import Charts
import SwiftUI

/// Les écrans où l'on entre depuis l'accueil. Un écran, une idée : la synthèse du client, un risque, le conseil,
/// une question de scénario, le rapport, une rubrique du dossier.
enum Lieu: Hashable {
    case client
    case risque(String)
    case alertes
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
    private static let image: UIImage? = FilmAccueil.fichier("accueil.jpg").flatMap { UIImage(contentsOfFile: $0.path) }

    var body: some View {
        Color.clear
            .overlay {
                if let image = Montagne.image {
                    Image(uiImage: image).resizable().scaledToFill().opacity(0.34)
                }
            }
            .clipped()
            .mask(LinearGradient(colors: [.clear, .black, .clear], startPoint: .top, endPoint: .bottom))
            .allowsHitTesting(false)
    }
}

// MARK: synthèse du client

/// Le point de départ d'un client : son score, puis ses risques sur un fil, du plus proche au plus lointain.
/// Un seul geste principal : le conseil. Le dossier, les scénarios et le rapport sont à portée, en dessous.
struct ClientNatif: View {
    @ObservedObject var navigation: Navigation
    @Environment(\.horizontalSizeClass) private var classe

    var body: some View {
        Feuille(large: true) {
            if let a = navigation.analyse {
                Colonnes {
                    if let choix = a.cibleChoix {
                        Picker("", selection: Binding(get: { choix }, set: { navigation.appeler("cible", $0) })) {
                            Text(a.ciblePersonne).tag("personne")
                            Text(a.cibleConjoint).tag("conjoint")
                        }
                        .pickerStyle(.segmented)
                    }
                    score(a)
                    if classe == .regular { acces(a) }
                } droite: {
                    fil(a)
                    if classe != .regular { acces(a) }
                }
            } else {
                Attente()
            }
        }
        .navigationTitle(navigation.nomDossier)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { OutilsEcran(navigation: navigation) }
        .boutonBas(navigation.analyse?.bouton ?? "") { navigation.entrer(.conseil) }
    }

    /// Points d'attention, dossier, scénarios, rapport.
    @ViewBuilder private func acces(_ a: AnalyseModele) -> some View {
        if !a.alertes.isEmpty {
            NavigationLink(value: Lieu.alertes) {
                Tuile(titre: a.alertesTitre, note: String(a.alertes.count), symbole: "exclamationmark.circle")
            }
            .buttonStyle(Appui())
        }
        HStack(spacing: 10) {
            lien(.dossier, "dossier", "person.text.rectangle")
            lien(.scenarios, "scenarios", "arrow.triangle.branch")
            lien(.rapport, "rapport", "doc.text")
        }
    }

    private func score(_ a: AnalyseModele) -> some View {
        VStack(spacing: 2) {
            Text(String(a.score))
                .font(.system(size: 96, weight: .thin))
                .monospacedDigit()
                .contentTransition(.numericText())
                .animation(.easeInOut(duration: 0.4), value: a.score)
            Text(a.scoreNom.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(2.4).foregroundStyle(Color.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .background { Montagne() }
    }

    private func fil(_ a: AnalyseModele) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(a.risques.enumerated()), id: \.element.id) { rang, risque in
                NavigationLink(value: Lieu.risque(risque.id)) {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(risque.lacune ? Teinte.accent : Teinte.glace.opacity(0.14))
                            Image(systemName: ClientNatif.symbole(risque.id))
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(risque.lacune ? Teinte.boutonEncre : Color.primary)
                        }
                        .frame(width: 40, height: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(risque.nom).font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1).minimumScaleFactor(0.8)
                            Text(risque.note).font(.system(size: 13)).foregroundStyle(Color.secondary).lineLimit(1)
                        }
                        Spacer(minLength: 8)
                        if risque.lacune {
                            Text(risque.montant).font(.system(size: 18, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary).lineLimit(1)
                        } else if risque.montant != "—" {
                            Image(systemName: "checkmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(Teinte.accent)
                        }
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.secondary)
                    }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 66)
                    .verreArrondi(rayon: 16)
                }
                .buttonStyle(Appui())
                if rang + 1 < a.risques.count {
                    Rectangle().fill(Teinte.glace.opacity(0.3)).frame(width: 1.5, height: 10).padding(.leading, 35)
                }
            }
        }
    }

    private func lien(_ lieu: Lieu, _ vue: String, _ symbole: String) -> some View {
        NavigationLink(value: lieu) {
            VStack(spacing: 7) {
                Image(systemName: symbole).font(.system(size: 19, weight: .medium)).foregroundStyle(Teinte.accent)
                Text(navigation.noms[vue] ?? "").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.primary).lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 72)
            .verreArrondi(rayon: 16)
        }
        .buttonStyle(Appui())
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
                    ligneDeVie(a)
                }
            } else {
                Attente()
            }
        }
        .navigationTitle(navigation.analyse?.risques.first(where: { $0.id == cle })?.nom ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { OutilsEcran(navigation: navigation) }
        .boutonBas(navigation.analyse?.bouton ?? "") { navigation.entrer(.conseil) }
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

    private func ligneDeVie(_ a: AnalyseModele) -> some View {
        let noms = a.legende
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(a.ligneTitre).font(.system(size: 20, weight: .semibold))
                Text(a.ligneNote).font(.system(size: 14)).foregroundStyle(Color.secondary)
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
                        .foregroundStyle(Color.primary)
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
            .frame(height: 240)
        }
        .padding(18)
        .verreArrondi(rayon: 16)
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
                        if bloc.type == "bouton" || bloc.type == "note" {
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
        .boutonBas(navigation.noms["rapport"] ?? "") { navigation.entrer(.rapport) }
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
