import PDFKit
import PhotosUI
import UIKit
import UniformTypeIdentifiers
import Vision
import VisionKit
import WebKit
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Scan d'un certificat de prévoyance, entièrement sur l'appareil :
/// 1. le scanner de documents d'iOS photographie et redresse les pages ; ou bien le conseiller choisit un certificat
///    déjà enregistré : un PDF ou une image dans Fichiers, une ou plusieurs photos de la photothèque ;
/// 2. la reconnaissance de texte d'Apple (Vision) lit le français, l'allemand, l'italien et l'anglais ;
/// 3. si l'appareil dispose du modèle de langage d'Apple (Apple Intelligence, iOS 26), il remplit les champs ;
///    sinon la page lit le texte par libellés (moteur/src/certificat.js).
/// Rien n'est envoyé sur Internet. La page affiche ensuite les valeurs à vérifier par le conseiller.
@MainActor
final class ScanCertificat: NSObject, VNDocumentCameraViewControllerDelegate, UIDocumentPickerDelegate, PHPickerViewControllerDelegate {
    private weak var vue: WKWebView?

    init(vue: WKWebView) { self.vue = vue }

    func ouvrir() {
        guard VNDocumentCameraViewController.isSupported,
              let racine = vue?.window?.rootViewController else { return repondre(["erreur": "scanner indisponible"]) }
        let scanner = VNDocumentCameraViewController()
        scanner.delegate = self
        racine.present(scanner, animated: true)
    }

    func documentCameraViewControllerDidCancel(_ controleur: VNDocumentCameraViewController) {
        controleur.dismiss(animated: true)
        repondre(["erreur": "annulé"])
    }

    func documentCameraViewController(_ controleur: VNDocumentCameraViewController, didFailWithError erreur: any Error) {
        controleur.dismiss(animated: true)
        repondre(["erreur": erreur.localizedDescription])
    }

    func documentCameraViewController(_ controleur: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        let pages = (0..<min(scan.pageCount, 6)).compactMap { scan.imageOfPage(at: $0).cgImage }
        controleur.dismiss(animated: true)
        Task { await conclure(await Self.lire(pages)) }
    }

    /// Le texte est lu : le modèle de langage de l'appareil remplit les champs s'il existe, puis la page est prévenue.
    private func conclure(_ texte: String) async {
        guard !texte.isEmpty else { return repondre(["erreur": "aucun texte lu"]) }
        var reponse: [String: Any] = ["texte": texte, "lecteur": "regles"]
        if let champs = await Self.comprendre(texte) {
            reponse["champs"] = champs
            reponse["lecteur"] = "modele"
        }
        repondre(reponse)
    }

    // MARK: certificat déjà enregistré

    /// Un PDF ou une image rangés dans Fichiers (iCloud Drive, téléchargements, clé…). L'app en reçoit une copie.
    func choisirFichier() {
        guard let racine = vue?.window?.rootViewController else { return repondre(["erreur": "fichiers indisponibles"]) }
        let choix = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.pdf, UTType.image], asCopy: true)
        choix.delegate = self
        choix.allowsMultipleSelection = false
        racine.present(choix, animated: true)
    }

    /// Une ou plusieurs photos de la photothèque (le sélecteur d'iOS ne demande aucune autorisation d'accès).
    func choisirPhoto() {
        guard let racine = vue?.window?.rootViewController else { return repondre(["erreur": "photos indisponibles"]) }
        var reglages = PHPickerConfiguration()
        reglages.filter = .images
        reglages.selectionLimit = 6
        let choix = PHPickerViewController(configuration: reglages)
        choix.delegate = self
        racine.present(choix, animated: true)
    }

    func documentPickerWasCancelled(_ controleur: UIDocumentPickerViewController) {
        repondre(["erreur": "annulé"])
    }

    func documentPicker(_ controleur: UIDocumentPickerViewController, didPickDocumentsAt adresses: [URL]) {
        guard let adresse = adresses.first else { return repondre(["erreur": "annulé"]) }
        Task {
            if adresse.pathExtension.lowercased() == "pdf" {
                await conclure(await Self.lirePDF(adresse))
            } else {
                let donnees = try? Data(contentsOf: adresse)
                await conclure(await Self.lire([donnees.flatMap(Self.redresser)].compactMap { $0 }))
            }
            try? FileManager.default.removeItem(at: adresse)          // la copie de travail ne reste pas dans l'app
        }
    }

    func picker(_ controleur: PHPickerViewController, didFinishPicking resultats: [PHPickerResult]) {
        controleur.dismiss(animated: true)
        guard !resultats.isEmpty else { return repondre(["erreur": "annulé"]) }
        let fournisseurs = resultats.map(\.itemProvider)
        Task {
            var pages: [CGImage] = []
            for fournisseur in fournisseurs {
                if let donnees = await Self.charger(fournisseur), let page = Self.redresser(donnees) { pages.append(page) }
            }
            await conclure(await Self.lire(pages))
        }
    }

    /// Données d'une image choisie dans la photothèque.
    private static func charger(_ fournisseur: NSItemProvider) async -> Data? {
        await withCheckedContinuation { (suite: CheckedContinuation<Data?, Never>) in
            _ = fournisseur.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { donnees, _ in suite.resume(returning: donnees) }
        }
    }

    /// Image remise à l'endroit (une photo garde son sens de prise de vue à part) et ramenée à 3000 points au plus.
    private static func redresser(_ donnees: Data) -> CGImage? {
        guard let image = UIImage(data: donnees), image.size.width > 0, image.size.height > 0 else { return nil }
        let echelle = min(1, 3000 / max(image.size.width, image.size.height))
        let taille = CGSize(width: image.size.width * echelle, height: image.size.height * echelle)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: taille, format: format).image { contexte in
            UIColor.white.setFill()
            contexte.fill(CGRect(origin: .zero, size: taille))
            image.draw(in: CGRect(origin: .zero, size: taille))
        }.cgImage
    }

    /// Texte d'un PDF : celui que le fichier contient déjà (PDF de la caisse), sinon la page est lue comme une image
    /// (PDF fait d'un scan). Six pages au plus.
    private static func lirePDF(_ adresse: URL) async -> String {
        guard let document = PDFDocument(url: adresse) else { return "" }
        var morceaux: [String] = []
        for numero in 0..<min(document.pageCount, 6) {
            guard let page = document.page(at: numero) else { continue }
            let texte = (page.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if texte.count > 40 { morceaux.append(texte); continue }
            let cadre = page.bounds(for: .mediaBox).size
            guard cadre.width > 0, cadre.height > 0 else { continue }
            let echelle = 2400 / max(cadre.width, cadre.height)
            let vignette = page.thumbnail(of: CGSize(width: cadre.width * echelle, height: cadre.height * echelle), for: .mediaBox)
            if let image = vignette.cgImage { morceaux.append(await lire([image])) }
        }
        return morceaux.filter { !$0.isEmpty }.joined(separator: "\n")
    }

    /// Reconnaissance de texte, page par page, hors du fil principal.
    static func lire(_ pages: [CGImage]) async -> String {
        await Task.detached(priority: .userInitiated) {
            var lignes: [String] = []
            for page in pages {
                let demande = VNRecognizeTextRequest()
                demande.recognitionLevel = .accurate
                demande.usesLanguageCorrection = true
                demande.recognitionLanguages = ["fr-FR", "de-DE", "it-IT", "en-US"]
                try? VNImageRequestHandler(cgImage: page).perform([demande])
                // de haut en bas, puis de gauche à droite : un libellé et son montant restent sur la même ligne
                let observations = (demande.results ?? []).sorted {
                    abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.012 ? $0.boundingBox.midY > $1.boundingBox.midY : $0.boundingBox.minX < $1.boundingBox.minX
                }
                var derniereHauteur: CGFloat = -1
                for observation in observations {
                    guard let texte = observation.topCandidates(1).first?.string else { continue }
                    if derniereHauteur >= 0, abs(observation.boundingBox.midY - derniereHauteur) <= 0.012, !lignes.isEmpty {
                        lignes[lignes.count - 1] += "   " + texte
                    } else {
                        lignes.append(texte)
                    }
                    derniereHauteur = observation.boundingBox.midY
                }
            }
            return lignes.joined(separator: "\n")
        }.value
    }

    /// Champs remplis par le modèle de langage de l'appareil, quand il existe ; sinon `nil` (lecture par libellés).
    private static func comprendre(_ texte: String) async -> [String: Double]? {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            guard case .available = SystemLanguageModel.default.availability else { return nil }
            let session = LanguageModelSession(instructions: """
                Tu lis le texte d'un certificat de prévoyance suisse du 2e pilier (LPP / BVG), en français, allemand ou italien. \
                Tu relèves uniquement les montants écrits dans le texte, en francs, sans rien calculer ni inventer. \
                Pour une rente, tu donnes le montant annuel. Quand une valeur ne figure pas dans le texte, tu donnes 0.
                """)
            guard let reponse = try? await session.respond(to: String(texte.prefix(6000)), generating: CertificatLu.self) else { return nil }
            let lu = reponse.content
            return ["lppAvoir": lu.avoirVieillesse, "lppRenteVieillesse": lu.renteVieillesseAnnuelle, "lppRenteInvalidite": lu.renteInvaliditeAnnuelle,
                    "lppRenteConjoint": lu.renteConjointAnnuelle, "lppCapitalDeces": lu.capitalDeces, "lppRachat": lu.rachatPossible,
                    "revenu": lu.salaireAnnuel].filter { $0.value > 0 }
        }
        #endif
        return nil
    }

    private func repondre(_ reponse: [String: Any]) {
        guard let donnees = try? JSONSerialization.data(withJSONObject: reponse), let json = String(data: donnees, encoding: .utf8) else { return }
        vue?.evaluateJavaScript("window.__prevoyanceScan && window.__prevoyanceScan(\(json))")
    }
}

#if canImport(FoundationModels)
/// Ce que le modèle de langage relève sur le certificat (0 = absent du texte).
@available(iOS 26.0, *)
@Generable
struct CertificatLu {
    @Guide(description: "Avoir de vieillesse ou prestation de libre passage à la date du certificat, en francs")
    var avoirVieillesse: Double
    @Guide(description: "Rente de vieillesse annuelle projetée à l'âge de référence, en francs par an")
    var renteVieillesseAnnuelle: Double
    @Guide(description: "Rente d'invalidité annuelle, en francs par an")
    var renteInvaliditeAnnuelle: Double
    @Guide(description: "Rente annuelle de conjoint ou de partenaire survivant, en francs par an")
    var renteConjointAnnuelle: Double
    @Guide(description: "Capital versé en cas de décès, en francs")
    var capitalDeces: Double
    @Guide(description: "Montant maximal de rachat possible, en francs")
    var rachatPossible: Double
    @Guide(description: "Salaire annuel annoncé ou déterminant, en francs")
    var salaireAnnuel: Double
}
#endif
