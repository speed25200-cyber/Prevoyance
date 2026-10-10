// @ts-check
/**
 * Conseil personnalisé : ce que le conseiller recommande à ce client, dans l'ordre, avec les montants et les raisons.
 *
 * Le conseil est déduit du dossier, pas rédigé librement : chaque recommandation vient d'une lacune ou d'un potentiel
 * calculé par le moteur, et chaque montant est celui de l'analyse ou du plan. Rien n'est inventé, tout se retrouve dans
 * les autres vues. Le moteur renvoie des codes et des valeurs ; l'interface les met en phrases dans la langue choisie.
 *
 * Ordre d'un conseiller : d'abord ce qui ne peut pas attendre (invalidité, décès, perte de gain), puis ce qui a une
 * échéance dans l'année (3a, années AVS), puis ce qui se planifie (rachats échelonnés, épargne), enfin les pièces à
 * réunir pour affiner l'analyse.
 */

/** Moments d'action, du plus pressant au moins pressant. */
export const URGENCES = ['maintenant', 'cetteAnnee', 'aPlanifier', 'aReunir'];

/**
 * @param {any} avant analyse du dossier @param {Record<string, any>} mesures plan retenu @param {any} apres analyse après le plan
 * @param {{rachatEchelonne?: {annees: number, economie: number}[]}} [options]
 * @returns {{resume: {cle: string, v: Record<string, number>}, points: {cle: string, urgence: string, v: Record<string, number>}[]}}
 */
export function rediger(avant, mesures, apres, options = {}) {
  const r = avant.risques, pot = avant.potentiels, P = avant.personne;
  /** @type {{cle: string, urgence: string, v: Record<string, number>}[]} */ const points = [];
  const point = (cle, urgence, v = {}) => points.push({ cle, urgence, v });
  const alerte = cle => avant.alertes.find(a => a.cle === cle);
  const part = (economie, montant, total) => (total > 0 ? Math.round(economie * Math.min(1, montant / total) / 10) * 10 : 0);

  // ---- ce qui ne peut pas attendre : les risques
  const invalidite = Math.max(r.invaliditeMaladie.lacune, r.invaliditeMaladie.lacuneMax ?? 0) >= Math.max(r.invaliditeAccident.lacune, r.invaliditeAccident.lacuneMax ?? 0)
    ? r.invaliditeMaladie : r.invaliditeAccident;
  // la lacune retenue est la plus grande à venir : celle d'après les rentes d'enfants quand il y en a
  const pire = x => Math.max(x.lacune, x.lacuneMax ?? 0);
  if (pire(invalidite) > 0) {
    // la couverture citée est celle de la pire année (comme la lacune), pas celle d'aujourd'hui
    point('cs_invalidite', 'maintenant', { mensuelChf: Math.round(pire(invalidite) / 12), couvertPct: invalidite.couvertureMin ?? invalidite.couverture, renteChf: mesures.renteInvalidite ?? 0 });
    if (r.invaliditeMaladie.lacune > r.invaliditeAccident.lacune + 1000) {
      point('cs_ecartMaladie', 'maintenant', { ecartChf: r.invaliditeMaladie.lacune - r.invaliditeAccident.lacune });
    }
  }
  if (mesures.ijm) point('cs_ijm', 'maintenant');
  if (mesures.laa || alerte('independantSansLAA')) point('cs_laa', 'maintenant');
  const deces = r.decesMaladie.capital >= r.decesAccident.capital ? r.decesMaladie : r.decesAccident;
  if (deces.capital > 0) {
    point('cs_deces', 'maintenant', { capitalChf: mesures.capitalDeces ?? deces.capital, mensuelChf: Math.round(pire(deces) / 12), enfants: avant.enfantsACharge ?? 0 });
  }
  if (alerte('concubinage')) point('cs_concubinage', 'maintenant');
  if (alerte('independantSansLPP')) point('cs_sansLPP', 'maintenant');
  if (alerte('sousSeuilLPP')) point('cs_sousSeuil', 'maintenant', { seuilChf: alerte('sousSeuilLPP').valeurs.seuil });

  // ---- la retraite : les leviers dans l'ordre de leur efficacité fiscale
  const retraite = r.retraite;
  if (retraite.lacune > 0) {
    point('cs_retraite', 'cetteAnnee', { mensuelChf: retraite.lacuneMensuelle, couvertPct: retraite.couverture, capitalChf: retraite.capital, age: P.ageRetraite });
  }
  if ((mesures.versement3a ?? 0) > 0) {
    point('cs_3a', 'cetteAnnee', { montantChf: mesures.versement3a, economieChf: part(pot.pilier3a.economieImpot, mesures.versement3a, pot.pilier3a.potentiel),
      plafondChf: pot.pilier3a.plafond });
  } else if (pot.pilier3a.potentiel > 0) {
    point('cs_3aFiscal', 'cetteAnnee', { montantChf: pot.pilier3a.potentiel, economieChf: pot.pilier3a.economieImpot });
  }
  const manquantes = alerte('lacunesAVS');
  if (manquantes) point('cs_anneesAVS', 'cetteAnnee', { annees: manquantes.valeurs.annees, perteChf: manquantes.valeurs.perteMensuelle });
  if ((mesures.rachatLPP ?? 0) > 0) {
    const meilleur = (options.rachatEchelonne ?? []).reduce((a, b) => (b.economie > (a?.economie ?? 0) ? b : a), /** @type {any} */ (null));
    point('cs_rachat', 'aPlanifier', { montantChf: mesures.rachatLPP, economieChf: part(pot.rachatLPP.economieImpot, mesures.rachatLPP, pot.rachatLPP.possible),
      annees: meilleur?.annees > 1 ? meilleur.annees : 0, economieEchelonneeChf: meilleur?.annees > 1 ? meilleur.economie : 0 });
  } else if (pot.rachatLPP.possible > 0) {
    point('cs_rachatFiscal', 'aPlanifier', { montantChf: pot.rachatLPP.possible, economieChf: pot.rachatLPP.economieImpot });
  }
  if ((mesures.epargneLibre ?? 0) > 0) point('cs_epargne', 'aPlanifier', { montantChf: mesures.epargneLibre, mensuelChf: Math.round(mesures.epargneLibre / 12) });
  if (alerte('choixRenteCapital')) point('cs_renteCapital', 'aPlanifier', { annees: alerte('choixRenteCapital').valeurs.annees });
  if (alerte('revenuAuDessusLAA')) point('cs_excedentLAA', 'aPlanifier', { excedentChf: alerte('revenuAuDessusLAA').valeurs.excedent });

  // ---- les pièces qui rendraient l'analyse plus sûre
  if (alerte('ramdEstime')) point('cs_extraitCI', 'aReunir');
  if (alerte('lppEstimee')) point('cs_certificat', 'aReunir');

  // un risque est ouvert s'il manque un revenu aujourd'hui, plus tard, ou un capital
  const ouvert = x => x.lacune > 0 || (x.lacuneMax ?? 0) > 0 || x.capital > 0;
  const lacunes = Object.values(avant.risques).filter(ouvert).length;
  const restantes = Object.values(apres.risques).filter(ouvert).length;
  points.sort((a, b) => URGENCES.indexOf(a.urgence) - URGENCES.indexOf(b.urgence));
  return {
    resume: { cle: lacunes === 0 ? 'cs_resumeCouvert' : restantes === 0 ? 'cs_resumeComble' : 'cs_resumeReste',
      v: { lacunes, restantes, avant: avant.score, apres: apres.score, age: P.age } },
    points,
  };
}
