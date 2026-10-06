// @ts-check
/**
 * 2e pilier : prévoyance professionnelle (LPP).
 *
 * Deux niveaux de précision. Quand le conseiller a le certificat de prévoyance, ses valeurs priment (avoir, rentes
 * projetées, prestations de risque, rachat possible) : les caisses assurent presque toujours plus que le minimum.
 * Sans certificat, on calcule le minimum légal, et le résultat est marqué « estimé ».
 */

import { arrondi, borne } from './util.js';

/**
 * Salaire coordonné LPP (part obligatoire).
 * @param {any} regles @param {number} salaireAVS annuel
 * @returns {number} 0 si le seuil d'entrée n'est pas atteint
 */
export function salaireCoordonne(regles, salaireAVS) {
  const l = regles.lpp;
  if (salaireAVS < l.seuilEntree) return 0;
  return borne(Math.min(salaireAVS, l.salaireMaxLPP) - l.deductionCoordination, l.salaireCoordonneMin, l.salaireCoordonneMax);
}

/** Taux de bonification de vieillesse à un âge donné. @param {any} regles @param {number} age */
export function tauxBonification(regles, age) {
  for (const [de, a, taux] of regles.lpp.bonifications) if (age >= de && age <= a) return taux;
  return 0;
}

/**
 * Projection de l'avoir de vieillesse année par année jusqu'à la retraite (minimum légal, ou plan personnalisé).
 * @param {any} regles
 * @param {{age: number, avoir: number, salaireAVS: number, ageRetraite?: number, interet?: number,
 *          croissanceSalaire?: number, tauxEpargne?: (age: number) => number, salaireAssure?: number, decalageAge?: number}} p
 * @returns {{avoirFinal: number, sansInteret: number, annees: {age: number, salaireAssure: number, bonification: number, avoir: number}[]}}
 */
export function projeterAvoir(regles, p) {
  const { age, avoir, salaireAVS, ageRetraite = 65, croissanceSalaire = 0 } = p;
  const interet = p.interet ?? regles.lpp.tauxInteretMinimal;
  const ageReference = regles.lpp.ageReference ?? 65;
  let a = avoir, sansInteret = avoir, salaire = salaireAVS;
  const annees = [];
  for (let x = age; x < ageRetraite; x++) {
    const assure = p.salaireAssure !== undefined ? p.salaireAssure * Math.pow(1 + croissanceSalaire, x - age) : salaireCoordonne(regles, salaire);
    // les bonifications légales s'arrêtent à l'âge de référence ; au-delà (ajournement), l'avoir ne porte plus que des intérêts
    // la tranche de bonification suit l'âge LPP (année civile moins année de naissance), parfois un an de plus que l'âge révolu
    const taux = p.tauxEpargne ? p.tauxEpargne(x) : x < ageReference ? tauxBonification(regles, x + (p.decalageAge ?? 0)) : 0;
    const bonification = assure * taux;
    a = a * (1 + interet) + bonification;
    sansInteret += bonification;
    annees.push({ age: x + 1, salaireAssure: arrondi(assure), bonification: arrondi(bonification), avoir: arrondi(a) });
    salaire *= 1 + croissanceSalaire;
  }
  return { avoirFinal: arrondi(a), sansInteret: arrondi(sansInteret), annees };
}

/**
 * Prestations LPP d'une personne : valeurs du certificat si elles existent, sinon minimum légal.
 * Toutes les rentes sont annuelles.
 * @param {any} regles
 * @param {{age: number, salaireAVS: number, ageRetraite?: number, croissanceSalaire?: number, interet?: number, decalageAge?: number,
 *          lpp?: {affilie?: boolean, avoir?: number, renteVieillesse?: number, capitalRetraite?: number,
 *                 tauxConversion?: number, renteInvalidite?: number, renteConjoint?: number, renteEnfant?: number,
 *                 capitalDeces?: number, rachatPossible?: number, partCapital?: number}}} p
 */
export function prestationsLPP(regles, p) {
  const c = p.lpp ?? {};
  const coordonne = salaireCoordonne(regles, p.salaireAVS);
  const affilie = c.affilie ?? coordonne > 0;
  if (!affilie) {
    return { affilie: false, estime: false, salaireCoordonne: 0, avoirActuel: c.avoir ?? 0, avoirRetraite: c.avoir ?? 0,
             renteVieillesse: 0, capitalRetraite: c.avoir ?? 0, renteInvalidite: 0, renteConjoint: 0, renteEnfant: 0,
             capitalDeces: c.capitalDeces ?? 0, rachatPossible: 0, projection: [] };
  }
  const ageReference = regles.lpp.ageReference ?? 65, ageRetraite = p.ageRetraite ?? ageReference, ecart = ageRetraite - ageReference;
  const base = { age: p.age, avoir: c.avoir ?? 0, salaireAVS: p.salaireAVS, interet: p.interet, decalageAge: p.decalageAge };
  const projection = projeterAvoir(regles, { ...base, ageRetraite, croissanceSalaire: p.croissanceSalaire });
  const aReference = ecart === 0 ? projection : projeterAvoir(regles, { ...base, ageRetraite: ageReference, croissanceSalaire: p.croissanceSalaire });
  // Départ avant ou après l'âge de référence : l'avoir s'arrête plus tôt ou continue de porter intérêt, et le taux de
  // conversion bouge d'environ 0,2 point par année d'écart (usage des caisses ; le règlement fait foi). Les valeurs du
  // certificat, données pour l'âge de référence, sont ajustées dans la même proportion : le niveau du plan est conservé.
  const conversionReference = c.tauxConversion ?? regles.lpp.tauxConversion;
  const conversion = Math.max(0, conversionReference + (regles.lpp.conversionParAnneeEcart ?? 0.002) * ecart);
  // Rente du certificat sans avoir saisi : l'avoir à l'âge de référence est celui que la rente suppose (rente / taux).
  // Partir plus tôt lui retire les bonifications et les intérêts des années manquantes ; partir plus tard lui ajoute des intérêts.
  const interet = p.interet ?? regles.lpp.tauxInteretMinimal;
  const implicite = c.avoir === undefined && c.renteVieillesse !== undefined && conversionReference > 0 ? c.renteVieillesse / conversionReference : 0;
  const rapportAvoir = ecart === 0 ? 1
    : implicite > 0 ? Math.max(0, ecart < 0 ? (implicite - (aReference.avoirFinal - projection.avoirFinal)) / Math.pow(1 + interet, -ecart) : implicite * Math.pow(1 + interet, ecart)) / implicite
    : aReference.avoirFinal > 0 ? projection.avoirFinal / aReference.avoirFinal : 1;
  const rapportConversion = ecart !== 0 && conversionReference > 0 ? conversion / conversionReference : 1;
  const avoirRetraite = c.capitalRetraite !== undefined ? arrondi(c.capitalRetraite * rapportAvoir)
    : implicite > 0 ? arrondi(implicite * rapportAvoir) : projection.avoirFinal;
  const renteVieillesse = c.renteVieillesse !== undefined ? arrondi(c.renteVieillesse * rapportAvoir * rapportConversion) : arrondi(avoirRetraite * conversion);
  // risque, minimum légal (LPP art. 24) : avoir acquis + bonifications futures sans intérêts jusqu'à l'âge de référence,
  // sur le salaire coordonné actuel, x taux de conversion ; conjoint 60 %, enfant 20 %. Indépendant de l'âge de départ choisi.
  const risque = projeterAvoir(regles, { ...base, ageRetraite: ageReference, croissanceSalaire: 0 });
  const renteInvalidite = c.renteInvalidite ?? arrondi(risque.sansInteret * regles.lpp.tauxConversion);
  const estime = c.renteVieillesse === undefined || c.renteInvalidite === undefined;
  return {
    affilie: true, estime, salaireCoordonne: coordonne, tauxConversion: conversion,
    avoirActuel: c.avoir ?? 0, avoirRetraite, renteVieillesse, capitalRetraite: avoirRetraite,
    renteInvalidite,
    renteConjoint: c.renteConjoint ?? arrondi(renteInvalidite * regles.lpp.survivants.conjoint),
    renteEnfant: c.renteEnfant ?? arrondi(renteInvalidite * regles.lpp.survivants.orphelin),
    capitalDeces: c.capitalDeces ?? 0,
    rachatPossible: c.rachatPossible ?? 0,
    projection: projection.annees,
  };
}
