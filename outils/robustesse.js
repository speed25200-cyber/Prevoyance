// Essai de robustesse du moteur : des milliers de dossiers tirés au hasard (cas extrêmes compris : revenu nul ou très
// élevé, 18 à 69 ans, 44 années manquantes, tous cantons, tous états civils, départ de 58 à 70 ans, les deux années de
// règles). Rien ne doit lever d'erreur, aucun nombre ne doit être invalide, le score reste entre 0 et 100, aucune
// lacune n'est négative. À lancer dans la console d'une page servie depuis la racine du dépôt :
//   const { robustesse } = await import('/outils/robustesse.js'); await robustesse(3000)
export async function robustesse(tirages = 3000, graine = 12345) {
  const M = await import('/moteur/src/index.js'), E = await import('/web/src/etat.js');
  const regles = {}, imp = {}, com = {};
  for (const a of M.ANNEES) {
    regles[a] = await (await fetch(`/moteur/regles/ch-${a}.json`)).json();
    imp[a] = await M.impots(a) ?? await M.impots(M.ANNEES[0]);
    com[a] = await M.communes(a) ?? await M.communes(M.ANNEES[0]);
  }
  const al = () => (graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296;
  const choix = t => t[Math.floor(al() * t.length)];
  const date = (min, max) => { const d = new Date(); d.setFullYear(d.getFullYear() - Math.floor(min + al() * (max - min))); d.setMonth(Math.floor(al() * 12)); return d.toISOString().slice(0, 10); };
  const personne = () => ({ dateNaissance: date(18, 69), sexe: choix(['h', 'f']), statut: choix(['salarie', 'independant', 'sans']),
    revenu: choix([0, 12000, 22680, 45000, 90720, 148200, 250000, 600000]), anneesManquantes: choix([0, 0, 2, 10, 44]),
    lppAvoir: choix([undefined, 0, 50000, 800000]), lppRachat: choix([undefined, 0, 62000]), ijm: al() > 0.5, avoir3a: choix([0, 41000, 300000]),
    versement3a: choix([0, 3600, 7258, 36288]), fortune: choix([0, 30000, 2000000]), lppAffilie: choix([undefined, true, false]),
    avoir3b: choix([0, 50000]), rentePrivee: choix([0, 24000]), capitalDecesPrive: choix([0, 200000]) });
  let analyses = 0, nonFinis = 0;
  const erreurs = [];
  const verifier = (o, chemin = '') => {
    if (typeof o === 'number') { if (!Number.isFinite(o)) { nonFinis++; if (erreurs.length < 8) erreurs.push('nombre invalide : ' + chemin); } }
    else if (o && typeof o === 'object') for (const k in o) verifier(o[k], chemin + '.' + k);
  };
  for (let i = 0; i < tirages; i++) {
    const annee = choix(M.ANNEES);
    const d = { ...E.dossierVide(), canton: choix(E.CANTONS), etatCivil: choix(['celibataire', 'marie', 'divorce', 'veuf', 'partenariat']), avecConjoint: al() > 0.5,
      enfants: choix([[], [4], [1, 7, 17], [24]]), personne: personne(), conjoint: personne(),
      besoins: { retraite: choix([0.5, 0.8, 1]), invalidite: choix([0.6, 0.9, 1]), deces: choix([0.5, 0.75, 1]) }, ageRetraite: choix([58, 60, 63, 65, 67, 70]),
      bien: { valeur: choix([0, 980000]), dette: choix([0, 620000]) } };
    try {
      const impots = M.Impots.localiser(imp[annee], com[annee], d.canton, { commune: null, confession: choix(['sans', 'catholique', 'reforme']) });
      for (const cible of d.avecConjoint ? ['personne', 'conjoint'] : ['personne']) {
        const dossier = E.versDossier(d, cible), a = M.analyser(dossier, regles[annee], { impots });
        verifier(a);
        if (!(a.score >= 0 && a.score <= 100)) erreurs.push('score hors bornes : ' + a.score);
        for (const r of Object.values(a.risques)) if (r && typeof r === 'object' && 'lacune' in r && r.lacune < 0) erreurs.push('lacune négative');
        M.Vie.feuilleDeRoute(dossier, regles[annee], { impots });
        M.Vie.resistance(dossier, regles[annee], { impots });
        M.Vie.coutAttente(dossier, regles[annee], { impots });
        analyses++;
      }
    } catch (e) {
      if (erreurs.length < 8) erreurs.push(String(e).slice(0, 160) + ' | ' + JSON.stringify({ canton: d.canton, etat: d.etatCivil, statut: d.personne.statut, revenu: d.personne.revenu, depart: d.ageRetraite }));
    }
  }
  return { analyses, nonFinis, erreurs: [...new Set(erreurs)] };
}
