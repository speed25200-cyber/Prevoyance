// @ts-check
/**
 * Application du conseiller : point d'entrée.
 *
 * Un contexte unique (`ctx`) porte la langue, les règles, les données fiscales et l'analyse du dossier ouvert ;
 * les vues (Analyse, Scénarios, Plan, Rapport, Données) le lisent. Chaque changement suit le même chemin :
 * état -> dossier du moteur -> analyse -> mise à jour ciblée de la vue affichée. Le passage d'une vue à l'autre
 * utilise les transitions de vue du navigateur quand elles existent.
 */

import { analyser, ANNEES, Impots } from '../../moteur/src/index.js';
import { LANGUES, traducteur, formats } from './i18n.js';
import { etat, garder, versDossier, dossier, VUES } from './etat.js';
import * as Donnees from './donnees.js';
import * as Formulaire from './formulaire.js';
import * as VueAnalyse from './vues/analyse.js';
import * as VueScenarios from './vues/scenarios.js';
import * as VuePlan from './vues/plan.js';
import * as VueRapport from './vues/rapport.js';
import * as VueDonnees from './vues/donnees.js';
import { h, $ } from './ui.js';
import { installerFond } from './fond.js';

installerFond();

/** Icônes de la navigation (traits simples, comme celles du système). */
const ICONES = {'dossier': '<path d="M12 12a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z"/><path d="M4.8 19.6c.9-3.1 3.7-4.9 7.2-4.9s6.3 1.8 7.2 4.9"/>',
  'analyse': '<path d="M4 19.5h16"/><path d="M7 16v-4.5"/><path d="M12 16V6"/><path d="M17 16V9.5"/>',
  'scenarios': '<path d="M4 18c5 0 5-12 10-12h5"/><path d="M4 18h15"/><path d="M16.5 3.5L19 6l-2.5 2.5"/><path d="M16.5 15.5L19 18l-2.5 2.5"/>',
  'plan': '<path d="M9 6.5h10"/><path d="M9 12h10"/><path d="M9 17.5h10"/><path d="M4.2 6.6l1 1 1.8-2"/><path d="M4.2 12.1l1 1 1.8-2"/><path d="M4.2 17.6l1 1 1.8-2"/>',
  'rapport': '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z"/><path d="M14 3.5v4h4"/><path d="M9 12.5h6"/><path d="M9 16h6"/>',
  'donnees': '<path d="M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>'};
function icone(nom) {
  const e = document.createElement('span');
  e.className = 'icone';
  e.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[nom]}</svg>`;
  return e;
}
/** L'entrée de navigation active : le dossier, ou la vue ouverte. */
function marquer() {
  const actif = document.body.dataset.panneau === 'dossier' ? 'dossier' : etat.vue;
  for (const b of $('onglets').children) b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.vue === actif));
}
function aller(cible) {
  if (cible === 'dossier') { document.body.dataset.panneau = 'dossier'; marquer(); scrollTo({ top: 0 }); return; }
  document.body.dataset.panneau = 'analyse';
  if (etat.vue !== cible) { etat.vue = cible; garder(); monterVue(); } else marquer();
  scrollTo({ top: 0 });
}

const MODULES = { analyse: VueAnalyse, scenarios: VueScenarios, plan: VuePlan, rapport: VueRapport, donnees: VueDonnees };

/** @type {any} */
const ctx = {
  t: traducteur(etat.langue), f: formats(etat.langue), regles: null, impots: null, impotsBase: null, communes: null, analyse: null, analyseAutre: null, dossierMoteur: null,
  /** Recalcule ; `remonter` reconstruit la vue (structure changée), `recharger` relit les données de référence. */
  recalculer: async (remonter = false, recharger = false) => { if (recharger) { ctx.regles = null; ctx.impots = null; } await calculer(); if (remonter) monterVue(); },
  apresChangement, reconstruire: () => { Formulaire.construire(); ctx.recalculer(true); },
};

let attente = false;
function apresChangement() {
  garder();
  if (attente) return;
  attente = true;
  // au prochain rafraîchissement de l'écran ; et de toute façon sous 80 ms si l'écran ne se rafraîchit pas (onglet masqué)
  const lancer = async () => { if (!attente) return; attente = false; await calculer(); };
  requestAnimationFrame(lancer);
  setTimeout(lancer, 80);
}

let anneeChargee = 0;
async function calculer() {
  if (!ctx.regles || anneeChargee !== etat.annee) {
    [ctx.regles, ctx.impotsBase, ctx.communes] = await Promise.all([Donnees.regles(etat.annee), Donnees.impots(etat.annee).then(x => x ?? Donnees.impots(ANNEES[0])),
      Donnees.communes(etat.annee).then(x => x ?? Donnees.communes(ANNEES[0]))]);
    anneeChargee = etat.annee;
  }
  try {
    // impôts ramenés à la commune et à la confession du dossier (chef-lieu, sans confession, à défaut)
    const lieu = dossier();
    ctx.impots = Impots.localiser(ctx.impotsBase, ctx.communes, lieu.canton, { commune: lieu.commune ?? null, confession: lieu.confession ?? 'sans' });
    ctx.dossierMoteur = versDossier();
    ctx.analyse = analyser(ctx.dossierMoteur, ctx.regles, { impots: ctx.impots });
    // couple : la même analyse pour l'autre personne, pour chiffrer la retraite du ménage
    const d = dossier();
    ctx.analyseAutre = d.avecConjoint ? analyser(versDossier(d, d.cible === 'conjoint' ? 'personne' : 'conjoint'), ctx.regles, { impots: ctx.impots }) : null;
  } catch (erreur) {
    console.error(erreur);
    return;
  }
  MODULES[etat.vue].afficher(ctx);
}

let montee = false;
function monterVue() {
  let fait = false;
  const changer = () => {
    if (fait) return;
    fait = true;
    document.body.dataset.vue = etat.vue;
    MODULES[etat.vue].monter(ctx, $('vue'));
    MODULES[etat.vue].afficher(ctx);
    marquer();
  };
  // première image sans transition ; ensuite, fondu-glissé entre les vues quand le navigateur le permet
  const transition = /** @type {any} */ (document).startViewTransition;
  if (transition && montee && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const tr = transition.call(document, changer);
    for (const promesse of [tr.ready, tr.finished, tr.updateCallbackDone]) promesse?.catch(() => {});   // transition sautée : la vue est montée quand même
    setTimeout(changer, 350);                                  // filet : si le navigateur tarde à appeler la transition, on monte la vue
  } else changer();
  montee = true;
}

function traduire() {
  ctx.t = traducteur(etat.langue); ctx.f = formats(etat.langue);
  document.documentElement.lang = etat.langue;
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-t]'))) e.textContent = ctx.t(e.dataset.t);
  document.title = `${ctx.t('titre')} — ${ctx.t('sousTitre')}`;
  for (const b of $('langues').children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.langue === etat.langue));
  // navigation : le dossier du client, puis les cinq vues
  $('onglets').replaceChildren(...['dossier', ...VUES].map(v => h('button', { type: 'button', role: 'tab', 'data-vue': v, 'aria-selected': 'false',
    onclick: () => aller(v) }, icone(v), h('span', {}, ctx.t(v === 'dossier' ? 'dossier' : 'v_' + v)))));
  Formulaire.construire();
  monterVue();
}

// lien direct vers une vue : …/index.html#scenarios
const demandee = location.hash.slice(1);
if (VUES.includes(demandee)) etat.vue = demandee;
addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v === 'dossier' || VUES.includes(v)) aller(v); });

Formulaire.initialiser(ctx);
$('langues').replaceChildren(...LANGUES.map(l => h('button', { type: 'button', 'data-langue': l, onclick: () => { etat.langue = l; garder(); traduire(); } }, l.toUpperCase())));
$('annee').replaceChildren(...ANNEES.map(a => h('option', { value: a, selected: a === etat.annee }, String(a))));
$('annee').addEventListener('change', async e => { etat.annee = +/** @type {HTMLSelectElement} */ (e.target).value; garder(); await calculer(); monterVue(); });

$('presentation').addEventListener('click', () => {
  const active = document.body.classList.toggle('presentation');
  $('presentation').textContent = ctx.t(active ? 'quitterPresentation' : 'presentation');
  $('presentation').dataset.t = active ? 'quitterPresentation' : 'presentation';
  if (active) document.documentElement.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.();
});

document.body.dataset.panneau = demandee === 'dossier' ? 'dossier' : 'analyse';
await calculer();
traduire();
document.body.classList.add('pret');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
/** @type {any} */ (window).__prevoyance = { etat, ctx };
