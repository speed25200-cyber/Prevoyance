// @ts-check
/**
 * Description du formulaire pour l'app iPhone / iPad.
 *
 * Pendant que le formulaire se construit, chaque champ se décrit ici (nature, libellé, valeur, choix possibles) et
 * dépose l'action qui enregistre sa valeur. L'app dessine alors le dossier avec ses propres composants (champs,
 * sélecteurs, dates, interrupteurs du système) et rappelle `agir(id, valeur)` : une seule logique de saisie, deux
 * affichages. Hors de l'app, rien n'est collecté.
 *
 * @typedef {{type: 'montant'|'texte'|'long'|'choix'|'date'|'bascule'|'compteur'|'curseur'|'action'|'note', libelle: string, valeur?: any,
 *            indication?: string, note?: string, facultatif?: boolean, options?: {v: string, l: string}[], min?: number, max?: number,
 *            pas?: number, etiquettes?: string[], icone?: string}} Champ
 */

/** @type {(Champ & {id: string})[]|null} */ let liste = null;
/** @type {Map<string, (valeur: any) => void>} */ const actions = new Map();
let numero = 0;

/** L'app est-elle là pour dessiner le formulaire ? */
export const active = () => !!(/** @type {any} */ (globalThis).webkit?.messageHandlers?.onglet);

/** Début d'une construction du formulaire : les anciens champs sont oubliés. */
export function commencer() {
  liste = active() ? [] : null;
  actions.clear();
  numero = 0;
}

/** Un champ se décrit. @param {Champ} champ @param {(valeur: any) => void} [action] */
export function decrire(champ, action = () => {}) {
  if (!liste) return;
  const id = `c${numero++}`;
  actions.set(id, action);
  liste.push({ ...champ, id });
}

/** Les champs décrits depuis le dernier appel (ceux d'une rubrique). */
export const prendre = () => (liste ? liste.splice(0) : []);

/** L'app a changé une valeur. */
export function agir(id, valeur) {
  actions.get(id)?.(valeur);
}
