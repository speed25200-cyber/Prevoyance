// @ts-check
/**
 * Page d'entrée : le film alpin avance avec le défilement (suite d'images dessinée sur un canevas), les chapitres
 * se relaient par-dessus, puis un simulateur branché sur le vrai moteur de calcul.
 * Sans mouvement demandé par l'appareil, le film reste sur sa première image et les chapitres se lisent à la suite.
 */

import { analyser, ANNEES, Impots } from '../../moteur/src/index.js';
import { dossierVide, versDossier, CANTONS } from './etat.js';
import * as Donnees from './donnees.js';

const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));
const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ------------------------------------------------------------------------------------------------ textes
const LANGUES = ['fr', 'de', 'it', 'en'];
const T = {
  fr: {
    ouvrir: 'Ouvrir l’analyse', essayer: 'Essayer en 10 secondes', exemple: 'Voir un dossier d’exemple', defiler: 'Défiler', parMois: 'par mois',
    c0_sur: 'Prévoyance suisse · 1er, 2e et 3e pilier', c0_titre: 'Votre retraite,<br><em>vue d’en haut.</em>',
    c0_texte: 'Ce que vous toucherez, ce qu’il manquera, et ce qu’il faut faire — chiffré au franc près.',
    c1_sur: 'Le point de départ', c1_titre: 'Trois piliers.<br><em>Une seule image.</em>',
    c1_texte: 'AVS, caisse de pension, 3e pilier : chaque rente est calculée selon les règles de l’année, puis réunie sur une ligne de vie.',
    p1: 'AVS / AI', p2: 'Caisse de pension', p3: 'Épargne privée',
    c2_sur: 'Le constat', c2_titre: 'La lacune,<br><em>chiffrée.</em>',
    c2_texte: 'Retraite, invalidité, décès : pour chaque risque, le revenu garanti, le besoin et l’écart entre les deux.',
    c3_sur: 'La suite', c3_titre: 'Un plan,<br><em>daté.</em>',
    c3_texte: 'Rachats, versements 3a, retraits échelonnés : chaque mesure a son gain, son coût et sa dernière date utile.',
    r1_quand: 'Chaque année', r1_quoi: 'Versement 3a avant le 31 décembre', r2_quand: 'Dès 50 ans', r2_quoi: 'Rachats dans la caisse de pension',
    r3_quand: '5 ans avant', r3_quoi: 'Retraits du 3a, échelonnés',
    c4_titre: 'Voyez clair.<br><em>Décidez tôt.</em>', c4_texte: 'L’analyse complète se fait en quelques minutes. Vos données restent sur votre appareil.',
    s_sur: 'À vous', s_titre: 'Votre lacune, <em>en direct.</em>',
    s_texte: 'Trois réglages, le vrai moteur de calcul. Une estimation : l’analyse complète tient compte de vos certificats.',
    s_age: 'Âge', s_revenu: 'Revenu annuel brut', s_depart: 'Départ à la retraite', s_canton: 'Canton', s_statut: 'Statut', s_salarie: 'Salarié', s_independant: 'Indépendant',
    s_resultat: 'Lacune à la retraite', s_couvert: 'du besoin couvert', s_complet: 'Faire l’analyse complète', s_aucune: 'Aucune lacune',
    s_p1: '1er pilier · AVS', s_p2: '2e pilier · caisse de pension', s_p3: '3e pilier et fortune', s_besoin: 'Besoin à la retraite', ans: 'ans', an: '/ an',
    f_sur: 'Dans l’analyse', f_titre: 'Tout ce qu’un bon conseil <em>doit montrer.</em>',
    f1: 'Ligne de vie', f1t: 'Vos revenus année par année, de l’activité à la retraite. Faites glisser l’âge du départ et tout se recalcule.',
    f2: 'Trois risques', f2t: 'Retraite, invalidité, décès — par maladie et par accident, avec le capital qui comblerait chaque écart.',
    f3: 'Test de résistance', f3t: 'Taux de conversion en baisse, rendement nul, cinq ans de vie en plus : ce que votre plan supporte.',
    f4: 'Feuille de route', f4t: 'Les échéances légales à ne pas manquer, datées pour vous : 3a, rachats, retraits, rente AVS.',
    f5: 'Deux offres, comparées', f5t: 'Prime, rente d’invalidité, capital décès : l’effet réel de chaque offre sur vos lacunes.',
    f6: 'Rapport signé', f6t: 'Un PDF aux couleurs de votre cabinet, tirées de votre logo. Prêt à remettre au client.',
    v1: 'cas de calcul contrôlés à la main', v2: 'cantons, barèmes fiscaux réels', v3: 'langues : FR · DE · IT · EN', v4: 'donnée envoyée à un serveur',
    pied: 'Estimations selon les règles légales de l’année ; elles ne remplacent ni un certificat de prévoyance ni un conseil personnalisé.',
    titrePage: 'Prévoyance — votre retraite, vue d’en haut',
  },
  de: {
    ouvrir: 'Analyse öffnen', essayer: 'In 10 Sekunden testen', exemple: 'Beispieldossier ansehen', defiler: 'Scrollen', parMois: 'pro Monat',
    c0_sur: 'Schweizer Vorsorge · 1., 2. und 3. Säule', c0_titre: 'Ihre Pensionierung,<br><em>von oben gesehen.</em>',
    c0_texte: 'Was Sie erhalten, was fehlen wird und was zu tun ist — auf den Franken genau.',
    c1_sur: 'Der Ausgangspunkt', c1_titre: 'Drei Säulen.<br><em>Ein einziges Bild.</em>',
    c1_texte: 'AHV, Pensionskasse, 3. Säule: Jede Rente wird nach den Regeln des Jahres berechnet und auf einer Lebenslinie vereint.',
    p1: 'AHV / IV', p2: 'Pensionskasse', p3: 'Privates Sparen',
    c2_sur: 'Der Befund', c2_titre: 'Die Lücke,<br><em>beziffert.</em>',
    c2_texte: 'Alter, Invalidität, Tod: für jedes Risiko das gesicherte Einkommen, der Bedarf und die Differenz.',
    c3_sur: 'Der nächste Schritt', c3_titre: 'Ein Plan,<br><em>mit Datum.</em>',
    c3_texte: 'Einkäufe, 3a-Einzahlungen, gestaffelte Bezüge: Jede Massnahme hat ihren Nutzen, ihre Kosten und ihre letzte Frist.',
    r1_quand: 'Jedes Jahr', r1_quoi: '3a-Einzahlung vor dem 31. Dezember', r2_quand: 'Ab 50', r2_quoi: 'Einkäufe in die Pensionskasse',
    r3_quand: '5 Jahre vorher', r3_quoi: '3a-Bezüge, gestaffelt',
    c4_titre: 'Klar sehen.<br><em>Früh entscheiden.</em>', c4_texte: 'Die vollständige Analyse dauert wenige Minuten. Ihre Daten bleiben auf Ihrem Gerät.',
    s_sur: 'Sie sind dran', s_titre: 'Ihre Lücke, <em>live.</em>',
    s_texte: 'Drei Regler, die echte Berechnung. Eine Schätzung: Die vollständige Analyse berücksichtigt Ihre Ausweise.',
    s_age: 'Alter', s_revenu: 'Bruttojahreseinkommen', s_depart: 'Pensionierung mit', s_canton: 'Kanton', s_statut: 'Status', s_salarie: 'Angestellt', s_independant: 'Selbstständig',
    s_resultat: 'Lücke im Alter', s_couvert: 'des Bedarfs gedeckt', s_complet: 'Vollständige Analyse starten', s_aucune: 'Keine Lücke',
    s_p1: '1. Säule · AHV', s_p2: '2. Säule · Pensionskasse', s_p3: '3. Säule und Vermögen', s_besoin: 'Bedarf im Alter', ans: 'Jahre', an: '/ Jahr',
    f_sur: 'In der Analyse', f_titre: 'Alles, was eine gute Beratung <em>zeigen muss.</em>',
    f1: 'Lebenslinie', f1t: 'Ihr Einkommen Jahr für Jahr, vom Erwerb bis ins Alter. Pensionierungsalter verschieben, alles rechnet neu.',
    f2: 'Drei Risiken', f2t: 'Alter, Invalidität, Tod — bei Krankheit und Unfall, mit dem Kapital, das jede Lücke schliesst.',
    f3: 'Stresstest', f3t: 'Tieferer Umwandlungssatz, null Rendite, fünf Jahre länger leben: was Ihr Plan aushält.',
    f4: 'Fahrplan', f4t: 'Die gesetzlichen Fristen, für Sie datiert: 3a, Einkäufe, Bezüge, AHV-Rente.',
    f5: 'Zwei Offerten im Vergleich', f5t: 'Prämie, Invalidenrente, Todesfallkapital: die echte Wirkung jeder Offerte auf Ihre Lücken.',
    f6: 'Signierter Bericht', f6t: 'Ein PDF in den Farben Ihres Büros, aus Ihrem Logo abgeleitet. Bereit für den Kunden.',
    v1: 'von Hand geprüfte Rechenfälle', v2: 'Kantone, echte Steuertarife', v3: 'Sprachen: FR · DE · IT · EN', v4: 'Daten an einen Server gesendet',
    pied: 'Schätzungen nach den gesetzlichen Regeln des Jahres; sie ersetzen weder einen Vorsorgeausweis noch eine persönliche Beratung.',
    titrePage: 'Vorsorge — Ihre Pensionierung, von oben gesehen',
  },
  it: {
    ouvrir: 'Apri l’analisi', essayer: 'Prova in 10 secondi', exemple: 'Vedi un dossier d’esempio', defiler: 'Scorri', parMois: 'al mese',
    c0_sur: 'Previdenza svizzera · 1°, 2° e 3° pilastro', c0_titre: 'La vostra pensione,<br><em>vista dall’alto.</em>',
    c0_texte: 'Ciò che riceverete, ciò che mancherà e ciò che occorre fare — al franco.',
    c1_sur: 'Il punto di partenza', c1_titre: 'Tre pilastri.<br><em>Una sola immagine.</em>',
    c1_texte: 'AVS, cassa pensione, 3° pilastro: ogni rendita è calcolata secondo le regole dell’anno e riunita su una linea della vita.',
    p1: 'AVS / AI', p2: 'Cassa pensione', p3: 'Risparmio privato',
    c2_sur: 'La constatazione', c2_titre: 'La lacuna,<br><em>in cifre.</em>',
    c2_texte: 'Vecchiaia, invalidità, decesso: per ogni rischio il reddito garantito, il fabbisogno e la differenza.',
    c3_sur: 'Il seguito', c3_titre: 'Un piano,<br><em>con le date.</em>',
    c3_texte: 'Riscatti, versamenti 3a, prelievi scaglionati: ogni misura ha il suo guadagno, il suo costo e la sua ultima data utile.',
    r1_quand: 'Ogni anno', r1_quoi: 'Versamento 3a entro il 31 dicembre', r2_quand: 'Dai 50 anni', r2_quoi: 'Riscatti nella cassa pensione',
    r3_quand: '5 anni prima', r3_quoi: 'Prelievi del 3a, scaglionati',
    c4_titre: 'Vedere chiaro.<br><em>Decidere presto.</em>', c4_texte: 'L’analisi completa richiede pochi minuti. I vostri dati restano sul vostro dispositivo.',
    s_sur: 'Tocca a voi', s_titre: 'La vostra lacuna, <em>in diretta.</em>',
    s_texte: 'Tre regolazioni, il vero motore di calcolo. Una stima: l’analisi completa tiene conto dei vostri certificati.',
    s_age: 'Età', s_revenu: 'Reddito annuo lordo', s_depart: 'Pensionamento a', s_canton: 'Cantone', s_statut: 'Statuto', s_salarie: 'Dipendente', s_independant: 'Indipendente',
    s_resultat: 'Lacuna alla pensione', s_couvert: 'del fabbisogno coperto', s_complet: 'Fare l’analisi completa', s_aucune: 'Nessuna lacuna',
    s_p1: '1° pilastro · AVS', s_p2: '2° pilastro · cassa pensione', s_p3: '3° pilastro e patrimonio', s_besoin: 'Fabbisogno alla pensione', ans: 'anni', an: '/ anno',
    f_sur: 'Nell’analisi', f_titre: 'Tutto ciò che una buona consulenza <em>deve mostrare.</em>',
    f1: 'Linea della vita', f1t: 'I vostri redditi anno per anno, dall’attività alla pensione. Spostate l’età e tutto si ricalcola.',
    f2: 'Tre rischi', f2t: 'Vecchiaia, invalidità, decesso — per malattia e infortunio, con il capitale che colmerebbe ogni scarto.',
    f3: 'Prova di resistenza', f3t: 'Aliquota di conversione in calo, rendimento nullo, cinque anni di vita in più: ciò che il piano sopporta.',
    f4: 'Tabella di marcia', f4t: 'Le scadenze legali da non mancare, datate per voi: 3a, riscatti, prelievi, rendita AVS.',
    f5: 'Due offerte a confronto', f5t: 'Premio, rendita d’invalidità, capitale di decesso: l’effetto reale di ogni offerta sulle lacune.',
    f6: 'Rapporto firmato', f6t: 'Un PDF con i colori del vostro studio, tratti dal logo. Pronto da consegnare al cliente.',
    v1: 'casi di calcolo verificati a mano', v2: 'cantoni, tariffe fiscali reali', v3: 'lingue: FR · DE · IT · EN', v4: 'dati inviati a un server',
    pied: 'Stime secondo le regole legali dell’anno; non sostituiscono né un certificato di previdenza né una consulenza personale.',
    titrePage: 'Previdenza — la vostra pensione, vista dall’alto',
  },
  en: {
    ouvrir: 'Open the analysis', essayer: 'Try it in 10 seconds', exemple: 'See a sample case', defiler: 'Scroll', parMois: 'per month',
    c0_sur: 'Swiss pensions · 1st, 2nd and 3rd pillar', c0_titre: 'Your retirement,<br><em>seen from above.</em>',
    c0_texte: 'What you will receive, what will be missing, and what to do about it — to the franc.',
    c1_sur: 'The starting point', c1_titre: 'Three pillars.<br><em>One picture.</em>',
    c1_texte: 'AHV, pension fund, 3rd pillar: each pension is computed under the year’s rules, then brought together on one lifeline.',
    p1: 'AHV / IV', p2: 'Pension fund', p3: 'Private savings',
    c2_sur: 'The finding', c2_titre: 'The gap,<br><em>in numbers.</em>',
    c2_texte: 'Retirement, disability, death: for each risk, the guaranteed income, the need and the difference.',
    c3_sur: 'What comes next', c3_titre: 'A plan,<br><em>with dates.</em>',
    c3_texte: 'Buy-ins, 3a payments, staggered withdrawals: each measure has its gain, its cost and its last useful date.',
    r1_quand: 'Every year', r1_quoi: '3a payment before 31 December', r2_quand: 'From age 50', r2_quoi: 'Pension fund buy-ins',
    r3_quand: '5 years before', r3_quoi: 'Staggered 3a withdrawals',
    c4_titre: 'See clearly.<br><em>Decide early.</em>', c4_texte: 'The full analysis takes a few minutes. Your data stays on your device.',
    s_sur: 'Your turn', s_titre: 'Your gap, <em>live.</em>',
    s_texte: 'Three settings, the real calculation engine. An estimate: the full analysis uses your certificates.',
    s_age: 'Age', s_revenu: 'Gross annual income', s_depart: 'Retirement at', s_canton: 'Canton', s_statut: 'Status', s_salarie: 'Employed', s_independant: 'Self-employed',
    s_resultat: 'Retirement gap', s_couvert: 'of the need covered', s_complet: 'Run the full analysis', s_aucune: 'No gap',
    s_p1: '1st pillar · AHV', s_p2: '2nd pillar · pension fund', s_p3: '3rd pillar and assets', s_besoin: 'Need in retirement', ans: 'years', an: '/ year',
    f_sur: 'In the analysis', f_titre: 'Everything good advice <em>has to show.</em>',
    f1: 'Lifeline', f1t: 'Your income year by year, from work to retirement. Drag the retirement age and everything recalculates.',
    f2: 'Three risks', f2t: 'Retirement, disability, death — through illness and accident, with the capital that would close each gap.',
    f3: 'Stress test', f3t: 'Lower conversion rate, zero return, five more years of life: what your plan can take.',
    f4: 'Roadmap', f4t: 'The legal deadlines not to miss, dated for you: 3a, buy-ins, withdrawals, AHV pension.',
    f5: 'Two offers, compared', f5t: 'Premium, disability pension, death capital: the real effect of each offer on your gaps.',
    f6: 'Signed report', f6t: 'A PDF in your firm’s colours, drawn from your logo. Ready to hand to the client.',
    v1: 'calculation cases checked by hand', v2: 'cantons, real tax scales', v3: 'languages: FR · DE · IT · EN', v4: 'data sent to a server',
    pied: 'Estimates under the year’s legal rules; they replace neither a pension certificate nor personal advice.',
    titrePage: 'Pensions — your retirement, seen from above',
  },
};
const CLE_LANGUE = 'prevoyance.bienvenue.langue';
let langue = 'fr';
try { langue = localStorage.getItem(CLE_LANGUE) || (navigator.language || 'fr').slice(0, 2); } catch { /* stockage indisponible */ }
if (!LANGUES.includes(langue)) langue = 'fr';
const t = cle => T[langue][cle] ?? T.fr[cle] ?? cle;
const nombre = v => Math.round(v).toLocaleString('de-CH').replace(/[’']/g, '’');

const ICONES = {
  f1: '<path d="M3 20h18"/><path d="M4 16c3 0 3-9 7-9s3 5 9 5"/><path d="M11 7v13" stroke-dasharray="1.5 2.5"/>',
  f2: '<path d="M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.400-7-10V6l7-3z"/><path d="M9 12l2.200 2.200L15.500 10"/>',
  f3: '<path d="M3 17l5-6 4 3 4-8 5 9"/><path d="M3 21h18"/>',
  f4: '<rect x="4" y="5" width="16" height="15" rx="2.500"/><path d="M4 10h16M9 3v4M15 3v4M8 14h3M8 17h6"/>',
  f5: '<path d="M12 4v16"/><path d="M5 8h14"/><path d="M5 8l-2.500 6a3 3 0 0 0 5 0L5 8zM19 8l-2.500 6a3 3 0 0 0 5 0L19 8z"/><path d="M8 20h8"/>',
  f6: '<path d="M7 3.500h7l4 4V19a1.500 1.500 0 0 1-1.500 1.500h-9A1.500 1.500 0 0 1 6 19V5a1.500 1.500 0 0 1 1-1.500z"/><path d="M14 3.500v4h4"/><path d="M9 15c1.500-2 2.500 2 4 0s1.500 0 2 0"/>',
};

function ecrire() {
  document.documentElement.lang = langue;
  document.title = t('titrePage');
  for (const e of document.querySelectorAll('[data-t]')) e.innerHTML = t(/** @type {HTMLElement} */ (e).dataset.t);
  $('grille').replaceChildren(...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((f, i) => {
    const c = document.createElement('article');
    c.className = 'carte verre-carte voir vu';
    c.style.setProperty('--i', String(i));
    c.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[f]}</svg><h3>${t(f)}</h3><p>${t(f + 't')}</p>`;
    return c;
  }));
  $('preuves').innerHTML = [['236', 'v1'], ['26', 'v2'], ['4', 'v3'], ['0', 'v4']].map(([n, c]) => `<li><b>${n}</b><span>${t(c)}</span></li>`).join('');
  for (const b of $('langues').children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.langue === langue));
  simuler();
}
$('langues').append(...LANGUES.map(l => {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.langue = l; b.textContent = l.toUpperCase();
  b.addEventListener('click', () => { langue = l; try { localStorage.setItem(CLE_LANGUE, l); } catch { /* rien */ } ecrire(); });
  return b;
}));

// ------------------------------------------------------------------------------------------------ le film
const IMAGES = 144, PAS_MOBILE = 2;
const etroit = matchMedia('(max-width: 620px)').matches;
const pas = etroit ? PAS_MOBILE : 1;
const toile = /** @type {HTMLCanvasElement} */ ($('film')), encre = toile.getContext('2d', { alpha: false });
/** @type {(HTMLImageElement|undefined)[]} */ const vues = [];
let derniere = -1;
const adresse = n => `images/film/f-${String(n + 1).padStart(3, '0')}.webp`;

function charger(n) {
  if (vues[n]) return;
  const im = new Image();
  im.decoding = 'async';
  im.src = adresse(n);
  im.onload = () => { vues[n] = im; if (derniere === -1 || n === voulue) dessiner(voulue); };
}
function dessiner(n) {
  // l'image voulue, sinon la plus proche déjà chargée (jamais d'écran vide pendant le chargement)
  let k = n;
  for (let e = 0; !vues[k] && e < IMAGES; e++) { if (vues[n - e]) k = n - e; else if (vues[n + e]) k = n + e; }
  const im = vues[k];
  if (!im || !encre || k === derniere) return;
  derniere = k;
  if (toile.width !== im.naturalWidth) { toile.width = im.naturalWidth; toile.height = im.naturalHeight; }
  encre.drawImage(im, 0, 0);
}
let voulue = 0;
// d'abord une image sur douze (le film existe tout de suite, en gros), puis le reste par vagues
const ordre = [];
for (const saut of [12, 6, 3, 1]) for (let n = 0; n < IMAGES; n += saut * pas) if (!ordre.includes(n)) ordre.push(n);
if (calme) charger(0);
else {
  let i = 0;
  const vague = () => { for (let k = 0; k < 6 && i < ordre.length; k++) charger(ordre[i++]); if (i < ordre.length) setTimeout(vague, 60); };
  vague();
}

// ------------------------------------------------------------------------------------------------ le défilement
const piste = $('piste'), chapitres = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.chapitre')]);
const reperes = $('reperes');
reperes.append(...chapitres.map(() => document.createElement('i')));
const acces = Object.assign(document.createElement('a'), { className: 'bouton plein acces', href: 'index.html' });
acces.dataset.t = 'ouvrir';
document.body.append(acces);
const LACUNE_EXEMPLE = 1190;
let cible = 0, courant = 0, anime = false;

function mesurer() {
  const r = piste.getBoundingClientRect(), course = r.height - innerHeight;
  cible = course > 0 ? borne(-r.top / course) : 0;
  // au-delà de la piste : le film s'efface dans la nuit
  const apres = borne((-r.top - course) / (innerHeight * 0.8));
  document.documentElement.style.setProperty('--fond', (apres * 0.94).toFixed(3));
  // l'accès à l'analyse reste sous le pouce, sauf là où le chapitre final le propose déjà
  const utile = cible > 0.04 && !(cible > 0.84 && apres === 0);
  document.documentElement.style.setProperty('--acces', utile ? '1' : '0');
  acces.classList.toggle('la', utile);
  if (!anime) { anime = true; requestAnimationFrame(avancer); }
}
function avancer() {
  courant += (cible - courant) * 0.12;
  if (Math.abs(cible - courant) < 0.0004) courant = cible;
  voulue = Math.round(courant * (IMAGES - 1) / pas) * pas;
  dessiner(voulue);
  chapitres.forEach((c, i) => {
    const de = +c.dataset.de, a = +c.dataset.a, fondu = 0.045;
    const entree = borne((courant - de) / fondu), sortie = borne((a - courant) / fondu), o = Math.min(entree, sortie);
    c.style.setProperty('--o', o.toFixed(3));
    c.style.setProperty('--y', ((1 - entree) * 46 - (1 - sortie) * 46).toFixed(1));
    c.classList.toggle('actif', o > 0.5);
    /** @type {HTMLElement} */ (reperes.children[i]).style.setProperty('--r', borne((courant - de) / (a - de)).toFixed(3));
  });
  // le chiffre du constat monte avec le film
  const c2 = chapitres[2], part = borne((courant - +c2.dataset.de) / 0.09);
  $('compteur').textContent = nombre(LACUNE_EXEMPLE * (1 - Math.pow(1 - part, 3)));
  if (courant !== cible) requestAnimationFrame(avancer); else anime = false;
}
if (!calme) {
  addEventListener('scroll', mesurer, { passive: true });
  addEventListener('resize', mesurer);
  mesurer();
} else {
  $('compteur').textContent = nombre(LACUNE_EXEMPLE);
}

// apparition des blocs après le film
const vigie = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('vu'); vigie.unobserve(e.target); } }, { threshold: 0.18 });
for (const [i, e] of [...document.querySelectorAll('.tete, .simulateur, .preuves')].entries()) { e.classList.add('voir'); /** @type {HTMLElement} */ (e).style.setProperty('--i', String(i % 3)); vigie.observe(e); }

// ------------------------------------------------------------------------------------------------ le simulateur
const champs = { age: /** @type {HTMLInputElement} */ ($('age')), revenu: /** @type {HTMLInputElement} */ ($('revenu')), depart: /** @type {HTMLInputElement} */ ($('depart')),
                 canton: /** @type {HTMLSelectElement} */ ($('canton')), statut: /** @type {HTMLSelectElement} */ ($('statut')) };
champs.canton.append(...CANTONS.map(c => Object.assign(document.createElement('option'), { value: c, textContent: c, selected: c === 'VD' })));
/** @type {{regles: any, impots: any, communes: any}|null} */ let reference = null;
const annee = ANNEES[0];
const pret = Promise.all([Donnees.regles(annee), Donnees.impots(annee), Donnees.communes(annee)])
  .then(([regles, impots, communes]) => { reference = { regles, impots, communes }; simuler(); })
  .catch(erreur => console.error(erreur));

function simuler() {
  const age = +champs.age.value, revenu = +champs.revenu.value, depart = Math.max(+champs.depart.value, age + 1);
  $('o-age').textContent = `${age} ${t('ans')}`;
  $('o-revenu').textContent = `CHF ${nombre(revenu)}`;
  $('o-depart').textContent = `${depart} ${t('ans')}`;
  for (const c of [champs.age, champs.revenu, champs.depart]) c.style.setProperty('--p', `${((+c.value - +c.min) / (+c.max - +c.min)) * 100}%`);
  if (!reference) return;
  const naissance = new Date();
  naissance.setFullYear(naissance.getFullYear() - age);
  const d = { ...dossierVide(), canton: champs.canton.value, ageRetraite: depart,
              personne: { dateNaissance: naissance.toISOString().slice(0, 10), sexe: 'h', statut: champs.statut.value, revenu } };
  let a;
  try {
    const impots = Impots.localiser(reference.impots, reference.communes, d.canton, { commune: null, confession: 'sans' });
    a = analyser(versDossier(d, 'personne'), reference.regles, { impots });
  } catch (erreur) { console.error(erreur); return; }
  const r = a.risques.retraite, mensuel = r.lacuneMensuelle ?? Math.round(r.lacune / 12);
  $('r-lacune').textContent = mensuel > 0 ? nombre(mensuel) : '0';
  $('r-couverture').textContent = `${Math.round(Math.min(1, r.couverture) * 100)} %`;
  $('r-jauge').style.setProperty('--j', String(Math.min(1, r.couverture)));
  const somme = p => r.sources.filter(s => s.pilier === p).reduce((n, s) => n + s.montant, 0);
  $('r-sources').innerHTML = [['s_p1', somme(1)], ['s_p2', somme(2)], ['s_p3', somme(3)], ['s_besoin', r.besoin]]
    .map(([cle, v]) => `<li><span>${t(cle)}</span><b>CHF ${nombre(v)} ${t('an')}</b></li>`).join('');
}
$('reglages').addEventListener('input', simuler);
$('reglages').addEventListener('submit', e => e.preventDefault());

ecrire();
void pret;
