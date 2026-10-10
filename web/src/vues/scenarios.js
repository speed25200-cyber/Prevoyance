// @ts-check
/**
 * Vue « Scénarios » : ce que change une décision. Âge de départ, rente ou capital, retraits et rachats échelonnés,
 * rendement des placements (simulation), tenue de l'hypothèque à la retraite.
 */

import { h, colonnes, couloir } from '../ui.js';
import { Scenarios, Impots, Vie, Evenements } from '../../../moteur/src/index.js';
import { dossier, garder, PROFILS } from '../etat.js';
import * as Agenda from '../agenda.js';
import * as Partage from '../partage.js';

export function monter(ctx, racine) {
  racine.replaceChildren(h('div', { id: 'scenarios', class: 'pile-cartes' }));
  afficher(ctx);
}

const carte = (titre, sousTitre, ...contenu) => h('div', { class: 'carte' }, h('div', { class: 'carte-tete' }, h('div', {}, h('h2', {}, titre), sousTitre ? h('p', {}, sousTitre) : null)), ...contenu);
const chiffre = (libelle, valeur, note = '', classe = '') => h('div', { class: 'chiffre ' + classe }, h('small', {}, libelle), h('b', {}, valeur), note ? h('span', {}, note) : null);

export function afficher(ctx) {
  const zone = document.getElementById('scenarios');
  const { t, f, analyse: a, regles, impots, dossierMoteur } = ctx;
  if (!zone || !a) return;
  const d = dossier(), P = a.personne, marie = a.marie, canton = a.canton;
  const blocs = [];

  // ---- feuille de route : les échéances légales à venir, dans l'ordre
  const route = Vie.feuilleDeRoute(dossierMoteur, regles, { impots });
  if (route.length) {
    blocs.push(carte(t('vi_route'), t('vi_route_d'),
      h('ol', { class: 'etapes' }, ...route.map((e, i) => h('li', { 'data-prochaine': String(i === 0) },
        h('b', {}, String(e.annee)), h('small', {}, t('vi_ans', { n: e.age })), h('p', {}, Agenda.texteEtape(e, ctx))))),
      // les mêmes échéances, en fichier d'agenda (Outlook, Apple Calendrier, Google Agenda)
      h('div', { class: 'demande-actions agenda-actions' },
        h('button', { type: 'button', class: 'pastille', title: t('ag_aide'),
          onclick: () => Partage.fichier('echeances.ics', Agenda.enICS(Agenda.echeances([dossier()], ctx), ctx), 'text/calendar;charset=utf-8') }, t('ag_bouton'))),
      h('p', { class: 'petit' }, t('vi_route_note'))));
  }

  // ---- et si… : six événements de vie, chacun refait l'analyse complète
  const vie = Evenements.evenements(dossierMoteur, regles, { impots }), possibles = vie.evenements.filter(e => e.applicable);
  if (possibles.length) {
    const pct = x => `${Math.round((x ?? 0) * 100)} %`;
    const nom = e => t('ev_' + e.cle, { p: pct(e.v.part) });
    const detail = e => t(`ev_${e.cle}_d`, { enfants: e.v.enfants ?? '', a: f.chf(e.v.avoir ?? 0), m: f.chf(e.v.montant ?? 0), n: f.chf(e.v.net ?? 0),
      r: f.chf(e.cle === 'logement' ? e.v.rente ?? 0 : e.v.revenu ?? 0) });
    const signe = x => (x > 0 ? '+ ' : x < 0 ? '− ' : '');
    // un écart se lit en bien ou en mal selon ce qu'il mesure : plus de revenu est un bien, plus de lacune un mal
    const ecart = (libelle, valeur, delta, bienSiPlus, unite) => chiffre(libelle, valeur,
      delta === 0 ? t('ev_inchange') : `${signe(delta)}${unite(Math.abs(delta))}`, delta === 0 ? '' : (delta > 0) === bienSiPlus ? 'plus' : 'moins');
    const pire = possibles.reduce((m, e) => (e.ecart.score < m.ecart.score ? e : m), possibles[0]);
    // en tête de la vue, sur toute la largeur : c'est par là qu'un entretien commence
    blocs.unshift(carte(t('ev_titre'), t('ev_d'),
      h('div', { class: 'evenements' }, ...possibles.map(e => h('div', { class: 'evenement' },
        h('div', { class: 'levier' }, h('b', {}, nom(e)), h('p', {}, detail(e))),
        h('div', { class: 'chiffres' },
          ecart(t('ev_couverture'), `${vie.avant.score} → ${e.apres.score}`, e.ecart.score, true, x => t('ev_points', { n: x })),
          ecart(`${t('ev_revenuRetraite')}, ${t('parMois')}`, f.chf(e.apres.revenuRetraite), e.ecart.revenuRetraite, true, f.chf),
          ecart(`${t('ev_invalidite')}, ${t('parMois')}`, e.apres.invalidite > 0 ? `− ${f.chf(e.apres.invalidite)}` : t('ev_aucune'), e.ecart.invalidite, false, f.chf),
          ecart(t('ev_deces'), e.apres.deces > 0 ? f.chf(e.apres.deces) : t('ev_aucune'), e.ecart.deces, false, f.chf))))),
      pire.ecart.score < 0 ? h('p', { class: 'remarque' }, t('ev_sensible', { n: nom(pire) })) : null,
      h('p', { class: 'petit' }, t('ev_note'))));
  }

  // ---- âge de départ
  const ages = Scenarios.agesDeDepart(dossierMoteur, regles, undefined, { impots });
  const graphe = colonnes(ages.map(x => ({
    libelle: String(x.age), besoin: x.besoin, actif: x.age === P.ageRetraite, note: x.lacune > 0 ? '− ' + f.court(x.lacune) : '✓',
    couches: [{ valeur: x.avs, couleur: 'var(--p1)' }, { valeur: x.lpp, couleur: 'var(--p2)' }, { valeur: x.pilier3, couleur: 'var(--p3)' }],
  })), { court: f.court, surClic: i => { d.ageRetraite = ages[i].age; garder(); ctx.recalculer(true); } });
  const choisi = ages.find(x => x.age === P.ageRetraite) ?? ages[5], reference = ages.find(x => x.ecart === 0) ?? choisi;
  blocs.push(carte(t('sc_age'), t('sc_age_d'), graphe,
    h('div', { class: 'chiffres' },
      chiffre(t('sc_depart', { n: choisi.age }), f.chf(choisi.total), t('parAn')),
      chiffre(t('sc_ecartReference'), (choisi.total - reference.total >= 0 ? '+ ' : '− ') + f.chf(Math.abs(choisi.total - reference.total)), t('parAn'),
        choisi.total < reference.total ? 'moins' : 'plus'),
      chiffre(t('lacune'), choisi.lacune > 0 ? f.chf(choisi.lacune / 12) : t('aucuneLacune'), choisi.lacune > 0 ? t('parMois') : '', choisi.lacune > 0 ? 'moins' : 'plus')),
    choisi.pontAVS > 0 ? h('p', { class: 'remarque' }, t('sc_pont', { n: choisi.pontAVS, a: choisi.debutAVS })) : null,
    h('p', { class: 'petit' }, t('sc_age_note'))));

  // ---- test de résistance : la retraite face à une hypothèse qui tourne mal
  const tenue = Vie.resistance(dossierMoteur, regles, { impots }), chocs = tenue.chocs.filter(c => c.applicable);
  if (chocs.length) {
    const nom = c => t('vt_' + c.cle, { a: `${((c.v.a ?? 0) * 100).toFixed(1)} %`, age: c.v.age ?? '', part: f.pourcent(c.v.part ?? 0) });
    const pire = chocs.reduce((m, c) => (c.ecartMensuel > m.ecartMensuel ? c : m), chocs[0]);
    const largeur = x => `${Math.round(Math.min(1, Math.max(0, x)) * 100)}%`;
    blocs.push(carte(t('vi_tenue'), t('vi_tenue_d'),
      h('div', { class: 'effets' }, ...chocs.map(c => h('div', { class: 'effet' },
        h('div', { class: 'effet-tete' }, h('span', {}, nom(c)), h('b', { class: c.lacune > 0 ? 'lacune' : 'ok' }, c.lacune > 0 ? `− ${f.chf(c.lacuneMensuelle)} ${t('parMois')}` : t('aucuneLacune'))),
        h('div', { class: 'effet-barres' }, h('i', { class: 'avant', style: { width: largeur(tenue.base.couverture) } }), h('i', { class: 'apres', style: { width: largeur(c.couverture) } })),
        h('small', {}, c.ecartMensuel > 0 ? t('vi_plus', { m: f.chf(c.ecartMensuel) }) : t('vi_inchange'))))),
      h('p', { class: 'remarque' }, pire.ecartMensuel > 0 ? t('vi_fragile', { n: nom(pire) }) : t('vi_solide')),
      h('p', { class: 'petit' }, t('vi_tenue_note'))));
  }

  // ---- coût de l'attente : remettre le 3a à plus tard
  const attente = Vie.coutAttente(dossierMoteur, regles, { impots });
  if (attente.applicable) {
    const dernier = attente.reports[attente.reports.length - 1];
    blocs.push(carte(t('vi_attente'), t('vi_attente_d', { v: f.chf(attente.versement) }),
      h('div', { class: 'chiffres' }, ...attente.reports.map(r => chiffre(r.annees === 1 ? t('vi_attendre1') : t('vi_attendreN', { n: r.annees }), '− ' + f.chf(r.capitalPerdu), t('vi_capitalPerdu'), 'moins'))),
      h('p', { class: 'remarque' }, t('vi_attente_r', { n: dernier.annees, c: f.chf(dernier.capitalPerdu), r: f.chf(dernier.renteMensuelle), i: f.chf(dernier.impotsPerdus) })),
      h('p', { class: 'petit' }, t('vi_attente_note', { r: (attente.rendement * 100).toFixed(1) }))));
  }

  // ---- rente ou capital
  if (P.lpp.affilie && P.lpp.avoirRetraite > 0) {
    if (!impots || !canton) blocs.push(carte(t('sc_rc'), t('sc_sansImpots')));
    else {
      const autres = a.risques.retraite.sources.filter(s => s.cle === 'avs').reduce((s, x) => s + x.montant, 0);
      const rc = Scenarios.renteOuCapital({ capital: P.lpp.avoirRetraite, tauxConversion: P.lpp.renteVieillesse / P.lpp.avoirRetraite, autresRentes: autres,
        ageRetraite: P.ageRetraite, canton, marie }, impots);
      const noms = ['sc_toutRente', 'sc_moitie', 'sc_toutCapital'], meilleur = Math.max(...rc.options.map(o => o.totalNet));
      blocs.push(carte(t('sc_rc'), t('sc_rc_d', { c: f.chf(P.lpp.avoirRetraite), a: rc.ageFin }),
        h('div', { class: 'options' }, ...rc.options.map((o, i) => h('div', { class: 'option' + (o.totalNet === meilleur ? ' meilleure' : '') },
          h('h3', {}, t(noms[i])), h('b', {}, f.chf(o.revenuAnnuelNet)), h('small', {}, t('sc_netParAn')),
          h('ul', {},
            h('li', {}, h('span', {}, t('sc_renteNette')), h('b', {}, f.chf(o.renteNette))),
            h('li', {}, h('span', {}, t('sc_capitalNet')), h('b', {}, f.chf(o.capitalNet))),
            h('li', {}, h('span', {}, t('sc_impotCapital')), h('b', {}, f.chf(o.impotCapital))),
            h('li', {}, h('span', {}, t('sc_totalNet', { a: rc.ageFin })), h('b', {}, f.chf(o.totalNet))),
            h('li', {}, h('span', {}, t('sc_resteHeritiers')), h('b', {}, f.chf(o.resteAMiParcours))))))),
        rc.seuilRentabilite ? h('p', { class: 'remarque' }, t('sc_seuil', { a: f.nombre(Math.round(rc.seuilRentabilite)) })) : null,
        h('p', { class: 'petit' }, t('sc_rc_note', { r: (rc.rendement * 100).toFixed(1), l: impots.cantons[canton].lieu }))));
    }
  }

  // ---- retrait du 2e pilier pour le logement
  if (P.lpp.affilie && P.lpp.avoirActuel > 0) {
    const cadre = { avoir: P.lpp.avoirActuel, age: P.age, ageRetraite: Math.max(P.ageRetraite, P.ageReference.ans), canton: canton ?? undefined, marie, tauxConversion: P.lpp.tauxConversion };
    const plafond = Scenarios.retraitLogement(cadre, regles, impots);
    if (!plafond.possible) blocs.push(carte(t('sc_logement'), t(plafond.raison === 'tropTard' ? 'sc_logTropTard' : 'sc_logSousMinimum', { m: f.chf(plafond.minimum) })));
    else {
      const retrait = Scenarios.retraitLogement({ ...cadre, montant: d.retraitLogement ?? Math.min(plafond.maximum, 50000) }, regles, impots);
      const pas = 5000, curseur = h('input', { type: 'range', min: plafond.minimum, max: Math.max(plafond.minimum, Math.floor(plafond.maximum / pas) * pas), step: pas, value: retrait.montant,
        'aria-label': t('sc_logMontant'), onchange: e => { d.retraitLogement = +e.target.value; garder(); ctx.recalculer(true); } });
      curseur.style.setProperty('--part', `${plafond.maximum > plafond.minimum ? (retrait.montant - plafond.minimum) / (plafond.maximum - plafond.minimum) * 100 : 100}%`);
      blocs.push(carte(t('sc_logement'), t('sc_logement_d', { m: f.chf(plafond.maximum) }),
        h('label', { class: 'champ' }, h('span', {}, t('sc_logMontant'), h('i', {}, f.chf(retrait.montant))), curseur),
        h('div', { class: 'chiffres' },
          chiffre(t('sc_logNet'), f.chf(retrait.net), impots && canton ? t('sc_logImpot', { i: f.chf(retrait.impot) }) : t('sc_logSansImpot')),
          chiffre(t('sc_logRente'), '− ' + f.chf(retrait.renteEnMoins), t('parAn'), 'moins'),
          chiffre(t('sc_logAvoir'), '− ' + f.chf(retrait.avoirRetraiteEnMoins), t('sc_logAvoir_d', { a: cadre.ageRetraite }), 'moins')),
        h('p', { class: 'petit' }, t('sc_logNote'))));
    }
  }

  // ---- retraits échelonnés et rachats échelonnés
  if (impots && canton) {
    const lignes = [];
    const capitaux = [a.personne.capital3a, P.lpp.affilie ? P.lpp.avoirRetraite * 0.5 : 0].filter(x => x > 0);
    const total3a = a.personne.capital3a;
    if (total3a > 50000) {
      const parts = Array.from({ length: 3 }, () => total3a / 3), e = Impots.retraitsEchelonnes(impots, canton, marie, parts);
      if (e) lignes.push(h('div', { class: 'levier' }, h('b', {}, t('sc_ech3a')), h('p', {}, t('sc_ech3a_d', { c: f.chf(total3a), u: f.chf(e.unique), e: f.chf(e.echelonne), g: f.chf(e.economie) }))));
    }
    if (capitaux.length === 2) {
      const e = Impots.retraitsEchelonnes(impots, canton, marie, capitaux);
      if (e && e.economie > 0) lignes.push(h('div', { class: 'levier' }, h('b', {}, t('sc_echLpp')), h('p', {}, t('sc_echLpp_d', { g: f.chf(e.economie) }))));
    }
    if (a.potentiels.rachatLPP.possible > 0) {
      const plans = Impots.rachatEchelonne(impots, canton, marie, P.revenu + (a.conjoint && marie ? a.conjoint.revenu : 0), a.potentiels.rachatLPP.possible, 5, a.enfantsACharge);
      const mieux = plans.reduce((m, x) => (x.economie > m.economie ? x : m), plans[0]);
      lignes.push(h('div', { class: 'levier' }, h('b', {}, t('sc_rachat')),
        h('p', {}, t('sc_rachat_d', { m: f.chf(a.potentiels.rachatLPP.possible), u: f.chf(plans[0].economie), n: mieux.annees, e: f.chf(mieux.economie), p: f.chf(mieux.parAn) })),
        h('div', { class: 'mini-barres' }, ...plans.map(x => h('div', { class: x === mieux ? 'actif' : '' },
          h('i', { style: { height: `${Math.round(x.economie / mieux.economie * 100)}%` } }), h('b', {}, f.court(x.economie)), h('small', {}, t('sc_surAns', { n: x.annees })))))));
    }
    if (lignes.length) blocs.push(carte(t('sc_fiscal'), t('sc_fiscal_d', { l: impots.cantons[canton].lieu, d: impots.releveLe }), ...lignes, h('p', { class: 'petit' }, t('sc_fiscal_note'))));
  }

  // ---- et dans un autre canton ? impôt sur le revenu du ménage, chef-lieu par chef-lieu
  if (impots && canton) {
    const brut = P.revenu + (a.conjoint && marie ? a.conjoint.revenu : 0);
    const valeurs = Object.keys(impots.cantons).map(c => ({ c, v: Impots.impotRevenu(impots, c, marie, brut, a.enfantsACharge)?.impot ?? 0 })).sort((x, y) => x.v - y.v);
    const ici = valeurs.find(x => x.c === canton), max = Math.max(...valeurs.map(x => x.v), 1), moins = valeurs[0];
    blocs.push(carte(t('sc_cantons'), t('sc_cantons_d', { r: f.chf(brut) }),
      h('div', { class: 'cantons-barres' }, ...valeurs.map((x, i) => h('div', { class: x.c === canton ? 'actif' : '', style: { '--i': i }, title: `${t('ct_' + x.c)} · ${f.chf(x.v)}` },
        h('b', {}, f.court(x.v)), h('i', { style: { height: `${Math.round(x.v / max * 100)}%` } }), h('small', {}, x.c)))),
      h('div', { class: 'chiffres' },
        chiffre(`${canton} · ${impots.cantons[canton].lieu}`, f.chf(ici?.v ?? 0), t('parAn')),
        chiffre(`${moins.c} · ${impots.cantons[moins.c].lieu}`, f.chf(moins.v), t('sc_cantonMoins'), 'plus'),
        chiffre(t('sc_cantonEcart'), f.chf((ici?.v ?? 0) - moins.v), t('parAn'))),
      h('p', { class: 'petit' }, `${impots.source}. ${impots.hypotheses}.`)));
  }

  // ---- placement : simulation
  const annees = Math.max(1, P.ageRetraite - P.age), profil = PROFILS[d.profilPlacement] ?? PROFILS.equilibre;
  const versement = (d.cible === 'conjoint' ? d.conjoint : d.personne).versement3a || a.potentiels.pilier3a.plafond;
  const depart = (d.cible === 'conjoint' ? d.conjoint : d.personne).avoir3a || 0;
  const sim = Scenarios.simulerPlacement({ capital: depart, versement, annees, rendement: profil.rendement, volatilite: profil.volatilite });
  const fin = sim[sim.length - 1];
  blocs.push(carte(t('sc_placement'), t('sc_placement_d', { v: f.chf(versement), n: annees }),
    h('div', { class: 'segments', role: 'group' }, ...Object.keys(PROFILS).map(cle => h('button', { type: 'button', 'aria-pressed': String(cle === d.profilPlacement),
      onclick: () => { d.profilPlacement = cle; garder(); afficher(ctx); } }, t('pr_' + cle)))),
    couloir(sim, { court: f.court, ageDepart: P.age }),
    h('div', { class: 'chiffres' },
      chiffre(t('sc_prudent'), f.chf(fin.p10), t('sc_p10')), chiffre(t('sc_median'), f.chf(fin.p50), t('sc_p50'), 'plus'),
      chiffre(t('sc_favorable'), f.chf(fin.p90), t('sc_p90')), chiffre(t('sc_verse'), f.chf(fin.verse), t('sc_sansRendement'))),
    h('p', { class: 'petit' }, t('sc_placement_note', { r: (profil.rendement * 100).toFixed(1), v: Math.round(profil.volatilite * 100) }))));

  // ---- hypothèque à la retraite
  if (d.bien?.valeur > 0 && d.bien?.dette > 0) {
    const revenuMenage = a.risques.retraite.total + (a.conjoint ? a.conjoint.avsMensuelle * 13 + a.conjoint.lppRente : 0);
    const actuel = Scenarios.chargeHypothecaire({ valeur: d.bien.valeur, dette: d.bien.dette, revenu: P.revenu + (a.conjoint ? a.conjoint.revenu : 0) });
    const retraite = Scenarios.chargeHypothecaire({ valeur: d.bien.valeur, dette: d.bien.dette, revenu: revenuMenage });
    const jauge = (x, libelle) => h('div', { class: 'tenue' + (x.tenable ? '' : ' depasse') },
      h('small', {}, libelle), h('b', {}, f.pourcent(Math.min(9.99, x.ratio))),
      h('div', { class: 'tenue-barre' }, h('i', { style: { width: `${Math.min(100, x.ratio / 0.6 * 100)}%` } }), h('em', {})));
    blocs.push(carte(t('sc_hypo'), t('sc_hypo_d'),
      h('div', { class: 'tenues' }, jauge(actuel, t('sc_aujourdhui')), jauge(retraite, t('sc_aLaRetraite'))),
      h('p', { class: 'remarque' + (retraite.tenable ? ' ok' : '') }, retraite.tenable ? t('sc_hypo_ok', { c: f.chf(retraite.charge) })
        : t('sc_hypo_ko', { c: f.chf(retraite.charge), m: f.chf(retraite.amortissement), d: f.chf(retraite.detteMax) })),
      h('p', { class: 'petit' }, t('sc_hypo_note'))));
  }

  blocs.forEach((b, i) => b.style.setProperty('--i', String(i)));
  zone.replaceChildren(...blocs);
}
