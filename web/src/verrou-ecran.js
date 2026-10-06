// @ts-check
/**
 * Écrans du verrouillage : la demande du code à l'ouverture, et la carte « Sécurité » du dossier (activer, verrouiller,
 * retirer). Le chiffrement lui-même est dans verrou.js ; ce qui est chiffré est décidé dans etat.js.
 */

import { h } from './ui.js';
import * as Verrou from './verrou.js';
import { deverrouiller, activerVerrou, retirerVerrou, effacerTout } from './etat.js';

/** Bloque l'application derrière la demande du code ; se résout quand le coffre est ouvert. */
export function demander(t) {
  return new Promise(resoudre => {
    let echecs = 0;
    const code = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': t('sv_saisir'), placeholder: t('sv_saisir') });
    const message = h('p', { class: 'petit', role: 'alert' }, '');
    const bouton = h('button', { type: 'submit', class: 'bouton' }, t('sv_ouvrir'));
    const formulaire = h('form', { class: 'verrou-carte' },
      h('img', { src: 'images/icone-192.png', alt: '', width: 72, height: 72 }),
      h('h1', {}, t('sv_titre')), h('p', { class: 'note' }, t('sv_explication')), code, bouton, message,
      h('button', { type: 'button', class: 'lien', onclick: () => { if (confirm(t('sv_effacerConfirmer'))) { effacerTout(); location.reload(); } } }, t('sv_effacer')));
    const ecran = h('div', { class: 'verrou', role: 'dialog', 'aria-modal': 'true' }, formulaire);
    formulaire.addEventListener('submit', async e => {
      e.preventDefault();
      if (!code.value) return;
      bouton.disabled = true;
      // chaque échec allonge l'attente : un code ne se devine pas par essais rapides
      if (echecs) await new Promise(r => setTimeout(r, Math.min(8000, 400 * 2 ** echecs)));
      const ok = await deverrouiller(code.value);
      bouton.disabled = false;
      if (!ok) { echecs += 1; message.textContent = t('sv_faux'); code.value = ''; code.focus(); return; }
      ecran.remove();
      resoudre(true);
    });
    document.body.append(ecran);
    code.focus();
  });
}

/** Champs de la carte « Sécurité ». */
export function champs(ctx, reconstruire) {
  const { t } = ctx;
  if (!Verrou.disponible()) return [h('p', { class: 'note' }, t('sv_indisponible'))];
  const message = h('p', { class: 'petit', role: 'alert' }, '');
  if (Verrou.actif()) {
    return [
      h('p', { class: 'note' }, t('sv_actif')), h('p', { class: 'petit sans-marge' }, t('sv_oubli')),
      h('div', { class: 'pastilles' },
        h('button', { type: 'button', class: 'pastille', onclick: () => { Verrou.fermer(); location.reload(); } }, t('sv_verrouiller')),
        h('button', { type: 'button', class: 'pastille danger', onclick: () => { if (confirm(t('sv_retirerConfirmer'))) { retirerVerrou(); reconstruire(); } } }, t('sv_retirer'))),
      message,
    ];
  }
  const code = h('input', { type: 'password', autocomplete: 'new-password' }), encore = h('input', { type: 'password', autocomplete: 'new-password' });
  const activer = h('button', { type: 'button', class: 'bouton', onclick: async () => {
    if (code.value.length < Verrou.LONGUEUR_MIN) { message.textContent = t('sv_court', { n: Verrou.LONGUEUR_MIN }); return; }
    if (code.value !== encore.value) { message.textContent = t('sv_differents'); return; }
    activer.disabled = true;
    try { await activerVerrou(code.value); reconstruire(); } catch { message.textContent = t('sv_indisponible'); activer.disabled = false; }
  } }, t('sv_activer'));
  return [
    h('p', { class: 'note' }, t('sv_aide')),
    h('label', { class: 'champ' }, h('span', {}, t('sv_code', { n: Verrou.LONGUEUR_MIN })), code),
    h('label', { class: 'champ' }, h('span', {}, t('sv_confirmer')), encore),
    activer, message, h('p', { class: 'petit' }, t('sv_oubli')),
  ];
}
