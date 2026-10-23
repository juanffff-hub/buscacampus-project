# BuscaCampus — Avance 2

BuscaCampus permite consultar y gestionar reportes de objetos perdidos y encontrados en la Universidad Autónoma de Occidente. Esta guía explica cómo preparar el proyecto, iniciar la aplicación y usar sus funciones. No hace falta conocer el proyecto de antemano.

## Funcionalidades

- Registro con correo institucional `@uao.edu.co`, contraseña almacenada con `bcryptjs` y login mediante cookie HttpOnly.
- Restauración de sesión, logout, rutas públicas y dashboard protegido.
- Catálogos reales de categorías y ubicaciones, búsqueda y filtros de reportes.
- Ubicaciones UAO: Aula 1–4, Sotanos 1–2, Cafeteria Piso 1–3 y Biblioteca Piso 1–3.
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

Crea una base de datos llamada `buscacampus` desde pgAdmin o con `createdb -U postgres buscacampus`. Después, abre una terminal en la raíz del repositorio y ejecuta el esquema y los datos iniciales. Si tu usuario de PostgreSQL no es `postgres`, reemplázalo en los comandos:

```bash
psql -U postgres -h localhost -p 5432 -d buscacampus -f server/sql/schema.sql
psql -U postgres -h localhost -p 5432 -d buscacampus -f server/sql/seed.sql
```

Si ya tienes una base de Avance 1, conserva sus datos y aplica las dos migraciones en orden:

```bash
psql -U postgres -h localhost -p 5432 -d buscacampus -f server/sql/migrations/20261020_001_avance2_archivos_mime.sql
psql -U postgres -h localhost -p 5432 -d buscacampus -f server/sql/migrations/20261022_001_ubicaciones_uao.sql
```

La primera migración añade el tipo MIME y los índices de archivos. La segunda agrega las ubicaciones oficiales de la UAO y desactiva las anteriores sin borrar las que estén asociadas a reportes. Para una base nueva, `schema.sql` y `seed.sql` ya preparan el esquema y el catálogo actual. Las migraciones se pueden volver a ejecutar. Consulta el [diagrama del modelo relacional](docs/mer.md) para conocer las relaciones entre las tablas.

Si usas pgAdmin, abre `buscacampus`, selecciona **Tools → Query Tool**, carga cada archivo indicado y ejecútalo. Para actualizar una base existente, aplica las migraciones antes de iniciar el servidor.

### 2. Configurar variables de entorno

Copia los archivos de ejemplo para crear la configuración local:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

En Windows PowerShell, usa `Copy-Item server/.env.example server/.env` y `Copy-Item client/.env.example client/.env`.

Abre `server/.env` y ajusta `DATABASE_URL` para que coincida con tu usuario, contraseña, host, puerto y nombre de base de datos de PostgreSQL. Sustituye el valor de ejemplo de `JWT_SECRET` por una clave aleatoria. Puedes generarla con `openssl rand -base64 48` o con `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. En desarrollo local con HTTP, deja `COOKIE_SECURE=false`; actívalo solo cuando el servidor use HTTPS. En `client/.env`, conserva `VITE_API_URL=http://localhost:4000/api/v1` para esta configuración local.

| Variable del servidor | Propósito                     | Valor de desarrollo del ejemplo                           |
| --------------------- | ----------------------------- | --------------------------------------------------------- |
| `PORT`                | Puerto HTTP de Express        | `4000`                                                    |
| `DATABASE_URL`        | Cadena de conexión PostgreSQL | `postgres://postgres:postgres@localhost:5432/buscacampus` |
| `CLIENT_ORIGIN`       | Origen permitido por CORS     | `http://localhost:5173`                                   |
| `PGSSL`               | Activa TLS para PostgreSQL    | `false`                                                   |
| `JWT_SECRET`          | Clave de firma de sesión      | Reemplazar por un secreto propio                          |
| `JWT_EXPIRES_IN`      | Vigencia del JWT              | `8h`                                                      |
| `COOKIE_SECURE`       | Marca Secure de la cookie     | `false` en HTTP local                                     |

Los archivos `.env` contienen configuración local y no se suben a Git. No compartas la clave JWT ni uses el valor de ejemplo en un entorno compartido.

### 3. Instalar dependencias e iniciar los proyectos

Instala las dependencias desde la raíz del repositorio:

```bash
npm install --prefix server
npm install --prefix client
```

Abre dos terminales en la raíz del repositorio. En la primera, inicia la API:

```bash
npm run dev --prefix server
```

En la segunda, inicia el cliente:

```bash
npm run dev --prefix client
```

Abre la dirección que Vite muestra, normalmente `http://localhost:5173`. El puerto `4000` es la API; su ruta raíz no es una página web. Para comprobar el servidor y PostgreSQL, visita `http://localhost:4000/api/v1/health`; la respuesta debe indicar `success: true` y `data.database.connected: true`. El cliente y `CLIENT_ORIGIN` deben usar los orígenes indicados en los archivos `.env`.

### 4. Usar la aplicación

1. En la página principal, busca reportes por texto o filtra por categoría y ubicación. Selecciona **Todas las ubicaciones** o **Todas** para quitar esos filtros.
2. Para publicar un objeto, selecciona **Reportar un objeto** y crea una cuenta con correo `@uao.edu.co` y contraseña de al menos ocho caracteres. Luego inicia sesión.
3. En el panel **Mis reportes**, selecciona **Publicar reporte**. Completa los campos y adjunta una imagen JPEG, PNG o WebP de hasta 5 MB.
4. Usa **Editar** para corregir un reporte propio y **Eliminar** para borrarlo. La eliminación solicita confirmación.
5. Cierra sesión desde la navegación cuando termines.

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

Consulta la [guía paso a paso de la demo](docs/demo-avance2.md). Los videos están disponibles por capítulo en [`Demo Web Avance 2`](Demo%20Web%20Avance%202/):

- [Parte 1 — Registro, login y sesión restaurable](Demo%20Web%20Avance%202/Demo%20Parte%201.%20Registro,%20login%20y%20sesi%C3%B3n%20restaurable.mp4)
- [Parte 2 — Landing con datos reales y filtros](Demo%20Web%20Avance%202/Demo%20Parte%202.%20Landing%20con%20datos%20reales%20y%20filtros.mp4)
- [Parte 3 — Crear un reporte con imagen](Demo%20Web%20Avance%202/Demo%20Parte%203.%20Crear%20un%20reporte%20con%20imagen.mp4)
- [Parte 4 — Editar y eliminar](Demo%20Web%20Avance%202/Demo%20Parte%204.%20Editar%20y%20eliminar.mp4)
