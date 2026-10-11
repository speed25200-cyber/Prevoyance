// @ts-check
/**
 * Vue « Analyse » : la couverture globale, les cinq risques, la ligne de vie, le détail des sources, les leviers
 * et les points d'attention. La structure est montée une fois ; chaque calcul ne fait que mettre les valeurs à jour.
 */

import { h, compter, couleurCouverture, COULEUR_PILIER } from '../ui.js';
import { creerGraphique, COUCHES } from '../graphique.js';
import { creerScene } from '../scene.js';
import { creerRelief, chargerTerrain } from '../relief.js';
import { etat, garder, dossier } from '../etat.js';
import * as Formulaire from '../formulaire.js';

export const RISQUES = ['retraite', 'invaliditeMaladie', 'invaliditeAccident', 'decesMaladie', 'decesAccident'];
const GRAVITES = ['critique', 'attention', 'opportunite', 'info'];
const MONTANTS = new Set(['montant', 'economie', 'plafond', 'excedent', 'seuil', 'perteMensuelle', 'ecart']);
const VAR_COUCHE = { salaire: '--salaire', attente: '--attente', pilier1: '--p1', pilier2: '--p2', pilier3: '--p3' };

/** @type {any} */ let graphique = null;
/** @type {any} */ let scene = null;
/** @type {ReturnType<typeof creerRelief>} */ let relief = null;
let terrainConnu = false;   // le terrain du relief a fini de se charger (qu'il soit là ou non)
/** @type {(() => void)|null} */ let surLargeur = null;
/** @type {Record<string, string>} */ let ecrits = {};
/** @type {(x: number) => string} */ let chf = String;
// La vue du relief dans la synthèse : le sommet à hauteur d'œil, à droite du chiffre (ou centré, au-dessus, sur un écran étroit).
const VUE_LARGE = { azimut: 0.55, elevation: 0.12, distance: 2.05, cibleY: 0.7, dx: 0.42, dy: 0.04 };
const VUE_ETROITE = { azimut: 0.55, elevation: 0.14, distance: 2.5, cibleY: 0.68, dx: 0, dy: 0 };

/** Approche la caméra d'un pilier (1 à 3) et allume son point ; `null` : vue d'ensemble. */
function viser(n) {
  scene?.viser(n === null ? null : n - 1);
  for (const k of [1, 2, 3]) { r['repere' + k]?.classList.toggle('actif', k === n); r['puce' + k]?.classList.toggle('actif', k === n); }
}
/** @type {Record<string, HTMLElement>} */ let r = {};

export function monter(ctx, racine) {
  const { t } = ctx, d = dossier();
  const ref = (cle, element) => (r[cle] = element);
  const cibles = d.avecConjoint ? h('div', { class: 'segments cibles', role: 'group' }, ...['personne', 'conjoint'].map(c =>
    h('button', { type: 'button', 'aria-pressed': String(d.cible === c), onclick: () => { d.cible = c; garder(); ctx.recalculer(true); } }, t(c === 'personne' ? 'client' : 'conjointCourt')))) : null;
  const toile = h('canvas', {}), bulle = h('div', { class: 'bulle', hidden: true });
  // dans le navigateur : le relief (les trois étages du massif, l'anneau du besoin) ; dans l'app : les colonnes photographiées
  const avecRelief = !document.documentElement.classList.contains('natif');
  relief?.detruire(); relief = null; ecrits = {};
  if (surLargeur) { removeEventListener('resize', surLargeur); surLargeur = null; }
  racine.replaceChildren(
    h('div', { class: 'tete carte' },
      h('div', { class: 'jauge' }, ref('jauge', h('div', { class: 'jauge-anneau' },
        h('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' }, h('circle', { class: 'piste', cx: 60, cy: 60, r: 52 }), ref('arc', h('circle', { class: 'arc', cx: 60, cy: 60, r: 52 }))),
        h('div', { class: 'jauge-texte' }, ref('score', h('b', {}, '0')), h('span', {}, t('score')))))),
      h('div', { class: 'resume' }, cibles, ref('resumeTitre', h('p', { class: 'surtitre' })),
        ref('grand', h('p', { class: 'grand' }, ref('resumeMontant', h('span', {}, 'CHF 0')), h('small', {}, t('parMois')))), ref('resumeNote', h('p', { class: 'note' })),
        // trois chiffres-clés du risque affiché, puis le pas suivant : le conseil
        h('div', { class: 'cles' },
          h('div', {}, h('small', {}, t('couvert')), ref('cleCouverture', h('b', {}, '–'))),
          h('div', {}, h('small', {}, t('besoin')), ref('cleBesoin', h('b', {}, '–'))),
          h('div', {}, h('small', {}, t('capital')), ref('cleCapital', h('b', {}, '–')))),
        h('button', { type: 'button', class: 'bouton vers-conseil', onclick: () => /** @type {HTMLElement|null} */ (document.querySelector('#onglets [data-vue=plan]'))?.click() },
          t('voirConseil'), h('i', { 'aria-hidden': 'true' }))),
      ref('sceneToile', h('canvas', { class: 'scene-toile', 'aria-hidden': 'true' })),
      h('div', { class: 'scene-voile', 'aria-hidden': 'true' }),
      ...[1, 2, 3].map(n => ref('repere' + n, h('i', { class: 'scene-point', 'aria-hidden': 'true' }))),
      avecRelief ? ref('reliefToile', h('canvas', { class: 'relief-toile', 'aria-hidden': 'true' })) : null,
      avecRelief ? ref('reliefReperes', h('div', { class: 'relief-reperes', 'aria-hidden': 'true' },
        h('svg', {}, ref('repTrait', h('line', { x1: 0, y1: 0, x2: 0, y2: 0 }))),
        ref('repSommet', h('p', { class: 'repere sommet' }, h('i'), h('span', {}, t('couvert')), ref('repSommetN', h('b')))),
        ref('repBesoin', h('p', { class: 'repere besoin' }, h('span', {}, t('besoin')), ref('repBesoinN', h('b')))))) : null,
      // ce que verse chaque pilier : toucher ou survoler approche la caméra de sa colonne
      h('div', { class: 'scene-piliers' }, ...[1, 2, 3].map(n => ref('puce' + n, h('button', { type: 'button', class: 'scene-puce',
        onpointerenter: () => viser(n), onpointerleave: () => viser(null), onfocus: () => viser(n), onblur: () => viser(null) },
        h('small', {}, t(n === 3 ? 'pilier3c' : 'pilier' + n)), ref('montant' + n, h('b', {}, '–'))))))),
    ref('risques', h('div', { class: 'risques', role: 'tablist' }, ...RISQUES.map((cle, i) => h('button', {
      class: 'risque', type: 'button', role: 'tab', 'data-risque': cle, style: { '--i': i + 1 }, onclick: () => { etat.risque = cle; garder(); afficher(ctx); } },
      h('h3', {}, t(cle)), h('b', {}, '–'), h('small', {}, ''), h('div', { class: 'barre-couv' }, h('i')))))),
    h('div', { class: 'carte graphique' },
      h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('ligneDeVie')), h('p', {}, `${t('revenuSelonAge')} · ${t('glisser')}`)), ref('legende', h('ul', { class: 'legende' }))),
      h('div', { class: 'toile' }, toile, bulle)),
    h('div', { class: 'deux' },
      h('div', { class: 'carte pliable' }, h('h2', {}, t('detail')), ref('detail', h('div'))),
      h('div', { class: 'carte pliable' }, h('h2', {}, t('potentiels')), ref('potentiels', h('div')))),
    ref('menage', h('div', { class: 'carte', hidden: true })),
    h('div', { class: 'carte' }, h('h2', {}, t('alertes')), ref('alertes', h('ul', { class: 'alertes' }))),
    h('p', { class: 'avertissement' }, t('avertissement')),
    avecRelief ? h('p', { class: 'avertissement source-relief' }, t('rl_source')) : null);
  // téléphone : le détail et les leviers sont repliés ; on les ouvre en touchant leur titre
  const etroit = matchMedia('(max-width: 640px)');
  for (const carte of racine.querySelectorAll('.pliable')) {
    const titre = /** @type {HTMLElement} */ (carte.querySelector('h2'));
    carte.classList.toggle('plie', etroit.matches);
    titre.addEventListener('click', () => { if (etroit.matches) carte.classList.toggle('plie'); });
  }
  graphique = creerGraphique(toile, bulle);
  // la scène : trois colonnes photographiées, une caméra qui suit le pointeur et s'approche du pilier désigné
  const tete = /** @type {HTMLElement} */ (racine.querySelector('.tete'));
  relief = avecRelief ? creerRelief(/** @type {HTMLCanvasElement} */ (r.reliefToile)) : null;
  if (relief) {
    const rel = relief;
    tete.classList.add('avec-relief');
    const vue = () => (matchMedia('(min-width: 1200px)').matches ? VUE_LARGE : VUE_ETROITE);
    surLargeur = () => rel.viser(vue());
    rel.viser(vue(), true);
    addEventListener('resize', surLargeur);
    rel.suivre(placerReperes);
    // désigner un pilier allume son étage et éteint les deux autres
    scene = { viser: n => rel.scene({ bandes: [0, 1, 2].map(k => (n === null || k === n ? 1 : 0.14)) }), pointer() {} };
  } else if (avecRelief && !terrainConnu) {
    // le terrain du relief n'est pas encore chargé : la synthèse se lit sans lui, et la vue se remonte dès qu'il arrive
    tete.classList.add('avec-relief');
    scene = { viser() {}, pointer() {} };
    const toile = r.reliefToile;
    chargerTerrain().then(() => { terrainConnu = true; if (toile?.isConnected) ctx.recalculer(true); });
  } else {
    r.reliefToile?.remove(); r.reliefReperes?.remove();
    scene = creerScene(/** @type {HTMLCanvasElement} */ (r.sceneToile), [r.repere1, r.repere2, r.repere3]);
  }
  tete.addEventListener('pointermove', e => { const b = tete.getBoundingClientRect(); scene.pointer((e.clientX - b.left) / b.width - 0.5, (e.clientY - b.top) / b.height - 0.5); });
  tete.addEventListener('pointerleave', () => scene.pointer(0, 0));
  // survoler une source dans le détail approche la caméra de son pilier
  r.detail.addEventListener('pointerover', e => { const li = /** @type {HTMLElement} */ (e.target).closest?.('[data-pilier]'); viser(li ? +/** @type {any} */ (li).dataset.pilier : null); });
  r.detail.addEventListener('pointerleave', () => viser(null));
}

/** Pose les étiquettes du relief là où tombent le sommet et l'anneau du besoin (appelé après chaque image). */
function placerReperes(rel) {
  if (!r.reliefReperes?.isConnected) return;
  const m = rel.reperes(), comble = m.besoin - m.total <= m.besoin * 0.004;
  const poser = (e, p) => { e.style.setProperty('--x', p.x.toFixed(1)); e.style.setProperty('--y', p.y.toFixed(1)); };
  const noter = (cle, texte) => { if (ecrits[cle] !== texte) { ecrits[cle] = texte; r[cle].textContent = texte; } };
  poser(r.repSommet, m.sommet); poser(r.repBesoin, m.dessus);
  r.repTrait.setAttribute('x1', m.sommet.x.toFixed(1)); r.repTrait.setAttribute('y1', (m.sommet.y - 3).toFixed(1));
  r.repTrait.setAttribute('x2', m.anneau.x.toFixed(1)); r.repTrait.setAttribute('y2', m.anneau.y.toFixed(1));
  noter('repSommetN', chf(m.total)); noter('repBesoinN', chf(m.besoin));
  r.reliefReperes.classList.toggle('atteint', comble);
  r.reliefReperes.classList.toggle('proche', !comble && m.besoin - m.total <= m.besoin * 0.09);
}

export function pointsDuGraphique(a, x) {
  const chrono = a.chronologie, P = a.personne;
  const parPilier = sources => { const v = {}; for (const s of sources) v['pilier' + s.pilier] = (v['pilier' + s.pilier] ?? 0) + s.montant; return v; };
  if (x.cle === 'retraite') {
    return chrono.map(p => ({ age: p.age, besoin: p.besoin, v: p.actif ? { salaire: p.salaire } : { pilier1: p.pilier1, pilier2: p.pilier2, pilier3: p.pilier3 } }));
  }
  if (x.cle.startsWith('invalidite')) {
    const besoin = P.revenu * a.besoins.invalidite, rente = parPilier(x.sources);
    return chrono.map(p => {
      if (!p.actif) return { age: p.age, besoin: p.besoin, v: { pilier1: p.pilier1, pilier2: p.pilier2, pilier3: p.pilier3 } };
      const depuis = p.age - P.age;
      if (depuis >= 2) return { age: p.age, besoin, v: rente };
      const part = Math.min(1, Math.max(0, (x.attente.jours - 365 * depuis) / 365));
      const attente = x.attente.montant * part, reste = Math.max(0, p[x.cle] - attente), somme = x.total || 1;
      return { age: p.age, besoin, v: { attente, pilier1: (rente.pilier1 ?? 0) / somme * reste, pilier2: (rente.pilier2 ?? 0) / somme * reste, pilier3: (rente.pilier3 ?? 0) / somme * reste } };
    });
  }
  const v = parPilier(x.sources);
  return Array.from({ length: Math.max(1, x.annees) }, (_, i) => ({ age: P.age + i, besoin: x.besoin, v }));
}

export function afficher(ctx) {
  const { t, f, analyse: a } = ctx;
  if (!a || !r.arc) return;
  const x = a.risques[etat.risque];
  r.arc.style.strokeDashoffset = String(326.73 * (1 - a.score / 100));
  r.jauge.style.setProperty('--couleur', couleurCouverture(a.score / 100));
  compter(r.score, a.score, v => String(Math.round(v)));
  r.resumeTitre.textContent = `${t(x.cle)} — ${x.lacune > 0 ? t('lacune') : t('aucuneLacune')}`;
  r.grand.classList.toggle('lacune', x.lacune > 0);
  compter(r.resumeMontant, x.lacuneMensuelle, f.chf);
  const morceaux = [`${t('besoin')} ${f.chf(x.besoin)} ${t('parAn')}`, `${t('couvert')} ${f.pourcent(Math.min(1, x.couverture))}`];
  if (x.capital > 0) morceaux.push(`${t('capital')} ${f.chf(x.capital)} (${t('surLaDuree', { n: x.annees })})`);
  if (x.cle === 'retraite' && x.epargneAnnuelle > 0) morceaux.push(t('epargne', { m: f.chf(x.epargneAnnuelle) }));
  r.resumeNote.textContent = morceaux.join(' · ');
  r.cleCouverture.textContent = f.pourcent(Math.min(1, x.couverture));
  compter(r.cleBesoin, x.besoin, f.chf);
  compter(r.cleCapital, x.capital ?? 0, f.chf);
  // ce que chaque pilier verse pour le risque choisi, posé sur sa colonne
  const verses = [1, 2, 3].map(n => x.sources.filter(s => s.pilier === n).reduce((s, y) => s + y.montant, 0));
  verses.forEach((verse, i) => {
    compter(r['montant' + (i + 1)], verse, f.chf);
    r['puce' + (i + 1)].classList.toggle('vide', verse < 1);
  });
  // le relief prend la forme du risque affiché : trois étages (ce que verse chaque pilier) sous l'altitude du besoin
  chf = f.chf;
  relief?.regler({ p1: verses[0], p2: verses[1], p3: verses[2], besoin: x.besoin });
  relief?.scene({ anneau: x.besoin > 0 ? 1 : 0 });

  for (const bouton of /** @type {HTMLElement[]} */ ([...r.risques.children])) {
    const y = a.risques[/** @type {string} */ (bouton.dataset.risque)];
    bouton.setAttribute('aria-selected', String(y.cle === etat.risque));
    const [, montant, note, barre] = /** @type {HTMLElement[]} */ ([...bouton.children]);
    montant.classList.toggle('lacune', y.lacune > 0);
    if (y.besoin === 0) { montant.textContent = '—'; /** @type {any} */ (montant)._v = 0; note.textContent = t('sansObjet'); }
    else {
      // pas de lacune aujourd'hui mais une plus tard (les rentes d'enfants s'arrêtent) : c'est elle qu'on montre
      const plusTard = y.lacune === 0 && (y.lacuneMax ?? 0) > 0;
      compter(montant, plusTard ? y.lacuneMax / 12 : y.lacuneMensuelle, v => (y.lacune > 0 || plusTard ? '− ' : '') + f.chf(v));
      note.textContent = plusTard ? t('lacunePlusTard') : y.lacune > 0 ? t('parMois') : t('aucuneLacune');
    }
    const trait = /** @type {HTMLElement} */ (barre.firstElementChild);
    trait.style.transform = `scaleX(${y.besoin === 0 ? 0 : Math.min(1, y.couverture)})`;
    trait.style.background = couleurCouverture(y.couverture);
  }

  const points = pointsDuGraphique(a, x);
  const libelles = { salaire: t('s_salaire'), attente: t('attente'), pilier1: t('pilier1'), pilier2: t('pilier2'), pilier3: t('pilier3c'), besoin: t('besoin'), lacune: t('lacune') };
  graphique.definir(points, { chf: f.chf, court: f.court, libelles, ans: t('ans'),
    reperes: x.cle.startsWith('deces') ? [] : [{ age: a.personne.ageRetraite, libelle: `${t('retraite')} · ${a.personne.ageRetraite}`, glissable: true }],
    surGlisser: (age, fin) => {
      const d = dossier(), voulu = Math.min(70, Math.max(58, age));
      if (voulu !== d.ageRetraite) { d.ageRetraite = voulu; ctx.apresChangement(); }
      if (fin) Formulaire.construire();                         // le curseur du formulaire reprend la valeur
    } });
  r.legende.replaceChildren(...COUCHES.filter(c => points.some(p => (p.v[c] ?? 0) > 0.5)).map(c => h('li', { style: { '--c': `var(${VAR_COUCHE[c]})` } }, h('i'), libelles[c])),
    h('li', {}, h('i', { class: 'trait' }), t('besoin')), h('li', { style: { '--c': 'var(--lacune)' } }, h('i'), t('lacune')));

  r.detail.replaceChildren(...detailRisque(ctx, x));
  requestAnimationFrame(() => { for (const i of /** @type {NodeListOf<HTMLElement>} */ (r.detail.querySelectorAll('.pile i'))) i.style.width = `${(+(i.dataset.part ?? 0) * 100).toFixed(2)}%`; });

  r.potentiels.replaceChildren(...leviers(ctx, a));
  afficherMenage(ctx);
  const triees = [...a.alertes].sort((p, q) => GRAVITES.indexOf(p.gravite) - GRAVITES.indexOf(q.gravite));
  r.alertes.replaceChildren(...triees.map(al => h('li', { style: { '--c': `var(--${al.gravite})` } }, h('span', {}, texteAlerte(ctx, al)))));
}

export function texteAlerte({ t, f }, al) {
  const valeurs = Object.fromEntries(Object.entries(al.valeurs).map(([k, v]) => [k, MONTANTS.has(k) ? f.chf(/** @type {number} */ (v)) : v]));
  return t('a_' + al.cle, valeurs);
}

/** Barre empilée, lignes par source, besoin, lacune et période d'attente d'un risque (aussi utilisé par le rapport). */
export function detailRisque({ t, f }, x) {
  const echelle = Math.max(x.besoin, x.total, 1);
  const pile = h('div', { class: 'pile' }, ...x.sources.map(s => h('i', { style: { '--c': COULEUR_PILIER[s.pilier] }, 'data-part': s.montant / echelle })),
    x.lacune > 0 ? h('i', { class: 'manque', 'data-part': x.lacune / echelle }) : null);
  const lignes = h('ul', { class: 'lignes' }, ...x.sources.map(s => h('li', { 'data-pilier': s.pilier },
    h('span', { class: 'nom' }, h('i', { style: { '--c': COULEUR_PILIER[s.pilier] } }), t('s_' + s.cle), s.estime ? h('em', {}, t('estime')) : null, s.reduit ? h('em', {}, t('reduit')) : null),
    h('b', {}, f.chf(s.montant)))),
    h('li', { class: 'total' }, h('span', {}, t('besoin')), h('b', {}, f.chf(x.besoin))),
    x.lacune > 0 ? h('li', { class: 'manque' }, h('span', {}, `${t('lacune')} ${t('parAn')}`), h('b', {}, '− ' + f.chf(x.lacune))) : null);
  const attente = x.attente ? h('div', { class: 'attente' }, h('b', {}, t('attente')),
    t('att_' + x.attente.cle, { t: Math.round(x.attente.taux * 100), j: x.attente.jours, s: Math.round(x.attente.jours / 7) })) : null;
  return [pile, lignes, attente].filter(Boolean);
}

export function leviers({ t, f }, a) {
  const p = a.potentiels, out = [];
  out.push(h('div', { class: 'levier' }, h('b', {}, t('p_3a')), h('p', {}, p.pilier3a.potentiel > 0
    ? t('p_3a_d', { m: f.chf(p.pilier3a.potentiel), e: f.chf(p.pilier3a.economieImpot), c: f.chf(p.pilier3a.capitalSupplementaire) })
    : t('p_3a_plein', { m: f.chf(p.pilier3a.plafond) }))));
  if (p.rachatLPP.possible > 0) out.push(h('div', { class: 'levier' }, h('b', {}, t('p_lpp')),
    h('p', {}, t('p_lpp_d', { m: f.chf(p.rachatLPP.possible), e: f.chf(p.rachatLPP.economieImpot), r: f.chf(p.rachatLPP.renteSupplementaire) }))));
  if (p.avs.anneesManquantes > 0) out.push(h('div', { class: 'levier' }, h('b', {}, t('p_avs')),
    h('p', {}, t('p_avs_d', { n: p.avs.anneesManquantes, m: f.chf(p.avs.perteMensuelle) }))));
  out.push(h('p', { class: 'petit' }, p.canton ? t('tauxMarginalCanton', { t: Math.round(p.tauxMarginal * 100), c: p.canton }) : t('tauxMarginal', { t: Math.round(p.tauxMarginal * 100) })));
  return out;
}

/** Le ménage à la retraite : les revenus des deux conjoints additionnés, face à leur besoin commun. */
function afficherMenage(ctx) {
  const { t, f, analyse: a, analyseAutre: b } = ctx;
  r.menage.hidden = !b;
  if (!b) return;
  const x = a.risques.retraite, y = b.risques.retraite, besoin = x.besoin + y.besoin, total = x.total + y.total;
  const lacune = Math.max(0, besoin - total), echelle = Math.max(besoin, total, 1);
  const noms = dossier().cible === 'conjoint' ? [t('conjointCourt'), t('client')] : [t('client'), t('conjointCourt')];
  const part = (s, classe = '') => h('i', { class: classe, style: { '--c': COULEUR_PILIER[s.pilier], width: `${(s.montant / echelle * 100).toFixed(2)}%` } });
  r.menage.replaceChildren(
    h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('mn_titre')), h('p', {}, t('mn_d'))),
      h('b', { class: 'menage-total ' + (lacune > 0 ? 'lacune' : 'ok') }, lacune > 0 ? `− ${f.chf(lacune / 12)} ${t('parMois')}` : t('aucuneLacune'))),
    h('div', { class: 'pile large' }, ...x.sources.map(s => part(s)), h('i', { class: 'separateur' }), ...y.sources.map(s => part(s, 'second')),
      lacune > 0 ? h('i', { class: 'manque', style: { width: `${(lacune / echelle * 100).toFixed(2)}%` } }) : null),
    h('ul', { class: 'lignes' },
      h('li', {}, h('span', {}, noms[0]), h('b', {}, f.chf(x.total))), h('li', {}, h('span', {}, noms[1]), h('b', {}, f.chf(y.total))),
      h('li', { class: 'total' }, h('span', {}, t('mn_besoin')), h('b', {}, f.chf(besoin))),
      a.marie ? h('li', {}, h('span', { class: 'petit' }, t('mn_plafond', { m: f.chf(ctx.regles.avs.renteMaxMensuelle * ctx.regles.avs.plafondCoupleFacteur) })), h('b', {}, '')) : null));
}
