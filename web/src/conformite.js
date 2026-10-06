// @ts-check
/**
 * Conformité du conseil : ce que la loi sur la surveillance des assurances (LSA, révisée au 1er janvier 2024) demande
 * à un intermédiaire d'assurance, et que l'application aide à documenter.
 *
 * - Art. 45 LSA : informations à communiquer au preneur d'assurance (nom et adresse ; lié ou non lié, et les entreprises
 *   d'assurance représentées ; où s'informer sur la formation ; qui répond des fautes ; traitement des données).
 * - Art. 45a : conflits d'intérêts. Art. 45b : publicité des rémunérations (intermédiaires non liés).
 * - Art. 39j et 39k : assurance sur la vie qualifiée — connaissances et expérience du client, caractère approprié,
 *   documentation.
 * La fiche de l'intermédiaire est saisie une fois (elle vaut pour tous les dossiers) ; le procès-verbal de conseil est
 * propre à chaque dossier. L'application ne remplace ni l'enregistrement auprès de la FINMA, ni les documents de
 * l'assureur.
 */

import { h } from './ui.js';
import { etat, garder, dossier } from './etat.js';
import * as Signature from './signature.js';
import * as Collecte from './collecte.js';

const VIE = ['aucune', 'appropriee', 'deconseillee', 'nonVerifiee'];

/** La fiche de l'intermédiaire, commune à tous les dossiers. */
export function intermediaire() {
  return (etat.intermediaire ??= { nom: etat.conseiller ?? '', adresse: '', genre: 'nonLie', assureurs: '', registre: '', formation: '', responsable: '',
    donnees: '', remuneration: '', conflits: '', mediation: '' });
}

/** Le procès-verbal de conseil du dossier ouvert. */
export function conseil(d = dossier()) {
  return (d.conseil ??= { besoins: '', recommandation: '', raisons: '', decision: '', vie: 'aucune', connaissances: '', consentement: false, infoRemise: false });
}

const rempli = v => typeof v === 'string' ? v.trim().length > 1 : !!v;

/**
 * Les points à documenter, avec leur état.
 * @returns {{cle: string, ok: boolean}[]}
 */
export function controle(d = dossier()) {
  const i = intermediaire(), c = conseil(d), lie = i.genre === 'lie';
  return [
    { cle: 'lg_nom', ok: rempli(i.nom) && rempli(i.adresse) },
    { cle: lie ? 'lg_assureurs' : 'lg_registre', ok: rempli(lie ? i.assureurs : i.registre) },
    { cle: 'lg_formation', ok: rempli(i.formation) },
    { cle: 'lg_responsable', ok: rempli(i.responsable) },
    { cle: 'lg_donnees', ok: true },                                    // un texte par défaut est fourni
    ...(lie ? [] : [{ cle: 'lg_remuneration', ok: rempli(i.remuneration) }]),
    { cle: 'lg_mediation', ok: rempli(i.mediation) },
    { cle: 'lg_besoins', ok: rempli(c.besoins) },
    { cle: 'lg_recommandation', ok: rempli(c.recommandation) && rempli(c.raisons) },
    { cle: 'lg_decision', ok: rempli(c.decision) },
    ...(c.vie === 'aucune' ? [] : [{ cle: 'lg_connaissances', ok: c.vie === 'nonVerifiee' || rempli(c.connaissances) }]),
    { cle: 'lg_consentement', ok: !!c.consentement },
    { cle: 'lg_infoRemise', ok: !!c.infoRemise },
  ];
}

// ---------------------------------------------------------------------------------------------- saisie

function champ(ctx, objet, cle, libelle, { long = false, indication = '', surChangement = () => {} } = {}) {
  Collecte.decrire({ type: long ? 'long' : 'texte', libelle: ctx.t(libelle), valeur: objet[cle] ?? '', indication },
    v => { objet[cle] = String(v ?? ''); dossier().modifie = new Date().toISOString(); garder(); surChangement(); });
  const proprietes = { value: objet[cle] ?? '', placeholder: indication, autocomplete: 'off',
    oninput: e => { objet[cle] = e.target.value; dossier().modifie = new Date().toISOString(); garder(); surChangement(); } };
  const entree = long ? h('textarea', { rows: 3, ...proprietes }, objet[cle] ?? '') : h('input', { type: 'text', ...proprietes });
  return h('label', { class: 'champ' }, h('span', {}, ctx.t(libelle)), entree);
}

function choix(ctx, objet, cle, libelle, valeurs, prefixe, surChangement = () => {}) {
  Collecte.decrire({ type: 'choix', libelle: ctx.t(libelle), valeur: objet[cle] ?? valeurs[0], options: valeurs.map(v => ({ v, l: ctx.t(prefixe + v) })) },
    v => { objet[cle] = v; garder(); surChangement(); });
  return h('label', { class: 'champ' }, h('span', {}, ctx.t(libelle)),
    h('select', { onchange: e => { objet[cle] = e.target.value; garder(); surChangement(); } },
      ...valeurs.map(v => h('option', { value: v, selected: objet[cle] === v }, ctx.t(prefixe + v)))));
}

function coche(ctx, objet, cle, libelle) {
  Collecte.decrire({ type: 'bascule', libelle: ctx.t(libelle), valeur: !!objet[cle] }, v => { objet[cle] = !!v; garder(); });
  return h('label', { class: 'bascule' }, ctx.t(libelle),
    h('input', { type: 'checkbox', checked: !!objet[cle], onchange: e => { objet[cle] = e.target.checked; garder(); } }));
}

/** Champs du procès-verbal de conseil (par dossier). */
export function champsConseil(ctx, reconstruire) {
  const c = conseil();
  return [
    (Collecte.decrire({ type: 'note', libelle: ctx.t('lg_conseilAide') }), h('p', { class: 'petit sans-marge' }, ctx.t('lg_conseilAide'))),
    champ(ctx, c, 'besoins', 'lg_besoins', { long: true }),
    champ(ctx, c, 'recommandation', 'lg_recommandation', { long: true }),
    champ(ctx, c, 'raisons', 'lg_raisons', { long: true }),
    champ(ctx, c, 'decision', 'lg_decision', { long: true }),
    choix(ctx, c, 'vie', 'lg_vie', VIE, 'lg_vie_', reconstruire),
    ...(c.vie === 'aucune' ? [] : [champ(ctx, c, 'connaissances', 'lg_connaissances', { long: true })]),
    coche(ctx, c, 'infoRemise', 'lg_infoRemise'),
    coche(ctx, c, 'consentement', 'lg_consentement'),
    // signatures sur l'écran : reprises sur le procès-verbal du rapport, avec le lieu et la date
    (Collecte.decrire({ type: 'titre', libelle: ctx.t('lg_signatures') }), h('p', { class: 'intertitre' }, ctx.t('lg_signatures'))),
    (Collecte.decrire({ type: 'note', libelle: ctx.t('lg_signaturesAide') }), h('p', { class: 'petit sans-marge' }, ctx.t('lg_signaturesAide'))),
    champ(ctx, c, 'lieu', 'lg_lieu'),
    ...['client', 'conseiller'].map(qui => (Collecte.decrire({ type: 'signature', libelle: ctx.t(qui === 'client' ? 'rp_signClient' : 'rp_signConseiller'),
      valeur: c.signatures?.[qui] ? 1 : 0, indication: ctx.t('lg_effacer') }, image => {
        c.signatures = { ...(c.signatures ?? {}), [qui]: String(image ?? ''), date: new Date().toISOString() };
        dossier().modifie = new Date().toISOString(); garder();
      }), Signature.zone({ libelle: ctx.t(qui === 'client' ? 'rp_signClient' : 'rp_signConseiller'), effacer: ctx.t('lg_effacer'),
      valeur: c.signatures?.[qui] ?? '', surChangement: image => {
        c.signatures = { ...(c.signatures ?? {}), [qui]: image, date: new Date().toISOString() };
        dossier().modifie = new Date().toISOString(); garder();
      } }))),
  ];
}

/** Champs de la fiche de l'intermédiaire (une fois pour tous les dossiers). */
export function champsIntermediaire(ctx, reconstruire) {
  const i = intermediaire(), lie = i.genre === 'lie';
  return [
    (Collecte.decrire({ type: 'note', libelle: ctx.t('lg_intermediaireAide') }), h('p', { class: 'petit sans-marge' }, ctx.t('lg_intermediaireAide'))),
    // logo du courtier ou de la compagnie : en tête de chaque page du rapport
    (Collecte.decrire({ type: 'logo', libelle: ctx.t(i.logo ? 'lg_logoChanger' : 'lg_logoChoisir'), valeur: i.logo ? 1 : 0, note: ctx.t('lg_logoAide'), indication: ctx.t('lg_logoRetirer') },
      image => { i.logo = String(image ?? ''); garder(); reconstruire(); }), null),
    h('div', { class: 'logo-choix' },
      i.logo ? h('img', { src: i.logo, alt: '' }) : h('span', { class: 'petit' }, ctx.t('lg_logoAide')),
      h('label', { class: 'pastille' }, ctx.t(i.logo ? 'lg_logoChanger' : 'lg_logoChoisir'),
        h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', hidden: true, onchange: async e => {
          const fichier = e.target.files?.[0];
          if (!fichier) return;
          const image = await Signature.lireLogo(fichier);
          if (image) { i.logo = image; garder(); reconstruire(); }
        } })),
      i.logo ? h('button', { type: 'button', class: 'pastille', onclick: () => { i.logo = ''; garder(); reconstruire(); } }, ctx.t('lg_logoRetirer')) : null),
    champ(ctx, i, 'nom', 'lg_nom'),
    champ(ctx, i, 'adresse', 'lg_adresse'),
    choix(ctx, i, 'genre', 'lg_genre', ['nonLie', 'lie'], 'lg_', reconstruire),
    lie ? champ(ctx, i, 'assureurs', 'lg_assureurs', { long: true }) : champ(ctx, i, 'registre', 'lg_registre'),
    champ(ctx, i, 'formation', 'lg_formation', { indication: ctx.t('lg_formation_i') }),
    champ(ctx, i, 'responsable', 'lg_responsable', { indication: ctx.t('lg_responsable_i') }),
    champ(ctx, i, 'donnees', 'lg_donnees', { long: true, indication: ctx.t('lg_donneesDefaut') }),
    ...(lie ? [] : [champ(ctx, i, 'remuneration', 'lg_remuneration', { long: true })]),
    champ(ctx, i, 'conflits', 'lg_conflits', { long: true, indication: ctx.t('lg_conflitsDefaut') }),
    champ(ctx, i, 'mediation', 'lg_mediation', { indication: ctx.t('lg_mediation_i') }),
    h('p', { class: 'petit' }, ctx.t('lg_appareil')),
  ];
}

// ---------------------------------------------------------------------------------------------- rapport

/** Bandeau de la vue Rapport : ce qui manque avant de remettre le document. */
export function bandeau(ctx) {
  const points = controle(), manquants = points.filter(p => !p.ok);
  return h('div', { class: 'carte conformite' + (manquants.length ? '' : ' complete') },
    h('h2', {}, ctx.t('lg_etat', { n: points.length - manquants.length, m: points.length })),
    h('p', { class: 'note' }, manquants.length ? ctx.t('lg_manque', { l: manquants.map(p => ctx.t(p.cle)).join(' ; ') }) : ctx.t('lg_complet')),
    h('p', { class: 'petit' }, ctx.t('lg_avert')));
}

/** Les deux pages légales du rapport : informations de l'intermédiaire, procès-verbal de conseil. */
export function pages(ctx, { page, entete, pied, ligne }, numero) {
  const { t } = ctx, i = intermediaire(), c = conseil(), lie = i.genre === 'lie';
  const v = (texte, defaut = '') => rempli(texte) ? String(texte) : (defaut || h('em', { class: 'a-completer' }, t('lg_aCompleter')));
  const information = page('', entete(t('lg_pageInfo')),
    h('p', { class: 'r-texte' }, t('lg_base')),
    h('table', { class: 'r-fiche large' },
      ligne(t('lg_nom'), v(i.nom)), ligne(t('lg_adresse'), v(i.adresse)),
      ligne(t('lg_genre'), t(lie ? 'lg_lie' : 'lg_nonLie')),
      lie ? ligne(t('lg_assureurs'), v(i.assureurs)) : ligne(t('lg_registre'), v(i.registre)),
      ligne(t('lg_formation'), v(i.formation)), ligne(t('lg_responsable'), v(i.responsable)),
      ligne(t('lg_donnees'), v(i.donnees, t('lg_donneesDefaut'))),
      lie ? null : ligne(t('lg_remuneration'), v(i.remuneration)),
      ligne(t('lg_conflits'), v(i.conflits, t('lg_conflitsDefaut'))),
      ligne(t('lg_mediation'), v(i.mediation))),
    h('p', { class: 'petit' }, t('lg_avert')), pied(numero));
  const proces = page('', entete(t('lg_pagePv')),
    h('table', { class: 'r-fiche large' },
      ligne(t('lg_besoins'), v(c.besoins)), ligne(t('lg_recommandation'), v(c.recommandation)), ligne(t('lg_raisons'), v(c.raisons)),
      ligne(t('lg_decision'), v(c.decision)),
      ligne(t('lg_vie'), t('lg_vie_' + c.vie)),
      c.vie === 'aucune' ? null : ligne(t('lg_connaissances'), c.vie === 'nonVerifiee' && !rempli(c.connaissances) ? '—' : v(c.connaissances)),
      ligne(t('lg_infoRemise'), t(c.infoRemise ? 'lg_oui' : 'lg_non')), ligne(t('lg_consentement'), t(c.consentement ? 'lg_oui' : 'lg_non'))),
    h('p', { class: 'r-texte' }, t('rp_avertissement')),
    c.lieu || c.signatures?.date ? h('p', { class: 'r-texte r-lieu' }, [c.lieu, c.signatures?.date
      ? new Date(c.signatures.date).toLocaleDateString(etat.langue + '-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : ''].filter(Boolean).join(', ')) : null,
    h('div', { class: 'r-signatures' }, ...['client', 'conseiller'].map(qui => h('div', {},
      c.signatures?.[qui] ? h('img', { src: c.signatures[qui], alt: '' }) : null,
      h('span', {}, t(qui === 'client' ? 'rp_signClient' : 'rp_signConseiller'))))),
    pied(numero + 1));
  return [information, proces];
}
