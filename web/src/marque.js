// @ts-check
/**
 * La marque de l'intermédiaire (courtier, compagnie) dans le rapport, tirée de son logo.
 *
 * Un logo arrive sous toutes les formes : sur fond blanc avec de grandes marges, sur fond transparent, en blanc pour
 * fond sombre, posé sur un aplat de couleur, en noir avec un seul détail coloré… Le logo est donc d'abord analysé :
 * son fond, le cadre de ce qui est réellement dessiné (les marges sont rognées), sa couleur principale et sa couleur
 * d'accent. Le thème du rapport s'en déduit : un bandeau, un filet d'accent, des textes toujours lisibles.
 * Tout se calcule sur l'appareil ; le logo n'en sort pas.
 */

/** @typedef {{r: number, g: number, b: number}} RVB */

const borne = x => Math.max(0, Math.min(255, Math.round(x)));
/** @param {RVB} c */
export const enHex = c => '#' + [c.r, c.g, c.b].map(v => borne(v).toString(16).padStart(2, '0')).join('');
/** @param {string|null|undefined} hex @returns {RVB|null} */
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
const ecart = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
const BLANC = { r: 255, g: 255, b: 255 }, NOIR = { r: 20, g: 22, b: 26 };
/** Saturation (0 à 1) et clarté (0 à 1) d'une couleur. @param {RVB} c */
function teinteDe(c) {
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b), l = (max + min) / 510, d = max - min;
  return { s: d === 0 ? 0 : d / (255 - Math.abs(max + min - 255)), l };
}
/** Une couleur « colorée » : ni grise, ni presque blanche, ni presque noire. @param {RVB} c */
const coloree = c => { const { s, l } = teinteDe(c); return s >= 0.3 && l >= 0.16 && l <= 0.86; };

/**
 * Analyse d'un logo à partir de ses points.
 * - `fond` : la couleur du fond quand les coins sont pleins et d'accord entre eux ; `null` pour un fond transparent
 *   (ou une image dont les coins diffèrent, une photo par exemple) ;
 * - `boite` : le cadre de ce qui est dessiné, sans les marges ; `null` si rien ne se détache ;
 * - `principale` : la couleur la plus présente du dessin ; `accent` : sa couleur vive la plus présente, si elle
 *   diffère de la principale et occupe au moins 0,6 % du dessin.
 * @param {Uint8ClampedArray|number[]} points suite RVBA @param {number} largeur @param {number} hauteur
 * @returns {{fond: RVB|null, boite: {x: number, y: number, l: number, h: number}|null, principale: RVB|null, accent: RVB|null}}
 */
export function analyser(points, largeur, hauteur) {
  const en = (x, y) => { const i = (y * largeur + x) * 4; return { r: points[i], g: points[i + 1], b: points[i + 2], a: points[i + 3] }; };
  const coins = [en(0, 0), en(largeur - 1, 0), en(0, hauteur - 1), en(largeur - 1, hauteur - 1)];
  const pleins = coins.filter(c => c.a >= 128);
  /** @type {RVB|null} */ let fond = null;
  if (pleins.length === 4 && pleins.every(c => ecart(c, pleins[0]) <= 36)) {
    fond = { r: borne(pleins.reduce((s, c) => s + c.r, 0) / 4), g: borne(pleins.reduce((s, c) => s + c.g, 0) / 4), b: borne(pleins.reduce((s, c) => s + c.b, 0) / 4) };
  }
  // le dessin : ce qui est opaque et se détache du fond
  let x0 = largeur, y0 = hauteur, x1 = -1, y1 = -1, total = 0;
  /** @type {Map<number, {n: number, r: number, g: number, b: number}>} */ const cases = new Map();
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const i = (y * largeur + x) * 4;
      if (points[i + 3] < 128) continue;
      const r = points[i], g = points[i + 1], b = points[i + 2];
      if (fond && Math.abs(r - fond.r) + Math.abs(g - fond.g) + Math.abs(b - fond.b) <= 54) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      total++;
      const cle = (r >> 4) << 8 | (g >> 4) << 4 | b >> 4;
      const c = cases.get(cle) ?? { n: 0, r: 0, g: 0, b: 0 };
      c.n++; c.r += r; c.g += g; c.b += b;
      cases.set(cle, c);
    }
  }
  if (!total) return { fond, boite: null, principale: null, accent: null };
  const couleurs = [...cases.values()].map(c => ({ n: c.n, c: { r: c.r / c.n, g: c.g / c.n, b: c.b / c.n } })).sort((a, b) => b.n - a.n);
  // les cases voisines d'une même couleur sont réunies (dégradés, lissage des bords)
  const reunir = centre => {
    const proches = couleurs.filter(k => ecart(k.c, centre) <= 48), n = proches.reduce((s, k) => s + k.n, 0);
    return { n, c: { r: borne(proches.reduce((s, k) => s + k.c.r * k.n, 0) / n), g: borne(proches.reduce((s, k) => s + k.c.g * k.n, 0) / n), b: borne(proches.reduce((s, k) => s + k.c.b * k.n, 0) / n) } };
  };
  const principale = reunir(couleurs[0].c).c;
  // l'accent : parmi les couleurs vives hors de la principale, la plus présente et la plus franche (une teinte
  // soutenue l'emporte sur son halo pâle, fréquent autour d'un détail lissé ou d'un logo de petite taille)
  const vives = couleurs.filter(k => coloree(k.c) && ecart(k.c, principale) > 90);
  let accent = null;
  if (vives.length) {
    const note = k => { const { s, l } = teinteDe(k.c); return k.n * s * s * Math.max(0.2, 1.2 - Math.abs(l - 0.5) * 1.8); };
    const coeur = vives.reduce((m, k) => (note(k) > note(m) ? k : m), vives[0]);
    const famille = vives.filter(k => ecart(k.c, coeur.c) <= 110), proches = famille.filter(k => ecart(k.c, coeur.c) <= 44);
    if (famille.reduce((n, k) => n + k.n, 0) >= total * 0.006) {
      const poids = proches.reduce((n, k) => n + k.n * teinteDe(k.c).s, 0);
      accent = { r: borne(proches.reduce((n, k) => n + k.c.r * k.n * teinteDe(k.c).s, 0) / poids), g: borne(proches.reduce((n, k) => n + k.c.g * k.n * teinteDe(k.c).s, 0) / poids),
                 b: borne(proches.reduce((n, k) => n + k.c.b * k.n * teinteDe(k.c).s, 0) / poids) };
    }
  }
  const marge = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  const bx = Math.max(0, x0 - marge), by = Math.max(0, y0 - marge);
  return { fond, principale, accent,
    boite: { x: bx, y: by, l: Math.min(largeur, x1 + marge + 1) - bx, h: Math.min(hauteur, y1 + marge + 1) - by } };
}

/**
 * Le thème du rapport tiré de l'analyse d'un logo (ou d'une couleur choisie à la main).
 * - `bande` : l'aplat de la couverture ; `encre` : le texte posé dessus ;
 * - `filet` : la couleur d'accent (filets, repères) ; `texte` : la même, assombrie au besoin pour s'écrire sur du
 *   blanc (contraste d'au moins 4,5) ; `claire` : un voile pour les fonds ;
 * - `piliers` : les trois teintes des graphiques ;
 * - `plaque` : la couleur de la plaque sous le logo, ou `null` quand le logo se pose directement sur la bande
 *   (logo clair sur fond transparent, ou logo qui porte déjà son fond de couleur).
 * @param {{fond?: string|null, principale?: string|null, accent?: string|null, choisie?: string|null}} m
 */
export function theme(m) {
  const F = deHex(m.fond), P = deHex(m.principale), A = deHex(m.accent), C = deHex(m.choisie);
  const fondFonce = F && luminance(F) < 0.55, logoClair = !F && P && luminance(P) > 0.7;
  // la bande : la couleur choisie ; sinon le fond du logo s'il est soutenu ; sinon la couleur principale si elle
  // porte du texte clair (sombre ou vive) ; sinon l'accent ; sinon une encre sombre
  const bande = C ?? (fondFonce ? F : P && !logoClair && (luminance(P) < 0.5 || coloree(P)) ? P : A ?? NOIR);
  const vif = [A, P, bande].find(c => c && coloree(c) && ecart(c, bande) > 60) ?? [A, P].find(c => c && coloree(c));
  const filet = C ?? vif ?? bande;
  let texte = filet;
  for (let pas = 0; pas < 20 && contraste(texte, BLANC) < 4.5; pas++) texte = melange(texte, NOIR, 0.12);
  const encre = contraste(bande, BLANC) >= contraste(bande, NOIR) ? BLANC : NOIR;
  // la plaque : le fond clair du logo (pour qu'il s'y fonde) ou du blanc ; aucune si le logo porte son fond sombre
  // (la bande le prolonge) ou s'il est dessiné en clair pour un fond sombre
  const plaque = fondFonce || logoClair ? null : F ?? BLANC;
  // sur la bande, le filet doit se voir : s'il s'y confond, on prend l'encre de la bande
  const filetBande = contraste(filet, bande) >= 1.6 ? filet : encre;
  // les trois teintes des graphiques (1er, 2e, 3e pilier) : de la plus soutenue à la plus claire, dans la famille de la marque
  const p1 = luminance(bande) < 0.45 ? bande : texte, p2 = ecart(filet, p1) > 60 ? filet : melange(p1, BLANC, 0.42), p3 = melange(p2, BLANC, 0.5);
  return { bande: enHex(bande), encre: enHex(encre), filet: enHex(filet), filetBande: enHex(filetBande), texte: enHex(texte),
           claire: enHex(melange(filet, BLANC, 0.9)), plaque: plaque ? enHex(plaque) : null, piliers: [enHex(p1), enHex(p2), enHex(p3)] };
}

/**
 * Prépare un logo : analyse, rognage des marges, couleurs. `null` si l'image ne se laisse pas lire.
 * @param {string} source image (adresse de données)
 * @returns {Promise<{image: string, ratio: number, fond: string|null, principale: string|null, accent: string|null}|null>}
 */
export function preparer(source) {
  return new Promise(resoudre => {
    if (!source) return resoudre(null);
    const image = new Image();
    image.onerror = () => resoudre(null);
    image.onload = () => {
      try {
        const echelle = Math.min(1, 1000 / image.naturalWidth, 1000 / image.naturalHeight);
        const l = Math.max(1, Math.round(image.naturalWidth * echelle)), h = Math.max(1, Math.round(image.naturalHeight * echelle));
        const toile = document.createElement('canvas');
        toile.width = l; toile.height = h;
        const dessin = /** @type {CanvasRenderingContext2D} */ (toile.getContext('2d', { willReadFrequently: true }));
        dessin.drawImage(image, 0, 0, l, h);
        const a = analyser(dessin.getImageData(0, 0, l, h).data, l, h);
        const b = a.boite ?? { x: 0, y: 0, l, h };
        const rognee = document.createElement('canvas');
        rognee.width = b.l; rognee.height = b.h;
        /** @type {CanvasRenderingContext2D} */ (rognee.getContext('2d')).drawImage(toile, b.x, b.y, b.l, b.h, 0, 0, b.l, b.h);
        resoudre({ image: rognee.toDataURL('image/png'), ratio: b.l / Math.max(1, b.h), fond: a.fond ? enHex(a.fond) : null,
                   principale: a.principale ? enHex(a.principale) : null, accent: a.accent ? enHex(a.accent) : null });
      } catch { resoudre(null); }
    };
    image.src = source;
  });
}

/** Dimensions (en millimètres) d'un logo de proportion `ratio` tenu dans un cadre. */
export function cadrer(ratio, largeurMax, hauteurMax) {
  const r = ratio > 0 ? ratio : 1, l = Math.min(largeurMax, hauteurMax * r);
  return { l: Math.round(l * 10) / 10, h: Math.round(l / r * 10) / 10 };
}
