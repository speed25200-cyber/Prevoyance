# Prévoyance

Analyse des lacunes de prévoyance pour le marché suisse : retraite, invalidité, décès, sur les trois piliers.
Un outil de conseiller, pensé pour le rendez-vous client : on saisit la situation, on montre les lacunes à l'écran,
on construit le plan avec le client, on lui remet un rapport PDF.

- **Public** : conseillers et courtiers, face au client. Particuliers, salariés, indépendants, couples.
- **Plateformes** : application web installable (iPad, iPhone, ordinateur ; fonctionne hors ligne), puis application native.
- **Langues** : français, allemand, italien, anglais.

> Aucune donnée de client réelle ne doit entrer dans ce dépôt : il est public. Les exemples sont fictifs.
> Les dossiers saisis dans l'application restent dans le navigateur de l'appareil.

## Ce que fait l'application

| Vue | Contenu |
|---|---|
| **Analyse** | Couverture globale, les cinq risques (retraite, invalidité maladie / accident, décès maladie / accident), ce que verse chaque pilier, la « ligne de vie » du revenu année par année, le détail des sources, les leviers et les points d'attention. Le repère de la retraite se déplace à la main sur le graphique. |
| **Scénarios** | Âge de départ de 60 à 70 ans ; rente ou capital après impôts, avec seuil de rentabilité ; retraits et rachats échelonnés ; simulation du placement du 3a (2000 trajectoires) ; tenue de l'hypothèque à la retraite. |
| **Plan** | Les mesures proposées par le moteur (rente d'incapacité, capital décès, perte de gain, 3a, rachat, épargne), réglables, avec l'effet avant / après sur chaque lacune et l'économie d'impôt. |
| **Rapport** | Le document du client, en pages A4 : couverture, synthèse, retraite, invalidité, décès, plan, hypothèses et sources. « Enregistrer en PDF » par l'impression du navigateur. |
| **Données** | Les montants officiels appliqués (2026 et 2027), les valeurs encore à confirmer, les impôts des 26 cantons avec la date du relevé, les sources, et la vérification des mises à jour. |

S'y ajoutent : un portefeuille de dossiers (créer, dupliquer, exporter, importer), l'analyse de chacun des deux
membres d'un couple, un mode présentation plein écran, le clair et le sombre selon l'appareil.

## Structure

| Dossier | Contenu |
|---|---|
| `moteur/` | Le moteur de calcul, en JavaScript pur, sans dépendance. Une seule source de vérité pour le web et pour iOS (JavaScriptCore). |
| `moteur/regles/` | Les règles suisses d'une année sous forme de données (`ch-2026.json`, `ch-2027.json`), avec leurs sources. |
| `moteur/donnees/` | Les impôts par canton, relevés auprès du calculateur de l'Administration fédérale des contributions. |
| `moteur/manifeste.json` | La version des données : l'application la compare à celle du dépôt pour se mettre à jour. |
| `moteur/tests/` | Les cas de test du moteur : chaque valeur attendue est calculée à la main d'après les textes et montants officiels. |
| `web/` | L'application : `index.html`, `src/` (vues, graphiques, textes), `essais.html` (essais de l'interface). |
| `outils/` | Relevé des impôts (`donnees/maj_impots.py`), essais et captures en arrière-plan (`essais.ps1`, `capture.ps1`). |

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
  chaque canton (personne seule, couple marié), interpolés sur les grilles relevées.
- **Scénarios** : âge de départ, rente ou capital, échelonnements, simulation de placement, charge hypothécaire,
  plan de mesures et comparaison avant / après.

## Mettre les données à jour

```bash
python outils/donnees/maj_impots.py 2027        # relève les impôts des 26 cantons (quelques minutes)
```

Puis ajouter le fichier à `moteur/manifeste.json` et en augmenter la version. Les applications déjà installées
proposent la mise à jour dans la vue « Données ». Les règles d'une nouvelle année s'ajoutent de la même façon
(`moteur/regles/ch-AAAA.json`, avec ses sources).

## Vérifier

```bash
python -m http.server 8790                       # depuis la racine du dépôt
```

- Moteur : ouvrir `http://localhost:8790/moteur/tests/index.html`, ou `node moteur/tests/run.mjs` (109 cas).
- Interface : ouvrir `http://localhost:8790/web/essais.html`, ou `powershell -File outils\essais.ps1` (14 essais).

## Limites connues

Le moteur donne un ordre de grandeur fiable pour un entretien de conseil, pas un calcul de rente opposable.
Le revenu annuel moyen déterminant est estimé quand l'extrait de compte individuel manque ; les prestations du
2e pilier sont au minimum légal quand le certificat manque ; les impôts sont ceux du chef-lieu du canton, sans
confession ni enfants. Les primes des assurances de risque ne sont pas chiffrées : elles dépendent d'une offre.
Chaque valeur estimée est signalée comme telle dans le résultat.
