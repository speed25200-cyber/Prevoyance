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
 *            pilier3?: Contrat3[], fortune?: number, tauxMarginal?: number}} Personne
 * @typedef {{dateAnalyse?: string, personne: Personne, conjoint?: Personne|null,
 *            etatCivil?: 'celibataire'|'marie'|'partenariat'|'concubin'|'divorce'|'veuf',
 *            enfants?: {dateNaissance: string, formationJusqua?: number}[],
 *            besoins?: {retraite?: number, invalidite?: number, deces?: number, capitalDeces?: number},
 *            hypotheses?: {ageRetraite?: number, rendement3a?: number, rendementFortune?: number, escompte?: number,
 *                          croissanceSalaire?: number, interetLPP?: number, ageFinRente?: number, flexibilisationAVS?: number}}} Dossier
 */

import * as AVS from './avs.js';
import { prestationsLPP } from './lpp.js';
import * as LAA from './laa.js';
import { age as ageA, anneeNaissance, arrondi, borne, renteDepuisCapital, somme, valeurActuelleRente, valeurFuture } from './util.js';

const HYPOTHESES = { ageRetraite: 65, rendement3a: 0.02, rendementFortune: 0.015, escompte: 0.015, croissanceSalaire: 0,
                     interetLPP: undefined, ageFinRente: 90, flexibilisationAVS: 0 };
const BESOINS = { retraite: 0.8, invalidite: 0.9, deces: 0.7, capitalDeces: 0 };

/** Taux marginal d'impôt estimé (moyenne suisse, revenu brut) : sert seulement à chiffrer un ordre de grandeur. */
export function estimerTauxMarginal(revenu, marie = false) {
  const r = marie ? revenu * 0.75 : revenu;
  const paliers = [[30000, 0.08], [50000, 0.15], [80000, 0.22], [120000, 0.28], [180000, 0.33], [300000, 0.37]];
  for (const [seuil, taux] of paliers) if (r <= seuil) return taux;
  return 0.4;
}

/** Profil d'une personne : âges, 1er et 2e piliers, 3e pilier à la retraite. */
function profil(regles, p, { quand, hyp, marie, enfants }) {
  const age = ageA(p.dateNaissance, quand);
  const ref = AVS.ageReference(regles, p.sexe, anneeNaissance(p.dateNaissance));
  const ageRetraite = hyp.ageRetraite;
  const revenu = Math.max(0, p.revenu || 0);
  // années avec un enfant de moins de 16 ans (bonifications pour tâches éducatives), estimées d'après l'aîné
  const agesEnfants = enfants.map(e => ageA(e.dateNaissance, quand)).filter(a => a >= 0);
  const anneesEducatives = agesEnfants.length ? Math.min(16 + (agesEnfants.length - 1) * 2, Math.max(...agesEnfants) + 1) : 0;
  const ramdEstime = p.avs?.ramd === undefined;
  const ramd = p.avs?.ramd ?? AVS.estimerRamd(regles, { revenu, age, anneesEducatives, marie });
  const manquantes = Math.max(0, p.avs?.anneesManquantes ?? 0);
  const echelle = AVS.echelle(regles, regles.avs.dureeCotisationComplete - manquantes);
  const lpp = prestationsLPP(regles, { age, salaireAVS: p.statut === 'salarie' ? revenu : (p.lpp?.affilie ? revenu : 0),
                                      ageRetraite, croissanceSalaire: hyp.croissanceSalaire, interet: hyp.interetLPP, lpp: p.lpp });
  const anneesRestantes = Math.max(0, ageRetraite - age);
  const contrats = (p.pilier3 ?? []).map(c => ({
    ...c,
    capitalRetraite: c.capitalEcheance ?? arrondi(valeurFuture(c.avoir ?? 0, c.versementAnnuel ?? 0, anneesRestantes, c.rendement ?? hyp.rendement3a)),
  }));
  const fortuneRetraite = arrondi(valeurFuture(p.fortune ?? 0, 0, anneesRestantes, hyp.rendementFortune));
  return { age, ref, ageRetraite, revenu, ramd, ramdEstime, echelle, manquantes, lpp, contrats, fortuneRetraite, anneesRestantes,
           statut: p.statut, laaAssure: p.laa?.assure ?? p.statut === 'salarie',
           ijm: { assure: p.ijm?.assure ?? false, taux: p.ijm?.taux ?? regles.maladie.ijmUsuelle.taux, jours: p.ijm?.jours ?? regles.maladie.ijmUsuelle.jours },
           tauxMarginal: p.tauxMarginal, source: p };
}

/** Un risque chiffré : besoin, sources, lacune, capital pour la combler. */
function risque(cle, besoin, sources, { annees = 0, escompte = 0, capitauxDisponibles = 0, capitalBesoin = 0 } = {}) {
  const lignes = sources.filter(s => s.montant > 0).map(s => ({ ...s, montant: arrondi(s.montant) }));
  const total = somme(lignes.map(s => s.montant));
  const lacune = Math.max(0, arrondi(besoin - total));
  const capitalRente = arrondi(valeurActuelleRente(lacune, annees, escompte), 100);
  const capital = Math.max(0, arrondi(capitalRente + capitalBesoin - capitauxDisponibles, 100));
  return { cle, besoin: arrondi(besoin), sources: lignes, total, lacune, lacuneMensuelle: arrondi(lacune / 12),
           couverture: besoin > 0 ? borne(total / besoin, 0, 1.5) : 1, annees, capitalRente, capitauxDisponibles: arrondi(capitauxDisponibles),
           capitalBesoin: arrondi(capitalBesoin), capital };
}

/**
 * @param {Dossier} dossier @param {any} regles
 */
export function analyser(dossier, regles) {
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
  const C = dossier.conjoint ? profil(regles, dossier.conjoint, { quand, hyp, marie, enfants }) : null;
  const alertes = [];
  const alerte = (cle, gravite, valeurs = {}) => alertes.push({ cle, gravite, valeurs });

  // ---------------------------------------------------------------- retraite
  const flex = AVS.facteurFlexibilisation(regles, hyp.flexibilisationAVS);
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
  const retraite = risque('retraite', P.revenu * besoins.retraite, [
    { cle: 'avs', pilier: 1, montant: avsAnnuelle },
    { cle: 'lpp', pilier: 2, montant: P.lpp.renteVieillesse, estime: P.lpp.estime },
    { cle: 'pilier3a', pilier: 3, montant: enRente(capital3a), capital: capital3a },
    { cle: 'pilier3b', pilier: 3, montant: enRente(capital3b), capital: capital3b },
    { cle: 'fortune', pilier: 3, montant: enRente(P.fortuneRetraite), capital: P.fortuneRetraite },
  ], { annees: dureeRente, escompte: hyp.escompte });
  // capital à constituer d'ici la retraite : ramené à aujourd'hui, et en épargne annuelle
  const actualisation = Math.pow(1 + hyp.escompte, -P.anneesRestantes);
  retraite.capitalAujourdhui = arrondi(retraite.capital * actualisation, 100);
  retraite.epargneAnnuelle = P.anneesRestantes > 0
    ? arrondi(retraite.capital / Math.max(valeurFuture(0, 1, P.anneesRestantes, hyp.rendement3a), 1e-9), 10) : retraite.capital;

  // ---------------------------------------------------------------- invalidité
  const anneesJusquaRetraite = Math.max(0, P.ageRetraite - P.age);
  const ai = AVS.rentesAI(regles, { ramd: P.ramd, echelle: P.echelle, age: P.age, degre: 100 });
  const aiAnnuelle = ai.assure * 12, aiEnfants = ai.parEnfant * 12 * nombreEnfants;
  const privees = somme(P.contrats.map(c => c.renteInvalidite ?? 0));
  const besoinInvalidite = P.revenu * besoins.invalidite;
  // maladie : AI + LPP, la LPP pouvant réduire ses prestations au-delà de 90 % du gain perdu (surindemnisation)
  const lppInvalidite = P.lpp.renteInvalidite + P.lpp.renteEnfant * nombreEnfants;
  const plafondLPP = Math.max(0, P.revenu * regles.lpp.surindemnisation - aiAnnuelle - aiEnfants);
  const lppVersee = Math.min(lppInvalidite, plafondLPP);
  const invaliditeMaladie = risque('invaliditeMaladie', besoinInvalidite, [
    { cle: 'ai', pilier: 1, montant: aiAnnuelle },
    { cle: 'aiEnfants', pilier: 1, montant: aiEnfants },
    { cle: 'lpp', pilier: 2, montant: lppVersee, estime: P.lpp.estime, reduit: lppVersee < lppInvalidite },
    { cle: 'privee', pilier: 3, montant: privees },
  ], { annees: anneesJusquaRetraite, escompte: hyp.escompte });
  // accident : la LAA complète l'AI jusqu'à 90 % du gain assuré ; la LPP n'intervient que s'il reste de la marge
  const laaRente = P.laaAssure ? LAA.renteInvaliditeLAA(regles, { salaire: P.revenu, degre: 100, renteAIAnnuelle: aiAnnuelle + aiEnfants }) : 0;
  const margeLPP = Math.max(0, P.revenu * regles.lpp.surindemnisation - aiAnnuelle - aiEnfants - laaRente);
  const invaliditeAccident = risque('invaliditeAccident', besoinInvalidite, [
    { cle: 'ai', pilier: 1, montant: aiAnnuelle },
    { cle: 'aiEnfants', pilier: 1, montant: aiEnfants },
    { cle: 'laa', pilier: 2, montant: laaRente },
    { cle: 'lpp', pilier: 2, montant: Math.min(lppInvalidite, margeLPP), estime: P.lpp.estime },
    { cle: 'privee', pilier: 3, montant: privees },
  ], { annees: anneesJusquaRetraite, escompte: hyp.escompte });
  // les deux premières années : salaire ou indemnités journalières, avant la rente
  const semainesSalaire = (() => {
    const anciennete = Math.max(1, Math.min(P.age - 25, 40));
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
  const conjointAyantDroitAVS = marie && (nombreEnfants > 0 || (C ? C.age >= 45 : false));
  const conjointAyantDroitLPP = marie || (etatCivil === 'concubin' && !!dossier.personne.lpp?.renteConjoint);
  const survAVS = AVS.rentesSurvivants(regles, { ramd: P.ramd, echelle: P.echelle, age: P.age, conjointAyantDroit: conjointAyantDroitAVS,
                                                 nombreEnfants });
  const aQuelquun = marie || etatCivil === 'concubin' || nombreEnfants > 0;
  const besoinDeces = aQuelquun ? P.revenu * besoins.deces : 0;
  const plusJeune = nombreEnfants ? Math.min(...aCharge.map(e => e.age)) : null;
  const anneesEnfants = plusJeune === null ? 0 : Math.max(...aCharge.map(e => e.fin - e.age));
  const anneesConjoint = (marie || etatCivil === 'concubin') && C ? Math.max(0, C.ageRetraite - C.age) : 0;
  const anneesDeces = Math.max(anneesEnfants, Math.min(anneesConjoint, anneesJusquaRetraite));
  const capitauxDeces = P.lpp.capitalDeces + somme(P.contrats.map(c => (c.capitalDeces ?? 0) + (c.forme === 'assurance' ? 0 : c.avoir ?? 0)))
    + (dossier.personne.fortune ?? 0);
  const lppSurvivants = (conjointAyantDroitLPP ? P.lpp.renteConjoint : 0) + P.lpp.renteEnfant * nombreEnfants;
  const sourcesDeces = [
    { cle: 'avsConjoint', pilier: 1, montant: survAVS.conjoint * 12 },
    { cle: 'avsOrphelins', pilier: 1, montant: survAVS.parEnfant * 12 * nombreEnfants },
    { cle: 'lpp', pilier: 2, montant: lppSurvivants, estime: P.lpp.estime },
  ];
  const optionsDeces = { annees: anneesDeces, escompte: hyp.escompte, capitauxDisponibles: capitauxDeces, capitalBesoin: besoins.capitalDeces };
  const decesMaladie = risque('decesMaladie', besoinDeces, sourcesDeces, optionsDeces);
  const laaSurv = P.laaAssure ? LAA.rentesSurvivantsLAA(regles, { salaire: P.revenu, conjointAyantDroit: marie, nombreEnfants,
                                                                 rentesAVSAnnuelles: survAVS.total * 12 }).total : 0;
  const decesAccident = risque('decesAccident', besoinDeces, [
    sourcesDeces[0], sourcesDeces[1], { cle: 'laa', pilier: 2, montant: laaSurv },
    { cle: 'lpp', pilier: 2, montant: Math.min(lppSurvivants, Math.max(0, P.revenu * regles.lpp.surindemnisation - survAVS.total * 12 - laaSurv)),
      estime: P.lpp.estime },
  ], optionsDeces);

  // ---------------------------------------------------------------- potentiels
  const marginal = P.tauxMarginal ?? estimerTauxMarginal(P.revenu + (C && marie ? C.revenu : 0), marie);
  const plafond3a = P.statut === 'sans' ? 0 : P.lpp.affilie ? regles.pilier3a.plafondAvecLPP
    : Math.min(regles.pilier3a.plafondSansLPP, arrondi(P.revenu * regles.pilier3a.tauxSansLPP));
  const verse3a = somme(P.contrats.filter(c => c.type === '3a').map(c => c.versementAnnuel ?? 0));
  const potentiel3a = Math.max(0, plafond3a - verse3a);
  const potentiels = {
    tauxMarginal: marginal, tauxMarginalEstime: P.tauxMarginal === undefined,
    pilier3a: { plafond: plafond3a, verse: verse3a, potentiel: potentiel3a, economieImpot: arrondi(potentiel3a * marginal, 10),
                capitalSupplementaire: arrondi(valeurFuture(0, potentiel3a, P.anneesRestantes, hyp.rendement3a), 100) },
    rachatLPP: { possible: P.lpp.rachatPossible, economieImpot: arrondi(P.lpp.rachatPossible * marginal, 10),
                 renteSupplementaire: arrondi(P.lpp.rachatPossible * regles.lpp.tauxConversion) },
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
  if (potentiel3a > 0) alerte('potentiel3a', 'opportunite', { montant: potentiel3a, economie: potentiels.pilier3a.economieImpot });
  if (P.lpp.rachatPossible > 0) alerte('rachatLPP', 'opportunite', { montant: P.lpp.rachatPossible, economie: potentiels.rachatLPP.economieImpot });
  if (invaliditeMaladie.lacune > invaliditeAccident.lacune + 1000) alerte('ecartMaladieAccident', 'attention',
    { ecart: invaliditeMaladie.lacune - invaliditeAccident.lacune });
  if (P.sexe === 'f' && P.ref.mois > 0) alerte('generationTransitoire', 'info', { ans: P.ref.ans, mois: P.ref.mois });
  if (P.anneesRestantes <= 10 && P.lpp.affilie) alerte('choixRenteCapital', 'info', { annees: P.anneesRestantes });

  // ---------------------------------------------------------------- score
  const poids = aQuelquun ? { retraite: 0.35, invaliditeMaladie: 0.3, invaliditeAccident: 0.1, decesMaladie: 0.2, decesAccident: 0.05 }
    : { retraite: 0.45, invaliditeMaladie: 0.4, invaliditeAccident: 0.15, decesMaladie: 0, decesAccident: 0 };
  const risques = { retraite, invaliditeMaladie, invaliditeAccident, decesMaladie, decesAccident };
  const score = arrondi(100 * somme(Object.entries(poids).map(([k, w]) => w * Math.min(1, risques[k].couverture))));

  return {
    annee: regles.annee, dateAnalyse: quand, etatCivil,
    personne: { age: P.age, ageReference: P.ref, ageRetraite: P.ageRetraite, revenu: P.revenu, ramd: arrondi(P.ramd), ramdEstime: P.ramdEstime,
                echelle: P.echelle, lpp: P.lpp, capital3a, capital3b },
    conjoint: C ? { age: C.age, revenu: C.revenu, avsMensuelle: avsConjointMensuelle, lppRente: C.lpp.renteVieillesse } : null,
    enfantsACharge: nombreEnfants,
    risques, potentiels, alertes, score,
    chronologie: chronologie(regles, { P, hyp, avsAnnuelle, retraite, invaliditeMaladie, invaliditeAccident }),
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
function chronologie(regles, { P, hyp, avsAnnuelle, retraite, invaliditeMaladie, invaliditeAccident }) {
  const points = [];
  const retraiteParPilier = pilier => somme(retraite.sources.filter(s => s.pilier === pilier).map(s => s.montant));
  for (let a = P.age; a <= hyp.ageFinRente; a++) {
    const actif = a < P.ageRetraite;
    const salaire = actif ? arrondi(P.revenu * Math.pow(1 + hyp.croissanceSalaire, a - P.age)) : 0;
    const depuis = a - P.age;
    // les deux premières années : salaire ou indemnités journalières tant qu'elles durent, puis la rente (dès 12 mois)
    const parcours = r => {
      if (!actif) return retraite.total;
      if (depuis >= 2) return r.total;
      const part = borne((r.attente.jours - 365 * depuis) / 365, 0, 1);
      return r.attente.montant * part + (depuis >= 1 ? r.total * (1 - part) : 0);
    };
    points.push({
      age: a, actif, salaire,
      pilier1: actif ? 0 : arrondi(avsAnnuelle), pilier2: actif ? 0 : retraiteParPilier(2), pilier3: actif ? 0 : arrondi(retraiteParPilier(3)),
      besoin: actif ? salaire : retraite.besoin,
      invaliditeMaladie: arrondi(parcours(invaliditeMaladie)), invaliditeAccident: arrondi(parcours(invaliditeAccident)),
    });
  }
  return points;
}
