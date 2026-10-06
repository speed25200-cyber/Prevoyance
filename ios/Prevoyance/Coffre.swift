import CommonCrypto
import CryptoKit
import Foundation
import WebKit

/// Chiffrement des dossiers pour la page (`web/src/verrou.js`).
///
/// Dans un navigateur, la page chiffre elle-même (Web Crypto). Dans l'app, l'adresse interne `prevoyance://` n'est pas
/// un « contexte sécurisé » : Web Crypto n'y existe pas. L'app fournit donc les trois mêmes opérations, avec les mêmes
/// algorithmes et le même format, si bien qu'un coffre créé d'un côté s'ouvre de l'autre :
/// - `deriver` : clé de 256 bits tirée du code par PBKDF2-HMAC-SHA-256 (sel et nombre de tours fournis par la page) ;
/// - `chiffrer` / `dechiffrer` : AES-GCM 256 bits, texte chiffré suivi de son sceau de 16 octets, en base64.
/// La clé ne quitte jamais l'app : la page ne reçoit qu'un jeton, oublié à la fermeture du coffre.
@MainActor
final class Coffre: NSObject, WKScriptMessageHandlerWithReply {
    private var cles: [String: SymmetricKey] = [:]

    func userContentController(_ controleur: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler repondre: @escaping (Any?, String?) -> Void) {
        guard let demande = message.body as? [String: Any], let operation = demande["op"] as? String else {
            return repondre(nil, "demande invalide")
        }
        let octets: (String) -> Data? = { nom in (demande[nom] as? String).flatMap { Data(base64Encoded: $0) } }
        switch operation {
        case "deriver":
            guard let code = demande["code"] as? String, let sel = octets("sel"),
                  let tours = demande["iterations"] as? Int, tours > 0 else { return repondre(nil, "paramètres manquants") }
            Task {
                // des centaines de milliers de tours : hors du fil principal, pour ne pas figer l'écran
                let cle = await Task.detached(priority: .userInitiated) { Coffre.pbkdf2(code: code, sel: sel, tours: tours) }.value
                guard let cle else { return repondre(nil, "dérivation impossible") }
                let jeton = UUID().uuidString
                self.cles[jeton] = SymmetricKey(data: cle)
                repondre(["jeton": jeton], nil)
            }
        case "chiffrer":
            guard let jeton = demande["jeton"] as? String, let cle = cles[jeton], let iv = octets("iv"),
                  let clair = demande["clair"] as? String, let nonce = try? AES.GCM.Nonce(data: iv),
                  let scelle = try? AES.GCM.seal(Data(clair.utf8), using: cle, nonce: nonce) else { return repondre(nil, "chiffrement impossible") }
            repondre((scelle.ciphertext + scelle.tag).base64EncodedString(), nil)
        case "dechiffrer":
            guard let jeton = demande["jeton"] as? String, let cle = cles[jeton], let iv = octets("iv"),
                  let donnees = octets("donnees"), donnees.count >= 16, let nonce = try? AES.GCM.Nonce(data: iv),
                  let boite = try? AES.GCM.SealedBox(nonce: nonce, ciphertext: donnees.dropLast(16), tag: donnees.suffix(16)),
                  let clair = try? AES.GCM.open(boite, using: cle), let texte = String(data: clair, encoding: .utf8) else {
                // code faux ou contenu altéré : le sceau ne correspond pas
                return repondre(nil, "déchiffrement impossible")
            }
            repondre(texte, nil)
        case "fermer":
            if let jeton = demande["jeton"] as? String { cles[jeton] = nil }
            repondre(true, nil)
        default:
            repondre(nil, "opération inconnue")
        }
    }

    /// PBKDF2-HMAC-SHA-256, clé de 32 octets.
    nonisolated static func pbkdf2(code: String, sel: Data, tours: Int) -> Data? {
        let motDePasse = code.utf8.map { Int8(bitPattern: $0) }
        let selOctets = [UInt8](sel)
        var cle = [UInt8](repeating: 0, count: 32)
        let etat = CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), motDePasse, motDePasse.count, selOctets, selOctets.count,
                                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(tours), &cle, cle.count)
        return etat == Int32(kCCSuccess) ? Data(cle) : nil
    }
}
