-- ==============================================================================
-- CENTRE MANAGEMENT SYSTEM (CMS) - SEED DATA
-- Default Demo Data: 1 Tenant, Roles, Permissions, Services, Trainings, Stock
-- ==============================================================================

-- 1. Standard Permissions
INSERT INTO permissions (code, module, name, description) VALUES
-- Orders
('orders.create', 'orders', 'Créer des commandes', 'Autorise la création de nouvelles commandes de services'),
('orders.view', 'orders', 'Consulter les commandes', 'Permet de voir la liste et le détail des commandes'),
('orders.update', 'orders', 'Modifier les commandes', 'Permet de modifier le contenu et statut d''une commande'),
('orders.cancel', 'orders', 'Annuler des commandes', 'Permet d''annuler une commande existante'),

-- Production
('production.view', 'production', 'Voir la file de production', 'Accès au tableau de bord des travaux en cours'),
('production.manage', 'production', 'Gérer la production', 'Prendre en charge, démarrer et terminer un travail'),

-- Payments & Cash
('payments.create', 'payments', 'Encaisser des paiements', 'Enregistrer un paiement pour commande ou formation'),
('payments.view', 'payments', 'Consulter les paiements', 'Accéder à l''historique des transactions'),
('payments.refund', 'payments', 'Effectuer des remboursements', 'Rembourser un paiement client ou apprenant'),
('cash.open', 'cash', 'Ouvrir la caisse', 'Ouvrir une session de caisse avec fond initial'),
('cash.close', 'cash', 'Clôturer la caisse', 'Clôturer la session de caisse avec inventaire physique'),
('cash.view', 'cash', 'Consulter la caisse', 'Visualiser les mouvements et le solde de caisse'),
('expenses.manage', 'cash', 'Gérer les dépenses', 'Enregistrer et justifier des sorties de caisse pour frais'),

-- Stock & Suppliers
('stock.view', 'stock', 'Consulter les stocks', 'Voir les niveaux de stocks et alertes'),
('stock.manage', 'stock', 'Gérer les mouvements de stock', 'Entrées, sorties et ajustements d''inventaire'),
('suppliers.manage', 'suppliers', 'Gérer les fournisseurs', 'Créer fournisseurs et bons de commande'),

-- Training / LMS
('trainings.view', 'training', 'Consulter les formations', 'Voir le catalogue et les modules'),
('trainings.manage', 'training', 'Gérer les formations', 'Créer et modifier le catalogue de formation'),
('sessions.manage', 'training', 'Gérer les sessions', 'Planifier des sessions et assigner formateurs/salles'),
('enrollments.manage', 'training', 'Gérer les inscriptions', 'Inscrire des apprenants et valider les dossiers'),
('attendance.manage', 'training', 'Pointer les présences', 'Enregistrer la présence et retards des apprenants'),
('assessments.manage', 'training', 'Gérer les évaluations', 'Saisir les notes et coefficients'),
('certificates.create', 'training', 'Délivrer les certificats', 'Générer les certificats PDF avec QR Code'),
('certificates.verify', 'training', 'Vérifier les certificats', 'Vérifier la validité d''un certificat'),

-- Reports & Settings
('reports.view', 'reports', 'Consulter les rapports', 'Accéder aux statistiques financières et d''activité'),
('users.manage', 'users', 'Gérer les utilisateurs', 'Créer et assigner des rôles aux collaborateurs'),
('settings.manage', 'settings', 'Gérer les paramètres', 'Configuration générale du centre et tarifs')
ON CONFLICT (code) DO NOTHING;

-- 2. Create Default Tenant
INSERT INTO tenants (id, name, code, slug, phone, email, address, currency, tax_rate, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Centre Polyvalent d''Excellence & Prestations (CPEP)',
    'CPEP-01',
    'cpep-conakry',
    '+224 620 00 11 22',
    'contact@cpep-guinee.com',
    'Avenue de la République, Kaloum, Conakry',
    'GNF',
    0.00,
    TRUE
) ON CONFLICT (code) DO NOTHING;

-- 3. Create Main Branch
INSERT INTO branches (id, tenant_id, name, code, phone, email, address, is_main)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Agence Centrale - Kaloum',
    'AG-KALOUM',
    '+224 620 00 11 22',
    'kaloum@cpep-guinee.com',
    'Avenue de la République, Kaloum',
    TRUE
) ON CONFLICT DO NOTHING;

-- 4. Create Standard Roles
INSERT INTO roles (id, tenant_id, name, code, is_system, description) VALUES
('r0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Super Admin', 'SUPER_ADMIN', TRUE, 'Accès complet et illimité à l''ensemble de la plateforme'),
('r0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Admin Centre', 'ADMIN_CENTRE', TRUE, 'Gestion complète du centre et des utilisateurs'),
('r0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Gérant', 'GERANT', TRUE, 'Gestion opérationnelle, stocks, commandes et caisse'),
('r0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Réceptionniste', 'RECEPTIONNISTE', TRUE, 'Accueil, création des clients et des commandes'),
('r0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Caissier', 'CAISSIER', TRUE, 'Encaissements, gestion des sessions et mouvements de caisse'),
('r0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Opérateur Production', 'OPERATEUR', TRUE, 'Exécution des travaux de reprographie, scan et reliure'),
('r0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Responsable Formation', 'RESPONSABLE_FORMATION', TRUE, 'Pilotage des formations, sessions, notes et certificats'),
('r0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Formateur', 'FORMATEUR', TRUE, 'Pointage des présences et saisie des évaluations'),
('r0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Magasinier', 'MAGASINIER', TRUE, 'Gestion des stocks et des réceptions fournisseurs')
ON CONFLICT DO NOTHING;
