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
            Circle().stroke(Teinte.glace.opacity(0.16), lineWidth: epaisseur)
            Circle().trim(from: 0, to: CGFloat(Swift.max(0.004, Swift.min(1, part))))
                .stroke(LinearGradient(colors: [Teinte.pilier2, Teinte.accent, Color.white], startPoint: .bottomLeading, endPoint: .topTrailing),
                        style: StrokeStyle(lineWidth: epaisseur, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: Teinte.accent.opacity(0.55), radius: epaisseur)
        }
    }
}

/// Une tuile du tableau de bord : plaque de glace aux angles doux, plus marquée que les panneaux courants.
struct TuileBord: ViewModifier {
    func body(content: Content) -> some View {
        let forme = RoundedRectangle(cornerRadius: 22, style: .continuous)
        return content
            .background(LinearGradient(colors: [Teinte.glace.opacity(0.13), Teinte.glace.opacity(0.05)], startPoint: .top, endPoint: .bottom), in: forme)
            .overlay(forme.strokeBorder(LinearGradient(colors: [Color.white.opacity(0.28), Teinte.glace.opacity(0.08)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
            .clipShape(forme)
    }
}

extension View {
    func tuileBord() -> some View { modifier(TuileBord()) }
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
            (nil, navigation.textes["synthese"] ?? noms["analyse"] ?? "", "square.grid.2x2", false),
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

/// iPad : la barre latérale des sections, en verre, toujours visible.
struct RailSections: View {
    @ObservedObject var navigation: Navigation
    /// Écran étroit : pictogrammes seuls, pour laisser la place au contenu.
    var reduite = false

    var body: some View {
        let ici = Sections.courante(navigation)
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Sections.liste(navigation)) { section in
                let actif = section.lieu == ici
                Button {
                    navigation.section(section.lieu)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: section.symbole).font(.system(size: reduite ? 19 : 17, weight: .medium)).frame(width: 24)
                        if !reduite {
                            Text(section.nom).font(.system(size: 15, weight: actif ? .semibold : .regular)).lineLimit(1).minimumScaleFactor(0.8)
                            Spacer(minLength: 0)
                        }
                    }
                    .foregroundStyle(actif ? Color.white : Color.secondary)
                    .padding(.horizontal, 12)
                    .frame(maxWidth: reduite ? .infinity : nil)
                    .frame(height: reduite ? 50 : 46)
                    .background {
                        if actif {
                            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Teinte.accent.opacity(0.2))
                                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Teinte.accent.opacity(0.45), lineWidth: 1))
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(section.nom))
                .accessibilityAddTraits(actif ? .isSelected : [])
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(width: reduite ? 72 : 168)
        .frame(maxHeight: .infinity)
        .background(Teinte.glace.opacity(0.06))
        .overlay(alignment: .trailing) { Rectangle().fill(Teinte.glace.opacity(0.14)).frame(width: 1) }
    }
}

/// iPhone : les sections en onglets, sur une ligne qui défile ; l'onglet ouvert est plein.
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
                                .foregroundStyle(actif ? Teinte.boutonEncre : Color.primary.opacity(0.82))
                                .padding(.horizontal, 15)
                                .frame(height: 34)
                                .background(actif ? Teinte.accent : Teinte.glace.opacity(0.1), in: Capsule())
                                .overlay(Capsule().strokeBorder(Teinte.glace.opacity(actif ? 0 : 0.18), lineWidth: 1))
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
        .background(Teinte.nuit.opacity(0.88))
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
        } else {
            content.safeAreaInset(edge: .top, spacing: 0) { OngletsSections(navigation: navigation) }
        }
    }
}

extension View {
    func cadreSections(_ navigation: Navigation) -> some View { modifier(CadreSections(navigation: navigation)) }
}

/// La ligne de vie : par âge, ce que versent le salaire et chaque pilier, face au besoin (en pointillé).
struct LigneDeVie: View {
    let a: AnalyseModele
    var hauteur: CGFloat = 240

    var body: some View {
        let noms = a.legende
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Label(a.ligneTitre, systemImage: "chart.bar.xaxis").font(.system(size: 14, weight: .semibold)).labelStyle(.titleAndIcon)
                Text(a.ligneNote).font(.system(size: 13)).foregroundStyle(Color.secondary)
            }
            Chart {
                ForEach(a.ligne) { point in
                    let age = Double(point.id), bas = [0, point.salaire, point.salaire + point.p1, point.salaire + point.p1 + point.p2]
                    let hauts = [point.salaire, point.salaire + point.p1, point.salaire + point.p1 + point.p2, point.salaire + point.p1 + point.p2 + point.p3]
                    ForEach(0..<4, id: \.self) { rang in
                        if hauts[rang] > bas[rang] {
                            RectangleMark(xStart: .value("âge", age - 0.5), xEnd: .value("âge", age + 0.5),
                                          yStart: .value("revenu", bas[rang]), yEnd: .value("revenu", hauts[rang]))
                                .foregroundStyle(by: .value("source", noms[rang]))
                        }
                    }
                }
                ForEach(a.ligne) { point in
                    LineMark(x: .value("âge", Double(point.id)), y: .value("besoin", point.besoin), series: .value("série", noms[4]))
                        .interpolationMethod(.stepCenter)
                        .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 4]))
                        .foregroundStyle(Color.white)
                }
            }
            .chartXScale(domain: (Double(a.ligne.first?.id ?? 0) - 0.5)...(Double(a.ligne.last?.id ?? 100) + 0.5))
            .chartForegroundStyleScale(domain: Array(noms.prefix(4)), range: [Teinte.salaire, Teinte.pilier1, Teinte.pilier2, Teinte.pilier3])
            .chartYAxis {
                AxisMarks(position: .leading) { valeur in
                    AxisGridLine().foregroundStyle(Color.primary.opacity(0.08))
                    AxisValueLabel {
                        if let montant = valeur.as(Double.self) { Text(montant >= 1000 ? "\(Int(montant / 1000))k" : "\(Int(montant))") }
                    }
                }
            }
            .chartLegend(position: .bottom, alignment: .leading)
            .frame(height: hauteur)
        }
        .padding(14)
        .tuileBord()
    }
}

/// Les risques d'un client, un par ligne, avec l'anneau de sa couverture ; à côté, la ligne de vie.
struct RisquesNatif: View {
    @ObservedObject var navigation: Navigation

    var body: some View {
        Feuille(large: true) {
            if let a = navigation.analyse {
                Colonnes {
                    ForEach(a.risques) { risque in
                        NavigationLink(value: Lieu.risque(risque.id)) { ligne(risque) }.buttonStyle(Appui())
                    }
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

    private func ligne(_ risque: AnalyseModele.Risque) -> some View {
        HStack(spacing: 14) {
            ZStack {
                Anneau(part: risque.couverture, epaisseur: 5)
                Text("\(Int((risque.couverture * 100).rounded()))").font(.system(size: 13, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(risque.nom).font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1).minimumScaleFactor(0.8)
                Text(risque.note).font(.system(size: 13)).foregroundStyle(Color.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            if risque.lacune {
                Text(risque.montant).font(.system(size: 17, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary).lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false).layoutPriority(1)
            } else if risque.montant != "—" {
                Image(systemName: "checkmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(Teinte.accent)
            }
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tuileBord()
    }
}

/// Le tableau de bord d'un client : le score dans son anneau, les trois piliers en colonnes de glace, chaque risque
/// avec sa couverture, la prochaine échéance et le ménage. Tout se lit d'un regard ; chaque tuile ouvre son détail.
struct ClientNatif: View {
    @ObservedObject var navigation: Navigation
    @Environment(\.horizontalSizeClass) private var classe

    var body: some View {
        GeometryReader { cadre in
            // trois colonnes quand la place le permet (iPad en paysage), deux sur iPad en portrait, une sur iPhone
            let trois = classe == .regular && cadre.size.width >= 900
            Feuille(large: true) {
                if let a = navigation.analyse {
                    if trois {
                        HStack(alignment: .top, spacing: 18) {
                            VStack(spacing: 14) {
                                cible(a)
                                score(a)
                                if let menage = a.menage { foyer(menage) }
                            }
                            .frame(maxWidth: .infinity)
                            VStack(spacing: 14) {
                                LigneDeVie(a: a, hauteur: 300)
                                if !a.colonnes.isEmpty { piliers(a) }
                            }
                            .frame(maxWidth: .infinity)
                            VStack(spacing: 12) {
                                ForEach(a.risques) { risque in tuile(risque) }
                                if let prochaine = a.prochaine { echeance(prochaine) }
                                alertes(a)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    } else {
                        Colonnes {
                            cible(a)
                            score(a)
                            HStack(alignment: .top, spacing: 12) {
                                if !a.colonnes.isEmpty { piliers(a) }
                                VStack(spacing: 12) {
                                    ForEach(a.risques.prefix(2)) { risque in tuile(risque) }
                                }
                            }
                            if classe == .regular, let menage = a.menage { foyer(menage) }
                        } droite: {
                            HStack(alignment: .top, spacing: 12) {
                                ForEach(a.risques.dropFirst(2)) { risque in tuile(risque, compacte: true) }
                            }
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
        .toolbar { OutilsEcran(navigation: navigation) }
        .cadreSections(navigation)
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

    private func score(_ a: AnalyseModele) -> some View {
        ZStack(alignment: .bottomTrailing) {
            Montagne(force: 0.6)
            VStack(spacing: 10) {
                ZStack {
                    Anneau(part: Double(a.score) / 100, epaisseur: 10)
                    VStack(spacing: 0) {
                        Text(String(a.score))
                            .font(.system(size: 62, weight: .thin))
                            .monospacedDigit()
                            .contentTransition(.numericText())
                            .animation(.easeInOut(duration: 0.4), value: a.score)
                        Text(a.scoreNom).font(.system(size: 11, weight: .medium)).foregroundStyle(Color.secondary).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.8).frame(maxWidth: 104)
                    }
                }
                .frame(width: 168, height: 168)
                if a.suivi.count >= 2 {
                    VStack(spacing: 4) {
                        // le chemin parcouru d'un rendez-vous à l'autre
                        Chart(a.suivi) { jour in
                            LineMark(x: .value("jour", jour.id), y: .value("score", jour.score))
                                .interpolationMethod(.monotone)
                                .foregroundStyle(Teinte.accent)
                                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                            if jour.id == a.suivi.count - 1 {
                                PointMark(x: .value("jour", jour.id), y: .value("score", jour.score)).foregroundStyle(Color.white).symbolSize(40)
                            }
                        }
                        .chartXAxis(.hidden)
                        .chartYAxis(.hidden)
                        // échelle resserrée autour des scores vus : la pente se lit, même sur quelques points
                        .chartYScale(domain: Swift.max(0, (a.suivi.map(\.score).min() ?? 0) - 6)...Swift.min(100, (a.suivi.map(\.score).max() ?? 100) + 6))
                        .frame(width: 120, height: 28)
                        Text(a.suiviTexte).font(.system(size: 13, weight: .medium)).foregroundStyle(Teinte.accent).lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 22)
        }
        .tuileBord()
    }

    // MARK: les trois piliers

    /// Les trois piliers à la retraite : trois colonnes de glace, hautes selon ce que chacun verse.
    private func piliers(_ a: AnalyseModele) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(a.colonnesTitre, systemImage: "building.columns").font(.system(size: 14, weight: .semibold)).labelStyle(.titleAndIcon)
            HStack(alignment: .bottom, spacing: 10) {
                ForEach(a.colonnes) { colonne in
                    VStack(spacing: 6) {
                        Spacer(minLength: 0)
                        ColonneGlace(rang: colonne.id).frame(height: Swift.max(14, 104 * colonne.part))
                        Text(colonne.nom).font(.system(size: 11, weight: .medium)).foregroundStyle(Color.secondary).lineLimit(1).minimumScaleFactor(0.7)
                        Text(colonne.montant).font(.system(size: 12.5, weight: .semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 160)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tuileBord()
    }

    // MARK: les risques

    /// Un risque : son nom, ce qu'il manque par mois (ou la coche), et l'anneau de sa couverture.
    private func tuile(_ risque: AnalyseModele.Risque, compacte: Bool = false) -> some View {
        NavigationLink(value: Lieu.risque(risque.id)) {
            VStack(alignment: .leading, spacing: compacte ? 8 : 6) {
                HStack(spacing: 6) {
                    Image(systemName: ClientNatif.symbole(risque.id)).font(.system(size: 13, weight: .medium)).foregroundStyle(Teinte.accent)
                    Text(risque.nom).font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(compacte ? 2 : 1).minimumScaleFactor(0.75)
                        .multilineTextAlignment(.leading)
                }
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 1) {
                        if risque.lacune {
                            Text(risque.montant).font(.system(size: compacte ? 14 : 16, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary).lineLimit(1).minimumScaleFactor(0.6)
                        } else {
                            Image(systemName: risque.montant == "—" ? "minus" : "checkmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(Teinte.accent)
                        }
                        Text(risque.note).font(.system(size: 11)).foregroundStyle(Color.secondary).lineLimit(1).minimumScaleFactor(0.7)
                    }
                    Spacer(minLength: 0)
                    if !compacte {
                        ZStack {
                            Anneau(part: risque.couverture, epaisseur: 5)
                            Text("\(Int((risque.couverture * 100).rounded()))").font(.system(size: 12, weight: .semibold)).monospacedDigit()
                        }
                        .frame(width: 44, height: 44)
                    }
                }
                if compacte {
                    GeometryReader { cadre in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Teinte.glace.opacity(0.16))
                            Capsule().fill(Teinte.accent).frame(width: cadre.size.width * Swift.max(0, Swift.min(1, risque.couverture)))
                        }
                    }
                    .frame(height: 4)
                }
            }
            .padding(13)
            .frame(maxWidth: .infinity, minHeight: compacte ? 96 : 0, alignment: .topLeading)
            .tuileBord()
        }
        .buttonStyle(Appui())
    }

    // MARK: la prochaine échéance

    private func echeance(_ prochaine: AnalyseModele.Echeance) -> some View {
        NavigationLink(value: Lieu.scenarios) {
            HStack(spacing: 14) {
                VStack(spacing: 0) {
                    Image(systemName: "calendar").font(.system(size: 15, weight: .medium)).foregroundStyle(Teinte.accent)
                    Text(prochaine.annee).font(.system(size: 17, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary)
                }
                .frame(width: 54)
                VStack(alignment: .leading, spacing: 3) {
                    Text(prochaine.titre.uppercased()).font(.system(size: 10.5, weight: .semibold)).tracking(1.2).foregroundStyle(Teinte.accent)
                    Text(prochaine.texte).font(.system(size: 14)).foregroundStyle(Color.primary).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.secondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tuileBord()
        }
        .buttonStyle(Appui())
    }

    // MARK: le ménage

    /// Le ménage à la retraite : ce que les deux conjoints touchent ensemble, face à leur besoin commun.
    private func foyer(_ m: AnalyseModele.Menage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Label(m.titre, systemImage: "person.2").font(.system(size: 14, weight: .semibold)).labelStyle(.titleAndIcon)
                Spacer(minLength: 8)
                Text(m.verdict).font(.system(size: 15, weight: .semibold)).monospacedDigit().foregroundStyle(m.lacune ? Color.primary : Teinte.accent)
            }
            GeometryReader { cadre in
                HStack(spacing: 2) {
                    ForEach(Array(m.parts.enumerated()), id: \.offset) { rang, part in
                        if part > 0 {
                            Capsule().fill(rang == 0 ? Teinte.pilier2 : rang == 1 ? Teinte.pilier3 : Teinte.manque)
                                .frame(width: Swift.max(3, (cadre.size.width - 6) * Swift.min(1, part)))
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(height: 10)
            VStack(spacing: 0) {
                ForEach(Array(m.lignes.enumerated()), id: \.offset) { rang, ligne in
                    HStack(spacing: 10) {
                        if rang < 2 { Circle().fill(rang == 0 ? Teinte.pilier2 : Teinte.pilier3).frame(width: 9, height: 9) }
                        Text(ligne.nom).fontWeight(rang == 2 ? .semibold : .regular)
                        Spacer(minLength: 8)
                        Text(ligne.valeur).fontWeight(.semibold).monospacedDigit()
                    }
                    .font(.system(size: 15))
                    .padding(.vertical, 9)
                    .overlay(alignment: .top) { Divider().opacity(0.6) }
                }
            }
            if !m.plafond.isEmpty { Text(m.plafond).font(.system(size: 12)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true) }
        }
        .padding(14)
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

/// Une colonne de glace : un pilier lumineux, plus clair en haut, avec un reflet sur l'arête.
struct ColonneGlace: View {
    let rang: Int

    var body: some View {
        let teinte = rang == 0 ? Teinte.pilier1 : rang == 1 ? Teinte.pilier2 : Teinte.pilier3
        let forme = RoundedRectangle(cornerRadius: 7, style: .continuous)
        return forme
            .fill(LinearGradient(colors: [Color.white.opacity(0.92), teinte, teinte.opacity(0.55)], startPoint: .top, endPoint: .bottom))
            .overlay(alignment: .leading) {
                LinearGradient(colors: [Color.white.opacity(0.55), Color.white.opacity(0)], startPoint: .leading, endPoint: .trailing).frame(width: 9).clipShape(forme)
            }
            .overlay(forme.strokeBorder(Color.white.opacity(0.5), lineWidth: 0.8))
            .shadow(color: teinte.opacity(0.7), radius: 12, y: 2)
            .frame(maxWidth: 46)
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

/// Le conseil : où l'on arrive avec le plan (avant, après), puis les mesures, une par carte, dans l'ordre d'urgence.
/// Les réglages du plan et le détail de son effet sont chacun derrière une ligne.
struct ConseilNatif: View {
    @ObservedObject var navigation: Navigation

    var body: some View {
        let cartes = navigation.ecrans["plan"] ?? []
        let conseil = cartes.first(where: { carte in carte.blocs.contains(where: { $0.type == "points" }) })
        return Feuille(large: true) {
            if let tete = cartes.first {
              Colonnes {
                ForEach(tete.blocs) { bloc in
                    if bloc.type == "grand" {
                        Text(bloc.s("texte")).font(.system(size: 30, weight: .semibold)).fixedSize(horizontal: false, vertical: true).padding(.top, 6)
                    } else if bloc.type != "titre" {
                        BlocVue(navigation: navigation, bloc: bloc).id("\(navigation.versionEcran)-t-\(bloc.id)")
                    }
                }
                ForEach(cartes) { carte in
                    if carte.id != tete.id && carte.id != conseil?.id && !carte.titre.isEmpty {
                        NavigationLink(value: Lieu.carte("plan", carte.id)) {
                            Tuile(titre: carte.titre, note: carte.sousTitre)
                        }
                        .buttonStyle(Appui())
                    }
                }
              } droite: {
                if let conseil {
                    // le résumé, puis les mesures ; la reprise dans le procès-verbal vient après
                    ForEach(conseil.blocs) { bloc in
                        if bloc.type == "grand" {
                            Text(bloc.s("texte")).font(.system(size: 16)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
                        } else if bloc.type == "points" {
                            mesures(bloc)
                        }
                    }
                    ForEach(conseil.blocs) { bloc in
                        if (bloc.type == "bouton" || bloc.type == "note") && !navigation.presentation {
                            BlocVue(navigation: navigation, bloc: bloc).id("\(navigation.versionEcran)-c-\(bloc.id)")
                        }
                    }
                }
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

    private func mesures(_ bloc: BlocEcran) -> some View {
        ForEach(Array(bloc.liste("points").enumerated()), id: \.offset) { _, point in
            let pressant = (point["urgence"] as? String ?? "") == "maintenant"
            VStack(alignment: .leading, spacing: 6) {
                Text((point["nom"] as? String ?? "").uppercased())
                    .font(.system(size: 11, weight: .semibold)).tracking(1.4)
                    .foregroundStyle(pressant ? Teinte.accent : Color.secondary)
                Text(point["texte"] as? String ?? "").font(.system(size: 16)).fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .verreArrondi(rayon: 16)
        }
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
