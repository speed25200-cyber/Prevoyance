"""Pilote Edge sans fenêtre par son protocole de débogage, pour contrôler l'interface comme un visiteur : vraie
largeur de téléphone, thème clair ou sombre, mouvement réduit, défilement, pointeur, attente en temps réel, captures,
erreurs de la console. Bibliothèque standard de Python, plus Pillow pour les images. Le relief (WebGL) est rendu par
le processeur : ce qu'on voit est fidèle, la fluidité ne l'est pas.

    from pilote import Navigateur
    with Navigateur(1440, 900, sombre=True) as n:
        n.ouvrir("http://localhost:8790/web/bienvenue.html")
        n.attendre(3)
        n.capture("accueil")
        print(n.js("document.title"), n.erreurs)
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import time
import urllib.request
from pathlib import Path

from PIL import Image

EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
if not EDGE.exists():
    EDGE = Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe")
DOSSIER = Path(__file__).resolve().parent / "tmp-capture"


class Navigateur:
    def __init__(self, largeur=1440, hauteur=900, sombre=False, mobile=False, calme=False, port=9377):
        self.largeur, self.hauteur, self.sombre, self.mobile, self.calme, self.port = largeur, hauteur, sombre, mobile, calme, port
        self.numero, self.erreurs, self.tampon = 0, [], b""

    def __enter__(self):
        DOSSIER.mkdir(exist_ok=True)
        self.profil = DOSSIER / f"profil-cdp-{self.port}"
        shutil.rmtree(self.profil, ignore_errors=True)
        self.processus = subprocess.Popen(
            [str(EDGE), "--headless=new", "--no-first-run", "--hide-scrollbars", f"--user-data-dir={self.profil}", f"--remote-debugging-port={self.port}",
             "--remote-allow-origins=*", "--enable-unsafe-swiftshader", f"--window-size={max(self.largeur, 500)},{self.hauteur}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(80):
            try:
                pages = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json/list", timeout=1).read())
                cible = next(p for p in pages if p.get("type") == "page")
                break
            except Exception:
                time.sleep(0.25)
        else:
            raise RuntimeError("Edge ne répond pas")
        adresse = cible["webSocketDebuggerUrl"]
        chemin = adresse.split(f":{self.port}", 1)[1]
        self.prise = socket.create_connection(("127.0.0.1", self.port), timeout=60)
        cle = base64.b64encode(os.urandom(16)).decode()
        self.prise.sendall((f"GET {chemin} HTTP/1.1\r\nHost: 127.0.0.1:{self.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                            f"Sec-WebSocket-Key: {cle}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        entete = b""
        while b"\r\n\r\n" not in entete:
            entete += self.prise.recv(4096)
        self.tampon = entete.split(b"\r\n\r\n", 1)[1]
        for domaine in ("Page", "Runtime", "Log"):
            self.commande(f"{domaine}.enable")
        self.commande("Emulation.setDeviceMetricsOverride", width=self.largeur, height=self.hauteur, deviceScaleFactor=1, mobile=self.mobile)
        traits = [{"name": "prefers-color-scheme", "value": "dark" if self.sombre else "light"}, {"name": "prefers-reduced-motion", "value": "reduce" if self.calme else "no-preference"}]
        self.commande("Emulation.setEmulatedMedia", features=traits)
        if self.mobile:
            self.commande("Emulation.setTouchEmulationEnabled", enabled=True)
        return self

    def __exit__(self, *_):
        try:
            self.commande("Browser.close")
        except Exception:
            pass
        try:
            self.processus.wait(timeout=5)
        except Exception:
            self.processus.kill()

    # ---- fils : trames WebSocket
    def _envoyer(self, texte):
        charge, masque = texte.encode(), os.urandom(4)
        n = len(charge)
        tete = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
        self.prise.sendall(tete + masque + bytes(b ^ masque[i % 4] for i, b in enumerate(charge)))

    def _lire(self, n):
        while len(self.tampon) < n:
            morceau = self.prise.recv(1 << 20)
            if not morceau:
                raise RuntimeError("connexion fermée")
            self.tampon += morceau
        sortie, self.tampon = self.tampon[:n], self.tampon[n:]
        return sortie

    def _message(self):
        texte = b""
        while True:
            a, b = self._lire(2)
            n = b & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._lire(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._lire(8))[0]
            charge = self._lire(n)
            if a & 0x0F in (0x0, 0x1):
                texte += charge
                if a & 0x80:
                    return json.loads(texte)

    def _noter(self, message):
        methode, p = message.get("method"), message.get("params", {})
        if methode == "Runtime.exceptionThrown":
            d = p.get("exceptionDetails", {})
            self.erreurs.append((d.get("exception", {}).get("description") or d.get("text", ""))[:400])
        elif methode == "Runtime.consoleAPICalled" and p.get("type") == "error":
            self.erreurs.append(" ".join(str(a.get("value", a.get("description", ""))) for a in p.get("args", []))[:400])
        elif methode == "Log.entryAdded" and p.get("entry", {}).get("level") == "error":
            self.erreurs.append((p["entry"].get("text", "") + " " + p["entry"].get("url", ""))[:400])

    def commande(self, methode, **parametres):
        self.numero += 1
        self._envoyer(json.dumps({"id": self.numero, "method": methode, "params": parametres}))
        while True:
            message = self._message()
            if message.get("id") == self.numero:
                if "error" in message:
                    raise RuntimeError(f"{methode} : {message['error']}")
                return message.get("result", {})
            self._noter(message)

    # ---- gestes
    def attendre(self, secondes):
        """Laisse tourner la page, en temps réel, en relevant les erreurs de la console."""
        fin = time.time() + secondes
        self.prise.settimeout(0.2)
        try:
            while time.time() < fin:
                try:
                    self._noter(self._message())
                except (socket.timeout, TimeoutError):
                    pass
        finally:
            self.prise.settimeout(60)

    def ouvrir(self, adresse, attente=1.5):
        self.commande("Page.navigate", url=adresse)
        self.attendre(attente)

    def js(self, code):
        r = self.commande("Runtime.evaluate", expression=code, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("exception", {}).get("description", str(r["exceptionDetails"]))[:500])
        return r.get("result", {}).get("value")

    def defiler(self, y, attente=0.8):
        self.js(f"scrollTo({{top: {y}, behavior: 'instant'}})")
        self.attendre(attente)

    def souris(self, x, y, attente=0.4):
        self.commande("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y, pointerType="mouse")
        self.attendre(attente)

    def clic(self, selecteur, attente=0.8):
        self.js(f"document.querySelector({json.dumps(selecteur)}).click()")
        self.attendre(attente)

    def touche(self, touche, attente=0.5):
        self.js(f"document.dispatchEvent(new KeyboardEvent('keydown', {{key: {json.dumps(touche)}, bubbles: true}}))")
        self.attendre(attente)

    def capture(self, nom, entiere=False):
        parametres = {"format": "png"}
        if entiere:
            h = self.js("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")
            parametres.update(captureBeyondViewport=True, clip={"x": 0, "y": 0, "width": self.largeur, "height": h, "scale": 1})
        donnees = base64.b64decode(self.commande("Page.captureScreenshot", **parametres)["data"])
        png = DOSSIER / f"{nom}.png"
        png.write_bytes(donnees)
        image = Image.open(png).convert("RGB")
        if image.height > 7000:
            image = image.crop((0, 0, image.width, 7000))
        image.save(DOSSIER / f"{nom}.jpg", quality=84)
        png.unlink()
        return str(DOSSIER / f"{nom}.jpg"), image.size


def planche(noms, sortie, marge=16, fond=(110, 110, 110)):
    """Réunit plusieurs captures côte à côte dans une seule image."""
    images = [Image.open(DOSSIER / f"{n}.jpg") for n in noms]
    toile = Image.new("RGB", (sum(i.width for i in images) + marge * (len(images) - 1), max(i.height for i in images)), fond)
    x = 0
    for image in images:
        toile.paste(image, (x, 0))
        x += image.width + marge
    toile.save(DOSSIER / f"{sortie}.jpg", quality=84)
    return str(DOSSIER / f"{sortie}.jpg"), toile.size


def _page(self, nom, ecrans=6, attente=0.9):
    """Photographie la page écran par écran, en défilant vraiment (les entrées au défilement se jouent), et réunit les tranches."""
    hauteur_page = self.js("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")
    tranches, y = [], 0
    while y < hauteur_page and len(tranches) < ecrans:
        self.defiler(y, attente)
        reel = self.js("Math.round(scrollY)")
        donnees = base64.b64decode(self.commande("Page.captureScreenshot", format="png")["data"])
        png = DOSSIER / f"{nom}-t.png"
        png.write_bytes(donnees)
        image = Image.open(png).convert("RGB")
        tranches.append((reel, image.copy()))
        png.unlink()
        y += self.hauteur
    total = min(hauteur_page, tranches[-1][0] + self.hauteur)
    toile = Image.new("RGB", (tranches[0][1].width, total), (128, 128, 128))
    for reel, image in tranches:
        toile.paste(image, (0, reel))
    toile.save(DOSSIER / f"{nom}.jpg", quality=84)
    self.defiler(0, 0.2)
    return str(DOSSIER / f"{nom}.jpg"), toile.size


Navigateur.page = _page
