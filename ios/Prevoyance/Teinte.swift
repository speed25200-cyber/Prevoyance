import SwiftUI

/// La palette « Glacier » : une nuit de montagne, du verre, des bleus de glace très doux, du blanc. Aucune couleur vive ni chaude.
/// Les sources de revenu gardent les mêmes bleus sur tous les écrans, du plus profond (1er pilier) au plus clair (3e).
enum Teinte {
    static let accent = Color(red: 0.66, green: 0.86, blue: 0.99)
    static let nuit = Color(red: 0.020, green: 0.055, blue: 0.125)
    static let nuitBasse = Color(red: 0.031, green: 0.086, blue: 0.180)
    /// Le bleu de glace des jauges et des pictogrammes : clair, jamais vif.
    static let eclat = Color(red: 0.70, green: 0.84, blue: 0.98)
    /// Le voile clair des petits éléments posés sur le verre (pastilles, lignes), du haut vers le bas.
    static let carteHaut = Color.white.opacity(0.11)
    static let carteBas = Color.white.opacity(0.05)
    static let glace = Color(red: 0.745, green: 0.824, blue: 0.922)
    static let bouton = Color(red: 0.933, green: 0.953, blue: 0.973)
    static let boutonEncre = Color(red: 0.043, green: 0.082, blue: 0.133)
    static let salaire = Color(red: 0.44, green: 0.50, blue: 0.60)
    static let pilier1 = Color(red: 0.33, green: 0.48, blue: 0.72)
    static let pilier2 = Color(red: 0.54, green: 0.70, blue: 0.90)
    static let pilier3 = Color(red: 0.84, green: 0.92, blue: 0.99)
    /// Un montant qui manque, dans un texte.
    static let lacune = Color(red: 0.66, green: 0.86, blue: 0.99)
    /// La part qui manque, dans une barre : un vide à peine marqué.
    static let manque = Color(red: 0.745, green: 0.824, blue: 0.922).opacity(0.26)

    static func pilier(_ numero: Int) -> Color {
        switch numero {
        case 1: return pilier1
        case 2: return pilier2
        case 3: return pilier3
        case -1: return manque
        default: return Color.secondary
        }
    }

    static func gravite(_ nom: String) -> Color {
        switch nom {
        case "critique": return Color.white
        case "attention": return accent
        case "opportunite": return pilier2
        default: return Color.secondary
        }
    }
}
