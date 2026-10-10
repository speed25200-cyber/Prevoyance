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
import * as Partage from '../partage.js';

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
  // les deux offres comparées : montants saisis par le conseiller, gardés dans le dossier
  const offres = () => { const o = (d.offres ??= {}); return (o[d.cible] ??= [{}, {}]); };
  const offre = (i, cle, libelle) => h('label', { class: 'champ' }, h('span', {}, t(libelle)), h('div', { class: 'montant' },
    h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: offres()[i][cle] ? f.nombre(offres()[i][cle]) : '',
      oninput: e => { const brut = e.target.value.replace(/[^\d]/g, ''); offres()[i][cle] = brut === '' ? 0 : +brut; garder(); afficher(ctx); },
      onblur: e => { e.target.value = offres()[i][cle] ? f.nombre(offres()[i][cle]) : ''; } })));
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
    // ce qu'il faut demander aux assureurs pour couvrir les risques du plan
    ref('demande', h('div', { class: 'carte' })),
    // deux offres reçues, côte à côte : ce que chacune comble, et à quel prix
    h('div', { class: 'carte' }, h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('of_titre')), h('p', {}, t('of_d')))),
      h('div', { class: 'champs nus' }, ...[0, 1].flatMap(i => [
        h('p', { class: 'intertitre' }, t(i ? 'of_b' : 'of_a')),
        offre(i, 'prime', 'of_prime'), offre(i, 'renteInvalidite', 'of_rente'), offre(i, 'capitalDeces', 'of_capital')])),
      ref('offres', h('div', {})),
      h('p', { class: 'petit' }, t('of_note'))),
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
  // un risque reste ouvert s'il manque un revenu aujourd'hui, plus tard (rentes d'enfants qui s'éteignent), ou un capital
  const pire = x => Math.max(x.lacune, x.lacuneMax ?? 0);
  const restantes = RISQUES.filter(c => apres.risques[c].besoin > 0 && (pire(apres.risques[c]) > 0 || (apres.risques[c].capital ?? 0) > 0)).length;
  r.phrase.textContent = restantes === 0 ? t('pl_toutCouvert') : restantes === 1 ? t('pl_reste1') : t('pl_reste', { n: restantes });
  const mensuel = ((mesures.versement3a ?? 0) + (mesures.epargneLibre ?? 0)) / 12;
  r.sousPhrase.textContent = (mesures.rachatLPP ?? 0) > 0 ? t('pl_effort', { m: f.chf(mensuel), r: f.chf(mesures.rachatLPP) }) : t('pl_effortSeul', { m: f.chf(mensuel) });
  r.conseil.replaceChildren(ConseilTexte.carte(ctx));   // le conseil suit le plan réglé par le conseiller
  afficherDemande(ctx, mesures, avant);
  r.effets.replaceChildren(...RISQUES.filter(c => avant.risques[c].besoin > 0).map(c => {
    const x = avant.risques[c], y = apres.risques[c], echelle = Math.max(x.besoin, 1);
    // la lacune montrée est la plus grande à venir ; les barres, la couverture de cette année-là
    const manque = pire(x), reste = pire(y), plusTard = x.lacune === 0 && manque > 0;
    return h('div', { class: 'effet' },
      h('div', { class: 'effet-tete' }, h('span', {}, t(c)), h('b', { class: reste > 0 ? 'lacune' : 'ok' },
        reste > 0 ? `− ${f.chf(reste / 12)} ${t('parMois')}` : t('aucuneLacune'))),
      h('div', { class: 'effet-barres' },
        h('i', { class: 'avant', style: { width: `${Math.min(100, (x.besoin - manque) / echelle * 100)}%` } }),
        h('i', { class: 'apres', style: { width: `${Math.min(100, (y.besoin - reste) / echelle * 100)}%`, background: couleurCouverture(y.couverture) } })),
      h('small', {}, manque > 0 ? t(plusTard ? 'pl_plusTard' : 'pl_avantLacune', { m: f.chf(manque / 12) }) : t('pl_dejaCouvert')));
  }));
  // les deux offres : chacune appliquée au dossier, puis comparées
  if (r.offres) {
    const saisies = dossier().offres?.[dossier().cible] ?? [{}, {}];
    const duel = Scenarios.comparerOffres(ctx.dossierMoteur, ctx.regles, saisies, { impots });
    r.offres.replaceChildren(h('div', { class: 'options' }, ...duel.offres.map((o, i) => h('div', { class: 'option' + (duel.meilleure === i ? ' meilleure' : '') },
      h('h3', {}, t(i ? 'of_b' : 'of_a') + (duel.meilleure === i ? ` · ${t('of_retenir')}` : '')),
      h('b', {}, o.saisie ? `${f.chf(o.prime)} ${t('parAn')}` : '—'),
      h('small', {}, !o.saisie ? t('of_vide') : o.couvre ? t('of_couvre') : t('of_partiel')),
      o.saisie ? h('ul', {},
        h('li', {}, h('span', {}, t('of_score')), h('b', {}, `${o.score} / 100`)),
        h('li', {}, h('span', {}, t('of_resteInv')), h('b', {}, o.lacuneInvalidite > 0 ? `− ${f.chf(o.lacuneInvaliditeMensuelle)} ${t('parMois')}` : '✓')),
        h('li', {}, h('span', {}, t('of_resteDeces')), h('b', {}, o.capitalDecesManquant > 0 ? f.chf(o.capitalDecesManquant) : '✓')),
        o.excedentRente > 0 ? h('li', {}, h('span', {}, t('of_excedent')), h('b', {}, `${f.chf(o.excedentRente)} ${t('parAn')}`)) : null) : null))));
  }
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

/**
 * Demande d'offre : les lignes à transmettre aux assureurs pour les assurances de risque du plan. Aucun nom, aucune
 * adresse : seulement ce qui sert au tarif (sexe, année de naissance, activité, canton, revenu, prestations voulues).
 * @returns {string[]} lignes du texte, dans la langue de l'interface ; vide si le plan n'assure aucun risque
 */
export function lignesDemande({ t, f, regles }, mesures, avant) {
  const d = dossier(), p = d[d.cible === 'conjoint' ? 'conjoint' : 'personne'] ?? {}, P = avant.personne, lignes = [];
  const rente = mesures.renteInvalidite ?? 0, capital = mesures.capitalDeces ?? 0;
  if (!(rente > 0 || capital > 0 || mesures.ijm || mesures.laa)) return lignes;
  const ijm = regles.maladie.ijmUsuelle;
  lignes.push(t('do_l_personne', { sexe: t(p.sexe === 'f' ? 'femme' : 'homme'), annee: String(p.dateNaissance ?? '').slice(0, 4), statut: t(p.statut ?? 'salarie'), canton: d.canton }));
  lignes.push(t('do_l_revenu', { m: f.chf(P.revenu) }));
  if (rente > 0) lignes.push(t('do_l_rente', { m: f.chf(rente), age: P.ageReference.ans, d: Math.round(ijm.jours / 365 * 12) }));
  if (capital > 0) lignes.push(t('do_l_capital', { m: f.chf(capital), n: Math.max(1, avant.risques.decesMaladie.annees) }));
  if (mesures.ijm) lignes.push(t('do_l_ijm', { t: Math.round(ijm.taux * 100), j: ijm.jours, d: ijm.delaiJours }));
  if (mesures.laa) lignes.push(t('do_l_laa', { m: f.chf(Math.min(P.revenu, regles.laa.gainAssureMax)) }));
  lignes.push(t('do_l_aPreciser'), t('do_l_fin'));
  return lignes;
}

function afficherDemande(ctx, mesures, avant) {
  if (!r.demande) return;
  const { t } = ctx, lignes = lignesDemande(ctx, mesures, avant);
  const etat = h('small', { class: 'petit', role: 'status' }, ''), texte = [t('do_objet'), '', ...lignes.map(l => `• ${l}`)].join('\n');
  // dans l'app iPhone / iPad : la feuille de partage d'iOS (Copier, Mail, Messages) ; dans un navigateur : le presse-papiers
  const copier = h('button', { type: 'button', class: 'pastille', onclick: async () => {
    if (await Partage.texte(texte) === 'copie') etat.textContent = t('do_copie');   // presse-papiers refusé : le texte reste à l'écran
  } }, t(Partage.dansApp() ? 'do_partager' : 'do_copier'));
  const courriel = h('a', { class: 'pastille', href: `mailto:?subject=${encodeURIComponent(t('do_objet'))}&body=${encodeURIComponent(texte)}` }, t('do_courriel'));
  r.demande.replaceChildren(
    h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('do_titre')), h('p', {}, t('do_d'))),
      // dans l'app iPhone / iPad, un lien « mailto » décrit à l'app ne serait qu'un libellé sans effet : « Partager » propose Mail
      lignes.length ? h('div', { class: 'demande-actions' }, copier, document.documentElement.classList.contains('natif') ? null : courriel, etat) : null),
    lignes.length ? h('ul', { class: 'demande-lignes' }, ...lignes.map(l => h('li', {}, l))) : h('p', { class: 'petit' }, t('do_rien')));
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
