"""Prépare la copie à mettre en ligne : uniquement ce que le navigateur charge (page d'entrée, application, moteur,
règles et données). Rien d'autre du dépôt n'est exposé (ni outils, ni essais, ni fichiers de travail).

    python outils/en-ligne.py [dossier de sortie]      (défaut : ../Prevoyance-en-ligne)
"""
import shutil
import sys
from pathlib import Path

racine = Path(__file__).resolve().parent.parent
sortie = Path(sys.argv[1]) if len(sys.argv) > 1 else racine.parent / "Prevoyance-en-ligne"
# copie par-dessus l'existant : le dossier peut être servi pendant la mise à jour
sortie.mkdir(parents=True, exist_ok=True)
shutil.copytree(racine / "web", sortie / "web", ignore=shutil.ignore_patterns("essais.html", "autotest.js"), dirs_exist_ok=True)
moteur = sortie / "moteur"
moteur.mkdir(exist_ok=True)
shutil.copytree(racine / "moteur" / "src", moteur / "src", dirs_exist_ok=True)
for nom in ("regles", "donnees"):
    shutil.copytree(racine / "moteur" / nom, moteur / nom, dirs_exist_ok=True)
shutil.copy2(racine / "moteur" / "manifeste.json", moteur / "manifeste.json")

(sortie / "index.html").write_text(
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
    '<meta http-equiv="refresh" content="0; url=web/bienvenue.html"><title>Prévoyance</title>'
    '<link rel="canonical" href="web/bienvenue.html"></head>'
    '<body><a href="web/bienvenue.html">Prévoyance</a></body></html>\n', encoding="utf-8")
(sortie / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")

fichiers = [f for f in sortie.rglob("*") if f.is_file()]
print(f"{sortie} : {len(fichiers)} fichiers, {sum(f.stat().st_size for f in fichiers) / 1e6:.1f} Mo")
