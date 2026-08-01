// =============================================================
//  KiAura — 気のオーラ（連番PNG素材のスプライトシート再生）
// =============================================================
//  素材: sozai_0146_dragonball_aura
//    public/aura_sheet.png    … オーラ 39コマ（8列×5行）
//    public/thunder_sheet.png … 稲妻 55コマ（8列×7行）
//  ※ 連番PNGをタイル状に1枚へまとめたものです（scratchpadのbuild_sheet.pyで生成）
//
//  素材の色は黄色ですが、明るさと「白っぽさ」を取り出して
//  キャラごとの色に塗り替えています。
//    ・白く光っている中心はそのまま白く残る
//    ・黄色い部分が指定色になる
//  色は characters.js の aura.color / boltColor で指定します。
// =============================================================

const AURA_SHEET = { url: "/aura_sheet.png", cols: 8, rows: 5, frames: 39, aspect: 192 / 202 };
const THUNDER_SHEET = { url: "/thunder_sheet.png", cols: 8, rows: 7, frames: 55, aspect: 144 / 185 };

const FPS = 30; // 素材の再生速度

const texCache = new Map();

function getTexture(THREE, url) {
  if (texCache.has(url)) return texCache.get(url);
  const tex = new THREE.TextureLoader().load(url);
  // タイル同士がにじまないようミップマップは使いません
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  texCache.set(url, tex);
  return tex;
}

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// スプライトシートから今のコマを取り出し、色を塗り替えます
const FRAG = `
precision mediump float;

varying vec2 vUv;

uniform sampler2D uMap;
uniform vec2  uGrid;      // (列数, 行数)
uniform float uFrame;     // 今のコマ番号
uniform vec3  uColor;     // キャラごとの色
uniform float uOpacity;
uniform float uIntensity;

void main() {
  float col = mod(uFrame, uGrid.x);
  float row = floor(uFrame / uGrid.x);

  // タイルの端で隣のコマを拾わないよう、ほんの少し内側を使います
  vec2 cell = vec2(1.0) / uGrid;
  vec2 inset = cell * 0.002;
  vec2 uv = (vUv * (cell - inset * 2.0)) + inset
          + vec2(col * cell.x, (uGrid.y - 1.0 - row) * cell.y);

  vec4 t = texture2D(uMap, uv);
  if (t.a <= 0.003) discard;

  // 明るさ（発光量）と、白っぽさ（黄色=0 / 白=1）に分解する
  float lum   = max(max(t.r, t.g), t.b);
  float white = clamp(t.b / max(max(t.r, t.g), 0.001), 0.0, 1.0);

  vec3 c = mix(uColor, vec3(1.0), white) * lum;
  float a = t.a * uOpacity * uIntensity;

  gl_FragColor = vec4(c, a);
}
`;

function makeMaterial(THREE, sheet, { color, opacity, intensity }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: getTexture(THREE, sheet.url) },
      uGrid: { value: new THREE.Vector2(sheet.cols, sheet.rows) },
      uFrame: { value: Math.floor(Math.random() * sheet.frames) }, // 位相をずらす
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uIntensity: { value: intensity },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * 気のオーラを作ります。
 * 戻り値の Group は userData.tick(dt) で毎フレーム進めてください。
 *
 * @param {object} THREE  window.THREE
 * @param {object} opts   { color, boltColor, opacity, thunder, height, centerY }
 */
export function createKiAura(THREE, opts = {}) {
  const color = opts.color || "#ffcc11";
  const boltColor = opts.boltColor || color;
  const opacity = opts.opacity != null ? opts.opacity : 0.95;
  const height = opts.height || 1.7;
  const centerY = opts.centerY != null ? opts.centerY : 0.78;
  const width = height * AURA_SHEET.aspect;

  const group = new THREE.Group();
  const layers = []; // { material, sheet, time }

  const addLayer = (sheet, w, h, z, mat) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(0, centerY, z);
    group.add(mesh);
    layers.push({ material: mat, sheet, time: Math.random() * 2 });
  };

  // 背面：オーラ本体（キャラの後ろに置くのでキャラが手前に立って見えます）
  addLayer(AURA_SHEET, width, height, -0.30,
    makeMaterial(THREE, AURA_SHEET, { color, opacity, intensity: 1.0 }));

  // 前面：薄い霞（キャラの上に光が乗り、包まれて見えます）
  addLayer(AURA_SHEET, width, height, 0.32,
    makeMaterial(THREE, AURA_SHEET, { color, opacity, intensity: 0.30 }));

  // 稲妻（任意）
  if (opts.thunder) {
    const th = height * 0.92;
    addLayer(THUNDER_SHEET, th * THUNDER_SHEET.aspect, th, 0.36,
      makeMaterial(THREE, THUNDER_SHEET, { color: boltColor, opacity, intensity: 0.85 }));
  }

  group.userData.tick = (dt) => {
    for (const L of layers) {
      L.time += dt;
      L.material.uniforms.uFrame.value = Math.floor(L.time * FPS) % L.sheet.frames;
    }
  };

  return group;
}
