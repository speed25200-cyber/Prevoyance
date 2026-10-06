import SwiftUI

/// Un dossier dans la liste de l'accueil (résumé envoyé par la page : rien d'autre n'est gardé côté app).
struct DossierResume: Identifiable, Equatable {
    let id: String
    let nom: String
    let date: String
    let score: Int
    let ouvert: Bool
}

/// L'écran d'accueil : ce que l'on voit à l'ouverture de l'app.
/// La scène des trois piliers en fond (elle respire lentement), le nom de l'app, les dossiers en cartes de verre avec
/// leur score de couverture, et le geste principal : ouvrir un dossier ou en créer un.
struct Accueil: View {
    @ObservedObject var navigation: Navigation
    @Environment(\.colorScheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var calme
    @State private var souffle = false
    @State private var arrive = false

    var body: some View {
        ZStack {
            fond
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 30) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text((navigation.textes["titre"] ?? "Prévoyance").uppercased())
                            .font(.system(size: 13, weight: .semibold))
                            .tracking(5)
                            .foregroundStyle(Color.secondary)
                        Text(navigation.textes["accroche"] ?? "")
                            .font(.system(size: 42, weight: .bold))
                            .foregroundStyle(Color.primary)
                            .minimumScaleFactor(0.7)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 220)
                    .opacity(arrive ? 1 : 0)
                    .offset(y: arrive ? 0 : 18)

                    VStack(alignment: .leading, spacing: 12) {
                        Text((navigation.textes["dossiers"] ?? "").uppercased())
                            .font(.system(size: 12, weight: .semibold))
                            .tracking(2.4)
                            .foregroundStyle(Color.secondary)
                            .padding(.leading, 4)
                        ForEach(Array(navigation.dossiers.enumerated()), id: \.element.id) { rang, dossier in
                            Button {
                                navigation.ouvrir(dossier: dossier.id)
                            } label: {
                                carte(dossier)
                            }
                            .buttonStyle(Appui())
                            .opacity(arrive ? 1 : 0)
                            .offset(y: arrive ? 0 : 24)
                            .animation(.spring(response: 0.6, dampingFraction: 0.82).delay(0.12 + Double(rang) * 0.06), value: arrive)
                        }
                    }

                    HStack(spacing: 12) {
                        Button {
                            navigation.creerDossier(exemple: false)
                        } label: {
                            Label(navigation.textes["nouveau"] ?? "", systemImage: "plus")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(Color.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(
                                    LinearGradient(colors: [Color(red: 0.35, green: 0.61, blue: 1), Color(red: 0.08, green: 0.34, blue: 0.84)],
                                                   startPoint: .top, endPoint: .bottom),
                                    in: Capsule())
                                .overlay(Capsule().strokeBorder(Color.white.opacity(0.3), lineWidth: 0.8))
                                .shadow(color: Color(red: 0.12, green: 0.39, blue: 0.91).opacity(0.55), radius: 18, y: 10)
                        }
                        .buttonStyle(Appui())
                        Button {
                            navigation.creerDossier(exemple: true)
                        } label: {
                            Text(navigation.textes["exemple"] ?? "")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundStyle(Color.primary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                                .padding(.horizontal, 20)
                                .frame(height: 56)
                                .verreArrondi(rayon: 28)
                        }
                        .buttonStyle(Appui())
                    }
                    .opacity(arrive ? 1 : 0)
                    .animation(.easeOut(duration: 0.5).delay(0.3), value: arrive)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 48)
                .frame(maxWidth: 680, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) { arrive = true }
            if !calme { withAnimation(.easeInOut(duration: 16).repeatForever(autoreverses: true)) { souffle = true } }
        }
    }

    /// Le fond : la scène des trois piliers, sous un voile qui laisse lire le texte.
    private var fond: some View {
        let sombre = theme == .dark
        let base = sombre ? Color(red: 0.016, green: 0.035, blue: 0.075) : Color(red: 0.92, green: 0.94, blue: 0.97)
        return ZStack {
            base
            if let image = Accueil.scene(sombre: sombre) {
                GeometryReader { cadre in
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: cadre.size.width, height: min(cadre.size.height * 0.62, 620), alignment: .trailing)
                        .scaleEffect(souffle ? 1.08 : 1, anchor: .trailing)
                        .clipped()
                        .mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .top, endPoint: .bottom))
                }
            }
            LinearGradient(colors: [base.opacity(0.1), base.opacity(0.55), base], startPoint: .top, endPoint: .center)
        }
        .ignoresSafeArea()
    }

    /// La carte d'un dossier : nom, date, score de couverture en anneau.
    private func carte(_ dossier: DossierResume) -> some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().stroke(Color.primary.opacity(0.12), lineWidth: 4)
                Circle().trim(from: 0, to: arrive ? CGFloat(max(0, min(100, dossier.score))) / 100 : 0)
                    .stroke(Color(red: 0.18, green: 0.49, blue: 0.96), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 1.1).delay(0.3), value: arrive)
                Text(String(dossier.score)).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.primary)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 3) {
                Text(dossier.nom).font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1)
                Text(dossier.date).font(.system(size: 14)).foregroundStyle(Color.secondary)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.secondary)
        }
        .padding(.horizontal, 18)
        .frame(height: 78)
        .verreArrondi(rayon: 26)
    }

    /// L'image de la scène, prise dans les écrans embarqués (une seule lecture par thème).
    private static var images: [Bool: UIImage] = [:]
    private static func scene(sombre: Bool) -> UIImage? {
        if let connue = images[sombre] { return connue }
        let chemin = Bundle.main.bundleURL.appendingPathComponent("web/images/colonnes-\(sombre ? "sombre" : "clair")-m.webp").path
        let image = UIImage(contentsOfFile: chemin)
        if let image { images[sombre] = image }
        return image
    }
}

/// Réponse au toucher : l'élément s'enfonce légèrement, comme les commandes du système.
struct Appui: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// Verre d'un panneau arrondi : « Liquid Glass » d'iOS 26, matériau translucide avant.
struct VerreArrondi: ViewModifier {
    let rayon: CGFloat

    #if compiler(>=6.2)
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: rayon, style: .continuous))
        } else {
            ancien(content)
        }
    }
    #else
    func body(content: Content) -> some View { ancien(content) }
    #endif

    private func ancien(_ content: Content) -> some View {
        content
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: rayon, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: rayon, style: .continuous).strokeBorder(Color.white.opacity(0.18), lineWidth: 0.6))
    }
}

extension View {
    func verreArrondi(rayon: CGFloat) -> some View { modifier(VerreArrondi(rayon: rayon)) }
}
