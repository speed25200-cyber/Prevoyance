// @ts-check
/**
 * Portefeuille du conseiller : tous les dossiers de l'appareil, classés par ce qu'il reste à faire.
 *
 * Chaque dossier est analysé avec le même moteur que partout ailleurs (personne principale, règles de l'année
 * affichée, impôts de sa commune). En tête, ce que le portefeuille représente : couverture moyenne, 3a encore
 * déductible, rachats possibles, rentes et capitaux de risque à assurer. Ensuite la liste, du dossier le plus
 * urgent au plus tranquille, avec ce qui est ouvert et la prochaine échéance légale.
 * Les segments (invalidité, décès, retraite, 3a, rachat) ne gardent que les dossiers concernés, du plus gros
 * montant au plus petit : la liste d'une campagne, prête à exporter.
 * Rien n'est envoyé : tout est calculé ici ; les exports (CSV, agenda .ics) sont des fichiers écrits sur l'appareil.
 */

import { analyser, Impots, Vie } from '../../moteur/src/index.js';
import { etat, versDossier } from './etat.js';
import { h } from './ui.js';
import * as Partage from './partage.js';
import * as Agenda from './agenda.js';

/**
 * Résumé d'un dossier pour le portefeuille. `null` si le dossier ne se calcule pas (saisie incomplète).
 * @param {any} d @param {any} ctx @param {'personne'|'conjoint'} [cible]
 */
export function resumer(d, ctx, cible = 'personne') {
  try {
    const impots = Impots.localiser(ctx.impotsBase, ctx.communes, d.canton, { commune: d.commune ?? null, confession: d.confession ?? 'sans' });
    const moteur = versDossier(d, cible), a = analyser(moteur, ctx.regles, { impots });
    const r = a.risques, pire = x => Math.max(x.lacune, x.lacuneMax ?? 0);
    const invalidite = Math.max(pire(r.invaliditeMaladie), pire(r.invaliditeAccident));
    const deces = Math.max(r.decesMaladie.capital ?? 0, r.decesAccident.capital ?? 0);
    const route = Vie.feuilleDeRoute(moteur, ctx.regles, { impots });
    return { id: d.id, nom: d.nom, canton: d.canton, modifie: d.modifie, score: a.score,
      retraite: r.retraite.lacuneMensuelle, invalidite: Math.round(invalidite / 12), renteAAssurer: invalidite, deces,
      potentiel3a: a.potentiels.pilier3a.potentiel, rachat: a.potentiels.rachatLPP.possible,
      echeance: route[0] ? { cle: route[0].cle, annee: route[0].annee } : null,
      // priorité : la couverture qui manque, puis les risques ouverts (ils ne peuvent pas attendre)
      priorite: (100 - a.score) + (invalidite > 0 ? 25 : 0) + (deces > 0 ? 20 : 0) };
  } catch {
    return null;
  }
}

/** Le portefeuille entier : un résumé par dossier (les plus urgents d'abord) et les totaux. */
export function calculer(ctx) {
  const lignes = etat.dossiers.map(d => ({ d, x: resumer(d, ctx) }));
  const valides = lignes.filter(l => l.x).map(l => /** @type {NonNullable<ReturnType<typeof resumer>>} */ (l.x));
  valides.sort((p, q) => q.priorite - p.priorite);
  const total = cle => valides.reduce((s, x) => s + (x[cle] || 0), 0);
  return { dossiers: valides, incomplets: lignes.filter(l => !l.x).map(l => l.d),
    totaux: { nombre: etat.dossiers.length, couverture: valides.length ? Math.round(total('score') / valides.length) : 0,
              potentiel3a: total('potentiel3a'), rachats: total('rachat'), rente: total('renteAAssurer'), capital: total('deces') } };
}

/**
 * Ce qui est ouvert dans un dossier, du plus pressant au moins pressant : `[ton, phrase]`.
 * @param {NonNullable<ReturnType<typeof resumer>>} x @param {{t: any, f: any}} ctx
 */
export function raisons(x, { t, f }) {
  const liste = [];
  if (x.invalidite > 0) liste.push(['critique', t('pf_r_invalidite', { m: f.chf(x.invalidite) })]);
  if (x.deces > 0) liste.push(['critique', t('pf_r_deces', { m: f.chf(x.deces) })]);
  if (x.retraite > 0) liste.push(['attention', t('pf_r_retraite', { m: f.chf(x.retraite) })]);
  if (x.potentiel3a > 0) liste.push(['opportunite', t('pf_r_3a', { m: f.chf(x.potentiel3a) })]);
  if (x.rachat > 0) liste.push(['opportunite', t('pf_r_rachat', { m: f.chf(x.rachat) })]);
  return liste.length ? liste : [['info', t('pf_r_ok')]];
}

/**
 * Les segments : pour chacun, le montant qui le définit dans un dossier (0 : le dossier n'en fait pas partie) et le
 * libellé du total. « tous » garde l'ordre de priorité.
 */
export const SEGMENTS = [
  { cle: 'tous', montant: () => 1, total: '' },
  { cle: 'invalidite', montant: x => x.renteAAssurer, total: 'pf_rente' },
  { cle: 'deces', montant: x => x.deces, total: 'pf_capital' },
  { cle: 'retraite', montant: x => x.retraite, total: 'pf_retraites' },
  { cle: '3a', montant: x => x.potentiel3a, total: 'pf_potentiel3a' },
  { cle: 'rachat', montant: x => x.rachat, total: 'pf_rachats' },
];

/** Les dossiers d'un segment, du plus gros montant au plus petit (« tous » : par priorité). */
export function segment(portefeuille, cle) {
  const s = SEGMENTS.find(x => x.cle === cle) ?? SEGMENTS[0];
  const dossiers = portefeuille.dossiers.filter(x => s.montant(x) > 0);
  if (s.cle !== 'tous') dossiers.sort((p, q) => s.montant(q) - s.montant(p));
  return { ...s, dossiers, somme: s.cle === 'tous' ? 0 : dossiers.reduce((n, x) => n + s.montant(x), 0) };
}

/** Fichier CSV d'une liste de dossiers (séparateur « ; », lisible par Excel). */
export function enCSV(portefeuille, { t }) {
  const cellule = v => { const s = String(v ?? '').replace(/[;\r\n]+/g, ' '); return /^[=+\-@]/.test(s) ? `'${s}` : s; };
  const lignes = portefeuille.dossiers.map(x => [x.nom || '—', x.canton, x.score, x.retraite, x.invalidite, x.deces, x.potentiel3a, x.rachat, String(x.modifie ?? '').slice(0, 10)].map(cellule).join(';'));
  return '﻿' + [t('pf_csv_tete'), ...lignes].join('\r\n') + '\r\n';
}

/** Remet le portefeuille en tableau (« csv ») ou les échéances de tous les dossiers pour l'agenda (« ics »). */
export function exporter(quoi, ctx, dossiers = calculer(ctx).dossiers) {
  if (quoi === 'ics') {
    const ids = new Set(dossiers.map(x => String(x.id)));
    Partage.fichier('echeances.ics', Agenda.enICS(Agenda.echeances(etat.dossiers.filter(d => ids.has(String(d.id))), ctx), ctx), 'text/calendar;charset=utf-8');
  } else Partage.fichier('portefeuille.csv', enCSV({ dossiers }, ctx), 'text/csv;charset=utf-8');
}

/**
 * Ouvre le portefeuille par-dessus l'écran.
 * @param {any} ctx @param {{ouvrir: (id: string) => void}} gestes
 */
export function ouvrir(ctx, { ouvrir: ouvrirDossier }) {
  if (document.querySelector('dialog.portefeuille-vue')) return;
  const { t, f } = ctx, p = calculer(ctx);
  const chiffre = (nom, valeur) => h('div', { class: 'chiffre' }, h('small', {}, nom), h('b', {}, valeur));
  const tour = 2 * Math.PI * 17;
  const anneau = score => {
    const e = h('span', { class: 'pf-score' }, h('b', {}, String(score)));
    e.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle cx="20" cy="20" r="17" stroke-dasharray="${(tour * score / 100).toFixed(1)} ${tour.toFixed(1)}"/></svg>`);
    return e;
  };
  const boite = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'portefeuille-vue', 'aria-label': t('pf_titre') }));
  const fermer = () => { boite.close(); boite.remove(); };
  let choisi = segment(p, 'tous');
  const liste = h('ol', { class: 'pf-liste' }), bilan = h('p', { class: 'pf-bilan', role: 'status' }, '');
  const puces = h('div', { class: 'pf-segments', role: 'group', 'aria-label': t('pf_s_aide') }, ...SEGMENTS.map(s => {
    const n = segment(p, s.cle).dossiers.length;
    return h('button', { type: 'button', class: 'pastille', 'data-segment': s.cle, 'aria-pressed': String(s.cle === 'tous'), disabled: n === 0 && s.cle !== 'tous',
      onclick: () => { choisi = segment(p, s.cle); lister(); } }, t('pf_s_' + s.cle), h('i', {}, String(n)));
  }));
  /** La liste suit le segment choisi ; les exports aussi. */
  function lister() {
    for (const b of puces.children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.segment === choisi.cle));
    bilan.textContent = choisi.cle === 'tous' ? '' : t('pf_segment', { n: choisi.dossiers.length, l: t(choisi.total), m: f.chf(choisi.somme) });
    liste.replaceChildren(...choisi.dossiers.map((x, i) => h('li', { style: { '--i': i } },
      anneau(x.score),
      h('div', { class: 'pf-corps' },
        h('b', {}, x.nom || t('sansNom')), h('small', {}, [x.canton, x.echeance ? t('pf_echeance', { a: x.echeance.annee }) : ''].filter(Boolean).join(' · ')),
        h('ul', { class: 'pf-raisons' }, ...raisons(x, ctx).slice(0, 4).map(([ton, texte]) => h('li', { style: { '--c': `var(--${ton})` } }, texte)))),
      h('button', { type: 'button', class: 'pastille', onclick: () => { fermer(); ouvrirDossier(x.id); } }, t('pf_ouvrir')))),
      ...(choisi.cle === 'tous' ? p.incomplets : []).map(d => h('li', { class: 'incomplet' }, h('span', { class: 'pf-score' }, h('b', {}, '–')),
        h('div', { class: 'pf-corps' }, h('b', {}, d.nom || t('sansNom')), h('small', {}, t('pf_incomplet'))),
        h('button', { type: 'button', class: 'pastille', onclick: () => { fermer(); ouvrirDossier(d.id); } }, t('pf_ouvrir')))));
  }
  boite.append(
    h('header', { class: 'pf-tete' }, h('div', {}, h('h2', {}, t('pf_titre')), h('p', {}, t('pf_d'))),
      h('div', { class: 'pf-gestes' },
        h('button', { type: 'button', class: 'pastille', title: t('ag_aide'), onclick: () => exporter('ics', ctx, choisi.dossiers) }, t('ag_bouton')),
        h('button', { type: 'button', class: 'pastille', onclick: () => exporter('csv', ctx, choisi.dossiers) }, t('pf_csv')),
        h('button', { type: 'button', class: 'pastille', onclick: fermer }, t('pf_fermer')))),
    h('div', { class: 'chiffres pf-totaux' },
      chiffre(t('pf_dossiers'), String(p.totaux.nombre)), chiffre(t('pf_couvertureMoyenne'), `${p.totaux.couverture} / 100`),
      chiffre(t('pf_potentiel3a'), f.chf(p.totaux.potentiel3a)), chiffre(t('pf_rachats'), f.chf(p.totaux.rachats)),
      chiffre(t('pf_rente'), f.chf(p.totaux.rente)), chiffre(t('pf_capital'), f.chf(p.totaux.capital))),
    etat.dossiers.length < 2 ? h('p', { class: 'petit' }, t('pf_vide')) : '',
    puces, bilan, liste);
  lister();
  boite.addEventListener('click', e => { if (e.target === boite) fermer(); });
  boite.addEventListener('cancel', e => { e.preventDefault(); fermer(); });
  document.body.append(boite);
  boite.showModal();
}
