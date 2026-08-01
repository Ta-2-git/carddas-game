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
    transform:     { file: "", loop: false, hold: true },
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
//  キャラクター本体
// =============================================================
export const CHARACTERS = {
  // ---------------- 孫悟空 ----------------
  c001: {
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

      kiBlast: { file: `${R2}/Goku_KiBlast.fbx`, loop: false },

      // 素材8.3秒のうち、2.05秒以降は向きが変わって静止するだけなので切り捨て。
      // 溜め〜腕を伸ばしきるまでの全フレームを、2秒で再生し終えます。
      // 腕が伸びきる（＝かめはめ波が出る）のはその終わり際。
      // 発射後さらに1秒エネルギー波を出し、全体で約3秒になります。
      ultimate: { file: `${R2}/Goku_Kamehameha.fbx`, loop: false, trimEnd: 2.05, duration: 2.0, faceCamera: true, shotAt: 2.0 },

      // 素材8.3秒のうち、6.0秒以降は静止するだけなので切り捨て。
      // 溜め〜気の爆発〜構え直しまでの全フレームを、2秒で再生し終えます。
      // hold は付けません（再生後は待機モーションに戻す。オーラは別管理なので消えません）
      transform: { file: `${R2}/Goku_変身.fbx`, loop: false, trimEnd: 6.0, duration: 2.0, faceCamera: true },

      hitByMelee:    { file: `${R2}/Goku_Receive.fbx`, loop: false },
      hitByKiBlast:  { file: "", loop: false },
      hitByUltimate: { file: "", loop: false },
    },

    kiBlast:  { model: "", color: "#ffd21a", effect: "sphere", scale: 0.30, speed: 6 },
    ultimate: { model: "", color: "#7fd4ff", effect: "beam",   scale: 1.0,  speed: 9 },

    // 通常時はオーラなし。界王拳（変身）になったら赤いオーラを出し、
    // 界王拳が続くあいだはずっと出したままにします。
    // startFrame は「変身モーション開始から何フレーム目で出すか」。
    // 気が爆発するのは素材の3.0秒＝2秒に詰めた再生だと約1.0秒＝30フレーム目です。
    aura: {
      normal:      { enabled: false },
      transformed: { enabled: true, ...AURA_PRESETS.red, scale: 1.0, opacity: 0.95, yOffset: 0, startFrame: 30, thunder: true },
      reverted:    { enabled: false },
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
 * 必殺技モーションを再生してから、実際にエネルギー波を撃つまでの秒数。
 * モーション設定の shotAt（素材のうち腕を伸ばしきる時刻）から、
 * trim と再生速度を考慮して逆算します。
 */
export function getUltimateShotDelay(cardId) {
  const m = (getCharacter(cardId).motions || {}).ultimate || {};
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
