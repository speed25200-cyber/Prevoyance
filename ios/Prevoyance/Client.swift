import Charts
import SwiftUI

/// Les écrans où l'on entre depuis l'accueil. Un écran, une idée : la synthèse du client, un risque, le conseil,
/// une question de scénario, le rapport, une rubrique du dossier.
enum Lieu: Hashable {
    case client
    case risque(String)
    case alertes
    /// Section « Risques » : tous les risques et la ligne de vie.
    case risques
    case conseil
    case scenarios
    case rapport
    case dossier
    case rubrique(String)
    case donnees
    /// Une carte d'un écran décrit par la page (une question de scénario, un réglage du conseil…).
    case carte(String, Int)
}

/// L'écran qui correspond à un lieu.
struct Destination: View {
    @ObservedObject var navigation: Navigation
    let lieu: Lieu

    var body: some View {
        switch lieu {
        case .client: ClientNatif(navigation: navigation)
        case .risques: RisquesNatif(navigation: navigation)
        case .risque(let cle): RisqueNatif(navigation: navigation, cle: cle)
        case .alertes: AlertesNatif(navigation: navigation)
        case .conseil: ConseilNatif(navigation: navigation)
        case .scenarios: EcranCartes(navigation: navigation, vue: "scenarios", ouvertes: 0)
        case .rapport: EcranCartes(navigation: navigation, vue: "rapport", ouvertes: 1)
        case .donnees: EcranCartes(navigation: navigation, vue: "donnees", ouvertes: 1)
        case .dossier: DossierNatif(navigation: navigation)
        case .rubrique(let id):
            if let rubrique = navigation.rubriques.first(where: { $0.id == id }) {
                RubriqueNative(navigation: navigation, rubrique: rubrique).id("\(id)-\(navigation.versionSchema)")
            } else {
                FondApp()
            }
        case .carte(let vue, let rang): CarteNative(navigation: navigation, vue: vue, rang: rang)
        }
    }
}

// MARK: éléments communs

/// Le corps d'un écran : une colonne qui défile, de largeur lisible, sur le fond de l'app.
struct Feuille<Contenu: View>: View {
    /// Écran qui se met en deux colonnes sur iPad : il prend alors toute la largeur utile.
    var large = false
    /// Les Alpes de nuit en haut de la page, derrière le contenu.
    var montagne = false
    @ViewBuilder var contenu: () -> Contenu
    @Environment(\.horizontalSizeClass) private var classe

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) { contenu() }
                .padding(.horizontal, classe == .regular ? 32 : 20)
                .padding(.top, 8)
                .padding(.bottom, 28)
                .frame(maxWidth: large && classe == .regular ? 1120 : 680, alignment: .leading)
                .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FondApp())
    }
}

/// Deux colonnes côte à côte sur grand écran (iPad), l'une sous l'autre sur iPhone.
struct Colonnes<Gauche: View, Droite: View>: View {
    @Environment(\.horizontalSizeClass) private var classe
    @ViewBuilder var gauche: () -> Gauche
    @ViewBuilder var droite: () -> Droite

    var body: some View {
        if classe == .regular {
            HStack(alignment: .top, spacing: 28) {
                VStack(alignment: .leading, spacing: 18) { gauche() }.frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 18) { droite() }.frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            gauche()
            droite()
        }
    }
}

/// Une ligne où l'on entre : un titre, une précision, une flèche.
struct Tuile: View {
    let titre: String
    var note = ""
    var symbole = ""

    var body: some View {
        HStack(spacing: 14) {
            if !symbole.isEmpty {
                Image(systemName: symbole).font(.system(size: 18, weight: .medium)).foregroundStyle(Teinte.accent).frame(width: 26)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(titre).font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.primary)
                    .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                if !note.isEmpty {
                    Text(note).font(.system(size: 14)).foregroundStyle(Color.secondary)
                        .multilineTextAlignment(.leading).lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .verreArrondi(rayon: 16)
    }
}

/// L'attente d'un écran que la page n'a pas encore décrit.
struct Attente: View {
    var body: some View {
        ProgressView().frame(maxWidth: .infinity).padding(.top, 120)
    }
}

extension View {
    /// Le geste principal de l'écran, toujours au même endroit : en bas, sous le pouce.
    func boutonBas(_ titre: String, action: @escaping () -> Void) -> some View {
        safeAreaInset(edge: .bottom) {
            if !titre.isEmpty {
                Button(action: action) {
                    HStack(spacing: 10) {
                        Text(titre).font(.system(size: 17, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                        Image(systemName: "arrow.right").font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(Teinte.boutonEncre)
                    .frame(maxWidth: 600)
                    .frame(height: 56)
                    .background(Teinte.bouton, in: Capsule())
                }
                .buttonStyle(Appui())
                .padding(.horizontal, 20)
                .padding(.top, 14)
                .padding(.bottom, 6)
                .frame(maxWidth: .infinity)
                .background(LinearGradient(colors: [Teinte.nuitBasse.opacity(0), Teinte.nuitBasse], startPoint: .top, endPoint: .center).ignoresSafeArea())
            }
        }
    }
}

/// La montagne de l'accueil, en filigrane derrière le score.
struct Montagne: View {
    /// Présence de l'image (0 : invisible, 1 : pleine).
    var force = 0.34
    private static let image: UIImage? = FilmAccueil.fichier("accueil.jpg").flatMap { UIImage(contentsOfFile: $0.path) }

    var body: some View {
        Color.clear
            .overlay {
                if let image = Montagne.image {
                    Image(uiImage: image).resizable().scaledToFill().opacity(force)
                }
            }
            .clipped()
            .mask(LinearGradient(colors: [.clear, .black, .clear], startPoint: .top, endPoint: .bottom))
            .allowsHitTesting(false)
    }
}

// MARK: synthèse du client

/// Un anneau de couverture : la part couverte s'allume, le reste reste en creux.
struct Anneau: View {
    let part: Double
    var epaisseur: CGFloat = 6

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.12), lineWidth: epaisseur)
            Circle().trim(from: 0, to: CGFloat(Swift.max(0.004, Swift.min(1, part))))
                .stroke(LinearGradient(colors: [Teinte.pilier2, Teinte.eclat, Color.white], startPoint: .bottomLeading, endPoint: .topTrailing),
                        style: StrokeStyle(lineWidth: epaisseur, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: Color.white.opacity(0.22), radius: epaisseur * 0.5)
        }
    }
}

/// Une carte du tableau de bord : le verre du système.
struct TuileBord: ViewModifier {
    func body(content: Content) -> some View {
        content.modifier(VerreCarte(rayon: 24))
    }
}

extension View {
    func tuileBord() -> some View { modifier(TuileBord()) }
}

/// Le titre d'une section, en tête de page (les écrans de section n'ont pas la barre du système).
struct TitreSection: View {
    let titre: String

    var body: some View {
        Text(titre).font(.system(size: 28, weight: .semibold)).foregroundStyle(Color.primary).padding(.top, 4)
    }
}

/// L'en-tête d'une carte : un pictogramme, un titre.
struct TitreCarte: View {
    let titre: String
    let symbole: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbole).font(.system(size: 14, weight: .semibold)).foregroundStyle(Teinte.eclat)
            Text(titre).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
        }
    }
}

/// Le panorama des Alpes de nuit (bandeau, pied de la barre latérale, bas du conseil).
struct Panorama: View {
    private static let image: UIImage? = FilmAccueil.fichier("panorama.jpg").flatMap { UIImage(contentsOfFile: $0.path) }
    var ancrage: Alignment = .center

    var body: some View {
        Color.clear
            .overlay(alignment: ancrage) {
                if let image = Panorama.image { Image(uiImage: image).resizable().scaledToFill() }
            }
            .clipped()
            .allowsHitTesting(false)
    }
}

/// La marque : la montagne et le nom de l'app.
struct Marque: View {
    @ObservedObject var navigation: Navigation

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "mountain.2.fill").font(.system(size: 16, weight: .semibold)).foregroundStyle(Teinte.eclat)
            Text(navigation.textes["titre"] ?? "Prévoyance").font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.primary)
        }
    }
}

/// Les sections d'un client : Synthèse, Risques, Conseil, Scénarios, Rapport, Dossier.
/// Sur iPad, une barre latérale ; sur iPhone, des onglets qui défilent en haut de l'écran.
enum Sections {
    struct Section: Identifiable {
        let id: Int
        let lieu: Lieu?
        let nom: String
        let symbole: String
    }

    @MainActor static func liste(_ navigation: Navigation) -> [Section] {
        let noms = navigation.noms
        // le dernier champ marque les outils du conseiller, retirés en présentation client
        let toutes: [(Lieu?, String, String, Bool)] = [
            (nil, navigation.textes["synthese"] ?? noms["analyse"] ?? "", "house", false),
            (.risques, navigation.textes["risques"] ?? "Risques", "shield.lefthalf.filled", false),
            (.conseil, noms["plan"] ?? "", "lightbulb", false),
            (.scenarios, noms["scenarios"] ?? "", "arrow.triangle.branch", false),
            (.rapport, noms["rapport"] ?? "", "doc.text", true),
            (.dossier, noms["dossier"] ?? "", "folder", true),
        ]
        return toutes.enumerated().filter { !(navigation.presentation && $0.element.3) }
            .map { Section(id: $0.offset, lieu: $0.element.0, nom: $0.element.1, symbole: $0.element.2) }
    }

    /// La section affichée : le deuxième écran du chemin (rien : la synthèse).
    @MainActor static func courante(_ navigation: Navigation) -> Lieu? {
        navigation.chemin.count > 1 ? navigation.chemin[1] : nil
    }
}

/// iPad : la barre latérale. En haut la marque, puis les sections ; en bas, la montagne et la devise.
struct RailSections: View {
    @ObservedObject var navigation: Navigation
    /// Écran étroit : pictogrammes seuls, pour laisser la place au contenu.
    var reduite = false

    var body: some View {
        let ici = Sections.courante(navigation)
        VStack(alignment: .leading, spacing: 6) {
            if reduite {
                Image(systemName: "mountain.2.fill").font(.system(size: 20, weight: .semibold)).foregroundStyle(Teinte.eclat)
                    .frame(maxWidth: .infinity).padding(.top, 8).padding(.bottom, 14)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Marque(navigation: navigation)
                    Text(navigation.textes["sousTitre"] ?? "").font(.system(size: 11)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 8).padding(.top, 8).padding(.bottom, 16)
            }
            ForEach(Sections.liste(navigation)) { section in
                let actif = section.lieu == ici
                Button {
                    navigation.section(section.lieu)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: section.symbole).font(.system(size: reduite ? 19 : 17, weight: .medium)).frame(width: 24)
                        if !reduite {
                            Text(section.nom).font(.system(size: 15, weight: actif ? .semibold : .regular)).lineLimit(1).minimumScaleFactor(0.8)
                            Spacer(minLength: 0)
                        }
                    }
                    .foregroundStyle(actif ? Color.white : Color.primary.opacity(0.72))
                    .padding(.horizontal, 12)
                    .frame(maxWidth: reduite ? .infinity : nil)
                    .frame(height: 48)
                    .background {
                        if actif {
                            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.16))
                                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.white.opacity(0.22), lineWidth: 0.8))
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(section.nom))
                .accessibilityAddTraits(actif ? .isSelected : [])
            }
            Spacer(minLength: 0)
            // revenir à la liste des clients ; année des règles, langue, présentation
            Button {
                navigation.montrerAccueil()
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "person.2").font(.system(size: reduite ? 19 : 17, weight: .medium)).frame(width: 24)
                    if !reduite {
                        Text(navigation.textes["dossiers"] ?? "").font(.system(size: 15)).lineLimit(1).minimumScaleFactor(0.8)
                        Spacer(minLength: 0)
                    }
                }
                .foregroundStyle(Color.primary.opacity(0.72))
                .padding(.horizontal, 12)
                .frame(maxWidth: reduite ? .infinity : nil)
                .frame(height: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(navigation.textes["dossiers"] ?? "Clients"))
            MenuOutils(navigation: navigation)
                .padding(.horizontal, reduite ? 0 : 12)
                .frame(maxWidth: reduite ? .infinity : nil, alignment: .leading)
                .frame(height: 40)
            if !reduite {
                Text(navigation.textes["devise"] ?? "").font(.system(size: 12.5)).foregroundStyle(Color.secondary)
                    .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 12).padding(.top, 6).padding(.bottom, 4)
            }
        }
        .padding(12)
        .frame(width: reduite ? 76 : 220)
        .frame(maxHeight: .infinity)
        // un panneau de verre qui flotte au bord de l'écran, comme les barres latérales d'iPadOS
        .modifier(VerreCarte(rayon: 30))
        .padding(.leading, 12)
        .padding(.vertical, 10)
    }
}

/// iPhone : les sections en onglets, sur une ligne qui défile ; l'onglet ouvert est plein et lumineux.
struct OngletsSections: View {
    @ObservedObject var navigation: Navigation

    var body: some View {
        let ici = Sections.courante(navigation), sections = Sections.liste(navigation)
        ScrollViewReader { defile in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(sections) { section in
                        let actif = section.lieu == ici
                        Button {
                            navigation.section(section.lieu)
                        } label: {
                            Text(section.nom).font(.system(size: 14, weight: actif ? .semibold : .medium))
                                .foregroundStyle(actif ? Teinte.boutonEncre : Color.primary.opacity(0.8))
                                .padding(.horizontal, 15)
                                .frame(height: 34)
                                .background(actif ? Color.white.opacity(0.92) : Color.white.opacity(0.09), in: Capsule())
                                .overlay(Capsule().strokeBorder(Color.white.opacity(actif ? 0 : 0.16), lineWidth: 0.8))
                        }
                        .buttonStyle(.plain)
                        .id(section.id)
                        .accessibilityAddTraits(actif ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
            }
            .onAppear {
                if let ouverte = sections.first(where: { $0.lieu == ici }) { defile.scrollTo(ouverte.id, anchor: .center) }
            }
        }
    }
}

/// Le cadre des écrans de section : la barre latérale sur iPad, les onglets du haut sur iPhone.
struct CadreSections: ViewModifier {
    @ObservedObject var navigation: Navigation
    @Environment(\.horizontalSizeClass) private var classe

    func body(content: Content) -> some View {
        if classe == .regular {
            GeometryReader { cadre in
                // iPad en portrait : la barre se réduit aux pictogrammes, le contenu garde deux vraies colonnes
                content.safeAreaInset(edge: .leading, spacing: 0) { RailSections(navigation: navigation, reduite: cadre.size.width < 1000) }
            }
            // le menu latéral tient lieu de barre : celle du système se retire
            .toolbar(.hidden, for: .navigationBar)
        } else {
            content
                .safeAreaInset(edge: .top, spacing: 0) {
                    VStack(spacing: 0) {
                        HStack(spacing: 14) {
                            Marque(navigation: navigation)
                            Spacer(minLength: 8)
                            MenuOutils(navigation: navigation)
                            Button {
                                navigation.montrerAccueil()
                            } label: {
                                Image(systemName: "person.2").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.primary)
                                    .frame(width: 38, height: 38)
                                    .background(Color.white.opacity(0.1), in: Circle())
                                    .overlay(Circle().strokeBorder(Color.white.opacity(0.16), lineWidth: 0.8))
                            }
                            .buttonStyle(Appui())
                            .accessibilityLabel(Text(navigation.textes["dossiers"] ?? "Clients"))
                        }
                        .padding(.horizontal, 20)
                        .frame(height: 48)
                        OngletsSections(navigation: navigation)
                    }
                    .background(.ultraThinMaterial.opacity(0.96), ignoresSafeAreaEdges: .top)
                }
                .toolbar(.hidden, for: .navigationBar)
        }
    }
}

extension View {
    func cadreSections(_ navigation: Navigation) -> some View { modifier(CadreSections(navigation: navigation)) }
}

/// La ligne de vie : par âge, ce que versent le salaire et chaque pilier, en nappes superposées, face au besoin
/// (en pointillé). Un repère marque l'âge de la retraite.
struct LigneDeVie: View {
    let a: AnalyseModele
    var hauteur: CGFloat = 240

    var body: some View {
        let noms = a.legende
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                TitreCarte(titre: a.ligneTitre, symbole: "chart.xyaxis.line")
                Text(a.ligneNote).font(.system(size: 13)).foregroundStyle(Color.secondary)
            }
            Chart {
                // quatre nappes empilées, du salaire au 3e pilier : la couleur fait la série
                ForEach(0..<4, id: \.self) { rang in
                    ForEach(a.ligne) { point in
                        AreaMark(x: .value("âge", Double(point.id)), y: .value("revenu", [point.salaire, point.p1, point.p2, point.p3][rang]), stacking: .standard)
                            .interpolationMethod(.monotone)
                            .foregroundStyle(by: .value("source", noms[rang]))
                    }
                }
                ForEach(a.ligne) { point in
                    LineMark(x: .value("âge", Double(point.id)), y: .value("besoin", point.besoin), series: .value("série", noms[4]))
                        .interpolationMethod(.stepCenter)
                        .lineStyle(StrokeStyle(lineWidth: 1.6, dash: [5, 4]))
                        .foregroundStyle(Color.white.opacity(0.85))
                }
                if a.repereAge > 0 {
                    RuleMark(x: .value("âge", a.repereAge))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        .foregroundStyle(Teinte.accent.opacity(0.8))
                        .annotation(position: .top, alignment: .center, spacing: 2) {
                            Text(a.repereTexte).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.primary)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(Teinte.nuit.opacity(0.7), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(Color.white.opacity(0.25), lineWidth: 0.8))
                        }
                }
            }
            .chartXScale(domain: Double(a.ligne.first?.id ?? 0)...Double(a.ligne.last?.id ?? 100))
            .chartForegroundStyleScale(domain: Array(noms.prefix(4)), range: [Teinte.salaire, Teinte.pilier1, Teinte.eclat, Teinte.pilier3])
            .chartYAxis {
                AxisMarks(position: .leading) { valeur in
                    AxisGridLine().foregroundStyle(Teinte.accent.opacity(0.1))
                    AxisValueLabel {
                        if let montant = valeur.as(Double.self) { Text(montant >= 1000 ? "\(Int(montant / 1000))k" : "\(Int(montant))") }
                    }
                }
            }
            // la légende sous le graphique : le haut reste au repère de la retraite
            .chartLegend(position: .bottom, alignment: .leading)
            .frame(height: hauteur)
        }
        .padding(16)
        .tuileBord()
    }
}

/// Un risque sur une ligne : l'anneau de sa couverture, son nom, ce qu'il manque par mois (ou la coche).
struct LigneRisque: View {
    let risque: AnalyseModele.Risque

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Anneau(part: risque.couverture, epaisseur: 4.5)
                Text("\(Int((risque.couverture * 100).rounded()))%").font(.system(size: 11, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(risque.nom).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1).minimumScaleFactor(0.75)
                if risque.lacune {
                    Text("\(risque.montant) · \(risque.note)").font(.system(size: 13, weight: .medium)).monospacedDigit().foregroundStyle(Teinte.accent).lineLimit(1).minimumScaleFactor(0.7)
                } else {
                    Text(risque.note).font(.system(size: 13)).foregroundStyle(Color.secondary).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            Spacer(minLength: 6)
            if !risque.lacune && risque.montant != "—" {
                Image(systemName: "checkmark").font(.system(size: 14, weight: .semibold)).foregroundStyle(Teinte.eclat)
            }
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.secondary)
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 62)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.white.opacity(0.10), lineWidth: 0.8))
    }
}

/// La carte « Risques » : tous les risques, chacun ouvre son détail.
struct CarteRisques: View {
    @ObservedObject var navigation: Navigation
    let a: AnalyseModele

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TitreCarte(titre: navigation.textes["risques"] ?? "Risques", symbole: "shield.lefthalf.filled")
            ForEach(a.risques) { risque in
                NavigationLink(value: Lieu.risque(risque.id)) { LigneRisque(risque: risque) }.buttonStyle(Appui())
            }
        }
        .padding(14)
        .tuileBord()
    }
}

/// Les risques d'un client et, à côté, la ligne de vie.
struct RisquesNatif: View {
    @ObservedObject var navigation: Navigation

    var body: some View {
        Feuille(large: true) {
            TitreSection(titre: navigation.textes["risques"] ?? "Risques")
            if let a = navigation.analyse {
                Colonnes {
                    CarteRisques(navigation: navigation, a: a)
                } droite: {
                    LigneDeVie(a: a, hauteur: 260)
                    if !a.alertes.isEmpty {
                        NavigationLink(value: Lieu.alertes) {
                            Tuile(titre: a.alertesTitre, note: String(a.alertes.count), symbole: "exclamationmark.circle")
                        }
                        .buttonStyle(Appui())
                    }
                }
            } else {
                Attente()
            }
        }
        .navigationTitle(navigation.textes["risques"] ?? "Risques")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { OutilsEcran(navigation: navigation) }
        .cadreSections(navigation)
    }
}

/// Le tableau de bord d'un client : sa couverture dans un anneau, la ligne de vie, les risques, les trois piliers,
/// la prochaine échéance et le ménage. Sur iPad en paysage, trois colonnes sous un bandeau de montagnes.
struct ClientNatif: View {
    @ObservedObject var navigation: Navigation
    @Environment(\.horizontalSizeClass) private var classe

    var body: some View {
        GeometryReader { cadre in
            // trois colonnes quand la place le permet (iPad en paysage), deux sur iPad en portrait, une sur iPhone
            let trois = classe == .regular && cadre.size.width >= 900
            Feuille(large: true, montagne: true) {
                if let a = navigation.analyse {
                    if classe == .regular { bandeau(a) } else { Text(navigation.nomDossier).font(.system(size: 24, weight: .semibold)).padding(.top, 2) }
                    if trois {
                        HStack(alignment: .top, spacing: 16) {
                            VStack(spacing: 14) {
                                score(a)
                                if let menage = a.menage { foyer(menage) }
                                if !a.colonnes.isEmpty { piliers(a) }
                            }
                            .frame(maxWidth: .infinity)
                            VStack(spacing: 14) {
                                LigneDeVie(a: a, hauteur: 330)
                                alertes(a)
                            }
                            .frame(maxWidth: .infinity)
                            .layoutPriority(1)
                            VStack(spacing: 14) {
                                CarteRisques(navigation: navigation, a: a)
                                if let prochaine = a.prochaine { echeance(prochaine) }
                            }
                            .frame(maxWidth: .infinity)
                        }
                    } else {
                        Colonnes {
                            if classe != .regular { cible(a) }
                            score(a)
                            if !a.colonnes.isEmpty { piliers(a) }
                            if classe == .regular, let menage = a.menage { foyer(menage) }
                        } droite: {
                            CarteRisques(navigation: navigation, a: a)
                            if classe == .regular { LigneDeVie(a: a, hauteur: 220) }
                            if let prochaine = a.prochaine { echeance(prochaine) }
                            if classe != .regular, let menage = a.menage { foyer(menage) }
                            alertes(a)
                        }
                    }
                } else {
                    Attente()
                }
            }
        }
        .navigationTitle(navigation.nomDossier)
        .navigationBarTitleDisplayMode(.inline)
        .cadreSections(navigation)
    }

    // MARK: le bandeau (iPad)

    /// Le bandeau : les Alpes de nuit, l'accroche, et le client ouvert (toucher : revenir à la liste des clients).
    private func bandeau(_ a: AnalyseModele) -> some View {
        ZStack(alignment: .leading) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(navigation.textes["bonjour"] ?? "").font(.system(size: 14)).foregroundStyle(Color.secondary)
                    Text(navigation.textes["slogan"] ?? "").font(.system(size: 30, weight: .semibold)).foregroundStyle(Color.primary)
                        .lineLimit(2).minimumScaleFactor(0.7).frame(maxWidth: 380, alignment: .leading)
                        .shadow(color: Teinte.nuit.opacity(0.8), radius: 8)
                    Text(navigation.textes["metiers"] ?? "").font(.system(size: 13)).foregroundStyle(Color.secondary)
                }
                Spacer(minLength: 12)
                VStack(alignment: .trailing, spacing: 10) {
                    Button {
                        navigation.montrerAccueil()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "person.2").font(.system(size: 15, weight: .medium)).foregroundStyle(Teinte.eclat)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(a.ciblePersonne.isEmpty ? (navigation.noms["dossier"] ?? "") : a.ciblePersonne).font(.system(size: 11)).foregroundStyle(Color.secondary)
                                Text(navigation.nomDossier).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1)
                            }
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.secondary)
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 50)
                        .modifier(VerreCarte(rayon: 16))
                    }
                    .buttonStyle(Appui())
                    cible(a).frame(maxWidth: 240)
                }
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 14)
        }
        .frame(minHeight: 132)
    }

    /// Couple : la personne analysée.
    @ViewBuilder private func cible(_ a: AnalyseModele) -> some View {
        if let choix = a.cibleChoix {
            Picker("", selection: Binding(get: { choix }, set: { navigation.appeler("cible", $0) })) {
                Text(a.ciblePersonne).tag("personne")
                Text(a.cibleConjoint).tag("conjoint")
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder private func alertes(_ a: AnalyseModele) -> some View {
        if !a.alertes.isEmpty {
            NavigationLink(value: Lieu.alertes) {
                Tuile(titre: a.alertesTitre, note: String(a.alertes.count), symbole: "exclamationmark.circle")
            }
            .buttonStyle(Appui())
        }
    }

    // MARK: le score

    /// « Couverture globale » : la jauge, le score sur 100, et le chemin parcouru depuis le premier rendez-vous.
    private func score(_ a: AnalyseModele) -> some View {
        VStack(spacing: 12) {
            HStack {
                Text(a.scoreNom).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                Image(systemName: "info.circle").font(.system(size: 14)).foregroundStyle(Teinte.eclat)
            }
            ZStack {
                Anneau(part: Double(a.score) / 100, epaisseur: 13)
                VStack(spacing: 1) {
                    Image(systemName: "mountain.2.fill").font(.system(size: 15, weight: .semibold)).foregroundStyle(Teinte.eclat)
                    Text(String(a.score))
                        .font(.system(size: 48, weight: .semibold))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                        .animation(.easeInOut(duration: 0.4), value: a.score)
                    Text("/ 100").font(.system(size: 13)).foregroundStyle(Color.secondary)
                }
            }
            .frame(width: 164, height: 164)
            .padding(.vertical, 2)
            if a.suivi.count >= 2 {
                VStack(spacing: 4) {
                    // le chemin parcouru d'un rendez-vous à l'autre
                    Chart(a.suivi) { jour in
                        LineMark(x: .value("jour", jour.id), y: .value("score", jour.score))
                            .interpolationMethod(.monotone)
                            .foregroundStyle(Teinte.eclat)
                            .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    // échelle resserrée autour des scores vus : la pente se lit, même sur quelques points
                    .chartYScale(domain: Swift.max(0, (a.suivi.map(\.score).min() ?? 0) - 6)...Swift.min(100, (a.suivi.map(\.score).max() ?? 100) + 6))
                    .frame(height: 26)
                    Label(a.suiviTexte, systemImage: "arrow.up.right").font(.system(size: 13, weight: .medium)).foregroundStyle(Teinte.eclat)
                        .labelStyle(.titleAndIcon).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .tuileBord()
    }

    // MARK: les trois piliers

    /// Les trois piliers à la retraite : trois cristaux, avec la part de chacun dans le revenu.
    private func piliers(_ a: AnalyseModele) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            TitreCarte(titre: a.colonnesTitre, symbole: "building.columns")
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(a.colonnes) { colonne in
                    VStack(spacing: 5) {
                        Cristal(rang: colonne.id).frame(width: 34, height: Swift.max(34, 78 * colonne.part))
                            .frame(height: 80, alignment: .bottom)
                        Text(colonne.nom).font(.system(size: 11, weight: .medium)).foregroundStyle(Color.primary.opacity(0.85)).lineLimit(1).minimumScaleFactor(0.7)
                        Text(colonne.pourcent).font(.system(size: 13, weight: .semibold)).monospacedDigit().foregroundStyle(Teinte.accent)
                        Text(colonne.montant).font(.system(size: 11)).monospacedDigit().foregroundStyle(Color.secondary).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tuileBord()
    }

    // MARK: la prochaine échéance

    private func echeance(_ prochaine: AnalyseModele.Echeance) -> some View {
        NavigationLink(value: Lieu.scenarios) {
            HStack(spacing: 14) {
                Image(systemName: "calendar").font(.system(size: 20, weight: .medium)).foregroundStyle(Teinte.eclat).frame(width: 30)
                VStack(alignment: .leading, spacing: 3) {
                    Text(prochaine.titre).font(.system(size: 13)).foregroundStyle(Color.secondary)
                    Text(prochaine.annee).font(.system(size: 18, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary)
                    Text(prochaine.texte).font(.system(size: 13)).foregroundStyle(Color.primary.opacity(0.8)).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.secondary)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tuileBord()
        }
        .buttonStyle(Appui())
    }

    // MARK: le ménage

    /// Le ménage à la retraite : ce que les deux conjoints touchent ensemble, face à leur besoin commun.
    private func foyer(_ m: AnalyseModele.Menage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            TitreCarte(titre: m.titre, symbole: "person.2.fill")
            Text(m.verdict).font(.system(size: 20, weight: .semibold)).monospacedDigit().foregroundStyle(m.lacune ? Color.primary : Teinte.eclat)
            GeometryReader { cadre in
                HStack(spacing: 2) {
                    ForEach(Array(m.parts.enumerated()), id: \.offset) { rang, part in
                        if part > 0 {
                            Capsule().fill(rang == 0 ? Teinte.eclat : rang == 1 ? Teinte.pilier3 : Teinte.manque)
                                .frame(width: Swift.max(3, (cadre.size.width - 6) * Swift.min(1, part)))
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(height: 8)
            VStack(spacing: 0) {
                ForEach(Array(m.lignes.enumerated()), id: \.offset) { rang, ligne in
                    HStack(spacing: 10) {
                        if rang < 2 { Circle().fill(rang == 0 ? Teinte.eclat : Teinte.pilier3).frame(width: 8, height: 8) }
                        Text(ligne.nom).fontWeight(rang == 2 ? .semibold : .regular)
                        Spacer(minLength: 8)
                        Text(ligne.valeur).fontWeight(.semibold).monospacedDigit()
                    }
                    .font(.system(size: 14))
                    .padding(.vertical, 8)
                    .overlay(alignment: .top) { Divider().opacity(0.5) }
                }
            }
            if !m.plafond.isEmpty { Text(m.plafond).font(.system(size: 11.5)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true) }
        }
        .padding(16)
        .tuileBord()
    }

    static func symbole(_ risque: String) -> String {
        switch risque {
        case "retraite": return "figure.walk"
        case "invaliditeMaladie": return "cross.case"
        case "invaliditeAccident": return "bandage"
        case "decesMaladie": return "heart"
        default: return "shield"
        }
    }
}

/// La silhouette d'un cristal : un prisme à deux pointes.
struct FormeCristal: Shape {
    func path(in cadre: CGRect) -> Path {
        let pointe = Swift.min(cadre.height * 0.24, cadre.width * 0.75)
        var trace = Path()
        trace.move(to: CGPoint(x: cadre.midX, y: cadre.minY))
        trace.addLine(to: CGPoint(x: cadre.maxX, y: cadre.minY + pointe))
        trace.addLine(to: CGPoint(x: cadre.maxX, y: cadre.maxY - pointe))
        trace.addLine(to: CGPoint(x: cadre.midX, y: cadre.maxY))
        trace.addLine(to: CGPoint(x: cadre.minX, y: cadre.maxY - pointe))
        trace.addLine(to: CGPoint(x: cadre.minX, y: cadre.minY + pointe))
        trace.closeSubpath()
        return trace
    }
}

/// Un cristal de glace : deux facettes, une arête claire, une lueur.
struct Cristal: View {
    let rang: Int

    var body: some View {
        let teinte = rang == 0 ? Teinte.pilier1 : rang == 1 ? Teinte.eclat : Teinte.pilier3
        return ZStack {
            FormeCristal().fill(LinearGradient(colors: [Color.white.opacity(0.95), teinte, teinte.opacity(0.55)], startPoint: .top, endPoint: .bottom))
            // la facette de gauche, plus claire
            GeometryReader { cadre in
                FormeCristal().fill(Color.white.opacity(0.22)).frame(width: cadre.size.width, height: cadre.size.height)
                    .mask(alignment: .leading) { Rectangle().frame(width: cadre.size.width / 2) }
                Rectangle().fill(Color.white.opacity(0.55)).frame(width: 1, height: cadre.size.height * 0.86)
                    .position(x: cadre.size.width / 2, y: cadre.size.height / 2)
            }
            FormeCristal().stroke(Color.white.opacity(0.55), lineWidth: 0.8)
        }
        .shadow(color: Color.white.opacity(0.18), radius: 6)
    }
}

// MARK: un risque

/// Un risque : ce qu'il manque par mois, d'où vient le revenu, et comment il évolue avec l'âge.
struct RisqueNatif: View {
    @ObservedObject var navigation: Navigation
    let cle: String

    var body: some View {
        Feuille(large: true) {
            if let a = navigation.analyse, a.risque == cle {
                Colonnes {
                    tete(a)
                    sources(a)
                } droite: {
                    cles(a)
                    if !a.attente.isEmpty {
                        Text(a.attente).font(.system(size: 14)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                    LigneDeVie(a: a)
                }
            } else {
                Attente()
            }
        }
        .navigationTitle(navigation.analyse?.risques.first(where: { $0.id == cle })?.nom ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { OutilsEcran(navigation: navigation) }
        .boutonBas(navigation.analyse?.bouton ?? "") { navigation.section(.conseil) }
    }

    private func tete(_ a: AnalyseModele) -> some View {
        let manque = a.risques.first(where: { $0.id == cle })?.lacune ?? false
        return VStack(alignment: .leading, spacing: 6) {
            Text(a.titre.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(2.2).foregroundStyle(Color.secondary)
            Text((manque ? "− " : "") + a.montant)
                .font(.system(size: 60, weight: .thin))
                .monospacedDigit()
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .contentTransition(.numericText())
            Text(a.parMois).font(.system(size: 16)).foregroundStyle(Color.secondary)
        }
        .padding(.top, 10)
    }

    private func sources(_ a: AnalyseModele) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(a.detailTitre.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(1.6).foregroundStyle(Color.secondary)
            GeometryReader { cadre in
                HStack(spacing: 2) {
                    ForEach(a.sources.filter { $0.part > 0 }) { source in
                        Capsule().fill(Teinte.pilier(source.pilier))
                            .frame(width: Swift.max(3, (cadre.size.width - 12) * Swift.min(1, source.part)))
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(height: 12)
            VStack(spacing: 0) {
                ForEach(a.sources) { source in
                    HStack(spacing: 10) {
                        if source.pilier != 0 { Circle().fill(Teinte.pilier(source.pilier)).frame(width: 9, height: 9) }
                        Text(source.nom).fontWeight(source.pilier == 0 ? .semibold : .regular)
                        Spacer(minLength: 8)
                        Text(source.montant).fontWeight(.semibold).monospacedDigit()
                    }
                    .font(.system(size: 16))
                    .padding(.vertical, 11)
                    .overlay(alignment: .top) { Divider().opacity(0.6) }
                }
            }
        }
        .padding(18)
        .verreArrondi(rayon: 16)
    }

    private func cles(_ a: AnalyseModele) -> some View {
        HStack(spacing: 10) {
            ForEach(a.cles) { cle in
                VStack(alignment: .leading, spacing: 4) {
                    Text(cle.nom.uppercased()).font(.system(size: 10.5, weight: .semibold)).tracking(1).foregroundStyle(Color.secondary).lineLimit(1).minimumScaleFactor(0.7)
                    Text(cle.valeur).font(.system(size: 17, weight: .semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .verreArrondi(rayon: 16)
            }
        }
    }

}

// MARK: points d'attention

/// Les points d'attention du dossier, du plus grave au plus léger : un par carte.
struct AlertesNatif: View {
    @ObservedObject var navigation: Navigation

    var body: some View {
        Feuille {
            if let a = navigation.analyse {
                ForEach(a.alertes) { alerte in
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Circle().fill(Teinte.gravite(alerte.gravite)).frame(width: 9, height: 9)
                        Text(alerte.texte).font(.system(size: 16)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .verreArrondi(rayon: 16)
                }
                Text(a.avertissement).font(.footnote).foregroundStyle(Color.secondary).padding(.horizontal, 4)
            } else {
                Attente()
            }
        }
        .navigationTitle(navigation.analyse?.alertesTitre ?? "")
        .navigationBarTitleDisplayMode(.large)
    }
}

// MARK: conseil

/// Le conseil : où l'on arrive avec le plan (deux anneaux, aujourd'hui et après), puis les mesures recommandées,
/// une par ligne avec son pictogramme. Les réglages du plan, son effet et la comparaison d'offres sont chacun derrière une ligne.
struct ConseilNatif: View {
    @ObservedObject var navigation: Navigation
    @Environment(\.horizontalSizeClass) private var classe
    private static let pictogrammes = ["shield.lefthalf.filled", "cross.case", "heart", "figure.walk", "banknote", "building.columns", "calendar", "house", "chart.line.uptrend.xyaxis"]

    var body: some View {
        let cartes = navigation.ecrans["plan"] ?? []
        let conseil = cartes.first(where: { carte in carte.blocs.contains(where: { $0.type == "points" }) })
        return Feuille(large: true) {
            if let tete = cartes.first {
                Colonnes {
                    entete(tete)
                    avantApres(tete)
                    ForEach(cartes) { carte in
                        if carte.id != tete.id && carte.id != conseil?.id && !carte.titre.isEmpty {
                            NavigationLink(value: Lieu.carte("plan", carte.id)) {
                                Tuile(titre: carte.titre, note: carte.sousTitre)
                            }
                            .buttonStyle(Appui())
                        }
                    }
                } droite: {
                    if let conseil { mesures(conseil) }
                    pied
                }
            } else {
                Attente()
            }
        }
        .navigationTitle(navigation.noms["plan"] ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { OutilsEcran(navigation: navigation) }
        .cadreSections(navigation)
    }

    /// Le titre de la section et la phrase qui résume le plan.
    private func entete(_ tete: CarteEcran) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "lightbulb.fill").font(.system(size: 16, weight: .semibold)).foregroundStyle(Teinte.eclat)
                    .frame(width: 34, height: 34)
                    .background(Teinte.eclat.opacity(0.16), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                Text(navigation.noms["plan"] ?? "").font(.system(size: 20, weight: .semibold))
            }
            ForEach(tete.blocs) { bloc in
                if bloc.type == "grand" {
                    Text(bloc.s("texte")).font(.system(size: 17, weight: .medium)).fixedSize(horizontal: false, vertical: true)
                } else if bloc.type == "note" || bloc.type == "texte" {
                    Text(bloc.s("texte")).font(.system(size: 13)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tuileBord()
    }

    /// La couverture aujourd'hui et avec le plan : deux anneaux, une flèche.
    @ViewBuilder private func avantApres(_ tete: CarteEcran) -> some View {
        let elements = tete.blocs.first(where: { $0.type == "chiffres" })?.liste("elements") ?? []
        if elements.count == 2 {
            VStack(alignment: .leading, spacing: 14) {
                Text(navigation.analyse?.scoreNom ?? "").font(.system(size: 15, weight: .semibold))
                HStack(spacing: 0) {
                    jauge(elements[0])
                    Image(systemName: "arrow.right").font(.system(size: 16, weight: .medium)).foregroundStyle(Color.secondary)
                    jauge(elements[1])
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tuileBord()
        }
    }

    private func jauge(_ element: [String: Any]) -> some View {
        let valeur = element["valeur"] as? String ?? "", nombre = Double(valeur.filter { $0.isNumber }) ?? 0
        return VStack(spacing: 8) {
            ZStack {
                Anneau(part: nombre / 100, epaisseur: 8)
                VStack(spacing: 0) {
                    Text(valeur).font(.system(size: 28, weight: .semibold)).monospacedDigit()
                    Text("/ 100").font(.system(size: 10)).foregroundStyle(Color.secondary)
                }
            }
            .frame(width: 96, height: 96)
            Text(element["nom"] as? String ?? "").font(.system(size: 12)).foregroundStyle(Color.secondary).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
    }

    /// Les mesures recommandées, dans l'ordre d'urgence.
    private func mesures(_ conseil: CarteEcran) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            TitreCarte(titre: conseil.titre, symbole: "checklist")
            ForEach(conseil.blocs) { bloc in
                if bloc.type == "grand" {
                    Text(bloc.s("texte")).font(.system(size: 13)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
                } else if bloc.type == "points" {
                    ForEach(Array(bloc.liste("points").enumerated()), id: \.offset) { rang, point in
                        let pressant = (point["urgence"] as? String ?? "") == "maintenant"
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: ConseilNatif.pictogrammes[rang % ConseilNatif.pictogrammes.count])
                                .font(.system(size: 15, weight: .medium)).foregroundStyle(Teinte.eclat)
                                .frame(width: 34, height: 34)
                                .background(Teinte.eclat.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            VStack(alignment: .leading, spacing: 3) {
                                Text((point["nom"] as? String ?? "").uppercased())
                                    .font(.system(size: 10.5, weight: .semibold)).tracking(1.2)
                                    .foregroundStyle(pressant ? Teinte.accent : Color.secondary)
                                Text(point["texte"] as? String ?? "").font(.system(size: 14)).fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.white.opacity(0.10), lineWidth: 0.8))
                    }
                }
            }
            // la reprise dans le procès-verbal est un outil du conseiller
            ForEach(conseil.blocs) { bloc in
                if (bloc.type == "bouton" || bloc.type == "note") && !navigation.presentation {
                    BlocVue(navigation: navigation, bloc: bloc).id("\(navigation.versionEcran)-c-\(bloc.id)")
                }
            }
        }
        .padding(14)
        .tuileBord()
    }

    /// La devise, pour fermer l'écran.
    private var pied: some View {
        Text(navigation.textes["devise"] ?? "").font(.system(size: 14)).foregroundStyle(Color.secondary)
            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 6).padding(.top, 4)
    }
}

// MARK: écrans décrits par la page

/// Les blocs d'une carte, à la suite.
struct ContenuCarte: View {
    @ObservedObject var navigation: Navigation
    let carte: CarteEcran

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(carte.blocs) { bloc in
                BlocVue(navigation: navigation, bloc: bloc)
                    .id("\(navigation.versionEcran)-\(carte.id)-\(bloc.id)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Scénarios, Rapport, Données : chaque carte de la page devient une ligne où l'on entre (une question, un écran).
/// Les premières cartes (`ouvertes`) et celles qui n'ont pas de titre sont montrées directement.
struct EcranCartes: View {
    @ObservedObject var navigation: Navigation
    let vue: String
    let ouvertes: Int

    var body: some View {
        let cartes = navigation.ecrans[vue] ?? []
        return Feuille {
            if vue == "scenarios" || vue == "rapport" { TitreSection(titre: navigation.noms[vue] ?? "") }
            if cartes.isEmpty { Attente() }
            ForEach(cartes) { carte in
                if carte.id < ouvertes || carte.titre.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        if !carte.titre.isEmpty && !carte.sousTitre.isEmpty {
                            Text(carte.sousTitre).font(.system(size: 15)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
                        }
                        ContenuCarte(navigation: navigation, carte: carte)
                    }
                    .padding(.bottom, 6)
                } else {
                    NavigationLink(value: Lieu.carte(vue, carte.id)) {
                        Tuile(titre: carte.titre, note: carte.sousTitre)
                    }
                    .buttonStyle(Appui())
                }
            }
        }
        .navigationTitle(navigation.noms[vue] ?? "")
        .navigationBarTitleDisplayMode(.large)
        .toolbar { OutilsEcran(navigation: navigation) }
        .modifier(CadreSiSection(navigation: navigation, section: vue == "scenarios" || vue == "rapport"))
    }
}

/// Scénarios et Rapport sont des sections du client (cadre) ; Données n'en est pas une.
struct CadreSiSection: ViewModifier {
    @ObservedObject var navigation: Navigation
    let section: Bool

    func body(content: Content) -> some View {
        if section { content.cadreSections(navigation) } else { content }
    }
}

/// Une carte en plein écran : sa question en grand, puis ses réglages et ses résultats.
struct CarteNative: View {
    @ObservedObject var navigation: Navigation
    let vue: String
    let rang: Int

    var body: some View {
        Feuille {
            if let carte = (navigation.ecrans[vue] ?? []).first(where: { $0.id == rang }) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(carte.titre).font(.system(size: 28, weight: .semibold)).fixedSize(horizontal: false, vertical: true)
                    if !carte.sousTitre.isEmpty {
                        Text(carte.sousTitre).font(.system(size: 15)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.top, 6)
                ContenuCarte(navigation: navigation, carte: carte)
            } else {
                Attente()
            }
        }
        .navigationTitle(navigation.noms[vue] ?? "")
        .navigationBarTitleDisplayMode(.inline)
    }
}
