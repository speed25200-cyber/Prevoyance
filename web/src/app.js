// @ts-check
/**
 * Application du conseiller : point d'entrée.
 *
 * Un contexte unique (`ctx`) porte la langue, les règles, les données fiscales et l'analyse du dossier ouvert ;
 * les vues (Analyse, Scénarios, Plan, Rapport, Données) le lisent. Chaque changement suit le même chemin :
 * état -> dossier du moteur -> analyse -> mise à jour ciblée de la vue affichée. Le passage d'une vue à l'autre
 * utilise les transitions de vue du navigateur quand elles existent.
 */

import { analyser, ANNEES } from '../../moteur/src/index.js';
import { LANGUES, traducteur, formats } from './i18n.js';
import { etat, garder, versDossier, VUES } from './etat.js';
import * as Donnees from './donnees.js';
import * as Formulaire from './formulaire.js';
import * as VueAnalyse from './vues/analyse.js';
import * as VueScenarios from './vues/scenarios.js';
import * as VuePlan from './vues/plan.js';
import * as VueRapport from './vues/rapport.js';
import * as VueDonnees from './vues/donnees.js';
import { h, $ } from './ui.js';

const MODULES = { analyse: VueAnalyse, scenarios: VueScenarios, plan: VuePlan, rapport: VueRapport, donnees: VueDonnees };

/** @type {any} */
const ctx = {
  t: traducteur(etat.langue), f: formats(etat.langue), regles: null, impots: null, analyse: null, dossierMoteur: null,
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
    [ctx.regles, ctx.impots] = await Promise.all([Donnees.regles(etat.annee), Donnees.impots(etat.annee).then(x => x ?? Donnees.impots(ANNEES[0]))]);
    anneeChargee = etat.annee;
  }
  try {
    ctx.dossierMoteur = versDossier();
    ctx.analyse = analyser(ctx.dossierMoteur, ctx.regles, { impots: ctx.impots });
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
    for (const b of $('onglets').children) b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.vue === etat.vue));
    if ($('panneaux').firstElementChild) $('panneaux').firstElementChild.textContent = ctx.t('v_' + etat.vue);
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
  $('onglets').replaceChildren(...VUES.map(v => h('button', { type: 'button', role: 'tab', 'data-vue': v, 'aria-selected': String(v === etat.vue),
    onclick: () => { if (etat.vue === v) return; etat.vue = v; garder(); monterVue(); scrollTo({ top: 0, behavior: 'smooth' }); } }, ctx.t('v_' + v))));
  // téléphone : bascule entre le dossier et l'analyse
  $('panneaux').replaceChildren(...['analyse', 'dossier'].map(pn => h('button', { type: 'button', 'data-panneau': pn, 'aria-pressed': String((document.body.dataset.panneau || 'analyse') === pn),
    onclick: () => { document.body.dataset.panneau = pn; for (const b of $('panneaux').children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.panneau === pn)); scrollTo({ top: 0 }); } },
    ctx.t(pn === 'analyse' ? 'v_' + etat.vue : 'dossier'))));
  Formulaire.construire();
  monterVue();
}

// lien direct vers une vue : …/index.html#scenarios
const demandee = location.hash.slice(1);
if (VUES.includes(demandee)) etat.vue = demandee;
addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VUES.includes(v) && v !== etat.vue) { etat.vue = v; garder(); monterVue(); } });

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

await calculer();
traduire();
document.body.dataset.panneau = 'analyse';
document.body.classList.add('pret');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
/** @type {any} */ (window).__prevoyance = { etat, ctx };
