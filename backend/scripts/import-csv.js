const path = require('path');
const catalogService = require('../src/modules/catalog/services/catalogService');
const db = require('../src/shared/database/pool');

async function runCliImport() {
  const arg = process.argv[2];

  try {
    if (arg === '--drive' || arg === '-d') {
      const driveParam = process.argv[3] || null;
      console.log(`[CSV CLI Import] Sincronizando desde Google Drive${driveParam ? ` (${driveParam})` : ''}...`);
      const result = await catalogService.syncFromGoogleDrive(driveParam, true);
      console.log('[CSV CLI Import] ¡Sincronización con Google Drive completada!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      const targetFile = arg || path.join(__dirname, '../data/sample_catalogo.csv');
      console.log(`[CSV CLI Import] Leyendo e importando archivo local: ${targetFile}`);
      const result = await catalogService.importCsv(targetFile, 'cli');
      console.log('[CSV CLI Import] ¡Proceso completado con éxito!');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('[CSV CLI Import] Error durante la importación:', error.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

runCliImport();
