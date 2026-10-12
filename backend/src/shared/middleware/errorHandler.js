function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
