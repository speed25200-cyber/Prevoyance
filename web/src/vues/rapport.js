// @ts-check
/**
 * Vue « Rapport » : le document remis au client. Pages A4 composées à l'écran, puis « Enregistrer en PDF » par
 * l'impression du navigateur (feuille de style d'impression : seul le rapport s'imprime, une section par page).
 * Tout est en SVG et en texte : le PDF reste net et léger, dans la langue de l'interface.
 */

import { h, colonnes, couleurCouverture } from '../ui.js';
import { Scenarios, Vie, VERSION } from '../../../moteur/src/index.js';
import { etat, garder, dossier } from '../etat.js';
import { RISQUES, detailRisque, texteAlerte } from './analyse.js';
import { planCourant, budgetPlan } from './plan.js';
import { Impots } from '../../../moteur/src/index.js';
import * as Conformite from '../conformite.js';
import * as ConseilTexte from '../conseil-texte.js';
import * as Marque from '../marque.js';
import { imageRelief, chargerTerrain } from '../relief.js';

// Couverture sans marque : le relief du client (ses trois piliers sous l'altitude du besoin), aux teintes du rapport imprimé.
const TEINTES_RELIEF = { fond: '#ffffff', trait: '#13161b', besoin: '#d9542b', ok: '#1f8a5b' };
let reliefCouverture = { cle: '', image: /** @type {string|null} */ (null) };
let terrainConnu = false;   // le terrain du relief a fini de se charger (qu'il soit là ou non)
function imageCouverture(a, ctx) {
  if (document.documentElement.classList.contains('natif')) return null;
  // le terrain n'est pas encore là (le rapport est la première vue ouverte) : la couverture garde son image d'origine,
  // et le rapport se redessine dès qu'il arrive
  if (!terrainConnu) { chargerTerrain().then(pret => { terrainConnu = true; if (pret && etat.vue === 'rapport') afficher(ctx); }); return null; }
  const x = a.risques.retraite, verse = n => Math.round(x.sources.filter(s => s.pilier === n).reduce((s, y) => s + y.montant, 0));
  const montants = { p1: verse(1), p2: verse(2), p3: verse(3), besoin: Math.round(x.besoin) }, cle = JSON.stringify(montants);
  if (reliefCouverture.cle !== cle) reliefCouverture = { cle, image: imageRelief(montants, { couleurs: TEINTES_RELIEF }) };
  return reliefCouverture.image;
}

const GRAVITES = ['critique', 'attention', 'opportunite', 'info'];

export function monter(ctx, racine) {
  racine.replaceChildren(h('div', { id: 'rapport-zone' }));
  afficher(ctx);
}

/**
 * À l'écran, dans le navigateur : chaque feuille garde sa vraie largeur A4 (celle de l'impression) et se réduit d'un
 * bloc à la place disponible — la feuille de style lit `--echelle-page`. Avant, la feuille rétrécissait sans son
 * contenu, qui était alors coupé en bas.
 */
const A4 = 793.7;   // 210 mm, en points d'écran
const surLargeur = new ResizeObserver(entrees => {
  for (const e of entrees) /** @type {HTMLElement} */ (e.target).style.setProperty('--echelle-page', Math.min(1, e.contentRect.width / A4).toFixed(4));
});
function ajusterFeuilles(zone) {
  surLargeur.disconnect();
  const feuilles = zone.querySelector('.rapport');
  if (!feuilles || document.documentElement.classList.contains('natif')) return;
  feuilles.style.setProperty('--echelle-page', Math.min(1, feuilles.clientWidth / A4).toFixed(4));
  surLargeur.observe(feuilles);
  // filet de sécurité : une feuille dont le contenu dépasse encore (dossier très chargé, langue plus longue) est
  // resserrée d'un rien — jusqu'à 14 % — plutôt que coupée ; le réglage suit la feuille jusque dans le PDF
  for (const feuille of /** @type {NodeListOf<HTMLElement>} */ (feuilles.querySelectorAll('.page:not(.couverture)'))) {
    const corps = /** @type {HTMLElement[]} */ ([...feuille.children]).filter(e => !e.matches('header, footer'));
    let serre = 1;
    while (feuille.scrollHeight > feuille.clientHeight + 1 && serre > 0.87) {
      serre -= 0.02;
      for (const e of corps) e.style.setProperty('zoom', serre.toFixed(2));
    }
  }
}

const page = (classe, ...contenu) => h('section', { class: 'page ' + classe }, ...contenu);
const ligne = (libelle, valeur) => h('tr', {}, h('th', {}, libelle), h('td', {}, valeur));

export function afficher(ctx) {
  const zone = document.getElementById('rapport-zone');
  const { t, f, analyse: a, regles, impots, dossierMoteur } = ctx;
  if (!zone || !a) return;
  const d = dossier(), P = a.personne, date = new Date().toLocaleDateString(etat.langue + '-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  const personne = d.cible === 'conjoint' && d.avecConjoint ? d.conjoint : d.personne;
  // marque du rapport : le logo et le nom de l'intermédiaire quand ils sont saisis, sinon le nom de l'application
  const marque = etat.intermediaire ?? {};
  const signature = marque.nom?.trim() || t('titre');
  // un logo pas encore analysé (enregistré par une version précédente) : on l'analyse une fois, puis le rapport se redessine
  if (marque.logo && marque.logoPret === undefined) {
    marque.logoPret = null;
    Marque.preparer(marque.logo).then(pret => { marque.logoPret = pret; garder(); afficher(ctx); });
  }
  const pret = marque.logo ? marque.logoPret : null;
  // le thème : tiré du logo (fond, couleur principale, accent) ou de la couleur choisie ; sans marque, le rapport garde sa sobriété
  const teintes = marque.logo || marque.nom?.trim() ? Marque.theme({ ...(pret ?? {}), choisie: marque.couleur || null }) : null;
  // le logo, rogné de ses marges, à la taille d'un cadre (en millimètres)
  const logo = (largeur, hauteur, classe) => {
    const taille = Marque.cadrer(pret?.ratio ?? 3, largeur, hauteur);
    return h('img', { class: classe, src: pret?.image ?? marque.logo, alt: signature, style: { width: `${taille.l}mm`, height: `${taille.h}mm` } });
  };
  const pied = n => h('footer', {}, h('span', {}, `${signature} · ${d.nom || t('sansNom')}`), h('span', {}, `${date} · ${n}`));
  const entete = titre => h('header', {}, h('h2', {}, titre), marque.logo ? logo(46, 11, 'r-logo') : h('span', {}, signature));
  const bloc = x => { const e = h('div', { class: 'r-detail' }, h('h3', {}, t(x.cle)), ...detailRisque(ctx, x)); for (const i of e.querySelectorAll('.pile i')) i.style.width = `${(+(i.dataset.part ?? 0) * 100).toFixed(2)}%`; return e; };

  const outils = h('div', { class: 'rapport-outils carte' },
    h('div', {}, h('h2', {}, t('rp_titre')), h('p', {}, t('rp_aide'))),
    h('label', { class: 'champ' }, h('span', {}, t('rp_conseiller')), h('input', { type: 'text', value: etat.conseiller, placeholder: t('rp_conseiller_i'),
      oninput: e => { etat.conseiller = e.target.value; garder(); for (const x of document.querySelectorAll('.r-conseiller')) x.textContent = etat.conseiller || '—'; } })),
    h('button', { type: 'button', class: 'bouton', onclick: () => window.print() }, t('rp_pdf')));

  // ---- 1. couverture
  // l'anneau du score, pour la couverture à la marque
  const anneau = () => {
    const e = h('div', { class: 'r-anneau' }), tour = 2 * Math.PI * 52;
    e.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="r-anneau-fond"/>`
      + `<circle cx="60" cy="60" r="52" class="r-anneau-part" stroke-dasharray="${(Math.max(0, Math.min(100, a.score)) / 100 * tour).toFixed(1)} ${tour.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>`;
    e.append(h('b', {}, String(a.score)), h('small', {}, t('score')));
    return e;
  };
  const repere = (nom, valeur) => h('div', {}, h('small', {}, nom), valeur);
  const relief = teintes ? null : imageCouverture(a, ctx);
  const couverture = teintes
    // avec une marque : un grand aplat à sa couleur — logo, nom et adresse en haut, titre et anneau du score dessus —, puis les repères du dossier
    ? page('couverture griffe',
      h('div', { class: 'r-bandeau' },
        h('div', { class: 'r-haut' },
          marque.logo ? h('div', { class: 'r-plaque' + (teintes.plaque ? '' : ' nue'), style: teintes.plaque ? { background: teintes.plaque } : {} }, logo(92, 34, 'r-logo-plaque')) : h('span', {}),
          h('div', { class: 'r-maison' }, h('p', { class: 'r-maison-nom' }, signature), marque.adresse?.trim() ? h('p', { class: 'r-maison-adresse' }, marque.adresse.trim()) : null)),
        h('div', { class: 'r-corps' },
          h('div', { class: 'r-titre' }, h('p', { class: 'r-sur' }, t('rp_surtitre', { a: a.annee })), h('p', { class: 'r-grand' }, t('rp_h1')), h('p', { class: 'r-pour' }, d.nom || t('sansNom'))),
          anneau())),
      h('div', { class: 'r-reperes' },
        repere(t('rp_date'), h('b', {}, date)), repere(t('rp_conseiller'), h('b', { class: 'r-conseiller' }, etat.conseiller || '—')),
        repere(t('canton'), h('b', {}, a.canton ? `${a.canton} · ${t('ct_' + a.canton)}` : '—'))))
    : page('couverture',
      relief ? h('img', { class: 'r-piliers r-relief', src: relief, alt: '', width: 1680, height: 896 })
        : h('img', { class: 'r-piliers', src: 'images/colonnes-clair.webp', alt: '', width: 2880, height: 1236 }),
      relief ? h('p', { class: 'r-credit' }, t('rl_credit')) : null,
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
  const ages = Scenarios.agesDeDepart(dossierMoteur, regles, [62, 63, 64, 65, 66, 67, 68], { impots });
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
    (() => {
      const brut = a.personne.revenu + (a.conjoint && a.marie ? a.conjoint.revenu : 0);
      const eco3a = impots && a.canton ? Impots.economieDeduction(impots, a.canton, a.marie, brut, m.versement3a ?? 0, a.enfantsACharge) ?? 0 : Math.round((m.versement3a ?? 0) * a.potentiels.tauxMarginal);
      const b = budgetPlan(m, eco3a);
      return h('div', {}, h('h3', {}, t('pl_budget')), h('table', { class: 'r-fiche large' },
        ligne(t('pl_budgetEpargne'), `${f.chf(b.epargne)} ${t('parAn')}`), ligne(t('pl_budgetPrimes'), b.attendues ? `${f.chf(b.primes)} ${t('parAn')} (${t('pl_offresAttendues', { n: b.attendues })})` : `${f.chf(b.primes)} ${t('parAn')}`),
        ligne(t('pl_budgetEconomie'), `− ${f.chf(b.economie)} ${t('parAn')}`), ligne(t('pl_budgetNet'), `${f.chf(b.net)} ${t('parAn')} · ${f.chf(b.net / 12)} ${t('parMois')}`)));
    })(),
    h('p', { class: 'petit' }, t('pl_primes')), pied(avecDeces ? 7 : 6));
  // ---- conseil personnalisé : avant le plan chiffré
  const pageConseil = ConseilTexte.page(ctx, { page, entete, pied }, avecDeces ? 6 : 5);

  // ---- feuille de route : les échéances à venir du client, et ce que devient sa retraite si une hypothèse tourne mal
  const numeroRoute = avecDeces ? 8 : 7;
  const route = Vie.feuilleDeRoute(dossierMoteur, regles, { impots });
  const tenue = Vie.resistance(dossierMoteur, regles, { impots }), chocs = tenue.chocs.filter(c => c.applicable);
  const valeursEtape = e => ({ m: f.chf(e.v.montant ?? 0), e: f.chf(e.v.economie ?? 0), a: e.v.depart ?? '', d: e.v.mois ? `${String(e.v.mois).padStart(2, '0')}.${e.v.anneeRente}` : '' });
  const nomChoc = c => t('vt_' + c.cle, { a: `${((c.v.a ?? 0) * 100).toFixed(1)} %`, age: c.v.age ?? '', part: f.pourcent(c.v.part ?? 0) });
  const pageRoute = route.length ? page('', entete(t('vi_route')),
    h('p', { class: 'r-texte' }, t('vi_route_d')),
    h('ol', { class: 'etapes' }, ...route.map((e, i) => h('li', { 'data-prochaine': String(i === 0) },
      h('b', {}, String(e.annee)), h('small', {}, t('vi_ans', { n: e.age })), h('p', {}, t('vr_' + e.cle, valeursEtape(e)))))),
    h('p', { class: 'petit' }, t('vi_route_note')),
    ...(chocs.length ? [h('h3', {}, t('vi_tenue')),
      h('table', { class: 'r-tableau' },
        h('thead', {}, h('tr', {}, h('th', {}, t('vi_tenue')), h('th', {}, `${t('lacune')} ${t('parMois')}`), h('th', {}, t('couvert')))),
        h('tbody', {}, ...chocs.map(c => h('tr', {}, h('th', {}, nomChoc(c)),
          h('td', { class: c.lacune > 0 ? 'lacune' : 'ok' }, c.lacune > 0 ? '− ' + f.chf(c.lacuneMensuelle) : '✓'), h('td', {}, f.pourcent(Math.min(1, c.couverture))))))),
      h('p', { class: 'petit' }, t('vi_tenue_note'))] : []),
    pied(numeroRoute)) : null;
  const decalage = pageRoute ? 1 : 0;

  // ---- hypothèses et sources
  const hyp = a.hypotheses;
  const sources = page('', entete(t('rp_hypotheses')),
    h('table', { class: 'r-fiche large' },
      ligne(t('rp_regles'), `${regles.annee} — ${regles.etat}`),
      ligne(t('besoinRetraite'), f.pourcent(a.besoins.retraite)), ligne(t('besoinInvalidite'), f.pourcent(a.besoins.invalidite)), ligne(t('besoinDeces'), f.pourcent(a.besoins.deces)),
      ligne(t('rp_rendement'), `${(hyp.rendement3a * 100).toFixed(1)} % / ${(hyp.rendementFortune * 100).toFixed(1)} %`),
      ligne(t('rp_escompte'), `${(hyp.escompte * 100).toFixed(1)} %`), ligne(t('rp_finRente'), `${hyp.ageFinRente} ${t('ans')}`),
      ligne(t('rp_fiscal'), impots && a.canton ? `${impots.cantons[a.canton].lieu} — ${impots.source} (${impots.releveLe})` : t('rp_fiscalMoyen')),
      ligne(t('rp_moteur'), `v${VERSION}`)),
    // ce que le calcul suppose, pour que le client et le conseiller sachent ce qui reste à vérifier
    h('h3', {}, t('rp_suppose')),
    h('ul', { class: 'r-sources' }, ...['rp_s_enfants', 'rp_s_mariage', 'rp_s_depart', 'rp_s_capitaux', 'rp_s_caisses'].map(cle => h('li', {}, t(cle)))),
    h('h3', {}, t('rp_sources')),
    h('ul', { class: 'r-sources' }, ...Object.values(regles.sources).map(s => h('li', {}, String(s)))),
    pied((avecDeces ? 8 : 7) + decalage));
  // ---- informations de l'intermédiaire (art. 45 LSA) et procès-verbal de conseil, avec les signatures
  const legales = Conformite.pages(ctx, { page, entete, pied, ligne }, (avecDeces ? 9 : 8) + decalage);

  zone.replaceChildren(h('aside', { class: 'rapport-cote' }, outils, Conformite.bandeau(ctx)), h('div', { class: 'rapport' + (teintes ? ' griffe' : ''),
    style: teintes ? { '--marque': teintes.bande, '--marque-encre': teintes.encre, '--marque-filet': teintes.filet, '--marque-filet-bande': teintes.filetBande,
      '--marque-texte': teintes.texte, '--marque-claire': teintes.claire, '--marque-p1': teintes.piliers[0], '--marque-p2': teintes.piliers[1], '--marque-p3': teintes.piliers[2] } : {} }, ...[couverture, synthese, retraite, invalidite, deces, pageConseil, pagePlan, pageRoute, sources, ...legales].filter(Boolean)));
  ajusterFeuilles(zone);
}
