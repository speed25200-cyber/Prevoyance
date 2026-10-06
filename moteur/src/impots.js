// @ts-check
/**
 * Impôts : revenu et prestations en capital, par canton.
 *
 * Les chiffres ne sont pas modélisés mais relevés auprès du calculateur officiel de l'Administration fédérale des
 * contributions (outils/donnees/maj_impots.py -> donnees/impots-AAAA.json) : pour le chef-lieu de chaque canton,
 * une personne seule et un couple marié, sans enfant ou avec un à trois enfants à charge, sur une grille de revenus
 * bruts et de capitaux. Le moteur interpole. Cela donne l'ordre de grandeur juste pour un conseil ; la commune
 * exacte et la confession déplacent le résultat de quelques pour cent.
 */

import { arrondi } from './util.js';

/** Part du salaire brut qui reste imposable (cotisations sociales et déductions courantes) : sert à convertir une
 *  déduction ou une rente en « équivalent brut » sur la grille. */
export const PART_IMPOSABLE = 0.85;

/** Interpolation linéaire sur une grille croissante, prolongée par la dernière pente. */
export function interpoler(xs, ys, x) {
  if (x <= xs[0]) return ys[0] * Math.max(0, x) / xs[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  }
  const n = xs.length - 1;
  return ys[n] + (ys[n] - ys[n - 1]) * (x - xs[n]) / (xs[n] - xs[n - 1]);
}

/** Nombre d'enfants à charge au-delà duquel les grilles ne sont plus relevées. */
export const ENFANTS_MAX = 3;

/** La grille d'un canton : celle du nombre d'enfants demandé quand elle a été relevée, sinon la plus proche en dessous. */
const grille = (donnees, canton, marie, nature, enfants = 0) => {
  const grilles = donnees?.cantons?.[canton]?.[nature], base = marie ? 'marie' : 'seul';
  if (!grilles) return undefined;
  for (let n = Math.min(ENFANTS_MAX, Math.max(0, Math.floor(enfants))); n > 0; n--) if (grilles[base + n]) return grilles[base + n];
  return grilles[base];
};

/** Les données portent-elles l'impôt avec enfants à charge pour ce canton ? */
export const avecEnfants = (donnees, canton) => !!donnees?.cantons?.[canton]?.revenu?.marie1;

/**
 * Impôt annuel sur le revenu (Confédération, canton, commune) pour un revenu brut de salarié.
 * @param {any} donnees impots-AAAA.json @param {string} canton @param {boolean} marie @param {number} brut
 * @param {number} [enfants] enfants à charge (0 par défaut)
 * @returns {{impot: number, marginal: number}|null} `null` si le canton n'est pas dans les données
 */
export function impotRevenu(donnees, canton, marie, brut, enfants = 0) {
  const g = grille(donnees, canton, marie, 'revenu', enfants);
  if (!g) return null;
  const impot = Math.max(0, interpoler(donnees.revenus, g.map(p => p[0]), brut));
  const pas = Math.max(1000, brut * 0.01);
  const marginal = Math.max(0, (interpoler(donnees.revenus, g.map(p => p[0]), brut + pas) - impot) / pas / PART_IMPOSABLE);
  return { impot: arrondi(impot), marginal: Math.min(0.5, marginal) };
}

/**
 * Économie d'impôt d'une déduction (versement 3a, rachat LPP) : différence d'impôt entre le revenu et le revenu
 * diminué de la déduction, la déduction étant ramenée à son équivalent brut.
 * @returns {number|null}
 */
export function economieDeduction(donnees, canton, marie, brut, deduction, enfants = 0) {
  const g = grille(donnees, canton, marie, 'revenu', enfants);
  if (!g || deduction <= 0) return g ? 0 : null;
  const impots = g.map(p => p[0]);
  const avant = interpoler(donnees.revenus, impots, brut), apres = interpoler(donnees.revenus, impots, Math.max(0, brut - deduction / PART_IMPOSABLE));
  return arrondi(Math.max(0, avant - apres), 10);
}

/**
 * Impôt sur une prestation en capital de la prévoyance (2e pilier, pilier 3a), imposée séparément du revenu.
 * @returns {number|null}
 */
export function impotCapital(donnees, canton, marie, capital) {
  const g = grille(donnees, canton, marie, 'capital');
  if (!g) return null;
  return capital <= 0 ? 0 : arrondi(Math.max(0, interpoler(donnees.capitaux, g, capital)), 10);
}

/**
 * Impôt sur le revenu d'un rentier : la rente est imposable à 100 %, sans cotisations sociales ; on la ramène à
 * son équivalent brut sur la grille des salariés.
 * @returns {number|null}
 */
export function impotRentes(donnees, canton, marie, rentes) {
  const r = impotRevenu(donnees, canton, marie, rentes / PART_IMPOSABLE);
  return r ? r.impot : null;
}

/**
 * Retraits échelonnés : impôt total si les capitaux sont retirés sur des années fiscales différentes, comparé à un
 * retrait unique. La progressivité rend l'échelonnement presque toujours gagnant.
 * @param {number[]} capitaux un montant par année de retrait
 * @returns {{unique: number, echelonne: number, economie: number}|null}
 */
export function retraitsEchelonnes(donnees, canton, marie, capitaux) {
  const total = capitaux.reduce((a, b) => a + b, 0);
  const unique = impotCapital(donnees, canton, marie, total);
  if (unique === null) return null;
  const echelonne = capitaux.reduce((s, c) => s + /** @type {number} */ (impotCapital(donnees, canton, marie, c)), 0);
  return { unique, echelonne: arrondi(echelonne, 10), economie: arrondi(Math.max(0, unique - echelonne), 10) };
}

/**
 * Rachat LPP échelonné : économie d'impôt totale selon le nombre d'années sur lesquelles on répartit le rachat.
 * @returns {{annees: number, parAn: number, economie: number}[]}
 */
export function rachatEchelonne(donnees, canton, marie, brut, montant, maxAnnees = 5, enfants = 0) {
  const out = [];
  for (let n = 1; n <= maxAnnees; n++) {
    const e = economieDeduction(donnees, canton, marie, brut, montant / n, enfants);
    if (e === null) return [];
    out.push({ annees: n, parAn: arrondi(montant / n), economie: arrondi(e * n, 10) });
  }
  return out;
}
