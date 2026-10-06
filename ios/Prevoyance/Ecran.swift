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
            // écrans dessinés par l'app elle-même ; les autres onglets montrent encore la page
            if navigation.barreVisible && !navigation.accueil {
                if navigation.onglet == "dossier" {
                    DossierNatif(navigation: navigation).transition(.opacity)
                } else if navigation.onglet == "analyse" {
                    AnalyseNatif(navigation: navigation).transition(.opacity)
                } else {
                    // Scénarios, Conseil, Rapport, Données : décrits par la page, dessinés par l'app
                    EcranDecrit(navigation: navigation, vue: navigation.onglet).id(navigation.onglet).transition(.opacity)
                }
            }
            if navigation.barreVisible && !navigation.accueil && !Navigation.natifs.contains(navigation.onglet) {
                // en haut : retour à l'accueil, titre de l'écran comme un grand titre du système, menu des réglages
                VStack {
                    HStack(alignment: .center, spacing: 12) {
                        Button {
                            navigation.montrerAccueil()
                        } label: {
                            Verre {
                                Image(systemName: "house")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Color.primary)
                                    .frame(width: 40, height: 40)
                            }
                        }
                        .buttonStyle(Appui())
                        .accessibilityLabel(Text(navigation.textes["accueil"] ?? "Accueil"))
                        Text(navigation.noms[navigation.onglet] ?? "")
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(Color.primary)
                            .lineLimit(1)
                            .id(navigation.onglet)
                            .transition(.opacity)
                        Spacer(minLength: 12)
                        MenuReglages(navigation: navigation)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 6)
                    Spacer()
                }
                .transition(.opacity)
            }
            if navigation.barreVisible && !navigation.accueil {
                BarreOnglets(navigation: navigation)
                    .frame(maxWidth: 560)
                    .padding(.horizontal, 14)
                    .padding(.bottom, -10)
                    .transition(.opacity)
                    // le clavier passe par-dessus la barre : elle ne remonte pas sur le formulaire
                    .ignoresSafeArea(.keyboard, edges: .bottom)
            }
        }
        // l'accueil couvre tout tant qu'aucun dossier n'est ouvert ; il s'efface en fondu quand on entre dans un dossier
        .overlay {
            if navigation.barreVisible && navigation.accueil {
                Accueil(navigation: navigation)
                    .transition(.opacity.combined(with: .scale(scale: 1.04)))
            }
        }
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
    /// Onglets dont l'écran est dessiné par l'app (SwiftUI), sans passer par la page.
    static let natifs: Set<String> = ["dossier", "analyse", "scenarios", "plan", "rapport", "donnees"]
    static let icones = ["dossier": "person", "analyse": "chart.bar", "scenarios": "arrow.triangle.branch",
                         "plan": "checklist", "rapport": "doc.text", "donnees": "cylinder.split.1x2"]

    @Published var onglet = "analyse"
    @Published var noms = ["dossier": "Dossier", "analyse": "Analyse", "scenarios": "Scénarios",
                           "plan": "Conseil", "rapport": "Rapport", "donnees": "Données"]
    /// La barre n'apparaît qu'une fois la page prête (et se retire devant le code d'accès ou une fenêtre).
    @Published var barreVisible = false
    /// Réglages affichés dans le menu natif ; la page les annonce et les applique.
    @Published var langue = "fr"
    @Published var langues = ["fr", "de", "it", "en"]
    @Published var annee = 2026
    @Published var annees = [2026, 2027]
    /// L'accueil : affiché à l'ouverture, avec les dossiers et les libellés annoncés par la page.
    @Published var accueil = true
    @Published var dossiers: [DossierResume] = []
    @Published var textes: [String: String] = [:]
    /// Le dossier (rubriques et champs décrits par la page) et l'analyse, pour les écrans natifs.
    @Published var rubriques: [Rubrique] = []
    @Published var nomDossier = ""
    @Published var versionSchema = 0
    @Published var analyse: AnalyseModele?
    /// Les autres écrans, tels que la page les décrit, par vue.
    @Published var ecrans: [String: [CarteEcran]] = [:]
    @Published var versionEcran = 0

    let vue: WKWebView
    private let pont: Pont
    private let coffre: Coffre
    /// Autotest (simulateur de l'intégration continue) : demandé par la variable PREVOYANCE_AUTOTEST=1.
    private let autotest = ProcessInfo.processInfo.environment["PREVOYANCE_AUTOTEST"] == "1"
    private var autotestLance = false

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
            window.__erreurs = [];
            addEventListener('error', e => window.__erreurs.push(String(e.message)));
            addEventListener('unhandledrejection', e => window.__erreurs.push('rejet : ' + String(e.reason && e.reason.message || e.reason)));
            """
        reglages.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        reglages.userContentController.add(pont, name: "imprimer")
        // Scan d'un certificat de prévoyance : appareil photo, lecture et compréhension sur l'appareil (Scan.swift).
        reglages.userContentController.add(pont, name: "scanner")
        // Chiffrement des dossiers par un code : la page n'a pas Web Crypto à cette adresse, l'app le fait pour elle (Coffre.swift).
        let coffre = Coffre()
        reglages.userContentController.addScriptMessageHandler(coffre, contentWorld: .page, name: "coffre")
        // Vue ouverte, libellés du menu, barre à montrer ou à retirer.
        reglages.userContentController.add(pont, name: "onglet")

        let vue = WKWebView(frame: .zero, configuration: reglages)
        vue.isOpaque = false
        vue.backgroundColor = .clear
        vue.scrollView.contentInsetAdjustmentBehavior = .never
        // une app ne se zoome pas : ni pincement, ni double-toucher (la page l'interdit aussi dans sa balise viewport)
        vue.scrollView.delegate = pont
        vue.scrollView.pinchGestureRecognizer?.isEnabled = false
        vue.scrollView.minimumZoomScale = 1
        vue.scrollView.maximumZoomScale = 1
        vue.scrollView.bouncesZoom = false
        vue.scrollView.alwaysBounceHorizontal = false
        vue.scrollView.showsHorizontalScrollIndicator = false
        vue.allowsBackForwardNavigationGestures = false
        vue.allowsLinkPreview = false
        vue.navigationDelegate = pont
        #if DEBUG
        vue.isInspectable = true
        #endif
        pont.vue = vue
        pont.scan = ScanCertificat(vue: vue)
        self.vue = vue
        self.pont = pont
        self.coffre = coffre
        pont.navigation = self
        vue.load(URLRequest(url: Adresse.accueil))
    }

    /// Un onglet est touché : la bulle glisse, la page change de vue.
    func choisir(_ cible: String) {
        guard Navigation.vues.contains(cible) else { return }
        withAnimation(.spring(response: 0.36, dampingFraction: 0.8)) { onglet = cible }
        vue.evaluateJavaScript("window.__prevoyance && window.__prevoyance.aller && window.__prevoyance.aller('\(cible)')")
    }

    // MARK: écrans natifs

    /// Une valeur saisie dans le dossier natif : la page l'enregistre et recalcule ; le modèle local suit.
    private func envoyer(_ id: String, _ valeur: Any, garder modifier: (inout Champ) -> Void) {
        for r in rubriques.indices {
            if let c = rubriques[r].champs.firstIndex(where: { $0.id == id }) { modifier(&rubriques[r].champs[c]) }
        }
        vue.callAsyncJavaScript("window.__prevoyance && window.__prevoyance.champ(id, valeur)", arguments: ["id": id, "valeur": valeur],
                                in: nil, in: .page, completionHandler: nil)
    }

    func ecrire(_ id: String, texte: String) { envoyer(id, texte) { $0.texte = texte } }
    func ecrire(_ id: String, montant: Int?) { envoyer(id, montant.map { $0 as Any } ?? NSNull()) { $0.nombre = montant.map(Double.init) } }
    func ecrire(_ id: String, actif: Bool) { envoyer(id, actif) { $0.actif = actif } }
    func ecrire(_ id: String, nombre: Double) { envoyer(id, nombre) { $0.nombre = nombre } }
    /// Image (signature, logo) : la page reçoit l'image, le modèle local retient seulement qu'elle existe.
    func ecrire(_ id: String, texte: String, presence: Double) { envoyer(id, texte) { $0.nombre = presence } }

    /// Action sur un élément d'un écran décrit (curseur, choix, bouton, champ) : la page l'exécute et renvoie l'écran à jour.
    func agir(_ id: String, _ valeur: Any) {
        guard !id.isEmpty else { return }
        vue.callAsyncJavaScript("window.__prevoyance && window.__prevoyance.action(id, valeur)", arguments: ["id": id, "valeur": valeur],
                                in: nil, in: .page, completionHandler: nil)
    }

    /// Demande simple à la page : risque affiché, personne analysée.
    func appeler(_ fonction: String, _ argument: String) {
        guard ["risque", "cible"].contains(fonction) else { return }
        vue.callAsyncJavaScript("window.__prevoyance && window.__prevoyance[fonction](argument)", arguments: ["fonction": fonction, "argument": argument],
                                in: nil, in: .page, completionHandler: nil)
    }

    /// Accueil : ouvrir un dossier (la page l'ouvre et montre son analyse), en créer un, ou y revenir.
    func ouvrir(dossier id: String) {
        guard id.allSatisfy({ $0.isLetter || $0.isNumber }) else { return }
        vue.evaluateJavaScript("window.__prevoyance && window.__prevoyance.ouvrirDossier && window.__prevoyance.ouvrirDossier('\(id)')")
        withAnimation(.easeInOut(duration: 0.45)) { accueil = false }
    }

    func creerDossier(exemple: Bool) {
        vue.evaluateJavaScript("window.__prevoyance && window.__prevoyance.creerDossier && window.__prevoyance.creerDossier(\(exemple))")
        withAnimation(.easeInOut(duration: 0.45)) { accueil = false }
    }

    func montrerAccueil() {
        // la page renvoie la liste à jour des dossiers (noms et scores peuvent avoir changé)
        vue.evaluateJavaScript("window.__prevoyance && window.__prevoyance.annoncer && window.__prevoyance.annoncer()")
        withAnimation(.easeInOut(duration: 0.45)) { accueil = true }
    }

    /// Réglage choisi dans le menu natif : la page l'applique, puis confirme par son message habituel.
    func regler(langue nouvelle: String) {
        guard langues.contains(nouvelle) else { return }
        langue = nouvelle
        vue.evaluateJavaScript("window.__prevoyance && window.__prevoyance.regler && window.__prevoyance.regler({ langue: '\(nouvelle)' })")
    }

    func regler(annee nouvelle: Int) {
        guard annees.contains(nouvelle) else { return }
        annee = nouvelle
        vue.evaluateJavaScript("window.__prevoyance && window.__prevoyance.regler && window.__prevoyance.regler({ annee: \(nouvelle) })")
    }

    /// Autotest : la page exécute web/src/autotest.js dans cette vue web ; le résultat, complété par l'état de la barre
    /// native, est écrit dans les documents de l'app, où le script ios/autotest.sh le lit.
    private func lancerAutotest() async {
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        let demandee = ProcessInfo.processInfo.environment["PREVOYANCE_VUE"] ?? "analyse"
        // « accueil » : l'autotest tourne derrière l'accueil, qui reste à l'écran pour la capture
        let finale = demandee == "accueil" ? "analyse" : demandee
        if demandee != "accueil" { accueil = false }
        let corps = "const m = await import('prevoyance://app/web/src/autotest.js'); return JSON.stringify(await m.executer(finale));"
        var page = "{\"echecs\":1,\"total\":1,\"resultats\":[{\"nom\":\"script d'autotest\",\"ok\":false,\"detail\":\"non exécuté\"}]}"
        if let retour = try? await vue.callAsyncJavaScript(corps, arguments: ["finale": finale], in: nil, contentWorld: .page) as? String {
            page = retour
        }
        let app = "{\"barre\":\(barreVisible),\"onglet\":\"\(onglet)\",\"noms\":\(noms.count),\"dossiers\":\(dossiers.count),\"textes\":\(textes.count),"
            + "\"rubriques\":\(rubriques.count),\"champs\":\(rubriques.reduce(0) { $0 + $1.champs.count }),\"analyse\":\(analyse != nil),\"risques\":\(analyse?.risques.count ?? 0),\"ligne\":\(analyse?.ligne.count ?? 0),"
            + "\"ecrans\":{" + ["scenarios", "plan", "rapport", "donnees"].map { "\"\($0)\":\(ecrans[$0]?.count ?? 0)" }.joined(separator: ",") + "}}"
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? "{\"page\":\(page),\"app\":\(app)}".write(to: documents.appendingPathComponent("autotest.json"), atomically: true, encoding: .utf8)
    }

    /// Message de la page : `actif` (vue ouverte), `noms` (libellés traduits), `visible` (montrer la barre).
    func recevoir(_ corps: Any) {
        guard let message = corps as? [String: Any] else { return }
        if let schema = message["schema"] as? [String: Any] {
            rubriques = (schema["rubriques"] as? [[String: Any]] ?? []).compactMap(Rubrique.init)
            nomDossier = schema["nom"] as? String ?? ""
            versionSchema += 1
        }
        if let modele = message["analyse"] as? [String: Any], let lu = AnalyseModele(modele), lu != analyse { analyse = lu }
        if let ecran = message["ecran"] as? [String: Any], let vue = ecran["vue"] as? String {
            ecrans[vue] = CarteEcran.lire(ecran)
            versionEcran += 1
        }
        if let libelles = message["noms"] as? [String: String] { noms = libelles }
        if let valeur = message["langue"] as? String, valeur != langue { langue = valeur }
        if let valeurs = message["langues"] as? [String], valeurs != langues { langues = valeurs }
        if let valeur = message["annee"] as? Int, valeur != annee { annee = valeur }
        if let valeurs = message["annees"] as? [Int], valeurs != annees { annees = valeurs }
        if let libelles = message["textes"] as? [String: String], libelles != textes { textes = libelles }
        if let liste = message["dossiers"] as? [[String: Any]] {
            let resumes = liste.compactMap { d -> DossierResume? in
                guard let id = d["id"] as? String else { return nil }
                return DossierResume(id: id, nom: d["nom"] as? String ?? "", date: d["date"] as? String ?? "",
                                     score: d["score"] as? Int ?? 0, ouvert: d["ouvert"] as? Bool ?? false)
            }
            if resumes != dossiers { dossiers = resumes }
        }
        if let actif = message["actif"] as? String, Navigation.vues.contains(actif), actif != onglet {
            withAnimation(.spring(response: 0.36, dampingFraction: 0.8)) { onglet = actif }
        }
        if let visible = message["visible"] as? Bool, visible != barreVisible {
            withAnimation(.easeOut(duration: 0.25)) { barreVisible = visible }
        }
        if autotest, barreVisible, !autotestLance {
            autotestLance = true
            Task { await lancerAutotest() }
        }
    }
}

/// Le menu des réglages, en haut à droite : année des règles et langue, dans un bouton de verre.
struct MenuReglages: View {
    @ObservedObject var navigation: Navigation
    private static let nomsLangues = ["fr": "Français", "de": "Deutsch", "it": "Italiano", "en": "English"]

    var body: some View {
        Menu {
            Picker("", selection: Binding(get: { navigation.annee }, set: { navigation.regler(annee: $0) })) {
                ForEach(navigation.annees, id: \.self) { an in Text(String(an)).tag(an) }
            }
            Picker("", selection: Binding(get: { navigation.langue }, set: { navigation.regler(langue: $0) })) {
                ForEach(navigation.langues, id: \.self) { code in Text(MenuReglages.nomsLangues[code] ?? code.uppercased()).tag(code) }
            }
        } label: {
            Verre {
                HStack(spacing: 6) {
                    Text(String(navigation.annee)).font(.system(size: 15, weight: .semibold))
                    Text(navigation.langue.uppercased()).font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.secondary)
                    Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.secondary)
                }
                .foregroundStyle(Color.primary)
                .padding(.horizontal, 14)
                .frame(height: 40)
            }
        }
    }
}

/// La barre d'onglets : une capsule de verre (« Liquid Glass » d'iOS 26, matériau translucide avant), une bulle
/// qui glisse sous l'onglet ouvert.
struct BarreOnglets: View {
    @ObservedObject var navigation: Navigation
    @Namespace private var espace

    var body: some View {
        Verre {
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

}

/// Le verre des éléments qui flottent (barre d'onglets, menu) : « Liquid Glass » d'iOS 26, matériau translucide avant.
struct Verre<Contenu: View>: View {
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

/// Reçoit les demandes de la page (impression) et ouvre les liens externes dans Safari.
@MainActor
final class Pont: NSObject, WKScriptMessageHandler, WKNavigationDelegate, UIScrollViewDelegate {
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

    /// Aucun zoom : la vue de défilement n'a rien à agrandir.
    func viewForZooming(in vueDefilement: UIScrollView) -> UIView? { nil }

    func scrollViewWillBeginZooming(_ vueDefilement: UIScrollView, with vue: UIView?) {
        vueDefilement.pinchGestureRecognizer?.isEnabled = false
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
