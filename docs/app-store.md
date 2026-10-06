# Fiche App Store — textes prêts à coller

À saisir dans App Store Connect par le titulaire du compte. Les champs entre crochets sont à compléter.

## Identité

| Champ | Valeur |
|---|---|
| Nom | Prévoyance — lacunes 3 piliers |
| Sous-titre (30 car.) | Analyse de prévoyance suisse |
| Catégorie principale | Finance |
| Catégorie secondaire | Économie et entreprise |
| Âge | 4+ |
| Prix | [gratuit pendant les essais ; à décider] |
| URL de confidentialité | https://github.com/speed25200-cyber/Prevoyance/blob/main/docs/confidentialite.md (après fusion dans `main`), ou la page du site de l'éditeur |
| URL d'assistance | [site ou adresse de l'éditeur] |
| Copyright | © 2026 [éditeur] |

## Texte promotionnel (170 caractères)

Retraite, invalidité, décès : les lacunes des trois piliers chiffrées en quelques minutes, face au client. Rapport PDF, procès-verbal signé, tout reste sur l'appareil.

## Description (français)

Prévoyance est l'outil du conseiller en assurance et du courtier suisses pour le rendez-vous client.

On saisit la situation du ménage, on scanne le certificat de la caisse de pension, et l'analyse se construit à l'écran :

• Les cinq risques — retraite, invalidité (maladie et accident), décès (maladie et accident) — avec, pour chacun, le besoin, ce que versent le 1er, le 2e et le 3e pilier, la lacune et le capital qui la comblerait.
• Les règles suisses de l'année : AVS/AI (13e rente, AVS 21, anticipation et ajournement), LPP, LAA, pilier 3a, avec leurs sources légales. Les montants 2026 et 2027 sont intégrés.
• Les impôts relevés auprès du calculateur de l'Administration fédérale des contributions : 26 cantons, plus de 2000 communes, enfants à charge, couples à un ou deux salaires, impôt d'Église, retraits en capital.
• Des scénarios : âge de départ de 60 à 70 ans, rente ou capital après impôts, retraits et rachats échelonnés, retrait pour le logement, placement du 3a, hypothèque à la retraite.
• Un plan de mesures réglable et un conseil rédigé, avec l'effet avant / après sur chaque lacune.
• Un rapport PDF à votre logo, la fiche d'information de l'intermédiaire (LSA art. 45) et le procès-verbal de conseil, signé à l'écran par le client et le conseiller.

Confidentialité : aucune donnée ne quitte l'appareil. Pas de compte, pas de serveur, pas de traceur. Un code d'accès chiffre les dossiers (AES 256).

Français, allemand, italien, anglais. iPhone et iPad.

L'application chiffre des lacunes à partir des règles légales et des valeurs saisies ; les montants des caisses font foi. Elle ne remplace ni un conseil fiscal ni les documents de l'assureur.

## Mots-clés (100 caractères)

prévoyance,lacune,3 piliers,AVS,LPP,3a,courtier,assurance,retraite,invalidité,Vorsorge,BVG

## Confidentialité de l'app (questionnaire Apple)

- Collectez-vous des données ? **Non** (« Data Not Collected »).
- Suivi (tracking) : **Non**.
- Chiffrement (export compliance) : l'app utilise uniquement le chiffrement standard du système (AES, PBKDF2 via CryptoKit / CommonCrypto) → répondre que l'app utilise un chiffrement **exempté** (algorithmes standard, pas de chiffrement propriétaire).

## Notes pour la vérification Apple

L'app s'ouvre sur un dossier d'exemple fictif (« Famille Rochat ») : aucun identifiant n'est nécessaire. Le scan de certificat demande l'appareil photo ; « Choisir un PDF ou un fichier » et « Choisir une photo » permettent de le tester sans appareil photo.

## Captures d'écran

Les captures de l'autotest (iPhone et iPad) sont produites à chaque construction : artefacts Codemagic, `ios/build/captures/*.png`.
