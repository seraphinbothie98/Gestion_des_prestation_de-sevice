# Script de packaging propre pour déploiement cPanel
param()

$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$staging = Join-Path $workspace "staging_cpanel_build"
$zipPath = Join-Path $workspace "gestion-centres-prestations-cpanel.zip"

Write-Host "Nettoyage des anciens dossiers temporaires..."
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Write-Host "Création du dossier de staging..."
New-Item -ItemType Directory -Path $staging | Out-Null

$rootFiles = @(
    "app.js",
    "package.json",
    "package-lock.json",
    ".htaccess",
    ".cpanel.yml",
    ".gitattributes",
    ".env.example",
    "index.html",
    "vite.config.ts",
    "tsconfig.json",
    "tailwind.config.js",
    "postcss.config.js",
    "README.md"
)

foreach ($f in $rootFiles) {
    $srcPath = Join-Path $workspace $f
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination (Join-Path $staging $f)
        Write-Host "Copié : $f"
    }
}

$dirs = @("server", "dist", "database", "storage", "scripts", "public", "docs", "src")
foreach ($d in $dirs) {
    $srcDir = Join-Path $workspace $d
    if (Test-Path $srcDir) {
        Copy-Item -Recurse -Path $srcDir -Destination (Join-Path $staging $d)
        Write-Host "Dossier copié : $d"
    }
}

# Anti-page blanche cPanel : Placer le HTML et les assets compilés de production directement à la racine
$distIndex = Join-Path $staging "dist\index.html"
if (Test-Path $distIndex) {
    Copy-Item -Path $distIndex -Destination (Join-Path $staging "index.html") -Force
    Write-Host "✅ Anti-page blanche : index.html de production copié à la racine."
}
$distAssets = Join-Path $staging "dist\assets"
if (Test-Path $distAssets) {
    Copy-Item -Recurse -Path $distAssets -Destination (Join-Path $staging "assets") -Force
    Write-Host "✅ Anti-page blanche : assets/ de production copiés à la racine."
}

# Assurer la présence des dossiers d'exécution
New-Item -ItemType Directory -Path (Join-Path $staging "storage\uploads") -Force | Out-Null
New-Item -ItemType File -Path (Join-Path $staging "storage\uploads\.gitkeep") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "tmp") -Force | Out-Null
New-Item -ItemType File -Path (Join-Path $staging "tmp\restart.txt") -Force | Out-Null

# Sécurité : Vérifier l'exclusion stricte de .env, node_modules et fichiers de build temporaires
$prohibited = @(".env", "node_modules", ".git", "staging_cpanel_build", "tsconfig.tsbuildinfo")
foreach ($item in $prohibited) {
    $target = Join-Path $staging $item
    if (Test-Path $target) {
        Remove-Item -Recurse -Force $target
        Write-Host "Sécurité : supprimé de staging : $item"
    }
}

Write-Host "Compression de l'archive $zipPath..."
Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Nettoyage du dossier de staging..."
Remove-Item -Recurse -Force $staging

$zipFile = Get-Item $zipPath
$sizeMB = [math]::Round($zipFile.Length / 1MB, 2)
Write-Host "===================================================="
Write-Host "Archive ZIP créée avec succès :"
Write-Host "Fichier : $($zipFile.FullName)"
Write-Host "Taille  : $sizeMB Mo ($($zipFile.Length) octets)"
Write-Host "===================================================="
