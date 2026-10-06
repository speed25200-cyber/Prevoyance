// @ts-check
/**
 * Cas de test du moteur : chaque valeur attendue est calculée à la main à partir des textes légaux et des montants
 * officiels (voir regles/ch-AAAA.json). Les mêmes cas tournent dans le navigateur (tests/index.html), sous Node
 * (tests/run.mjs, intégration continue) et dans l'app iOS.
 */

import { analyser, AVS, LPP, LAA } from '../src/index.js';

/** @param {(nom: string, obtenu: any, attendu: any, tolerance?: number) => void} egal @param {{r26: any, r27: any}} regles */
export function cas(egal, { r26, r27 }) {
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
