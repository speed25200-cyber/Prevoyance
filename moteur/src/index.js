// @ts-check
/**
 * Moteur de prévoyance suisse : point d'entrée unique, sans dépendance.
 *
 * Le même fichier sert l'application web (module ES) et l'application iPad/iPhone (JavaScriptCore) : une seule
 * source de vérité pour les calculs, vérifiée par les mêmes cas de test.
 *
 *   import { analyser, regles } from './index.js';
 *   const resultat = analyser(dossier, await regles(2026));
 */

export { analyser, estimerTauxMarginal } from './analyse.js';
export * as AVS from './avs.js';
export * as LPP from './lpp.js';
export * as LAA from './laa.js';
export * as Impots from './impots.js';
export * as Scenarios from './scenarios.js';
export * as Certificat from './certificat.js';
export * as Conseil from './conseil.js';
export * as outils from './util.js';

export const VERSION = '0.9.1';
export const ANNEES = [2026, 2027];

/**
 * Règles d'une année (chargées depuis regles/ch-AAAA.json).
 * @param {number} annee @param {string} [base] adresse du dossier des règles
 */
export async function regles(annee, base = new URL('../regles/', import.meta.url).href) {
  const reponse = await fetch(`${base}ch-${annee}.json`);
  if (!reponse.ok) throw new Error(`Règles ${annee} introuvables`);
  return reponse.json();
}

/**
 * Communes d'une année (donnees/communes-AAAA.json) : facteur de chaque commune, impôt d'Église. `null` si elles manquent.
 * @param {number} annee @param {string} [base]
 */
export async function communes(annee, base = new URL('../donnees/', import.meta.url).href) {
  try {
    const reponse = await fetch(`${base}communes-${annee}.json`);
    return reponse.ok ? await reponse.json() : null;
  } catch {
    return null;
  }
}

/**
 * Données fiscales d'une année (donnees/impots-AAAA.json, relevées auprès de l'AFC). `null` si elles manquent.
 * @param {number} annee @param {string} [base]
 */
export async function impots(annee, base = new URL('../donnees/', import.meta.url).href) {
  try {
    const reponse = await fetch(`${base}impots-${annee}.json`);
    return reponse.ok ? await reponse.json() : null;
  } catch {
    return null;
  }
}
