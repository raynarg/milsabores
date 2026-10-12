const catalogService = require('../services/catalogService');

class CatalogController {
  /**
   * GET /api/catalog/products
   * Endpoint paginado con filtros
   */
  async getProducts(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 15;
      const search = (req.query.search || '').trim();
      const category = (req.query.category || 'todos').trim();

      const result = await catalogService.getCatalog({ page, limit, search, category });
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
          hasPrevPage: result.page > 1
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/catalog/categories
   * Lista de categorías activas
   */
  async getCategories(req, res, next) {
    try {
      const categories = await catalogService.getCategories();
      return res.status(200).json({
        success: true,
        data: categories
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/catalog/import
   * Subida e importación de CSV
   */
  async importCsv(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Debe adjuntar un archivo CSV en el campo "file".'
        });
      }

      const result = await catalogService.importCsv(req.file.path, 'manual');
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/catalog/sync-drive
   * Dispara sincronización desde Google Drive bajo demanda
   */
  async syncGoogleDrive(req, res, next) {
    try {
      const driveIdOrUrl = req.body?.driveIdOrUrl || null;
      const force = Boolean(req.body?.force);

      const result = await catalogService.syncFromGoogleDrive(driveIdOrUrl, force);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/catalog/sync-status
   * Obtiene estado actual y métricas de sincronización
   */
  async getSyncStatus(req, res, next) {
    try {
      const status = await catalogService.getSyncStatus();
      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CatalogController();
