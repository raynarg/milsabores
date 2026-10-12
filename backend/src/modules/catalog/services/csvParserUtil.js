/**
 * Normaliza nombres de encabezados eliminando tildes, signos y espacios
 * Ejemplo: "Precio Mayorista ($)" -> "preciomayorista"
 */
function normalizeHeader(header) {
  if (!header) return '';
  return header
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9]/g, ''); // solo alfanumérico
}

/**
 * Detecta qué columna corresponde a cada campo requerido
 */
function mapRowKeys(row) {
  const mapping = {
    code: null,
    name: null,
    wholesale_price: null,
    retail_price: null,
    category: null,
    unit: null,
    image_url: null,
    tag: null
  };

  for (const rawKey of Object.keys(row)) {
    const key = normalizeHeader(rawKey);

    if (['codigo', 'cod', 'code', 'idarticulo', 'sku'].includes(key)) {
      mapping.code = rawKey;
    } else if (['nombre', 'producto', 'articulo', 'descripcion', 'name'].includes(key)) {
      mapping.name = rawKey;
    } else if (['preciomayorista', 'mayorista', 'pmayorista', 'costomayorista'].includes(key)) {
      mapping.wholesale_price = rawKey;
    } else if (['preciominorista', 'minorista', 'pminorista', 'precio', 'publico'].includes(key)) {
      mapping.retail_price = rawKey;
    } else if (['categoria', 'rubro', 'category', 'seccion'].includes(key)) {
      mapping.category = rawKey;
    } else if (['unidad', 'presentacion', 'medida', 'envase'].includes(key)) {
      mapping.unit = rawKey;
    } else if (['imagen', 'image', 'urlimagen', 'fotourl'].includes(key)) {
      mapping.image_url = rawKey;
    } else if (['tag', 'etiqueta', 'destacado'].includes(key)) {
      mapping.tag = rawKey;
    }
  }

  return mapping;
}

/**
 * Parsea montos monetarios en formatos como "$ 18.500,50", "18500.50", "18,500.00"
 */
function parsePrice(value) {
  if (value === undefined || value === null) return 0.0;
  if (typeof value === 'number') return isNaN(value) ? 0.0 : value;

  let str = value.toString().trim();
  // Quitar símbolos de moneda y caracteres invisibles
  str = str.replace(/[$€s\s]/gi, '');

  if (!str) return 0.0;

  // Si contiene tanto punto como coma: "18.500,50" vs "18,500.50"
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Formato argentino/español: 18.500,50 -> 18500.50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 18,500.50 -> 18500.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Si solo hay coma: "18500,50" -> "18500.50"
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0.0 : Math.round(num * 100) / 100;
}

module.exports = {
  normalizeHeader,
  mapRowKeys,
  parsePrice
};
