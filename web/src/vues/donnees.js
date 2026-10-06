// @ts-check
/**
 * Vue « Données » : d'où viennent les chiffres, de quand ils datent, et comment ils se mettent à jour.
 * Un conseiller doit pouvoir répondre à « c'est à jour ? » en un coup d'œil : montants-clés des deux années, valeurs
 * encore à confirmer, impôts par canton avec la date du relevé, sources légales, version du moteur.
 */

import { h } from '../ui.js';
import { VERSION, ANNEES, Impots } from '../../../moteur/src/index.js';
import * as Donnees from '../donnees.js';
import { etat } from '../etat.js';

const CLES = [
  ['dn_avsMin', r => r.avs.renteMinMensuelle], ['dn_avsMax', r => r.avs.renteMaxMensuelle], ['dn_couple', r => r.avs.renteMaxMensuelle * r.avs.plafondCoupleFacteur],
  ['dn_seuil', r => r.lpp.seuilEntree], ['dn_coordination', r => r.lpp.deductionCoordination], ['dn_salaireMax', r => r.lpp.salaireMaxLPP],
  ['dn_interet', r => r.lpp.tauxInteretMinimal, 'taux'], ['dn_conversion', r => r.lpp.tauxConversion, 'taux'],
  ['dn_3a', r => r.pilier3a.plafondAvecLPP], ['dn_3aSans', r => r.pilier3a.plafondSansLPP], ['dn_laa', r => r.laa.gainAssureMax],
];

/** Libellé lisible des valeurs encore à confirmer (clés du fichier de règles). */
const A_CONFIRMER = { 'lpp.tauxInteretMinimal': 'dn_interet', 'laa.gainAssureMax': 'dn_laa', 'ac.plafond': 'dn_ac', 'avs.bonificationEducative': 'dn_bonification', 'avs.flexibilisation': 'dn_flexAVS' };

export async function monter(ctx, racine) {
  const { t, f } = ctx;
  const [r1, r2, manifeste, impots] = await Promise.all([Donnees.regles(ANNEES[0]), Donnees.regles(ANNEES[1]), Donnees.manifeste(), ctx.impotsBase ?? Donnees.impots(ANNEES[0])]);
  const mise = (v, nature) => (nature === 'taux' ? `${(v * 100).toFixed(2).replace(/0$/, '')} %` : f.chf(v));
  const etatMaj = h('p', { class: 'note' }, Donnees.dernierControle()
    ? t('dn_controle', { d: new Date(/** @type {string} */ (Donnees.dernierControle())).toLocaleString(etat.langue + '-CH') }) : t('dn_jamais'));
  const bouton = h('button', { type: 'button', class: 'bouton', onclick: async () => {
    bouton.disabled = true; bouton.textContent = t('dn_enCours');
    const resultat = await Donnees.verifierMisesAJour();
    bouton.disabled = false; bouton.textContent = t('dn_verifier');
    etatMaj.textContent = t('dn_' + resultat.etat, { v: resultat.version ?? '' });
    if (resultat.etat === 'misAJour') ctx.recalculer(true, true);
  } }, t('dn_verifier'));

  const blocs = [
    h('div', { class: 'carte donnees-tete' },
      h('div', {}, h('p', { class: 'surtitre' }, t('dn_surtitre')), h('p', { class: 'grand petit-grand' }, t('dn_version', { v: manifeste?.version ?? '—' })),
        h('p', { class: 'note' }, manifeste?.notes ?? ''), etatMaj),
      h('div', { class: 'donnees-actions' }, bouton, h('small', {}, t('dn_moteur', { v: VERSION })),
        h('a', { class: 'lien', href: '../moteur/tests/index.html', target: '_blank', rel: 'noopener' }, t('dn_tests')))),
    h('div', { class: 'carte' }, h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('dn_regles')), h('p', {}, t('dn_regles_d')))),
      h('table', { class: 'r-tableau donnees-table' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, String(r1.annee)), h('th', {}, String(r2.annee)), h('th', {}, t('dn_ecart')))),
        h('tbody', {}, ...CLES.map(([cle, lire, nature]) => {
          const a = lire(r1), b = lire(r2), change = Math.abs(a - b) > 1e-9;
          return h('tr', {}, h('th', {}, t(cle)), h('td', {}, mise(a, nature)), h('td', { class: change ? 'change' : '' }, mise(b, nature)),
            h('td', { class: change ? 'change' : 'meme' }, change ? (nature === 'taux' ? '' : (b > a ? '+ ' : '− ') + f.chf(Math.abs(b - a))) : '='));
        }))),
      r2.aConfirmer?.length ? h('p', { class: 'remarque' }, t('dn_aConfirmer', { l: r2.aConfirmer.map(c => t(A_CONFIRMER[c] ?? c)).join(' ; ') })) : null,
      h('p', { class: 'petit' }, `${r1.annee} : ${r1.etat} · ${r2.annee} : ${r2.etat}`)),
  ];

  if (impots) {
    const cantons = Object.keys(impots.cantons);
    const serie = (lire, titre, note) => {
      const valeurs = cantons.map(c => ({ c, v: lire(c) ?? 0 })).sort((x, y) => x.v - y.v), max = Math.max(...valeurs.map(x => x.v), 1);
      return h('div', { class: 'cantons' }, h('h3', {}, titre), h('p', { class: 'petit' }, note),
        h('div', { class: 'cantons-barres' }, ...valeurs.map((x, i) => h('div', { class: x.c === ctx.analyse?.canton ? 'actif' : '', style: { '--i': i }, title: `${x.c} · ${f.chf(x.v)}` },
          h('b', {}, f.court(x.v)), h('i', { style: { height: `${Math.round(x.v / max * 100)}%` } }), h('small', {}, x.c)))));
    };
    blocs.push(h('div', { class: 'carte' }, h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, t('dn_impots')), h('p', {}, t('dn_impots_d', { d: impots.releveLe })))),
      serie(c => Impots.impotRevenu(impots, c, false, 100000)?.impot, t('dn_impotRevenu'), t('dn_impotRevenu_d')),
      serie(c => Impots.impotCapital(impots, c, false, 300000), t('dn_impotCapital'), t('dn_impotCapital_d')),
      ctx.communes ? h('p', { class: 'remarque' }, t('dn_communes', { n: f.nombre(Object.values(ctx.communes.cantons).reduce((s, l) => s + l.length, 0)), e: `${(ctx.communes.ecartMaxControle * 100).toFixed(1)} %` })) : null,
      h('p', { class: 'petit' }, `${impots.source}. ${impots.hypotheses}.`)));
  }
  blocs.push(h('div', { class: 'carte' }, h('h2', {}, t('rp_sources')),
    h('ul', { class: 'r-sources' }, ...Object.entries(r1.sources).map(([k, s]) => h('li', {}, h('b', {}, k.toUpperCase() + ' — '), String(s))),
      ...Object.entries(r2.sources).filter(([k]) => ['avs', 'lpp', 'pilier3a'].includes(k)).map(([k, s]) => h('li', {}, h('b', {}, `${k.toUpperCase()} ${r2.annee} — `), String(s))))));
  // confidentialité et limites : ce qu'un courtier ou une compagnie doit pouvoir lire avant d'utiliser l'outil avec un client
  blocs.push(h('div', { class: 'carte apropos' }, h('h2', {}, t('ap_titre')),
    h('ul', { class: 'r-sources' }, ...['ap_appareil', 'ap_reseau', 'ap_verrou', 'ap_effacer', 'ap_limites', 'ap_controle'].map(cle => h('li', {}, t(cle, { v: VERSION, d: manifeste?.version ?? '—' }))))));
  blocs.forEach((b, i) => b.style.setProperty('--i', String(i)));
  racine.replaceChildren(h('div', { class: 'pile-cartes' }, ...blocs));
}

export function afficher() { /* la vue ne dépend pas du dossier : rien à mettre à jour à chaque calcul */ }
