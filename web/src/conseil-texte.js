// @ts-check
/**
 * Le conseil personnalisé, mis en phrases : le moteur (moteur/src/conseil.js) donne les recommandations sous forme de
 * codes et de valeurs, ce module les rédige dans la langue de l'interface et les présente (vue Conseil, rapport).
 */

import { h } from './ui.js';
import { Conseil, Impots } from '../../moteur/src/index.js';
import { planCourant } from './vues/plan.js';
import { conseil as procesVerbal } from './conformite.js';
import { garder } from './etat.js';

/** Recommandations du dossier ouvert, rédigées. */
export function rediger(ctx) {
  const { t, f, impots } = ctx, { mesures, avant, apres } = planCourant(ctx);
  const brut = avant.personne.revenu + (avant.conjoint && avant.marie ? avant.conjoint.revenu : 0);
  const rachatEchelonne = impots && avant.canton && (mesures.rachatLPP ?? 0) > 0
    ? Impots.rachatEchelonne(impots, avant.canton, avant.marie, brut, mesures.rachatLPP, 5, avant.enfantsACharge) : [];
  const brutes = Conseil.rediger(avant, mesures, apres, { rachatEchelonne });
  const valeurs = v => Object.fromEntries(Object.entries(v).map(([cle, n]) => [cle, cle.endsWith('Chf') ? f.chf(n) : cle.endsWith('Pct') ? f.pourcent(Math.min(1, n)) : String(n)]));
  const points = brutes.points.map(p => {
    let phrase = t(p.cle, valeurs(p.v));
    if (p.cle === 'cs_rachat') phrase += ' ' + (p.v.annees > 1 ? t('cs_rachatEtale', valeurs(p.v)) : t('cs_rachatBlocage'));
    return { urgence: p.urgence, phrase };
  });
  return { resume: t(brutes.resume.cle, valeurs(brutes.resume.v)), points };
}

/** Texte brut, pour le procès-verbal de conseil. */
export function enTexte(ctx) {
  const { t } = ctx, c = rediger(ctx);
  return { recommandation: c.points.filter(p => p.urgence !== 'aReunir').map((p, i) => `${i + 1}. ${p.phrase}`).join('\n'),
    raisons: [c.resume, ...c.points.filter(p => p.urgence === 'aReunir').map(p => p.phrase)].join('\n') || t('cs_resumeCouvert') };
}

function liste(ctx, c) {
  const { t } = ctx;
  let rang = 0;
  return h('ol', { class: 'conseil-liste' }, ...c.points.map(p => h('li', { class: 'conseil-point', 'data-urgence': p.urgence },
    h('span', { class: 'conseil-rang' }, String(++rang)), h('div', {}, h('small', {}, t('cs_u_' + p.urgence)), h('p', {}, p.phrase)))));
}

/** Carte de la vue Conseil. */
export function carte(ctx) {
  const { t } = ctx, c = rediger(ctx);
  const etat = h('small', { class: 'petit', role: 'status' }, '');
  const copier = h('button', { type: 'button', class: 'pastille', onclick: () => {
    const pv = procesVerbal(), texte = enTexte(ctx);
    pv.recommandation = texte.recommandation; pv.raisons = texte.raisons; garder();
    etat.textContent = t('cs_copie');
  } }, t('cs_copier'));
  return h('div', { class: 'carte conseil' },
    h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('cs_titre')), h('p', {}, t('cs_sous'))), h('div', { class: 'conseil-actions' }, copier, etat)),
    h('p', { class: 'conseil-resume' }, c.resume), liste(ctx, c));
}

/** Page du rapport. */
export function page(ctx, { page: faire, entete, pied }, numero) {
  const { t } = ctx, c = rediger(ctx);
  return faire('', entete(t('cs_titre')), h('p', { class: 'r-texte conseil-resume' }, c.resume), liste(ctx, c), h('p', { class: 'petit' }, t('cs_sous')), pied(numero));
}
