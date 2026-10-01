import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/tenants
 * Récupère les agences (toutes pour SUPER_ADMIN, la sienne pour un gérant)
 */
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM tenants WHERE deleted_at IS NULL ORDER BY created_at DESC';
    let params = [];

    // Si authentifié et non super_admin, restreindre à son propre tenant
    if (req.user && req.user.role !== 'SUPER_ADMIN') {
      sql = 'SELECT * FROM tenants WHERE id = $1 AND deleted_at IS NULL';
      params = [req.user.tenantId];
    }

    const result = await query(sql, params);

    const tenants = result.rows.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
      slug: d.slug,
      activityType: d.activity_type || 'SERVICE_CENTER',
      status: d.status || 'ACTIVE',
      responsibleName: d.responsible_name || '',
      subscriptionStatus: d.subscription_status || 'ACTIVE',
      trialStartedAt: d.trial_started_at || d.created_at,
      trialEndsAt: d.trial_ends_at || d.created_at,
      trialDaysTotal: d.trial_days_total || 45,
      activationRequests: d.activation_requests || [],
      licensePlan: d.license_plan || 'COMMERCIAL',
      licenseKey: d.license_key,
      verificationStatus: d.verification_status || 'APPROUVE',
      commercialStatus: d.commercial_status || 'ACTIVE',
      phone: d.phone,
      email: d.email,
      address: d.address,
      currency: d.currency || 'GNF',
      taxRate: Number(d.tax_rate || 0),
      isActive: d.is_active ?? true,
      settings: d.settings || {},
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    return res.json({ success: true, data: tenants });
  } catch (error) {
    console.error('[Get Tenants Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tenants
 * Crée ou met à jour une agence
 */
router.post('/', async (req, res) => {
  try {
    const t = req.body;
    if (!t.name || !t.code) {
      return res.status(400).json({ success: false, message: 'Nom et code requis.' });
    }

    const id = t.id || `t-${Date.now()}`;
    const slug = t.slug || t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const sql = `
      INSERT INTO tenants (
        id, name, code, slug, activity_type, status, responsible_name,
        subscription_status, trial_started_at, trial_ends_at, trial_days_total,
        license_plan, license_key, verification_status, commercial_status,
        phone, email, address, currency, tax_rate, is_active, settings, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        activity_type = EXCLUDED.activity_type,
        status = EXCLUDED.status,
        responsible_name = EXCLUDED.responsible_name,
        subscription_status = EXCLUDED.subscription_status,
        trial_started_at = EXCLUDED.trial_started_at,
        trial_ends_at = EXCLUDED.trial_ends_at,
        trial_days_total = EXCLUDED.trial_days_total,
        license_plan = EXCLUDED.license_plan,
        license_key = EXCLUDED.license_key,
        verification_status = EXCLUDED.verification_status,
        commercial_status = EXCLUDED.commercial_status,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        currency = EXCLUDED.currency,
        tax_rate = EXCLUDED.tax_rate,
        is_active = EXCLUDED.is_active,
        settings = EXCLUDED.settings,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      id,
      t.name,
      t.code,
      slug,
      t.activityType || 'SERVICE_CENTER',
      t.status || 'ACTIVE',
      t.responsibleName || '',
      t.subscriptionStatus || 'ACTIVE',
      t.trialStartedAt || new Date().toISOString(),
      t.trialEndsAt || new Date(Date.now() + 45 * 86400000).toISOString(),
      t.trialDaysTotal || 45,
      t.licensePlan || 'COMMERCIAL',
      t.licenseKey || null,
      t.verificationStatus || 'APPROUVE',
      t.commercialStatus || 'ACTIVE',
      t.phone || null,
      t.email || null,
      t.address || null,
      t.currency || 'GNF',
      t.taxRate || 0,
      t.isActive ?? true,
      JSON.stringify(t.settings || {})
    ];

    const result = await query(sql, params);
    return res.json({ success: true, tenant: result.rows[0] });
  } catch (error) {
    console.error('[Save Tenant Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
