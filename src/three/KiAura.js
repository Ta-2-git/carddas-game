// =============================================================
//  KiAura — 気のオーラ（手続き型・GLB不要）
// =============================================================
//  ギザギザに立ち上る炎のようなオーラを、シェーダーで生成します。
//  ・中心は白く光り、外側にいくほどキャラごとの色になります
//  ・外形は角度方向のノイズでトゲトゲに揺らめきます
//  ・内側に稲妻がときどき走ります
//
//  色は createKiAura の color / boltColor で変えられます。
//  （キャラ設定は src/data/characters.js の aura を編集してください）
// =============================================================

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
precision mediump float;

varying vec2 vUv;

uniform float uTime;
uniform vec3  uColor;      // オーラ本体の色
uniform vec3  uBoltColor;  // 稲妻の色
uniform float uOpacity;    // 濃さ
uniform float uIntensity;  // レイヤーごとの強さ（前面の霞は弱く）
uniform float uBolts;      // 稲妻を出すか（0 or 1）

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),                hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// 横方向にうねる稲妻を1本描きます
float bolt(vec2 p, float t, float seed) {
  float wob = (fbm(vec2(p.x * 2.2 + seed * 7.0, t * 2.2 + seed)) - 0.5) * 0.7;
  float d = abs(p.y - wob);
  float c = smoothstep(0.028, 0.0, d);        // 芯
  float g = smoothstep(0.150, 0.0, d) * 0.25; // まわりの光
  float m = smoothstep(0.95, 0.30, abs(p.x)); // 左右の端はフェード
  return (c + g) * m;
}

// 稲妻の点滅
float flick(float t, float seed) {
  float k = floor(t * 6.0 + seed * 11.0);
  return step(0.5, hash(vec2(k, seed)));
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;

  // 上に長く伸びる炎のかたちにする
  vec2 q = p;
  q.y *= (q.y > 0.0) ? 0.70 : 1.18;

  float r   = length(q);
  float ang = atan(q.y, q.x);
  vec2  dir = vec2(cos(ang), sin(ang)); // 円周上を見るので継ぎ目が出ません
  float t   = uTime;

  // 角度方向のノイズでトゲトゲの外形をつくる
  float n1 = fbm(dir *  4.5 + vec2(0.0, t * 1.15));
  float n2 = fbm(dir * 12.0 - vec2(t * 1.60, 0.0));
  float spike = 0.62 * n1 + 0.38 * n2;
  float edge  = 0.30 + 0.80 * spike;

  // 外形の内側を塗る
  float fill = smoothstep(edge, edge * 0.30, r);

  // 放射状の筋を重ねる
  float streak = fbm(vec2(ang * 12.0, r * 3.5 - t * 2.2));
  fill *= 0.70 + 0.60 * streak;

  // 中心の光。ここを広げすぎると白飛びして色とトゲが見えなくなります
  float core = exp(-r * r * 8.0);

  float alpha = fill * 0.55 + core * 0.70;
  float white = clamp(pow(core, 0.85) * 0.95 + fill * 0.04, 0.0, 1.0);
  vec3  col   = mix(uColor, vec3(1.0), white);

  // 稲妻（オーラの内側だけ）
  float b = 0.0;
  b += bolt(p - vec2(0.0,  0.30), t, 1.0) * flick(t, 1.0);
  b += bolt(p - vec2(0.0, -0.10), t, 4.0) * flick(t, 4.0);
  b *= smoothstep(edge + 0.10, edge - 0.25, r) * uBolts;

  col   += uBoltColor * b * 1.3;
  alpha += b * 0.7;

  alpha = clamp(alpha, 0.0, 1.0) * uOpacity * uIntensity;
  if (alpha <= 0.002) discard;

  gl_FragColor = vec4(col, alpha);
}
`;

function makeMaterial(THREE, { color, boltColor, opacity, intensity, bolts }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: Math.random() * 10.0 }, // キャラごとに位相をずらす
      uColor: { value: new THREE.Color(color) },
      uBoltColor: { value: new THREE.Color(boltColor) },
      uOpacity: { value: opacity },
      uIntensity: { value: intensity },
      uBolts: { value: bolts },
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
 * 戻り値の Group は userData.tick(dt) で時間を進めてください。
 *
 * @param {object} THREE  window.THREE
 * @param {object} opts   { color, boltColor, opacity, width, height, centerY }
 */
export function createKiAura(THREE, opts = {}) {
  const color = opts.color || "#ffcc11";
  const boltColor = opts.boltColor || "#8fe4ff";
  const opacity = opts.opacity != null ? opts.opacity : 0.9;
  const width = opts.width || 2.2;
  const height = opts.height || 2.6;
  const centerY = opts.centerY != null ? opts.centerY : 0.95;

  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(width, height);
  const materials = [];

  // 後ろ側：オーラ本体。キャラの背後に置くのでキャラが手前に立って見えます
  const backMat = makeMaterial(THREE, { color, boltColor, opacity, intensity: 1.0, bolts: 1.0 });
  const back = new THREE.Mesh(geo, backMat);
  back.position.set(0, centerY, -0.28);
  materials.push(backMat);

  // 手前側：薄い霞。キャラの上に光が乗って包まれて見えます
  const frontMat = makeMaterial(THREE, { color, boltColor, opacity, intensity: 0.28, bolts: 1.0 });
  const front = new THREE.Mesh(geo, frontMat);
  front.position.set(0, centerY, 0.30);
  materials.push(frontMat);

  group.add(back, front);

  group.userData.tick = (dt) => {
    for (const m of materials) m.uniforms.uTime.value += dt;
  };

  return group;
}
