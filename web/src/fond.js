// @ts-check
/**
 * Le fond de l'application : un mur de pierre où la lumière glisse lentement (boucle vidéo, rendu réaliste),
 * derrière toutes les vues. Il suit le thème clair ou sombre de l'appareil, se déplace très légèrement avec le
 * pointeur et le défilement, et se met en pause quand l'application n'est pas à l'écran.
 * Sans mouvement demandé par l'appareil (« réduire les animations »), seule l'image fixe est affichée.
 */

const IMAGES = new URL('../images/', import.meta.url).href;

export function installerFond() {
  const sombre = matchMedia('(prefers-color-scheme: dark)'), calme = matchMedia('(prefers-reduced-motion: reduce)');
  const racine = document.createElement('div');
  racine.className = 'fond';
  racine.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img'), film = document.createElement('video'), voile = document.createElement('i');
  image.alt = ''; image.decoding = 'async';
  film.muted = true; film.loop = true; film.playsInline = true; film.preload = 'auto'; film.disablePictureInPicture = true;
  film.setAttribute('muted', ''); film.setAttribute('playsinline', '');
  racine.append(image, film, voile);
  document.body.prepend(racine);

  const jouer = () => { if (!calme.matches && !document.hidden) film.play().catch(() => {}); else film.pause(); };
  const charger = () => {
    const theme = sombre.matches ? 'sombre' : 'clair';
    racine.classList.remove('pret');
    image.src = `${IMAGES}fond-${theme}.webp`;
    if (calme.matches) { film.removeAttribute('src'); film.load(); return; }
    film.src = `${IMAGES}fond-${theme}.mp4`;
    jouer();
  };
  film.addEventListener('playing', () => racine.classList.add('pret'));
  sombre.addEventListener('change', charger);
  calme.addEventListener('change', charger);
  document.addEventListener('visibilitychange', jouer);
  charger();

  // léger déplacement avec le pointeur et le défilement, amorti image par image (fluide à 120 Hz)
  let cibleX = 0, cibleY = 0, x = 0, y = 0, defile = 0, enCours = false;
  const pas = () => {
    const d = Math.min(1, scrollY / 1600);
    x += (cibleX - x) * 0.06; y += (cibleY - y) * 0.06; defile += (d - defile) * 0.08;
    racine.style.setProperty('--fx', `${(x * 14).toFixed(2)}px`);
    racine.style.setProperty('--fy', `${(y * 10 - defile * 40).toFixed(2)}px`);
    racine.style.setProperty('--fz', (1.08 + defile * 0.05).toFixed(4));
    enCours = Math.abs(cibleX - x) + Math.abs(cibleY - y) + Math.abs(d - defile) > 0.002;
    if (enCours) requestAnimationFrame(pas);
  };
  const reveiller = () => { if (!enCours && !calme.matches) { enCours = true; requestAnimationFrame(pas); } };
  addEventListener('pointermove', e => { cibleX = e.clientX / innerWidth - 0.5; cibleY = e.clientY / innerHeight - 0.5; reveiller(); }, { passive: true });
  addEventListener('scroll', reveiller, { passive: true });
}
