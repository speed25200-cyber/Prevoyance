// @ts-check
/**
 * Page d'entrée : la prévoyance lue comme une carte. Un relief en courbes de niveau, calculé en direct (relief.js),
 * reste derrière la page : vu d'en haut au début, il s'incline quand le récit commence, ses trois étages s'allument
 * (les trois piliers), l'anneau du besoin apparaît, puis le massif monte jusqu'à lui (le plan). Dans le simulateur,
 * ce relief devient celui du visiteur : chaque réglage refait le calcul avec le vrai moteur, et la montagne suit.
 * Sans mouvement demandé par l'appareil : pas d'épinglage, les chapitres se lisent à la suite, le relief est fixe.
 */

import { analyser, ANNEES, Impots } from '../../moteur/src/index.js';
import { dossierVide, versDossier, CANTONS } from './etat.js';
import * as Donnees from './donnees.js';
import { creerRelief } from './relief.js';

const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));
const racine = document.documentElement;
// posées par pret.js avant le premier affichage : « js » (récit épinglé), « anime » (animations), « fige » (capture)
const fige = racine.classList.contains('fige'), anime = racine.classList.contains('anime'), epingle = racine.classList.contains('js');
const requete = new URLSearchParams(location.search);
const borne = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lisse = (a, b, x) => { const k = borne((x - a) / (b - a)); return k * k * (3 - 2 * k); };

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
    l_atteint: 'Revenu garanti', l_lacune: 'Lacune', l_equi: 'Équidistance des courbes', l_altitude: 'Altitude = revenu annuel', l_charge: 'Levé du relief', l_exemple: 'Exemple calculé',
    marque: 'Prévoyance',
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
    l_atteint: 'Gesichertes Einkommen', l_lacune: 'Lücke', l_equi: 'Äquidistanz der Höhenkurven', l_altitude: 'Höhe = Jahreseinkommen', l_charge: 'Geländeaufnahme', l_exemple: 'Berechnetes Beispiel',
    marque: 'Vorsorge',
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
    l_atteint: 'Reddito garantito', l_lacune: 'Lacuna', l_equi: 'Equidistanza delle curve', l_altitude: 'Altitudine = reddito annuo', l_charge: 'Rilievo del terreno', l_exemple: 'Esempio calcolato',
    marque: 'Previdenza',
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
    l_atteint: 'Guaranteed income', l_lacune: 'Gap', l_equi: 'Contour interval', l_altitude: 'Elevation = annual income', l_charge: 'Surveying the terrain', l_exemple: 'Worked example',
    marque: 'Pension',
    titrePage: 'Pensions — your retirement, seen from above',
  },
};
const CLE_LANGUE = 'prevoyance.bienvenue.langue';
let langue = 'fr';
try { langue = localStorage.getItem(CLE_LANGUE) || (navigator.language || 'fr').slice(0, 2); } catch { /* stockage indisponible */ }
if (!LANGUES.includes(langue)) langue = 'fr';
// en français, la ponctuation double ne passe jamais seule à la ligne : espace insécable avant « : ; ? ! »
const typo = texte => (langue === 'fr' ? texte.replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') : texte);
const t = cle => typo(T[langue][cle] ?? T.fr[cle] ?? cle);
const nombre = v => Math.round(v).toLocaleString('de-CH').replace(/[’']/g, '’');

const ICONES = {
  f1: '<path d="M2.500 19.500h19"/><path d="M3 17l5-5 3 2 5-9 5 12"/><path d="M16 5v14.500" stroke-dasharray="1.500 2.500"/>',
  f2: '<path d="M2 19.500l3.500-7 3.500 7z"/><path d="M8.500 19.500l3.500-11.500 3.500 11.500z"/><path d="M15 19.500l3.500-5.500 3.500 5.500z"/>',
  f3: '<circle cx="12" cy="12" r="2.500"/><circle cx="12" cy="12" r="5.500"/><circle cx="12" cy="12" r="9"/><path d="M12 3v18" stroke-dasharray="1.500 2.500"/>',
  f4: '<path d="M4 19.500c5 0 3-6.500 7.500-6.500s3-6 7.500-7" stroke-dasharray="2 2.500"/><circle cx="4" cy="19.500" r="1.200"/><path d="M19 2.500l2.200 4h-4.400z"/>',
  f5: '<path d="M2 19.500l5.500-11.500 5.500 11.500z"/><path d="M12 19.500l4.500-7.500 5.500 7.500"/><path d="M2 8h20" stroke-dasharray="1.500 2.500"/>',
  f6: '<path d="M7 3.500h7l4 4V19a1.500 1.500 0 0 1-1.500 1.500h-9A1.500 1.500 0 0 1 6 19V5a1.500 1.500 0 0 1 1-1.500z"/><path d="M14 3.500v4h4"/><path d="M9 17l3-5.500 3 5.500z"/>',
};

// ------------------------------------------------------------------------------------------------ titres mot à mot
/** Découpe un titre en mots, chacun dans son masque, pour l'entrée mot à mot ; les balises (<br>, <em>) sont gardées. */
function decouper(element) {
  let rang = 0;
  const parcourir = noeud => {
    for (const enfant of [...noeud.childNodes]) {
      if (enfant.nodeType === 3) {
        const fragment = document.createDocumentFragment();
        for (const morceau of (enfant.textContent ?? '').split(/(\s+)/)) {
          if (!morceau) continue;
          if (/^\s+$/.test(morceau)) { fragment.append(' '); continue; }
          const masque = document.createElement('span'), mot = document.createElement('span');
          masque.className = 'mot'; mot.textContent = morceau; mot.style.setProperty('--m', String(rang++));
          masque.append(mot); fragment.append(masque);
        }
        enfant.replaceWith(fragment);
      } else if (enfant.nodeType === 1 && /** @type {Element} */ (enfant).tagName !== 'BR') parcourir(enfant);
    }
  };
  parcourir(element);
}

// ------------------------------------------------------------------------------------------------ apparitions au défilement
const vigie = new IntersectionObserver(entrees => {
  for (const e of entrees) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('vu');
    vigie.unobserve(e.target);
    if (e.target.id === 'preuves') compter();
  }
}, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
/** Les chiffres de preuve montent de zéro à leur valeur quand la rangée arrive à l'écran. */
function compter() {
  if (!anime) return;
  const debut = performance.now();
  const pas = maintenant => {
    const k = borne((maintenant - debut) / 1500), e = 1 - Math.pow(1 - k, 4);
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#preuves b'))) b.textContent = String(Math.round(+(b.dataset.n ?? 0) * e));
    if (k < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}

// ------------------------------------------------------------------------------------------------ écriture des textes
function ecrire() {
  racine.lang = langue;
  document.title = t('titrePage');
  for (const e of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-t]'))) {
    e.innerHTML = t(e.dataset.t ?? '');
    if (e.hasAttribute('data-mots')) decouper(e);
  }
  $('grille').replaceChildren(...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((f, i) => {
    const ligne = document.createElement('li');
    ligne.style.setProperty('--i', String(i % 3));
    ligne.innerHTML = `<h3>${t(f)}</h3><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[f]}</svg><p>${t(f + 't')}</p>`;
    if (anime) vigie.observe(ligne); else ligne.classList.add('vu');
    return ligne;
  }));
  $('preuves').replaceChildren(...[['236', 'v1'], ['26', 'v2'], ['4', 'v3'], ['0', 'v4']].map(([n, cle], i) => {
    const ligne = document.createElement('li'), chiffre = document.createElement('b'), nom = document.createElement('span');
    ligne.style.setProperty('--i', String(i));
    chiffre.dataset.n = n; chiffre.textContent = n; nom.textContent = t(cle);
    ligne.append(chiffre, nom);
    return ligne;
  }));
  // la bande : les trois piliers, deux fois, pour boucler sans raccord
  const bande = /** @type {HTMLElement} */ ($('bande').firstElementChild);
  bande.replaceChildren(...[0, 1].flatMap(() => ['s_p1', 's_p2', 's_p3'].flatMap((cle, i) => {
    const mot = document.createElement('span'), jalon = document.createElement('i');
    mot.textContent = t(cle); if (i % 2) mot.className = 'creux';
    return [mot, jalon];
  })));
  for (const b of $('langues').children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.langue === langue));
  for (const j of jalons) j.nom.textContent = t(j.cle ?? 'marque').replace(/<[^>]+>/g, ' ');
  textes = {};
  simuler();
  raconter();
}
$('langues').append(...LANGUES.map(l => {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.langue = l; b.textContent = l.toUpperCase();
  b.addEventListener('click', () => { langue = l; try { localStorage.setItem(CLE_LANGUE, l); } catch { /* rien */ } ecrire(); });
  return b;
}));

// ------------------------------------------------------------------------------------------------ le calcul : le vrai moteur
/** @type {{regles: any, impots: any, communes: any}|null} */ let reference = null;
const annee = ANNEES[0];
/**
 * La retraite d'une personne type, calculée par le moteur de l'application.
 * @returns {{p1: number, p2: number, p3: number, besoin: number, mensuel: number, couverture: number}|null}
 */
function calculer({ age, revenu, depart, canton, statut }) {
  if (!reference) return null;
  const naissance = new Date();
  naissance.setFullYear(naissance.getFullYear() - age);
  const d = { ...dossierVide(), canton, ageRetraite: depart, personne: { dateNaissance: naissance.toISOString().slice(0, 10), sexe: 'h', statut, revenu } };
  try {
    const impots = Impots.localiser(reference.impots, reference.communes, d.canton, { commune: null, confession: 'sans' });
    const r = analyser(versDossier(d, 'personne'), reference.regles, { impots }).risques.retraite;
    const somme = p => r.sources.filter(s => s.pilier === p).reduce((n, s) => n + s.montant, 0);
    return { p1: somme(1), p2: somme(2), p3: somme(3), besoin: r.besoin, mensuel: Math.max(0, r.lacuneMensuelle ?? Math.round(r.lacune / 12)), couverture: Math.min(1, r.couverture) };
  } catch (erreur) { console.error(erreur); return null; }
}

// ------------------------------------------------------------------------------------------------ le relief et sa mise en scène
const recit = $('recit'), essai = $('essai'), fonctions = $('fonctions'), fin = $('fin'), haut = $('haut'), reperes = $('reperes'), itineraire = $('itineraire');
const chapitres = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.chapitre')]);
const etapes = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.route li')]);
const etages = /** @type {HTMLElement[]} */ ([1, 2, 3].map(n => document.querySelector(`.etages [data-etage="${n}"]`)));
const relief = creerRelief(/** @type {HTMLCanvasElement} */ ($('relief')), { fige });
if (!relief) racine.classList.add('sans-relief');

// Avant que les règles soient chargées : une silhouette plausible, sans aucun chiffre affiché.
const ESQUISSE = { p1: 26000, p2: 30000, p3: 5000, besoin: 76000, mensuel: 0, couverture: 0.8 };
const DEFAUT = { age: 40, revenu: 90000, depart: 65, canton: 'VD', statut: 'salarie' };
/** @type {ReturnType<typeof calculer>} */ let exemple = null;
/** @type {ReturnType<typeof calculer>} */ let sim = null;
let phase = '', avancement = 0, dernierY = scrollY, elan = 0, planifie = false;
/** @type {number[]} */ let positions = [];
/** @type {Record<string, string>} */ let textes = {};

// Les vues du relief : d'en haut (la carte), puis de biais pour chaque chapitre. Décalage en demi-largeurs d'écran.
const vues = etroit => ({
  carte: { azimut: 0.35, elevation: 1.5607, distance: etroit ? 7.6 : 4.5, cibleY: 0, dx: etroit ? 0 : 0.36, dy: etroit ? 0.5 : 0 },
  piliers: { azimut: 0.62, elevation: 0.46, distance: etroit ? 7.4 : 4, cibleY: 0.38, dx: etroit ? 0 : 0.4, dy: etroit ? 0.52 : -0.04 },
  lacune: { azimut: -0.1, elevation: 0.3, distance: etroit ? 7.4 : 3.9, cibleY: 0.5, dx: etroit ? 0 : 0.4, dy: etroit ? 0.5 : -0.08 },
  plan: { azimut: -0.6, elevation: 0.36, distance: etroit ? 7.4 : 4, cibleY: 0.46, dx: etroit ? 0 : 0.4, dy: etroit ? 0.5 : -0.06 },
  essai: { azimut: 0.5, elevation: 0.36, distance: etroit ? 5.8 : 4.4, cibleY: 0.42, dx: etroit ? 0 : 0.26, dy: etroit ? 0.46 : 0.2 },
  fin: { azimut: 0.95, elevation: 1.5607, distance: etroit ? 6.4 : 3.5, cibleY: 0, dx: etroit ? 0 : 0.44, dy: etroit ? 0.46 : 0 },
});
const melange = (u, v, k) => Object.fromEntries(Object.keys(u).map(cle => [cle, u[cle] + (v[cle] - u[cle]) * k]));
/** Écrit un texte seulement s'il a changé (les repères sont replacés à chaque image). */
function noter(id, texte) { if (textes[id] !== texte) { textes[id] = texte; $(id).textContent = texte; } }

// l'itinéraire : un jalon par étape de la page
const jalons = [null, 'c1_sur', 'c2_sur', 'c3_sur', 's_sur', 'f_sur', 'ouvrir'].map((cle, i) => {
  const bouton = document.createElement('button'), nom = document.createElement('span'), jalon = document.createElement('i');
  bouton.type = 'button'; bouton.tabIndex = -1; bouton.append(nom, jalon);
  bouton.addEventListener('click', () => scrollTo({ top: (positions[i] ?? 0) + (i ? 2 : 0), behavior: anime ? 'smooth' : 'auto' }));
  return { cle, bouton, nom };
});
{
  const fil = document.createElement('div');
  fil.className = 'fil'; fil.append(document.createElement('i'));
  itineraire.append(fil, ...jalons.map(j => j.bouton));
}

/** Tout ce qui dépend de la position dans la page : la vue du relief, le chapitre en cours, la barre, l'itinéraire. */
function mettreEnScene() {
  planifie = false;
  const h = innerHeight, y = Math.max(0, scrollY), etroit = innerWidth < 1000;
  if (y > dernierY + 4 && y > 260) haut.classList.add('cache'); else if (y < dernierY - 4 || y <= 260) haut.classList.remove('cache');
  haut.classList.toggle('pose', y > 30);
  elan += y - dernierY; dernierY = y;

  const bR = recit.getBoundingClientRect(), bE = essai.getBoundingClientRect(), bF = fonctions.getBoundingClientRect(), bFin = fin.getBoundingClientRect();
  const course = Math.max(1, bR.height - h), r = epingle ? borne(-bR.top / course) : 0;
  phase = !epingle ? 'calme' : bFin.top < h * 0.9 ? 'fin' : bF.top < h * 0.3 ? 'pages' : bE.top < h * 0.72 ? 'essai' : bR.top < h * 0.5 ? 'recit' : 'hero';
  avancement = r;

  // l'itinéraire
  positions = [0, recit.offsetTop + course * 0.02, recit.offsetTop + course * 0.36, recit.offsetTop + course * 0.69, essai.offsetTop, fonctions.offsetTop, fin.offsetTop];
  // l'itinéraire dit exactement ce que montre la page : le chapitre affiché, puis les sections
  const rangRecit = r < 0.34 ? 0 : r < 0.67 ? 1 : 2;
  const k = phase === 'recit' ? 1 + rangRecit : phase === 'essai' ? 4 : phase === 'pages' ? 5 : phase === 'fin' ? 6 : 0;
  itineraire.style.setProperty('--part', ((phase === 'recit' ? 1 + Math.min(2.999, r * 3) : k) / (positions.length - 1)).toFixed(4));
  jalons.forEach((j, i) => { j.bouton.classList.toggle('ici', i === k); j.bouton.classList.toggle('passe', i < k); });
  racine.dataset.phase = phase;
  if (!epingle) { if (relief) { relief.viser(dansFenetre(vues(etroit).essai), true); relief.scene({ bandes: [1, 1, 1], anneau: 1 }, true); relief.regler(sim ?? exemple ?? ESQUISSE, true); } return; }

  // les chapitres du récit
  const rang = phase === 'hero' ? -1 : rangRecit;
  chapitres.forEach((c, i) => { c.classList.toggle('actif', i === rang); c.classList.toggle('passe', i < rang); });

  // le relief
  const V = vues(etroit), donnees = exemple ?? ESQUISSE;
  let vue = V.carte, bandes = [0, 0, 0], anneau = 0, montants = donnees, opacite = 1;
  if (phase === 'hero') vue = { ...V.carte, distance: V.carte.distance - 0.5 * borne(y / h) };
  else if (phase === 'recit') {
    vue = melange(melange(melange(V.carte, V.piliers, lisse(0, 0.2, r)), V.lacune, lisse(0.3, 0.44, r)), V.plan, lisse(0.62, 0.76, r));
    bandes = [lisse(0.03, 0.1, r), lisse(0.1, 0.17, r), lisse(0.17, 0.24, r)];
    anneau = lisse(0.33, 0.4, r);
    const gain = lisse(0.72, 0.95, r), manque = Math.max(0, donnees.besoin - donnees.p1 - donnees.p2 - donnees.p3);
    montants = { ...donnees, p2: donnees.p2 + manque * 0.55 * gain, p3: donnees.p3 + manque * 0.45 * gain };
    etapes.forEach((e, i) => e.classList.toggle('fait', r > 0.7 + i * 0.08));
    etages.forEach((e, i) => e.classList.toggle('eteint', bandes[i] < 0.5));
    if (exemple) noter('compteur', nombre(exemple.mensuel * (1 - Math.pow(1 - lisse(0.34, 0.46, r), 3))));
  } else {
    vue = phase === 'fin' ? V.fin : dansFenetre(V.essai); bandes = [1, 1, 1]; anneau = 1; montants = sim ?? donnees;
    opacite = phase === 'pages' ? 0 : phase === 'fin' ? 0.9 : 1;
  }
  // les étiquettes du relief : dans le récit sur grand écran seulement (ailleurs le texte passe dessous), toujours dans le simulateur
  reperes.classList.toggle('voit-sommet', !!exemple && (phase === 'essai' || (!etroit && phase === 'recit' && r > 0.22)));
  reperes.classList.toggle('voit-besoin', !!exemple && (phase === 'essai' || (!etroit && phase === 'recit' && r > 0.38)));
  racine.style.setProperty('--relief-o', String(opacite));
  territoire.classList.toggle('la', phase === 'fin' && !!relief);
  if (!relief) return;
  relief.actif(opacite > 0);
  // dans le simulateur, le relief est attaché à sa fenêtre : une fois arrivé, il la suit sans retard au défilement
  if (phase !== 'essai') arriveeEssai = 0; else if (!arriveeEssai) arriveeEssai = performance.now();
  relief.viser(vue, fige);
  if (phase === 'essai' && performance.now() - arriveeEssai > 900) relief.viser({ dx: vue.dx, dy: vue.dy }, true);
  relief.scene({ bandes, anneau, eclat: phase === 'hero' || phase === 'fin' ? 1 : 0.45 }, fige); relief.regler(montants, fige);
  if (fige) relief.redessiner();
}
/**
 * Tient le relief dans la fenêtre du simulateur : centré sur elle, à une taille qui laisse voir le sommet et l'anneau
 * en entier. La fiche des résultats est dessous, plus rien ne passe devant la montagne.
 */
function dansFenetre(base) {
  const b = $('essai-scene').getBoundingClientRect();
  if (b.height < 60 || b.width < 60) return base;
  // un peu sous le milieu de la fenêtre, et assez loin pour que l'étiquette du besoin, au-dessus de l'anneau, y tienne aussi
  return { ...base, dx: ((b.left + b.width / 2) / innerWidth) * 2 - 1, dy: 1 - ((b.top + b.height * 0.57) / innerHeight) * 2,
    distance: borne(4.4 * (0.63 * innerHeight) / b.height, 3.4, 12) };
}
let arriveeEssai = 0;
const demanderScene = () => { if (!planifie) { planifie = true; requestAnimationFrame(mettreEnScene); } };
addEventListener('scroll', demanderScene, { passive: true });
addEventListener('resize', demanderScene);

/** Pose une étiquette là où tombe son repère. */
const poser = (id, point) => { const e = $(id); e.style.setProperty('--x', point.x.toFixed(1)); e.style.setProperty('--y', point.y.toFixed(1)); };
const trait = /** @type {SVGLineElement} */ (document.querySelector('#rep-trait line'));
const territoire = $('territoire');
relief?.suivre(r => {
  const m = r.reperes(), manque = m.besoin - m.total, comble = manque <= m.besoin * 0.004;
  // à la fin de la page, la photographie du sommet tient exactement dans l'anneau du besoin
  if (phase === 'fin') {
    territoire.style.setProperty('--tx', m.anneau.x.toFixed(1)); territoire.style.setProperty('--ty', m.anneau.y.toFixed(1));
    territoire.style.setProperty('--tr', Math.max(0, (m.dessous.y - m.dessus.y) / 2).toFixed(1));
  }
  poser('rep-sommet', m.sommet); poser('rep-besoin', m.dessus); poser('rep-ecart', { x: m.sommet.x, y: Math.max((m.sommet.y + m.dessous.y) / 2, m.dessous.y + 26) });
  trait.setAttribute('x1', m.sommet.x.toFixed(1)); trait.setAttribute('y1', (m.sommet.y - 3).toFixed(1));
  trait.setAttribute('x2', m.anneau.x.toFixed(1)); trait.setAttribute('y2', m.anneau.y.toFixed(1));
  noter('rep-sommet-n', `CHF ${nombre(m.total)} ${t('an')}`);
  noter('rep-besoin-n', `CHF ${nombre(m.besoin)} ${t('an')}`);
  noter('rep-ecart-n', `− CHF ${nombre(Math.max(0, manque) / 12)} ${t('parMois')}`);
  noter('equidistance', `CHF ${nombre(m.equidistance)}`);
  reperes.classList.toggle('atteint', comble);
  reperes.classList.toggle('proche', !comble && manque <= m.besoin * 0.09);   // sommet tout près de l'anneau : les étiquettes se chevaucheraient
  reperes.classList.toggle('voit-ecart', reperes.classList.contains('voit-besoin') && !comble);
});

/** Le récit reprend les chiffres de l'exemple calculé (personne type du simulateur) : rien n'est écrit en dur. */
function raconter() {
  if (!exemple) return;
  for (const n of [1, 2, 3]) $('e-p' + n).textContent = `CHF ${nombre(exemple['p' + n])}`;
  $('exemple').textContent = `${t('l_exemple')} — ${DEFAUT.age} ${t('ans')} · ${t('s_salarie')} · CHF ${nombre(DEFAUT.revenu)} · ${DEFAUT.canton}`;
  if (!epingle) $('compteur').textContent = nombre(exemple.mensuel);
  mettreEnScene();
}

// ------------------------------------------------------------------------------------------------ le simulateur
const champs = { age: /** @type {HTMLInputElement} */ ($('age')), revenu: /** @type {HTMLInputElement} */ ($('revenu')), depart: /** @type {HTMLInputElement} */ ($('depart')),
                 canton: /** @type {HTMLSelectElement} */ ($('canton')), statut: /** @type {HTMLSelectElement} */ ($('statut')) };
champs.canton.append(...CANTONS.map(c => Object.assign(document.createElement('option'), { value: c, textContent: c, selected: c === DEFAUT.canton })));
const pret = Promise.all([Donnees.regles(annee), Donnees.impots(annee), Donnees.communes(annee)])
  .then(([regles, impots, communes]) => { reference = { regles, impots, communes }; exemple = calculer(DEFAUT); simuler(); raconter(); })
  .catch(erreur => console.error(erreur));

function simuler() {
  const age = +champs.age.value, revenu = +champs.revenu.value, depart = Math.max(+champs.depart.value, age + 1);
  $('o-age').textContent = `${age} ${t('ans')}`;
  $('o-revenu').textContent = `CHF ${nombre(revenu)}`;
  $('o-depart').textContent = `${depart} ${t('ans')}`;
  for (const c of [champs.age, champs.revenu, champs.depart]) c.style.setProperty('--p', `${((+c.value - +c.min) / (+c.max - +c.min)) * 100}%`);
  const a = calculer({ age, revenu, depart, canton: champs.canton.value, statut: champs.statut.value });
  if (!a) return;
  sim = a;
  $('r-lacune').textContent = a.mensuel > 0 ? nombre(a.mensuel) : '0';
  $('r-couverture').textContent = `${Math.round(a.couverture * 100)} %`;
  /** @type {HTMLElement} */ ($('r-lacune').closest('.resultat')).classList.toggle('comble', a.mensuel <= 0);
  $('r-sources').replaceChildren(...[['s_p1', a.p1, 'var(--p1)'], ['s_p2', a.p2, 'var(--p2)'], ['s_p3', a.p3, 'var(--p3)'], ['s_besoin', a.besoin, '']].map(([cle, montant, couleur]) => {
    const ligne = document.createElement('li'), puce = document.createElement('i'), nom = document.createElement('span'), valeur = document.createElement('b');
    if (couleur) puce.style.setProperty('--c', String(couleur));
    nom.textContent = t(String(cle)); valeur.textContent = `CHF ${nombre(+montant)} ${t('an')}`;
    ligne.append(puce, nom, valeur);
    return ligne;
  }));
  if (phase === 'essai' || phase === 'fin' || phase === 'calme') relief?.regler(a, fige);
}
$('reglages').addEventListener('input', simuler);
$('reglages').addEventListener('submit', e => e.preventDefault());

// ------------------------------------------------------------------------------------------------ ouverture de la page
for (const groupe of [document.querySelectorAll('.hero .voir'), document.querySelectorAll('.essai .voir'), document.querySelectorAll('.fin .voir')])
  groupe.forEach((e, i) => /** @type {HTMLElement} */ (e).style.setProperty('--d', String(i)));
if (anime) {
  for (const e of document.querySelectorAll('.voir, #preuves, .fin')) vigie.observe(e);
  relief?.scene({ trace: 0 }, true);
  let ouverte = false;
  const ouvrir = () => {
    if (ouverte) return;
    ouverte = true;
    racine.classList.add('ouvert'); $('chargement').classList.add('parti'); relief?.scene({ trace: 1.1 });
  };
  const debut = performance.now();
  const monter = maintenant => {
    const part = borne((maintenant - debut) / 950);
    $('chargement-n').textContent = String(Math.round(part * 100));
    if (part < 1) requestAnimationFrame(monter); else ouvrir();
  };
  requestAnimationFrame(monter);
  setTimeout(ouvrir, 2400);   // jamais d'écran de chargement qui reste, même si les images ne tournent pas (onglet en arrière-plan)
} else {
  racine.classList.add('ouvert');
  for (const e of document.querySelectorAll('.voir, #preuves, .fin')) e.classList.add('vu');
}

// ------------------------------------------------------------------------------------------------ la bande qui défile
if (anime) {
  const bande = $('bande'), texte = /** @type {HTMLElement} */ (bande.firstElementChild);
  let enVue = false, x = 0, v = 0, avant = 0, tourne = false;
  const pas = maintenant => {
    const ecoule = Math.min(50, maintenant - avant) / 16.7;
    avant = maintenant;
    v += (elan - v) * 0.12; elan *= 0.82;
    x -= (0.7 + v * 0.42) * ecoule;
    const demi = texte.scrollWidth / 2;
    if (demi > 0) x = ((x % demi) - demi) % demi;
    texte.style.setProperty('--bx', x.toFixed(1));
    if (enVue) requestAnimationFrame(pas); else tourne = false;
  };
  new IntersectionObserver(entrees => {
    enVue = entrees[entrees.length - 1].isIntersecting;
    if (enVue && !tourne) { tourne = true; avant = performance.now(); requestAnimationFrame(pas); }
  }).observe(bande);
}

// ------------------------------------------------------------------------------------------------ le pointeur : réticule, altitude, boutons aimantés
if (anime && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const curseur = document.createElement('div'), etiquette = document.createElement('p'), valeur = document.createElement('b'), nom = document.createElement('span');
  curseur.className = 'curseur'; curseur.setAttribute('aria-hidden', 'true');
  etiquette.append(valeur, nom); curseur.append(document.createElement('i'), etiquette);
  document.body.append(curseur);
  let cx = 0, cy = 0, x = 0, y = 0, tourne = false;
  /** @type {Element|null} */ let dessous = null;
  const suivre = () => {
    x += (cx - x) * 0.22; y += (cy - y) * 0.22;
    curseur.style.setProperty('--x', x.toFixed(1)); curseur.style.setProperty('--y', y.toFixed(1));
    const lien = !!dessous?.closest?.('a, button, input, select, label');
    curseur.classList.toggle('lien', lien);
    // hors des commandes, là où le relief est visible : le réticule lit l'altitude sous le pointeur
    const sonde = !lien && relief && (phase === 'hero' || phase === 'recit' || phase === 'essai' || phase === 'fin') && !dessous?.closest?.('.resultat, .reglages, .haut') ? relief.sonder(cx, cy) : null;
    curseur.classList.toggle('sonde', !!sonde && !!exemple);
    if (sonde && exemple) { valeur.textContent = `CHF ${nombre(Math.round(sonde.altitude / 100) * 100)}`; nom.textContent = t('s_p' + sonde.etage); }
    if (Math.abs(cx - x) + Math.abs(cy - y) > 0.3) requestAnimationFrame(suivre); else tourne = false;
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    cx = e.clientX; cy = e.clientY; dessous = /** @type {Element|null} */ (e.target);
    curseur.classList.add('la');
    if (!tourne) { tourne = true; requestAnimationFrame(suivre); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => curseur.classList.remove('la'));
  // boutons aimantés : ils viennent un peu vers le pointeur
  for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.bouton'))) {
    b.addEventListener('pointermove', e => {
      const boite = b.getBoundingClientRect();
      b.style.setProperty('--ax', ((e.clientX - boite.left - boite.width / 2) * 0.16).toFixed(1));
      b.style.setProperty('--ay', ((e.clientY - boite.top - boite.height / 2) * 0.3).toFixed(1));
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--ax', '0'); b.style.setProperty('--ay', '0'); });
  }
}

// ------------------------------------------------------------------------------------------------ les aperçus : la fonction survolée, en image
if (anime && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const apercu = $('apercu'), image = /** @type {HTMLImageElement} */ (apercu.firstElementChild), grille = $('grille');
  let cx = 0, cy = 0, x = 0, y = 0, tourne = false, rang = -1;
  const suivre = () => {
    const avant = x;
    x += (cx - x) * 0.16; y += (cy - y) * 0.16;
    apercu.style.setProperty('--ax', x.toFixed(1)); apercu.style.setProperty('--ay', y.toFixed(1));
    apercu.style.setProperty('--at', borne((x - avant) * 0.35, -5, 5).toFixed(2));
    if (Math.abs(cx - x) + Math.abs(cy - y) > 0.4) requestAnimationFrame(suivre); else { tourne = false; apercu.style.setProperty('--at', '0'); }
  };
  grille.addEventListener('pointermove', e => {
    const ligne = /** @type {HTMLElement|null} */ (/** @type {Element} */ (e.target).closest('li'));
    if (!ligne || e.pointerType !== 'mouse') return;
    const n = [...grille.children].indexOf(ligne);
    if (n !== rang) { rang = n; image.src = `images/apercus/${matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair'}-f${n + 1}.webp`; }
    // l'image se tient dans la colonne du titre, à gauche de la liste, à la hauteur du pointeur (sans recouvrir le titre)
    const titre = /** @type {HTMLElement} */ (document.querySelector('.fonctions-tete')).getBoundingClientRect();
    apercu.style.width = `${Math.round(Math.min(titre.width, 540))}px`;
    const h = apercu.offsetHeight || apercu.offsetWidth * 0.66, sousLeTitre = titre.bottom + 28;
    cx = titre.left; cy = borne(e.clientY - h / 2, Math.min(sousLeTitre, innerHeight - h - 16), innerHeight - h - 16);
    if (!apercu.classList.contains('la')) { x = cx; y = cy + 24; apercu.classList.add('la'); }
    if (!tourne) { tourne = true; requestAnimationFrame(suivre); }
  }, { passive: true });
  grille.addEventListener('pointerleave', () => apercu.classList.remove('la'));
  addEventListener('scroll', () => apercu.classList.remove('la'), { passive: true });
}

ecrire();
mettreEnScene();
// Capture de contrôle : « ?fige&recit=0.5 » (avancement du récit), « ?fige&vers=essai » (une section), « ?fige&y=1200 ».
if (fige) {
  void pret.then(() => {
    const versRecit = requete.get('recit'), vers = requete.get('vers');
    const y = versRecit !== null ? recit.offsetTop + (recit.offsetHeight - innerHeight) * +versRecit : vers ? $(vers).offsetTop + (+(requete.get('plus') ?? 0)) : +(requete.get('y') ?? 0);
    scrollTo(0, y);
    mettreEnScene();
  });
}
