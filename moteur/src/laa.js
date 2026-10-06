// @ts-check
/**
 * Assurance-accidents (LAA) : obligatoire pour les salariés, facultative pour les indépendants.
 * C'est elle qui crée l'écart entre « maladie » et « accident » dans une analyse de lacunes : après un accident la
 * couverture atteint 90 % du gain assuré (rente complémentaire), après une maladie elle retombe sur AI + LPP.
 */

import { arrondi } from './util.js';

/** @param {any} regles @param {number} salaire annuel */
export const gainAssure = (regles, salaire) => Math.min(Math.max(0, salaire), regles.laa.gainAssureMax);

/**
 * Rente d'invalidité LAA annuelle, coordonnée avec la rente AI (rente complémentaire, LAA art. 20 al. 2).
 * @param {any} regles @param {{salaire: number, degre?: number, renteAIAnnuelle?: number}} p
 */
export function renteInvaliditeLAA(regles, { salaire, degre = 100, renteAIAnnuelle = 0 }) {
  const gain = gainAssure(regles, salaire);
  const pleine = gain * regles.laa.renteInvalidite * degre / 100;
  if (renteAIAnnuelle <= 0) return arrondi(pleine);
  const complementaire = Math.max(0, gain * regles.laa.plafondComplementaire - renteAIAnnuelle);
  return arrondi(Math.min(pleine, complementaire));
}

/**
 * Rentes de survivants LAA annuelles, coordonnées avec les rentes AVS (LAA art. 31).
 * @param {any} regles
 * @param {{salaire: number, conjointAyantDroit: boolean, nombreEnfants: number, rentesAVSAnnuelles?: number}} p
 */
export function rentesSurvivantsLAA(regles, { salaire, conjointAyantDroit, nombreEnfants, rentesAVSAnnuelles = 0 }) {
  const gain = gainAssure(regles, salaire), s = regles.laa.survivants;
  let taux = (conjointAyantDroit ? s.conjoint : 0) + nombreEnfants * s.orphelin;
  taux = Math.min(taux, s.plafond);
  let total = gain * taux;
  if (rentesAVSAnnuelles > 0) total = Math.min(total, Math.max(0, gain * regles.laa.plafondComplementaire - rentesAVSAnnuelles));
  return { total: arrondi(total), taux };
}

/** Indemnité journalière LAA, en montant annuel équivalent. @param {any} regles @param {number} salaire */
export const indemniteJournaliereAnnuelle = (regles, salaire) => arrondi(gainAssure(regles, salaire) * regles.laa.indemniteJournaliere);
