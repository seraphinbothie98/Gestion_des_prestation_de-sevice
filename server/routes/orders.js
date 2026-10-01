import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/orders
 * Récupère les commandes d'un tenant avec leurs items
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || (req.user ? req.user.tenantId : null);
    let sql = 'SELECT * FROM orders WHERE deleted_at IS NULL';
    const params = [];

    if (tenantId && tenantId !== 'ALL') {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    const orders = result.rows;

    // Récupération des items de chaque commande
    const orderIds = orders.map(o => o.id);
    let itemsMap = {};

    if (orderIds.length > 0) {
      const itemsResult = await query(
        `SELECT * FROM order_items WHERE order_id = ANY($1::uuid[])`,
        [orderIds]
      );
      itemsResult.rows.forEach(it => {
        if (!itemsMap[it.order_id]) itemsMap[it.order_id] = [];
        itemsMap[it.order_id].push({
          id: it.id,
          orderId: it.order_id,
          serviceId: it.service_id,
          productId: it.product_id,
          description: it.description,
          quantity: Number(it.quantity || 1),
          unit: it.unit,
          publicUnit: it.public_unit,
          unitPrice: Number(it.unit_price || 0),
          discountPercent: Number(it.discount_percent || 0),
          totalPrice: Number(it.total_price || 0),
          notes: it.notes
        });
      });
    }

    const formattedOrders = orders.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      branchId: d.branch_id,
      orderNumber: d.order_number,
      orderSource: d.order_source || 'INTERNAL',
      customerType: d.customer_type || 'REGISTERED',
      personId: d.person_id,
      personName: d.person_name,
      personPhone: d.person_phone,
      personEmail: d.person_email,
      clientCity: d.client_city,
      deliveryAddress: d.delivery_address,
      status: d.status || 'PENDING',
      priority: d.priority || 'NORMAL',
      subtotal: Number(d.subtotal || 0),
      discountAmount: Number(d.discount_amount || 0),
      taxAmount: Number(d.tax_amount || 0),
      totalAmount: Number(d.total_amount || 0),
      paidAmount: Number(d.paid_amount || 0),
      dueAmount: Number(d.due_amount || 0),
      dueDate: d.due_date,
      instructions: d.instructions,
      items: itemsMap[d.id] || [],
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    return res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error('[Get Orders Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/orders
 * Crée ou met à jour une commande et ses éléments
 */
router.post('/', async (req, res) => {
  try {
    const o = req.body;
    if (!o.tenantId || !o.personName) {
      return res.status(400).json({ success: false, message: 'tenantId et personName requis.' });
    }

    const id = o.id || `ord-${Date.now()}`;
    const orderNumber = o.orderNumber || `CMD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const sqlOrder = `
      INSERT INTO orders (
        id, tenant_id, branch_id, order_number, order_source, customer_type,
        person_id, person_name, person_phone, person_email, client_city, delivery_address,
        status, priority, subtotal, discount_amount, tax_amount, total_amount,
        paid_amount, due_amount, due_date, instructions, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        subtotal = EXCLUDED.subtotal,
        discount_amount = EXCLUDED.discount_amount,
        tax_amount = EXCLUDED.tax_amount,
        total_amount = EXCLUDED.total_amount,
        paid_amount = EXCLUDED.paid_amount,
        due_amount = EXCLUDED.due_amount,
        instructions = EXCLUDED.instructions,
        updated_at = NOW()
      RETURNING *;
    `;

    const orderParams = [
      id,
      o.tenantId,
      o.branchId || null,
      orderNumber,
      o.orderSource || 'INTERNAL',
      o.customerType || 'REGISTERED',
      o.personId || null,
      o.personName,
      o.personPhone || null,
      o.personEmail || null,
      o.clientCity || null,
      o.deliveryAddress || null,
      o.status || 'PENDING',
      o.priority || 'NORMAL',
      o.subtotal || 0,
      o.discountAmount || 0,
      o.taxAmount || 0,
      o.totalAmount || 0,
      o.paidAmount || 0,
      o.dueAmount || 0,
      o.dueDate || null,
      o.instructions || null
    ];

    const orderResult = await query(sqlOrder, orderParams);
    const savedOrder = orderResult.rows[0];

    // Sauvegarde des items
    if (Array.isArray(o.items) && o.items.length > 0) {
      await query('DELETE FROM order_items WHERE order_id = $1', [id]);
      for (const it of o.items) {
        const itemId = it.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        await query(
          `INSERT INTO order_items (
            id, order_id, service_id, product_id, description, quantity, unit,
            public_unit, unit_price, discount_percent, total_price, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            itemId,
            id,
            it.serviceId || null,
            it.productId || null,
            it.description || '',
            it.quantity || 1,
            it.unit || null,
            it.publicUnit || null,
            it.unitPrice || 0,
            it.discountPercent || 0,
            it.totalPrice || 0,
            it.notes || null
          ]
        );
      }
    }

    return res.json({ success: true, order: savedOrder });
  } catch (error) {
    console.error('[Save Order Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
