// PrÃ©voyance â€” fonctionnement hors ligne (iPad en rendez-vous, sans rÃ©seau).
// RÃ©seau d'abord, copie gardÃ©e ensuite : en ligne on a toujours la derniÃ¨re version ; hors ligne, la derniÃ¨re connue.
const CACHE = 'prevoyance-v60';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', evenement => evenement.waitUntil(
  caches.keys().then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())));

self.addEventListener('fetch', evenement => {
  const requete = evenement.request;
  if (requete.method !== 'GET' || new URL(requete.url).origin !== location.origin) return;
  evenement.respondWith(
    fetch(requete).then(reponse => {
      if (reponse.ok) { const copie = reponse.clone(); caches.open(CACHE).then(c => c.put(requete, copie)); }
      return reponse;
    }).catch(() => caches.match(requete, { ignoreSearch: true }).then(garde => garde ?? Response.error())));
});
