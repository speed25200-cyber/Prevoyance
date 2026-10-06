// @ts-check
/**
 * La scène de l'en-tête : les trois piliers en vraie matière (pierre, bronze, verre), photographiés.
 *
 * Une seule grande image, recadrée en direct sur un canvas comme par une caméra : vue d'ensemble au repos, approche
 * d'une colonne quand on désigne un pilier, léger déplacement avec le pointeur. Chaque mouvement est amorti et suit
 * la fréquence de l'écran. Quand elle existe, une boucle filmée de la même scène (la lumière passe lentement sur
 * les colonnes) remplace l'image fixe : elle ne tourne que si la carte est visible, et jamais en mouvement réduit.
 * Sur un écran tactile (iPhone, iPad), pas de film : recopier une vidéo dans un canvas à chaque image y fait
 * scintiller la scène ; l'image fixe est animée par la feuille de style (lent zoom), sans rien redessiner.
 * Trois points restent posés sur les colonnes. La version claire ou sombre suit le thème de l'appareil.
 */

/** Position des colonnes dans l'image (fraction de la largeur et de la hauteur) : sommet de chaque colonne. */
const COLONNES = {
  sombre: [{ x: 0.704, y: 0.373 }, { x: 0.773, y: 0.243 }, { x: 0.848, y: 0.107 }],
  clair: [{ x: 0.702, y: 0.404 }, { x: 0.773, y: 0.28 }, { x: 0.845, y: 0.14 }],
};
const RAPPORT = 3840 / 1648;

/**
 * @param {HTMLCanvasElement} canvas @param {HTMLElement[]} reperes trois éléments, un par pilier
 */
export function creerScene(canvas, reperes) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const sombreMedia = matchMedia('(prefers-color-scheme: dark)'), calme = matchMedia('(prefers-reduced-motion: reduce)');
  const tactile = matchMedia('(pointer: coarse)');
  let theme = sombreMedia.matches ? 'sombre' : 'clair';
  let image = new Image(), prete = false;
  /** @type {HTMLVideoElement|null} */ let film = null;
  let filmPret = false, visible = true;
  // caméra : centre visé (fraction de l'image) et zoom ; `c` est l'état courant, `v` la cible
  const c = { x: 0.5, y: 0.5, z: 1 }, v = { x: 0.5, y: 0.5, z: 1 }, pointeur = { x: 0, y: 0 };
  let largeur = 0, hauteur = 0, enCours = false, avant = 0, vise = /** @type {number|null} */ (null);
  let vierge = true;                                           // le canvas vient d'être (re)créé : rien n'y est encore dessiné

  function charger() {
    prete = false; filmPret = false;
    image = new Image();
    image.decoding = 'async';
    image.onload = () => { prete = true; lancer(); };
    image.src = `images/colonnes-${theme}${Math.max(canvas.clientWidth, 1) * (devicePixelRatio || 1) > 1500 ? '' : '-m'}.webp`;
    film?.pause();
    film = null;
    if (calme.matches || tactile.matches) return;
    // la boucle filmée arrive après l'image ; si elle manque ou ne peut pas être lue, l'image reste
    const f = document.createElement('video');
    f.muted = true; f.loop = true; f.playsInline = true; f.preload = 'auto'; f.crossOrigin = 'anonymous';
    f.addEventListener('playing', () => { if (film === f) { filmPret = true; lancer(); } });
    f.addEventListener('error', () => { if (film === f) film = null; });
    f.src = `images/colonnes-${theme}.mp4`;
    film = f;
    if (visible) f.play().catch(() => {});
  }

  function dimensionner() {
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const l = canvas.clientWidth, ht = canvas.clientHeight, pl = Math.round(l * dpr), ph = Math.round(ht * dpr);
    // même taille : on ne touche à rien (changer la taille d'un canvas l'efface)
    if (pl === canvas.width && ph === canvas.height && l === largeur && ht === hauteur) return;
    largeur = l; hauteur = ht;
    canvas.width = pl; canvas.height = ph; vierge = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    cadrer();
    // dessin immédiat, avant l'affichage : sinon l'écran montre une image vide le temps d'un rafraîchissement
    c.x = vise === null ? v.x : c.x; c.y = vise === null ? v.y : c.y;
    dessiner();
    lancer();
  }

  /** Cible de la caméra : vue d'ensemble calée à droite (le texte est à gauche), ou approche d'une colonne. */
  function cadrer() {
    const col = COLONNES[theme];
    if (vise === null) {
      const ecran = largeur / Math.max(1, hauteur);
      v.z = 1;
      // cadre étroit (moitié d'écran, téléphone) : les trois colonnes au centre ; cadre large : colonnes à droite, texte à gauche
      v.x = ecran >= RAPPORT ? 0.5 : (ecran < 1.5 || largeur < 700) ? Math.min(1 - ecran / RAPPORT / 2, col[1].x)
        : Math.min(1 - ecran / RAPPORT / 2, Math.max(0.5, col[1].x - 0.22 * ecran / RAPPORT));
      v.y = 0.5;
    } else {
      v.z = 1.9; v.x = col[vise].x - 0.07; v.y = Math.min(0.62, col[vise].y + 0.2);
    }
  }

  function dessiner() {
    if (!largeur || !(prete || filmPret)) return;
    // le film n'est recopié que s'il a une image prête ; au moment où la boucle repart, on garde l'image déjà affichée
    const filmDispo = !!(filmPret && film && film.readyState >= 2 && !film.seeking && film.videoWidth);
    if (filmPret && film && !filmDispo && !(vierge && prete)) return;
    const source = filmDispo && film ? film : image;
    const sl = filmDispo && film ? film.videoWidth : image.naturalWidth, sh0 = filmDispo && film ? film.videoHeight : image.naturalHeight;
    if (!sl || !sh0) return;
    // rectangle source : l'image « couvre » la carte au zoom 1, puis la caméra s'approche
    const ecran = largeur / hauteur, rapport = sl / sh0;
    let sw = ecran >= rapport ? 1 : ecran / rapport, sh = ecran >= rapport ? rapport / ecran : 1;
    sw /= c.z; sh /= c.z;
    const cx = Math.min(1 - sw / 2, Math.max(sw / 2, c.x + pointeur.x * 0.012)), cy = Math.min(1 - sh / 2, Math.max(sh / 2, c.y + pointeur.y * 0.012));
    const sx = cx - sw / 2, sy = cy - sh / 2;
    // pas d'effacement : l'image couvre tout le cadre, et un cadre vidé puis non redessiné ferait un éclair
    try { ctx.drawImage(source, sx * sl, sy * sh0, sw * sl, sh * sh0, 0, 0, largeur, hauteur); vierge = false; } catch { /* image pas encore décodée */ }
    COLONNES[theme].forEach((col, i) => {
      const x = (col.x - sx) / sw * largeur, y = (col.y - sy) / sh * hauteur;
      reperes[i].style.transform = `translate3d(${x.toFixed(1)}px, ${(y + hauteur * 0.05).toFixed(1)}px, 0)`;
      reperes[i].classList.toggle('hors', x < 8 || x > largeur - 8 || y < 0);
    });
  }

  function image_(t) {
    const dt = Math.min((t - avant) / 1000, 0.05); avant = t;
    const k = 1 - Math.exp(-dt * 5.5);
    let bouge = false;
    for (const cle of /** @type {const} */ (['x', 'y', 'z'])) {
      const n = c[cle] + (v[cle] - c[cle]) * k;
      if (Math.abs(v[cle] - n) > 0.0004) { bouge = true; c[cle] = n; } else c[cle] = v[cle];
    }
    dessiner();
    // tant que la boucle filmée tourne à l'écran, on redessine à chaque image
    if (bouge || (filmPret && visible && film && !film.paused)) requestAnimationFrame(image_); else enCours = false;
  }

  function lancer() {
    if (enCours) return;
    enCours = true; avant = performance.now();
    requestAnimationFrame(image_);
  }

  sombreMedia.addEventListener('change', e => { theme = e.matches ? 'sombre' : 'clair'; charger(); cadrer(); });
  new ResizeObserver(dimensionner).observe(canvas);
  new IntersectionObserver(entrees => {
    visible = entrees[0].isIntersecting;
    if (!film) return;
    if (visible) { film.play().catch(() => {}); lancer(); } else film.pause();
  }).observe(canvas);
  charger();
  dimensionner();

  return {
    /** Approche d'un pilier (0, 1, 2) ou retour à la vue d'ensemble (`null`). */
    viser(pilier) { if (pilier === vise) return; vise = pilier; cadrer(); lancer(); },
    /** Déplacement du pointeur sur la carte, de -0,5 à 0,5 sur chaque axe. */
    pointer(x, y) { pointeur.x = x; pointeur.y = y; lancer(); },
  };
}
