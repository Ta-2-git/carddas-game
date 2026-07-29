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

/** GLB/FBX を読み込んで { scene, animations } を返します（キャッシュなし） */
export function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error("URLが空です")); return; }

    if (isFBX(url)) {
      const loader = getFBXLoader();
      if (!loader) { reject(new Error("THREE.FBXLoader が読み込まれていません")); return; }
      loader.load(url, (object) => resolve({ scene: object, animations: object.animations || [] }), undefined, reject);
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
