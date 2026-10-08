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

# Accès privé (site d'essai) : avec « --acces <fichier du code> », la racine devient une page de connexion et les
# deux pages vérifient le passage. C'est une porte simple côté navigateur, pas une protection de serveur.
if "--acces" in sys.argv:
    code = Path(sys.argv[sys.argv.index("--acces") + 1]).read_text(encoding="utf-8").strip()

    def empreinte(texte: str) -> str:
        h = 0x811C9DC5
        for octet in texte.encode("utf-8"):
            h = ((h ^ octet) * 0x01000193) & 0xFFFFFFFF
        return f"{h:08x}"

    sel = "prevoyance-essai"
    marque = empreinte(sel + code.upper()) + empreinte(code.upper() + sel)
    modele = (racine / "outils" / "acces.html").read_text(encoding="utf-8")
    (sortie / "index.html").write_text(modele.replace("__EMPREINTE__", marque).replace("__SEL__", sel), encoding="utf-8")
    (sortie / "web" / "garde.js").write_text(
        f"try {{ if (sessionStorage.getItem('prevoyance.acces') !== '{marque}') location.replace('../index.html'); }}"
        " catch (e) { location.replace('../index.html'); }\n", encoding="utf-8")
    for page in ("bienvenue.html", "index.html"):
        p = sortie / "web" / page
        p.write_text(p.read_text(encoding="utf-8").replace("<head>", '<head>\n<script src="garde.js"></script>', 1), encoding="utf-8")
    (sortie / ".htaccess").write_text('Header set X-Robots-Tag "noindex, nofollow"\nOptions -Indexes\n', encoding="utf-8")

fichiers = [f for f in sortie.rglob("*") if f.is_file()]
print(f"{sortie} : {len(fichiers)} fichiers, {sum(f.stat().st_size for f in fichiers) / 1e6:.1f} Mo")
