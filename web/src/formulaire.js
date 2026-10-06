// @ts-check
/**
 * Le dossier du client : portefeuille (choisir, créer, dupliquer, supprimer, exporter, importer) et saisie.
 * Le formulaire n'est reconstruit que lorsque sa structure change (langue, conjoint, enfants, activité, dossier) ;
 * une frappe ne fait que mettre l'état à jour et relancer le calcul.
 */

import { h, $ } from './ui.js';
import { etat, garder, dossier, nouveauDossier, supprimerDossier, dupliquerDossier, dossierVide, dossierExemple, CANTONS, aujourdhui } from './etat.js';

/** @type {{t: (c: string, v?: any) => string, f: any, apresChangement: () => void, reconstruire: () => void}} */
let ctx;

const lire = chemin => chemin.split('.').reduce((o, k) => o?.[k], dossier());
function ecrire(chemin, valeur) {
  const cles = chemin.split('.'), fin = /** @type {string} */ (cles.pop());
  const objet = cles.reduce((o, k) => (o[k] ??= {}), dossier());
  if (valeur === undefined) delete objet[fin]; else objet[fin] = valeur;
  dossier().modifie = new Date().toISOString();
  ctx.apresChangement();
}

function champMontant(chemin, cle, { facultatif = false } = {}) {
  const { t, f } = ctx, valeur = lire(chemin);
  const entree = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: valeur === undefined || valeur === '' ? '' : f.nombre(valeur),
    oninput: e => { const brut = e.target.value.replace(/[^\d]/g, ''); ecrire(chemin, brut === '' ? undefined : +brut); },
    onblur: e => { const v = lire(chemin); e.target.value = v === undefined ? '' : f.nombre(v); },
    onfocus: e => e.target.select() });
  return h('label', { class: 'champ' }, h('span', {}, t(cle), facultatif ? h('i', {}, t('facultatif')) : null), h('div', { class: 'montant' }, entree));
}

function champTexte(chemin, cle, indication = '') {
  return h('label', { class: 'champ' }, h('span', {}, ctx.t(cle)),
    h('input', { type: 'text', value: lire(chemin) ?? '', placeholder: indication, autocomplete: 'off', oninput: e => { ecrire(chemin, e.target.value); majTitre(); } }));
}

function champChoix(chemin, cle, valeurs, { structure = false, libelle = v => ctx.t(v === 'h' ? 'homme' : v === 'f' ? 'femme' : v) } = {}) {
  const select = h('select', { onchange: e => { ecrire(chemin, e.target.value); if (structure) construire(); } },
    ...valeurs.map(v => h('option', { value: v, selected: lire(chemin) === v }, libelle(v))));
  return h('label', { class: 'champ' }, h('span', {}, ctx.t(cle)), select);
}

const champDate = (chemin, cle) => h('label', { class: 'champ' }, h('span', {}, ctx.t(cle)),
  h('input', { type: 'date', value: lire(chemin) || '', min: '1940-01-01', max: aujourdhui(), onchange: e => e.target.value && ecrire(chemin, e.target.value) }));

const bascule = (chemin, cle, defaut, { structure = false } = {}) => h('label', { class: 'bascule' }, ctx.t(cle),
  h('input', { type: 'checkbox', checked: lire(chemin) ?? defaut, onchange: e => { ecrire(chemin, e.target.checked); if (structure) construire(); } }));

function compteur(cle, valeur, min, max, surChangement) {
  const pas = delta => () => { const v = Math.min(max, Math.max(min, valeur + delta)); if (v !== valeur) surChangement(v); };
  return h('div', { class: 'champ' }, h('span', {}, ctx.t(cle)),
    h('div', { class: 'compteur' }, h('button', { type: 'button', 'aria-label': '−', onclick: pas(-1) }, '−'), h('b', {}, String(valeur)),
      h('button', { type: 'button', 'aria-label': '+', onclick: pas(1) }, '+')));
}

export function curseur(chemin, cle, min, max, pas, afficher, { lecture = lire, ecriture = ecrire } = {}) {
  const sortie = h('output', {}, afficher(lecture(chemin)));
  const regler = el => el.style.setProperty('--part', `${(+el.value - min) / (max - min) * 100}%`);
  const entree = h('input', { type: 'range', min, max, step: pas, value: lecture(chemin),
    oninput: e => { const v = +e.target.value; sortie.textContent = afficher(v); regler(e.target); ecriture(chemin, v); } });
  regler(entree);
  return h('label', { class: 'champ curseur' }, h('span', {}, ctx.t(cle), sortie), entree);
}

const bloc = (cle, ouvert, ...champs) => h('details', { class: 'bloc', open: ouvert, 'data-bloc': cle }, h('summary', {}, ctx.t(cle)), h('div', { class: 'champs' }, ...champs));

/** Champs d'une personne (client ou conjoint) : identité, AVS, 2e pilier, 3e pilier. */
function champsPersonne(prefixe) {
  const p = lire(prefixe) ?? {}, independant = p.statut === 'independant', c = suite => `${prefixe}.${suite}`;
  return {
    identite: [
      h('div', { class: 'rangee' }, champDate(c('dateNaissance'), 'naissance'), champChoix(c('sexe'), 'sexe', ['h', 'f'])),
      champChoix(c('statut'), 'statut', ['salarie', 'independant', 'sans'], { structure: true }),
      champMontant(c('revenu'), 'revenu'),
      h('div', { class: 'rangee' },
        compteur('anneesManquantes', +p.anneesManquantes || 0, 0, 20, v => { ecrire(c('anneesManquantes'), v); construire(); }),
        champMontant(c('ramd'), 'ramd', { facultatif: true })),
    ],
    lpp: [
      ...(independant ? [bascule(c('lppAffilie'), 'affilie', false, { structure: true })] : []),
      ...(!independant || p.lppAffilie ? [
        champMontant(c('lppAvoir'), 'avoir', { facultatif: true }),
        h('div', { class: 'rangee' }, champMontant(c('lppRenteVieillesse'), 'renteVieillesse', { facultatif: true }),
          champMontant(c('lppRenteInvalidite'), 'renteInvalidite', { facultatif: true })),
        h('div', { class: 'rangee' }, champMontant(c('lppRenteConjoint'), 'renteConjoint', { facultatif: true }),
          champMontant(c('lppCapitalDeces'), 'capitalDeces', { facultatif: true })),
        champMontant(c('lppRachat'), 'rachatPossible', { facultatif: true }),
      ] : []),
      bascule(c('laa'), 'laa', !independant && p.statut !== 'sans'),
      bascule(c('ijm'), 'ijm', false),
    ],
    pilier3: [
      h('div', { class: 'rangee' }, champMontant(c('avoir3a'), 'avoir3a', { facultatif: true }), champMontant(c('versement3a'), 'versement3a', { facultatif: true })),
      h('div', { class: 'rangee' }, champMontant(c('avoir3b'), 'avoir3b', { facultatif: true }), champMontant(c('fortune'), 'fortune', { facultatif: true })),
      h('div', { class: 'rangee' }, champMontant(c('rentePrivee'), 'renteInvaliditePrivee', { facultatif: true }),
        champMontant(c('capitalDecesPrive'), 'capitalDecesPrive', { facultatif: true })),
    ],
  };
}

function majTitre() {
  const titre = document.querySelector('.portefeuille-nom');
  if (titre) titre.textContent = dossier().nom || ctx.t('sansNom');
}

/** Bandeau du portefeuille : dossier ouvert, liste, actions. */
function portefeuille() {
  const { t } = ctx, d = dossier();
  const importer = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    try {
      const lu = JSON.parse(await fichier.text());
      for (const x of Array.isArray(lu) ? lu : [lu]) if (x?.personne) nouveauDossier({ ...dossierVide(), ...x, id: Math.random().toString(36).slice(2, 10) });
      ctx.reconstruire();
    } catch { alert(t('importImpossible')); }
  } });
  const exporter = () => {
    const lien = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(dossier(), null, 2)], { type: 'application/json' })),
      download: `${(dossier().nom || 'dossier').replace(/[^\p{L}\p{N}]+/gu, '-')}.json` });
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
  };
  const liste = h('div', { class: 'portefeuille-liste' }, ...etat.dossiers.map(x => h('button', { type: 'button', class: x.id === d.id ? 'actif' : '',
    onclick: () => { etat.ouvert = x.id; garder(); ctx.reconstruire(); } },
    h('b', {}, x.nom || t('sansNom')), h('small', {}, new Date(x.modifie).toLocaleDateString(etat.langue + '-CH')))));
  const action = (cle, f, danger = false) => h('button', { type: 'button', class: 'pastille' + (danger ? ' danger' : ''), onclick: f }, t(cle));
  return h('details', { class: 'bloc portefeuille' },
    h('summary', {}, h('span', {}, h('small', {}, t('dossier')), h('b', { class: 'portefeuille-nom' }, d.nom || t('sansNom'))), h('em', {}, String(etat.dossiers.length))),
    h('div', { class: 'champs' }, liste,
      h('div', { class: 'pastilles' },
        action('nouveau', () => { nouveauDossier(); ctx.reconstruire(); }),
        action('exemple', () => { nouveauDossier(dossierExemple()); ctx.reconstruire(); }),
        action('dupliquer', () => { dupliquerDossier(d.id); ctx.reconstruire(); }),
        action('exporter', exporter), action('importer', () => importer.click()),
        action('supprimer', () => { if (confirm(t('confirmerSuppression'))) { supprimerDossier(d.id); ctx.reconstruire(); } }, true)),
      importer));
}

export function construire() {
  const { t } = ctx, d = dossier();
  const ouverts = Object.fromEntries([...document.querySelectorAll('#saisie .bloc[data-bloc]')].map(b => [/** @type {HTMLElement} */ (b).dataset.bloc, /** @type {HTMLDetailsElement} */ (b).open]));
  const ouvert = (cle, defaut) => ouverts[cle] ?? defaut;
  const client = champsPersonne('personne'), conjoint = d.avecConjoint ? champsPersonne('conjoint') : null;
  const blocs = [
    portefeuille(),
    bloc('client', ouvert('client', true), champTexte('nom', 'nomClient', t('nomClientIndication')),
      champChoix('canton', 'canton', CANTONS, { libelle: v => `${v} · ${t('ct_' + v)}` }), ...client.identite),
    bloc('menage', ouvert('menage', true),
      champChoix('etatCivil', 'etatCivil', ['celibataire', 'marie', 'partenariat', 'concubin', 'divorce', 'veuf']),
      compteur('enfants', d.enfants.length, 0, 6, n => { d.enfants = n > d.enfants.length ? [...d.enfants, 5] : d.enfants.slice(0, n); ctx.apresChangement(); construire(); }),
      ...d.enfants.map((_, i) => curseur(`enfants.${i}`, 'ageEnfant', 0, 24, 1, v => `${v} ${t('ans')}`)),
      bascule('avecConjoint', 'avecConjoint', false, { structure: true })),
    ...(conjoint ? [bloc('conjoint', ouvert('conjoint', false), ...conjoint.identite, h('p', { class: 'intertitre' }, t('lpp')), ...conjoint.lpp,
      h('p', { class: 'intertitre' }, t('pilier3')), ...conjoint.pilier3)] : []),
    bloc('lpp', ouvert('lpp', false), ...client.lpp),
    bloc('pilier3', ouvert('pilier3', false), ...client.pilier3),
    bloc('logement', ouvert('logement', false), h('div', { class: 'rangee' }, champMontant('bien.valeur', 'valeurBien', { facultatif: true }),
      champMontant('bien.dette', 'dette', { facultatif: true }))),
    bloc('besoins', ouvert('besoins', false),
      curseur('besoins.retraite', 'besoinRetraite', 0.5, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('besoins.invalidite', 'besoinInvalidite', 0.5, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('besoins.deces', 'besoinDeces', 0.4, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('ageRetraite', 'ageRetraite', 58, 70, 1, v => `${v} ${t('ans')}`)),
  ];
  blocs.forEach((b, i) => b.style.setProperty('--i', String(i)));
  $('saisie').replaceChildren(...blocs);
}

/** @param {typeof ctx} contexte */
export function initialiser(contexte) {
  ctx = contexte;
}
