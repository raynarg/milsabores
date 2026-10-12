const db = require('../../../shared/database/pool');

class ProductRepository {
  /**
   * Obtiene lista paginada de productos con filtros de búsqueda y categoría
   */
  async findPaginated({ page = 1, limit = 15, search = '', category = 'todos', showInactive = false }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (!showInactive) {
      conditions.push(`p.is_active = TRUE`);
    }

    if (search && search.trim() !== '') {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.code ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (category && category.toLowerCase() !== 'todos') {
      conditions.push(`LOWER(c.name) = LOWER($${paramIndex})`);
      params.push(category.trim());
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Consulta total para calcular metadata de paginación
    const countSql = `
      SELECT COUNT(*) AS total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Consulta de registros ordenados
    const dataSql = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.wholesale_price,
        p.retail_price,
        c.name AS category,
        p.unit,
        p.image_url,
        p.tag,
        p.is_active,
        p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await db.query(dataSql, dataParams);

    return {
      items: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Busca o crea una categoría por nombre dentro de una transacción o query
   */
  async findOrCreateCategory(client, categoryName) {
    if (!categoryName || categoryName.trim() === '') return null;
    const trimmed = categoryName.trim();

    const existing = await client.query(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER($1)`,
      [trimmed]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const inserted = await client.query(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
      [trimmed]
    );
    return inserted.rows[0].id;
  }

  /**
   * Obtiene todos los nombres de categorías disponibles con productos activos
   */
  async getCategories() {
    const sql = `
      SELECT DISTINCT c.name
      FROM categories c
      INNER JOIN products p ON p.category_id = c.id
      WHERE p.is_active = TRUE
      ORDER BY c.name ASC
    `;
    const res = await db.query(sql);
    return res.rows.map(r => r.name);
  }

  /**
   * Guarda un registro en el historial de sincronizaciones
   */
  async recordSyncLog({ source = 'google_drive', status = 'success', totalRows = 0, inserted = 0, updated = 0, deactivated = 0, skippedErrors = 0, message = '' }) {
    const sql = `
      INSERT INTO catalog_sync_logs (
        source, status, total_rows, inserted, updated, deactivated, skipped_errors, message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const res = await db.query(sql, [
      source,
      status,
      totalRows,
      inserted,
      updated,
      deactivated,
      skippedErrors,
      message
    ]);
    return res.rows[0];
  }

  /**
   * Obtiene el último registro de sincronización
   */
  async getLatestSyncLog() {
    const sql = `
      SELECT *
      FROM catalog_sync_logs
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await db.query(sql);
    return res.rows[0] || null;
  }

  /**
   * Obtiene los últimos N registros de sincronización
   */
  async getSyncLogs(limit = 10) {
    const sql = `
      SELECT *
      FROM catalog_sync_logs
      ORDER BY created_at DESC
      LIMIT $1;
    `;
    const res = await db.query(sql, [limit]);
    return res.rows;
  }

  /**
   * Obtiene estadísticas globales del catálogo (activos, inactivos, categorías)
   */
  async getCatalogStats() {
    const sql = `
      SELECT 
        COUNT(*) FILTER (WHERE is_active = TRUE) AS active_products,
        COUNT(*) FILTER (WHERE is_active = FALSE) AS inactive_products,
        (SELECT COUNT(*) FROM categories) AS total_categories
      FROM products;
    `;
    const res = await db.query(sql);
    return {
      activeProducts: parseInt(res.rows[0].active_products, 10) || 0,
      inactiveProducts: parseInt(res.rows[0].inactive_products, 10) || 0,
      totalCategories: parseInt(res.rows[0].total_categories, 10) || 0
    };
  }
}

module.exports = new ProductRepository();
