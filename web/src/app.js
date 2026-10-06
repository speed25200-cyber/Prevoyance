// @ts-check
/**
 * Application web du conseiller : un dossier saisi à gauche, l'analyse à droite, recalculée à chaque frappe.
 *
 * L'état tient dans un objet simple, gardé dans le navigateur (localStorage) : rien ne quitte l'appareil.
 * Chaque changement suit le même chemin : état -> dossier du moteur -> analyse -> mise à jour ciblée de l'écran
 * (les chiffres comptent, les barres glissent, le graphique se déforme). Le formulaire n'est reconstruit que
 * lorsque sa structure change (langue, conjoint, nombre d'enfants, activité).
 */

import { analyser, regles as chargerRegles, ANNEES } from '../../moteur/src/index.js';
import { LANGUES, traducteur, formats } from './i18n.js';
import { creerGraphique, COUCHES } from './graphique.js';

const CLE = 'prevoyance.etat.v1';
const RISQUES = ['retraite', 'invaliditeMaladie', 'invaliditeAccident', 'decesMaladie', 'decesAccident'];
const COULEUR_PILIER = { 1: '--p1', 2: '--p2', 3: '--p3' };
const GRAVITES = ['critique', 'attention', 'opportunite', 'info'];
const MONTANTS = new Set(['montant', 'economie', 'plafond', 'excedent', 'seuil', 'perteMensuelle', 'ecart']);

const VIDE = () => ({
  etatCivil: 'celibataire', avecConjoint: false, enfants: /** @type {number[]} */ ([]),
  personne: { dateNaissance: '1986-05-14', sexe: 'h', statut: 'salarie', revenu: 90000 },
  conjoint: { dateNaissance: '1988-09-02', sexe: 'f', statut: 'salarie', revenu: 60000 },
  besoins: { retraite: 0.8, invalidite: 0.9, deces: 0.7 }, ageRetraite: 65,
});
const EXEMPLE = () => ({
  etatCivil: 'marie', avecConjoint: true, enfants: [4, 7],
  personne: { dateNaissance: '1987-03-21', sexe: 'f', statut: 'salarie', revenu: 104000, anneesManquantes: 2, lppAvoir: 148000, lppRachat: 62000,
              ijm: true, avoir3a: 41000, versement3a: 3600, fortune: 30000 },
  conjoint: { dateNaissance: '1985-11-08', sexe: 'h', statut: 'independant', revenu: 78000 },
  besoins: { retraite: 0.8, invalidite: 0.9, deces: 0.75 }, ageRetraite: 65,
});

const etat = charger();
let t = traducteur(etat.langue), f = formats(etat.langue);
/** @type {Record<number, any>} */ const reglesParAnnee = {};
/** @type {any} */ let analyse = null;
const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));
const graphique = creerGraphique(/** @type {HTMLCanvasElement} */ ($('graphique')), $('bulle'));

function charger() {
  const base = { langue: (navigator.language || 'fr').slice(0, 2), annee: ANNEES[0], risque: 'retraite', dossier: EXEMPLE() };
  if (!LANGUES.includes(base.langue)) base.langue = 'fr';
  try {
    const garde = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (garde?.dossier?.personne) return { ...base, ...garde, dossier: { ...VIDE(), ...garde.dossier } };
  } catch { /* stockage indisponible : on travaille en mémoire */ }
  return base;
}

function garder() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* navigation privée */ }
}

// ------------------------------------------------------------------ du formulaire au moteur

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function naissanceDepuisAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

function versPersonne(p, principale) {
  const independant = p.statut === 'independant';
  const affilie = independant ? !!p.lppAffilie : p.lppAffilie === false ? false : undefined;
  const contrats = [];
  if (p.avoir3a || p.versement3a) contrats.push({ type: '3a', forme: 'banque', avoir: p.avoir3a || 0, versementAnnuel: p.versement3a || 0 });
  if (p.avoir3b) contrats.push({ type: '3b', forme: 'banque', avoir: p.avoir3b });
  if (p.rentePrivee || p.capitalDecesPrive) contrats.push({ type: '3b', forme: 'assurance', renteInvalidite: p.rentePrivee || 0, capitalDeces: p.capitalDecesPrive || 0 });
  const defini = v => (v === undefined || v === null || v === '' ? undefined : +v);
  return {
    dateNaissance: p.dateNaissance || '1986-01-01', sexe: p.sexe || 'h', statut: p.statut || 'salarie', revenu: +p.revenu || 0,
    avs: { ramd: defini(p.ramd), anneesManquantes: +p.anneesManquantes || 0 },
    lpp: { affilie, avoir: defini(p.lppAvoir), renteVieillesse: defini(p.lppRenteVieillesse), renteInvalidite: defini(p.lppRenteInvalidite),
           renteConjoint: defini(p.lppRenteConjoint), capitalDeces: defini(p.lppCapitalDeces), rachatPossible: defini(p.lppRachat) },
    laa: { assure: p.laa ?? (!independant && p.statut !== 'sans') },
    ijm: { assure: !!p.ijm },
    pilier3: principale ? contrats : [], fortune: principale ? +p.fortune || 0 : 0,
  };
}

function versDossier() {
  const d = etat.dossier;
  return {
    dateAnalyse: aujourdhui(), etatCivil: d.etatCivil,
    personne: versPersonne(d.personne, true),
    conjoint: d.avecConjoint ? versPersonne(d.conjoint, false) : null,
    enfants: d.enfants.map(a => ({ dateNaissance: naissanceDepuisAge(a) })),
    besoins: { ...d.besoins }, hypotheses: { ageRetraite: d.ageRetraite },
  };
}

// ------------------------------------------------------------------ formulaire

const h = (balise, attributs = {}, ...enfants) => {
  const e = document.createElement(balise);
  for (const [k, v] of Object.entries(attributs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v !== undefined) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...enfants.filter(x => x !== null && x !== undefined));
  return e;
};

/** Lit et écrit une valeur de l'état par son chemin (« personne.revenu »). */
const lire = chemin => chemin.split('.').reduce((o, k) => o?.[k], etat.dossier);
function ecrire(chemin, valeur) {
  const cles = chemin.split('.'), fin = cles.pop();
  const objet = cles.reduce((o, k) => (o[k] ??= {}), etat.dossier);
  if (valeur === undefined) delete objet[fin]; else objet[fin] = valeur;
  apresChangement();
}

function champMontant(chemin, cle, { facultatif = false } = {}) {
  const valeur = lire(chemin);
  const entree = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: valeur === undefined || valeur === '' ? '' : f.nombre(valeur),
    oninput: e => { const brut = e.target.value.replace(/[^\d]/g, ''); ecrire(chemin, brut === '' ? undefined : +brut); },
    onblur: e => { const v = lire(chemin); e.target.value = v === undefined ? '' : f.nombre(v); },
    onfocus: e => e.target.select() });
  return h('label', { class: 'champ' }, h('span', {}, t(cle), facultatif ? h('i', {}, t('facultatif')) : null), h('div', { class: 'montant' }, entree));
}

function champChoix(chemin, cle, valeurs, { structure = false } = {}) {
  const select = h('select', { onchange: e => { ecrire(chemin, e.target.value); if (structure) construireFormulaire(); } },
    ...valeurs.map(v => h('option', { value: v, selected: lire(chemin) === v }, t(v === 'h' ? 'homme' : v === 'f' ? 'femme' : v))));
  return h('label', { class: 'champ' }, h('span', {}, t(cle)), select);
}

const champDate = (chemin, cle) => h('label', { class: 'champ' }, h('span', {}, t(cle)),
  h('input', { type: 'date', value: lire(chemin) || '', min: '1940-01-01', max: aujourdhui(), onchange: e => e.target.value && ecrire(chemin, e.target.value) }));

function bascule(chemin, cle, defaut, { structure = false } = {}) {
  return h('label', { class: 'bascule' }, t(cle),
    h('input', { type: 'checkbox', checked: lire(chemin) ?? defaut, onchange: e => { ecrire(chemin, e.target.checked); if (structure) construireFormulaire(); } }));
}

function compteur(cle, valeur, min, max, surChangement) {
  const nombre = h('b', {}, String(valeur));
  const pas = delta => () => { const v = Math.min(max, Math.max(min, valeur + delta)); if (v !== valeur) surChangement(v); };
  return h('div', { class: 'champ' }, h('span', {}, t(cle)),
    h('div', { class: 'compteur' }, h('button', { type: 'button', 'aria-label': '−', onclick: pas(-1) }, '−'), nombre, h('button', { type: 'button', 'aria-label': '+', onclick: pas(1) }, '+')));
}

function curseur(chemin, cle, min, max, pas, afficher) {
  const sortie = h('output', {}, afficher(lire(chemin)));
  const entree = h('input', { type: 'range', min, max, step: pas, value: lire(chemin),
    oninput: e => { const v = +e.target.value; sortie.textContent = afficher(v); regler(e.target); ecrire(chemin, v); } });
  const regler = el => el.style.setProperty('--part', `${(+el.value - min) / (max - min) * 100}%`);
  regler(entree);
  return h('label', { class: 'champ curseur' }, h('span', {}, t(cle), sortie), entree);
}

const bloc = (cle, ouvert, ...champs) => h('details', { class: 'bloc', open: ouvert }, h('summary', {}, t(cle)), h('div', { class: 'champs' }, ...champs));

function construireFormulaire() {
  const d = etat.dossier, p = d.personne, independant = p.statut === 'independant';
  const ouverts = [...document.querySelectorAll('#saisie .bloc')].map(b => /** @type {HTMLDetailsElement} */ (b).open);
  const ouvert = (i, defaut) => ouverts[i] ?? defaut;
  const blocs = [
    bloc('client', ouvert(0, true),
      h('div', { class: 'rangee' }, champDate('personne.dateNaissance', 'naissance'), champChoix('personne.sexe', 'sexe', ['h', 'f'])),
      champChoix('personne.statut', 'statut', ['salarie', 'independant', 'sans'], { structure: true }),
      champMontant('personne.revenu', 'revenu'),
      h('div', { class: 'rangee' },
        compteur('anneesManquantes', +p.anneesManquantes || 0, 0, 20, v => { ecrire('personne.anneesManquantes', v); construireFormulaire(); }),
        champMontant('personne.ramd', 'ramd', { facultatif: true }))),
    bloc('menage', ouvert(1, true),
      champChoix('etatCivil', 'etatCivil', ['celibataire', 'marie', 'partenariat', 'concubin', 'divorce', 'veuf']),
      compteur('enfants', d.enfants.length, 0, 6, n => { d.enfants = n > d.enfants.length ? [...d.enfants, 5] : d.enfants.slice(0, n); apresChangement(); construireFormulaire(); }),
      ...d.enfants.map((_, i) => curseur(`enfants.${i}`, 'ageEnfant', 0, 24, 1, v => `${v} ${t('ans')}`)),
      bascule('avecConjoint', 'avecConjoint', false, { structure: true }),
      ...(d.avecConjoint ? [
        h('div', { class: 'rangee' }, champDate('conjoint.dateNaissance', 'naissance'), champChoix('conjoint.sexe', 'sexe', ['h', 'f'])),
        champChoix('conjoint.statut', 'statut', ['salarie', 'independant', 'sans']),
        champMontant('conjoint.revenu', 'revenu'),
      ] : [])),
    bloc('lpp', ouvert(2, false),
      ...(independant ? [bascule('personne.lppAffilie', 'affilie', false, { structure: true })] : []),
      ...(!independant || p.lppAffilie ? [
        champMontant('personne.lppAvoir', 'avoir', { facultatif: true }),
        h('div', { class: 'rangee' }, champMontant('personne.lppRenteVieillesse', 'renteVieillesse', { facultatif: true }),
          champMontant('personne.lppRenteInvalidite', 'renteInvalidite', { facultatif: true })),
        h('div', { class: 'rangee' }, champMontant('personne.lppRenteConjoint', 'renteConjoint', { facultatif: true }),
          champMontant('personne.lppCapitalDeces', 'capitalDeces', { facultatif: true })),
        champMontant('personne.lppRachat', 'rachatPossible', { facultatif: true }),
      ] : []),
      bascule('personne.laa', 'laa', !independant && p.statut !== 'sans'),
      bascule('personne.ijm', 'ijm', false)),
    bloc('pilier3', ouvert(3, false),
      h('div', { class: 'rangee' }, champMontant('personne.avoir3a', 'avoir3a', { facultatif: true }), champMontant('personne.versement3a', 'versement3a', { facultatif: true })),
      h('div', { class: 'rangee' }, champMontant('personne.avoir3b', 'avoir3b', { facultatif: true }), champMontant('personne.fortune', 'fortune', { facultatif: true })),
      h('div', { class: 'rangee' }, champMontant('personne.rentePrivee', 'renteInvaliditePrivee', { facultatif: true }),
        champMontant('personne.capitalDecesPrive', 'capitalDecesPrive', { facultatif: true }))),
    bloc('besoins', ouvert(4, false),
      curseur('besoins.retraite', 'besoinRetraite', 0.5, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('besoins.invalidite', 'besoinInvalidite', 0.5, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('besoins.deces', 'besoinDeces', 0.4, 1, 0.05, v => `${Math.round(v * 100)} % ${t('duRevenu')}`),
      curseur('ageRetraite', 'ageRetraite', 58, 70, 1, v => `${v} ${t('ans')}`)),
  ];
  blocs.forEach((b, i) => b.style.setProperty('--i', String(i)));
  $('saisie').replaceChildren(...blocs);
}

// ------------------------------------------------------------------ affichage de l'analyse

/** Fait compter un nombre jusqu'à sa nouvelle valeur. */
function compter(element, valeur, mise = f.chf) {
  const depart = /** @type {any} */ (element)._v ?? 0, debut = performance.now(), duree = 650;
  /** @type {any} */ (element)._v = valeur;
  const jeton = /** @type {any} */ (element)._jeton = Symbol();
  const pas = maintenant => {
    if (/** @type {any} */ (element)._jeton !== jeton) return;
    const k = Math.min(1, (maintenant - debut) / duree), e = 1 - Math.pow(1 - k, 4);
    element.textContent = mise(depart + (valeur - depart) * e);
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

const couleurCouverture = c => (c >= 0.995 ? 'var(--p3)' : c >= 0.75 ? 'var(--attention)' : 'var(--lacune)');

function construireRisques() {
  $('risques').replaceChildren(...RISQUES.map((cle, i) => {
    const bouton = h('button', { class: 'risque', type: 'button', role: 'tab', 'data-risque': cle, 'aria-selected': String(etat.risque === cle),
      onclick: () => { etat.risque = cle; garder(); afficher(); } },
      h('h3', {}, t(cle)), h('b', {}, '–'), h('small', {}, ''), h('div', { class: 'barre-couv' }, h('i')));
    bouton.style.setProperty('--i', String(i + 1));
    return bouton;
  }));
}

function pointsDuGraphique(r) {
  const a = analyse, chrono = a.chronologie, P = a.personne;
  const parPilier = sources => { const v = {}; for (const s of sources) v['pilier' + s.pilier] = (v['pilier' + s.pilier] ?? 0) + s.montant; return v; };
  if (r.cle === 'retraite') {
    return chrono.map(p => ({ age: p.age, besoin: p.besoin, v: p.actif ? { salaire: p.salaire } : { pilier1: p.pilier1, pilier2: p.pilier2, pilier3: p.pilier3 } }));
  }
  if (r.cle.startsWith('invalidite')) {
    const besoin = P.revenu * a.besoins.invalidite, rente = parPilier(r.sources);
    return chrono.map(p => {
      if (!p.actif) return { age: p.age, besoin: p.besoin, v: { pilier1: p.pilier1, pilier2: p.pilier2, pilier3: p.pilier3 } };
      const depuis = p.age - P.age;
      if (depuis >= 2) return { age: p.age, besoin, v: rente };
      const total = p[r.cle], part = Math.min(1, Math.max(0, (r.attente.jours - 365 * depuis) / 365));
      const attente = r.attente.montant * part, reste = Math.max(0, total - attente), somme = r.total || 1;
      return { age: p.age, besoin, v: { attente, pilier1: (rente.pilier1 ?? 0) / somme * reste, pilier2: (rente.pilier2 ?? 0) / somme * reste, pilier3: (rente.pilier3 ?? 0) / somme * reste } };
    });
  }
  const annees = Math.max(1, r.annees), v = parPilier(r.sources);
  return Array.from({ length: annees }, (_, i) => ({ age: P.age + i, besoin: r.besoin, v }));
}

function afficher() {
  if (!analyse) return;
  const a = analyse, r = a.risques[etat.risque];
  // tête
  const arc = /** @type {SVGCircleElement} */ (document.querySelector('#jauge .arc'));
  arc.style.strokeDashoffset = String(326.73 * (1 - a.score / 100));
  $('jauge').style.setProperty('--couleur', couleurCouverture(a.score / 100));
  compter($('score'), a.score, x => String(Math.round(x)));
  $('resume-titre').textContent = `${t(r.cle)} — ${r.lacune > 0 ? t('lacune') : t('aucuneLacune')}`;
  /** @type {HTMLElement} */ ($('resume-montant').parentElement).classList.toggle('lacune', r.lacune > 0);
  compter($('resume-montant'), r.lacuneMensuelle);
  $('resume-unite').textContent = t('parMois');
  const morceaux = [`${t('besoin')} ${f.chf(r.besoin)} ${t('parAn')}`, `${t('couvert')} ${f.pourcent(Math.min(1, r.couverture))}`];
  if (r.capital > 0) morceaux.push(`${t('capital')} ${f.chf(r.capital)} (${t('surLaDuree', { n: r.annees })})`);
  if (r.cle === 'retraite' && r.epargneAnnuelle > 0) morceaux.push(t('epargne', { m: f.chf(r.epargneAnnuelle) }));
  $('resume-note').textContent = morceaux.join(' · ');
  // cartes des risques
  for (const bouton of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.risque'))) {
    const x = a.risques[bouton.dataset.risque];
    bouton.setAttribute('aria-selected', String(x.cle === etat.risque));
    const [, montant, note, barre] = bouton.children;
    montant.classList.toggle('lacune', x.lacune > 0);
    if (x.besoin === 0) { montant.textContent = '—'; /** @type {any} */ (montant)._v = 0; note.textContent = ''; }
    else { compter(/** @type {HTMLElement} */ (montant), x.lacuneMensuelle, v => (x.lacune > 0 ? '− ' : '') + f.chf(v)); note.textContent = x.lacune > 0 ? t('parMois') : t('aucuneLacune'); }
    const trait = /** @type {HTMLElement} */ (barre.firstElementChild);
    trait.style.transform = `scaleX(${x.besoin === 0 ? 0 : Math.min(1, x.couverture)})`;
    trait.style.background = couleurCouverture(x.couverture);
  }
  // ligne de vie
  const points = pointsDuGraphique(r);
  const libelles = { salaire: t('s_salaire'), attente: t('attente'), pilier1: t('pilier1'), pilier2: t('pilier2'), pilier3: t('pilier3c'), besoin: t('besoin'), lacune: t('lacune') };
  graphique.definir(points, { chf: f.chf, court: f.court, libelles, ans: t('ans'),
    reperes: r.cle.startsWith('deces') ? [] : [{ age: a.personne.ageRetraite, libelle: `${t('retraite')} · ${a.personne.ageRetraite}` }] });
  const utilisees = COUCHES.filter(c => points.some(p => (p.v[c] ?? 0) > 0.5));
  $('legende').replaceChildren(...utilisees.map(c => { const li = h('li', {}, h('i'), libelles[c]); li.style.setProperty('--c', `var(${{ salaire: '--salaire', attente: '--attente', pilier1: '--p1', pilier2: '--p2', pilier3: '--p3' }[c]})`); return li; }),
    h('li', {}, h('i', { class: 'trait' }), t('besoin')), (() => { const li = h('li', {}, h('i'), t('lacune')); li.style.setProperty('--c', 'var(--lacune)'); return li; })());
  // détail des sources
  const echelle = Math.max(r.besoin, r.total, 1);
  const pile = h('div', { class: 'pile' }, ...r.sources.map(s => { const i = h('i'); i.style.setProperty('--c', `var(${COULEUR_PILIER[s.pilier]})`); i.dataset.part = String(s.montant / echelle); return i; }),
    ...(r.lacune > 0 ? [(() => { const i = h('i', { class: 'manque' }); i.dataset.part = String(r.lacune / echelle); return i; })()] : []));
  const lignes = h('ul', { class: 'lignes' }, ...r.sources.map(s => {
    const point = h('i'); point.style.setProperty('--c', `var(${COULEUR_PILIER[s.pilier]})`);
    return h('li', {}, h('span', { class: 'nom' }, point, t('s_' + s.cle), s.estime ? h('em', {}, t('estime')) : null, s.reduit ? h('em', {}, t('reduit')) : null), h('b', {}, f.chf(s.montant)));
  }), h('li', { class: 'total' }, h('span', {}, t('besoin')), h('b', {}, f.chf(r.besoin))),
    r.lacune > 0 ? h('li', { class: 'manque' }, h('span', {}, `${t('lacune')} ${t('parAn')}`), h('b', {}, '− ' + f.chf(r.lacune))) : null);
  const attente = r.attente ? h('div', { class: 'attente' }, h('b', {}, t('attente')),
    t('att_' + r.attente.cle, { t: Math.round(r.attente.taux * 100), j: r.attente.jours, s: Math.round(r.attente.jours / 7) })) : null;
  $('detail').replaceChildren(pile, lignes, ...(attente ? [attente] : []));
  requestAnimationFrame(() => { for (const i of /** @type {NodeListOf<HTMLElement>} */ (pile.querySelectorAll('i'))) i.style.width = `${(+i.dataset.part * 100).toFixed(2)}%`; });
  // leviers
  const p = a.potentiels, leviers = [];
  leviers.push(h('div', { class: 'levier' }, h('b', {}, t('p_3a')), h('p', {}, p.pilier3a.potentiel > 0
    ? t('p_3a_d', { m: f.chf(p.pilier3a.potentiel), e: f.chf(p.pilier3a.economieImpot), c: f.chf(p.pilier3a.capitalSupplementaire) })
    : t('p_3a_plein', { m: f.chf(p.pilier3a.plafond) }))));
  if (p.rachatLPP.possible > 0) leviers.push(h('div', { class: 'levier' }, h('b', {}, t('p_lpp')),
    h('p', {}, t('p_lpp_d', { m: f.chf(p.rachatLPP.possible), e: f.chf(p.rachatLPP.economieImpot), r: f.chf(p.rachatLPP.renteSupplementaire) }))));
  if (p.avs.anneesManquantes > 0) leviers.push(h('div', { class: 'levier' }, h('b', {}, t('p_avs')),
    h('p', {}, t('p_avs_d', { n: p.avs.anneesManquantes, m: f.chf(p.avs.perteMensuelle) }))));
  leviers.push(h('p', { class: 'petit' }, t('tauxMarginal', { t: Math.round(p.tauxMarginal * 100) })));
  $('potentiels').replaceChildren(...leviers);
  // alertes, les plus graves d'abord
  const triees = [...a.alertes].sort((x, y) => GRAVITES.indexOf(x.gravite) - GRAVITES.indexOf(y.gravite));
  $('alertes').replaceChildren(...triees.map(x => {
    const valeurs = Object.fromEntries(Object.entries(x.valeurs).map(([k, v]) => [k, MONTANTS.has(k) ? f.chf(/** @type {number} */ (v)) : v]));
    const li = h('li', {}, h('span', {}, t('a_' + x.cle, valeurs)));
    li.style.setProperty('--c', `var(--${x.gravite})`);
    return li;
  }));
}

// ------------------------------------------------------------------ cycle de vie

let attenteCalcul = false;
function apresChangement() {
  garder();
  if (attenteCalcul) return;
  attenteCalcul = true;
  requestAnimationFrame(() => { attenteCalcul = false; calculer(); });
}

async function calculer() {
  reglesParAnnee[etat.annee] ??= await chargerRegles(etat.annee);
  try {
    analyse = analyser(versDossier(), reglesParAnnee[etat.annee]);
  } catch (erreur) {
    console.error(erreur);
    return;
  }
  afficher();
}

function traduire() {
  t = traducteur(etat.langue); f = formats(etat.langue);
  document.documentElement.lang = etat.langue;
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-t]'))) e.textContent = t(e.dataset.t);
  document.title = `${t('titre')} — ${t('sousTitre')}`;
  for (const b of $('langues').children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.langue === etat.langue));
  construireFormulaire();
  construireRisques();
  afficher();
}

$('langues').replaceChildren(...LANGUES.map(l => h('button', { type: 'button', 'data-langue': l, onclick: () => { etat.langue = l; garder(); traduire(); } }, l.toUpperCase())));
$('annee').replaceChildren(...ANNEES.map(a => h('option', { value: a, selected: a === etat.annee }, String(a))));
$('annee').addEventListener('change', e => { etat.annee = +/** @type {HTMLSelectElement} */ (e.target).value; apresChangement(); });
$('exemple').addEventListener('click', () => { etat.dossier = EXEMPLE(); construireFormulaire(); apresChangement(); });
$('reinitialiser').addEventListener('click', () => { etat.dossier = VIDE(); construireFormulaire(); apresChangement(); });

traduire();
calculer();
window.__prevoyance = { etat, analyse: () => analyse };
