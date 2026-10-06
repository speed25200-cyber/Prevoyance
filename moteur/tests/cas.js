// @ts-check
/**
 * Cas de test du moteur : chaque valeur attendue est calculée à la main à partir des textes légaux et des montants
 * officiels (voir regles/ch-AAAA.json). Les mêmes cas tournent dans le navigateur (tests/index.html), sous Node
 * (tests/run.mjs, intégration continue) et dans l'app iOS.
 */

import { analyser, AVS, LPP, LAA, Impots, Scenarios } from '../src/index.js';

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
export function casScenarios(egal, { r26, i26, c26 }) {
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
}
