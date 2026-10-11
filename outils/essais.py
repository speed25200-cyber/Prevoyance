"""Lance les essais de l'interface (web/essais.html) dans Edge, sans fenêtre, et affiche leur bilan.

Le navigateur est piloté en temps réel (outils/pilote.py) : la page charge ses images et prépare le terrain du relief
comme chez un visiteur. Le serveur local doit tourner : python -m http.server 8790, depuis la racine du dépôt.

    python outils/essais.py                 les essais de l'interface
    python outils/essais.py <adresse>       une autre page d'essais (par exemple moteur/tests/index.html)

Code de sortie : 0 si tout passe, 1 sinon.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pilote import Navigateur  # noqa: E402

adresse = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8790/web/essais.html"
COMPTE = "document.querySelectorAll('li.ok, li.ko').length"
with Navigateur(1500, 1100, port=9388) as n:
    n.ouvrir(adresse, attente=3.0)
    debut, avant, stable = time.time(), -1, 0
    # la page ajoute une ligne par essai : c'est fini quand le compte ne bouge plus pendant six secondes
    while time.time() - debut < 300 and stable < 3:
        n.attendre(2.0)
        compte = n.js(COMPTE) or 0
        stable = stable + 1 if compte == avant and compte > 0 else 0
        avant = compte
    echecs = n.js("[...document.querySelectorAll('li.ko')].map(e => e.textContent.trim()).join('\\n')") or ""
    reussis = n.js("document.querySelectorAll('li.ok').length") or 0
    erreurs = [e for e in n.erreurs if "favicon" not in e]
    print(f"{n.js('document.title')} — {reussis} réussis, {len(echecs.splitlines())} échecs, en {round(time.time() - debut)} s")
    if echecs:
        print(echecs)
    if erreurs:
        print("erreurs de la console :", *erreurs[:8], sep="\n  ")
sys.exit(1 if echecs or not reussis else 0)
