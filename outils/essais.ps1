# Lance les essais de l'interface dans Edge, en arrière-plan, et affiche leur résultat.
# Usage : powershell -File outils\essais.ps1     (le serveur local doit tourner : python -m http.server 8790)
# Le travail est fait par outils\essais.py, qui pilote le navigateur en temps réel : la page d'essais charge le
# terrain du relief (des images à décoder), ce que le « temps virtuel » d'Edge sans fenêtre ne sait pas attendre.
param([string]$adresse = "http://localhost:8790/web/essais.html")
$env:PYTHONIOENCODING = "utf-8"
python (Join-Path $PSScriptRoot "essais.py") $adresse
exit $LASTEXITCODE
