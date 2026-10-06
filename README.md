# Prévoyance

Analyse des lacunes de prévoyance pour le marché suisse : retraite, invalidité, décès, sur les trois piliers.
Un outil de conseiller, pensé pour le rendez-vous client : on saisit la situation, on montre les lacunes à l'écran,
on remet un rapport.

- **Public** : conseillers et courtiers, face au client. Particuliers, salariés, indépendants.
- **Plateformes** : application web, puis application native iPad et iPhone (120 Hz).
- **Langues** : français, allemand, italien, anglais.

> Aucune donnée de client réelle ne doit entrer dans ce dépôt : il est public. Les exemples sont fictifs.

## Structure

| Dossier | Contenu |
|---|---|
| `moteur/` | Le moteur de calcul, en JavaScript pur, sans dépendance. Une seule source de vérité pour le web et pour iOS (JavaScriptCore). |
| `moteur/regles/` | Les règles suisses d'une année sous forme de données (`ch-2026.json`, `ch-2027.json`), avec leurs sources. |
| `moteur/tests/` | Les cas de test : chaque valeur attendue est calculée à la main d'après les textes et montants officiels. |
| `web/` | L'application web (à venir). |
| `ios/` | L'application iPad et iPhone (à venir). |

## Le moteur

```js
import { analyser, regles } from './moteur/src/index.js';

const resultat = analyser({
  etatCivil: 'marie',
  personne: { dateNaissance: '1986-01-01', sexe: 'h', statut: 'salarie', revenu: 90000, lpp: { avoir: 100000 } },
  conjoint: { dateNaissance: '1988-05-12', sexe: 'f', statut: 'salarie', revenu: 60000 },
  enfants: [{ dateNaissance: '2019-09-03' }],
}, await regles(2026));
```

Pour chaque risque (`retraite`, `invaliditeMaladie`, `invaliditeAccident`, `decesMaladie`, `decesAccident`), le
résultat donne le besoin, les prestations par source et par pilier, la lacune annuelle et mensuelle, le taux de
couverture et le capital qui comblerait la lacune. S'y ajoutent les potentiels (pilier 3a, rachat LPP, années AVS
manquantes), les alertes (concubinage, indépendant sans 2e pilier, écart maladie / accident…), un score de
couverture et une chronologie des revenus année par année.

Le moteur ne produit aucun texte : il renvoie des codes, que chaque interface traduit dans les quatre langues.

### Ce qui est modélisé

- **1er pilier** : rente AVS selon le revenu annuel moyen déterminant et l'échelle de rente (formule légale de
  l'échelle 44), 13e rente, âge de référence et génération transitoire des femmes, anticipation et ajournement,
  plafonnement des couples, rentes AI (système linéaire) et rentes pour enfants, supplément de carrière, rentes de
  survivants.
- **2e pilier** : salaire coordonné, bonifications de vieillesse, projection de l'avoir, minimum légal en cas
  d'invalidité et de décès. Les valeurs du certificat de prévoyance priment dès qu'elles sont saisies.
- **Assurance-accidents** : gain assuré plafonné, rente complémentaire coordonnée à 90 % avec l'AI ou l'AVS.
- **Maladie** : indemnités journalières, ou échelle bernoise à défaut.
- **3e pilier** : plafonds 3a avec et sans 2e pilier, capital à la retraite converti en rente.

### Tests

Ouvrir `moteur/tests/index.html` depuis un serveur local, ou :

```bash
node moteur/tests/run.mjs
```

## Limites connues

Le moteur donne un ordre de grandeur fiable pour un entretien de conseil, pas un calcul de rente opposable.
Le revenu annuel moyen déterminant est estimé quand l'extrait de compte individuel manque ; les prestations du
2e pilier sont au minimum légal quand le certificat manque ; le taux marginal d'impôt est une estimation moyenne.
Chaque valeur estimée est signalée comme telle dans le résultat.
