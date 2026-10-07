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
import { etat, garder, versDossier, dossier, VUES, nouveauDossier, dossierExemple } from './etat.js';
import * as Donnees from './donnees.js';
import * as Formulaire from './formulaire.js';
import * as VueAnalyse from './vues/analyse.js';
import * as VueScenarios from './vues/scenarios.js';
import * as VuePlan from './vues/plan.js';
import * as VueRapport from './vues/rapport.js';
import * as VueDonnees from './vues/donnees.js';
import { h, $ } from './ui.js';
import { installerFond } from './fond.js';
import * as Natif from './natif.js';
import * as Suivi from './suivi.js';
import * as Verrou from './verrou.js';
import * as EcranVerrou from './verrou-ecran.js';

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
  placerBulle();
  // dans l'app iPhone / iPad, le menu est la barre native : on lui dit la vue ouverte et les libellés
  appNative()?.postMessage({ actif, visible: true, analyse: Natif.analyse(ctx), dossiers: resumeDossiers(),
    textes: { titre: ctx.t('titre'), accroche: ctx.t('accueilAccroche'), dossiers: ctx.t('accueilDossiers'), nouveau: ctx.t('accueilNouveau'), exemple: ctx.t('accueilExemple'), accueil: ctx.t('accueil'), suivant: ctx.t('accueilSuivant'), terminer: ctx.t('accueilTerminer'), presentation: ctx.t('vi_presentation'), risques: ctx.t('vi_risques'), synthese: ctx.t('vi_synthese') },
    langue: etat.langue, langues: LANGUES, annee: etat.annee, annees: ANNEES, noms: Object.fromEntries(['dossier', ...VUES].map(v => [v, ctx.t(v === 'dossier' ? 'dossier' : 'v_' + v)])) });
}
const appNative = () => /** @type {any} */ (window).webkit?.messageHandlers?.onglet ?? null;
/** Les dossiers pour l'accueil de l'app : nom, date, score de couverture. */
function resumeDossiers() {
  return etat.dossiers.map(d => {
    let score = 0;
    try { if (ctx.regles) score = analyser(versDossier(d, d.cible), ctx.regles, { impots: ctx.impots }).score; } catch { /* dossier incomplet : score 0 */ }
    return { id: String(d.id), nom: d.nom || ctx.t('sansNom'), date: new Date(d.modifie ?? Date.now()).toLocaleDateString(etat.langue + '-CH', { day: 'numeric', month: 'long', year: 'numeric' }),
             score, ouvert: d.id === dossier().id };
  });
}
/** Demandes de l'accueil de l'app : ouvrir un dossier sur son analyse, en créer un (vide ou d'exemple) et le saisir. */
function ouvrirDossier(id) {
  if (!etat.dossiers.some(d => String(d.id) === String(id))) return;
  etat.ouvert = etat.dossiers.find(d => String(d.id) === String(id)).id; garder();
  ctx.reconstruire();
  aller('analyse');
}
function creerDossier(exemple = false) {
  nouveauDossier(exemple ? dossierExemple() : undefined);
  ctx.reconstruire();
  aller(exemple ? 'analyse' : 'dossier');
}
/** La bulle de verre du menu se pose sous l'entrée active (elle glisse d'une entrée à l'autre). */
function placerBulle() {
  const menu = $('onglets'), actif = /** @type {HTMLElement|null} */ (menu.querySelector('[aria-selected="true"]'));
  if (!actif) return;
  menu.style.setProperty('--bulle-x', `${actif.offsetLeft}px`);
  menu.style.setProperty('--bulle-l', `${actif.offsetWidth}px`);
}
new ResizeObserver(placerBulle).observe($('onglets'));
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

/** Un calcul qui échoue ne doit jamais laisser des chiffres périmés à l'écran sans le dire. */
function signalerErreur(visible) {
  let bandeau = document.getElementById('erreur-calcul');
  if (!visible) { bandeau?.remove(); return; }
  if (!bandeau) { bandeau = h('p', { id: 'erreur-calcul', role: 'alert' }); document.body.append(bandeau); }
  bandeau.textContent = ctx.t('erreurCalcul');
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
    signalerErreur(true);
    return;
  }
  signalerErreur(false);
  // suivi : le point du jour de la personne principale (un par jour, le dernier état fait foi)
  const suivi = dossier();
  if (suivi.cible !== 'conjoint' && ctx.analyse) {
    const note = Suivi.noter(suivi.suivi, Suivi.pointDe(ctx.analyse, new Date().toISOString().slice(0, 10)));
    if (note.change) { suivi.suivi = note.suivi; garder(); }
  }
  MODULES[etat.vue].afficher(ctx);
  // l'app dessine elle-même l'analyse : on lui remet le modèle d'affichage à chaque calcul
  appNative()?.postMessage({ analyse: Natif.analyse(ctx) });
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
  // écran tactile : pas de transition de vue du navigateur (elle photographie toute la page, fond compris : lent)
  const tactile = matchMedia('(pointer: coarse)').matches;
  if (tactile) {
    changer();
    if (montee && !matchMedia('(prefers-reduced-motion: reduce)').matches) $('vue').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
  } else if (transition && montee && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
// verrouillage : rien ne s'affiche avant le code ; après cinq minutes en arrière-plan, le code est redemandé
if (Verrou.actif()) { document.body.classList.add('pret'); await EcranVerrou.demander(ctx.t); }
let masqueDepuis = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) masqueDepuis = Date.now();
  else if (Verrou.actif() && masqueDepuis && Date.now() - masqueDepuis > 5 * 60_000) { Verrou.fermer(); location.reload(); }
});
await calculer();
traduire();
// les données de référence de la vue « Données » sont lues d'avance : la vue s'ouvre sans attendre
Donnees.manifeste().catch(() => {}); for (const annee of ANNEES) Donnees.regles(annee).catch(() => {});
document.body.classList.add('pret');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
// Scénarios, Conseil, Rapport, Données : la page décrit ce qu'elle affiche, l'app le dessine. Chaque changement de la
// vue (calcul, réglage) est annoncé, regroupé sur un court délai.
let annonceEcran = 0;
function annoncerEcran() {
  if (!appNative() || etat.vue === 'analyse') return;
  clearTimeout(annonceEcran);
  annonceEcran = setTimeout(() => appNative()?.postMessage({ ecran: { vue: etat.vue, ...Natif.ecran($('vue')) } }), 140);
}
if (appNative()) new MutationObserver(annoncerEcran).observe($('vue'), { childList: true, subtree: true, characterData: true });
// Le formulaire se décrit à l'app à chaque reconstruction ; l'app y écrit par `champ(id, valeur)`.
Formulaire.quandSchema(schema => appNative()?.postMessage({ schema }));
/** Écran Analyse natif : risque affiché, personne analysée. */
function choisirRisque(cle) { if (VueAnalyse.RISQUES.includes(cle)) { etat.risque = cle; garder(); MODULES[etat.vue].afficher(ctx); appNative()?.postMessage({ analyse: Natif.analyse(ctx) }); } }
function choisirCible(cible) { const d = dossier(); if (d.avecConjoint && ['personne', 'conjoint'].includes(cible) && d.cible !== cible) { d.cible = cible; garder(); ctx.recalculer(true); } }
/** Réglages demandés par l'app (menu natif) : langue et année des règles. */
async function regler({ langue, annee } = {}) {
  if (langue && LANGUES.includes(langue) && langue !== etat.langue) { etat.langue = langue; garder(); traduire(); }
  if (annee && ANNEES.includes(annee) && annee !== etat.annee) {
    etat.annee = annee; garder();
    /** @type {HTMLSelectElement} */ ($('annee')).value = String(annee);
    await calculer(); monterVue();
  }
}
/** @type {any} */ (window).__prevoyance = { etat, ctx, aller, regler, ouvrirDossier, creerDossier, annoncer: marquer,
  champ: Formulaire.agir, action: (id, valeur) => { Natif.agir(id, valeur); annoncerEcran(); }, ecran: () => Natif.ecran($('vue')), risque: choisirRisque, cible: choisirCible, modeles: () => ({ analyse: Natif.analyse(ctx) }) };
