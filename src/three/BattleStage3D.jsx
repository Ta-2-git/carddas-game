// =============================================================
//  BattleStage3D — 対戦画面用の3Dステージ
// =============================================================
//  自分と相手を「1つの3D空間」に並べて描画します。
//  こうすることで、気弾や必殺技が相手に向かって飛ぶ表現ができます。
//  （キャラごとに別canvasだと、間を飛ぶ表現ができません）
//
//  使い方は INTEGRATION.md を参照してください。
// =============================================================

import { useEffect, useRef } from "react";
import CharacterRig from "./CharacterRig";
import { getCharacter, normalizeMotion, MOTION } from "../data/characters";

const CHAR_HEIGHT = 0.97; // 素体の身長（足0.16〜頭1.13）

// 画面に映るキャラの高さを「canvas幅の何分の1にするか」。
// PC（横長）は小さめ、スマホ（縦長）は大きめにします。
const SIZE_FRAC_WIDE = 1 / 8;
const SIZE_FRAC_NARROW = 1 / 4;

// ---- 画面比率への最適化 ----------------------------------------
//  スマホ（縦長）とPC（横長）で使える形が大きく違うため、
//   1) canvasが縦長になりすぎないように高さを制限する
//   2) 横幅が足りない時は2人の間隔を詰める
//   3) 必要な表示範囲からカメラ距離を逆算する
//   4) キャラの大きさも画面比率に合わせる
//  の4段構えで、どちらでも見切れず・大きさが不自然にならないようにします。
const FOV_Y = 38;
const MIN_ASPECT = 1.1;    // これより縦長のcanvasにはしない
const SPREAD_WIDE = 1.7;   // 横に余裕がある時の立ち位置（±）
const SPREAD_NARROW = 1.05; // 縦長画面で詰めた時の立ち位置（±）
const HALF_W_MARGIN = 0.8;  // 立ち位置に足す体の幅＋余白
const FIT_HALF_H = 1.15;    // 上下に必要な半高
const FIT_CENTER_Y = 1.05;

/** 画面比率のどのあたりか（0=縦長スマホ / 1=横長PC） */
function wideness(aspect) {
  return Math.min(1, Math.max(0, (aspect - 0.9) / (1.8 - 0.9)));
}

/** 画面比率から2人の立ち位置（中心からの距離）を決めます */
function spreadFor(aspect) {
  return SPREAD_NARROW + (SPREAD_WIDE - SPREAD_NARROW) * wideness(aspect);
}

/**
 * キャラの表示倍率を決めます。
 * 「画面に映る高さ ÷ canvas幅」が目標の割合になるよう逆算します。
 * 横方向に見えている範囲は 2*halfW なので、
 *   割合 = (身長 × 倍率) / (2 × halfW)
 */
function charScaleFor(aspect, halfW) {
  const frac = SIZE_FRAC_NARROW + (SIZE_FRAC_WIDE - SIZE_FRAC_NARROW) * wideness(aspect);
  return (frac * 2 * halfW) / CHAR_HEIGHT;
}

/** 画面比率に合わせてカメラを引き、2人とも収まる距離に置きます */
function frameCamera(camera, aspect, halfW) {
  const tanY = Math.tan((FOV_Y * Math.PI) / 180 / 2);
  const distV = FIT_HALF_H / tanY;             // 縦に収まる距離
  const distH = halfW / (tanY * aspect);       // 横に収まる距離
  const dist = Math.max(distV, distH);         // 厳しい方に合わせる
  camera.aspect = aspect;
  camera.position.set(0, FIT_CENTER_Y + 0.3, dist);
  camera.lookAt(0, FIT_CENTER_Y, 0);
  camera.updateProjectionMatrix();
}

/** canvasサイズ・立ち位置・カメラをまとめて画面比率に合わせます */
function applyLayout(S, w, h) {
  if (!S.renderer || !S.camera) return;
  const aspect = w / h;
  const spread = spreadFor(aspect);
  const halfW = spread + HALF_W_MARGIN;
  const scale = charScaleFor(aspect, halfW);
  S.spread = spread;
  if (S.playerRig) { S.playerRig.root.position.x = -spread; S.playerRig.root.scale.setScalar(scale); }
  if (S.enemyRig) { S.enemyRig.root.position.x = spread; S.enemyRig.root.scale.setScalar(scale); }
  S.renderer.setSize(w, h);
  frameCamera(S.camera, aspect, halfW);
}

export default function BattleStage3D({
  playerCardId,
  enemyCardId,
  playerAnim = "idle",
  enemyAnim = "idle",
  playerTransformed = false,
  enemyTransformed = false,
  playerAnimLoop = false, // trueの間、1回再生のモーションも終わったら繰り返す（ドラゴンバースト用）
  enemyAnimLoop = false,
  shot = null,          // { key, from: "player"|"enemy", kind: "kiBlast"|"ultimate" }
  onShotHit = null,     // 着弾時に呼ばれます
  onPlayerShot = null,  // 自キャラが腕を伸ばしきった瞬間（弾を出す合図）
  width = null,         // 未指定なら親要素いっぱいに自動フィット（スマホ/PC両対応）
  height = null,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  // 最新のコールバックを参照できるようにしておきます（rigは作り直さないため）
  const onPlayerShotRef = useRef(onPlayerShot);
  onPlayerShotRef.current = onPlayerShot;

  // ---------- 初期化（キャラが変わった時だけ） ----------
  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE || !mountRef.current) return;
    const S = stateRef.current;
    let cancelled = false;

    const el = mountRef.current;
    const w0 = width || el.clientWidth || 360;
    const h0 = height || el.clientHeight || 240;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w0, h0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV_Y, w0 / h0, 0.1, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    // 自キャラは敵(+X側)を、敵キャラは自キャラ(-X側)を向くように固定する
    const playerRig = new CharacterRig({
      cardId: playerCardId, isEnemy: false, facingYDeg: 90, preloadAll: true,
      // モーションが腕を伸ばしきった瞬間に呼ばれます
      onShot: (motion) => { if (onPlayerShotRef.current) onPlayerShotRef.current(motion); },
    });
    const enemyRig = new CharacterRig({ cardId: enemyCardId, isEnemy: true, facingYDeg: -90, preloadAll: true });
    // 立ち位置と大きさは applyLayout で画面比率に合わせて設定します
    scene.add(playerRig.root, enemyRig.root);
    playerRig.load();
    enemyRig.load();

    Object.assign(S, { THREE, renderer, scene, camera, playerRig, enemyRig, shots: [] });
    applyLayout(S, w0, h0); // 立ち位置とカメラを画面比率に合わせる

    // 必殺技の動画エフェクトは、撃つ前に読み込んでおきます
    for (const id of [playerCardId, enemyCardId]) {
      const u = (getCharacter(id).ultimate || {}).video;
      if (u) preloadShotVideo(u);
    }

    const clock = new THREE.Clock();
    const tick = () => {
      if (cancelled) return;
      S.raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      playerRig.update(dt);
      enemyRig.update(dt);
      updateShots(S, dt, onShotHit);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(S.raf);
      playerRig.dispose();
      enemyRig.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      stateRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCardId, enemyCardId]);

  // ---------- 画面サイズへの追従（スマホ/PC・回転の両方に対応） ----------
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const apply = () => {
      const S = stateRef.current;
      if (!S.renderer || !S.camera) return;
      const w = Math.round(width || el.clientWidth);
      // 縦長になりすぎると横並びの対戦が見づらいので高さを制限します
      const availH = Math.round(height || el.clientHeight);
      const h = Math.min(availH, Math.round(w / MIN_ASPECT));
      if (w < 2 || h < 2) return;
      if (w === S.lastW && h === S.lastH) return; // 変化がなければ何もしない
      S.lastW = w; S.lastH = h;
      applyLayout(S, w, h);
    };

    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    // 端末や描画タイミングによってはイベントを取りこぼすことがあるため、
    // 保険として定期的にもサイズを見に行きます（変化がなければ即return）
    const poll = setInterval(apply, 400);
    return () => {
      if (ro) ro.disconnect();
      clearInterval(poll);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, [width, height]);

  // ---------- モーション切り替え ----------
  useEffect(() => {
    const rig = stateRef.current.playerRig;
    if (rig) rig.play(normalizeMotion(playerAnim));
  }, [playerAnim]);

  useEffect(() => {
    const rig = stateRef.current.enemyRig;
    if (rig) rig.play(normalizeMotion(enemyAnim));
  }, [enemyAnim]);

  // ---------- ループ指定（ドラゴンバースト中の近接攻撃モーション等） ----------
  useEffect(() => {
    const rig = stateRef.current.playerRig;
    if (rig) rig.setLoopOverride(playerAnimLoop);
  }, [playerAnimLoop]);

  useEffect(() => {
    const rig = stateRef.current.enemyRig;
    if (rig) rig.setLoopOverride(enemyAnimLoop);
  }, [enemyAnimLoop]);

  // ---------- 変身状態 ----------
  useEffect(() => {
    const rig = stateRef.current.playerRig;
    if (rig) rig.setTransformed(playerTransformed);
  }, [playerTransformed]);

  useEffect(() => {
    const rig = stateRef.current.enemyRig;
    if (rig) rig.setTransformed(enemyTransformed);
  }, [enemyTransformed]);

  // ---------- 気弾・必殺技の発射 ----------
  useEffect(() => {
    if (!shot || !shot.key) return;
    const S = stateRef.current;
    if (!S.scene) return;
    spawnShot(S, shot);
  }, [shot && shot.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // サイズ未指定のときは、親（position:relative）を絶対配置で埋めます。
  // height:"100%" はフレックスアイテム上だと解決されず潰れることがあるため、
  // 絶対配置にして確実に親いっぱいへ広げています。
  const fill = !width && !height;
  return (
    <div
      ref={mountRef}
      style={
        fill
          ? {
              position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
              // 高さを制限した分の余白は上に出し、キャラは地面側（下）に揃える
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              lineHeight: 0,
            }
          : { width, height, lineHeight: 0 }
      }
    />
  );
}

// =============================================================
//  動画エフェクト（かめはめ波など）
// =============================================================
//  背景が黒い動画をそのまま加算合成で重ねます。
//  加算合成では黒＝加算されないので、黒背景が自然に透けます。
//  （アルファ付き動画でなくてもエフェクトとして使えます）
// =============================================================
const videoCache = new Map(); // url -> HTMLVideoElement

/** 動画を用意します。使い回すので毎回ダウンロードしません */
function getVideo(url) {
  let v = videoCache.get(url);
  if (!v) {
    v = document.createElement("video");
    v.src = url;
    v.muted = true;          // 自動再生できるように必ず消音
    v.defaultMuted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.load();
    videoCache.set(url, v);
  }
  return v;
}

/** 先読み（対戦開始時に呼びます） */
export function preloadShotVideo(url) {
  if (url) getVideo(url);
}

// 動画の黒背景を「明るさ」で抜くマテリアル。
//
// canvasは背景画像を透かすため透過設定にしています。
// この状態で加算合成だけに頼ると、色は足されなくてもアルファが
// 書き込まれてしまい、板の四角がまるごと黒く見えてしまいます。
// そこで明るさから透明度を作り、暗い画素は discard で完全に捨てます
// （何も書き込まないのでアルファも残りません）。
// あわせて浮いている黒の分を引いて、暗部が灰色に濁らないようにします。
const VIDEO_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const VIDEO_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uKeyLow;   // これ以下の明るさは完全に透明
uniform float uKeyHigh;  // これ以上の明るさは完全に不透明
uniform float uOpacity;
uniform float uBoost;    // 明るさの強調

void main() {
  vec3 c = texture2D(uMap, vUv).rgb;
  float lum = max(max(c.r, c.g), c.b);

  float a = smoothstep(uKeyLow, uKeyHigh, lum);
  if (a <= 0.001) discard;

  // 浮いている黒の分を引いて伸ばす（暗部が灰色にならないように）
  vec3 rgb = max(c - vec3(uKeyLow), vec3(0.0)) / max(1.0 - uKeyLow, 0.001);

  gl_FragColor = vec4(rgb * uBoost, a * uOpacity);
}
`;

function makeVideoMaterial(THREE, tex, spec) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      // 実測: 背景の黒は 0〜3/255。ただし輝度16〜64の薄暗い青の靄が
      // 全体の約25%あるため、それも光としてだけ足す（下記のブレンド設定）。
      uKeyLow: { value: spec.videoKeyLow != null ? spec.videoKeyLow : 0.05 },
      uKeyHigh: { value: spec.videoKeyHigh != null ? spec.videoKeyHigh : 0.22 },
      uOpacity: { value: 1 },
      uBoost: { value: spec.videoBoost != null ? spec.videoBoost : 1.0 },
    },
    vertexShader: VIDEO_VERT,
    fragmentShader: VIDEO_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // canvas は alpha:true（背景画像はCSS側）なので、通常の AdditiveBlending だと
  // RGBだけでなくアルファまで加算され、暗い所でも canvas が不透明になって
  // 背景を覆い隠す＝「黒い背景が残る」状態になる。
  // そこでRGBのみ加算し、アルファは書き換えない合成にする。
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.SrcAlphaFactor;
  mat.blendDst = THREE.OneFactor;
  mat.blendEquationAlpha = THREE.AddEquation;
  mat.blendSrcAlpha = THREE.ZeroFactor;
  mat.blendDstAlpha = THREE.OneFactor;
  return mat;
}

function spawnVideoShot(S, shot, spec, place) {
  const THREE = S.THREE;
  const video = getVideo(spec.video);

  const tex = new THREE.VideoTexture(video);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  // 大きさは「2人の間の距離」に合わせます。
  // 動画のビームは左端(約5%)から右端(約99%)まで伸びるので、
  // 少し広め(既定1.15倍)にするとちょうど相手まで届きます。
  const aspect = spec.videoAspect || 16 / 9;
  const span = 2 * (S.spread || SPREAD_WIDE);
  const width = span * (spec.videoSpan || 1.15);
  const height = width / aspect;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    makeVideoMaterial(THREE, tex, spec)
  );

  // 2人のちょうど真ん中に置きます（動画のビームがほぼ左右対称なため）
  const midX = (spec.videoOffsetX || 0) * (place.fromPlayer ? 1 : -1);
  mesh.position.set(midX, place.y + (spec.videoOffsetY || 0), 0.15);
  if (!place.fromPlayer) mesh.scale.x = -1; // 敵が撃つときは左右反転

  S.scene.add(mesh);

  // 最初から再生
  try { video.currentTime = 0; } catch (e) { /* 読み込み前は無視 */ }
  const p = video.play();
  if (p && p.catch) p.catch(() => { /* 自動再生できなくても進行は止めません */ });

  S.shots.push({
    isVideo: true,
    group: mesh,
    texture: tex,
    from: shot.from,
    kind: shot.kind,
    life: 0,
    // 実際の動画の長さを優先します（読めない場合は設定値）
    duration: (isFinite(video.duration) && video.duration > 0) ? video.duration : (spec.videoDuration || 2.2),
    hit: false,
  });
}

// =============================================================
//  弾（気弾 / 必殺技）
// =============================================================
function spawnShot(S, shot) {
  const THREE = S.THREE;
  const fromPlayer = shot.from === "player";
  const cardId = fromPlayer ? S.playerRig.cardId : S.enemyRig.cardId;
  const cfg = getCharacter(cardId);
  const spec = shot.kind === "ultimate" ? cfg.ultimate : cfg.kiBlast;
  if (!spec || spec.effect === "none") {
    if (shot.onDone) shot.onDone();
    return;
  }

  const color = new THREE.Color(spec.color || "#ffffff");
  const scale = spec.scale || 0.3;
  // 立ち位置は画面比率で変わるので、その時の値を使います
  const spread = S.spread || SPREAD_WIDE;
  const startX = fromPlayer ? -spread + 0.35 : spread - 0.35;
  const endX = fromPlayer ? spread - 0.3 : -spread + 0.3;
  // 発射位置の高さはキャラの大きさに合わせます（胸のあたり）
  const charScale = (S.playerRig && S.playerRig.root.scale.x) || 1;
  const y = 0.8 * charScale;

  // 動画エフェクトが指定されていればそちらを使います
  if (spec.video) {
    spawnVideoShot(S, shot, spec, { fromPlayer, startX, endX, y, charScale });
    return;
  }

  const group = new THREE.Group();
  let mesh;

  if (spec.effect === "beam") {
    // ビーム：発射元から相手までを1本の筒で結び、太さが伸びる
    const geo = new THREE.CylinderGeometry(scale * 0.35, scale * 0.35, 1, 16, 1, true);
    geo.rotateZ(Math.PI / 2); // X軸方向へ
    mesh = new THREE.Mesh(geo, glowMaterial(THREE, color, 0.85));
    group.add(mesh);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(scale * 0.5, 16, 12),
      glowMaterial(THREE, new THREE.Color(0xffffff), 0.95)
    );
    group.add(core);
    group.userData.core = core;
  } else if (spec.effect === "disc") {
    mesh = new THREE.Mesh(
      new THREE.TorusGeometry(scale, scale * 0.28, 10, 24),
      glowMaterial(THREE, color, 0.9)
    );
    mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
  } else {
    // sphere（既定）：光る球 + 外殻
    mesh = new THREE.Mesh(new THREE.SphereGeometry(scale, 20, 16), glowMaterial(THREE, color, 0.95));
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(scale * 1.7, 20, 16),
      glowMaterial(THREE, color, 0.28)
    );
    group.add(mesh, halo);
  }

  group.position.set(startX, y, 0);
  S.scene.add(group);

  S.shots.push({
    group,
    kind: shot.kind,
    effect: spec.effect || "sphere",
    from: shot.from,
    startX,
    endX,
    y,
    speed: spec.speed || 6,
    t: 0,
    life: 0,
  });
}

function glowMaterial(THREE, color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function updateShots(S, dt, onShotHit) {
  if (!S.shots || S.shots.length === 0) return;
  const remain = [];

  for (const s of S.shots) {
    s.life += dt;

    // --- 動画エフェクトは再生し終わるまで出しっぱなし ---
    if (s.isVideo) {
      if (!s.hit && s.life >= s.duration * 0.45) {
        s.hit = true;
        if (onShotHit) onShotHit({ from: s.from, kind: s.kind });
      }
      // 終わり際はふわっと消します（ShaderMaterialなのでuniformで指定）
      const left = s.duration - s.life;
      if (left < 0.35) s.group.material.uniforms.uOpacity.value = Math.max(0, left / 0.35);
      if (s.life >= s.duration) {
        S.scene.remove(s.group);
        s.group.geometry.dispose();
        s.group.material.dispose();
        if (s.texture) s.texture.dispose();
        continue;
      }
      remain.push(s);
      continue;
    }

    const dist = Math.abs(s.endX - s.startX);
    s.t += (dt * s.speed) / Math.max(dist, 0.001);

    if (s.effect === "beam") {
      // ビームは発射元から先端まで伸びる
      const head = s.startX + (s.endX - s.startX) * Math.min(s.t, 1);
      const len = Math.abs(head - s.startX);
      const body = s.group.children[0];
      body.scale.x = Math.max(len, 0.001);
      body.position.x = (head - s.startX) / 2;
      if (s.group.userData.core) s.group.userData.core.position.x = head - s.startX;
      s.group.position.x = s.startX;
    } else {
      s.group.position.x = s.startX + (s.endX - s.startX) * Math.min(s.t, 1);
      s.group.rotation.z += dt * 6;
    }

    if (s.t >= 1) {
      if (!s.hit) {
        s.hit = true;
        if (onShotHit) onShotHit({ from: s.from, kind: s.kind });
      }
      // 着弾後は少しだけ光って消える
      s.fade = (s.fade || 0) + dt * 3;
      s.group.traverse((o) => {
        if (o.isMesh && o.material) o.material.opacity = Math.max(0, o.material.opacity - dt * 3);
      });
      if (s.fade > 1) {
        S.scene.remove(s.group);
        s.group.traverse((o) => {
          if (o.isMesh) {
            o.geometry && o.geometry.dispose();
            o.material && o.material.dispose && o.material.dispose();
          }
        });
        continue;
      }
    }
    remain.push(s);
  }
  S.shots = remain;
}
