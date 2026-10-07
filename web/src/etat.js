// @ts-check
/**
 * État de l'application : le portefeuille de dossiers du conseiller, le dossier ouvert, les réglages d'affichage.
 * Tout reste dans le navigateur (localStorage) : aucune donnée de client ne quitte l'appareil.
 * Quand le verrouillage est activé, les données sensibles (dossiers, fiche de l'intermédiaire, nom du conseiller) ne
 * sont plus écrites en clair : elles vont dans le coffre chiffré de verrou.js, et seuls les réglages d'affichage
 * restent lisibles.
 *
 * Le dossier de l'interface est « plat » (un champ par case du formulaire) ; `versDossier` le convertit dans la
 * forme attendue par le moteur.
 */

import { ANNEES } from '../../moteur/src/index.js';
import { LANGUES } from './i18n.js';
import * as Verrou from './verrou.js';

const CLE = 'prevoyance.etat.v2';
/** Ce qui est chiffré quand le verrouillage est actif. */
const SENSIBLES = ['dossiers', 'ouvert', 'conseiller', 'intermediaire'];
export const CANTONS = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH'];
export const VUES = ['analyse', 'scenarios', 'plan', 'rapport', 'donnees'];

const identifiant = () => Math.random().toString(36).slice(2, 10);

export const dossierVide = () => ({
  id: identifiant(), nom: '', modifie: new Date().toISOString(), canton: 'FR', commune: /** @type {number|null} */ (null), communeTexte: '', confession: 'sans', etatCivil: 'celibataire', avecConjoint: false, enfants: /** @type {number[]} */ ([]),
  personne: { dateNaissance: '1986-05-14', sexe: 'h', statut: 'salarie', revenu: 90000 },
  conjoint: { dateNaissance: '1988-09-02', sexe: 'f', statut: 'salarie', revenu: 60000 },
  besoins: { retraite: 0.8, invalidite: 0.9, deces: 0.7 }, ageRetraite: 65,
  bien: { valeur: 0, dette: 0 }, profilPlacement: 'equilibre', mesures: null, cible: 'personne',
});

export const dossierExemple = () => ({
  ...dossierVide(), nom: 'Famille Rochat (exemple)', canton: 'VD', etatCivil: 'marie', avecConjoint: true, enfants: [4, 7],
  personne: { dateNaissance: '1987-03-21', sexe: 'f', statut: 'salarie', revenu: 104000, anneesManquantes: 2, lppAvoir: 148000, lppRachat: 62000,
              ijm: true, avoir3a: 41000, versement3a: 3600, fortune: 30000 },
  conjoint: { dateNaissance: '1985-11-08', sexe: 'h', statut: 'independant', revenu: 78000, avoir3a: 22000, versement3a: 6000 },
  besoins: { retraite: 0.8, invalidite: 0.9, deces: 0.75 }, bien: { valeur: 980000, dette: 620000 },
  // deux rendez-vous passés fictifs, pour montrer le suivi dans le temps sur l'exemple
  suivi: [{ j: '2025-10-02', s: 81, r: 1650, i: 640, d: 310 }, { j: '2026-04-14', s: 87, r: 1410, i: 420, d: 180 }],
});

function charger() {
  const langue = (navigator.language || 'fr').slice(0, 2);
  const base = { langue: LANGUES.includes(langue) ? langue : 'fr', annee: ANNEES[0], vue: 'analyse', risque: 'retraite', conseiller: '',
                 dossiers: [dossierExemple()], ouvert: '' };
  try {
    const garde = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (garde?.dossiers?.length) Object.assign(base, garde, { dossiers: garde.dossiers.map(d => ({ ...dossierVide(), ...d })) });
  } catch { /* stockage indisponible : on travaille en mémoire */ }
  if (!base.dossiers.some(d => d.id === base.ouvert)) base.ouvert = base.dossiers[0].id;
  if (!VUES.includes(base.vue)) base.vue = 'analyse';
  return base;
}

export const etat = charger();

export function garder() {
  try {
    if (!Verrou.actif()) { localStorage.setItem(CLE, JSON.stringify(etat)); return; }
    if (!Verrou.ouvert()) return;                                   // verrouillé : rien ne s'écrit avant le code
    localStorage.setItem(CLE, JSON.stringify(Object.fromEntries(Object.entries(etat).filter(([cle]) => !SENSIBLES.includes(cle)))));
    Verrou.enregistrer(Object.fromEntries(SENSIBLES.map(cle => [cle, etat[cle]])));
  } catch { /* navigation privée : rien n'est gardé */ }
}

function reprendre(donnees) {
  Object.assign(etat, donnees, { dossiers: (donnees.dossiers?.length ? donnees.dossiers : [dossierVide()]).map(d => ({ ...dossierVide(), ...d })) });
  if (!etat.dossiers.some(d => d.id === etat.ouvert)) etat.ouvert = etat.dossiers[0].id;
}

/** Ouvre le coffre avec le code : les dossiers reviennent en mémoire. `false` si le code est faux. */
export async function deverrouiller(code) {
  const donnees = await Verrou.ouvrir(code);
  if (!donnees) return false;
  reprendre(donnees);
  return true;
}

/** Active le verrouillage : les données sensibles passent dans le coffre et disparaissent du stockage en clair. */
export async function activerVerrou(code) {
  await Verrou.creer(code, Object.fromEntries(SENSIBLES.map(cle => [cle, etat[cle]])));
  garder();
}

/** Retire le verrouillage (coffre ouvert) : les données reviennent en clair sur l'appareil. */
export function retirerVerrou() {
  if (!Verrou.ouvert()) return;
  Verrou.supprimer();
  garder();
}

/** Code oublié : efface le coffre et les réglages de cet appareil. */
export function effacerTout() {
  Verrou.supprimer();
  try { localStorage.removeItem(CLE); } catch { /* stockage indisponible */ }
}

/** Le dossier ouvert. */
export const dossier = () => etat.dossiers.find(d => d.id === etat.ouvert) ?? etat.dossiers[0];

export function nouveauDossier(modele = dossierVide()) {
  etat.dossiers.unshift(modele);
  etat.ouvert = modele.id;
  garder();
  return modele;
}

export function supprimerDossier(id) {
  etat.dossiers = etat.dossiers.filter(d => d.id !== id);
  if (!etat.dossiers.length) etat.dossiers = [dossierVide()];
  if (!etat.dossiers.some(d => d.id === etat.ouvert)) etat.ouvert = etat.dossiers[0].id;
  garder();
}

export function dupliquerDossier(id) {
  const source = etat.dossiers.find(d => d.id === id);
  if (!source) return null;
  return nouveauDossier({ ...JSON.parse(JSON.stringify(source)), id: identifiant(), nom: `${source.nom || '—'} (2)`, modifie: new Date().toISOString() });
}

// ------------------------------------------------------------------ vers le moteur

export const aujourdhui = () => new Date().toISOString().slice(0, 10);

function naissanceDepuisAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

const defini = v => (v === undefined || v === null || v === '' ? undefined : +v);

/** Une personne de l'interface dans la forme du moteur. */
function versPersonne(p, fortune) {
  const independant = p.statut === 'independant';
  const affilie = independant ? !!p.lppAffilie : p.lppAffilie === false ? false : undefined;
  const contrats = [];
  if (p.avoir3a || p.versement3a) contrats.push({ type: '3a', forme: 'banque', avoir: p.avoir3a || 0, versementAnnuel: p.versement3a || 0 });
  if (p.avoir3b) contrats.push({ type: '3b', forme: 'banque', avoir: p.avoir3b });
  if (p.rentePrivee || p.capitalDecesPrive) contrats.push({ type: '3b', forme: 'assurance', renteInvalidite: p.rentePrivee || 0, capitalDeces: p.capitalDecesPrive || 0 });
  return {
    dateNaissance: p.dateNaissance || '1986-01-01', sexe: p.sexe || 'h', statut: p.statut || 'salarie', revenu: +p.revenu || 0,
    avs: { ramd: defini(p.ramd), anneesManquantes: +p.anneesManquantes || 0 },
    lpp: { affilie, avoir: defini(p.lppAvoir), renteVieillesse: defini(p.lppRenteVieillesse), renteInvalidite: defini(p.lppRenteInvalidite),
           renteConjoint: defini(p.lppRenteConjoint), capitalDeces: defini(p.lppCapitalDeces), rachatPossible: defini(p.lppRachat) },
    laa: { assure: p.laa ?? (!independant && p.statut !== 'sans') },
    ijm: { assure: !!p.ijm },
    pilier3: contrats, fortune: fortune ? +p.fortune || 0 : 0,
  };
}

/**
 * Le dossier ouvert dans la forme du moteur. `cible` : la personne analysée (« personne » ou « conjoint ») ; l'autre
 * devient son conjoint, de sorte que le même moteur analyse les deux membres du couple.
 * @param {any} [d] @param {'personne'|'conjoint'} [cible]
 */
export function versDossier(d = dossier(), cible = d.cible) {
  const inverse = cible === 'conjoint' && d.avecConjoint;
  const premier = inverse ? d.conjoint : d.personne, second = inverse ? d.personne : d.conjoint;
  return {
    dateAnalyse: aujourdhui(), canton: d.canton, etatCivil: d.etatCivil,
    personne: versPersonne(premier, true),
    conjoint: d.avecConjoint ? versPersonne(second, false) : null,
    enfants: d.enfants.map(a => ({ dateNaissance: naissanceDepuisAge(a) })),
    besoins: { ...d.besoins }, hypotheses: { ageRetraite: d.ageRetraite },
  };
}

/** Profils de placement : rendement attendu et volatilité annuels (hypothèses de travail, modifiables dans le code). */
export const PROFILS = {
  prudent: { rendement: 0.015, volatilite: 0.04 },
  equilibre: { rendement: 0.03, volatilite: 0.09 },
  dynamique: { rendement: 0.045, volatilite: 0.15 },
};
