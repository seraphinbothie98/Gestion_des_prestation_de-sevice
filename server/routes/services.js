import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/services
 * Récupère les prestations et tarifs
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || (req.user ? req.user.tenantId : null);
    let sql = 'SELECT * FROM services WHERE 1=1';
    const params = [];

    if (tenantId && tenantId !== 'ALL') {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);

    const services = result.rows.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      categoryId: d.category_id,
      code: d.code,
      name: d.name,
      description: d.description,
      unit: d.unit || 'unité',
      baseCost: Number(d.base_cost || 0),
      basePrice: Number(d.base_price || 0),
      requiresFile: d.requires_file ?? false,
      estimatedDurationMinutes: d.estimated_duration_minutes || 5,
      isActive: d.is_active ?? true,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    return res.json({ success: true, data: services });
  } catch (error) {
    console.error('[Get Services Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/services
 * Crée ou met à jour une prestation
 */
router.post('/', async (req, res) => {
  try {
    const s = req.body;
    if (!s.tenantId || !s.name || !s.code) {
      return res.status(400).json({ success: false, message: 'tenantId, nom et code requis.' });
    }

    const id = s.id || `srv-${Date.now()}`;

    // S'assurer qu'une catégorie existe
    let categoryId = s.categoryId;
    if (!categoryId) {
      const catCheck = await query('SELECT id FROM service_categories WHERE tenant_id = $1 LIMIT 1', [s.tenantId]);
      if (catCheck.rows.length > 0) {
        categoryId = catCheck.rows[0].id;
      } else {
        const newCat = await query(
          'INSERT INTO service_categories (tenant_id, name, code) VALUES ($1, $2, $3) RETURNING id',
          [s.tenantId, 'Général', 'CAT-GEN']
        );
        categoryId = newCat.rows[0].id;
      }
    }

    const sql = `
      INSERT INTO services (
        id, tenant_id, category_id, code, name, description, unit,
        base_cost, base_price, requires_file, estimated_duration_minutes, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        unit = EXCLUDED.unit,
        base_cost = EXCLUDED.base_cost,
        base_price = EXCLUDED.base_price,
        requires_file = EXCLUDED.requires_file,
        estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      id,
      s.tenantId,
      categoryId,
      s.code,
      s.name,
      s.description || null,
      s.unit || 'unité',
      s.baseCost || 0,
      s.basePrice || 0,
      s.requiresFile ?? false,
      s.estimatedDurationMinutes || 5,
      s.isActive ?? true
    ];

    const result = await query(sql, params);
    return res.json({ success: true, service: result.rows[0] });
  } catch (error) {
    console.error('[Save Service Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
