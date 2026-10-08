// @ts-check
/**
 * Palette de commandes (Ctrl + K, ou « / ») : aller à une page, à une rubrique du dossier, à un autre dossier,
 * ou lancer une action, sans quitter le clavier. La liste est fournie par l'application à chaque ouverture :
 * elle reflète toujours la langue, les dossiers et l'état du moment.
 */

import { h } from './ui.js';

/** Sans accents ni majuscules, pour chercher « resistance » et trouver « Test de résistance ». */
const simple = texte => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * @param {() => {titre: string, groupe: string, touche?: string, faire: () => void}[]} entrees
 * @param {(cle: string) => string} t
 */
export function installer(entrees, t) {
  /** @type {HTMLDialogElement|null} */ let boite = null;
  let choisi = 0, visibles = /** @type {ReturnType<typeof entrees>} */ ([]);

  function fermer() { boite?.close(); boite?.remove(); boite = null; }

  function ouvrir() {
    if (boite) return;
    const toutes = entrees();
    const champ = /** @type {HTMLInputElement} */ (h('input', { type: 'text', placeholder: t('pa_chercher'), 'aria-label': t('pa_chercher'), autocomplete: 'off', spellcheck: 'false' }));
    const liste = h('div', { class: 'palette-liste', role: 'listbox' });
    boite = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'palette', 'aria-label': t('pa_chercher') },
      h('div', { class: 'palette-champ' }, h('span', { class: 'palette-loupe', 'aria-hidden': 'true' }), champ, h('kbd', {}, 'Esc')),
      liste,
      h('p', { class: 'palette-aide' }, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' ', t('pa_naviguer'), '  ·  ', h('kbd', {}, '↵'), ' ', t('pa_ouvrir'))));

    const dessiner = () => {
      const q = simple(champ.value.trim());
      visibles = q ? toutes.filter(e => q.split(/\s+/).every(mot => simple(e.titre + ' ' + e.groupe).includes(mot))) : toutes;
      choisi = Math.min(choisi, Math.max(0, visibles.length - 1));
      /** @type {Node[]} */ const noeuds = [];
      let groupe = '';
      visibles.forEach((e, i) => {
        if (e.groupe !== groupe) { groupe = e.groupe; noeuds.push(h('p', { class: 'palette-groupe' }, groupe)); }
        noeuds.push(h('button', { type: 'button', role: 'option', class: 'palette-entree', 'aria-selected': String(i === choisi),
          onclick: () => executer(i), onpointermove: () => { if (choisi !== i) { choisi = i; marquer(); } } },
          h('span', {}, e.titre), e.touche ? h('kbd', {}, e.touche) : ''));
      });
      if (!visibles.length) noeuds.push(h('p', { class: 'palette-vide' }, t('pa_rien')));
      liste.replaceChildren(...noeuds);
    };
    const marquer = () => {
      [...liste.querySelectorAll('.palette-entree')].forEach((b, i) => {
        b.setAttribute('aria-selected', String(i === choisi));
        if (i === choisi) b.scrollIntoView({ block: 'nearest' });
      });
    };
    const executer = i => { const e = visibles[i]; fermer(); e?.faire(); };

    champ.addEventListener('input', () => { choisi = 0; dessiner(); });
    boite.addEventListener('keydown', evenement => {
      if (evenement.key === 'ArrowDown') { choisi = Math.min(visibles.length - 1, choisi + 1); marquer(); evenement.preventDefault(); }
      else if (evenement.key === 'ArrowUp') { choisi = Math.max(0, choisi - 1); marquer(); evenement.preventDefault(); }
      else if (evenement.key === 'Enter') { executer(choisi); evenement.preventDefault(); }
      evenement.stopPropagation();          // les raccourcis de l'application ne s'appliquent pas pendant la recherche
    });
    boite.addEventListener('cancel', evenement => { evenement.preventDefault(); fermer(); });
    boite.addEventListener('pointerdown', evenement => { if (evenement.target === boite) fermer(); });   // clic sur le voile
    document.body.append(boite);
    choisi = 0;
    dessiner();
    boite.showModal();
    champ.focus();
  }

  document.addEventListener('keydown', evenement => {
    const dansChamp = /** @type {HTMLElement} */ (evenement.target).closest?.('input, textarea, select, [contenteditable]');
    if ((evenement.key === 'k' || evenement.key === 'K') && (evenement.ctrlKey || evenement.metaKey)) { evenement.preventDefault(); boite ? fermer() : ouvrir(); }
    else if (evenement.key === '/' && !dansChamp && !evenement.ctrlKey && !evenement.metaKey && !evenement.altKey) { evenement.preventDefault(); ouvrir(); }
  });
  return { ouvrir, fermer };
}
