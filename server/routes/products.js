import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/products
 * Récupère les articles de stock d'un tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || (req.user ? req.user.tenantId : null);
    let sql = 'SELECT * FROM products WHERE deleted_at IS NULL';
    const params = [];

    if (tenantId && tenantId !== 'ALL') {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);

    const products = result.rows.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      categoryId: d.category_id,
      code: d.code,
      barcode: d.barcode,
      name: d.name,
      category: d.category || 'Général',
      description: d.description,
      unit: d.unit || 'unité',
      purchaseUnit: d.purchase_unit,
      stockUnit: d.stock_unit,
      conversionFactor: Number(d.conversion_factor || 1),
      costPrice: Number(d.cost_price || 0),
      salePrice: d.sale_price !== null ? Number(d.sale_price) : undefined,
      initialStock: Number(d.initial_stock || 0),
      currentStock: Number(d.current_stock || 0),
      minStockAlert: Number(d.min_stock_alert || 5),
      maxStock: d.max_stock !== null ? Number(d.max_stock) : undefined,
      location: d.location,
      publicUnit: d.public_unit,
      publicPrice: d.public_price !== null ? Number(d.public_price) : undefined,
      images: d.images || [],
      videoUrl: d.video_url,
      isMarketplacePublished: d.is_marketplace_published ?? false,
      publicationStatus: d.publication_status || 'DRAFT',
      isActive: d.is_active ?? true,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    return res.json({ success: true, data: products });
  } catch (error) {
    console.error('[Get Products Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/products
 * Crée ou met à jour un produit
 */
router.post('/', async (req, res) => {
  try {
    const p = req.body;
    if (!p.tenantId || !p.name || !p.code) {
      return res.status(400).json({ success: false, message: 'tenantId, nom et code requis.' });
    }

    const id = p.id || `prd-${Date.now()}`;

    const sql = `
      INSERT INTO products (
        id, tenant_id, code, barcode, name, category, description,
        unit, purchase_unit, stock_unit, conversion_factor, cost_price, sale_price,
        initial_stock, current_stock, min_stock_alert, location, public_unit, public_price,
        images, video_url, is_marketplace_published, publication_status, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW())
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        barcode = EXCLUDED.barcode,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        unit = EXCLUDED.unit,
        purchase_unit = EXCLUDED.purchase_unit,
        stock_unit = EXCLUDED.stock_unit,
        conversion_factor = EXCLUDED.conversion_factor,
        cost_price = EXCLUDED.cost_price,
        sale_price = EXCLUDED.sale_price,
        current_stock = EXCLUDED.current_stock,
        min_stock_alert = EXCLUDED.min_stock_alert,
        location = EXCLUDED.location,
        public_unit = EXCLUDED.public_unit,
        public_price = EXCLUDED.public_price,
        images = EXCLUDED.images,
        video_url = EXCLUDED.video_url,
        is_marketplace_published = EXCLUDED.is_marketplace_published,
        publication_status = EXCLUDED.publication_status,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      id,
      p.tenantId,
      p.code,
      p.barcode || null,
      p.name,
      p.category || 'Général',
      p.description || null,
      p.unit || 'unité',
      p.purchaseUnit || null,
      p.stockUnit || null,
      p.conversionFactor || 1,
      p.costPrice || 0,
      p.salePrice || null,
      p.initialStock || 0,
      p.currentStock || 0,
      p.minStockAlert || 5,
      p.location || null,
      p.publicUnit || null,
      p.publicPrice || null,
      JSON.stringify(p.images || []),
      p.videoUrl || null,
      p.isMarketplacePublished ?? false,
      p.publicationStatus || 'DRAFT',
      p.isActive ?? true
    ];

    const result = await query(sql, params);
    return res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error('[Save Product Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
