// @ts-check
/**
 * Ce que l'app iPhone / iPad affiche avec ses propres écrans.
 *
 * L'app ne calcule rien et ne traduit rien : la page lui remet des modèles d'affichage prêts (libellés dans la langue
 * choisie, montants déjà mis en forme), tirés de la même analyse que partout ailleurs. Une seule source de vérité
 * pour les chiffres ; l'app n'a plus qu'à dessiner.
 */

import { etat, dossier } from './etat.js';
import { RISQUES, texteAlerte, pointsDuGraphique } from './vues/analyse.js';

const GRAVITES = ['critique', 'attention', 'opportunite', 'info'];

/** L'écran « Analyse ». @param {any} ctx @returns {any|null} */
export function analyse(ctx) {
  const { t, f, analyse: a } = ctx;
  if (!a) return null;
  const d = dossier(), x = a.risques[etat.risque] ?? a.risques.retraite;
  const plusTard = r => r.lacune === 0 && (r.lacuneMax ?? 0) > 0;
  const verse = n => x.sources.filter(s => s.pilier === n).reduce((s, y) => s + y.montant, 0);
  const points = pointsDuGraphique(a, x);
  return {
    score: a.score, scoreNom: t('score'),
    cible: d.avecConjoint ? { choix: d.cible === 'conjoint' ? 'conjoint' : 'personne', personne: t('client'), conjoint: t('conjointCourt') } : null,
    risque: x.cle,
    titre: `${t(x.cle)} — ${x.lacune > 0 ? t('lacune') : plusTard(x) ? t('lacune') : t('aucuneLacune')}`,
    montant: f.chf(plusTard(x) ? x.lacuneMax / 12 : x.lacuneMensuelle), parMois: plusTard(x) ? t('lacunePlusTard') : t('parMois'),
    cles: [{ nom: t('couvert'), valeur: f.pourcent(Math.min(1, x.couverture)) }, { nom: t('besoin'), valeur: f.chf(x.besoin) }, { nom: t('capital'), valeur: f.chf(x.capital ?? 0) }],
    bouton: t('voirConseil'),
    piliers: [1, 2, 3].map(n => ({ nom: t(n === 3 ? 'pilier3c' : 'pilier' + n), montant: f.chf(verse(n)), vide: verse(n) < 1 })),
    risques: RISQUES.map(cle => {
      const y = a.risques[cle], tard = plusTard(y);
      return { cle, nom: t(cle), actif: cle === x.cle, couverture: y.besoin === 0 ? 0 : Math.min(1, y.couverture),
        montant: y.besoin === 0 ? '—' : (y.lacune > 0 || tard ? '− ' : '') + f.chf(tard ? y.lacuneMax / 12 : y.lacuneMensuelle),
        note: y.besoin === 0 ? t('sansObjet') : tard ? t('lacunePlusTard') : y.lacune > 0 ? t('parMois') : t('aucuneLacune'), lacune: y.lacune > 0 || tard };
    }),
    detailTitre: t('detail'),
    sources: [...x.sources.map(s => ({ nom: t('s_' + s.cle) + (s.estime ? ` (${t('estime')})` : '') + (s.reduit ? ` (${t('reduit')})` : ''), montant: f.chf(s.montant), pilier: s.pilier, part: s.montant / Math.max(x.besoin, x.total, 1) })),
      { nom: t('besoin'), montant: f.chf(x.besoin), pilier: 0, part: 0 },
      ...(x.lacune > 0 ? [{ nom: `${t('lacune')} ${t('parAn')}`, montant: '− ' + f.chf(x.lacune), pilier: -1, part: x.lacune / Math.max(x.besoin, x.total, 1) }] : [])],
    attente: x.attente ? `${t('attente')} : ${t('att_' + x.attente.cle, { t: Math.round(x.attente.taux * 100), j: x.attente.jours, s: Math.round(x.attente.jours / 7) })}` : '',
    ligneTitre: t('ligneDeVie'), ligneNote: t('revenuSelonAge'),
    // la ligne de vie : par âge, ce que versent le salaire et chaque pilier, et le besoin
    ligne: points.map(p => ({ age: p.age, besoin: Math.round(p.besoin), salaire: Math.round((p.v.salaire ?? 0) + (p.v.attente ?? 0)), p1: Math.round(p.v.pilier1 ?? 0), p2: Math.round(p.v.pilier2 ?? 0), p3: Math.round(p.v.pilier3 ?? 0) })),
    legende: { salaire: t('s_salaire'), p1: t('pilier1'), p2: t('pilier2'), p3: t('pilier3c'), besoin: t('besoin') },
    alertesTitre: t('alertes'),
    alertes: [...a.alertes].sort((p, q) => GRAVITES.indexOf(p.gravite) - GRAVITES.indexOf(q.gravite)).map(al => ({ gravite: al.gravite, texte: texteAlerte(ctx, al) })),
    avertissement: t('avertissement'),
  };
}

// ---------------------------------------------------------------------------------------------- écrans décrits

/** Actions des éléments décrits à l'app (curseurs, choix, boutons, champs), par identifiant. */
const actions = new Map();
let numero = 0;
const action = f => { const id = `e${numero++}`; actions.set(id, f); return id; };
const texte = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const visible = el => !el.hidden && getComputedStyle(el).display !== 'none';
const pourcent = valeur => Math.max(0, Math.min(1, (parseFloat(valeur) || 0) / 100));
const signaler = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

/** L'app a agi sur un élément décrit. */
export function agir(id, valeur) {
  actions.get(id)?.(valeur);
}

/** Décrit les enfants d'un élément : des blocs simples que l'app sait dessiner. */
function decrire(parent, sortie) {
  for (const el of /** @type {HTMLElement[]} */ ([...parent.children])) {
    if (!visible(el)) continue;
    const c = el.classList, balise = el.tagName;
    const natif = /** @type {any} */ (el).__natif;
    if (natif?.type === 'colonnes') {
      sortie.push({ type: 'colonnes', colonnes: natif.colonnes, id: natif.surClic ? action(i => natif.surClic(+i)) : '' });
    } else if (natif?.type === 'couloir') sortie.push({ type: 'couloir', points: natif.points, depart: natif.depart });
    else if (balise === 'H2') continue;
    else if (balise === 'H3' || c.contains('intertitre') || c.contains('surtitre')) sortie.push({ type: 'titre', texte: texte(el) });
    else if (c.contains('carte-tete')) {
      // le titre et son sous-titre sont repris par la carte ; le reste (bouton, total…) suit
      for (const enfant of /** @type {HTMLElement[]} */ ([...el.children])) {
        if (enfant.querySelector(':scope > h2')) continue;
        decrire({ children: [enfant] }, sortie);
      }
    } else if (c.contains('chiffres') || c.contains('avant-apres') || c.contains('tenues')) {
      const jauges = c.contains('tenues');
      sortie.push({ type: jauges ? 'jauges' : 'chiffres', elements: [...el.children].filter(x => x.querySelector('b')).map(x => ({
        nom: texte(x.querySelector('small')), valeur: texte(x.querySelector('b')), note: texte(x.querySelector(':scope > span')),
        ton: x.classList.contains('moins') || x.classList.contains('depasse') ? 'moins' : x.classList.contains('plus') || x.classList.contains('apres') ? 'plus' : '',
        part: jauges ? pourcent(/** @type {HTMLElement|null} */ (x.querySelector('.tenue-barre i'))?.style.width) : 0 })) });
    } else if (c.contains('options')) {
      for (const o of el.children) sortie.push({ type: 'option', titre: texte(o.querySelector('h3')), valeur: texte(o.querySelector(':scope > b')), note: texte(o.querySelector(':scope > small')),
        meilleure: o.classList.contains('meilleure'), lignes: [...o.querySelectorAll('li')].map(li => ({ nom: texte(li.querySelector('span')), valeur: texte(li.querySelector('b')) })) });
    } else if (c.contains('levier')) {
      sortie.push({ type: 'levier', titre: texte(el.querySelector(':scope > b')), texte: texte(el.querySelector(':scope > p')) });
      for (const barres of el.querySelectorAll(':scope > .mini-barres')) decrire({ children: [barres] }, sortie);
    } else if (c.contains('effet')) {
      const [avant, apres] = /** @type {HTMLElement[]} */ ([...el.querySelectorAll('.effet-barres i')]);
      sortie.push({ type: 'effet', nom: texte(el.querySelector('.effet-tete span')), valeur: texte(el.querySelector('.effet-tete b')), note: texte(el.querySelector(':scope > small')),
        avant: pourcent(avant?.style.width), apres: pourcent(apres?.style.width), lacune: !!el.querySelector('.effet-tete b.lacune') });
    } else if (c.contains('conseil-liste')) {
      sortie.push({ type: 'points', points: [...el.children].map(li => ({ rang: texte(li.querySelector('.conseil-rang')), urgence: /** @type {HTMLElement} */ (li).dataset.urgence ?? '',
        nom: texte(li.querySelector('small')), texte: texte(li.querySelector('p')) })) });
    } else if (balise === 'UL' || balise === 'OL') {
      sortie.push({ type: 'lignes', lignes: [...el.children].map(li => {
        const b = li.querySelector(':scope > b'), nom = li.querySelector(':scope > span') ?? li;
        return { nom: b ? texte(nom) : texte(li), valeur: b && nom !== li ? texte(b) : '', fort: li.classList.contains('total'), ton: li.classList.contains('manque') ? 'moins' : '',
          gravite: /** @type {HTMLElement} */ (li).style.getPropertyValue('--c').replace(/var\(--|\)/g, '') };
      }).filter(l => l.nom || l.valeur) });
    } else if (balise === 'TABLE') {
      const rangees = [...el.querySelectorAll('tr')].map(tr => [...tr.children].map(texte));
      sortie.push({ type: 'tableau', entetes: rangees[0] ?? [], lignes: rangees.slice(1) });
    } else if (c.contains('cantons-barres') || c.contains('mini-barres')) {
      sortie.push({ type: 'barres', dense: c.contains('cantons-barres'), barres: [...el.children].map(x => ({ libelle: texte(x.querySelector('small')), valeur: texte(x.querySelector('b')),
        part: pourcent(/** @type {HTMLElement|null} */ (x.querySelector('i'))?.style.height), actif: x.classList.contains('actif') })) });
    } else if (c.contains('segments')) {
      const boutons = /** @type {HTMLElement[]} */ ([...el.querySelectorAll('button')]);
      sortie.push({ type: 'choix', options: boutons.map(b => texte(b)), choisi: Math.max(0, boutons.findIndex(b => b.getAttribute('aria-pressed') === 'true')), id: action(i => boutons[+i]?.click()) });
    } else if (balise === 'LABEL' && (c.contains('champ') || c.contains('bascule'))) {
      const entree = /** @type {HTMLInputElement|null} */ (el.querySelector('input'));
      if (!entree) continue;
      const etiquette = el.querySelector(':scope > span');
      const nom = etiquette ? texte({ textContent: [...etiquette.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ') }) || texte(etiquette) : texte({ textContent: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ') });
      if (entree.type === 'range') sortie.push({ type: 'curseur', nom, affichage: texte(el.querySelector('output, span > i')), valeur: +entree.value, min: +entree.min, max: +entree.max, pas: +entree.step || 1,
        id: action(v => { entree.value = String(v); signaler(entree, 'input'); signaler(entree, 'change'); }) });
      else if (entree.type === 'checkbox') sortie.push({ type: 'bascule', nom, actif: entree.checked, id: action(v => { entree.checked = !!v; signaler(entree, 'change'); }) });
      else if (entree.type === 'text') sortie.push({ type: 'champ', nom, valeur: entree.value, indication: entree.placeholder, numerique: entree.inputMode === 'numeric',
        id: action(v => { entree.value = String(v ?? ''); signaler(entree, 'input'); signaler(entree, 'blur'); }) });
    } else if (balise === 'BUTTON') {
      if (texte(el)) sortie.push({ type: 'bouton', texte: texte(el), principal: c.contains('bouton'), id: action(() => el.click()) });
    } else if (balise === 'P' || balise === 'SMALL' || balise === 'A') {
      const contenu = texte(el);
      if (contenu) sortie.push({ type: c.contains('remarque') || c.contains('attente') ? 'remarque' : c.contains('grand') || c.contains('conseil-resume') ? 'grand'
        : c.contains('petit') || c.contains('note') || c.contains('avertissement') || balise !== 'P' ? 'note' : 'texte', texte: contenu });
    } else if (c.contains('pile') || c.contains('jauge') || c.contains('page') || balise === 'CANVAS' || balise === 'SVG' || balise === 'svg') continue;
    else decrire(el, sortie);
  }
  return sortie;
}

/** L'écran affiché par la page, en cartes : titre, sous-titre et blocs. Les pages du rapport (papier) n'en font pas partie. */
export function ecran(racine) {
  actions.clear();
  numero = 0;
  const cartes = /** @type {HTMLElement[]} */ ([...racine.querySelectorAll('.carte')]).filter(c => visible(c) && !c.closest('.page') && !c.parentElement?.closest('.carte'));
  return { cartes: cartes.map(c => {
    const titre = c.querySelector(':scope > h2, :scope > .carte-tete h2');
    return { titre: texte(titre), sousTitre: texte(titre?.parentElement?.querySelector(':scope > p')), blocs: decrire(c, []) };
  }).filter(c => c.titre || c.blocs.length) };
}
