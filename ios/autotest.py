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
if not app.get('dossiers') or not app.get('textes'):
    echecs.append({'nom': 'accueil : dossiers et libellés reçus de la page', 'detail': str(app)})
if (app.get('rubriques') or 0) < 7 or (app.get('champs') or 0) < 30:
    echecs.append({'nom': 'dossier natif : rubriques et champs reçus de la page', 'detail': str(app)})
if not app.get('analyse') or app.get('risques') != 5 or (app.get('ligne') or 0) < 10:
    echecs.append({'nom': 'analyse native : modèle reçu de la page', 'detail': str(app)})
for vue, minimum in (('scenarios', 4), ('plan', 3), ('rapport', 1), ('donnees', 3)):
    if ((app.get('ecrans') or {}).get(vue) or 0) < minimum:
        echecs.append({'nom': f'écran natif {vue} : cartes reçues de la page', 'detail': str(app.get('ecrans'))})
# fonctions de l'app elle-même : certificat photographié, signature, logo, PDF du rapport
natif = app.pop('natif', None) or []
if len(natif) < 5:
    echecs.append({'nom': 'essais des fonctions de l’app exécutés', 'detail': f'{len(natif)} sur 5'})
echecs += [r for r in natif if not r.get('ok')]
for r in natif:
    print(f"  {'✓' if r.get('ok') else '✗'} {r.get('nom')} — {r.get('detail', '')}")
print(f"BILAN {appareil} : {len(resultats) + 9 + len(natif) - len(echecs)} réussis, {len(echecs)} échecs — {contexte} — app {app}")
for r in echecs:
    print(f"error: {appareil} — {r.get('nom')} : {r.get('detail', '')}")
sys.exit(1 if echecs or not resultats else 0)
