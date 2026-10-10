// @ts-check
/**
 * Trois outils de conseil construits sur l'analyse :
 *
 * - `resistance` : ce que devient la retraite si une hypothèse tourne mal (taux de conversion abaissé par la caisse,
 *   placements sans rendement, vie plus longue, départ avancé, train de vie plus élevé). Un plan solide tient ces chocs.
 * - `feuilleDeRoute` : les échéances légales de la personne, année par année (3a, encouragement à la propriété,
 *   rachats, retraite anticipée, rente AVS, ajournement). Ce sont des dates que l'on ne rattrape pas.
 * - `coutAttente` : ce que coûte le fait de remettre le 3e pilier à plus tard (capital et économie d'impôt perdus).
 *
 * Comme le reste du moteur, rien n'est rédigé ici : chaque élément porte un code (`cle`) que l'interface traduit.
 */

import { analyser } from './analyse.js';
import { anneeNaissance, arrondi, renteDepuisCapital, valeurFuture } from './util.js';

/** Baisse du taux de conversion appliquée par le choc « conversion », en points (6,8 % devient 5,8 %). */
export const CHOC_CONVERSION = 0.01;
/** Années de vie en plus du choc « longévité ». */
export const CHOC_LONGEVITE = 5;
/** Années d'avance du choc « départ ». */
export const CHOC_DEPART = 2;
/** Part du revenu en plus du choc « train de vie » (80 % devient 90 %). */
export const CHOC_TRAIN_DE_VIE = 0.1;

/**
 * Test de résistance de la retraite : chaque choc modifie une seule hypothèse, puis l'analyse est refaite.
 * @param {import('./analyse.js').Dossier} dossier @param {any} regles @param {{impots?: any}} [contexte]
 * @returns {{base: {lacune: number, lacuneMensuelle: number, couverture: number, capital: number, score: number},
 *            chocs: {cle: string, applicable: boolean, lacune: number, lacuneMensuelle: number, couverture: number, capital: number,
 *                    score: number, ecartMensuel: number, v: Record<string, number>}[]}}
 */
export function resistance(dossier, regles, contexte = {}) {
  const avant = analyser(dossier, regles, contexte);
  const resume = a => ({ lacune: a.risques.retraite.lacune, lacuneMensuelle: a.risques.retraite.lacuneMensuelle,
    couverture: a.risques.retraite.couverture, capital: a.risques.retraite.capital ?? 0, score: a.score });
  const base = resume(avant);
  const p = dossier.personne, lpp = p.lpp ?? {}, hyp = dossier.hypotheses ?? {}, besoins = dossier.besoins ?? {};
  const conversion = lpp.tauxConversion ?? regles.lpp.tauxConversion, basse = Math.max(0, conversion - CHOC_CONVERSION);
  const P = avant.personne, ageFin = hyp.ageFinRente ?? 90, depart = P.ageRetraite - CHOC_DEPART;
  const troisieme = avant.risques.retraite.sources.filter(s => s.pilier === 3).reduce((s, x) => s + x.montant, 0);
  // l'âge de départ avancé laisse l'analyse recalculer la réduction de la rente AVS (comme `agesDeDepart`)
  const hypothesesDepart = { ...hyp, ageRetraite: depart };
  delete hypothesesDepart.flexibilisationAVS;
  /** @type {{cle: string, applicable: boolean, v: Record<string, number>, dossier: import('./analyse.js').Dossier}[]} */
  const essais = [
    // la caisse abaisse son taux de conversion : la rente du certificat baisse dans la même proportion
    { cle: 'conversion', applicable: P.lpp.affilie && P.lpp.renteVieillesse > 0 && conversion > 0, v: { de: conversion, a: basse },
      dossier: { ...dossier, personne: { ...p, lpp: { ...lpp, tauxConversion: basse,
        ...(lpp.renteVieillesse !== undefined && conversion > 0 ? { renteVieillesse: lpp.renteVieillesse * basse / conversion } : {}) } } } },
    // les placements ne rapportent rien : 3e pilier et fortune sans rendement
    { cle: 'rendement', applicable: troisieme > 0, v: {}, dossier: { ...dossier, hypotheses: { ...hyp, rendement3a: 0, rendementFortune: 0 } } },
    // la retraite dure plus longtemps : les capitaux doivent tenir cinq ans de plus
    { cle: 'longevite', applicable: true, v: { age: ageFin + CHOC_LONGEVITE }, dossier: { ...dossier, hypotheses: { ...hyp, ageFinRente: ageFin + CHOC_LONGEVITE } } },
    // le départ est avancé de deux ans (pas avant 58 ans, âge minimal de la retraite anticipée du 2e pilier)
    { cle: 'depart', applicable: depart >= 58 && depart > P.age, v: { age: depart }, dossier: { ...dossier, hypotheses: hypothesesDepart } },
    // le train de vie à la retraite demande dix points de revenu en plus
    { cle: 'trainDeVie', applicable: P.revenu > 0, v: { part: (besoins.retraite ?? 0.8) + CHOC_TRAIN_DE_VIE },
      dossier: { ...dossier, besoins: { ...besoins, retraite: (besoins.retraite ?? 0.8) + CHOC_TRAIN_DE_VIE } } },
  ];
  const chocs = essais.map(e => {
    const r = e.applicable ? resume(analyser(e.dossier, regles, contexte)) : base;
    return { cle: e.cle, applicable: e.applicable, ...r, ecartMensuel: arrondi((r.lacune - base.lacune) / 12), v: e.v };
  });
  return { base, chocs };
}

/** Année et mois où un âge (ans, mois) est atteint. @param {string} naissance AAAA-MM-JJ */
function echeance(naissance, ans, mois = 0) {
  const an = +naissance.slice(0, 4), m = +naissance.slice(5, 7) || 1;
  const total = (an + ans) * 12 + (m - 1) + mois;
  return { annee: Math.floor(total / 12), mois: total % 12 + 1 };
}

/**
 * Feuille de route : les échéances légales à venir de la personne, dans l'ordre.
 * - 3a : versement de l'année avant le 31 décembre ; retrait possible cinq ans avant l'âge de référence, au plus tard
 *   cinq ans après si l'activité continue (OPP 3 art. 3).
 * - Logement : jusqu'à 50 ans, tout l'avoir du 2e pilier peut être retiré ; ensuite, une partie seulement
 *   (LPP art. 30c, OEPL art. 5). Dernier retrait trois ans avant le droit aux prestations de vieillesse.
 * - Rachat : un capital ne peut pas être retiré dans les trois ans qui suivent un rachat (LPP art. 79b al. 3).
 * - Retraite anticipée du 2e pilier : au plus tôt à 58 ans (OPP 2 art. 1i), selon le règlement de la caisse.
 * - AVS : anticipation dès 63 ans (62 ans pour les femmes nées de 1961 à 1969), rente ordinaire le mois qui suit
 *   l'âge de référence, à demander trois à quatre mois avant ; ajournement de cinq ans au plus (LAVS art. 39 et 40).
 * @param {import('./analyse.js').Dossier} dossier @param {any} regles @param {{impots?: any}} [contexte]
 * @returns {{cle: string, annee: number, age: number, v: Record<string, number>}[]}
 */
export function feuilleDeRoute(dossier, regles, contexte = {}) {
  const a = analyser(dossier, regles, contexte), P = a.personne, pot = a.potentiels;
  const naissance = dossier.personne.dateNaissance, ne = anneeNaissance(naissance);
  const maintenant = +(dossier.dateAnalyse ?? new Date().toISOString()).slice(0, 4);
  const ref = P.ageReference, reference = echeance(naissance, ref.ans, ref.mois);
  // la rente commence le premier jour du mois qui suit l'âge de référence
  const debutRente = reference.mois === 12 ? { annee: reference.annee + 1, mois: 1 } : { annee: reference.annee, mois: reference.mois + 1 };
  const transitoire = dossier.personne.sexe === 'f' && ne >= 1961 && ne <= 1969;
  const depart = Math.max(P.ageRetraite, P.age + 1), affilie = P.lpp.affilie && (P.lpp.avoirActuel > 0 || P.lpp.avoirRetraite > 0);
  const delai = regles.lpp.logement?.delaiAvantRetraite ?? 3, limite = regles.lpp.logement?.ageLimiteTotal ?? 50;
  const troisA = P.capital3a > 0 || pot.pilier3a.potentiel > 0;
  /** @type {{cle: string, annee: number, age: number, v: Record<string, number>}[]} */
  const etapes = [];
  const a_ = (cle, age, v = {}, annee = ne + age) => etapes.push({ cle, annee, age, v });
  if (pot.pilier3a.potentiel > 0) a_('versement3a', P.age, { montant: pot.pilier3a.potentiel, economie: pot.pilier3a.economieImpot }, maintenant);
  if (affilie) a_('logementEntier', limite);
  if (pot.rachatLPP.possible > 0) a_('rachatDernier', depart - 3, { montant: pot.rachatLPP.possible, depart });
  if (affilie) a_('logementDernier', depart - delai, { depart });
  if (affilie) a_('anticipationLPP', 58);
  // cinq ans avant l'âge de référence, au mois près (femmes de la génération transitoire : 64 ans et quelques mois)
  if (troisA) { const tot = echeance(naissance, ref.ans - 5, ref.mois); a_('retrait3a', ref.ans - 5, {}, tot.annee); }
  a_('anticipationAVS', transitoire ? 62 : 63);
  a_('renteAVS', ref.ans, { mois: debutRente.mois, anneeRente: debutRente.annee, moisAge: ref.mois }, debutRente.annee);
  a_('ajournementFin', ref.ans + 5);
  // seulement ce qui est encore devant soi, dans l'ordre des années (à année égale, l'ordre de la liste ci-dessus)
  return etapes.filter(e => e.annee >= maintenant && e.age >= P.age).sort((x, y) => x.annee - y.annee);
}

/**
 * Coût de l'attente : capital de retraite et économie d'impôt perdus si le versement 3a commence plus tard.
 * Le capital perdu est l'écart entre les versements faits dès maintenant et ceux qui commencent `k` années plus tard,
 * au rendement supposé du 3a ; sa contre-valeur en rente utilise les mêmes hypothèses que l'analyse.
 * @param {import('./analyse.js').Dossier} dossier @param {any} regles
 * @param {{impots?: any, versement?: number, reports?: number[]}} [contexte] `versement` : montant annuel étudié (à défaut, le potentiel 3a)
 * @returns {{applicable: boolean, versement: number, annees: number, rendement: number, economieAnnuelle: number, capital: number,
 *            reports: {annees: number, capitalPerdu: number, impotsPerdus: number, renteMensuelle: number}[]}}
 */
export function coutAttente(dossier, regles, contexte = {}) {
  const a = analyser(dossier, regles, contexte), P = a.personne, pot = a.potentiels.pilier3a, hyp = dossier.hypotheses ?? {};
  const versement = Math.max(0, Math.min(contexte.versement ?? pot.potentiel, pot.potentiel));
  const annees = Math.max(0, P.ageRetraite - P.age), rendement = hyp.rendement3a ?? 0.02;
  const duree = Math.max(1, (hyp.ageFinRente ?? 90) - P.ageRetraite), tauxRente = hyp.rendementFortune ?? 0.015;
  // l'économie d'impôt du versement étudié, au prorata de celle du potentiel entier
  const economieAnnuelle = pot.potentiel > 0 ? arrondi(pot.economieImpot * versement / pot.potentiel, 10) : 0;
  const complet = valeurFuture(0, versement, annees, rendement);
  const reports = (contexte.reports ?? [1, 3, 5]).filter(k => k < annees).map(k => {
    const perdu = complet - valeurFuture(0, versement, annees - k, rendement);
    return { annees: k, capitalPerdu: arrondi(perdu, 100), impotsPerdus: arrondi(economieAnnuelle * k, 10),
             renteMensuelle: arrondi(renteDepuisCapital(perdu, duree, tauxRente) / 12) };
  });
  return { applicable: versement > 0 && reports.length > 0, versement, annees, rendement, economieAnnuelle, capital: arrondi(complet, 100), reports };
}
