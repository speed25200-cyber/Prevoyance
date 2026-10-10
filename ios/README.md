# Prévoyance — application iPad et iPhone

L'app native embarque les dossiers `web/` et `moteur/` du dépôt : un seul moteur de calcul, les mêmes écrans,
les mêmes règles et les mêmes données que la version web. Elle fonctionne sans connexion ; seule la vérification
des mises à jour des données (vue « Données ») va sur Internet.

| Fichier | Rôle |
|---|---|
| `project.yml` | Le projet Xcode, généré par XcodeGen. Le `.xcodeproj` n'est pas versionné. |
| `Prevoyance/PrevoyanceApp.swift` | Le point d'entrée. |
| `Prevoyance/Ecran.swift` | La vue web plein écran, le service des fichiers embarqués (schéma `prevoyance://`), l'impression native du rapport. |
| `Prevoyance/Scan.swift` | Le scan d'un certificat de prévoyance : scanner de documents d'iOS, reconnaissance de texte (Vision), puis modèle de langage de l'appareil (Apple Intelligence, iOS 26) quand il existe. Tout reste sur l'appareil. |
| `Prevoyance/Assets.xcassets` | L'icône et la couleur de lancement (clair et sombre). |
| `../codemagic.yaml` | La construction : contrôle sans signature, puis TestFlight. |

Ce que l'app ajoute à la version web : l'icône sur l'écran d'accueil sans passer par Safari, le plein écran,
120 Hz sur iPhone Pro (`CADisableMinimumFrameDurationOnPhone`), et « Enregistrer en PDF » par la feuille
d'impression d'iOS (AirPrint, partage, Fichiers).

**Octobre 2026 — portefeuille et partage.** L'accueil montre, sous chaque dossier, ce qu'il reste à faire en premier
(envoyé par la page : `reste`, `urgent`), le bilan du portefeuille dès deux dossiers, et deux exports : les échéances
de tous les dossiers pour l'agenda (`.ics`) et le portefeuille en tableau (`.csv`). Un nouveau pont, `partager`
(`Ecran.swift`), ouvre la feuille de partage d'iOS pour un texte ou un fichier préparé par la page ; la demande
d'offre et la feuille de route s'en servent. Un agenda `.ics` part vers Fichiers ou Mail ; son ajout au calendrier
depuis là reste à confirmer sur un appareil. La nouvelle peau du navigateur (`web/carte.css`) ne s'applique pas à
l'app : ses sélecteurs excluent la classe `natif`.

Ces ajouts Swift ont été écrits sans compilateur (PC sans Xcode), en reprenant les tournures déjà présentes dans les
mêmes fichiers. Ce qui a été vérifié : la moitié « page », en rejouant `web/src/autotest.js` hors de l'app (page
chargée avec la classe `natif` et les cinq ponts, tailles iPhone et iPad : 37 contrôles sur 37), et les messages que
l'app recevrait. Ce qui reste à vérifier par le premier passage de Codemagic : la compilation, puis l'autotest dans
les simulateurs (il contrôle désormais la présence du pont `partager`).

## Construire sur un Mac

```bash
brew install xcodegen
cd ios && xcodegen generate && open Prevoyance.xcodeproj
```

## État

**Le projet n'a pas encore été compilé** : il a été écrit sur un PC sans Xcode. Le premier passage du workflow
`ios-controle` dira s'il reste une erreur à corriger.

Avant TestFlight, trois choses sont à faire par le titulaire du compte Apple (elles ne peuvent pas l'être d'ici) :

1. créer l'identifiant d'app (aucune capacité à cocher) et la fiche
   dans App Store Connect, et reporter cet identifiant dans `project.yml` et `codemagic.yaml` (aujourd'hui
   `ch.prevoyance.app`, provisoire) ;
2. ajouter ce dépôt comme application dans Codemagic ;
3. y renseigner la variable `APP_STORE_APPLE_ID` (le numéro de la fiche).
