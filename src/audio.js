// =============================================================
//  BGM と効果音
// =============================================================
//  音源は Cloudflare R2 に置いてあります。ファイル名に日本語と括弧が
//  入っているので、URL に組み立てるときに encodeURIComponent します。
//
//  ここでは Web Audio（AudioContext）を使わず、<audio> だけで鳴らします。
//  スマホで画面録画をすると、AudioContext が動いている間だけ音が
//  ノイズだらけになる端末があるためです（録画の音声を調べたところ、
//  音が鳴り始めた瞬間から最後まで高い周波数の成分が増え続けていました）。
//
//  <audio> はそのままだと「画面を触った瞬間」以外で鳴らせませんが、
//  最初のタップのときに全部の要素を一度 play → pause しておくと、
//  以降はいつでも鳴らせるようになります（unlock）。
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

// 効果音ごとの音量と長さ。素材の波形を実測した最大値をもとに揃えています。
//   打撃 0.76 / 気弾 0.62 / スカウター 0.62 / 停止 0.48 / カーソル 0.43
//   キャンセル 0.38 / 打ち合い 0.38 / 爆発 0.35 / 変身・回転 0.25
const SE_OPTIONS = {
  // スカウターは3.6秒あり、数値のカウントアップ（1.5秒）より長いので
  // 頭の電子音＋走査音のところで切ります
  [SE.scouter]: { volume: 0.85, maxMs: 1600 },
  [SE.dragonBurst]: { volume: 1.0 },
  [SE.ultimate]: { volume: 1.0 },
  [SE.cursor]: { volume: 0.75 },
  [SE.cancel]: { volume: 0.85 },
  [SE.rouletteStop]: { volume: 0.8 },
};

// ループする音の設定。
//  aura … 全長53.2秒。先頭が「変身する瞬間」の音で、そのあとは気を纏って
//         いる音が続きます。1周目は先頭から鳴らし、2周目以降は変身音を
//         飛ばして 2.5秒〜14秒 を繰り返します。
//         飛ばす位置が2.5秒なのは、実測で変身音が1.0秒ではまだ鳴っており
//        （0秒=0.25 → 1.0秒=0.177 → 1.5秒=0.086 → 2.0秒=0.055）、
//         2.5秒でオーラ音と同じ 0.04〜0.06 に落ち着くためです。
//  rouletteSpin … 2.67秒。全体が平坦なので丸ごと繰り返します。
const LOOP_SPECS = {
  aura: { src: SE.aura, volume: 1.0, loopStart: 2.5, loopEnd: 14 },
  rouletteSpin: { src: SE.rouletteSpin, volume: 1.0, loopStart: 0, loopEnd: 0 },
};

// 同じ音を重ねて鳴らせる数。
// 音声要素をたくさん持つほど、端末の音まわりが不安定になります。
// このゲームは同じ効果音が重なる場面がほとんど無いので1つにします
// （全部で 効果音10 + ループ2 + BGM1 = 13個）。
const POOL_SIZE = 1;

// ---- 要素の置き場 ------------------------------------------
const sePool = new Map();   // URL -> [HTMLAudioElement]
const seTurn = new Map();   // URL -> 次に使う番号
const loopEls = new Map();  // 名前 -> HTMLAudioElement
let bgmEl = null;
let bgmSrc = null;
let fadeTimer = null;
let unlocked = false;

function makeEl(src, { loop = false, volume = 1 } = {}) {
  if (typeof Audio === "undefined") return null;
  const el = new Audio(src);
  el.preload = "auto";
  el.loop = loop;
  el.volume = volume;
  // スマホで全画面表示に持っていかれないようにします
  el.playsInline = true;
  return el;
}

/** その音源の要素をまとめて用意します（無ければ作ります） */
function poolFor(src) {
  let arr = sePool.get(src);
  if (!arr) {
    arr = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = makeEl(src);
      if (el) arr.push(el);
    }
    sePool.set(src, arr);
    seTurn.set(src, 0);
    // 解除は「画面を触った瞬間」にまとめて行います。
    // ここで鳴らすと、その音が実際に聞こえてしまいます。
  }
  return arr;
}

function loopFor(name) {
  const spec = LOOP_SPECS[name];
  if (!spec) return null;
  let el = loopEls.get(name);
  if (!el) {
    // 途中に戻して繰り返す場合は loop を使わず、自分で位置を戻します
    const needSeek = spec.loopStart > 0;
    el = makeEl(spec.src, { loop: !needSeek, volume: spec.volume });
    if (!el) return null;
    if (needSeek) {
      el.addEventListener("timeupdate", () => {
        if (spec.loopEnd && el.currentTime >= spec.loopEnd) {
          try { el.currentTime = spec.loopStart; } catch { /* 無視 */ }
        }
      });
      el.addEventListener("ended", () => {
        try { el.currentTime = spec.loopStart; el.play().catch(() => {}); } catch { /* 無視 */ }
      });
    }
    loopEls.set(name, el);
  }
  return el;
}

// ---- 自動再生の解除 ----------------------------------------
/**
 * 要素を「一度鳴らした」ことにしておきます。
 * スマホは画面を触った瞬間しか鳴らせないので、そのときにまとめて
 * play → 即 pause しておくと、以降は好きなタイミングで鳴らせます。
 *
 * 止めるのは必ず同期（play のすぐ次の行）で行います。
 * iPhone は音量の指定を受け付けないため、音量を0にして待つ方法だと
 * 「解除の瞬間に全部の効果音がまとめて鳴る」ことになります。
 */
const unlockedEls = new WeakSet();
function unlockEl(el) {
  if (!el || unlockedEls.has(el)) return;
  unlockedEls.add(el);
  try {
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    el.pause();          // ここで即座に止めるので音は出ません
    el.currentTime = 0;
  } catch { /* 解除できなくても進行は止めません */ }
}

function unlockAll() {
  // 触られたこの瞬間に、使う音を全部用意してから解除します。
  // あとから作った要素は解除できず（触っていない扱いになるため）、
  // スマホで鳴らないままになります。
  for (const src of Object.values(SE)) poolFor(src);
  for (const name of Object.keys(LOOP_SPECS)) loopFor(name);
  for (const arr of sePool.values()) arr.forEach(unlockEl);
  for (const el of loopEls.values()) unlockEl(el);
  // BGMは鳴らしたい曲があれば、そのまま鳴らします
  if (bgmEl && bgmSrc && bgmEl.paused) bgmEl.play().catch(() => {});
}

function armUnlock() {
  if (typeof window === "undefined") return;
  const fire = () => {
    if (unlocked) return;
    unlocked = true;
    window.removeEventListener("pointerdown", fire);
    window.removeEventListener("keydown", fire);
    window.removeEventListener("touchstart", fire);
    unlockAll();
  };
  window.addEventListener("pointerdown", fire);
  window.addEventListener("keydown", fire);
  window.addEventListener("touchstart", fire);
}
armUnlock();

// ---- 効果音 ------------------------------------------------
/** 効果音を1回鳴らします */
export function playSe(src, volume = null) {
  if (!src) return;
  const opt = SE_OPTIONS[src] || {};
  const vol = Math.min(1, Math.max(0, volume != null ? volume : (opt.volume != null ? opt.volume : SE_VOLUME)));
  const arr = poolFor(src);
  if (!arr || !arr.length) return;
  // 空いている要素を優先し、無ければ順番に使い回します
  let el = arr.find((a) => a.paused || a.ended);
  if (!el) {
    const i = (seTurn.get(src) || 0) % arr.length;
    seTurn.set(src, i + 1);
    el = arr[i];
  }
  try { el.currentTime = 0; } catch { /* 読み込み前は無視 */ }
  el.volume = vol;
  const p = el.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
  // 長い素材は途中で切ります（最後を小さくして、ぷつっと切れないように）
  if (opt.maxMs) {
    const fade = 250;
    setTimeout(() => {
      const from = el.volume;
      const t0 = Date.now();
      const id = setInterval(() => {
        const q = (Date.now() - t0) / fade;
        el.volume = Math.max(0, from * (1 - q));
        if (q >= 1) { clearInterval(id); try { el.pause(); } catch { /* 無視 */ } el.volume = from; }
      }, 25);
    }, Math.max(0, opt.maxMs - fade));
  }
}

/** 音源を先に用意しておきます（鳴らす瞬間に間に合わせるため） */
export function preloadAudio(list) {
  for (const src of list) {
    if (!src) continue;
    poolFor(src).forEach((el) => el.load());
  }
  // ループする音も先に作っておきます。最初のタップより後に作ると、
  // スマホでは鳴らせないままになります。
  for (const name of Object.keys(LOOP_SPECS)) {
    const el = loopFor(name);
    if (el) el.load();
  }
}

// ---- ループする効果音 --------------------------------------
export function startLoop(name, restart = false) {
  const spec = LOOP_SPECS[name];
  const el = loopFor(name);
  if (!spec || !el) return;
  // restart は「もう鳴っていても頭から鳴らし直す」指定です。
  // スーパーサイヤ人3へ上がるときは既にオーラ音が鳴っているので、
  // これが無いと変身の瞬間の音が鳴りません。
  if (!el.paused && !restart) return;
  try { el.currentTime = 0; } catch { /* 無視 */ }
  el.volume = spec.volume;
  const p = el.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

export function stopLoop(name) {
  const el = loopEls.get(name);
  if (!el) return;
  try { el.pause(); el.currentTime = 0; } catch { /* 無視 */ }
}

export const startAuraLoop = (restart = false) => startLoop("aura", restart);
export const stopAuraLoop = () => stopLoop("aura");
export const startRouletteLoop = () => startLoop("rouletteSpin");
export const stopRouletteLoop = () => stopLoop("rouletteSpin");

// ---- BGM ---------------------------------------------------
//  要素は1つだけを使い回します。曲ごとに作ると、前の曲を止め損ねたときに
//  二重で鳴り続けます（ロビー曲がバトル中も鳴っていた原因でした）。
function bgmElement() {
  if (typeof Audio === "undefined") return null;
  if (!bgmEl) {
    bgmEl = new Audio();
    bgmEl.loop = true;
    bgmEl.preload = "auto";
    bgmEl.playsInline = true;
    bgmEl.volume = BGM_VOLUME;
  }
  return bgmEl;
}

/** BGMを切り替えます。同じ曲が既に指定されていれば何もしません。 */
export function playBgm(src) {
  const el = bgmElement();
  if (!el) return;
  if (bgmSrc === src) {
    if (src && el.paused && unlocked) el.play().catch(() => {});
    return;
  }
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  bgmSrc = src;
  if (!src) { el.pause(); return; }
  el.pause();
  el.src = src;   // src を入れ直すと再生位置も先頭に戻ります
  el.volume = BGM_VOLUME;
  const p = el.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

/** BGMを止めます（フェードアウト付き） */
export function stopBgm() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const el = bgmEl;
  bgmSrc = null;
  if (!el) return;
  fadeTimer = setInterval(() => {
    el.volume = Math.max(0, el.volume - BGM_VOLUME / 8);
    if (el.volume <= 0.001) {
      clearInterval(fadeTimer); fadeTimer = null;
      el.pause();
      el.volume = BGM_VOLUME;
    }
  }, 50);
}
