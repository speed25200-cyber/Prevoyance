// Lance les cas de test sous Node (intégration continue) : node moteur/tests/run.mjs
import { readFile } from 'node:fs/promises';
import { cas, casScenarios } from './cas.js';

const lire = async annee => JSON.parse(await readFile(new URL(`../regles/ch-${annee}.json`, import.meta.url), 'utf8'));
const identique = (a, b, tolerance) => typeof a === 'number' && typeof b === 'number'
  ? Math.abs(a - b) <= tolerance : JSON.stringify(a) === JSON.stringify(b);

let reussis = 0;
const echecs = [];
const egal = (nom, obtenu, attendu, tolerance = 0) => {
  if (identique(obtenu, attendu, tolerance)) reussis += 1;
  else echecs.push(`${nom} : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
};
const donnees = { r26: await lire(2026), r27: await lire(2027),
                  i26: JSON.parse(await readFile(new URL('../donnees/impots-2026.json', import.meta.url), 'utf8')),
                  c26: JSON.parse(await readFile(new URL('../donnees/communes-2026.json', import.meta.url), 'utf8')) };
cas(egal, donnees);
casScenarios(egal, donnees);

for (const e of echecs) console.error('ÉCHEC  ' + e);
console.log(`${reussis} réussis, ${echecs.length} échecs`);
process.exit(echecs.length ? 1 : 0);
