"""Relève l'impôt des 26 chefs-lieux de canton auprès du calculateur officiel de l'Administration fédérale des
contributions (swisstaxcalculator.estv.admin.ch) et l'écrit dans moteur/donnees/impots-AAAA.json.

Deux grilles, pour une personne seule et pour un couple marié, sans confession, sans enfant :
  - impôt sur le revenu (Confédération + canton + commune) et taux marginal, selon le revenu brut d'un salarié ;
  - impôt sur une prestation en capital de la prévoyance (2e pilier, 3a), selon le montant retiré à 65 ans.
Le moteur interpole entre les points. Le fichier porte la date du relevé : l'application l'affiche.

Usage : python outils/donnees/maj_impots.py [année] [cantons…]   (année en cours et tous les cantons par défaut ;
        avec des cantons, seuls ceux-là sont relevés et fusionnés dans le fichier existant)
Le relevé fait environ 1300 requêtes, espacées, et dure quelques minutes.
"""
import datetime
import json
import sys
import time
import urllib.request
from pathlib import Path

BASE = 'https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV/'
RACINE = Path(__file__).resolve().parents[2]
CHEFS_LIEUX = {
    'ZH': ('Zürich', '8001'), 'BE': ('Bern', '3011'), 'LU': ('Luzern', '6003'), 'UR': ('Altdorf', '6460'), 'SZ': ('Schwyz', '6430'),
    'OW': ('Sarnen', '6060'), 'NW': ('Stans', '6370'), 'GL': ('Glarus', '8750'), 'ZG': ('Zug', '6300'), 'FR': ('Fribourg', '1700'),
    'SO': ('Solothurn', '4500'), 'BS': ('Basel', '4051'), 'BL': ('Liestal', '4410'), 'SH': ('Schaffhausen', '8200'),
    'AR': ('Herisau', '9100'), 'AI': ('Appenzell', '9050'), 'SG': ('St. Gallen', '9000'), 'GR': ('Chur', '7000'), 'AG': ('Aarau', '5000'),
    'TG': ('Frauenfeld', '8500'), 'TI': ('Bellinzona', '6500'), 'VD': ('Lausanne', '1003'), 'VS': ('Sion', '1950'),
    'NE': ('Neuchâtel', '2000'), 'GE': ('Genève', '1201'), 'JU': ('Delémont', '2800'),
}
REVENUS = [20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000, 120000, 150000, 200000, 250000, 300000, 400000, 500000]
CAPITAUX = [25000, 50000, 100000, 150000, 200000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000]
ETATS = {'seul': 1, 'marie': 2}
SANS_CONFESSION = 4
PAUSE = 0.12


def appel(operation: str, corps: dict):
    donnees = json.dumps(corps).encode('utf-8')
    for essai in range(4):
        try:
            requete = urllib.request.Request(BASE + operation, data=donnees, method='POST',
                                             headers={'Content-Type': 'application/json', 'User-Agent': 'Prevoyance-releve/1.0'})
            with urllib.request.urlopen(requete, timeout=40) as reponse:
                time.sleep(PAUSE)
                return json.loads(reponse.read().decode('utf-8'))['response']
        except Exception as erreur:  # noqa: BLE001 - réseau : on réessaie, puis on abandonne clairement
            if essai == 3:
                raise RuntimeError(f'{operation} : {erreur}') from erreur
            time.sleep(2 + 2 * essai)


def lieu(annee: int, canton: str) -> dict:
    ville, npa = CHEFS_LIEUX[canton]
    trouves = appel('API_searchLocation', {'Search': npa, 'Language': 2, 'TaxYear': annee})
    # un même numéro postal couvre parfois plusieurs communes (6370 : Stans et Oberdorf) : la commune du chef-lieu d'abord
    for t in trouves:
        if t['Canton'] == canton and t['ZipCode'] == npa and ville.lower() in (t.get('City', '').lower(), t.get('BfsName', '').lower()):
            return t
    for t in trouves:
        if t['Canton'] == canton and t['ZipCode'] == npa:
            return t
    for t in appel('API_searchLocation', {'Search': ville, 'Language': 2, 'TaxYear': annee}):
        if t['Canton'] == canton:
            return t
    raise RuntimeError(f'Lieu introuvable : {canton} {ville}')


def revenu(annee: int, lieu_id: int, etat: int, brut: int) -> list:
    r = appel('API_calculateDetailedTaxes', {
        'SimKey': None, 'TaxYear': annee, 'TaxLocationID': lieu_id, 'Relationship': etat, 'Confession1': SANS_CONFESSION, 'Children': [],
        'Age1': 45, 'RevenueType1': 1, 'Revenue1': brut, 'Fortune': 0, 'Language': 2,
        'Confession2': SANS_CONFESSION if etat == 2 else 0, 'Age2': 45 if etat == 2 else 0, 'RevenueType2': 0, 'Revenue2': 0, 'Budget': []})
    return [round(r['TotalNetTax']), round(r.get('MarginalTaxRate') or 0, 1)]


def capital(annee: int, lieu_id: int, etat: int, montant: int) -> int:
    r = appel('API_calculateManyCapitalTaxes', {
        'SimKey': None, 'TaxYear': annee, 'TaxGroupID': lieu_id, 'Relationship': etat, 'Confession1': SANS_CONFESSION, 'NumberOfChildren': 0,
        'Gender': 1, 'AgeAtPayment': 65, 'Capital': montant, 'Confession2': SANS_CONFESSION if etat == 2 else 0})[0]
    return round(r['TaxFed'] + r['TaxCanton'] + r['TaxCity'] + r.get('TaxChurch', 0))


def main() -> None:
    annee = int(sys.argv[1]) if len(sys.argv) > 1 else datetime.date.today().year
    sortie = {
        'annee': annee, 'releveLe': datetime.date.today().isoformat(),
        'source': 'Administration fédérale des contributions, calculateur d\'impôts (swisstaxcalculator.estv.admin.ch)',
        'hypotheses': 'Chef-lieu du canton, sans confession, sans enfant ; revenu brut d\'un salarié de 45 ans ; capital retiré à 65 ans',
        'revenus': REVENUS, 'capitaux': CAPITAUX, 'cantons': {},
    }
    cible = RACINE / 'moteur' / 'donnees' / f'impots-{annee}.json'
    choisis = [c.upper() for c in sys.argv[2:]] or list(CHEFS_LIEUX)
    if len(choisis) < len(CHEFS_LIEUX) and cible.exists():
        sortie['cantons'] = json.loads(cible.read_text(encoding='utf-8'))['cantons']
    for canton in choisis:
        l = lieu(annee, canton)
        donnees = {'lieu': CHEFS_LIEUX[canton][0], 'npa': l['ZipCode'], 'commune': l.get('BfsName') or l['City'], 'revenu': {}, 'capital': {}}
        for nom, etat in ETATS.items():
            donnees['revenu'][nom] = [revenu(annee, l['TaxLocationID'], etat, r) for r in REVENUS]
            donnees['capital'][nom] = [capital(annee, l['TaxLocationID'], etat, c) for c in CAPITAUX]
        sortie['cantons'][canton] = donnees
        print(canton, l['City'], 'revenu 100000 seul :', donnees['revenu']['seul'][REVENUS.index(100000)],
              '| capital 300000 seul :', donnees['capital']['seul'][CAPITAUX.index(300000)], flush=True)
    sortie['cantons'] = {c: sortie['cantons'][c] for c in CHEFS_LIEUX if c in sortie['cantons']}
    cible.parent.mkdir(parents=True, exist_ok=True)
    cible.write_text(json.dumps(sortie, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('écrit :', cible, cible.stat().st_size, 'octets')


main()
