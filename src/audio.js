// =============================================================
//  BGM と効果音
// =============================================================
//  音源は Cloudflare R2 に置いてあります。ファイル名に日本語と括弧が
//  入っているので、URL に組み立てるときに encodeURIComponent します。
//
//  ブラウザは「利用者が一度も触っていないページ」では音を鳴らせません。
//  そのため再生に失敗しても例外にせず、最初のタップ/クリックのときに
//  もう一度だけ鳴らし直します（unlock）。
// =============================================================

const R2 = "https://pub-cc2639bfd1b440dbab289c6b875da6bb.r2.dev";
const url = (name) => `${R2}/${encodeURIComponent(name)}`;

export const BGM = {
  // ロビー（タイトル〜カード選択。VS画面に入る手前まで）
  lobby: url("nc313490_RPGツクール以外の音源でドラゴンボールZ_-_ほのぼの1.mp3"),
  // バトル（VS画面〜戦闘〜リザルト）
  battle: url("nc316221_RPGツクール音源でドラゴンボールZ_-_EDスーパーサイヤ人だ孫悟空（バトル風）.mp3"),
};

export const SE = {
  melee: url("nc414736_打撃音（弱）加工済み.mp3"),                   // 近接攻撃
  ultimate: url("nc414749_エネルギー爆発音３選加工済み.mp3"),        // かめはめ波 / 超かめはめ波 / ファイナルフラッシュ
  kiBlast: url("nc414744_ビーム発射音（弱）加工済み.mp3"),           // 気弾
  aura: url("nc414748_エネルギー溜め・増幅音７選加工済み.mp3"),      // 変身後の気のオーラ（ループ）
  dragonBurst: url("nc432033_DB_ぶつけ合い.wav"),                    // ドラゴンバーストの打ち合い
};

const BGM_VOLUME = 0.35;
const SE_VOLUME = 0.7;

// ---- オーラ音の調整値 ----------------------------------------
// この音源は実測で
//   ・先頭0.8秒が完全な無音、そこから0.8秒かけて音が立ち上がる
//   ・立ち上がったあとは 9.68秒まで平坦（波形の最大値 0.13〜0.18）
// という作りです。他の効果音は最大 0.35〜0.76 あるので、そのまま鳴らすと
// 埋もれて聞こえません。無音部分を飛ばし、音量を持ち上げて鳴らします。
const AURA_LOOP_START = 1.6;  // 立ち上がりきったところから
const AURA_LOOP_END = 9.4;    // 終わりぎわを避けて折り返す
const AURA_GAIN = 3.0;        // 0.18 × 3.0 ＝ 0.54。近接音とほぼ同じ大きさ

// ---- 自動再生の解除 ----------------------------------------
let unlocked = false;
const pending = [];

/** 利用者が最初に画面を触ったときに、鳴らせなかった音を鳴らし直します */
function armUnlock() {
  if (typeof window === "undefined" || unlocked) return;
  const fire = () => {
    unlocked = true;
    window.removeEventListener("pointerdown", fire);
    window.removeEventListener("keydown", fire);
    window.removeEventListener("touchstart", fire);
    while (pending.length) {
      const retry = pending.shift();
      try { retry(); } catch { /* 鳴らせなくても進行は止めません */ }
    }
  };
  window.addEventListener("pointerdown", fire);
  window.addEventListener("keydown", fire);
  window.addEventListener("touchstart", fire);
}
armUnlock();

/** play() は Promise を返すので、失敗しても握りつぶして進行を止めません */
function safePlay(el, retry) {
  const p = el.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      // 自動再生を止められた場合だけ、最初のタップまで待ちます
      if (!unlocked && retry && pending.length < 4) pending.push(retry);
    });
  }
}

// ---- 効果音 ------------------------------------------------
// 同じ音が重なって鳴らせるよう、元になる要素を複製して使います
const seCache = new Map();

function baseAudio(src) {
  let el = seCache.get(src);
  if (!el) {
    el = new Audio(src);
    el.preload = "auto";
    seCache.set(src, el);
  }
  return el;
}

/** 効果音を1回鳴らします */
export function playSe(src, volume = SE_VOLUME) {
  if (!src || typeof Audio === "undefined") return;
  const el = baseAudio(src).cloneNode();
  el.volume = volume;
  safePlay(el);
}

/** 音源を先に取りに行っておきます（鳴らす瞬間に間に合わせるため） */
export function preloadAudio(list) {
  if (typeof Audio === "undefined") return;
  for (const src of list) { if (src) baseAudio(src).load(); }
}

// ---- ループする効果音（変身の気のオーラ） --------------------
//  <audio> の音量は 1.0 が上限で、この音源はそれでもまだ小さいので
//  Web Audio でゲインを掛けて鳴らします。無音の頭出しと折り返し位置も
//  Web Audio なら正確に指定できます。
let actx = null;
let auraBuf = null;
let auraNode = null;
let auraWanted = false;

function audioCtx() {
  if (actx) return actx;
  const C = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!C) return null;
  actx = new C();
  return actx;
}

/** オーラの音をループ再生します（既に鳴っていれば何もしません） */
export function startAuraLoop() {
  const ctx = audioCtx();
  if (!ctx) return;
  auraWanted = true;
  if (auraNode) return; // すでに鳴っています

  const begin = () => {
    // 呼ばれてから読み込みが終わるまでの間に止められていたら鳴らしません
    if (!auraWanted || auraNode || !auraBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = auraBuf;
    src.loop = true;
    src.loopStart = Math.min(AURA_LOOP_START, auraBuf.duration - 0.1);
    src.loopEnd = Math.min(AURA_LOOP_END, auraBuf.duration);
    const gain = ctx.createGain();
    gain.gain.value = AURA_GAIN;
    src.connect(gain).connect(ctx.destination);
    src.start(0, src.loopStart); // 無音の頭出しを飛ばして鳴らし始めます
    auraNode = { src, gain };
  };

  const run = () => {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (auraBuf) { begin(); return; }
    fetch(SE.aura)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => { auraBuf = buf; begin(); })
      .catch(() => { /* 読めなくても進行は止めません */ });
  };

  run();
  // 自動再生を止められている場合は、最初のタップでやり直します
  if (!unlocked && pending.length < 4) pending.push(run);
}

/** オーラの音を止めます */
export function stopAuraLoop() {
  auraWanted = false;
  if (!auraNode) return;
  try { auraNode.src.stop(); } catch { /* 既に止まっている場合は無視 */ }
  auraNode = null;
}

// ---- BGM ---------------------------------------------------
let bgmEl = null;
let bgmSrc = null;
let fadeTimer = null;

/**
 * BGMを切り替えます。同じ曲が既に鳴っていれば何もしません。
 * 前の曲は0.4秒かけて小さくしてから止めます。
 */
export function playBgm(src) {
  if (typeof Audio === "undefined") return;
  if (bgmSrc === src && bgmEl && !bgmEl.paused) return;
  stopBgm();
  bgmSrc = src;
  if (!src) return;
  bgmEl = new Audio(src);
  bgmEl.loop = true;
  bgmEl.volume = BGM_VOLUME;
  const el = bgmEl;
  safePlay(el, () => { if (bgmEl === el) safePlay(el); });
}

/** BGMを止めます（フェードアウト付き） */
export function stopBgm() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const old = bgmEl;
  bgmEl = null; bgmSrc = null;
  if (!old) return;
  fadeTimer = setInterval(() => {
    old.volume = Math.max(0, old.volume - BGM_VOLUME / 8);
    if (old.volume <= 0.001) {
      clearInterval(fadeTimer); fadeTimer = null;
      old.pause();
    }
  }, 50);
}
