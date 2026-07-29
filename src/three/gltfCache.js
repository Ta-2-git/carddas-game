// =============================================================
//  GLB 読み込みユーティリティ
// =============================================================
//  同じURLを何度も読み込まないようにキャッシュします。
//  ・アニメーションクリップは再利用しても安全なので共有します
//  ・素体モデル本体はキャラごとに別インスタンスが必要なので、
//    毎回読み直します（HTTPキャッシュが効くので通信は1回だけです）
// =============================================================

const clipCache = new Map(); // url -> Promise<AnimationClip[]>

function getLoader() {
  const THREE = window.THREE;
  if (!THREE || !THREE.GLTFLoader) return null;
  return new THREE.GLTFLoader();
}

/** GLB を読み込んで gltf オブジェクトを返します（キャッシュなし） */
export function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error("URLが空です")); return; }
    const loader = getLoader();
    if (!loader) { reject(new Error("THREE.GLTFLoader が読み込まれていません")); return; }
    loader.load(url, resolve, undefined, reject);
  });
}

/**
 * GLB からアニメーションクリップだけを取り出します（キャッシュあり）。
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
