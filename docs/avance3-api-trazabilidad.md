# Avance 3: API y trazabilidad

La especificación [openapi.yaml](openapi.yaml) describe el contrato de la API v3. Las rutas viven en `server/src/routes`; validación, autorización y persistencia se separan en esquemas, controladores, servicios y repositorios.

## Rutas y permisos

| Ruta | Acceso | Resultado |
| --- | --- | --- |
| `POST /reportes/{id}/reclamaciones` | Usuario autenticado; no puede ser autor | Crea una reclamación Pendiente con evidencia privada y pasa el reporte a En reclamación. |
| `GET /reportes/{id}/reclamaciones` | Autor del reporte o administrador | Lista solicitudes recibidas, con paginación. |
| `GET /reclamaciones/mias` | Reclamante autenticado | Lista el historial propio, con paginación. |
| `GET /reclamaciones/recibidas` | Autor autenticado; administrador ve todas | Bandeja agregada y paginada para evitar una consulta por reporte. |
| `GET /reclamaciones/{id}` | Reclamante, autor o administrador | Devuelve el detalle autorizado. |
| `PATCH /reclamaciones/{id}/estado` | Autor del reporte o administrador | Decide una reclamación Pendiente. |
| `GET /reclamaciones/{id}/evidencia` | Reclamante, autor o administrador | Transmite la imagen con `private, no-store`; no hay ruta pública de evidencia. |

Las listas aceptan `page` (1–1.000.000, por defecto 1) y `limit` (1–100, por defecto 20). El contrato conserva el envoltorio `{ success, data }` y el formato estándar de error.

## Estados y transacciones

- Crear una reclamación de un reporte Encontrado inserta la reclamación y sus metadatos dentro de una transacción y cambia el reporte a `En reclamación`.
- Aprobar bloquea el reporte, aprueba una solicitud, rechaza las demás pendientes y marca el reporte `Devuelto` en una transacción.
- Rechazar una solicitud la conserva en el historial. El reporte vuelve a `Publicado` solo cuando no quedan solicitudes pendientes ni aprobadas.
- `PUT /reportes/{id}` no acepta `estado`. Eliminar un reporte con reclamaciones responde `409`.
- El índice único `(usuario_reclamante_id, reporte_id)` impide solicitudes duplicadas; el servicio convierte ese conflicto en `409` y elimina el archivo provisional.

## Archivos y persistencia dual

Las imágenes de reportes se guardan en `server/uploads/` y sus metadatos en `archivos_metadatos`. Las evidencias se guardan en `server/private_uploads/` y `reclamaciones_archivos_metadatos`; solo el endpoint autenticado transmite una evidencia. Ambas cargas validan MIME, extensión y firma, usan UUID y limitan el archivo a 5 MB. La API no devuelve rutas físicas ni el nombre físico como campo separado.

Para comparar el disco y las tablas sin cambiar datos:

```bash
npm run diagnose:files --prefix server
```

El comando informa cantidades de archivos ausentes, huérfanos, temporales o con nombres inválidos. No repara, crea ni elimina archivos. Requiere `DATABASE_URL` y acceso a las dos carpetas de almacenamiento.

## Consultas e índices

La bandeja anterior consultaba los reportes propios y luego solicitaba reclamaciones por cada reporte. En el caso de una página con datos eso implicaba aproximadamente `2 + 3N` viajes de base de datos: dos para listar reportes y tres por cada uno de `N` reportes (verificar autor, contar y obtener página). `GET /reclamaciones/recibidas` reúne esa bandeja en una ruta paginada y una consulta SQL por página con resultados. Las listas de reportes y reclamaciones también obtienen el total con `COUNT(*) OVER()` en el mismo viaje cuando hay filas; una página vacía conserva la consulta de conteo como fallback.

La migración `server/sql/migrations/20261113_001_avance3_query_indexes.sql` añade índices para reportes propios ordenados por fecha y reclamaciones por reporte y fecha. El esquema y las migraciones usan `IF NOT EXISTS` y no borran datos. No se registraron tiempos de ejecución ni planes `EXPLAIN`: este entorno no dispone de PostgreSQL de prueba.

## Verificación reproducible

La prueba `server/src/integration/claimFlow.integration.test.js` recorre registro, login, publicación, reclamación, evidencia, autorización, decisión e historial usando una base cuyo nombre termina en `_test` o `-test` y carpetas temporales. Nunca modifica tablas del esquema `public`; crea y elimina un esquema aleatorio propio.

En PowerShell, configura una base dedicada antes de ejecutar la suite:

```powershell
$env:AVANCE3_TEST_DATABASE_URL = "postgres://usuario:clave@localhost:5432/buscacampus_test"
npm.cmd test --prefix server
```

La prueba verifica su nombre antes de conectarse a la aplicación. Si la variable no está configurada, Node la marca como omitida; esa omisión no acredita una integración real.
