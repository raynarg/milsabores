# Mil Sabores — Distribuidora Mayorista y Minorista

Sistema integral monolítico modular para la gestión y catálogo de insumos de gastronomía, panadería y pastelería.

---

## 🛠️ Stack Tecnológico
- **Backend:** Node.js + Express (arquitectura monolito modular stateless, preparada para escalar horizontalmente).
- **Base de Datos:** PostgreSQL (esquema mínimo optimizado con índices y auditoría de sincronizaciones).
- **Frontend:** HTML5 + Tailwind CSS + JavaScript modular (catálogo paginado, generador de PDF con jsPDF, vista dinámica tarjetas/tabla).

---

## 🚀 Puesta en Marcha Local

### 1. Variables de Entorno
Crea o revisa tu archivo `.env` en la raíz del proyecto (basado en `.env.example`):
```env
PORT=3000
NODE_ENV=development

# Conexión PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=milsabores

CORS_ORIGIN=*

# Sincronización con Google Drive (enlace público o ID del archivo/hoja)
GOOGLE_DRIVE_CSV_ID=
SYNC_INTERVAL_MINUTES=60
```

### 2. Base de Datos
Aplica las migraciones iniciales para crear las tablas (`categories`, `products`, `catalog_sync_logs` e índices):
```bash
npm run db:migrate
```

Cargar datos de prueba iniciales (opcional):
```bash
npm run db:seed
```

### 3. Iniciar el Servidor
```bash
npm run dev
```

Una vez levantado:
- 🌐 **Web Pública / Landing Page:** [http://localhost:3000](http://localhost:3000)
- 🔒 **Panel de Administración Oculto:** [http://localhost:3000/admin](http://localhost:3000/admin)
- 🩺 **Healthcheck:** [http://localhost:3000/health](http://localhost:3000/health)

---

## 📦 Sincronización de Catálogo con Google Drive y CSV

El sistema sincroniza automáticamente los productos a partir de un archivo CSV en Google Drive y soporta tres métodos:

1. **Sincronización Periódica Automática:**
   Si configuras `GOOGLE_DRIVE_CSV_ID`, el backend verifica periódicamente (cada `SYNC_INTERVAL_MINUTES`, por defecto 60 min) si el archivo cambió en Google Drive y actualiza la base de datos automáticamente sin reiniciar el servidor.

2. **Panel de Administración (`/admin`):**
   - Sincronización bajo demanda desde Google Drive con un clic.
   - Carga manual de archivos `.csv` mediante drag & drop o selector de archivos.
   - Auditoría de sincronizaciones en tiempo real: filas procesadas, productos nuevos insertados, actualizados y ocultados.

3. **Comandos por Consola (CLI):**
   ```bash
   # Sincronizar desde Google Drive
   npm run csv:import:drive

   # O importar un archivo CSV local específico
   npm run csv:import -- ruta/al/archivo.csv
   ```

### Reglas de Negocio en la Importación
- **Identificador único:** Código de producto (`code`). Si existe, actualiza precios, unidad y nombre; si es nuevo, lo inserta.
- **Baja lógica:** Los productos que dejan de figurar en el CSV pasan a `is_active = FALSE` (ocultos del catálogo público pero preservados en PostgreSQL).
- **Delimitadores soportados:** Coma (`,`), punto y coma (`;`), tabulador (`\t`) y barra vertical (`|`).