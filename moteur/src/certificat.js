// @ts-check
/**
 * Lecture d'un certificat de prévoyance (2e pilier) à partir de son texte.
 *
 * Le texte vient de la reconnaissance de caractères de l'appareil (scan de l'app iPhone / iPad, « Scanner du texte »
 * de Safari, copier-coller d'un PDF). Rien ne quitte l'appareil. Les certificats diffèrent d'une caisse à l'autre :
 * cette lecture par libellés (français, allemand, italien) propose des valeurs, que le conseiller vérifie toujours
 * avant de les reprendre. Dans l'app native, le modèle de langage de l'appareil peut fournir les mêmes champs ; ils
 * passent alors par `normaliser`, qui applique les mêmes contrôles.
 */

/** Champs du dossier que la lecture peut proposer, avec les libellés qui les annoncent sur un certificat. */
export const CHAMPS = {
  lppAvoir: [/avoir de vieillesse/i, /avoir de pr[ée]voyance/i, /capital[- ]?[ée]pargne/i, /prestation de (libre passage|sortie)/i,
    /altersguthaben/i, /sparguthaben/i, /sparkapital/i, /(austritts|freiz[üu]gigkeits)leistung/i, /avere di vecchiaia/i, /prestazione d.uscita/i],
  lppRenteVieillesse: [/rente (annuelle )?de (vieillesse|retraite)/i, /rente de vieillesse (annuelle|projet[ée]e)/i, /altersrente/i, /rendita (annua )?di vecchiaia/i],
  lppRenteInvalidite: [/rente (annuelle )?d.invalidit[ée]/i, /invalidenrente/i, /rendita (annua )?d.invalidit[àa]/i],
  lppRenteConjoint: [/rente (annuelle )?de (conjoint|partenaire|veuve|veuf)/i, /(ehegatten|partner|witwen|witwer)rente/i, /rendita (per|del) (coniuge|vedov)/i],
  lppCapitalDeces: [/capital(-| en cas de | )d[ée]c[èe]s/i, /todesfallkapital/i, /capitale (in caso )?di (decesso|morte)/i],
  lppRachat: [/rachat (maximal|maximum|possible)/i, /(montant|somme) (maximale? )?de rachat/i, /possibilit[ée] de rachat/i, /(maximal(er)? )?einkauf(ssumme|sm[öo]glichkeit)?/i,
    /riscatto (massimo|possibile)/i],
  revenu: [/salaire annuel (annonc[ée]|d[ée]terminant|brut|avs)/i, /(gemeldeter|massgebender) jahreslohn/i, /jahreslohn/i, /salario annuo/i],
};

/** Bornes de vraisemblance d'un montant annuel ou d'un capital, en francs : écarte les numéros, dates et pourcentages. */
const BORNES = { lppAvoir: [0, 5e6], lppRenteVieillesse: [500, 4e5], lppRenteInvalidite: [500, 4e5], lppRenteConjoint: [300, 3e5],
  lppCapitalDeces: [0, 5e6], lppRachat: [0, 5e6], revenu: [5000, 2e6] };

/** Les montants d'une ligne : « 148'000.00 », « 148 000 », « 148’000.– », « CHF 1'234.50 ». Ni pour-cent, ni dates. */
export function montants(ligne) {
  const sans = ligne.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, ' ').replace(/\d+([.,]\d+)?\s*%/g, ' ').replace(/756\.\d{4}\.\d{4}\.\d{2}/g, ' ');
  const trouves = sans.match(/\d{1,3}(?:['’`´   ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g) ?? [];
  return trouves.map(t => parseFloat(t.replace(/['’`´   ]/g, '').replace(',', '.'))).filter(n => Number.isFinite(n));
}

const plausible = (cle, n) => n >= BORNES[cle][0] && n <= BORNES[cle][1];

/**
 * Lit le texte d'un certificat.
 * @param {string} texte
 * @returns {{champs: Record<string, {valeur: number, ligne: string}>, lignes: number}}
 */
export function extraire(texte) {
  const lignes = String(texte ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  /** @type {Record<string, {valeur: number, ligne: string}>} */ const champs = {};
  for (const [cle, libelles] of Object.entries(CHAMPS)) {
    for (let i = 0; i < lignes.length && !champs[cle]; i++) {
      if (!libelles.some(r => r.test(lignes[i]))) continue;
      // le montant est sur la ligne du libellé, ou sur la suivante quand le scan a séparé les colonnes
      for (const ligne of [lignes[i], lignes[i + 1] ?? '']) {
        const candidats = montants(ligne).filter(n => plausible(cle, n) && (n >= 100 || cle === 'lppRachat' || cle === 'lppCapitalDeces'));
        if (!candidats.length) continue;
        // rente donnée par mois et par an sur la même ligne : la valeur annuelle est la plus grande
        champs[cle] = { valeur: Math.round(Math.max(...candidats)), ligne: lignes[i] === ligne ? ligne : `${lignes[i]} ${ligne}` };
        break;
      }
    }
  }
  return { champs, lignes: lignes.length };
}

/**
 * Contrôle des champs fournis par un autre lecteur (modèle de langage de l'appareil) : mêmes clés, mêmes bornes.
 * @param {Record<string, number|null|undefined>} bruts
 * @returns {Record<string, {valeur: number, ligne: string}>}
 */
export function normaliser(bruts) {
  /** @type {Record<string, {valeur: number, ligne: string}>} */ const champs = {};
  for (const cle of Object.keys(CHAMPS)) {
    const n = Number(bruts?.[cle]);
    if (Number.isFinite(n) && n > 0 && plausible(cle, n)) champs[cle] = { valeur: Math.round(n), ligne: '' };
  }
  return champs;
}
