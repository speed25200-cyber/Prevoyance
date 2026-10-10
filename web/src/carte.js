// @ts-check
/**
 * La carte : le mouvement de la peau du navigateur (carte.css). Jamais dans l'app iPhone / iPad, jamais en
 * mouvement réduit — dans ces deux cas tout est en place d'emblée.
 * - les feuilles d'une vue entrent quand elles arrivent à l'écran, l'une après l'autre ;
 * - le titre de la page monte mot à mot quand on change de vue.
 */

const natif = () => document.documentElement.classList.contains('natif');
const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Découpe un titre en mots, chacun dans son masque : la feuille de style les fait monter l'un après l'autre. */
export function titrer(element) {
  if (natif() || calme()) return;
  const mots = (element.textContent ?? '').split(/(\s+)/).filter(Boolean);
  let rang = 0;
  element.replaceChildren(...mots.map(m => {
    if (/^\s+$/.test(m)) return ' ';
    const masque = document.createElement('span'), mot = document.createElement('span');
    masque.className = 'mot'; mot.textContent = m; mot.style.setProperty('--m', String(rang++));
    masque.append(mot);
    return masque;
  }));
}

/** Les feuilles de la vue ouverte entrent quand elles arrivent à l'écran. */
export function installerCarte() {
  const vue = document.getElementById('vue');
  if (!vue || natif() || calme() || !('IntersectionObserver' in window)) return;
  const vigie = new IntersectionObserver(entrees => {
    for (const e of entrees) if (e.isIntersecting) { e.target.classList.add('vu'); vigie.unobserve(e.target); }
  }, { rootMargin: '0px 0px -4% 0px' });
  let prevu = false;
  const relever = () => {
    prevu = false;
    let rang = 0;
    for (const e of /** @type {NodeListOf<HTMLElement>} */ (vue.querySelectorAll(':scope > *, :scope > .pile-cartes > *, :scope > .deux > *, :scope > div:not([class]) > *'))) {
      if (e.classList.contains('a-voir') || e.matches('.pile-cartes, .deux, div:not([class])')) continue;
      e.classList.add('a-voir');
      e.style.setProperty('--rang', String(Math.min(rang++, 4)));
      vigie.observe(e);
    }
  };
  new MutationObserver(() => { if (!prevu) { prevu = true; requestAnimationFrame(relever); } }).observe(vue, { childList: true });
  relever();
}
