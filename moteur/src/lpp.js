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
 *          croissanceSalaire?: number, tauxEpargne?: (age: number) => number, salaireAssure?: number}} p
 * @returns {{avoirFinal: number, sansInteret: number, annees: {age: number, salaireAssure: number, bonification: number, avoir: number}[]}}
 */
export function projeterAvoir(regles, p) {
  const { age, avoir, salaireAVS, ageRetraite = 65, croissanceSalaire = 0 } = p;
  const interet = p.interet ?? regles.lpp.tauxInteretMinimal;
  let a = avoir, sansInteret = avoir, salaire = salaireAVS;
  const annees = [];
  for (let x = age; x < ageRetraite; x++) {
    const assure = p.salaireAssure !== undefined ? p.salaireAssure * Math.pow(1 + croissanceSalaire, x - age) : salaireCoordonne(regles, salaire);
    const taux = p.tauxEpargne ? p.tauxEpargne(x) : tauxBonification(regles, x);
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
 * @param {{age: number, salaireAVS: number, ageRetraite?: number, croissanceSalaire?: number, interet?: number,
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
  const projection = projeterAvoir(regles, { age: p.age, avoir: c.avoir ?? 0, salaireAVS: p.salaireAVS,
                                             ageRetraite: p.ageRetraite, croissanceSalaire: p.croissanceSalaire, interet: p.interet });
  const conversion = c.tauxConversion ?? regles.lpp.tauxConversion;
  const avoirRetraite = c.capitalRetraite ?? projection.avoirFinal;
  const renteVieillesse = c.renteVieillesse ?? arrondi(avoirRetraite * conversion);
  // risque, minimum légal : avoir projeté sans intérêts x taux de conversion (LPP art. 24) ; conjoint 60 %, enfant 20 %
  const renteInvalidite = c.renteInvalidite ?? arrondi(projection.sansInteret * regles.lpp.tauxConversion);
  const estime = c.renteVieillesse === undefined || c.renteInvalidite === undefined;
  return {
    affilie: true, estime, salaireCoordonne: coordonne,
    avoirActuel: c.avoir ?? 0, avoirRetraite, renteVieillesse, capitalRetraite: avoirRetraite,
    renteInvalidite,
    renteConjoint: c.renteConjoint ?? arrondi(renteInvalidite * regles.lpp.survivants.conjoint),
    renteEnfant: c.renteEnfant ?? arrondi(renteInvalidite * regles.lpp.survivants.orphelin),
    capitalDeces: c.capitalDeces ?? 0,
    rachatPossible: c.rachatPossible ?? 0,
    projection: projection.annees,
  };
}
