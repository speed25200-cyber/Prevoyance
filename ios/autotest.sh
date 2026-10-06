#!/bin/bash
# Autotest de l'app dans les simulateurs iPhone et iPad, avant tout envoi sur TestFlight.
#
# L'app est construite pour le simulateur, lancée avec PREVOYANCE_AUTOTEST=1 : elle exécute web/src/autotest.js dans sa
# vraie vue web (ponts vers l'app, chiffrement, six écrans, erreurs JavaScript) et écrit le résultat dans ses documents.
# Un seul échec arrête la construction : une app qui ne fonctionne pas ne part pas chez les testeurs.
# Les captures d'écran sont gardées dans build/captures (artefacts) ; une version réduite est écrite dans le journal.
# Le fichier « autotest-diagnostic » (s'il existe) fait échouer l'étape après l'affichage, pour relire le journal.
set -u
cd "$(dirname "$0")"
# aucune commande du simulateur ne doit pouvoir bloquer la construction : chacune a un délai
borne() { perl -e 'alarm shift; exec @ARGV' "$@"; }

echo "==== Construction pour le simulateur ===="
xcodebuild build -project Prevoyance.xcodeproj -scheme Prevoyance -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build/sim CODE_SIGNING_ALLOWED=NO -quiet || { echo "error: construction pour le simulateur impossible"; exit 1; }
APP=$(find build/sim/Build/Products -maxdepth 2 -name "Prevoyance.app" | head -1)
[ -d "$APP" ] || { echo "error: app du simulateur introuvable"; exit 1; }
mkdir -p build/captures
ECHECS=0

essayer() {   # $1 : nom affiché ; $2 : motif de l'appareil ; $3 : écran laissé pour la capture ; $4 : taille de la capture du journal
  local nom="$1" udid dossier fichier
  udid=$(xcrun simctl list devices available | grep -E "$2" | tail -1 | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}')
  if [ -z "$udid" ]; then echo "error: aucun simulateur pour $nom"; ECHECS=$((ECHECS + 1)); return; fi
  echo "==== $nom : $(xcrun simctl list devices available | grep "$udid" | sed 's/ (.*//' | xargs) ===="
  xcrun simctl boot "$udid" 2>/dev/null
  borne 300 xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1
  xcrun simctl ui "$udid" appearance dark 2>/dev/null
  borne 120 xcrun simctl install "$udid" "$APP"
  SIMCTL_CHILD_PREVOYANCE_AUTOTEST=1 SIMCTL_CHILD_PREVOYANCE_VUE="$3" borne 60 xcrun simctl launch "$udid" ch.prevoyance.app >/dev/null
  dossier=$(xcrun simctl get_app_container "$udid" ch.prevoyance.app data)
  fichier="$dossier/Documents/autotest.json"
  for _ in $(seq 1 60); do [ -f "$fichier" ] && break; sleep 2; done
  sleep 3
  borne 60 xcrun simctl io "$udid" screenshot "build/captures/$nom.png" >/dev/null 2>&1
  if [ -f "$fichier" ]; then
    python3 autotest.py "$fichier" "$nom" || ECHECS=$((ECHECS + 1))
  else
    echo "error: $nom — l'autotest n'a rien écrit en deux minutes (page non chargée ?)"; ECHECS=$((ECHECS + 1))
  fi
  if [ -f "build/captures/$nom.png" ]; then
    sips -Z "$4" -s format jpeg -s formatOptions 32 "build/captures/$nom.png" --out "/tmp/$nom.jpg" >/dev/null 2>&1
    echo "IMAGE-DEBUT $nom"; base64 -i "/tmp/$nom.jpg" | fold -w 380; echo "IMAGE-FIN $nom"
  fi
  xcrun simctl shutdown "$udid" 2>/dev/null
}

essayer iphone '^ +iPhone [0-9]+ Pro \(' "${AUTOTEST_VUE_IPHONE:-accueil}" 520
essayer ipad '^ +iPad Pro 11' "${AUTOTEST_VUE_IPAD:-analyse}" 500

if [ "$ECHECS" -gt 0 ]; then echo "error: autotest de l'app — $ECHECS appareil(s) en échec"; exit 1; fi
echo "==== Autotest réussi sur iPhone et iPad ===="
if [ -f autotest-diagnostic ]; then echo "error: arrêt voulu (fichier autotest-diagnostic) pour relire ce journal"; exit 1; fi
