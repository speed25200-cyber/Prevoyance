// @ts-check
/**
 * « Ligne de vie » : le revenu annuel selon l'âge, empilé par source, face au besoin. La lacune est la zone hachurée
 * entre les deux. Dessin sur canvas, à la fréquence de l'écran (120 Hz sur ProMotion).
 *
 * Rien n'est remplacé d'un coup : chaque valeur glisse vers sa cible (amortissement exponentiel), de sorte que
 * changer un chiffre du dossier ou de scénario déforme le graphique au lieu de le redessiner. La boucle s'arrête
 * dès que tout est en place.
 */

export const COUCHES = ['salaire', 'attente', 'pilier1', 'pilier2', 'pilier3'];
const VARIABLES = { salaire: '--salaire', attente: '--attente', pilier1: '--p1', pilier2: '--p2', pilier3: '--p3' };

/**
 * @param {HTMLCanvasElement} canvas @param {HTMLElement} bulle
 */
export function creerGraphique(canvas, bulle) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  /** @type {Map<number, {besoin: number, v: Record<string, number>}>} */
  const courant = new Map();
  /** @type {Map<number, {besoin: number, v: Record<string, number>}>} */
  let cible = new Map();
  let domaine = { a0: 25, a1: 90, max: 100000 }, vise = { ...domaine };
  /** @type {any} */
  let options = { reperes: [], chf: x => String(x), court: x => String(x), libelles: {}, ans: 'ans' };
  let glisse = /** @type {any} */ (null);                    // repère en cours de déplacement
  let largeur = 0, hauteur = 0, enCours = false, avant = 0, survol = /** @type {number|null} */ (null), couleurs = lireCouleurs();
  const marge = { g: 46, d: 14, h: 14, b: 30 };

  function lireCouleurs() {
    const s = getComputedStyle(document.documentElement), c = {};
    for (const [k, v] of Object.entries(VARIABLES)) c[k] = s.getPropertyValue(v).trim();
    c.encre = s.getPropertyValue('--encre').trim(); c.encre2 = s.getPropertyValue('--encre-2').trim(); c.encre3 = s.getPropertyValue('--encre-3').trim();
    c.filet = s.getPropertyValue('--filet').trim(); c.lacune = s.getPropertyValue('--lacune').trim(); c.surface = s.getPropertyValue('--surface').trim();
    return c;
  }

  function dimensionner() {
    const dpr = Math.min(devicePixelRatio || 1, 3);
    largeur = canvas.clientWidth; hauteur = canvas.clientHeight;
    canvas.width = Math.round(largeur * dpr); canvas.height = Math.round(hauteur * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lancer();
  }

  const X = age => marge.g + (age - domaine.a0) / Math.max(1e-6, domaine.a1 - domaine.a0) * (largeur - marge.g - marge.d);
  const Y = valeur => hauteur - marge.b - valeur / Math.max(1, domaine.max) * (hauteur - marge.h - marge.b);

  function hachures() {
    const motif = document.createElement('canvas');
    motif.width = motif.height = 8;
    const m = /** @type {CanvasRenderingContext2D} */ (motif.getContext('2d'));
    m.strokeStyle = couleurs.lacune; m.lineWidth = 2.2; m.lineCap = 'square';
    for (const d of [-8, 0, 8]) { m.beginPath(); m.moveTo(d, 8); m.lineTo(d + 8, 0); m.stroke(); }
    return /** @type {CanvasPattern} */ (ctx.createPattern(motif, 'repeat'));
  }

  function graduations(max) {
    const brut = max / 4, puissance = Math.pow(10, Math.floor(Math.log10(Math.max(brut, 1))));
    const pas = [1, 2, 2.5, 5, 10].map(m => m * puissance).find(p => p >= brut) ?? brut;
    const out = [];
    for (let v = pas; v <= max * 1.001; v += pas) out.push(v);
    return out;
  }

  function dessiner() {
    ctx.clearRect(0, 0, largeur, hauteur);
    if (!largeur) return;
    const ages = [...courant.keys()].filter(a => a >= Math.floor(domaine.a0) - 1 && a <= Math.ceil(domaine.a1)).sort((a, b) => a - b);
    ctx.font = '500 11.5px ' + getComputedStyle(document.body).fontFamily;
    ctx.textBaseline = 'middle';
    // grille horizontale
    for (const v of graduations(domaine.max)) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = couleurs.filet; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(marge.g, y); ctx.lineTo(largeur - marge.d, y); ctx.stroke();
      ctx.fillStyle = couleurs.encre3; ctx.textAlign = 'right';
      ctx.fillText(options.court(v), marge.g - 8, y);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(marge.g, 0, largeur - marge.g - marge.d, hauteur - marge.b + 1); ctx.clip();
    // couches empilées, une colonne par année
    const base = new Map(ages.map(a => [a, 0]));
    for (const cle of COUCHES) {
      ctx.beginPath();
      let trace = false;
      for (const a of ages) {
        const v = courant.get(a)?.v[cle] ?? 0;
        if (v < 0.5) continue;
        const b = base.get(a) ?? 0, x0 = X(a), x1 = X(a + 1);
        ctx.rect(x0, Y(b + v), x1 - x0 + 0.6, Y(b) - Y(b + v));
        base.set(a, b + v);
        trace = true;
      }
      if (trace) { ctx.fillStyle = couleurs[cle]; ctx.fill(); }
    }
    // lacune : entre le sommet de la pile et le besoin
    ctx.beginPath();
    for (const a of ages) {
      const besoin = courant.get(a)?.besoin ?? 0, haut = base.get(a) ?? 0;
      if (besoin - haut > 1) ctx.rect(X(a), Y(besoin), X(a + 1) - X(a) + 0.6, Y(haut) - Y(besoin));
    }
    ctx.globalAlpha = 0.16; ctx.fillStyle = couleurs.lacune; ctx.fill();
    ctx.globalAlpha = 0.85; ctx.fillStyle = hachures(); ctx.fill();
    ctx.globalAlpha = 1;
    // besoin : ligne en escalier, en tirets
    ctx.beginPath();
    let premier = true;
    for (const a of ages) {
      const besoin = courant.get(a)?.besoin ?? 0;
      if (besoin < 1) { premier = true; continue; }
      const y = Y(besoin);
      if (premier) ctx.moveTo(X(a), y); else ctx.lineTo(X(a), y);
      ctx.lineTo(X(a + 1), y);
      premier = false;
    }
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.8; ctx.strokeStyle = couleurs.encre; ctx.stroke(); ctx.setLineDash([]);
    // repères verticaux (retraite…)
    for (const r of options.reperes) {
      const x = Math.round(X(r.age)) + 0.5;
      ctx.strokeStyle = couleurs.encre2; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(x, marge.h); ctx.lineTo(x, hauteur - marge.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = couleurs.encre2; ctx.textAlign = x > largeur - 90 ? 'right' : 'left';
      ctx.fillText(r.libelle, x + (x > largeur - 90 ? -(r.glissable ? 16 : 6) : (r.glissable ? 16 : 6)), marge.h + 6);
      if (r.glissable) {                                        // poignée : on peut saisir le repère et le déplacer
        ctx.restore(); ctx.save();
        ctx.fillStyle = couleurs.encre; ctx.beginPath(); ctx.roundRect(x - 9, marge.h - 4, 18, 20, 7); ctx.fill();
        ctx.strokeStyle = couleurs.surface; ctx.lineWidth = 1.4; ctx.beginPath();
        for (const dx of [-3, 0, 3]) { ctx.moveTo(x + dx, marge.h + 2); ctx.lineTo(x + dx, marge.h + 10); }
        ctx.stroke();
        ctx.beginPath(); ctx.rect(marge.g, 0, largeur - marge.g - marge.d, hauteur - marge.b + 1); ctx.clip();
      }
    }
    // survol
    if (survol !== null && courant.has(survol)) {
      const x0 = X(survol), x1 = X(survol + 1);
      ctx.fillStyle = couleurs.encre; ctx.globalAlpha = 0.07; ctx.fillRect(x0, marge.h, x1 - x0, hauteur - marge.h - marge.b); ctx.globalAlpha = 1;
    }
    ctx.restore();
    // axe des âges
    ctx.textAlign = 'center'; ctx.fillStyle = couleurs.encre3;
    const pas = (domaine.a1 - domaine.a0) > 45 ? 10 : 5;
    for (let a = Math.ceil(domaine.a0 / pas) * pas; a <= domaine.a1; a += pas) ctx.fillText(String(a), X(a), hauteur - marge.b / 2 + 3);
  }

  function image(t) {
    const dt = Math.min((t - avant) / 1000, 0.05); avant = t;
    const k = 1 - Math.exp(-dt * 9);
    let bouge = false;
    const vers = (a, b) => { const n = a + (b - a) * k; if (Math.abs(b - n) > Math.max(0.5, Math.abs(b) * 0.0008)) { bouge = true; return n; } return b; };
    for (const cle of /** @type {const} */ (['a0', 'a1', 'max'])) domaine[cle] = vers(domaine[cle], vise[cle]);
    for (const age of new Set([...courant.keys(), ...cible.keys()])) {
      const c = courant.get(age) ?? { besoin: 0, v: {} }, but = cible.get(age);
      c.besoin = vers(c.besoin, but?.besoin ?? 0);
      let reste = c.besoin > 0.5;
      for (const cle of COUCHES) {
        c.v[cle] = vers(c.v[cle] ?? 0, but?.v[cle] ?? 0);
        if (c.v[cle] > 0.5) reste = true;
      }
      if (reste || but) courant.set(age, c); else courant.delete(age);
    }
    dessiner();
    if (bouge) requestAnimationFrame(image); else enCours = false;
  }

  function lancer() {
    if (enCours) return;
    enCours = true; avant = performance.now();
    requestAnimationFrame(image);
  }

  function montrerBulle(evenement) {
    const r = canvas.getBoundingClientRect();
    const x = evenement.clientX - r.left;
    const age = Math.floor(domaine.a0 + (x - marge.g) / Math.max(1, largeur - marge.g - marge.d) * (domaine.a1 - domaine.a0));
    const point = cible.get(age);
    if (!point || x < marge.g || x > largeur - marge.d) { cacherBulle(); return; }
    survol = age;
    const total = COUCHES.reduce((s, c) => s + (point.v[c] ?? 0), 0);
    const lignes = COUCHES.filter(c => (point.v[c] ?? 0) > 0.5)
      .map(c => `<div><span>${options.libelles[c] ?? c}</span><span>${options.chf(point.v[c])}</span></div>`).join('');
    const manque = Math.max(0, point.besoin - total);
    bulle.innerHTML = `<b>${age} ${options.ans}</b>${lignes}<div class="fort"><span>${options.libelles.besoin}</span><span>${options.chf(point.besoin)}</span></div>`
      + (manque > 1 ? `<div class="fort"><span>${options.libelles.lacune}</span><span>− ${options.chf(manque)}</span></div>` : '');
    bulle.hidden = false;
    const bw = bulle.offsetWidth, px = Math.min(Math.max(X(age + 0.5) - bw / 2, 4), largeur - bw - 4);
    bulle.style.transform = `translate3d(${px.toFixed(1)}px, ${Math.max(4, Y(Math.max(point.besoin, total)) - bulle.offsetHeight - 10).toFixed(1)}px, 0)`;
    lancer();
  }

  function cacherBulle() {
    if (survol === null && bulle.hidden) return;
    survol = null; bulle.hidden = true; lancer();
  }

  // saisir un repère déplaçable (l'âge de la retraite) et le faire glisser : le dossier suit, tout se recalcule
  const repereSous = evenement => {
    const x = evenement.clientX - canvas.getBoundingClientRect().left;
    return options.reperes.find(r => r.glissable && Math.abs(X(r.age) - x) < 18) ?? null;
  };
  const ageSous = evenement => {
    const x = evenement.clientX - canvas.getBoundingClientRect().left;
    return Math.round(vise.a0 + (x - marge.g) / Math.max(1, largeur - marge.g - marge.d) * (vise.a1 - vise.a0));
  };
  canvas.addEventListener('pointerdown', evenement => {
    glisse = repereSous(evenement);
    if (glisse) { try { canvas.setPointerCapture(evenement.pointerId); } catch { /* pointeur synthétique */ } cacherBulle(); evenement.preventDefault(); } else montrerBulle(evenement);
  });
  canvas.addEventListener('pointermove', evenement => {
    if (glisse) { options.surGlisser?.(ageSous(evenement), false); return; }
    canvas.style.cursor = repereSous(evenement) ? 'ew-resize' : '';
    montrerBulle(evenement);
  });
  const lacher = evenement => { if (!glisse) return; glisse = null; options.surGlisser?.(ageSous(evenement), true); };
  canvas.addEventListener('pointerup', lacher);
  canvas.addEventListener('pointercancel', lacher);
  canvas.addEventListener('pointerleave', () => { if (!glisse) cacherBulle(); });
  new ResizeObserver(dimensionner).observe(canvas);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { couleurs = lireCouleurs(); lancer(); });
  dimensionner();

  return {
    /**
     * @param {{age: number, besoin: number, v: Record<string, number>}[]} points
     * @param {{reperes: {age: number, libelle: string, glissable?: boolean}[], chf: (x: number) => string, court: (x: number) => string,
     *          libelles: Record<string, string>, ans: string, surGlisser?: (age: number, fin: boolean) => void}} opts
     */
    definir(points, opts) {
      options = opts;
      cible = new Map(points.map(p => [p.age, { besoin: p.besoin, v: p.v }]));
      if (points.length) {
        const sommet = Math.max(...points.map(p => Math.max(p.besoin, COUCHES.reduce((s, c) => s + (p.v[c] ?? 0), 0))));
        const cibleDomaine = { a0: points[0].age, a1: points[points.length - 1].age + 1, max: Math.max(1000, sommet * 1.12) };
        // pendant un glissement, l'échelle ne bouge pas : le repère reste sous le doigt
        vise = glisse ? { ...vise, max: Math.max(vise.max, cibleDomaine.max) } : cibleDomaine;
        if (!courant.size) domaine = { ...vise, max: vise.max * 1.6 };   // première image : les colonnes montent
      }
      if (!glisse) cacherBulle();
      lancer();
    },
  };
}
