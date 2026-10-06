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
