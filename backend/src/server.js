const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./shared/config');
const errorHandler = require('./shared/middleware/errorHandler');

// Rutas de módulos
const catalogRoutes = require('./modules/catalog/routes/catalogRoutes');
const catalogService = require('./modules/catalog/services/catalogService');

// Inicialización de la aplicación Express
const app = express();

// Middlewares globales (Stateless para escalar horizontalmente)
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
const publicPath = path.join(__dirname, '../../frontend/public');
app.use(express.static(publicPath));

// Ruta administrativa oculta para el administrador
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// Healthcheck para balanceadores de carga (Load Balancer / Kubernetes / Docker Swarm)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Registro de rutas modulares (/api/catalog, en el futuro /api/orders, /api/clients, etc.)
app.use('/api/catalog', catalogRoutes);

// Manejador centralizado de errores
app.use(errorHandler);

// Servidor HTTP
const server = app.listen(config.port, () => {
  console.log(`[Mil Sabores Server] Escuchando en el puerto ${config.port} (${config.nodeEnv})`);
  console.log(`[Frontend] Disponible en http://localhost:${config.port}`);
  console.log(`[Panel Admin] Disponible en http://localhost:${config.port}/admin`);

  // Iniciar tarea en segundo plano de sincronización periódica con Google Drive
  catalogService.startPeriodicSync();
});

module.exports = { app, server };
