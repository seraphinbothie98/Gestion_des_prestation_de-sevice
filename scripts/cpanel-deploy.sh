#!/usr/bin/env bash
# ==============================================================================
# CENTRE MANAGEMENT SYSTEM (CMS) - CPANEL DEPLOYMENT AUTOMATION SCRIPT
# ==============================================================================
# Ce script est exécuté par cPanel Git Version Control lors du clic sur
# "Deploy HEAD Commit" ou lors d'un déploiement déclenché par webhook.
# ==============================================================================

set -e

echo "===================================================="
echo "🚀 DÉBUT DU DÉPLOIEMENT CPANEL - CMS"
echo "📅 Date : $(date)"
echo "📂 Répertoire dépôt : $(pwd)"
echo "👤 Utilisateur système : $(whoami)"
echo "===================================================="

# ------------------------------------------------------------------------------
# 1. Détection de l'environnement Node.js & NPM
# ------------------------------------------------------------------------------
POSSIBLE_NODE_PATHS=(
  "/usr/local/bin"
  "/usr/bin"
  "/opt/alt/alt-nodejs22/root/usr/bin"
  "/opt/alt/alt-nodejs20/root/usr/bin"
  "/opt/alt/alt-nodejs18/root/usr/bin"
  "/opt/cpanel/ea-nodejs20/bin"
  "/opt/cpanel/ea-nodejs18/bin"
)

for node_path in "${POSSIBLE_NODE_PATHS[@]}"; do
  if [ -d "$node_path" ] && [ -x "$node_path/node" ]; then
    export PATH="$node_path:$PATH"
    break
  fi
done

# Détection éventuelle de NVM
if [ -d "$HOME/.nvm" ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" || true
fi

# Détection de l'environnement virtuel CloudLinux Node.js s'il existe
if [ -d "$HOME/nodevenv" ]; then
  VENV_ACTIVATE=$(find "$HOME/nodevenv" -name "activate" 2>/dev/null | head -n 1)
  if [ -n "$VENV_ACTIVATE" ] && [ -f "$VENV_ACTIVATE" ]; then
    echo "⚙️ Activation de l'environnement virtuel cPanel : $VENV_ACTIVATE"
    source "$VENV_ACTIVATE" || true
  fi
fi

if command -v node >/dev/null 2>&1; then
  echo "✅ Node.js actif : $(node -v) ($(which node))"
else
  echo "⚠️ 'node' non détecté dans le PATH immédiat (normal si géré exclusivement par Phusion Passenger)."
fi

if command -v npm >/dev/null 2>&1; then
  echo "✅ NPM actif : $(npm -v) ($(which npm))"
else
  echo "⚠️ 'npm' non détecté dans le PATH immédiat."
fi

# ------------------------------------------------------------------------------
# 2. Résolution du répertoire cible de déploiement (DEPLOYPATH)
# ------------------------------------------------------------------------------
REPO_DIR="$(pwd)"
TARGET_DIR=""

# Cas A : Fichier .deploypath présent dans le dépôt
if [ -f "$REPO_DIR/.deploypath" ]; then
  TARGET_DIR=$(cat "$REPO_DIR/.deploypath" | tr -d '\r\n' | xargs)
  echo "📌 Répertoire cible spécifié dans .deploypath : $TARGET_DIR"
fi

# Cas B : Variable d'environnement DEPLOYPATH configurée dans cPanel
if [ -z "$TARGET_DIR" ] && [ -n "$DEPLOYPATH" ]; then
  TARGET_DIR="$DEPLOYPATH"
  echo "📌 Répertoire cible spécifié par DEPLOYPATH : $TARGET_DIR"
fi

# Cas C : Si aucun chemin externe n'est spécifié, l'application s'exécute in-situ
if [ -z "$TARGET_DIR" ] || [ "$TARGET_DIR" = "$REPO_DIR" ]; then
  TARGET_DIR="$REPO_DIR"
  echo "📌 Mode de déploiement : In-situ (le dossier du dépôt est la racine de l'application)"
else
  echo "📌 Mode de déploiement : Copie vers cible distante ($TARGET_DIR)"
  mkdir -p "$TARGET_DIR"

  # Copie des fichiers racine essentiels
  for item in app.js package.json package-lock.json .htaccess .env.example; do
    if [ -f "$REPO_DIR/$item" ]; then
      /bin/cp -f "$REPO_DIR/$item" "$TARGET_DIR/"
    fi
  done

  # Copie des dossiers applicatifs essentiels
  for folder in server database dist storage; do
    if [ -d "$REPO_DIR/$folder" ]; then
      /bin/mkdir -p "$TARGET_DIR/$folder"
      /bin/cp -Rf "$REPO_DIR/$folder/"* "$TARGET_DIR/$folder/" 2>/dev/null || true
    fi
  done
fi

# ------------------------------------------------------------------------------
# 3. Préparation des répertoires runtime et permissions
# ------------------------------------------------------------------------------
echo "📁 Configuration des dossiers runtime et permissions..."

# Dossier d'upload pour les fichiers de l'application
mkdir -p "$TARGET_DIR/storage/uploads"
chmod 755 "$TARGET_DIR/storage/uploads" 2>/dev/null || true

# Signal de rechargement à chaud Phusion Passenger
mkdir -p "$TARGET_DIR/tmp"
touch "$TARGET_DIR/tmp/restart.txt"
echo "🔄 Signal Phusion Passenger envoyé : tmp/restart.txt mis à jour."

# ------------------------------------------------------------------------------
# 4. Installation des dépendances de production
# ------------------------------------------------------------------------------
if command -v npm >/dev/null 2>&1; then
  echo "📥 Vérification et installation des dépendances Node.js (production)..."
  (
    cd "$TARGET_DIR"
    # Installe uniquement les dépendances nécessaires au serveur en production
    npm install --omit=dev --no-audit --no-fund || {
      echo "⚠️ Attention : échec lors de npm install --omit=dev."
    }
  )
else
  echo "ℹ️ Pour installer ou mettre à jour les modules npm, utilisez le bouton 'Run NPM Install' dans cPanel -> 'Setup Node.js App'."
fi

# ------------------------------------------------------------------------------
# 5. Contrôle des assets frontend (dist/)
# ------------------------------------------------------------------------------
if [ -f "$TARGET_DIR/dist/index.html" ]; then
  echo "✅ Assets frontend de production (dist/) prêts et validés."
else
  echo "⚠️ dist/index.html manquant dans $TARGET_DIR."
  if command -v npm >/dev/null 2>&1; then
    echo "🔨 Tentative de génération locale via npm run build..."
    (cd "$REPO_DIR" && npm install && npm run build) || true
    if [ "$TARGET_DIR" != "$REPO_DIR" ] && [ -d "$REPO_DIR/dist" ]; then
      mkdir -p "$TARGET_DIR/dist"
      /bin/cp -Rf "$REPO_DIR/dist/"* "$TARGET_DIR/dist/" 2>/dev/null || true
    fi
  fi
fi

# ------------------------------------------------------------------------------
# 6. Protection et initialisation du fichier .env
# ------------------------------------------------------------------------------
if [ ! -f "$TARGET_DIR/.env" ] && [ -f "$TARGET_DIR/.env.example" ]; then
  echo "ℹ️ Initialisation de .env à partir de .env.example (pensez à configurer vos accès PostgreSQL dans cPanel)."
  /bin/cp "$TARGET_DIR/.env.example" "$TARGET_DIR/.env"
fi

if [ -f "$TARGET_DIR/.env" ]; then
  chmod 600 "$TARGET_DIR/.env" 2>/dev/null || true
  echo "🔒 Permissions sécurisées appliquées à .env (600)."
fi

echo "===================================================="
echo "🎉 DÉPLOIEMENT CPANEL EFFECTUÉ AVEC SUCCÈS !"
echo "===================================================="
exit 0
