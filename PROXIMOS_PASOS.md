# 📋 Hoja de Ruta y Próximos Pasos — Mil Sabores

Este documento reúne las definiciones técnicas, prioridades de arquitectura y tareas pendientes para continuar en la próxima sesión.

---

## 🚀 1. Despliegue en Producción (Deploy)

Actualmente el prototipo se comparte mediante túnel local (**ngrok**). Para un entorno de producción o testing permanente para el cliente, se requiere:

- [ ] **Base de Datos PostgreSQL Cloud**:
  - Configurar instancia gestionada y gratuita en **Render.com**, **Neon.tech** o **Supabase**.
  - Ejecutar scripts de inicialización de esquema (`CREATE TABLE categories`, `products`, `sync_logs`).
  - Cargar variables de entorno de conexión segura (`DATABASE_URL`, SSL activado).
- [ ] **Despliegue de Backend (Node.js/Express)**:
  - Crear Web Service en **Render.com** (o Railway) enlazado a la rama `main` del repositorio de GitHub.
  - Configurar variables de entorno en la plataforma:
    - `PORT=3000`
    - `NODE_ENV=production`
    - `DATABASE_URL` (conexión a Postgres)
    - `GOOGLE_DRIVE_CSV_ID` (enlace al Google Sheets maestro)
    - `SYNC_INTERVAL_MINUTES=60`
- [ ] **Dominio y Certificados HTTPS**:
  - Validar subdominio provisto (ej. `milsabores.onrender.com`) o configurar dominio propio personalizado con DNS en Cloudflare/proveedor.

---

## 🖼️ 2. Estrategia y Rendimiento de Imágenes de Productos

### ⚠️ El Problema Actual:
- Si almacenamos cientos de imágenes de alta resolución directamente en `frontend/public/images/`:
  - El bundle o repositorio crece desmedidamente.
  - El navegador intentará descargar imágenes pesadas simultáneamente, destruyendo el First Contentful Paint (FCP) y el ancho de banda en dispositivos móviles.
  - La sincronización desde Google Sheets se volvería rígida si dependiera de archivos locales fijos.

### 💡 Solución Arquitectónica Recomendada:

1. **Almacenamiento y CDN Externo (Storage en la Nube)**:
   - **Opción A (Recomendada - Cloudinary / Supabase Storage / Cloudflare R2 / AWS S3)**:
     - Subir las fotos de productos a un bucket o CDN dedicado.
     - **Columna en Google Sheets:** Agregar o mantener la columna `image_url` en la planilla de cálculo. Al sincronizar el catálogo desde el panel, el sistema asocia automáticamente la URL de la imagen en la base de datos sin tocar el código.
   - **Opción B (Google Drive como CDN de imágenes con direct link)**:
     - Guardar las imágenes en una carpeta pública de Google Drive y usar la URL de visualización directa (`https://lh3.googleusercontent.com/d/[ID]`).

2. **Optimización de Rendimiento en el Frontend**:
   - **Lazy Loading Nativo:** Asegurar que cada `<img>` en la tarjeta de producto use `loading="lazy"` y `decoding="async"`.
   - **Paginación & Virtualización:** El catálogo ya cuenta con paginación (`limit=15` o `12`), lo que previene que se carguen más de 12–15 imágenes por pantalla.
   - **Formatos Modernos:** Servir imágenes en **WebP** o **AVIF** con compresión (máximo 80–120 KB por imagen de producto en resolución 600x600 px).
   - **Placeholder / Fallback SVG:** Si un producto no tiene imagen asignada en el Sheets o falla su carga, mostrar un fallback SVG elegante con la inicial o categoría (evita imágenes rotas).

---

## 🧹 3. Limpieza y Organización de la Carpeta de Imágenes (`frontend/public/images/`)

Revisar el directorio de assets para eliminar redundancias y organizar la estructura:

### Diagnóstico de Archivos en `frontend/public/images/`:
- **Imágenes en Uso Activo**:
  - `fondopresentacion.webp` (Hero / Portada editorial)
  - `logomilsaboresinfondo.svg` (Navbar, Header y Footer)
  - `imageninicial.png` (Slide 1 carrusel Manifiesto)
  - `logo-milsabores-recortado.png` (Slide 2 carrusel Manifiesto)
  - SVGs de categorías (`cheese-1-svgrepo-com.svg`, `cake-tall-svgrepo-com.svg`, `pizza-svgrepo-com.svg`, etc.)
  - Carpeta `infinite-marquee-logo/` (Logos de marcas del carrusel infinito)

- **Archivos a Depurar / Eliminar (Redundantes o Backups temporales)**:
  - `Screenshot from 2026-10-07 21-27-43.png`
  - `Screenshot from 2026-10-07 21-28-13.png`
  - `Screenshot from 2026-10-07 21-28-54.png`
  - `Screenshot from 2026-10-07 21-29-27.png`
  - `Screenshot from 2026-10-07 21-30-01.png`
  - `imageninicial.png.bak` y `logo-milsabores-recortado.png.bak`
  - `harina fondo.jpg` (Reemplazada por `fondopresentacion.webp`)
  - `imagenquienessomos.png` (Si ya no se utiliza en el carrusel)
  - `producto-aceites.png`, `producto-vacalin-repostero.png`, `producto-vacalin-torre.png` (Migrar a storage de productos o limpiar si eran solo demos locales)

- **Estructura de Carpetas Propuesta**:
  ```text
  frontend/public/images/
  ├── brand/              # Logos, favicon, marcas institucionales
  ├── hero/               # Portada y fondos de presentación
  ├── icons/              # SVGs de categorías y UI
  ├── partners/           # Logos del infinite marquee
  └── products/           # Solo fallbacks o demos mínimos locales
  ```

---

## 📌 4. Checklist para la Próxima Sesión

1. [ ] Realizar la limpieza física de capturas de pantalla y backups en `frontend/public/images/`.
2. [ ] Reorganizar la estructura de carpetas de assets y actualizar las referencias en `index.html`.
3. [ ] Definir el proveedor para el hosting de imágenes de productos (Cloudinary, Cloudflare R2 o Drive IDs).
4. [ ] Crear la cuenta de Render.com / Neon y realizar el primer deploy funcional en la nube con base de datos real.
5. [ ] Probar la sincronización automática de Google Sheets directamente en producción.
