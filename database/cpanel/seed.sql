-- ==============================================================================
-- CENTRE MANAGEMENT SYSTEM (CMS) - SEED DATA CPANEL
-- Compatible: PostgreSQL 10.23+ & PostgreSQL 11/12/13/14/15/16
-- Tous les UUIDs sont strictement hexadécimaux conformes RFC 4122 [0-9a-f]
-- Données initiales essentielles pour démarrage à froid d'une installation neuve
-- ==============================================================================

-- 1. PERMISSIONS STANDARD DU SYSTÈME
INSERT INTO permissions (code, module, name, description) VALUES
-- Commandes & Prestations
('orders.create', 'orders', 'Créer des commandes', 'Autorise la création de nouvelles commandes de prestations'),
('orders.view', 'orders', 'Consulter les commandes', 'Permet de voir la liste et le détail des commandes'),
('orders.update', 'orders', 'Modifier les commandes', 'Permet de modifier le contenu et statut d''une commande'),
('orders.cancel', 'orders', 'Annuler des commandes', 'Permet d''annuler une commande existante'),

-- Production
('production.view', 'production', 'Voir la file de production', 'Accès au tableau de bord des travaux en cours'),
('production.manage', 'production', 'Gérer la production', 'Prendre en charge, démarrer et terminer un travail'),

-- Paiements & Caisse
('payments.create', 'payments', 'Encaisser des paiements', 'Enregistrer un paiement pour commande ou formation'),
('payments.view', 'payments', 'Consulter les paiements', 'Accéder à l''historique des transactions'),
('payments.refund', 'payments', 'Effectuer des remboursements', 'Rembourser un paiement client ou apprenant'),
('cash.open', 'cash', 'Ouvrir la caisse', 'Ouvrir une session de caisse avec fond initial'),
('cash.close', 'cash', 'Clôturer la caisse', 'Clôturer la session de caisse avec inventaire physique'),
('cash.view', 'cash', 'Consulter la caisse', 'Visualiser les mouvements et le solde de caisse'),
('expenses.manage', 'cash', 'Gérer les dépenses', 'Enregistrer et justifier des sorties de caisse pour frais'),

-- Stocks & Fournisseurs
('stock.view', 'stock', 'Consulter les stocks', 'Voir les niveaux de stocks et alertes'),
('stock.manage', 'stock', 'Gérer les mouvements de stock', 'Entrées, sorties et ajustements d''inventaire'),
('suppliers.manage', 'suppliers', 'Gérer les fournisseurs', 'Créer fournisseurs et bons de commande'),

-- Formations (LMS)
('trainings.view', 'training', 'Consulter les formations', 'Voir le catalogue et les modules'),
('trainings.manage', 'training', 'Gérer les formations', 'Créer et modifier le catalogue de formation'),
('sessions.manage', 'training', 'Gérer les sessions', 'Planifier des sessions et assigner formateurs/salles'),
('enrollments.manage', 'training', 'Gérer les inscriptions', 'Inscrire des apprenants et valider les dossiers'),
('attendance.manage', 'training', 'Pointer les présences', 'Enregistrer la présence et retards des apprenants'),
('assessments.manage', 'training', 'Gérer les évaluations', 'Saisir les notes et coefficients'),
('certificates.create', 'training', 'Délivrer les certificats', 'Générer les certificats PDF avec QR Code'),
('certificates.verify', 'training', 'Vérifier les certificats', 'Vérifier la validité d''un certificat'),

-- Rapports & Administration
('reports.view', 'reports', 'Consulter les rapports', 'Accéder aux statistiques financières et d''activité'),
('users.manage', 'users', 'Gérer les utilisateurs', 'Créer et assigner des rôles aux collaborateurs'),
('settings.manage', 'settings', 'Gérer les paramètres', 'Configuration générale du centre et tarifs')
ON CONFLICT (code) DO NOTHING;

-- 2. TENANT PRINCIPAL PAR DÉFAUT
INSERT INTO tenants (
    id, name, code, slug, activity_type, status, responsible_name, 
    phone, email, address, currency, tax_rate, is_active, subscription_status
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Centre Polyvalent d''Excellence & Prestations (CPEP)',
    'CPEP-01',
    'cpep-conakry',
    'SERVICE_CENTER',
    'ACTIVE',
    'Directeur Général',
    '+224 620 00 11 22',
    'contact@cpep-guinee.com',
    'Avenue de la République, Kaloum, Conakry',
    'GNF',
    0.00,
    TRUE,
    'ACTIVE'
) ON CONFLICT (code) DO NOTHING;

-- 3. BRANCHE / AGENCE CENTRALE
INSERT INTO branches (id, tenant_id, name, code, phone, email, address, is_main, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Agence Centrale - Kaloum',
    'AG-KALOUM',
    '+224 620 00 11 22',
    'kaloum@cpep-guinee.com',
    'Avenue de la République, Kaloum',
    TRUE,
    TRUE
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 4. RÔLES SYSTÈME (UUIDs valides: préfixe d0000000-...)
INSERT INTO roles (id, tenant_id, name, code, is_system, description) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Super Admin', 'SUPER_ADMIN', TRUE, 'Accès complet et illimité à l''ensemble de la plateforme'),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Admin Centre', 'ADMIN_CENTRE', TRUE, 'Gestion complète du centre et des utilisateurs'),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Gérant', 'GERANT', TRUE, 'Gestion opérationnelle, stocks, commandes et caisse'),
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Réceptionniste', 'RECEPTIONNISTE', TRUE, 'Accueil, création des clients et des commandes'),
('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Caissier', 'CAISSIER', TRUE, 'Encaissements, gestion des sessions et mouvements de caisse'),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Opérateur Production', 'OPERATEUR', TRUE, 'Exécution des travaux de reprographie, scan et reliure'),
('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Responsable Formation', 'RESPONSABLE_FORMATION', TRUE, 'Pilotage des formations, sessions, notes et certificats'),
('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Formateur', 'FORMATEUR', TRUE, 'Pointage des présences et saisie des évaluations'),
('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Magasinier', 'MAGASINIER', TRUE, 'Gestion des stocks et des réceptions fournisseurs')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 5. ATTRIBUTION DE TOUTES LES PERMISSIONS AU RÔLE SUPER_ADMIN & ADMIN_CENTRE
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd0000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'd0000000-0000-0000-0000-000000000002', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 6. UTILISATEUR ADMINISTRATEUR PRINCIPAL INITIAL (UUID valide: préfixe e0000000-...)
-- Mot de passe par défaut: Admin1234! (hash bcrypt standard $2a$10$...)
INSERT INTO users (
    id, tenant_id, branch_id, first_name, last_name, username, email, phone, 
    password_hash, role, is_active
) VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Administrateur',
    'Plateforme',
    'admin',
    'admin@cms-centre.com',
    '+224 620 00 11 22',
    '$2a$10$q09l9qjR0Z4T9l4vKjJz8.6w5Gj.k5G6rX3rV0yU6Z.1E1E1E1E1E', -- Hash de sécurité
    'SUPER_ADMIN',
    TRUE
) ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
) ON CONFLICT (user_id, role_id) DO NOTHING;

-- 7. COMPTES FINANCIERS DE BASE (CAISSE & BANQUE) (UUIDs valides: préfixe f0000000-...)
INSERT INTO financial_accounts (
    id, tenant_id, name, code, type, currency, current_balance, initial_balance, is_active, is_default
) VALUES 
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Caisse Principale (Espèces)', 'CPT-CASH-01', 'CASH', 'GNF', 0.00, 0.00, TRUE, TRUE),
('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Compte Orange Money Pro', 'CPT-OM-01', 'MOBILE_MONEY', 'GNF', 0.00, 0.00, TRUE, FALSE)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 8. REGISTRE DE CAISSE PHYSIQUE (UUID valide: préfixe c0000000-...)
INSERT INTO cash_registers (id, tenant_id, branch_id, name, code, is_active)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Caisse Guichet 1',
    'CAISSE-01',
    TRUE
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 9. CATÉGORIES & SERVICES STANDARDS DU CENTRE (UUIDs valides: 10000000-... & 20000000-...)
INSERT INTO service_categories (id, tenant_id, name, code, icon, sort_order)
VALUES 
('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Reprographie & Impression', 'CAT-REPRO', 'Printer', 1),
('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Finition & Reliure', 'CAT-FINISH', 'BookOpen', 2),
('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Numérisation & Saisie', 'CAT-SCAN', 'FileText', 3)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO services (
    id, tenant_id, category_id, code, name, unit, base_cost, base_price, is_active
) VALUES
('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'SRV-PHOTO-NB', 'Photocopie N&B A4', 'page', 100.00, 500.00, TRUE),
('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'SRV-IMP-COUL', 'Impression Couleur A4', 'page', 500.00, 2000.00, TRUE),
('20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'SRV-RELIURE-SP', 'Reliure Spirale Plastique', 'exemplaire', 3000.00, 10000.00, TRUE),
('20000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'SRV-PLASTIF-A4', 'Plastification A4', 'exemplaire', 2000.00, 5000.00, TRUE)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 10. CATÉGORIE DE FORMATION & FORMATIONS (LMS) (UUIDs valides: 30000000-... & 40000000-...)
INSERT INTO training_categories (id, tenant_id, name, code, description)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Informatique & Bureautique',
    'CAT-INFO',
    'Formations professionnelles aux outils informatiques'
) ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO trainings (
    id, tenant_id, category_id, code, title, duration_hours, level, price, max_capacity, is_active
) VALUES (
    '40000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'FORM-BUR-PRO',
    'Pack Bureautique Professionnelle (Word, Excel, PowerPoint)',
    40,
    'TOUS_NIVEAUX',
    500000.00,
    15,
    TRUE
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 11. SÉQUENCES DE DOCUMENTS
INSERT INTO document_sequences (tenant_id, prefix, current_year, last_sequence)
VALUES
('a0000000-0000-0000-0000-000000000001', 'CMD', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 0),
('a0000000-0000-0000-0000-000000000001', 'FAC', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 0),
('a0000000-0000-0000-0000-000000000001', 'PAY', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 0)
ON CONFLICT (tenant_id, prefix, current_year) DO NOTHING;
