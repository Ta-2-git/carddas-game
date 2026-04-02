import { useState, useEffect, useCallback, useRef } from "react";

// ===== キャラクター表示（Three.js なし・2Dのみ） =====
const CharacterFighter = ({ card, animState, isEnemy = false, size = 110, scale = 1 }) => {
  if (card.isGoku) return <GokuFighter animState={animState} isEnemy={isEnemy} scale={scale} />;
  return <StickmanFighter card={card} isEnemy={isEnemy} size={size} state={animState} />;
};

const TITLE_IMG = "https://pub-cc2639bfd1b440dbab289c6b875da6bb.r2.dev/title.png.PNG";
const BATTLE_BG = "https://pub-cc2639bfd1b440dbab289c6b875da6bb.r2.dev/battle_bg.png.PNG";
const IMG_CARD_GOKU = "https://pub-cc2639bfd1b440dbab289c6b875da6bb.r2.dev/goku_card.png.PNG";
const CARD_BACK_IMG = "https://pub-cc2639bfd1b440dbab289c6b875da6bb.r2.dev/card_back.png.PNG";
const IMG_PUNCH_SHEET = "";
const IMG_BEAM_SHEET = "";
const PUNCH_FRAME = { w: 204.8, h: 272, count: 5 };
const BEAM_FRAME = { w: 142.8, h: 310, count: 10 };
const IDLE_FRAMES = Array(16).fill("");
const KAIOKEN_IDLE_FRAMES = Array(16).fill("");
const PUNCH_FRAMES = Array(9).fill("");
const KICK_FRAMES = Array(10).fill("");
const DASH_FRAMES = Array(9).fill("");

const IdleAnimOnce = ({ frames, fps = 10, scale = 1, flipH = false, onDone }) => {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const doneRef = useRef(false);
  const effectiveScale = scale * 0.5;
  useEffect(() => {
    doneRef.current = false; setFrame(0);
    const interval = 1000 / fps;
    const tick = (now) => {
      if (doneRef.current) return;
      if (now - lastRef.current >= interval) {
        lastRef.current = now;
        setFrame(f => { const next = f + 1; if (next >= frames.length) { doneRef.current = true; onDone && setTimeout(onDone, 50); return f; } return next; });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [fps, frames.length]);
  return (
    <div style={{ display: 'inline-block', width: 256 * effectiveScale, height: 256 * effectiveScale, transform: flipH ? 'scaleX(-1)' : 'none', overflow: 'visible' }}>
      <img src={frames[frame]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', imageRendering: 'crisp-edges' }} />
    </div>
  );
};

const IdleAnim = ({ frames, fps = 8, scale = 1, flipH = false, pingPong = false, style = {} }) => {
  const [frame, setFrame] = useState(0);
  const dirRef = useRef(1);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const effectiveScale = scale * 0.5;
  useEffect(() => {
    const interval = 1000 / fps;
    const tick = (now) => {
      if (now - lastRef.current >= interval) {
        lastRef.current = now;
        setFrame(f => {
          if (!pingPong) return (f + 1) % frames.length;
          let next = f + dirRef.current;
          if (next >= frames.length - 1) { dirRef.current = -1; next = frames.length - 1; }
          else if (next <= 0) { dirRef.current = 1; next = 0; }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [fps, frames.length, pingPong]);
  return (
    <div style={{ display: 'inline-block', width: 256 * effectiveScale, height: 256 * effectiveScale, transform: flipH ? 'scaleX(-1)' : 'none', overflow: 'visible', ...style }}>
      <img src={frames[frame]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', imageRendering: 'crisp-edges' }} />
    </div>
  );
};

const MOVES = {
  rock_kamehameha: { id: "rock_kamehameha", name: "超かめはめ波", hand: "rock", type: "special", power: 2.5, color: "#60a5fa" },
  scissors_kick:   { id: "scissors_kick",   name: "回転蹴り",     hand: "scissors", type: "normal",  power: 1.3, color: "#f59e0b" },
  paper_punch:     { id: "paper_punch",     name: "正拳突き",     hand: "paper",    type: "normal",  power: 1.2, color: "#4ade80" },
  rock_punch:      { id: "rock_punch",      name: "必殺パンチ",   hand: "rock",     type: "special", power: 1.8, color: "#ef4444" },
  scissors_slash:  { id: "scissors_slash",  name: "連続斬り",     hand: "scissors", type: "normal",  power: 1.1, color: "#f59e0b" },
  paper_beam:      { id: "paper_beam",      name: "気功波",       hand: "paper",    type: "normal",  power: 1.0, color: "#818cf8" },
};

const RARITY_CONFIG = {
  N:   { color: "#9ca3af", glow: "#6b7280", label: "ノーマル" },
  R:   { color: "#3b82f6", glow: "#2563eb", label: "レア" },
  SR:  { color: "#f59e0b", glow: "#d97706", label: "スーパーレア" },
  SSR: { color: "#ec4899", glow: "#db2777", label: "スーパースーパーレア" },
  UR:  { color: "#ffffff", glow: "#fbbf24", label: "ウルトラレア" },
};

const CARDS = [
  { id: "c001", name: "孫悟空", rarity: "SR", hp: 2500, atk: 350, rock: "rock_kamehameha", scissors: "scissors_kick", paper: "paper_punch", color: "#f59e0b", isGoku: true, description: "地球最強の戦士。界王拳で限界を超える！" },
  { id: "c002", name: "ブルーS太郎",    rarity: "SSR", hp: 2200, atk: 400, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#3b82f6", bodyColor: "#1d4ed8", hairColor: "#1e3a8a" },
  { id: "c003", name: "グレートS太郎",  rarity: "R",   hp: 3000, atk: 280, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#6b7280", bodyColor: "#374151", hairColor: "#4b5563" },
  { id: "c004", name: "ダークS太郎",    rarity: "SR",  hp: 2400, atk: 370, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#8b5cf6", bodyColor: "#6d28d9", hairColor: "#4c1d95" },
  { id: "c005", name: "ファイヤーS太郎", rarity: "R",  hp: 2600, atk: 320, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#ef4444", bodyColor: "#dc2626", hairColor: "#991b1b" },
  { id: "c006", name: "超ザコ太郎",     rarity: "N",   hp: 100,  atk: 100, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#9ca3af", bodyColor: "#6b7280", hairColor: "#4b5563", description: "テスト用キャラクター" },
  { id: "c007", name: "孫悟天", rarity: "R", hp: 2000, atk: 320, rock: "rock_punch", scissors: "scissors_kick", paper: "paper_punch", color: "#fbbf24", bodyColor: "#f59e0b", hairColor: "#78350f", canFuse: true, fuseWith: "c008", description: "フュージョンでゴテンクスになれる！" },
  { id: "c008", name: "トランクス", rarity: "R", hp: 2100, atk: 300, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#60a5fa", bodyColor: "#3b82f6", hairColor: "#1d4ed8", canFuse: true, fuseWith: "c007", description: "フュージョンでゴテンクスになれる！" },
];

const GOTENKS_CARD = {
  id: "c_gotenks", name: "ゴテンクス", rarity: "SSR",
  hp: 3000, atk: 400,
  rock: "rock_kamehameha", scissors: "scissors_kick", paper: "paper_punch",
  color: "#a78bfa", bodyColor: "#7c3aed", hairColor: "#4c1d95",
  isGotenks: true,
  description: "フュージョン！ジャンケン勝利でSSJ→SSJ3へ変身！負けると1段階ずつ解除。",
};

const ENEMIES = [
  { id: "e001", name: "ザコ戦士",        hp: 1800, atk: 200, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#6b7280" },
  { id: "e002", name: "強敵！レッド将軍", hp: 2600, atk: 320, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#ef4444" },
  { id: "e003", name: "魔人ダーク",       hp: 3200, atk: 420, rock: "rock_punch", scissors: "scissors_slash", paper: "paper_beam", color: "#8b5cf6" },
];

const INITIAL_OWNED = ["c001", "c003", "c006", "c007", "c008"];

const SUPPORT_CARDS = [
  { id: "s001", name: "怒り", rarity: "SR", color: "#ef4444", glow: "#dc2626", description: "1段階変身した状態でバトル開始。孫悟空は界王拳状態からスタート。", timing: "battle_start", effect: "transform_start", illustSymbol: "🔥" },
  { id: "s002", name: "潜在能力の解放", rarity: "SR", color: "#a78bfa", glow: "#7c3aed", description: "HPが300、ATKが100上昇する。（永続）", timing: "battle_start", effect: "boost_stats", hpBoost: 300, atkBoost: 100, illustSymbol: "⚡" },
];

const EVENT_CARDS = [
  { id: "e001", name: "ナメック星人の力", rarity: "SSR", color: "#22d3ee", glow: "#0891b2", description: "5ターン以内に自分の体力が0になった時、体力を半分回復する。(1回限り)", timing: "on_ko", condition: "turn_lte_5", effect: "revive_half", illustSymbol: "💧" },
];

const INITIAL_SUPPORT = ["s001", "s002"];
const INITIAL_EVENT   = ["e001"];
const HANDS = ["rock", "scissors", "paper"];
const HAND_EMOJI = { rock: "✊", scissors: "✌️", paper: "🖐️" };

function judgeJanken(a, b) {
  if (a === b) return "draw";
  if ((a === "rock" && b === "scissors") || (a === "scissors" && b === "paper") || (a === "paper" && b === "rock")) return "win";
  return "lose";
}

const SpriteAnim = ({ sheet, frameW, frameH, frameCount, fps = 8, frameIndex = null, reversed = false, scale = 1, style = {}, flipH = false }) => {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef(null); const lastRef = useRef(0);
  useEffect(() => {
    if (frameIndex !== null) { setFrame(frameIndex); return; }
    const interval = 1000 / fps;
    const tick = (now) => { if (now - lastRef.current >= interval) { lastRef.current = now; setFrame(f => (f + 1) % frameCount); } rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [fps, frameCount, frameIndex]);
  const currentFrame = reversed ? (frameCount - 1 - frame) : frame;
  return <div style={{ width: frameW * scale, height: frameH * scale, backgroundImage: `url(${sheet})`, backgroundSize: `${frameW * frameCount * scale}px ${frameH * scale}px`, backgroundPosition: `${-(currentFrame * frameW) * scale}px 0px`, backgroundRepeat: 'no-repeat', transform: flipH ? 'scaleX(-1)' : 'none', imageRendering: 'pixelated', ...style }} />;
};

const SpriteOnce = ({ sheet, frameW, frameH, frameCount, fps = 10, reversed = false, scale = 1, style = {}, flipH = false, onDone }) => {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef(null); const lastRef = useRef(0); const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = false; setFrame(0);
    const interval = 1000 / fps;
    const tick = (now) => {
      if (doneRef.current) return;
      if (now - lastRef.current >= interval) { lastRef.current = now; setFrame(f => { const next = f + 1; if (next >= frameCount) { doneRef.current = true; onDone && setTimeout(onDone, 50); return f; } return next; }); }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sheet, frameCount, fps]);
  const currentFrame = reversed ? (frameCount - 1 - frame) : frame;
  return <div style={{ width: frameW * scale, height: frameH * scale, backgroundImage: `url(${sheet})`, backgroundSize: `${frameW * frameCount * scale}px ${frameH * scale}px`, backgroundPosition: `${-(currentFrame * frameW) * scale}px 0px`, backgroundRepeat: 'no-repeat', transform: flipH ? 'scaleX(-1)' : 'none', imageRendering: 'crisp-edges', ...style }} />;
};

const GokuFighter = ({ animState = 'idle', isEnemy = false, scale = 1 }) => {
  const flip = isEnemy;
  const s = scale * 0.5;
  const baseStyle = { position: 'relative', display: 'inline-block', filter: animState === 'kaioken_idle' ? 'drop-shadow(0 0 12px #ff4400) drop-shadow(0 0 24px #ff220088)' : animState === 'hit' ? 'drop-shadow(0 0 8px #ffffff) brightness(2)' : 'none', transition: 'filter 0.3s' };
  const gokuCard = CARDS[0];
  const w = 256 * s, h = 256 * s;
  const renderStickman = (state) => (
    <svg width={w} height={h} viewBox="0 0 120 168" style={{ overflow: "visible", filter: `drop-shadow(0 0 10px #f59e0baa)` }}>
      <g transform={flip ? "scale(-1,1)" : ""} style={{ transformOrigin: "60px 84px" }}>
        <ellipse cx="60" cy="17" rx="16" ry="12" fill="#f59e0b" />
        <circle cx="60" cy="20" r="13" fill="#f5e6d3" stroke="#f59e0b" strokeWidth="2.5" />
        {animState === 'kaioken_idle' && <ellipse cx="60" cy="20" rx="16" ry="16" fill="none" stroke="#ff4400" strokeWidth="2" opacity="0.7" />}
        <line x1="60" y1="33" x2="60" y2="75" stroke="#f59e0b" strokeWidth="3.5" />
        {state === "attack" ? <>
          <line x1="60" y1="42" x2="95" y2="35" stroke="#f59e0b" strokeWidth="3" />
          <line x1="60" y1="42" x2="45" y2="58" stroke="#f59e0b" strokeWidth="3" />
        </> : state === "win" ? <>
          <line x1="60" y1="42" x2="40" y2="25" stroke="#f59e0b" strokeWidth="3" />
          <line x1="60" y1="42" x2="35" y2="58" stroke="#f59e0b" strokeWidth="3" />
        </> : <>
          <line x1="60" y1="42" x2="85" y2="58" stroke="#f59e0b" strokeWidth="3" />
          <line x1="60" y1="42" x2="35" y2="58" stroke="#f59e0b" strokeWidth="3" />
        </>}
        <line x1="60" y1="75" x2="78" y2="108" stroke="#f59e0b" strokeWidth="3" />
        <line x1="60" y1="75" x2="42" y2="108" stroke="#f59e0b" strokeWidth="3" />
      </g>
    </svg>
  );
  if (animState === 'idle') return <div style={baseStyle}>{renderStickman("idle")}</div>;
  if (animState === 'kaioken_idle') return <div style={{ ...baseStyle, filter: 'drop-shadow(0 0 16px #ff3300) drop-shadow(0 0 32px #ff110066)' }}>{renderStickman("idle")}</div>;
  if (animState === 'dash') return <div style={{ ...baseStyle, transform: flip ? 'scaleX(-1) translateX(-20px)' : 'translateX(20px)' }}>{renderStickman("idle")}</div>;
  if (animState === 'punch') return <div style={baseStyle}>{renderStickman("attack")}</div>;
  if (animState === 'kick') return <div style={{ ...baseStyle, transform: flip ? 'scaleX(-1)' : 'none' }}>{renderStickman("attack")}</div>;
  if (animState === 'beam') return <div style={{ ...baseStyle, filter: 'drop-shadow(0 0 20px #0088ff) drop-shadow(0 0 40px #0044ff88)' }}>{renderStickman("attack")}</div>;
  if (animState === 'hit') return <div style={{ ...baseStyle, filter: 'brightness(3) drop-shadow(0 0 8px white)', transform: flip ? 'scaleX(-1) translateX(-10px)' : 'translateX(-10px)' }}>{renderStickman("idle")}</div>;
  if (animState === 'win') return <div style={{ ...baseStyle, filter: 'drop-shadow(0 0 16px #ffd700)' }}>{renderStickman("win")}</div>;
  if (animState === 'lose') return <div style={{ ...baseStyle, opacity: 0.5, transform: 'rotate(20deg) translateY(10px)', filter: 'grayscale(1)' }}>{renderStickman("idle")}</div>;
  return <div style={baseStyle}>{renderStickman("idle")}</div>;
};

const StickmanFighter = ({ card, isEnemy, state = "idle", size = 100 }) => {
  const flip = isEnemy ? "scale(-1,1)" : "";
  const cx = 60, cy = 20;
  const animClass = state === "idle" ? "stickman-idle" : state === "attack" ? "stickman-attack" : state === "hit" ? "stickman-hit" : state === "win" ? "stickman-win" : state === "lose" ? "stickman-lose" : "";
  const [bx, by] = state === "attack" ? (isEnemy ? [-15, 0] : [15, 0]) : state === "hit" ? (isEnemy ? [10, 0] : [-10, 0]) : [0, 0];
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 120 168" style={{ overflow: "visible", filter: `drop-shadow(0 0 8px ${card.aura || card.color}88)` }}>
      <g transform={flip} style={{ transformOrigin: "60px 84px" }}>
        <g className={animClass} transform={`translate(${bx},${by})`}>
          {card.hairColor && <ellipse cx={cx} cy={cy - 2} rx="14" ry="10" fill={card.hairColor} />}
          <circle cx={cx} cy={cy} r="13" fill="#f5e6d3" stroke={card.color} strokeWidth="2.5" />
          <line x1={cx} y1={cy + 13} x2={cx} y2={cy + 55} stroke={card.bodyColor || card.color} strokeWidth="3.5" />
          {state === "attack" ? <>
            <line x1={cx} y1={cy + 22} x2={cx + 35} y2={cy + 15} stroke={card.bodyColor || card.color} strokeWidth="3" />
            <line x1={cx} y1={cy + 22} x2={cx - 15} y2={cy + 38} stroke={card.bodyColor || card.color} strokeWidth="3" />
          </> : <>
            <line x1={cx} y1={cy + 22} x2={cx + 25} y2={cy + 38} stroke={card.bodyColor || card.color} strokeWidth="3" />
            <line x1={cx} y1={cy + 22} x2={cx - 25} y2={cy + 38} stroke={card.bodyColor || card.color} strokeWidth="3" />
          </>}
          <line x1={cx} y1={cy + 55} x2={cx + 18} y2={cy + 88} stroke={card.bodyColor || card.color} strokeWidth="3" />
          <line x1={cx} y1={cy + 55} x2={cx - 18} y2={cy + 88} stroke={card.bodyColor || card.color} strokeWidth="3" />
        </g>
      </g>
    </svg>
  );
};

const CardBack = ({ small = false }) => {
  const w = small ? 80 : 130; const h = small ? 112 : 182;
  if (CARD_BACK_IMG) {
    return (
      <div style={{ width: w, height: h, borderRadius: 10, overflow: "hidden", border: "2px solid #f59e0b", boxShadow: "0 0 20px #f59e0b88" }}>
        <img src={CARD_BACK_IMG} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{ width: w, height: h, borderRadius: 10, background: "linear-gradient(135deg,#1a0a00,#2d1000,#1a0a00)", border: "2px solid #f59e0b", boxShadow: "0 0 20px #f59e0b88, inset 0 0 30px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.3 }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {Array.from({ length: 20 }).map((_, i) => (<line key={`d1-${i}`} x1={i * 14 - h} y1={0} x2={i * 14} y2={h} stroke="#f59e0b" strokeWidth="0.5" />))}
        {Array.from({ length: 20 }).map((_, i) => (<line key={`d2-${i}`} x1={i * 14} y1={0} x2={i * 14 - h} y2={h} stroke="#f59e0b" strokeWidth="0.5" />))}
      </svg>
      <div style={{ fontSize: 32, zIndex: 1, filter: "drop-shadow(0 0 8px #f59e0b)" }}>⭐</div>
      <div style={{ position: "absolute", bottom: 6, fontSize: 7, color: "#f59e0b88", fontFamily: "monospace", letterSpacing: 2 }}>CARDDAS</div>
    </div>
  );
};

const GokuCardDisplay = ({ card, selected, onClick, small = false }) => {
  const rar = RARITY_CONFIG[card.rarity];
  const w = small ? 80 : 130; const h = small ? 112 : 182;
  return (
    <div onClick={onClick} style={{ width: w, height: h, borderRadius: 10, background: "linear-gradient(160deg, #1a0500 0%, #2d1000 60%, #1a0800 100%)", border: `2px solid ${selected ? "#fbbf24" : rar.color}`, boxShadow: selected ? `0 0 20px #fbbf24, 0 0 40px #fbbf2466` : `0 0 10px ${rar.glow}55`, cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.2s", transform: selected ? "scale(1.06) translateY(-4px)" : "scale(1)", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px 4px", userSelect: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: rar.color, color: "#000", fontSize: small ? 7 : 9, fontWeight: "900", textAlign: "center", padding: "2px 0", fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{card.rarity}</div>
      <div style={{ marginTop: small ? 12 : 14, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <StickmanFighter card={card} size={small ? 44 : 72} />
      </div>
      <div style={{ fontSize: small ? 7 : 9, color: "#fff", fontWeight: "700", textAlign: "center", padding: "2px 2px 0", fontFamily: "'Courier New',monospace", textShadow: "0 0 8px #f59e0b", lineHeight: 1.2 }}>{card.name}</div>
      {!small && <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
        <div style={{ fontSize: 8, color: "#4ade80", fontFamily: "monospace" }}>HP:{card.hp}</div>
        <div style={{ fontSize: 8, color: "#f87171", fontFamily: "monospace" }}>ATK:{card.atk}</div>
      </div>}
    </div>
  );
};

const CardDisplay = ({ card, selected, onClick, small = false }) => {
  if (card.isGoku) return <GokuCardDisplay card={card} selected={selected} onClick={onClick} small={small} />;
  const rar = RARITY_CONFIG[card.rarity];
  const w = small ? 80 : 130; const h = small ? 112 : 182;
  return (
    <div onClick={onClick} style={{ width: w, height: h, borderRadius: 10, background: "linear-gradient(160deg,#1a1a2e,#16213e,#0f3460)", border: `2px solid ${selected ? "#fbbf24" : rar.color}`, boxShadow: selected ? `0 0 20px #fbbf24` : `0 0 10px ${rar.glow}55`, cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.2s", transform: selected ? "scale(1.06) translateY(-4px)" : "scale(1)", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px 4px", userSelect: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: rar.color, color: "#000", fontSize: small ? 7 : 9, fontWeight: "900", textAlign: "center", padding: "2px 0", fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{card.rarity}</div>
      <div style={{ marginTop: small ? 12 : 14, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <StickmanFighter card={card} size={small ? 44 : 72} />
      </div>
      <div style={{ fontSize: small ? 7 : 9, color: "#fff", fontWeight: "700", textAlign: "center", padding: "2px 2px 0", fontFamily: "'Courier New',monospace", textShadow: `0 0 8px ${card.color}`, lineHeight: 1.2 }}>{card.name}</div>
      {!small && <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
        <div style={{ fontSize: 8, color: "#4ade80", fontFamily: "monospace" }}>HP:{card.hp}</div>
        <div style={{ fontSize: 8, color: "#f87171", fontFamily: "monospace" }}>ATK:{card.atk}</div>
      </div>}
    </div>
  );
};

const HpBar = ({ displayHp, max, flip = false, playerLabel = "1P" }) => {
  const pct = Math.max(0, Math.min(1, displayHp / max));
  const VW = 260, VH = 48, R = 7;
  const outerPath = [`M ${VW} ${3 + R}`, `L ${VW} ${VH - 3 - R}`, `Q ${VW} ${VH - 3} ${VW - R} ${VH - 3}`, `L 32 ${VH - 4}`, `Q 10 ${VH - 4} 2 ${VH - 14}`, `Q 0 ${VH - 20} 4 ${VH - 29}`, `C 36 ${VH - 34} 90 10 ${VW - R} 3`, `Q ${VW} 3 ${VW} ${3 + R}`, `Z`].join(" ");
  const barW = pct * (VW - 8);
  const innerBarPath = barW < 5 ? null : (() => {
    const bx = 5 + barW;
    const t = barW / (VW - 8);
    const topAtBx = 6 + (VH - 33 - 6) * Math.pow(1 - t, 1.8);
    const topCurve = pct >= 0.98 ? `C 38 ${VH - 32} 92 12 ${VW - 5 - R} 6 Q ${VW - 5} 6 ${VW - 5} ${6 + R}` : `L ${bx} ${topAtBx}`;
    const rightEdge = pct >= 0.98 ? [`L ${VW - 5} ${VH - 3 - R}`, `Q ${VW - 5} ${VH - 5} ${VW - 5 - R} ${VH - 5}`] : [`L ${bx} ${VH - 6}`];
    return [`M 5 ${VH - 16}`, `Q 4 ${VH - 22} 6 ${VH - 30}`, topCurve, ...rightEdge, `L 30 ${VH - 6}`, `Q 12 ${VH - 5} 5 ${VH - 16}`, `Z`].join(" ");
  })();
  const isLow = pct <= 0.25 && pct > 0;
  const uid = flip ? "e" : "p";
  const gradId = `hpG_${uid}`, shineId = `hpS_${uid}`, bgId = `hpBG_${uid}`;
  const shapeTransform = !flip ? `scale(-1,1) translate(-${VW},0)` : undefined;
  const hpNumX = flip ? VW - 10 : 10, hpNumAnchor = flip ? "end" : "start";
  const labelX = flip ? 36 : VW - 36, labelAnchor = flip ? "start" : "end";
  return (
    <div style={{ width: "100%", position: "relative", userSelect: "none" }}>
      <svg viewBox={`-4 -2 ${VW + 8} ${VH + 4}`} width="100%" height={VH + 4} style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.85)) drop-shadow(0 0 3px rgba(0,0,0,1))" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d4ff00" /><stop offset="25%" stopColor="#8fff00" /><stop offset="65%" stopColor="#4ade80" /><stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.65)" /><stop offset="45%" stopColor="rgba(255,255,255,0.12)" /><stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
          </linearGradient>
          <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e2e20" /><stop offset="100%" stopColor="#0a1209" />
          </linearGradient>
        </defs>
        <g transform={shapeTransform}>
          <path d={outerPath} fill="none" stroke="rgba(215,225,215,0.7)" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
          <path d={outerPath} fill={`url(#${bgId})`} stroke="#1a2a1c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {innerBarPath && <path d={innerBarPath} fill={`url(#${gradId})`} style={{ filter: isLow ? "brightness(1.6) saturate(2)" : "none" }} />}
          {innerBarPath && <path d={innerBarPath} fill={`url(#${shineId})`} pointerEvents="none" />}
          {isLow && innerBarPath && <path d={innerBarPath} fill="rgba(239,68,68,0.5)" style={{ animation: "pulse 0.5s infinite" }} />}
          <path d={outerPath} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        </g>
        {[[-2,-2],[2,-2],[-2,2],[2,2]].map(([dx,dy],i) => (<text key={i} x={hpNumX} y={VH*0.2} textAnchor={hpNumAnchor} dominantBaseline="middle" fontFamily="'Arial Black','Impact',sans-serif" fontWeight="900" fontSize="57" fill="#000" opacity="0.95" transform={`translate(${dx},${dy})`}>{Math.max(0,Math.round(displayHp))}</text>))}
        <text x={hpNumX} y={VH*0.2} textAnchor={hpNumAnchor} dominantBaseline="middle" fontFamily="'Arial Black','Impact',sans-serif" fontWeight="900" fontSize="57" fill="#fff">{Math.max(0,Math.round(displayHp))}</text>
        {[[-2,-2],[2,-2],[-2,2],[2,2]].map(([dx,dy],i) => (<text key={i} x={labelX} y={VH*0.2} textAnchor={labelAnchor} dominantBaseline="middle" fontFamily="'Arial Black','Impact',sans-serif" fontWeight="900" fontSize="28" fill="#000" opacity="0.95" transform={`translate(${dx},${dy})`}>{playerLabel}</text>))}
        <text x={labelX} y={VH*0.2} textAnchor={labelAnchor} dominantBaseline="middle" fontFamily="'Arial Black','Impact',sans-serif" fontWeight="900" fontSize="28" fill="#fff">{playerLabel}</text>
      </svg>
    </div>
  );
};

const HAND_COLOR = { rock: "#ef4444", scissors: "#f59e0b", paper: "#3b82f6" };
const HAND_LABEL = { rock: "グー", scissors: "チョキ", paper: "パー" };
const HAND_BG = { rock: "#1a0505", scissors: "#1a1005", paper: "#030d1a" };

const JankenBtn = ({ hand, playerCard, onSelect, selected }) => {
  const locked = selected !== null;
  const isSelected = selected === hand;
  const color = HAND_COLOR[hand];
  const MOVE_LABEL = playerCard?.isGoku
    ? { rock: "超かめはめ波", scissors: "回転蹴り", paper: "正拳突き" }
    : { rock: "必殺技", scissors: "蹴り", paper: "パンチ" };
  return (
    <button onClick={() => !locked && onSelect(hand)} style={{ width: 64, height: 64, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${HAND_BG[hand]}, #000)`, border: isSelected ? `3px solid ${color}` : `3px solid ${locked ? "#1f2937" : color}`, cursor: locked ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 0, flexShrink: 0, boxShadow: isSelected ? `0 0 20px ${color}cc, 0 0 40px ${color}55, inset 0 1px 0 rgba(255,255,255,0.2)` : locked ? "none" : `0 0 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.1)`, opacity: locked && !isSelected ? 0.22 : 1, transform: isSelected ? "scale(1.12)" : "scale(1)", transition: "all 0.15s" }}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>{HAND_EMOJI[hand]}</span>
      <span style={{ fontSize: 8, color: locked && !isSelected ? "#374151" : color, fontWeight: "700" }}>{HAND_LABEL[hand]}</span>
      <span style={{ fontSize: 6, color: "rgba(255,255,255,0.28)", maxWidth: 56, textAlign: "center" }}>{MOVE_LABEL[hand]}</span>
    </button>
  );
};

const EnemyHandDisplay = ({ hand, slot, phase }) => {
  const showHand = phase === "reveal" && hand;
  const showOnSlot = slot === "top";
  if (showHand && !showOnSlot) return null;
  return (
    <div style={{ width: 64, height: 64, borderRadius: "50%", background: showHand && showOnSlot ? `radial-gradient(circle at 35% 35%, ${HAND_BG[hand] || "#0d0d0d"}, #000)` : "radial-gradient(circle at 35% 35%,#0d0d0d,#000)", border: `3px solid ${showHand && showOnSlot ? (HAND_COLOR[hand] || "#4ade80") : "#1f2937"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: showHand && showOnSlot ? 1 : 0.45, gap: 1, boxShadow: showHand && showOnSlot ? `0 0 14px ${HAND_COLOR[hand] || "#4ade80"}55` : "none", transition: "all 0.2s" }}>
      {showHand && showOnSlot ? <>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{HAND_EMOJI[hand]}</span>
        <span style={{ fontSize: 8, color: HAND_COLOR[hand] || "#4ade80", fontWeight: "700" }}>{HAND_LABEL[hand]}</span>
      </> : <span style={{ fontSize: 22, color: "#374151", animation: phase === "waiting_enemy" ? "pulse 0.6s infinite" : "none" }}>?</span>}
    </div>
  );
};

const ROULETTE_TOTAL = 70;

function placeSlots(total, count, type, slots, clusterStrength) {
  if (count <= 0) return;
  if (Math.random() < 0.10) {
    const start = Math.floor(Math.random() * total);
    for (let k = 0; k < count; k++) slots[(start + k) % total] = type;
    return;
  }
  const occupied = new Set();
  for (let i = 0; i < total; i++) {
    if (slots[i] !== "normal" && slots[i] !== "none" && slots[i] !== "low") occupied.add(i);
  }
  const maxGroupSize = Math.max(1, Math.round(1 + clusterStrength * (count - 1)));
  let placed = 0;
  while (placed < count) {
    const groupSize = Math.min(count - placed, 1 + Math.floor(Math.random() * maxGroupSize));
    let start = -1;
    for (let attempt = 0; attempt < 200; attempt++) {
      const candidate = Math.floor(Math.random() * total);
      let fits = true;
      for (let k = 0; k < groupSize; k++) {
        if (occupied.has((candidate + k) % total)) { fits = false; break; }
      }
      if (fits) { start = candidate; break; }
    }
    if (start === -1) {
      for (let attempt = 0; attempt < 300 && placed < count; attempt++) {
        const pos = Math.floor(Math.random() * total);
        if (!occupied.has(pos)) { slots[pos] = type; occupied.add(pos); placed++; }
      }
      break;
    }
    let cur = start;
    for (let k = 0; k < groupSize && placed < count; k++) {
      slots[cur % total] = type; occupied.add(cur % total); placed++;
      const skip = (clusterStrength < 1.0 && Math.random() > clusterStrength) ? 1 + Math.floor(Math.random() * 2) : 0;
      cur += 1 + skip;
    }
  }
}

function buildAttackSlots(lv) {
  const slots = Array(ROULETTE_TOTAL).fill("normal");
  if (lv === 1) placeSlots(ROULETTE_TOTAL, 2, "special", slots, 0.0);
  else if (lv === 2) placeSlots(ROULETTE_TOTAL, 3, "special", slots, 0.5);
  else placeSlots(ROULETTE_TOTAL, 4, "special", slots, 0.8);
  return slots;
}

function buildGuardSlots(lv) {
  if (lv === 1) {
    const s = Array(ROULETTE_TOTAL).fill("none");
    placeSlots(ROULETTE_TOTAL, 4, "low", s, 0.0);
    return s;
  } else if (lv === 2) {
    const s = Array(ROULETTE_TOTAL).fill("none");
    placeSlots(ROULETTE_TOTAL, 6, "mid", s, 0.5);
    placeSlots(ROULETTE_TOTAL, 8, "low", s, 0.1);
    return s;
  } else {
    const s = Array(ROULETTE_TOTAL).fill("low");
    placeSlots(ROULETTE_TOTAL, 12, "mid", s, 0.5);
    placeSlots(ROULETTE_TOTAL, 6, "high", s, 0.8);
    return s;
  }
}
const GUARD_REDUCTION = { none: 0, low: 0.15, mid: 0.30, high: 0.50 };
const GUARD_LABEL = { none: "0%軽減", low: "15%軽減", mid: "30%軽減", high: "50%軽減" };
const GUARD_COLOR = { none: "#374151", low: "#3b82f6", mid: "#8b5cf6", high: "#f59e0b" };

const RouletteWheel = ({ slots, currentIdx, isAttack, lv, onTap, stopped, result, size = 260 }) => {
  const N = slots.length;
  const scale = size / 260;
  const R = Math.round(118 * scale), r = Math.round(76 * scale);
  const cx = Math.round(130 * scale), cy = Math.round(130 * scale);
  const getColor = (type, isActive) => {
    if (isActive) return "#ffffff";
    if (isAttack) return type === "special" ? "#ef4444" : "#1e293b";
    return { high: "#f59e0b", mid: "#8b5cf6", low: "#3b82f6", none: "#1e293b" }[type] || "#1e293b";
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, fontFamily: "monospace" }}>
      <div style={{ fontWeight: "900", fontSize: 20, color: isAttack ? "#ef4444" : "#3b82f6", textShadow: isAttack ? "0 0 14px #ef4444" : "0 0 14px #3b82f6", letterSpacing: 3 }}>{isAttack ? "アタック" : "ガード"}</div>
      <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: 3 }}>レベル. {lv}</div>
      <div style={{ position: "relative", width: size, height: size, cursor: stopped ? "default" : "pointer", userSelect: "none" }} onClick={!stopped ? onTap : undefined} onTouchEnd={!stopped ? (e) => { e.preventDefault(); onTap(); } : undefined}>
        <svg width={size} height={size} style={{ overflow: "visible" }}>
          <defs><filter id="glowW"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
          {slots.map((type, i) => {
            const a1 = (i / N) * 2 * Math.PI - Math.PI / 2;
            const a2 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
            const isActive = i === currentIdx;
            const ox1 = cx + R * Math.cos(a1), oy1 = cy + R * Math.sin(a1);
            const ox2 = cx + R * Math.cos(a2), oy2 = cy + R * Math.sin(a2);
            const ix1 = cx + r * Math.cos(a1), iy1 = cy + r * Math.sin(a1);
            const ix2 = cx + r * Math.cos(a2), iy2 = cy + r * Math.sin(a2);
            return (
              <g key={i}>
                <path d={`M ${ox1} ${oy1} A ${R} ${R} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${r} ${r} 0 0 0 ${ix1} ${iy1} Z`} fill={getColor(type, isActive)} opacity={isActive ? 1 : type === "none" ? 0.4 : 0.82} filter={isActive ? "url(#glowW)" : undefined} />
                <line x1={ox1} y1={oy1} x2={ix1} y2={iy1} stroke="rgba(255,255,255,0.55)" strokeWidth={1.2} />
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={r - 2} fill="rgba(0,0,0,0.88)" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          <polygon points={`${cx},${cy - R + 6} ${cx - 8},${cy - R - 8} ${cx + 8},${cy - R - 8}`} fill={isAttack ? "#ef4444" : "#3b82f6"} style={{ filter: `drop-shadow(0 0 5px ${isAttack ? "#ef4444" : "#3b82f6"})` }} />
          {stopped && result ? (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={isAttack ? (result === "special" ? "#ef4444" : "#9ca3af") : (GUARD_COLOR[result] || "#9ca3af")} fontSize={isAttack ? 13 : 11} fontWeight="900" fontFamily="monospace">
              {isAttack ? (result === "special" ? "必殺技！" : "ノーマル") : GUARD_LABEL[result]}
            </text>
          ) : (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.5)" fontSize={12} fontWeight="900" fontFamily="monospace">TAP !</text>
          )}
        </svg>
      </div>
    </div>
  );
};

const TitleBtn = ({ label, color, onClick, primary, badge }) => (
  <button onClick={onClick} style={{ padding: "14px 20px", background: primary ? `linear-gradient(135deg,${color}33,${color}11)` : "rgba(255,255,255,0.04)", border: `2px solid ${color}`, borderRadius: 8, color: color, fontSize: 14, fontWeight: "700", fontFamily: "'Courier New',monospace", cursor: "pointer", boxShadow: primary ? `0 0 20px ${color}44` : "none", transition: "all 0.2s", letterSpacing: 1, position: "relative" }}>
    {label}
    {badge !== undefined && <span style={{ position: "absolute", top: -8, right: -8, background: color, color: "#000", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "900" }}>{badge}</span>}
  </button>
);

const TitleScreen = ({ onStart, onGacha, onCards, ownedCards }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", background: "#000", padding: "0 0 32px", fontFamily: "'Courier New',monospace", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 160, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, fontWeight: "900", color: "#f59e0b", textShadow: "0 0 40px #f59e0b, 0 0 80px #f59e0b44", fontFamily: "'Courier New',monospace", letterSpacing: 4, animation: "titlePulse 2s ease-in-out infinite" }}>STICKMAN<br />CARDDAS</div>
        <div style={{ marginTop: 20 }}><StickmanFighter card={CARDS[0]} size={120} state="idle" /></div>
      </div>
    </div>
    <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 400, padding: "20px 24px 8px", background: "linear-gradient(0deg,rgba(0,0,0,0.95) 80%,transparent 100%)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <TitleBtn label="▶ ゲームをはじめる" color="#f59e0b" onClick={onStart} primary />
        <TitleBtn label="🎴 カードを引く" color="#4ade80" onClick={onGacha} />
        <TitleBtn label="📋 所持カード一覧" color="#60a5fa" onClick={onCards} badge={ownedCards.length} />
      </div>
      <div style={{ marginTop: 16, fontSize: 9, color: "#6b7280", textAlign: "center" }}>©STICKMAN CARDDAS — Original Work</div>
    </div>
  </div>
);

const CoinInsertScreen = ({ coins, onInsert, onBack }) => {
  const [inserting, setInserting] = useState(false);
  const handleInsert = () => { setInserting(true); setTimeout(() => { setInserting(false); onInsert(); }, 1200); };
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#0a0a0a,#1a1a1a)", fontFamily: "'Courier New',monospace", padding: 20 }}>
      <div style={{ border: "3px solid #f59e0b", borderRadius: 16, padding: "30px 40px", background: "linear-gradient(180deg,#1a1200,#0a0800)", textAlign: "center", maxWidth: 320, width: "100%", boxShadow: "0 0 40px #f59e0b44" }}>
        <div style={{ fontSize: 14, color: "#f59e0b", letterSpacing: 4, marginBottom: 20 }}>★ STICKMAN CARDDAS ★</div>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🪙</div>
        <div style={{ fontSize: 32, fontWeight: "900", color: "#f59e0b", textShadow: "0 0 20px #f59e0b", marginBottom: 4 }}>100コイン</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>を投入してください</div>
        <div style={{ fontSize: 12, color: "#4ade80", marginBottom: 24 }}>コイン残高: <span style={{ fontWeight: "900", fontSize: 16 }}>{coins}</span></div>
        <button onClick={handleInsert} disabled={inserting || coins < 100} style={{ width: "100%", padding: "16px", borderRadius: 8, background: inserting ? "#374151" : coins >= 100 ? "linear-gradient(135deg,#f59e0b,#d97706)" : "#1f2937", border: "none", color: coins >= 100 ? "#000" : "#6b7280", fontSize: 16, fontWeight: "900", cursor: coins >= 100 ? "pointer" : "not-allowed", fontFamily: "'Courier New',monospace", letterSpacing: 2, boxShadow: coins >= 100 ? "0 4px 20px #f59e0b88" : "none", transition: "all 0.2s" }}>
          {inserting ? "投入中..." : "100コイン 投入！"}
        </button>
        {coins < 100 && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 8 }}>コインが不足しています</div>}
      </div>
      <button onClick={onBack} style={{ marginTop: 20, padding: "10px 30px", background: "transparent", border: "1px solid #374151", borderRadius: 8, color: "#6b7280", fontFamily: "monospace", cursor: "pointer" }}>← もどる</button>
    </div>
  );
};

const GachaResultScreen = ({ card, mode = "gacha", onHome, onBuyAgain, onSelectCard }) => {
  const [phase, setPhase] = useState(0);
  const rar = RARITY_CONFIG[card.rarity];
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 2200);
    const t4 = setTimeout(() => setPhase(4), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse at center,${rar.color}22 0%,#000 70%)`, fontFamily: "'Courier New',monospace", padding: 20, overflow: "hidden" }}>
      {phase >= 2 && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", width: "200vw", height: 2, background: `linear-gradient(90deg, transparent 40%, ${rar.color}44, transparent 60%)`, transform: `rotate(${i * 30}deg)`, animation: "rayRotate 8s linear infinite", transformOrigin: "center" }} />
          ))}
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        {phase >= 1 && (<div style={{ fontSize: 12, color: rar.color, letterSpacing: 4, marginBottom: 20, animation: "fadeInUp 0.5s ease", textShadow: `0 0 20px ${rar.color}` }}>✦ カード排出！ ✦</div>)}
        {phase >= 1 && (
          <div style={{ perspective: "1000px", marginBottom: 20 }}>
            <div style={{ width: 130, height: 182, position: "relative", transformStyle: "preserve-3d", transition: phase >= 2 ? "transform 0.9s cubic-bezier(0.4,0,0.2,1)" : "none", transform: phase >= 2 ? "rotateY(180deg)" : "rotateY(0deg)", margin: "0 auto", animation: phase === 1 ? "cardAppear 0.5s cubic-bezier(0.34,1.56,0.64,1)" : "none" }}>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}><CardBack /></div>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <div style={{ width: 130, height: 182, borderRadius: 10, background: card.isGoku ? "linear-gradient(160deg,#1a0500,#2d1000,#1a0800)" : "linear-gradient(160deg,#1a1a2e,#16213e,#0f3460)", border: `3px solid ${rar.color}`, boxShadow: `0 0 40px ${rar.glow}88`, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px 4px" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: rar.color, color: "#000", fontSize: 9, fontWeight: "900", textAlign: "center", padding: "2px 0", fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{card.rarity} — {rar.label}</div>
                  <div style={{ marginTop: 14, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <StickmanFighter card={card} size={72} state="win" />
                  </div>
                  <div style={{ fontSize: 10, color: "#fff", fontWeight: "700", textAlign: "center", fontFamily: "'Courier New',monospace", textShadow: `0 0 8px ${card.color}` }}>{card.name}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {phase >= 3 && (
          <div style={{ animation: "fadeInUp 0.5s ease", background: "rgba(0,0,0,0.7)", border: `1px solid ${rar.color}44`, borderRadius: 12, padding: "14px 20px", maxWidth: 260, margin: "0 auto 16px" }}>
            <div style={{ fontSize: 18, fontWeight: "900", color: "#fff", marginBottom: 12, textShadow: `0 0 10px ${card.color}` }}>{card.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "8px", textAlign: "center", border: "1px solid #4ade8033" }}>
                <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2 }}>HP</div>
                <div style={{ fontSize: 24, fontWeight: "900", color: "#4ade80", textShadow: "0 0 10px #4ade80" }}>{card.hp}</div>
              </div>
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "8px", textAlign: "center", border: "1px solid #f8717133" }}>
                <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2 }}>ATK</div>
                <div style={{ fontSize: 24, fontWeight: "900", color: "#f87171", textShadow: "0 0 10px #f87171" }}>{card.atk}</div>
              </div>
            </div>
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "8px 10px", border: "1px solid #ef444433" }}>
              <div style={{ fontSize: 9, color: "#ef4444", letterSpacing: 2, marginBottom: 6, fontWeight: "700" }}>✦ 必殺技</div>
              {[card.rock, card.scissors, card.paper].filter((v, i, a) => a.indexOf(v) === i).filter(moveId => MOVES[moveId]?.type === "special").map((moveId, i) => {
                const m = MOVES[moveId];
                return (<div key={i} style={{ fontSize: 13, color: m.color, fontWeight: "700", textShadow: `0 0 8px ${m.color}`, letterSpacing: 1 }}>💥 {m.name}</div>);
              })}
            </div>
          </div>
        )}
        {phase >= 4 && (
          <div style={{ animation: "fadeInUp 0.4s ease", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            {mode === "game" ? (
              <button onClick={onSelectCard} style={{ padding: "16px 48px", background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 8, color: "#000", fontSize: 15, fontWeight: "900", cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 24px #f59e0b99", letterSpacing: 1 }}>🃏 カードを選択する</button>
            ) : (<>
              <button onClick={onBuyAgain} style={{ padding: "14px 40px", background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 8, color: "#000", fontSize: 14, fontWeight: "900", cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px #f59e0b88", letterSpacing: 1 }}>🎴 もう一度購入する</button>
              <button onClick={onHome} style={{ padding: "12px 40px", background: "transparent", border: "2px solid #6b7280", borderRadius: 8, color: "#9ca3af", fontSize: 13, fontWeight: "700", cursor: "pointer", fontFamily: "monospace" }}>🏠 ホームへ</button>
            </>)}
          </div>
        )}
      </div>
    </div>
  );
};

const DigitalMatrixBg = () => {
  const rows = 16, cols = 20;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="none">
        {Array.from({ length: rows + 1 }).map((_, i) => (<line key={`h${i}`} x1="0" y1={`${(i / rows) * 100}%`} x2="100%" y2={`${(i / rows) * 100}%`} stroke="#00ff4433" strokeWidth="0.5" />))}
        {Array.from({ length: cols + 1 }).map((_, i) => (<line key={`v${i}`} x1={`${(i / cols) * 100}%`} y1="0" x2={`${(i / cols) * 100}%`} y2="100%" stroke="#00ff4433" strokeWidth="0.5" />))}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#00ff4488,transparent)", animation: "scanline 3s linear infinite" }} />
    </div>
  );
};

const DataAssembleChar = ({ card, assembled }) => {
  const [scanLines, setScanLines] = useState(0);
  useEffect(() => {
    if (!assembled) { setScanLines(0); return; }
    let n = 0;
    const iv = setInterval(() => { n++; setScanLines(n); if (n >= 20) clearInterval(iv); }, 40);
    return () => clearInterval(iv);
  }, [assembled, card?.id]);
  if (!card || !assembled) return null;
  return (
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", filter: scanLines < 20 ? `brightness(${0.3 + scanLines * 0.035}) saturate(${scanLines * 0.05})` : "none", transition: "filter 0.1s" }}>
        {card.isGoku ? <GokuFighter animState="idle" scale={0.85} /> : <StickmanFighter card={card} size={110} state="idle" />}
      </div>
      <div style={{ marginTop: 8, fontFamily: "monospace", textAlign: "center", animation: scanLines >= 20 ? "fadeInUp 0.3s ease" : "none", opacity: scanLines >= 20 ? 1 : 0 }}>
        <div style={{ fontSize: 14, fontWeight: "900", color: "#00ff44", textShadow: "0 0 10px #00ff44", letterSpacing: 2 }}>{card.name}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
          <div style={{ fontSize: 11, color: "#4ade80" }}>HP <span style={{ color: "#fff", fontWeight: "700" }}>{card.hp}</span></div>
          <div style={{ fontSize: 11, color: "#f87171" }}>ATK <span style={{ color: "#fff", fontWeight: "700" }}>{card.atk}</span></div>
        </div>
        <div style={{ fontSize: 10, color: "#00ff44aa", marginTop: 2, letterSpacing: 1 }}>[{RARITY_CONFIG[card.rarity].label}]</div>
      </div>
    </div>
  );
};

const CardCutIn = ({ card, cardType, onDone }) => {
  const [phase, setPhase] = useState("cutin");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("card"), 800);
    const t2 = setTimeout(() => setPhase("effect"), 1600);
    const t3 = setTimeout(() => setPhase("fadeout"), 3200);
    const t4 = setTimeout(() => onDone(), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);
  const isSupport = cardType === "support";
  const ac = card.color;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 95, overflow: "hidden", opacity: phase === "fadeout" ? 0 : 1, transition: phase === "fadeout" ? "opacity 0.6s ease" : "none", background: isSupport ? "linear-gradient(160deg,rgba(26,0,0,0.94),rgba(48,0,16,0.96),rgba(26,5,0,0.94))" : "linear-gradient(160deg,rgba(0,16,26,0.94),rgba(0,26,48,0.96),rgba(0,10,16,0.94))" }}>
      {Array.from({ length: 12 }).map((_, i) => (<div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: "200vw", height: 1.5, background: `linear-gradient(90deg,transparent 30%,${ac}44,transparent 70%)`, transform: `rotate(${i * 30}deg)`, transformOrigin: "0 50%", animation: "rayRotate 5s linear infinite" }} />))}
      {phase === "cutin" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: "cutInBannerIn 0.4s cubic-bezier(0.22,1,0.36,1) forwards" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 28, color: "#fff", textShadow: `0 0 30px ${ac}, 0 0 60px ${ac}88, 3px 3px 0 #000`, letterSpacing: 3, lineHeight: 1.3 }}>{isSupport ? "⚡ サポートカード" : "🌟 イベントカード"}</div>
            <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 36, color: ac, textShadow: `0 0 20px ${ac}, 0 0 40px ${ac}88`, letterSpacing: 4, marginTop: 4 }}>発動！</div>
          </div>
        </div>
      )}
      {(phase === "card" || phase === "effect" || phase === "fadeout") && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div style={{ animation: "fadeInUp 0.3s ease", textAlign: "center" }}>
            <div style={{ display: "inline-block", background: `linear-gradient(135deg,${ac}22,${ac}44)`, border: `2px solid ${ac}`, borderRadius: 8, padding: "5px 18px", fontSize: 12, fontWeight: "900", color: ac, fontFamily: "'Courier New',monospace", letterSpacing: 3 }}>{isSupport ? "⚡ サポートカード発動！" : "🌟 イベントカード発動！"}</div>
          </div>
          <div style={{ animation: phase === "card" ? "cutInCardIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both" : "none" }}>
            <div style={{ width: 130, height: 182, borderRadius: 10, background: `linear-gradient(160deg,${ac}18,${ac}08,${isSupport ? "#0a0010" : "#000a10"})`, border: `2px solid ${ac}`, boxShadow: `0 0 30px ${ac}aa, 0 0 60px ${ac}44`, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px 6px", userSelect: "none" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: ac, color: "#000", fontSize: 8, fontWeight: "900", textAlign: "center", padding: "2px 0", fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{card.rarity} — {isSupport ? "サポート" : "イベント"}</div>
              <div style={{ marginTop: 16, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 52, filter: `drop-shadow(0 0 14px ${ac})`, animation: "pulse 1s infinite" }}>{card.illustSymbol}</div>
              </div>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: "700", textAlign: "center", padding: "2px 4px 0", fontFamily: "'Courier New',monospace", textShadow: `0 0 8px ${ac}`, lineHeight: 1.2 }}>{card.name}</div>
            </div>
          </div>
          {phase === "effect" && (
            <div style={{ animation: "fadeInUp 0.4s ease", background: "rgba(0,0,0,0.85)", border: `1px solid ${ac}66`, borderRadius: 10, padding: "12px 20px", maxWidth: 260, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: ac, letterSpacing: 2, marginBottom: 6, fontWeight: "700" }}>{isSupport ? "サポート効果" : "イベント効果"}</div>
              <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6, fontFamily: "monospace" }}>{card.description}</div>
            </div>
          )}
        </div>
      )}
      {phase === "effect" && (
        <div style={{ position: "absolute", bottom: "8%", left: 0, right: 0, textAlign: "center", animation: "fadeInUp 0.3s ease" }}>
          <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 20, color: "#fff", textShadow: `0 0 20px ${ac},2px 2px 0 #000`, letterSpacing: 4, animation: "pulse 0.5s infinite" }}>✦ 効果付与！ ✦</div>
        </div>
      )}
    </div>
  );
};

const SupportCardSelectScreen = ({ ownedSupports, onSelect, onSkip }) => {
  const [selected, setSelected] = useState(null);
  const cards = ownedSupports.map(id => SUPPORT_CARDS.find(c => c.id === id)).filter(Boolean);
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#100005,#200010)", fontFamily: "'Courier New',monospace", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#f87171", letterSpacing: 4, textShadow: "0 0 10px #ef4444", fontWeight: "900" }}>⚡ サポートカード選択 ⚡</div>
        <div style={{ fontSize: 9, color: "#f8717188", marginTop: 4, letterSpacing: 2 }}>バトル開始前に効果を発動するカードを選んでください</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12, justifyItems: "center", paddingBottom: 100 }}>
          {cards.map(card => (
            <div key={card.id} onClick={() => setSelected(selected?.id === card.id ? null : card)} style={{ cursor: "pointer" }}>
              <div style={{ width: 130, height: 182, borderRadius: 10, background: `linear-gradient(160deg,${card.color}18,${card.color}08,#0a0010)`, border: `2px solid ${selected?.id === card.id ? card.color : card.color + "55"}`, boxShadow: selected?.id === card.id ? `0 0 20px ${card.color}, 0 0 40px ${card.color}66` : `0 0 10px ${card.color}33`, cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.2s", transform: selected?.id === card.id ? "scale(1.06) translateY(-4px)" : "scale(1)", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px 6px", userSelect: "none" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: card.color, color: "#000", fontSize: 8, fontWeight: "900", textAlign: "center", padding: "2px 0", fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{card.rarity} — サポート</div>
                <div style={{ marginTop: 16, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 52, filter: `drop-shadow(0 0 12px ${card.color})`, animation: selected?.id === card.id ? "pulse 1s infinite" : "none" }}>{card.illustSymbol}</div>
                </div>
                <div style={{ fontSize: 11, color: "#fff", fontWeight: "700", textAlign: "center", padding: "2px 4px 0", fontFamily: "'Courier New',monospace", textShadow: `0 0 8px ${card.color}`, lineHeight: 1.2 }}>{card.name}</div>
                <div style={{ fontSize: 8, color: card.color + "cc", textAlign: "center", padding: "3px 4px 0", lineHeight: 1.3 }}>{card.description}</div>
                {selected?.id === card.id && (<div style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: card.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "900", color: "#000" }}>✓</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px", background: "linear-gradient(0deg,rgba(16,0,5,0.98) 80%,transparent 100%)", display: "flex", flexDirection: "column", gap: 10 }}>
        {selected && (<button onClick={() => onSelect(selected)} style={{ padding: "14px", background: `linear-gradient(135deg,${selected.color},${selected.glow})`, border: "none", borderRadius: 8, color: "#000", fontSize: 14, fontWeight: "900", cursor: "pointer", fontFamily: "monospace", boxShadow: `0 4px 20px ${selected.color}88` }}>✦ このカードを使う</button>)}
        <button onClick={() => onSkip(null)} style={{ padding: "12px", background: "transparent", border: "1px solid #374151", borderRadius: 8, color: "#6b7280", fontSize: 12, cursor: "pointer", fontFamily: "monospace" }}>使わずに進む →</button>
      </div>
    </div>
  );
};

const EventCardSelectScreen = ({ ownedEvents, onSelect, onSkip }) => {
  const [selected, setSelected] = useState(null);
  const cards = ownedEvents.map(id => EVENT_CARDS.find(c => c.id === id)).filter(Boolean);
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#00101a,#00051a)", fontFamily: "'Courier New',monospace", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#22d3ee", letterSpacing: 4, textShadow: "0 0 10px #0891b2", fontWeight: "900" }}>🌟 イベントカード選択 🌟</div>
        <div style={{ fontSize: 9, color: "#22d3ee88", marginTop: 4, letterSpacing: 2 }}>特定の状況で自動発動するカードを選んでください</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12, justifyItems: "center", paddingBottom: 100 }}>
          {cards.map(card => (
            <div key={card.id} onClick={() => setSelected(selected?.id === card.id ? null : card)} style={{ cursor: "pointer" }}>
              <div style={{ width: 130, height: 182, borderRadius: 10, background: `linear-gradient(160deg,${card.color}18,${card.color}08,#000a10)`, border: `2px solid ${selected?.id === card.id ? card.color : card.color + "55"}`, boxShadow: selected?.id === card.id ? `0 0 20px ${card.color}, 0 0 40px ${card.color}66` : `0 0 10px ${card.color}33`, cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.2s", transform: selected?.id === card.id ? "scale(1.06) translateY(-4px)" : "scale(1)", display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px 6px", userSelect: "none" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: card.color, color: "#000", fontSize: 8, fontWeight: "900", textAlign: "center", padding: "2px 0", fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>{card.rarity} — イベント</div>
                <div style={{ marginTop: 16, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 52, filter: `drop-shadow(0 0 12px ${card.color})`, animation: selected?.id === card.id ? "pulse 1s infinite" : "none" }}>{card.illustSymbol}</div>
                </div>
                <div style={{ fontSize: 11, color: "#fff", fontWeight: "700", textAlign: "center", padding: "2px 4px 0", fontFamily: "'Courier New',monospace", textShadow: `0 0 8px ${card.color}`, lineHeight: 1.2 }}>{card.name}</div>
                <div style={{ fontSize: 7, color: card.color + "bb", textAlign: "center", padding: "2px 4px 0", lineHeight: 1.3 }}>{card.condition === "turn_lte_5" ? "5T以内KO時" : card.condition}</div>
                <div style={{ fontSize: 7, color: "#9ca3af", textAlign: "center", padding: "2px 4px 0", lineHeight: 1.3 }}>{card.description.slice(0, 24)}…</div>
                {selected?.id === card.id && (<div style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: card.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "900", color: "#000" }}>✓</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px", background: "linear-gradient(0deg,rgba(0,5,10,0.98) 80%,transparent 100%)", display: "flex", flexDirection: "column", gap: 10 }}>
        {selected && (<button onClick={() => onSelect(selected)} style={{ padding: "14px", background: `linear-gradient(135deg,${selected.color},${selected.glow})`, border: "none", borderRadius: 8, color: "#000", fontSize: 14, fontWeight: "900", cursor: "pointer", fontFamily: "monospace", boxShadow: `0 4px 20px ${selected.color}88` }}>✦ このカードを使う</button>)}
        <button onClick={() => onSkip(null)} style={{ padding: "12px", background: "transparent", border: "1px solid #374151", borderRadius: 8, color: "#6b7280", fontSize: 12, cursor: "pointer", fontFamily: "monospace" }}>使わずに進む →</button>
      </div>
    </div>
  );
};

const CardSelectScreen = ({ ownedCards, onSelect, onBack }) => {
  const [selected, setSelected] = useState(null);
  const [fuseCandidate, setFuseCandidate] = useState(null);
  const [showFuseAnim, setShowFuseAnim] = useState(false);
  const [assembled, setAssembled] = useState(false);
  const [fusedCard, setFusedCard] = useState(null);
  const cards = ownedCards.map(id => CARDS.find(c => c.id === id)).filter(Boolean);
  const canFuse = selected && fuseCandidate && selected.canFuse && selected.fuseWith === fuseCandidate.id;

  const handleSelect = (card) => {
    if (selected?.id === card.id) { setSelected(null); setFuseCandidate(null); setAssembled(false); return; }
    if (selected && selected.canFuse && selected.fuseWith === card.id) { setFuseCandidate(card); setAssembled(false); setTimeout(() => setAssembled(true), 50); return; }
    if (selected && card.canFuse && card.fuseWith === selected.id) { setFuseCandidate(selected); setSelected(card); setAssembled(false); setTimeout(() => setAssembled(true), 50); return; }
    setFuseCandidate(null); setAssembled(false); setSelected(card); setTimeout(() => setAssembled(true), 50);
  };

  const handleFuse = () => {
    setShowFuseAnim(true);
    setTimeout(() => { setShowFuseAnim(false); setFusedCard(GOTENKS_CARD); setSelected(GOTENKS_CARD); setFuseCandidate(null); setAssembled(false); setTimeout(() => setAssembled(true), 100); }, 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#000a00,#001a00)", fontFamily: "'Courier New',monospace", display: "flex", flexDirection: "column" }}>
      {showFuseAnim && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, color: "#a78bfa", letterSpacing: 4, fontFamily: "monospace", animation: "pulse 0.3s infinite" }}>⚡ FUSION ⚡</div>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ animation: "fusionCharLeft 1.5s ease forwards" }}><StickmanFighter card={selected} size={80} state="attack" /></div>
            <div style={{ fontSize: 32, color: "#fbbf24", animation: "pulse 0.2s infinite", margin: "0 8px" }}>✦</div>
            <div style={{ animation: "fusionCharRight 1.5s ease forwards" }}><StickmanFighter card={fuseCandidate} size={80} state="attack" /></div>
          </div>
          <div style={{ fontSize: 36, fontWeight: "900", color: "#a78bfa", textShadow: "0 0 40px #a78bfa, 0 0 80px #7c3aed", animation: "scaleIn 0.5s ease 1.2s both", letterSpacing: 4 }}>GOTENKS!</div>
        </div>
      )}
      <div style={{ padding: "16px 16px 8px", position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: 12, color: "#00ff44", letterSpacing: 4, textAlign: "center", marginBottom: 4, textShadow: "0 0 10px #00ff44" }}>◆ カード選択 ◆</div>
        <div style={{ fontSize: 9, color: "#00ff4488", textAlign: "center", letterSpacing: 2 }}>使用するカードを選んでください</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
        {fusedCard ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40, paddingBottom: 300 }}>
            <div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#a78bfa", letterSpacing: 3, fontFamily: "monospace", marginBottom: 12, animation: "pulse 0.6s infinite" }}>⚡ FUSION COMPLETE ⚡</div>
              <CardDisplay card={fusedCard} selected small={false} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, justifyItems: "center", paddingBottom: selected ? 300 : 60 }}>
            {cards.map(card => {
              const isSelected = selected?.id === card.id;
              const isFuseCandidate = fuseCandidate?.id === card.id;
              return (
                <div key={card.id} onClick={() => handleSelect(card)} style={{ cursor: "pointer", position: "relative" }}>
                  <CardDisplay card={card} selected={isSelected || isFuseCandidate} small={false} />
                  {isFuseCandidate && (<div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", background: "#a78bfa", color: "#000", fontSize: 8, fontWeight: "900", padding: "1px 6px", borderRadius: 8, whiteSpace: "nowrap", boxShadow: "0 0 8px #a78bfa" }}>FUSION PAIR</div>)}
                  {card.canFuse && !isSelected && !isFuseCandidate && (<div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", background: "#a78bfa33", border: "1px solid #a78bfa66", color: "#a78bfa", fontSize: 7, fontWeight: "700", padding: "1px 5px", borderRadius: 6, whiteSpace: "nowrap" }}>⚡ FUSION</div>)}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "linear-gradient(180deg,rgba(0,10,0,0.95) 0%,rgba(0,20,0,0.98) 100%)", borderTop: `2px solid ${canFuse ? "#a78bfa44" : "#00ff4444"}`, minHeight: selected ? 260 : 60, transition: "min-height 0.4s ease", overflow: "hidden" }}>
        <DigitalMatrixBg />
        {!selected && (<div style={{ padding: "16px", textAlign: "center", color: "#00ff4466", fontSize: 10, letterSpacing: 3, position: "relative", zIndex: 1 }}>▲ カードを選んでください ▲</div>)}
        {canFuse && (
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 8 }}>
              <div style={{ width: 70, opacity: 0.9 }}><CardDisplay card={selected} selected small /></div>
              <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: "#a78bfa", animation: "pulse 0.5s infinite" }}>⚡</div>
              <div style={{ width: 70, opacity: 0.9 }}><CardDisplay card={fuseCandidate} selected small /></div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={handleFuse} style={{ padding: "14px 16px", background: "linear-gradient(135deg,#7c3aed,#a78bfa)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: "900", cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px #a78bfa88", letterSpacing: 1, animation: "pulse 1s infinite" }}>⚡ フュージョン！</button>
              <button onClick={() => onSelect(selected)} style={{ padding: "10px 16px", background: "linear-gradient(135deg,#00ff44,#00cc33)", border: "none", borderRadius: 8, color: "#000", fontSize: 11, fontWeight: "900", cursor: "pointer", fontFamily: "monospace" }}>▶ このままバトルへ</button>
              <button onClick={() => { setSelected(null); setFuseCandidate(null); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #00ff4444", borderRadius: 8, color: "#00ff4488", fontFamily: "monospace", cursor: "pointer", fontSize: 10 }}>← もどる</button>
            </div>
          </div>
        )}
        {selected && !canFuse && (
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-end", gap: 20, position: "relative", zIndex: 1 }}>
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}><DataAssembleChar card={selected} assembled={assembled} /></div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.canFuse && (<div style={{ fontSize: 9, color: "#a78bfa", fontFamily: "monospace", border: "1px solid #a78bfa44", borderRadius: 6, padding: "4px 8px", background: "#a78bfa11" }}>⚡ {CARDS.find(c => c.id === selected.fuseWith)?.name} を選ぶとフュージョン！</div>)}
              <button onClick={() => onSelect(selected)} style={{ padding: "14px 16px", background: "linear-gradient(135deg,#00ff44,#00cc33)", border: "none", borderRadius: 8, color: "#000", fontSize: 14, fontWeight: "900", cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px #00ff4488, 0 0 30px #00ff4433", letterSpacing: 1, animation: "btnGlow 1.5s ease-in-out infinite alternate" }}>▶ バトルへ！</button>
              <button onClick={onBack} style={{ padding: "10px 16px", background: "transparent", border: "1px solid #00ff4444", borderRadius: 8, color: "#00ff4488", fontFamily: "monospace", cursor: "pointer", fontSize: 11 }}>← もどる</button>
            </div>
          </div>
        )}
        {!selected && (<div style={{ textAlign: "center", padding: "0 16px 12px", position: "relative", zIndex: 1 }}><button onClick={onBack} style={{ padding: "10px 30px", background: "transparent", border: "1px solid #00ff4444", borderRadius: 8, color: "#00ff4488", fontFamily: "monospace", cursor: "pointer", fontSize: 11 }}>← もどる</button></div>)}
      </div>
    </div>
  );
};

const DragonBurstDecideScreen = ({ data }) => {
  if (!data) return null;
  const { playerAtk, enemyAtk, winner, phase } = data;
  const maxAtk = Math.max(playerAtk, enemyAtk);
  const playerPct = (playerAtk / maxAtk) * 100;
  const enemyPct = (enemyAtk / maxAtk) * 100;
  const playerWins = winner === "player";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, fontFamily: "'Courier New',monospace", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #1a0500 0%, #000 70%)", animation: "pulse 0.2s infinite" }} />
      <div style={{ position: "absolute", top: "8%", left: 0, right: 0, textAlign: "center", zIndex: 2 }}>
        <div style={{ display: "inline-block", background: "linear-gradient(135deg,#78350f,#f59e0b,#fbbf24,#f59e0b,#78350f)", padding: "6px 24px", borderRadius: 4, animation: "goldShine 0.8s infinite" }}>
          <span style={{ fontSize: 11, fontWeight: "900", color: "#000", letterSpacing: 4 }}>🔥 ATK × 2.0 — 200%到達！ 🔥</span>
        </div>
      </div>
      <div style={{ position: "absolute", top: "20%", left: 0, right: 0, bottom: 0, display: "flex", gap: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, borderRight: "2px solid rgba(255,100,0,0.4)", background: playerWins ? "linear-gradient(160deg,rgba(5,46,22,0.85),rgba(20,83,45,0.7))" : "linear-gradient(160deg,rgba(20,5,5,0.85),rgba(40,10,10,0.7))", padding: "0 12px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 3 }}>あなた</div>
          {phase === "atk" && (<div style={{ textAlign: "center", animation: "scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}><div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 2, marginBottom: 4 }}>攻撃力</div><div style={{ fontSize: 56, fontWeight: "900", color: playerWins ? "#fbbf24" : "#f87171", lineHeight: 1 }}>{playerAtk}</div></div>)}
          {phase === "atk" && (<div style={{ width: "80%" }}><div style={{ height: 10, background: "#1a1a1a", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${playerPct}%`, background: playerWins ? "linear-gradient(90deg,#22c55e,#4ade80,#86efac)" : "linear-gradient(90deg,#dc2626,#ef4444,#f87171)", borderRadius: 5 }} /></div></div>)}
          {phase === "result" && (<div style={{ fontWeight: "900", fontSize: 36, color: playerWins ? "#4ade80" : "#f87171", animation: "scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)", letterSpacing: 2 }}>{playerWins ? "勝ち！" : "負け…"}</div>)}
        </div>
        <div style={{ width: 3, background: "linear-gradient(180deg,transparent,#f97316,#fbbf24,#f97316,transparent)", animation: "pulse 0.3s infinite", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: !playerWins ? "linear-gradient(160deg,rgba(5,46,22,0.85),rgba(20,83,45,0.7))" : "linear-gradient(160deg,rgba(20,5,5,0.85),rgba(40,10,10,0.7))", padding: "0 12px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 3 }}>てき</div>
          {phase === "atk" && (<div style={{ textAlign: "center", animation: "scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}><div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 2, marginBottom: 4 }}>攻撃力</div><div style={{ fontSize: 56, fontWeight: "900", color: !playerWins ? "#fbbf24" : "#f87171", lineHeight: 1 }}>{enemyAtk}</div></div>)}
          {phase === "atk" && (<div style={{ width: "80%" }}><div style={{ height: 10, background: "#1a1a1a", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${enemyPct}%`, background: !playerWins ? "linear-gradient(90deg,#22c55e,#4ade80,#86efac)" : "linear-gradient(90deg,#dc2626,#ef4444,#f87171)", borderRadius: 5 }} /></div></div>)}
          {phase === "result" && (<div style={{ fontWeight: "900", fontSize: 36, color: !playerWins ? "#4ade80" : "#f87171", animation: "scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.08s both", letterSpacing: 2 }}>{!playerWins ? "勝ち！" : "負け…"}</div>)}
        </div>
      </div>
    </div>
  );
};

const BattleScreen = ({ playerCard, enemyData, supportCard, eventCard, onEnd }) => {
  const startsWithKaioken = supportCard?.effect === "transform_start" && playerCard.isGoku;
  const startsWithSSJ = supportCard?.effect === "transform_start" && playerCard.isGotenks;
  const startsWithBoost = supportCard?.effect === "boost_stats";
  const boostedHp = startsWithBoost ? playerCard.hp + (supportCard.hpBoost || 0) : playerCard.hp;
  const boostedAtk = startsWithBoost ? playerCard.atk + (supportCard.atkBoost || 0) : playerCard.atk;

  const [playerHp, setPlayerHp] = useState(playerCard.hp);
  const [enemyHp, setEnemyHp] = useState(enemyData.hp);
  const [playerDisplayHp, setPlayerDisplayHp] = useState(playerCard.hp);
  const [enemyDisplayHp, setEnemyDisplayHp] = useState(enemyData.hp);
  const [dmgText, setDmgText] = useState(null);
  const drainRafRef = useRef(null);
  const playerHpRef = useRef(playerCard.hp);
  const enemyHpRef = useRef(enemyData.hp);
  const eventCardUsedRef = useRef(false);
  const [showEventCutIn, setShowEventCutIn] = useState(false);
  const [eventCutInDone, setEventCutInDone] = useState(null);
  const [rouletteState, setRouletteState] = useState(null);
  const [atkRouletteLevel, setAtkRouletteLevel] = useState(1);
  const [defRouletteLevel, setDefRouletteLevel] = useState(1);
  const atkRouletteLevelRef = useRef(1);
  const defRouletteLevelRef = useRef(1);
  const [enemyAtkRouletteLevel, setEnemyAtkRouletteLevel] = useState(1);
  const [enemyDefRouletteLevel, setEnemyDefRouletteLevel] = useState(1);
  const enemyAtkRouletteLevelRef = useRef(1);
  const enemyDefRouletteLevelRef = useRef(1);
  const [phase, setPhase] = useState("waiting");
  const [playerHand, setPlayerHand] = useState(null);
  const [enemyHand, setEnemyHand] = useState(null);
  const [turn, setTurn] = useState(1);
  const [timer, setTimer] = useState(15);
  const [timerActive, setTimerActive] = useState(false);
  const [battleLog, setBattleLog] = useState([]);
  const [playerAnim, setPlayerAnim] = useState(startsWithKaioken ? "kaioken_idle" : "idle");
  const [enemyAnim, setEnemyAnim] = useState("idle");
  const [damageNum, setDamageNum] = useState(null);
  const [damagePos, setDamagePos] = useState("enemy");
  const [currentMove, setCurrentMove] = useState(null);
  const [jankenResult, setJankenResult] = useState(null);
  const [kaiokenActive, setKaiokenActive] = useState(startsWithKaioken);
  const kaiokenUnlockedRef = useRef(startsWithKaioken);
  const [kaiokenUnlocked, setKaiokenUnlocked] = useState(startsWithKaioken);
  const [playerOffset, setPlayerOffset] = useState(0);
  const isGotenks = playerCard.isGotenks;
  const [gotenksLevel, setGotenksLevel] = useState(startsWithSSJ ? 1 : 0);
  const gotenksLevelRef = useRef(startsWithSSJ ? 1 : 0);
  const getGotenksAtk = (lv) => { if (!isGotenks) return playerCard.atk; if (lv === 1) return Math.floor(playerCard.atk * 1.5); if (lv === 2) return playerCard.atk * 2; return playerCard.atk; };
  const getGotenksMaxHp = (lv) => { if (!isGotenks) return playerCard.hp; if (lv === 1) return Math.floor(playerCard.hp * 1.5); if (lv === 2) return playerCard.hp * 2; return playerCard.hp; };
  const [roundPhase, setRoundPhase] = useState("done");
  const [showRoundNum, setShowRoundNum] = useState(1);
  const [roundFadeOut, setRoundFadeOut] = useState(false);
  const [showFight, setShowFight] = useState(false);
  const [fightFadeOut, setFightFadeOut] = useState(false);
  const [showSet, setShowSet] = useState(false);
  const [jankenResultLabel, setJankenResultLabel] = useState(null);
  const timerRef = useRef(null);
  const kaiokenActiveRef = useRef(startsWithKaioken);
  const [dragonBurstPhase, setDragonBurstPhase] = useState(null);
  const [dragonBurstMultiplier, setDragonBurstMultiplier] = useState(1);
  const dragonBurstMultiplierRef = useRef(1);
  const [playerClashOffset, setPlayerClashOffset] = useState(0);
  const [enemyClashOffset, setEnemyClashOffset] = useState(0);
  const [clashFlash, setClashFlash] = useState(false);
  const [dragonBurstDecide, setDragonBurstDecide] = useState(null);
  const [kiryokuPhase, setKiryokuPhase] = useState(null);
  const [playerMeter, setPlayerMeter] = useState(0);
  const [enemyMeter, setEnemyMeter] = useState(0);
  const [kiryokuTimer, setKiryokuTimer] = useState(5);
  const [atkBonus, setAtkBonus] = useState({ player: 0, enemy: 0 });
  const [showAtkBonus, setShowAtkBonus] = useState(false);
  const playerTapCountRef = useRef(0);
  const kiryokuTimerRef = useRef(null);
  const enemySmashRef = useRef(null);
  const playerMeterRef = useRef(0);
  const enemyMeterRef = useRef(0);
  const kiryokuUsedRef = useRef(false);
  const [clashSparks, setClashSparks] = useState(false);
  const [enterPhase, setEnterPhase] = useState("hidden");
  const [playerVisible, setPlayerVisible] = useState(false);
  const [enemyVisible, setEnemyVisible] = useState(false);
  const [playerMaxHp, setPlayerMaxHp] = useState(playerCard.hp);
  const [playerCurrentAtk, setPlayerCurrentAtk] = useState(playerCard.atk);
  const [zoomTarget, setZoomTarget] = useState(null);
  const [showZoomStats, setShowZoomStats] = useState(false);
  const [showSupportBanner, setShowSupportBanner] = useState(false);
  const [showSupportInfo, setShowSupportInfo] = useState(false);
  const [zoomPlayerHp, setZoomPlayerHp] = useState(playerCard.hp);
  const [zoomPlayerAtk, setZoomPlayerAtk] = useState(playerCard.atk);
  const [zoomPlayerStatus, setZoomPlayerStatus] = useState("");

  useEffect(() => {
    const startRound1Sequence = () => {
      setRoundPhase("round"); setShowRoundNum(1); setRoundFadeOut(false);
      setShowFight(false); setFightFadeOut(false);
      const t1 = setTimeout(() => setRoundFadeOut(true), 1400);
      const t2 = setTimeout(() => { setRoundPhase("fight"); setShowFight(true); setFightFadeOut(false); }, 1900);
      const t3 = setTimeout(() => setFightFadeOut(true), 3100);
      const t4 = setTimeout(() => { setRoundPhase("done"); setShowFight(false); setPhase("choose"); setTimer(15); setTimerActive(true); }, 3600);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    };
    const timers = [];
    const T = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
    T(() => { setPlayerVisible(true); setEnterPhase("player_land"); }, 800);
    T(() => { setZoomTarget("player"); setShowZoomStats(false); }, 1400);
    T(() => { setShowZoomStats(true); }, 1900);
    if (supportCard) {
      T(() => { setShowSupportBanner(true); }, 3500);
      T(() => { setShowSupportBanner(false); setShowSupportInfo(true); }, 4400);
      T(() => { setShowSupportInfo(false); }, 6500);
      T(() => {
        if (startsWithKaioken) { const kaiokenAtk = Math.floor(playerCard.atk * 1.5); setZoomPlayerAtk(kaiokenAtk); setPlayerCurrentAtk(kaiokenAtk); setTimeout(() => setZoomPlayerStatus("界王拳🔥"), 300); }
        else if (startsWithSSJ) { const ssjAtk = Math.floor(playerCard.atk * 1.5); const ssjHp = Math.floor(playerCard.hp * 1.5); setPlayerHp(ssjHp); playerHpRef.current = ssjHp; setPlayerMaxHp(ssjHp); setPlayerDisplayHp(ssjHp); setPlayerCurrentAtk(ssjAtk); setZoomPlayerAtk(ssjAtk); setZoomPlayerHp(ssjHp); gotenksLevelRef.current = 1; setGotenksLevel(1); setTimeout(() => setZoomPlayerStatus("⚡ スーパーサイヤ人"), 300); }
        else if (startsWithBoost) { setPlayerHp(boostedHp); playerHpRef.current = boostedHp; setPlayerMaxHp(boostedHp); setPlayerCurrentAtk(boostedAtk); setZoomPlayerHp(boostedHp); setZoomPlayerAtk(boostedAtk); setTimeout(() => setZoomPlayerStatus(`HP+${supportCard.hpBoost} / ATK+${supportCard.atkBoost}`), 300); }
      }, 6800);
      T(() => { setZoomTarget(null); setShowZoomStats(false); }, 8000);
      T(() => { setEnemyVisible(true); setEnterPhase("enemy_land"); }, 8500);
      T(() => { setZoomTarget("enemy"); setShowZoomStats(false); }, 9100);
      T(() => { setShowZoomStats(true); }, 9600);
      T(() => { setZoomTarget(null); setShowZoomStats(false); setEnterPhase("done"); }, 11100);
      T(() => { startRound1Sequence(); }, 11400);
    } else {
      T(() => { setZoomTarget(null); setShowZoomStats(false); setEnemyVisible(true); setEnterPhase("enemy_land"); }, 3200);
      T(() => { setZoomTarget("enemy"); setShowZoomStats(false); }, 3800);
      T(() => { setShowZoomStats(true); }, 4300);
      T(() => { setZoomTarget(null); setShowZoomStats(false); setEnterPhase("done"); }, 5800);
      T(() => { startRound1Sequence(); }, 6100);
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => { playerMeterRef.current = playerMeter; }, [playerMeter]);
  useEffect(() => { enemyMeterRef.current = enemyMeter; }, [enemyMeter]);

  useEffect(() => {
    if (phase !== "choose" || !timerActive) return;
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); handleHandSelect(HANDS[Math.floor(Math.random() * 3)]); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, turn, timerActive]);

  const atkTimerRef2 = useRef(null);
  const defTimerRef2 = useRef(null);
  const atkIdxRef = useRef(0);
  const defIdxRef = useRef(0);
  const [rouletteCountdown, setRouletteCountdown] = useState(0);
  const rouletteCountdownRef = useRef(null);

  const stopAtkRoulette = useCallback(() => {
    clearInterval(rouletteCountdownRef.current); setRouletteCountdown(0);
    setRouletteState(prev => { if (!prev || prev.atkStopped) return prev; clearInterval(atkTimerRef2.current); const res = prev.atkSlots[atkIdxRef.current]; return { ...prev, atkStopped: true, atkResult: res }; });
  }, []);

  const stopDefRoulette = useCallback(() => {
    clearInterval(rouletteCountdownRef.current); setRouletteCountdown(0);
    setRouletteState(prev => { if (!prev || prev.defStopped) return prev; clearInterval(defTimerRef2.current); const res = prev.defSlots[defIdxRef.current]; return { ...prev, defStopped: true, defResult: res }; });
  }, []);

  useEffect(() => {
    if (!rouletteState || !rouletteState.atkStopped || !rouletteState.defStopped) return;
    const t = setTimeout(() => {
      const { atkResult, defResult, pendingMove, pendingBaseAtk, pendingHand, pendingEHand, pendingIsKaioken, attacker, isFirstWin } = rouletteState;
      const isSpecial = atkResult === "special";
      let move;
      if (isSpecial) { move = attacker === "player" ? (playerCard.isGoku ? MOVES.rock_kamehameha : MOVES.rock_punch) : MOVES.rock_punch; }
      else { move = (pendingMove && pendingMove.id === "rock_kamehameha") ? (attacker === "player" ? MOVES.paper_punch : MOVES.rock_punch) : pendingMove; }
      const rawDmg = Math.max(1, Math.floor(pendingBaseAtk * move.power * (0.95 + Math.random() * 0.1)));
      const reduction = GUARD_REDUCTION[defResult] || 0;
      const finalDmg = Math.max(1, Math.floor(rawDmg * (1 - reduction)));
      if (attacker === "player") {
        const nAtk = Math.min(3, atkRouletteLevelRef.current + 1); atkRouletteLevelRef.current = nAtk; setAtkRouletteLevel(nAtk);
        const nEDef = Math.min(3, enemyDefRouletteLevelRef.current + 1); enemyDefRouletteLevelRef.current = nEDef; setEnemyDefRouletteLevel(nEDef);
      } else {
        const nEAtk = Math.min(3, enemyAtkRouletteLevelRef.current + 1); enemyAtkRouletteLevelRef.current = nEAtk; setEnemyAtkRouletteLevel(nEAtk);
        const nDef = Math.min(3, defRouletteLevelRef.current + 1); defRouletteLevelRef.current = nDef; setDefRouletteLevel(nDef);
      }
      setRouletteState(null);
      if (isFirstWin && attacker === "player") {
        setKaiokenActive(true); kaiokenActiveRef.current = true; setPlayerAnim("kaioken_idle");
        setBattleLog(l => [...l, `界王拳！！ ATK×1.5！`]);
        setTimeout(() => { doAttack(attacker, move, finalDmg, pendingHand, pendingEHand, true); }, 1200);
      } else { setTimeout(() => { doAttack(attacker, move, finalDmg, pendingHand, pendingEHand, pendingIsKaioken); }, 100); }
    }, 1000);
    return () => clearTimeout(t);
  }, [rouletteState?.atkStopped, rouletteState?.defStopped]);

  const startAttackRoulette = useCallback((attacker, pendingMove, pendingBaseAtk, pendingHand, pendingEHand, pendingIsKaioken, isFirstWin) => {
    const atkLv = attacker === "player" ? atkRouletteLevelRef.current : enemyAtkRouletteLevelRef.current;
    const defLv = attacker === "player" ? enemyDefRouletteLevelRef.current : defRouletteLevelRef.current;
    const atkSlots = buildAttackSlots(atkLv);
    const defSlots = buildGuardSlots(defLv);
    atkIdxRef.current = Math.floor(Math.random() * ROULETTE_TOTAL);
    defIdxRef.current = Math.floor(Math.random() * ROULETTE_TOTAL);
    setRouletteState({ atkSlots, atkIdx: atkIdxRef.current, atkStopped: false, atkResult: null, defSlots, defIdx: defIdxRef.current, defStopped: false, defResult: null, attacker, pendingMove, pendingBaseAtk, pendingHand, pendingEHand, pendingIsKaioken, isFirstWin });
    clearInterval(atkTimerRef2.current);
    atkTimerRef2.current = setInterval(() => { atkIdxRef.current = (atkIdxRef.current + 1) % ROULETTE_TOTAL; setRouletteState(prev => prev && !prev.atkStopped ? { ...prev, atkIdx: atkIdxRef.current } : prev); }, 30);
    clearInterval(defTimerRef2.current);
    defTimerRef2.current = setInterval(() => { defIdxRef.current = (defIdxRef.current + 1) % ROULETTE_TOTAL; setRouletteState(prev => prev && !prev.defStopped ? { ...prev, defIdx: defIdxRef.current } : prev); }, 30);
    setRouletteCountdown(7); clearInterval(rouletteCountdownRef.current);
    rouletteCountdownRef.current = setInterval(() => { setRouletteCountdown(prev => { if (prev <= 1) { clearInterval(rouletteCountdownRef.current); return 0; } return prev - 1; }); }, 1000);
    if (attacker === "player") {
      const enemyAutoStop = 1000 + Math.random() * 2000;
      setTimeout(() => { clearInterval(defTimerRef2.current); setRouletteState(prev => { if (!prev || prev.defStopped) return prev; return { ...prev, defStopped: true, defResult: prev.defSlots[defIdxRef.current] }; }); }, enemyAutoStop);
      setTimeout(() => { clearInterval(atkTimerRef2.current); clearInterval(rouletteCountdownRef.current); setRouletteCountdown(0); setRouletteState(prev => { if (!prev || prev.atkStopped) return prev; return { ...prev, atkStopped: true, atkResult: prev.atkSlots[atkIdxRef.current] }; }); }, 7000);
    } else {
      const enemyAutoStop = 1000 + Math.random() * 2000;
      setTimeout(() => { clearInterval(atkTimerRef2.current); setRouletteState(prev => { if (!prev || prev.atkStopped) return prev; return { ...prev, atkStopped: true, atkResult: prev.atkSlots[atkIdxRef.current] }; }); }, enemyAutoStop);
      setTimeout(() => { clearInterval(defTimerRef2.current); clearInterval(rouletteCountdownRef.current); setRouletteCountdown(0); setRouletteState(prev => { if (!prev || prev.defStopped) return prev; return { ...prev, defStopped: true, defResult: prev.defSlots[defIdxRef.current] }; }); }, 7000);
    }
  }, []);

  const startKiryoku = useCallback((onDone) => {
    setPlayerMeter(0); setEnemyMeter(0); playerMeterRef.current = 0; enemyMeterRef.current = 0;
    playerTapCountRef.current = 0; setKiryokuTimer(5); setShowAtkBonus(false); setKiryokuPhase("announce");
    setTimeout(() => {
      setKiryokuPhase("smash");
      const TARGET_ENEMY = 40 + Math.random() * 10; let ep = 0;
      enemySmashRef.current = setInterval(() => { const rem = TARGET_ENEMY - ep; if (rem <= 0) { clearInterval(enemySmashRef.current); return; } ep = Math.min(TARGET_ENEMY, ep + Math.max(0.2, rem * 0.08 + Math.random() * 1.5)); setEnemyMeter(Math.min(100, ep)); }, 150);
      kiryokuTimerRef.current = setInterval(() => {
        setKiryokuTimer(prev => {
          const next = prev - 1;
          if (next <= 0) {
            clearInterval(kiryokuTimerRef.current); clearInterval(enemySmashRef.current);
            const pct = playerMeterRef.current, ect = enemyMeterRef.current;
            const newBonus = { player: pct >= ect ? 100 : 30, enemy: pct >= ect ? 30 : 100 };
            setAtkBonus(newBonus); setShowAtkBonus(true); setKiryokuPhase("result_show");
            setTimeout(() => { setShowAtkBonus(false); setKiryokuPhase(null); onDone(newBonus); }, 2000);
            return 0;
          }
          return next;
        });
      }, 1000);
    }, 3000);
  }, []);

  const handleKiryokuTap = useCallback(() => {
    if (kiryokuPhase !== "smash") return;
    playerTapCountRef.current += 1;
    setPlayerMeter(prev => Math.min(100, prev + Math.max(0.3, 8 * Math.pow(0.88, playerTapCountRef.current))));
  }, [kiryokuPhase]);

  const startDragonBurst = useCallback((multiplier) => {
    setDragonBurstMultiplier(multiplier); dragonBurstMultiplierRef.current = multiplier;
    setDragonBurstPhase("announce");
    setTimeout(() => {
      setDragonBurstPhase("clash"); setPlayerAnim("dash"); setEnemyAnim("dash"); setPlayerClashOffset(120); setEnemyClashOffset(-120);
      setTimeout(() => { setClashFlash(true); setTimeout(() => setClashFlash(false), 300); setClashSparks(true); }, 500);
      setTimeout(() => { setDragonBurstPhase("janken"); setPhase("choose"); setTimer(15); setTimerActive(true); }, 900);
    }, 2000);
  }, []);

  const applyGotenksTransform = useCallback(() => {
    const curLv = gotenksLevelRef.current;
    if (curLv >= 2) return;
    const newLv = curLv + 1;
    setBattleLog(l => [...l, `ゴテンクス ${newLv === 1 ? "⚡ スーパーサイヤ人！" : "⚡⚡ スーパーサイヤ人3！！"}`]);
    setTimeout(() => {
      const curHpRatio = playerHpRef.current / getGotenksMaxHp(curLv);
      const newMax = getGotenksMaxHp(newLv);
      const newHp = Math.min(newMax, Math.max(1, Math.floor(newMax * curHpRatio)));
      setPlayerHp(newHp); playerHpRef.current = newHp; setPlayerMaxHp(newMax); setPlayerDisplayHp(newHp);
      setPlayerCurrentAtk(getGotenksAtk(newLv)); gotenksLevelRef.current = newLv; setGotenksLevel(newLv);
    }, 300);
  }, []);

  const handleDragonBurstResult = useCallback((result, hand, eHand) => {
    const currentMultiplier = dragonBurstMultiplierRef.current;
    const basePlayerAtk = isGotenks ? getGotenksAtk(gotenksLevelRef.current) : playerCurrentAtk;
    const playerEffAtk = kaiokenActiveRef.current ? Math.floor((basePlayerAtk + (atkBonus?.player || 0)) * 1.5) : (basePlayerAtk + (atkBonus?.player || 0));
    if (result === "draw") {
      const newMult = Math.min(2.0, currentMultiplier + 0.5);
      setBattleLog(l => [...l, `ドラゴンバースト継続！ ATK×${newMult.toFixed(1)}`]);
      setPlayerHand(null); setEnemyHand(null); setJankenResult(null); setJankenResultLabel(null); setPhase("attack"); setTimerActive(false);
      if (newMult >= 2.0) {
        const playerTotalAtk = playerEffAtk; const enemyTotalAtk = enemyData.atk + (atkBonus?.enemy || 0);
        const forcedAttacker = playerTotalAtk >= enemyTotalAtk ? "player" : "enemy";
        const forcedHand = forcedAttacker === "player" ? hand : eHand; const forcedEHand = forcedAttacker === "player" ? eHand : hand;
        const moveId = forcedAttacker === "player" ? playerCard[forcedHand] : enemyData[forcedEHand];
        const move = MOVES[moveId] || MOVES[playerCard.rock];
        const baseAtk = forcedAttacker === "player" ? Math.floor(playerTotalAtk * newMult) : Math.floor(enemyTotalAtk * newMult);
        setClashSparks(false); setDragonBurstPhase(null); setPlayerClashOffset(0); setEnemyClashOffset(0);
        dragonBurstMultiplierRef.current = 1; setDragonBurstMultiplier(1);
        setDragonBurstDecide({ playerAtk: playerTotalAtk, enemyAtk: enemyTotalAtk, winner: forcedAttacker, phase: "atk" });
        setTimeout(() => {
          setDragonBurstDecide({ playerAtk: playerTotalAtk, enemyAtk: enemyTotalAtk, winner: forcedAttacker, phase: "result" });
          setTimeout(() => {
            setDragonBurstDecide(null);
            if (isGotenks && forcedAttacker === "player") applyGotenksTransform();
            startAttackRoulette(forcedAttacker, move, baseAtk, forcedHand, forcedEHand, kaiokenActiveRef.current, false);
          }, 2000);
        }, 2200);
      } else { setTimeout(() => startDragonBurst(newMult), 500); }
      return;
    }
    const attacker = result === "win" ? "player" : "enemy";
    const moveId = attacker === "player" ? playerCard[hand] : enemyData[eHand];
    const move = MOVES[moveId];
    const baseAtk = attacker === "player" ? Math.floor(playerEffAtk * currentMultiplier) : Math.floor((enemyData.atk + (atkBonus?.enemy || 0)) * currentMultiplier);
    if (isGotenks && attacker === "player") applyGotenksTransform();
    setBattleLog(l => [...l, `ドラゴンバースト！ ${attacker === "player" ? playerCard.name : enemyData.name}の${move.name}！`]);
    setClashSparks(false); setDragonBurstPhase(null); setPlayerClashOffset(0); setEnemyClashOffset(0);
    setJankenResultLabel(null); setJankenResult(null); setPhase("attack"); setTimerActive(false);
    dragonBurstMultiplierRef.current = 1; setDragonBurstMultiplier(1);
    setTimeout(() => { startAttackRoulette(attacker, move, baseAtk, hand, eHand, kaiokenActiveRef.current, false); }, 400);
  }, [playerCard, enemyData, atkBonus, startDragonBurst, startAttackRoulette, playerCurrentAtk, isGotenks]);

  const handleDragonBurstResultRef = useRef(null);
  handleDragonBurstResultRef.current = handleDragonBurstResult;

  const handleHandSelect = useCallback((hand) => {
    if (dragonBurstPhase === "janken") {
      clearInterval(timerRef.current); setTimerActive(false); setPlayerHand(hand); setShowSet(true); setPhase("waiting_enemy");
      setTimeout(() => {
        const eHand = HANDS[Math.floor(Math.random() * 3)];
        setEnemyHand(eHand); setShowSet(false);
        const result = judgeJanken(hand, eHand);
        setJankenResult(result); setJankenResultLabel(result); setPhase("reveal");
        setTimeout(() => { handleDragonBurstResultRef.current && handleDragonBurstResultRef.current(result, hand, eHand); }, 1500);
      }, 600);
      return;
    }
    if (phase !== "choose") return;
    clearInterval(timerRef.current); setTimerActive(false); setPlayerHand(hand); setShowSet(true); setPhase("waiting_enemy");
    setTimeout(() => {
      const eHand = HANDS[Math.floor(Math.random() * 3)];
      setEnemyHand(eHand); setShowSet(false);
      const result = judgeJanken(hand, eHand);
      setJankenResult(result); setJankenResultLabel(result); setPhase("reveal");
      if (result === "draw") {
        setBattleLog(l => [...l, `T${turn}: ドラゴンバースト！！`]);
        setTimeout(() => { setPlayerHand(null); setEnemyHand(null); setJankenResult(null); setJankenResultLabel(null); setPhase("attack"); setTimerActive(false); startDragonBurst(1.5); }, 2000);
        return;
      }
      const attacker = result === "win" ? "player" : "enemy";
      const moveId = attacker === "player" ? playerCard[hand] : enemyData[eHand];
      const pendingMove = MOVES[moveId];
      const gotenksEffAtk = isGotenks ? getGotenksAtk(gotenksLevelRef.current) : 0;
      const rawPlayerAtk = isGotenks ? gotenksEffAtk + atkBonus.player : playerCurrentAtk + atkBonus.player;
      const effectivePlayerAtk = (kaiokenActiveRef.current && attacker === "player") ? Math.floor(rawPlayerAtk * 1.5) : rawPlayerAtk;
      const baseAtk = attacker === "player" ? effectivePlayerAtk : enemyData.atk + atkBonus.enemy;
      setCurrentMove(pendingMove);
      const isFirstWin = result === "win" && playerCard.isGoku && kaiokenUnlockedRef.current && !kaiokenActiveRef.current;
      if (isGotenks && result === "win" && attacker === "player") applyGotenksTransform();
      setTimeout(() => {
        const latestGotenksAtk = isGotenks ? getGotenksAtk(gotenksLevelRef.current) : 0;
        const latestRawAtk = isGotenks ? latestGotenksAtk + atkBonus.player : playerCurrentAtk + atkBonus.player;
        const latestEffAtk = (kaiokenActiveRef.current && attacker === "player") ? Math.floor(latestRawAtk * 1.5) : latestRawAtk;
        const latestBaseAtk = attacker === "player" ? latestEffAtk : enemyData.atk + atkBonus.enemy;
        setJankenResultLabel(null); setPhase("attack");
        startAttackRoulette(attacker, pendingMove, latestBaseAtk, hand, eHand, kaiokenActiveRef.current, isFirstWin);
      }, 450);
    }, 600);
  }, [phase, dragonBurstPhase, playerCard, enemyData, turn, startDragonBurst, startAttackRoulette, atkBonus]);

  const drainHp = useCallback((target, fromHp, toHp, onDone) => {
    const dmg = fromHp - toHp;
    if (dmg <= 0) { onDone(); return; }
    const startTime = performance.now();
    const setter = target === "player" ? setPlayerDisplayHp : setEnemyDisplayHp;
    const tick = (now) => { const progress = Math.min(1, (now - startTime) / 1500); setter(Math.max(toHp, fromHp - dmg * progress)); if (progress < 1) drainRafRef.current = requestAnimationFrame(tick); else { setter(toHp); onDone(); } };
    drainRafRef.current = requestAnimationFrame(tick);
  }, []);

  const doAttack = (attacker, move, dmg, hand, eHand, isKaioken) => {
    const needsDash = attacker === "player" && playerCard.isGoku && (move.id === "paper_punch" || move.id === "scissors_kick");
    const kaiokenSelfDmg = (isKaioken && attacker === "player") ? 200 : 0;
    const afterHit = (frozenAnim, hitTarget) => {
      const fromHp = hitTarget === "enemy" ? enemyHpRef.current : playerHpRef.current;
      const newHp = Math.max(0, fromHp - dmg);
      setDmgText({ amount: dmg, target: hitTarget });
      setTimeout(() => {
        setDmgText(null);
        if (hitTarget === "enemy") { setEnemyHp(newHp); enemyHpRef.current = newHp; }
        else { setPlayerHp(newHp); playerHpRef.current = newHp; }
        if (kaiokenSelfDmg > 0) {
          const pFrom = playerHpRef.current; const pNew = Math.max(1, pFrom - kaiokenSelfDmg);
          setPlayerHp(pNew); playerHpRef.current = pNew; drainHp("player", pFrom, pNew, () => {});
          setBattleLog(l => [...l, `界王拳の反動！ ${Math.min(kaiokenSelfDmg, pFrom - 1)}ダメージ！`]);
        }
        drainHp(hitTarget, fromHp, newHp, () => {
          if (newHp <= 0) {
            if (hitTarget === "enemy") { setPlayerAnim(isKaioken && playerCard.isGoku ? "kaioken_idle" : "win"); setEnemyAnim("lose"); setTimeout(() => onEnd(true), 1500); setPhase("result"); }
            else {
              const canRevive = eventCard?.effect === "revive_half" && !eventCardUsedRef.current && turn <= 5;
              if (canRevive) {
                eventCardUsedRef.current = true; setShowEventCutIn(true);
                setEventCutInDone(() => () => {
                  const reviveHp = Math.floor(playerCard.hp / 2);
                  setPlayerHp(reviveHp); playerHpRef.current = reviveHp; setPlayerDisplayHp(reviveHp);
                  setBattleLog(l => [...l, `ナメック星人の力発動！ HP ${reviveHp} 回復！`]);
                  setPlayerAnim(isKaioken && playerCard.isGoku ? "kaioken_idle" : "idle"); setEnemyAnim("idle");
                  setDamageNum(null); setCurrentMove(null); nextTurn(isKaioken, turn + 1);
                });
              } else { setEnemyAnim("win"); setPlayerAnim("lose"); setTimeout(() => onEnd(false), 1500); setPhase("result"); }
            }
          } else {
            if (isGotenks && attacker === "enemy" && gotenksLevelRef.current > 0) {
              const curLv = gotenksLevelRef.current; const newLv = curLv - 1;
              setBattleLog(l => [...l, `変身解除！ ${newLv === 0 ? "ノーマル" : "スーパーサイヤ人"}に戻った！`]);
              const oldMax = getGotenksMaxHp(curLv); const newMax = getGotenksMaxHp(newLv);
              const ratio = playerHpRef.current / oldMax; const newHpG = Math.max(1, Math.floor(newMax * ratio));
              setPlayerHp(newHpG); playerHpRef.current = newHpG; setPlayerMaxHp(newMax); setPlayerDisplayHp(newHpG);
              setPlayerCurrentAtk(getGotenksAtk(newLv)); gotenksLevelRef.current = newLv; setGotenksLevel(newLv);
            }
            if (needsDash) { setPlayerAnim(isKaioken ? "kaioken_idle" : "idle"); setEnemyAnim("idle"); setPlayerOffset(0); }
            setDamageNum(null); setCurrentMove(null); nextTurn(isKaioken, turn + 1);
          }
        });
      }, 2000);
    };
    if (needsDash) {
      setPlayerAnim("dash"); setEnemyAnim("idle"); setPlayerOffset(160);
      setTimeout(() => { setPlayerAnim(isKaioken ? "kaioken_idle" : "idle"); }, 600);
      setTimeout(() => { if (move.id === "scissors_kick") setPlayerAnim("kick"); else setPlayerAnim("punch"); setEnemyAnim("hit"); setDamageNum(dmg); setDamagePos("enemy"); setBattleLog(l => [...l, `T${turn}: ${playerCard.name}の${move.name}！ ${dmg}ダメージ！`]); }, 1100);
      setTimeout(() => { afterHit("punch", "enemy"); }, 1800);
      return;
    }
    if (attacker === "player") {
      if (playerCard.isGoku) { if (move.id === "rock_kamehameha") setPlayerAnim("beam"); else if (move.id === "scissors_kick") setPlayerAnim("kick"); else setPlayerAnim("punch"); } else setPlayerAnim("attack");
      setEnemyAnim("idle");
    } else { setEnemyAnim("attack"); setPlayerAnim(isKaioken && playerCard.isGoku ? "kaioken_idle" : "idle"); }
    setTimeout(() => {
      if (attacker === "player") setEnemyAnim("hit");
      else { setEnemyAnim("idle"); setPlayerAnim(isKaioken && playerCard.isGoku ? "kaioken_idle" : "hit"); }
      setDamageNum(dmg); setDamagePos(attacker === "player" ? "enemy" : "player");
      setBattleLog(l => [...l, `T${turn}: ${attacker === "player" ? playerCard.name : enemyData.name}の${move.name}！ ${dmg}ダメージ！`]);
      afterHit(attacker === "player" ? "attack" : "hit", attacker === "player" ? "enemy" : "player");
    }, 700);
  };

  const showRoundAnnounce = useCallback((roundNum, onDone) => {
    setRoundPhase("round"); setShowRoundNum(roundNum); setRoundFadeOut(false); setShowFight(false);
    const t1 = setTimeout(() => setRoundFadeOut(true), 1200);
    const t2 = setTimeout(() => { setRoundPhase("done"); onDone(); }, 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const nextTurn = useCallback((isKaioken, nextTurnNum) => {
    setPlayerAnim(isKaioken && playerCard.isGoku ? "kaioken_idle" : "idle"); setEnemyAnim("idle");
    setPlayerHand(null); setEnemyHand(null); setJankenResult(null); setTurn(nextTurnNum);
    if (playerCard.isGoku && !kaiokenUnlockedRef.current && playerHpRef.current <= boostedHp / 2) {
      kaiokenUnlockedRef.current = true; setKaiokenUnlocked(true);
      setBattleLog(l => [...l, `HP半分以下！界王拳が使えるようになった！`]);
    }
    const startRound = () => {
      if (nextTurnNum === 4 && !kiryokuUsedRef.current) { kiryokuUsedRef.current = true; startKiryoku(bonus => { setAtkBonus(bonus); setPhase("choose"); setTimer(15); setTimerActive(true); }); }
      else { setPhase("choose"); setTimer(15); setTimerActive(true); }
    };
    showRoundAnnounce(nextTurnNum, startRound);
  }, [playerCard, startKiryoku, showRoundAnnounce]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0a1628,#1a2a4a)", fontFamily: "monospace", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {showEventCutIn && eventCard && (<CardCutIn card={eventCard} cardType="event" onDone={() => { setShowEventCutIn(false); if (eventCutInDone) { eventCutInDone(); setEventCutInDone(null); } }} />)}

      <div style={{ padding: "10px 14px 8px", position: "relative", zIndex: 2, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 1fr", gap: 10, alignItems: "center" }}>
          <HpBar displayHp={playerDisplayHp} max={playerMaxHp} flip={false} playerLabel="1P" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: phase === "choose" ? (timer <= 5 ? "radial-gradient(circle,#3d0000,#1a0000)" : "radial-gradient(circle,#0d1a2e,#060d1a)") : "radial-gradient(circle,#0d0d0d,#060606)", border: phase === "choose" ? (timer <= 5 ? "2px solid #ef4444" : "2px solid #3b82f6") : "2px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", transition: "all 0.3s", flexShrink: 0 }}>
              <div key={timer} style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: timer >= 10 ? 18 : 22, color: phase === "choose" ? (timer <= 5 ? "#ef4444" : "#ffffff") : "#374151", lineHeight: 1 }}>{phase === "choose" ? timer : "—"}</div>
              {phase === "choose" && <div style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 1 }}>SEC</div>}
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>T{turn}</div>
          </div>
          <HpBar displayHp={enemyDisplayHp} max={enemyData.hp} flip={true} playerLabel="2P" />
        </div>
        {phase === "choose" && (<div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}><div style={{ height: "100%", width: `${(timer / 15) * 100}%`, background: timer <= 5 ? "linear-gradient(90deg,#ef4444,#ff6b6b)" : "linear-gradient(90deg,#3b82f6,#60a5fa)", borderRadius: 2, transition: "width 1s linear" }} /></div>)}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 1fr", gap: 10, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace", fontWeight: "700", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, padding: "1px 5px" }}>ATK {kaiokenActive ? Math.floor((playerCurrentAtk + atkBonus.player) * 1.5) : (playerCurrentAtk + atkBonus.player)}</div>
            {kaiokenActive && (<div style={{ fontSize: 10, color: "#ff4400", fontFamily: "monospace", fontWeight: "900", background: "rgba(255,68,0,0.15)", border: "1px solid rgba(255,68,0,0.5)", borderRadius: 4, padding: "1px 5px", animation: "pulse 0.6s infinite" }}>界王拳🔥</div>)}
            {isGotenks && gotenksLevel === 1 && (<div style={{ fontSize: 9, color: "#fbbf24", fontFamily: "monospace", fontWeight: "900", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.5)", borderRadius: 4, padding: "1px 5px", animation: "pulse 0.8s infinite" }}>⚡SSJ</div>)}
            {isGotenks && gotenksLevel === 2 && (<div style={{ fontSize: 9, color: "#a78bfa", fontFamily: "monospace", fontWeight: "900", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.5)", borderRadius: 4, padding: "1px 5px", animation: "pulse 0.4s infinite" }}>⚡⚡SSJ3</div>)}
          </div>
          <div />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace", fontWeight: "700", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, padding: "1px 5px" }}>ATK {enemyData.atk + atkBonus.enemy}</div>
          </div>
        </div>
      </div>

      {zoomTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 78, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", background: "rgba(0,0,0,0.45)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ transform: "scale(2.2)", transformOrigin: "center bottom", animation: "scouterZoomIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              {zoomTarget === "player" ? <CharacterFighter card={playerCard} animState={startsWithKaioken ? "kaioken_idle" : "idle"} size={110} scale={0.85} /> : <CharacterFighter card={enemyData} animState="idle" isEnemy size={110} />}
            </div>
            {showZoomStats && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "scouterStatIn 0.4s ease both", marginLeft: 16 }}>
                <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 13, color: "#fff", textShadow: `0 0 12px ${zoomTarget === "player" ? (playerCard.color || "#f59e0b") : (enemyData.color || "#ef4444")}`, letterSpacing: 2, marginBottom: 4, borderLeft: `3px solid ${zoomTarget === "player" ? (playerCard.color || "#f59e0b") : (enemyData.color || "#ef4444")}`, paddingLeft: 8 }}>{zoomTarget === "player" ? playerCard.name : enemyData.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><div style={{ fontFamily: "monospace", fontSize: 9, color: "#4ade8088", letterSpacing: 2 }}>HP</div><div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 22, color: "#4ade80", textShadow: "0 0 12px #4ade80", letterSpacing: 1 }}>{zoomTarget === "player" ? zoomPlayerHp : enemyData.hp}</div></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><div style={{ fontFamily: "monospace", fontSize: 9, color: "#f8717188", letterSpacing: 2 }}>ATK</div><div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 22, color: "#f87171", textShadow: "0 0 12px #ef4444", letterSpacing: 1 }}>{zoomTarget === "player" ? zoomPlayerAtk : enemyData.atk}</div></div>
                {zoomTarget === "player" && zoomPlayerStatus && (<div style={{ fontFamily: "monospace", fontWeight: "900", fontSize: 11, color: "#ff4400", background: "rgba(255,68,0,0.15)", border: "1px solid rgba(255,68,0,0.5)", borderRadius: 4, padding: "3px 8px", textShadow: "0 0 8px #ff4400", animation: "pulse 0.6s infinite" }}>{zoomPlayerStatus}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {showSupportBanner && supportCard && (
        <div style={{ position: "fixed", inset: 0, zIndex: 82, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(105deg, transparent 20%, ${supportCard.color}dd 20%, ${supportCard.color}dd 80%, transparent 80%)`, animation: "supportBannerSlide 0.4s cubic-bezier(0.22,1,0.36,1) both" }} />
          <div style={{ position: "relative", zIndex: 1, textAlign: "center", animation: "supportBannerSlide 0.4s cubic-bezier(0.22,1,0.36,1) 0.05s both" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 16, color: "#000", letterSpacing: 4 }}>⚡ サポートカード発動！</div>
            <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 22, color: "#000", letterSpacing: 2, marginTop: 4 }}>{supportCard.name}</div>
          </div>
        </div>
      )}

      {showSupportInfo && supportCard && (
        <div style={{ position: "fixed", inset: 0, zIndex: 82, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, background: "rgba(0,0,0,0.55)" }}>
          <div style={{ width: 110, height: 154, borderRadius: 8, background: `linear-gradient(160deg,${supportCard.color}18,${supportCard.color}08,#0a0010)`, border: `2px solid ${supportCard.color}`, boxShadow: `0 0 24px ${supportCard.color}88`, display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 3px 4px", position: "relative", overflow: "hidden", animation: "cutInCardIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: supportCard.color, color: "#000", fontSize: 7, fontWeight: "900", textAlign: "center", padding: "2px 0", fontFamily: "monospace" }}>{supportCard.rarity} — サポート</div>
            <div style={{ marginTop: 14, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 40, filter: `drop-shadow(0 0 10px ${supportCard.color})` }}>{supportCard.illustSymbol}</div></div>
            <div style={{ fontSize: 9, color: "#fff", fontWeight: "700", textAlign: "center", fontFamily: "monospace", textShadow: `0 0 6px ${supportCard.color}` }}>{supportCard.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 180, animation: "fadeInUp 0.4s ease 0.3s both" }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: supportCard.color, fontWeight: "700", letterSpacing: 2 }}>サポート効果</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0", lineHeight: 1.6 }}>{supportCard.description}</div>
            {zoomPlayerStatus && (<div style={{ fontFamily: "monospace", fontWeight: "900", fontSize: 12, color: "#ff4400", textShadow: "0 0 8px #ff4400", animation: "pulse 0.6s infinite" }}>{zoomPlayerStatus}</div>)}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: "0 10px 20px", position: "relative", minHeight: 220 }}>
        {roundPhase === "round" && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ textAlign: "center", animation: roundFadeOut ? "fightOut 0.5s ease forwards" : "fightIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
              <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 18, color: "#60a5fa", letterSpacing: 8, textShadow: "0 0 16px #3b82f6", marginBottom: 4 }}>ROUND</div>
              <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 80, color: "#ffd700", textShadow: "0 0 40px #ffd700, 4px 4px 0 #7c2d12, -2px -2px 0 #000", lineHeight: 1 }}>{showRoundNum}</div>
            </div>
          </div>
        )}
        {showFight && (<div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 54, color: "#ffd700", textShadow: "0 0 30px #ffd700, 4px 4px 0 #7c2d12, -1px -1px 0 #000", letterSpacing: 6, animation: fightFadeOut ? "fightOut 0.5s ease forwards" : "fightIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>FIGHT!</div></div>)}
        {phase === "choose" && timer > 0 && timer <= 5 && (<div style={{ position: "absolute", inset: 0, zIndex: 19, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div key={`jk-cd-${timer}`} style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: timer <= 3 ? 120 : 96, color: timer <= 3 ? "#ef4444" : "#f59e0b", lineHeight: 1, opacity: 0.85, animation: "rouletteCountPop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>{timer}</div></div>)}
        {dmgText && (<div style={{ position: "absolute", inset: 0, zIndex: 18, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div style={{ textAlign: "center", animation: "dmgTextIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}><div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 58, color: dmgText.target === "enemy" ? "#fbbf24" : "#f87171", letterSpacing: 2, lineHeight: 1 }}>{dmgText.amount}</div><div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 20, color: "#fff", letterSpacing: 4, marginTop: 4 }}>ダメージ！</div></div></div>)}
        {kiryokuPhase === "announce" && (<div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,rgba(0,10,40,0.85),rgba(10,0,40,0.85))", pointerEvents: "none" }}><div style={{ textAlign: "center", animation: "kiryokuIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards" }}><div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 44, color: "#fff", textShadow: "0 0 20px #3b82f6, 0 0 40px #1d4ed8, 3px 3px 0 #000", letterSpacing: 2, lineHeight: 1.1 }}>気力全開<br />チャンス！</div><div style={{ marginTop: 10, fontSize: 12, color: "#93c5fd", letterSpacing: 6, animation: "pulse 0.6s infinite" }}>⚡ POWER UP ⚡</div></div></div>)}
        {dragonBurstPhase === "announce" && (<div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,rgba(40,0,0,0.82),rgba(20,0,0,0.88))", pointerEvents: "none" }}><div style={{ textAlign: "center", animation: "dragonBurstIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}><div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 46, color: "#fff", textShadow: "0 0 16px #ef4444, 0 0 32px #dc2626, 4px 4px 0 #000", letterSpacing: 2, lineHeight: 1.1 }}>ドラゴン<br />バースト！</div>{dragonBurstMultiplier > 1 && <div style={{ marginTop: 8, fontSize: 16, fontWeight: "900", color: "#fbbf24", animation: "pulse 0.4s infinite" }}>ATK × {dragonBurstMultiplier.toFixed(1)}</div>}</div></div>)}
        {clashFlash && <div style={{ position: "absolute", inset: 0, zIndex: 35, background: "radial-gradient(ellipse at center, rgba(255,200,50,0.9) 0%, rgba(255,150,0,0) 70%)", pointerEvents: "none", animation: "clashFlashAnim 0.3s ease forwards" }} />}
        {dragonBurstPhase === "janken" && (<div style={{ position: "absolute", top: 10, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}><div style={{ background: "rgba(0,0,0,0.75)", border: "2px solid #ef4444", borderRadius: 20, padding: "4px 16px", fontFamily: "monospace", fontWeight: "900", fontSize: 13, color: "#fbbf24", letterSpacing: 2 }}>🔥 ATK × {dragonBurstMultiplier.toFixed(1)}</div></div>)}
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, height: 2, background: "linear-gradient(90deg,transparent,rgba(180,120,60,0.5),rgba(180,120,60,0.5),transparent)" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", transform: `translateX(${playerOffset + playerClashOffset}px)`, transition: "transform 0.4s ease" }}>
          <div style={{ opacity: playerVisible ? 1 : 0, animation: playerVisible && enterPhase === "player_land" ? "charLand 0.4s cubic-bezier(0.22,1,0.36,1) forwards" : "none" }}>
            {playerCard.isGoku ? <GokuFighter animState={dragonBurstPhase === "janken" ? "dash" : playerAnim} scale={0.85} /> : <CharacterFighter card={playerCard} animState={dragonBurstPhase === "janken" ? "dash" : playerAnim} size={110} scale={0.85} />}
          </div>
          {damagePos === "player" && damageNum && <div style={{ position: "absolute", top: -20, right: -10, fontSize: 22, fontWeight: "900", color: "#ef4444", animation: "damageFloat 1s ease forwards", textShadow: "0 0 10px #ef4444" }}>-{damageNum}</div>}
        </div>

        <div style={{ textAlign: "center", minWidth: 80, position: "relative" }}>
          {clashSparks && (dragonBurstPhase === "janken" || dragonBurstPhase === "clash") && (
            <div style={{ position: "relative", width: 70, height: 80, overflow: "visible" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 22, height: 22, borderRadius: "50%", background: "radial-gradient(circle,#fff 0%,#fbbf24 40%,#f97316 70%,transparent 100%)", boxShadow: "0 0 12px 6px #fbbf2488", animation: "coreFlash 0.18s ease-in-out infinite alternate" }} />
            </div>
          )}
          {damagePos === "enemy" && damageNum && <div style={{ fontSize: 22, fontWeight: "900", color: "#f59e0b", animation: "damageFloat 1s ease forwards", textShadow: "0 0 10px #f59e0b" }}>-{damageNum}</div>}
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", transform: `translateX(${enemyClashOffset}px)`, transition: "transform 0.4s ease" }}>
          <div style={{ opacity: enemyVisible ? 1 : 0, animation: enemyVisible && enterPhase === "enemy_land" ? "charLand 0.4s cubic-bezier(0.22,1,0.36,1) forwards" : "none" }}>
            <CharacterFighter card={enemyData} animState={dragonBurstPhase === "janken" ? "idle" : (enemyAnim === "hit" ? "hit" : enemyAnim === "attack" ? "attack" : enemyAnim === "win" ? "win" : enemyAnim === "lose" ? "lose" : "idle")} isEnemy size={110} />
          </div>
        </div>
      </div>

      {kiryokuPhase === "smash" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "linear-gradient(180deg,rgba(0,5,30,0.95) 0%,rgba(5,0,30,0.98) 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, fontFamily: "'Courier New',monospace" }} onTouchStart={handleKiryokuTap} onClick={handleKiryokuTap}>
          <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: 6, marginBottom: 6, animation: "pulse 0.5s infinite" }}>⚡ 気力全開チャンス！ ⚡</div>
          <div key={kiryokuTimer} style={{ fontSize: 32, fontWeight: "900", color: kiryokuTimer <= 2 ? "#ef4444" : "#ffd700", marginBottom: 8 }}>{kiryokuTimer}</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, width: "100%", maxWidth: 340, marginBottom: 12 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: "900", color: "#4ade80" }}>{Math.round(playerMeter)}%</div>
              <div style={{ width: 28, height: 120, background: "#0a1208", border: "2px solid #1a3010", borderRadius: 4, overflow: "hidden", position: "relative" }}><div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${playerMeter}%`, background: "linear-gradient(180deg,#5eff3a,#22c55e,#16a34a)", transition: "height 0.1s ease" }} /></div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>あなた</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><div style={{ fontWeight: "900", fontSize: 18, color: "#ffd700", animation: "pulse 0.4s infinite", whiteSpace: "nowrap" }}>押しまくれ！！</div></div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: "900", color: "#f87171" }}>{Math.round(enemyMeter)}%</div>
              <div style={{ width: 28, height: 120, background: "#1a0808", border: "2px solid #3f1010", borderRadius: 4, overflow: "hidden", position: "relative" }}><div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${enemyMeter}%`, background: "linear-gradient(180deg,#ff6b6b,#ef4444,#dc2626)", transition: "height 0.15s ease" }} /></div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>てき</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 136, display: "flex", justifyContent: "center" }}>
              <button onTouchStart={e => { e.stopPropagation(); handleKiryokuTap(); }} onClick={e => { e.stopPropagation(); handleKiryokuTap(); }} style={{ width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,#1a0505,#000)", border: "3px solid #ef4444", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 24 }}>✊</span><span style={{ fontSize: 7, color: "#ef4444", fontWeight: "700" }}>グー</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["✌️", "#f59e0b", "チョキ"], ["🖐️", "#3b82f6", "パー"]].map(([emoji, color, label]) => (
                <button key={label} onTouchStart={e => { e.stopPropagation(); handleKiryokuTap(); }} onClick={e => { e.stopPropagation(); handleKiryokuTap(); }} style={{ width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,#0d0d0d,#000)", border: `3px solid ${color}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 24 }}>{emoji}</span><span style={{ fontSize: 7, color, fontWeight: "700" }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>タップ連打でメーターを溜めろ！</div>
        </div>
      )}

      {kiryokuPhase === "result_show" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, fontFamily: "'Courier New',monospace", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "50%", background: playerMeter >= enemyMeter ? "linear-gradient(135deg,#1a0e00,#3d2800,#1a0e00)" : "linear-gradient(135deg,#0e0020,#200040,#0e0020)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRight: "2px solid rgba(255,255,255,0.15)" }}>
            <div style={{ fontWeight: "900", fontSize: 30, color: playerMeter >= enemyMeter ? "#fbbf24" : "#a78bfa", animation: "scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)", letterSpacing: 2 }}>{playerMeter >= enemyMeter ? "勝ち！" : "負け…"}</div>
            <div style={{ fontSize: 40, fontWeight: "900", color: playerMeter >= enemyMeter ? "#fde68a" : "#ddd6fe" }}>{Math.round(playerMeter)}<span style={{ fontSize: 20 }}>%</span></div>
            {showAtkBonus && (<div style={{ background: atkBonus.player === 100 ? "linear-gradient(135deg,#78350f,#d97706,#fbbf24,#d97706,#78350f)" : "linear-gradient(135deg,#2e1065,#5b21b6,#7c3aed,#5b21b6,#2e1065)", borderRadius: 10, padding: "10px 18px", textAlign: "center" }}><div style={{ fontSize: 9, color: "#fef3c7", letterSpacing: 2 }}>攻撃力</div><div style={{ fontSize: 36, fontWeight: "900", color: "#fff" }}>+{atkBonus.player}</div><div style={{ fontSize: 14, fontWeight: "900", color: "#fde68a", letterSpacing: 4 }}>UP!</div></div>)}
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>あなた</div>
          </div>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "50%", background: enemyMeter > playerMeter ? "linear-gradient(135deg,#1a0e00,#3d2800,#1a0e00)" : "linear-gradient(135deg,#0e0020,#200040,#0e0020)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div style={{ fontWeight: "900", fontSize: 30, color: enemyMeter > playerMeter ? "#fbbf24" : "#a78bfa", animation: "scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.08s both", letterSpacing: 2 }}>{enemyMeter > playerMeter ? "勝ち！" : "負け…"}</div>
            <div style={{ fontSize: 40, fontWeight: "900", color: enemyMeter > playerMeter ? "#fde68a" : "#ddd6fe" }}>{Math.round(enemyMeter)}<span style={{ fontSize: 20 }}>%</span></div>
            {showAtkBonus && (<div style={{ background: atkBonus.enemy === 100 ? "linear-gradient(135deg,#78350f,#d97706,#fbbf24,#d97706,#78350f)" : "linear-gradient(135deg,#2e1065,#5b21b6,#7c3aed,#5b21b6,#2e1065)", borderRadius: 10, padding: "10px 18px", textAlign: "center" }}><div style={{ fontSize: 9, color: "#fef3c7", letterSpacing: 2 }}>攻撃力</div><div style={{ fontSize: 36, fontWeight: "900", color: "#fff" }}>+{atkBonus.enemy}</div><div style={{ fontSize: 14, fontWeight: "900", color: "#fde68a", letterSpacing: 4 }}>UP!</div></div>)}
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>てき</div>
          </div>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 3, background: "linear-gradient(180deg,transparent,#fff,rgba(255,255,255,0.8),#fff,transparent)", transform: "translateX(-50%)", animation: "pulse 0.6s infinite" }} />
        </div>
      )}

      <DragonBurstDecideScreen data={dragonBurstDecide} />

      {rouletteState && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", flexDirection: "row", fontFamily: "monospace", overflow: "hidden" }}
          onClick={() => { if (rouletteState.attacker === "player") { if (!rouletteState.atkStopped) stopAtkRoulette(); } else { if (!rouletteState.defStopped) stopDefRoulette(); } }}
          onTouchEnd={(e) => { e.preventDefault(); if (rouletteState.attacker === "player") { if (!rouletteState.atkStopped) stopAtkRoulette(); } else { if (!rouletteState.defStopped) stopDefRoulette(); } }}>
          {[true, false].map((isPlayerSide) => {
            const isPlayerAtk = rouletteState.attacker === "player";
            const showPlayerAtk = isPlayerSide ? isPlayerAtk : !isPlayerAtk;
            const slots = showPlayerAtk ? rouletteState.atkSlots : rouletteState.defSlots;
            const idx = showPlayerAtk ? rouletteState.atkIdx : rouletteState.defIdx;
            const stopped = showPlayerAtk ? rouletteState.atkStopped : rouletteState.defStopped;
            const result = showPlayerAtk ? rouletteState.atkResult : rouletteState.defResult;
            const isAttack = showPlayerAtk;
            let lv;
            if (isAttack) { lv = rouletteState.attacker === "player" ? atkRouletteLevel : enemyAtkRouletteLevel; }
            else { lv = rouletteState.attacker === "player" ? enemyDefRouletteLevel : defRouletteLevel; }
            const canTap = isPlayerSide && !stopped;
            const onTap = isPlayerSide ? (showPlayerAtk ? stopAtkRoulette : stopDefRoulette) : () => {};
            const accentColor = isAttack ? "#ef4444" : "#3b82f6";
            return (
              <div key={String(isPlayerSide)} style={{ width: "50%", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: isAttack ? "linear-gradient(160deg,#1a0000,#2a0800)" : "linear-gradient(160deg,#00001a,#000a20)", borderRight: isPlayerSide ? `2px solid ${accentColor}44` : "none", padding: "6px 2px", position: "relative", overflow: "hidden" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 2, zIndex: 1 }}>{isPlayerSide ? "あなた" : "てき"} の {isAttack ? "攻撃" : "ガード"}</div>
                <div style={{ zIndex: 1, width: "100%", display: "flex", justifyContent: "center" }}>
                  <RouletteWheel slots={slots} currentIdx={idx} isAttack={isAttack} lv={lv} stopped={stopped} result={result} onTap={canTap ? onTap : () => {}} size={172} />
                </div>
                {canTap && <div style={{ fontSize: 9, fontWeight: "900", color: accentColor, letterSpacing: 2, animation: "pulse 0.5s infinite", zIndex: 1 }}>▼ タップして止める！</div>}
                {stopped && result && <div style={{ fontSize: 11, fontWeight: "900", color: isAttack ? (result === "special" ? "#ef4444" : "#9ca3af") : (GUARD_COLOR[result] || "#9ca3af"), animation: "scaleIn 0.3s ease", letterSpacing: 1, zIndex: 1 }}>{isAttack ? (result === "special" ? "💥 必殺技！" : "ノーマル") : `🛡️ ${GUARD_LABEL[result]}`}</div>}
              </div>
            );
          })}
          {rouletteCountdown > 0 && rouletteCountdown <= 5 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
              <div key={rouletteCountdown} style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: rouletteCountdown <= 3 ? 100 : 80, color: rouletteCountdown <= 3 ? "#ef4444" : "#fbbf24", lineHeight: 1, animation: "rouletteCountPop 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards", opacity: 0.92 }}>{rouletteCountdown}</div>
            </div>
          )}
        </div>
      )}

      {(phase === "choose" || phase === "waiting_enemy") && (
        <div style={{ padding: "10px 12px 14px", background: "rgba(0,0,0,0.68)", borderTop: "1px solid #1f2937", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", fontSize: 9, color: "#6b7280", letterSpacing: 4, marginBottom: 10 }}>─ 手を選べ！ ─</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 8px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, position: "relative" }}>
              <div style={{ width: 136, display: "flex", justifyContent: "center", position: "relative" }}>
                <JankenBtn hand="rock" playerCard={playerCard} onSelect={handleHandSelect} selected={playerHand} />
                {showSet && playerHand === "rock" && <div style={{ position: "absolute", bottom: -8, right: 8, zIndex: 20, pointerEvents: "none", fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 13, color: "#4ade80", textShadow: "0 0 16px #4ade80, 2px 2px 0 #052e16", letterSpacing: 4, animation: "setIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>SET!</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["scissors", "paper"].map(h => (
                  <div key={h} style={{ position: "relative" }}>
                    <JankenBtn hand={h} playerCard={playerCard} onSelect={handleHandSelect} selected={playerHand} />
                    {showSet && playerHand === h && <div style={{ position: "absolute", bottom: -8, right: -4, zIndex: 20, pointerEvents: "none", fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 13, color: "#4ade80", textShadow: "0 0 16px #4ade80, 2px 2px 0 #052e16", letterSpacing: 4, animation: "setIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>SET!</div>}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <div style={{ width: 136, display: "flex", justifyContent: "center" }}><EnemyHandDisplay hand={enemyHand} slot="top" phase={phase} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <EnemyHandDisplay hand={enemyHand} slot="left" phase={phase} />
                <EnemyHandDisplay hand={enemyHand} slot="right" phase={phase} />
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "reveal" && playerHand && enemyHand && (
        <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.82)", borderTop: "1px solid #1f2937", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            {[{ hand: playerHand, label: "YOU", myResult: jankenResultLabel }, { hand: enemyHand, label: "ENEMY", myResult: jankenResultLabel === "win" ? "lose" : jankenResultLabel === "lose" ? "win" : jankenResultLabel }].map(({ hand, label, myResult }, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 90 }}>
                {myResult && <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: myResult === "draw" ? 14 : 18, color: myResult === "win" ? "#4ade80" : myResult === "lose" ? "#ef4444" : "#f59e0b", letterSpacing: 2, animation: `scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.08}s both` }}>{myResult === "win" ? "勝ち！" : myResult === "lose" ? "負け…" : "あいこ！"}</div>}
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${HAND_BG[hand]}, #000)`, border: `4px solid ${HAND_COLOR[hand]}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `0 0 24px ${HAND_COLOR[hand]}88`, animation: `scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.1}s both` }}>
                  <span style={{ fontSize: 30 }}>{HAND_EMOJI[hand]}</span>
                  <span style={{ fontSize: 9, color: HAND_COLOR[hand], fontWeight: "900" }}>{HAND_LABEL[hand]}</span>
                </div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
            <div style={{ fontFamily: "'Courier New',monospace", fontWeight: "900", fontSize: 16, color: "#f59e0b" }}>VS</div>
          </div>
        </div>
      )}

      {battleLog.length > 0 && <div style={{ padding: "6px 16px", fontSize: 9, color: "#6b7280", borderTop: "1px solid #111", maxHeight: 40, overflow: "hidden" }}>{battleLog[battleLog.length - 1]}</div>}
    </div>
  );
};

const VSCutScreen = ({ playerCard, enemyData, onDone }) => {
  const [phase, setPhase] = useState("show");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fadeout"), 3000);
    const t2 = setTimeout(() => onDone(), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, overflow: "hidden", background: "#000", opacity: phase === "fadeout" ? 0 : 1, transition: phase === "fadeout" ? "opacity 2s ease" : "none", display: "flex", flexDirection: "row" }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#060e2a,#0d2050,#1a3a6e)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
        <div style={{ position: "absolute", top: "6%", left: 0, right: 0, textAlign: "center", animation: "fadeInUp 0.4s ease 0.3s both" }}>
          <div style={{ fontWeight: "900", fontSize: 11, color: "#93c5fd", letterSpacing: 4 }}>1 P</div>
          <div style={{ fontWeight: "900", fontSize: 13, color: "#fff", textShadow: "0 0 10px #60a5fa, 2px 2px 0 #000", letterSpacing: 1, marginTop: 2 }}>{playerCard.name}</div>
        </div>
        <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: "8%", animation: "vsCharIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both", flex: 1, paddingTop: "18%" }}>
          <CharacterFighter card={playerCard} animState="idle" size={140} scale={0.85} />
        </div>
      </div>
      <div style={{ width: 3, flexShrink: 0, zIndex: 5, background: "linear-gradient(180deg,transparent 0%,#fff 20%,#fff 80%,transparent 100%)", boxShadow: "0 0 18px 4px rgba(255,255,255,0.7)" }} />
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "linear-gradient(200deg,#2a0606,#501010,#7a1a1a)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
        <div style={{ position: "absolute", top: "6%", left: 0, right: 0, textAlign: "center", animation: "fadeInUp 0.4s ease 0.4s both" }}>
          <div style={{ fontWeight: "900", fontSize: 11, color: "#fca5a5", letterSpacing: 4 }}>2 P</div>
          <div style={{ fontWeight: "900", fontSize: 13, color: "#fff", textShadow: "0 0 10px #f87171, 2px 2px 0 #000", letterSpacing: 1, marginTop: 2 }}>{enemyData.name}</div>
        </div>
        <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: "8%", animation: "vsEnemyIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.3s both", flex: 1, paddingTop: "18%", transform: "scaleX(-1)" }}>
          <CharacterFighter card={enemyData} animState="idle" size={140} />
        </div>
      </div>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontWeight: "900", fontSize: 68, color: "#fff", textShadow: "0 0 28px #fff, 4px 4px 0 #000, -2px -2px 0 #000", letterSpacing: 6, fontFamily: "'Arial Black','Impact',sans-serif", zIndex: 10, animation: "vsTextIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both", whiteSpace: "nowrap" }}>VS</div>
    </div>
  );
};

const ResultScreen = ({ won, playerCard, enemy, onHome }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: won ? "radial-gradient(ellipse,#052e16 0%,#000 70%)" : "radial-gradient(ellipse,#3b0000 0%,#000 70%)", fontFamily: "monospace", padding: 20 }}>
    <div style={{ fontSize: 42, fontWeight: "900", marginBottom: 8, color: won ? "#4ade80" : "#ef4444", textShadow: `0 0 40px ${won ? "#4ade80" : "#ef4444"}`, animation: "scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)", letterSpacing: 4 }}>{won ? "WINNER!" : "KO..."}</div>
    {won && (<div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>{Array.from({ length: 20 }).map((_, i) => (<div key={i} style={{ position: "absolute", left: `${Math.random() * 100}%`, top: "-20px", width: 8, height: 8, borderRadius: "50%", background: ["#fbbf24", "#4ade80", "#60a5fa", "#f87171", "#a78bfa"][i % 5], animation: `confettiFall ${1.5 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`, opacity: 0.8 }} />))}</div>)}
    <div style={{ display: "flex", gap: 30, margin: "20px 0", alignItems: "flex-end" }}>
      <div style={{ textAlign: "center" }}><CharacterFighter card={playerCard} animState={won ? "win" : "lose"} size={90} scale={0.55} /><div style={{ fontSize: 9, color: "#9ca3af", marginTop: 4 }}>{playerCard.name}</div></div>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>VS</div>
      <div style={{ textAlign: "center" }}><CharacterFighter card={enemy} animState={won ? "lose" : "win"} isEnemy size={90} /><div style={{ fontSize: 9, color: "#9ca3af", marginTop: 4 }}>{enemy.name}</div></div>
    </div>
    {won && (<div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid #4ade8044", borderRadius: 10, padding: "12px 24px", marginBottom: 20, textAlign: "center" }}><div style={{ fontSize: 11, color: "#4ade80", marginBottom: 6 }}>★ 報酬獲得！</div><div style={{ fontSize: 24, color: "#f59e0b" }}>🪙 +150コイン</div></div>)}
    <button onClick={onHome} style={{ padding: "16px 48px", background: "linear-gradient(135deg,#374151,#1f2937)", border: "2px solid #6b7280", borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: "900", cursor: "pointer", fontFamily: "monospace", letterSpacing: 2 }}>🏠 ホームへ</button>
  </div>
);

const OwnedCardsScreen = ({ ownedCards, onBack }) => {
  const cards = ownedCards.map(id => CARDS.find(c => c.id === id)).filter(Boolean);
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#050510,#0a0a2e)", fontFamily: "monospace", padding: 16 }}>
      <div style={{ fontSize: 12, color: "#60a5fa", letterSpacing: 4, textAlign: "center", marginBottom: 16 }}>◆ 所持カード ({cards.length}枚) ◆</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12, justifyItems: "center", marginBottom: 16 }}>
        {cards.map(card => <CardDisplay key={card.id} card={card} />)}
      </div>
      <div style={{ textAlign: "center" }}><button onClick={onBack} style={{ padding: "10px 30px", background: "transparent", border: "1px solid #374151", borderRadius: 8, color: "#6b7280", fontFamily: "monospace", cursor: "pointer", fontSize: 12 }}>← もどる</button></div>
    </div>
  );
};

export default function App() {
  const [screen, setScreen] = useState("title");
  const [coins, setCoins] = useState(500);
  const [ownedCards, setOwnedCards] = useState(INITIAL_OWNED);
  const [selectedCard, setSelectedCard] = useState(null);
  const [gachaCard, setGachaCard] = useState(null);
  const [battleEnemy, setBattleEnemy] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [gachaMode, setGachaMode] = useState("gacha");
  const [ownedSupports] = useState(INITIAL_SUPPORT);
  const [ownedEvents] = useState(INITIAL_EVENT);
  const [selectedSupport, setSelectedSupport] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [cutInCard, setCutInCard] = useState(null);
  const [cutInAfter, setCutInAfter] = useState(null);

  const handleCoinInsert = () => {
    setCoins(c => c - 100);
    const card = CARDS[Math.floor(Math.random() * CARDS.length)];
    setGachaCard(card);
    if (!ownedCards.includes(card.id)) setOwnedCards(o => [...o, card.id]);
    setGachaMode("game"); setScreen("gacha_result");
  };

  const handleGachaOnly = () => {
    if (coins < 100) return;
    setCoins(c => c - 100);
    const card = CARDS[Math.floor(Math.random() * CARDS.length)];
    setGachaCard(card);
    if (!ownedCards.includes(card.id)) setOwnedCards(o => [...o, card.id]);
    setGachaMode("gacha"); setScreen("gacha_result");
  };

  const handleBuyAgain = () => {
    if (coins < 100) { setScreen("title"); return; }
    setCoins(c => c - 100);
    const card = CARDS[Math.floor(Math.random() * CARDS.length)];
    setGachaCard(null);
    setTimeout(() => { setGachaCard(card); if (!ownedCards.includes(card.id)) setOwnedCards(o => [...o, card.id]); }, 50);
  };

  const handleCharCardSelect = (card) => { setSelectedCard(card); setBattleEnemy(ENEMIES[Math.floor(Math.random() * ENEMIES.length)]); setScreen("support_select"); };
  const handleSupportSelect = (card) => { setSelectedSupport(card); setScreen("event_select"); };
  const handleEventSelect = (card) => { setSelectedEvent(card); setScreen("vs"); };

  return (
    <>
      <style>{`
        @keyframes titlePulse { 0%,100%{text-shadow:0 0 40px #f59e0b, 0 0 80px #f59e0b44} 50%{text-shadow:0 0 60px #f59e0b, 0 0 120px #f59e0b66} }
        @keyframes rayRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes cardAppear { 0%{opacity:0;transform:scale(0.3) translateY(60px)} 60%{opacity:1;transform:scale(1.05) translateY(-5px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes scanline { 0%{top:-10%} 100%{top:110%} }
        @keyframes dataFloat { 0%{opacity:0.3;transform:translateY(0)} 100%{opacity:0.8;transform:translateY(-8px)} }
        @keyframes btnGlow { from{box-shadow:0 4px 20px #00ff4488, 0 0 30px #00ff4433} to{box-shadow:0 4px 30px #00ff44cc, 0 0 50px #00ff4466} }
        @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes damageFloat { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-40px) scale(1.3)} }
        @keyframes fightIn { 0%{opacity:0;transform:scale(2.5) rotate(-5deg)} 60%{opacity:1;transform:scale(0.95)} 100%{opacity:1;transform:scale(1)} }
        @keyframes fightOut { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.5)} }
        @keyframes setIn { 0%{opacity:0;transform:scale(0.4) rotate(-8deg)} 60%{opacity:1;transform:scale(1.1) rotate(2deg)} 100%{opacity:1;transform:scale(1)} }
        @keyframes kiryokuIn { 0%{opacity:0;transform:scale(0.3) rotate(-6deg)} 60%{opacity:1;transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }
        @keyframes goldShine { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.35) drop-shadow(0 0 8px #fbbf24)} }
        @keyframes starFloat { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-30px) scale(0.5)} }
        @keyframes dmgTextIn { 0%{opacity:0;transform:scale(0.4) translateY(10px)} 60%{opacity:1;transform:scale(1.05) translateY(-5px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes dragonBurstIn { 0%{opacity:0;transform:scale(0.2) rotate(-8deg)} 50%{opacity:1;transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
        @keyframes clashFlashAnim { 0%{opacity:1} 100%{opacity:0} }
        @keyframes coreFlash { 0%{transform:translate(-50%,-50%) scale(0.7);opacity:0.8} 100%{transform:translate(-50%,-50%) scale(1.2);opacity:1} }
        @keyframes vsTextIn { 0%{opacity:0;transform:translate(-50%,-50%) scale(3) rotate(-4deg)} 60%{opacity:1;transform:translate(-50%,-50%) scale(0.95)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes vsCharIn { 0%{opacity:0;transform:translateX(-60px) scale(0.7)} 60%{opacity:1;transform:translateX(5px) scale(1.02)} 100%{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes vsEnemyIn { 0%{opacity:0;transform:translateX(60px) scale(0.7)} 60%{opacity:1;transform:translateX(-5px) scale(1.02)} 100%{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes rouletteCountPop { 0%{opacity:0;transform:scale(2.2)} 40%{opacity:0.92;transform:scale(0.92)} 70%{transform:scale(1.06)} 100%{opacity:0.85;transform:scale(1)} }
        @keyframes cutInCardIn { 0%{opacity:0;transform:scale(0.2) rotate(-8deg)} 60%{opacity:1;transform:scale(1.06) rotate(1deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes cutInBannerIn { 0%{opacity:0;transform:scaleX(0.1) scaleY(1.5)} 50%{opacity:1;transform:scaleX(1.05) scaleY(0.95)} 100%{opacity:1;transform:scale(1)} }
        @keyframes fusionCharLeft { 0%{transform:translateX(0) scale(1)} 70%{transform:translateX(40px) scale(1.2)} 90%{transform:translateX(30px) scale(0.8)} 100%{transform:translateX(0) scale(0);opacity:0} }
        @keyframes fusionCharRight { 0%{transform:translateX(0) scale(1)} 70%{transform:translateX(-40px) scale(1.2)} 90%{transform:translateX(-30px) scale(0.8)} 100%{transform:translateX(0) scale(0);opacity:0} }
        @keyframes charLand { 0%{transform:scaleY(0.6) scaleX(1.3);opacity:0.5} 40%{transform:scaleY(1.1) scaleX(0.95)} 70%{transform:scaleY(0.97) scaleX(1.02)} 100%{transform:scale(1);opacity:1} }
        @keyframes scouterZoomIn { 0%{opacity:0;transform:scale(1.4)} 60%{opacity:1;transform:scale(2.1)} 100%{opacity:1;transform:scale(2.2)} }
        @keyframes scouterStatIn { 0%{opacity:0;transform:translateX(14px)} 100%{opacity:1;transform:translateX(0)} }
        @keyframes supportBannerSlide { 0%{opacity:0;transform:translateX(-60%) skewX(-8deg)} 60%{opacity:1;transform:translateX(4%) skewX(-8deg)} 100%{opacity:1;transform:translateX(0%) skewX(-8deg)} }
        @keyframes stickman-idle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes stickman-attack { 0%{transform:translateX(0)} 30%{transform:translateX(20px)} 100%{transform:translateX(0)} }
        @keyframes stickman-hit { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-12px)} 75%{transform:translateX(4px)} }
        @keyframes stickman-win { from{transform:translateY(0) rotate(-5deg)} to{transform:translateY(-10px) rotate(5deg)} }
        @keyframes stickman-lose { to{transform:translateY(8px) rotate(15deg);opacity:0.5} }
        .stickman-idle { animation: stickman-idle 2s ease-in-out infinite; }
        .stickman-attack { animation: stickman-attack 0.4s ease; }
        .stickman-hit { animation: stickman-hit 0.3s ease; }
        .stickman-win { animation: stickman-win 0.6s ease infinite alternate; }
        .stickman-lose { animation: stickman-lose 0.5s ease forwards; }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#000; }
        button:active { transform:scale(0.97); }
      `}</style>

      {screen === "title" && <TitleScreen onStart={() => setScreen("coin")} onGacha={handleGachaOnly} onCards={() => setScreen("owned")} ownedCards={ownedCards} />}
      {screen === "coin" && <CoinInsertScreen coins={coins} onInsert={handleCoinInsert} onBack={() => setScreen("title")} />}
      {screen === "gacha_result" && gachaCard && (<GachaResultScreen card={gachaCard} mode={gachaMode} onHome={() => setScreen("title")} onBuyAgain={handleBuyAgain} onSelectCard={() => setScreen("select")} />)}
      {screen === "select" && (<CardSelectScreen ownedCards={ownedCards} onSelect={handleCharCardSelect} onBack={() => setScreen("title")} />)}
      {screen === "support_select" && (<SupportCardSelectScreen ownedSupports={ownedSupports} onSelect={handleSupportSelect} onSkip={handleSupportSelect} />)}
      {screen === "event_select" && (<EventCardSelectScreen ownedEvents={ownedEvents} onSelect={handleEventSelect} onSkip={handleEventSelect} />)}
      {screen === "vs" && selectedCard && battleEnemy && (<VSCutScreen playerCard={selectedCard} enemyData={battleEnemy} onDone={() => setScreen("battle")} />)}
      {screen === "battle" && selectedCard && battleEnemy && (<BattleScreen playerCard={selectedCard} enemyData={battleEnemy} supportCard={selectedSupport} eventCard={selectedEvent} onEnd={won => { if (won) setCoins(c => c + 150); setBattleResult(won); setTimeout(() => setScreen("result"), 500); }} />)}
      {screen === "result" && selectedCard && battleEnemy && (<ResultScreen won={battleResult} playerCard={selectedCard} enemy={battleEnemy} onHome={() => { setBattleResult(null); setSelectedCard(null); setSelectedSupport(null); setSelectedEvent(null); setScreen("title"); }} />)}
      {screen === "owned" && <OwnedCardsScreen ownedCards={ownedCards} onBack={() => setScreen("title")} />}
    </>
  );
}
