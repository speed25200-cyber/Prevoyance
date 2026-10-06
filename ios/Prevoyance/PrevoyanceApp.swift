import SwiftUI

/// L'app native : une enveloppe autour des écrans et du moteur du dépôt (dossiers `web/` et `moteur/`),
/// servis depuis l'app elle-même. Aucune connexion n'est nécessaire, sauf pour vérifier les mises à jour des données.
@main
struct PrevoyanceApp: App {
    var body: some Scene {
        WindowGroup {
            Ecran()
                .background(Color("FondLancement").ignoresSafeArea())
                .persistentSystemOverlays(.hidden)
        }
    }
}
