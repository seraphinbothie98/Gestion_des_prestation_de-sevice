-- ==============================================================================
-- CENTRE MANAGEMENT SYSTEM (CMS) - POSTGRESQL CPANEL SCHEMA
-- Compatible: PostgreSQL 10.23+ & PostgreSQL 11/12/13/14/15/16
-- Conçu spécifiquement pour hébergement cPanel (sans privilèges superuser requis)
-- ==============================================================================

-- 1. Gestion résiliente des UUID sous PostgreSQL 10.23
-- Tente d'activer uuid-ossp ou pgcrypto si les droits le permettent
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Fonction universelle de génération UUID compatible PostgreSQL 10+
-- Fonctionne même si l'hébergeur cPanel restreint les extensions
CREATE OR REPLACE FUNCTION cpanel_gen_uuid() RETURNS UUID AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid') THEN
        RETURN gen_random_uuid();
    ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4') THEN
        RETURN uuid_generate_v4();
    ELSE
        -- Fallback pseudo-aléatoire UUID v4 100% natif PG 10 sans extension
        RETURN md5(random()::text || clock_timestamp()::text)::uuid;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN md5(random()::text || clock_timestamp()::text)::uuid;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. TYPES ENUMÉRÉS (PROTÉGÉS CONTRE LES DOUBLONS)
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE person_type_enum AS ENUM ('CUSTOMER', 'LEARNER', 'TRAINER', 'STAFF', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_source_enum AS ENUM ('INTERNAL', 'BOUTIQUE_POS', 'MARKETPLACE', 'PRESTATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM (
        'DRAFT', 'PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'READY', 'DELIVERED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_priority_enum AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE production_status_enum AS ENUM ('TODO', 'IN_PROGRESS', 'PAUSED', 'DONE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE session_status_enum AS ENUM ('PLANNED', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE enrollment_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status_enum AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('CASH', 'ORANGE_MONEY', 'MTN_MOMO', 'BANK_TRANSFER', 'CARD', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_target_enum AS ENUM ('ORDER', 'ENROLLMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cash_session_status_enum AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cash_movement_type_enum AS ENUM ('INFLOW', 'OUTFLOW', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE stock_movement_type_enum AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'CONSUMPTION', 'RETURN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE purchase_status_enum AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_type_enum AS ENUM ('QUOTE', 'INVOICE', 'RECEIPT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel_enum AS ENUM ('INTERNAL', 'EMAIL', 'SMS', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==============================================================================
-- 3. STRUCTURE MULTI-TENANT & AGENCES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    activity_type VARCHAR(50) DEFAULT 'SERVICE_CENTER',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    responsible_name VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'ACTIVE',
    trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    trial_days_total INT DEFAULT 45,
    activation_requests JSONB DEFAULT '[]'::jsonb,
    license_plan VARCHAR(50) DEFAULT 'COMMERCIAL',
    license_key VARCHAR(100),
    verification_status VARCHAR(50) DEFAULT 'APPROUVE',
    commercial_status VARCHAR(50) DEFAULT 'ACTIVE',
    logo_url TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    currency VARCHAR(10) DEFAULT 'GNF',
    tax_rate NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    is_main BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_tenant_branch_code UNIQUE (tenant_id, code)
);

-- ==============================================================================
-- 4. RBAC: ROLES, PERMISSIONS & UTILISATEURS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_role_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'GERANT',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_until TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INT DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- ==============================================================================
-- 5. PERSONNES (CLIENTS, APPRENANTS, FORMATEURS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    id_card_number VARCHAR(100),
    photo_url TEXT,
    types person_type_enum[] DEFAULT ARRAY['CUSTOMER'::person_type_enum],
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE UNIQUE,
    customer_number VARCHAR(50) NOT NULL,
    company_name VARCHAR(255),
    is_company BOOLEAN DEFAULT FALSE,
    discount_rate NUMERIC(5, 2) DEFAULT 0.00,
    credit_limit NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_customer_number UNIQUE (tenant_id, customer_number)
);

CREATE TABLE IF NOT EXISTS trainers (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE UNIQUE,
    trainer_number VARCHAR(50) NOT NULL,
    specialty VARCHAR(255),
    bio TEXT,
    hourly_rate NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_trainer_number UNIQUE (tenant_id, trainer_number)
);

CREATE TABLE IF NOT EXISTS learners (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE UNIQUE,
    learner_number VARCHAR(50) NOT NULL,
    education_level VARCHAR(100),
    profession VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_learner_number UNIQUE (tenant_id, learner_number)
);

-- ==============================================================================
-- 6. SERVICES ET TARIFICATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    icon VARCHAR(50),
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_service_category_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50) NOT NULL DEFAULT 'unité',
    base_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    base_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    requires_file BOOLEAN DEFAULT FALSE,
    estimated_duration_minutes INT DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_service_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS service_pricing_rules (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    min_quantity INT NOT NULL DEFAULT 1,
    max_quantity INT,
    unit_price NUMERIC(15, 2) NOT NULL,
    customer_type VARCHAR(50) DEFAULT 'ALL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 7. COMMANDES & PRODUCTION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL,
    order_source order_source_enum NOT NULL DEFAULT 'INTERNAL',
    customer_type VARCHAR(20) NOT NULL DEFAULT 'REGISTERED',
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    person_name VARCHAR(255) NOT NULL,
    person_phone VARCHAR(50),
    person_email VARCHAR(255),
    client_city VARCHAR(100),
    delivery_address TEXT,
    status order_status_enum NOT NULL DEFAULT 'PENDING',
    priority order_priority_enum NOT NULL DEFAULT 'NORMAL',
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    due_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    due_date TIMESTAMP WITH TIME ZONE,
    instructions TEXT,
    is_read_by_merchant BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_tenant_order_number UNIQUE (tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
    product_id UUID,
    description TEXT,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(50),
    public_unit VARCHAR(50),
    product_image_url TEXT,
    unit_price NUMERIC(15, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) DEFAULT 0.00,
    total_price NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_files (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status order_status_enum,
    new_status order_status_enum NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_jobs (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    status production_status_enum NOT NULL DEFAULT 'TODO',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_tracking_events (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    actor_name VARCHAR(255),
    actor_role VARCHAR(100),
    is_completed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 8. FORMATIONS & LMS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS training_categories (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_training_category_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS trainings (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES training_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objectives TEXT,
    duration_hours INT NOT NULL DEFAULT 0,
    level VARCHAR(50) DEFAULT 'DEBUTANT',
    price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    max_capacity INT DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_training_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS training_modules (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_hours INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 20,
    equipment TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE RESTRICT,
    session_code VARCHAR(50) NOT NULL,
    trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
    classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    schedule_description TEXT,
    capacity INT NOT NULL,
    status session_status_enum NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_session_code UNIQUE (tenant_id, session_code)
);

CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
    enrollment_number VARCHAR(50) NOT NULL,
    status enrollment_status_enum NOT NULL DEFAULT 'PENDING',
    price NUMERIC(15, 2) NOT NULL,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    final_amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) DEFAULT 0.00,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_enrollment_number UNIQUE (tenant_id, enrollment_number),
    CONSTRAINT uq_session_learner UNIQUE (session_id, learner_id)
);

CREATE TABLE IF NOT EXISTS attendance_sheets (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title VARCHAR(100),
    conducted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_date UNIQUE (session_id, date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    attendance_sheet_id UUID NOT NULL REFERENCES attendance_sheets(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    status attendance_status_enum NOT NULL DEFAULT 'PRESENT',
    justification TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sheet_learner UNIQUE (attendance_sheet_id, learner_id)
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    module_id UUID REFERENCES training_modules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    assessment_date DATE,
    max_score NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    coefficient NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_results (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_learner UNIQUE (assessment_id, learner_id)
);

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
    certificate_code VARCHAR(50) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    final_score NUMERIC(5, 2),
    mention VARCHAR(50),
    signature_name VARCHAR(100),
    signature_title VARCHAR(100),
    qr_code_data TEXT,
    pdf_url TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_cert_session_learner UNIQUE (session_id, learner_id)
);

CREATE TABLE IF NOT EXISTS certificate_verifications (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 9. CAISSES, PAIEMENTS & FINANCES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_cash_register_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS cash_sessions (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    closing_balance_theoretical NUMERIC(15, 2),
    closing_balance_actual NUMERIC(15, 2),
    difference_amount NUMERIC(15, 2),
    status cash_session_status_enum NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    person_name VARCHAR(255) NOT NULL,
    target_type payment_target_enum NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
    payment_number VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_method payment_method_enum NOT NULL DEFAULT 'CASH',
    reference VARCHAR(100),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_payment_number UNIQUE (tenant_id, payment_number)
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    movement_type cash_movement_type_enum NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
    expense_number VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    receipt_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_expense_number UNIQUE (tenant_id, expense_number)
);

CREATE TABLE IF NOT EXISTS financial_accounts (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    currency VARCHAR(10) DEFAULT 'GNF',
    current_balance NUMERIC(15, 2) DEFAULT 0.00,
    initial_balance NUMERIC(15, 2) DEFAULT 0.00,
    account_number VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_financial_account_code UNIQUE (tenant_id, code)
);

-- ==============================================================================
-- 10. PRODUITS, CATÉGORIES & GESTION DES STOCKS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_tenant_product_category_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    unit VARCHAR(50) NOT NULL DEFAULT 'unité',
    purchase_unit VARCHAR(50),
    stock_unit VARCHAR(50),
    conversion_factor NUMERIC(10, 2) DEFAULT 1.0,
    cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    purchase_price_purchase_unit NUMERIC(15, 2),
    sale_price NUMERIC(15, 2),
    sale_price_purchase_unit NUMERIC(15, 2),
    wholesale_price NUMERIC(15, 2),
    initial_stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    min_stock_alert NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    max_stock NUMERIC(10, 2),
    location TEXT,
    stock_by_location JSONB DEFAULT '{}'::jsonb,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    public_unit VARCHAR(50),
    public_price NUMERIC(15, 2),
    conversion_factor_to_stock_unit NUMERIC(10, 2) DEFAULT 1.0,
    images JSONB DEFAULT '[]'::jsonb,
    video_url TEXT,
    is_marketplace_published BOOLEAN DEFAULT FALSE,
    publication_status VARCHAR(50) DEFAULT 'DRAFT',
    published_at TIMESTAMP WITH TIME ZONE,
    unpublished_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_tenant_product_code UNIQUE (tenant_id, code)
);

-- Liaison stricte des clés étrangères de order_items vers products
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_product;
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_image_order UNIQUE (product_id, display_order)
);

CREATE TABLE IF NOT EXISTS service_product_consumptions (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_consumed_per_unit NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_service_product UNIQUE (service_id, product_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type stock_movement_type_enum NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_cost NUMERIC(15, 2),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    reason TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requesting_departments (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_tenant_dept_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES requesting_departments(id) ON DELETE RESTRICT,
    po_number VARCHAR(50) NOT NULL,
    status purchase_status_enum NOT NULL DEFAULT 'ORDERED',
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    order_date DATE NOT NULL,
    expected_delivery DATE,
    received_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_po_number UNIQUE (tenant_id, po_number)
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_code VARCHAR(50),
    product_name VARCHAR(255),
    category VARCHAR(100),
    ordered_quantity_purchase_unit NUMERIC(10, 2) NOT NULL,
    purchase_unit_name VARCHAR(50),
    conversion_factor NUMERIC(10, 2) DEFAULT 1.0,
    quantity_in_stock_unit NUMERIC(10, 2) NOT NULL,
    received_quantity_purchase_unit NUMERIC(10, 2) DEFAULT 0.0,
    unit_price_purchase_unit NUMERIC(15, 2) NOT NULL,
    unit_price_stock_unit NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 11. FACTURATION, DOCUMENTS & NUMÉROTATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
    invoice_type invoice_type_enum NOT NULL DEFAULT 'INVOICE',
    document_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE,
    subtotal NUMERIC(15, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) DEFAULT 0.00,
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'ISSUED',
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_doc_number UNIQUE (tenant_id, document_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_sequences (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prefix VARCHAR(20) NOT NULL,
    current_year INT NOT NULL,
    last_sequence INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_tenant_seq UNIQUE (tenant_id, prefix, current_year)
);

-- ==============================================================================
-- 12. NOTIFICATIONS, MODÈLES & JOURNAUX D'AUDIT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_code VARCHAR(100) NOT NULL,
    channel notification_channel_enum NOT NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    boutique_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel notification_channel_enum NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 13. MARKETPLACE, CONVERSATIONS & MESSAGES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS marketplace_categories (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(100),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_marketplace_categories (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id VARCHAR(100) NOT NULL REFERENCES marketplace_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_marketplace_category UNIQUE (tenant_id, category_id)
);

CREATE TABLE IF NOT EXISTS marketplace_conversations (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    customer_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    boutique_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    boutique_name VARCHAR(255) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    publication_id VARCHAR(100),
    product_name VARCHAR(255),
    product_image_url TEXT,
    public_price NUMERIC(15, 2),
    public_unit VARCHAR(50),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_code VARCHAR(100),
    order_total NUMERIC(15, 2),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    service_name VARCHAR(255),
    last_message_content TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_sender_role VARCHAR(100),
    unread_by_boutique INTEGER NOT NULL DEFAULT 0,
    unread_by_customer INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_messages (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    conversation_id UUID NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(100) NOT NULL,
    sender_type VARCHAR(20) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(100),
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    image_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_verifications (
    id UUID PRIMARY KEY DEFAULT cpanel_gen_uuid(),
    store_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_by_name VARCHAR(255) NOT NULL,
    submitted_by_phone VARCHAR(50) NOT NULL,
    submitted_by_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'EN_ATTENTE',
    commercial_status VARCHAR(50) DEFAULT 'EN_ATTENTE_VALIDATION',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_name VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    rejection_note TEXT,
    internal_admin_notes TEXT,
    requested_information TEXT,
    has_potential_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_warning_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 14. INDEX DE PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_persons_tenant ON persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persons_phone ON persons(phone);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_person ON orders(person_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_production_jobs_tenant_status ON production_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_training_sessions_tenant ON training_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_session ON enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_register ON cash_sessions(cash_register_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_stock ON products(tenant_id, current_stock);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON audit_logs(tenant_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_boutique ON notifications(boutique_id, is_read);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_boutique ON marketplace_conversations(boutique_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_customer ON marketplace_conversations(customer_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_order ON marketplace_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_mkt_msg_conv ON marketplace_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_store_verifications_store ON store_verifications(store_id);
CREATE INDEX IF NOT EXISTS idx_store_verifications_status ON store_verifications(status);
