# Capture une vue de l'application dans Edge, en arrière-plan, pour contrôler le rendu.
# Usage : powershell -File outils\capture.ps1 <vue> [largeur] [hauteur] [sombre|clair]
param([string]$vue = "analyse", [int]$largeur = 1366, [int]$hauteur = 2400, [string]$theme = "sombre", [string]$adresse = "http://localhost:8790/web/index.html")
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$dossier = Join-Path $PSScriptRoot "tmp-capture"
New-Item -ItemType Directory -Force $dossier | Out-Null
$cible = Join-Path $dossier "$vue-$largeur-$theme.png"
if (Test-Path $cible) { Remove-Item $cible -Confirm:$false }
$arguments = @("--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--user-data-dir=$dossier\profil-$theme",
               "--window-size=$largeur,$hauteur", "--virtual-time-budget=7000", "--screenshot=$cible")
if ($theme -eq "sombre") { $arguments += "--force-dark-mode"; $arguments += "--enable-features=WebContentsForceDark:inversion_method/cielab_based" }
$arguments += "$adresse#$vue"
Start-Process -FilePath $edge -ArgumentList $arguments -Wait -WindowStyle Hidden
if (Test-Path $cible) { "ok $cible" } else { "capture impossible" }
