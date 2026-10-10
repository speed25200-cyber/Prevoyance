// Avant le premier affichage de la page d'entrée : dit à la feuille de style que le script est là.
//   js     le récit est épinglé et piloté par le défilement ;
//   anime  les états de départ des animations s'appliquent (jamais en mouvement réduit) ;
//   fige   « ?fige » dans l'adresse : tout est à son état final, pour une capture de contrôle.
// Sans ce fichier, ou en mouvement réduit, la page est complète et se lit de haut en bas.
(function () {
  var racine = document.documentElement, calme = false;
  try { calme = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (erreur) { /* vieux navigateur : page simple */ }
  if (/[?&]fige/.test(location.search)) racine.classList.add('js', 'fige');
  else if (!calme) racine.classList.add('js', 'anime');
})();
