// @ts-check
/**
 * Données de référence (règles de l'année, impôts par canton) et leur mise à jour.
 *
 * Les fichiers livrés avec l'application servent de base. « Vérifier les mises à jour » compare le manifeste local
 * à celui du dépôt public ; s'il est plus récent, les nouveaux fichiers sont téléchargés, gardés dans le navigateur
 * et utilisés tout de suite, sans réinstaller l'application. Hors ligne, les dernières données connues restent.
 */

const CLE = 'prevoyance.donnees.v1';
const BASE = new URL('../../moteur/', import.meta.url).href;
const DEPOT = 'https://raw.githubusercontent.com/speed25200-cyber/Prevoyance/';
const CANAUX = ['main', 'claude/fondations'];

/** @type {{manifeste: any, fichiers: Record<string, any>, verifieLe?: string}|null} */
let surcharge = null;
try { surcharge = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { surcharge = null; }
/** @type {any} */ let manifesteLocal = null;
const cache = new Map();

async function lire(chemin) {
  if (cache.has(chemin)) return cache.get(chemin);
  let donnees = surcharge?.fichiers?.[chemin] ?? null;
  if (!donnees) {
    const reponse = await fetch(BASE + chemin);
    donnees = reponse.ok ? await reponse.json() : null;
  }
  cache.set(chemin, donnees);
  return donnees;
}

export async function manifeste() {
  manifesteLocal ??= await fetch(BASE + 'manifeste.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
  const garde = surcharge?.manifeste;
  return garde && manifesteLocal && garde.version > manifesteLocal.version ? garde : manifesteLocal;
}

export const regles = annee => lire(`regles/ch-${annee}.json`);
export const impots = annee => lire(`donnees/impots-${annee}.json`);
export const dernierControle = () => surcharge?.verifieLe ?? null;

/**
 * Compare avec le dépôt public et installe les données plus récentes.
 * @returns {Promise<{etat: 'ajour'|'misAJour'|'horsLigne', version?: string}>}
 */
export async function verifierMisesAJour() {
  const local = await manifeste();
  for (const canal of CANAUX) {
    try {
      const reponse = await fetch(`${DEPOT}${canal}/moteur/manifeste.json`, { cache: 'no-store' });
      if (!reponse.ok) continue;
      const distant = await reponse.json(), maintenant = new Date().toISOString();
      if (!local || distant.version > local.version) {
        const fichiers = {};
        for (const chemin of distant.fichiers) {
          const f = await fetch(`${DEPOT}${canal}/moteur/${chemin}`, { cache: 'no-store' });
          if (!f.ok) throw new Error(chemin);
          fichiers[chemin] = await f.json();
        }
        surcharge = { manifeste: distant, fichiers, verifieLe: maintenant };
        localStorage.setItem(CLE, JSON.stringify(surcharge));
        cache.clear();
        return { etat: 'misAJour', version: distant.version };
      }
      surcharge = { manifeste: surcharge?.manifeste ?? null, fichiers: surcharge?.fichiers ?? {}, verifieLe: maintenant };
      try { localStorage.setItem(CLE, JSON.stringify(surcharge)); } catch { /* stockage plein ou privé */ }
      return { etat: 'ajour', version: local?.version };
    } catch { /* canal suivant */ }
  }
  return { etat: 'horsLigne' };
}
