// Configuración de columnas visibles en el catálogo
// Permite añadir, remover o reorganizar columnas fácilmente en futuras versiones.
export const CATALOG_COLUMNS = [
  { key: 'code', label: 'Código', align: 'left', primary: true },
  { key: 'name', label: 'Nombre / Insumo', align: 'left' },
  { key: 'category', label: 'Categoría', align: 'center', badge: true },
  { key: 'wholesale_price', label: 'Precio Mayorista', align: 'right', format: 'currency' },
  { key: 'retail_price', label: 'Precio Minorista', align: 'right', format: 'currency' }
];

export function formatCurrency(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
