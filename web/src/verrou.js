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

/** @type {{cle: any, sel: string, iterations: number}|null} */ let session = null;
let file = Promise.resolve();

// par tranches : un dossier avec logo et signatures dépasse vite ce qu'un seul appel accepte en arguments
const b64 = octets => {
  const o = new Uint8Array(octets);
  let texte = '';
  for (let i = 0; i < o.length; i += 0x8000) texte += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(texte);
};
const depuisB64 = texte => Uint8Array.from(atob(texte), c => c.charCodeAt(0));

// Dans l'app iPhone / iPad, l'adresse interne n'est pas un contexte sécurisé : Web Crypto n'existe pas. L'app fournit
// alors les mêmes opérations (mêmes algorithmes, même format : ios/Prevoyance/Coffre.swift) ; la clé reste chez elle,
// la page ne tient qu'un jeton.
const app = () => /** @type {any} */ (globalThis).webkit?.messageHandlers?.coffre ?? null;
const parApp = () => !globalThis.crypto?.subtle && !!app();
/** Le chiffrement est-il possible ici ? (https, localhost, ou l'app) */
export const disponible = () => !!globalThis.crypto?.subtle || !!app();
/** Un coffre existe-t-il sur cet appareil ? */
export const actif = (stockage = localStorage) => { try { return !!stockage.getItem(CLE); } catch { return false; } };
/** Le coffre est-il ouvert (code saisi pendant cette session) ? */
export const ouvert = () => session !== null;

async function deriver(code, sel, iterations) {
  if (parApp()) return (await app().postMessage({ op: 'deriver', code: code.normalize('NFKC'), sel: b64(sel), iterations })).jeton;
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** @returns {Promise<string>} texte chiffré et son sceau, en base64 */
async function chiffrer(cle, iv, texte) {
  if (parApp()) return app().postMessage({ op: 'chiffrer', jeton: cle, iv: b64(iv), clair: texte });
  return b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, new TextEncoder().encode(texte)));
}

/** @returns {Promise<string>} le texte clair ; échoue si le code est faux ou le contenu altéré */
async function dechiffrer(cle, iv, donnees) {
  if (parApp()) return app().postMessage({ op: 'dechiffrer', jeton: cle, iv, donnees });
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisB64(iv) }, cle, depuisB64(donnees)));
}

async function ecrire(donnees, stockage) {
  if (!session) throw new Error('coffre fermé');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await chiffrer(session.cle, iv, JSON.stringify(donnees));
  stockage.setItem(CLE, JSON.stringify({ v: 1, sel: session.sel, iterations: session.iterations, iv: b64(iv), donnees: chiffre }));
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
    const clair = await dechiffrer(cle, coffre.iv, coffre.donnees);
    session = { cle, sel: coffre.sel, iterations: coffre.iterations };
    return JSON.parse(clair);
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
export function fermer() {
  if (session && parApp()) app().postMessage({ op: 'fermer', jeton: session.cle }).catch(() => {});
  session = null;
}

/** Supprime le coffre (verrouillage retiré, ou tout effacer après un code oublié). */
export function supprimer(stockage = localStorage) {
  session = null;
  try { stockage.removeItem(CLE); } catch { /* stockage indisponible */ }
}
