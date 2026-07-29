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

const PLAYER_X = -1.15;
const ENEMY_X = 1.15;

export default function BattleStage3D({
  playerCardId,
  enemyCardId,
  playerAnim = "idle",
  enemyAnim = "idle",
  playerTransformed = false,
  enemyTransformed = false,
  shot = null,          // { key, from: "player"|"enemy", kind: "kiBlast"|"ultimate" }
  onShotHit = null,     // 着弾時に呼ばれます
  width = 360,
  height = 240,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  // ---------- 初期化（1回だけ） ----------
  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE || !mountRef.current) return;
    const S = stateRef.current;
    let cancelled = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.35, 4.6);
    camera.lookAt(0, 0.85, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    const playerRig = new CharacterRig({ cardId: playerCardId, isEnemy: false });
    const enemyRig = new CharacterRig({ cardId: enemyCardId, isEnemy: true });
    playerRig.root.position.x = PLAYER_X;
    enemyRig.root.position.x = ENEMY_X;
    scene.add(playerRig.root, enemyRig.root);
    playerRig.load();
    enemyRig.load();

    Object.assign(S, { THREE, renderer, scene, camera, playerRig, enemyRig, shots: [] });

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
  }, [playerCardId, enemyCardId, width, height]);

  // ---------- モーション切り替え ----------
  useEffect(() => {
    const rig = stateRef.current.playerRig;
    if (rig) rig.play(normalizeMotion(playerAnim));
  }, [playerAnim]);

  useEffect(() => {
    const rig = stateRef.current.enemyRig;
    if (rig) rig.play(normalizeMotion(enemyAnim));
  }, [enemyAnim]);

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

  return <div ref={mountRef} style={{ width, height }} />;
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
  const startX = fromPlayer ? PLAYER_X + 0.35 : ENEMY_X - 0.35;
  const endX = fromPlayer ? ENEMY_X - 0.3 : PLAYER_X + 0.3;
  const y = 1.05;

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
