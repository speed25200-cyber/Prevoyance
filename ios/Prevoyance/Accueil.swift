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
    @State private var arrive = false
    @StateObject private var inclinaison = Inclinaison()
    /// Première apparition depuis le lancement de l'app : le film d'émergence est joué, le texte attend qu'il s'installe.
    @State private var premiere = Accueil.jamaisVu
    private static var jamaisVu = true

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
                    .padding(.top, 300)
                    .offset(x: inclinaison.x * 8, y: inclinaison.y * 6)
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
                                .foregroundStyle(Teinte.boutonEncre)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(
                                    LinearGradient(colors: [Teinte.bouton, Teinte.bouton.opacity(0.9)],
                                                   startPoint: .top, endPoint: .bottom),
                                    in: Capsule())
                                .overlay(Capsule().strokeBorder(Color.white.opacity(0.3), lineWidth: 0.8))
                                .shadow(color: Color.black.opacity(0.4), radius: 18, y: 10)
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
        // l'accueil est une scène de nuit, quel que soit le thème de l'appareil
        .environment(\.colorScheme, .dark)
        .onAppear {
            let attente = premiere && !calme ? 3.4 : 0.05
            Accueil.jamaisVu = false
            withAnimation(.spring(response: 0.9, dampingFraction: 0.86).delay(attente)) { arrive = true }
            inclinaison.demarrer()
            navigation.rafraichirAccueil()
        }
        .onDisappear { inclinaison.arreter() }
    }

    /// Le fond : le film des trois piliers (émergence à la première ouverture, puis boucle), sur son image fixe, sous
    /// un voile qui laisse lire le texte. Il se décale légèrement avec l'inclinaison de l'appareil.
    private var fond: some View {
        let nuit = Teinte.nuit
        return ZStack {
            nuit
            GeometryReader { cadre in
                ZStack {
                    if let image = Accueil.affiche() {
                        Image(uiImage: image).resizable().scaledToFill()
                    }
                    if !calme {
                        FilmAccueil(avecIntro: premiere)
                    }
                }
                .frame(width: cadre.size.width, height: cadre.size.height)
                .scaleEffect(1.06)
                .offset(x: inclinaison.x * -22, y: inclinaison.y * -16)
                .clipped()
            }
            LinearGradient(stops: [.init(color: nuit.opacity(0), location: 0), .init(color: nuit.opacity(0.05), location: 0.42),
                                   .init(color: nuit.opacity(0.78), location: 0.66), .init(color: nuit.opacity(0.96), location: 1)],
                           startPoint: .top, endPoint: .bottom)
        }
        .ignoresSafeArea()
    }

    /// La carte d'un dossier : nom, date, score de couverture en anneau.
    private func carte(_ dossier: DossierResume) -> some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().stroke(Color.primary.opacity(0.12), lineWidth: 4)
                Circle().trim(from: 0, to: arrive ? CGFloat(max(0, min(100, dossier.score))) / 100 : 0)
                    .stroke(Teinte.accent, style: StrokeStyle(lineWidth: 4, lineCap: .round))
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

    /// L'image fixe du film (visible avant que la vidéo démarre, et seule en mouvement réduit).
    private static var imageAffiche: UIImage?
    private static func affiche() -> UIImage? {
        if let imageAffiche { return imageAffiche }
        imageAffiche = FilmAccueil.fichier("accueil.jpg").flatMap { UIImage(contentsOfFile: $0.path) }
        return imageAffiche
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

/// Panneau « Alpin » : une plaque nette, à peine teintée de glace, bordée d'un filet. Les angles restent sobres.
struct VerreArrondi: ViewModifier {
    let rayon: CGFloat

    func body(content: Content) -> some View {
        let forme = RoundedRectangle(cornerRadius: min(rayon, 16), style: .continuous)
        return content
            .background(Teinte.glace.opacity(0.07), in: forme)
            .overlay(forme.strokeBorder(Teinte.glace.opacity(0.16), lineWidth: 1))
    }
}

extension View {
    func verreArrondi(rayon: CGFloat) -> some View { modifier(VerreArrondi(rayon: rayon)) }
}
