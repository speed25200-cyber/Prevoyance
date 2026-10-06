// @ts-check
/** Petits outils de calcul partagés par le moteur. Aucune dépendance. */

/** @param {number} x @param {number} [pas] */
export const arrondi = (x, pas = 1) => Math.round(x / pas + Number.EPSILON) * pas;

/** @param {number} x @param {number} min @param {number} max */
export const borne = (x, min, max) => Math.min(max, Math.max(min, x));

/** @param {number[]} valeurs */
export const somme = valeurs => valeurs.reduce((a, b) => a + b, 0);

/**
 * Âge en années révolues à une date donnée.
 * @param {string} naissance AAAA-MM-JJ @param {string|Date} [quand]
 */
export function age(naissance, quand = new Date()) {
  const n = new Date(naissance + 'T00:00:00'), q = typeof quand === 'string' ? new Date(quand + 'T00:00:00') : quand;
  let a = q.getFullYear() - n.getFullYear();
  if (q.getMonth() < n.getMonth() || (q.getMonth() === n.getMonth() && q.getDate() < n.getDate())) a -= 1;
  return a;
}

/** @param {string} naissance AAAA-MM-JJ */
export const anneeNaissance = naissance => +naissance.slice(0, 4);

/**
 * Valeur actuelle d'une rente annuelle constante versée pendant `annees` (paiement en cours d'année).
 * @param {number} rente annuelle @param {number} annees @param {number} taux d'escompte réel
 */
export function valeurActuelleRente(rente, annees, taux) {
  if (annees <= 0 || rente <= 0) return 0;
  if (Math.abs(taux) < 1e-9) return rente * annees;
  return rente * (1 - Math.pow(1 + taux, -annees)) / taux * Math.sqrt(1 + taux);
}

/**
 * Rente annuelle constante que finance un capital consommé sur `annees`.
 * @param {number} capital @param {number} annees @param {number} taux
 */
export function renteDepuisCapital(capital, annees, taux) {
  if (annees <= 0 || capital <= 0) return 0;
  if (Math.abs(taux) < 1e-9) return capital / annees;
  return capital * taux / (1 - Math.pow(1 + taux, -annees)) / Math.sqrt(1 + taux);
}

/**
 * Valeur future d'un capital et de versements annuels en fin d'année.
 * @param {number} capital @param {number} versement @param {number} annees @param {number} taux
 */
export function valeurFuture(capital, versement, annees, taux) {
  if (annees <= 0) return capital;
  if (Math.abs(taux) < 1e-9) return capital + versement * annees;
  const f = Math.pow(1 + taux, annees);
  return capital * f + versement * (f - 1) / taux;
}
