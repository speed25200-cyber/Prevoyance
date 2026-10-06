// @ts-check
/**
 * Le dossier du client : portefeuille (choisir, créer, dupliquer, supprimer, exporter, importer) et saisie.
 * Le formulaire n'est reconstruit que lorsque sa structure change (langue, conjoint, enfants, activité, dossier) ;
 * une frappe ne fait que mettre l'état à jour et relancer le calcul.
 */

import { h, $ } from './ui.js';
import * as Collecte from './collecte.js';
import * as Scan from './scan.js';
import * as Conformite from './conformite.js';
import * as EcranVerrou from './verrou-ecran.js';
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
  Collecte.decrire({ type: 'montant', libelle: t(cle), valeur: valeur === undefined || valeur === '' ? null : +valeur, facultatif },
    v => ecrire(chemin, v === null || v === undefined || v === '' ? undefined : Math.max(0, Math.round(+v))));
  const entree = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: valeur === undefined || valeur === '' ? '' : f.nombre(valeur),
    oninput: e => { const brut = e.target.value.replace(/[^\d]/g, ''); ecrire(chemin, brut === '' ? undefined : +brut); },
    onblur: e => { const v = lire(chemin); e.target.value = v === undefined ? '' : f.nombre(v); },
    onfocus: e => e.target.select() });
  return h('label', { class: 'champ' }, h('span', {}, t(cle), facultatif ? h('i', {}, t('facultatif')) : null), h('div', { class: 'montant' }, entree));
}

function champTexte(chemin, cle, indication = '') {
  Collecte.decrire({ type: 'texte', libelle: ctx.t(cle), valeur: lire(chemin) ?? '', indication }, v => { ecrire(chemin, String(v ?? '')); majTitre(); });
  return h('label', { class: 'champ' }, h('span', {}, ctx.t(cle)),
    h('input', { type: 'text', value: lire(chemin) ?? '', placeholder: indication, autocomplete: 'off', oninput: e => { ecrire(chemin, e.target.value); majTitre(); } }));
}

function champChoix(chemin, cle, valeurs, { structure = false, libelle = v => ctx.t(v === 'h' ? 'homme' : v === 'f' ? 'femme' : v) } = {}) {
  Collecte.decrire({ type: 'choix', libelle: ctx.t(cle), valeur: lire(chemin) ?? valeurs[0], options: valeurs.map(v => ({ v, l: libelle(v) })) },
    v => { ecrire(chemin, v); if (structure) construire(); });
  const select = h('select', { onchange: e => { ecrire(chemin, e.target.value); if (structure) construire(); } },
    ...valeurs.map(v => h('option', { value: v, selected: lire(chemin) === v }, libelle(v))));
  return h('label', { class: 'champ' }, h('span', {}, ctx.t(cle)), select);
}

/** Commune de domicile : on tape un numéro postal ou un nom, la liste propose les localités du canton. */
function champCommune() {
  const { t } = ctx, d = dossier(), id = 'liste-communes';
  const liste = h('datalist', { id });
  const communes = () => ctx.communes?.cantons?.[d.canton] ?? [];
  const remplir = () => { if (!liste.childElementCount) liste.replaceChildren(...communes().flatMap(c => c.l.map(l => h('option', { value: l })))); };
  const trouver = texte => { const v = texte.trim().toLowerCase(); return v ? communes().find(c => c.l.some(l => l.toLowerCase() === v)) ?? communes().find(c => c.n.toLowerCase() === v) ?? null : null; };
  const note = h('i', {}, d.commune ? '' : t('communeDefaut', { l: ctx.impotsBase?.cantons?.[d.canton]?.lieu ?? '' }));
  Collecte.decrire({ type: 'texte', libelle: t('commune'), valeur: d.communeTexte ?? '', indication: t('communeIndication'), note: note.textContent ?? '' },
    v => { const c = trouver(String(v ?? '')); d.communeTexte = String(v ?? ''); ecrire('commune', c ? c.b : null); });
  return h('label', { class: 'champ' }, h('span', {}, t('commune'), note), liste,
    h('input', { type: 'text', list: id, value: d.communeTexte ?? '', placeholder: t('communeIndication'), autocomplete: 'off', onfocus: remplir,
      oninput: e => { const c = trouver(e.target.value); d.communeTexte = e.target.value; note.textContent = c ? '' : t('communeDefaut', { l: ctx.impotsBase?.cantons?.[d.canton]?.lieu ?? '' }); ecrire('commune', c ? c.b : null); } }));
}

function champDate(chemin, cle) {
  Collecte.decrire({ type: 'date', libelle: ctx.t(cle), valeur: lire(chemin) || '' }, v => { if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) ecrire(chemin, v); });
  return h('label', { class: 'champ' }, h('span', {}, ctx.t(cle)),
    h('input', { type: 'date', value: lire(chemin) || '', min: '1940-01-01', max: aujourdhui(), onchange: e => e.target.value && ecrire(chemin, e.target.value) }));
}

function bascule(chemin, cle, defaut, { structure = false } = {}) {
  Collecte.decrire({ type: 'bascule', libelle: ctx.t(cle), valeur: !!(lire(chemin) ?? defaut) }, v => { ecrire(chemin, !!v); if (structure) construire(); });
  return h('label', { class: 'bascule' }, ctx.t(cle),
    h('input', { type: 'checkbox', checked: lire(chemin) ?? defaut, onchange: e => { ecrire(chemin, e.target.checked); if (structure) construire(); } }));
}

function compteur(cle, valeur, min, max, surChangement) {
  Collecte.decrire({ type: 'compteur', libelle: ctx.t(cle), valeur, min, max }, v => { const n = Math.min(max, Math.max(min, Math.round(+v))); if (n !== valeur) surChangement(n); });
  const pas = delta => () => { const v = Math.min(max, Math.max(min, valeur + delta)); if (v !== valeur) surChangement(v); };
  return h('div', { class: 'champ' }, h('span', {}, ctx.t(cle)),
    h('div', { class: 'compteur' }, h('button', { type: 'button', 'aria-label': '−', onclick: pas(-1) }, '−'), h('b', {}, String(valeur)),
      h('button', { type: 'button', 'aria-label': '+', onclick: pas(1) }, '+')));
}

export function curseur(chemin, cle, min, max, pas, afficher, { lecture = lire, ecriture = ecrire } = {}) {
  const pasN = Math.round((max - min) / pas);
  Collecte.decrire({ type: 'curseur', libelle: ctx.t(cle), valeur: +lecture(chemin), min, max, pas,
    etiquettes: Array.from({ length: pasN + 1 }, (_, i) => afficher(Math.round((min + i * pas) * 1000) / 1000)) }, v => ecriture(chemin, +v));
  const sortie = h('output', {}, afficher(lecture(chemin)));
  const regler = el => el.style.setProperty('--part', `${(+el.value - min) / (max - min) * 100}%`);
  const entree = h('input', { type: 'range', min, max, step: pas, value: lecture(chemin),
    oninput: e => { const v = +e.target.value; sortie.textContent = afficher(v); regler(e.target); ecriture(chemin, v); } });
  regler(entree);
  return h('label', { class: 'champ curseur' }, h('span', {}, ctx.t(cle), sortie), entree);
}

/** Rubriques décrites pour l'app pendant la construction (voir collecte.js). */
let rubriquesDecrites = [];
/** Appelé quand le formulaire vient d'être reconstruit : l'app redessine le dossier. */
let surSchema = /** @type {(schema: any) => void} */ (() => {});
export const quandSchema = f => { surSchema = f; };
export const agir = (id, valeur) => Collecte.agir(id, valeur);

function bloc(cle, ouvert, ...champs) {
  rubriquesDecrites.push({ cle, titre: ctx.t(cle), champs: Collecte.prendre() });
  return h('details', { class: 'bloc', open: ouvert, 'data-bloc': cle }, h('summary', {}, ctx.t(cle)), h('div', { class: 'champs' }, ...champs));
}

/** Champs d'une personne (client ou conjoint) : identité, AVS, 2e pilier, 3e pilier. */
function champsPersonne(prefixe) {
  const p = lire(prefixe) ?? {}, independant = p.statut === 'independant', c = suite => `${prefixe}.${suite}`;
  return {
    identite: () => [
      h('div', { class: 'rangee' }, champDate(c('dateNaissance'), 'naissance'), champChoix(c('sexe'), 'sexe', ['h', 'f'])),
      champChoix(c('statut'), 'statut', ['salarie', 'independant', 'sans'], { structure: true }),
      champMontant(c('revenu'), 'revenu'),
      h('div', { class: 'rangee' },
        compteur('anneesManquantes', +p.anneesManquantes || 0, 0, 20, v => { ecrire(c('anneesManquantes'), v); construire(); }),
        champMontant(c('ramd'), 'ramd', { facultatif: true })),
    ],
    lpp: () => [
      ...(independant ? [bascule(c('lppAffilie'), 'affilie', false, { structure: true })] : []),
      ...(!independant || p.lppAffilie ? [
        (Collecte.decrire({ type: 'action', libelle: ctx.t('sc_bouton'), icone: 'scan', options: [{ v: 'certificat', l: ctx.t('sc_photographier') },
          { v: 'fichier', l: ctx.t('sc_fichier') }, { v: 'photo', l: ctx.t('sc_photo') }] },
          source => Scan.direct(source, (cle, valeur) => ecrire(c(cle), valeur), construire)),
        h('button', { type: 'button', class: 'pastille scan-bouton', onclick: () => Scan.ouvrir(ctx, (cle, valeur) => { ecrire(c(cle), valeur); construire(); }) },
          h('span', { class: 'scan-icone', 'aria-hidden': 'true' }), ctx.t('sc_bouton'))),
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
    pilier3: () => [
      h('div', { class: 'rangee' }, champMontant(c('avoir3a'), 'avoir3a', { facultatif: true }), champMontant(c('versement3a'), 'versement3a', { facultatif: true })),
      h('div', { class: 'rangee' }, champMontant(c('avoir3b'), 'avoir3b', { facultatif: true }), champMontant(c('fortune'), 'fortune', { facultatif: true })),
      h('div', { class: 'rangee' }, champMontant(c('rentePrivee'), 'renteInvaliditePrivee', { facultatif: true }),
        champMontant(c('capitalDecesPrive'), 'capitalDecesPrive', { facultatif: true })),
    ],
  };
}

/** Sous-titre à l'intérieur d'une rubrique. */
function intertitre(texte) {
  Collecte.decrire({ type: 'titre', libelle: texte });
  return h('p', { class: 'intertitre' }, texte);
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

/** Rubrique du dossier affichée (elle reste la même quand le formulaire est reconstruit). */
let rubriqueOuverte = '';

export function construire() {
  const { t } = ctx, d = dossier();
  const ouverts = Object.fromEntries([...document.querySelectorAll('#saisie .bloc[data-bloc]')].map(b => [/** @type {HTMLElement} */ (b).dataset.bloc, /** @type {HTMLDetailsElement} */ (b).open]));
  const ouvert = (cle, defaut) => ouverts[cle] ?? defaut;
  // les trois groupes de champs d'une personne sont créés au moment où leur rubrique les demande
  const client = champsPersonne('personne'), conjoint = d.avecConjoint ? champsPersonne('conjoint') : null;
  Collecte.commencer();
  rubriquesDecrites = [];
  // les champs se décrivent dans l'ordre où ils sont créés : ceux de chaque rubrique sont créés juste avant elle
  const portefeuilleBloc = portefeuille();
  Collecte.prendre();
  const blocs = [
    portefeuilleBloc,
    bloc('client', ouvert('client', true), champTexte('nom', 'nomClient', t('nomClientIndication')),
      (Collecte.decrire({ type: 'choix', libelle: t('canton'), valeur: d.canton, options: CANTONS.map(v => ({ v, l: `${v} · ${t('ct_' + v)}` })) },
        v => { d.commune = null; d.communeTexte = ''; ecrire('canton', v); construire(); }),
      h('label', { class: 'champ' }, h('span', {}, t('canton')), h('select', { onchange: e => { d.commune = null; d.communeTexte = ''; ecrire('canton', e.target.value); construire(); } },
        ...CANTONS.map(v => h('option', { value: v, selected: d.canton === v }, `${v} · ${t('ct_' + v)}`))))),
      h('div', { class: 'rangee' }, champCommune(), champChoix('confession', 'confession', ['sans', 'reformee', 'catholique'], { libelle: v => t('cf_' + v) })),
      ...client.identite()),
    bloc('menage', ouvert('menage', true),
      champChoix('etatCivil', 'etatCivil', ['celibataire', 'marie', 'partenariat', 'concubin', 'divorce', 'veuf']),
      compteur('enfants', d.enfants.length, 0, 6, n => { d.enfants = n > d.enfants.length ? [...d.enfants, 5] : d.enfants.slice(0, n); ctx.apresChangement(); construire(); }),
      ...d.enfants.map((_, i) => curseur(`enfants.${i}`, 'ageEnfant', 0, 24, 1, v => `${v} ${t('ans')}`)),
      bascule('avecConjoint', 'avecConjoint', false, { structure: true })),
    ...(conjoint ? [bloc('conjoint', ouvert('conjoint', true), ...conjoint.identite(), intertitre(t('lpp')), ...conjoint.lpp(),
      intertitre(t('pilier3')), ...conjoint.pilier3())] : []),
    bloc('lpp', ouvert('lpp', true), ...client.lpp()),
    bloc('pilier3', ouvert('pilier3', true), ...client.pilier3()),
    bloc('logement', ouvert('logement', true), h('div', { class: 'rangee' }, champMontant('bien.valeur', 'valeurBien', { facultatif: true }),
      champMontant('bien.dette', 'dette', { facultatif: true }))),
    bloc('besoins', ouvert('besoins', true),
      curseur('besoins.retraite', 'besoinRetraite', 0.5, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('besoins.invalidite', 'besoinInvalidite', 0.5, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('besoins.deces', 'besoinDeces', 0.4, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('ageRetraite', 'ageRetraite', 58, 70, 1, v => `${v} ${t('ans')}`)),
    // conformité : procès-verbal de conseil du dossier, puis fiche de l'intermédiaire (une fois pour tous les dossiers)
    bloc('lg_conseil', ouvert('lg_conseil', true), ...Conformite.champsConseil(ctx, construire)),
    bloc('lg_intermediaire', ouvert('lg_intermediaire', false), ...Conformite.champsIntermediaire(ctx, construire)),
    bloc('sv_securite', ouvert('sv_securite', false), ...EcranVerrou.champs(ctx, construire)),
  ];
  blocs.forEach((b, i) => b.style.setProperty('--i', String(i)));
  // Une seule rubrique ouverte à la fois. Téléphone : un accordéon. Tablette et ordinateur : la liste des rubriques
  // à gauche, la rubrique choisie à droite (comme les réglages du système).
  const rubriques = /** @type {HTMLDetailsElement[]} */ (blocs.filter(b => b.dataset.bloc));
  if (!rubriques.some(b => b.dataset.bloc === rubriqueOuverte)) rubriqueOuverte = /** @type {string} */ (rubriques[0].dataset.bloc);
  const etroit = matchMedia('(max-width: 759.98px)');
  const liste = h('nav', { class: 'rubriques', 'aria-label': t('dossier') }, ...rubriques.map((b, i) => h('button', { type: 'button', 'data-rubrique': b.dataset.bloc,
    onclick: () => ouvrir(/** @type {string} */ (b.dataset.bloc)) }, h('i', { 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, t(/** @type {string} */ (b.dataset.bloc))))));
  const ouvrir = cle => {
    rubriqueOuverte = cle;
    for (const b of rubriques) b.open = b.dataset.bloc === cle;
    for (const bouton of liste.children) bouton.setAttribute('aria-current', String(/** @type {HTMLElement} */ (bouton).dataset.rubrique === cle));
  };
  let pret = false;
  setTimeout(() => { pret = true; }, 400);                       // les rubriques créées ouvertes signalent leur état : on l'ignore
  for (const b of rubriques) {
    b.addEventListener('toggle', () => {
      if (!pret) return;
      const cle = /** @type {string} */ (b.dataset.bloc);
      if (b.open) {
        if (rubriqueOuverte !== cle) ouvrir(cle);
        if (etroit.matches) requestAnimationFrame(() => b.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      } else if (rubriqueOuverte === cle && !etroit.matches) b.open = true;   // à droite, la rubrique affichée ne se replie pas
    });
  }
  ouvrir(rubriqueOuverte);
  $('saisie').replaceChildren(
    h('div', { class: 'ecran-titre' }, h('div', {}, h('h1', {}, t('dossier')), h('p', {}, t('dossierAide')))),
    blocs[0], liste, ...rubriques,
    h('button', { type: 'button', class: 'bouton voir-analyse', onclick: () => /** @type {HTMLElement|null} */ (document.querySelector('#onglets [data-vue=analyse]'))?.click() }, t('voirAnalyse')));
  if (Collecte.active()) surSchema({ nom: d.nom || t('sansNom'), rubriques: rubriquesDecrites });
}

/** @param {typeof ctx} contexte */
export function initialiser(contexte) {
  ctx = contexte;
}
