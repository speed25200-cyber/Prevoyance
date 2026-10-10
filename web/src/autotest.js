// @ts-check
/**
 * Autotest de l'application dans son enveloppe iPhone / iPad.
 *
 * L'app le lance quand elle est démarrée avec PREVOYANCE_AUTOTEST=1 (simulateur de l'intégration continue, voir
 * ios/autotest.sh) : il vérifie, dans la vraie vue web d'iOS, ce qu'un navigateur d'ordinateur ne peut pas prouver —
 * les ponts vers l'app, le chiffrement des dossiers, les six vues, l'absence d'erreur et de débordement.
 * Il ne touche pas aux dossiers enregistrés (stockage d'essai pour le coffre).
 */

/** @param {string} [finale] vue laissée à l'écran à la fin (pour la capture) */
export async function executer(finale = 'analyse') {
  /** @type {{nom: string, ok: boolean, detail: string}[]} */ const resultats = [];
  const noter = (nom, ok, detail = '') => resultats.push({ nom, ok: !!ok, detail: String(detail).slice(0, 110) });
  const attendre = ms => new Promise(f => setTimeout(f, ms));
  const w = /** @type {any} */ (window), p = w.__prevoyance;
  try {
    noter('contexte', true, `subtle=${!!globalThis.crypto?.subtle} sur=${isSecureContext} ${innerWidth}x${innerHeight} dpr=${devicePixelRatio} tactile=${matchMedia('(pointer: coarse)').matches}`);
    noter('page prête et dossier analysé', typeof p?.ctx?.analyse?.score === 'number', `score ${p?.ctx?.analyse?.score}`);
    noter('la page sait qu’elle est dans l’app', document.documentElement.classList.contains('natif'));
    noter('menu de la page retiré (barre native)', getComputedStyle(/** @type {HTMLElement} */ (document.getElementById('onglets'))).display === 'none');
    noter('zoom de page désactivé', /user-scalable=no/.test(document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? '') && Math.abs((visualViewport?.scale ?? 1) - 1) < 0.01,
      `échelle ${visualViewport?.scale}`);
    noter('en-tête de page retiré (titre et réglages natifs)', getComputedStyle(/** @type {HTMLElement} */ (document.querySelector('.barre'))).display === 'none');
    noter('aucune sélection de texte au toucher', getComputedStyle(document.body).webkitUserSelect === 'none' || getComputedStyle(document.body).userSelect === 'none');
    const ponts = w.webkit?.messageHandlers ?? {};
    for (const nom of ['onglet', 'scanner', 'imprimer', 'coffre', 'partager']) noter(`pont « ${nom} »`, !!ponts[nom]);
    // l'accueil de l'app propose deux exports (portefeuille en tableau, échéances pour l'agenda) : la page doit savoir les préparer
    noter('exports du portefeuille disponibles pour l’accueil de l’app', typeof p.exporter === 'function');

    // chiffrement des dossiers, de bout en bout, par le chemin réellement utilisé ici (Web Crypto ou l'app)
    const Verrou = await import('./verrou.js');
    const boite = new Map(), faux = { getItem: k => boite.get(k) ?? null, setItem: (k, v) => boite.set(k, v), removeItem: k => boite.delete(k) };
    noter('chiffrement disponible', Verrou.disponible());
    const secret = { dossiers: [{ nom: 'Dupont Marie', personne: { revenu: 91000 }, image: 'x'.repeat(120000) }] };
    await Verrou.creer('code-essai-42', secret, /** @type {any} */ (faux), 20000);
    const brut = [...boite.values()].join(' ');
    noter('coffre : rien de lisible', brut.length > 1000 && !brut.includes('Dupont') && !brut.includes('91000'), `${brut.length} caractères`);
    Verrou.fermer();
    noter('coffre : un mauvais code n’ouvre pas', await Verrou.ouvrir('code-essai-43', /** @type {any} */ (faux)) === null);
    const rendu = await Verrou.ouvrir('code-essai-42', /** @type {any} */ (faux));
    noter('coffre : le bon code rend le dossier (120 000 caractères)', rendu?.dossiers?.[0]?.nom === 'Dupont Marie' && rendu.dossiers[0].image.length === 120000);
    Verrou.fermer();

    // suivi dans le temps : un point par jour, le dernier état du jour fait foi, la liste reste bornée
    const Suivi = await import('./suivi.js');
    const p1 = { j: '2026-03-01', s: 70, r: 900, i: 0, d: 0 }, p2 = { j: '2026-03-01', s: 74, r: 700, i: 0, d: 0 }, p3 = { j: '2026-09-01', s: 88, r: 200, i: 0, d: 0 };
    const un = Suivi.noter(undefined, p1), deux = Suivi.noter(un.suivi, p2), trois = Suivi.noter(deux.suivi, p3), meme = Suivi.noter(trois.suivi, p3);
    noter('suivi : un point par jour, le dernier état fait foi', un.suivi.length === 1 && deux.suivi.length === 1 && deux.suivi[0].s === 74 && trois.suivi.length === 2 && !meme.change);
    noter('suivi : écart depuis le premier point', Suivi.evolution(trois.suivi)?.ecart === 14 && Suivi.evolution(un.suivi) === null);
    let longue = [];
    for (let n = 0; n < 50; n++) longue = Suivi.noter(longue, { j: `2026-01-${String(n + 1).padStart(2, '0')}`, s: n, r: 0, i: 0, d: 0 }).suivi;
    noter('suivi : liste bornée', longue.length === Suivi.MAXIMUM && longue[longue.length - 1].s === 49);
    noter('suivi : le dossier ouvert a son point du jour', (p.etat.dossiers.find(x => x.id === p.etat.ouvert)?.suivi ?? []).length >= 1);

    // la marque tirée du logo : fond, marges, couleur principale et accent, puis un thème toujours lisible
    const Marque = await import('./marque.js');
    // logo 40 x 20 sur fond blanc : un mot noir (10 x 6) et un détail doré (4 x 2), avec de grandes marges
    const L = 40, H = 20, logo = new Uint8ClampedArray(L * H * 4).fill(255);
    const poser = (x0, y0, l, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + l; x++) logo.set([...c, 255], (y * L + x) * 4); };
    poser(14, 8, 10, 6, [10, 10, 12]); poser(10, 12, 4, 2, [200, 150, 30]);
    const lu = Marque.analyser(logo, L, H);
    noter('marque : fond blanc reconnu, marges rognées autour du dessin', Marque.enHex(lu.fond) === '#ffffff' && lu.boite.x >= 9 && lu.boite.x <= 10 && lu.boite.l <= 16 && lu.boite.h <= 8);
    noter('marque : couleur principale (noir) et accent (doré)', Marque.enHex(lu.principale) === '#0a0a0c' && Marque.enHex(lu.accent) === '#c8961e');
    const elite = Marque.theme({ fond: '#ffffff', principale: '#0a0a0c', accent: '#c8961e' });
    noter('marque : logo noir et doré, bande sombre, filet doré, plaque blanche', elite.bande === '#0a0a0c' && elite.filet === '#c8961e' && elite.encre === '#ffffff' && elite.plaque === '#ffffff' && elite.piliers[0] === '#0a0a0c' && elite.piliers[1] === '#c8961e'
      && Marque.contraste(Marque.deHex(elite.texte), { r: 255, g: 255, b: 255 }) >= 4.5);
    const blancSurBleu = Marque.theme({ fond: '#0a3d91', principale: '#ffffff', accent: null }), clair = Marque.theme({ fond: null, principale: '#ffffff', accent: '#ffd400' });
    noter('marque : logo sur aplat ou dessiné en clair, posé sans plaque', blancSurBleu.bande === '#0a3d91' && blancSurBleu.plaque === null && clair.plaque === null && clair.bande === '#ffd400' && clair.encre === '#14161a');
    noter('marque : couleur choisie à la main, et logo sans rien de lisible', Marque.theme({ principale: '#0a0a0c', choisie: '#0b6b4f' }).bande === '#0b6b4f'
      && Marque.theme({}).bande === '#14161a' && Marque.analyser(new Uint8ClampedArray(16), 2, 2).boite === null && Marque.cadrer(4, 92, 34).h === 23);

    // les six écrans : chacun s'affiche seul, avec du contenu, sans dépasser la largeur
    const affiche = id => getComputedStyle(/** @type {HTMLElement} */ (document.getElementById(id))).display !== 'none';
    for (const vue of ['dossier', 'analyse', 'scenarios', 'plan', 'rapport', 'donnees']) {
      p.aller(vue);
      await attendre(900);
      if (vue === 'donnees') {
        // les données de référence se chargent avant de s'afficher : on attend qu'elles y soient, et on mesure
        const debut = performance.now();
        while (!document.querySelector('#vue .donnees-tete') && performance.now() - debut < 9000) await attendre(200);
        // seuil large : un simulateur d'intégration continue est bien plus lent qu'un appareil
        noter('données de référence affichées en moins de 5 s', !!document.querySelector('#vue .donnees-tete') && performance.now() - debut < 4100, `${Math.round(performance.now() - debut + 900)} ms`);
        await attendre(500);
      }
      const dossier = vue === 'dossier', largeur = document.documentElement.scrollWidth;
      const bon = dossier ? affiche('saisie') && !affiche('vue') : affiche('vue') && !affiche('saisie') && document.body.dataset.vue === vue;
      const contenu = /** @type {HTMLElement} */ (document.getElementById(dossier ? 'saisie' : 'vue')).innerText.trim().length;
      noter(`écran ${vue}`, bon && contenu > 80 && largeur <= innerWidth + 1, `${contenu} caractères, largeur ${largeur}/${innerWidth}`);
    }
    // changement d'onglet rapide : une vue lente (Données) ne doit pas s'écrire sous un autre onglet
    p.aller('donnees'); p.aller('plan');
    await attendre(2200);
    noter('une vue lente ne s’affiche pas sous un autre onglet', document.body.dataset.vue === 'plan' && !document.querySelector('#vue .donnees-tete'));
    // l'analyse : la scène des piliers est dessinée, et aucun texte du résumé ne la recouvre
    p.aller('analyse');
    await attendre(900);
    const toile = /** @type {HTMLCanvasElement|null} */ (document.querySelector('.scene-toile'));
    noter('scène des piliers présente', !!toile && toile.width > 100 && toile.height > 50, toile ? `${toile.width}x${toile.height}` : 'absente');
    // réglages pilotés par l'app : la langue change et revient
    await p.regler({ langue: 'de' }); await attendre(500);
    const allemand = document.documentElement.lang === 'de';
    await p.regler({ langue: 'fr' }); await attendre(500);
    noter('langue réglée depuis l’app', allemand && document.documentElement.lang === 'fr');
    noter('aucune erreur JavaScript', (w.__erreurs ?? []).length === 0, (w.__erreurs ?? []).join(' | '));
    if (finale !== 'analyse') { p.aller(finale); await attendre(900); }
    scrollTo(0, 0);
  } catch (erreur) {
    noter('exception', false, /** @type {Error} */ (erreur).message);
  }
  return { echecs: resultats.filter(r => !r.ok).length, total: resultats.length, resultats };
}
