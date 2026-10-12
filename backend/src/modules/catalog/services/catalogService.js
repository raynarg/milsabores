const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const csv = require('csv-parser');
const db = require('../../../shared/database/pool');
const config = require('../../../shared/config');
const productRepository = require('../repositories/productRepository');
const { mapRowKeys, parsePrice } = require('./csvParserUtil');

class CatalogService {
  constructor() {
    this.lastContentHash = null;
    this.periodicIntervalId = null;
  }

  /**
   * Obtiene catálogo paginado
   */
  async getCatalog(filters) {
    return await productRepository.findPaginated(filters);
  }

  /**
   * Obtiene lista de categorías activas
   */
  async getCategories() {
    return await productRepository.getCategories();
  }

  /**
   * Ingesta y sincronización transaccional de productos desde un CSV
   * Reglas de negocio:
   * 1. Soporta delimitadores automáticos (, ; \t |).
   * 2. Upsert por 'code' (código único de producto).
   * 3. Conserva y oculta (is_active = FALSE) los productos que no figuran en este CSV.
   * 4. Registra auditoría en catalog_sync_logs.
   */
  async importCsv(filePath, source = 'manual') {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo CSV no fue encontrado en: ${filePath}`);
    }

    // Detectar delimitador leyendo las primeras líneas
    const sampleBuffer = fs.readFileSync(filePath, { encoding: 'utf8' }).slice(0, 4096);
    const firstLine = sampleBuffer.split(/\r\n|\n|\r/)[0] || '';
    let separator = ',';
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    const pipes = (firstLine.match(/\|/g) || []).length;

    if (semicolons > commas && semicolons > tabs) separator = ';';
    else if (tabs > commas) separator = '\t';
    else if (pipes > commas) separator = '|';

    const parsedRows = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ separator }))
        .on('data', (data) => parsedRows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (parsedRows.length === 0) {
      return {
        success: true,
        message: 'El archivo CSV está vacío.',
        summary: { totalRows: 0, processed: 0, inserted: 0, updated: 0, deactivated: 0 }
      };
    }

    const mapping = mapRowKeys(parsedRows[0]);
    if (!mapping.code || !mapping.name) {
      throw new Error(
        `El archivo CSV no contiene las columnas mínimas requeridas. Columnas detectadas: ${Object.keys(parsedRows[0]).join(', ')}. Se requiere al menos 'codigo' y 'nombre'.`
      );
    }

    // Iniciar transacción de sincronización atómica
    const client = await db.getClient();
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const activeCodesInCsv = new Set();

    try {
      await client.query('BEGIN');

      for (const row of parsedRows) {
        const rawCode = mapping.code ? row[mapping.code] : null;
        const rawName = mapping.name ? row[mapping.name] : null;

        if (!rawCode || !rawName || rawCode.trim() === '' || rawName.trim() === '') {
          errors++;
          continue;
        }

        const code = rawCode.trim();
        const name = rawName.trim();
        const wholesalePrice = mapping.wholesale_price ? parsePrice(row[mapping.wholesale_price]) : 0.0;
        const retailPrice = mapping.retail_price ? parsePrice(row[mapping.retail_price]) : wholesalePrice;
        const categoryName = mapping.category && row[mapping.category] ? row[mapping.category].trim() : 'General';
        const unit = mapping.unit && row[mapping.unit] ? row[mapping.unit].trim() : 'Unidad';
        const imageUrl = mapping.image_url && row[mapping.image_url] ? row[mapping.image_url].trim() : null;
        const tag = mapping.tag && row[mapping.tag] ? row[mapping.tag].trim() : null;

        activeCodesInCsv.add(code);

        // Resolver o registrar categoría
        const categoryId = await productRepository.findOrCreateCategory(client, categoryName);

        // Upsert de producto
        const upsertSql = `
          INSERT INTO products (
            code, name, category_id, wholesale_price, retail_price, unit, image_url, tag, is_active, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, CURRENT_TIMESTAMP)
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            category_id = COALESCE(EXCLUDED.category_id, products.category_id),
            wholesale_price = EXCLUDED.wholesale_price,
            retail_price = EXCLUDED.retail_price,
            unit = COALESCE(EXCLUDED.unit, products.unit),
            image_url = COALESCE(EXCLUDED.image_url, products.image_url),
            tag = COALESCE(EXCLUDED.tag, products.tag),
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS is_inserted;
        `;

        const res = await client.query(upsertSql, [
          code,
          name,
          categoryId,
          wholesalePrice,
          retailPrice,
          unit,
          imageUrl,
          tag
        ]);

        if (res.rows[0].is_inserted) {
          inserted++;
        } else {
          updated++;
        }
      }

      // Regla clave: Desactivar productos que ya no figuran en este CSV
      let deactivated = 0;
      if (activeCodesInCsv.size > 0) {
        const codeArray = Array.from(activeCodesInCsv);
        const deactivateSql = `
          UPDATE products
          SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE code <> ALL($1::varchar[]) AND is_active = TRUE
          RETURNING id;
        `;
        const deactRes = await client.query(deactivateSql, [codeArray]);
        deactivated = deactRes.rowCount;
      }

      await client.query('COMMIT');

      const result = {
        success: true,
        message: 'Catálogo sincronizado exitosamente desde el archivo CSV.',
        summary: {
          totalRows: parsedRows.length,
          processed: activeCodesInCsv.size,
          inserted,
          updated,
          deactivated,
          skippedErrors: errors
        }
      };

      // Registrar auditoría de sincronización
      await productRepository.recordSyncLog({
        source,
        status: 'success',
        totalRows: parsedRows.length,
        inserted,
        updated,
        deactivated,
        skippedErrors: errors,
        message: result.message
      }).catch(err => console.error('[CatalogService] Error al guardar sync log:', err.message));

      return result;
    } catch (err) {
      await client.query('ROLLBACK');

      await productRepository.recordSyncLog({
        source,
        status: 'error',
        totalRows: 0,
        inserted: 0,
        updated: 0,
        deactivated: 0,
        skippedErrors: 0,
        message: err.message
      }).catch(() => {});

      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Resuelve el enlace de descarga directa de CSV para Google Drive o Google Sheets
   */
  resolveDriveDownloadUrl(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    // Si ya es un URL completo de exportación CSV
    if (trimmed.includes('export?format=csv') || trimmed.includes('export=download')) {
      return trimmed;
    }

    // Si es enlace compartido de Google Sheets
    const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetMatch) {
      return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`;
    }

    // Si es enlace compartido de archivo Google Drive
    const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (driveMatch) {
      return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}&confirm=t`;
    }

    // Si es el ID puro
    return `https://drive.google.com/uc?export=download&id=${trimmed}&confirm=t`;
  }

  /**
   * Descarga y sincroniza catálogo desde Google Drive
   */
  async syncFromGoogleDrive(driveIdOrUrl = null, force = false) {
    const targetInput = driveIdOrUrl || config.googleDriveCsvId;
    if (!targetInput) {
      throw new Error('No se ha configurado GOOGLE_DRIVE_CSV_ID ni se proporcionó un ID o enlace.');
    }

    let downloadUrl = this.resolveDriveDownloadUrl(targetInput);
    const separator = downloadUrl.includes('?') ? '&' : '?';
    downloadUrl += `${separator}_t=${Date.now()}`;

    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'MilSabores-CatalogSync/1.0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Error al descargar desde Google Drive (HTTP ${response.status}: ${response.statusText}). Verifica permisos del enlace público.`);
    }

    const csvContent = await response.text();

    // Validar que no sea una página HTML de login o error de Google
    if (csvContent.includes('<!DOCTYPE html>') || csvContent.includes('<html')) {
      throw new Error('El archivo obtenido de Google Drive no es un CSV válido (Google retornó una página HTML, asegúrate de que el archivo esté configurado como público: "Cualquier persona con el enlace puede ver").');
    }

    // Detección de cambios por hash SHA-256
    const currentHash = crypto.createHash('sha256').update(csvContent).digest('hex');
    if (!force && this.lastContentHash === currentHash) {
      return {
        success: true,
        unchanged: true,
        message: 'El archivo de Google Drive no presenta cambios desde la última sincronización.',
        summary: { totalRows: 0, inserted: 0, updated: 0, deactivated: 0 }
      };
    }

    // Guardar temporalmente para procesar con streams
    const tempFilePath = path.join(os.tmpdir(), `milsabores_drive_${Date.now()}.csv`);
    fs.writeFileSync(tempFilePath, csvContent, 'utf8');

    try {
      const result = await this.importCsv(tempFilePath, 'google_drive');
      this.lastContentHash = currentHash;
      return result;
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  /**
   * Obtiene estado integral de sincronización para el panel de administración
   */
  async getSyncStatus() {
    const latestLog = await productRepository.getLatestSyncLog();
    const recentLogs = await productRepository.getSyncLogs(10);
    const stats = await productRepository.getCatalogStats();

    return {
      googleDriveConfigured: Boolean(config.googleDriveCsvId && config.googleDriveCsvId.trim() !== ''),
      googleDriveCsvId: config.googleDriveCsvId ? config.googleDriveCsvId.slice(0, 8) + '...' : null,
      syncIntervalMinutes: config.syncIntervalMinutes,
      stats,
      latestLog,
      recentLogs
    };
  }

  /**
   * Inicia sincronización periódica en segundo plano
   */
  startPeriodicSync() {
    if (!config.googleDriveCsvId || config.googleDriveCsvId.trim() === '') {
      console.log('[Catalog Sync] GOOGLE_DRIVE_CSV_ID no definido. Sincronización automática periódica en pausa.');
      return;
    }

    const intervalMs = Math.max(1, config.syncIntervalMinutes) * 60 * 1000;
    console.log(`[Catalog Sync] Sincronización automática de Google Drive activa cada ${config.syncIntervalMinutes} minutos.`);

    // Chequeo inicial suave tras 5 segundos de arrancar
    setTimeout(() => {
      this.syncFromGoogleDrive(null, false).catch(err => {
        console.warn(`[Catalog Sync] Chequeo inicial automático de Drive omitido: ${err.message}`);
      });
    }, 5000);

    this.periodicIntervalId = setInterval(() => {
      console.log('[Catalog Sync] Ejecutando chequeo periódico de cambios en Google Drive...');
      this.syncFromGoogleDrive(null, false)
        .then(res => {
          if (!res.unchanged) {
            console.log(`[Catalog Sync] Catálogo actualizado: ${JSON.stringify(res.summary)}`);
          }
        })
        .catch(err => {
          console.error(`[Catalog Sync] Error en sincronización periódica: ${err.message}`);
        });
    }, intervalMs);
  }
}

module.exports = new CatalogService();
