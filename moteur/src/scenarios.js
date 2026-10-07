// @ts-check
/**
 * Scénarios de conseil construits sur l'analyse : âge de départ, rente ou capital, rendement des placements
 * (simulation), charge hypothécaire à la retraite, et plan de mesures avec comparaison avant / après.
 */

import { analyser } from './analyse.js';
import * as AVS from './avs.js';
import * as Impots from './impots.js';
import { anneeNaissance, arrondi, borne, renteDepuisCapital, valeurFuture } from './util.js';

/**
 * Revenu de retraite selon l'âge de départ (anticipation ou ajournement).
 * AVS : réduction de 6,8 % par année d'anticipation, supplément en cas d'ajournement (LAVS art. 39 et 40).
 * LPP : l'avoir s'arrête plus tôt ou continue de croître ; le taux de conversion baisse d'environ 0,2 point par
 * année d'anticipation et monte d'autant en cas d'ajournement (usage des caisses ; le règlement fait foi).
 * @param {import('./analyse.js').Dossier} dossier @param {any} regles @param {number[]} [ages]
 * @param {{impots?: any}} [contexte] données fiscales (3a compté après l'impôt sur son retrait, comme dans l'analyse)
 */
export function agesDeDepart(dossier, regles, ages = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70], contexte = {}) {
  // âge de référence de la personne (femmes nées de 1961 à 1963 : entre 64 et 65 ans)
  const ref = AVS.ageReference(regles, dossier.personne.sexe, anneeNaissance(dossier.personne.dateNaissance));
  const reference = ref.ans + ref.mois / 12;
  return ages.map(age => {
    // écart en années entières par rapport à l'âge de référence (64 ans et 6 mois compte comme 65)
    const ecart = age - Math.round(reference);
    // l'analyse applique elle-même l'effet de l'âge de départ : réduction ou supplément AVS, avoir et conversion LPP
    const hypotheses = { ...(dossier.hypotheses ?? {}), ageRetraite: age };
    delete hypotheses.flexibilisationAVS;
    const a = analyser({ ...dossier, hypotheses }, regles, contexte);
    const r = a.risques.retraite;
    const de = cle => r.sources.filter(s => s.cle === cle).reduce((s, x) => s + x.montant, 0);
    return { age, ecart, avs: de('avs'), lpp: de('lpp'), pilier3: r.sources.filter(s => s.pilier === 3).reduce((s, x) => s + x.montant, 0),
             total: r.total, besoin: r.besoin, lacune: r.lacune, couverture: r.couverture,
             // avant 63 ans, l'AVS ne peut pas encore être touchée : il faut un pont
             pontAVS: a.personne.pontAVS, debutAVS: a.personne.debutAVS };
  });
}

/**
 * Rente ou capital pour l'avoir du 2e pilier, après impôts.
 * La rente est imposée chaque année avec les autres revenus ; le capital est imposé une fois, à part, puis consommé
 * (rendement net supposé) jusqu'à l'âge choisi. Le seuil de rentabilité est l'âge à partir duquel la rente a rapporté
 * davantage que le capital.
 * @param {{capital: number, tauxConversion: number, autresRentes: number, ageRetraite: number, ageFin?: number, rendement?: number,
 *          canton: string, marie: boolean, partCapital?: number}} p
 * @param {any} donneesImpots
 */
export function renteOuCapital(p, donneesImpots) {
  const ageFin = p.ageFin ?? 90, rendement = p.rendement ?? 0.015, duree = Math.max(1, ageFin - p.ageRetraite);
  const option = part => {
    const capital = p.capital * part, enRente = p.capital - capital;
    const rente = enRente * p.tauxConversion;
    const impotCapital = Impots.impotCapital(donneesImpots, p.canton, p.marie, capital) ?? 0;
    const impotAvec = Impots.impotRentes(donneesImpots, p.canton, p.marie, p.autresRentes + rente) ?? 0;
    const impotSans = Impots.impotRentes(donneesImpots, p.canton, p.marie, p.autresRentes) ?? 0;
    const renteNette = rente - (impotAvec - impotSans);
    const capitalNet = capital - impotCapital;
    const retraitAnnuel = renteDepuisCapital(capitalNet, duree, rendement);
    return { part, capital: arrondi(capital), rente: arrondi(rente), impotCapital, renteNette: arrondi(renteNette), capitalNet: arrondi(capitalNet),
             revenuAnnuelNet: arrondi(renteNette + retraitAnnuel), totalNet: arrondi((renteNette + retraitAnnuel) * duree, 100),
             // ce qui reste aux héritiers si le décès survient à mi-parcours (la rente, elle, s'éteint ou se réduit à 60 %)
             resteAMiParcours: arrondi(Math.max(0, valeurFuture(capitalNet, -retraitAnnuel, duree / 2, rendement)), 100) };
  };
  const tout = option(0), moitie = option(0.5), capital = option(1);
  // seuil de rentabilité de la rente face au capital (sans rendement, pour rester prudent)
  const seuil = tout.renteNette > 0 ? p.ageRetraite + capital.capitalNet / tout.renteNette : null;
  return { options: [tout, moitie, capital], seuilRentabilite: seuil === null ? null : Math.round(seuil * 10) / 10, ageFin, rendement };
}

/** Générateur pseudo-aléatoire reproductible (mulberry32) : la même simulation donne toujours le même résultat. */
function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Simulation d'un placement (3a en titres, fortune) : rendements annuels tirés au hasard (loi log-normale), mille
 * trajectoires et plus. Renvoie par année les 10e, 50e et 90e centiles : le couloir du probable.
 * @param {{capital: number, versement: number, annees: number, rendement: number, volatilite: number, trajectoires?: number, graine?: number}} p
 * @returns {{annee: number, p10: number, p50: number, p90: number, verse: number}[]}
 */
export function simulerPlacement({ capital, versement, annees, rendement, volatilite, trajectoires = 2000, graine = 20261006 }) {
  const hasard = aleatoire(graine);
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(hasard(), 1e-12))) * Math.cos(2 * Math.PI * hasard());
  const derive = Math.log(1 + rendement) - volatilite * volatilite / 2;
  const valeurs = Array.from({ length: trajectoires }, () => capital);
  const out = [{ annee: 0, p10: arrondi(capital), p50: arrondi(capital), p90: arrondi(capital), verse: arrondi(capital) }];
  for (let an = 1; an <= annees; an++) {
    for (let i = 0; i < trajectoires; i++) valeurs[i] = valeurs[i] * Math.exp(derive + volatilite * normal()) + versement;
    const tri = Float64Array.from(valeurs).sort();
    const centile = q => tri[Math.min(trajectoires - 1, Math.floor(q * trajectoires))];
    out.push({ annee: an, p10: arrondi(centile(0.1), 100), p50: arrondi(centile(0.5), 100), p90: arrondi(centile(0.9), 100),
               verse: arrondi(capital + versement * an) });
  }
  return out;
}

/**
 * Charge hypothécaire à la retraite, selon la règle des banques : intérêts théoriques de 5 % sur la dette, 1 % de la
 * valeur du bien pour l'entretien, le tout ne devant pas dépasser un tiers du revenu. À la retraite le revenu baisse :
 * c'est là que la tenue des charges se joue.
 * @param {{valeur: number, dette: number, revenu: number, tauxTheorique?: number, entretien?: number, plafond?: number}} p
 */
export function chargeHypothecaire({ valeur, dette, revenu, tauxTheorique = 0.05, entretien = 0.01, plafond = 1 / 3 }) {
  const charge = dette * tauxTheorique + valeur * entretien;
  const ratio = revenu > 0 ? charge / revenu : Infinity;
  // dette maximale supportable avec ce revenu, et amortissement nécessaire pour y revenir
  const detteMax = Math.max(0, (revenu * plafond - valeur * entretien) / tauxTheorique);
  return { charge: arrondi(charge), ratio, tenable: ratio <= plafond + 1e-9, detteMax: arrondi(detteMax, 1000),
           amortissement: arrondi(Math.max(0, dette - detteMax), 1000), avance: valeur > 0 ? dette / valeur : 0 };
}

/**
 * Retrait anticipé du 2e pilier pour le logement (encouragement à la propriété, LPP art. 30c, OEPL art. 5).
 * - Montant minimal : 20 000 francs ; au plus tard trois ans avant le droit aux prestations de vieillesse.
 * - Jusqu'à 50 ans : tout l'avoir. Après 50 ans : le plus grand de l'avoir à 50 ans et de la moitié de l'avoir actuel.
 * - Le retrait est imposé une fois, à part (barème des prestations en capital). Il réduit l'avoir de retraite (avec
 *   les intérêts qu'il aurait portés) et donc la rente ; beaucoup de caisses réduisent aussi les prestations de risque.
 * - Un retrait remboursé rend l'impôt payé (sans intérêts) ; tant qu'il n'est pas remboursé, aucun rachat n'est déductible.
 * @param {{avoir: number, age: number, montant?: number, avoirA50?: number, ageRetraite?: number, interet?: number, tauxConversion?: number,
 *          canton?: string, marie?: boolean}} p `avoirA50` : avoir à 50 ans s'il est connu (certificat) ; sinon seule la moitié de l'avoir actuel est retenue
 * @param {any} regles @param {any} [donneesImpots]
 */
export function retraitLogement(p, regles, donneesImpots = null) {
  const l = regles.lpp.logement ?? { minimum: 20000, ageLimiteTotal: 50, delaiAvantRetraite: 3 };
  const ageRetraite = p.ageRetraite ?? regles.lpp.ageReference ?? 65, annees = Math.max(0, ageRetraite - p.age);
  const maximum = p.age <= l.ageLimiteTotal ? p.avoir : Math.max(Math.min(p.avoirA50 ?? 0, p.avoir), p.avoir / 2);
  const possible = annees >= l.delaiAvantRetraite && maximum >= l.minimum;
  const montant = possible ? borne(p.montant ?? maximum, l.minimum, maximum) : 0;
  const impot = montant > 0 && donneesImpots && p.canton ? Impots.impotCapital(donneesImpots, p.canton, !!p.marie, montant) ?? 0 : 0;
  const interet = p.interet ?? regles.lpp.tauxInteretMinimal;
  const avoirEnMoins = arrondi(montant * Math.pow(1 + interet, annees));
  return { possible, minimum: l.minimum, maximum: arrondi(maximum), montant: arrondi(montant), impot, net: arrondi(montant - impot),
           avoirRetraiteEnMoins: avoirEnMoins, renteEnMoins: arrondi(avoirEnMoins * (p.tauxConversion ?? regles.lpp.tauxConversion)),
           raison: possible ? null : annees < l.delaiAvantRetraite ? 'tropTard' : 'sousMinimum' };
}

/**
 * Applique un plan de mesures au dossier (sans le modifier) : versements 3a, rachat LPP, rente d'incapacité de gain,
 * capital décès, perte de gain maladie, assurance-accidents pour un indépendant.
 * @param {import('./analyse.js').Dossier} dossier
 * @param {{versement3a?: number, rachatLPP?: number, renteInvalidite?: number, capitalDeces?: number, ijm?: boolean, laa?: boolean,
 *          epargneLibre?: number}} mesures
 * @param {any} regles
 */
export function appliquerMesures(dossier, mesures, regles) {
  const p = dossier.personne, contrats = [...(p.pilier3 ?? [])];
  if (mesures.versement3a) contrats.push({ type: '3a', forme: 'banque', avoir: 0, versementAnnuel: mesures.versement3a });
  if (mesures.epargneLibre) contrats.push({ type: '3b', forme: 'banque', avoir: 0, versementAnnuel: mesures.epargneLibre });
  if (mesures.renteInvalidite || mesures.capitalDeces) {
    contrats.push({ type: '3b', forme: 'assurance', renteInvalidite: mesures.renteInvalidite ?? 0, capitalDeces: mesures.capitalDeces ?? 0 });
  }
  const lpp = { ...(p.lpp ?? {}) };
  if (mesures.rachatLPP) {
    lpp.avoir = (lpp.avoir ?? 0) + mesures.rachatLPP;
    lpp.rachatPossible = Math.max(0, (lpp.rachatPossible ?? 0) - mesures.rachatLPP);
    if (lpp.renteVieillesse !== undefined) lpp.renteVieillesse += mesures.rachatLPP * (lpp.tauxConversion ?? regles.lpp.tauxConversion);
  }
  return { ...dossier, personne: { ...p, lpp, pilier3: contrats, ijm: mesures.ijm ? { ...(p.ijm ?? {}), assure: true } : p.ijm,
                                   laa: mesures.laa ? { assure: true } : p.laa } };
}

/**
 * Propose un plan de mesures qui comble les lacunes, dans l'ordre où un conseiller les traite : d'abord les risques
 * (invalidité, décès), ensuite la retraite par les leviers fiscalement les plus efficaces (3a, puis rachat, puis
 * épargne libre). Renvoie le plan, l'analyse avant et l'analyse après.
 * @param {import('./analyse.js').Dossier} dossier @param {any} regles
 * @param {{impots?: any}} [contexte] données fiscales : avec elles, le plan tient compte de l'impôt sur le retrait du 3a
 */
export function proposerPlan(dossier, regles, contexte = {}) {
  const avant = analyser(dossier, regles, contexte);
  const r = avant.risques, pot = avant.potentiels;
  /** @type {Parameters<typeof appliquerMesures>[1]} */
  const mesures = {};
  // la rente à assurer couvre la plus grande lacune à venir (celle d'après les rentes d'enfants), pas seulement celle d'aujourd'hui
  const pire = Math.max(r.invaliditeMaladie.lacuneMax, r.invaliditeAccident.lacuneMax);
  if (pire > 0) mesures.renteInvalidite = Math.ceil(pire / 1200) * 1200;
  const capitalDeces = Math.max(r.decesMaladie.capital, r.decesAccident.capital);
  if (capitalDeces > 0) mesures.capitalDeces = Math.ceil(capitalDeces / 10000) * 10000;
  if (dossier.personne.statut !== 'sans' && !(dossier.personne.ijm?.assure)) mesures.ijm = true;
  if (dossier.personne.statut === 'independant' && !(dossier.personne.laa?.assure)) mesures.laa = true;
  if (r.retraite.lacune > 0) {
    let reste = r.retraite.epargneAnnuelle;
    mesures.versement3a = Math.min(pot.pilier3a.potentiel, Math.ceil(reste / 100) * 100);
    reste -= mesures.versement3a;
    if (reste > 0 && pot.rachatLPP.possible > 0) {
      // un rachat agit comme une épargne ponctuelle : on le convertit en équivalent annuel sur la durée restante
      const annees = Math.max(1, avant.personne.ageRetraite - avant.personne.age);
      mesures.rachatLPP = Math.min(pot.rachatLPP.possible, Math.ceil(reste * annees / 1000) * 1000);
      reste -= mesures.rachatLPP / annees;
    }
    if (reste > 0) mesures.epargneLibre = Math.ceil(reste / 100) * 100;
  }
  let apres = analyser(appliquerMesures(dossier, mesures, regles), regles, contexte);
  // Le 3a est imposé à son retrait et les montants sont arrondis : s'il reste une lacune de retraite, on complète
  // (d'abord dans le 3a tant qu'il reste de la place, puis en épargne libre) jusqu'à ce qu'elle soit comblée.
  for (let tour = 0; tour < 5 && apres.risques.retraite.lacune > 0 && r.retraite.lacune > 0; tour++) {
    const plus = Math.max(100, Math.ceil(apres.risques.retraite.epargneAnnuelle / 100) * 100);
    const dans3a = Math.min(Math.max(0, pot.pilier3a.potentiel - (mesures.versement3a ?? 0)), plus);
    if (dans3a > 0) mesures.versement3a = (mesures.versement3a ?? 0) + dans3a;
    if (plus - dans3a > 0) mesures.epargneLibre = (mesures.epargneLibre ?? 0) + plus - dans3a;
    apres = analyser(appliquerMesures(dossier, mesures, regles), regles, contexte);
  }
  return { mesures, avant, apres };
}

/**
 * Compare des offres d'assurance de risque (rente d'incapacité de gain, capital décès) : chacune est appliquée au
 * dossier, puis l'analyse est refaite. On voit ce que chaque offre comble, ce qu'elle laisse, ce qu'elle assure de
 * trop, et à quel prix. L'offre à retenir est celle qui comble les lacunes de risque au meilleur prix ; si aucune ne
 * les comble, celle qui couvre le mieux, puis la moins chère.
 * Seules les prestations chiffrées sont comparées : délais d'attente, exclusions et excédents se lisent dans l'offre.
 * @param {import('./analyse.js').Dossier} dossier @param {any} regles
 * @param {{prime?: number, renteInvalidite?: number, capitalDeces?: number}[]} offres @param {{impots?: any}} [contexte]
 */
export function comparerOffres(dossier, regles, offres, contexte = {}) {
  const avant = analyser(dossier, regles, contexte);
  // la plus grande lacune à venir (celle d'après les rentes d'enfants), comme dans le plan proposé
  const risques = a => ({ invalidite: Math.max(a.risques.invaliditeMaladie.lacuneMax ?? 0, a.risques.invaliditeAccident.lacuneMax ?? 0,
                                               a.risques.invaliditeMaladie.lacune, a.risques.invaliditeAccident.lacune),
                          deces: Math.max(a.risques.decesMaladie.capital ?? 0, a.risques.decesAccident.capital ?? 0) });
  const besoin = risques(avant);
  const resultats = offres.map(o => {
    const rente = Math.max(0, o.renteInvalidite ?? 0), capital = Math.max(0, o.capitalDeces ?? 0), prime = Math.max(0, o.prime ?? 0);
    const saisie = rente > 0 || capital > 0;
    const apres = saisie ? analyser(appliquerMesures(dossier, { renteInvalidite: rente, capitalDeces: capital }, regles), regles, contexte) : avant;
    const reste = risques(apres);
    return { saisie, prime, score: apres.score, gainScore: apres.score - avant.score,
             lacuneInvalidite: reste.invalidite, lacuneInvaliditeMensuelle: arrondi(reste.invalidite / 12), capitalDecesManquant: reste.deces,
             couvre: saisie && reste.invalidite === 0 && reste.deces === 0,
             // ce qui est assuré au-delà du besoin : une prime payée pour rien
             excedentRente: arrondi(Math.max(0, rente - besoin.invalidite)), excedentCapital: arrondi(Math.max(0, capital - besoin.deces)) };
  });
  const candidats = resultats.map((r, i) => ({ r, i })).filter(x => x.r.saisie);
  candidats.sort((x, y) => (Number(y.r.couvre) - Number(x.r.couvre)) || (x.r.couvre && y.r.couvre ? x.r.prime - y.r.prime : (y.r.score - x.r.score) || (x.r.prime - y.r.prime)));
  // une préférence n'a de sens qu'entre deux offres saisies
  return { avant: { score: avant.score, lacuneInvalidite: besoin.invalidite, capitalDeces: besoin.deces }, offres: resultats,
           meilleure: candidats.length >= 2 ? candidats[0].i : null };
}
