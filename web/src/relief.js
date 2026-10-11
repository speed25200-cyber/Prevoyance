// @ts-check
/**
 * Le relief de prévoyance : un sommet alpin, calculé et éclairé en direct (WebGL, sans bibliothèque).
 *
 * L'altitude est un revenu annuel. Du pied au sommet, les trois étages sont les trois piliers (AVS, caisse de
 * pension, épargne privée) ; l'anneau en pointillé, à l'altitude du besoin, dit où il faudrait arriver. Le sommet
 * sous l'anneau : il reste un dénivelé à gravir — c'est la lacune. Les chiffres viennent du moteur, jamais d'ici.
 *
 * Le terrain est réel : le Weisshorn et son massif, d'après swisstopo (voir `chargerTerrain`) — les altitudes pour la
 * forme, la photographie aérienne pour la roche et la glace, une neige fraîche calculée par-dessus. Sa hauteur suit
 * les montants. La lumière est celle d'un lever de soleil — l'ombre portée des arêtes, la ligne d'ombre qui
 * descend du sommet à mesure que l'heure avance, le ciel qui éclaire les versants à l'ombre. Autour : une mer de
 * nuages qui dérive, des chaînes lointaines dans la brume. Par-dessus, la carte : les courbes de niveau et les
 * limites des trois étages, d'un trait fin.
 *
 * Deux ambiances, choisies d'après la couleur du fond (`--relief-fond`) : sur fond sombre, l'heure bleue et l'aube ;
 * sur papier, un plein jour pâle, la brume à la couleur de la page.
 *
 * Sans WebGL, ou tant que le terrain n'est pas chargé : `creerRelief` rend `null` et la page garde sa version sans
 * relief. En mouvement réduit, ou figé pour
 * une capture : une image, redessinée seulement quand les chiffres ou la vue changent.
 */

const ETENDUE = 1.3;      // demi-côté du terrain, en unités de scène (4 km)
const ANNEAU = 0.3;       // rayon de l'anneau du besoin
const LOIN = 60;          // demi-côté de la mer de nuages, jusqu'à l'horizon
const MER = 5.2;          // demi-côté de sa partie en relief, autour du massif
const HAUT = 1.02;        // hauteur, en unités de scène, du plus haut des deux : le sommet ou le besoin
const PENTE = 6;          // pente la plus forte rangée dans la carte du terrain (pour une hauteur de 1)
const HORIZON = 4;        // tangente d'horizon la plus forte rangée dans la carte du terrain
const TOUR = Math.PI * 2;
// Points dessinés au plus par image : au-delà, la toile est dessinée moins fine que l'écran (voir taille).
const BUDGET = 1.25e6;
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
// La déformation commune au maillage et aux images du terrain : u (de −1 à 1, à pas constant) donne une position (de −1
// à 1) deux fois plus serrée au centre — le sommet — qu'en moyenne ; `rang` est l'inverse.
const place = u => 0.5 * u + 0.5 * u * u * u;
function rang(v) { let u = v; for (let k = 0; k < 6; k++) u -= (place(u) - v) / (0.5 + 1.5 * u * u); return u; }
const entre = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// ------------------------------------------------------------------------------------------------ le terrain
function hasard(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Le terrain : un vrai sommet, le Weisshorn (4506 m, Valais), son massif (Bishorn, Schalihorn, glaciers) et les
 * vallées autour — un carré de 8 km, d'après swisstopo : les altitudes du modèle de terrain swissALTI3D et la
 * photographie aérienne SWISSIMAGE, réduites par `outils/terrain.py` (images déformées par `place` : plus fines au
 * centre). +x est l'est, +z le sud ; 0 est la mer de brouillard (1750 m), 1 le sommet. Préparé une fois : les
 * altitudes, puis ce que la lumière demande — la pente, l'horizon vu de chaque point en regardant vers le soleil
 * (pour l'ombre portée), et le creux (pour l'ombre du ciel).
 * @type {{n: number, h: Float32Array, creux: Float32Array, carte: Uint8Array, sommet: number[], photo: HTMLImageElement}|null}
 */
let TERRAIN = null;
/** @type {Promise<boolean>|null} */ let chargement = null;
/** Rend la main au navigateur un instant (la préparation du terrain ne doit pas figer la page). */
const souffler = () => new Promise(suite => { const canal = new MessageChannel(); canal.port1.onmessage = () => suite(null); canal.port2.postMessage(0); });
/**
 * Charge et prépare le terrain (une fois). À appeler avant `creerRelief`, qui rend `null` tant qu'il n'est pas là.
 * Sur un écran tactile : des fichiers deux fois moins fins, quatre fois plus légers.
 * @returns {Promise<boolean>} vrai si le terrain est prêt
 */
export function chargerTerrain() {
  chargement ??= (async () => {
    try {
      const suffixe = matchMedia('(pointer: coarse)').matches ? '-leger' : '';
      const lire = nom => { const image = new Image(); image.src = new URL(`../images/terrain/${nom}`, import.meta.url).href; return image.decode().then(() => image); };
      const [altitudes, photo] = await Promise.all([lire(`weisshorn${suffixe}.png`), lire(`weisshorn-photo${suffixe}.webp`)]);
      const n = altitudes.naturalWidth, toile = document.createElement('canvas');
      toile.width = toile.height = n;
      const c = toile.getContext('2d', { willReadFrequently: true });
      if (!c || altitudes.naturalHeight !== n) return false;
      c.drawImage(altitudes, 0, 0);
      const octets = c.getImageData(0, 0, n, n).data, h = new Float32Array(n * n);
      for (let k = 0; k < h.length; k++) h[k] = (octets[k * 4] * 256 + octets[k * 4 + 1]) / 65535;   // 16 bits : rouge (fort), vert (faible)
      TERRAIN = await preparer(n, h, photo);
      return true;
    } catch (erreur) { console.error(erreur); return false; }
  })();
  return chargement;
}
async function preparer(n, h, photo) {
  const X = Float32Array.from({ length: n }, (_, i) => ETENDUE * place(i / (n - 1) * 2 - 1));   // la position de chaque colonne (et de chaque ligne)
  let max = 0, sommet = 0, repere = performance.now();
  const pause = async () => { if (performance.now() - repere > 10) { await souffler(); repere = performance.now(); } };
  for (let k = 0; k < h.length; k++) if (h[k] > max) { max = h[k]; sommet = k; }
  for (let k = 0; k < h.length; k++) h[k] /= max;
  // tout au bord du carré, le terrain dessiné s'enfonce sous la brume (une arête ne s'arrête pas net) ; la pente,
  // l'ombre et la matière, elles, restent celles du vrai terrain
  const dessine = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.max(Math.abs(i / (n - 1) * 2 - 1), Math.abs(j / (n - 1) * 2 - 1)), t = Math.min(1, Math.max(0, (r - 0.86) / 0.14));
    dessine[j * n + i] = h[j * n + i] * (1 - t * t * (3 - 2 * t));
  }
  // le creux : l'écart à la moyenne des alentours (deux passes de flou), un fond de couloir reçoit moins de ciel
  const rayon = Math.max(2, Math.round(n / 64)), saut = Math.max(1, Math.round(rayon / 6)), flou = new Float32Array(n * n), creux = new Float32Array(n * n);
  const moyenne = async (origine, cible, pasI, pasJ) => {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let somme = 0, compte = 0;
        for (let r = -rayon; r <= rayon; r += saut) { const ii = i + r * pasI, jj = j + r * pasJ; if (ii >= 0 && jj >= 0 && ii < n && jj < n) { somme += origine[jj * n + ii]; compte++; } }
        cible[j * n + i] = somme / compte;
      }
      if (!(j & 31)) await pause();
    }
  };
  await moyenne(h, creux, 1, 0); await moyenne(creux, flou, 0, 1);
  for (let k = 0; k < h.length; k++) creux[k] = 1 - Math.min(0.62, Math.max(0, (flou[k] - h[k]) * 9));
  // la carte du terrain : pente (rouge, vert), horizon vers le soleil (bleu), altitude dessinée (alpha)
  const carte = new Uint8Array(n * n * 4);
  const coder = g => { const v = Math.sign(g) * Math.sqrt(Math.min(1, Math.abs(g) / PENTE)); return Math.round((v * 0.5 + 0.5) * 255); };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i, h0 = h[k];
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
      const gx = (h[j * n + i1] - h[j * n + i0]) / (X[i1] - X[i0]), gz = (h[j1 * n + i] - h[j0 * n + i]) / (X[j1] - X[j0]);
      // l'horizon : la plus forte pente vers un point du terrain, en regardant vers le soleil (+x, l'est)
      let horizon = 0;
      for (let d = 1, bond = 1; i + d < n; d += bond) {
        const v = (h[k + d] - h0) / (X[i + d] - X[i]);
        if (v > horizon) horizon = v;
        if (d >= 24) bond = d >= 160 ? 8 : d >= 64 ? 4 : 2;
      }
      const o = k * 4;
      carte[o] = coder(gx); carte[o + 1] = coder(gz); carte[o + 2] = Math.round(Math.min(1, horizon / HORIZON) * 255); carte[o + 3] = Math.round(dessine[k] * 255);
    }
    if (!(j & 31)) await pause();
  }
  return { n, h: dessine, creux, carte, sommet: [X[sommet % n], X[Math.floor(sommet / n)]], photo };
}
/** Les faces d'une grille de n × n points, du sud-est vers le nord-ouest : l'œil est toujours au sud-est, les faces
 * proches se dessinent d'abord et cachent les lointaines avant qu'on les calcule. */
function grille(n) {
  const faces = new Uint16Array((n - 1) * (n - 1) * 6);
  let f = 0;
  for (let j = n - 2; j >= 0; j--) for (let i = n - 2; i >= 0; i--) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    faces[f++] = a; faces[f++] = c; faces[f++] = b; faces[f++] = b; faces[f++] = c; faces[f++] = d;
  }
  return faces;
}
/** Une valeur du terrain (altitude, creux) au point (x, z) du sol. */
function lire(t, champ, x, z) {
  if (Math.abs(x) > ETENDUE || Math.abs(z) > ETENDUE) return 0;
  const i = (rang(x / ETENDUE) + 1) / 2 * (t.n - 1), j = (rang(z / ETENDUE) + 1) / 2 * (t.n - 1);
  const i0 = Math.min(t.n - 2, Math.floor(i)), j0 = Math.min(t.n - 2, Math.floor(j)), fx = i - i0, fy = j - j0, k = j0 * t.n + i0;
  return (champ[k] * (1 - fx) + champ[k + 1] * fx) * (1 - fy) + (champ[k + t.n] * (1 - fx) + champ[k + t.n + 1] * fx) * fy;
}

/**
 * Le maillage : n × n points posés sur le terrain, chacun avec sa position au sol, son altitude (0 à 1), son creux et
 * sa place dans les images du terrain. Comme elles, il est plus serré autour du sommet (au centre) que vers les bords.
 */
function maillage(n, t) {
  const points = new Float32Array(n * n * 6), X = Float32Array.from({ length: n }, (_, i) => ETENDUE * place(i / (n - 1) * 2 - 1));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++)
    points.set([X[i], X[j], lire(t, t.h, X[i], X[j]), lire(t, t.creux, X[i], X[j]), i / (n - 1), j / (n - 1)], (j * n + i) * 6);
  return { n, points, faces: grille(n), sommet: t.sommet };
}

/**
 * Le grain : un bruit qui se répète sans raccord, pour le détail de la roche, les volutes des nuages et la découpe
 * des chaînes lointaines. Rouge et vert : sa pente ; bleu : sa valeur ; alpha : un second bruit, plus fin.
 */
let GRAIN = /** @type {Uint8Array|null} */ (null);
const COTE_GRAIN = 256;
function grain() {
  if (GRAIN) return GRAIN;
  const n = COTE_GRAIN, valeur = new Float32Array(n * n), fin = new Float32Array(n * n);
  const periodique = (x, y, periode, graine) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const en = (a, b) => hasard(((a % periode) + periode) % periode + graine, ((b % periode) + periode) % periode - graine);
    const a = en(i, j), b = en(i + 1, j), c = en(i, j + 1), d = en(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let a = 0, b = 0, poids = 0.5;
    for (let o = 0; o < 6; o++) { const f = 4 << o; a += poids * periodique(i / n * f, j / n * f, f, 101 * o); poids *= 0.5; }
    poids = 0.5;
    for (let o = 0; o < 4; o++) { const f = 16 << o; b += poids * periodique(i / n * f, j / n * f, f, 977 + 53 * o); poids *= 0.5; }
    valeur[j * n + i] = a; fin[j * n + i] = b;
  }
  GRAIN = new Uint8Array(n * n * 4);
  const octet = v => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, dx = valeur[j * n + (i + 1) % n] - valeur[j * n + (i + n - 1) % n], dy = valeur[((j + 1) % n) * n + i] - valeur[((j + n - 1) % n) * n + i];
    GRAIN.set([octet(0.5 + dx * 9), octet(0.5 + dy * 9), octet(valeur[k] * 1.02), octet(fin[k] * 1.06)], k * 4);
  }
  return GRAIN;
}

// ------------------------------------------------------------------------------------------------ l'heure et sa lumière
// De l'heure bleue (0) au plein jour (1) : les couleurs du ciel, du soleil, de la brume et des nuages. Le soleil monte
// (sa tangente), la ligne d'ombre descend du sommet (en part de la hauteur du massif) : la première lueur ne touche
// que la pointe.
const HEURES = [
  { heure: 0, zenith: '#05070f', horizon: '#131c34', aube: '#3a3552', lueur: 0.3, soleil: [0.34, 0.4, 0.58], tangente: 0.04, ciel: [0.2, 0.27, 0.44], brume: '#0f1627', densite: 0.05,
    nuage: '#2b3653', ombre: '#0b101d', chaine: '#060a14', terme: 1.3, disque: 0, nappe: 0 },
  { heure: 0.25, zenith: '#091126', horizon: '#34466f', aube: '#e88d64', lueur: 0.9, soleil: [1.75, 0.86, 0.56], tangente: 0.08, ciel: [0.3, 0.41, 0.66], brume: '#26355a', densite: 0.046,
    nuage: '#66739a', ombre: '#151e37', chaine: '#0c142b', terme: 0.56, disque: 0.45, nappe: 0 },
  { heure: 0.5, zenith: '#16345f', horizon: '#eeb089', aube: '#ffc48f', lueur: 1, soleil: [1.85, 1.36, 1.0], tangente: 0.2, ciel: [0.44, 0.48, 0.72], brume: '#8d92b0', densite: 0.04,
    nuage: '#f3c6a9', ombre: '#48537a', chaine: '#2a3457', terme: -0.4, disque: 1, nappe: 1 },
  { heure: 1, zenith: '#2a69b8', horizon: '#cfe1f2', aube: '#ffffff', lueur: 0, soleil: [1.5, 1.44, 1.34], tangente: 0.6, ciel: [0.56, 0.68, 0.9], brume: '#c4d6ea', densite: 0.034,
    nuage: '#ffffff', ombre: '#97abc6', chaine: '#5b7397', terme: -0.4, disque: 1, nappe: 1 },
].map(h => ({ ...h, zenith: hex(h.zenith), horizon: hex(h.horizon), aube: hex(h.aube), brume: hex(h.brume), nuage: hex(h.nuage), ombre: hex(h.ombre), chaine: hex(h.chaine) }));
function lumiere(heure) {
  heure = Math.min(1, Math.max(0, heure));
  const k = Math.max(1, HEURES.findIndex(h => h.heure >= heure)), a = HEURES[k - 1], b = HEURES[k] ?? a;
  const part = Math.min(1, Math.max(0, (heure - a.heure) / Math.max(1e-6, b.heure - a.heure)));
  return Object.fromEntries(Object.keys(a).map(cle => [cle, Array.isArray(a[cle]) ? entre(a[cle], b[cle], part) : a[cle] + (b[cle] - a[cle]) * part]));
}
/** Sur papier : un plein jour pâle, la brume et le ciel à la couleur de la page. */
function lumierePapier(fond) {
  return { zenith: fond, horizon: fond, aube: fond, lueur: 0, soleil: [1.5, 1.48, 1.44], tangente: 0.42, ciel: [0.3, 0.32, 0.38], brume: fond, densite: 0.035,
           nuage: entre(fond, [1, 1, 1], 0.72), ombre: entre(fond, hex('#9aa0ab'), 0.42), chaine: entre(fond, hex('#6f7888'), 0.5), terme: -0.4, disque: 0, nappe: 0.7 };
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
/**
 * La nappe de nuages : sa hauteur (0 à 1) au point p du sol, et sa pente. Des volutes rondes aux creux marqués, à
 * deux échelles, qui dérivent lentement. La même fonction sert à déplacer le maillage, à l'éclairer, et à voiler le
 * pied du massif là où la nappe le touche.
 */
const NAPPE = (lire, fin) => `
float volutes(vec2 p, float t, out vec2 pente) {
  vec2 v = t * vec2(.0042, .0017);
  vec4 a = ${lire}p * .19 + v${fin}, b = ${lire}p * .53 - v * 1.6 + .41${fin}, c = ${lire}p * 1.37 + v * 2.3 + .17${fin};
  float ga = 2. * a.b - 1., gb = 2. * b.b - 1., gc = 2. * c.b - 1.;
  float ra = sqrt(ga * ga + .004), rb = sqrt(gb * gb + .006), rc = sqrt(gc * gc + .01);     // des creux marqués, mais sans arête vive
  pente = (a.rg - .5) * (ga / ra) * 1.3 + (b.rg - .5) * (gb / rb) * 1.1 + (c.rg - .5) * (gc / rc) * .6;
  return clamp(ra * 1.45 + rb * .75 + rc * .28 - .06, 0., 1.);
}`;
const SOMMETS_CIEL = `
attribute vec2 aE;
uniform mat4 uInv;
uniform vec2 uD;
varying vec3 vR;
void main() {
  vec4 a = uInv * vec4(aE - uD, -1., 1.), b = uInv * vec4(aE - uD, 1., 1.);
  vR = b.xyz / b.w - a.xyz / a.w;
  gl_Position = vec4(aE, 1., 1.);                         // au plus loin : tout ce qui est dessiné avant le cache
}`;
const POINTS_CIEL = `#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vR;
uniform sampler2D tGrain;
uniform vec3 uSoleil, cZenith, cHorizon, cAube, cSoleil, cBrume, cChaine;
uniform float uLueur, uDisque;
void main() {
  vec3 r = normalize(vR);
  float e = r.y, cap = atan(r.x, -r.z) / 6.2831853;
  float vers = .5 + .5 * dot(normalize(r.xz + 1e-5), normalize(uSoleil.xz));
  // l'horizon est plus clair du côté du soleil ; à l'opposé, le ciel garde la couleur du zénith
  vec3 col = mix(mix(cZenith, cHorizon, .42 + .58 * vers), cZenith, pow(clamp(e * 1.3, 0., 1.), .5));
  col = mix(col, cAube, pow(vers, 1.5) * exp(-max(e, 0.) * 6.) * uLueur);                     // la bande chaude à l'horizon, du côté du soleil
  float s = max(dot(r, uSoleil), 0.);
  col += cSoleil * (pow(s, 18.) * .16 + pow(s, 300.) * .7) * uDisque;
  // quelques cirrus étirés, qui prennent la couleur de l'aube
  vec4 v = texture2D(tGrain, vec2(cap * 3. + .2, e * 5.5));
  col = mix(col, mix(cHorizon, cAube, uLueur * (.35 + .65 * vers)), smoothstep(.5, .78, v.b * .72 + v.a * .34) * smoothstep(.03, .14, e) * (1. - smoothstep(.2, .55, e)) * .42);
  // les chaînes lointaines : trois plans, de la plus haute et plus pâle à la plus proche et plus sombre
  for (int k = 0; k < 3; k++) {
    float f = float(k);
    vec4 n = texture2D(tGrain, vec2(cap * (2. + f) + f * .37, .21 + f * .31));
    vec4 m = texture2D(tGrain, vec2(cap * (9. + 4. * f) + f * .11, .63 - f * .17));
    float fond = (.03 - .007 * f) + (.08 - .018 * f) * (n.b - .45), h = fond + (.03 - .006 * f) * (1. - abs(2. * m.a - 1.)) * n.b;
    float dans = smoothstep(0., fwidth(e) * 1.5 + 1e-4, h - e);
    vec3 teinte = mix(cBrume, cChaine, .3 + .24 * f);
    teinte = mix(teinte, cBrume, smoothstep(fond + .01, fond - .05, e) * .75);               // leur pied se perd dans la brume
    teinte = mix(teinte, cAube, pow(vers, 3.) * .22 * uLueur);
    col = mix(col, teinte, dans);
  }
  col = mix(col, cBrume, smoothstep(.012, -.012, e));                                        // sous l'horizon : la mer de nuages, au loin
  col += (texture2D(tGrain, gl_FragCoord.xy / 256.).a - .5) / 170.;                          // un rien de grain : pas de marches dans les dégradés
  gl_FragColor = vec4(col, 1.);
}`;
const SOMMETS_MASSIF = `
attribute vec2 aP;
attribute vec2 aU;
attribute vec2 aT;
uniform mat4 uM;
uniform vec2 uD;
uniform float uHaut;
varying float vU;
varying float vO;
varying vec2 vT;
varying vec3 vP;
void main() {
  vU = aU.x; vO = aU.y; vT = aT;
  vP = vec3(aP.x, aU.x * uHaut, aP.y);
  gl_Position = uM * vec4(vP, 1.);
  gl_Position.xy += uD * gl_Position.w;
}`;
const POINTS_MASSIF = `#extension GL_OES_standard_derivatives : enable
precision highp float;
varying float vU;
varying float vO;
varying vec2 vT;
varying vec3 vP;
uniform sampler2D tTerrain, tGrain, tPhoto;
uniform vec2 uCotes;
uniform vec3 uOeil, uSoleil, cSoleil, cCiel, cRebond, cBrume, cVoile, cNeige, cTrait, cOk;
uniform float uGris, uNeige;
uniform float uHaut, uTotal, uBesoin, uPas, uFin, uTrace, uTemps, uEclat, uAnneau, uDensite, uNuages, uVolutes, uTangente, uTerme, uExpo, uCourbes;
uniform vec2 uSeuils;
uniform vec3 uBandes;
${NAPPE('texture2D(tGrain, ', ')')}
// un trait là où v passe par un entier ; il s'éteint quand les courbes deviennent plus serrées que l'écran
float ligne(float v, float w) {
  float f = fwidth(v);
  float d = abs(fract(v - .5) - .5) / max(f, 1e-6);
  return (1. - smoothstep(w - .6, w + .6, d)) * clamp(1.7 - f * 2.6, 0., 1.);
}
// un trait à l'altitude s
float niveau(float a, float s, float w) { return 1. - smoothstep(w - .6, w + .6, abs(a - s) / max(fwidth(a), 1e-6)); }
void main() {
  // la place du point dans les images du terrain (leurs points tombent sur ceux du maillage), et au sol pour le grain
  vec2 sol0 = vP.xz / ${(2 * ETENDUE).toFixed(3)} + .5;
  vec4 t = texture2D(tTerrain, (vT * (uCotes.x - 1.) + .5) / uCotes.x);
  vec4 n3 = texture2D(tGrain, sol0 * 131. + .11);
  vec3 photo = texture2D(tPhoto, (vT * (uCotes.y - 1.) + .5) / uCotes.y).rgb;
  // la pente : celle du terrain, cassée par le grain de la roche (plus fort sur les faces raides)
  vec2 s = t.rg * 2. - 1.;
  vec2 g0 = s * abs(s) * ${PENTE.toFixed(1)}, g = g0 * uHaut;
  float raide = 1. - inversesqrt(1. + dot(g0, g0) * .7);                                     // la raideur du vrai terrain : la matière ne change pas avec les montants
  vec2 gd = (n3.rg - .5) * 1.2 * (.1 + .9 * raide);
  vec3 N = normalize(vec3(-(g.x + gd.x), 1., -(g.y + gd.y)));
  // la matière : la vraie photographie du massif (prise l'été, en plein jour) donne la roche, la glace et ses crevasses ;
  // la neige fraîche, calculée, la recouvre là où la pente la laisse tenir, plus haut que les alpages
  float clair = dot(photo, vec3(.3, .52, .18));
  vec3 sol = mix(vec3(clair), photo, .82 * (1. - uGris));
  sol = sol * (.55 + .6 * sol) * mix(1., .62 + .5 * clair, uGris);                           // un peu plus de contraste : les ombres de la photo se creusent, la glace reste claire
  float tient = raide - (1. - vO) * .26 - (n3.b - .5) * .04;
  float neige = (1. - smoothstep(.17, .25, tient)) * smoothstep(.16, .36, t.a) * uNeige;
  vec3 matiere = mix(sol, cNeige * (.9 + .1 * clair), neige);
  // la lumière : le soleil rasant (l'ombre portée des arêtes, la ligne d'ombre de l'aube), puis le ciel
  float portee = smoothstep(-.04, .06, uTangente - t.b * ${HORIZON.toFixed(1)} * uHaut);
  float jour = smoothstep(uTerme - .16, uTerme + .1, vP.y) * portee;
  vec3 col = matiere * (cSoleil * max(dot(N, uSoleil), 0.) * jour + cCiel * (.4 + .6 * N.y) * vO + cRebond * (.62 - .38 * N.y) * vO);
  vec3 V = normalize(uOeil - vP);
  col += cSoleil * pow(max(dot(normalize(V + uSoleil), N), 0.), 40.) * neige * jour * .2;     // la neige brille un peu
  col = 1. - exp(-col * uExpo);
  // l'air : la brume avec la distance, et le pied qui se perd dans la nappe
  float voile = 0.;
  if (vP.y - uNuages < uVolutes + .05) {                                                     // la brume ne se calcule que près des vallées
    vec2 inutile;
    voile = smoothstep(.045, -.008, vP.y - uNuages - (volutes(vP.xz, uTemps, inutile) - .3) * uVolutes);
  }
  col = mix(col, mix(cVoile, cBrume, .25), voile * .96);
  col = mix(col, cBrume, 1. - exp(-length(uOeil - vP) * uDensite * (1. + .5 * voile)));
  // la carte, dessinée par-dessus : les étages (un pilier par tranche d'altitude) et les courbes de niveau
  float a = vU * uTotal, w = fwidth(a) * 1.3;
  float e2 = smoothstep(uSeuils.x - w, uSeuils.x + w, a), e3 = smoothstep(uSeuils.y - w, uSeuils.y + w, a);
  float allume = mix(mix(uBandes.x, uBandes.y, e2), uBandes.z, e3);
  col *= 1. - .56 * (max(uBandes.x, max(uBandes.y, uBandes.z)) - allume);                    // un étage montré : les autres passent à l'ombre
  float massif = smoothstep(.02, .07, vU) * (1. - voile);
  float courbes = max(ligne(a / (4. * uPas), .8) * uFin, ligne(a / (8. * uPas), .8));        // les courbes maîtresses seulement : la carte reste discrète
  float trace = 1. - smoothstep(uTrace - .06, uTrace, vU);                                    // elles se tracent du pied vers le sommet
  float balai = exp(-pow((vU - fract(uTemps * .055) * 1.3 + .15) * 15., 2.)) * uEclat;
  col = mix(col, cTrait, courbes * (.1 + .3 * balai) * trace * massif * uCourbes);
  float limites = max(niveau(a, uSeuils.x, 1.) * max(uBandes.x, uBandes.y), niveau(a, uSeuils.y, 1.) * max(uBandes.y, uBandes.z));
  col = mix(col, cTrait, limites * massif * mix(.95, .8, uGris));
  // le besoin, quand le sommet le dépasse : sa courbe, d'un trait net
  col = mix(col, cOk, niveau(a, uBesoin, 1.6) * massif * step(uBesoin, uTotal * .999) * uAnneau);
  gl_FragColor = vec4(col, 1.);
}`;
const SOMMETS_NUAGES = `
attribute vec2 aP;
uniform sampler2D tGrain;
uniform mat4 uM;
uniform vec2 uD;
uniform float uY, uVolutes, uTemps, uPortee;
varying vec3 vP;
${NAPPE('texture2DLod(tGrain, ', ', 0.)')}
void main() {
  vec2 p = aP * uPortee, inutile;
  // au bord du maillage, les volutes s'aplanissent : elles rejoignent la nappe lointaine, qui est plate
  float bord = 1. - smoothstep(.72, 1., max(abs(aP.x), abs(aP.y)));
  vP = vec3(p.x, uY + (volutes(p, uTemps, inutile) - .3) * uVolutes * bord, p.y);
  gl_Position = uM * vec4(vP, 1.);
  gl_Position.xy += uD * gl_Position.w;
}`;
const POINTS_NUAGES = `
precision highp float;
varying vec3 vP;
uniform sampler2D tGrain;
uniform vec3 uOeil, uSoleil, cBrume, cNuage, cOmbre;
uniform float uTemps, uDensite, uNappe;
${NAPPE('texture2D(tGrain, ', ')')}
void main() {
  vec2 pente;
  float h = volutes(vP.xz, uTemps, pente);
  vec3 N = normalize(vec3(-pente.x * 3.4, 1., -pente.y * 3.4));
  // le dessus des volutes prend la lumière, les creux restent dans l'ombre de la nappe
  float clair = clamp(.12 + .56 * min(h, 1.) + (.3 + .75 * max(dot(N, uSoleil), 0.)) * uNappe * (.4 + .6 * min(h, 1.)), 0., 1.);
  vec3 col = mix(cOmbre, cNuage, clair);
  col = mix(col, cBrume, 1. - exp(-length(uOeil - vP) * uDensite * 1.5));
  gl_FragColor = vec4(col, 1.);
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
 * @param {{derive?: boolean, parallaxe?: boolean, fige?: boolean, taille?: number[], couleurs?: Record<string, string>}} [options]
 */
export function creerRelief(toile, options = {}) {
  const gl = toile.getContext('webgl', { antialias: (devicePixelRatio || 1) < 1.5, alpha: true, premultipliedAlpha: true });   // sur un écran fin, le lissage ne se voit pas : on s'en passe
  // il faut les dérivées (traits nets) et la lecture d'une texture depuis les sommets (les volutes de la nappe)
  if (!gl || !gl.getExtension('OES_standard_derivatives') || !gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)) return null;
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches, fige = !!options.fige;
  const tactile = matchMedia('(pointer: coarse)').matches, T = TERRAIN;
  if (!T) return null;   // le terrain n'est pas chargé (voir chargerTerrain)
  const M = maillage(tactile ? 144 : 200, T);

  /** @type {any} */ let P = null;   // programmes, tampons, textures et adresses des réglages : refaits si le contexte est perdu
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
    const texture = (cote, octets, repete) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (octets instanceof HTMLImageElement) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, octets);   // la photographie, telle quelle
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cote, cote, 0, gl.RGBA, gl.UNSIGNED_BYTE, octets);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repete ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repete ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      return t;
    };
    const ciel = programme(SOMMETS_CIEL, POINTS_CIEL), massif = programme(SOMMETS_MASSIF, POINTS_MASSIF), nuages = programme(SOMMETS_NUAGES, POINTS_NUAGES), anneau = programme(SOMMETS_ANNEAU, POINTS_ANNEAU);
    const BRUME = 96, volutes = new Float32Array(BRUME * BRUME * 2);
    for (let j = 0; j < BRUME; j++) for (let i = 0; i < BRUME; i++) volutes.set([i / (BRUME - 1) * 2 - 1, j / (BRUME - 1) * 2 - 1], (j * BRUME + i) * 2);
    const facesBrume = grille(BRUME);
    const SEGMENTS = 160, cercle = new Float32Array((SEGMENTS + 1) * 4);
    for (let i = 0; i <= SEGMENTS; i++) cercle.set([i / SEGMENTS, -1, i / SEGMENTS, 1], i * 4);
    P = { ciel, massif, nuages, anneau, points: tampon(gl.ARRAY_BUFFER, M.points), faces: tampon(gl.ELEMENT_ARRAY_BUFFER, M.faces),
          ecran: tampon(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])), mer: tampon(gl.ARRAY_BUFFER, new Float32Array([-LOIN, -LOIN, LOIN, -LOIN, -LOIN, LOIN, LOIN, LOIN])),
          volutes: tampon(gl.ARRAY_BUFFER, volutes), facesBrume: tampon(gl.ELEMENT_ARRAY_BUFFER, facesBrume), nBrume: facesBrume.length,
          cercle: tampon(gl.ARRAY_BUFFER, cercle), segments: SEGMENTS, terrain: texture(T.n, T.carte, false), grain: texture(COTE_GRAIN, grain(), true), photo: texture(0, T.photo, false),
          aE: gl.getAttribLocation(ciel.p, 'aE'), aP: gl.getAttribLocation(massif.p, 'aP'), aU: gl.getAttribLocation(massif.p, 'aU'), aT: gl.getAttribLocation(massif.p, 'aT'),
          aN: gl.getAttribLocation(nuages.p, 'aP'), aA: gl.getAttribLocation(anneau.p, 'aA') };
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  }
  try { monter(); } catch (erreur) { console.error(erreur); return null; }

  // ---- couleurs : lues dans la feuille de style, sur la toile elle-même (le thème et la marque s'y appliquent)
  const sonde = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const temoin = document.createElement('i');
  temoin.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
  /** @type {Record<string, number[]>} */ let C = {};
  let sombre = 0;
  function lireCouleurs() {
    if (options.couleurs) C = Object.fromEntries(Object.entries(options.couleurs).map(([cle, c]) => [cle, hex(c)]));   // couleurs imposées (image hors écran) : « #rrggbb »
    else {
      (toile.parentElement ?? document.body).append(temoin);
      const lire = (nom, secours) => {
        temoin.style.color = secours; temoin.style.color = `var(${nom}, ${secours})`;
        if (!sonde) return [0.5, 0.5, 0.5];
        sonde.clearRect(0, 0, 1, 1); sonde.fillStyle = '#000'; sonde.fillStyle = getComputedStyle(temoin).color; sonde.fillRect(0, 0, 1, 1);
        const [r, v, b] = sonde.getImageData(0, 0, 1, 1).data;
        return [r / 255, v / 255, b / 255];
      };
      C = { fond: lire('--relief-fond', '#f3efe6'), trait: lire('--relief-trait', '#13161b'), besoin: lire('--lacune', '#dc3b26'), ok: lire('--ok', '#1f8a5b') };
      temoin.remove();
    }
    sombre = 0.2126 * C.fond[0] + 0.7152 * C.fond[1] + 0.0722 * C.fond[2] < 0.4 ? 1 : 0;
  }
  lireCouleurs();

  // ---- état : les montants, la vue et l'heure voulus, et leurs valeurs du moment, qui les rejoignent en douceur
  const voulu = { p1: 26, p2: 30, p3: 9, besoin: 80, b1: 1, b2: 1, b3: 1, anneau: 1, montee: 1, trace: 1.1, eclat: 1, heure: 0.3, courbes: 1,
                  azimut: 0.6, elevation: 0.5, distance: 3.4, cibleY: 0.3, dx: 0, dy: 0 };
  const etat = { ...voulu };
  const LENTEUR = { p1: 0.34, p2: 0.34, p3: 0.34, besoin: 0.34, b1: 0.3, b2: 0.3, b3: 0.3, anneau: 0.3, montee: 0.5, trace: 0.55, eclat: 0.5, heure: 0.9, courbes: 0.4,
                    azimut: 0.42, elevation: 0.42, distance: 0.42, cibleY: 0.42, dx: 0.42, dy: 0.42 };
  let largeur = 0, hauteur = 0, matrice = /** @type {number[]} */ ([]), decalage = [0, 0], azimutVu = 0, temps = fige ? 12 : 0, instant = 0, image = 0, visible = true, propre = false;
  let px = 0, py = 0, vx = 0, vy = 0;   // pointeur (−1 à 1) : valeur voulue et valeur adoucie
  let voulue = true;                    // la page peut suspendre le dessin quand le relief est recouvert
  let allegement = 1, lentes = 0;       // carte graphique à la peine : on dessine moins de points (voir avancer)
  let plafonne = false;                 // l'écran lui-même tourne à 30 images par seconde : inutile de réduire
  /** @type {{avant: number, images: number, rapides: number}|null} */ let essai = null;
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
             pas, fin: 1 - (rang - Math.floor(rang)), equidistance: 4 * pas };
  }

  function dessiner() {
    if (!P || gl.isContextLost()) return;
    const m = mesures(), rapport = Math.max(0.2, largeur / Math.max(1, hauteur));
    const azimut = etat.azimut + (options.derive === false || calme || fige ? 0 : 0.16 * Math.sin(temps * 0.13)) + vx * 0.22;
    const elevation = Math.min(1.5607, Math.max(-0.06, etat.elevation - vy * 0.05));
    const cible = [0, etat.cibleY, 0];
    const oeil = [cible[0] + etat.distance * Math.cos(elevation) * Math.sin(azimut), cible[1] + etat.distance * Math.sin(elevation), cible[2] + etat.distance * Math.cos(elevation) * Math.cos(azimut)];
    const haut = [-Math.sin(elevation) * Math.sin(azimut), Math.cos(elevation), -Math.sin(elevation) * Math.cos(azimut)];
    matrice = produit(perspective(0.62, rapport, 0.1, 170), regard(oeil, cible, haut));
    decalage = [etat.dx, etat.dy]; azimutVu = azimut;

    // l'heure : sa lumière, puis le soleil, toujours du même côté (+x), plus ou moins haut
    const L = sombre ? lumiere(etat.heure) : lumierePapier(C.fond);
    const norme = Math.hypot(1, L.tangente), soleil = [1 / norme, L.tangente / norme, 0];
    const nappe = 0.035 * m.hautSommet + 0.03, volutes = 0.055, voile = entre(L.ombre, L.nuage, 0.5);   // la mer de brouillard : au fond des vallées
    const air = u => {
      gl.uniform3fv(u.uOeil, oeil); gl.uniform3fv(u.uSoleil, soleil); gl.uniform3fv(u.cSoleil, L.soleil); gl.uniform3fv(u.cBrume, L.brume);
      gl.uniform1f(u.uDensite, L.densite); gl.uniform1f(u.uTemps, temps); gl.uniform1f(u.uHaut, m.hautSommet); gl.uniform1i(u.tTerrain, 0); gl.uniform1i(u.tGrain, 1);
    };
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.terrain);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, P.grain);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, P.photo);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let u;
    // le massif
    u = P.massif.u;
    gl.useProgram(P.massif.p); gl.depthMask(true);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.points); gl.enableVertexAttribArray(P.aP); gl.enableVertexAttribArray(P.aU); gl.enableVertexAttribArray(P.aT);
    gl.vertexAttribPointer(P.aP, 2, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(P.aU, 2, gl.FLOAT, false, 24, 8); gl.vertexAttribPointer(P.aT, 2, gl.FLOAT, false, 24, 16);
    air(u);
    gl.uniformMatrix4fv(u.uM, false, matrice); gl.uniform2f(u.uD, decalage[0], decalage[1]);
    gl.uniform3fv(u.cCiel, L.ciel); gl.uniform3fv(u.cVoile, voile); gl.uniform3fv(u.cRebond, entre(L.ombre, L.nuage, 0.35 + 0.5 * L.nappe).map(v => v * (0.5 + 0.4 * L.nappe))); gl.uniform3fv(u.cTrait, C.trait); gl.uniform3fv(u.cOk, C.ok);
    gl.uniform3fv(u.cNeige, sombre ? [0.93, 0.95, 0.99] : [1, 1, 1]); gl.uniform1f(u.uGris, sombre ? 0 : 1); gl.uniform1f(u.uNeige, sombre ? 0.78 : 0.4); gl.uniform1i(u.tPhoto, 2); gl.uniform2f(u.uCotes, T.n, T.photo.naturalWidth);   // sur papier : une photographie en noir et blanc
    gl.uniform1f(u.uTotal, m.total); gl.uniform1f(u.uBesoin, etat.besoin); gl.uniform1f(u.uPas, m.pas); gl.uniform1f(u.uFin, m.fin);
    gl.uniform1f(u.uTrace, etat.trace); gl.uniform1f(u.uEclat, calme || fige ? 0 : etat.eclat); gl.uniform1f(u.uAnneau, etat.anneau); gl.uniform1f(u.uCourbes, etat.courbes);
    gl.uniform1f(u.uNuages, nappe); gl.uniform1f(u.uVolutes, volutes); gl.uniform1f(u.uTangente, L.tangente); gl.uniform1f(u.uTerme, L.terme * m.hautSommet); gl.uniform1f(u.uExpo, sombre ? 1.5 : 1.9);
    gl.uniform2f(u.uSeuils, etat.p1, etat.p1 + etat.p2); gl.uniform3f(u.uBandes, etat.b1, etat.b2, etat.b3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, P.faces);
    gl.drawElements(gl.TRIANGLES, M.faces.length, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(P.aP); gl.disableVertexAttribArray(P.aU); gl.disableVertexAttribArray(P.aT);

    // la mer de nuages : au loin une nappe plate, autour du massif des volutes en relief (le maillage du massif, étiré)
    u = P.nuages.u;
    gl.useProgram(P.nuages.p);
    gl.enableVertexAttribArray(P.aN);
    air(u);
    gl.uniformMatrix4fv(u.uM, false, matrice); gl.uniform2f(u.uD, decalage[0], decalage[1]);
    gl.uniform3fv(u.cNuage, L.nuage); gl.uniform3fv(u.cOmbre, L.ombre); gl.uniform1f(u.uNappe, L.nappe);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.volutes); gl.vertexAttribPointer(P.aN, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, P.facesBrume);
    gl.uniform1f(u.uY, nappe); gl.uniform1f(u.uVolutes, volutes); gl.uniform1f(u.uPortee, MER);
    gl.drawElements(gl.TRIANGLES, P.nBrume, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.mer); gl.vertexAttribPointer(P.aN, 2, gl.FLOAT, false, 0, 0);   // la nappe lointaine, après : les volutes la cachent autour du massif
    gl.uniform1f(u.uY, nappe - 0.34 * volutes); gl.uniform1f(u.uVolutes, 0); gl.uniform1f(u.uPortee, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(P.aN);

    // le ciel : en dernier, au plus loin — il ne se dessine que là où ni le terrain ni la brume ne le cachent
    u = P.ciel.u;
    gl.useProgram(P.ciel.p); gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.ecran); gl.enableVertexAttribArray(P.aE); gl.vertexAttribPointer(P.aE, 2, gl.FLOAT, false, 0, 0);
    air(u);
    gl.uniformMatrix4fv(u.uInv, false, inverse(matrice) ?? matrice); gl.uniform2f(u.uD, decalage[0], decalage[1]);
    gl.uniform3fv(u.cZenith, L.zenith); gl.uniform3fv(u.cHorizon, L.horizon); gl.uniform3fv(u.cAube, L.aube); gl.uniform3fv(u.cChaine, L.chaine);
    gl.uniform1f(u.uLueur, L.lueur); gl.uniform1f(u.uDisque, L.disque);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(P.aE);


    // le besoin : un plan d'altitude à peine teinté, et son anneau en pointillé
    if (etat.anneau > 0.01) {
      u = P.anneau.u;
      gl.useProgram(P.anneau.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, P.cercle);
      gl.enableVertexAttribArray(P.aA); gl.vertexAttribPointer(P.aA, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(u.uM, false, matrice); gl.uniform2f(u.uD, decalage[0], decalage[1]);
      gl.uniform3f(u.uCentre, M.sommet[0], m.hautBesoin, M.sommet[1]); gl.uniform1f(u.uTemps, temps);
      const manque = etat.besoin > m.total * 1.001;
      gl.uniform3fv(u.cTeinte, manque ? entre(C.besoin, [0.78, 0.16, 0.08], sombre ? 0.75 * L.nappe : 0) : C.ok);   // sur un ciel clair, un rouge plus soutenu
      gl.uniform2f(u.uVue, toile.width, toile.height);
      gl.uniform1f(u.uEcran, 0); gl.uniform1f(u.uRayon, ANNEAU / 2); gl.uniform1f(u.uEpais, ANNEAU / 2); gl.uniform1f(u.uTirets, 0); gl.uniform1f(u.uAlpha, 0.12 * etat.anneau);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (P.segments + 1) * 2);
      gl.uniform1f(u.uEcran, 1); gl.uniform1f(u.uRayon, ANNEAU); gl.uniform1f(u.uEpais, 1.8 * toile.width / Math.max(1, largeur)); gl.uniform1f(u.uTirets, 72); gl.uniform1f(u.uAlpha, etat.anneau);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (P.segments + 1) * 2);
      gl.disableVertexAttribArray(P.aA);
    }
    gl.depthMask(true);
    for (const suivre of suiveurs) suivre(relief);
  }

  function avancer(maintenant) {
    image = 0;
    const brut = maintenant - instant, ecoule = Math.min(0.064, Math.max(0.001, brut / 1000));
    instant = maintenant;
    // La carte graphique ne suit pas (une quarantaine d'images lentes de suite) : on dessine moins fin, d'un cran, et
    // on regarde. Si les images redeviennent rapides, c'était bien la carte : on garde. Si rien ne change, c'est
    // l'écran ou un mode d'économie qui plafonne à 30 images par seconde : on rend sa finesse à l'image et on n'y
    // touche plus (sauf vraie lenteur, sous 28 images par seconde).
    if (!calme && !fige && !options.taille) {
      const lente = brut > (plafonne ? 36 : 25) && brut < 250;
      lentes = lente ? lentes + 1 : 0;
      if (essai) {
        essai.images++; if (brut < 25) essai.rapides++;
        if (essai.images >= 36) {
          if (essai.rapides < 12) { allegement = essai.avant; plafonne = true; taille(); }
          essai = null; lentes = 0;
        }
      } else if (lentes > 40 && allegement > 0.6) {
        if (brut <= 36 && !plafonne) essai = { avant: allegement, images: 0, rapides: 0 };
        allegement = Math.max(0.6, allegement * 0.8); lentes = 0; taille();
      }
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
  const hauteurEn = (x, z) => lire(T, T.h, x, z);

  /** Les points de l'anneau le plus haut et le plus bas à l'écran : l'étiquette du besoin se pose au-dessus, celle de la lacune en dessous. */
  function bords(y) {
    let dessus = { x: 0, y: 1e9, devant: true }, dessous = { x: 0, y: -1e9, devant: true };
    for (let k = 0; k < 32; k++) {
      const angle = (k / 32) * TOUR, p = relief.projeter(M.sommet[0] + ANNEAU * Math.cos(angle), y, M.sommet[1] + ANNEAU * Math.sin(angle));
      if (p.y < dessus.y) dessus = p;
      if (p.y > dessous.y) dessous = p;
    }
    return { dessus, dessous };
  }
  /** Le point du versant, à droite du sommet vu d'ici, à l'altitude y : là où s'accroche l'étiquette d'un étage. */
  function flanc(y, hautSommet) {
    const dx = Math.cos(azimutVu), dz = -Math.sin(azimutVu), [sx, sz] = M.sommet;
    let s = 0;
    while (s < 1.2 && hauteurEn(sx + dx * s, sz + dz * s) * hautSommet > y) s += 0.005;
    return relief.projeter(sx + dx * s, y, sz + dz * s);
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
    /**
     * La mise en scène : étages montrés (0 à 1), anneau, montée du massif, tracé et force des courbes, éclat du
     * balayage, heure (0 : heure bleue, 0,25 : première lueur, 0,5 : lever du soleil, 1 : plein jour).
     */
    scene(reglages, immediat = false) {
      if (reglages.bandes) reglages.bandes.forEach((v, i) => { voulu['b' + (i + 1)] = v; if (immediat) etat['b' + (i + 1)] = v; });
      for (const cle of ['anneau', 'montee', 'trace', 'eclat', 'heure', 'courbes']) if (Number.isFinite(reglages[cle])) { voulu[cle] = reglages[cle]; if (immediat) etat[cle] = reglages[cle]; }
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
      const milieux = [etat.p1 / 2, etat.p1 + etat.p2 / 2, etat.p1 + etat.p2 + etat.p3 / 2].map(f => m.hautSommet * f / total);
      return { ...m, p1: etat.p1, p2: etat.p2, p3: etat.p3, besoin: etat.besoin, sommet: a(m.hautSommet), anneau: a(m.hautBesoin), pied: a(0),
               ...bords(m.hautBesoin), etages: milieux.map(a), flancs: milieux.map(y => flanc(y, m.hautSommet)) };
    },
    /** L'altitude (francs par an) sous un point de l'écran, ou `null` hors du massif. */
    sonder(clientX, clientY) {
      const boite = toile.getBoundingClientRect(), inv = matrice.length ? inverse(matrice) : null;
      if (!inv || !boite.width) return null;
      const nx = ((clientX - boite.left) / boite.width) * 2 - 1 - decalage[0], ny = 1 - ((clientY - boite.top) / boite.height) * 2 - decalage[1];
      const pres = applique(inv, nx, ny, -1), loin = applique(inv, nx, ny, 1), m = mesures();
      const A = pres.slice(0, 3).map(v => v / pres[3]), B = loin.slice(0, 3).map(v => v / loin[3]);
      // le rayon part de l'œil ; on ne le suit que sur la traversée du massif (le lointain est à 170 unités)
      const portee = Math.min(1, 12 / Math.max(1e-6, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2])));
      const en = t => [A[0] + (B[0] - A[0]) * t * portee, A[1] + (B[1] - A[1]) * t * portee, A[2] + (B[2] - A[2]) * t * portee];
      let avant = 0;
      for (let k = 1; k <= 480; k++) {
        const t = k / 480, p = en(t);
        if (p[1] <= hauteurEn(p[0], p[2]) * m.hautSommet) {
          let a = avant, b = t;
          for (let i = 0; i < 10; i++) { const c = (a + b) / 2, q = en(c); if (q[1] <= hauteurEn(q[0], q[2]) * m.hautSommet) b = c; else a = c; }
          const q = en(b), h = hauteurEn(q[0], q[2]);
          return h > 0.1 ? { altitude: h * m.total, part: h, etage: h * m.total < etat.p1 ? 1 : h * m.total < etat.p1 + etat.p2 ? 2 : 3 } : null;
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
 * @param {{largeur?: number, hauteur?: number, couleurs: Record<string, string>, vue?: Vue, heure?: number}} options
 * @returns {string|null} l'image (adresse « data: »), ou `null` sans WebGL
 */
export function imageRelief(montants, { largeur = 1680, hauteur = 896, couleurs, vue, heure = 0.5 }) {
  const toile = document.createElement('canvas');
  const relief = creerRelief(toile, { fige: true, taille: [largeur, hauteur], couleurs });
  if (!relief) return null;
  relief.regler(montants, true);
  relief.viser(vue ?? { azimut: 0.55, elevation: 0.12, distance: 1.9, cibleY: 0.7, dx: 0.22, dy: 0.02 }, true);
  relief.scene({ bandes: [1, 1, 1], anneau: montants.besoin > 0 ? 1 : 0, montee: 1, trace: 1.1, eclat: 0, heure }, true);
  relief.redessiner();
  let image = null;
  try { image = toile.toDataURL('image/png'); } catch { /* toile illisible : la couverture garde son image d'origine */ }
  relief.detruire();
  return image;
}
