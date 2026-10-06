import SwiftUI
import UniformTypeIdentifiers
import WebKit

/// Adresse interne de l'app. Un schéma propre (et non `file://`) : les modules JavaScript, `fetch` et
/// le stockage du navigateur s'y comportent comme sur un vrai site, donc le même code tourne partout.
enum Adresse {
    static let schema = "prevoyance"
    static let accueil = URL(string: "prevoyance://app/web/index.html")!
}

/// L'écran de l'application : la page en plein écran et, par-dessus, la barre d'onglets native en verre.
struct Ecran: View {
    @StateObject private var navigation = Navigation()

    var body: some View {
        ZStack(alignment: .bottom) {
            Page(vue: navigation.vue).ignoresSafeArea()
            if navigation.barreVisible {
                BarreOnglets(navigation: navigation)
                    .frame(maxWidth: 560)
                    .padding(.horizontal, 14)
                    .padding(.bottom, -10)
                    .transition(.opacity)
            }
        }
        // le clavier passe par-dessus la barre : elle ne remonte pas sur le formulaire
        .ignoresSafeArea(.keyboard)
    }
}

/// La vue web, posée telle quelle dans l'écran (créée une seule fois par `Navigation`).
struct Page: UIViewRepresentable {
    let vue: WKWebView

    func makeUIView(context: Context) -> WKWebView { vue }
    func updateUIView(_ vue: WKWebView, context: Context) {}
}

/// Ce que la barre d'onglets et la page partagent : la vue ouverte, les libellés dans la langue choisie,
/// et la vue web elle-même. La page prévient l'app (message « onglet ») ; l'app demande une vue à la page.
@MainActor
final class Navigation: ObservableObject {
    static let vues = ["dossier", "analyse", "scenarios", "plan", "rapport", "donnees"]
    static let icones = ["dossier": "person", "analyse": "chart.bar", "scenarios": "arrow.triangle.branch",
                         "plan": "checklist", "rapport": "doc.text", "donnees": "cylinder.split.1x2"]

    @Published var onglet = "analyse"
    @Published var noms = ["dossier": "Dossier", "analyse": "Analyse", "scenarios": "Scénarios",
                           "plan": "Conseil", "rapport": "Rapport", "donnees": "Données"]
    /// La barre n'apparaît qu'une fois la page prête (et se retire devant le code d'accès ou une fenêtre).
    @Published var barreVisible = false

    let vue: WKWebView
    private let pont: Pont

    init() {
        let pont = Pont()
        let reglages = WKWebViewConfiguration()
        reglages.setURLSchemeHandler(Ressources(), forURLScheme: Adresse.schema)
        reglages.allowsInlineMediaPlayback = true
        reglages.mediaTypesRequiringUserActionForPlayback = []
        // « Enregistrer en PDF » : window.print() n'existe pas dans une vue web iOS, on le confie à l'app.
        // La classe « natif » dit à la page que le menu est tenu par l'app : elle retire le sien.
        let script = """
            window.print = () => window.webkit.messageHandlers.imprimer.postMessage(document.title);
            document.documentElement.classList.add('natif');
            """
        reglages.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        reglages.userContentController.add(pont, name: "imprimer")
        // Scan d'un certificat de prévoyance : appareil photo, lecture et compréhension sur l'appareil (Scan.swift).
        reglages.userContentController.add(pont, name: "scanner")
        // Vue ouverte, libellés du menu, barre à montrer ou à retirer.
        reglages.userContentController.add(pont, name: "onglet")

        let vue = WKWebView(frame: .zero, configuration: reglages)
        vue.isOpaque = false
        vue.backgroundColor = .clear
        vue.scrollView.contentInsetAdjustmentBehavior = .never
        vue.scrollView.bounces = false
        vue.allowsLinkPreview = false
        vue.navigationDelegate = pont
        #if DEBUG
        vue.isInspectable = true
        #endif
        pont.vue = vue
        pont.scan = ScanCertificat(vue: vue)
        self.vue = vue
        self.pont = pont
        pont.navigation = self
        vue.load(URLRequest(url: Adresse.accueil))
    }

    /// Un onglet est touché : la bulle glisse, la page change de vue.
    func choisir(_ cible: String) {
        guard Navigation.vues.contains(cible) else { return }
        withAnimation(.spring(response: 0.36, dampingFraction: 0.8)) { onglet = cible }
        vue.evaluateJavaScript("window.__prevoyance && window.__prevoyance.aller && window.__prevoyance.aller('\(cible)')")
    }

    /// Message de la page : `actif` (vue ouverte), `noms` (libellés traduits), `visible` (montrer la barre).
    func recevoir(_ corps: Any) {
        guard let message = corps as? [String: Any] else { return }
        if let libelles = message["noms"] as? [String: String] { noms = libelles }
        if let actif = message["actif"] as? String, Navigation.vues.contains(actif), actif != onglet {
            withAnimation(.spring(response: 0.36, dampingFraction: 0.8)) { onglet = actif }
        }
        if let visible = message["visible"] as? Bool, visible != barreVisible {
            withAnimation(.easeOut(duration: 0.25)) { barreVisible = visible }
        }
    }
}

/// La barre d'onglets : une capsule de verre (« Liquid Glass » d'iOS 26, matériau translucide avant), une bulle
/// qui glisse sous l'onglet ouvert.
struct BarreOnglets: View {
    @ObservedObject var navigation: Navigation
    @Namespace private var espace

    var body: some View {
        Fond {
            HStack(spacing: 0) {
                ForEach(Navigation.vues, id: \.self) { cible in
                    let actif = navigation.onglet == cible
                    Button {
                        navigation.choisir(cible)
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: Navigation.icones[cible] ?? "circle")
                                .font(.system(size: 19, weight: .medium))
                                .frame(height: 24)
                            Text(navigation.noms[cible] ?? cible)
                                .font(.system(size: 10, weight: actif ? .semibold : .medium))
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        }
                        .foregroundStyle(actif ? Color.primary : Color.secondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background {
                            if actif {
                                Capsule().fill(Color.primary.opacity(0.14)).matchedGeometryEffect(id: "bulle", in: espace)
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(actif ? .isSelected : [])
                }
            }
            .padding(5)
        }
    }

    /// Le verre de la barre.
    private struct Fond<Contenu: View>: View {
        @ViewBuilder var contenu: () -> Contenu

        #if compiler(>=6.2)
        var body: some View {
            if #available(iOS 26.0, *) {
                contenu().glassEffect(.regular.interactive(), in: Capsule())
            } else {
                ancien
            }
        }
        #else
        var body: some View { ancien }
        #endif

        private var ancien: some View {
            contenu()
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.2), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.3), radius: 18, y: 10)
        }
    }
}

/// Reçoit les demandes de la page (impression) et ouvre les liens externes dans Safari.
@MainActor
final class Pont: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    weak var vue: WKWebView?
    var scan: ScanCertificat?
    weak var navigation: Navigation?

    func userContentController(_ controleur: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "onglet" { navigation?.recevoir(message.body); return }
        if message.name == "scanner" {
            // « certificat » : appareil photo ; « fichier » : PDF ou image dans Fichiers ; « photo » : photothèque
            switch message.body as? String {
            case "fichier": scan?.choisirFichier()
            case "photo": scan?.choisirPhoto()
            default: scan?.ouvrir()
            }
            return
        }
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

    /// La page se recharge (verrouillage après une absence) : la barre se retire jusqu'à ce qu'elle soit prête.
    func webView(_ vue: WKWebView, didStartProvisionalNavigation chargement: WKNavigation!) {
        navigation?.recevoir(["visible": false])
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
