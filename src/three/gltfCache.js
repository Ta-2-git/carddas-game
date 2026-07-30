// =============================================================
//  モデル読み込みユーティリティ（GLB / FBX 両対応）
// =============================================================
//  同じURLを何度も読み込まないようにキャッシュします。
//  ・アニメーションクリップは再利用しても安全なので共有します
//  ・素体モデル本体はキャラごとに別インスタンスが必要なので、
//    毎回読み直します（HTTPキャッシュが効くので通信は1回だけです）
//  ・拡張子が .fbx なら THREE.FBXLoader、それ以外は THREE.GLTFLoader を使います
// =============================================================

const clipCache = new Map(); // url -> Promise<AnimationClip[]>

function isFBX(url) {
  return /\.fbx(\?|$)/i.test(url);
}

function getGLTFLoader() {
  const THREE = window.THREE;
  if (!THREE || !THREE.GLTFLoader) return null;
  return new THREE.GLTFLoader();
}

function getFBXLoader() {
  const THREE = window.THREE;
  if (!THREE || !THREE.FBXLoader) return null;
  return new THREE.FBXLoader();
}

// -------------------------------------------------------------
//  FBXモーションを素体（GLB）の骨へ移すときの向き補正
// -------------------------------------------------------------
//  BlenderからZ-upのまま書き出したFBXは、キャラを立たせるための回転が
//  アーマチュア（ボーンの親グループ）側に入っています。
//  例: Armature001.quaternion = (-0.7071, 0, 0, 0.7071) = X軸 -90度
//
//  アニメーションだけを取り出して素体の骨に流し込むと、この親側の回転が
//  抜け落ちるため、キャラが前のめりに倒れた状態で再生されます
//  （近接攻撃が地面に向かって出ているように見えるのはこれが原因）。
//
//  そこで、親グループの回転をルートボーン(Hips)のトラックへ焼き込みます。
//  ・position … 回転を掛けて座標系を合わせる
//  ・quaternion… 回転を「前から」掛ける（合成）。
//    ここで R*q*R⁻¹ のような共役変換にすると回転角が変わらないため、
//    倒れたままになるので注意。
// -------------------------------------------------------------
const FBX_ROOT_BONE = "Hips";

/** ルートボーンの親（アーマチュア）のワールド回転を取り出します */
function getArmatureQuaternion(object) {
  const THREE = window.THREE;
  const q = new THREE.Quaternion();
  let rootBone = null;
  object.traverse((o) => { if (!rootBone && o.isBone && o.name === FBX_ROOT_BONE) rootBone = o; });
  if (!rootBone || !rootBone.parent) return q;
  object.updateMatrixWorld(true);
  rootBone.parent.getWorldQuaternion(q);
  return q;
}

function bakeArmatureRotation(clip, R) {
  const THREE = window.THREE;
  if (!THREE) return clip;
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();

  for (const track of clip.tracks) {
    if (track.name === `${FBX_ROOT_BONE}.position`) {
      for (let i = 0; i < track.times.length; i++) {
        const o = i * 3;
        v.set(track.values[o], track.values[o + 1], track.values[o + 2]).applyQuaternion(R);
        track.values[o] = v.x; track.values[o + 1] = v.y; track.values[o + 2] = v.z;
      }
    } else if (track.name === `${FBX_ROOT_BONE}.quaternion`) {
      for (let i = 0; i < track.times.length; i++) {
        const o = i * 4;
        q.set(track.values[o], track.values[o + 1], track.values[o + 2], track.values[o + 3]);
        const qn = R.clone().multiply(q);
        track.values[o] = qn.x; track.values[o + 1] = qn.y; track.values[o + 2] = qn.z; track.values[o + 3] = qn.w;
      }
    }
  }
  return clip;
}

/** GLB/FBX を読み込んで { scene, animations } を返します（キャッシュなし） */
export function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error("URLが空です")); return; }

    if (isFBX(url)) {
      const loader = getFBXLoader();
      if (!loader) { reject(new Error("THREE.FBXLoader が読み込まれていません")); return; }
      loader.load(url, (object) => {
        const R = getArmatureQuaternion(object);
        (object.animations || []).forEach((clip) => bakeArmatureRotation(clip, R));
        resolve({ scene: object, animations: object.animations || [] });
      }, undefined, reject);
      return;
    }

    const loader = getGLTFLoader();
    if (!loader) { reject(new Error("THREE.GLTFLoader が読み込まれていません")); return; }
    loader.load(url, resolve, undefined, reject);
  });
}

/**
 * GLB/FBX からアニメーションクリップだけを取り出します（キャッシュあり）。
 * クリップは書き換えないので、複数キャラで共有しても問題ありません。
 */
export function loadClips(url) {
  if (!url) return Promise.resolve([]);
  if (clipCache.has(url)) return clipCache.get(url);

  const p = loadGLTF(url)
    .then((gltf) => gltf.animations || [])
    .catch((err) => {
      console.warn("[gltfCache] 読み込み失敗:", url, err);
      clipCache.delete(url); // 失敗は覚えない（次回リトライできる）
      return [];
    });

  clipCache.set(url, p);
  return p;
}

/** 名前でクリップを選びます。名前未指定なら最初のクリップ */
export function pickClip(clips, name) {
  if (!clips || clips.length === 0) return null;
  if (!name) return clips[0];
  return clips.find((c) => c.name === name) || clips[0];
}
