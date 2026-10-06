import Charts
import SwiftUI

/// Un bloc d'un écran décrit par la page (web/src/natif.js, fonction `ecran`) : chiffres, lignes, graphique, curseur…
struct BlocEcran: Identifiable {
    let id: Int
    let type: String
    let d: [String: Any]

    func s(_ cle: String) -> String { d[cle] as? String ?? "" }
    func n(_ cle: String) -> Double { (d[cle] as? NSNumber)?.doubleValue ?? 0 }
    func b(_ cle: String) -> Bool { (d[cle] as? NSNumber)?.boolValue ?? false }
    func liste(_ cle: String) -> [[String: Any]] { d[cle] as? [[String: Any]] ?? [] }
}

/// Une carte d'un écran décrit : un titre, un sous-titre, des blocs.
struct CarteEcran: Identifiable {
    let id: Int
    let titre: String
    let sousTitre: String
    let blocs: [BlocEcran]

    static func lire(_ ecran: [String: Any]) -> [CarteEcran] {
        (ecran["cartes"] as? [[String: Any]] ?? []).enumerated().map { rang, carte in
            CarteEcran(id: rang, titre: carte["titre"] as? String ?? "", sousTitre: carte["sousTitre"] as? String ?? "",
                       blocs: (carte["blocs"] as? [[String: Any]] ?? []).enumerated().map { BlocEcran(id: $0.offset, type: $0.element["type"] as? String ?? "", d: $0.element) })
        }
    }
}

private func texte(_ d: [String: Any], _ cle: String) -> String { d[cle] as? String ?? "" }
private func nombre(_ d: [String: Any], _ cle: String) -> Double { (d[cle] as? NSNumber)?.doubleValue ?? 0 }
private func vrai(_ d: [String: Any], _ cle: String) -> Bool { (d[cle] as? NSNumber)?.boolValue ?? false }

/// Scénarios, Conseil, Rapport, Données : la page décrit ce qu'elle affiche, l'app le dessine avec ses composants
/// (cartes de verre, graphiques du système, curseurs, interrupteurs). Les chiffres viennent du moteur, par la page.
struct EcranDecrit: View {
    @ObservedObject var navigation: Navigation
    let vue: String

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    ForEach(navigation.ecrans[vue] ?? []) { carte in
                        VStack(alignment: .leading, spacing: 14) {
                            if !carte.titre.isEmpty {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(carte.titre).font(.system(size: 21, weight: .semibold))
                                    if !carte.sousTitre.isEmpty { Text(carte.sousTitre).font(.system(size: 14)).foregroundStyle(Color.secondary) }
                                }
                            }
                            ForEach(carte.blocs) { bloc in
                                BlocVue(navigation: navigation, bloc: bloc)
                                    .id("\(navigation.versionEcran)-\(carte.id)-\(bloc.id)")
                            }
                        }
                        .padding(20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .verreArrondi(rayon: 26)
                    }
                    if (navigation.ecrans[vue] ?? []).isEmpty { ProgressView().frame(maxWidth: .infinity).padding(.top, 120) }
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .frame(maxWidth: 860)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 84) }
            .background(FondApp())
            .navigationTitle(navigation.noms[vue] ?? "")
            .toolbar { OutilsEcran(navigation: navigation) }
        }
    }
}

/// Un bloc, dessiné selon sa nature.
struct BlocVue: View {
    @ObservedObject var navigation: Navigation
    let bloc: BlocEcran
    @State private var valeur: Double
    @State private var actif: Bool
    @State private var saisie: String
    @State private var choisi: Int
    @FocusState private var enSaisie: Bool

    init(navigation: Navigation, bloc: BlocEcran) {
        self.navigation = navigation
        self.bloc = bloc
        _valeur = State(initialValue: bloc.n("valeur"))
        _actif = State(initialValue: bloc.b("actif"))
        _saisie = State(initialValue: bloc.s("valeur"))
        _choisi = State(initialValue: Int(bloc.n("choisi")))
    }

    var body: some View {
        switch bloc.type {
        case "titre":
            Text(bloc.s("texte").uppercased()).font(.system(size: 12, weight: .semibold)).tracking(1.6).foregroundStyle(Color.secondary).padding(.top, 4)
        case "grand":
            Text(bloc.s("texte")).font(.system(size: 24, weight: .semibold)).fixedSize(horizontal: false, vertical: true)
        case "texte":
            Text(bloc.s("texte")).font(.system(size: 16)).fixedSize(horizontal: false, vertical: true)
        case "note":
            Text(bloc.s("texte")).font(.system(size: 13)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
        case "remarque":
            Text(bloc.s("texte")).font(.system(size: 15, weight: .medium)).fixedSize(horizontal: false, vertical: true)
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(Teinte.accent.opacity(0.16), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        case "chiffres":
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                ForEach(Array(bloc.liste("elements").enumerated()), id: \.offset) { _, e in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(texte(e, "nom").uppercased()).font(.system(size: 10.5, weight: .semibold)).tracking(1).foregroundStyle(Color.secondary).lineLimit(2)
                        Text(texte(e, "valeur")).font(.system(size: 22, weight: .semibold)).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1)
                            .foregroundStyle(texte(e, "ton") == "moins" ? Teinte.lacune : Color.primary)
                        if !texte(e, "note").isEmpty { Text(texte(e, "note")).font(.system(size: 12)).foregroundStyle(Color.secondary) }
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
        case "jauges":
            VStack(spacing: 12) {
                ForEach(Array(bloc.liste("elements").enumerated()), id: \.offset) { _, e in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack { Text(texte(e, "nom")); Spacer(); Text(texte(e, "valeur")).fontWeight(.semibold).monospacedDigit() }.font(.system(size: 16))
                        barre(nombre(e, "part"), couleur: texte(e, "ton") == "moins" ? Teinte.lacune : Teinte.accent)
                    }
                }
            }
        case "option":
            VStack(alignment: .leading, spacing: 8) {
                Text(bloc.s("titre").uppercased()).font(.system(size: 11, weight: .semibold)).tracking(1.2).foregroundStyle(Color.secondary)
                Text(bloc.s("valeur")).font(.system(size: 26, weight: .semibold)).monospacedDigit()
                Text(bloc.s("note")).font(.system(size: 12)).foregroundStyle(Color.secondary)
                lignes(bloc.liste("lignes"))
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.primary.opacity(bloc.b("meilleure") ? 0.12 : 0.05), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(bloc.b("meilleure") ? Teinte.accent : Color.clear, lineWidth: 1.5))
        case "levier":
            VStack(alignment: .leading, spacing: 4) {
                Text(bloc.s("titre")).font(.system(size: 17, weight: .semibold))
                Text(bloc.s("texte")).font(.system(size: 15)).foregroundStyle(Color.secondary).fixedSize(horizontal: false, vertical: true)
            }
        case "effet":
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(bloc.s("nom"))
                    Spacer()
                    Text(bloc.s("valeur")).fontWeight(.semibold).foregroundStyle(bloc.b("lacune") ? Teinte.lacune : Color.primary)
                }
                .font(.system(size: 16))
                barre(bloc.n("avant"), couleur: Color.secondary.opacity(0.6))
                barre(bloc.n("apres"), couleur: Teinte.accent)
                Text(bloc.s("note")).font(.system(size: 12)).foregroundStyle(Color.secondary)
            }
        case "points":
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(bloc.liste("points").enumerated()), id: \.offset) { _, p in
                    HStack(alignment: .top, spacing: 12) {
                        Text(texte(p, "rang")).font(.system(size: 14, weight: .semibold))
                            .frame(width: 28, height: 28)
                            .background(texte(p, "urgence") == "maintenant" ? Teinte.accent : Color.primary.opacity(0.1), in: Circle())
                            .foregroundStyle(texte(p, "urgence") == "maintenant" ? Color.white : Color.primary)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(texte(p, "nom").uppercased()).font(.system(size: 10.5, weight: .semibold)).tracking(1.2).foregroundStyle(Color.secondary)
                            Text(texte(p, "texte")).font(.system(size: 16)).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        case "lignes":
            lignes(bloc.liste("lignes"))
        case "tableau":
            tableau
        case "barres":
            barres
        case "colonnes":
            colonnes
        case "couloir":
            couloir
        case "curseur":
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(bloc.s("nom"))
                    Spacer()
                    Text(bloc.s("affichage")).fontWeight(.semibold).monospacedDigit()
                }
                .font(.system(size: 16))
                Slider(value: $valeur, in: bloc.n("min")...Swift.max(bloc.n("min") + Swift.max(1, bloc.n("pas")), bloc.n("max")), step: Swift.max(1, bloc.n("pas"))) { enCours in
                    if !enCours { navigation.agir(bloc.s("id"), valeur) }
                }
            }
        case "bascule":
            Toggle(bloc.s("nom"), isOn: $actif)
                .onChange(of: actif) { _, nouveau in navigation.agir(bloc.s("id"), nouveau) }
        case "champ":
            HStack {
                Text(bloc.s("nom")).font(.system(size: 16))
                Spacer()
                TextField(bloc.s("indication").isEmpty ? "—" : bloc.s("indication"), text: $saisie)
                    .keyboardType(bloc.b("numerique") ? .numberPad : .default)
                    .multilineTextAlignment(.trailing)
                    .focused($enSaisie)
                    .onSubmit { navigation.agir(bloc.s("id"), saisie) }
                    .onChange(of: enSaisie) { _, dedans in if !dedans { navigation.agir(bloc.s("id"), saisie) } }
                    .frame(maxWidth: 220)
            }
        case "choix":
            Picker("", selection: $choisi) {
                ForEach(Array((bloc.d["options"] as? [String] ?? []).enumerated()), id: \.offset) { rang, nom in Text(nom).tag(rang) }
            }
            .pickerStyle(.segmented)
            .onChange(of: choisi) { _, nouveau in navigation.agir(bloc.s("id"), nouveau) }
        case "bouton":
            Button {
                navigation.agir(bloc.s("id"), true)
            } label: {
                if bloc.b("principal") {
                    Text(bloc.s("texte")).font(.system(size: 17, weight: .semibold)).foregroundStyle(Teinte.boutonEncre)
                        .frame(maxWidth: .infinity).frame(height: 52)
                        .background(LinearGradient(colors: [Teinte.bouton, Teinte.bouton.opacity(0.9)], startPoint: .top, endPoint: .bottom), in: Capsule())
                } else {
                    Text(bloc.s("texte")).font(.system(size: 15, weight: .medium)).foregroundStyle(Color.primary)
                        .padding(.horizontal, 16).frame(height: 40)
                        .background(Color.primary.opacity(0.1), in: Capsule())
                }
            }
            .buttonStyle(Appui())
        default:
            EmptyView()
        }
    }

    // MARK: éléments communs

    private func barre(_ part: Double, couleur: Color) -> some View {
        GeometryReader { cadre in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.primary.opacity(0.1))
                Capsule().fill(couleur).frame(width: cadre.size.width * Swift.max(0, Swift.min(1, part)))
            }
        }
        .frame(height: 5)
    }

    private func lignes(_ lignes: [[String: Any]]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(lignes.enumerated()), id: \.offset) { _, ligne in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    if !texte(ligne, "gravite").isEmpty { Circle().fill(Teinte.gravite(texte(ligne, "gravite"))).frame(width: 8, height: 8) }
                    Text(texte(ligne, "nom")).fontWeight(vrai(ligne, "fort") ? .semibold : .regular).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    if !texte(ligne, "valeur").isEmpty {
                        Text(texte(ligne, "valeur")).fontWeight(.semibold).monospacedDigit()
                            .foregroundStyle(texte(ligne, "ton") == "moins" ? Teinte.lacune : Color.primary)
                    }
                }
                .font(.system(size: 15))
                .padding(.vertical, 9)
                .overlay(alignment: .top) { Divider().opacity(0.5) }
            }
        }
    }

    private var tableau: some View {
        let entetes = bloc.d["entetes"] as? [String] ?? [], rangees = bloc.d["lignes"] as? [[String]] ?? []
        return ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .trailing, horizontalSpacing: 18, verticalSpacing: 10) {
                GridRow {
                    ForEach(Array(entetes.enumerated()), id: \.offset) { rang, nom in
                        Text(nom.uppercased()).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(Color.secondary)
                            .gridColumnAlignment(rang == 0 ? .leading : .trailing)
                    }
                }
                ForEach(Array(rangees.enumerated()), id: \.offset) { _, rangee in
                    Divider().gridCellUnsizedAxes(.horizontal)
                    GridRow {
                        ForEach(Array(rangee.enumerated()), id: \.offset) { rang, cellule in
                            Text(cellule).font(.system(size: 14, weight: rang == 0 ? .regular : .semibold)).monospacedDigit()
                                .foregroundStyle(rang == 0 ? Color.secondary : Color.primary)
                                .frame(maxWidth: rang == 0 ? 220 : nil, alignment: rang == 0 ? .leading : .trailing)
                        }
                    }
                }
            }
        }
    }

    private var barres: some View {
        let donnees = bloc.liste("barres")
        return Chart {
            ForEach(Array(donnees.enumerated()), id: \.offset) { _, x in
                BarMark(x: .value("nom", texte(x, "libelle")), y: .value("part", nombre(x, "part")))
                    .foregroundStyle(vrai(x, "actif") ? Teinte.accent : Color.secondary.opacity(0.45))
                    .cornerRadius(4)
            }
        }
        .chartYAxis(.hidden)
        .chartXAxis { AxisMarks { _ in AxisValueLabel().font(.system(size: bloc.b("dense") ? 8 : 11)) } }
        .frame(height: bloc.b("dense") ? 150 : 110)
    }

    /// Colonnes empilées (âge de départ) : 1er, 2e, 3e pilier, et le besoin en pointillé. Toucher un âge le choisit.
    private var colonnes: some View {
        let donnees = bloc.liste("colonnes"), couleurs = [Teinte.pilier1, Teinte.pilier2, Teinte.pilier3]
        return VStack(alignment: .leading, spacing: 12) {
            Chart {
                ForEach(Array(donnees.enumerated()), id: \.offset) { _, colonne in
                    ForEach(Array((colonne["couches"] as? [NSNumber] ?? []).enumerated()), id: \.offset) { rang, couche in
                        BarMark(x: .value("âge", texte(colonne, "libelle")), y: .value("revenu", couche.doubleValue))
                            .foregroundStyle(couleurs[rang % couleurs.count].opacity(vrai(colonne, "actif") ? 1 : 0.5))
                    }
                    RectangleMark(x: .value("âge", texte(colonne, "libelle")), y: .value("besoin", nombre(colonne, "besoin")), height: .fixed(2))
                        .foregroundStyle(Color.primary)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { valeur in
                    AxisGridLine().foregroundStyle(Color.primary.opacity(0.08))
                    AxisValueLabel { if let montant = valeur.as(Double.self) { Text(montant >= 1000 ? "\(Int(montant / 1000))k" : "\(Int(montant))") } }
                }
            }
            .frame(height: 230)
            if !bloc.s("id").isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(donnees.enumerated()), id: \.offset) { rang, colonne in
                            Button {
                                navigation.agir(bloc.s("id"), rang)
                            } label: {
                                VStack(spacing: 2) {
                                    Text(texte(colonne, "libelle")).font(.system(size: 15, weight: .semibold))
                                    Text(texte(colonne, "note")).font(.system(size: 10)).foregroundStyle(vrai(colonne, "actif") ? Color.white.opacity(0.85) : Color.secondary)
                                }
                                .foregroundStyle(vrai(colonne, "actif") ? Color.white : Color.primary)
                                .frame(minWidth: 52).padding(.vertical, 8).padding(.horizontal, 6)
                                .background(vrai(colonne, "actif") ? Teinte.accent : Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(Appui())
                        }
                    }
                }
            }
        }
    }

    /// Simulation de placement : le couloir du probable (10e à 90e centile), la médiane, et le total versé.
    private var couloir: some View {
        let points = bloc.liste("points"), depart = bloc.n("depart")
        return Chart {
            ForEach(Array(points.enumerated()), id: \.offset) { _, p in
                AreaMark(x: .value("âge", depart + nombre(p, "annee")), yStart: .value("prudent", nombre(p, "p10")), yEnd: .value("favorable", nombre(p, "p90")))
                    .foregroundStyle(Teinte.accent.opacity(0.22))
                LineMark(x: .value("âge", depart + nombre(p, "annee")), y: .value("médian", nombre(p, "p50")), series: .value("série", "médiane"))
                    .foregroundStyle(Teinte.accent)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                LineMark(x: .value("âge", depart + nombre(p, "annee")), y: .value("versé", nombre(p, "verse")), series: .value("série", "versé"))
                    .foregroundStyle(Color.secondary)
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { valeur in
                AxisGridLine().foregroundStyle(Color.primary.opacity(0.08))
                AxisValueLabel { if let montant = valeur.as(Double.self) { Text(montant >= 1000 ? "\(Int(montant / 1000))k" : "\(Int(montant))") } }
            }
        }
        .frame(height: 230)
    }
}
