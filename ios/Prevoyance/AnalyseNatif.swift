import Charts
import SwiftUI

/// La palette « Alpin — Nuit » : une nuit de montagne, la glace, l'acier et le granit, un seul accent rouge.
/// Les sources de revenu gardent les mêmes couleurs sur tous les écrans.
enum Teinte {
    static let accent = Color(red: 0.886, green: 0.227, blue: 0.267)
    static let nuit = Color(red: 0.043, green: 0.082, blue: 0.133)
    static let nuitBasse = Color(red: 0.055, green: 0.106, blue: 0.173)
    static let glace = Color(red: 0.745, green: 0.824, blue: 0.922)
    static let bouton = Color(red: 0.933, green: 0.953, blue: 0.973)
    static let boutonEncre = Color(red: 0.043, green: 0.082, blue: 0.133)
    static let salaire = Color(red: 0.33, green: 0.40, blue: 0.50)
    static let pilier1 = Color(red: 0.60, green: 0.65, blue: 0.72)
    static let pilier2 = Color(red: 0.38, green: 0.52, blue: 0.70)
    static let pilier3 = Color(red: 0.66, green: 0.86, blue: 0.99)
    static let lacune = Color(red: 0.94, green: 0.46, blue: 0.33)

    static func pilier(_ numero: Int) -> Color {
        switch numero {
        case 1: return pilier1
        case 2: return pilier2
        case 3: return pilier3
        case -1: return lacune
        default: return Color.secondary
        }
    }

    static func gravite(_ nom: String) -> Color {
        switch nom {
        case "critique": return lacune
        case "attention": return Color(red: 0.95, green: 0.72, blue: 0.30)
        case "opportunite": return Color(red: 0.30, green: 0.78, blue: 0.56)
        default: return Color.secondary
        }
    }
}

/// L'analyse du dossier, en natif : la lacune du risque choisi, ce que verse chaque pilier, les cinq risques, la ligne
/// de vie, le détail des sources et les points d'attention. Les chiffres viennent du moteur, par la page.
struct AnalyseNatif: View {
    @ObservedObject var navigation: Navigation

    var body: some View {
        NavigationStack {
            ScrollView {
                if let a = navigation.analyse {
                    VStack(alignment: .leading, spacing: 18) {
                        tete(a)
                        risques(a)
                        ligneDeVie(a)
                        detail(a)
                        if !a.alertes.isEmpty { alertes(a) }
                        Text(a.avertissement).font(.footnote).foregroundStyle(Color.secondary).padding(.horizontal, 6)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 8)
                    .frame(maxWidth: 860)
                    .frame(maxWidth: .infinity)
                } else {
                    ProgressView().padding(.top, 120)
                }
            }
            .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 84) }
            .background(FondApp())
            .navigationTitle(navigation.noms["analyse"] ?? "")
            .toolbar { OutilsEcran(navigation: navigation) }
        }
    }

    // MARK: la lacune du risque choisi

    private func tete(_ a: AnalyseModele) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if let choix = a.cibleChoix {
                Picker("", selection: Binding(get: { choix }, set: { navigation.appeler("cible", $0) })) {
                    Text(a.ciblePersonne).tag("personne")
                    Text(a.cibleConjoint).tag("conjoint")
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 280)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(a.titre.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(2.2).foregroundStyle(Color.secondary)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(a.montant)
                        .font(.system(size: 54, weight: .light))
                        .foregroundStyle(Color.primary)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                        .contentTransition(.numericText())
                    Text(a.parMois).font(.system(size: 16)).foregroundStyle(Color.secondary)
                }
            }
            VStack(spacing: 0) {
                ForEach(a.cles) { cle in
                    HStack {
                        Text(cle.nom).foregroundStyle(Color.secondary)
                        Spacer()
                        Text(cle.valeur).fontWeight(.semibold).monospacedDigit().contentTransition(.numericText())
                    }
                    .font(.system(size: 16))
                    .padding(.vertical, 11)
                    .overlay(alignment: .top) { Divider().opacity(0.6) }
                }
            }
            Button {
                navigation.choisir("plan")
            } label: {
                HStack(spacing: 10) {
                    Text(a.bouton).font(.system(size: 17, weight: .semibold))
                    Image(systemName: "arrow.right").font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(Teinte.boutonEncre)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(LinearGradient(colors: [Teinte.bouton, Teinte.bouton.opacity(0.9)], startPoint: .top, endPoint: .bottom), in: Capsule())
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.3), lineWidth: 0.8))
                .shadow(color: Color.black.opacity(0.35), radius: 16, y: 9)
            }
            .buttonStyle(Appui())
            HStack(spacing: 0) {
                ForEach(a.piliers) { pilier in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Circle().fill(Teinte.pilier(pilier.id + 1)).frame(width: 8, height: 8)
                            Text(pilier.nom.uppercased()).font(.system(size: 10.5, weight: .semibold)).tracking(1).foregroundStyle(Color.secondary).lineLimit(1)
                        }
                        Text(pilier.montant).font(.system(size: 16, weight: .semibold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
                            .opacity(pilier.vide ? 0.45 : 1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.top, 2)
        }
        .padding(22)
        .verreArrondi(rayon: 30)
        .animation(.easeInOut(duration: 0.35), value: a.montant)
    }

    // MARK: les cinq risques

    private func risques(_ a: AnalyseModele) -> some View {
        VStack(spacing: 0) {
            ForEach(a.risques) { risque in
                Button {
                    navigation.appeler("risque", risque.id)
                } label: {
                    VStack(spacing: 8) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(risque.nom).font(.system(size: 16, weight: risque.actif ? .bold : .regular)).foregroundStyle(Color.primary)
                            Spacer()
                            VStack(alignment: .trailing, spacing: 1) {
                                Text(risque.montant).font(.system(size: 16, weight: .semibold)).monospacedDigit().foregroundStyle(Color.primary)
                                Text(risque.note).font(.system(size: 12)).foregroundStyle(Color.secondary)
                            }
                        }
                        GeometryReader { cadre in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.primary.opacity(0.1))
                                Capsule().fill(Teinte.accent)
                                    .frame(width: cadre.size.width * Swift.max(0, Swift.min(1, risque.couverture)))
                            }
                        }
                        .frame(height: 4)
                    }
                    .padding(.vertical, 13)
                    .contentShape(Rectangle())
                }
                .buttonStyle(Appui())
                if risque.id != a.risques.last?.id { Divider().opacity(0.6) }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 4)
        .verreArrondi(rayon: 26)
    }

    // MARK: la ligne de vie

    private func ligneDeVie(_ a: AnalyseModele) -> some View {
        let noms = a.legende
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(a.ligneTitre).font(.system(size: 20, weight: .semibold))
                Text(a.ligneNote).font(.system(size: 14)).foregroundStyle(Color.secondary)
            }
            Chart {
                ForEach(a.ligne) { point in
                    BarMark(x: .value("âge", point.id), y: .value("revenu", point.salaire), width: .ratio(1))
                        .foregroundStyle(by: .value("source", noms[0]))
                    BarMark(x: .value("âge", point.id), y: .value("revenu", point.p1), width: .ratio(1))
                        .foregroundStyle(by: .value("source", noms[1]))
                    BarMark(x: .value("âge", point.id), y: .value("revenu", point.p2), width: .ratio(1))
                        .foregroundStyle(by: .value("source", noms[2]))
                    BarMark(x: .value("âge", point.id), y: .value("revenu", point.p3), width: .ratio(1))
                        .foregroundStyle(by: .value("source", noms[3]))
                }
                ForEach(a.ligne) { point in
                    LineMark(x: .value("âge", point.id), y: .value("besoin", point.besoin), series: .value("série", noms[4]))
                        .interpolationMethod(.stepCenter)
                        .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 4]))
                        .foregroundStyle(Color.primary)
                }
            }
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
            .frame(height: 260)
        }
        .padding(20)
        .verreArrondi(rayon: 26)
    }

    // MARK: d'où vient le revenu

    private func detail(_ a: AnalyseModele) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(a.detailTitre).font(.system(size: 20, weight: .semibold))
            GeometryReader { cadre in
                HStack(spacing: 2) {
                    ForEach(a.sources.filter { $0.part > 0 }) { source in
                        Capsule().fill(Teinte.pilier(source.pilier))
                            .frame(width: Swift.max(3, (cadre.size.width - 12) * Swift.min(1, source.part)))
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(height: 10)
            VStack(spacing: 0) {
                ForEach(a.sources) { source in
                    HStack(spacing: 10) {
                        if source.pilier != 0 { Circle().fill(Teinte.pilier(source.pilier)).frame(width: 9, height: 9) }
                        Text(source.nom).fontWeight(source.pilier == 0 ? .semibold : .regular)
                        Spacer()
                        Text(source.montant).fontWeight(.semibold).monospacedDigit()
                            .foregroundStyle(source.pilier == -1 ? Teinte.lacune : Color.primary)
                    }
                    .font(.system(size: 16))
                    .padding(.vertical, 10)
                    .overlay(alignment: .top) { Divider().opacity(0.6) }
                }
            }
            if !a.attente.isEmpty {
                Text(a.attente).font(.system(size: 14)).foregroundStyle(Color.secondary)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
        .padding(20)
        .verreArrondi(rayon: 26)
    }

    // MARK: points d'attention

    private func alertes(_ a: AnalyseModele) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(a.alertesTitre).font(.system(size: 20, weight: .semibold))
            ForEach(a.alertes) { alerte in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Circle().fill(Teinte.gravite(alerte.gravite)).frame(width: 9, height: 9)
                    Text(alerte.texte).font(.system(size: 15)).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, 2)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .verreArrondi(rayon: 26)
    }
}
