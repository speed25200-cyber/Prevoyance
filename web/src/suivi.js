// @ts-check
/**
 * Suivi d'un dossier dans le temps : un point par jour où le dossier a été analysé (score de couverture et lacunes
 * mensuelles), pour montrer au client le chemin parcouru d'un rendez-vous à l'autre. Les points restent dans le
 * dossier, donc sur l'appareil, chiffrés avec lui.
 *
 * @typedef {{j: string, s: number, r: number, i: number, d: number}} Point jour (AAAA-MM-JJ), score, lacunes retraite / invalidité / décès par mois
 */

/** Nombre de points gardés : les plus anciens s'effacent. */
export const MAXIMUM = 36;

/**
 * Ajoute le point du jour, ou remplace celui du même jour (le dernier état de la journée fait foi).
 * @param {Point[]|undefined} suivi @param {Point} point
 * @returns {{suivi: Point[], change: boolean}} `change` : la liste diffère de celle reçue (il faut l'enregistrer)
 */
export function noter(suivi, point) {
  const liste = [...(suivi ?? [])], dernier = liste[liste.length - 1];
  if (dernier && dernier.j === point.j) {
    if (dernier.s === point.s && dernier.r === point.r && dernier.i === point.i && dernier.d === point.d) return { suivi: liste, change: false };
    liste[liste.length - 1] = point;
  } else {
    liste.push(point);
  }
  return { suivi: liste.slice(-MAXIMUM), change: true };
}

/** Le point d'une analyse. @param {any} analyse @param {string} jour */
export function pointDe(analyse, jour) {
  const r = analyse.risques, mois = x => Math.round((x?.lacune ?? 0) / 12);
  return { j: jour, s: analyse.score, r: mois(r.retraite), i: Math.max(mois(r.invaliditeMaladie), mois(r.invaliditeAccident)), d: Math.max(mois(r.decesMaladie), mois(r.decesAccident)) };
}

/**
 * L'évolution depuis le premier point : écart de score et date de départ. `null` tant qu'il n'y a qu'un jour.
 * @param {Point[]|undefined} suivi
 */
export function evolution(suivi) {
  if (!suivi || suivi.length < 2) return null;
  const premier = suivi[0], dernier = suivi[suivi.length - 1];
  return { depuis: premier.j, ecart: dernier.s - premier.s, points: suivi.length };
}
