import SwiftUI
import UIKit
import WebKit

/// Essais des fonctions de l'app elle-même, lancés par l'autotest (simulateur de l'intégration continue) :
/// ce qu'un contrôle de la page ne prouve pas — la lecture d'un certificat photographié, le PDF du rapport,
/// la signature et le logo jusque dans le dossier. Aucun appareil photo ni doigt n'est nécessaire : l'image du
/// certificat et le tracé sont dessinés ici, puis suivent exactement le chemin des vrais.
extension Navigation {
    /// Résultats, en JSON : `[{"nom": …, "ok": …, "detail": …}]`.
    func essaisNatifs() async -> String {
        var essais: [[String: Any]] = []
        func noter(_ nom: String, _ ok: Bool, _ detail: String) { essais.append(["nom": nom, "ok": ok, "detail": detail]) }
        func page(_ corps: String, _ arguments: [String: Any]) async -> Any? {
            try? await vue.callAsyncJavaScript(corps, arguments: arguments, in: nil, contentWorld: .page)
        }

        // 1. certificat photographié : reconnaissance du texte par l'appareil, puis lecture des montants par le moteur
        let texte = await ScanCertificat.lire([Navigation.certificatEssai()].compactMap { $0 })
        let lecture = await page("""
            const m = await import('prevoyance://app/moteur/src/index.js');
            const champs = m.Certificat.extraire(texte).champs;
            return JSON.stringify(Object.fromEntries(Object.entries(champs).map(([cle, champ]) => [cle, champ.valeur])));
            """, ["texte": texte]) as? String ?? "{}"
        let champs = (try? JSONSerialization.jsonObject(with: Data(lecture.utf8))) as? [String: Any] ?? [:]
        let valeur: (String) -> Int = { (champs[$0] as? NSNumber)?.intValue ?? 0 }
        noter("certificat photographié : texte lu et montants reconnus",
              valeur("lppAvoir") == 187_450 && valeur("lppRenteVieillesse") == 33_545 && valeur("lppRenteInvalidite") == 41_600 && valeur("lppRachat") == 62_000 && champs.count >= 6,
              "\(champs.count) champs sur 7, avoir \(valeur("lppAvoir")), rente \(valeur("lppRenteVieillesse")), \(texte.count) caractères lus")

        // 2. signature et logo : l'image suit le chemin du formulaire et se retrouve dans le dossier
        let image = Navigation.traceEssai()
        let marque = String(image.dropFirst(60).prefix(48))
        var deja = 0
        for type in ["signature", "logo"] {
            let cibles = rubriques.flatMap { $0.champs }.filter { $0.type == type }
            for champ in cibles { ecrire(champ.id, texte: image, presence: 1) }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            let gardees = (await page("return JSON.stringify(window.__prevoyance.etat).split(marque).length - 1;", ["marque": marque]) as? NSNumber)?.intValue ?? -1
            noter("\(type) : enregistré dans le dossier", !cibles.isEmpty && gardees >= deja + cibles.count, "\(cibles.count) champ(s), \(gardees) image(s) dans le dossier")
            deja = max(deja, gardees)
        }

        // 3. rapport : le PDF est réellement produit (pages A4), avec les images du dossier
        choisir("rapport")
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        let images = (await page("return document.querySelectorAll('#vue img[src^=data]').length;", [:]) as? NSNumber)?.intValue ?? -1
        noter("rapport : logo et signatures repris", images >= 1, "\(images) image(s) dans le rapport")
        let feuilles = (await page("return document.querySelectorAll('#vue .page').length;", [:]) as? NSNumber)?.intValue ?? -1
        let pdf = Navigation.pdf(de: vue)
        let pages = pdf.pages, octets = pdf.donnees.count
        noter("rapport : PDF produit, une page par feuille, sans page vide", feuilles >= 2 && pages == feuilles && octets > 20_000, "\(pages) pages pour \(feuilles) feuilles, \(octets) octets")

        guard let donnees = try? JSONSerialization.data(withJSONObject: essais), let json = String(data: donnees, encoding: .utf8) else { return "[]" }
        return json
    }

    /// Le rapport en PDF, fabriqué par l'app : des feuilles A4 exactes, sans les marges qu'une imprimante ajouterait
    /// (ce sont elles qui repoussaient le bas de chaque feuille sur une page de plus).
    static func pdf(de vue: WKWebView) -> (donnees: Data, pages: Int) {
        let rendu = UIPrintPageRenderer()
        rendu.addPrintFormatter(vue.viewPrintFormatter(), startingAtPageAt: 0)
        let feuille = CGRect(x: 0, y: 0, width: 595.28, height: 841.89)   // A4, en points
        rendu.setValue(NSValue(cgRect: feuille), forKey: "paperRect")
        rendu.setValue(NSValue(cgRect: feuille), forKey: "printableRect")
        let donnees = NSMutableData()
        UIGraphicsBeginPDFContextToData(donnees, feuille, nil)
        let nombre = rendu.numberOfPages
        rendu.prepare(forDrawingPages: NSRange(location: 0, length: nombre))
        for numero in 0..<nombre {
            UIGraphicsBeginPDFPage()
            rendu.drawPage(at: numero, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()
        let pages = CGDataProvider(data: donnees as CFData).flatMap { CGPDFDocument($0) }?.numberOfPages ?? 0
        return (donnees as Data, pages)
    }

    /// Un certificat de prévoyance d'essai, dessiné comme une page photographiée : libellés à gauche, montants à droite.
    private static func certificatEssai() -> CGImage? {
        let lignes = [("Certificat de prévoyance au 01.01.2026", ""), ("Salaire annuel annoncé", "CHF 104'000.00"),
                      ("Avoir de vieillesse", "CHF 187'450.00"), ("Rente de vieillesse annuelle à 65 ans", "CHF 33'545.00"),
                      ("Rente d'invalidité annuelle", "CHF 41'600.00"), ("Rente de conjoint annuelle", "CHF 24'960.00"),
                      ("Capital décès", "CHF 50'000.00"), ("Rachat maximal possible", "CHF 62'000.00")]
        let taille = CGSize(width: 1240, height: 1100)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: taille, format: format).image { contexte in
            UIColor.white.setFill()
            contexte.fill(CGRect(origin: .zero, size: taille))
            let attributs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 34), .foregroundColor: UIColor.black]
            for (rang, ligne) in lignes.enumerated() {
                let hauteur = 90 + CGFloat(rang) * 115
                (ligne.0 as NSString).draw(at: CGPoint(x: 70, y: hauteur), withAttributes: attributs)
                (ligne.1 as NSString).draw(at: CGPoint(x: 830, y: hauteur), withAttributes: attributs)
            }
        }.cgImage
    }

    /// Un tracé d'essai (comme une signature), en PNG : la même forme d'image que celle du pavé de signature.
    private static func traceEssai() -> String {
        let taille = CGSize(width: 360, height: 120)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let png = UIGraphicsImageRenderer(size: taille, format: format).pngData { _ in
            let trace = UIBezierPath()
            trace.move(to: CGPoint(x: 20, y: 80))
            trace.addCurve(to: CGPoint(x: 340, y: 50), controlPoint1: CGPoint(x: 120, y: 0), controlPoint2: CGPoint(x: 220, y: 130))
            trace.lineWidth = 4
            UIColor.black.setStroke()
            trace.stroke()
        }
        return "data:image/png;base64," + png.base64EncodedString()
    }
}
