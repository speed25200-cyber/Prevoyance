# Lance les essais de l'interface dans Edge, en arrière-plan, et affiche leur résultat.
# Usage : powershell -File outils\essais.ps1     (le serveur local doit tourner : python -m http.server 8790)
param([string]$adresse = "http://localhost:8790/web/essais.html")
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$dossier = Join-Path $PSScriptRoot "tmp-capture"
New-Item -ItemType Directory -Force $dossier | Out-Null
$sortie = Join-Path $dossier "essais.html"
$profil = Join-Path $dossier "profil-essais"
if (Test-Path $profil) { Remove-Item $profil -Recurse -Force -Confirm:$false }
$p = Start-Process -FilePath $edge -ArgumentList "--headless=new","--disable-gpu","--no-first-run","--user-data-dir=$profil","--window-size=1500,1100","--virtual-time-budget=40000","--dump-dom",$adresse `
  -Wait -WindowStyle Hidden -RedirectStandardOutput $sortie -PassThru
$html = Get-Content $sortie -Raw -Encoding utf8
[regex]::Matches($html, '(?s)<li class="(ok|ko)">(.*?)</li>') | ForEach-Object { $_.Groups[2].Value }
if ($html -match '<title>(.*?)</title>') { $Matches[1] }
