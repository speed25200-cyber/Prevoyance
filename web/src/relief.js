// @ts-check
/**
 * Le relief de prévoyance : une montagne en courbes de niveau, calculée en direct (WebGL, sans bibliothèque).
 *
 * L'altitude est un revenu annuel. Du pied au sommet, les trois étages sont les trois piliers (AVS, caisse de
 * pension, épargne privée) ; l'anneau en pointillé, à l'altitude du besoin, dit où il faudrait arriver. Le sommet
 * sous l'anneau : il reste un dénivelé à gravir — c'est la lacune. Les chiffres viennent du moteur, jamais d'ici.
 *
 * Le dessin : un maillage fixe (la forme du massif, calculée une fois), dont la hauteur et les courbes suivent les
 * montants. Les faces sont pleines, à la couleur du papier : ce qui est derrière la crête est caché, comme sur un
 * vrai relief. La lumière vient du nord-ouest, la convention des cartes nationales.
 *
 * Sans WebGL : `creerRelief` rend `null` et la page garde sa version sans relief. En mouvement réduit, ou figé pour
 * une capture : une image, redessinée seulement quand les chiffres ou la vue changent.
 */

const ETENDUE = 1.24;     // demi-côté du maillage du massif, en unités de scène
const SOL = 2.7;          // demi-côté du sol (la carte autour du massif)
const HAUT = 1.02;        // hauteur, en unités de scène, du plus haut des deux : le sommet ou le besoin
const TOUR = Math.PI * 2;
// Points dessinés au plus par image. Mesuré sur une carte intégrée modeste (Intel UHD 630) : 1,3 million de points se
// dessinent en 9 ms, 5 millions (plein écran à densité 2) en 17 à 23 ms — trop pour 60 images par seconde.
const BUDGET = 2.4e6;
const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------------------------------------ la forme du massif
function hasard(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function bruit(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hasard(i, j), b = hasard(i + 1, j), c = hasard(i, j + 1), d = hasard(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Arêtes et couloirs : un bruit « à crêtes », de 0 à 1 environ. */
function aretes(x, y) {
  let somme = 0, poids = 0.5, pas = 1;
  for (let o = 0; o < 4; o++) {
    const n = 1 - Math.abs(2 * bruit(x * pas + 17.3 * o, y * pas - 9.1 * o) - 1);
    somme += poids * n * n; poids *= 0.5; pas *= 2.03;
  }
  return somme;
}
// Quatre arêtes partent du sommet (direction, longueur, finesse) : la pyramide d'un grand sommet alpin.
const ARETES = [[0.55, 1, 0.15], [2.25, 0.84, 0.19], [3.8, 1, 0.13], [5.2, 0.66, 0.2], [6.0, 0.5, 0.1]];
/** Hauteur du massif au point (x, z), avant mise à l'échelle : une pointe, quatre arêtes, un avant-sommet, un pied plat. */
function forme(x, z) {
  const wx = x + 0.2 * (bruit(x * 1.15 + 4.2, z * 1.15) - 0.5) + 0.05 * (bruit(x * 4.1, z * 4.1 + 2.3) - 0.5);
  const wz = z + 0.2 * (bruit(x * 1.15, z * 1.15 + 8.7) - 0.5) + 0.05 * (bruit(x * 4.1 + 6.1, z * 4.1) - 0.5);
  const d = Math.hypot(wx, wz);
  // les arêtes ne filent pas droit : elles s'incurvent en descendant
  const angle = (Math.atan2(wz, wx) + 0.42 * d * Math.sin(d * 3.3 + 1.2) + 2 * TOUR) % TOUR;
  let arete = 0;
  for (const [direction, longueur, finesse] of ARETES) {
    let ecart = Math.abs(angle - direction);
    if (ecart > Math.PI) ecart = TOUR - ecart;
    arete = Math.max(arete, longueur * Math.exp(-(ecart * ecart) / finesse));
  }
  let h = Math.exp(-Math.pow(d / (0.19 + 0.31 * arete), 1.12));
  h += 0.2 * Math.exp(-Math.pow(Math.hypot(wx + 0.3, wz - 0.38) / 0.2, 1.7));                 // l'avant-sommet, une épaule sur l'arête
  h *= 0.78 + 0.4 * aretes(wx * 1.7 + 3, wz * 1.7 + 1);
  h *= 1 - lisse(0.82, 1.14, Math.hypot(x, z));
  return Math.max(0, h - 0.022);
}

/** Le maillage : n × n points, chacun avec sa position au sol, sa hauteur (0 à 1) et sa pente. */
function maillage(n) {
  const hauteurs = new Float32Array(n * n), pas = (2 * ETENDUE) / (n - 1);
  let max = 0, sommet = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const h = forme(-ETENDUE + i * pas, -ETENDUE + j * pas);
    hauteurs[j * n + i] = h;
    if (h > max) { max = h; sommet = j * n + i; }
  }
  for (let k = 0; k < hauteurs.length; k++) hauteurs[k] /= max;
  const points = new Float32Array(n * n * 5);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, g = hauteurs[j * n + Math.max(0, i - 1)], d = hauteurs[j * n + Math.min(n - 1, i + 1)];
    const b = hauteurs[Math.max(0, j - 1) * n + i], t = hauteurs[Math.min(n - 1, j + 1) * n + i];
    points.set([-ETENDUE + i * pas, -ETENDUE + j * pas, hauteurs[k], (d - g) / (2 * pas), (t - b) / (2 * pas)], k * 5);
  }
  const faces = new Uint16Array((n - 1) * (n - 1) * 6);
  let f = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    faces[f++] = a; faces[f++] = c; faces[f++] = b; faces[f++] = b; faces[f++] = c; faces[f++] = d;
  }
  return { n, pas, hauteurs, points, faces, sommet: [-ETENDUE + (sommet % n) * pas, -ETENDUE + Math.floor(sommet / n) * pas] };
}

// ------------------------------------------------------------------------------------------------ matrices (colonnes d'abord)
function perspective(angle, rapport, pres, loin) {
  const f = 1 / Math.tan(angle / 2), d = 1 / (pres - loin);
  return [f / rapport, 0, 0, 0, 0, f, 0, 0, 0, 0, (loin + pres) * d, -1, 0, 0, 2 * loin * pres * d, 0];
}
function regard(oeil, cible, haut) {
  const norme = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const point = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = norme([oeil[0] - cible[0], oeil[1] - cible[1], oeil[2] - cible[2]]), x = norme(croix(haut, z)), y = croix(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -point(x, oeil), -point(y, oeil), -point(z, oeil), 1];
}
function produit(a, b) {
  const m = new Array(16);
  for (let c = 0; c < 4; c++) for (let l = 0; l < 4; l++) m[c * 4 + l] = a[l] * b[c * 4] + a[4 + l] * b[c * 4 + 1] + a[8 + l] * b[c * 4 + 2] + a[12 + l] * b[c * 4 + 3];
  return m;
}
function inverse(m) {
  const r = new Array(16), [a, b, c, d, e, f, g, h, i, j, k, l, n, o, p, q] = m;
  r[0] = f * k * q - f * l * p - j * g * q + j * h * p + o * g * l - o * h * k;
  r[4] = -e * k * q + e * l * p + i * g * q - i * h * p - n * g * l + n * h * k;
  r[8] = e * j * q - e * l * o - i * f * q + i * h * o + n * f * l - n * h * j;
  r[12] = -e * j * p + e * k * o + i * f * p - i * g * o - n * f * k + n * g * j;
  r[1] = -b * k * q + b * l * p + j * c * q - j * d * p - o * c * l + o * d * k;
  r[5] = a * k * q - a * l * p - i * c * q + i * d * p + n * c * l - n * d * k;
  r[9] = -a * j * q + a * l * o + i * b * q - i * d * o - n * b * l + n * d * j;
  r[13] = a * j * p - a * k * o - i * b * p + i * c * o + n * b * k - n * c * j;
  r[2] = b * g * q - b * h * p - f * c * q + f * d * p + o * c * h - o * d * g;
  r[6] = -a * g * q + a * h * p + e * c * q - e * d * p - n * c * h + n * d * g;
  r[10] = a * f * q - a * h * o - e * b * q + e * d * o + n * b * h - n * d * f;
  r[14] = -a * f * p + a * g * o + e * b * p - e * c * o - n * b * g + n * c * f;
  r[3] = -b * g * l + b * h * k + f * c * l - f * d * k - j * c * h + j * d * g;
  r[7] = a * g * l - a * h * k - e * c * l + e * d * k + i * c * h - i * d * g;
  r[11] = -a * f * l + a * h * j + e * b * l - e * d * j - i * b * h + i * d * f;
  r[15] = a * f * k - a * g * j - e * b * k + e * c * j + i * b * g - i * c * f;
  const det = a * r[0] + b * r[4] + c * r[8] + d * r[12];
  if (!det) return null;
  for (let x = 0; x < 16; x++) r[x] /= det;
  return r;
}
const applique = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];

// ------------------------------------------------------------------------------------------------ programmes
const SOMMETS_MASSIF = `
attribute vec2 aP;
attribute vec3 aU;
uniform mat4 uM;
uniform vec2 uD;
uniform float uHaut;
varying float vU;
varying vec3 vN;
varying vec3 vP;
void main() {
  vU = aU.x;
  vP = vec3(aP.x, aU.x * uHaut, aP.y);
  vN = vec3(-aU.y * uHaut, 1., -aU.z * uHaut);
  gl_Position = uM * vec4(vP, 1.);
  gl_Position.xy += uD * gl_Position.w;
}`;
const POINTS_MASSIF = `#extension GL_OES_standard_derivatives : enable
precision highp float;
varying float vU;
varying vec3 vN;
varying vec3 vP;
uniform vec3 cFond, cTrait, c1, c2, c3, cOk;
uniform float uTotal, uBesoin, uPas, uFin, uTrace, uSombre, uTemps, uEclat, uAnneau;
uniform vec2 uSeuils;
uniform vec3 uBandes;
// un trait là où v passe par un entier ; il s'éteint quand les courbes deviennent plus serrées que l'écran
float ligne(float v, float w) {
  float f = fwidth(v);
  float d = abs(fract(v - .5) - .5) / max(f, 1e-6);
  return (1. - smoothstep(w - .6, w + .6, d)) * clamp(1.7 - f * 2.6, 0., 1.);
}
void main() {
  float a = vU * uTotal;                                   // l'altitude, en francs par an
  float massif = smoothstep(.002, .014, vU);
  // les étages : un pilier par tranche d'altitude
  float w = fwidth(a) * 1.3;
  float e2 = smoothstep(uSeuils.x - w, uSeuils.x + w, a), e3 = smoothstep(uSeuils.y - w, uSeuils.y + w, a);
  vec3 etage = mix(mix(c1, c2, e2), c3, e3);
  float allume = mix(mix(uBandes.x, uBandes.y, e2), uBandes.z, e3);
  // les courbes : une famille fine qui s'efface quand l'échelle grandit, une famille maîtresse plus appuyée
  float fines = max(ligne(a / uPas, .72) * uFin, ligne(a / (2. * uPas), .72));
  float fortes = max(ligne(a / (4. * uPas), 1.2) * uFin, ligne(a / (8. * uPas), 1.2));
  float trace = 1. - smoothstep(uTrace - .06, uTrace, vU); // les courbes se tracent du pied vers le sommet
  float balai = exp(-pow((vU - fract(uTemps * .055) * 1.3 + .15) * 15., 2.)) * uEclat;
  float courbe = clamp(max(fines * (.46 + .5 * balai), fortes * .96), 0., 1.) * trace * massif;
  // le relief : lumière du nord-ouest ; le plat reste à la couleur du papier, seuls les versants s'ombrent (ou s'éclairent, de nuit)
  vec3 soleil = normalize(vec3(-.52, .62, -.58));
  float pente = dot(normalize(vN), soleil) - soleil.y;
  vec3 jour = mix(cFond, mix(cTrait, etage, .5), clamp(-pente * .42, 0., .2) * massif);      // versants à l'ombre : teintés
  jour = mix(jour, vec3(1.), clamp(pente * 1.5, 0., .8) * massif);                            // versants au soleil : le blanc du papier couché
  vec3 plein = mix(jour, mix(cFond, cTrait, clamp(pente * .5, 0., .26) * massif), uSombre);
  plein = mix(plein, etage, .075 * allume * massif);
  // le sol : le quadrillage de la carte, des croix aux intersections
  vec2 g = vP.xz * 3.;
  vec2 fg = abs(fract(g - .5) - .5), wg = fwidth(g);
  float lx = 1. - smoothstep(0., 1.3, fg.x / max(wg.x, 1e-6)), lz = 1. - smoothstep(0., 1.3, fg.y / max(wg.y, 1e-6));
  float croix = max(lx * step(fg.y, .1), lz * step(fg.x, .1));
  float sol = (max(lx, lz) * .16 + croix * .5) * (1. - massif);
  // le besoin, quand le sommet le dépasse : sa courbe, d'un trait net
  float atteint = (1. - smoothstep(.9, 2.4, abs(a - uBesoin) / max(fwidth(a), 1e-6))) * massif * step(uBesoin, uTotal * .999) * uAnneau;
  vec3 col = mix(plein, cTrait, sol * .55);
  col = mix(col, mix(cTrait, etage, allume), courbe);
  col = mix(col, cOk, atteint);
  float bord = 1. - smoothstep(1.25, 2.5, length(vP.xz));
  gl_FragColor = vec4(col, 1.) * bord;
}`;
const SOMMETS_ANNEAU = `
attribute vec2 aA;
uniform mat4 uM;
uniform vec2 uD, uVue;
uniform vec3 uCentre;
uniform float uRayon, uEpais, uEcran;
varying float vT;
varying float vC;
vec4 point(float angle, float r) { return uM * vec4(uCentre + vec3(cos(angle) * r, 0., sin(angle) * r), 1.); }
void main() {
  float angle = aA.x * 6.2831853;
  vT = aA.x; vC = aA.y;
  if (uEcran > .5) {                                       // l'anneau : un trait d'épaisseur constante à l'écran, quel que soit l'angle de vue
    vec4 a = point(angle, uRayon), b = point(angle + .012, uRayon);
    vec2 d = normalize((b.xy / b.w - a.xy / a.w) * uVue);
    gl_Position = a;
    gl_Position.xy += vec2(-d.y, d.x) / uVue * 2. * uEpais * aA.y * a.w;
  } else gl_Position = point(angle, uRayon + aA.y * uEpais);   // le disque : posé à plat, à l'altitude du besoin
  gl_Position.xy += uD * gl_Position.w;
}`;
const POINTS_ANNEAU = `
precision highp float;
varying float vT;
varying float vC;
uniform vec3 cTeinte;
uniform float uAlpha, uTirets, uTemps;
void main() {
  float plein = step(uTirets, .5);
  float tiret = max(plein, step(.44, fract(vT * uTirets - uTemps * .02)));
  float bordure = mix(1. - smoothstep(.5, 1., abs(vC)), .5 - .5 * vC, plein);   // l'anneau : bords doux ; le disque : il s'efface vers l'extérieur
  gl_FragColor = vec4(cTeinte, 1.) * uAlpha * tiret * bordure;
}`;

/**
 * @typedef {{p1: number, p2: number, p3: number, besoin: number}} Montants
 * @typedef {{azimut?: number, elevation?: number, distance?: number, cibleY?: number, dx?: number, dy?: number}} Vue
 */

/**
 * Pose le relief sur une toile.
 * @param {HTMLCanvasElement} toile
 * @param {{fin?: boolean, derive?: boolean, parallaxe?: boolean, fige?: boolean, taille?: number[], couleurs?: Record<string, string>}} [options]
 */
export function creerRelief(toile, options = {}) {
  const gl = toile.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches, fige = !!options.fige;
  const tactile = matchMedia('(pointer: coarse)').matches;
  const M = maillage(options.fin === false || tactile ? 128 : 184);

  /** @type {any} */ let P = null;   // programmes, tampons et adresses des réglages : refaits si le contexte est perdu
  function monter() {
    const compiler = (type, source) => {
      const s = /** @type {WebGLShader} */ (gl.createShader(type));
      gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('relief : ' + gl.getShaderInfoLog(s));
      return s;
    };
    const programme = (sommets, points) => {
      const p = /** @type {WebGLProgram} */ (gl.createProgram());
      gl.attachShader(p, compiler(gl.VERTEX_SHADER, sommets)); gl.attachShader(p, compiler(gl.FRAGMENT_SHADER, points)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('relief : ' + gl.getProgramInfoLog(p));
      const adresses = {};
      for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const u = gl.getActiveUniform(p, i); if (u) adresses[u.name] = gl.getUniformLocation(p, u.name); }
      return { p, u: adresses };
    };
    const tampon = (cible, donnees) => { const t = gl.createBuffer(); gl.bindBuffer(cible, t); gl.bufferData(cible, donnees, gl.STATIC_DRAW); return t; };
    const massif = programme(SOMMETS_MASSIF, POINTS_MASSIF), anneau = programme(SOMMETS_ANNEAU, POINTS_ANNEAU);
    const SEGMENTS = 160, cercle = new Float32Array((SEGMENTS + 1) * 4);
    for (let i = 0; i <= SEGMENTS; i++) cercle.set([i / SEGMENTS, -1, i / SEGMENTS, 1], i * 4);
    const sol = new Float32Array([-SOL, -SOL, 0, 0, 0, SOL, -SOL, 0, 0, 0, -SOL, SOL, 0, 0, 0, SOL, SOL, 0, 0, 0]);
    P = { massif, anneau, points: tampon(gl.ARRAY_BUFFER, M.points), faces: tampon(gl.ELEMENT_ARRAY_BUFFER, M.faces), sol: tampon(gl.ARRAY_BUFFER, sol),
          cercle: tampon(gl.ARRAY_BUFFER, cercle), segments: SEGMENTS,
          aP: gl.getAttribLocation(massif.p, 'aP'), aU: gl.getAttribLocation(massif.p, 'aU'), aA: gl.getAttribLocation(anneau.p, 'aA') };
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
  }
  try { monter(); } catch (erreur) { console.error(erreur); return null; }

  // ---- couleurs : lues dans la feuille de style, sur la toile elle-même (le thème et la marque s'y appliquent)
  const sonde = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const temoin = document.createElement('i');
  temoin.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
  /** @type {Record<string, number[]>} */ let C = {};
  let sombre = 0;
  function lireCouleurs() {
    if (options.couleurs) {   // couleurs imposées (image hors écran) : « #rrggbb »
      C = Object.fromEntries(Object.entries(options.couleurs).map(([cle, c]) => [cle, [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255)]));
      sombre = 0;
      return;
    }
    (toile.parentElement ?? document.body).append(temoin);
    const lire = (nom, secours) => {
      temoin.style.color = secours; temoin.style.color = `var(${nom}, ${secours})`;
      if (!sonde) return [0.5, 0.5, 0.5];
      sonde.clearRect(0, 0, 1, 1); sonde.fillStyle = '#000'; sonde.fillStyle = getComputedStyle(temoin).color; sonde.fillRect(0, 0, 1, 1);
      const [r, v, b] = sonde.getImageData(0, 0, 1, 1).data;
      return [r / 255, v / 255, b / 255];
    };
    C = { fond: lire('--relief-fond', '#f3efe6'), trait: lire('--relief-trait', '#8c7f6b'), p1: lire('--p1', '#16305f'), p2: lire('--p2', '#2c66d8'), p3: lire('--p3', '#36a5c9'),
          besoin: lire('--lacune', '#dc3b26'), ok: lire('--ok', '#1f8a5b') };
    sombre = 0.2126 * C.fond[0] + 0.7152 * C.fond[1] + 0.0722 * C.fond[2] < 0.4 ? 1 : 0;
    temoin.remove();
  }
  lireCouleurs();

  // ---- état : les montants et la vue voulus, et leurs valeurs du moment, qui les rejoignent en douceur
  const voulu = { p1: 26, p2: 30, p3: 9, besoin: 80, b1: 1, b2: 1, b3: 1, anneau: 1, montee: 1, trace: 1.1, eclat: 1,
                  azimut: 0.6, elevation: 0.5, distance: 3.4, cibleY: 0.3, dx: 0, dy: 0 };
  const etat = { ...voulu };
  const LENTEUR = { p1: 0.34, p2: 0.34, p3: 0.34, besoin: 0.34, b1: 0.3, b2: 0.3, b3: 0.3, anneau: 0.3, montee: 0.5, trace: 0.55, eclat: 0.5,
                    azimut: 0.42, elevation: 0.42, distance: 0.42, cibleY: 0.42, dx: 0.42, dy: 0.42 };
  let largeur = 0, hauteur = 0, matrice = /** @type {number[]} */ ([]), decalage = [0, 0], temps = fige ? 12 : 0, instant = 0, image = 0, visible = true, propre = false;
  let px = 0, py = 0, vx = 0, vy = 0;   // pointeur (−1 à 1) : valeur voulue et valeur adoucie
  let voulue = true;                    // la page peut suspendre le dessin quand le relief est recouvert
  let allegement = 1, lentes = 0;       // carte graphique à la peine : on dessine moins de points (voir avancer)
  /** @type {((r: any) => void)[]} */ const suiveurs = [];

  function taille() {
    if (options.taille) {   // taille imposée (image hors écran)
      [largeur, hauteur] = options.taille;
      if (toile.width !== largeur || toile.height !== hauteur) { toile.width = largeur; toile.height = hauteur; }
      gl.viewport(0, 0, largeur, hauteur);
      return;
    }
    const boite = toile.getBoundingClientRect();
    const densite = Math.max(0.6, Math.min(devicePixelRatio || 1, tactile ? 1.5 : 2, Math.sqrt(BUDGET / Math.max(1, boite.width * boite.height))) * allegement);
    const l = Math.max(1, Math.round(boite.width * densite)), h = Math.max(1, Math.round(boite.height * densite));
    largeur = boite.width; hauteur = boite.height;
    if (toile.width !== l || toile.height !== h) { toile.width = l; toile.height = h; gl.viewport(0, 0, l, h); }
  }

  /** Mise à l'échelle : le plus haut des deux (sommet, besoin) occupe la hauteur de la scène. */
  function mesures() {
    const total = Math.max(1, etat.p1 + etat.p2 + etat.p3), echelle = Math.max(total, etat.besoin, 1);
    const ideal = echelle / 36, rang = Math.log2(Math.max(ideal, 1) / 1000), pas = 1000 * Math.pow(2, Math.floor(rang));
    return { total, echelle, hautSommet: HAUT * total / echelle * etat.montee, hautBesoin: HAUT * etat.besoin / echelle * etat.montee,
             pas, fin: 1 - (rang - Math.floor(rang)), equidistance: 2 * pas };
  }

  function dessiner() {
    if (!P || gl.isContextLost()) return;
    const m = mesures(), rapport = Math.max(0.2, largeur / Math.max(1, hauteur));
    const azimut = etat.azimut + (options.derive === false || calme || fige ? 0 : 0.16 * Math.sin(temps * 0.13)) + vx * 0.22;
    const elevation = Math.min(1.5607, Math.max(0.08, etat.elevation - vy * 0.07));
    const cible = [0, etat.cibleY, 0];
    const oeil = [cible[0] + etat.distance * Math.cos(elevation) * Math.sin(azimut), cible[1] + etat.distance * Math.sin(elevation), cible[2] + etat.distance * Math.cos(elevation) * Math.cos(azimut)];
    const haut = [-Math.sin(elevation) * Math.sin(azimut), Math.cos(elevation), -Math.sin(elevation) * Math.cos(azimut)];
    matrice = produit(perspective(0.62, rapport, 0.1, 30), regard(oeil, cible, haut));
    decalage = [etat.dx, etat.dy];
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // le sol, puis le massif posé dessus
    let u = P.massif.u;
    const pointer = tampon => { gl.bindBuffer(gl.ARRAY_BUFFER, tampon); gl.vertexAttribPointer(P.aP, 2, gl.FLOAT, false, 20, 0); gl.vertexAttribPointer(P.aU, 3, gl.FLOAT, false, 20, 8); };
    gl.useProgram(P.massif.p);
    gl.enableVertexAttribArray(P.aP); gl.enableVertexAttribArray(P.aU);
    gl.uniformMatrix4fv(u.uM, false, matrice); gl.uniform2f(u.uD, decalage[0], decalage[1]); gl.uniform1f(u.uHaut, m.hautSommet);
    gl.uniform3fv(u.cFond, C.fond); gl.uniform3fv(u.cTrait, C.trait); gl.uniform3fv(u.c1, C.p1); gl.uniform3fv(u.c2, C.p2); gl.uniform3fv(u.c3, C.p3); gl.uniform3fv(u.cOk, C.ok);
    gl.uniform1f(u.uTotal, m.total); gl.uniform1f(u.uBesoin, etat.besoin); gl.uniform1f(u.uPas, m.pas); gl.uniform1f(u.uFin, m.fin);
    gl.uniform1f(u.uTrace, etat.trace); gl.uniform1f(u.uSombre, sombre); gl.uniform1f(u.uTemps, temps); gl.uniform1f(u.uEclat, calme || fige ? 0 : etat.eclat); gl.uniform1f(u.uAnneau, etat.anneau);
    gl.uniform2f(u.uSeuils, etat.p1, etat.p1 + etat.p2); gl.uniform3f(u.uBandes, etat.b1, etat.b2, etat.b3);
    gl.depthMask(false);
    pointer(P.sol); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.depthMask(true);
    pointer(P.points); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, P.faces);
    gl.drawElements(gl.TRIANGLES, M.faces.length, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(P.aP); gl.disableVertexAttribArray(P.aU);

    // le besoin : un plan d'altitude à peine teinté, et son anneau en pointillé
    if (etat.anneau > 0.01) {
      u = P.anneau.u;
      gl.useProgram(P.anneau.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, P.cercle);
      gl.enableVertexAttribArray(P.aA); gl.vertexAttribPointer(P.aA, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(u.uM, false, matrice); gl.uniform2f(u.uD, decalage[0], decalage[1]);
      gl.uniform3f(u.uCentre, M.sommet[0], m.hautBesoin, M.sommet[1]); gl.uniform1f(u.uTemps, temps);
      const manque = etat.besoin > m.total * 1.001;
      gl.uniform3fv(u.cTeinte, manque ? C.besoin : C.ok);
      gl.depthMask(false);
      gl.uniform2f(u.uVue, toile.width, toile.height);
      gl.uniform1f(u.uEcran, 0); gl.uniform1f(u.uRayon, 0.31); gl.uniform1f(u.uEpais, 0.31); gl.uniform1f(u.uTirets, 0); gl.uniform1f(u.uAlpha, (0.14 + 0.1 * sombre) * etat.anneau);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (P.segments + 1) * 2);
      gl.uniform1f(u.uEcran, 1); gl.uniform1f(u.uRayon, 0.62); gl.uniform1f(u.uEpais, 1.5 * toile.width / Math.max(1, largeur)); gl.uniform1f(u.uTirets, 72); gl.uniform1f(u.uAlpha, etat.anneau);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (P.segments + 1) * 2);
      gl.depthMask(true);
      gl.disableVertexAttribArray(P.aA);
    }
    for (const suivre of suiveurs) suivre(relief);
  }

  function avancer(maintenant) {
    image = 0;
    const brut = maintenant - instant, ecoule = Math.min(0.064, Math.max(0.001, brut / 1000));
    instant = maintenant;
    // une quarantaine d'images lentes de suite (moins de 40 par seconde) : la carte ne suit pas, on réduit d'un cran,
    // une fois pour toutes ; mieux vaut un trait un peu moins fin qu'un mouvement saccadé
    if (!calme && !fige && !options.taille) {
      lentes = brut > 25 && brut < 250 ? lentes + 1 : 0;
      if (lentes > 40 && allegement > 0.6) { allegement *= 0.8; lentes = 0; taille(); }
    }
    if (!fige) temps += ecoule;
    let bouge = false;
    for (const cle in voulu) {
      const ecart = voulu[cle] - etat[cle];
      if (Math.abs(ecart) < 1e-4 * Math.max(1, Math.abs(voulu[cle]))) { etat[cle] = voulu[cle]; continue; }
      etat[cle] += ecart * (calme || fige ? 1 : 1 - Math.exp(-ecoule / LENTEUR[cle])); bouge = true;
    }
    if (Math.abs(px - vx) + Math.abs(py - vy) > 0.0005) { vx += (px - vx) * (1 - Math.exp(-ecoule / 0.5)); vy += (py - vy) * (1 - Math.exp(-ecoule / 0.5)); bouge = true; }
    dessiner();
    propre = !bouge;
    if (bouge || !(calme || fige)) demander();
  }
  function demander() { if (!image && visible && voulue && !document.hidden) image = requestAnimationFrame(avancer); }

  const surTaille = new ResizeObserver(() => { taille(); if (propre || calme || fige) { instant = performance.now(); dessiner(); } demander(); });
  surTaille.observe(toile);
  const surVue = new IntersectionObserver(entrees => { visible = entrees[entrees.length - 1].isIntersecting; if (visible) { instant = performance.now(); demander(); } });
  surVue.observe(toile);
  const surRetour = () => { if (!document.hidden) { instant = performance.now(); demander(); } };
  document.addEventListener('visibilitychange', surRetour);
  const theme = matchMedia('(prefers-color-scheme: dark)'), surTheme = () => { lireCouleurs(); demander(); };
  theme.addEventListener('change', surTheme);
  const surPointeur = evenement => {
    if (evenement.pointerType !== 'mouse') return;
    px = (evenement.clientX / innerWidth) * 2 - 1; py = (evenement.clientY / innerHeight) * 2 - 1;
    demander();
  };
  if (options.parallaxe !== false && !calme && !fige && !tactile) addEventListener('pointermove', surPointeur, { passive: true });
  toile.addEventListener('webglcontextlost', evenement => { evenement.preventDefault(); P = null; });
  toile.addEventListener('webglcontextrestored', () => { try { monter(); demander(); } catch (erreur) { console.error(erreur); } });

  /** Hauteur du massif (0 à 1) au point (x, z) du sol. */
  function hauteurEn(x, z) {
    const i = (x + ETENDUE) / M.pas, j = (z + ETENDUE) / M.pas;
    if (i < 0 || j < 0 || i > M.n - 1 || j > M.n - 1) return 0;
    const i0 = Math.min(M.n - 2, Math.floor(i)), j0 = Math.min(M.n - 2, Math.floor(j)), fx = i - i0, fy = j - j0, k = j0 * M.n + i0, H = M.hauteurs;
    return (H[k] * (1 - fx) + H[k + 1] * fx) * (1 - fy) + (H[k + M.n] * (1 - fx) + H[k + M.n + 1] * fx) * fy;
  }

  /** Les points de l'anneau le plus haut et le plus bas à l'écran : l'étiquette du besoin se pose au-dessus, celle de la lacune en dessous. */
  function bords(y) {
    let dessus = { x: 0, y: 1e9, devant: true }, dessous = { x: 0, y: -1e9, devant: true };
    for (let k = 0; k < 32; k++) {
      const angle = (k / 32) * TOUR, p = relief.projeter(M.sommet[0] + 0.62 * Math.cos(angle), y, M.sommet[1] + 0.62 * Math.sin(angle));
      if (p.y < dessus.y) dessus = p;
      if (p.y > dessous.y) dessous = p;
    }
    return { dessus, dessous };
  }

  const relief = {
    /** Suspend ou reprend le dessin (quand une section pleine recouvre le relief). */
    actif(oui) { if (voulue === !!oui) return; voulue = !!oui; if (voulue) { instant = performance.now(); demander(); } },
    /** Les montants à montrer (francs par an). @param {Partial<Montants>} montants @param {boolean} [immediat] */
    regler(montants, immediat = false) {
      for (const cle of ['p1', 'p2', 'p3', 'besoin']) if (Number.isFinite(montants[cle])) { voulu[cle] = Math.max(0, montants[cle]); if (immediat) etat[cle] = voulu[cle]; }
      demander();
    },
    /** La vue : angles en radians, distance et décalage (en demi-largeurs d'écran). @param {Vue} vue @param {boolean} [immediat] */
    viser(vue, immediat = false) {
      for (const cle of ['azimut', 'elevation', 'distance', 'cibleY', 'dx', 'dy']) if (Number.isFinite(vue[cle])) { voulu[cle] = vue[cle]; if (immediat) etat[cle] = vue[cle]; }
      demander();
    },
    /** La mise en scène : étages allumés (0 à 1), anneau, montée du massif, tracé des courbes, éclat du balayage. */
    scene(reglages, immediat = false) {
      if (reglages.bandes) reglages.bandes.forEach((v, i) => { voulu['b' + (i + 1)] = v; if (immediat) etat['b' + (i + 1)] = v; });
      for (const cle of ['anneau', 'montee', 'trace', 'eclat']) if (Number.isFinite(reglages[cle])) { voulu[cle] = reglages[cle]; if (immediat) etat[cle] = reglages[cle]; }
      demander();
    },
    /** Où tombe à l'écran un point de la scène : pixels dans la toile, et s'il est devant l'œil. */
    projeter(x, y, z) {
      if (!matrice.length) return { x: 0, y: 0, devant: false };
      const c = applique(matrice, x, y, z);
      return { x: ((c[0] / c[3] + decalage[0]) * 0.5 + 0.5) * largeur, y: (0.5 - (c[1] / c[3] + decalage[1]) * 0.5) * hauteur, devant: c[3] > 0 };
    },
    /** Les repères utiles aux étiquettes : montants du moment, hauteurs de scène et points à l'écran. */
    reperes() {
      const m = mesures(), [sx, sz] = M.sommet, total = m.total;
      const a = y => relief.projeter(sx, y, sz);
      return { ...m, p1: etat.p1, p2: etat.p2, p3: etat.p3, besoin: etat.besoin, sommet: a(m.hautSommet), anneau: a(m.hautBesoin), pied: a(0),
               ...bords(m.hautBesoin),
               etages: [etat.p1 / 2, etat.p1 + etat.p2 / 2, etat.p1 + etat.p2 + etat.p3 / 2].map(f => a(m.hautSommet * f / total)) };
    },
    /** L'altitude (francs par an) sous un point de l'écran, ou `null` hors du massif. */
    sonder(clientX, clientY) {
      const boite = toile.getBoundingClientRect(), inv = matrice.length ? inverse(matrice) : null;
      if (!inv || !boite.width) return null;
      const nx = ((clientX - boite.left) / boite.width) * 2 - 1 - decalage[0], ny = 1 - ((clientY - boite.top) / boite.height) * 2 - decalage[1];
      const pres = applique(inv, nx, ny, -1), loin = applique(inv, nx, ny, 1), m = mesures();
      const A = pres.slice(0, 3).map(v => v / pres[3]), B = loin.slice(0, 3).map(v => v / loin[3]);
      const en = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
      let avant = 0;
      for (let k = 1; k <= 320; k++) {
        const t = k / 320, p = en(t);
        if (p[1] <= hauteurEn(p[0], p[2]) * m.hautSommet) {
          let a = avant, b = t;
          for (let i = 0; i < 10; i++) { const c = (a + b) / 2, q = en(c); if (q[1] <= hauteurEn(q[0], q[2]) * m.hautSommet) b = c; else a = c; }
          const q = en(b), h = hauteurEn(q[0], q[2]);
          return h > 0.016 ? { altitude: h * m.total, part: h, etage: h * m.total < etat.p1 ? 1 : h * m.total < etat.p1 + etat.p2 ? 2 : 3 } : null;
        }
        avant = t;
      }
      return null;
    },
    /** Appelé après chaque image : pour poser les étiquettes là où tombent les repères. */
    suivre(fonction) { suiveurs.push(fonction); demander(); },
    relireCouleurs() { lireCouleurs(); demander(); },
    redessiner() { taille(); instant = performance.now(); dessiner(); demander(); },
    detruire() {
      cancelAnimationFrame(image); surTaille.disconnect(); surVue.disconnect(); suiveurs.length = 0; voulue = false;
      gl.getExtension('WEBGL_lose_context')?.loseContext();   // un navigateur ne garde qu'une poignée de contextes : on rend celui-ci
      document.removeEventListener('visibilitychange', surRetour); theme.removeEventListener('change', surTheme); removeEventListener('pointermove', surPointeur);
    },
  };
  taille();
  instant = performance.now();
  demander();
  return relief;
}

/**
 * Une image fixe du relief, rendue hors écran aux couleurs données : la couverture du rapport imprimé.
 * @param {Montants} montants
 * @param {{largeur?: number, hauteur?: number, couleurs: Record<string, string>, vue?: Vue}} options
 * @returns {string|null} l'image (adresse « data: »), ou `null` sans WebGL
 */
export function imageRelief(montants, { largeur = 1680, hauteur = 896, couleurs, vue }) {
  const toile = document.createElement('canvas');
  const relief = creerRelief(toile, { fige: true, taille: [largeur, hauteur], couleurs });
  if (!relief) return null;
  relief.regler(montants, true);
  relief.viser(vue ?? { azimut: 0.55, elevation: 0.34, distance: 3.3, cibleY: 0.46, dx: 0.4, dy: 0.02 }, true);
  relief.scene({ bandes: [1, 1, 1], anneau: montants.besoin > 0 ? 1 : 0, montee: 1, trace: 1.1, eclat: 0 }, true);
  relief.redessiner();
  let image = null;
  try { image = toile.toDataURL('image/png'); } catch { /* toile illisible : la couverture garde son image d'origine */ }
  relief.detruire();
  return image;
}
