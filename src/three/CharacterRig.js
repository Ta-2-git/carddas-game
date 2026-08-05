// =============================================================
//  CharacterRig — キャラ1体分の3D管理
// =============================================================
//  ・素体モデルの読み込み
//  ・モーションの切り替え（クロスフェード付き）
//  ・オーラの表示切り替え（通常 / 変身後 / 変身解除後）
//  ・「変身モーション開始から N フレーム目でオーラを出す」処理
//
//  App からは BattleStage3D / CharacterModel3D 経由で使うので、
//  普段このファイルを編集する必要はありません。
// =============================================================

import { loadGLTF, loadModelInstance, loadClips, pickClip, applyArmatureRotation } from "./gltfCache";
import { createKiAura } from "./KiAura";
import { getCharacter, MOTION } from "../data/characters";

const FADE = 0.18; // モーション切り替えにかける秒数

/** 現在時刻（ミリ秒）。performance が無い環境でも動くようにしておきます */
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** クリップの [start, end] 秒だけを取り出した新しいクリップを作ります */
function trimClip(THREE, clip, start, end) {
  const out = clip.clone();
  out.tracks = [];
  for (const track of clip.tracks) {
    const stride = track.getValueSize();
    const times = [];
    const values = [];
    const push = (t, srcIdx) => {
      times.push(t - start);
      for (let k = 0; k < stride; k++) values.push(track.values[srcIdx * stride + k]);
    };
    // 範囲内のキーを集める（範囲外の直前・直後のキーは端に丸めて必ず含める）
    let firstIdx = 0;
    for (let i = 0; i < track.times.length; i++) if (track.times[i] <= start) firstIdx = i;
    push(start, firstIdx);
    for (let i = 0; i < track.times.length; i++) {
      const t = track.times[i];
      if (t > start && t < end) push(t, i);
    }
    let lastIdx = track.times.length - 1;
    for (let i = track.times.length - 1; i >= 0; i--) if (track.times[i] >= end) lastIdx = i;
    push(end, lastIdx);

    const T = track.constructor;
    out.tracks.push(new T(track.name, times, values));
  }
  out.duration = end - start;
  out.resetDuration();
  return out;
}

export default class CharacterRig {
  constructor({ cardId, isEnemy = false, onReady = null, facingYDeg = null, onShot = null, preloadAll = false }) {
    this.THREE = window.THREE;
    this.cardId = cardId;
    this.config = getCharacter(cardId);
    this.isEnemy = isEnemy;
    this.onReady = onReady;
    // モーションが「腕を伸ばしきった瞬間」に呼ばれます（弾を出すタイミング）
    this.onShot = onShot;
    // 対戦画面だけ、待機以外のモーションも先読みします。
    // カード一覧などの表示では待機しか使わないので取りに行きません。
    this.preloadAll = preloadAll;
    // 指定があれば cfg.camera.rotationY より優先して、この向き（度）で固定する
    // （BattleStage3Dのように「敵と向き合わせたい」場面で使う）
    this.facingYDeg = facingYDeg;

    this.root = new this.THREE.Group();      // 位置・向きを持つ親
    this.modelGroup = new this.THREE.Group(); // 素体モデル
    this.auraGroup = new this.THREE.Group();  // オーラ
    this.root.add(this.modelGroup, this.auraGroup);

    this.mixer = null;
    this.actions = {};        // motionName -> AnimationAction
    this.current = null;      // 再生中の motion 名
    this.currentAction = null;
    this._boneFixes = [];     // 素体ごとの骨の向きのズレを打ち消す補正
    // 変身の指示は受けたが、まだ変身モーションの切り替え位置に達していない状態
    this._pendingTransformSwap = false;
    this._pendingSwapSince = 0;

    this.auraMeshes = {};     // "normal" | "transformed" | "reverted" -> Object3D
    this.auraMode = "normal";
    this.transformElapsed = -1; // 変身モーション開始からの経過秒（-1 = 再生していない）
    this.transformed = false;
    this.transformLevel = 0;    // 0=通常 / 1=変身後 / 2=第2段階

    this.disposed = false;
    this._loading = {}; // 読み込み中のモーション（name -> Promise）
    this._variants = {}; // 素体モデル（normal / transformed）
    this._activeKey = null;
    this._loopOverride = false; // true の間、1回再生のモーションも終わったら繰り返す
  }

  // ---------------------------------------------------------
  //  読み込み
  // ---------------------------------------------------------
  async load() {
    const THREE = this.THREE;
    const cfg = this.config;
    if (!cfg.model) return false;

    let gltf;
    try {
      // 2体目以降はキャッシュから複製されるので待ち時間がほぼありません
      gltf = await loadModelInstance(cfg.model);
    } catch (e) {
      console.warn("[CharacterRig] 素体モデルを読み込めません:", cfg.model, e);
      return false;
    }
    if (this.disposed) return false;

    this._installModel("normal", gltf.scene);
    this._activateModel("normal");

    // 素体GLBに入っているアニメも待機として使えるようにしておく
    this._builtinClips = gltf.animations || [];

    // 向き（敵は反転）。facingYDeg指定時はそちらを優先します
    if (this.facingYDeg != null) {
      this._baseYaw = (this.facingYDeg * Math.PI) / 180;
    } else {
      const rotDeg = (cfg.camera && cfg.camera.rotationY) || 0;
      const rot = (rotDeg * Math.PI) / 180;
      this._baseYaw = this.isEnemy ? Math.PI + rot : rot;
    }
    // 向きは modelGroup（素体の親）に掛けます。
    // 素体GLB自体は X軸-90度が焼き込まれた「Z-upのモデル」なので、
    // 素体に直接 rotation.y を掛けると、垂直軸ではなく傾いた軸で回って
    // キャラが横倒しになります。親を回せば必ず垂直軸で回せます。
    this.modelGroup.rotation.y = this._baseYaw;
    this._targetYaw = this._baseYaw;

    this._findBones();
    if (this._hipsBone) {
      const p = new THREE.Vector3();
      this._hipsBone.getWorldPosition(p);
      this.root.worldToLocal(p);
      this._hipsRestY = p.y; // 立っているときの腰の高さ
    }

    // 変身後のモデルがあれば裏で用意しておきます（変身時に待たせないため）
    if (cfg.transformedModel) this._prepareTransformedModel(cfg.transformedModel, "transformed");
    if (cfg.transformedModel2) this._prepareTransformedModel(cfg.transformedModel2, "transformed2");

    // まず待機モーションだけを確実に用意します。
    // ここを他のモーションと同時にダウンロードすると帯域を奪い合って
    // いつまでも棒立ち（素体のポーズのまま）になるため、必ず先に取ります。
    await this._loadMotion(MOTION.IDLE);
    if (this.disposed) return false;
    this.play(MOTION.IDLE, { immediate: true });

    // 読み込み前に指定されていたモーションがあれば、ここで再生します
    if (this._queuedMotion) {
      const q = this._queuedMotion;
      this._queuedMotion = null;
      if (q.name !== MOTION.IDLE) this.play(q.name, q.opts);
    }

    this._loadAuras(); // オーラは待たずに裏で読み込む
    if (this.preloadAll) this._preloadRest();

    if (this.onReady) this.onReady(this);
    return true;
  }

  // ---------------------------------------------------------
  //  素体モデル（通常 / 変身後）の管理
  // ---------------------------------------------------------
  /** 読み込んだモデルを登録します（まだ表示はしません） */
  _installModel(key, scene) {
    const THREE = this.THREE;
    const mixer = new THREE.AnimationMixer(scene);
    mixer.addEventListener("finished", (e) => {
      // 表示中のモデルのものだけ扱います（裏に控えているモデルは無視）
      if (!this.disposed && this._variants[this._activeKey] &&
          this._variants[this._activeKey].mixer === mixer) {
        this._handleFinished(e.action);
      }
    });
    scene.visible = false;
    this.modelGroup.add(scene);
    this._variants[key] = { scene, mixer, actions: {} };
  }

  /** 表示するモデルを切り替えます */
  _activateModel(key) {
    const v = this._variants[key];
    if (!v || this._activeKey === key) return;

    // 切り替え前の再生位置を覚えておきます。
    // ここで頭から再生し直すと、たとえば被弾モーションの途中で変身が
    // 解除されたときに「もう一度殴られて倒れる」動きが再生されてしまいます。
    const cur = this.current;
    const resumeTime = this.currentAction ? this.currentAction.time : 0;

    for (const k of Object.keys(this._variants)) {
      this._variants[k].scene.visible = k === key;
    }
    // 裏に回るモデルのモーションは全部止めます。
    // 残したままだと、戻ってきたときに古いアクションが重みを持ったままになり、
    // 新しいモーションと混ざって妙なポーズになります。
    if (this.mixer) this.mixer.stopAllAction();
    if (v.mixer) v.mixer.stopAllAction();

    this._activeKey = key;
    this.model = v.scene;
    this.mixer = v.mixer;
    this.actions = v.actions;
    this.currentAction = null;
    this._findBones();

    // 今のモーションを、同じ再生位置から新しいモデルで続けます
    this.current = null;
    if (cur) this.play(cur, { immediate: true, resumeTime });
    else this.play(MOTION.IDLE, { immediate: true });
  }

  _findBones() {
    if (!this.model) return;
    this.model.updateMatrixWorld(true);
    this._hipsBone = null; this._headBone = null;
    this.model.traverse((o) => {
      if (!o.isBone) return;
      if (!this._hipsBone && o.name === "Hips") this._hipsBone = o;
      if (!this._headBone && o.name === "Head") this._headBone = o;
    });
    this._collectBoneFixes();
  }

  /**
   * 素体ごとの「骨の向きのズレ」を打ち消す補正を集めます。
   * 設定は characters.js の boneFix（素体の種類ごとに骨名→クォータニオン）。
   * モーションは骨の回転をそのまま書き込むので、素体側のバインド姿勢が
   * 基準（悟空）とずれているとその分だけ見た目がずれます。
   */
  _collectBoneFixes() {
    const THREE = this.THREE;
    this._boneFixes = [];
    const table = (this.config.boneFix || {})[this._activeKey];
    if (!table || !this.model) return;
    this.model.traverse((o) => {
      if (!o.isBone) return;
      const q = table[o.name];
      if (!q) return;
      this._boneFixes.push({
        bone: o,
        fix: new THREE.Quaternion(q[0], q[1], q[2], q[3]),
        last: new THREE.Quaternion(),
        wrote: false,
      });
    });
  }

  /**
   * モーションが書き込んだ回転に補正を掛けます（毎フレーム、mixerの直後）。
   * 掛けたあとの値を覚えておき、次のフレームでそれと同じなら
   * 「モーション側がその骨を動かしていない」と判断して掛け直しません。
   * こうしないと、頭のトラックを持たないモーションで回り続けてしまいます。
   */
  _applyBoneFixes() {
    if (!this._boneFixes || !this._boneFixes.length) return;
    for (const f of this._boneFixes) {
      if (f.wrote && f.bone.quaternion.equals(f.last)) continue;
      f.bone.quaternion.multiply(f.fix);
      f.last.copy(f.bone.quaternion);
      f.wrote = true;
    }
  }

  /** 変身後のモデルを裏で読み込んでおきます（key: transformed / transformed2） */
  async _prepareTransformedModel(url, key = "transformed") {
    try {
      const gltf = await loadModelInstance(url);
      if (this.disposed || this._variants[key]) return;
      this._installModel(key, gltf.scene);
      // 読み込み前に変身していた場合は、ここで反映します
      if (this.transformed && this.auraMode === "transformed") this._applyModelForState();
    } catch (e) {
      console.warn("[CharacterRig] 変身後モデルを読み込めません:", url, e);
    }
  }

  /**
   * 骨に当たらないトラックを捨てます。
   *
   * FBXのモーションには骨のほかに「Armature001」のような入れ物ノードの
   * トラックが入っています。素体GLBの入れ物ノード名がたまたまこれと一致すると、
   * そのノードの scale が 1 に上書きされ、モデルが100倍の大きさになります
   * （素体は "Armature" なので当たらず、変身後だけ巨大化していました）。
   * 骨以外のトラックは使わないので、ここで落としておきます。
   */
  _stripNonBoneTracks(clip) {
    const THREE = this.THREE;
    if (!this.model) return clip;
    const bones = new Set();
    this.model.traverse((o) => {
      if (o.isBone) bones.add(THREE.PropertyBinding.sanitizeNodeName(o.name));
    });
    if (!bones.size) return clip;
    const keep = clip.tracks.filter((t) => {
      const i = t.name.lastIndexOf(".");
      const node = i >= 0 ? t.name.slice(0, i) : t.name;
      return bones.has(THREE.PropertyBinding.sanitizeNodeName(node));
    });
    if (keep.length === clip.tracks.length) return clip;
    return new THREE.AnimationClip(clip.name, clip.duration, keep);
  }

  /**
   * モーションの向きを素体に合わせます。
   *
   * Blenderの書き出し設定によって、そのまま使える場合と、アーマチュアの
   * 回転（X軸-90度など）を焼き込む必要がある場合があります。
   * 決め打ちにすると書き出し方を変えた途端に破綻するため、
   * 最初の1回だけ実際に素体の骨へ当ててみて、
   * 「頭が腰より上に来る方」を採用します。
   */
  _orientClip(rawClip, armatureQuaternion) {
    if (!armatureQuaternion) return rawClip;

    if (this._axisFix == null) {
      this._axisFix = this._detectAxisFix(rawClip, armatureQuaternion);
      console.info(
        "[CharacterRig] モーションの向き補正:",
        this._axisFix ? "あり（メッシュ込み書き出し）" : "なし（アーマチュアのみ書き出し）"
      );
    }
    return this._axisFix ? applyArmatureRotation(rawClip, armatureQuaternion) : rawClip;
  }

  /** 補正あり/なしを実際に当てて比べ、正しく立つ方を選びます */
  _detectAxisFix(rawClip, R) {
    const THREE = this.THREE;
    if (!this._hipsBone || !this._headBone || !this.model) return false;

    const uprightness = (clip) => {
      const mixer = new THREE.AnimationMixer(this.model);
      const action = mixer.clipAction(clip);
      action.play();
      mixer.setTime(0);
      this.model.updateMatrixWorld(true);
      const hips = new THREE.Vector3();
      const head = new THREE.Vector3();
      this._hipsBone.getWorldPosition(hips);
      this._headBone.getWorldPosition(head);
      action.stop();
      mixer.uncacheClip(clip);
      mixer.uncacheRoot(this.model);
      return head.y - hips.y; // 頭が腰よりどれだけ上か
    };

    let plain = -Infinity;
    let fixed = -Infinity;
    try { plain = uprightness(rawClip); } catch (e) { /* 判定できなければ補正なし扱い */ }
    try { fixed = uprightness(applyArmatureRotation(rawClip, R)); } catch (e) { /* 同上 */ }
    return fixed > plain;
  }

  /**
   * 残りのモーションを裏で先読みします。
   * モーション1本が十数MBあるため、同時に何本も落とすとどれも遅くなります。
   * 1本ずつ順番に取得して、必要になった時に間に合うようにします。
   */
  async _preloadRest() {
    for (const name of Object.values(MOTION)) {
      if (name === MOTION.IDLE) continue;
      if (this.disposed) return;
      await this._loadMotion(name);
    }
  }

  /**
   * 必要になったモーションだけ読み込みます（初回表示を軽くするため）。
   * 先読みと再生要求が重なっても取りこぼさないよう、読み込み中の場合は
   * 同じ Promise を返して「読み終わるまで待つ」ようにしています。
   * （ここで null を返すと、呼び出し側が待機モーションへ差し替えてしまい、
   *   必殺技や変身が再生されないことがありました）
   */
  _loadMotion(name) {
    if (this.actions[name]) return Promise.resolve(this.actions[name]);
    this._loading = this._loading || {};
    // 読み込み中の管理は「モデルごと」に分けます。
    // ここを名前だけで共有すると、読み込み中に変身でモデルが入れ替わったとき、
    // 別のモデルのミキサーに紐づいたアクションが返ってきて動きが壊れます。
    const key = (this._activeKey || "normal") + ":" + name;
    if (this._loading[key]) return this._loading[key];
    const p = this._loadMotionInner(name).then((action) => {
      delete this._loading[key];
      return action;
    }, (err) => {
      delete this._loading[key];
      console.warn("[CharacterRig] モーションを読み込めません:", name, err);
      return null;
    });
    this._loading[key] = p;
    return p;
  }

  async _loadMotionInner(name) {
    const m = (this.config.motions || {})[name];
    const THREE = this.THREE;

    // 一度用意したクリップは覚えておきます。
    // （変身でモデルを入れ替えても、切り出しをやり直さずに済みます）
    this._clips = this._clips || {};
    let clip = this._clips[name] || null;

    if (!clip) {
      if (m && m.file) {
        const data = await loadClips(m.file);
        const raw0 = pickClip(data.clips, m.clip);
        const raw = raw0 ? this._stripNonBoneTracks(raw0) : null;
        if (raw) clip = this._orientClip(raw, data.armatureQuaternion);
      }
      // 待機モーションだけは、ファイルが無い/読み込めない場合でも
      // 素体モデルに入っているアニメで代用します（棒立ちを避けるため）
      if (!clip && name === MOTION.IDLE) {
        clip = pickClip(this._builtinClips, m && m.clip);
      }
      if (clip && m && (m.trimStart != null || m.trimEnd != null)) {
        // trimStart / trimEnd（秒）で使う範囲を切り出します。
        // 素材の前後にある不要な部分（助走のパンチ、最後の静止など）を落とす用です。
        const s = Math.max(0, m.trimStart || 0);
        const e = Math.min(clip.duration, m.trimEnd != null ? m.trimEnd : clip.duration);
        if (e > s) clip = trimClip(THREE, clip, s, e);
      }
      if (clip) this._clips[name] = clip;
    }

    if (this.disposed || !clip || !this.mixer) return null;

    const action = this.mixer.clipAction(clip);
    const loop = m ? m.loop !== false : true;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    // duration（秒）を指定すると、その長さで再生し終わるよう速度を自動調整します
    if (m && m.duration && clip.duration > 0) {
      action.timeScale = clip.duration / m.duration;
    } else {
      action.timeScale = (m && m.speed) || 1;
    }
    this.actions[name] = action;
    this._motionMeta = this._motionMeta || {};
    // shotAt（素材上で腕を伸ばしきる時刻）を、実際の再生時間に直しておきます。
    // これを使って「モーションが本当にその瞬間に来たとき」に弾を出します。
    let shotTime = -1;
    if (m && m.shotAt != null) {
      const s = Math.max(0, m.trimStart || 0);
      shotTime = Math.max(0, (m.shotAt - s) / (Math.abs(action.timeScale) || 1));
    }
    this._motionMeta[name] = {
      loop,
      hold: Boolean(m && m.hold),
      faceCamera: Boolean(m && m.faceCamera),
      shotTime,
    };
    return action;
  }

  // ---------------------------------------------------------
  //  モーション再生
  // ---------------------------------------------------------
  /**
   * @param {string} name  MOTION.* の値
   * @param {object} opts  { immediate: フェードなしで即切替 }
   */
  play(name, opts = {}) {
    if (this.disposed) return;
    // 素体の読み込みが終わる前に指定された場合は覚えておき、
    // 読み込み完了後に再生します（開始直後の変身モーション等が消えないように）
    if (!this.mixer) { this._queuedMotion = { name, opts }; return; }
    if (this.current === name && !opts.force) return;

    const start = (action) => {
      if (!action || this.disposed) return;
      const prev = this.currentAction;
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.play();
      if (prev && prev !== action) {
        // 再生し終わって最後のポーズで止まっている（paused）モーションは
        // クロスフェードで薄れてくれないことがあるため、確実に止めます。
        // これを取りこぼすと前のポーズが残り続けます（変身後に固まる原因）。
        if (opts.immediate || prev.paused) prev.stop();
        else prev.crossFadeTo(action, FADE, false);
      }
      const dur = action.getClip().duration;
      const ts = Math.abs(action.timeScale) || 1;
      // モデルを入れ替えたときは、同じ再生位置から続けます
      let at = 0;
      if (opts.resumeTime != null && opts.resumeTime > 0) {
        at = Math.min(opts.resumeTime, Math.max(0, dur - 1e-4));
        action.time = at;
      }
      const elapsed = at / ts; // 開始からの実時間（秒）
      const prevName = this.current;

      this.currentAction = action;
      this.current = name;
      this._applyFacing(name);

      // 1回再生のモーションは、経過時間でも終了を判定します。
      // （finished イベントに取りこぼしがあっても必ず待機へ戻すため）
      const meta = (this._motionMeta || {})[name] || {};
      if (!meta.loop && !meta.hold) {
        this._oneShotLeft = Math.max(0.001, dur / ts - elapsed);
      } else {
        this._oneShotLeft = -1;
      }
      // 弾を出すモーションなら、その瞬間までのカウントダウンを開始します。
      // モーションの読み込みが遅れても、実際に再生が始まってから数えるので
      // 「腕を伸ばす前に弾が出る」ことがありません。
      if (meta.shotTime != null && meta.shotTime >= 0) {
        const left = meta.shotTime - elapsed;
        this._shotLeft = left > 0 ? left : -1; // 既に過ぎていれば撃たない
      } else {
        this._shotLeft = -1;
      }

      // 変身モーションならフレーム計測を開始
      this.transformElapsed = name === MOTION.TRANSFORM ? elapsed : -1;

      // 変身モーションが終わって別のモーションへ移る瞬間
      //（＝変身し終わって立ち上がったポーズ）でモデルを入れ替えます。
      // startFrame をモーションの最後に置くと、終わって待機へ戻る処理のほうが
      // 先に走って切り替えを取りこぼすことがあるので、その受け皿です。
      // この行より上で this.current を確定させてから呼びます。モデルの
      // 入れ替えは「今のモーションを新しいモデルで続ける」処理を含むためです。
      if (name !== MOTION.TRANSFORM && prevName === MOTION.TRANSFORM && this._pendingTransformSwap) {
        this._doTransformSwap();
      }
    };

    const existing = this.actions[name];
    if (existing) { start(existing); return; }

    // 未読み込みなら、読み込みを待ってから再生します。
    // この間も今のモーションは流れたままにします（棒立ちにしないため）。
    const req = (this._playSeq = (this._playSeq || 0) + 1);
    this._loadMotion(name).then((action) => {
      if (this.disposed) return;
      // 待っている間に別のモーションが指定されていたら、そちらを優先します
      if (req !== this._playSeq) return;
      if (action) { start(action); return; }
      // 読み込めなかった場合、何も再生していない時だけ待機で代用します。
      // （再生中のモーションを消してしまうと素体のポーズで固まるため）
      if (!this.currentAction && name !== MOTION.IDLE) this.play(MOTION.IDLE);
    });
  }

  /** 1回再生のモーションが終わったら待機へ戻す（loopOverride中は繰り返す） */
  _handleFinished(action) {
    const name = Object.keys(this.actions).find((k) => this.actions[k] === action);
    if (!name) return;
    if (this._loopOverride) { this.play(name, { force: true, immediate: true }); return; }
    const meta = (this._motionMeta || {})[name] || {};
    if (meta.hold) return;         // 最後のポーズで止める設定
    if (name === MOTION.IDLE) return;
    this.play(MOTION.IDLE);
  }

  /** ドラゴンバースト中など、1回再生のモーションを終了まで繰り返させたい時に使います */
  setLoopOverride(active) {
    this._loopOverride = Boolean(active);
  }

  /**
   * モーションごとの向きを反映します。
   * faceCamera: true のモーション（変身・必殺技など）は、相手ではなく
   * 画面の正面を向いて再生します。
   */
  _applyFacing(name) {
    const meta = (this._motionMeta || {})[name] || {};
    // 実際の回転は update() で少しずつ寄せます（急に向きが変わらないように）
    this._targetYaw = meta.faceCamera ? 0 : (this._baseYaw || 0);
  }

  // ---------------------------------------------------------
  //  オーラ
  // ---------------------------------------------------------
  async _loadAuras() {
    const modes = ["normal", "transformed", "transformed2", "reverted"];
    for (const mode of modes) {
      const a = (this.config.aura || {})[mode];
      if (!a || !a.enabled) continue;

      // GLBが指定されていればそれを使い、無ければシェーダーでオーラを生成します
      let obj = null;
      if (a.model) {
        try {
          const gltf = await loadGLTF(a.model);
          obj = gltf.scene;
          this._tintAura(obj, a);
        } catch (e) {
          console.warn("[CharacterRig] オーラGLBを読み込めません:", a.model, e);
        }
      }
      if (!obj) {
        obj = createKiAura(this.THREE, {
          color: a.color,
          boltColor: a.boltColor,
          opacity: a.opacity != null ? a.opacity : 0.9,
          thunder: Boolean(a.thunder),
          // 段階ごとに濃さ・稲妻の強さを変えられます
          backIntensity: a.backIntensity,
          frontIntensity: a.frontIntensity,
          boltIntensity: a.boltIntensity,
          boltLayers: a.boltLayers,
          // オーラは腰の位置を基準に置き、体と一緒に動くようにします
          anchorY: this._hipsRestY != null ? this._hipsRestY : 0.8,
        });
      }
      if (this.disposed) return;

      obj.scale.setScalar(a.scale || 1);
      obj.position.y = a.yOffset || 0;
      obj.visible = false;
      obj.renderOrder = 2;
      this.auraMeshes[mode] = obj;
      this.auraGroup.add(obj);
    }
    this._applyAuraVisibility();
  }

  /** オーラの色・濃さをまとめて設定します（GLBオーラを使う場合のみ） */
  _tintAura(obj, a) {
    const THREE = this.THREE;
    const color = new THREE.Color(a.color || "#ffffff");
    const opacity = a.opacity != null ? a.opacity : 0.7;

    obj.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map((m) => {
        const nm = m.clone(); // 他キャラと共有しないよう複製
        if (nm.color) nm.color.copy(color);
        if (nm.emissive) nm.emissive.copy(color);
        if ("emissiveIntensity" in nm) nm.emissiveIntensity = 2.0;
        nm.transparent = true;
        nm.opacity = opacity;
        nm.depthWrite = false;
        nm.blending = THREE.AdditiveBlending;
        nm.side = THREE.DoubleSide;
        return nm;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
  }

  _applyAuraVisibility() {
    for (const mode of Object.keys(this.auraMeshes)) {
      this.auraMeshes[mode].visible = mode === this.auraMode;
    }
  }

  /** 変身状態を切り替えます（true=変身後 / false=解除後） */
  setTransformed(on) {
    this.setTransformLevel(on ? 1 : 0);
  }

  /**
   * 変身の段階を指定します。
   *   0 = 通常 / 1 = transformedModel / 2 = transformedModel2
   * ゴテンクスやGokuSS3のような多段変身で使います。
   */
  setTransformLevel(level) {
    const lv = Math.max(0, Math.min(2, level | 0));
    if (this.transformLevel === lv) return;
    const prev = this.transformLevel || 0;
    this.transformLevel = lv;
    this.transformed = lv > 0;
    if (lv === 0) {
      this._pendingTransformSwap = false;
      this.auraMode = "reverted";
      this._applyAuraVisibility();
      this._applyModelForState(); // 解除時は見た目もすぐ元に戻す
    } else if (lv < prev) {
      // 段階が下がるときは、変身モーションを待たずにすぐ切り替えます
      this._pendingTransformSwap = false;
      this._applyModelForState();
    } else {
      // 段階が上がる場合、オーラとモデルは「変身モーションの startFrame に
      // 到達したら」同時に切り替えます（update 内で処理）。
      // それまでは切り替えを保留にしておきます。この印が無いと、変身モーション
      // がまだ始まっていない一瞬のあいだに update の受け皿処理が走ってしまい、
      // startFrame を何フレームにしてもすぐ切り替わってしまいます。
      this._pendingTransformSwap = true;
      this._pendingSwapSince = now();
    }
  }

  /** オーラとモデルを、いまの変身段階の見た目に切り替えます */
  _doTransformSwap() {
    this._pendingTransformSwap = false;
    this.transformed = true;
    this.auraMode = this._wantedAuraMode();
    this._applyAuraVisibility();
    this._applyModelForState();
  }

  /** 今の変身段階で表示すべきオーラの種類を返します */
  _wantedAuraMode() {
    const lv = this.transformLevel || 0;
    if (lv >= 2 && this.auraMeshes.transformed2) return "transformed2";
    return "transformed";
  }

  /** 今の変身段階で表示すべきモデルの種類を返します */
  _wantedVariant() {
    const lv = this.transformLevel || 0;
    if (lv >= 2 && this._variants.transformed2) return "transformed2";
    if (lv >= 1 && this._variants.transformed) return "transformed";
    return "normal";
  }

  /** 変身状態に合わせて、表示するモデルを選びます */
  _applyModelForState() {
    const want = this._wantedVariant();
    if (this._variants[want]) this._activateModel(want);
  }

  // ---------------------------------------------------------
  //  毎フレーム更新
  // ---------------------------------------------------------
  update(dt) {
    if (this.disposed) return;
    if (this.mixer) this.mixer.update(dt);
    this._applyBoneFixes();

    // --- 向きをなめらかに変える ---
    // 必殺技や気弾は素体の向きが変わるので、切り替え時に一瞬で
    // 回らないよう少しずつ回します（その場でくるっと向き直る感じ）
    if (this._targetYaw != null) {
      const cur = this.modelGroup.rotation.y;
      let diff = this._targetYaw - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.002) this.modelGroup.rotation.y = this._targetYaw;
      else this.modelGroup.rotation.y = cur + diff * Math.min(1, dt * 12);
    }

    // --- 変身オーラの開始判定 ---
    if (this.transformElapsed >= 0) {
      this.transformElapsed += dt;
      const t = (this.config.aura || {}).transformed;
      if (t && t.enabled) {
        const fps = this.config.fps || 30;
        const startSec = (t.startFrame || 0) / fps;
        // 段階が上がるとき（1→2）は auraMode が既に transformed のままなので、
        // 表示すべきモデルが変わったかどうかも見て切り替えます。
        const wantAura = this._wantedAuraMode();
        const needSwap = this._activeKey !== this._wantedVariant();
        if (this.transformElapsed >= startSec && (this.auraMode !== wantAura || needSwap)) {
          this._doTransformSwap(); // 変身し終わる瞬間にモデルも入れ替える
        }
      }
    } else if (this.transformed && this.auraMode !== this._wantedAuraMode() && this.auraMeshes.transformed) {
      // 変身モーションを再生していない（既に別のモーションへ移った / 用意が無い）場合は
      // 変身状態である限りオーラを出し続けます。
      // ただし「これから変身モーションを再生する」ところなら待ちます。
      // 変身の指示とモーションの指定は同じタイミングで届かないことがあり、
      // ここで先に切り替えてしまうと startFrame が効かなくなります。
      // モーションがいつまでも来ない場合の保険として1秒で打ち切ります。
      if (!this._pendingTransformSwap || now() - this._pendingSwapSince > 1000) {
        this._doTransformSwap();
      }
    }

    // --- オーラを体に追従させる ---
    // 腰の位置に置き、背骨（腰→頭）の向きに合わせて傾けます。
    // これで倒れたときもオーラが体と一緒に倒れます。
    if (this._hipsBone && this.auraGroup.children.length) {
      const THREE = this.THREE;
      this._v1 = this._v1 || new THREE.Vector3();
      this._v2 = this._v2 || new THREE.Vector3();
      this._up = this._up || new THREE.Vector3(0, 1, 0);
      const hips = this._v1, head = this._v2;
      this._hipsBone.getWorldPosition(hips);
      this.root.worldToLocal(hips);
      this.auraGroup.position.copy(hips);
      if (this._headBone) {
        this._headBone.getWorldPosition(head);
        this.root.worldToLocal(head);
        head.sub(hips);
        if (head.lengthSq() > 1e-6) {
          head.normalize();
          this.auraGroup.quaternion.setFromUnitVectors(this._up, head);
        }
      }
    }

    // --- オーラの更新 ---
    const aura = this.auraMeshes[this.auraMode];
    if (aura) {
      if (aura.userData.tick) {
        // 手続き型オーラ。揺らめきはシェーダー側で作るのでここでは時間だけ進めます
        aura.userData.tick(dt);
      } else {
        // GLBオーラ。少し脈動させて生気を出します
        const time = (this._t = (this._t || 0) + dt);
        const base = ((this.config.aura[this.auraMode] || {}).scale) || 1;
        const pulse = 1 + Math.sin(time * 4.2) * 0.05;
        aura.scale.set(base * pulse, base * (1 + Math.sin(time * 3.1) * 0.08), base * pulse);
        aura.rotation.y += dt * 0.6;
      }
    }

    // --- 弾を出す瞬間の通知 ---
    if (this._shotLeft > 0) {
      this._shotLeft -= dt;
      if (this._shotLeft <= 0) {
        const motion = this.current;
        this._shotLeft = -1;
        if (this.onShot) this.onShot(motion);
      }
    }

    // --- 1回再生の終了判定（経過時間ベース） ---
    // finished イベントも使っていますが、環境によって取りこぼすことがあるため
    // 再生時間でも必ず待機へ戻します。
    if (this._oneShotLeft > 0) {
      this._oneShotLeft -= dt;
      if (this._oneShotLeft <= 0) {
        this._oneShotLeft = -1;
        if (this.currentAction) this._handleFinished(this.currentAction);
      }
    }
  }

  // ---------------------------------------------------------
  dispose() {
    this.disposed = true;
    if (this.mixer) this.mixer.stopAllAction();
    this.root.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m && m.dispose && m.dispose());
      }
    });
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}
