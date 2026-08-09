// =============================================================
//  CharacterModel3D — キャラ1体だけを表示する用
// =============================================================
//  カード一覧やガチャ演出など、相手がいない場面で使います。
//  対戦画面では BattleStage3D を使ってください（弾が飛ぶ表現のため）。
// =============================================================

import { useEffect, useRef } from "react";
import CharacterRig from "./CharacterRig";
import { getCharacter, normalizeMotion } from "../data/characters";

export default function CharacterModel3D({
  cardId,
  animState = "idle",
  isEnemy = false,
  transformed = false,
  size = 110,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE || !mountRef.current) return;
    const cfg = getCharacter(cardId);
    if (!cfg.model) return;

    const S = stateRef.current;
    let cancelled = false;
    const w = size, h = size * 1.4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = cfg.camera || {};
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);

    // 単体表示は、キャラの上下に余白が出すぎて小さく見えていました。
    // 全身がぎりぎり収まるところまでカメラを寄せます。
    //   ・縦に見える範囲を VIEW_H に固定し、そこから距離を逆算します
    //   ・一番背の高い悟空（足元0〜頭1.70）でも収まるよう 1.90 にしています
    //     （ゴテンクスなど小柄なキャラは約1.25なので余裕があります）
    //   ・目線の高さは体の中心（VIEW_Hの半分あたり）に合わせます
    // characters.js の cameraZ / cameraY はここでは使いません。
    // あちらは対戦画面（BattleStage3D）用の値です。
    const VIEW_H = 1.90;
    const centerY = 0.90;                       // 足元(y=0)の下に0.05だけ余白が残ります
    const dist = (VIEW_H / 2) / Math.tan((45 * Math.PI) / 180 / 2);
    camera.position.set(isEnemy ? -0.3 : 0.3, centerY, dist);
    camera.lookAt(0, centerY, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    // 単体表示（カード紹介・ステータス表示・VS画面）では、敵でも
    // こちらを向かせます。isEnemy をそのまま渡すと180度回って後ろ姿に
    // なるため、facingYDeg で自キャラと同じ向きに固定します。
    // （対戦画面は BattleStage3D 側が向かい合う向きを指定します）
    const rig = new CharacterRig({ cardId, isEnemy, facingYDeg: cam.rotationY || 0 });
    scene.add(rig.root);
    rig.load();

    Object.assign(S, { renderer, scene, camera, rig });

    const clock = new THREE.Clock();
    const tick = () => {
      if (cancelled) return;
      S.raf = requestAnimationFrame(tick);
      rig.update(Math.min(clock.getDelta(), 0.05));
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(S.raf);
      rig.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      stateRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, isEnemy, size]);

  useEffect(() => {
    const rig = stateRef.current.rig;
    if (rig) rig.play(normalizeMotion(animState));
  }, [animState]);

  useEffect(() => {
    const rig = stateRef.current.rig;
    if (rig) rig.setTransformed(transformed);
  }, [transformed]);

  return <div ref={mountRef} style={{ width: size, height: size * 1.4, display: "inline-block" }} />;
}
