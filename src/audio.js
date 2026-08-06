// =============================================================
//  BGM と効果音
// =============================================================
//  音源は Cloudflare R2 に置いてあります。ファイル名に日本語と括弧が
//  入っているので、URL に組み立てるときに encodeURIComponent します。
//
//  ブラウザは「利用者が一度も触っていないページ」では音を鳴らせません。
//  そのため再生に失敗しても例外にせず、最初のタップ/クリックのときに
//  もう一度だけ鳴らし直します（unlock）。
//
//  鳴らしっぱなしにする音（変身のオーラ・ルーレットの回転音）だけは
//  Web Audio を使います。<audio> だと音量の上限が 1.0 で足りないのと、
//  折り返し位置をフレーム単位で指定できないためです。
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
  dragonBurst: url("nc432033_DB_ぶつけ合い.wav"),                    // ドラゴンバーストの打ち合い
  aura: url("nc116127_超サイヤ人に変身.wav"),                        // 変身＋その後の気のオーラ（ループ）
  scouter: url("nc116296_スカウター.wav"),                           // ステータス表示・上昇
  cursor: url("カーソル移動3.mp3"),                                  // カード選択・メニュー
  cancel: url("キャンセル1.mp3"),                                    // じゃんけんの手を選ぶ
  rouletteSpin: url("電子ルーレット回転中.mp3"),                     // ルーレット回転中（ループ）
  rouletteStop: url("電子ルーレット停止ボタンを押す.mp3"),           // ルーレット停止
};

const BGM_VOLUME = 0.35;
const SE_VOLUME = 0.7;

// 効果音ごとの音量と長さの調整。
// 素材の波形を実測した最大値をもとに、だいたい同じ大きさに揃えています。
//   打撃 0.76 / 気弾 0.62 / スカウター 0.62 / 停止 0.48 / カーソル 0.43
//   キャンセル 0.38 / 打ち合い 0.38 / 爆発 0.35
const SE_OPTIONS = {
  // スカウターは3.6秒あり、数値のカウントアップ（約0.9秒）より長いので
  // 頭の電子音＋走査音のところで切ります
  [SE.scouter]: { volume: 0.85, maxMs: 1600 },
  [SE.dragonBurst]: { volume: 1.0 },
  [SE.ultimate]: { volume: 1.0 },
  [SE.cursor]: { volume: 0.75 },
  [SE.cancel]: { volume: 0.85 },
  [SE.rouletteStop]: { volume: 0.8 },
};

// ---- ループする音の設定 --------------------------------------
// aura … 全長53.2秒。先頭が「変身する瞬間」の音で、そのあとは気を纏って
//        いる音がずっと続きます。1周目は先頭から鳴らし、2周目以降は
//        変身音を飛ばして繰り返します。
//        飛ばす位置は 2.5秒。実測すると変身音は 1.0秒ではまだ鳴っていて
//        （波形 0秒=0.25 → 1.0秒=0.177 → 1.5秒=0.086 → 2.0秒=0.055）、
//        2.5秒でようやくオーラ音と同じ 0.04〜0.06 に落ち着きます。
//        1.0秒で折り返すと、折り返した瞬間だけ音量が2.6倍に跳ねます
//        （実測 折り返し前0.345 → 直後0.901）。2.5秒なら 0.345→0.341 で
//        つなぎ目が分かりません。
//        変身音とオーラ音で3〜4倍の音量差があるので、変身音が鳴り終わる
//        あたりでゲインを上げ、オーラ音が埋もれないようにします。
//        オーラのゲインは 5.8 → 3.9 に下げています（波形の最大 0.40 → 0.27）。
//        近接攻撃音が 0.53 なので、その半分くらいの控えめな音量です。
// rouletteSpin … 2.67秒。全体が平坦（0.24前後）なので丸ごと繰り返します。
const LOOP_SPECS = {
  aura: { src: SE.aura, loopStart: 2.5, gain: 2.4, gainAfter: 3.9, rampAt: 1.0, rampDur: 0.4 },
  rouletteSpin: { src: SE.rouletteSpin, loopStart: 0, gain: 1.2 },
};

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
    // スマホは「画面を触った瞬間」でないと音の器を起こせません。
    // ここで起こしておけば、以降は攻撃の途中でも効果音を鳴らせます。
    const ctx = audioCtx();
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      // iOS は無音を一度鳴らさないと起きないことがあるため、空の音を出します
      try {
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        s.start(0);
      } catch { /* 起こせなくても進行は止めません */ }
    }
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
      if (!unlocked && retry && pending.length < 6) pending.push(retry);
    });
  }
}

// ---- 効果音 ------------------------------------------------
//  スマホ（特にiOS）は、画面を触った直後以外に new Audio().play() を
//  呼んでも鳴りません。効果音は攻撃やルーレットの途中で鳴らすので、
//  そのままだと鳴ったり鳴らなかったりします。
//  そこで効果音は Web Audio で鳴らします。最初のタップで音の器
//  （AudioContext）を一度起こしておけば、あとはいつでも鳴らせます。
//  Web Audio が使えない環境では <audio> に切り替えます。
const seBuffers = new Map();   // URL -> AudioBuffer
const seLoading = new Map();   // URL -> Promise
const seFallback = new Map();  // URL -> HTMLAudioElement（Web Audioが使えない時）

function loadSeBuffer(src) {
  const ctx = audioCtx();
  if (!ctx) return null;
  if (seBuffers.has(src)) return Promise.resolve(seBuffers.get(src));
  if (seLoading.has(src)) return seLoading.get(src);
  const p = fetch(src)
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => { seBuffers.set(src, buf); seLoading.delete(src); return buf; })
    .catch(() => { seLoading.delete(src); return null; });
  seLoading.set(src, p);
  return p;
}

function playSeBuffer(src, vol, opt) {
  const ctx = audioCtx();
  const buf = seBuffers.get(src);
  if (!ctx || !buf) return false;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const node = ctx.createBufferSource();
  node.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  node.connect(gain).connect(ctx.destination);
  // 長い素材は途中で切ります（最後を小さくして、ぷつっと切れないように）
  if (opt.maxMs) {
    const t = ctx.currentTime;
    const end = opt.maxMs / 1000;
    const fade = Math.min(0.25, end * 0.5);
    gain.gain.setValueAtTime(vol, t + end - fade);
    gain.gain.linearRampToValueAtTime(0.0001, t + end);
    node.start(0);
    node.stop(t + end);
  } else {
    node.start(0);
  }
  return true;
}

/** <audio> で鳴らします（Web Audio が使えない・間に合わない時の受け皿） */
function playSeElement(src, vol) {
  if (typeof Audio === "undefined") return;
  let el = seFallback.get(src);
  if (!el) { el = new Audio(src); el.preload = "auto"; seFallback.set(src, el); }
  const c = el.cloneNode();
  c.volume = Math.min(1, Math.max(0, vol));
  safePlay(c);
}

/**
 * 効果音を1回鳴らします。
 * 読み込み済みなら Web Audio で鳴らし、まだなら <audio> で今すぐ鳴らします。
 * 「読み込みを待ってから鳴らす」だと、間に合わないときに遅れて鳴ったり
 * そのまま鳴らなかったりします。待たずにその場で鳴らせる方を使い、
 * 裏では次回のために読み込んでおきます。
 */
export function playSe(src, volume = null) {
  if (!src) return;
  const opt = SE_OPTIONS[src] || {};
  const vol = volume != null ? volume : (opt.volume != null ? opt.volume : SE_VOLUME);
  const ctx = audioCtx();
  if (ctx && seBuffers.has(src)) {
    if (ctx.state === "running") {
      if (playSeBuffer(src, vol, opt)) return;
    } else {
      // 止まっている場合は起こしてから鳴らします。
      // 起こせなければ <audio> に切り替えます。
      ctx.resume().then(() => {
        if (!playSeBuffer(src, vol, opt)) playSeElement(src, vol);
      }).catch(() => playSeElement(src, vol));
      return;
    }
  }
  // まだ読み込めていない、または Web Audio が無い場合
  if (ctx) loadSeBuffer(src);   // 次に鳴らす時のために裏で読んでおきます
  playSeElement(src, vol);
}

/** 音源を先に取りに行っておきます（鳴らす瞬間に間に合わせるため） */
export function preloadAudio(list) {
  for (const src of list) {
    if (!src) continue;
    if (audioCtx()) loadSeBuffer(src);
    // <audio> 側も用意しておきます（Web Audio が間に合わない時の受け皿）
    if (typeof Audio !== "undefined") {
      let el = seFallback.get(src);
      if (!el) { el = new Audio(src); el.preload = "auto"; seFallback.set(src, el); }
      el.load();
    }
  }
}

// ---- ループする効果音（Web Audio） --------------------------
let actx = null;
const loopBufs = new Map();   // src -> AudioBuffer
const loopNodes = new Map();  // 名前 -> { src }
const loopWanted = new Set(); // 鳴らしたい状態になっている名前

function audioCtx() {
  if (actx) return actx;
  const C = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!C) return null;
  actx = new C();
  return actx;
}

/** ループ音を鳴らし始めます（既に鳴っていれば何もしません） */
export function startLoop(name) {
  const spec = LOOP_SPECS[name];
  const ctx = audioCtx();
  if (!spec || !ctx) return;
  loopWanted.add(name);
  if (loopNodes.has(name)) return;

  const begin = () => {
    // 読み込みを待っている間に止められていたら鳴らしません
    if (!loopWanted.has(name) || loopNodes.has(name)) return;
    const buf = loopBufs.get(spec.src);
    if (!buf) return;
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.loopStart = Math.min(spec.loopStart, Math.max(0, buf.duration - 0.1));
    node.loopEnd = buf.duration;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(spec.gain, t);
    if (spec.gainAfter != null) {
      // 変身音のあとにオーラ音の音量を持ち上げます
      gain.gain.setValueAtTime(spec.gain, t + (spec.rampAt || 0));
      gain.gain.linearRampToValueAtTime(spec.gainAfter, t + (spec.rampAt || 0) + (spec.rampDur || 0.3));
    }
    node.connect(gain).connect(ctx.destination);
    node.start(0, 0); // 1周目は先頭（変身の瞬間の音）から鳴らします
    loopNodes.set(name, { src: node });
  };

  const run = () => {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (loopBufs.has(spec.src)) { begin(); return; }
    fetch(spec.src)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => { loopBufs.set(spec.src, buf); begin(); })
      .catch(() => { /* 読めなくても進行は止めません */ });
  };

  run();
  if (!unlocked && pending.length < 6) pending.push(run);
}

/** ループ音を止めます */
export function stopLoop(name) {
  loopWanted.delete(name);
  const n = loopNodes.get(name);
  if (!n) return;
  loopNodes.delete(name);
  try { n.src.stop(); } catch { /* 既に止まっている場合は無視 */ }
}

export const startAuraLoop = () => startLoop("aura");
export const stopAuraLoop = () => stopLoop("aura");
export const startRouletteLoop = () => startLoop("rouletteSpin");
export const stopRouletteLoop = () => stopLoop("rouletteSpin");

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
