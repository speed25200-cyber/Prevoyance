// Contrôle de mise en page, à lancer dans la console (ou par un outil) sur une vue ouverte :
//   cartes voisines qui se touchent ou se chevauchent, textes qui débordent de leur boîte, éléments qui sortent de l'écran.
// Rend une liste courte de défauts ; liste vide = rien trouvé.
window.auditMiseEnPage = function auditMiseEnPage() {
  const visibles = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); const plie = e.closest('details:not([open])'); if (plie && !e.closest('summary') && e !== plie) return false; return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const nom = e => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
    + ' «' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26) + '»');
  const defauts = [];
  // 1. boîtes sœurs trop proches (moins de 6 px) ou qui se chevauchent
  const BOITES = '.carte, .risque, .chiffre, .option, .scene-puce, .bloc, .alertes > li, .tenue, .pastille, .mesure, .etape, .offre, .rubriques, .portefeuille, .bouton, .verre-carte, .piliers li, .route li, .simulateur, .entete-page, .segments, .champ, .compteur';
  // toutes les boîtes visibles, deux à deux, sauf une boîte et ce qu'elle contient ; les rangées d'une liste groupée sont voulues jointives
  const toutes = [...document.querySelectorAll(BOITES)].filter(e => visibles(e) && !e.closest('.page') && !['absolute', 'fixed'].includes(getComputedStyle(e).position)
    && !(e.matches('.risque, .scene-puce') && getComputedStyle(e).borderRadius === '0px'));
  for (let i = 0; i < toutes.length; i++) for (let j = i + 1; j < toutes.length; j++) {
    const x = toutes[i], y = toutes[j];
    if (x.contains(y) || y.contains(x)) continue;
    const a = x.getBoundingClientRect(), b = y.getBoundingClientRect();
    const rv = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), rh = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    if (rv > 4 && rh > 4) defauts.push(`CHEVAUCHEMENT ${nom(x)} / ${nom(y)} (${Math.round(rh)}×${Math.round(rv)})`);
    else if (rv > 4 && rh > -6) defauts.push(`SE TOUCHENT (côte à côte, ${Math.round(-rh)} px) ${nom(x)} / ${nom(y)}`);
    else if (rh > 4 && rv > -6) defauts.push(`SE TOUCHENT (l'une sous l'autre, ${Math.round(-rv)} px) ${nom(x)} / ${nom(y)}`);
  }
  // 2. texte ou contenu qui dépasse de sa boîte
  for (const boite of [...document.querySelectorAll(BOITES + ', .entete-page, .barre, .onglets, .cles, .chiffres, .carte-tete, .lignes li')].filter(visibles)) {
    const r = boite.getBoundingClientRect();
    for (const e of boite.querySelectorAll('b, h1, h2, h3, p, span, small, button, output, label, input, select, canvas, svg')) {
      if (!visibles(e) || e.closest('.scene-toile, .fond')) continue;
      const q = e.getBoundingClientRect();
      if (q.right > r.right + 2 || q.left < r.left - 2) { defauts.push(`DÉBORDE de ${nom(boite)} : ${nom(e)} (${Math.round(Math.max(q.right - r.right, r.left - q.left))} px)`); break; }
    }
  }
  // 3. page plus large que l'écran, éléments hors écran
  if (document.documentElement.scrollWidth > innerWidth + 1) defauts.push(`PAGE TROP LARGE : ${document.documentElement.scrollWidth} px pour ${innerWidth}`);
  // 4. éléments fixes qui recouvrent un bouton ou un champ en bas de l'écran
  return [...new Set(defauts)].slice(0, 40);
};
