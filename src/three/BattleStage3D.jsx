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

const CHAR_SCALE = 1.6; // 二回り大きく表示する倍率

// ---- 画面比率への最適化 ----------------------------------------
//  スマホ（縦長）とPC（横長）で使える形が大きく違うため、
//   1) canvasが縦長になりすぎないように高さを制限する
//   2) 横幅が足りない時は2人の間隔を詰める
//   3) 必要な表示範囲からカメラ距離を逆算する
//  の3段構えで、どちらでも見切れず・小さくなりすぎないようにします。
const FOV_Y = 38;
const MIN_ASPECT = 1.1;    // これより縦長のcanvasにはしない
const SPREAD_WIDE = 1.7;   // 横に余裕がある時の立ち位置（±）
const SPREAD_NARROW = 1.05; // 縦長画面で詰めた時の立ち位置（±）
const HALF_W_MARGIN = 0.8;  // 立ち位置に足す体の幅＋余白
const FIT_HALF_H = 1.15;    // 上下に必要な半高
const FIT_CENTER_Y = 1.05;

/** 画面比率から2人の立ち位置（中心からの距離）を決めます */
function spreadFor(aspect) {
  const t = Math.min(1, Math.max(0, (aspect - 0.9) / (1.8 - 0.9)));
  return SPREAD_NARROW + (SPREAD_WIDE - SPREAD_NARROW) * t;
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
  S.spread = spread;
  if (S.playerRig) S.playerRig.root.position.x = -spread;
  if (S.enemyRig) S.enemyRig.root.position.x = spread;
  S.renderer.setSize(w, h);
  frameCamera(S.camera, aspect, spread + HALF_W_MARGIN);
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
  width = null,         // 未指定なら親要素いっぱいに自動フィット（スマホ/PC両対応）
  height = null,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

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
    const playerRig = new CharacterRig({ cardId: playerCardId, isEnemy: false, facingYDeg: 90 });
    const enemyRig = new CharacterRig({ cardId: enemyCardId, isEnemy: true, facingYDeg: -90 });
    playerRig.root.scale.setScalar(CHAR_SCALE);
    enemyRig.root.scale.setScalar(CHAR_SCALE);
    scene.add(playerRig.root, enemyRig.root);
    playerRig.load();
    enemyRig.load();

    Object.assign(S, { THREE, renderer, scene, camera, playerRig, enemyRig, shots: [] });
    applyLayout(S, w0, h0); // 立ち位置とカメラを画面比率に合わせる

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
      applyLayout(S, w, h);
    };

    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      if (ro) ro.disconnect();
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
  const y = 1.05 * CHAR_SCALE; // キャラの拡大に合わせて発射位置も上げる

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
