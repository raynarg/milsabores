const fs = require('fs');
const path = require('path');
const db = require('../src/shared/database/pool');

async function runMigration() {
  console.log('[Migración] Iniciando aplicación de esquema en PostgreSQL...');
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../src/shared/database/schema.sql'), 'utf-8');
    await db.query(schemaSql);
    console.log('[Migración] ¡Esquema de tablas e índices aplicado exitosamente!');
  } catch (error) {
    console.error('[Migración] Error al aplicar esquema:', error);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

runMigration();
