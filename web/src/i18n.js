// @ts-check
/**
 * Textes de l'interface dans les quatre langues. Le moteur ne renvoie que des codes : tout ce qui se lit est ici.
 * Une clé absente dans une langue retombe sur le français, jamais sur une case vide.
 */

import { VUES_T } from './i18n-vues.js';
import { PLUS_T } from './i18n-plus.js';

export const LANGUES = ['fr', 'de', 'it', 'en'];
const REGION = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-CH' };

const T = {
  fr: {
    titre: 'Prévoyance', sousTitre: 'Analyse des lacunes', exemple: 'Charger un exemple', reinitialiser: 'Nouveau dossier', regles: 'Règles',
    client: 'Client', conjoint: 'Conjoint ou partenaire', menage: 'Ménage', lpp: '2e pilier — certificat', pilier3: '3e pilier et fortune',
    besoins: 'Objectifs du client', naissance: 'Date de naissance', sexe: 'Sexe', homme: 'Homme', femme: 'Femme',
    statut: 'Activité', salarie: 'Salarié', independant: 'Indépendant', sans: 'Sans activité', revenu: 'Revenu annuel brut',
    etatCivil: 'État civil', celibataire: 'Célibataire', marie: 'Marié', partenariat: 'Partenariat enregistré', concubin: 'Concubinage',
    divorce: 'Divorcé', veuf: 'Veuf', enfants: 'Enfants à charge', ageEnfant: 'Âge de l’enfant', avecConjoint: 'Saisir le conjoint',
    anneesManquantes: 'Années AVS manquantes', ramd: 'Revenu moyen AVS (si connu)', avoir: 'Avoir de vieillesse', renteVieillesse: 'Rente de vieillesse projetée',
    renteInvalidite: 'Rente d’invalidité', renteConjoint: 'Rente de conjoint', capitalDeces: 'Capital décès', rachatPossible: 'Rachat possible',
    affilie: 'Affilié à une caisse de pension', laa: 'Assurance-accidents (LAA)', ijm: 'Perte de gain maladie',
    avoir3a: 'Avoir 3a', versement3a: 'Versement 3a par an', avoir3b: 'Avoir 3b', fortune: 'Fortune libre', renteInvaliditePrivee: 'Rente d’invalidité privée',
    capitalDecesPrive: 'Capital décès privé', besoinRetraite: 'Revenu voulu à la retraite', besoinInvalidite: 'Revenu voulu en cas d’invalidité',
    besoinDeces: 'Revenu voulu pour les proches', ageRetraite: 'Âge de la retraite', duRevenu: 'du revenu', facultatif: 'facultatif', ans: 'ans',
    score: 'Couverture globale', lacune: 'Lacune', couvert: 'Couvert', parMois: 'par mois', parAn: 'par an', besoin: 'Besoin', capital: 'Capital à prévoir',
    aucuneLacune: 'Aucune lacune', surLaDuree: 'sur {n} ans', epargne: 'soit {m} par an jusqu’à la retraite',
    retraite: 'Retraite', invaliditeMaladie: 'Invalidité · maladie', invaliditeAccident: 'Invalidité · accident',
    decesMaladie: 'Décès · maladie', decesAccident: 'Décès · accident', ligneDeVie: 'Ligne de vie', revenuSelonAge: 'Revenu annuel selon l’âge',
    detail: 'D’où vient le revenu', alertes: 'Points d’attention', potentiels: 'Leviers', estime: 'estimé', reduit: 'réduit (surindemnisation)',
    s_avs: 'AVS', s_ai: 'Rente AI', s_aiEnfants: 'AI — rentes pour enfants', s_lpp: 'Caisse de pension', s_laa: 'Assurance-accidents',
    s_pilier3a: 'Pilier 3a', s_pilier3b: 'Pilier 3b', s_fortune: 'Fortune', s_privee: 'Assurance privée', s_avsConjoint: 'AVS — rente de conjoint',
    s_avsSupplement: 'AVS — supplément AVS 21', avsOrphelins: 'AVS — rentes d’orphelin', s_capitaux: 'Capitaux disponibles, en revenu', s_salaire: 'Salaire', pilier1: '1er pilier', pilier2: '2e pilier', pilier3c: '3e pilier',
    attente: 'Les deux premières années', att_ijm: 'Indemnités journalières maladie : {t} % pendant {j} jours',
    att_salaireEchelle: 'Sans assurance : salaire versé {s} semaines seulement, puis plus rien avant la rente',
    att_aucune: 'Aucun revenu de remplacement avant la rente AI', att_laaIndemnite: 'Indemnités journalières LAA : {t} % du gain assuré',
    p_3a: 'Pilier 3a', p_3a_d: '{m} peuvent encore être versés cette année. Économie d’impôt estimée : {e}. Capital supplémentaire à la retraite : {c}.',
    p_3a_plein: 'Le plafond 3a de {m} est atteint.', p_lpp: 'Rachat dans la caisse de pension',
    p_lpp_d: 'Rachat possible de {m}. Économie d’impôt estimée : {e}. Rente supplémentaire : {r} par an.',
    p_avs: 'Années AVS manquantes', p_avs_d: '{n} année(s) manquante(s) : {m} de rente en moins chaque mois, à vie.',
    tauxMarginal: 'Taux marginal d’impôt retenu : {t} %', a_ramdEstime: 'Le revenu moyen AVS est estimé. Demandez un calcul anticipé de la rente à la caisse de compensation.',
    a_lppEstimee: 'Les prestations du 2e pilier sont au minimum légal. Saisissez le certificat de prévoyance pour un résultat exact.',
    a_lacunesAVS: '{annees} année(s) de cotisations AVS manquante(s) : rente réduite de {perteMensuelle} par mois.',
    a_concubinage: 'Concubinage : aucune rente de veuve ou de veuf de l’AVS, et rien de la LAA. La caisse de pension ne verse une rente que si le partenaire a été annoncé.',
    a_independantSansLPP: 'Indépendant sans 2e pilier : aucune rente d’invalidité ni de survivants hors AVS/AI.',
    a_independantSansLAA: 'Indépendant sans assurance-accidents : un accident est couvert comme une maladie, par l’AI seule.',
    a_independantSansIJM: 'Aucune perte de gain maladie : aucun revenu pendant l’année d’attente de la rente AI.',
    a_sansIJM: 'Pas d’assurance perte de gain maladie connue : le salaire n’est dû que {semaines} semaines.',
    a_revenuAuDessusLAA: 'Revenu supérieur au plafond LAA de {plafond} : {excedent} ne sont pas assurés en cas d’accident.',
    a_sousSeuilLPP: 'Revenu inférieur au seuil d’entrée LPP de {seuil} : pas de 2e pilier obligatoire.',
    a_plafonnementCouple: 'Couple marié : les deux rentes AVS sont plafonnées à {plafond} par mois au total.',
    a_rachat3a: 'Pilier 3a : rachat rétroactif possible jusqu’à {montant} (lacunes depuis 2025), soit environ {economie} d’impôt en moins. La cotisation de l’année doit être versée en entier.', a_potentiel3a: 'Pilier 3a : {montant} encore déductibles cette année, soit environ {economie} d’impôt en moins.',
    a_rachatLPP: 'Rachat LPP possible de {montant} : environ {economie} d’impôt en moins.',
    a_ecartMaladieAccident: 'La maladie est bien moins couverte que l’accident : {ecart} de différence par an.',
    a_pontAVS: 'Départ avant l’AVS : la rente ne peut être touchée qu’à {age} ans. {annees} année(s) à financer par ses propres moyens.', a_supplementTransitoire: 'Femme née entre 1961 et 1969 (AVS 21) : supplément de rente ou taux d’anticipation réduits pris en compte. Montant à confirmer par la caisse de compensation.', lacunePlusTard: 'par mois, après les rentes d’enfants', erreurCalcul: 'Le calcul n’a pas abouti avec ces valeurs : les chiffres affichés ne sont plus à jour. Vérifiez la dernière saisie.', accueil: 'Accueil', accueilAccroche: 'Les lacunes des trois piliers, en clair.', accueilDossiers: 'Dossiers', accueilNouveau: 'Nouveau dossier', accueilExemple: 'Exemple', accueilSuivant: 'Suivant', accueilTerminer: 'Terminer', a_generationTransitoire: 'Génération transitoire AVS 21 : âge de référence à {ans} ans et {mois} mois.',
    a_choixRenteCapital: 'Retraite dans {annees} ans : le choix entre rente et capital doit être préparé (délais d’annonce de la caisse).',
    avertissement: 'Ordre de grandeur pour un entretien de conseil. Ce n’est pas un calcul de rente officiel.',
  },
  de: {
    titre: 'Vorsorge', sousTitre: 'Lückenanalyse', exemple: 'Beispiel laden', reinitialiser: 'Neues Dossier', regles: 'Regeln',
    client: 'Kunde', conjoint: 'Ehe- oder Lebenspartner', menage: 'Haushalt', lpp: '2. Säule — Vorsorgeausweis', pilier3: '3. Säule und Vermögen',
    besoins: 'Ziele des Kunden', naissance: 'Geburtsdatum', sexe: 'Geschlecht', homme: 'Mann', femme: 'Frau',
    statut: 'Erwerb', salarie: 'Angestellt', independant: 'Selbständig', sans: 'Nicht erwerbstätig', revenu: 'Bruttojahreseinkommen',
    etatCivil: 'Zivilstand', celibataire: 'Ledig', marie: 'Verheiratet', partenariat: 'Eingetragene Partnerschaft', concubin: 'Konkubinat',
    divorce: 'Geschieden', veuf: 'Verwitwet', enfants: 'Unterhaltsberechtigte Kinder', ageEnfant: 'Alter des Kindes', avecConjoint: 'Partner erfassen',
    anneesManquantes: 'Fehlende AHV-Jahre', ramd: 'AHV-Durchschnittseinkommen (falls bekannt)', avoir: 'Altersguthaben', renteVieillesse: 'Voraussichtliche Altersrente',
    renteInvalidite: 'Invalidenrente', renteConjoint: 'Ehegattenrente', capitalDeces: 'Todesfallkapital', rachatPossible: 'Möglicher Einkauf',
    affilie: 'Einer Pensionskasse angeschlossen', laa: 'Unfallversicherung (UVG)', ijm: 'Krankentaggeld',
    avoir3a: 'Guthaben 3a', versement3a: 'Einzahlung 3a pro Jahr', avoir3b: 'Guthaben 3b', fortune: 'Freies Vermögen', renteInvaliditePrivee: 'Private Invalidenrente',
    capitalDecesPrive: 'Privates Todesfallkapital', besoinRetraite: 'Gewünschtes Einkommen im Alter', besoinInvalidite: 'Gewünschtes Einkommen bei Invalidität',
    besoinDeces: 'Gewünschtes Einkommen für Hinterbliebene', ageRetraite: 'Pensionierungsalter', duRevenu: 'des Einkommens', facultatif: 'optional', ans: 'Jahre',
    score: 'Gesamtdeckung', lacune: 'Lücke', couvert: 'Gedeckt', parMois: 'pro Monat', parAn: 'pro Jahr', besoin: 'Bedarf', capital: 'Benötigtes Kapital',
    aucuneLacune: 'Keine Lücke', surLaDuree: 'über {n} Jahre', epargne: 'oder {m} pro Jahr bis zur Pensionierung',
    retraite: 'Alter', invaliditeMaladie: 'Invalidität · Krankheit', invaliditeAccident: 'Invalidität · Unfall',
    decesMaladie: 'Tod · Krankheit', decesAccident: 'Tod · Unfall', ligneDeVie: 'Lebenslinie', revenuSelonAge: 'Jahreseinkommen nach Alter',
    detail: 'Woher das Einkommen kommt', alertes: 'Wichtige Punkte', potentiels: 'Hebel', estime: 'geschätzt', reduit: 'gekürzt (Überentschädigung)',
    s_avs: 'AHV', s_ai: 'IV-Rente', s_aiEnfants: 'IV — Kinderrenten', s_lpp: 'Pensionskasse', s_laa: 'Unfallversicherung',
    s_pilier3a: 'Säule 3a', s_pilier3b: 'Säule 3b', s_fortune: 'Vermögen', s_privee: 'Private Versicherung', s_avsConjoint: 'AHV — Witwen-/Witwerrente',
    s_avsSupplement: 'AHV — Rentenzuschlag AHV 21', avsOrphelins: 'AHV — Waisenrenten', s_capitaux: 'Verfügbares Kapital, als Einkommen', s_salaire: 'Lohn', pilier1: '1. Säule', pilier2: '2. Säule', pilier3c: '3. Säule',
    attente: 'Die ersten zwei Jahre', att_ijm: 'Krankentaggeld: {t} % während {j} Tagen',
    att_salaireEchelle: 'Ohne Versicherung: Lohn nur während {s} Wochen, danach nichts bis zur Rente',
    att_aucune: 'Kein Ersatzeinkommen bis zur IV-Rente', att_laaIndemnite: 'UVG-Taggeld: {t} % des versicherten Verdienstes',
    p_3a: 'Säule 3a', p_3a_d: '{m} können dieses Jahr noch eingezahlt werden. Geschätzte Steuerersparnis: {e}. Zusätzliches Kapital im Alter: {c}.',
    p_3a_plein: 'Der 3a-Maximalbetrag von {m} ist erreicht.', p_lpp: 'Einkauf in die Pensionskasse',
    p_lpp_d: 'Möglicher Einkauf von {m}. Geschätzte Steuerersparnis: {e}. Zusätzliche Rente: {r} pro Jahr.',
    p_avs: 'Fehlende AHV-Jahre', p_avs_d: '{n} fehlende(s) Jahr(e): {m} weniger Rente pro Monat, lebenslang.',
    tauxMarginal: 'Angenommener Grenzsteuersatz: {t} %', a_ramdEstime: 'Das AHV-Durchschnittseinkommen ist geschätzt. Verlangen Sie eine Rentenvorausberechnung bei der Ausgleichskasse.',
    a_lppEstimee: 'Die Leistungen der 2. Säule entsprechen dem gesetzlichen Minimum. Erfassen Sie den Vorsorgeausweis für ein genaues Ergebnis.',
    a_lacunesAVS: '{annees} fehlende(s) AHV-Beitragsjahr(e): Rente um {perteMensuelle} pro Monat gekürzt.',
    a_concubinage: 'Konkubinat: keine Witwen- oder Witwerrente der AHV und nichts vom UVG. Die Pensionskasse zahlt nur, wenn der Partner gemeldet wurde.',
    a_independantSansLPP: 'Selbständig ohne 2. Säule: keine Invaliden- oder Hinterlassenenrente ausser AHV/IV.',
    a_independantSansLAA: 'Selbständig ohne Unfallversicherung: Ein Unfall ist wie eine Krankheit gedeckt, nur durch die IV.',
    a_independantSansIJM: 'Kein Krankentaggeld: kein Einkommen während des Wartejahres der IV-Rente.',
    a_sansIJM: 'Keine Krankentaggeldversicherung bekannt: Der Lohn ist nur {semaines} Wochen geschuldet.',
    a_revenuAuDessusLAA: 'Einkommen über dem UVG-Höchstbetrag von {plafond}: {excedent} sind bei Unfall nicht versichert.',
    a_sousSeuilLPP: 'Einkommen unter der BVG-Eintrittsschwelle von {seuil}: keine obligatorische 2. Säule.',
    a_plafonnementCouple: 'Ehepaar: Die beiden AHV-Renten sind zusammen auf {plafond} pro Monat plafoniert.',
    a_rachat3a: 'Säule 3a: nachträglicher Einkauf bis {montant} möglich (Lücken seit 2025), rund {economie} weniger Steuern. Der ordentliche Jahresbeitrag muss voll einbezahlt sein.', a_potentiel3a: 'Säule 3a: noch {montant} abzugsfähig in diesem Jahr, rund {economie} weniger Steuern.',
    a_rachatLPP: 'BVG-Einkauf von {montant} möglich: rund {economie} weniger Steuern.',
    a_ecartMaladieAccident: 'Krankheit ist deutlich schlechter gedeckt als Unfall: {ecart} Unterschied pro Jahr.',
    a_pontAVS: 'Pensionierung vor der AHV: Die Rente kann erst mit {age} bezogen werden. {annees} Jahr(e) sind selbst zu überbrücken.', a_supplementTransitoire: 'Frau mit Jahrgang 1961 bis 1969 (AHV 21): Rentenzuschlag oder tiefere Kürzungssätze berücksichtigt. Betrag von der Ausgleichskasse bestätigen lassen.', lacunePlusTard: 'pro Monat, nach den Kinderrenten', erreurCalcul: 'Die Berechnung ist mit diesen Werten fehlgeschlagen: Die angezeigten Zahlen sind nicht mehr aktuell. Prüfen Sie die letzte Eingabe.', accueil: 'Start', accueilAccroche: 'Die Lücken der drei Säulen, klar beziffert.', accueilDossiers: 'Dossiers', accueilNouveau: 'Neues Dossier', accueilExemple: 'Beispiel', accueilSuivant: 'Weiter', accueilTerminer: 'Abschliessen', a_generationTransitoire: 'Übergangsgeneration AHV 21: Referenzalter {ans} Jahre und {mois} Monate.',
    a_choixRenteCapital: 'Pensionierung in {annees} Jahren: Die Wahl zwischen Rente und Kapital muss vorbereitet werden (Anmeldefristen der Kasse).',
    avertissement: 'Grössenordnung für ein Beratungsgespräch. Keine offizielle Rentenberechnung.',
  },
  it: {
    titre: 'Previdenza', sousTitre: 'Analisi delle lacune', exemple: 'Carica un esempio', reinitialiser: 'Nuovo dossier', regles: 'Regole',
    client: 'Cliente', conjoint: 'Coniuge o partner', menage: 'Economia domestica', lpp: '2° pilastro — certificato', pilier3: '3° pilastro e patrimonio',
    besoins: 'Obiettivi del cliente', naissance: 'Data di nascita', sexe: 'Sesso', homme: 'Uomo', femme: 'Donna',
    statut: 'Attività', salarie: 'Dipendente', independant: 'Indipendente', sans: 'Senza attività', revenu: 'Reddito annuo lordo',
    etatCivil: 'Stato civile', celibataire: 'Celibe/nubile', marie: 'Coniugato', partenariat: 'Unione domestica registrata', concubin: 'Concubinato',
    divorce: 'Divorziato', veuf: 'Vedovo', enfants: 'Figli a carico', ageEnfant: 'Età del figlio', avecConjoint: 'Inserire il partner',
    anneesManquantes: 'Anni AVS mancanti', ramd: 'Reddito medio AVS (se noto)', avoir: 'Avere di vecchiaia', renteVieillesse: 'Rendita di vecchiaia prevista',
    renteInvalidite: 'Rendita d’invalidità', renteConjoint: 'Rendita per coniuge', capitalDeces: 'Capitale in caso di decesso', rachatPossible: 'Riscatto possibile',
    affilie: 'Affiliato a una cassa pensioni', laa: 'Assicurazione infortuni (LAINF)', ijm: 'Indennità giornaliera di malattia',
    avoir3a: 'Avere 3a', versement3a: 'Versamento 3a all’anno', avoir3b: 'Avere 3b', fortune: 'Patrimonio libero', renteInvaliditePrivee: 'Rendita d’invalidità privata',
    capitalDecesPrive: 'Capitale privato in caso di decesso', besoinRetraite: 'Reddito desiderato al pensionamento', besoinInvalidite: 'Reddito desiderato in caso d’invalidità',
    besoinDeces: 'Reddito desiderato per i superstiti', ageRetraite: 'Età di pensionamento', duRevenu: 'del reddito', facultatif: 'facoltativo', ans: 'anni',
    score: 'Copertura globale', lacune: 'Lacuna', couvert: 'Coperto', parMois: 'al mese', parAn: 'all’anno', besoin: 'Fabbisogno', capital: 'Capitale necessario',
    aucuneLacune: 'Nessuna lacuna', surLaDuree: 'su {n} anni', epargne: 'ossia {m} all’anno fino al pensionamento',
    retraite: 'Vecchiaia', invaliditeMaladie: 'Invalidità · malattia', invaliditeAccident: 'Invalidità · infortunio',
    decesMaladie: 'Decesso · malattia', decesAccident: 'Decesso · infortunio', ligneDeVie: 'Linea della vita', revenuSelonAge: 'Reddito annuo secondo l’età',
    detail: 'Da dove viene il reddito', alertes: 'Punti d’attenzione', potentiels: 'Leve', estime: 'stimato', reduit: 'ridotto (sovraindennizzo)',
    s_avs: 'AVS', s_ai: 'Rendita AI', s_aiEnfants: 'AI — rendite per i figli', s_lpp: 'Cassa pensioni', s_laa: 'Assicurazione infortuni',
    s_pilier3a: 'Pilastro 3a', s_pilier3b: 'Pilastro 3b', s_fortune: 'Patrimonio', s_privee: 'Assicurazione privata', s_avsConjoint: 'AVS — rendita vedovile',
    s_avsSupplement: 'AVS — supplemento AVS 21', avsOrphelins: 'AVS — rendite per orfani', s_capitaux: 'Capitali disponibili, in reddito', s_salaire: 'Salario', pilier1: '1° pilastro', pilier2: '2° pilastro', pilier3c: '3° pilastro',
    attente: 'I primi due anni', att_ijm: 'Indennità giornaliera di malattia: {t} % per {j} giorni',
    att_salaireEchelle: 'Senza assicurazione: salario versato solo per {s} settimane, poi nulla fino alla rendita',
    att_aucune: 'Nessun reddito sostitutivo fino alla rendita AI', att_laaIndemnite: 'Indennità giornaliera LAINF: {t} % del guadagno assicurato',
    p_3a: 'Pilastro 3a', p_3a_d: '{m} possono ancora essere versati quest’anno. Risparmio fiscale stimato: {e}. Capitale supplementare al pensionamento: {c}.',
    p_3a_plein: 'Il limite 3a di {m} è raggiunto.', p_lpp: 'Riscatto nella cassa pensioni',
    p_lpp_d: 'Riscatto possibile di {m}. Risparmio fiscale stimato: {e}. Rendita supplementare: {r} all’anno.',
    p_avs: 'Anni AVS mancanti', p_avs_d: '{n} anno/i mancante/i: {m} di rendita in meno ogni mese, a vita.',
    tauxMarginal: 'Aliquota marginale considerata: {t} %', a_ramdEstime: 'Il reddito medio AVS è stimato. Richiedete un calcolo anticipato della rendita alla cassa di compensazione.',
    a_lppEstimee: 'Le prestazioni del 2° pilastro sono al minimo legale. Inserite il certificato di previdenza per un risultato esatto.',
    a_lacunesAVS: '{annees} anno/i di contributi AVS mancante/i: rendita ridotta di {perteMensuelle} al mese.',
    a_concubinage: 'Concubinato: nessuna rendita vedovile dell’AVS e nulla dalla LAINF. La cassa pensioni versa una rendita solo se il partner è stato annunciato.',
    a_independantSansLPP: 'Indipendente senza 2° pilastro: nessuna rendita d’invalidità o per superstiti oltre AVS/AI.',
    a_independantSansLAA: 'Indipendente senza assicurazione infortuni: un infortunio è coperto come una malattia, solo dall’AI.',
    a_independantSansIJM: 'Nessuna indennità giornaliera di malattia: nessun reddito durante l’anno d’attesa della rendita AI.',
    a_sansIJM: 'Nessuna assicurazione d’indennità giornaliera nota: il salario è dovuto solo per {semaines} settimane.',
    a_revenuAuDessusLAA: 'Reddito superiore al massimo LAINF di {plafond}: {excedent} non sono assicurati in caso d’infortunio.',
    a_sousSeuilLPP: 'Reddito inferiore alla soglia d’entrata LPP di {seuil}: nessun 2° pilastro obbligatorio.',
    a_plafonnementCouple: 'Coppia sposata: le due rendite AVS sono limitate a {plafond} al mese in totale.',
    a_rachat3a: 'Pilastro 3a: riscatto retroattivo possibile fino a {montant} (lacune dal 2025), circa {economie} d’imposte in meno. Il contributo dell’anno va versato per intero.', a_potentiel3a: 'Pilastro 3a: ancora {montant} deducibili quest’anno, circa {economie} d’imposte in meno.',
    a_rachatLPP: 'Riscatto LPP possibile di {montant}: circa {economie} d’imposte in meno.',
    a_ecartMaladieAccident: 'La malattia è molto meno coperta dell’infortunio: {ecart} di differenza all’anno.',
    a_pontAVS: 'Pensionamento prima dell’AVS: la rendita è percepibile solo a {age} anni. {annees} anno/i da finanziare con mezzi propri.', a_supplementTransitoire: 'Donna nata tra il 1961 e il 1969 (AVS 21): supplemento di rendita o aliquote di anticipazione ridotte considerati. Importo da confermare presso la cassa di compensazione.', lacunePlusTard: 'al mese, dopo le rendite per i figli', erreurCalcul: 'Il calcolo non è riuscito con questi valori: le cifre mostrate non sono più aggiornate. Verificate l’ultimo dato inserito.', accueil: 'Inizio', accueilAccroche: 'Le lacune dei tre pilastri, in chiaro.', accueilDossiers: 'Dossier', accueilNouveau: 'Nuovo dossier', accueilExemple: 'Esempio', accueilSuivant: 'Avanti', accueilTerminer: 'Concludere', a_generationTransitoire: 'Generazione di transizione AVS 21: età di riferimento {ans} anni e {mois} mesi.',
    a_choixRenteCapital: 'Pensionamento tra {annees} anni: la scelta tra rendita e capitale va preparata (termini d’annuncio della cassa).',
    avertissement: 'Ordine di grandezza per un colloquio di consulenza. Non è un calcolo ufficiale della rendita.',
  },
  en: {
    titre: 'Pension', sousTitre: 'Gap analysis', exemple: 'Load an example', reinitialiser: 'New case', regles: 'Rules',
    client: 'Client', conjoint: 'Spouse or partner', menage: 'Household', lpp: '2nd pillar — pension certificate', pilier3: '3rd pillar and assets',
    besoins: 'Client goals', naissance: 'Date of birth', sexe: 'Sex', homme: 'Male', femme: 'Female',
    statut: 'Occupation', salarie: 'Employed', independant: 'Self-employed', sans: 'Not working', revenu: 'Gross annual income',
    etatCivil: 'Marital status', celibataire: 'Single', marie: 'Married', partenariat: 'Registered partnership', concubin: 'Cohabiting',
    divorce: 'Divorced', veuf: 'Widowed', enfants: 'Dependent children', ageEnfant: 'Child’s age', avecConjoint: 'Enter the partner',
    anneesManquantes: 'Missing AHV/AVS years', ramd: 'Average AHV/AVS income (if known)', avoir: 'Retirement assets', renteVieillesse: 'Projected retirement pension',
    renteInvalidite: 'Disability pension', renteConjoint: 'Spouse’s pension', capitalDeces: 'Lump sum on death', rachatPossible: 'Possible buy-in',
    affilie: 'Member of a pension fund', laa: 'Accident insurance (UVG/LAA)', ijm: 'Daily sickness allowance',
    avoir3a: 'Pillar 3a assets', versement3a: 'Pillar 3a payment per year', avoir3b: 'Pillar 3b assets', fortune: 'Free assets', renteInvaliditePrivee: 'Private disability pension',
    capitalDecesPrive: 'Private death benefit', besoinRetraite: 'Target income in retirement', besoinInvalidite: 'Target income if disabled',
    besoinDeces: 'Target income for survivors', ageRetraite: 'Retirement age', duRevenu: 'of income', facultatif: 'optional', ans: 'years',
    score: 'Overall coverage', lacune: 'Gap', couvert: 'Covered', parMois: 'per month', parAn: 'per year', besoin: 'Need', capital: 'Capital required',
    aucuneLacune: 'No gap', surLaDuree: 'over {n} years', epargne: 'or {m} per year until retirement',
    retraite: 'Retirement', invaliditeMaladie: 'Disability · illness', invaliditeAccident: 'Disability · accident',
    decesMaladie: 'Death · illness', decesAccident: 'Death · accident', ligneDeVie: 'Lifeline', revenuSelonAge: 'Annual income by age',
    detail: 'Where the income comes from', alertes: 'Key points', potentiels: 'Levers', estime: 'estimated', reduit: 'reduced (overcompensation)',
    s_avs: 'AHV/AVS', s_ai: 'Disability pension (IV/AI)', s_aiEnfants: 'IV/AI — child pensions', s_lpp: 'Pension fund', s_laa: 'Accident insurance',
    s_pilier3a: 'Pillar 3a', s_pilier3b: 'Pillar 3b', s_fortune: 'Assets', s_privee: 'Private insurance', s_avsConjoint: 'AHV/AVS — widow(er)’s pension',
    s_avsSupplement: 'AHV/AVS — AHV 21 supplement', avsOrphelins: 'AHV/AVS — orphans’ pensions', s_capitaux: 'Available capital, as income', s_salaire: 'Salary', pilier1: '1st pillar', pilier2: '2nd pillar', pilier3c: '3rd pillar',
    attente: 'The first two years', att_ijm: 'Daily sickness allowance: {t} % for {j} days',
    att_salaireEchelle: 'Uninsured: salary paid for {s} weeks only, then nothing until the pension starts',
    att_aucune: 'No replacement income before the disability pension', att_laaIndemnite: 'Accident daily allowance: {t} % of insured earnings',
    p_3a: 'Pillar 3a', p_3a_d: '{m} can still be paid in this year. Estimated tax saving: {e}. Extra capital at retirement: {c}.',
    p_3a_plein: 'The pillar 3a ceiling of {m} is reached.', p_lpp: 'Pension fund buy-in',
    p_lpp_d: 'Possible buy-in of {m}. Estimated tax saving: {e}. Extra pension: {r} per year.',
    p_avs: 'Missing AHV/AVS years', p_avs_d: '{n} missing year(s): {m} less pension every month, for life.',
    tauxMarginal: 'Marginal tax rate used: {t} %', a_ramdEstime: 'The average AHV/AVS income is estimated. Ask the compensation office for a pension forecast.',
    a_lppEstimee: '2nd pillar benefits are at the legal minimum. Enter the pension certificate for an exact result.',
    a_lacunesAVS: '{annees} missing AHV/AVS contribution year(s): pension reduced by {perteMensuelle} per month.',
    a_concubinage: 'Cohabiting: no widow(er)’s pension from AHV/AVS and nothing from accident insurance. The pension fund only pays if the partner was registered.',
    a_independantSansLPP: 'Self-employed without a 2nd pillar: no disability or survivors’ pension beyond AHV/IV.',
    a_independantSansLAA: 'Self-employed without accident insurance: an accident is covered like an illness, by IV/AI alone.',
    a_independantSansIJM: 'No daily sickness allowance: no income during the waiting year for the disability pension.',
    a_sansIJM: 'No daily sickness allowance known: salary is owed for {semaines} weeks only.',
    a_revenuAuDessusLAA: 'Income above the accident insurance ceiling of {plafond}: {excedent} is uninsured in case of accident.',
    a_sousSeuilLPP: 'Income below the pension fund entry threshold of {seuil}: no mandatory 2nd pillar.',
    a_plafonnementCouple: 'Married couple: the two AHV/AVS pensions are capped at {plafond} per month in total.',
    a_rachat3a: 'Pillar 3a: retroactive purchase possible up to {montant} (gaps since 2025), about {economie} less tax. The year’s regular contribution must be paid in full.', a_potentiel3a: 'Pillar 3a: {montant} still deductible this year, about {economie} less tax.',
    a_rachatLPP: 'Pension fund buy-in of {montant} possible: about {economie} less tax.',
    a_ecartMaladieAccident: 'Illness is far less covered than accident: {ecart} difference per year.',
    a_pontAVS: 'Retiring before the AHV: the pension can only be drawn from age {age}. {annees} year(s) to bridge from own means.', a_supplementTransitoire: 'Woman born 1961 to 1969 (AHV 21): pension supplement or reduced early-withdrawal rates taken into account. Amount to be confirmed by the compensation office.', lacunePlusTard: 'per month, after the children’s pensions', erreurCalcul: 'The calculation failed with these values: the figures shown are out of date. Check the last entry.', accueil: 'Home', accueilAccroche: 'The three-pillar gaps, made clear.', accueilDossiers: 'Client files', accueilNouveau: 'New file', accueilExemple: 'Example', accueilSuivant: 'Next', accueilTerminer: 'Finish', a_generationTransitoire: 'AHV 21 transitional generation: reference age {ans} years and {mois} months.',
    a_choixRenteCapital: 'Retirement in {annees} years: the pension-or-capital choice must be prepared (fund notice periods).',
    avertissement: 'Order of magnitude for an advisory meeting. Not an official pension calculation.',
  },
};

/** Traducteur d'une langue : `t('cle', {n: 3})`. */
export function traducteur(langue) {
  const table = { ...T.fr, ...VUES_T.fr, ...PLUS_T.fr, ...(T[langue] ?? {}), ...(VUES_T[langue] ?? {}), ...(PLUS_T[langue] ?? {}) };
  return (cle, valeurs = {}) => {
    let texte = table[cle] ?? cle;
    for (const [k, v] of Object.entries(valeurs)) texte = texte.replaceAll(`{${k}}`, String(v));
    const accorde = accorder(texte, langue);
    // en français, la ponctuation double ne passe jamais seule à la ligne : espace insécable avant « : ; ? ! »
    return langue === 'fr' ? accorde.replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') : accorde;
  };
}

/**
 * Accords en nombre : « 1 année(s) manquante(s) » devient « 1 année manquante », « 3 lacune(s) » « 3 lacunes ».
 * Chaque marque entre parenthèses s'accorde avec le dernier nombre écrit avant elle. Français et anglais : « (s) » au
 * pluriel. Allemand : « (e) », « (n) » au pluriel, « (s) » au singulier (« 1 fehlendes Jahr », « 2 fehlende Jahre »).
 * Sans nombre devant, le texte reste tel quel.
 * @param {string} texte @param {string} langue
 */
export function accorder(texte, langue) {
  if (!texte.includes('(')) return texte;
  return texte.replace(/\((s|e|n)\)/g, (marque, lettre, position) => {
    const nombres = texte.slice(0, position).match(/\d+/g);
    if (!nombres) return marque;
    const n = +nombres[nombres.length - 1];
    if (langue === 'de') return lettre === 's' ? (n === 1 ? 's' : '') : (n === 1 ? '' : lettre);
    if (lettre !== 's') return marque;
    return (langue === 'fr' ? n >= 2 : n !== 1) ? 's' : '';
  });
}

/** Mise en forme suisse des montants : 12’345 CHF, sans centimes. */
export function formats(langue) {
  const region = REGION[langue] ?? REGION.fr;
  const brut = new Intl.NumberFormat(region, { maximumFractionDigits: 0 });
  // Un seul usage dans les quatre langues, celui de la page d'entrée : l'apostrophe des milliers (83’200). L'espace
  // fine du français disparaissait dans les grands chiffres (« CHF 298000 »). « CHF » ne se sépare pas de son montant.
  const nombre = { format: x => brut.format(x).replace(/[\u202f\u00a0\u2009 '’]/g, '’') };
  return {
    nombre: x => nombre.format(Math.round(x)),
    chf: x => `CHF\u00a0${nombre.format(Math.round(x))}`,
    court: x => Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(1).replace('.0', '')} M` : Math.abs(x) >= 1000 ? `${Math.round(x / 1000)}k` : String(Math.round(x)),
    pourcent: x => `${Math.round(x * 100)}\u00a0%`,
  };
}

/** Clés présentes dans une langue, sans repli sur le français : sert au contrôle de complétude des traductions. */
export function clesDe(langue) {
  return new Set([...Object.keys(T[langue] ?? {}), ...Object.keys(VUES_T[langue] ?? {}), ...Object.keys(PLUS_T[langue] ?? {})]);
}
