require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  googleDriveCsvId: process.env.GOOGLE_DRIVE_CSV_ID || '',
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 60,
  adminApiKey: process.env.ADMIN_API_KEY || '',
  db: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'milsabores',
    max: 20, // Pool size apto para escalar con múltiples workers o réplicas
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  }
};
