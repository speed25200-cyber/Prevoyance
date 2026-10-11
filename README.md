# Prévoyance

Analyse des lacunes de prévoyance pour le marché suisse : retraite, invalidité, décès, sur les trois piliers.
Un outil de conseiller, pensé pour le rendez-vous client : on saisit la situation, on montre les lacunes à l'écran,
on construit le plan avec le client, on lui remet un rapport PDF.

- **Public** : conseillers et courtiers, face au client. Particuliers, salariés, indépendants, couples.
- **Plateformes** : application web installable (iPad, iPhone, ordinateur ; fonctionne hors ligne) et application native iPad / iPhone (`ios/`, construite et envoyée sur TestFlight par Codemagic : voir `ios/README.md`), avec barre d'onglets native.
- **Langues** : français, allemand, italien, anglais.

> Aucune donnée de client réelle ne doit entrer dans ce dépôt : il est public. Les exemples sont fictifs.
> Les dossiers saisis dans l'application restent dans le navigateur de l'appareil.

## Ce que fait l'application

| Vue | Contenu |
|---|---|
| **Analyse** | Couverture globale, les cinq risques (retraite, invalidité maladie / accident, décès maladie / accident), ce que verse chaque pilier, la « ligne de vie » du revenu année par année, le détail des sources, les leviers et les points d'attention. Le repère de la retraite se déplace à la main sur le graphique. |
| **Scénarios** | « Et si… » : six événements de vie (naissance, temps partiel, mise à son compte, augmentation, achat du logement avec le 2e pilier, mariage), chacun refaisant l'analyse complète ; âge de départ de 60 à 70 ans ; rente ou capital après impôts, avec seuil de rentabilité ; retraits et rachats échelonnés ; simulation du placement du 3a (2000 trajectoires) ; tenue de l'hypothèque à la retraite. |
| **Plan** | Les mesures proposées par le moteur (rente d'incapacité, capital décès, perte de gain, 3a, rachat, épargne), réglables, avec l'effet avant / après sur chaque lacune, l'économie d'impôt, et le budget du plan : épargne, primes des offres saisies par le conseiller, effort net par an et par mois. La **demande d'offre** à transmettre aux assureurs (sans nom ni adresse : seulement ce qui sert au tarif) se copie ou s'ouvre dans un courriel. |
| **Rapport** | Le document du client, en pages A4 : couverture, synthèse, retraite, invalidité, décès, plan, hypothèses et sources. « Enregistrer en PDF » par l'impression du navigateur. |
| **Données** | Les montants officiels appliqués (2026 et 2027), les valeurs encore à confirmer, les impôts des 26 cantons avec la date du relevé, les sources, et la vérification des mises à jour. |

Pour le courtier ou la compagnie : **logo de l'intermédiaire** sur le rapport, **fiche d'information LSA art. 45** et
**procès-verbal de conseil** avec **signatures du client et du conseiller sur l'écran**, dossiers **chiffrés par un code**
(AES 256), export et import d'un dossier en fichier. Rien ne quitte l'appareil.

Le moteur (`moteur/`) est contrôlé par des cas de test calculés à la main à partir des montants officiels
(`moteur/tests/cas.js`) ; Codemagic les rejoue avant chaque construction de l'app, et `outils/ci/essais-github.yml`
est un modèle prêt pour GitHub Actions.

S'y ajoute le **scan du certificat de prévoyance** (2e pilier) : le texte est lu sur l'appareil, les valeurs reconnues
(avoir, rentes, capital décès, rachat, salaire) sont proposées et le conseiller les vérifie avant de les reprendre.
Dans l'app iPhone / iPad : appareil photo, reconnaissance de texte et modèle de langage de l'appareil. Dans un
navigateur : texte collé, ou « Scanner du texte » de Safari. Rien n'est envoyé.

**Conformité (LSA révisée, en vigueur depuis le 1er janvier 2024).** L'application aide l'intermédiaire à documenter
son conseil : fiche d'information selon l'art. 45 LSA (nom et adresse, lié ou non lié, formation, responsabilité,
traitement des données), conflits d'intérêts (art. 45a), rémunération des intermédiaires non liés (art. 45b), et
procès-verbal de conseil avec la vérification d'une assurance sur la vie qualifiée (art. 39j et 39k). Ces deux pages
terminent le rapport ; un bandeau signale ce qui reste à compléter. L'application ne remplace ni l'enregistrement
auprès de la FINMA, ni les documents de l'assureur, ni un avis juridique.

**Verrouillage.** Dans le dossier, la carte « Sécurité » protège l'application par un code : les dossiers, la fiche de
l'intermédiaire et le nom du conseiller sont alors chiffrés sur l'appareil (AES-GCM 256 bits, clé dérivée du code par
PBKDF2-SHA-256, 600 000 itérations). Le code est demandé à l'ouverture et après cinq minutes en arrière-plan. Il n'est
enregistré nulle part : oublié, les dossiers sont perdus. Le chiffrement demande une adresse https ou locale ; dans
l'app native (adresse interne `prevoyance://`), sa disponibilité reste à vérifier à la première compilation.

S'y ajoutent aussi : un portefeuille de dossiers (créer, dupliquer, exporter, importer) et sa **vue d'ensemble** (touche P : tous les dossiers classés par ce qu'il reste à faire, 3a encore déductible, rachats possibles, rentes et capitaux de risque à assurer, export CSV), ses **segments** (invalidité, décès, retraite, 3a, rachat : la liste d'une campagne, du plus gros montant au plus petit), l'**agenda des échéances** (fichier .ics pour Outlook, Apple Calendrier ou Google Agenda : les dates légales d'un dossier ou de tout le portefeuille, tirées de la feuille de route du moteur), l'analyse de chacun des deux
membres d'un couple, un mode présentation plein écran, le clair et le sombre selon l'appareil.

## L'apparence : un vrai sommet

Dans le navigateur, la page d'entrée et l'application partagent un même parti pris : **la prévoyance se lit sur un vrai
sommet**. La retraite est une montagne dont les trois étages sont les trois piliers ; le besoin est une altitude à
atteindre (l'anneau en pointillé) ; la lacune est le dénivelé qui reste ; le plan est l'itinéraire. Fraunces pour les
titres et les montants, Inter pour le reste, le triangle des sommets comme jalon.

- **Le relief** (`web/src/relief.js`) est calculé et éclairé en direct (WebGL, sans bibliothèque) à partir des
  montants du moteur. Le terrain est réel : **le Weisshorn (4506 m, Valais) et son massif, sur 8 km**, d'après les
  données ouvertes de swisstopo — les altitudes de swissALTI3D pour la forme, la photographie aérienne SWISSIMAGE pour
  la roche et les glaciers (mention « © swisstopo » dans la page d'entrée, l'application et le rapport). Par-dessus :
  une neige fraîche calculée, la lumière d'un lever de soleil (ombre portée des arêtes, ligne d'ombre qui descend du
  sommet), une mer de brouillard dans les vallées, des chaînes lointaines, puis la carte — limites des étages et
  courbes de niveau. Sur fond sombre : l'heure bleue et l'aube ; sur papier : une photographie en noir et blanc.
  Sans WebGL, ou si le terrain ne se charge pas, la page garde sa version sans relief ; en mouvement réduit, une image
  fixe.
- **Le terrain embarqué** (`web/images/terrain/`, 2,6 Mo en tout) est fabriqué par `outils/terrain.py` : il télécharge
  les tuiles de swisstopo dans un dossier hors du dépôt, puis écrit une carte d'altitudes (PNG, 16 bits) et une
  photographie (WebP), chacune en deux finesses (ordinateur, téléphone), plus fines au centre qu'au bord.
  `outils/relief-essai.html` montre le relief seul, réglé par l'adresse (heure, vue, montants).
- **La page d'entrée** (`web/bienvenue.html`), toujours sombre : l'arrivée à l'heure bleue, puis un récit épinglé —
  les étages se dessinent sur le versant, l'anneau du besoin se pose, le massif monte jusqu'à lui pendant que le
  soleil se lève ; le simulateur fait du relief celui du visiteur (vrai moteur) ; à la fin, l'itinéraire monte
  jusqu'au sommet. `?fige` fige la page pour une capture (`?fige&recit=0.5`, `?fige&vers=essai`).
- **L'application** : `web/carte.css` est la peau du navigateur. Les feuilles d'origine restent chargées, rangées
  dans la couche CSS « socle » (voir `index.html`) ; la peau, hors couche, passe toujours devant. Tous ses sélecteurs
  commencent par `html:not(.natif)` : **l'app iPhone / iPad garde son apparence**. Les pages A4 du rapport reviennent
  aux feuilles d'origine (ce qu'on voit est ce qui s'imprime) ; sans marque, leur couverture porte le relief du client.
- Les images `web/images/apercus/` sont de vraies captures de l'application (dossier d'exemple).
- **Fluidité.** Mesuré sur une carte graphique intégrée modeste (Intel UHD 630, octobre 2026) : environ 20 ms par
  image à 1440 × 900, soit 30 images par seconde à pleine finesse — trop peu. Le relief ne dessine donc jamais plus de
  1,25 million de points par image, et dessine moins fin, par crans, quand les images tardent (il sait reconnaître un
  écran plafonné à 30 images par seconde, et n'y touche pas). Sur une telle carte, il se stabilise autour de 60 % à
  80 % de la finesse de l'écran. Non mesuré sur téléphone ni sur Safari.

## Structure

| Dossier | Contenu |
|---|---|
| `moteur/` | Le moteur de calcul, en JavaScript pur, sans dépendance. Une seule source de vérité pour le web et pour iOS (JavaScriptCore). |
| `moteur/regles/` | Les règles suisses d'une année sous forme de données (`ch-2026.json`, `ch-2027.json`), avec leurs sources. |
| `moteur/donnees/` | Les impôts par canton, relevés auprès du calculateur de l'Administration fédérale des contributions. |
| `moteur/manifeste.json` | La version des données : l'application la compare à celle du dépôt pour se mettre à jour. |
| `moteur/tests/` | Les cas de test du moteur : chaque valeur attendue est calculée à la main d'après les textes et montants officiels. |
| `web/` | La page d'entrée (`bienvenue.html`) et l'application (`index.html`), `src/` (vues, graphiques, relief, textes), `essais.html` (essais de l'interface). |
| `ios/` | L'application native : une enveloppe qui embarque `web/` et `moteur/`. |
| `outils/` | Relevé des impôts (`donnees/maj_impots.py`), essais et captures en arrière-plan (`essais.py`, `essais.ps1`, `capture.ps1`), contrôle de l'interface comme un visiteur (`pilote.py`, `cadre.html`), terrain du relief (`terrain.py`, `relief-essai.html`). |

## Le moteur

```js
import { analyser, regles, impots, Scenarios } from './moteur/src/index.js';

const dossier = {
  canton: 'VD', etatCivil: 'marie',
  personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 90000, lpp: { avoir: 100000 } },
  conjoint: { dateNaissance: '1988-05-12', sexe: 'f', statut: 'salarie', revenu: 60000 },
  enfants: [{ dateNaissance: '2019-09-03' }],
};
const resultat = analyser(dossier, await regles(2026), { impots: await impots(2026) });
const plan = Scenarios.proposerPlan(dossier, await regles(2026));
```

Pour chaque risque, le résultat donne le besoin, les prestations par source et par pilier, la lacune annuelle et
mensuelle, le taux de couverture et le capital qui comblerait la lacune ; plus les potentiels, les alertes, un score
et une chronologie des revenus. Le moteur ne produit aucun texte : il renvoie des codes, que l'interface traduit.

### Ce qui est modélisé

- **1er pilier** : rente AVS selon le revenu annuel moyen déterminant et l'échelle de rente (formule légale de
  l'échelle 44), 13e rente, âge de référence et génération transitoire des femmes, anticipation et ajournement,
  plafonnement des couples, rentes AI (système linéaire) et rentes pour enfants, supplément de carrière, survivants.
- **2e pilier** : salaire coordonné, bonifications de vieillesse, projection de l'avoir, minimum légal en cas
  d'invalidité et de décès, surindemnisation. Les valeurs du certificat de prévoyance priment dès qu'elles sont saisies.
- **Assurance-accidents** : gain assuré plafonné, rente complémentaire coordonnée à 90 % avec l'AI ou l'AVS.
- **Maladie** : indemnités journalières, ou échelle bernoise à défaut.
- **3e pilier** : plafonds 3a avec et sans 2e pilier, capital à la retraite converti en rente, capitaux au décès.
- **Impôts** : impôt sur le revenu, taux marginal et impôt sur les prestations en capital, pour le chef-lieu de
  chaque canton (personne seule, couple marié, sans enfant ou avec un à trois enfants à charge), interpolés sur les
  grilles relevées, puis ramenés à la commune du client et à sa confession (facteur de chaque commune de Suisse et
  impôt d'Église, contrôlés contre le calculateur officiel).
- **Scénarios** : âge de départ, rente ou capital, échelonnements, simulation de placement, charge hypothécaire,
  plan de mesures et comparaison avant / après, événements de vie (`moteur/src/evenements.js`).
- **Couverture sur la durée** : le score et chaque risque comptent une lacune qui n'apparaît que plus tard (rentes
  d'enfants qui s'éteignent), en plus de la couverture d'aujourd'hui (`couvertureDuree`, `couvertureMin`).
- **Libre passage** : l'avoir d'une personne qui n'est plus affiliée (indépendant, sans activité) porte intérêt jusqu'à
  la retraite, puis compte comme un capital consommé, après l'impôt sur son retrait ; il revient aux proches au décès.

## Mettre les données à jour

```bash
python outils/donnees/maj_impots.py 2027        # relève les impôts des 26 cantons (une vingtaine de minutes)
python outils/donnees/maj_communes.py 2027      # puis les communes et l'impôt d'Église (une quinzaine de minutes)
```

Puis ajouter le fichier à `moteur/manifeste.json` et en augmenter la version. Les applications déjà installées
proposent la mise à jour dans la vue « Données ». Les règles d'une nouvelle année s'ajoutent de la même façon
(`moteur/regles/ch-AAAA.json`, avec ses sources).

## Vérifier

```bash
python -m http.server 8790                       # depuis la racine du dépôt
```

- Moteur : ouvrir `http://localhost:8790/moteur/tests/index.html`, ou `node moteur/tests/run.mjs` (259 cas).
- Interface : ouvrir `http://localhost:8790/web/essais.html`, ou `python outils/essais.py` (67 essais : parcours, quatre langues complètes, largeur de téléphone,
  pages légales du rapport, chiffrement, peau du navigateur, agenda des échéances, segments du portefeuille, terrain et relief).
- App iPhone / iPad, moitié « page » : `web/src/autotest.js` (celui que l'app exécute dans le simulateur) se rejoue hors
  de l'app avec `outils/pilote.py`, la page chargée comme l'app la charge (classe `natif`, ponts présents).
- À l'œil : `outils/pilote.py` pilote Edge sans fenêtre (largeur d'un vrai téléphone, clair ou sombre, mouvement
  réduit, défilement, captures, erreurs de la console) ; `outils/cadre.html` montre une page dans un cadre de la
  taille voulue.
- Vitesse : une analyse complète prend environ 0,06 ms sur un PC de bureau (mesure dans un navigateur ouvert).

## Limites connues

Le moteur donne un ordre de grandeur fiable pour un entretien de conseil, pas un calcul de rente opposable.
Le revenu annuel moyen déterminant est estimé quand l'extrait de compte individuel manque ; les prestations du
2e pilier sont au minimum légal quand le certificat manque ; l'impôt sur le revenu est ramené à la commune
par un facteur mesuré à 100 000 de revenu (l'écart avec le calculateur officiel est affiché dans la vue « Données ») ;
l'impôt sur les prestations en capital suit la même méthode, avec un écart mesuré jusqu'à 4 %. Les primes des assurances de risque ne sont pas estimées par l'application : elles dépendent de
l'âge, de la santé et de l'assureur. Le conseiller saisit celles des offres reçues, et le budget du plan les intègre.
Les textes allemands, italiens et anglais sont complets mais n'ont pas été relus par une personne de langue maternelle.
Chaque valeur estimée est signalée comme telle dans le résultat.
