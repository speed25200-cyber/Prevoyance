import AVFoundation
import CoreMotion
import SwiftUI

/// Le film de l'accueil : les trois piliers émergent de l'eau (une fois, à l'ouverture de l'app), puis la scène vit en
/// boucle — la brume passe, l'eau frémit, le verre respire. Deux lecteurs vidéo du système superposés : le passage de
/// l'un à l'autre se fait en fondu, sur la même image. Muet, sans jamais couper la musique de l'utilisateur.
final class VueFilm: UIView {
    private let lecteurIntro = AVPlayer()
    private let lecteurBoucle = AVQueuePlayer()
    private var repetition: AVPlayerLooper?
    private let coucheIntro = AVPlayerLayer()
    private let coucheBoucle = AVPlayerLayer()
    private var observateurs: [NSObjectProtocol] = []

    init(intro: URL?, boucle: URL?, avecIntro: Bool) {
        super.init(frame: .zero)
        backgroundColor = .clear
        isUserInteractionEnabled = false
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: .mixWithOthers)
        coucheBoucle.player = lecteurBoucle
        coucheIntro.player = lecteurIntro
        for couche in [coucheBoucle, coucheIntro] {
            couche.videoGravity = .resizeAspectFill
            layer.addSublayer(couche)
        }
        for lecteur in [lecteurIntro, lecteurBoucle as AVPlayer] {
            lecteur.isMuted = true
            lecteur.allowsExternalPlayback = false
            lecteur.preventsDisplaySleepDuringVideoPlayback = false
        }
        if let boucle { repetition = AVPlayerLooper(player: lecteurBoucle, templateItem: AVPlayerItem(url: boucle)) }
        if avecIntro, let intro {
            let element = AVPlayerItem(url: intro)
            lecteurIntro.replaceCurrentItem(with: element)
            observateurs.append(NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: element, queue: .main) { [weak self] _ in
                self?.passerALaBoucle()
            })
            lecteurIntro.play()
        } else {
            coucheIntro.isHidden = true
            lecteurBoucle.play()
        }
        // au retour dans l'app, la boucle reprend
        observateurs.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            if self.coucheIntro.isHidden || self.coucheIntro.opacity == 0 { self.lecteurBoucle.play() } else { self.lecteurIntro.play() }
        })
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("non utilisé") }

    deinit { observateurs.forEach(NotificationCenter.default.removeObserver) }

    /// Fin de l'émergence : la boucle démarre dessous, l'intro s'efface en fondu.
    private func passerALaBoucle() {
        lecteurBoucle.play()
        CATransaction.begin()
        CATransaction.setAnimationDuration(0.9)
        coucheIntro.opacity = 0
        CATransaction.commit()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        coucheIntro.frame = bounds
        coucheBoucle.frame = bounds
        CATransaction.commit()
    }
}

/// Le film, posé dans SwiftUI.
struct FilmAccueil: UIViewRepresentable {
    let avecIntro: Bool

    static func fichier(_ nom: String) -> URL? {
        let adresse = Bundle.main.bundleURL.appendingPathComponent("web/images/\(nom)")
        return FileManager.default.fileExists(atPath: adresse.path) ? adresse : nil
    }

    func makeUIView(context: Context) -> VueFilm {
        VueFilm(intro: FilmAccueil.fichier("accueil-intro.mp4"), boucle: FilmAccueil.fichier("accueil-boucle.mp4"), avecIntro: avecIntro)
    }

    func updateUIView(_ vue: VueFilm, context: Context) {}
}

/// L'inclinaison de l'appareil, lissée : elle décale légèrement le film et le texte en sens contraire, pour donner de la
/// profondeur à l'accueil (aucune autorisation n'est nécessaire ; rien sur un appareil sans capteur de mouvement).
@MainActor
final class Inclinaison: ObservableObject {
    @Published var x: CGFloat = 0
    @Published var y: CGFloat = 0
    private let capteur = CMMotionManager()

    func demarrer() {
        guard capteur.isDeviceMotionAvailable, !capteur.isDeviceMotionActive else { return }
        capteur.deviceMotionUpdateInterval = 1.0 / 30.0
        capteur.startDeviceMotionUpdates(to: .main) { [weak self] mouvement, _ in
            guard let self, let gravite = mouvement?.gravity else { return }
            // lissage : le déplacement suit l'appareil sans trembler
            self.x += (CGFloat(max(-0.5, min(0.5, gravite.x))) - self.x) * 0.12
            self.y += (CGFloat(max(-0.5, min(0.5, gravite.y + 0.6))) - self.y) * 0.12
        }
    }

    func arreter() {
        capteur.stopDeviceMotionUpdates()
    }
}
