# BuscaCampus — Entrega Final (Avance 3)

BuscaCampus es una aplicación web para reportar objetos perdidos y encontrados en la Universidad Autónoma de Occidente. Permite publicar reportes con imágenes, presentar reclamaciones con evidencia privada, revisar solicitudes y consultar el historial después de volver a iniciar sesión.

La aplicación usa React y Vite, Express y PostgreSQL. Las sesiones se guardan en cookies HttpOnly; las imágenes y evidencias se guardan como archivos con metadatos en PostgreSQL.

## Funciones

- Registro e inicio de sesión con correo institucional @uao.edu.co, restauración de sesión y cierre de sesión.
- Landing pública, detalle de reportes y panel privado.
- Creación, edición y eliminación de reportes propios.
- Reclamaciones de objetos encontrados con mensaje y evidencia JPEG, PNG o WebP de hasta 5 MB.
- Evidencia privada visible para quien reclama, quien publicó el reporte y la administración.
- Aprobación y rechazo con actualización transaccional del estado y conservación del historial.
- Búsqueda, filtros, paginación y estados de carga, error, reintento y contenido vacío.
- Persistencia dual: archivos físicos más metadatos relacionados en PostgreSQL.

## Requisitos

Para el arranque recomendado:

- Docker Desktop o Docker Engine con Docker Compose v2.
- Un mínimo de 2 GB de memoria disponible para las imágenes.

Para ejecutar cada proyecto directamente en el equipo:

- Node.js 20.19 o posterior y npm.
- PostgreSQL 14 o posterior.

## Arranque local con Docker Compose

1. Copia la plantilla de variables y cambia las contraseñas locales:

   ~~~powershell
   Copy-Item deploy/.env.example deploy/.env
   ~~~

   Edita deploy/.env. Usa una contraseña local propia con letras, números, guion o guion bajo para que pueda formar la URL PostgreSQL; genera un JWT_SECRET aleatorio de al menos 32 bytes. La plantilla solo sirve para desarrollo local.

2. Desde la raíz del repositorio, construye e inicia la aplicación:

   ~~~powershell
   docker compose --env-file deploy/.env -f deploy/docker-compose.yml up --build -d
   ~~~

3. Abre http://localhost:8080. El estado de la API y de PostgreSQL está en http://localhost:8080/api/v1/health.

El contenedor API espera a PostgreSQL, aplica el esquema actual, las migraciones idempotentes y el seed, y luego inicia Express. El inicio no borra reportes ni usuarios. Compose mantiene PostgreSQL, imágenes de reportes y evidencias privadas en volúmenes independientes. La interfaz y la API comparten origen; Nginx envía las solicitudes de API y de imágenes al servidor.

Para revisar el estado o apagar servicios:

~~~powershell
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f api
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down
~~~

No añadas -v al comando down si quieres conservar la base y los archivos. La opción -v elimina los volúmenes persistentes.

### Usar la aplicación

1. Crea dos cuentas de prueba con correos @uao.edu.co distintos. Usa datos sintéticos, no información personal real.
2. Con la primera cuenta, abre Mis reportes y publica un objeto de tipo Encontrado con imagen.
3. Cierra sesión. Con la segunda cuenta, abre el detalle público del reporte y selecciona Reclamar este objeto.
4. Escribe un mensaje de prueba y adjunta una imagen de evidencia.
5. Vuelve a iniciar sesión con la primera cuenta. En Reclamaciones recibidas abre la solicitud, revisa su evidencia y apruébala o recházala.
6. Revisa el estado final del reporte y el historial en Mis reclamaciones.

## Ejecución directa sin Docker

1. Crea una base PostgreSQL vacía y copia los archivos de entorno:

   ~~~powershell
   Copy-Item server/.env.example server/.env
   Copy-Item client/.env.example client/.env
   ~~~

2. Edita server/.env. Ajusta DATABASE_URL, genera JWT_SECRET y deja COOKIE_SECURE=false para HTTP local. En client/.env conserva VITE_API_URL=http://localhost:4000/api/v1.
3. Instala dependencias e inicializa esquema, migraciones y datos de catálogo:

   ~~~powershell
   npm ci --prefix server
   npm ci --prefix client
   npm run db:init --prefix server
   ~~~

4. Inicia la API y el cliente en dos terminales distintas:

   ~~~powershell
   npm run dev --prefix server
   npm run dev --prefix client
   ~~~

Abre la dirección que informa Vite, normalmente http://localhost:5173. El puerto 4000 es la API; su ruta raíz no muestra una página web.

## Base existente de Avance 2

Haz primero un respaldo de PostgreSQL y de las carpetas de archivos. Detén la API durante la actualización. Configura server/.env para apuntar a la misma base de Avance 2 y ejecuta:

~~~powershell
npm run db:init --prefix server
~~~

El inicializador carga server/.env, aplica schema.sql, todas las migraciones SQL en orden y seed.sql. Las instrucciones usan CREATE ... IF NOT EXISTS, ALTER ... IF NOT EXISTS, índices repetibles y datos con ON CONFLICT. No eliminan registros existentes. Las migraciones amplían metadatos, catálogos de ubicación, evidencias e índices.

Si administras PostgreSQL desde pgAdmin, también puedes aplicar manualmente, en orden, los archivos de server/sql/migrations. No ejecutes pruebas de integración contra una base con datos reales: requieren una base aislada cuyo nombre termine en _test o -test.

El Compose local inicia una base nueva en un volumen propio. Para conservar datos de otra instalación en Compose, restaura primero el respaldo en la base vacía que usarás; luego inicia la API para que aplique los cambios idempotentes.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| DATABASE_URL | Conexión PostgreSQL del servidor. |
| JWT_SECRET | Secreto de firma; usa uno distinto por ambiente y no lo subas a Git. |
| JWT_EXPIRES_IN | Vigencia de la sesión; por ejemplo, 8h. |
| COOKIE_SECURE | true con HTTPS; false solo en HTTP local. |
| CLIENT_ORIGIN | Origen permitido para CORS. |
| PGSSL | Activa conexión TLS a PostgreSQL administrado. |
| BUSCACAMPUS_UPLOADS_DIR | Carpeta de imágenes públicas de reportes. |
| BUSCACAMPUS_PRIVATE_UPLOADS_DIR | Carpeta privada de evidencias de reclamaciones. |
| VITE_API_URL | URL base de la API para Vite; usa /api/v1 detrás del proxy del mismo origen. |

No guardes secretos en client/.env: las variables VITE_* se incluyen en el código que descarga el navegador. Los archivos server/.env, client/.env y deploy/.env son locales y están excluidos de Git.

## API y modelo de datos

La especificación de rutas, payloads, permisos, límites y códigos HTTP está en [OpenAPI](docs/openapi.yaml). El diagrama del modelo relacional está en [MER](docs/mer.md), y los cambios del Avance 3 están descritos en [trazabilidad técnica](docs/avance3-api-trazabilidad.md).

Rutas principales:

- Autenticación: /api/v1/auth/registro, /login, /me y /logout.
- Catálogos y reportes: /api/v1/categorias, /ubicaciones y /reportes.
- Reclamaciones: /api/v1/reportes/:id/reclamaciones, /api/v1/reclamaciones/mias, /recibidas, /:id, /:id/estado y /:id/evidencia.

La evidencia de reclamación no se sirve desde /uploads. El endpoint de evidencia requiere sesión y permiso; las imágenes normales de reportes se sirven desde /uploads.

## Pruebas y build

~~~powershell
npm.cmd test --prefix server
npm.cmd test --prefix client -- --pool=threads --maxWorkers=1 --reporter=dot
npm.cmd run build --prefix client
~~~

La suite del servidor ejecuta las pruebas de PostgreSQL si se define AVANCE3_TEST_DATABASE_URL con una base de pruebas aislada terminada en _test o -test. El flujo E2E requiere Chromium y esa misma clase de base:

~~~powershell
$env:AVANCE3_TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/buscacampus_test"
npm.cmd run test:e2e --prefix client
Remove-Item Env:AVANCE3_TEST_DATABASE_URL
~~~

Playwright comprueba el recorrido con dos usuarios. Su proceso de inicio aplica esquema, migraciones y seed a esa base de prueba y guarda archivos en carpetas temporales que elimina al terminar. No apuntes AVANCE3_TEST_DATABASE_URL a una base de desarrollo o producción.

GitHub Actions ejecuta pruebas del servidor con PostgreSQL, pruebas del cliente, build, E2E con Chromium, validación de Compose y construcción de imágenes en cada push de rama Avance 3 y pull request a main.

## Archivos y persistencia dual

- Imágenes públicas de reportes: server/uploads en ejecución directa; volumen report-uploads en Compose.
- Evidencia privada de reclamaciones: server/private_uploads en ejecución directa; volumen claim-evidence en Compose.
- Metadatos en PostgreSQL: archivos_metadatos y reclamaciones_archivos_metadatos.

El servidor genera nombres UUID, verifica MIME y firma del contenido, limita el tamaño a 5 MB y limpia archivos provisionales si falla la transacción. La API no devuelve rutas físicas. Para revisar discrepancias en modo de solo lectura:

~~~powershell
npm run diagnose:files --prefix server
~~~

## Publicación HTTPS

Hay una configuración base con Caddy en deploy/docker-compose.production.yml. Caddy obtiene certificados TLS cuando PUBLIC_DOMAIN apunta a la máquina y los puertos 80 y 443 son accesibles. La API exige una base PostgreSQL externa. Las imágenes y evidencias usan rutas persistentes del host.

1. Copia deploy/.env.production.example a deploy/.env.production y reemplaza el dominio, origen HTTPS, URL PostgreSQL, JWT_SECRET y rutas persistentes.
2. Asegura que las carpetas persistentes existan y que el usuario de contenedor con UID 1000 pueda escribir en ellas.
3. Configura DNS hacia el host y permite entrada a 80/443.
4. Inicia la publicación:

   ~~~bash
   docker compose --env-file deploy/.env.production -f deploy/docker-compose.production.yml up --build -d
   ~~~

5. Comprueba /api/v1/health y recorre el registro, publicación, reclamación, decisión, evidencia e historial desde el dominio HTTPS.

La plantilla no es una URL activa. La publicación requiere un host autorizado, un nombre DNS y acceso a PostgreSQL persistente. No marques la entrega como publicada hasta probar el flujo completo desde el dominio.

## Respaldo y restauración

Detén la API antes de tomar el respaldo para que PostgreSQL y los archivos queden sincronizados. Conserva fuera del repositorio:

1. Un respaldo PostgreSQL en formato custom con pg_dump.
2. Una copia de las carpetas públicas y privadas de archivos; en producción son REPORT_UPLOADS_PATH y CLAIM_EVIDENCE_PATH.
3. La versión de código y las migraciones usadas.

Ejemplo con credenciales exportadas en Bash:

~~~bash
pg_dump --dbname "$DATABASE_URL" --format=custom --file=buscacampus.backup
pg_restore --dbname "$RESTORE_DATABASE_URL" --no-owner --no-privileges buscacampus.backup
~~~

Restaura en una base vacía y restaura las dos carpetas de archivos desde el mismo respaldo. Después inicia la API, que volverá a aplicar los cambios idempotentes. Ejecuta el diagnóstico de archivos y comprueba las rutas de imágenes antes de habilitar tráfico.

## Solución de problemas

- La portada no carga: abre el cliente en 8080 con Compose o la dirección de Vite en ejecución directa.
- PostgreSQL no está listo: revisa docker compose ps y los logs del servicio db; confirma que el puerto no esté ocupado y DATABASE_URL sea correcto.
- No inicia sesión tras desplegar: confirma HTTPS, COOKIE_SECURE=true, PUBLIC_ORIGIN y JWT_SECRET. No cambies a localStorage para resolver cookies.
- No carga una imagen: confirma que el volumen público está montado y que el archivo existe. /uploads publica únicamente imágenes de reportes.
- No se ve la evidencia: abre el detalle autorizado de la reclamación; la descarga requiere sesión y no funciona como una URL pública.
- E2E no inicia: comprueba Chromium, PostgreSQL y que AVANCE3_TEST_DATABASE_URL termine en _test o -test.

## Sustentación

Consulta [Guion de sustentación del Avance 3](docs/sustentacion-avance3.md). Incluye un recorrido de menos de 10 minutos, consultas SQL de solo lectura, archivos por verificar, reparto entre los cuatro integrantes, ventajas y costos de las decisiones y tomas sugeridas para un video opcional.
