const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const catalogController = require('../controllers/catalogController');

const router = express.Router();

// Configuración de almacenamiento temporal para subida de CSV
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024 }, // hasta 25MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || file.mimetype.includes('csv') || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos con extensión .csv'));
    }
  }
});

router.get('/products', (req, res, next) => catalogController.getProducts(req, res, next));
router.get('/categories', (req, res, next) => catalogController.getCategories(req, res, next));
router.post('/import', upload.single('file'), (req, res, next) => catalogController.importCsv(req, res, next));
router.post('/sync-drive', (req, res, next) => catalogController.syncGoogleDrive(req, res, next));
router.get('/sync-status', (req, res, next) => catalogController.getSyncStatus(req, res, next));

module.exports = router;
