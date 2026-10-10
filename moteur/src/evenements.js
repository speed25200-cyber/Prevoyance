// @ts-check
/**
 * « Et si… » : les événements de vie qui déplacent une prévoyance, appliqués au dossier un à la fois.
 *
 * Une naissance, un temps partiel, une mise à son compte, une augmentation, l'achat d'un logement avec le 2e pilier,
 * un mariage : chacun change les prestations des trois piliers d'une façon que le client ne devine pas. Chaque
 * événement transforme une copie du dossier, puis l'analyse complète est refaite : on lit l'effet sur la couverture,
 * sur la retraite, sur l'invalidité et sur le décès, avec les mêmes règles que partout ailleurs.
 *
 * Comme le reste du moteur, rien n'est rédigé ici : chaque événement porte un code (`cle`) que l'interface traduit.
 */

import { analyser } from './analyse.js';
import { salaireCoordonne } from './lpp.js';
import { retraitLogement } from './scenarios.js';
import { arrondi } from './util.js';

/** Part du temps de travail après le passage à temps partiel. */
export const TEMPS_PARTIEL = 0.8;
/** Augmentation de salaire étudiée. */
export const HAUSSE = 0.15;
/** Retrait étudié pour le logement, plafonné au maximum légal. */
export const RETRAIT_LOGEMENT = 50000;

/** Ce qu'on lit d'une analyse : la couverture, et la lacune de chaque famille de risque (la pire à venir). */
function lire(a) {
  const r = a.risques, pire = x => Math.max(x.lacune, x.lacuneMax ?? 0);
  return { score: a.score, retraite: r.retraite.lacuneMensuelle, revenuRetraite: arrondi(r.retraite.total / 12),
           invalidite: arrondi(Math.max(pire(r.invaliditeMaladie), pire(r.invaliditeAccident)) / 12),
           deces: Math.max(r.decesMaladie.capital ?? 0, r.decesAccident.capital ?? 0) };
}

/**
 * Valeurs du certificat de prévoyance après un changement de salaire : les prestations de risque suivent le salaire
 * assuré ; la rente de vieillesse garde ce qui est déjà acquis et ne fait varier que la part à venir.
 */
function certificatAjuste(regles, lpp, ancien, nouveau) {
  const avant = salaireCoordonne(regles, ancien), apres = salaireCoordonne(regles, nouveau);
  if (!lpp || avant <= 0) return lpp;
  const k = apres / avant, conversion = lpp.tauxConversion ?? regles.lpp.tauxConversion, c = { ...lpp };
  for (const cle of ['renteInvalidite', 'renteConjoint', 'renteEnfant']) if (c[cle] !== undefined) c[cle] = arrondi(c[cle] * k);
  if (c.renteVieillesse !== undefined) {
    const acquis = Math.min(c.renteVieillesse, (c.avoir ?? 0) * conversion);
    c.renteVieillesse = arrondi(acquis + (c.renteVieillesse - acquis) * k);
  }
  if (c.capitalRetraite !== undefined) {
    const acquis = Math.min(c.capitalRetraite, c.avoir ?? 0);
    c.capitalRetraite = arrondi(acquis + (c.capitalRetraite - acquis) * k);
  }
  return c;
}

/**
 * @param {import('./analyse.js').Dossier} dossier @param {any} regles @param {{impots?: any}} [contexte]
 * @returns {{avant: ReturnType<typeof lire>, evenements: {cle: string, applicable: boolean, v: Record<string, number>,
 *            apres: ReturnType<typeof lire>, ecart: ReturnType<typeof lire>}[]}}
 */
export function evenements(dossier, regles, contexte = {}) {
  const a0 = analyser(dossier, regles, contexte), avant = lire(a0);
  const p = dossier.personne, lpp = p.lpp ?? {}, P = a0.personne;
  const quand = dossier.dateAnalyse ?? `${regles.annee}-01-01`;
  const marie = dossier.etatCivil === 'marie' || dossier.etatCivil === 'partenariat';
  const salaire = facteur => ({ ...dossier, personne: { ...p, revenu: arrondi(p.revenu * facteur),
    lpp: p.statut === 'salarie' ? certificatAjuste(regles, p.lpp, p.revenu, p.revenu * facteur) : p.lpp } });
  const logement = P.lpp.affilie && P.lpp.avoirActuel > 0
    ? retraitLogement({ avoir: P.lpp.avoirActuel, age: P.age, ageRetraite: Math.max(P.ageRetraite, P.ageReference.ans), montant: RETRAIT_LOGEMENT,
                        canton: dossier.canton, marie, tauxConversion: P.lpp.tauxConversion }, regles, contexte.impots ?? null)
    : null;

  /** @type {{cle: string, applicable: boolean, v: Record<string, number>, dossier: import('./analyse.js').Dossier}[]} */
  const essais = [
    // un enfant de plus : le besoin des proches dure plus longtemps, les rentes d'enfants aussi
    { cle: 'naissance', applicable: (dossier.enfants ?? []).length < 8, v: { enfants: (dossier.enfants ?? []).length + 1 },
      dossier: { ...dossier, enfants: [...(dossier.enfants ?? []), { dateNaissance: quand }] } },
    // temps partiel : le salaire baisse, la déduction de coordination ne baisse pas (sauf règlement plus généreux)
    { cle: 'tempsPartiel', applicable: p.statut !== 'sans' && p.revenu > 0, v: { part: TEMPS_PARTIEL, revenu: arrondi(p.revenu * TEMPS_PARTIEL) },
      dossier: salaire(TEMPS_PARTIEL) },
    // mise à son compte : plus de caisse de pension ni d'assurance-accidents obligatoires, plus d'indemnités journalières
    // collectives ; l'avoir acquis devient un avoir de libre passage
    { cle: 'independant', applicable: p.statut === 'salarie', v: { avoir: P.lpp.avoirActuel },
      dossier: { ...dossier, personne: { ...p, statut: 'independant', lpp: { affilie: false, avoir: lpp.avoir ?? 0 }, laa: { assure: false }, ijm: { assure: false } } } },
    // augmentation : le besoin monte avec le revenu, les prestations plafonnées (AVS, LAA, LPP obligatoire) ne suivent pas
    { cle: 'hausse', applicable: p.revenu > 0, v: { part: HAUSSE, revenu: arrondi(p.revenu * (1 + HAUSSE)) }, dossier: salaire(1 + HAUSSE) },
    // achat du logement avec le 2e pilier : l'avoir retiré manque à la retraite
    { cle: 'logement', applicable: !!logement?.possible, v: { montant: logement?.montant ?? 0, net: logement?.net ?? 0, rente: logement?.renteEnMoins ?? 0 },
      dossier: { ...dossier, personne: { ...p, lpp: { ...lpp, avoir: Math.max(0, (lpp.avoir ?? 0) - (logement?.montant ?? 0)),
        ...(lpp.renteVieillesse !== undefined ? { renteVieillesse: Math.max(0, lpp.renteVieillesse - (logement?.renteEnMoins ?? 0)) } : {}),
        ...(lpp.capitalRetraite !== undefined ? { capitalRetraite: Math.max(0, lpp.capitalRetraite - (logement?.avoirRetraiteEnMoins ?? 0)) } : {}) } } } },
    // mariage d'un couple qui vit ensemble : droits de survivant ouverts, rentes AVS du couple plafonnées
    { cle: 'mariage', applicable: !!dossier.conjoint && !marie, v: {}, dossier: { ...dossier, etatCivil: 'marie' } },
  ];
  return { avant, evenements: essais.map(e => {
    const apres = e.applicable ? lire(analyser(e.dossier, regles, contexte)) : avant;
    return { cle: e.cle, applicable: e.applicable, v: e.v, apres,
             ecart: { score: apres.score - avant.score, retraite: apres.retraite - avant.retraite, revenuRetraite: apres.revenuRetraite - avant.revenuRetraite,
                      invalidite: apres.invalidite - avant.invalidite, deces: apres.deces - avant.deces } };
  }) };
}
