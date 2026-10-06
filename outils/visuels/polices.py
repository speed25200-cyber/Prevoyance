"""Télécharge les polices de l'application (licence OFL, Google Fonts) dans web/polices/ et écrit polices.css.

Fraunces (titres et grands chiffres, variable 300-500) et Inter (texte, variable 400-600), sous-ensembles latin et
latin étendu. Les fichiers sont servis par l'application elle-même : aucun appel externe, fonctionne hors ligne.

Usage : python outils/visuels/polices.py
"""
import re
import urllib.request
from pathlib import Path

CIBLE = Path(__file__).resolve().parents[2] / 'web' / 'polices'
ADRESSE = ('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..500;1,9..144,300..500'
           '&family=Inter:opsz,wght@14..32,400..600&display=swap')
NAVIGATEUR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
GARDES = ('latin', 'latin-ext')


def lire(adresse: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(adresse, headers={'User-Agent': NAVIGATEUR}), timeout=40) as r:
        return r.read()


def main() -> None:
    CIBLE.mkdir(parents=True, exist_ok=True)
    feuille = lire(ADRESSE).decode('utf-8')
    blocs = re.findall(r'/\* ([a-z-]+) \*/\s*(@font-face \{.*?\})', feuille, re.S)
    sortie = ['/* Polices de l\'application : Fraunces et Inter, licence OFL. Générées par outils/visuels/polices.py. */']
    total = 0
    for sous_ensemble, bloc in blocs:
        if sous_ensemble not in GARDES:
            continue
        famille = re.search(r"font-family: '([^']+)'", bloc).group(1)
        style = re.search(r'font-style: (\w+)', bloc).group(1)
        source = re.search(r'url\((https://[^)]+\.woff2)\)', bloc).group(1)
        nom = f"{famille.lower().replace(' ', '-')}-{style}-{sous_ensemble}.woff2"
        donnees = lire(source)
        (CIBLE / nom).write_bytes(donnees)
        total += len(donnees)
        sortie.append(bloc.replace(source, nom))
        print(nom, len(donnees))
    (CIBLE / 'polices.css').write_text('\n'.join(sortie) + '\n', encoding='utf-8', newline='\n')
    print('total', total, 'octets')


main()
