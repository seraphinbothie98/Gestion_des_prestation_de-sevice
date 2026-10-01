-- ==============================================================================
-- CENTRE MANAGEMENT SYSTEM (CMS) - ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-Tenant Isolation & Granular Security
-- ==============================================================================

-- Enable Row Level Security on all tenant-isolated tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to extract current tenant ID from auth context or session config
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Generic Tenant Isolation Policy Template (applied per table)
CREATE POLICY tenant_isolation_orders ON orders
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true')
    WITH CHECK (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true');

CREATE POLICY tenant_isolation_persons ON persons
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true')
    WITH CHECK (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true');

CREATE POLICY tenant_isolation_trainings ON trainings
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true')
    WITH CHECK (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true');

CREATE POLICY tenant_isolation_payments ON payments
    FOR ALL
    USING (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true')
    WITH CHECK (tenant_id = current_tenant_id() OR current_setting('app.is_super_admin', TRUE) = 'true');

-- Public Verification Policy for Certificates (Readable without auth for valid certificate checking)
CREATE POLICY public_verify_certificates ON certificates
    FOR SELECT
    USING (is_valid = TRUE);
