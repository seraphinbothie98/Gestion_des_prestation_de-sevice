import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/persons
 * Récupère les personnes avec filtre multi-tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || (req.user ? req.user.tenantId : null);
    let sql = 'SELECT * FROM persons WHERE deleted_at IS NULL';
    const params = [];

    if (tenantId && tenantId !== 'ALL') {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);

    const persons = result.rows.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      firstName: d.first_name,
      lastName: d.last_name,
      phone: d.phone,
      email: d.email,
      address: d.address,
      idCardNumber: d.id_card_number,
      photoUrl: d.photo_url,
      types: d.types || ['CUSTOMER'],
      notes: d.notes,
      isActive: d.is_active ?? true,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    return res.json({ success: true, data: persons });
  } catch (error) {
    console.error('[Get Persons Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/persons
 * Crée ou met à jour une personne
 */
router.post('/', async (req, res) => {
  try {
    const p = req.body;
    if (!p.tenantId || !p.firstName || !p.lastName) {
      return res.status(400).json({ success: false, message: 'tenantId, prénom et nom requis.' });
    }

    const id = p.id || `p-${Date.now()}`;

    const sql = `
      INSERT INTO persons (
        id, tenant_id, first_name, last_name, phone, email, address,
        id_card_number, photo_url, types, notes, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        id_card_number = EXCLUDED.id_card_number,
        photo_url = EXCLUDED.photo_url,
        types = EXCLUDED.types,
        notes = EXCLUDED.notes,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      id,
      p.tenantId,
      p.firstName,
      p.lastName,
      p.phone || null,
      p.email || null,
      p.address || null,
      p.idCardNumber || null,
      p.photoUrl || null,
      p.types || ['CUSTOMER'],
      p.notes || null,
      p.isActive ?? true
    ];

    const result = await query(sql, params);
    return res.json({ success: true, person: result.rows[0] });
  } catch (error) {
    console.error('[Save Person Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
