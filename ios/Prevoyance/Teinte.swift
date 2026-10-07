import SwiftUI

/// La palette « Glacier » : une nuit de montagne, des bleus de glace, du blanc. Aucune couleur chaude.
/// Les sources de revenu gardent les mêmes bleus sur tous les écrans, du plus profond (1er pilier) au plus clair (3e).
enum Teinte {
    static let accent = Color(red: 0.66, green: 0.86, blue: 0.99)
    static let nuit = Color(red: 0.043, green: 0.082, blue: 0.133)
    static let nuitBasse = Color(red: 0.055, green: 0.106, blue: 0.173)
    static let glace = Color(red: 0.745, green: 0.824, blue: 0.922)
    static let bouton = Color(red: 0.933, green: 0.953, blue: 0.973)
    static let boutonEncre = Color(red: 0.043, green: 0.082, blue: 0.133)
    static let salaire = Color(red: 0.30, green: 0.36, blue: 0.46)
    static let pilier1 = Color(red: 0.20, green: 0.38, blue: 0.68)
    static let pilier2 = Color(red: 0.40, green: 0.63, blue: 0.87)
    static let pilier3 = Color(red: 0.74, green: 0.88, blue: 0.98)
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
