# Lit le résultat de l'autotest écrit par l'app (ios/autotest.sh) : une ligne de bilan, le détail des échecs.
import json
import sys

chemin, appareil = sys.argv[1], sys.argv[2]
try:
    donnees = json.load(open(chemin, encoding='utf-8'))
except Exception as erreur:  # fichier illisible : c'est un échec
    print(f"error: {appareil} — résultat illisible ({erreur})")
    sys.exit(1)
page, app = donnees.get('page') or {}, donnees.get('app') or {}
resultats = page.get('resultats') or []
contexte = next((r.get('detail', '') for r in resultats if r.get('nom') == 'contexte'), '')
echecs = [r for r in resultats if not r.get('ok')]
# côté app : la barre native doit être affichée, avec ses six libellés
if not app.get('barre'):
    echecs.append({'nom': 'barre d’onglets native affichée', 'detail': str(app)})
if app.get('noms') != 6:
    echecs.append({'nom': 'six libellés reçus par la barre native', 'detail': str(app)})
print(f"BILAN {appareil} : {len(resultats) + 2 - len(echecs)} réussis, {len(echecs)} échecs — {contexte} — app {app}")
for r in echecs:
    print(f"error: {appareil} — {r.get('nom')} : {r.get('detail', '')}")
sys.exit(1 if echecs or not resultats else 0)
