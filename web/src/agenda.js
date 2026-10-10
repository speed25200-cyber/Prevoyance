// @ts-check
/**
 * L'agenda des échéances : les dates légales de la feuille de route (versement 3a, dernier rachat, retraits, rente
 * AVS…), pour un dossier ou pour tout le portefeuille, en fichier d'agenda (.ics, RFC 5545) que lisent Outlook,
 * Apple Calendrier et Google Agenda. Le courtier ne laisse plus passer une échéance qui ne se rattrape pas.
 *
 * Les dates viennent du moteur (`Vie.feuilleDeRoute`), jamais d'ici ; le texte est celui de l'écran, dans la langue
 * de l'interface. Le fichier est écrit sur l'appareil : rien n'est envoyé.
 */

import { Vie, Impots } from '../../moteur/src/index.js';
import { versDossier } from './etat.js';

const deux = n => String(n).padStart(2, '0');

/** La phrase d'une échéance, telle qu'elle s'affiche dans la feuille de route. */
export function texteEtape(etape, { t, f }) {
  return t('vr_' + etape.cle, { m: f.chf(etape.v.montant ?? 0), e: f.chf(etape.v.economie ?? 0), a: etape.v.depart ?? '',
    d: etape.v.mois ? `${deux(etape.v.mois)}.${etape.v.anneeRente}` : '' });
}

/**
 * Le jour où poser une échéance dans l'agenda (AAAAMMJJ).
 * - versement 3a : le 1er décembre (le versement doit arriver avant le 31) ;
 * - rente AVS : le premier jour du mois où elle commence ;
 * - les autres tiennent à un âge : l'anniversaire de l'année concernée (un 29 février devient le 28).
 * @param {{cle: string, annee: number, v: Record<string, number>}} etape @param {string} naissance AAAA-MM-JJ
 */
export function jourDe(etape, naissance) {
  if (etape.cle === 'versement3a') return `${etape.annee}1201`;
  if (etape.cle === 'renteAVS' && etape.v.mois) return `${etape.v.anneeRente}${deux(etape.v.mois)}01`;
  const [, mois = '01', jour = '01'] = String(naissance ?? '').split('-');
  const bissextile = etape.annee % 4 === 0 && (etape.annee % 100 !== 0 || etape.annee % 400 === 0);
  return `${etape.annee}${mois}${mois === '02' && jour === '29' && !bissextile ? '28' : jour}`;
}

/**
 * Les échéances à venir de plusieurs dossiers, dans l'ordre des dates.
 * @param {any[]} dossiers @param {any} ctx
 * @returns {{id: string, nom: string, cle: string, annee: number, age: number, jour: string, texte: string}[]}
 */
export function echeances(dossiers, ctx) {
  const liste = [];
  for (const d of dossiers) {
    try {
      const impots = Impots.localiser(ctx.impotsBase, ctx.communes, d.canton, { commune: d.commune ?? null, confession: d.confession ?? 'sans' });
      const moteur = versDossier(d, 'personne');
      for (const etape of Vie.feuilleDeRoute(moteur, ctx.regles, { impots })) {
        liste.push({ id: String(d.id), nom: d.nom || ctx.t('sansNom'), cle: etape.cle, annee: etape.annee, age: etape.age,
          jour: jourDe(etape, moteur.personne.dateNaissance), texte: texteEtape(etape, ctx) });
      }
    } catch { /* dossier incomplet : pas d'échéance calculable */ }
  }
  return liste.sort((a, b) => a.jour.localeCompare(b.jour));
}

/** Texte d'un champ d'agenda : les caractères réservés sont protégés. */
const proteger = texte => String(texte).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Une ligne d'agenda ne dépasse pas 75 octets : la suite passe à la ligne, précédée d'une espace. */
function plier(ligne) {
  const octets = new TextEncoder();
  let sortie = '', courant = '', taille = 0;
  for (const caractere of ligne) {
    const n = octets.encode(caractere).length;
    if (taille + n > 73) { sortie += courant + '\r\n '; courant = ''; taille = 1; }
    courant += caractere; taille += n;
  }
  return sortie + courant;
}

/** Le lendemain d'un jour AAAAMMJJ (un événement d'une journée finit le lendemain, borne exclue). */
function lendemain(jour) {
  const d = new Date(Date.UTC(+jour.slice(0, 4), +jour.slice(4, 6) - 1, +jour.slice(6, 8) + 1));
  return `${d.getUTCFullYear()}${deux(d.getUTCMonth() + 1)}${deux(d.getUTCDate())}`;
}

/**
 * Le fichier d'agenda : un événement d'une journée par échéance.
 * @param {ReturnType<typeof echeances>} liste @param {{t: (cle: string, v?: any) => string}} ctx
 */
export function enICS(liste, { t }) {
  const maintenant = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prevoyance//Echeances//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${proteger(t('ag_titre'))}`];
  for (const e of liste) {
    lignes.push('BEGIN:VEVENT', `UID:${e.id}-${e.cle}-${e.annee}@prevoyance.local`, `DTSTAMP:${maintenant}`,
      `DTSTART;VALUE=DATE:${e.jour}`, `DTEND;VALUE=DATE:${lendemain(e.jour)}`,
      `SUMMARY:${proteger(`${e.nom} — ${e.texte}`)}`, `DESCRIPTION:${proteger(`${e.texte}\n${t('vi_ans', { n: e.age })} · ${e.nom}`)}`,
      'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lignes.push('END:VCALENDAR');
  return lignes.map(plier).join('\r\n') + '\r\n';
}
