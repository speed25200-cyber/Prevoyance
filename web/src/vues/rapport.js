// @ts-check
/**
 * Vue « Rapport » : le document remis au client. Pages A4 composées à l'écran, puis « Enregistrer en PDF » par
 * l'impression du navigateur (feuille de style d'impression : seul le rapport s'imprime, une section par page).
 * Tout est en SVG et en texte : le PDF reste net et léger, dans la langue de l'interface.
 */

import { h, colonnes, couleurCouverture } from '../ui.js';
import { Scenarios, VERSION } from '../../../moteur/src/index.js';
import { etat, garder, dossier } from '../etat.js';
import { RISQUES, detailRisque, texteAlerte } from './analyse.js';
import { planCourant } from './plan.js';

const GRAVITES = ['critique', 'attention', 'opportunite', 'info'];

export function monter(ctx, racine) {
  racine.replaceChildren(h('div', { id: 'rapport-zone' }));
  afficher(ctx);
}

const page = (classe, ...contenu) => h('section', { class: 'page ' + classe }, ...contenu);
const ligne = (libelle, valeur) => h('tr', {}, h('th', {}, libelle), h('td', {}, valeur));

export function afficher(ctx) {
  const zone = document.getElementById('rapport-zone');
  const { t, f, analyse: a, regles, impots, dossierMoteur } = ctx;
  if (!zone || !a) return;
  const d = dossier(), P = a.personne, date = new Date().toLocaleDateString(etat.langue + '-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  const personne = d.cible === 'conjoint' && d.avecConjoint ? d.conjoint : d.personne;
  const pied = n => h('footer', {}, h('span', {}, `${t('titre')} · ${d.nom || t('sansNom')}`), h('span', {}, `${date} · ${n}`));
  const entete = titre => h('header', {}, h('h2', {}, titre), h('span', {}, t('titre')));
  const bloc = x => { const e = h('div', { class: 'r-detail' }, h('h3', {}, t(x.cle)), ...detailRisque(ctx, x)); for (const i of e.querySelectorAll('.pile i')) i.style.width = `${(+(i.dataset.part ?? 0) * 100).toFixed(2)}%`; return e; };

  const outils = h('div', { class: 'rapport-outils carte' },
    h('div', {}, h('h2', {}, t('rp_titre')), h('p', {}, t('rp_aide'))),
    h('label', { class: 'champ' }, h('span', {}, t('rp_conseiller')), h('input', { type: 'text', value: etat.conseiller, placeholder: t('rp_conseiller_i'),
      oninput: e => { etat.conseiller = e.target.value; garder(); for (const x of document.querySelectorAll('.r-conseiller')) x.textContent = etat.conseiller || '—'; } })),
    h('button', { type: 'button', class: 'bouton', onclick: () => window.print() }, t('rp_pdf')));

  // ---- 1. couverture
  const couverture = page('couverture',
    h('img', { class: 'r-piliers', src: 'images/colonnes-clair.webp', alt: '', width: 2880, height: 1236 }),
    h('div', {}, h('p', { class: 'surtitre' }, t('rp_surtitre', { a: a.annee })), h('h1', {}, t('rp_h1')), h('p', { class: 'r-client' }, d.nom || t('sansNom'))),
    h('table', { class: 'r-fiche' },
      ligne(t('rp_date'), date), ligne(t('rp_conseiller'), h('span', { class: 'r-conseiller' }, etat.conseiller || '—')),
      ligne(t('canton'), a.canton ? `${a.canton} · ${t('ct_' + a.canton)}` : '—'), ligne(t('score'), `${a.score} / 100`)));

  // ---- 2. synthèse
  const triees = [...a.alertes].sort((p, q) => GRAVITES.indexOf(p.gravite) - GRAVITES.indexOf(q.gravite));
  const synthese = page('', entete(t('rp_synthese')),
    h('div', { class: 'r-deux' },
      h('table', { class: 'r-fiche' },
        ligne(t('rp_age'), `${P.age} ${t('ans')}`), ligne(t('etatCivil'), t(a.etatCivil)), ligne(t('statut'), t(personne.statut)),
        ligne(t('revenu'), f.chf(P.revenu)), ligne(t('enfants'), String(a.enfantsACharge)), ligne(t('ageRetraite'), `${P.ageRetraite} ${t('ans')}`)),
      h('div', { class: 'r-score' }, h('b', { style: { color: couleurCouverture(a.score / 100) } }, String(a.score)), h('span', {}, t('score')))),
    h('table', { class: 'r-tableau' },
      h('thead', {}, h('tr', {}, h('th', {}, t('rp_risque')), h('th', {}, t('besoin')), h('th', {}, t('couvert')), h('th', {}, `${t('lacune')} ${t('parMois')}`), h('th', {}, t('capital')))),
      h('tbody', {}, ...RISQUES.filter(c => a.risques[c].besoin > 0).map(c => { const x = a.risques[c]; return h('tr', {},
        h('th', {}, t(c)), h('td', {}, f.chf(x.besoin)), h('td', {}, f.pourcent(Math.min(1, x.couverture))),
        h('td', { class: x.lacune > 0 ? 'lacune' : 'ok' }, x.lacune > 0 ? '− ' + f.chf(x.lacuneMensuelle) : '✓'), h('td', {}, x.capital > 0 ? f.chf(x.capital) : '—')); }))),
    h('h3', {}, t('alertes')),
    h('ul', { class: 'alertes' }, ...triees.slice(0, 7).map(al => h('li', { style: { '--c': `var(--${al.gravite})` } }, h('span', {}, texteAlerte(ctx, al))))),
    pied(2));

  // ---- 3. retraite
  const ages = Scenarios.agesDeDepart(dossierMoteur, regles, [62, 63, 64, 65, 66, 67, 68]);
  const retraite = page('', entete(t('retraite')), bloc(a.risques.retraite),
    h('h3', {}, t('sc_age')),
    colonnes(ages.map(x => ({ libelle: String(x.age), besoin: x.besoin, actif: x.age === P.ageRetraite, note: x.lacune > 0 ? '− ' + f.court(x.lacune) : '✓',
      couches: [{ valeur: x.avs, couleur: 'var(--p1)' }, { valeur: x.lpp, couleur: 'var(--p2)' }, { valeur: x.pilier3, couleur: 'var(--p3)' }] })), { court: f.court, hauteur: 220 }),
    h('p', { class: 'petit' }, t('sc_age_note')), pied(3));
  if (impots && a.canton && P.lpp.affilie && P.lpp.avoirRetraite > 0) {
    const autres = a.risques.retraite.sources.filter(s => s.cle === 'avs').reduce((s, x) => s + x.montant, 0);
    const rc = Scenarios.renteOuCapital({ capital: P.lpp.avoirRetraite, tauxConversion: P.lpp.renteVieillesse / P.lpp.avoirRetraite, autresRentes: autres,
      ageRetraite: P.ageRetraite, canton: a.canton, marie: a.marie }, impots);
    retraite.insertBefore(h('div', {}, h('h3', {}, t('sc_rc')),
      h('table', { class: 'r-tableau' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), ...['sc_toutRente', 'sc_moitie', 'sc_toutCapital'].map(c => h('th', {}, t(c))))),
        h('tbody', {},
          h('tr', {}, h('th', {}, t('sc_netParAn')), ...rc.options.map(o => h('td', {}, f.chf(o.revenuAnnuelNet)))),
          h('tr', {}, h('th', {}, t('sc_impotCapital')), ...rc.options.map(o => h('td', {}, f.chf(o.impotCapital)))),
          h('tr', {}, h('th', {}, t('sc_totalNet', { a: rc.ageFin })), ...rc.options.map(o => h('td', {}, f.chf(o.totalNet)))))),
      rc.seuilRentabilite ? h('p', { class: 'petit' }, t('sc_seuil', { a: Math.round(rc.seuilRentabilite) })) : null), retraite.lastElementChild);
  }

  // ---- 4. invalidité, 5. décès
  const invalidite = page('', entete(t('rp_invalidite')), h('div', { class: 'r-deux' }, bloc(a.risques.invaliditeMaladie), bloc(a.risques.invaliditeAccident)),
    h('p', { class: 'r-texte' }, t('rp_invalidite_d')), pied(4));
  const avecDeces = a.risques.decesMaladie.besoin > 0;
  const deces = avecDeces ? page('', entete(t('rp_deces')), h('div', { class: 'r-deux' }, bloc(a.risques.decesMaladie), bloc(a.risques.decesAccident)),
    h('p', { class: 'r-texte' }, t('rp_deces_d', { n: a.risques.decesMaladie.annees, c: f.chf(a.risques.decesMaladie.capitauxDisponibles) })), pied(5)) : null;

  // ---- 6. plan
  const plan = planCourant(ctx), m = plan.mesures;
  const mesures = [
    m.renteInvalidite ? [t('pl_renteInvalidite'), `${f.chf(m.renteInvalidite)} ${t('parAn')}`] : null,
    m.capitalDeces ? [t('pl_capitalDeces'), f.chf(m.capitalDeces)] : null,
    m.ijm ? [t('pl_ijm'), '✓'] : null, m.laa ? [t('pl_laa'), '✓'] : null,
    m.versement3a ? [t('pl_3a'), `${f.chf(m.versement3a)} ${t('parAn')}`] : null,
    m.rachatLPP ? [t('pl_rachat'), f.chf(m.rachatLPP)] : null,
    m.epargneLibre ? [t('pl_epargne'), `${f.chf(m.epargneLibre)} ${t('parAn')}`] : null,
  ].filter(Boolean);
  const pagePlan = page('', entete(t('pl_titre')),
    h('table', { class: 'r-fiche large' }, ...(mesures.length ? mesures.map(x => ligne(x[0], x[1])) : [ligne(t('pl_toutCouvert'), '✓')])),
    h('h3', {}, t('pl_effet')),
    h('table', { class: 'r-tableau' },
      h('thead', {}, h('tr', {}, h('th', {}, t('rp_risque')), h('th', {}, t('pl_avant')), h('th', {}, t('pl_apres')))),
      h('tbody', {}, ...RISQUES.filter(c => plan.avant.risques[c].besoin > 0).map(c => { const x = plan.avant.risques[c], y = plan.apres.risques[c]; return h('tr', {},
        h('th', {}, t(c)), h('td', { class: x.lacune > 0 ? 'lacune' : 'ok' }, x.lacune > 0 ? `− ${f.chf(x.lacuneMensuelle)} ${t('parMois')}` : '✓'),
        h('td', { class: y.lacune > 0 ? 'lacune' : 'ok' }, y.lacune > 0 ? `− ${f.chf(y.lacuneMensuelle)} ${t('parMois')}` : '✓')); }),
        h('tr', { class: 'fort' }, h('th', {}, t('score')), h('td', {}, String(plan.avant.score)), h('td', {}, String(plan.apres.score))))),
    h('p', { class: 'petit' }, t('pl_primes')), pied(avecDeces ? 6 : 5));

  // ---- 7. hypothèses et sources
  const hyp = a.hypotheses;
  const sources = page('', entete(t('rp_hypotheses')),
    h('table', { class: 'r-fiche large' },
      ligne(t('rp_regles'), `${regles.annee} — ${regles.etat}`),
      ligne(t('besoinRetraite'), f.pourcent(a.besoins.retraite)), ligne(t('besoinInvalidite'), f.pourcent(a.besoins.invalidite)), ligne(t('besoinDeces'), f.pourcent(a.besoins.deces)),
      ligne(t('rp_rendement'), `${(hyp.rendement3a * 100).toFixed(1)} % / ${(hyp.rendementFortune * 100).toFixed(1)} %`),
      ligne(t('rp_escompte'), `${(hyp.escompte * 100).toFixed(1)} %`), ligne(t('rp_finRente'), `${hyp.ageFinRente} ${t('ans')}`),
      ligne(t('rp_fiscal'), impots && a.canton ? `${impots.cantons[a.canton].lieu} — ${impots.source} (${impots.releveLe})` : t('rp_fiscalMoyen')),
      ligne(t('rp_moteur'), `v${VERSION}`)),
    h('h3', {}, t('rp_sources')),
    h('ul', { class: 'r-sources' }, ...Object.values(regles.sources).map(s => h('li', {}, String(s)))),
    h('p', { class: 'r-texte' }, t('rp_avertissement')),
    h('div', { class: 'r-signatures' }, h('div', {}, h('span', {}, t('rp_signClient'))), h('div', {}, h('span', {}, t('rp_signConseiller')))),
    pied(avecDeces ? 7 : 6));

  zone.replaceChildren(outils, h('div', { class: 'rapport' }, ...[couverture, synthese, retraite, invalidite, deces, pagePlan, sources].filter(Boolean)));
}
