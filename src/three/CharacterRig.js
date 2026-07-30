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

import { loadGLTF, loadClips, pickClip } from "./gltfCache";
import { createKiAura } from "./KiAura";
import { getCharacter, MOTION } from "../data/characters";

const FADE = 0.18; // モーション切り替えにかける秒数

export default class CharacterRig {
  constructor({ cardId, isEnemy = false, onReady = null, facingYDeg = null }) {
    this.THREE = window.THREE;
    this.cardId = cardId;
    this.config = getCharacter(cardId);
    this.isEnemy = isEnemy;
    this.onReady = onReady;
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

    this.auraMeshes = {};     // "normal" | "transformed" | "reverted" -> Object3D
    this.auraMode = "normal";
    this.transformElapsed = -1; // 変身モーション開始からの経過秒（-1 = 再生していない）
    this.transformed = false;

    this.disposed = false;
    this._pending = new Set();
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
      gltf = await loadGLTF(cfg.model);
    } catch (e) {
      console.warn("[CharacterRig] 素体モデルを読み込めません:", cfg.model, e);
      return false;
    }
    if (this.disposed) return false;

    this.model = gltf.scene;
    this.modelGroup.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);

    // 素体GLBに入っているアニメも待機として使えるようにしておく
    this._builtinClips = gltf.animations || [];

    // 向き（敵は反転）。facingYDeg指定時はそちらを優先します
    if (this.facingYDeg != null) {
      this.model.rotation.y = (this.facingYDeg * Math.PI) / 180;
    } else {
      const rotDeg = (cfg.camera && cfg.camera.rotationY) || 0;
      const rot = (rotDeg * Math.PI) / 180;
      this.model.rotation.y = this.isEnemy ? Math.PI + rot : rot;
    }

    // 待機モーションもFBXだとサイズが大きく数秒かかることがあるため、
    // ここではブロックせずに読み込みつつ（読み込み中は素体がTポーズのまま）
    // オーラや他モーションの先読みを並行して進める
    this.play(MOTION.IDLE, { immediate: true });

    // 読み込み前に指定されていたモーションがあれば、ここで再生します
    if (this._queuedMotion) {
      const q = this._queuedMotion;
      this._queuedMotion = null;
      if (q.name !== MOTION.IDLE) this.play(q.name, q.opts);
    }

    this._loadAuras(); // オーラは待たずに裏で読み込む

    // 他のモーションも裏で先読みしておく（技を出す瞬間に読み込み待ちで
    // 出遅れないように。FBXはファイルサイズが大きく数秒かかることがあるため）
    for (const name of Object.values(MOTION)) {
      if (name !== MOTION.IDLE) this._loadMotion(name);
    }

    if (this.onReady) this.onReady(this);
    return true;
  }

  /** 必要になったモーションだけ読み込みます（初回表示を軽くするため） */
  async _loadMotion(name) {
    if (this.actions[name] || this._pending.has(name)) return this.actions[name] || null;
    const m = (this.config.motions || {})[name];
    this._pending.add(name);

    let clip = null;
    if (m && m.file) {
      const clips = await loadClips(m.file);
      clip = pickClip(clips, m.clip);
    } else if (name === MOTION.IDLE) {
      clip = pickClip(this._builtinClips, m && m.clip);
    }

    this._pending.delete(name);
    if (this.disposed || !clip || !this.mixer) return null;

    const THREE = this.THREE;
    const action = this.mixer.clipAction(clip);
    const loop = m ? m.loop !== false : true;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.timeScale = (m && m.speed) || 1;
    this.actions[name] = action;
    this._motionMeta = this._motionMeta || {};
    this._motionMeta[name] = { loop, hold: Boolean(m && m.hold) };
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
      if (prev && prev !== action && !opts.immediate) {
        prev.crossFadeTo(action, FADE, false);
      } else if (prev && prev !== action) {
        prev.stop();
      }
      this.currentAction = action;
      this.current = name;

      // 変身モーションならフレーム計測を開始
      this.transformElapsed = name === MOTION.TRANSFORM ? 0 : -1;
    };

    const existing = this.actions[name];
    if (existing) { start(existing); return; }

    // 未読み込みなら読み込んでから再生（間は待機のまま）
    this._loadMotion(name).then((action) => {
      if (action) start(action);
      else if (name !== MOTION.IDLE) this.play(MOTION.IDLE); // 用意されていなければ待機で代用
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

  // ---------------------------------------------------------
  //  オーラ
  // ---------------------------------------------------------
  async _loadAuras() {
    const modes = ["normal", "transformed", "reverted"];
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
    if (this.transformed === on) return;
    this.transformed = on;
    if (!on) {
      this.auraMode = "reverted";
      this._applyAuraVisibility();
    }
    // on の場合は「変身モーションの startFrame に到達したら」出すので
    // ここでは切り替えません（update 内で処理）
  }

  // ---------------------------------------------------------
  //  毎フレーム更新
  // ---------------------------------------------------------
  update(dt) {
    if (this.disposed) return;
    if (this.mixer) this.mixer.update(dt);

    // --- 変身オーラの開始判定 ---
    if (this.transformElapsed >= 0) {
      this.transformElapsed += dt;
      const t = (this.config.aura || {}).transformed;
      if (t && t.enabled) {
        const fps = this.config.fps || 30;
        const startSec = (t.startFrame || 0) / fps;
        if (this.transformElapsed >= startSec && this.auraMode !== "transformed") {
          this.transformed = true;
          this.auraMode = "transformed";
          this._applyAuraVisibility();
        }
      }
    } else if (this.transformed && this.auraMode !== "transformed" && this.auraMeshes.transformed) {
      // 変身モーションを再生していない（既に別のモーションへ移った / 用意が無い）場合は
      // 変身状態である限りオーラを出し続けます
      this.auraMode = "transformed";
      this._applyAuraVisibility();
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

    // --- 1回再生の終了検知 ---
    if (this.currentAction && !this.currentAction.isRunning() && this.current !== MOTION.IDLE) {
      const meta = (this._motionMeta || {})[this.current] || {};
      if (!meta.loop) this._handleFinished(this.currentAction);
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
