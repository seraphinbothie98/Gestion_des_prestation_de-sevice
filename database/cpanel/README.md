# Base de données PostgreSQL pour cPanel - Centre Management System (CMS)

Ce répertoire contient les scripts SQL officiels pour déployer la base de données du CMS sur un hébergement web **cPanel** équipé de **PostgreSQL standard (version 10.23 ou supérieure)**.

---

## 1. Fichiers disponibles

| Fichier | Description |
| :--- | :--- |
| `schema.sql` | Schéma relationnel complet (tables, clés primaires, clés étrangères, index, contraintes, types ENUM, fonction UUID résiliente). Sans RLS Supabase. |
| `seed.sql` | Jeu de données initial essentiel (tenant par défaut, branche principale, permissions, rôles RBAC, utilisateur admin de démarrage, comptes financiers, prestations et formations de base). |
| `README.md` | Ce guide d'architecture, d'importation et de sécurité applicative. |

---

## 2. Compatibilité PostgreSQL 10.23 & Spécificités cPanel

Sur les serveurs mutualisés ou VPS cPanel :
1. **Privilèges non-superuser** : L'utilisateur de base de données créé via cPanel n'a pas les droits `SUPERUSER`. Il ne peut généralement pas forcer l'installation de nouvelles extensions système.
2. **Génération d'UUID résiliente** :
   - `schema.sql` utilise une fonction intelligente `cpanel_gen_uuid()`.
   - Si `uuid-ossp` (`uuid_generate_v4()`) ou `pgcrypto` (`gen_random_uuid()`) est actif sur le serveur, il l'utilise automatiquement.
   - Si aucune extension n'est disponible, il utilise un fallback cryptographique v4 natif `md5(random()::text || clock_timestamp()::text)::uuid`.
   - **Résultat** : L'importation ne provoque **jamais d'erreur d'autorisation** sur cPanel.
3. **Génération côté Node.js** : Pour une robustesse totale, le backend Node.js génère également les identifiants UUID au format standard RFC4122 via `crypto.randomUUID()` lors de chaque création de ressource.

---

## 3. Procédure d'importation sur cPanel

### Méthode A : Via l'interface phpPgAdmin (Recommandée)
1. Connectez-vous à votre interface **cPanel**.
2. Allez dans **Bases de données PostgreSQL** :
   - Créez une nouvelle base (ex: `votrecompte_cmsdb`).
   - Créez un nouvel utilisateur PostgreSQL avec un mot de passe robuste (ex: `votrecompte_cmsuser`).
   - Associez l'utilisateur à la base avec **Tous les privilèges** (ALL PRIVILEGES).
3. Ouvrez **phpPgAdmin** depuis cPanel.
4. Cliquez sur votre base de données dans la barre latérale gauche, puis sur l'onglet **SQL** en haut.
5. Ouvrez `schema.sql` avec un éditeur de texte, copiez l'intégralité du contenu et collez-le dans la zone SQL de phpPgAdmin. Cliquez sur **Exécuter**.
6. Répétez l'opération avec `seed.sql`.

### Méthode B : En ligne de commande SSH (si accès terminal activé)
```bash
# 1. Importer le schéma
psql -h 127.0.0.1 -U votrecompte_cmsuser -d votrecompte_cmsdb -f database/cpanel/schema.sql

# 2. Importer les données initiales
psql -h 127.0.0.1 -U votrecompte_cmsuser -d votrecompte_cmsdb -f database/cpanel/seed.sql
```

---

## 4. Architecture de Sécurité & Remplacement de Supabase RLS

Dans l'ancienne architecture Supabase, le navigateur accédait directement aux tables PostgreSQL via PostgREST, nécessitant des règles Row Level Security (RLS) complexes basées sur `auth.uid()`.

Dans l'architecture cPanel cible :
```
[Navigateur Web]
       ↓ (Requêtes HTTPS /api/* sans identifiant DB)
[Serveur Node.js Express (sur cPanel)]
  ├── Vérification du token JWT ou Session
  ├── Extraction du user_id et du tenant_id
  └── Application stricte des filtres SQL
       ↓ (Connexion interne pool TCP localhost)
[PostgreSQL cPanel]
```

### Règles d'isolation métier appliquées au niveau de l'API Node.js :
1. **Isolation Multi-Tenant stricte** :
   - Toute requête sensible (`orders`, `persons`, `products`, `services`, `cash_sessions`, `payments`) inclut systématiquement la clause `WHERE tenant_id = $1`.
   - Le `tenant_id` provient du jeton authentifié du collaborateur connecté, et **jamais** d'un paramètre non vérifié envoyé par le client.
2. **Super Administrateur** :
   - Seuls les utilisateurs avec `role = 'SUPER_ADMIN'` ont le droit d'accéder aux données inter-agences (`tenant_id = ALL` ou vue globale de la plateforme).
3. **Visibilité Publique (Marketplace & Vérification)** :
   - Les clients publics n'ont accès aux produits que si `publication_status = 'PUBLISHED'` et si la boutique est validée (`verification_status = 'APPROUVE'`).
   - La vérification des certificats de formation (`/api/certificates/verify/:code`) est accessible publiquement uniquement si `is_valid = TRUE`.
4. **Protection des identifiants** :
   - Les mots de passe sont hashés avec **bcrypt** avant écriture.
   - Les informations de connexion (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`) sont confinées dans le fichier `.env` sur le serveur et ne sont **jamais transmises** au navigateur.
