-- ==============================================================================
-- CENTRE MANAGEMENT SYSTEM (CMS) - DATABASE SCHEMA
-- PostgreSQL Normalized Multi-Tenant Schema with RBAC, Services, LMS & Finances
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. MULTI-TENANT & ORGANIZATIONAL HIERARCHY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 2. RBAC: ROLES & PERMISSIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
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
-- 3. UNIFIED PERSONS (CLIENTS, LEARNERS, TRAINERS)
-- ==============================================================================

CREATE TYPE person_type_enum AS ENUM ('CUSTOMER', 'LEARNER', 'TRAINER', 'STAFF', 'OTHER');

CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 4. SERVICES & PRICING ENGINE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50) NOT NULL DEFAULT 'unité', -- page, exemplaire, mètre, document, etc.
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    min_quantity INT NOT NULL DEFAULT 1,
    max_quantity INT, -- NULL means infinity
    unit_price NUMERIC(15, 2) NOT NULL,
    customer_type VARCHAR(50) DEFAULT 'ALL', -- ALL, STUDENT, COMPANY, VIP
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 5. ORDERS & PRODUCTION WORKFLOW
-- ==============================================================================

CREATE TYPE order_source_enum AS ENUM ('INTERNAL', 'BOUTIQUE_POS', 'MARKETPLACE', 'PRESTATION');

CREATE TYPE order_status_enum AS ENUM (
    'DRAFT', 'PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'READY', 'DELIVERED', 'CANCELLED'
);

CREATE TYPE order_priority_enum AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL,
    order_source order_source_enum NOT NULL DEFAULT 'INTERNAL',
    customer_type VARCHAR(20) NOT NULL DEFAULT 'REGISTERED', -- 'REGISTERED' | 'WALK_IN'
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL, -- NULL for walk-in / marketplace guests
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    description TEXT,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(50),
    public_unit VARCHAR(50), -- Unité commerciale choisie par le client
    product_image_url TEXT,
    unit_price NUMERIC(15, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) DEFAULT 0.00,
    total_price NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status order_status_enum,
    new_status order_status_enum NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE production_status_enum AS ENUM ('TODO', 'IN_PROGRESS', 'PAUSED', 'DONE');

CREATE TABLE IF NOT EXISTS production_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ==============================================================================
-- 6. TRAINING / LMS MODULE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS training_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_training_category_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS trainings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES training_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objectives TEXT,
    duration_hours INT NOT NULL DEFAULT 0,
    level VARCHAR(50) DEFAULT 'DEBUTANT', -- DEBUTANT, INTERMEDIAIRE, AVANCE, TOUS_NIVEAUX
    price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    max_capacity INT DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_training_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS training_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_hours INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 20,
    equipment TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE session_status_enum AS ENUM ('PLANNED', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE RESTRICT,
    session_code VARCHAR(50) NOT NULL,
    trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
    classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    schedule_description TEXT, -- ex: Lun-Mer-Ven 09:00 - 12:00
    capacity INT NOT NULL,
    status session_status_enum NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_session_code UNIQUE (tenant_id, session_code)
);

CREATE TYPE enrollment_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE TYPE attendance_status_enum AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

CREATE TABLE IF NOT EXISTS attendance_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title VARCHAR(100),
    conducted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_date UNIQUE (session_id, date)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_sheet_id UUID NOT NULL REFERENCES attendance_sheets(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    status attendance_status_enum NOT NULL DEFAULT 'PRESENT',
    justification TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sheet_learner UNIQUE (attendance_sheet_id, learner_id)
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    module_id UUID REFERENCES training_modules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    assessment_date DATE,
    max_score NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    coefficient NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_learner UNIQUE (assessment_id, learner_id)
);

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
    certificate_code VARCHAR(50) NOT NULL UNIQUE, -- CERT-2026-000001
    issue_date DATE NOT NULL,
    final_score NUMERIC(5, 2),
    mention VARCHAR(50), -- ADMIS, TRES_BIEN, BIEN, ASSEZ_BIEN
    signature_name VARCHAR(100),
    signature_title VARCHAR(100),
    qr_code_data TEXT,
    pdf_url TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_cert_session_learner UNIQUE (session_id, learner_id)
);

CREATE TABLE IF NOT EXISTS certificate_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 7. FINANCES, PAYMENTS & CASH REGISTERS
-- ==============================================================================

CREATE TYPE payment_method_enum AS ENUM ('CASH', 'ORANGE_MONEY', 'MTN_MOMO', 'BANK_TRANSFER', 'CARD', 'OTHER');

CREATE TYPE payment_target_enum AS ENUM ('ORDER', 'ENROLLMENT', 'OTHER');

CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_cash_register_code UNIQUE (tenant_id, code)
);

CREATE TYPE cash_session_status_enum AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE IF NOT EXISTS cash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL, -- NULL for walk-in payments
    person_name VARCHAR(255) NOT NULL,
    target_type payment_target_enum NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
    payment_number VARCHAR(50) NOT NULL, -- PAY-2026-000001
    amount NUMERIC(15, 2) NOT NULL,
    payment_method payment_method_enum NOT NULL DEFAULT 'CASH',
    reference VARCHAR(100),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_payment_number UNIQUE (tenant_id, payment_number)
);

CREATE TYPE cash_movement_type_enum AS ENUM ('INFLOW', 'OUTFLOW', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL');

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ==============================================================================
-- 8. STOCK & SUPPLIERS MODULE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    CONSTRAINT uq_tenant_product_category_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_tenant_product_category_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    unit VARCHAR(50) NOT NULL DEFAULT 'unité', -- paquet, ramette, flacon, rouleau
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
    public_unit VARCHAR(50), -- Public selling unit displayed on marketplace (e.g. Carton, Paquet, Sac)
    public_price NUMERIC(15, 2), -- Public selling price in GNF
    conversion_factor_to_stock_unit NUMERIC(10, 2) DEFAULT 1.0,
    images JSONB DEFAULT '[]'::jsonb, -- Array of up to 4 real photos
    video_url TEXT, -- Optional explanatory video URL
    is_marketplace_published BOOLEAN DEFAULT FALSE,
    publication_status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'DISABLED'
    published_at TIMESTAMP WITH TIME ZONE,
    unpublished_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_tenant_product_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_tenant_product_barcode UNIQUE (tenant_id, barcode)
);

-- ==============================================================================
-- PRODUCT IMAGES (Up to 4 Real Views linked strictly by product_id)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1, -- 1=Vue 1 (Principale), 2=Vue 2, 3=Vue 3, 4=Vue 4
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_image_order UNIQUE (product_id, display_order)
);

-- Automatic stock consumption link with services
CREATE TABLE IF NOT EXISTS service_product_consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_consumed_per_unit NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_service_product UNIQUE (service_id, product_id)
);

CREATE TYPE stock_movement_type_enum AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'CONSUMPTION', 'RETURN');

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    CONSTRAINT uq_tenant_dept_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_tenant_dept_name UNIQUE (tenant_id, name)
);

CREATE TYPE purchase_status_enum AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 9. BILLING, INVOICING & DOCUMENTS
-- ==============================================================================

CREATE TYPE invoice_type_enum AS ENUM ('QUOTE', 'INVOICE', 'RECEIPT');

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
    invoice_type invoice_type_enum NOT NULL DEFAULT 'INVOICE',
    document_number VARCHAR(50) NOT NULL, -- FAC-2026-000001, DEV-2026-000001
    issue_date DATE NOT NULL,
    due_date DATE,
    subtotal NUMERIC(15, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) DEFAULT 0.00,
    tax_amount NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'ISSUED', -- DRAFT, ISSUED, PAID, PARTIAL, CANCELLED
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_doc_number UNIQUE (tenant_id, document_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prefix VARCHAR(20) NOT NULL, -- CMD, FAC, DEV, REC, PAY, CERT
    current_year INT NOT NULL,
    last_sequence INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_tenant_seq UNIQUE (tenant_id, prefix, current_year)
);

-- ==============================================================================
-- 10. NOTIFICATIONS, QR CODES & AUDIT TRAIL
-- ==============================================================================

CREATE TYPE notification_channel_enum AS ENUM ('INTERNAL', 'EMAIL', 'SMS', 'WHATSAPP');

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_code VARCHAR(100) NOT NULL,
    channel notification_channel_enum NOT NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, SUCCESS, WARNING, DANGER
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel notification_channel_enum NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- SENT, FAILED, QUEUED
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- USER_CREATED, ORDER_CREATED, CASH_CLOSED, etc.
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- MARKETPLACE EXTENSIONS: CATEGORIES, CONVERSATIONS & MESSAGES
-- ==============================================================================

-- Central catalog of Marketplace categories
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

-- Store category affiliations
CREATE TABLE IF NOT EXISTS tenant_marketplace_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id VARCHAR(100) NOT NULL REFERENCES marketplace_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_marketplace_category UNIQUE (tenant_id, category_id)
);

-- Marketplace Conversations between Customer and Store
CREATE TABLE IF NOT EXISTS marketplace_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- 'OPEN' | 'ARCHIVED' | 'CLOSED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Marketplace Messages in a Conversation
CREATE TABLE IF NOT EXISTS marketplace_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(100) NOT NULL,
    sender_type VARCHAR(20) NOT NULL, -- 'CUSTOMER' | 'BOUTIQUE' | 'STAFF' | 'ADMIN'
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(100), -- 'Client', 'Vendeur', 'Gérant', 'Accueil / Réception', 'Administrateur'
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'TEXT', -- 'TEXT' | 'IMAGE' | 'ORDER_REF' | 'PRODUCT_REF'
    image_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR MESSAGING
-- ==============================================================================
ALTER TABLE marketplace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;

-- 1. CLIENT RLS: Can view and insert conversations/messages where customer_id matches auth.uid()
CREATE POLICY rls_mkt_conv_client_select ON marketplace_conversations
    FOR SELECT USING (customer_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'SUPER_ADMIN');

CREATE POLICY rls_mkt_conv_client_insert ON marketplace_conversations
    FOR INSERT WITH CHECK (customer_id = auth.uid()::text);

CREATE POLICY rls_mkt_msg_client_select ON marketplace_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM marketplace_conversations c 
            WHERE c.id = marketplace_messages.conversation_id 
              AND (c.customer_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'SUPER_ADMIN')
        )
    );

CREATE POLICY rls_mkt_msg_client_insert ON marketplace_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM marketplace_conversations c 
            WHERE c.id = marketplace_messages.conversation_id 
              AND c.customer_id = auth.uid()::text
        )
    );

-- 2. BOUTIQUE / STAFF RLS: Authorized staff of a boutique can view/reply to their boutique's conversations
CREATE POLICY rls_mkt_conv_boutique_select ON marketplace_conversations
    FOR SELECT USING (
        boutique_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        ) OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
    );

CREATE POLICY rls_mkt_conv_boutique_update ON marketplace_conversations
    FOR UPDATE USING (
        boutique_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        ) OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
    );

CREATE POLICY rls_mkt_msg_boutique_select ON marketplace_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM marketplace_conversations c 
            WHERE c.id = marketplace_messages.conversation_id 
              AND (c.boutique_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) OR auth.jwt() ->> 'role' = 'SUPER_ADMIN')
        )
    );

CREATE POLICY rls_mkt_msg_boutique_insert ON marketplace_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM marketplace_conversations c 
            WHERE c.id = marketplace_messages.conversation_id 
              AND (c.boutique_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) OR auth.jwt() ->> 'role' = 'SUPER_ADMIN')
        )
    );

-- Notifications Table & Audit
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    boutique_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'INFO', -- 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER'
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order Tracking Events Table
CREATE TABLE IF NOT EXISTS order_tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- ROW LEVEL SECURITY (RLS) POLICIES FOR NOTIFICATIONS & ORDERS
-- ==============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking_events ENABLE ROW LEVEL SECURITY;

-- 1. NOTIFICATIONS RLS: Strict Boutique and User Isolation
CREATE POLICY rls_notifications_tenant_select ON notifications
    FOR SELECT USING (
        (boutique_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
        OR (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
        OR user_id = auth.uid()
        OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
    );

CREATE POLICY rls_notifications_tenant_update ON notifications
    FOR UPDATE USING (
        (boutique_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
        OR (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
        OR user_id = auth.uid()
        OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
    );

-- 2. ORDERS RLS: Strict Boutique and Client Separation
CREATE POLICY rls_orders_tenant_isolation ON orders
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        OR person_id = auth.uid()::text
        OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
    );

-- 3. ORDER TRACKING RLS: Accessible by Owning Boutique or Owning Customer
CREATE POLICY rls_order_tracking_select ON order_tracking_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_tracking_events.order_id
              AND (
                  o.tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
                  OR o.person_id = auth.uid()::text
                  OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
              )
        )
    );

-- ==============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persons_tenant ON persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_person ON orders(person_id);
CREATE INDEX IF NOT EXISTS idx_production_jobs_tenant_status ON production_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_training_sessions_tenant ON training_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_session ON enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_register ON cash_sessions(cash_register_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_stock ON products(tenant_id, current_stock);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON audit_logs(tenant_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_boutique ON notifications(boutique_id, is_read);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_boutique ON marketplace_conversations(boutique_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_customer ON marketplace_conversations(customer_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_order ON marketplace_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_mkt_msg_conv ON marketplace_messages(conversation_id, created_at);

-- ==============================================================================
-- 18. STORE VERIFICATION & AUTHENTICATION (BOUTIQUES GUINÉENNES)
-- ==============================================================================

-- Create store verification status and commercial status enums if supported
DO $$ BEGIN
    CREATE TYPE store_verification_status_enum AS ENUM (
        'BROUILLON', 'EN_ATTENTE', 'EN_REVISION', 'INFORMATIONS_DEMANDEES', 'APPROUVE', 'REFUSE', 'ANNULE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE store_commercial_status_enum AS ENUM (
        'EN_ATTENTE_VALIDATION', 'VALIDEE', 'ESSAI_GRATUIT', 'ACTIVE', 'SUSPENDUE', 'ESSAI_EXPIRE', 'ABONNEMENT_EXPIRE', 'FERMEE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Store Verifications Table
CREATE TABLE IF NOT EXISTS store_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_store_verifications_store ON store_verifications(store_id);
CREATE INDEX IF NOT EXISTS idx_store_verifications_status ON store_verifications(status);
CREATE INDEX IF NOT EXISTS idx_store_verifications_submitted_by ON store_verifications(submitted_by);

-- RLS: Public can only view APPROVED & ACTIVE stores
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_public_verified_stores_select ON tenants
    FOR SELECT USING (
        (verification_status = 'APPROUVE' AND (commercial_status = 'ESSAI_GRATUIT' OR commercial_status = 'ACTIVE' OR commercial_status = 'VALIDEE') AND is_active = TRUE)
        OR id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
    );

-- RLS: Public can only view PUBLISHED products from APPROVED & ACTIVE stores
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_public_published_products_select ON products
    FOR SELECT USING (
        (
            publication_status = 'PUBLISHED' 
            AND is_active = TRUE 
            AND is_archived = FALSE
            AND tenant_id IN (
                SELECT id FROM tenants 
                WHERE verification_status = 'APPROUVE' 
                AND (commercial_status = 'ESSAI_GRATUIT' OR commercial_status = 'ACTIVE' OR commercial_status = 'VALIDEE')
                AND is_active = TRUE
            )
        )
        OR tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        OR auth.jwt() ->> 'role' = 'SUPER_ADMIN'
    );



