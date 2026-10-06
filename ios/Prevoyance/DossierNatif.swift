import PhotosUI
import SwiftUI

/// Le fond des écrans natifs : bleu nuit (ou clair), avec un halo de lumière en haut.
struct FondApp: View {
    @Environment(\.colorScheme) private var theme

    var body: some View {
        let sombre = theme == .dark
        ZStack {
            (sombre ? Color(red: 0.016, green: 0.035, blue: 0.075) : Color(red: 0.93, green: 0.95, blue: 0.98))
            RadialGradient(colors: [Color(red: 0.18, green: 0.49, blue: 0.96).opacity(sombre ? 0.42 : 0.22), .clear],
                           center: .topLeading, startRadius: 0, endRadius: 620)
            RadialGradient(colors: [Color(red: 0.33, green: 0.27, blue: 0.86).opacity(sombre ? 0.3 : 0.12), .clear],
                           center: .bottomTrailing, startRadius: 0, endRadius: 560)
        }
        .ignoresSafeArea()
    }
}

/// Les commandes communes des écrans natifs, dans la barre du système : retour à l'accueil, année et langue.
struct OutilsEcran: ToolbarContent {
    let navigation: Navigation

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                navigation.montrerAccueil()
            } label: {
                Image(systemName: "house")
            }
            .accessibilityLabel(Text(navigation.textes["accueil"] ?? "Accueil"))
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Picker("", selection: Binding(get: { navigation.annee }, set: { navigation.regler(annee: $0) })) {
                    ForEach(navigation.annees, id: \.self) { an in Text(String(an)).tag(an) }
                }
                Picker("", selection: Binding(get: { navigation.langue }, set: { navigation.regler(langue: $0) })) {
                    ForEach(navigation.langues, id: \.self) { code in Text(code.uppercased()).tag(code) }
                }
            } label: {
                Text("\(String(navigation.annee)) · \(navigation.langue.uppercased())")
                    .font(.system(size: 15, weight: .semibold))
            }
        }
    }
}

/// Le dossier du client, en natif : la liste des rubriques, puis les champs de la rubrique choisie.
/// Sur iPad, les deux colonnes sont côte à côte ; sur iPhone, on entre dans une rubrique et on revient.
struct DossierNatif: View {
    @ObservedObject var navigation: Navigation
    @State private var choisie: String?
    /// Sur iPad, la liste et la rubrique restent côte à côte, en portrait comme en paysage.
    @State private var colonnes = NavigationSplitViewVisibility.all
    @Environment(\.horizontalSizeClass) private var largeur

    var body: some View {
        NavigationSplitView(columnVisibility: $colonnes) {
            List(selection: $choisie) {
                Section {
                    ForEach(Array(navigation.rubriques.enumerated()), id: \.element.id) { rang, rubrique in
                        NavigationLink(value: rubrique.id) {
                            Label {
                                Text(rubrique.titre).font(.system(size: 17, weight: .medium))
                            } icon: {
                                Image(systemName: rubrique.symbole)
                            }
                            .padding(.vertical, 4)
                        }
                        .accessibilityHint(Text(String(rang + 1)))
                    }
                } header: {
                    Text(navigation.nomDossier).font(.system(size: 13, weight: .semibold)).textCase(nil)
                }
            }
            .scrollContentBackground(.hidden)
            .background(FondApp())
            .navigationTitle(navigation.noms["dossier"] ?? "")
            .toolbar { OutilsEcran(navigation: navigation) }
            .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 84) }
        } detail: {
            if let rubrique = navigation.rubriques.first(where: { $0.id == choisie }) {
                RubriqueNative(navigation: navigation, rubrique: rubrique)
                    .id("\(rubrique.id)-\(navigation.versionSchema)")
            } else {
                FondApp()
            }
        }
        .navigationSplitViewStyle(.balanced)
        // écran large : une rubrique est toujours ouverte (la première d'emblée) ; iPhone : on commence par la liste
        .task(id: "\(navigation.versionSchema)-\(largeur == .regular)") {
            guard largeur == .regular else { return }
            if choisie == nil || !navigation.rubriques.contains(where: { $0.id == choisie }) { choisie = navigation.rubriques.first?.id }
        }
    }
}

/// Les champs d'une rubrique, dans une liste du système.
struct RubriqueNative: View {
    @ObservedObject var navigation: Navigation
    let rubrique: Rubrique

    var body: some View {
        Form {
            ForEach(rubrique.champs) { champ in
                ChampNatif(navigation: navigation, champ: champ)
            }
        }
        .scrollContentBackground(.hidden)
        .background(FondApp())
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(rubrique.titre)
        .navigationBarTitleDisplayMode(.large)
        .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 84) }
    }
}

/// Un champ, avec le composant du système qui lui correspond.
struct ChampNatif: View {
    @ObservedObject var navigation: Navigation
    let champ: Champ
    @State private var texte: String
    @State private var montant: Int?
    @State private var actif: Bool
    @State private var valeur: Double
    @State private var date: Date
    @State private var demande = false
    @State private var signature = false
    @State private var photo: PhotosPickerItem?

    private static let formatDate: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    init(navigation: Navigation, champ: Champ) {
        self.navigation = navigation
        self.champ = champ
        _texte = State(initialValue: champ.texte)
        _montant = State(initialValue: champ.nombre.map { Int($0.rounded()) })
        _actif = State(initialValue: champ.actif)
        _valeur = State(initialValue: champ.nombre ?? champ.min)
        _date = State(initialValue: ChampNatif.formatDate.date(from: champ.texte) ?? Date(timeIntervalSince1970: 315_532_800))
    }

    var body: some View {
        switch champ.type {
        case "titre":
            Text(champ.libelle).font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.secondary).textCase(.uppercase)
                .listRowBackground(Color.clear)
        case "note":
            Text(champ.libelle).font(.footnote).foregroundStyle(Color.secondary).listRowBackground(Color.clear)
        case "texte":
            VStack(alignment: .leading, spacing: 4) {
                LabeledContent(champ.libelle) {
                    TextField(champ.indication, text: $texte)
                        .multilineTextAlignment(.trailing)
                        .autocorrectionDisabled()
                }
                if !champ.note.isEmpty { Text(champ.note).font(.footnote).foregroundStyle(Color.secondary) }
            }
            .onChange(of: texte) { _, nouveau in navigation.ecrire(champ.id, texte: nouveau) }
        case "long":
            VStack(alignment: .leading, spacing: 6) {
                Text(champ.libelle).font(.subheadline).foregroundStyle(Color.secondary)
                TextField(champ.indication, text: $texte, axis: .vertical).lineLimit(2...8)
            }
            .onChange(of: texte) { _, nouveau in navigation.ecrire(champ.id, texte: nouveau) }
        case "secret":
            SecureField(champ.libelle, text: $texte)
                .textContentType(.newPassword)
                .onChange(of: texte) { _, nouveau in navigation.ecrire(champ.id, texte: nouveau) }
        case "montant":
            LabeledContent(champ.libelle) {
                HStack(spacing: 6) {
                    Text("CHF").foregroundStyle(Color.secondary)
                    TextField(champ.facultatif ? "—" : "0", value: $montant, format: .number.grouping(.automatic))
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(minWidth: 90)
                }
            }
            .onChange(of: montant) { _, nouveau in navigation.ecrire(champ.id, montant: nouveau) }
        case "choix":
            Picker(champ.libelle, selection: $texte) {
                ForEach(champ.options) { option in Text(option.l).tag(option.v) }
            }
            .onChange(of: texte) { _, nouveau in navigation.ecrire(champ.id, texte: nouveau) }
        case "date":
            DatePicker(champ.libelle, selection: $date, in: ...Date(), displayedComponents: .date)
                .onChange(of: date) { _, nouvelle in navigation.ecrire(champ.id, texte: ChampNatif.formatDate.string(from: nouvelle)) }
        case "bascule":
            Toggle(champ.libelle, isOn: $actif)
                .onChange(of: actif) { _, nouveau in navigation.ecrire(champ.id, actif: nouveau) }
        case "compteur":
            Stepper(value: $valeur, in: champ.min...Swift.max(champ.min, champ.max), step: 1) {
                LabeledContent(champ.libelle) { Text(String(Int(valeur))).font(.system(size: 17, weight: .semibold)) }
            }
            .onChange(of: valeur) { _, nouveau in navigation.ecrire(champ.id, nombre: nouveau) }
        case "curseur":
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(champ.libelle)
                    Spacer()
                    Text(etiquette).font(.system(size: 17, weight: .semibold)).monospacedDigit()
                }
                Slider(value: $valeur, in: champ.min...Swift.max(champ.min + champ.pas, champ.max), step: champ.pas)
            }
            .padding(.vertical, 4)
            .onChange(of: valeur) { _, nouveau in navigation.ecrire(champ.id, nombre: nouveau) }
        case "action":
            Button(role: champ.icone == "danger" ? .destructive : nil) {
                if champ.options.isEmpty && champ.icone != "danger" { navigation.ecrire(champ.id, actif: true) } else { demande = true }
            } label: {
                Label(champ.libelle, systemImage: champ.icone == "scan" ? "doc.viewfinder" : champ.icone == "danger" ? "lock.open" : "lock")
            }
            .confirmationDialog(champ.icone == "danger" ? champ.note : champ.libelle, isPresented: $demande, titleVisibility: .visible) {
                if champ.options.isEmpty {
                    Button(champ.libelle, role: .destructive) { navigation.ecrire(champ.id, actif: true) }
                } else {
                    ForEach(champ.options) { option in
                        Button(option.l) { navigation.ecrire(champ.id, texte: option.v) }
                    }
                }
            }
        case "signature":
            HStack {
                Button {
                    signature = true
                } label: {
                    Label(champ.libelle, systemImage: (champ.nombre ?? 0) > 0 || !texte.isEmpty ? "checkmark.seal.fill" : "signature")
                }
                Spacer()
                if (champ.nombre ?? 0) > 0 || !texte.isEmpty {
                    Button(champ.indication, role: .destructive) { texte = ""; navigation.ecrire(champ.id, texte: "", presence: 0) }
                        .buttonStyle(.borderless)
                        .font(.subheadline)
                }
            }
            .sheet(isPresented: $signature) {
                PadSignature(titre: champ.libelle, effacer: champ.indication) { image in
                    texte = image.isEmpty ? "" : "signé"
                    navigation.ecrire(champ.id, texte: image, presence: image.isEmpty ? 0 : 1)
                }
            }
        case "logo":
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    PhotosPicker(selection: $photo, matching: .images) {
                        Label(champ.libelle, systemImage: (champ.nombre ?? 0) > 0 ? "photo.fill" : "photo")
                    }
                    Spacer()
                    if (champ.nombre ?? 0) > 0 {
                        Button(champ.indication, role: .destructive) { navigation.ecrire(champ.id, texte: "", presence: 0) }
                            .buttonStyle(.borderless)
                            .font(.subheadline)
                    }
                }
                if !champ.note.isEmpty { Text(champ.note).font(.footnote).foregroundStyle(Color.secondary) }
            }
            .onChange(of: photo) { _, choisie in
                guard let choisie else { return }
                Task {
                    if let donnees = try? await choisie.loadTransferable(type: Data.self), let image = ChampNatif.reduire(donnees) {
                        navigation.ecrire(champ.id, texte: image, presence: 1)
                    }
                }
            }
        default:
            EmptyView()
        }
    }

    /// Libellé de la position du curseur (fourni par la page pour chaque cran).
    private var etiquette: String {
        guard champ.pas > 0 else { return "" }
        let rang = Int(((valeur - champ.min) / champ.pas).rounded())
        return champ.etiquettes.indices.contains(rang) ? champ.etiquettes[rang] : ""
    }

    /// Logo ramené à 520 x 180 points au plus, en PNG (adresse de données pour la page).
    static func reduire(_ donnees: Data) -> String? {
        guard let image = UIImage(data: donnees), image.size.width > 0, image.size.height > 0 else { return nil }
        let echelle = Swift.min(1, 520 / image.size.width, 180 / image.size.height)
        let taille = CGSize(width: image.size.width * echelle, height: image.size.height * echelle)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let rendu = UIGraphicsImageRenderer(size: taille, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: taille)) }
        guard let png = rendu.pngData() else { return nil }
        return "data:image/png;base64," + png.base64EncodedString()
    }
}

/// Signature au doigt ou au stylet, sur une feuille blanche. Le tracé est rendu en PNG transparent pour le rapport.
struct PadSignature: View {
    let titre: String
    let effacer: String
    let terminer: (String) -> Void
    @Environment(\.dismiss) private var fermer
    /// Traits en coordonnées relatives (0 à 1) : le rendu final ne dépend pas de la taille de l'écran.
    @State private var traits: [[CGPoint]] = []
    @State private var courant: [CGPoint] = []

    var body: some View {
        NavigationStack {
            VStack {
                GeometryReader { cadre in
                    Trace(traits: traits + [courant])
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .gesture(DragGesture(minimumDistance: 0)
                            .onChanged { geste in
                                courant.append(CGPoint(x: geste.location.x / Swift.max(1, cadre.size.width), y: geste.location.y / Swift.max(1, cadre.size.height)))
                            }
                            .onEnded { _ in traits.append(courant); courant = [] })
                }
                .aspectRatio(640.0 / 220.0, contentMode: .fit)
                .padding(20)
                Spacer()
            }
            .background(FondApp())
            .navigationTitle(titre)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(effacer) { traits = []; courant = [] }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK") {
                        terminer(image())
                        fermer()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }

    /// Le tracé en PNG transparent de 640 x 220 points, ou une chaîne vide s'il n'y a rien.
    @MainActor
    private func image() -> String {
        guard traits.contains(where: { $0.count > 1 }) else { return "" }
        let rendu = ImageRenderer(content: Trace(traits: traits).frame(width: 640, height: 220))
        rendu.scale = 1
        guard let png = rendu.uiImage?.pngData() else { return "" }
        return "data:image/png;base64," + png.base64EncodedString()
    }
}

/// Dessin des traits d'une signature.
struct Trace: View {
    let traits: [[CGPoint]]

    var body: some View {
        Canvas { contexte, taille in
            for trait in traits where !trait.isEmpty {
                var chemin = Path()
                chemin.addLines(trait.map { CGPoint(x: $0.x * taille.width, y: $0.y * taille.height) })
                contexte.stroke(chemin, with: .color(Color(red: 0.04, green: 0.07, blue: 0.13)),
                                style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
            }
        }
    }
}
