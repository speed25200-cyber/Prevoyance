// @ts-check
/**
 * Cas de test du moteur : chaque valeur attendue est calculée à la main à partir des textes légaux et des montants
 * officiels (voir regles/ch-AAAA.json). Les mêmes cas tournent dans le navigateur (tests/index.html), sous Node
 * (tests/run.mjs, intégration continue) et dans l'app iOS.
 */

import { analyser, AVS, LPP, LAA, Impots, Scenarios, Certificat, Conseil, Vie } from '../src/index.js';
import * as Analyse from '../src/analyse.js';

/** @param {(nom: string, obtenu: any, attendu: any, tolerance?: number) => void} egal @param {{r26: any, r27: any, i26?: any}} regles */
export function cas(egal, { r26, r27, i26 }) {
  // ---- AVS : échelle 44 (formule à deux segments, arrondie au franc)
  egal('AVS 2026 rente minimale (RAMD 15 120)', AVS.renteComplete(r26, 15120), 1260);
  egal('AVS 2026 charnière (RAMD 45 360)', AVS.renteComplete(r26, 45360), 1915);
  egal('AVS 2026 RAMD 60 480', AVS.renteComplete(r26, 60480), 2117);
  egal('AVS 2026 rente maximale (RAMD 90 720)', AVS.renteComplete(r26, 90720), 2520);
  egal('AVS 2026 au-delà du maximum', AVS.renteComplete(r26, 250000), 2520);
  egal('AVS 2026 sans revenu', AVS.renteComplete(r26, 0), 1260);
  egal('AVS 2027 rente maximale (RAMD 92 160)', AVS.renteComplete(r27, 92160), 2560);
  egal('AVS 2027 rente minimale', AVS.renteComplete(r27, 1000), 1280);
  egal('AVS palier supérieur (RAMD 60 000 -> 60 480)', AVS.palierRamd(r26, 60000), 60480);
  egal('AVS échelle partielle 40/44', AVS.renteVieillesse(r26, 90720, 40), 2291);
  egal('AVS plafond couple', AVS.plafonnerCouple(r26, 2520, 2520), [1890, 1890]);
  egal('AVS couple sous le plafond', AVS.plafonnerCouple(r26, 1500, 1800), [1500, 1800]);
  egal('AVS âge de référence femme 1962', AVS.ageReference(r26, 'f', 1962), { ans: 64, mois: 6 });
  egal('AVS âge de référence femme 1970', AVS.ageReference(r26, 'f', 1970), { ans: 65, mois: 0 });
  egal('AVS âge de référence homme 1962', AVS.ageReference(r26, 'h', 1962), { ans: 65, mois: 0 });
  egal('AVS anticipation 2 ans', AVS.facteurFlexibilisation(r26, -2), 0.864, 1e-9);
  egal('AVS ajournement 5 ans', AVS.facteurFlexibilisation(r26, 5), 1.315, 1e-9);
  // ---- AI : système linéaire
  egal('AI degré 39', AVS.fractionAI(r26, 39), 0);
  egal('AI degré 40', AVS.fractionAI(r26, 40), 0.25);
  egal('AI degré 45', AVS.fractionAI(r26, 45), 0.375, 1e-9);
  egal('AI degré 50', AVS.fractionAI(r26, 50), 0.5);
  egal('AI degré 69', AVS.fractionAI(r26, 69), 0.69);
  egal('AI degré 70', AVS.fractionAI(r26, 70), 1);
  egal('Supplément de carrière à 22 ans', AVS.supplementCarriere(r26, 22), 1);
  egal('Supplément de carrière à 40 ans', AVS.supplementCarriere(r26, 40), 0.05);
  egal('Supplément de carrière à 46 ans', AVS.supplementCarriere(r26, 46), 0);
  // ---- LPP
  egal('LPP sous le seuil d’entrée', LPP.salaireCoordonne(r26, 22000), 0);
  egal('LPP salaire coordonné minimal', LPP.salaireCoordonne(r26, 25000), 3780);
  egal('LPP salaire coordonné 90 000', LPP.salaireCoordonne(r26, 90000), 63540);
  egal('LPP salaire coordonné maximal', LPP.salaireCoordonne(r26, 200000), 64260);
  egal('LPP 2027 salaire coordonné maximal', LPP.salaireCoordonne(r27, 200000), 65280);
  egal('LPP bonification à 34 ans', LPP.tauxBonification(r26, 34), 0.07);
  egal('LPP bonification à 55 ans', LPP.tauxBonification(r26, 55), 0.18);
  const projection = LPP.projeterAvoir(r26, { age: 40, avoir: 100000, salaireAVS: 90000, interet: 0 });
  egal('LPP projection sans intérêt, 40 -> 65 ans', projection.avoirFinal, 341452);
  egal('LPP projection : 25 années', projection.annees.length, 25);
  // ---- LAA
  egal('LAA rente pleine sans AI', LAA.renteInvaliditeLAA(r26, { salaire: 90000 }), 72000);
  egal('LAA rente complémentaire (AI 30 000)', LAA.renteInvaliditeLAA(r26, { salaire: 90000, renteAIAnnuelle: 30000 }), 51000);
  egal('LAA gain assuré plafonné', LAA.gainAssure(r26, 200000), 148200);
  egal('LAA survivants, conjoint + 2 enfants', LAA.rentesSurvivantsLAA(r26, { salaire: 100000, conjointAyantDroit: true, nombreEnfants: 2 }).total, 70000);
  egal('LAA survivants complémentaires (AVS 40 000)',
       LAA.rentesSurvivantsLAA(r26, { salaire: 100000, conjointAyantDroit: true, nombreEnfants: 2, rentesAVSAnnuelles: 40000 }).total, 50000);

  // ---- Analyse complète : salarié de 40 ans, célibataire, 90 000 fr., avoir LPP 100 000, RAMD connu
  const a = analyser({
    dateAnalyse: '2026-01-01', etatCivil: 'celibataire',
    personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 90000, avs: { ramd: 84672 }, lpp: { avoir: 100000 } },
    hypotheses: { interetLPP: 0 },
  }, r26);
  egal('Cas A âge', a.personne.age, 40);
  egal('Cas A AVS : 2439 x 13', a.risques.retraite.sources.find(s => s.cle === 'avs').montant, 31707);
  egal('Cas A LPP vieillesse : 341 452 x 6,8 %', a.risques.retraite.sources.find(s => s.cle === 'lpp').montant, 23219);
  egal('Cas A besoin retraite 80 %', a.risques.retraite.besoin, 72000);
  egal('Cas A lacune retraite', a.risques.retraite.lacune, 72000 - 31707 - 23219);
  egal('Cas A AI : RAMD majoré de 5 % -> 2500 x 12', a.risques.invaliditeMaladie.sources.find(s => s.cle === 'ai').montant, 30000);
  egal('Cas A LPP invalidité', a.risques.invaliditeMaladie.sources.find(s => s.cle === 'lpp').montant, 23219);
  egal('Cas A lacune invalidité maladie', a.risques.invaliditeMaladie.lacune, 81000 - 30000 - 23219);
  egal('Cas A rente LAA complémentaire', a.risques.invaliditeAccident.sources.find(s => s.cle === 'laa').montant, 51000);
  egal('Cas A lacune invalidité accident', a.risques.invaliditeAccident.lacune, 0);
  egal('Cas A sans proches : pas de besoin au décès', a.risques.decesMaladie.besoin, 0);
  egal('Cas A potentiel 3a', a.potentiels.pilier3a.potentiel, 7258);
  egal('Cas A alerte écart maladie / accident', a.alertes.some(x => x.cle === 'ecartMaladieAccident'), true);
  egal('Cas A chronologie de 40 à 90 ans', a.chronologie.length, 51);

  // ---- Indépendant sans 2e pilier ni LAA, en concubinage, un enfant de 3 ans
  const b = analyser({
    dateAnalyse: '2026-01-01', etatCivil: 'concubin',
    personne: { dateNaissance: '1988-06-15', sexe: 'h', statut: 'independant', revenu: 120000, avs: { ramd: 90720 } },
    conjoint: { dateNaissance: '1990-03-01', sexe: 'f', statut: 'salarie', revenu: 50000 },
    enfants: [{ dateNaissance: '2023-02-01' }],
  }, r26);
  egal('Cas B plafond 3a sans LPP : 20 % de 120 000', b.potentiels.pilier3a.plafond, 24000);
  egal('Cas B aucune rente LAA', b.risques.invaliditeAccident.sources.some(s => s.cle === 'laa'), false);
  egal('Cas B aucune rente de veuve AVS (concubinage)', b.risques.decesMaladie.sources.some(s => s.cle === 'avsConjoint'), false);
  egal('Cas B rente d’orphelin AVS : 40 % de la rente majorée', b.risques.decesMaladie.sources.find(s => s.cle === 'avsOrphelins').montant, 1008 * 12);
  for (const cle of ['concubinage', 'independantSansLPP', 'independantSansLAA', 'independantSansIJM']) {
    egal(`Cas B alerte ${cle}`, b.alertes.some(x => x.cle === cle), true);
  }
  egal('Cas B score plus bas que le cas A', b.score < a.score, true);

  // ---- Couple marié, deux rentes maximales : plafonnement à 150 %
  const c = analyser({
    dateAnalyse: '2026-01-01', etatCivil: 'marie',
    personne: { dateNaissance: '1970-01-01', sexe: 'h', statut: 'salarie', revenu: 130000, avs: { ramd: 95000 }, lpp: { avoir: 400000, renteVieillesse: 36000, renteInvalidite: 40000 } },
    conjoint: { dateNaissance: '1972-01-01', sexe: 'f', statut: 'salarie', revenu: 95000, avs: { ramd: 95000 } },
  }, r26);
  egal('Cas C AVS plafonnée : 1890 x 13', c.risques.retraite.sources.find(s => s.cle === 'avs').montant, 24570);
  egal('Cas C certificat LPP repris tel quel', c.risques.retraite.sources.find(s => s.cle === 'lpp').montant, 36000);
  egal('Cas C alerte plafonnement', c.alertes.some(x => x.cle === 'plafonnementCouple'), true);
  egal('Cas C rente de veuve AVS : 80 % de 2520', c.risques.decesMaladie.sources.find(s => s.cle === 'avsConjoint').montant, 2016 * 12);
}

/** Suite du jeu de cas : impôts par canton (données relevées auprès de l'AFC) et scénarios de conseil. */
export function casScenarios(egal, { r26, r27, i26, c26 }) {
  // ---- interpolation et grilles fiscales
  egal('Interpolation au milieu', Impots.interpoler([0, 10], [0, 100], 5), 50);
  egal('Interpolation prolongée', Impots.interpoler([0, 10, 20], [0, 100, 300], 30), 500);
  if (i26) {
    egal('Impôts : 26 cantons', Object.keys(i26.cantons).length, 26);
    const fr = Impots.impotRevenu(i26, 'FR', false, 100000);
    egal('Impôt FR, 100 000 seul = point de grille', fr.impot, i26.cantons.FR.revenu.seul[i26.revenus.indexOf(100000)][0]);
    egal('Taux marginal FR plausible (15 à 45 %)', fr.marginal > 0.15 && fr.marginal < 0.45, true);
    egal('Marié paie moins que seul (ZH, 120 000)', Impots.impotRevenu(i26, 'ZH', true, 120000).impot < Impots.impotRevenu(i26, 'ZH', false, 120000).impot, true);
    egal('Impôt croissant avec le revenu (GE)', Impots.impotRevenu(i26, 'GE', false, 150000).impot > Impots.impotRevenu(i26, 'GE', false, 100000).impot, true);
    egal('Canton inconnu', Impots.impotRevenu(i26, 'XX', false, 100000), null);
    if (c26) {
      const toutes = Object.values(c26.cantons).flat();
      egal('Communes : les 26 cantons, plus de 2000 communes', Object.keys(c26.cantons).length === 26 && toutes.length > 2000, true);
      egal('Communes : facteurs plausibles (0,3 à 2)', toutes.every(c => c.k > 0.3 && c.k < 2), true);
      egal('Communes : contrôle contre le calculateur officiel sous 5 %', c26.ecartMaxControle < 0.05, true);
      egal('Sans commune ni confession : données inchangées', Impots.localiser(i26, c26, 'VD') === i26, true);
      for (const canton of ['VD', 'ZH', 'GE', 'TI']) {
        const chef = c26.cantons[canton].find(c => c.l.some(l => l.startsWith(i26.cantons[canton].npa + ' ')));
        const ici = Impots.impotRevenu(Impots.localiser(i26, c26, canton, { commune: chef.b }), canton, false, 100000).impot;
        egal(`Chef-lieu ${canton} choisi comme commune : même impôt`, ici, Impots.impotRevenu(i26, canton, false, 100000).impot, 5);
      }
      const basse = [...c26.cantons.ZH].sort((x, y) => x.k - y.k)[0], point = i26.revenus.indexOf(100000);
      const zhBas = Impots.localiser(i26, c26, 'ZH', { commune: basse.b });
      egal('Commune la moins imposée de ZH : moins que Zurich', Impots.impotRevenu(zhBas, 'ZH', false, 100000).impot < Impots.impotRevenu(i26, 'ZH', false, 100000).impot, true);
      egal('Formule : fédéral + (chef-lieu − fédéral) × facteur', zhBas.cantons.ZH.revenu.seul[point][0],
        Math.round(c26.federal.seul[point] + (i26.cantons.ZH.revenu.seul[point][0] - c26.federal.seul[point]) * basse.k));
      egal('Le nom du lieu suit la commune', zhBas.cantons.ZH.lieu, basse.n);
      egal('Les autres cantons ne changent pas', zhBas.cantons.BE === i26.cantons.BE, true);
      egal('Impôt d’Église à Zurich (réformée) : plus que sans confession', Impots.impotRevenu(Impots.localiser(i26, c26, 'ZH', { confession: 'reformee' }), 'ZH', false, 100000).impot > Impots.impotRevenu(i26, 'ZH', false, 100000).impot, true);
      if (c26.federalCapital) {
        const j = i26.capitaux.indexOf(300000);
        egal('Capital : toutes les communes ont leur facteur', toutes.every(c => c.kc > 0.3 && c.kc < 2), true);
        egal('Capital : contrôle contre le calculateur officiel sous 5 %', c26.ecartMaxControleCapital < 0.05, true);
        egal('Capital : formule fédéral + (chef-lieu − fédéral) × facteur', zhBas.cantons.ZH.capital.seul[j],
          Math.round(c26.federalCapital.seul[j] + (i26.cantons.ZH.capital.seul[j] - c26.federalCapital.seul[j]) * basse.kc));
        egal('Capital : commune la moins imposée de ZH, moins que Zurich', Impots.impotCapital(zhBas, 'ZH', false, 300000) < Impots.impotCapital(i26, 'ZH', false, 300000), true);
      }
      egal('Les grilles avec enfants sont ajustées aussi', zhBas.cantons.ZH.revenu.marie2[point][0] < i26.cantons.ZH.revenu.marie2[point][0], true);
    }
    if (Impots.avecEnfants(i26, 'VD')) {
      const point = i26.revenus.indexOf(100000);
      egal('Impôt VD, marié, 2 enfants = point de grille', Impots.impotRevenu(i26, 'VD', true, 100000, 2).impot, i26.cantons.VD.revenu.marie2[point][0]);
      egal('Les 26 cantons ont les grilles avec enfants', Object.values(i26.cantons).every(c => ['seul1', 'seul2', 'seul3', 'marie1', 'marie2', 'marie3'].every(k => c.revenu[k]?.length === i26.revenus.length)), true);
      egal('Chaque enfant allège l’impôt, dans chaque canton (marié, 100 000)', Object.keys(i26.cantons).every(c => [1, 2, 3].every(n => Impots.impotRevenu(i26, c, true, 100000, n).impot <= Impots.impotRevenu(i26, c, true, 100000, n - 1).impot)), true);
      egal('Au-delà de trois enfants : la grille de trois', Impots.impotRevenu(i26, 'GE', true, 120000, 5).impot, Impots.impotRevenu(i26, 'GE', true, 120000, 3).impot);
      egal('Sans enfant : la grille de base est inchangée', Impots.impotRevenu(i26, 'ZH', false, 100000, 0).impot, i26.cantons.ZH.revenu.seul[point][0]);
      const famille = analyser({ dateAnalyse: '2026-01-01', canton: 'VD', etatCivil: 'marie', enfants: [{ dateNaissance: '2018-01-01' }, { dateNaissance: '2020-01-01' }],
        personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 100000, lpp: { avoir: 100000 } } }, r26, { impots: i26 });
      egal('Analyse : l’impôt tient compte des deux enfants', famille.potentiels.impotRevenu, i26.cantons.VD.revenu.marie2[point][0]);
    }
    egal('Capital : point de grille VD 300 000', Impots.impotCapital(i26, 'VD', false, 300000), Math.round(i26.cantons.VD.capital.seul[i26.capitaux.indexOf(300000)] / 10) * 10);
    egal('Capital nul', Impots.impotCapital(i26, 'VD', false, 0), 0);
    const ech = Impots.retraitsEchelonnes(i26, 'BE', false, [100000, 100000, 100000]);
    egal('Retraits échelonnés moins imposés qu’un retrait unique', ech.echelonne < ech.unique && ech.economie > 0, true);
    const rachats = Impots.rachatEchelonne(i26, 'VD', false, 120000, 60000);
    egal('Rachat échelonné : 5 variantes', rachats.length, 5);
    egal('Rachat sur 3 ans au moins aussi avantageux qu’en une fois', rachats[2].economie >= rachats[0].economie, true);
    egal('Économie d’une déduction nulle', Impots.economieDeduction(i26, 'VD', false, 100000, 0), 0);
    // l'analyse reprend le barème du canton
    const a = analyser({ dateAnalyse: '2026-01-01', canton: 'VD', personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 90000, lpp: { avoir: 100000 } } }, r26, { impots: i26 });
    egal('Analyse : canton repris', a.potentiels.canton, 'VD');
    egal('Analyse : économie 3a selon le barème', a.potentiels.pilier3a.economieImpot, Impots.economieDeduction(i26, 'VD', false, 90000, 7258));
    const rc = Scenarios.renteOuCapital({ capital: 400000, tauxConversion: 0.06, autresRentes: 30000, ageRetraite: 65, canton: 'VD', marie: false }, i26);
    egal('Rente ou capital : trois options', rc.options.length, 3);
    egal('Tout en rente : aucun impôt sur le capital', rc.options[0].impotCapital, 0);
    egal('Tout en capital : aucune rente', rc.options[2].rente, 0);
    egal('Capital net = capital - impôt', rc.options[2].capitalNet, 400000 - rc.options[2].impotCapital);
    egal('Seuil de rentabilité après la retraite', rc.seuilRentabilite > 65 && rc.seuilRentabilite < 100, true);
  }
  // ---- âge de départ
  const dossier = { dateAnalyse: '2026-01-01', personne: { dateNaissance: '1976-01-01', sexe: 'h', statut: 'salarie', revenu: 100000, avs: { ramd: 90720 }, lpp: { avoir: 300000 } } };
  const ages = Scenarios.agesDeDepart(dossier, r26, [63, 64, 65, 66]);
  egal('Départ à 65 ans : AVS 2520 x 13', ages[2].avs, 32760);
  egal('Départ à 63 ans : AVS réduite de 13,6 %', ages[0].avs, Math.round(32760 * 0.864));
  egal('Départ à 66 ans : AVS majorée de 5,2 %', ages[3].avs, Math.round(32760 * 1.052));
  egal('Plus on part tard, plus la rente LPP est haute', ages[0].lpp < ages[1].lpp && ages[1].lpp < ages[2].lpp && ages[2].lpp < ages[3].lpp, true);
  egal('Pont AVS avant 63 ans', Scenarios.agesDeDepart(dossier, r26, [61])[0].pontAVS, 2);
  // ---- simulation de placement
  const s1 = Scenarios.simulerPlacement({ capital: 10000, versement: 7000, annees: 20, rendement: 0.03, volatilite: 0.1 });
  const s2 = Scenarios.simulerPlacement({ capital: 10000, versement: 7000, annees: 20, rendement: 0.03, volatilite: 0.1 });
  egal('Simulation reproductible', s1[20].p50, s2[20].p50);
  egal('Centiles ordonnés', s1[20].p10 < s1[20].p50 && s1[20].p50 < s1[20].p90, true);
  egal('Total versé', s1[20].verse, 150000);
  egal('Sans volatilité, la médiane suit l’intérêt composé', Scenarios.simulerPlacement({ capital: 100000, versement: 0, annees: 10, rendement: 0.02, volatilite: 0 })[10].p50, 121900);
  // ---- hypothèque
  const h = Scenarios.chargeHypothecaire({ valeur: 1000000, dette: 600000, revenu: 90000 });
  egal('Hypothèque : charge théorique 5 % + 1 %', h.charge, 40000);
  egal('Hypothèque : non tenable à 44 %', h.tenable, false);
  egal('Hypothèque : dette maximale', h.detteMax, 400000);
  egal('Hypothèque : amortissement nécessaire', h.amortissement, 200000);
  egal('Hypothèque tenable', Scenarios.chargeHypothecaire({ valeur: 800000, dette: 300000, revenu: 90000 }).tenable, true);
  // ---- plan de mesures
  const famille = { dateAnalyse: '2026-01-01', etatCivil: 'marie',
    personne: { dateNaissance: '1988-01-01', sexe: 'h', statut: 'salarie', revenu: 110000, lpp: { avoir: 90000, rachatPossible: 40000 }, ijm: { assure: true } },
    conjoint: { dateNaissance: '1990-01-01', sexe: 'f', statut: 'salarie', revenu: 40000 }, enfants: [{ dateNaissance: '2021-05-01' }] };
  const plan = Scenarios.proposerPlan(famille, r26);
  egal('Plan : la couverture progresse', plan.apres.score >= plan.avant.score, true);
  egal('Plan : plus de lacune d’invalidité', plan.apres.risques.invaliditeMaladie.lacune, 0);
  egal('Plan : plus de lacune au décès', plan.apres.risques.decesMaladie.lacune, 0);
  egal('Plan : la lacune de retraite recule', plan.apres.risques.retraite.lacune < plan.avant.risques.retraite.lacune, true);
  egal('Plan : 3a dans la limite du plafond', (plan.mesures.versement3a ?? 0) <= 7258, true);
  egal('Mesures : le dossier d’origine n’est pas modifié', famille.personne.lpp.avoir, 90000);
  // ---- décès : les capitaux disponibles comptent comme un revenu
  const seul = analyser({ dateAnalyse: '2026-01-01', etatCivil: 'marie', personne: { dateNaissance: '1980-01-01', sexe: 'h', statut: 'salarie', revenu: 100000, fortune: 200000 },
    conjoint: { dateNaissance: '1980-01-01', sexe: 'f', statut: 'sans', revenu: 0 } }, r26);
  egal('Décès : la fortune devient une source', seul.risques.decesMaladie.sources.some(s => s.cle === 'capitaux' && s.montant > 0), true);

  // ---- lecture d'un certificat de prévoyance (textes fictifs, tels que les rend un scan)
  egal('Montants : formats suisses', Certificat.montants("CHF 148'000.00 et 1 234.50 ou 62’000.–"), [148000, 1234.5, 62000]);
  egal('Montants : ni pour-cent, ni date, ni numéro AVS', Certificat.montants('Taux 6.8 % au 31.12.2026, AVS 756.1234.5678.97'), []);
  const fr = Certificat.extraire(["Caisse de pension Exemple — Certificat de prévoyance au 01.01.2026", "Assuré : Exemple Marie   N° AVS 756.1234.5678.97",
    "Salaire annuel annoncé                 104'000.00", "Avoir de vieillesse au 01.01.2026      148'250.35", "Rente de vieillesse annuelle à 65 ans   2'795.00   33'540.00",
    "Taux de conversion 6.00 %", "Rente d'invalidité annuelle             41'600.00", "Rente de conjoint", "24'960.00", "Capital décès                          50'000.00",
    "Rachat maximal possible                62'000.00"].join('\n')).champs;
  egal('Certificat FR : avoir de vieillesse', fr.lppAvoir.valeur, 148250);
  egal('Certificat FR : rente annuelle, pas la mensuelle', fr.lppRenteVieillesse.valeur, 33540);
  egal('Certificat FR : rente d’invalidité', fr.lppRenteInvalidite.valeur, 41600);
  egal('Certificat FR : montant sur la ligne suivante', fr.lppRenteConjoint.valeur, 24960);
  egal('Certificat FR : capital décès, rachat, salaire', [fr.lppCapitalDeces.valeur, fr.lppRachat.valeur, fr.revenu.valeur], [50000, 62000, 104000]);
  egal('Certificat FR : la ligne lue est conservée', fr.lppAvoir.ligne.includes('Avoir de vieillesse'), true);
  const de = Certificat.extraire("Vorsorgeausweis per 01.01.2026\nGemeldeter Jahreslohn CHF 96'000.00\nAltersguthaben CHF 210'400.00\nAltersrente mit 65 CHF 38'120.00\n"
    + "Invalidenrente CHF 38'400.00\nEhegattenrente CHF 23'040.00\nTodesfallkapital CHF 0.00\nMaximale Einkaufssumme CHF 18'500.00").champs;
  egal('Certificat DE', [de.lppAvoir.valeur, de.lppRenteVieillesse.valeur, de.lppRenteInvalidite.valeur, de.lppRenteConjoint.valeur, de.lppRachat.valeur, de.revenu.valeur],
    [210400, 38120, 38400, 23040, 18500, 96000]);
  egal('Certificat IT', Certificat.extraire("Avere di vecchiaia 88'000.00\nRendita annua di vecchiaia 19'300.00").champs.lppRenteVieillesse.valeur, 19300);
  egal('Texte sans rapport : rien de proposé', Object.keys(Certificat.extraire('Facture n° 2026-118\nTotal 1 250.00').champs), []);
  // ---- conseil personnalisé : déduit du dossier, dans l'ordre d'un conseiller
  {
  const menage = { dateAnalyse: '2026-01-01', canton: 'VD', etatCivil: 'marie', enfants: [{ dateNaissance: '2019-01-01' }],
    personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 110000, avs: { anneesManquantes: 2 }, lpp: { avoir: 90000, rachatPossible: 40000 } },
    conjoint: { dateNaissance: '1988-01-01', sexe: 'f', statut: 'sans', revenu: 0 } };
  const plan = Scenarios.proposerPlan(menage, r26), conseil = Conseil.rediger(plan.avant, plan.mesures, plan.apres);
  const cles = conseil.points.map(p => p.cle), rangs = conseil.points.map(p => Conseil.URGENCES.indexOf(p.urgence));
  egal('Conseil : les risques avant la retraite, les pièces à la fin', rangs.every((x, i) => i === 0 || rangs[i - 1] <= x), true);
  egal('Conseil : chaque lacune a sa recommandation', ['cs_invalidite', 'cs_deces', 'cs_retraite'].filter(c => !cles.includes(c)),
    [plan.avant.risques.invaliditeMaladie.lacune > 0 || plan.avant.risques.invaliditeAccident.lacune > 0 ? null : 'cs_invalidite',
      plan.avant.risques.decesMaladie.capital > 0 || plan.avant.risques.decesAccident.capital > 0 ? null : 'cs_deces', plan.avant.risques.retraite.lacune > 0 ? null : 'cs_retraite'].filter(Boolean));
  const troisA = conseil.points.find(p => p.cle === 'cs_3a');
  egal('Conseil : le versement 3a est celui du plan', troisA?.v.montantChf, plan.mesures.versement3a);
  egal('Conseil : l’économie d’impôt ne dépasse pas celle du potentiel entier', troisA.v.economieChf <= plan.avant.potentiels.pilier3a.economieImpot, true);
  egal('Conseil : années AVS manquantes signalées', conseil.points.find(p => p.cle === 'cs_anneesAVS')?.v.annees, 2);
  egal('Conseil : pièces à réunir quand des valeurs sont estimées', cles.includes('cs_extraitCI'), true);
  egal('Conseil : le résumé compte les lacunes avant et après', [conseil.resume.v.lacunes > 0, conseil.resume.v.apres >= conseil.resume.v.avant], [true, true]);
  const serein = { dateAnalyse: '2026-01-01', etatCivil: 'celibataire', personne: { dateNaissance: '1975-01-01', sexe: 'h', statut: 'salarie', revenu: 60000, ramd: 60000,
    lpp: { avoir: 900000, renteVieillesse: 60000, renteInvalidite: 54000 }, ijm: { assure: true } } };
  const p2 = Scenarios.proposerPlan(serein, r26), c2 = Conseil.rediger(p2.avant, p2.mesures, p2.apres);
  egal('Conseil : dossier couvert, aucune recommandation de risque', [c2.resume.cle, c2.points.filter(p => p.urgence === 'maintenant').length], ['cs_resumeCouvert', 0]);
  }
  // ---- contrôle du 06.10.2026 : chaque correction a son cas, calculé à la main
  {
    const base = { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 90000, avs: { ramd: 90720 }, lpp: { avoir: 100000 } };
    const a = age => analyser({ dateAnalyse: '2026-01-01', etatCivil: 'celibataire', personne: base, hypotheses: { ageRetraite: age } }, r26);
    const de = (x, cle) => x.risques.retraite.sources.find(s => s.cle === cle)?.montant ?? 0;
    // AVS : 2520 x 13 à 65 ans ; anticipée de 2 ans au plus (-13,6 %) ; ajournée de 3 ans (+17,1 %)
    egal('Départ à 65 ans : AVS entière', de(a(65), 'avs'), 32760);
    egal('Départ à 63 ans : AVS réduite de 13,6 %', de(a(63), 'avs'), 28305);
    egal('Départ à 62 ans : AVS dès 63 ans seulement, une année de pont', [de(a(62), 'avs'), a(62).personne.pontAVS, a(62).personne.debutAVS], [28305, 1, 63]);
    egal('Départ à 62 ans : pas d’AVS dans la ligne de vie à 62 ans', a(62).chronologie.find(x => x.age === 62).pilier1, 0);
    egal('Départ à 62 ans : alerte de pont', a(62).alertes.some(x => x.cle === 'pontAVS'), true);
    egal('Départ à 68 ans : AVS majorée de 17,1 %', de(a(68), 'avs'), 38362);
    // LPP art. 24 : la rente d'invalidité ne dépend pas de l'âge de départ (100 000 + bonifications sans intérêt jusqu'à 65 ans)
    egal('Rente d’invalidité LPP identique à 60, 65 et 70 ans', [a(60), a(65), a(70)].map(x => x.personne.lpp.renteInvalidite), [23219, 23219, 23219]);
    egal('Lacune d’invalidité comptée jusqu’à 65 ans, même pour un départ à 60', a(60).risques.invaliditeMaladie.annees, 25);
    // LPP : pas de bonification après 65 ans ; rente plus basse avant, plus haute après
    egal('Rente LPP : plus basse à 63 ans, plus haute à 68', [de(a(63), 'lpp') < de(a(65), 'lpp'), de(a(68), 'lpp') > de(a(65), 'lpp')], [true, true]);
    // certificat : la rente saisie est ajustée, pas remplacée par le minimum légal
    const cert = { dateAnalyse: '2026-01-01', etatCivil: 'celibataire', personne: { dateNaissance: '1976-01-01', sexe: 'h', statut: 'salarie', revenu: 100000, lpp: { renteVieillesse: 36000 } } };
    const ages = Scenarios.agesDeDepart(cert, r26, [64, 65, 66]);
    egal('Âge de départ : rente du certificat reprise à 65 ans', ages[1].lpp, 36000);
    egal('Âge de départ : pas de falaise à 64 ans (certificat ajusté)', [ages[0].lpp > 30000, ages[0].lpp < 36000, ages[2].lpp > 36000], [true, true, true]);
    // femme née en 1962 : référence à 64 ans et 6 mois
    const f62 = Scenarios.agesDeDepart({ dateAnalyse: '2026-01-01', etatCivil: 'celibataire', personne: { ...base, dateNaissance: '1962-03-01', sexe: 'f' } }, r26, [62, 63]);
    egal('Femme de 1962 (génération transitoire) : AVS possible dès 62 ans, sans pont', [f62[0].pontAVS, f62[1].pontAVS], [0, 0]);
    // AVS 21 : RAMD 60 480 = classe la plus basse ; née en 1965 : supplément entier de 160 fr. ; anticipation de 2 ans : -2 %
    const f65 = age => analyser({ dateAnalyse: '2026-01-01', etatCivil: 'celibataire', hypotheses: { ageRetraite: age },
      personne: { ...base, dateNaissance: '1965-03-01', sexe: 'f', avs: { ramd: 60480 } } }, r26).risques.retraite.sources;
    egal('Femme de 1965 à 65 ans : rente 2117 x 13 et supplément de 160 x 12', ['avs', 'avsSupplement'].map(c => f65(65).find(s => s.cle === c)?.montant), [27521, 1920]);
    egal('Femme de 1965 à 63 ans : réduction de 2 % seulement, pas de supplément', [f65(63).find(s => s.cle === 'avs').montant, f65(63).some(s => s.cle === 'avsSupplement')], [26971, false]);
    egal('AVS 21 : classes de revenu et échelonnement', [AVS.generationTransitoire(r26, 'f', 1966, 70000).supplementMensuel, AVS.generationTransitoire(r26, 'f', 1961, 100000).supplementMensuel,
      AVS.generationTransitoire(r26, 'h', 1965, 60000), AVS.generationTransitoire(r26, 'f', 1970, 60000)], [81, 13, null, null]);
    // rachat rétroactif 3a : une année ouverte en 2026 (2025), deux en 2027 ; plafonné à un petit plafond par an
    const p3 = (regles, extra = {}) => analyser({ dateAnalyse: `${regles.annee}-01-01`, etatCivil: 'celibataire', personne: { ...base, ...extra } }, regles).potentiels.pilier3a.retroactif;
    egal('Rachat 3a 2026 : lacune estimée d’une année, rachat du petit plafond', [p3(r26).possible, p3(r26).anneesOuvertes, p3(r26).estime], [7258, 1, true]);
    egal('Rachat 3a : lacune connue de 3000', p3(r26, { lacune3a: 3000 }).possible, 3000);
    egal('Rachat 3a 2027 : deux années ouvertes, un seul plafond par an', [p3(r27).anneesOuvertes, p3(r27).possible], [2, r27.pilier3a.rachatRetroactif.plafondParRachat]);
    // âge LPP : né en décembre 1981, analysé en janvier 2026 : 44 ans révolus mais 45 ans au sens de la LPP (15 %)
    egal('Âge LPP en année civile : bonification de 15 % dès l’année des 45 ans', analyser({ dateAnalyse: '2026-01-01',
      personne: { ...base, dateNaissance: '1981-12-15', lpp: { avoir: 0 } } }, r26).personne.lpp.projection[0].bonification, Math.round(63540 * 0.15));
    egal('Femme de 1962 : alertes de la génération transitoire', ['generationTransitoire', 'supplementTransitoire'].map(c =>
      analyser({ dateAnalyse: '2026-01-01', personne: { ...base, dateNaissance: '1962-03-01', sexe: 'f' } }, r26).alertes.some(x => x.cle === c)), [true, true]);
    // enfants : la rente s'éteint, la lacune grandit, le capital additionne les années
    const famille = enfants => analyser({ dateAnalyse: '2026-01-01', etatCivil: 'marie', enfants,
      personne: { ...base, avs: { ramd: 84672 } }, conjoint: { dateNaissance: '1988-01-01', sexe: 'f', statut: 'sans', revenu: 0 } }, r26).risques.invaliditeMaladie;
    const avec = famille([{ dateNaissance: '2016-01-01' }]), sans = famille([]);
    egal('Invalidité avec un enfant de 10 ans : la lacune d’aujourd’hui est plus petite que celle d’après ses 25 ans', [avec.lacune < sans.lacune, avec.lacuneMax], [true, sans.lacune]);
    egal('Invalidité avec un enfant : capital entre « lacune d’aujourd’hui » et « sans enfant »',
      [avec.capitalRente > Math.round(avec.lacune * 20), avec.capitalRente < sans.capitalRente], [true, true]);
    egal('Invalidité sans enfant : capital inchangé (rente constante)', Math.abs(sans.capitalRente - sans.lacune * (1 - Math.pow(1.015, -25)) / 0.015 * Math.sqrt(1.015)) < 60, true);
    // conjoint survivant
    const deces = (sexe, conjoint, enfants = []) => analyser({ dateAnalyse: '2026-01-01', etatCivil: 'marie', enfants,
      personne: { ...base, sexe, dateNaissance: '1976-01-01' }, conjoint }, r26).risques.decesMaladie.sources;
    const rente = (sources, cle) => sources.find(s => s.cle === cle)?.montant ?? 0;
    const mari50 = { dateNaissance: '1975-06-01', sexe: 'h', statut: 'salarie', revenu: 60000 }, femme50 = { ...mari50, sexe: 'f' }, femme40 = { ...femme50, dateNaissance: '1985-06-01' };
    egal('Décès de l’épouse, veuf de 50 ans sans enfant : pas de rente AVS', rente(deces('f', mari50), 'avsConjoint'), 0);
    egal('Décès du mari, veuve de 50 ans sans enfant : rente AVS de veuve', rente(deces('h', femme50), 'avsConjoint') > 20000, true);
    egal('Veuve de 40 ans avec un enfant adulte : rente AVS de veuve', rente(deces('h', femme40, [{ dateNaissance: '1998-01-01' }]), 'avsConjoint') > 20000, true);
    egal('Veuf avec un enfant mineur : rente AVS de veuf', rente(deces('f', mari50, [{ dateNaissance: '2015-01-01' }]), 'avsConjoint') > 20000, true);
    const jeune = analyser({ dateAnalyse: '2026-01-01', etatCivil: 'marie', personne: { ...base, lpp: { avoir: 100000, renteConjoint: 12000 } }, conjoint: femme40 }, r26).risques.decesMaladie;
    egal('LPP, veuve de 40 ans sans enfant : allocation de trois rentes annuelles au lieu de la rente', [rente(jeune.sources, 'lpp'), jeune.capitauxDisponibles], [0, 36000]);
  }
  {
    // le plan comble la retraite même quand le 3a est imposé à son retrait, et couvre la lacune d'après les rentes d'enfants
    const foyer = { dateAnalyse: '2026-01-01', canton: 'VD', etatCivil: 'marie', enfants: [{ dateNaissance: '2018-01-01' }, { dateNaissance: '2020-01-01' }],
      personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 100000, lpp: { avoir: 100000 } },
      conjoint: { dateNaissance: '1988-01-01', sexe: 'f', statut: 'sans', revenu: 0 } };
    const plan = Scenarios.proposerPlan(foyer, r26, { impots: i26 });
    egal('Plan avec impôts : la lacune de retraite est comblée', [plan.avant.risques.retraite.lacune > 0, plan.apres.risques.retraite.lacune], [true, 0]);
    egal('Plan : la rente d’invalidité proposée couvre la plus grande lacune à venir', (plan.mesures.renteInvalidite ?? 0) >= Math.max(plan.avant.risques.invaliditeMaladie.lacuneMax, plan.avant.risques.invaliditeAccident.lacuneMax), true);
    const conseil = Conseil.rediger(plan.avant, plan.mesures, plan.apres);
    egal('Conseil : après le plan, plus aucun risque ouvert et un score de 100', [conseil.resume.v.restantes, plan.apres.score], [0, 100]);
    egal('Conseil : le texte du décès ne dit jamais « 0 par mois » quand un capital est proposé',
      conseil.points.filter(p => p.cle === 'cs_deces').every(p => p.v.mensuelChf > 0), true);
  }
  {
    // relecture du 06.10.2026
    const base = { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 90000, avs: { ramd: 90720 }, lpp: { avoir: 100000 } };
    const a = (age, personne = base) => analyser({ dateAnalyse: '2026-01-01', etatCivil: 'celibataire', personne, hypotheses: { ageRetraite: age } }, r26);
    // pont : départ à 60 ans, AVS (28 305) dès 63 ans : trois années à financer, comptées dans le capital
    const pont = a(60).risques.retraite;
    egal('Départ à 60 ans : trois années de pont comptées dans le capital de retraite', [a(60).personne.pontAVS, pont.capitalPont > 80000, pont.capitalPont < 85000, pont.capital >= pont.capitalRente + pont.capitalPont - 100],
      [3, true, true, true]);
    // âge de départ dépassé : une personne de 63 ans ne part pas à 60
    const age63 = a(60, { ...base, dateNaissance: '1962-06-01' });
    egal('Âge de départ inférieur à l’âge actuel : ramené à l’âge actuel, sans pont', [age63.personne.ageRetraite, age63.personne.pontAVS], [63, 0]);
    // certificat sans avoir : -1 an = environ -3,4 % d'avoir et -0,2 point de conversion
    const cert = Scenarios.agesDeDepart({ dateAnalyse: '2026-01-01', etatCivil: 'celibataire',
      personne: { dateNaissance: '1976-01-01', sexe: 'h', statut: 'salarie', revenu: 100000, lpp: { renteVieillesse: 36000 } } }, r26, [64, 65]);
    egal('Certificat sans avoir, départ à 64 ans : rente d’environ 33 750', Math.abs(cert[0].lpp - 33750) < 250, true);
    egal('Certificat sans avoir : l’avoir de retraite est celui que la rente suppose', Math.abs(a(65, { ...base, lpp: { renteVieillesse: 36000 } }).personne.lpp.avoirRetraite - 529412) <= 1, true);
    // AVS 21 : supplément réduit selon l'échelle (34/44 de 160 = 124) ; six mois d'anticipation = moitié du taux d'un an
    egal('AVS 21 : supplément réduit avec une durée de cotisation incomplète', AVS.generationTransitoire(r26, 'f', 1965, 50000, 34).supplementMensuel, 124);
    const f62 = a(64, { ...base, dateNaissance: '1962-03-01', sexe: 'f', avs: { ramd: 100000 } });
    egal('Femme de 1962, départ à 64 ans (6 mois d’anticipation, classe haute) : réduction de 1,75 %', Math.abs(f62.personne.facteurAVS - 0.9825) < 1e-9, true);
    egal('AVS ajournement d’un an et demi : entre 5,2 et 10,8 %', AVS.facteurFlexibilisation(r26, 1.5), 1.08, 1e-9);
    egal('AVS ajournement de moins d’un an : aucun supplément', AVS.facteurFlexibilisation(r26, 0.5), 1);
    // conjoint : sa rente LPP ne dépend pas de l'âge de départ de la personne analysée
    const couple = age => analyser({ dateAnalyse: '2026-01-01', etatCivil: 'marie', hypotheses: { ageRetraite: age }, personne: base,
      conjoint: { dateNaissance: '1988-01-01', sexe: 'f', statut: 'salarie', revenu: 70000, lpp: { avoir: 60000 } } }, r26).conjoint.lppRente;
    egal('Conjoint : rente LPP identique quel que soit l’âge de départ de la personne', couple(60), couple(68));
    // parcours d'invalidité : rentes jusqu'à 65 ans même pour un départ prévu à 60
    const ligne = a(60).chronologie.find(x => x.age === 62);
    egal('Ligne de vie, départ à 60 ans : à 62 ans, l’invalide touche encore ses rentes d’invalidité', ligne.invaliditeMaladie, a(60).risques.invaliditeMaladie.total);
    // marié, conjoint non saisi : une durée de besoin et un capital cohérents
    const seul = analyser({ dateAnalyse: '2026-01-01', etatCivil: 'marie', personne: base }, r26).risques.decesMaladie;
    egal('Marié sans conjoint saisi : la lacune de décès a une durée et un capital', [seul.annees > 0, seul.lacune > 0 ? seul.capital > 0 : true], [true, true]);
  }
  {
    // retrait pour le logement (LPP art. 30c) et couple à deux salaires
    const e = Scenarios.retraitLogement({ avoir: 200000, age: 45, montant: 80000 }, r26);
    egal('Logement, 45 ans : tout l’avoir est disponible ; 80 000 retirés coûtent 80 000 x 1,0125^20 d’avoir et 6,8 % de rente',
      [e.possible, e.maximum, e.montant, e.avoirRetraiteEnMoins, e.renteEnMoins], [true, 200000, 80000, Math.round(80000 * Math.pow(1.0125, 20)), Math.round(Math.round(80000 * Math.pow(1.0125, 20)) * 0.068)]);
    egal('Logement, 55 ans : la moitié de l’avoir, ou l’avoir à 50 ans s’il est plus grand', [Scenarios.retraitLogement({ avoir: 300000, age: 55 }, r26).maximum,
      Scenarios.retraitLogement({ avoir: 300000, age: 55, avoirA50: 220000 }, r26).maximum], [150000, 220000]);
    egal('Logement : minimum de 20 000 et délai de trois ans avant la retraite', [Scenarios.retraitLogement({ avoir: 15000, age: 40 }, r26).raison,
      Scenarios.retraitLogement({ avoir: 300000, age: 63 }, r26).raison, Scenarios.retraitLogement({ avoir: 100000, age: 40, montant: 5000 }, r26).montant], ['sousMinimum', 'tropTard', 20000]);
    const fiscal = Scenarios.retraitLogement({ avoir: 200000, age: 45, montant: 100000, canton: 'VD', marie: false }, r26, i26);
    egal('Logement : impôt du retrait selon le barème du canton (100 000 à Lausanne)', [fiscal.impot, fiscal.net], [Impots.impotCapital(i26, 'VD', false, 100000), 100000 - Impots.impotCapital(i26, 'VD', false, 100000)]);
    if (i26.cantons.VD.revenu.marieDeux50) {
      const un = Impots.impotRevenu(i26, 'VD', true, 100000).impot, vd = i26.cantons.VD.revenu;
      egal('Couple à deux salaires égaux (VD, 100 000) : l’impôt relevé pour 50/50', Impots.impotRevenu(i26, 'VD', true, 100000, 0, 0.5).impot, vd.marieDeux50[8]);
      egal('Couple, second salaire de 20 % : l’impôt relevé pour 80/20', Impots.impotRevenu(i26, 'VD', true, 100000, 0, 0.2).impot, vd.marieDeux20[8]);
      egal('Couple, second salaire de 10 % : à mi-chemin entre un salaire et 80/20', Impots.impotRevenu(i26, 'VD', true, 100000, 0, 0.1).impot, Math.round((un + vd.marieDeux20[8]) / 2), 1);
      egal('Couple à un seul salaire : inchangé', Impots.impotRevenu(i26, 'VD', true, 100000, 0, 0).impot, vd.marie[8][0]);
      const couple = c => analyser({ dateAnalyse: '2026-01-01', canton: 'VD', etatCivil: 'marie', personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 60000 },
        conjoint: { dateNaissance: '1988-01-01', sexe: 'f', statut: c > 0 ? 'salarie' : 'sans', revenu: c } }, r26, { impots: i26 }).potentiels.impotRevenu;
      egal('Analyse : un couple 60 000 + 40 000 paie moins d’impôt que le barème à un salaire de 100 000', couple(40000) < Impots.impotRevenu(i26, 'VD', true, 100000).impot, true);
    }
  }
  egal('AVS plafond couple, échelles 44 et 30 (RAVS art. 53bis : 2 x 44 + 30, sur 3)', AVS.plafonnerCouple(r26, 2520, 1718, 44, 30), [2009, 1370]);
  egal('Économie d’impôt estimée d’un rachat de 200 000 sur 100 000 de revenu : bornée par les paliers', Analyse.economieEstimee(100000, 200000), 17600);
  egal('Économie d’impôt estimée d’une petite déduction : taux du palier', Analyse.economieEstimee(100000, 7258), 2030);
  egal('Échelle bernoise : 3 mois dès la 5e année, 4 mois dès la 10e', [5, 10].map(n => r26.maladie.echelleBernoise.filter(([an]) => n >= an).pop()[1]), [13, 17]);
  egal('Champs d’un modèle de langage : contrôlés et bornés', Certificat.normaliser({ lppAvoir: 148250.4, lppRenteVieillesse: 12, lppRachat: null, autre: 5 }),
    { lppAvoir: { valeur: 148250, ligne: '' } });

  // ---- feuille de route : homme né le 15.06.1980, analysé le 01.01.2026 (45 ans), salarié affilié, sans 3a
  const quadra = { dateAnalyse: '2026-01-01', etatCivil: 'celibataire',
    personne: { dateNaissance: '1980-06-15', sexe: 'h', statut: 'salarie', revenu: 100000, lpp: { avoir: 150000, rachatPossible: 30000 } } };
  const route = Vie.feuilleDeRoute(quadra, r26), etape = cle => route.find(e => e.cle === cle);
  egal('Feuille de route : échéances dans l’ordre', route.map(e => e.cle),
    ['versement3a', 'logementEntier', 'anticipationLPP', 'retrait3a', 'rachatDernier', 'logementDernier', 'anticipationAVS', 'renteAVS', 'ajournementFin']);
  egal('Feuille de route : années (1980 + 50, 58, 60, 62, 62, 63, 65, 70)', route.map(e => e.annee), [2026, 2030, 2038, 2040, 2042, 2042, 2043, 2045, 2050]);
  egal('Feuille de route : 3a de l’année = plafond entier', etape('versement3a').v.montant, 7258);
  egal('Feuille de route : rente AVS dès le mois qui suit les 65 ans (juillet 2045)', [etape('renteAVS').v.anneeRente, etape('renteAVS').v.mois], [2045, 7]);
  const dame = cle => Vie.feuilleDeRoute({ dateAnalyse: '2026-01-01', etatCivil: 'celibataire',
    personne: { dateNaissance: '1962-03-10', sexe: 'f', statut: 'salarie', revenu: 70000 } }, r26).find(e => e.cle === cle);
  egal('Feuille de route : femme née en mars 1962, 64 ans et 6 mois en septembre 2026, rente dès octobre', [dame('renteAVS').annee, dame('renteAVS').v.mois], [2026, 10]);
  egal('Feuille de route : une échéance passée n’est plus montrée (anticipation à 62 ans, en 2024)', dame('anticipationAVS'), undefined);
  egal('Feuille de route : fin d’ajournement cinq ans après l’âge de référence (1962 + 69)', dame('ajournementFin').annee, 2031);
  const decembre = Vie.feuilleDeRoute({ dateAnalyse: '2026-01-01', personne: { dateNaissance: '1961-12-05', sexe: 'h', statut: 'salarie', revenu: 80000 } }, r26).find(e => e.cle === 'renteAVS');
  egal('Feuille de route : 65 ans en décembre 2026, rente dès janvier 2027', [decembre.annee, decembre.v.mois], [2027, 1]);

  // ---- coût de l'attente : 7 258 par an pendant 20 ans à 2 % ; chaque année perdue coûte le versement capitalisé
  const attente = Vie.coutAttente(quadra, r26);
  egal('Attente : versement étudié et durée', [attente.versement, attente.annees], [7258, 20]);
  egal('Attente : capital si l’on commence maintenant (7 258 x 24,2974)', attente.capital, 176400);
  egal('Attente : capital perdu en attendant 1, 3 et 5 ans', attente.reports.map(r => r.capitalPerdu), [10600, 31100, 50800]);
  egal('Attente : économie d’impôt perdue (2 030 par an)', attente.reports.map(r => r.impotsPerdus), [2030, 6090, 10150]);
  egal('Attente : un an de retard = environ 42 francs de rente par mois en moins', attente.reports[0].renteMensuelle, 42, 1);
  egal('Attente : sans potentiel 3a, rien à chiffrer', Vie.coutAttente({ dateAnalyse: '2026-01-01', personne: { dateNaissance: '1980-06-15', sexe: 'h', statut: 'sans', revenu: 0 } }, r26).applicable, false);

  // ---- test de résistance : un seul paramètre change à la fois
  const tenue = Vie.resistance(famille, r26), choc = cle => tenue.chocs.find(c => c.cle === cle);
  const avantFamille = analyser(famille, r26);
  egal('Résistance : la base est l’analyse du dossier', tenue.base.lacune, avantFamille.risques.retraite.lacune);
  egal('Résistance : train de vie à 90 % = 10 % du revenu en plus à trouver (11 000)', choc('trainDeVie').lacune - tenue.base.lacune, 11000, 1);
  egal('Résistance : un point de conversion en moins = 1 % de l’avoir de retraite en moins', choc('conversion').lacune - tenue.base.lacune,
    avantFamille.personne.lpp.avoirRetraite * 0.01, 2);
  egal('Résistance : départ deux ans plus tôt = le scénario « âge de départ » à 63 ans', choc('depart').lacune, Scenarios.agesDeDepart(famille, r26, [63])[0].lacune);
  egal('Résistance : vivre cinq ans de plus demande plus de capital', choc('longevite').capital > tenue.base.capital, true);
  egal('Résistance : sans 3e pilier, le choc de rendement ne s’applique pas', [choc('rendement').applicable, choc('rendement').lacune], [false, tenue.base.lacune]);
  egal('Résistance : le dossier d’origine n’est pas modifié', [famille.hypotheses, famille.besoins, famille.personne.lpp.tauxConversion], [undefined, undefined, undefined]);

  // ---- comparaison d'offres : la rente et le capital du plan proposé comblent les risques de la famille
  const R = plan.mesures.renteInvalidite, K = plan.mesures.capitalDeces ?? 0;
  const duel = Scenarios.comparerOffres(famille, r26, [{ prime: 1800, renteInvalidite: R, capitalDeces: K }, { prime: 1200, renteInvalidite: R / 2, capitalDeces: K }]);
  egal('Offres : celle du plan comble les risques, la demi-rente laisse une lacune', [duel.offres[0].couvre, duel.offres[1].couvre, duel.offres[1].lacuneInvalidite > 0], [true, false, true]);
  egal('Offres : on retient celle qui comble, même plus chère', duel.meilleure, 0);
  egal('Offres : à couverture égale, la moins chère', Scenarios.comparerOffres(famille, r26, [{ prime: 1800, renteInvalidite: R, capitalDeces: K }, { prime: 1500, renteInvalidite: R, capitalDeces: K }]).meilleure, 1);
  const large = Scenarios.comparerOffres(famille, r26, [{ prime: 2400, renteInvalidite: R + 6000, capitalDeces: K }]);
  egal('Offres : rente au-delà du besoin = rente offerte moins la plus grande lacune', large.offres[0].excedentRente, R + 6000 - large.avant.lacuneInvalidite, 1);
  egal('Offres : une seule offre saisie, pas de préférence', large.meilleure, null);
  egal('Offres : une offre vide ne change rien', Scenarios.comparerOffres(famille, r26, [{}]).offres[0], { saisie: false, prime: 0, score: plan.avant.score, gainScore: 0,
    lacuneInvalidite: large.avant.lacuneInvalidite, lacuneInvaliditeMensuelle: Math.round(large.avant.lacuneInvalidite / 12), capitalDecesManquant: large.avant.capitalDeces, couvre: false, excedentRente: 0, excedentCapital: 0 });
}
