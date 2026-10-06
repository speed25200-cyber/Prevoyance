// @ts-check
/**
 * 1er pilier : AVS (vieillesse, survivants) et AI (invalidité).
 *
 * Tout part de deux grandeurs : le revenu annuel moyen déterminant (RAMD) et l'échelle de rente (années de
 * cotisations rapportées à la durée complète, 44 ans). La rente complète suit la formule légale à deux segments
 * (LAVS art. 34) ; les montants de l'échelle 44 publiée par l'OFAS en découlent, arrondis au franc.
 * Les fonctions sont pures : elles reçoivent les règles de l'année (regles/ch-AAAA.json) et ne lisent rien d'autre.
 */

import { arrondi, borne } from './util.js';

/**
 * RAMD ramené au palier de l'échelle officielle (multiples de 1/10 de la rente minimale annuelle, arrondi au-dessus).
 * @param {any} regles @param {number} ramd
 */
export function palierRamd(regles, ramd) {
  const pas = regles.avs.renteMinMensuelle * 12 / 10;
  return Math.ceil(Math.max(0, ramd) / pas - 1e-9) * pas;
}

/**
 * Rente mensuelle complète (échelle 44) pour un RAMD donné.
 * Segment bas : 0,74 x min + 13/600 x RAMD ; segment haut : 1,04 x min + 8/600 x RAMD ; bornée entre min et 2 x min.
 * @param {any} regles @param {number} ramd
 */
export function renteComplete(regles, ramd) {
  const min = regles.avs.renteMinMensuelle, max = regles.avs.renteMaxMensuelle;
  const r = palierRamd(regles, ramd);
  const charniere = 36 * min;
  const brut = r <= charniere ? 0.74 * min + (13 / 600) * r : 1.04 * min + (8 / 600) * r;
  return arrondi(borne(brut, min, max));
}

/**
 * Échelle de rente (0 à 44) : années de cotisations de l'assuré rapportées à celles de sa classe d'âge.
 * @param {any} regles @param {number} anneesCotisees @param {number} [anneesPossibles] années de la classe d'âge (44 à l'âge de référence)
 */
export function echelle(regles, anneesCotisees, anneesPossibles) {
  const complete = regles.avs.dureeCotisationComplete;
  const possibles = Math.max(1, anneesPossibles ?? complete);
  return borne(Math.round(complete * Math.min(anneesCotisees, possibles) / possibles), 0, complete);
}

/**
 * Rente de vieillesse mensuelle, selon le RAMD et l'échelle.
 * @param {any} regles @param {number} ramd @param {number} echelleRente 0 à 44
 */
export function renteVieillesse(regles, ramd, echelleRente) {
  return arrondi(renteComplete(regles, ramd) * echelleRente / regles.avs.dureeCotisationComplete);
}

/**
 * Âge de référence (ans, mois). Génération transitoire des femmes (AVS 21) : 1961 à 1963.
 * @param {any} regles @param {'h'|'f'} sexe @param {number} anneeNaissance
 * @returns {{ans: number, mois: number}}
 */
export function ageReference(regles, sexe, anneeNaissance) {
  const t = sexe === 'f' ? regles.avs.transitionFemmes : null;
  if (t) {
    if (anneeNaissance <= 1960) return { ans: 64, mois: 0 };
    const cas = t[String(anneeNaissance)];
    if (cas) return { ans: cas[0], mois: cas[1] };
  }
  return { ans: regles.avs.ageReference[sexe] ?? 65, mois: 0 };
}

/**
 * Génération transitoire d'AVS 21 (femmes nées de 1961 à 1969) : supplément de rente mensuel si la rente n'est pas
 * anticipée, ou taux de réduction plus bas en cas d'anticipation (possible dès 62 ans). Les deux dépendent du revenu
 * annuel moyen. `null` pour toute autre personne.
 * @param {any} regles @param {'h'|'f'} sexe @param {number} anneeNaissance @param {number} ramd
 * @returns {{classe: number, supplementMensuel: number, reductions: number[], anticipationMax: number}|null}
 */
export function generationTransitoire(regles, sexe, anneeNaissance, ramd) {
  const g = regles.avs.generationTransitoire;
  if (!g || sexe !== 'f' || anneeNaissance < g.de || anneeNaissance > g.a) return null;
  const minimale = regles.avs.renteMinMensuelle * 12;
  const classe = ramd <= minimale * g.seuilsRamd[0] ? 0 : ramd <= minimale * g.seuilsRamd[1] ? 1 : 2;
  return { classe, supplementMensuel: arrondi(g.supplement[classe] * (g.echelonnement[String(anneeNaissance)] ?? 0)),
           reductions: [0, g.anticipation['1'][classe], g.anticipation['2'][classe], g.anticipation['3'][classe]], anticipationMax: g.anticipationMaxAnnees };
}

/**
 * Effet d'une anticipation (années négatives) ou d'un ajournement (positives) sur la rente de vieillesse.
 * @param {any} regles @param {number} annees de -2 à +5 @returns {number} facteur multiplicatif
 */
export function facteurFlexibilisation(regles, annees) {
  if (annees < 0) return 1 - regles.avs.reductionAnticipationParAn * Math.min(-annees, regles.avs.anticipationMaxAnnees);
  if (annees > 0) return 1 + (regles.avs.supplementsAjournement[String(Math.min(5, Math.floor(annees)))] ?? 0);
  return 1;
}

/**
 * Plafonnement des deux rentes d'un couple marié : 150 % de la rente maximale. Quand les durées de cotisation sont
 * incomplètes, le plafond suit les échelles : deux fois la plus haute plus une fois la plus basse, divisé par trois
 * (RAVS art. 53bis).
 * @param {any} regles @param {number} rente1 @param {number} rente2 @param {number} [echelle1] @param {number} [echelle2]
 * @returns {[number, number]}
 */
export function plafonnerCouple(regles, rente1, rente2, echelle1 = 44, echelle2 = 44) {
  const complete = regles.avs.dureeCotisationComplete;
  const part = (2 * Math.max(echelle1, echelle2) + Math.min(echelle1, echelle2)) / 3 / complete;
  const plafond = regles.avs.renteMaxMensuelle * regles.avs.plafondCoupleFacteur * part;
  const somme = rente1 + rente2;
  if (somme <= plafond || somme === 0) return [rente1, rente2];
  return [arrondi(rente1 * plafond / somme), arrondi(rente2 * plafond / somme)];
}

/**
 * Supplément de carrière : majoration du revenu moyen quand l'invalidité ou le décès survient avant 45 ans.
 * @param {any} regles @param {number} age
 */
export function supplementCarriere(regles, age) {
  for (const [ageMax, taux] of regles.avs.supplementCarriere) if (age <= ageMax) return taux;
  return 0;
}

/**
 * Fraction de rente AI selon le degré d'invalidité (système linéaire).
 * @param {any} regles @param {number} degre 0 à 100
 */
export function fractionAI(regles, degre) {
  const b = regles.ai.bareme;
  if (degre < b.seuil) return 0;
  if (degre >= b.entiereDes) return 1;
  if (degre >= b.lineaireDe) return degre / 100;
  return b.quartA40 + (degre - b.seuil) * b.pasParDegre;
}

/**
 * Rente AI mensuelle de l'assuré et rente pour chaque enfant.
 * @param {any} regles @param {{ramd: number, echelle: number, age: number, degre?: number}} p
 */
export function rentesAI(regles, { ramd, echelle: e, age, degre = 100 }) {
  const ramdMajore = ramd * (1 + supplementCarriere(regles, age));
  const entiere = renteVieillesse(regles, ramdMajore, e);
  const fraction = fractionAI(regles, degre);
  return {
    assure: arrondi(entiere * fraction),
    parEnfant: arrondi(entiere * fraction * regles.avs.survivants.enfantDeRentier),
    fraction,
  };
}

/**
 * Rentes de survivants AVS (mensuelles) après le décès de l'assuré.
 * Le conjoint marié (ou partenaire enregistré) y a droit s'il a un enfant, ou s'il a 45 ans révolus après 5 ans de
 * mariage (veuve) ; le concubin n'a droit à rien : c'est une lacune typique.
 * @param {any} regles
 * @param {{ramd: number, echelle: number, age: number, conjointAyantDroit: boolean, nombreEnfants: number}} p
 */
export function rentesSurvivants(regles, { ramd, echelle: e, age, conjointAyantDroit, nombreEnfants }) {
  const base = renteVieillesse(regles, ramd * (1 + supplementCarriere(regles, age)), e);
  const s = regles.avs.survivants;
  let conjoint = conjointAyantDroit ? arrondi(base * s.conjoint) : 0;
  let parEnfant = nombreEnfants > 0 ? arrondi(base * s.orphelin) : 0;
  // la somme des rentes de survivants ne dépasse pas 90 % du revenu déterminant : rarement atteint, non modélisé ici
  return { conjoint, parEnfant, total: conjoint + parEnfant * nombreEnfants, base };
}

/**
 * Estimation du RAMD quand l'extrait de compte individuel n'est pas disponible : revenu actuel pondéré par un
 * facteur de carrière (les revenus de début de carrière, revalorisés, restent en dessous du revenu actuel) et
 * bonifications pour tâches éducatives. À remplacer par la valeur du calcul anticipé de la caisse dès qu'on l'a.
 * @param {any} regles
 * @param {{revenu: number, age: number, anneesEducatives?: number, marie?: boolean, facteurCarriere?: number}} p
 */
export function estimerRamd(regles, { revenu, age, anneesEducatives = 0, marie = false, facteurCarriere }) {
  const carriere = Math.max(1, age - 20);
  const facteur = facteurCarriere ?? borne(0.72 + 0.006 * Math.min(carriere, 40), 0.72, 0.96);
  const educatif = regles.avs.bonificationEducative * (marie ? 0.5 : 1) * anneesEducatives / Math.max(carriere, 1);
  return Math.max(0, revenu * facteur + educatif);
}
