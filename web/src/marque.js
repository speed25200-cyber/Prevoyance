// @ts-check
/**
 * La marque de l'intermédiaire (courtier, compagnie) dans le rapport : sa couleur est tirée de son logo, puis
 * déclinée pour rester lisible sur le papier — un aplat pour la couverture, une teinte sombre pour les titres, un
 * voile clair pour les fonds. Tout se calcule sur l'appareil ; le logo n'en sort pas.
 */

/** @typedef {{r: number, g: number, b: number}} RVB */

const borne = x => Math.max(0, Math.min(255, Math.round(x)));
/** @param {RVB} c */
export const enHex = c => '#' + [c.r, c.g, c.b].map(v => borne(v).toString(16).padStart(2, '0')).join('');
/** @param {string} hex @returns {RVB|null} */
export function deHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}

/** Luminance relative (WCAG). @param {RVB} c */
export function luminance(c) {
  const lin = v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** Contraste entre deux couleurs, de 1 à 21 (WCAG). @param {RVB} a @param {RVB} b */
export function contraste(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const melange = (a, b, part) => ({ r: a.r + (b.r - a.r) * part, g: a.g + (b.g - a.g) * part, b: a.b + (b.b - a.b) * part });
const BLANC = { r: 255, g: 255, b: 255 }, NOIR = { r: 20, g: 22, b: 26 };

/**
 * La couleur dominante d'une image : la teinte la plus présente parmi les points colorés (ni blancs, ni noirs, ni
 * gris, ni transparents). Un logo en noir ou en gris donne sa teinte sombre ; une image sans rien donne `null`.
 * @param {Uint8ClampedArray|number[]} points suite RVBA
 * @returns {RVB|null}
 */
export function dominante(points) {
  const cases = Array.from({ length: 12 }, () => ({ poids: 0, r: 0, g: 0, b: 0 }));
  const sombre = { poids: 0, r: 0, g: 0, b: 0 };
  let opaques = 0;
  for (let i = 0; i + 3 < points.length; i += 4) {
    if (points[i + 3] < 128) continue;
    opaques++;
    const r = points[i], g = points[i + 1], b = points[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510, ecart = max - min;
    const s = ecart === 0 ? 0 : ecart / (255 - Math.abs(max + min - 255));
    if (l < 0.35 && s < 0.22) { sombre.poids++; sombre.r += r; sombre.g += g; sombre.b += b; }
    if (s < 0.22 || l < 0.12 || l > 0.9) continue;
    let teinte = max === r ? (g - b) / ecart % 6 : max === g ? (b - r) / ecart + 2 : (r - g) / ecart + 4;
    if (teinte < 0) teinte += 6;
    const c = cases[Math.min(11, Math.floor(teinte * 2))];
    c.poids += s; c.r += r * s; c.g += g * s; c.b += b * s;
  }
  if (!opaques) return null;
  const forte = cases.reduce((m, c) => (c.poids > m.poids ? c : m), cases[0]);
  // assez de points colorés (2 % de l'image) : c'est la couleur de la marque
  if (forte.poids > opaques * 0.02) return { r: borne(forte.r / forte.poids), g: borne(forte.g / forte.poids), b: borne(forte.b / forte.poids) };
  // logo en noir ou en gris foncé : sa teinte sombre
  if (sombre.poids > opaques * 0.05) return { r: borne(sombre.r / sombre.poids), g: borne(sombre.g / sombre.poids), b: borne(sombre.b / sombre.poids) };
  return null;
}

/**
 * Les teintes du rapport tirées d'une couleur de marque.
 * - `couleur` : l'aplat (bandeau de couverture, filets) ;
 * - `encre` : le texte posé sur l'aplat (blanc ou presque noir, selon ce qui se lit le mieux) ;
 * - `texte` : la couleur assombrie au besoin pour s'écrire sur du blanc (contraste d'au moins 4,5) ;
 * - `claire` : un voile pour les fonds.
 * @param {string} hex @returns {{couleur: string, encre: string, texte: string, claire: string}|null}
 */
export function palette(hex) {
  const c = deHex(hex);
  if (!c) return null;
  const encre = contraste(c, BLANC) >= contraste(c, NOIR) ? BLANC : NOIR;
  let texte = c;
  for (let pas = 0; pas < 20 && contraste(texte, BLANC) < 4.5; pas++) texte = melange(texte, NOIR, 0.12);
  return { couleur: enHex(c), encre: enHex(encre), texte: enHex(texte), claire: enHex(melange(c, BLANC, 0.9)) };
}

/**
 * La couleur du logo, en « #rrggbb » ; chaîne vide si elle ne se laisse pas lire.
 * @param {string} source image (adresse de données) @returns {Promise<string>}
 */
export function couleurDuLogo(source) {
  return new Promise(resoudre => {
    if (!source) return resoudre('');
    const image = new Image();
    image.onerror = () => resoudre('');
    image.onload = () => {
      try {
        const cote = 72, toile = document.createElement('canvas');
        toile.width = cote; toile.height = cote;
        const dessin = /** @type {CanvasRenderingContext2D} */ (toile.getContext('2d', { willReadFrequently: true }));
        dessin.drawImage(image, 0, 0, cote, cote);
        const c = dominante(dessin.getImageData(0, 0, cote, cote).data);
        resoudre(c ? enHex(c) : '');
      } catch { resoudre(''); }
    };
    image.src = source;
  });
}
