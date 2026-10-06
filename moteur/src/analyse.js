// @ts-check
/**
 * Analyse des lacunes de prévoyance d'un ménage : retraite, invalidité (maladie, accident), décès (maladie, accident).
 *
 * Entrée : un dossier (voir `Dossier`) et les règles de l'année. Sortie : pour chaque risque, le besoin, les
 * prestations par source (1er, 2e, 3e pilier, assurances), la lacune annuelle et le capital qui la comblerait ;
 * plus les potentiels (3a, rachats), les alertes et un score de couverture.
 *
 * Le moteur ne produit aucun texte : alertes et sources portent des codes (`cle`) que chaque interface traduit
 * (FR, DE, IT, EN). Tous les montants sont annuels, en francs, sauf mention contraire.
 *
 * @typedef {{type: '3a'|'3b', forme?: 'banque'|'assurance', avoir?: number, versementAnnuel?: number, rendement?: number,
 *            capitalDeces?: number, renteInvalidite?: number, capitalEcheance?: number}} Contrat3
 * @typedef {{dateNaissance: string, sexe: 'h'|'f', statut: 'salarie'|'independant'|'sans', revenu: number,
 *            avs?: {ramd?: number, anneesManquantes?: number},
 *            lpp?: {affilie?: boolean, avoir?: number, renteVieillesse?: number, capitalRetraite?: number, tauxConversion?: number,
 *                   renteInvalidite?: number, renteConjoint?: number, renteEnfant?: number, capitalDeces?: number, rachatPossible?: number},
 *            laa?: {assure?: boolean}, ijm?: {assure?: boolean, taux?: number, jours?: number},
 *            pilier3?: Contrat3[], fortune?: number, tauxMarginal?: number, anciennete?: number, lacune3a?: number}} Personne
 * @typedef {{dateAnalyse?: string, canton?: string, personne: Personne, conjoint?: Personne|null,
 *            etatCivil?: 'celibataire'|'marie'|'partenariat'|'concubin'|'divorce'|'veuf',
 *            enfants?: {dateNaissance: string, formationJusqua?: number}[],
 *            besoins?: {retraite?: number, invalidite?: number, deces?: number, capitalDeces?: number},
 *            hypotheses?: {ageRetraite?: number, rendement3a?: number, rendementFortune?: number, escompte?: number,
 *                          croissanceSalaire?: number, interetLPP?: number, ageFinRente?: number, flexibilisationAVS?: number}}} Dossier
 */

import * as AVS from './avs.js';
import { prestationsLPP } from './lpp.js';
import * as LAA from './laa.js';
import * as Impots from './impots.js';
import { age as ageA, anneeNaissance, arrondi, borne, renteDepuisCapital, somme, valeurActuelleRente, valeurFuture } from './util.js';

const HYPOTHESES = { ageRetraite: 65, rendement3a: 0.02, rendementFortune: 0.015, escompte: 0.015, croissanceSalaire: 0,
                     interetLPP: undefined, ageFinRente: 90, flexibilisationAVS: undefined };
const BESOINS = { retraite: 0.8, invalidite: 0.9, deces: 0.7, capitalDeces: 0 };

const PALIERS = [[30000, 0.08], [50000, 0.15], [80000, 0.22], [120000, 0.28], [180000, 0.33], [300000, 0.37], [Infinity, 0.4]];

/** Taux marginal d'impôt estimé (moyenne suisse, revenu brut) : sert seulement à chiffrer un ordre de grandeur. */
export function estimerTauxMarginal(revenu, marie = false) {
  const r = marie ? revenu * 0.75 : revenu;
  for (const [seuil, taux] of PALIERS) if (r <= seuil) return taux;
  return 0.4;
}

/**
 * Économie d'impôt estimée d'une déduction, sans barème cantonal : chaque tranche de la déduction est comptée au taux
 * du palier qu'elle quitte. Une grosse déduction (rachat) ne rapporte donc pas « montant x taux marginal du sommet ».
 * @param {number} revenu @param {number} deduction @param {boolean} [marie]
 */
export function economieEstimee(revenu, deduction, marie = false) {
  const k = marie ? 0.75 : 1, haut = Math.max(0, revenu) * k, bas = Math.max(0, revenu - deduction) * k;
  let total = 0, debut = 0;
  for (const [seuil, taux] of PALIERS) {
    total += Math.max(0, Math.min(haut, seuil) - Math.max(bas, debut)) * taux;
    debut = seuil;
  }
  return arrondi(total / k, 10);
}

/** Profil d'une personne : âges, 1er et 2e piliers, 3e pilier à la retraite. */
function profil(regles, p, { quand, hyp, marie, enfants }) {
  const age = ageA(p.dateNaissance, quand);
  const ref = AVS.ageReference(regles, p.sexe, anneeNaissance(p.dateNaissance));
  const ageRetraite = Math.max(age, hyp.ageRetraite ?? ref.ans);
  const revenu = Math.max(0, p.revenu || 0);
  // années avec un enfant de moins de 16 ans (bonifications pour tâches éducatives), estimées d'après l'aîné
  const agesEnfants = enfants.map(e => ageA(e.dateNaissance, quand)).filter(a => a >= 0);
  const anneesEducatives = agesEnfants.length ? Math.min(16 + (agesEnfants.length - 1) * 2, Math.max(...agesEnfants) + 1) : 0;
  const ramdEstime = p.avs?.ramd === undefined;
  const ramd = p.avs?.ramd ?? AVS.estimerRamd(regles, { revenu, age, anneesEducatives, marie });
  const manquantes = Math.max(0, p.avs?.anneesManquantes ?? 0);
  const echelle = AVS.echelle(regles, regles.avs.dureeCotisationComplete - manquantes);
  const lpp = prestationsLPP(regles, { age, salaireAVS: p.statut === 'salarie' ? revenu : (p.lpp?.affilie ? revenu : 0),
                                      ageRetraite, croissanceSalaire: hyp.croissanceSalaire, interet: hyp.interetLPP, lpp: p.lpp,
                                      decalageAge: Math.max(0, +String(quand).slice(0, 4) - anneeNaissance(p.dateNaissance) - age) });
  const anneesRestantes = Math.max(0, ageRetraite - age);
  const contrats = (p.pilier3 ?? []).map(c => ({
    ...c,
    capitalRetraite: c.capitalEcheance ?? arrondi(valeurFuture(c.avoir ?? 0, c.versementAnnuel ?? 0, anneesRestantes, c.rendement ?? hyp.rendement3a)),
  }));
  const fortuneRetraite = arrondi(valeurFuture(p.fortune ?? 0, 0, anneesRestantes, hyp.rendementFortune));
  return { age, ref, naissance: anneeNaissance(p.dateNaissance), sexe: p.sexe, ageRetraite, revenu, ramd, ramdEstime, echelle, manquantes, lpp, contrats, fortuneRetraite, anneesRestantes,
           statut: p.statut, laaAssure: p.laa?.assure ?? p.statut === 'salarie',
           ijm: { assure: p.ijm?.assure ?? false, taux: p.ijm?.taux ?? regles.maladie.ijmUsuelle.taux, jours: p.ijm?.jours ?? regles.maladie.ijmUsuelle.jours },
           tauxMarginal: p.tauxMarginal, source: p };
}

/** Un risque chiffré : besoin, sources, lacune, capital pour la combler. */
function risque(cle, besoin, sources, { annees = 0, escompte = 0, capitauxDisponibles = 0, capitalBesoin = 0, capitalRente: capitalCalcule = undefined,
                                         lacuneMax = undefined } = {}) {
  const lignes = sources.filter(s => s.montant > 0).map(s => ({ ...s, montant: arrondi(s.montant) }));
  const total = somme(lignes.map(s => s.montant));
  const lacune = Math.max(0, arrondi(besoin - total));
  // lacune constante : valeur actuelle d'une rente ; lacune variable (rentes d'enfants qui s'éteignent) : capital fourni
  const capitalRente = capitalCalcule ?? arrondi(valeurActuelleRente(lacune, annees, escompte), 100);
  const capital = Math.max(0, arrondi(capitalRente + capitalBesoin - capitauxDisponibles, 100));
  return { cle, besoin: arrondi(besoin), sources: lignes, total, lacune, lacuneMensuelle: arrondi(lacune / 12),
           couverture: besoin > 0 ? borne(total / besoin, 0, 1.5) : 1, annees, capitalRente, lacuneMax: Math.max(lacune, lacuneMax ?? 0), capitauxDisponibles: arrondi(capitauxDisponibles),
           capitalBesoin: arrondi(capitalBesoin), capital };
}

/**
 * @param {Dossier} dossier @param {any} regles
 * @param {{impots?: any}} [contexte] données fiscales de l'année (donnees/impots-AAAA.json) : avec elles et le canton du
 *        dossier, les économies d'impôt sont calculées sur le barème réel au lieu d'une moyenne suisse
 */
export function analyser(dossier, regles, contexte = {}) {
  const hyp = { ...HYPOTHESES, ...(dossier.hypotheses ?? {}) };
  const besoins = { ...BESOINS, ...(dossier.besoins ?? {}) };
  const quand = dossier.dateAnalyse ?? `${regles.annee}-01-01`;
  const etatCivil = dossier.etatCivil ?? (dossier.conjoint ? 'marie' : 'celibataire');
  const marie = etatCivil === 'marie' || etatCivil === 'partenariat';
  const enfants = dossier.enfants ?? [];
  const aCharge = enfants.map(e => ({ age: ageA(e.dateNaissance, quand), fin: e.formationJusqua ?? 25 }))
    .filter(e => e.age < e.fin).map(e => ({ ...e, mineur: e.age < 18 }));
  const nombreEnfants = aCharge.length;
  const P = profil(regles, dossier.personne, { quand, hyp, marie, enfants });
  // le conjoint part à son propre âge de référence : l'âge de départ choisi ne vaut que pour la personne analysée
  const C = dossier.conjoint ? profil(regles, dossier.conjoint, { quand, hyp: { ...hyp, ageRetraite: undefined }, marie, enfants }) : null;
  const alertes = [];
  const alerte = (cle, gravite, valeurs = {}) => alertes.push({ cle, gravite, valeurs });

  // ---------------------------------------------------------------- retraite
  // Âge de départ et AVS : la rente peut être anticipée de deux ans au plus (réduite à vie) ou ajournée (majorée).
  // Avant, il n'y a pas de rente : `pontAVS` compte les années à financer soi-même.
  const refAVS = P.ref.ans + P.ref.mois / 12;
  // Femmes nées de 1961 à 1969 (AVS 21) : anticipation dès 62 ans à taux réduits, ou supplément de rente sans anticipation.
  const transitoire = AVS.generationTransitoire(regles, P.sexe, P.naissance, P.ramd, P.echelle);
  const anticipationMax = transitoire?.anticipationMax ?? regles.avs.anticipationMaxAnnees;
  const ecartAVS = hyp.flexibilisationAVS ?? borne(P.ageRetraite - refAVS, -anticipationMax, 5);
  // taux réduits de la génération transitoire : au mois près entre deux années entières
  const reductionTransitoire = annees => { const bas = Math.floor(annees), haut = Math.min(3, bas + 1), r = /** @type {any} */ (transitoire).reductions;
    return r[Math.min(3, bas)] + (r[haut] - r[Math.min(3, bas)]) * (annees - bas); };
  const flex = transitoire && ecartAVS < 0 ? 1 - reductionTransitoire(Math.min(3, -ecartAVS)) : AVS.facteurFlexibilisation(regles, ecartAVS);
  const supplementAVS = transitoire && ecartAVS >= 0 ? transitoire.supplementMensuel * 12 : 0;
  const debutAVS = Math.max(P.age, P.ageRetraite, Math.ceil(refAVS - anticipationMax));
  const pontAVS = Math.max(0, debutAVS - P.ageRetraite);
  let avsMensuelle = AVS.renteVieillesse(regles, P.ramd, P.echelle);
  let avsConjointMensuelle = C ? AVS.renteVieillesse(regles, C.ramd, C.echelle) : 0;
  let plafonne = false;
  if (C && marie) {
    const [a, b] = AVS.plafonnerCouple(regles, avsMensuelle, avsConjointMensuelle, P.echelle, C.echelle);
    plafonne = a + b < avsMensuelle + avsConjointMensuelle;
    [avsMensuelle, avsConjointMensuelle] = [a, b];
  }
  const versements = regles.avs.treiziemeRente ? 13 : 12;
  const avsAnnuelle = avsMensuelle * versements * flex;
  const dureeRente = Math.max(1, hyp.ageFinRente - P.ageRetraite);
  const capital3a = somme(P.contrats.filter(c => c.type === '3a').map(c => c.capitalRetraite));
  const capital3b = somme(P.contrats.filter(c => c.type === '3b').map(c => c.capitalRetraite));
  const enRente = capital => renteDepuisCapital(capital, dureeRente, hyp.rendementFortune);
  // le 3a est imposé une fois à son retrait (barème des prestations en capital) : seul le net finance la retraite
  const impot3a = capital3a > 0 && dossier.canton && contexte.impots ? Impots.impotCapital(contexte.impots, dossier.canton, marie, capital3a) ?? 0 : 0;
  const retraite = risque('retraite', P.revenu * besoins.retraite, [
    { cle: 'avs', pilier: 1, montant: avsAnnuelle },
    { cle: 'avsSupplement', pilier: 1, montant: supplementAVS },
    { cle: 'lpp', pilier: 2, montant: P.lpp.renteVieillesse, estime: P.lpp.estime },
    { cle: 'pilier3a', pilier: 3, montant: enRente(capital3a - impot3a), capital: capital3a, impotRetrait: impot3a },
    { cle: 'pilier3b', pilier: 3, montant: enRente(capital3b), capital: capital3b },
    { cle: 'fortune', pilier: 3, montant: enRente(P.fortuneRetraite), capital: P.fortuneRetraite },
  ], { annees: dureeRente, escompte: hyp.escompte,
       // années de pont : l'AVS comptée ci-dessus n'est pas encore versée, il faut la financer soi-même
       capitalBesoin: arrondi(valeurActuelleRente(avsAnnuelle + supplementAVS, pontAVS, hyp.escompte), 100) });
  retraite.capitalPont = retraite.capitalBesoin;
  // capital à constituer d'ici la retraite : ramené à aujourd'hui, et en épargne annuelle
  const actualisation = Math.pow(1 + hyp.escompte, -P.anneesRestantes);
  retraite.capitalAujourdhui = arrondi(retraite.capital * actualisation, 100);
  retraite.epargneAnnuelle = P.anneesRestantes > 0
    ? arrondi(retraite.capital / Math.max(valeurFuture(0, 1, P.anneesRestantes, hyp.rendement3a), 1e-9), 10) : retraite.capital;

  // ---------------------------------------------------------------- invalidité
  // les rentes d'invalidité courent jusqu'à l'âge de référence, quel que soit l'âge de départ souhaité
  const anneesJusquaRetraite = Math.max(0, P.ref.ans - P.age);
  // Rentes d'enfants : chacune s'arrête quand l'enfant a 18 ans, ou 25 ans au plus en formation. La lacune grandit donc
  // d'année en année ; le capital à prévoir additionne les lacunes de chaque année (et pas la lacune d'aujourd'hui
  // multipliée par la durée).
  const dureesEnfants = aCharge.map(e => Math.max(0, e.fin - e.age));
  const enfantsApres = annee => dureesEnfants.filter(d => d > annee).length;
  const capitalVariable = (annees, sourcesPour, besoin) => {
    let capital = 0, pire = 0;
    for (let y = 0; y < annees; y++) {
      const lacune = Math.max(0, besoin - somme(sourcesPour(enfantsApres(y)).map(s => Math.max(0, arrondi(s.montant)))));
      pire = Math.max(pire, lacune);
      capital += valeurActuelleRente(lacune, 1, hyp.escompte) * Math.pow(1 + hyp.escompte, -y);
    }
    return { capitalRente: arrondi(capital, 100), lacuneMax: arrondi(pire) };
  };
  const ai = AVS.rentesAI(regles, { ramd: P.ramd, echelle: P.echelle, age: P.age, degre: 100 });
  const aiAnnuelle = ai.assure * 12;
  const privees = somme(P.contrats.map(c => c.renteInvalidite ?? 0));
  const besoinInvalidite = P.revenu * besoins.invalidite;
  // maladie : AI + LPP, la LPP pouvant réduire ses prestations au-delà de 90 % du gain perdu (surindemnisation)
  const sourcesMaladie = n => {
    const aiEnfants = ai.parEnfant * 12 * n, lppInvalidite = P.lpp.renteInvalidite + P.lpp.renteEnfant * n;
    const lppVersee = Math.min(lppInvalidite, Math.max(0, P.revenu * regles.lpp.surindemnisation - aiAnnuelle - aiEnfants));
    return [
      { cle: 'ai', pilier: 1, montant: aiAnnuelle },
      { cle: 'aiEnfants', pilier: 1, montant: aiEnfants },
      { cle: 'lpp', pilier: 2, montant: lppVersee, estime: P.lpp.estime, reduit: lppVersee < lppInvalidite },
      { cle: 'privee', pilier: 3, montant: privees },
    ];
  };
  const invaliditeMaladie = risque('invaliditeMaladie', besoinInvalidite, sourcesMaladie(nombreEnfants),
    { annees: anneesJusquaRetraite, escompte: hyp.escompte, ...capitalVariable(anneesJusquaRetraite, sourcesMaladie, besoinInvalidite) });
  // accident : la LAA complète l'AI jusqu'à 90 % du gain assuré ; la LPP n'intervient que s'il reste de la marge
  const sourcesAccident = n => {
    const aiEnfants = ai.parEnfant * 12 * n, lppInvalidite = P.lpp.renteInvalidite + P.lpp.renteEnfant * n;
    const laaRente = P.laaAssure ? LAA.renteInvaliditeLAA(regles, { salaire: P.revenu, degre: 100, renteAIAnnuelle: aiAnnuelle + aiEnfants }) : 0;
    const margeLPP = Math.max(0, P.revenu * regles.lpp.surindemnisation - aiAnnuelle - aiEnfants - laaRente);
    return [
      { cle: 'ai', pilier: 1, montant: aiAnnuelle },
      { cle: 'aiEnfants', pilier: 1, montant: aiEnfants },
      { cle: 'laa', pilier: 2, montant: laaRente },
      { cle: 'lpp', pilier: 2, montant: Math.min(lppInvalidite, margeLPP), estime: P.lpp.estime },
      { cle: 'privee', pilier: 3, montant: privees },
    ];
  };
  const invaliditeAccident = risque('invaliditeAccident', besoinInvalidite, sourcesAccident(nombreEnfants),
    { annees: anneesJusquaRetraite, escompte: hyp.escompte, ...capitalVariable(anneesJusquaRetraite, sourcesAccident, besoinInvalidite) });
  // les deux premières années : salaire ou indemnités journalières, avant la rente
  const semainesSalaire = (() => {
    // ancienneté chez l'employeur : celle du dossier si elle est saisie, sinon une carrière sans changement depuis 25 ans (optimiste)
    const anciennete = Math.max(1, Math.min(P.source.anciennete ?? P.age - 25, 40));
    let s = 3;
    for (const [an, semaines] of regles.maladie.echelleBernoise) if (anciennete >= an) s = semaines;
    return s;
  })();
  const attenteMaladie = P.ijm.assure
    ? { cle: 'ijm', taux: P.ijm.taux, jours: P.ijm.jours, montant: arrondi(P.revenu * P.ijm.taux) }
    : { cle: P.statut === 'salarie' ? 'salaireEchelle' : 'aucune', taux: P.statut === 'salarie' ? 1 : 0,
        jours: P.statut === 'salarie' ? semainesSalaire * 7 : 0, montant: P.statut === 'salarie' ? P.revenu : 0 };
  const attenteAccident = P.laaAssure
    ? { cle: 'laaIndemnite', taux: regles.laa.indemniteJournaliere, jours: 730, montant: LAA.indemniteJournaliereAnnuelle(regles, P.revenu) }
    : attenteMaladie;
  invaliditeMaladie.attente = attenteMaladie;
  invaliditeAccident.attente = attenteAccident;

  // ---------------------------------------------------------------- décès
  // Droit du conjoint survivant (on suppose un mariage de cinq ans au moins) :
  // - AVS : la veuve, si elle a un enfant (de tout âge) ou 45 ans révolus ; le veuf, seulement s'il a un enfant mineur ;
  // - LPP (art. 19) : enfant à charge, ou 45 ans révolus ; sinon une allocation unique de trois rentes annuelles ;
  // - LAA (art. 29) : enfant ayant droit à une rente ; la veuve aussi dès 45 ans ou si elle a des enfants adultes.
  const sexeSurvivant = dossier.conjoint?.sexe ?? (dossier.personne.sexe === 'h' ? 'f' : 'h');
  // conjoint non saisi : on le suppose du même âge que la personne
  const survivantA45 = (C ? C.age : P.age) >= 45;
  const conjointAyantDroitAVS = marie && (sexeSurvivant === 'f' ? enfants.length > 0 || survivantA45 : aCharge.some(e => e.mineur));
  const rentierLPP = marie && (nombreEnfants > 0 || survivantA45);
  const conjointAyantDroitLPP = rentierLPP || (etatCivil === 'concubin' && !!dossier.personne.lpp?.renteConjoint);
  const allocationLPP = marie && !rentierLPP ? 3 * P.lpp.renteConjoint : 0;
  const conjointAyantDroitLAA = marie && (nombreEnfants > 0 || (sexeSurvivant === 'f' && (enfants.length > 0 || survivantA45)));
  const survivantsAVS = n => AVS.rentesSurvivants(regles, { ramd: P.ramd, echelle: P.echelle, age: P.age, conjointAyantDroit: conjointAyantDroitAVS,
                                                           nombreEnfants: n });
  const survAVS = survivantsAVS(nombreEnfants);
  const aQuelquun = marie || etatCivil === 'concubin' || nombreEnfants > 0;
  const besoinDeces = aQuelquun ? P.revenu * besoins.deces : 0;
  const plusJeune = nombreEnfants ? Math.min(...aCharge.map(e => e.age)) : null;
  const anneesEnfants = plusJeune === null ? 0 : Math.max(...aCharge.map(e => e.fin - e.age));
  const anneesConjoint = marie || etatCivil === 'concubin' ? (C ? Math.max(0, C.ref.ans - C.age) : anneesJusquaRetraite) : 0;
  const anneesDeces = Math.max(anneesEnfants, Math.min(anneesConjoint, anneesJusquaRetraite));
  const capitauxDeces = P.lpp.capitalDeces + allocationLPP + somme(P.contrats.map(c => (c.capitalDeces ?? 0) + (c.forme === 'assurance' ? 0 : c.avoir ?? 0)))
    + (dossier.personne.fortune ?? 0);
  const lppSurvivantsPour = n => (conjointAyantDroitLPP ? P.lpp.renteConjoint : 0) + P.lpp.renteEnfant * n;
  // Les capitaux disponibles au décès (capital de la caisse, 3e pilier, assurances, fortune) servent d'abord le besoin en
  // capital (hypothèque à rembourser…) ; le reste est converti en revenu sur la durée du besoin et compte comme une source.
  const capitauxLibres = Math.max(0, capitauxDeces - besoins.capitalDeces);
  const revenuCapitaux = aQuelquun ? renteDepuisCapital(capitauxLibres, anneesDeces, hyp.escompte) : 0;
  const sourcesDecesMaladie = n => {
    const avs = survivantsAVS(n);
    return [
      { cle: 'avsConjoint', pilier: 1, montant: avs.conjoint * 12 },
      { cle: 'avsOrphelins', pilier: 1, montant: avs.parEnfant * 12 * n },
      { cle: 'lpp', pilier: 2, montant: lppSurvivantsPour(n), estime: P.lpp.estime },
      { cle: 'capitaux', pilier: 3, montant: revenuCapitaux, capital: capitauxLibres },
    ];
  };
  const sourcesDecesAccident = n => {
    const avs = survivantsAVS(n), [conjoint, orphelins, lpp, capitaux] = sourcesDecesMaladie(n);
    const laaSurv = P.laaAssure ? LAA.rentesSurvivantsLAA(regles, { salaire: P.revenu, conjointAyantDroit: conjointAyantDroitLAA, nombreEnfants: n,
                                                                   rentesAVSAnnuelles: avs.total * 12 }).total : 0;
    return [conjoint, orphelins, { cle: 'laa', pilier: 2, montant: laaSurv },
      { ...lpp, montant: Math.min(lpp.montant, Math.max(0, P.revenu * regles.lpp.surindemnisation - avs.total * 12 - laaSurv)) }, capitaux];
  };
  const optionsDeces = { annees: anneesDeces, escompte: hyp.escompte, capitalBesoin: Math.max(0, besoins.capitalDeces - capitauxDeces) };
  // Capital à prévoir au décès : la somme des lacunes de chaque année, comptées sans les capitaux, moins les capitaux
  // disponibles. (Les répartir en rente égale sur toute la durée les ferait « dépenser » pendant les années sans lacune,
  // alors que le manque n'apparaît souvent qu'à la fin des rentes d'orphelin.)
  const capitalDecesPour = sources => {
    const brut = capitalVariable(anneesDeces, n => sources(n).filter(s => s.cle !== 'capitaux'), besoinDeces);
    const capitalRente = Math.max(0, arrondi(brut.capitalRente - capitauxLibres, 100));
    return { capitalRente, lacuneMax: capitalRente > 0 ? capitalVariable(anneesDeces, sources, besoinDeces).lacuneMax : 0 };
  };
  const decesMaladie = risque('decesMaladie', besoinDeces, sourcesDecesMaladie(nombreEnfants), { ...optionsDeces, ...capitalDecesPour(sourcesDecesMaladie) });
  decesMaladie.capitauxDisponibles = arrondi(capitauxDeces);
  const decesAccident = risque('decesAccident', besoinDeces, sourcesDecesAccident(nombreEnfants), { ...optionsDeces, ...capitalDecesPour(sourcesDecesAccident) });
  decesAccident.capitauxDisponibles = arrondi(capitauxDeces);

  // ---------------------------------------------------------------- potentiels
  const revenuImposable = P.revenu + (C && marie ? C.revenu : 0);
  // couple à deux salaires : l'impôt est plus bas qu'avec un seul salaire du même total (déductions pour double revenu)
  const partSecond = C && marie && P.revenu > 0 && C.revenu > 0 ? Math.min(P.revenu, C.revenu) / revenuImposable : 0;
  const fiscal = dossier.canton && contexte.impots ? Impots.impotRevenu(contexte.impots, dossier.canton, marie, revenuImposable, nombreEnfants, partSecond) : null;
  const marginal = P.tauxMarginal ?? fiscal?.marginal ?? estimerTauxMarginal(revenuImposable, marie);
  // économie d'une déduction : sur le barème réel du canton quand il est connu, sinon au taux marginal
  const economie = deduction => (fiscal && P.tauxMarginal === undefined
    ? /** @type {number} */ (Impots.economieDeduction(contexte.impots, /** @type {string} */ (dossier.canton), marie, revenuImposable, deduction, nombreEnfants, partSecond))
    : P.tauxMarginal !== undefined ? arrondi(Math.min(deduction, revenuImposable) * marginal, 10)
      : economieEstimee(revenuImposable, deduction, marie));
  const plafond3a = P.statut === 'sans' ? 0 : P.lpp.affilie ? regles.pilier3a.plafondAvecLPP
    : Math.min(regles.pilier3a.plafondSansLPP, arrondi(P.revenu * regles.pilier3a.tauxSansLPP));
  const verse3a = somme(P.contrats.filter(c => c.type === '3a').map(c => c.versementAnnuel ?? 0));
  const potentiel3a = Math.max(0, plafond3a - verse3a);
  // Rachat rétroactif 3a (OPP 3, dès 2026) : les lacunes de cotisation depuis 2025 se rattrapent pendant dix ans, à
  // raison d'un petit plafond par an au plus, en plus de la cotisation ordinaire entière de l'année. La lacune vient du
  // dossier si elle est connue ; sinon elle est estimée (même versement les années passées qu'aujourd'hui).
  const rr = regles.pilier3a.rachatRetroactif;
  const anneesOuvertes = rr && P.statut !== 'sans' ? borne(regles.annee - rr.depuisAnnee, 0, rr.maxAnneesArriere) : 0;
  const lacune3a = Math.max(0, dossier.personne.lacune3a ?? potentiel3a * anneesOuvertes);
  const retro3a = anneesOuvertes > 0 ? Math.min(lacune3a, rr.plafondParRachat) : 0;
  const potentiels = {
    tauxMarginal: marginal, tauxMarginalEstime: P.tauxMarginal === undefined && !fiscal, canton: fiscal ? dossier.canton : null,
    impotRevenu: fiscal?.impot ?? null,
    pilier3a: { plafond: plafond3a, verse: verse3a, potentiel: potentiel3a, economieImpot: economie(potentiel3a),
                retroactif: { possible: retro3a, lacune: lacune3a, estime: dossier.personne.lacune3a === undefined, anneesOuvertes,
                              economieImpot: Math.max(0, economie(potentiel3a + retro3a) - economie(potentiel3a)) },
                capitalSupplementaire: arrondi(valeurFuture(0, potentiel3a, P.anneesRestantes, hyp.rendement3a), 100) },
    rachatLPP: { possible: P.lpp.rachatPossible, economieImpot: economie(P.lpp.rachatPossible),
                 renteSupplementaire: arrondi(P.lpp.rachatPossible * (P.lpp.tauxConversion ?? regles.lpp.tauxConversion)) },
    avs: { anneesManquantes: P.manquantes, perteMensuelle: arrondi(AVS.renteComplete(regles, P.ramd) - avsMensuelleBrute(regles, P)) },
  };

  // ---------------------------------------------------------------- alertes
  if (P.ramdEstime) alerte('ramdEstime', 'info');
  if (P.lpp.affilie && P.lpp.estime) alerte('lppEstimee', 'info');
  if (P.manquantes > 0) alerte('lacunesAVS', 'attention', { annees: P.manquantes, perteMensuelle: potentiels.avs.perteMensuelle });
  if (etatCivil === 'concubin') alerte('concubinage', 'critique');
  if (P.statut === 'independant' && !P.lpp.affilie) alerte('independantSansLPP', 'critique');
  if (P.statut === 'independant' && !P.laaAssure) alerte('independantSansLAA', 'critique');
  if (P.statut !== 'sans' && !P.ijm.assure) alerte(P.statut === 'salarie' ? 'sansIJM' : 'independantSansIJM',
                                                  P.statut === 'salarie' ? 'attention' : 'critique', { semaines: semainesSalaire });
  if (P.revenu > regles.laa.gainAssureMax) alerte('revenuAuDessusLAA', 'attention', { plafond: regles.laa.gainAssureMax, excedent: P.revenu - regles.laa.gainAssureMax });
  if (P.statut === 'salarie' && P.revenu > 0 && P.revenu < regles.lpp.seuilEntree) alerte('sousSeuilLPP', 'critique', { seuil: regles.lpp.seuilEntree });
  if (plafonne) alerte('plafonnementCouple', 'info', { plafond: regles.avs.renteMaxMensuelle * regles.avs.plafondCoupleFacteur });
  if (retro3a > 0) alerte('rachat3a', 'opportunite', { montant: retro3a, economie: potentiels.pilier3a.retroactif.economieImpot });
  if (potentiel3a > 0) alerte('potentiel3a', 'opportunite', { montant: potentiel3a, economie: potentiels.pilier3a.economieImpot });
  if (P.lpp.rachatPossible > 0) alerte('rachatLPP', 'opportunite', { montant: P.lpp.rachatPossible, economie: potentiels.rachatLPP.economieImpot });
  if (invaliditeMaladie.lacune > invaliditeAccident.lacune + 1000) alerte('ecartMaladieAccident', 'attention',
    { ecart: invaliditeMaladie.lacune - invaliditeAccident.lacune });
  if (P.sexe === 'f' && P.ref.mois > 0) alerte('generationTransitoire', 'info', { ans: P.ref.ans, mois: P.ref.mois });
  // femmes nées de 1961 à 1969 (AVS 21) : supplément de rente ou taux d'anticipation réduits, chiffrés plus haut
  if (transitoire) alerte('supplementTransitoire', 'info', { supplement: transitoire.supplementMensuel, anticipe: ecartAVS < 0 ? 1 : 0 });
  if (pontAVS > 0) alerte('pontAVS', 'attention', { annees: pontAVS, age: debutAVS });
  if (P.anneesRestantes <= 10 && P.lpp.affilie) alerte('choixRenteCapital', 'info', { annees: P.anneesRestantes });

  // ---------------------------------------------------------------- score
  const poids = aQuelquun ? { retraite: 0.35, invaliditeMaladie: 0.3, invaliditeAccident: 0.1, decesMaladie: 0.2, decesAccident: 0.05 }
    : { retraite: 0.45, invaliditeMaladie: 0.4, invaliditeAccident: 0.15, decesMaladie: 0, decesAccident: 0 };
  const risques = { retraite, invaliditeMaladie, invaliditeAccident, decesMaladie, decesAccident };
  const score = arrondi(100 * somme(Object.entries(poids).map(([k, w]) => w * Math.min(1, risques[k].couverture))));

  return {
    annee: regles.annee, dateAnalyse: quand, etatCivil, marie, canton: dossier.canton ?? null,
    personne: { age: P.age, ageReference: P.ref, ageRetraite: P.ageRetraite, debutAVS, pontAVS, facteurAVS: flex, supplementAVS, revenu: P.revenu, ramd: arrondi(P.ramd), ramdEstime: P.ramdEstime,
                echelle: P.echelle, lpp: P.lpp, capital3a, capital3b },
    conjoint: C ? { age: C.age, revenu: C.revenu, avsMensuelle: avsConjointMensuelle, lppRente: C.lpp.renteVieillesse } : null,
    enfantsACharge: nombreEnfants,
    risques, potentiels, alertes, score,
    chronologie: chronologie(regles, { P, hyp, avsAnnuelle: avsAnnuelle + supplementAVS, debutAVS, retraite, invaliditeMaladie, invaliditeAccident }),
    hypotheses: hyp, besoins,
  };
}

/** Rente AVS mensuelle avec l'échelle réelle (sert à chiffrer la perte due aux années manquantes). */
function avsMensuelleBrute(regles, P) {
  return AVS.renteVieillesse(regles, P.ramd, P.echelle);
}

/**
 * Revenus année par année, de l'âge actuel à la fin de la projection : parcours normal, et parcours en cas
 * d'invalidité (maladie ou accident) survenant aujourd'hui. Alimente la « ligne de vie » des interfaces.
 */
function chronologie(regles, { P, hyp, avsAnnuelle, debutAVS, retraite, invaliditeMaladie, invaliditeAccident }) {
  const points = [];
  const retraiteParPilier = pilier => somme(retraite.sources.filter(s => s.pilier === pilier).map(s => s.montant));
  for (let a = P.age; a <= hyp.ageFinRente; a++) {
    const actif = a < P.ageRetraite;
    const salaire = actif ? arrondi(P.revenu * Math.pow(1 + hyp.croissanceSalaire, a - P.age)) : 0;
    const depuis = a - P.age;
    // les deux premières années : salaire ou indemnités journalières tant qu'elles durent, puis la rente (dès 12 mois)
    const parcours = r => {
      // les rentes d'invalidité courent jusqu'à l'âge de référence, quel que soit l'âge de départ prévu ; ensuite, la retraite
      if (a >= P.ref.ans) return retraite.total - (a < debutAVS ? avsAnnuelle : 0);
      if (depuis >= 2) return r.total;
      const part = borne((r.attente.jours - 365 * depuis) / 365, 0, 1);
      return r.attente.montant * part + (depuis >= 1 ? r.total * (1 - part) : 0);
    };
    points.push({
      age: a, actif, salaire,
      pilier1: actif || a < debutAVS ? 0 : arrondi(avsAnnuelle), pilier2: actif ? 0 : retraiteParPilier(2), pilier3: actif ? 0 : arrondi(retraiteParPilier(3)),
      besoin: actif ? salaire : retraite.besoin,
      invaliditeMaladie: arrondi(parcours(invaliditeMaladie)), invaliditeAccident: arrondi(parcours(invaliditeAccident)),
    });
  }
  return points;
}
