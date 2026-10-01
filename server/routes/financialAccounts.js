import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/financial-accounts
 * Récupère les comptes financiers d'un tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || (req.user ? req.user.tenantId : null);
    let sql = 'SELECT * FROM financial_accounts WHERE 1=1';
    const params = [];

    if (tenantId && tenantId !== 'ALL') {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at ASC';

    const result = await query(sql, params);

    const accounts = result.rows.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      name: d.name,
      code: d.code,
      type: d.type,
      currency: d.currency || 'GNF',
      currentBalance: Number(d.current_balance || 0),
      initialBalance: Number(d.initial_balance || 0),
      accountNumber: d.account_number,
      isActive: d.is_active ?? true,
      isDefault: d.is_default ?? false,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    return res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('[Get Financial Accounts Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/financial-accounts
 * Crée ou met à jour un compte financier
 */
router.post('/', async (req, res) => {
  try {
    const a = req.body;
    if (!a.tenantId || !a.name || !a.code) {
      return res.status(400).json({ success: false, message: 'tenantId, nom et code requis.' });
    }

    const id = a.id || `acc-${Date.now()}`;

    const sql = `
      INSERT INTO financial_accounts (
        id, tenant_id, name, code, type, currency, current_balance,
        initial_balance, account_number, is_active, is_default, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        type = EXCLUDED.type,
        currency = EXCLUDED.currency,
        current_balance = EXCLUDED.current_balance,
        initial_balance = EXCLUDED.initial_balance,
        account_number = EXCLUDED.account_number,
        is_active = EXCLUDED.is_active,
        is_default = EXCLUDED.is_default,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      id,
      a.tenantId,
      a.name,
      a.code,
      a.type || 'CASH',
      a.currency || 'GNF',
      a.currentBalance || 0,
      a.initialBalance || 0,
      a.accountNumber || null,
      a.isActive ?? true,
      a.isDefault ?? false
    ];

    const result = await query(sql, params);
    return res.json({ success: true, account: result.rows[0] });
  } catch (error) {
    console.error('[Save Financial Account Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
