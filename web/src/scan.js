// @ts-check
/**
 * Scan d'un certificat de prévoyance : lecture sur l'appareil, puis vérification par le conseiller.
 *
 * - Dans l'app iPhone / iPad : l'app ouvre le scanner de documents, ou reprend un certificat déjà enregistré (PDF ou
 *   image dans Fichiers, photo de la photothèque), lit le texte (texte du PDF, sinon reconnaissance de caractères de
 *   l'appareil) et, si l'appareil a un modèle de langage, lui fait remplir les champs. Elle rappelle
 *   `window.__prevoyanceScan({ texte, champs, lecteur })`.
 * - Dans un navigateur : le conseiller colle le texte du certificat, ou touche le champ puis « Scanner du texte » sur
 *   iPhone et iPad (la caméra insère le texte, sans rien envoyer).
 * Dans tous les cas, rien ne quitte l'appareil et rien n'entre dans le dossier sans validation.
 */

import { h } from './ui.js';
import { Certificat } from '../../moteur/src/index.js';

/** Libellé de chaque champ lu (clés de traduction du formulaire). */
const LIBELLES = { lppAvoir: 'avoir', lppRenteVieillesse: 'renteVieillesse', lppRenteInvalidite: 'renteInvalidite', lppRenteConjoint: 'renteConjoint',
  lppCapitalDeces: 'capitalDeces', lppRachat: 'rachatPossible', revenu: 'revenu' };

const pont = () => /** @type {any} */ (window).webkit?.messageHandlers?.scanner ?? null;

/**
 * Ouvre le scan pour une personne du dossier.
 * @param {any} ctx @param {(cle: string, valeur: number) => void} reprendre appelé pour chaque champ validé
 */
export function ouvrir(ctx, reprendre) {
  const { t, f } = ctx;
  const natif = pont();
  const zone = h('textarea', { rows: 7, placeholder: t('sc_coller'), autocomplete: 'off', spellcheck: 'false' });
  const resultats = h('div', { class: 'scan-resultats' });
  const etat = h('p', { class: 'petit' }, t(natif ? 'sc_aideApp' : 'sc_aideWeb'));
  const valider = h('button', { type: 'button', class: 'bouton', disabled: true }, t('sc_reprendre'));
  /** @type {Record<string, {valeur: number, ligne: string}>} */ let champs = {};

  const montrer = lecteur => {
    const cles = Object.keys(champs);
    valider.disabled = !cles.length;
    etat.textContent = cles.length ? t('sc_trouves', { n: cles.length, l: t(lecteur === 'modele' ? 'sc_parModele' : 'sc_parRegles') }) : t('sc_rien');
    resultats.replaceChildren(...cles.map(cle => {
      const champ = champs[cle];
      const coche = h('input', { type: 'checkbox', checked: true, 'data-cle': cle });
      const valeur = h('input', { type: 'text', inputmode: 'numeric', value: f.nombre(champ.valeur), 'data-valeur': cle,
        oninput: e => { e.target.value = e.target.value.replace(/[^\d]/g, ''); } });
      return h('label', { class: 'scan-ligne' }, coche, h('span', {}, h('b', {}, t(LIBELLES[cle])), champ.ligne ? h('small', {}, champ.ligne.slice(0, 90)) : null),
        h('div', { class: 'montant' }, valeur));
    }));
  };
  const lire = () => { champs = Certificat.extraire(zone.value).champs; montrer('regles'); };
  zone.addEventListener('input', lire);

  // dans l'app, la barre d'onglets native se retire le temps de la fenêtre
  const barre = visible => /** @type {any} */ (window).webkit?.messageHandlers?.onglet?.postMessage({ visible });
  const fermer = () => { delete /** @type {any} */ (window).__prevoyanceScan; boite.close(); boite.remove(); barre(true); };
  valider.addEventListener('click', () => {
    for (const coche of /** @type {NodeListOf<HTMLInputElement>} */ (resultats.querySelectorAll('input[type=checkbox]'))) {
      if (!coche.checked) continue;
      const cle = /** @type {string} */ (coche.dataset.cle);
      const saisi = /** @type {HTMLInputElement} */ (resultats.querySelector(`[data-valeur=${cle}]`)).value.replace(/[^\d]/g, '');
      if (saisi !== '') reprendre(cle, +saisi);
    }
    fermer();
  });

  const demander = quoi => () => { etat.textContent = t('sc_enCours'); natif.postMessage(quoi); };
  const scanner = natif ? h('button', { type: 'button', class: 'bouton', onclick: demander('certificat') }, t('sc_photographier')) : null;
  // certificat déjà enregistré : un PDF ou une image dans Fichiers, ou une photo de la photothèque
  const existants = natif ? h('div', { class: 'scan-sources' },
    h('button', { type: 'button', class: 'pastille', onclick: demander('fichier') }, t('sc_fichier')),
    h('button', { type: 'button', class: 'pastille', onclick: demander('photo') }, t('sc_photo'))) : null;
  const boite = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'scan' },
    h('h2', {}, t('sc_titre')), h('p', { class: 'note' }, t('sc_prive')),
    scanner, existants, zone, etat, resultats,
    h('div', { class: 'scan-actions' }, h('button', { type: 'button', class: 'pastille', onclick: fermer }, t('sc_annuler')), valider)));
  boite.addEventListener('cancel', fermer);

  // réponse de l'app : texte lu, et champs remplis par le modèle de langage de l'appareil quand il existe
  /** @type {any} */ (window).__prevoyanceScan = reponse => {
    if (reponse?.erreur === 'annulé') { etat.textContent = t('sc_aideApp'); return; }
    if (!reponse || reponse.erreur) { etat.textContent = t('sc_echec'); return; }
    zone.value = reponse.texte ?? '';
    const lus = Certificat.extraire(zone.value).champs;
    const duModele = reponse.champs ? Certificat.normaliser(reponse.champs) : {};
    champs = { ...lus, ...Object.fromEntries(Object.entries(duModele).map(([cle, c]) => [cle, { ...c, ligne: lus[cle]?.ligne ?? '' }])) };
    montrer(Object.keys(duModele).length ? 'modele' : 'regles');
  };
  document.body.append(boite);
  boite.showModal();
  barre(false);
  if (natif) scanner?.focus(); else zone.focus();
}
