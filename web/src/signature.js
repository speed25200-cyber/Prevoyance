// @ts-check
/**
 * Signature à la main sur l'écran (doigt, stylet ou souris) et logo de l'intermédiaire.
 *
 * - `zone` : un cadre où l'on signe ; le tracé est gardé en image (PNG transparent) dans le dossier, et repris sur le
 *   procès-verbal de conseil du rapport. Rien ne quitte l'appareil.
 * - `lireLogo` : réduit l'image choisie (logo du courtier ou de la compagnie) pour l'en-tête du rapport.
 */

import { h } from './ui.js';

const LARGEUR = 640, HAUTEUR = 220;

/**
 * @param {{libelle: string, effacer: string, valeur?: string, surChangement: (image: string) => void}} p
 * @returns {HTMLElement}
 */
export function zone({ libelle, effacer, valeur = '', surChangement }) {
  const toile = /** @type {HTMLCanvasElement} */ (h('canvas', { width: LARGEUR, height: HAUTEUR, role: 'img', 'aria-label': libelle }));
  const ctx = /** @type {CanvasRenderingContext2D} */ (toile.getContext('2d'));
  ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1322';
  if (valeur) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, LARGEUR, HAUTEUR); image.src = valeur; }
  let trace = false, avant = { x: 0, y: 0 };
  const point = e => { const b = toile.getBoundingClientRect(); return { x: (e.clientX - b.left) * LARGEUR / b.width, y: (e.clientY - b.top) * HAUTEUR / b.height }; };
  toile.addEventListener('pointerdown', e => {
    e.preventDefault();
    toile.setPointerCapture(e.pointerId);
    trace = true; avant = point(e);
    ctx.beginPath(); ctx.arc(avant.x, avant.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#0b1322'; ctx.fill();
  });
  toile.addEventListener('pointermove', e => {
    if (!trace) return;
    e.preventDefault();
    const p = point(e), milieu = { x: (avant.x + p.x) / 2, y: (avant.y + p.y) / 2 };
    ctx.beginPath(); ctx.moveTo(avant.x, avant.y); ctx.quadraticCurveTo(avant.x, avant.y, milieu.x, milieu.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    avant = p;
  });
  const finir = () => { if (!trace) return; trace = false; surChangement(toile.toDataURL('image/png')); };
  toile.addEventListener('pointerup', finir);
  toile.addEventListener('pointercancel', finir);
  return h('div', { class: 'signature' },
    h('div', { class: 'signature-tete' }, h('span', {}, libelle),
      h('button', { type: 'button', class: 'pastille', onclick: () => { ctx.clearRect(0, 0, LARGEUR, HAUTEUR); surChangement(''); } }, effacer)),
    toile);
}

/**
 * Lit une image choisie par l'utilisateur et la ramène à 520 x 180 points au plus (PNG).
 * @param {File} fichier @returns {Promise<string>} adresse de données, ou '' si l'image n'a pas pu être lue
 */
export function lireLogo(fichier) {
  return new Promise(resoudre => {
    const lecteur = new FileReader();
    lecteur.onerror = () => resoudre('');
    lecteur.onload = () => {
      const image = new Image();
      image.onerror = () => resoudre('');
      image.onload = () => {
        const echelle = Math.min(1, 520 / image.naturalWidth, 180 / image.naturalHeight);
        const toile = document.createElement('canvas');
        toile.width = Math.max(1, Math.round(image.naturalWidth * echelle)); toile.height = Math.max(1, Math.round(image.naturalHeight * echelle));
        /** @type {CanvasRenderingContext2D} */ (toile.getContext('2d')).drawImage(image, 0, 0, toile.width, toile.height);
        resoudre(toile.toDataURL('image/png'));
      };
      image.src = String(lecteur.result);
    };
    lecteur.readAsDataURL(fichier);
  });
}
