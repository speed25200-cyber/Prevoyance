// @ts-check
/**
 * Remettre un texte ou un fichier préparé par la page (demande d'offre, portefeuille, échéances).
 *
 * Dans l'app iPhone / iPad : la feuille de partage d'iOS (Copier, Mail, Messages, Fichiers…), par le pont « partager »
 * (ios/Prevoyance/Ecran.swift) ; un agenda .ics s'ajoute au calendrier en l'ouvrant depuis Fichiers ou un courriel.
 * Dans un navigateur : le presse-papiers pour un texte, un téléchargement pour un fichier.
 * Rien n'est envoyé nulle part : l'utilisateur choisit où va le contenu.
 */

const pont = () => /** @type {any} */ (globalThis).webkit?.messageHandlers?.partager ?? null;

/** Vrai dans l'app iPhone / iPad (le libellé du bouton devient « Partager »). */
export const dansApp = () => !!pont();

/**
 * Remet un texte. @param {string} contenu
 * @returns {Promise<'partage'|'copie'|'refus'>} ce qui s'est passé : feuille de partage ouverte, texte copié, ou refus du navigateur
 */
export async function texte(contenu) {
  const app = pont();
  if (app) { app.postMessage({ texte: contenu }); return 'partage'; }
  try { await navigator.clipboard.writeText(contenu); return 'copie'; } catch { return 'refus'; }
}

/**
 * Remet un fichier de texte (CSV, agenda .ics). @param {string} nom @param {string} contenu @param {string} [type]
 */
export function fichier(nom, contenu, type = 'text/plain;charset=utf-8') {
  const app = pont();
  if (app) { app.postMessage({ nom, contenu }); return; }
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
}
