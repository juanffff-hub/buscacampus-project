# BuscaCampus — Avance 2

Aplicación web para consultar objetos perdidos y encontrados en la Universidad Autónoma de Occidente. Este avance conecta React con una API Express respaldada por PostgreSQL e implementa registro, login con sesión restaurable, reportes CRUD e imágenes guardadas en disco con sus metadatos en la base de datos.

## Funcionalidades

- Registro con correo institucional `@uao.edu.co`, contraseña almacenada con `bcryptjs` y login mediante cookie HttpOnly.
- Restauración de sesión, logout, rutas públicas y dashboard protegido.
- Catálogos reales de categorías y ubicaciones, búsqueda y filtros de reportes.
- Dashboard para consultar, publicar, editar y eliminar reportes propios.
- Subida multipart de una imagen JPEG, PNG o WebP de hasta 5 MB por reporte.
- Persistencia dual: archivo físico en `server/uploads/` y metadatos relacionados en PostgreSQL.
- Estados de carga, error, reintento y contenido vacío en las vistas que consultan la API.

Las reclamaciones, la administración completa, el chat, las notificaciones y el almacenamiento cloud están fuera del alcance de este avance.

## Requisitos

- Node.js 20.19 o posterior y npm.
- PostgreSQL 14 o posterior.
- `psql` para aplicar los scripts por terminal, o pgAdmin 4 para ejecutarlos desde Query Tool.

El cliente y el servidor son proyectos npm independientes. `server/package.json` declara Node 18 o posterior; Vite requiere Node 20.19 o posterior para ejecutar el cliente.

## Puesta en marcha

### 1. Crear y preparar la base de datos

Crea una base de datos llamada `buscacampus` en PostgreSQL. Desde la raíz del repositorio, ejecuta el esquema y los datos iniciales:

```bash
psql "postgres://postgres:postgres@localhost:5432/buscacampus" -f server/sql/schema.sql
psql "postgres://postgres:postgres@localhost:5432/buscacampus" -f server/sql/seed.sql
```

Si ya tienes una base de Avance 1, conserva sus datos y aplica la migración incremental:

```bash
psql "postgres://postgres:postgres@localhost:5432/buscacampus" -f server/sql/migrations/20261020_001_avance2_archivos_mime.sql
```

La migración añade el MIME de los archivos y los índices por reporte y autor. Es idempotente. Para una base nueva, `schema.sql` ya crea esas columnas e índices. El diagrama del modelo relacional está en [`docs/mer.md`](docs/mer.md), con sus archivos fuente en `docs/`.

En pgAdmin, abre la base `buscacampus`, selecciona **Tools → Query Tool**, carga cada archivo indicado y ejecútalo. Para una base existente, ejecuta la migración antes de iniciar la API.

### 2. Configurar variables de entorno

Crea los archivos locales a partir de los ejemplos:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

En Windows PowerShell puedes usar `Copy-Item server/.env.example server/.env` y `Copy-Item client/.env.example client/.env`.

Configura `server/.env` con tu conexión PostgreSQL y reemplaza `JWT_SECRET` por un valor aleatorio secreto. Puedes generarlo con `openssl rand -base64 48`. Mantén `COOKIE_SECURE=false` en desarrollo local con HTTP; usa `true` cuando publiques el servidor detrás de HTTPS.

| Variable del servidor | Propósito                     | Valor de desarrollo del ejemplo                           |
| --------------------- | ----------------------------- | --------------------------------------------------------- |
| `PORT`                | Puerto HTTP de Express        | `4000`                                                    |
| `DATABASE_URL`        | Cadena de conexión PostgreSQL | `postgres://postgres:postgres@localhost:5432/buscacampus` |
| `CLIENT_ORIGIN`       | Origen permitido por CORS     | `http://localhost:5173`                                   |
| `PGSSL`               | Activa TLS para PostgreSQL    | `false`                                                   |
| `JWT_SECRET`          | Clave de firma de sesión      | Reemplazar por un secreto propio                          |
| `JWT_EXPIRES_IN`      | Vigencia del JWT              | `8h`                                                      |
| `COOKIE_SECURE`       | Marca Secure de la cookie     | `false` en HTTP local                                     |

Configura `client/.env` con la URL base de la API:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

Los archivos `.env` no se suben a Git. No uses el secreto de ejemplo en un entorno compartido.

### 3. Instalar dependencias e iniciar los proyectos

Desde la raíz del repositorio:

```bash
npm install --prefix server
npm install --prefix client
npm run dev --prefix server
npm run dev --prefix client
```

La API queda disponible en `http://localhost:4000`; Vite muestra la URL local del cliente, normalmente `http://localhost:5173`. El servidor limita CORS al origen de `CLIENT_ORIGIN` y acepta credenciales; el cliente envía sus peticiones con `credentials: "include"`. Mantén `CLIENT_ORIGIN` y `VITE_API_URL` alineados con los orígenes locales.

Comprueba la conexión de la API y PostgreSQL en `GET http://localhost:4000/api/v1/health`. La respuesta exitosa usa el contrato estándar y contiene `data.database.connected: true`.

## API REST

La especificación completa está en [`docs/openapi.yaml`](docs/openapi.yaml). Todas las rutas API usan el prefijo `/api/v1`. Las respuestas exitosas usan `{ "success": true, "data": ... }`; los errores usan `{ "success": false, "error": { "code", "message", "details" } }`.

| Método   | Ruta             | Acceso                | Descripción                                           |
| -------- | ---------------- | --------------------- | ----------------------------------------------------- |
| `GET`    | `/health`        | Público               | Estado de la API y conexión PostgreSQL                |
| `POST`   | `/auth/registro` | Público               | Crear cuenta institucional; responde `201`            |
| `POST`   | `/auth/login`    | Público               | Iniciar sesión y establecer cookie                    |
| `GET`    | `/auth/me`       | Sesión                | Restaurar la sesión actual                            |
| `POST`   | `/auth/logout`   | Público               | Eliminar la cookie; responde `204`                    |
| `GET`    | `/categorias`    | Público               | Listar categorías                                     |
| `GET`    | `/ubicaciones`   | Público               | Listar ubicaciones activas                            |
| `GET`    | `/reportes`      | Público*              | Listar, buscar y filtrar reportes                     |
| `GET`    | `/reportes/:id`  | Público               | Consultar un reporte                                  |
| `POST`   | `/reportes`      | Sesión                | Crear reporte multipart; responde `201`               |
| `PUT`    | `/reportes/:id`  | Autor o administrador | Actualizar campos y, opcionalmente, reemplazar imagen |
| `DELETE` | `/reportes/:id`  | Autor o administrador | Eliminar reporte y archivo; responde `204`            |

`GET /reportes` acepta `q`, `categoriaId`, `ubicacionId`, `tipoReporte`, `estado`, `mios`, `page` y `limit`. `mios=true` requiere sesión. La paginación usa por defecto `page=1` y `limit=20`, con máximo de 100 resultados por página. `tipoReporte` admite `Perdido` o `Encontrado`; `estado` admite `Publicado`, `En reclamación` o `Devuelto`.

El registro requiere `nombreCompleto` (3–160 caracteres), `correoElectronico` institucional y `contrasena` (al menos 8 caracteres). El correo se normaliza a minúsculas. El login establece la cookie `buscacampus_session` como HttpOnly y SameSite=Lax; Secure depende de `COOKIE_SECURE`. El JWT viaja únicamente en esa cookie: no se devuelve en el cuerpo ni se guarda en `localStorage` o `sessionStorage`.

Crear reporte requiere los campos `titulo`, `descripcion`, `categoriaId`, `ubicacionId`, `tipoReporte`, `fechaHoraEvento` y un archivo `archivo`. El archivo es obligatorio al crear y opcional al editar. Solo se aceptan JPEG, PNG y WebP de hasta 5 MB. El cliente envía FormData; no debe fijar manualmente el encabezado multipart `Content-Type`.

Los códigos de error relevantes son `400` validación, `401` sesión ausente o credenciales inválidas, `403` permiso insuficiente, `404` recurso inexistente, `409` correo duplicado o dependencia que impide borrar, `413` archivo demasiado grande y `500` error inesperado. Las respuestas no exponen hashes, tokens, secretos, rutas físicas ni trazas.

## Archivos y persistencia dual

Cada archivo se guarda en `server/uploads/` con un nombre generado por UUID. PostgreSQL conserva en `archivos_metadatos` el autor, reporte, nombre original, nombre físico, URL pública, MIME, extensión, peso y fecha de subida. La creación del reporte y sus metadatos se confirma en una transacción; si falla, el archivo cargado se elimina. Los archivos se sirven desde `/uploads/<nombre-uuid>` y no se guardan en Base64.

Al reemplazar una imagen o eliminar un reporte, la API sincroniza la metadata y el archivo físico. La carpeta y sus archivos están excluidos de Git, salvo `server/uploads/.gitkeep`.

## Pruebas y build

```bash
npm test --prefix server
npm test --prefix client -- --pool=threads --maxWorkers=1 --reporter=dot
npm run build --prefix client
```

El límite de workers del comando cliente hace la suite más estable en equipos Windows. `dist/` es un artefacto local y está excluido de Git.

## Demo

Sigue el guion reproducible de [`docs/demo-avance2.md`](docs/demo-avance2.md) para mostrar autenticación, restauración, protección de rutas, filtros, CRUD y persistencia del archivo y sus metadatos.
