// @ts-check
/**
 * Vue « Plan » : les mesures qui comblent les lacunes, et l'effet de chacune. Le moteur propose un plan (risques
 * d'abord, puis la retraite par les leviers fiscaux) ; le conseiller l'ajuste avec le client, et voit avant / après.
 */

import { h, compter, couleurCouverture } from '../ui.js';
import { etat } from '../etat.js';
import { analyser, Scenarios, Impots } from '../../../moteur/src/index.js';
import { dossier, garder } from '../etat.js';
import { curseur } from '../formulaire.js';
import { RISQUES } from './analyse.js';
import * as ConseilTexte from '../conseil-texte.js';

/** @type {Record<string, HTMLElement>} */ let r = {};

/** Le plan en vigueur : celui que le conseiller a réglé, sinon celui que le moteur propose. */
export function planCourant(ctx) {
  const propose = Scenarios.proposerPlan(ctx.dossierMoteur, ctx.regles, { impots: ctx.impots });
  const d = dossier(), mesures = d.mesures?.[d.cible] ?? propose.mesures;
  const apres = analyser(Scenarios.appliquerMesures(ctx.dossierMoteur, mesures, ctx.regles), ctx.regles, { impots: ctx.impots });
  return { mesures, propose: propose.mesures, avant: ctx.analyse, apres };
}

export function monter(ctx, racine) {
  const { t, f, analyse: a } = ctx, d = dossier();
  if (!a) return;
  const { mesures } = planCourant(ctx), pot = a.potentiels;
  const regler = (cle, valeur) => { d.mesures ??= {}; d.mesures[d.cible] = { ...planCourant(ctx).mesures, [cle]: valeur }; garder(); afficher(ctx); };
  const glisse = (cle, libelle, max, pas, mise = f.chf) => curseur(cle, libelle, 0, Math.max(pas, max), pas, mise,
    { lecture: () => Math.min(max, mesures[cle] ?? 0), ecriture: (_, v) => regler(cle, v) });
  const bascule = (cle, libelle) => h('label', { class: 'bascule' }, t(libelle), h('input', { type: 'checkbox', checked: !!mesures[cle], onchange: e => regler(cle, e.target.checked) }));
  // primes annuelles des offres reçues : saisies par le conseiller, elles complètent le budget du plan
  const primes = () => (d.primes ??= {})[d.cible] ??= {};
  const prime = (cle, libelle) => h('label', { class: 'champ' }, h('span', {}, t(libelle)), h('div', { class: 'montant' },
    h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: primes()[cle] ? f.nombre(primes()[cle]) : '',
      oninput: e => { const brut = e.target.value.replace(/[^\d]/g, ''); primes()[cle] = brut === '' ? 0 : +brut; garder(); afficher(ctx); },
      onblur: e => { e.target.value = primes()[cle] ? f.nombre(primes()[cle]) : ''; } })));
  const ref = (cle, e) => (r[cle] = e);
  racine.replaceChildren(
    h('div', { class: 'carte plan-tete' },
      h('div', {}, h('p', { class: 'surtitre' }, t('pl_titre')), ref('phrase', h('p', { class: 'grand petit-grand' })), ref('sousPhrase', h('p', { class: 'note' }))),
      h('div', { class: 'avant-apres' },
        h('div', {}, h('small', {}, t('pl_avant')), ref('scoreAvant', h('b', {}, '0'))), h('span', { class: 'fleche', 'aria-hidden': 'true' }, '→'),
        h('div', { class: 'apres' }, h('small', {}, t('pl_apres')), ref('scoreApres', h('b', {}, '0'))))),
    ref('conseil', h('div', {})),
    h('div', { class: 'deux' },
      h('div', { class: 'carte' }, h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('pl_mesures')), h('p', {}, t('pl_mesures_d'))),
        h('button', { type: 'button', class: 'pastille', onclick: () => { if (d.mesures) delete d.mesures[d.cible]; garder(); monter(ctx, racine); } }, t('pl_proposer'))),
        h('div', { class: 'champs nus' },
          h('p', { class: 'intertitre' }, t('pl_risques')),
          glisse('renteInvalidite', 'pl_renteInvalidite', 72000, 1200), glisse('capitalDeces', 'pl_capitalDeces', 1500000, 10000),
          bascule('ijm', 'pl_ijm'), ...(d[d.cible]?.statut === 'independant' ? [bascule('laa', 'pl_laa')] : []),
          h('p', { class: 'intertitre' }, t('pl_retraite')),
          glisse('versement3a', 'pl_3a', pot.pilier3a.potentiel, 100),
          ...(pot.rachatLPP.possible > 0 ? [glisse('rachatLPP', 'pl_rachat', pot.rachatLPP.possible, 1000)] : []),
          glisse('epargneLibre', 'pl_epargne', 36000, 600),
          h('p', { class: 'intertitre' }, t('pl_primesTitre')),
          h('p', { class: 'petit sans-marge' }, t('pl_primesAide')),
          h('div', { class: 'rangee' }, prime('renteInvalidite', 'pl_primeInvalidite'), prime('capitalDeces', 'pl_primeDeces')),
          h('div', { class: 'rangee' }, prime('ijm', 'pl_primeIjm'), prime('laa', 'pl_primeLaa')))),
      h('div', { class: 'carte' }, h('h2', {}, t('pl_effet')), ref('effets', h('div', { class: 'effets' })), ref('fiscal', h('div')))),
    h('p', { class: 'avertissement' }, t('pl_note')));
  afficher(ctx);
}

export function afficher(ctx) {
  const { t, f, impots } = ctx;
  if (!r.effets || !ctx.analyse) return;
  const { mesures, avant, apres } = planCourant(ctx);
  compter(r.scoreAvant, avant.score, v => String(Math.round(v)));
  compter(r.scoreApres, apres.score, v => String(Math.round(v)));
  r.scoreApres.style.color = couleurCouverture(apres.score / 100);
  const restantes = RISQUES.filter(c => apres.risques[c].lacune > 0 && apres.risques[c].besoin > 0).length;
  r.phrase.textContent = restantes === 0 ? t('pl_toutCouvert') : restantes === 1 ? t('pl_reste1') : t('pl_reste', { n: restantes });
  const mensuel = ((mesures.versement3a ?? 0) + (mesures.epargneLibre ?? 0)) / 12;
  r.sousPhrase.textContent = t('pl_effort', { m: f.chf(mensuel), r: f.chf(mesures.rachatLPP ?? 0) });
  r.conseil.replaceChildren(ConseilTexte.carte(ctx));   // le conseil suit le plan réglé par le conseiller
  r.effets.replaceChildren(...RISQUES.filter(c => avant.risques[c].besoin > 0).map(c => {
    const x = avant.risques[c], y = apres.risques[c], echelle = Math.max(x.besoin, 1);
    return h('div', { class: 'effet' },
      h('div', { class: 'effet-tete' }, h('span', {}, t(c)), h('b', { class: y.lacune > 0 ? 'lacune' : 'ok' },
        y.lacune > 0 ? `− ${f.chf(y.lacuneMensuelle)} ${t('parMois')}` : t('aucuneLacune'))),
      h('div', { class: 'effet-barres' },
        h('i', { class: 'avant', style: { width: `${Math.min(100, x.total / echelle * 100)}%` } }),
        h('i', { class: 'apres', style: { width: `${Math.min(100, y.total / echelle * 100)}%`, background: couleurCouverture(y.couverture) } })),
      h('small', {}, x.lacune > 0 ? t('pl_avantLacune', { m: f.chf(x.lacuneMensuelle) }) : t('pl_dejaCouvert')));
  }));
  // effet fiscal des versements déductibles
  const a = avant, brut = a.personne.revenu + (a.conjoint && a.marie ? a.conjoint.revenu : 0);
  const eco = montant => (impots && a.canton ? Impots.economieDeduction(impots, a.canton, a.marie, brut, montant, a.enfantsACharge) ?? 0 : Math.round(montant * a.potentiels.tauxMarginal));
  const eco3a = eco(mesures.versement3a ?? 0), ecoRachat = eco(mesures.rachatLPP ?? 0);
  r.fiscal.replaceChildren(h('div', { class: 'chiffres' },
    h('div', { class: 'chiffre plus' }, h('small', {}, t('pl_eco3a')), h('b', {}, f.chf(eco3a)), h('span', {}, t('parAn'))),
    h('div', { class: 'chiffre plus' }, h('small', {}, t('pl_ecoRachat')), h('b', {}, f.chf(ecoRachat)), h('span', {}, t('pl_uneFois')))),
    budget(ctx, mesures, eco3a),
    h('p', { class: 'petit' }, t('pl_primes')));
}

/** Budget annuel et mensuel du plan : épargne, primes des offres saisies, moins l'économie d'impôt récurrente. */
export function budgetPlan(mesures, eco3a) {
  const d = dossier(), p = d.primes?.[d.cible] ?? {};
  const epargne = (mesures.versement3a ?? 0) + (mesures.epargneLibre ?? 0);
  const primes = (mesures.renteInvalidite ? p.renteInvalidite ?? 0 : 0) + (mesures.capitalDeces ? p.capitalDeces ?? 0 : 0) + (mesures.ijm ? p.ijm ?? 0 : 0) + (mesures.laa ? p.laa ?? 0 : 0);
  const attendues = [mesures.renteInvalidite && !p.renteInvalidite, mesures.capitalDeces && !p.capitalDeces, mesures.ijm && !p.ijm, mesures.laa && !p.laa].filter(Boolean).length;
  return { epargne, primes, economie: eco3a, net: epargne + primes - eco3a, attendues };
}

function budget({ t, f }, mesures, eco3a) {
  const b = budgetPlan(mesures, eco3a);
  return h('div', { class: 'budget' }, h('h3', {}, t('pl_budget')),
    h('ul', { class: 'lignes' },
      h('li', {}, h('span', {}, t('pl_budgetEpargne')), h('b', {}, f.chf(b.epargne))),
      h('li', {}, h('span', {}, t('pl_budgetPrimes'), b.attendues ? h('em', {}, t('pl_offresAttendues', { n: b.attendues })) : null), h('b', {}, f.chf(b.primes))),
      h('li', {}, h('span', {}, t('pl_budgetEconomie')), h('b', {}, '− ' + f.chf(b.economie))),
      h('li', { class: 'total' }, h('span', {}, t('pl_budgetNet')), h('b', {}, `${f.chf(b.net)} · ${f.chf(b.net / 12)} ${t('parMois')}`))));
}
