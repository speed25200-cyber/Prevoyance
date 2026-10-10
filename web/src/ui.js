// @ts-check
/** Petits outils d'interface partagés par les vues : création d'éléments, nombres qui comptent, graphiques SVG. */

/**
 * Crée un élément. `h('div', {class: 'x', onclick: f}, enfant, 'texte')`.
 * @param {string} balise @param {Record<string, any>} [attributs] @param {...(Node|string|null|undefined|false)} enfants
 * @returns {any}
 */
export function h(balise, attributs = {}, ...enfants) {
  const svg = ['svg', 'rect', 'path', 'line', 'circle', 'g', 'text', 'polyline', 'defs', 'pattern', 'linearGradient', 'stop', 'tspan'].includes(balise);
  const e = svg ? document.createElementNS('http://www.w3.org/2000/svg', balise) : document.createElement(balise);
  for (const [k, v] of Object.entries(attributs)) {
    if (v === false || v === undefined || v === null) continue;
    if (k === 'class') e.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) /** @type {any} */ (e).style.setProperty(p, String(x));
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  e.append(.../** @type {(Node|string)[]} */ (enfants.filter(x => x !== null && x !== undefined && x !== false)));
  return e;
}

/** @param {string} id @returns {HTMLElement} */
export const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * Fait compter un nombre jusqu'à sa nouvelle valeur (650 ms, décélération).
 * @param {HTMLElement} element @param {number} valeur @param {(x: number) => string} mise
 */
export function compter(element, valeur, mise) {
  const e = /** @type {any} */ (element);
  const depart = e._v ?? 0, debut = performance.now(), duree = 650;
  e._v = valeur;
  const jeton = e._jeton = Symbol('compte');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || depart === valeur || document.documentElement.classList.contains('natif')) { element.textContent = mise(valeur); return; }
  const pas = maintenant => {
    if (e._jeton !== jeton) return;
    const k = Math.min(1, (maintenant - debut) / duree), aise = 1 - Math.pow(1 - k, 4);
    element.textContent = mise(depart + (valeur - depart) * aise);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

/** Couleur d'une barre de couverture : une seule teinte, le chiffre dit le reste (pas de rouge ni de vert sur l'écran). */
export const couleurCouverture = () => 'var(--accent)';
export const COULEUR_PILIER = { 1: 'var(--p1)', 2: 'var(--p2)', 3: 'var(--p3)' };

/**
 * Colonnes empilées en SVG (scénarios, rapport imprimé). Chaque colonne : {libelle, couches: [{valeur, couleur}], repere?}.
 * Les hauteurs s'animent par CSS (transform), le SVG reste net à l'impression.
 * @param {{libelle: string, couches: {valeur: number, couleur: string}[], besoin?: number, actif?: boolean, note?: string}[]} colonnes
 * @param {{hauteur?: number, court: (x: number) => string, surClic?: (i: number) => void}} options
 */
export function colonnes(colonnes, { hauteur = 260, court, surClic }) {
  const largeur = 720, bas = 34, haut = 18, gauche = 44, n = colonnes.length;
  const rayon = document.documentElement.classList.contains('natif') ? 3 : 0;   // dans le navigateur : des colonnes nettes, sans arrondi
  const max = Math.max(1, ...colonnes.map(c => Math.max(c.besoin ?? 0, c.couches.reduce((s, x) => s + x.valeur, 0)))) * 1.08;
  const y = v => hauteur - bas - v / max * (hauteur - bas - haut);
  const pas = (largeur - gauche - 8) / n, lc = Math.min(54, pas * 0.62);
  const svg = h('svg', { viewBox: `0 0 ${largeur} ${hauteur}`, class: 'colonnes', role: 'img' });
  /** @type {any} */ (svg).__natif = { type: 'colonnes', surClic, colonnes: colonnes.map(c => ({ libelle: c.libelle, note: c.note ?? '', actif: !!c.actif, besoin: c.besoin ?? 0,
    couches: c.couches.map(x => Math.round(x.valeur)) })) };
  const brut = max / 4, p10 = Math.pow(10, Math.floor(Math.log10(Math.max(brut, 1)))), palier = [1, 2, 2.5, 5, 10].map(m => m * p10).find(p => p >= brut) ?? brut;
  for (let v = palier; v < max; v += palier) {
    svg.append(h('line', { x1: gauche, x2: largeur - 4, y1: y(v), y2: y(v), class: 'grille' }), h('text', { x: gauche - 8, y: y(v) + 4, class: 'axe', 'text-anchor': 'end' }, court(v)));
  }
  colonnes.forEach((c, i) => {
    const x = gauche + pas * i + (pas - lc) / 2;
    const groupe = h('g', { class: 'colonne' + (c.actif ? ' actif' : ''), style: { '--i': i }, ...(surClic ? { onclick: () => surClic(i), tabindex: 0, role: 'button' } : {}) });
    let base = 0;
    for (const couche of c.couches) {
      if (couche.valeur <= 0) continue;
      groupe.append(h('rect', { x, width: lc, y: y(base + couche.valeur), height: Math.max(0, y(base) - y(base + couche.valeur)), fill: couche.couleur, rx: rayon }));
      base += couche.valeur;
    }
    if (c.besoin && c.besoin > base) groupe.append(h('rect', { x, width: lc, y: y(c.besoin), height: y(base) - y(c.besoin), class: 'manque', rx: rayon }));
    if (c.besoin) groupe.append(h('line', { x1: x - 5, x2: x + lc + 5, y1: y(c.besoin), y2: y(c.besoin), class: 'besoin' }));
    groupe.append(h('rect', { x: gauche + pas * i, width: pas, y: haut, height: hauteur - bas - haut, fill: 'transparent' }));
    groupe.append(h('text', { x: x + lc / 2, y: hauteur - bas + 18, class: 'axe fort', 'text-anchor': 'middle' }, c.libelle));
    if (c.note) groupe.append(h('text', { x: x + lc / 2, y: Math.max(12, y(Math.max(base, c.besoin ?? 0)) - 7), class: 'axe note', 'text-anchor': 'middle' }, c.note));
    svg.append(groupe);
  });
  return svg;
}

/**
 * Couloir d'une simulation (10e, 50e, 90e centiles) en SVG.
 * @param {{annee: number, p10: number, p50: number, p90: number, verse: number}[]} points
 * @param {{court: (x: number) => string, ageDepart: number, hauteur?: number}} options
 */
export function couloir(points, { court, ageDepart, hauteur = 260 }) {
  const largeur = 720, bas = 30, haut = 14, gauche = 48;
  const max = Math.max(1, ...points.map(p => p.p90)) * 1.06, n = Math.max(1, points.length - 1);
  const x = i => gauche + (largeur - gauche - 10) * i / n, y = v => hauteur - bas - v / max * (hauteur - bas - haut);
  const svg = h('svg', { viewBox: `0 0 ${largeur} ${hauteur}`, class: 'couloir', role: 'img' });
  /** @type {any} */ (svg).__natif = { type: 'couloir', depart: ageDepart ?? 0, points: points.map(p => ({ annee: p.annee, p10: p.p10, p50: p.p50, p90: p.p90, verse: p.verse })) };
  const brut = max / 4, p10 = Math.pow(10, Math.floor(Math.log10(Math.max(brut, 1)))), palier = [1, 2, 2.5, 5, 10].map(m => m * p10).find(p => p >= brut) ?? brut;
  for (let v = palier; v < max; v += palier) {
    svg.append(h('line', { x1: gauche, x2: largeur - 4, y1: y(v), y2: y(v), class: 'grille' }), h('text', { x: gauche - 8, y: y(v) + 4, class: 'axe', 'text-anchor': 'end' }, court(v)));
  }
  const chemin = cle => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[cle]).toFixed(1)}`).join(' ');
  const zone = `${chemin('p90')} ${[...points].reverse().map((p, i) => `L${x(points.length - 1 - i).toFixed(1)},${y(p.p10).toFixed(1)}`).join(' ')} Z`;
  svg.append(h('path', { d: zone, class: 'zone' }), h('path', { d: chemin('verse'), class: 'verse' }), h('path', { d: chemin('p50'), class: 'mediane' }));
  const pasAxe = n > 24 ? 10 : 5;
  for (let i = 0; i <= n; i += pasAxe) svg.append(h('text', { x: x(i), y: hauteur - 8, class: 'axe', 'text-anchor': 'middle' }, String(ageDepart + i)));
  return svg;
}
