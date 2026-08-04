// =============================================================
//  キャラクター設定ファイル
// =============================================================
//  ここだけを編集すれば、キャラの追加・差し替えができます。
//  App.jsx を触る必要はありません。
//
//  【新しいキャラを追加する手順】
//   1. 下の CHARACTERS に "カードID": { ... } を追加する
//   2. 各項目の URL を自分の R2 のファイルに差し替える
//   3. 保存 → GitHub に push すれば反映されます
//
//  【空欄にした場合】
//   URL が "" のものは自動で代替表示になります。
//   （モーションなら待機モーションで代用、オーラなら簡易オーラを自動生成）
//   まだ作っていないモーションは "" のままで大丈夫です。
// =============================================================

const R2 = "https://pub-cc2639bfd1b440dbab289c6b875da6bb.r2.dev";

// -------------------------------------------------------------
// オーラのプリセット（色だけ指定すればOK）
// -------------------------------------------------------------
//  オーラは GLB を使わず、Three.js のシェーダーで生成します
//  （src/three/KiAura.js）。ここで色を決めるだけで見た目が変わります。
//    color     … オーラ本体の色（中心は白く光り、外側がこの色になります）
//    boltColor … 内側に走る稲妻の色
//  独自の色にしたい場合は、プリセットを使わず
//  { enabled: true, color: "#xxxxxx", boltColor: "#xxxxxx" } と直接書けます。
// -------------------------------------------------------------
export const AURA_PRESETS = {
  white:  { color: "#e8f2ff", boltColor: "#bfe9ff" },
  yellow: { color: "#ffcc11", boltColor: "#7fdfff" },
  // スーパーサイヤ人用。髪の色を実測すると (249,207,88) で、
  // yellow(255,204,17) とは赤・緑がほぼ同じため髪がオーラに埋もれます。
  // 緑を落とした橙寄りの金色にして、金髪が浮き上がるようにしています。
  gold:   { color: "#ff8c00", boltColor: "#7fdfff" },
  red:    { color: "#ff2010", boltColor: "#ffd8a0" },
  blue:   { color: "#1058ff", boltColor: "#a8ecff" },
  purple: { color: "#9e1aff", boltColor: "#e6b4ff" },
};

// -------------------------------------------------------------
// 各項目の意味
// -------------------------------------------------------------
//  model      … 素体モデル（スキン付きGLB）。全モーションはこの骨に流し込みます
//  fps        … Blenderで作った時のフレームレート。変身オーラの開始フレーム計算に使います
//  camera     … 表示時のカメラ（cameraY:高さ / cameraZ:距離 / lookAtY:注視点 / rotationY:向き(度)）
//
//  motions    … モーション。file にモーション入りGLB/FBXのURLを指定します
//               clip       : ファイル内のアニメーション名（省略時は最初のもの）
//               loop       : true=ループ / false=1回だけ再生して待機に戻る
//               speed      : 再生速度（1.0=等速、2.0=倍速）
//               duration   : 「何秒で再生し終えるか」。速度を自動計算します
//                            （speed より優先。素材が長すぎる時に便利）
//               trimStart  : 素材の先頭を何秒スキップするか
//               trimEnd    : 素材の何秒目で打ち切るか
//                            （不要な助走や、最後の静止部分を落とす用）
//               hold       : true にすると再生後、最後のポーズで止まったままになります
//               faceCamera : true にすると相手ではなく画面の正面を向いて再生します
//                            （変身・必殺技など、見せ場のモーション向け）
//
//  kiBlast    … 気弾（model 省略時は color の光る球を自動生成）
//               effect: "sphere"=球 / "beam"=ビーム / "disc"=円盤 / "none"=見た目なし
//  ultimate   … 必殺技（項目は kiBlast と同じ）
//
//  aura.normal      … 通常時のオーラ
//  aura.transformed … 変身後のオーラ
//        startFrame : 変身モーション開始から何フレーム目でオーラを出すか
//                     （以降ずっと出続けます）
//  aura.reverted    … 変身解除後のオーラ
//
//  オーラ共通:  enabled(出すか) / scale(大きさ) / opacity(濃さ) / yOffset(高さ調整)
//               color(本体の色) / boltColor(稲妻の色)
// -------------------------------------------------------------

// 未設定キャラに使う既定値
export const DEFAULT_CHARACTER = {
  model: "",
  fps: 30,
  camera: { cameraY: 1.2, cameraZ: 4.0, lookAtY: 0.8, rotationY: 0 },
  motions: {
    idle:          { file: "", loop: true },
    melee:         { file: "", loop: false },
    kiBlast:       { file: "", loop: false },
    ultimate:      { file: "", loop: false },
    // hold は付けません。付けると再生後に最後のポーズで固まったままになり、
    // 待機モーションへ戻らなくなります（オーラは別管理なので消えません）。
    transform:     { file: "", loop: false },
    hitByMelee:    { file: "", loop: false },
    hitByKiBlast:  { file: "", loop: false },
    hitByUltimate: { file: "", loop: false },
  },
  kiBlast:  { model: "", color: "#9ecbff", effect: "sphere", scale: 0.28, speed: 6 },
  ultimate: { model: "", color: "#66ccff", effect: "beam",   scale: 1.0,  speed: 8 },
  aura: {
    normal:      { enabled: false, ...AURA_PRESETS.white,  scale: 1.0, opacity: 0.7, yOffset: 0 },
    transformed: { enabled: false, ...AURA_PRESETS.yellow, scale: 1.15, opacity: 0.95, yOffset: 0, startFrame: 30 },
    reverted:    { enabled: false, ...AURA_PRESETS.white,  scale: 1.0, opacity: 0.7, yOffset: 0 },
  },
};

// =============================================================
//  孫悟空の共通設定
// =============================================================
//  No.001 孫悟空 と No.002 GokuSS1 で、モデル・モーション・技は同じものを
//  使います。差分（変身後のモデルやオーラの色）だけを各キャラで上書きします。
// =============================================================
const GOKU_BASE = {
    name: "孫悟空",
    model: `${R2}/goku1_idle.glb`,
    fps: 30,
    // rotationY は「度」で指定します（カード一覧・VS画面など単体表示用。
    // 対戦画面は BattleStage3D 側で敵と向き合う向きに固定するので無関係です）。
    // 待機モーションが goku1_idle.glb だった頃は、そのGLBに約-55度のヨーが
    // 焼き込まれていたため、それを打ち消す 58 を指定していました。
    // Goku_Motion.fbx は焼き込みヨーがほぼ0度なので 0 にしています。
    camera: { cameraY: 1.2, cameraZ: 2.7, lookAtY: 0.8, rotationY: 0 },

    motions: {
      idle: { file: `${R2}/Goku_Motion.fbx`, loop: true },

      // 素材は「パンチ2回→膝蹴り→キック」のコンボ1セット。
      // 以前パンチが4回に見えていたのは、接近(dash)と攻撃(punch)の両方が
      // このモーションに割り当てられ2回再生されていたためで、素材側は正常です。
      melee: { file: `${R2}/Goku_Combo.fbx`, loop: false },

      // ↓ 数値はすべて、実際の素材を素体の骨に当てて計測した値です。
      //   素材を差し替えたら測り直してください。

      // 素材9.1秒。1.5秒で相手側へ腕を伸ばしきって気弾が出て、
      // そのあと5秒以上その姿勢のまま静止するので2.0秒で切り捨て。
      // faceCamera は「正面向き→相手側へ振り向いて撃つ」動きが素材に
      // 入っているため、向きを素材に任せる指定です。
      kiBlast: { file: `${R2}/Goku_KiBlast.fbx`, loop: false, trimEnd: 2.0, duration: 1.5, faceCamera: true, shotAt: 1.5 },

      // 素材8.3秒。0〜4.5秒が溜め、4.6秒から腕が前に出て5.0秒で伸びきる
      // （実測: 手と腰の距離が 4.5秒で4.9→4.75秒で23.6→5.0秒で35.9）。
      // 6.5秒までを3秒に詰めて全フレーム再生する。
      // shotAt は「伸びきる直前」の4.7に置き、動画の立ち上がり分を先取りします。
      ultimate: { file: `${R2}/Goku_Kamehameha.fbx`, loop: false, trimEnd: 6.5, duration: 3.0, faceCamera: true, shotAt: 4.7 },

      // 素材8.3秒。3.0秒で気が爆発して立ち上がる（腰が0.73→0.78に上がる）。
      // 5.5秒までを2秒に詰めて全フレーム再生する。
      // hold は付けません（再生後は待機へ戻す。オーラは別管理なので消えません）
      transform: { file: `${R2}/Goku_変身.fbx`, loop: false, trimEnd: 5.5, duration: 2.0, faceCamera: true },

      hitByMelee:    { file: `${R2}/Goku_Receive.fbx`, loop: false },
      hitByKiBlast:  { file: "", loop: false },
      hitByUltimate: { file: "", loop: false },
    },

    kiBlast:  { model: "", color: "#ffd21a", effect: "sphere", scale: 0.30, speed: 6 },

    // かめはめ波は動画エフェクトを使います（public/kamehameha.mp4）。
    // 黒背景の動画を加算合成で重ねるので、黒い部分は自然に透けます。
    //   videoSpan    : 2人の間の距離の何倍の幅で出すか（1.15＝少しはみ出す）
    //   videoAspect  : 動画の縦横比（1920x1080 なので 16/9）
    //   videoDuration: 動画の長さ（秒）。実際の長さが読めればそちらを優先します
    //   videoOffsetX / videoOffsetY : 位置の微調整
    //   videoStartAt : 動画の何秒目から再生するか。実測で0〜0.05秒は
    //                  完全な黒コマなので、そこを飛ばして即ビームを出します
    ultimate: {
      model: "", color: "#7fd4ff", effect: "beam", scale: 1.0, speed: 9,
      video: "/kamehameha.mp4",
      videoAspect: 16 / 9,
      videoSpan: 1.15,
      videoDuration: 2.17,
      videoStartAt: 0.1,
      videoOffsetX: 0,
      videoOffsetY: 0,
    },
};

// 変身オーラの共通設定。色だけ差し替えて使います。
// startFrame は「変身モーション開始から何フレーム目で出すか」。
// 気が爆発するのは素材の3.0秒。2秒に詰めた再生では約1.09秒＝33フレーム目です。
const GOKU_AURA = (preset) => ({
  normal:      { enabled: false },
  transformed: { enabled: true, ...preset, scale: 1.0, opacity: 0.90, yOffset: 0, startFrame: 33, thunder: true },
  reverted:    { enabled: false },
});

// =============================================================
//  キャラクター本体
// =============================================================
export const CHARACTERS = {
  // ---------------- No.001 孫悟空（界王拳・赤） ----------------
  // 通常時はオーラなし。界王拳になったら赤いオーラを出し、続くあいだ出したままにします。
  c001: {
    ...GOKU_BASE,
    aura: GOKU_AURA(AURA_PRESETS.red),
  },

  // ---------------- No.002 GokuSS1（スーパーサイヤ人・黄） ----------------
  // モデル・モーション・技はNo.001と同じ。違いは次の2点です。
  //   ・変身するとモデルがスーパーサイヤ人（goku_ssj.glb）に入れ替わる
  //   ・オーラが黄色
  c009: {
    ...GOKU_BASE,
    name: "GokuSS1",
    transformedModel: `${R2}/goku_ssj.glb`,
    aura: GOKU_AURA(AURA_PRESETS.gold),
  },

  // ---------------- No.003 GokuSS3（2段階変身） ----------------
  // モデル・モーション・技はNo.001と同じ。違いは次の2点です。
  //   ・2段階変身（1段階目=スーパーサイヤ人 / 2段階目=スーパーサイヤ人3）
  //   ・必殺技の動画が「超かめはめ波」
  c010: {
    ...GOKU_BASE,
    name: "GokuSS3",
    transformedModel:  `${R2}/goku_ssj.glb`,
    transformedModel2: `${R2}/goku_ssj3.glb`,
    aura: GOKU_AURA(AURA_PRESETS.gold),
    ultimate: {
      ...GOKU_BASE.ultimate,
      video: "/kamehameha_super.mp4",
      videoDuration: 2.58,   // 実測 2.578秒 / 1920x1080 / 約30fps
    },
  },

  // ---------------- 以下は雛形（URLを入れれば有効になります） ----------------
  c002: {
    name: "ブルーS太郎",
    model: "",
    fps: 30,
    camera: { cameraY: 1.2, cameraZ: 3.6, lookAtY: 0.8, rotationY: 0 },
    motions: {},
    kiBlast:  { model: "", color: "#3b82f6", effect: "sphere", scale: 0.28, speed: 6 },
    ultimate: { model: "", color: "#60a5fa", effect: "beam",   scale: 1.0,  speed: 8 },
    aura: {
      normal:      { enabled: true, ...AURA_PRESETS.blue,   scale: 1.0, opacity: 0.5 },
      transformed: { enabled: true, ...AURA_PRESETS.white,  scale: 1.2, opacity: 0.95, startFrame: 30 },
      reverted:    { enabled: true, ...AURA_PRESETS.blue,   scale: 1.0, opacity: 0.5 },
    },
  },

  c_gotenks: {
    name: "ゴテンクス",
    model: "",
    fps: 30,
    camera: { cameraY: 1.2, cameraZ: 3.6, lookAtY: 0.8, rotationY: 0 },
    motions: {},
    kiBlast:  { model: "", color: "#c4b5fd", effect: "sphere", scale: 0.3, speed: 6 },
    ultimate: { model: "", color: "#a78bfa", effect: "beam",   scale: 1.1, speed: 9 },
    aura: {
      normal:      { enabled: true, ...AURA_PRESETS.purple, scale: 1.0, opacity: 0.5 },
      transformed: { enabled: true, ...AURA_PRESETS.yellow, scale: 1.25, opacity: 1.0, startFrame: 36 },
      reverted:    { enabled: true, ...AURA_PRESETS.purple, scale: 1.0, opacity: 0.5 },
    },
  },

  e001: { name: "ザコ戦士",        model: "", fps: 30, motions: {},
          kiBlast: { color: "#9ca3af", effect: "sphere" }, ultimate: { color: "#6b7280", effect: "beam" },
          aura: { normal: { enabled: false }, transformed: { enabled: false }, reverted: { enabled: false } } },

  e002: { name: "強敵！レッド将軍", model: "", fps: 30, motions: {},
          kiBlast: { color: "#ef4444", effect: "sphere" }, ultimate: { color: "#ff2010", effect: "beam" },
          aura: { normal: { enabled: true, ...AURA_PRESETS.red, scale: 1.0, opacity: 0.5 },
                  transformed: { enabled: true, ...AURA_PRESETS.red, scale: 1.2, opacity: 0.95, startFrame: 30 },
                  reverted: { enabled: true, ...AURA_PRESETS.red, scale: 1.0, opacity: 0.5 } } },

  e003: { name: "魔人ダーク",       model: "", fps: 30, motions: {},
          kiBlast: { color: "#8b5cf6", effect: "sphere" }, ultimate: { color: "#9e1aff", effect: "beam" },
          aura: { normal: { enabled: true, ...AURA_PRESETS.purple, scale: 1.0, opacity: 0.5 },
                  transformed: { enabled: true, ...AURA_PRESETS.purple, scale: 1.25, opacity: 1.0, startFrame: 30 },
                  reverted: { enabled: true, ...AURA_PRESETS.purple, scale: 1.0, opacity: 0.5 } } },
};

// =============================================================
//  取得ヘルパー（App 側から使います）
// =============================================================
function mergeDeep(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v)
      ? mergeDeep(base[k] || {}, v)
      : v;
  }
  return out;
}

/** カードIDからキャラ設定を取得（未設定でも既定値が返るので落ちません） */
export function getCharacter(cardId) {
  return mergeDeep(DEFAULT_CHARACTER, CHARACTERS[cardId] || {});
}

/** そのキャラが3D表示できるか（素体モデルがあるか） */
export function has3DModel(cardId) {
  return Boolean(getCharacter(cardId).model);
}

/**
 * モーションを再生してから、実際に弾（気弾・エネルギー波）が出るまでの秒数。
 * モーション設定の shotAt（素材のうち腕を伸ばしきる時刻）から、
 * trim と再生速度を考慮して逆算します。
 *
 * @param {string} cardId
 * @param {string} motionName  MOTION.ULTIMATE / MOTION.KI_BLAST など
 */
/**
 * ゲーム開始時に先読みしておきたいファイル一覧。
 * 素体モデルと待機モーションを先に取っておくと、
 * カード選択で選んだ瞬間にキャラが動き出します。
 */
export function getPreloadUrls() {
  const urls = [];
  for (const id of Object.keys(CHARACTERS)) {
    const c = getCharacter(id);
    if (!c.model) continue;
    urls.push(c.model);
    if (c.transformedModel) urls.push(c.transformedModel);
    if (c.transformedModel2) urls.push(c.transformedModel2);
    const idle = (c.motions || {}).idle;
    if (idle && idle.file) urls.push(idle.file);
  }
  return [...new Set(urls)]; // 同じファイルを重複して読まない
}

/** そのモーションの再生時間（秒）。設定が無ければ 0 を返します。 */
export function getMotionPlaySeconds(cardId, motionName) {
  const m = (getCharacter(cardId).motions || {})[motionName] || {};
  if (!m.file) return 0;
  if (m.duration) return m.duration;
  if (m.trimEnd != null) return (m.trimEnd - (m.trimStart || 0)) / (m.speed || 1);
  return 0; // 素材の長さは読み込むまで分からないので、呼び出し側で既定値を使ってください
}

export function getMotionShotDelay(cardId, motionName) {
  const m = (getCharacter(cardId).motions || {})[motionName] || {};
  if (!m.file || m.shotAt == null) return 0;
  const start = m.trimStart || 0;
  const trimmed = m.trimEnd != null ? m.trimEnd - start : null;
  let scale = m.speed || 1;
  if (m.duration && trimmed) scale = trimmed / m.duration;
  return Math.max(0, (m.shotAt - start) / scale);
}

// =============================================================
//  モーションの種類（App 側はこの名前で指定します）
// =============================================================
export const MOTION = {
  IDLE: "idle",
  MELEE: "melee",
  KI_BLAST: "kiBlast",
  ULTIMATE: "ultimate",
  TRANSFORM: "transform",
  HIT_MELEE: "hitByMelee",
  HIT_KI: "hitByKiBlast",
  HIT_ULTIMATE: "hitByUltimate",
};

/**
 * 旧 App.jsx のアニメ名を新しいモーション名に変換します。
 * 既存コードをそのまま動かすための互換レイヤーです。
 */
export function normalizeMotion(name) {
  switch (name) {
    case "punch":
    case "kick":
    case "attack":
      return MOTION.MELEE;
    // dash は「相手に近づく移動」なので攻撃モーションにはしません。
    // （近接モーションに割り当てると、接近時と攻撃時の2回再生されてしまいます）
    case "dash":
      return MOTION.IDLE;
    case "beam":
      return MOTION.ULTIMATE;
    case "hit":
      return MOTION.HIT_MELEE;
    case "kaioken_idle":
    case "win":
    case "lose":
    case "idle":
      return MOTION.IDLE;
    default:
      return name || MOTION.IDLE;
  }
}
