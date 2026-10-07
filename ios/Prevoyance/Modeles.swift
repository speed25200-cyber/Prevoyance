import Foundation

/// Les modèles d'affichage que la page remet à l'app (web/src/collecte.js, web/src/natif.js).
/// L'app ne calcule rien : elle reçoit des libellés traduits et des montants déjà mis en forme, et les dessine.

/// Un choix d'une liste.
struct OptionChamp: Equatable, Identifiable {
    let v: String
    let l: String
    var id: String { v }
}

/// Un champ du dossier, décrit par la page.
struct Champ: Identifiable, Equatable {
    let id: String
    let type: String
    let libelle: String
    var texte: String
    var nombre: Double?
    var actif: Bool
    let indication: String
    let note: String
    let facultatif: Bool
    let options: [OptionChamp]
    let min: Double
    let max: Double
    let pas: Double
    let etiquettes: [String]
    let icone: String

    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String, let type = d["type"] as? String else { return nil }
        self.id = id
        self.type = type
        libelle = d["libelle"] as? String ?? ""
        let valeur = d["valeur"]
        texte = valeur as? String ?? ""
        actif = type == "bascule" ? ((valeur as? NSNumber)?.boolValue ?? false) : false
        nombre = valeur is String || valeur is NSNull ? nil : (valeur as? NSNumber)?.doubleValue
        indication = d["indication"] as? String ?? ""
        note = d["note"] as? String ?? ""
        facultatif = (d["facultatif"] as? NSNumber)?.boolValue ?? false
        options = (d["options"] as? [[String: Any]] ?? []).compactMap { o in
            guard let v = o["v"] as? String else { return nil }
            return OptionChamp(v: v, l: o["l"] as? String ?? v)
        }
        min = (d["min"] as? NSNumber)?.doubleValue ?? 0
        max = (d["max"] as? NSNumber)?.doubleValue ?? 0
        pas = (d["pas"] as? NSNumber)?.doubleValue ?? 1
        etiquettes = d["etiquettes"] as? [String] ?? []
        icone = d["icone"] as? String ?? ""
    }
}

/// Une rubrique du dossier.
struct Rubrique: Identifiable, Equatable {
    let id: String
    let titre: String
    var champs: [Champ]

    init?(_ d: [String: Any]) {
        guard let cle = d["cle"] as? String else { return nil }
        id = cle
        titre = d["titre"] as? String ?? cle
        champs = (d["champs"] as? [[String: Any]] ?? []).compactMap(Champ.init)
    }

    /// Pictogramme du système pour chaque rubrique.
    var symbole: String {
        switch id {
        case "client": return "person"
        case "menage": return "house"
        case "conjoint": return "person.2"
        case "lpp": return "building.columns"
        case "pilier3": return "banknote"
        case "logement": return "key"
        case "besoins": return "target"
        case "lg_conseil": return "signature"
        case "lg_intermediaire": return "briefcase"
        case "sv_securite": return "lock"
        default: return "circle"
        }
    }
}

/// L'écran « Analyse ».
struct AnalyseModele: Equatable {
    struct Cle: Equatable, Identifiable { let nom: String; let valeur: String; var id: String { nom } }
    struct Pilier: Equatable, Identifiable { let id: Int; let nom: String; let montant: String; let vide: Bool }
    struct Risque: Equatable, Identifiable { let id: String; let nom: String; let montant: String; let note: String; let couverture: Double; let actif: Bool; let lacune: Bool }
    struct Source: Equatable, Identifiable { let id: Int; let nom: String; let montant: String; let pilier: Int; let part: Double }
    struct Point: Equatable, Identifiable { let id: Int; let besoin: Double; let salaire: Double; let p1: Double; let p2: Double; let p3: Double }
    struct Alerte: Equatable, Identifiable { let id: Int; let gravite: String; let texte: String }
    struct Jour: Equatable, Identifiable { let id: Int; let jour: String; let score: Double }

    let score: Int
    let scoreNom: String
    let risque: String
    let titre: String
    let montant: String
    let parMois: String
    let bouton: String
    let detailTitre: String
    let attente: String
    let ligneTitre: String
    let ligneNote: String
    let alertesTitre: String
    let avertissement: String
    let cibleChoix: String?
    let ciblePersonne: String
    let cibleConjoint: String
    let cles: [Cle]
    let piliers: [Pilier]
    let risques: [Risque]
    let sources: [Source]
    let ligne: [Point]
    let alertes: [Alerte]
    /// Libellés de la légende : salaire, 1er, 2e, 3e pilier, besoin.
    let legende: [String]
    /// Le score de chaque jour d'analyse (vide tant qu'il n'y en a qu'un) et la phrase qui dit le chemin parcouru.
    let suivi: [Jour]
    let suiviTexte: String

    init?(_ d: [String: Any]) {
        guard d["risques"] != nil else { return nil }
        let s: (String) -> String = { d[$0] as? String ?? "" }
        let n: ([String: Any], String) -> Double = { ($0[$1] as? NSNumber)?.doubleValue ?? 0 }
        let b: ([String: Any], String) -> Bool = { ($0[$1] as? NSNumber)?.boolValue ?? false }
        let liste: (String) -> [[String: Any]] = { d[$0] as? [[String: Any]] ?? [] }
        score = Int(n(d, "score"))
        scoreNom = s("scoreNom"); risque = s("risque"); titre = s("titre"); montant = s("montant"); parMois = s("parMois")
        bouton = s("bouton"); detailTitre = s("detailTitre"); attente = s("attente"); ligneTitre = s("ligneTitre"); ligneNote = s("ligneNote")
        alertesTitre = s("alertesTitre"); avertissement = s("avertissement")
        let cible = d["cible"] as? [String: Any]
        cibleChoix = cible?["choix"] as? String
        ciblePersonne = cible?["personne"] as? String ?? ""
        cibleConjoint = cible?["conjoint"] as? String ?? ""
        cles = liste("cles").map { Cle(nom: $0["nom"] as? String ?? "", valeur: $0["valeur"] as? String ?? "") }
        piliers = liste("piliers").enumerated().map { Pilier(id: $0.offset, nom: $0.element["nom"] as? String ?? "", montant: $0.element["montant"] as? String ?? "", vide: b($0.element, "vide")) }
        risques = liste("risques").map { Risque(id: $0["cle"] as? String ?? "", nom: $0["nom"] as? String ?? "", montant: $0["montant"] as? String ?? "",
                                                note: $0["note"] as? String ?? "", couverture: n($0, "couverture"), actif: b($0, "actif"), lacune: b($0, "lacune")) }
        sources = liste("sources").enumerated().map { Source(id: $0.offset, nom: $0.element["nom"] as? String ?? "", montant: $0.element["montant"] as? String ?? "",
                                                             pilier: Int(n($0.element, "pilier")), part: n($0.element, "part")) }
        ligne = liste("ligne").map { Point(id: Int(n($0, "age")), besoin: n($0, "besoin"), salaire: n($0, "salaire"), p1: n($0, "p1"), p2: n($0, "p2"), p3: n($0, "p3")) }
        alertes = liste("alertes").enumerated().map { Alerte(id: $0.offset, gravite: $0.element["gravite"] as? String ?? "info", texte: $0.element["texte"] as? String ?? "") }
        let l = d["legende"] as? [String: Any] ?? [:]
        legende = ["salaire", "p1", "p2", "p3", "besoin"].map { l[$0] as? String ?? $0 }
        suivi = liste("suivi").enumerated().map { Jour(id: $0.offset, jour: $0.element["jour"] as? String ?? "", score: n($0.element, "score")) }
        suiviTexte = s("suiviTexte")
    }
}
