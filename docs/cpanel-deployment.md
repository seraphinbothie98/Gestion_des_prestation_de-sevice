# Guide de Déploiement Complet sur Hébergement cPanel (PostgreSQL 10.23+ & Node.js)

Ce document décrit pas à pas la procédure officielle pour déployer l'application **Centre Management System (CMS)** sur un hébergement web **cPanel** en utilisant **PostgreSQL standard** et **Node.js** (sans Supabase, sans Vercel, sans cloud externe).

---

## Architecture de Déploiement sur cPanel

```
                      [Navigateur Client]
                              │
                    HTTPS (Port 443 standard)
                              ▼
            ┌────────────────────────────────────────┐
            │             Serveur cPanel             │
            │                                        │
            │  1. Frontend React (Fichiers dist/)    │
            │     - Routage SPA géré par .htaccess   │
            │                                        │
            │  2. Backend Node.js Express (server/)  │
            │     - Exécuté via "Setup Node.js App"  │
            │     - Point d'entrée: app.js / server  │
            │     - Routes relatives sous /api/*     │
            │                                        │
            │  3. PostgreSQL 10.23+ (Localhost:5432) │
            │     - Base de données cPanel interne   │
            │     - Isolation multi-tenant stricte   │
            │                                        │
            │  4. Stockage Fichiers (storage/uploads)│
            │     - Téléversement local sécurisé     │
            └────────────────────────────────────────┘
```

---

## Étape 1 : Créer la base de données PostgreSQL dans cPanel
1. Connectez-vous à votre panneau de contrôle **cPanel**.
2. Dans la section **Bases de données**, cliquez sur **Bases de données PostgreSQL**.
3. Dans le champ **Créer une nouvelle base de données**, saisissez un nom (ex: `cmsdb`).
4. Cliquez sur **Créer la base de données**.
   *(Note : cPanel préfixera automatiquement le nom, par exemple `moncompte_cmsdb`).*

---

## Étape 2 : Créer l'utilisateur PostgreSQL
1. Sur la même page, faites défiler jusqu'à la section **Utilisateurs PostgreSQL** > **Ajouter un nouvel utilisateur**.
2. Saisissez un nom d'utilisateur (ex: `cmsuser`).
3. Générez un mot de passe fort (ex: 20+ caractères avec majuscules, minuscules, chiffres et symboles).
4. **Conservez précieusement ce mot de passe**, il servira pour le fichier `.env`.
5. Cliquez sur **Créer un utilisateur**.
   *(L'identifiant complet sera par exemple `moncompte_cmsuser`).*

---

## Étape 3 : Associer l'utilisateur à la base de données
1. Toujours sur la page **Bases de données PostgreSQL**, allez à la section **Ajouter un utilisateur à une base de données**.
2. Sélectionnez votre utilisateur (`moncompte_cmsuser`) et votre base (`moncompte_cmsdb`).
3. Cliquez sur **Ajouter**.
4. Cochez **TOUS LES PRIVILÈGES** (ALL PRIVILEGES) et cliquez sur **Apporter des modifications**.

---

## Étape 4 : Importer le schéma de la base (`schema.sql`)
1. Retournez à l'accueil de cPanel et ouvrez **phpPgAdmin**.
2. Dans le menu de gauche, cliquez sur votre base `moncompte_cmsdb`.
3. Cliquez sur l'onglet **SQL** en haut.
4. Ouvrez le fichier local [`database/cpanel/schema.sql`](file:///c:/Users/bothi/.gemini/antigravity-ide/scratch/Gestion_des_centre_de_prestation/database/cpanel/schema.sql), copiez tout le texte et collez-le dans la zone de texte de phpPgAdmin.
5. Cliquez sur **Exécuter**.
   > *Note de compatibilité PostgreSQL 10.23 :* Le script inclut la fonction `cpanel_gen_uuid()` qui gère automatiquement les UUIDs sans exiger de droits superuser.

---

## Étape 5 : Importer les données initiales (`seed.sql`)
1. Toujours dans **phpPgAdmin** sur la même base, cliquez à nouveau sur l'onglet **SQL**.
2. Ouvrez le fichier [`database/cpanel/seed.sql`](file:///c:/Users/bothi/.gemini/antigravity-ide/scratch/Gestion_des_centre_de_prestation/database/cpanel/seed.sql), copiez l'intégralité du contenu et collez-le dans phpPgAdmin.
3. Cliquez sur **Exécuter**.
   *(Toutes les permissions, le centre principal, l'administrateur et les catégories de services sont créés).*

---

## Étape 6 : Envoyer les fichiers de l'application sur cPanel
1. Sur votre machine de développement locale, exécutez la compilation de production :
   ```bash
   npm run build
   ```
   Cela génère le dossier `dist/`.
2. Créez une archive ZIP contenant :
   - `dist/` (fichiers compilés React)
   - `server/` (backend Node.js)
   - `storage/` (dossier pour les uploads)
   - `app.js` (point d'entrée Passenger)
   - `package.json` et `package-lock.json`
   - `.htaccess`
   - `.env.example`
3. Dans cPanel, ouvrez le **Gestionnaire de fichiers** (File Manager).
4. Accédez au dossier racine de votre domaine (ex: `public_html` ou un sous-dossier selon votre domaine).
5. Téléversez le fichier ZIP et extrayez-le.

---

## Étape 7 : Installer les dépendances NPM sur cPanel
### Méthode 1 : Via l'interface graphique cPanel
1. Dans cPanel, cliquez sur **Setup Node.js App**.
2. Cliquez sur votre application.
3. Cliquez sur le bouton **Run NPM Install**.

### Méthode 2 : Via le Terminal SSH cPanel
```bash
cd ~/public_html
npm install --production
```

---

## Étape 8 : Configurer les variables d'environnement (`.env`)
1. Dans le **Gestionnaire de fichiers** cPanel, assurez-vous d'activer l'option **Afficher les fichiers masqués (dotfiles)** dans les paramètres.
2. Créez ou modifiez le fichier `.env` à la racine de l'application :
   ```env
   NODE_ENV=production
   PORT=3000

   # Identifiants PostgreSQL créés aux étapes 1 et 2
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_NAME=moncompte_cmsdb
   DB_USER=moncompte_cmsuser
   DB_PASSWORD=votre_mot_de_passe_robuste_ici
   DB_SSL=false

   # Clé secrète JWT pour les sessions utilisateurs
   JWT_SECRET=generer_une_cle_secrete_aleatoire_de_minimum_32_caracteres
   SESSION_EXPIRY=7d

   STORAGE_PROVIDER=local
   STORAGE_DIR=storage/uploads
   ```
3. Sauvegardez le fichier `.env`.

---

## Étape 9 : Configurer Node.js App / Phusion Passenger dans cPanel
1. Dans cPanel, cliquez sur **Setup Node.js App**.
2. Cliquez sur **Create Application** :
   - **Node.js version** : Sélectionnez **Node.js 18.x** ou **20.x** (LTS recommandées).
   - **Application mode** : `Production`.
   - **Application root** : Le chemin vers votre dossier (ex: `public_html` ou `cms`).
   - **Application URL** : Votre domaine (ex: `centre.votredomaine.com`).
   - **Application startup file** : `app.js` (ou `server/index.js`).
3. Cliquez sur **Create**.

---

## Étape 10 : Lancer et redémarrer l'application
1. Dans la page **Setup Node.js App**, cliquez sur **Restart** (ou **Start Application**).
2. L'application est maintenant en cours d'exécution via le serveur web Apache et le module Passenger de cPanel.

---

## Étape 11 : Tester la route `/api/health`
1. Ouvrez votre navigateur et accédez à :
   `https://votredomaine.com/api/health`
2. Vous devez obtenir une réponse JSON de succès :
   ```json
   {
     "status": "ok",
     "api": {
       "uptimeSeconds": 12,
       "nodeVersion": "v18.x.x",
       "environment": "production"
     },
     "database": {
       "provider": "cPanel PostgreSQL",
       "connected": true,
       "databaseName": "moncompte_cmsdb",
       "message": "Connexion PostgreSQL établie avec succès."
     }
   }
   ```
   Si `"connected": true` apparaît, la liaison entre le serveur Node.js et PostgreSQL cPanel est 100% validée !

---

## Étape 12 : Tester la connexion utilisateur
1. Accédez à l'URL de votre application : `https://votredomaine.com`
2. Sur la page de connexion, utilisez le compte administrateur initial créé par `seed.sql` :
   - **Identifiant / Email** : `admin@cms-centre.com` (ou `admin`)
   - **Mot de passe** : `Admin1234!`
3. Vérifiez l'accès au tableau de bord.
4. Pour des raisons de sécurité évidentes, modifiez immédiatement ce mot de passe depuis le profil utilisateur.

---

## Étape 13 : Tester les fonctionnalités principales
1. **Commandes & Prestations** : Créer une commande de photocopie ou reliure.
2. **Caisse & Paiements** : Ouvrir une session de caisse et encaisser un règlement.
3. **Articles & Stock** : Vérifier la liste des articles et les alertes de stock.
4. **Formations & Apprenants** : Vérifier les modules LMS et certificats.
5. **Gestion Multi-Agences** : Basculer d'agence si vous avez le rôle Super Admin.
6. **Téléversement de fichiers** : Tester l'upload d'un document ou avatar et vérifier sa présence dans `storage/uploads/`.
