# Prévoyance — application iPad et iPhone

L'app native embarque les dossiers `web/` et `moteur/` du dépôt : un seul moteur de calcul, les mêmes écrans,
les mêmes règles et les mêmes données que la version web. Elle fonctionne sans connexion ; seule la vérification
des mises à jour des données (vue « Données ») va sur Internet.

| Fichier | Rôle |
|---|---|
| `project.yml` | Le projet Xcode, généré par XcodeGen. Le `.xcodeproj` n'est pas versionné. |
| `Prevoyance/PrevoyanceApp.swift` | Le point d'entrée. |
| `Prevoyance/Ecran.swift` | La vue web plein écran, le service des fichiers embarqués (schéma `prevoyance://`), l'impression native du rapport. |
| `Prevoyance/Assets.xcassets` | L'icône et la couleur de lancement (clair et sombre). |
| `../codemagic.yaml` | La construction : contrôle sans signature, puis TestFlight. |

Ce que l'app ajoute à la version web : l'icône sur l'écran d'accueil sans passer par Safari, le plein écran,
120 Hz sur iPhone Pro (`CADisableMinimumFrameDurationOnPhone`), et « Enregistrer en PDF » par la feuille
d'impression d'iOS (AirPrint, partage, Fichiers).

## Construire sur un Mac

```bash
brew install xcodegen
cd ios && xcodegen generate && open Prevoyance.xcodeproj
```

## État

**Le projet n'a pas encore été compilé** : il a été écrit sur un PC sans Xcode. Le premier passage du workflow
`ios-controle` dira s'il reste une erreur à corriger.

Avant TestFlight, trois choses sont à faire par le titulaire du compte Apple (elles ne peuvent pas l'être d'ici) :

1. créer l'identifiant d'app et la fiche dans App Store Connect, et reporter cet identifiant dans `project.yml`
   et `codemagic.yaml` (aujourd'hui `ch.prevoyance.app`, provisoire) ;
2. ajouter ce dépôt comme application dans Codemagic ;
3. y renseigner la variable `APP_STORE_APPLE_ID` (le numéro de la fiche).

L'icône de 1024 px est un agrandissement de celle de 512 px : à refaire en pleine définition avant une publication.
