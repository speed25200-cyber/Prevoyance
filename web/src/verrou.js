// @ts-check
/**
 * Verrouillage de l'application : les dossiers sont chiffrés sur l'appareil avec un code que seul le conseiller connaît.
 *
 * - Le code n'est enregistré nulle part. Il sert à dériver une clé (PBKDF2, SHA-256, 600 000 itérations, sel aléatoire).
 * - Les dossiers, la fiche de l'intermédiaire et le nom du conseiller sont chiffrés en AES-GCM 256 bits, avec un
 *   vecteur d'initialisation neuf à chaque enregistrement. Un mauvais code ou un contenu altéré ne se déchiffre pas.
 * - Sans le code, les dossiers sont illisibles, y compris pour nous : il n'existe aucune récupération.
 * Tout repose sur le chiffrement intégré au navigateur (Web Crypto), disponible sur une adresse https ou locale.
 */

const CLE = 'prevoyance.coffre.v1';
const ITERATIONS = 600_000;
export const LONGUEUR_MIN = 6;

/** @type {{cle: CryptoKey, sel: string, iterations: number}|null} */ let session = null;
let file = Promise.resolve();

const b64 = octets => btoa(String.fromCharCode(...new Uint8Array(octets)));
const depuisB64 = texte => Uint8Array.from(atob(texte), c => c.charCodeAt(0));

/** Le chiffrement est-il possible ici ? (contexte sécurisé : https ou localhost) */
export const disponible = () => !!globalThis.crypto?.subtle;
/** Un coffre existe-t-il sur cet appareil ? */
export const actif = (stockage = localStorage) => { try { return !!stockage.getItem(CLE); } catch { return false; } };
/** Le coffre est-il ouvert (code saisi pendant cette session) ? */
export const ouvert = () => session !== null;

async function deriver(code, sel, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function ecrire(donnees, stockage) {
  if (!session) throw new Error('coffre fermé');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, session.cle, new TextEncoder().encode(JSON.stringify(donnees)));
  stockage.setItem(CLE, JSON.stringify({ v: 1, sel: session.sel, iterations: session.iterations, iv: b64(iv), donnees: b64(chiffre) }));
}

/** Crée le coffre avec un nouveau code et y range les données. */
export async function creer(code, donnees, stockage = localStorage, iterations = ITERATIONS) {
  if (!disponible()) throw new Error('chiffrement indisponible');
  if (String(code).length < LONGUEUR_MIN) throw new Error('code trop court');
  const sel = crypto.getRandomValues(new Uint8Array(16));
  session = { cle: await deriver(String(code), sel, iterations), sel: b64(sel), iterations };
  await ecrire(donnees, stockage);
}

/** Ouvre le coffre : renvoie les données, ou `null` si le code est faux ou le contenu altéré. */
export async function ouvrir(code, stockage = localStorage) {
  try {
    const coffre = JSON.parse(stockage.getItem(CLE) || 'null');
    if (!coffre || !disponible()) return null;
    const cle = await deriver(String(code), depuisB64(coffre.sel), coffre.iterations);
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisB64(coffre.iv) }, cle, depuisB64(coffre.donnees));
    session = { cle, sel: coffre.sel, iterations: coffre.iterations };
    return JSON.parse(new TextDecoder().decode(clair));
  } catch {
    return null;
  }
}

/** Enregistre les données dans le coffre ouvert. Les enregistrements se suivent dans l'ordre des appels. */
export function enregistrer(donnees, stockage = localStorage) {
  const copie = JSON.parse(JSON.stringify(donnees));
  file = file.then(() => ecrire(copie, stockage)).catch(() => {});
  return file;
}

/** Ferme le coffre : la clé quitte la mémoire. */
export function fermer() { session = null; }

/** Supprime le coffre (verrouillage retiré, ou tout effacer après un code oublié). */
export function supprimer(stockage = localStorage) {
  session = null;
  try { stockage.removeItem(CLE); } catch { /* stockage indisponible */ }
}
