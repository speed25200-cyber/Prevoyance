"""Relève, pour chaque commune de Suisse, l'écart d'impôt avec le chef-lieu de son canton, et l'impôt d'Église.

Complète moteur/donnees/impots-AAAA.json (grilles des chefs-lieux) par moteur/donnees/communes-AAAA.json :
  - federal     l'impôt fédéral direct sur les mêmes grilles (il ne dépend pas du lieu) ;
  - cantons     par canton, la liste des communes : numéro OFS, nom, localités (NPA + nom), et le facteur k =
                impôt cantonal et communal de la commune / celui du chef-lieu, mesuré à 100 000 de revenu brut ;
  - confessions par canton, l'impôt d'Église rapporté à l'impôt cantonal et communal du chef-lieu.
Le moteur en tire : impôt(commune) = fédéral + (total du chef-lieu − fédéral) × k × (1 + part d'Église).
La même chose est relevée pour l'impôt sur les prestations en capital (federalCapital, facteur kc, confessionsCapital),
mesurée sur un retrait de 300 000.
Le script contrôle cette formule sur un échantillon de communes et affiche l'écart avec le calculateur officiel.

Usage : python outils/donnees/maj_communes.py [année] [--capital]   (environ 5000 requêtes, une demi-heure ;
        avec --capital, seule la partie « prestations en capital » est ajoutée au fichier existant)
"""
import datetime
import json
import random
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

BASE = 'https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV/'
RACINE = Path(__file__).resolve().parents[2]
ETATS = {'seul': 1, 'marie': 2}
AGES_ENFANTS = [8, 10, 12]
SANS_CONFESSION, REFORMEE, CATHOLIQUE = 4, 1, 2
REFERENCE = 100000
REFERENCE_CAPITAL = 300000
PAUSE = 0.1


def appel(operation: str, corps: dict):
    donnees = json.dumps(corps).encode('utf-8')
    for essai in range(5):
        try:
            requete = urllib.request.Request(BASE + operation, data=donnees, method='POST',
                                             headers={'Content-Type': 'application/json', 'User-Agent': 'Prevoyance-releve/1.0'})
            with urllib.request.urlopen(requete, timeout=40) as reponse:
                time.sleep(PAUSE)
                return json.loads(reponse.read().decode('utf-8'))['response']
        except Exception as erreur:  # noqa: BLE001 - réseau : on réessaie, puis on abandonne clairement
            if essai == 4:
                raise RuntimeError(f'{operation} : {erreur}') from erreur
            time.sleep(2 + 3 * essai)


def detail(annee: int, lieu_id: int, etat: int = 1, brut: int = REFERENCE, enfants: int = 0, confession: int = SANS_CONFESSION) -> dict:
    r = appel('API_calculateDetailedTaxes', {
        'SimKey': None, 'TaxYear': annee, 'TaxLocationID': lieu_id, 'Relationship': etat, 'Confession1': confession,
        'Children': [{'Age': a} for a in AGES_ENFANTS[:enfants]],
        'Age1': 45, 'RevenueType1': 1, 'Revenue1': brut, 'Fortune': 0, 'Language': 2,
        'Confession2': confession if etat == 2 else 0, 'Age2': 45 if etat == 2 else 0, 'RevenueType2': 0, 'Revenue2': 0, 'Budget': []})
    return {'federal': r['IncomeTaxFed'], 'eglise': r['IncomeTaxChurch'], 'total': r['TotalNetTax'],
            'local': r['TotalNetTax'] - r['IncomeTaxFed'] - r['IncomeTaxChurch']}


def capital(annee: int, lieu_id: int, etat: int = 1, montant: int = REFERENCE_CAPITAL, confession: int = SANS_CONFESSION) -> dict:
    r = appel('API_calculateManyCapitalTaxes', {
        'SimKey': None, 'TaxYear': annee, 'TaxGroupID': lieu_id, 'Relationship': etat, 'Confession1': confession, 'NumberOfChildren': 0,
        'Gender': 1, 'AgeAtPayment': 65, 'Capital': montant, 'Confession2': confession if etat == 2 else 0})[0]
    return {'federal': r['TaxFed'], 'eglise': r.get('TaxChurch', 0), 'local': r['TaxCanton'] + r['TaxCity']}


def completer_capital(annee: int, impots: dict, sortie: dict, chefs: dict, identifiants: dict) -> None:
    """Ajoute à `sortie` l'impôt fédéral sur le capital, le facteur kc de chaque commune et la part d'Église."""
    un_lieu = chefs['BE']['TaxLocationID']
    sortie['federalCapital'] = {nom: [round(capital(annee, un_lieu, etat, c)['federal']) for c in impots['capitaux']] for nom, etat in ETATS.items()}
    sortie['confessionsCapital'] = {}
    reference = {}
    for canton, chef in chefs.items():
        base = capital(annee, chef['TaxLocationID'])
        reference[canton] = base['local']
        sortie['confessionsCapital'][canton] = {
            'reformee': round(capital(annee, chef['TaxLocationID'], confession=REFORMEE)['eglise'] / max(base['local'], 1), 4),
            'catholique': round(capital(annee, chef['TaxLocationID'], confession=CATHOLIQUE)['eglise'] / max(base['local'], 1), 4)}
    for canton, liste in sortie['cantons'].items():
        for i, commune in enumerate(liste):
            commune['kc'] = round(capital(annee, identifiants[(canton, commune['b'])])['local'] / max(reference[canton], 1), 4)
            if (i + 1) % 50 == 0:
                print('capital', canton, i + 1, flush=True)
    # contrôle sur un échantillon, pour un autre montant et un couple
    random.seed(annee + 1)
    plates = [(c, x) for c, liste in sortie['cantons'].items() for x in liste]
    pire = 0.0
    for canton, commune in random.sample(plates, 24):
        for nom, etat, montant in (('seul', 1, 150000), ('marie', 2, 500000)):
            i = impots['capitaux'].index(montant)
            f = sortie['federalCapital'][nom][i]
            prevu = f + (impots['cantons'][canton]['capital'][nom][i] - f) * commune['kc']
            r = capital(annee, identifiants[(canton, commune['b'])], etat, montant)
            reel = r['federal'] + r['local']
            ecart = abs(prevu - reel) / max(reel, 1)
            pire = max(pire, ecart)
            print(f"contrôle capital {canton} {commune['n']} {nom} {montant} : prévu {round(prevu)}, officiel {round(reel)}, écart {ecart:.1%}", flush=True)
    sortie['ecartMaxControleCapital'] = round(pire, 4)


def localites(annee: int) -> list:
    """Toutes les localités du calculateur, par préfixe de numéro postal (la recherche plafonne à 200 réponses)."""
    vues = {}
    for prefixe in range(10, 100):
        trouvees = appel('API_searchLocation', {'Search': str(prefixe), 'Language': 2, 'TaxYear': annee})
        if len(trouvees) >= 200:
            trouvees = [t for p in range(10) for t in appel('API_searchLocation', {'Search': f'{prefixe}{p}', 'Language': 2, 'TaxYear': annee})]
        for t in trouvees:
            if t['ZipCode'].startswith(str(prefixe)):
                vues[t['TaxLocationID']] = t
    return list(vues.values())


def main() -> None:
    arguments = [a for a in sys.argv[1:] if not a.startswith('--')]
    annee = int(arguments[0]) if arguments else datetime.date.today().year
    impots = json.loads((RACINE / 'moteur' / 'donnees' / f'impots-{annee}.json').read_text(encoding='utf-8'))
    revenus = impots['revenus']

    toutes = localites(annee)
    communes = {}
    for t in toutes:
        communes.setdefault((t['Canton'], t['BfsID']), []).append(t)
    print(len(toutes), 'localités,', len(communes), 'communes', flush=True)

    # le chef-lieu de chaque canton, tel que relevé dans impots-AAAA.json
    chefs = {}
    for canton, c in impots['cantons'].items():
        candidats = [t for t in toutes if t['Canton'] == canton and t['ZipCode'] == c['npa']]
        exact = [t for t in candidats if t['City'].lower() == c['lieu'].lower()]
        chefs[canton] = (exact or candidats)[0]
    identifiants = {cle: lieux[0]['TaxLocationID'] for cle, lieux in communes.items()}
    cible = RACINE / 'moteur' / 'donnees' / f'communes-{annee}.json'
    if '--capital' in sys.argv:
        sortie = json.loads(cible.read_text(encoding='utf-8'))
        completer_capital(annee, impots, sortie, chefs, identifiants)
        cible.write_text(json.dumps(sortie, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print('écrit :', cible, cible.stat().st_size, 'octets ; écart maximal du contrôle (capital) :', f"{sortie['ecartMaxControleCapital']:.1%}")
        return

    # impôt fédéral : identique partout, relevé une fois sur les mêmes grilles
    federal = {}
    un_lieu = chefs['BE']['TaxLocationID']
    for nom, etat in ETATS.items():
        for n in range(0, 4):
            federal[f'{nom}{n or ""}'] = [round(detail(annee, un_lieu, etat, r, n)['federal']) for r in revenus]
    print('fédéral relevé', flush=True)

    sortie = {
        'annee': annee, 'releveLe': datetime.date.today().isoformat(), 'source': impots['source'],
        'methode': ("Impôt de la commune = impôt fédéral + (impôt du chef-lieu − impôt fédéral) × facteur de la commune × (1 + part d'Église). "
                    f"Facteur et part d'Église mesurés pour une personne seule à {REFERENCE} de revenu brut"),
        'federal': federal, 'confessions': {}, 'cantons': {},
    }
    reference = {}
    for canton, chef in chefs.items():
        base = detail(annee, chef['TaxLocationID'])
        reference[canton] = base['local']
        sortie['confessions'][canton] = {
            'reformee': round(detail(annee, chef['TaxLocationID'], confession=REFORMEE)['eglise'] / base['local'], 4),
            'catholique': round(detail(annee, chef['TaxLocationID'], confession=CATHOLIQUE)['eglise'] / base['local'], 4)}

    for (canton, bfs), lieux in sorted(communes.items()):
        if canton not in chefs:
            continue
        noms = Counter(t['City'] for t in lieux)
        nom = max(noms, key=lambda n: (noms[n], -len(n)))
        local = detail(annee, lieux[0]['TaxLocationID'])['local']
        sortie['cantons'].setdefault(canton, []).append({
            'b': bfs, 'n': nom, 'k': round(local / reference[canton], 4), 'id': lieux[0]['TaxLocationID'],
            'l': sorted({f"{t['ZipCode']} {t['City']}" for t in lieux})})
        if len(sortie['cantons'][canton]) % 50 == 0:
            print(canton, len(sortie['cantons'][canton]), flush=True)

    # contrôle de la formule sur un échantillon, dans d'autres situations que celle de la mesure
    random.seed(annee)
    plates = [(c, x) for c, liste in sortie['cantons'].items() for x in liste]
    pire = 0.0
    for canton, commune in random.sample(plates, 24):
        for nom, etat, brut, enfants in (('seul', 1, 60000, 0), ('marie2', 2, 150000, 2)):
            grille = impots['cantons'][canton]['revenu'][nom]
            i = revenus.index(brut)
            prevu = federal[nom][i] + (grille[i][0] - federal[nom][i]) * commune['k']
            reel = detail(annee, commune['id'], etat, brut, enfants)['total']
            ecart = abs(prevu - reel) / max(reel, 1)
            pire = max(pire, ecart)
            print(f"contrôle {canton} {commune['n']} {nom} {brut} : prévu {round(prevu)}, officiel {round(reel)}, écart {ecart:.1%}", flush=True)
    sortie['ecartMaxControle'] = round(pire, 4)

    for liste in sortie['cantons'].values():
        liste.sort(key=lambda x: x['n'])
        for x in liste:
            del x['id']
    completer_capital(annee, impots, sortie, chefs, identifiants)
    cible.write_text(json.dumps(sortie, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('écrit :', cible, cible.stat().st_size, 'octets ; écart maximal du contrôle :', f'{pire:.1%}')


main()
