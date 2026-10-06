import SwiftUI
import UniformTypeIdentifiers
import WebKit

/// Adresse interne de l'app. Un schéma propre (et non `file://`) : les modules JavaScript, `fetch` et
/// le stockage du navigateur s'y comportent comme sur un vrai site, donc le même code tourne partout.
enum Adresse {
    static let schema = "prevoyance"
    static let accueil = URL(string: "prevoyance://app/web/index.html")!
}

/// L'écran de l'application : la vue web, en plein écran, avec l'impression native du rapport.
struct Ecran: UIViewRepresentable {
    func makeCoordinator() -> Pont { Pont() }

    func makeUIView(context: Context) -> WKWebView {
        let reglages = WKWebViewConfiguration()
        reglages.setURLSchemeHandler(Ressources(), forURLScheme: Adresse.schema)
        // La scène des trois colonnes est une boucle vidéo muette : elle doit jouer dans la page, sans geste.
        reglages.allowsInlineMediaPlayback = true
        reglages.mediaTypesRequiringUserActionForPlayback = []
        // « Enregistrer en PDF » : window.print() n'existe pas dans une vue web iOS, on le confie à l'app.
        let script = "window.print = () => window.webkit.messageHandlers.imprimer.postMessage(document.title);"
        reglages.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        reglages.userContentController.add(context.coordinator, name: "imprimer")

        let vue = WKWebView(frame: .zero, configuration: reglages)
        vue.isOpaque = false
        vue.backgroundColor = .clear
        vue.scrollView.contentInsetAdjustmentBehavior = .never
        vue.scrollView.bounces = false
        vue.allowsLinkPreview = false
        vue.navigationDelegate = context.coordinator
        #if DEBUG
        vue.isInspectable = true
        #endif
        context.coordinator.vue = vue
        vue.load(URLRequest(url: Adresse.accueil))
        return vue
    }

    func updateUIView(_ vue: WKWebView, context: Context) {}
}

/// Reçoit les demandes de la page (impression) et ouvre les liens externes dans Safari.
@MainActor
final class Pont: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    weak var vue: WKWebView?

    func userContentController(_ controleur: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "imprimer", let vue else { return }
        let impression = UIPrintInteractionController.shared
        let infos = UIPrintInfo(dictionary: nil)
        infos.outputType = .general
        infos.jobName = (message.body as? String) ?? "Prévoyance"
        impression.printInfo = infos
        // La mise en page A4 du rapport vient de la feuille de style d'impression de la page.
        impression.printFormatter = vue.viewPrintFormatter()
        impression.present(animated: true)
    }

    func webView(_ vue: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let adresse = action.request.url else { return .cancel }
        if adresse.scheme == Adresse.schema || adresse.scheme == "about" || adresse.scheme == "blob" { return .allow }
        // Sources légales, calculateur de l'AFC… : hors de l'app.
        if action.navigationType == .linkActivated { await UIApplication.shared.open(adresse) }
        return .cancel
    }
}

/// Sert les fichiers embarqués (`web/`, `moteur/`) à la vue web, avec le bon type et les lectures partielles
/// dont la vidéo a besoin.
final class Ressources: NSObject, WKURLSchemeHandler {
    func webView(_ vue: WKWebView, start tache: any WKURLSchemeTask) {
        guard let adresse = tache.request.url, let fichier = Self.fichier(pour: adresse),
              let donnees = try? Data(contentsOf: fichier, options: .mappedIfSafe) else {
            tache.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        var entetes = [
            "Content-Type": Self.type(de: fichier),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        ]
        var corps = donnees
        var statut = 200
        if let plage = tache.request.value(forHTTPHeaderField: "Range"), let (debut, fin) = Self.plage(plage, taille: donnees.count) {
            corps = donnees.subdata(in: debut..<(fin + 1))
            entetes["Content-Range"] = "bytes \(debut)-\(fin)/\(donnees.count)"
            statut = 206
        }
        entetes["Content-Length"] = String(corps.count)
        guard let reponse = HTTPURLResponse(url: adresse, statusCode: statut, httpVersion: "HTTP/1.1", headerFields: entetes) else {
            tache.didFailWithError(URLError(.badServerResponse))
            return
        }
        tache.didReceive(reponse)
        tache.didReceive(corps)
        tache.didFinish()
    }

    func webView(_ vue: WKWebView, stop tache: any WKURLSchemeTask) {}

    /// Le fichier embarqué qui répond à une adresse ; rien en dehors de `web/` et `moteur/`.
    static func fichier(pour adresse: URL) -> URL? {
        let parties = adresse.path.split(separator: "/").map(String.init)
        guard let racine = parties.first, ["web", "moteur"].contains(racine), !parties.contains("..") else { return nil }
        var chemin = Bundle.main.bundleURL
        for partie in parties { chemin.appendPathComponent(partie) }
        var estDossier: ObjCBool = false
        guard FileManager.default.fileExists(atPath: chemin.path, isDirectory: &estDossier) else { return nil }
        return estDossier.boolValue ? chemin.appendingPathComponent("index.html") : chemin
    }

    static func type(de fichier: URL) -> String {
        switch fichier.pathExtension.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "json", "webmanifest": "application/json; charset=utf-8"
        default: UTType(filenameExtension: fichier.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }

    /// Lit un en-tête `Range: bytes=a-b` (b facultatif, ou `bytes=-n` pour les n derniers octets).
    static func plage(_ entete: String, taille: Int) -> (Int, Int)? {
        guard taille > 0, entete.hasPrefix("bytes="), let premiere = entete.dropFirst(6).split(separator: ",").first else { return nil }
        let bornes = premiere.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        guard bornes.count == 2 else { return nil }
        if bornes[0].isEmpty {
            guard let n = Int(bornes[1]), n > 0 else { return nil }
            return (max(0, taille - n), taille - 1)
        }
        guard let debut = Int(bornes[0]), debut < taille else { return nil }
        let fin = min(Int(bornes[1]) ?? (taille - 1), taille - 1)
        return debut <= fin ? (debut, fin) : nil
    }
}
