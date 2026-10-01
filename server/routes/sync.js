import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/sync
 * Charge l'état initial d'un tenant pour le store frontend
 */
router.get('/', async (req, res) => {
  try {
    const targetTenant = req.query.tenantId || (req.user ? req.user.tenantId : null);

    const [tenantsRes, personsRes, servicesRes, productsRes, ordersRes, accountsRes] = await Promise.all([
      query('SELECT * FROM tenants WHERE deleted_at IS NULL ORDER BY created_at DESC'),
      targetTenant && targetTenant !== 'ALL'
        ? query('SELECT * FROM persons WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC', [targetTenant])
        : query('SELECT * FROM persons WHERE deleted_at IS NULL ORDER BY created_at DESC'),
      targetTenant && targetTenant !== 'ALL'
        ? query('SELECT * FROM services WHERE tenant_id = $1 ORDER BY created_at DESC', [targetTenant])
        : query('SELECT * FROM services ORDER BY created_at DESC'),
      targetTenant && targetTenant !== 'ALL'
        ? query('SELECT * FROM products WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC', [targetTenant])
        : query('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC'),
      targetTenant && targetTenant !== 'ALL'
        ? query('SELECT * FROM orders WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 500', [targetTenant])
        : query('SELECT * FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500'),
      targetTenant && targetTenant !== 'ALL'
        ? query('SELECT * FROM financial_accounts WHERE tenant_id = $1 ORDER BY created_at ASC', [targetTenant])
        : query('SELECT * FROM financial_accounts ORDER BY created_at ASC')
    ]);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        tenants: tenantsRes.rows,
        persons: personsRes.rows,
        services: servicesRes.rows,
        products: productsRes.rows,
        orders: ordersRes.rows,
        financialAccounts: accountsRes.rows
      }
    });
  } catch (error) {
    console.error('[Sync Route Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
