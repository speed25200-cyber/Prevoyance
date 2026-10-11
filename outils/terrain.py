"""Le terrain du relief : un vrai sommet suisse et son massif, d'après les données officielles de swisstopo.

Sources (Office fédéral de topographie swisstopo, données ouvertes — usage libre avec mention de la source) :
- swissALTI3D, le modèle de terrain (grille de 2 m) : les altitudes ;
- SWISSIMAGE, la photographie aérienne (ici à 2 m par point) : la roche, les glaciers, la neige.
Le site n'embarque pas ces données : seulement un carré de 8 km autour du sommet, réduit — une carte d'altitudes et
une photographie, chacune en deux finesses (ordinateur, téléphone) — fabriqué ici. Ces images sont déformées comme le
maillage du relief : plus fines au centre (le sommet) qu'au bord.

Deux étapes :

    python outils/terrain.py telecharger C:/Prevoyance-donnees/weisshorn
        demande au catalogue de swisstopo les tuiles de 1 km autour du sommet et les télécharge : 81 fichiers
        d'altitudes (environ 1 Mo chacun) et 81 de photographie (environ 0,15 Mo). Le dossier reste hors du dépôt.

    python -I outils/terrain.py cuire C:/Prevoyance-donnees/weisshorn web/images/terrain
        assemble les tuiles, découpe le carré centré sur le sommet et écrit :
        weisshorn.png, weisshorn-leger.png          l'altitude sur 16 bits (octet fort dans le rouge, octet faible dans
                                                    le vert), 0 à la mer de brouillard, 65535 au sommet ; 1024 et 512 points
        weisshorn-photo.webp, …-photo-leger.webp    la photographie aérienne du même carré ; 2048 et 1024 points

Demande Pillow et numpy.
"""
import json
import sys
import urllib.request
from pathlib import Path

# Le Weisshorn (4506 m, Valais) : une pyramide à trois arêtes, entièrement en Suisse.
SOMMET = {"nom": "weisshorn", "est": range(2617, 2626), "nord": range(1101, 1110), "boite": "7.6585,46.0603,7.7750,46.1412"}
CATALOGUE = "https://data.geo.admin.ch/api/stac/v0.9/collections/{}/items"
# (jeu de données, fin du nom de fichier voulu, sous-dossier)
JEUX = {"altitudes": ("ch.swisstopo.swissalti3d", "_2_2056_5728.tif", ""), "photo": ("ch.swisstopo.swissimage-dop10", "_2_2056.tif", "photo")}
MAILLE = 2            # mètres par point, dans les tuiles (altitudes comme photographie)
METRES = 8000         # côté du carré de terrain : le sommet, son massif (Bishorn, Schalihorn, glaciers) et les vallées autour
BASE = 1750           # altitude (m) du niveau 0 : la mer de brouillard, qui remplit le Mattertal et le val de Zinal
# Avec un demi-côté de 1,3 unité de scène (ETENDUE, dans relief.js) pour 4 km et une unité de hauteur pour sommet − base,
# la hauteur est forcée d'un dixième environ, comme sur toute maquette de relief.


def telecharger(dossier: Path) -> None:
    voulues = [f"{e}-{n}" for e in SOMMET["est"] for n in SOMMET["nord"]]
    for nom, (jeu, fin, sous_dossier) in JEUX.items():
        cible_dossier = dossier / sous_dossier
        cible_dossier.mkdir(parents=True, exist_ok=True)
        elements, adresse = [], f"{CATALOGUE.format(jeu)}?bbox={SOMMET['boite']}&limit=100"
        while adresse:                                # le catalogue répond par pages de cent
            if not adresse.startswith("https://data.geo.admin.ch/"):
                raise SystemExit(f"adresse inattendue : {adresse}")
            with urllib.request.urlopen(adresse, timeout=60) as reponse:
                page = json.load(reponse)
            elements += page["features"]
            adresse = next((lien["href"] for lien in page.get("links", []) if lien.get("rel") == "next"), None)
        # une tuile existe pour plusieurs années de relevé : on garde la plus récente
        tuiles: dict[str, tuple[str, str]] = {}
        for element in elements:
            cle = element["id"].split("_")[-1]
            for fichier_nom, fichier in element["assets"].items():
                if fichier_nom.endswith(fin) and (cle not in tuiles or element["id"] > tuiles[cle][0]):
                    tuiles[cle] = (element["id"], fichier["href"])
        total = 0
        for cle in voulues:
            if cle not in tuiles:
                raise SystemExit(f"{nom} : tuile {cle} absente du catalogue")
            adresse = tuiles[cle][1]
            if not adresse.startswith("https://data.geo.admin.ch/"):
                raise SystemExit(f"adresse inattendue : {adresse}")
            cible = cible_dossier / f"{cle}.tif"
            if not cible.exists():
                with urllib.request.urlopen(adresse, timeout=120) as reponse:
                    cible.write_bytes(reponse.read())
            total += cible.stat().st_size
        print(f"{nom} : {len(voulues)} tuiles dans {cible_dossier} ({total / 1e6:.1f} Mo)")


def cuire(dossier: Path, sortie: Path) -> None:
    import numpy as np
    from PIL import Image

    points = 1000 // MAILLE
    est, nord = list(SOMMET["est"]), list(SOMMET["nord"])

    def mosaique(sous_dossier: str, canaux: int):
        forme = (len(nord) * points, len(est) * points) + ((canaux,) if canaux > 1 else ())
        tout = np.zeros(forme, dtype=np.float32)
        for i, e in enumerate(est):
            for j, n in enumerate(nord):
                image = Image.open(dossier / sous_dossier / f"{e}-{n}.tif")
                tuile = np.asarray(image.convert("RGB") if canaux > 1 else image, dtype=np.float32)
                if tuile.shape[:2] != (points, points):
                    raise SystemExit(f"tuile {sous_dossier}/{e}-{n} : {tuile.shape}, attendu {points} x {points}")
                ligne = (len(nord) - 1 - j) * points      # la première ligne d'une tuile est au nord
                tout[ligne:ligne + points, i * points:(i + 1) * points] = tuile
        return tout

    altitudes = mosaique("", 1)
    altitudes[altitudes < 0] = 0                      # hors relevé
    ligne, colonne = np.unravel_index(int(np.argmax(altitudes)), altitudes.shape)
    sommet = float(altitudes[ligne, colonne])
    base = BASE
    print(f"sommet : {sommet:.1f} m, à E {est[0] * 1000 + colonne * MAILLE}, N {(nord[-1] + 1) * 1000 - ligne * MAILLE} ; "
          f"carré de {METRES} m, base à {base} m, hauteur forcée de {(METRES / 2.6) / (sommet - base):.2f}")

    def decouper(source, cote: int):
        """Le carré de terrain (centré sur le sommet, x vers l'est, z vers le sud), réduit à `cote` points de côté.
        Les points ne sont pas à pas constant : ils suivent la déformation du maillage du relief (0,5 u + 0,5 u³),
        deux fois plus serrés au centre qu'en moyenne, deux fois plus lâches au bord."""
        u = np.linspace(-1, 1, cote)
        place = (0.5 * u + 0.5 * u ** 3) * METRES / 2
        x, z = np.meshgrid(place, place)
        c, l = colonne + x / MAILLE, ligne + z / MAILLE
        if c.min() < 0 or l.min() < 0 or c.max() > source.shape[1] - 1 or l.max() > source.shape[0] - 1:
            raise SystemExit("le carré sort des tuiles : réduire METRES")
        c0, l0 = np.minimum(np.floor(c).astype(int), source.shape[1] - 2), np.minimum(np.floor(l).astype(int), source.shape[0] - 2)
        fc, fl = (c - c0).astype(np.float32), (l - l0).astype(np.float32)
        # l'empreinte d'un point change du centre au bord : on prépare la source à plusieurs flous (une moyenne sur un
        # carré de 2 r + 1 points) et chaque point prend, entre deux flous voisins, celui qui vaut son empreinte
        pas = np.gradient(place) / MAILLE
        empreinte = np.maximum(*np.meshgrid(pas, pas)) / 2
        rayons = [0, 1, 2, 4, 8]

        def lire(plan, rayon):
            if rayon:
                cumul = np.cumsum(np.cumsum(np.pad(plan.astype(np.float64), rayon + 1, mode="edge"), axis=0), axis=1)   # en double précision : les sommes sont grandes
                k = 2 * rayon + 1
                plan = ((cumul[k:, k:] - cumul[:-k, k:] - cumul[k:, :-k] + cumul[:-k, :-k]) / k ** 2)[:plan.shape[0], :plan.shape[1]].astype(np.float32)
            return (plan[l0, c0] * (1 - fc) + plan[l0, c0 + 1] * fc) * (1 - fl) + (plan[l0 + 1, c0] * (1 - fc) + plan[l0 + 1, c0 + 1] * fc) * fl

        def plan_reduit(plan):
            resultat = np.zeros((cote, cote), dtype=np.float32)
            for bas, haut in zip(rayons, rayons[1:]):
                dans = (empreinte >= bas) & ((empreinte < haut) | (haut == rayons[-1]))
                if dans.any():
                    part = np.clip((empreinte - bas) / (haut - bas), 0, 1)
                    resultat[dans] = (lire(plan, bas) * (1 - part) + lire(plan, haut) * part)[dans]
            return resultat

        return plan_reduit(source) if source.ndim == 2 else np.stack([plan_reduit(source[..., k]) for k in range(source.shape[2])], axis=-1)

    sortie.mkdir(parents=True, exist_ok=True)
    nom = SOMMET["nom"]
    for cote, suffixe in ((1024, ""), (512, "-leger")):
        # le terrain tel qu'il est, au-dessus de la mer de brouillard : c'est le relief (relief.js) qui l'efface au bord du carré
        altitude = decouper(altitudes, cote)
        h = np.clip((altitude - base) / (float(altitude.max()) - base), 0, 1)
        entier = np.round(h * 65535).astype(np.uint16)
        image = np.zeros((cote, cote, 3), dtype=np.uint8)
        image[..., 0], image[..., 1] = entier >> 8, entier & 255
        fichier = sortie / f"{nom}{suffixe}.png"
        Image.fromarray(image, "RGB").save(fichier, optimize=True)
        print(f"{fichier} : {cote} x {cote}, {fichier.stat().st_size / 1024:.0f} Ko, {METRES / (cote - 1) / 2:.1f} m par point au centre, sommet {altitude.max():.0f} m (après moyenne)")

    if (dossier / "photo").is_dir():
        photo = mosaique("photo", 3)
        for cote, suffixe in ((2048, ""), (1024, "-leger")):
            image = np.clip(np.round(decouper(photo, cote)), 0, 255).astype(np.uint8)
            fichier = sortie / f"{nom}-photo{suffixe}.webp"
            Image.fromarray(image, "RGB").save(fichier, quality=82, method=6)
            print(f"{fichier} : {cote} x {cote}, {fichier.stat().st_size / 1024:.0f} Ko, {METRES / (cote - 1) / 2:.1f} m par point au centre")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "telecharger":
        telecharger(Path(sys.argv[2]))
    elif len(sys.argv) >= 4 and sys.argv[1] == "cuire":
        cuire(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        raise SystemExit(__doc__)
