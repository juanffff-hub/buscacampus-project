# Guía de demostración — BuscaCampus Avance 2

Esta guía permite preparar y recorrer la demostración de BuscaCampus sin conocimiento previo del proyecto. Duración sugerida: 6–8 minutos. Se usan PostgreSQL local, la API Express y el cliente React; no hacen falta servicios cloud.

## Videos por capítulo

- [Parte 1 — Registro, login y sesión restaurable](../Demo%20Web%20Avance%202/Demo%20Parte%201.%20Registro,%20login%20y%20sesi%C3%B3n%20restaurable.mp4)
- [Parte 2 — Landing con datos reales y filtros](../Demo%20Web%20Avance%202/Demo%20Parte%202.%20Landing%20con%20datos%20reales%20y%20filtros.mp4)
- [Parte 3 — Crear un reporte con imagen](../Demo%20Web%20Avance%202/Demo%20Parte%203.%20Crear%20un%20reporte%20con%20imagen.mp4)
- [Parte 4 — Editar y eliminar](../Demo%20Web%20Avance%202/Demo%20Parte%204.%20Editar%20y%20eliminar.mp4)

## Preparación

1. Completa la [puesta en marcha del README](../README.md#puesta-en-marcha): prepara PostgreSQL, aplica el esquema y el seed, crea los archivos `.env` e instala las dependencias.
2. Abre dos terminales en la raíz del repositorio. Inicia el servidor en la primera:

   ```bash
   npm run dev --prefix server
   ```

   Inicia el cliente en la segunda:

   ```bash
   npm run dev --prefix client
   ```

3. Abre la URL que muestra Vite, normalmente `http://localhost:5173`. El puerto `4000` corresponde a la API; para revisar su estado, abre `http://localhost:4000/api/v1/health` y confirma que la respuesta indica `success: true` y `data.database.connected: true`.
4. Mantén pgAdmin o una terminal con `psql` disponible para verificar los datos al final. Usa una cuenta de prueba con correo `@uao.edu.co`.

## Recorrido

### 1. Registro, login y sesión restaurable

1. Selecciona **Crear cuenta** y registra una cuenta de prueba. Usa un correo `@uao.edu.co`, un nombre completo y una contraseña de al menos ocho caracteres.
2. Abre **Iniciar sesión**. Comprueba que el formulario señala los campos obligatorios y, luego, entra con las credenciales de la cuenta creada.
3. Confirma que la navegación muestra la cuenta y el acceso al panel.
4. Abre `http://localhost:5173/dashboard` directamente y recarga la página. La sesión debe restaurarse y el panel debe seguir disponible.
5. Cierra sesión desde la navegación y vuelve a abrir `/dashboard`. La aplicación debe llevarte a la pantalla de inicio de sesión.

### 2. Landing con datos reales y filtros

1. Inicia sesión si la sesión anterior se cerró y vuelve a la página principal.
2. Revisa los reportes, las imágenes y los filtros de categoría y ubicación.
3. Busca por una palabra que aparezca en un reporte. Prueba los filtros y, si no hay coincidencias, usa **Limpiar filtros**.

### 3. Crear un reporte con imagen

1. Abre **Mis reportes** y selecciona **Publicar reporte**.
2. Completa el título, la descripción, la categoría, la ubicación, el tipo y la fecha del evento. Adjunta una imagen JPEG, PNG o WebP de hasta 5 MB.
3. Revisa la vista previa y selecciona **Publicar reporte**. El reporte debe aparecer en el panel sin recargar la página. Anota el número que aparece como `Reporte #...` en su tarjeta.
4. En el explorador de archivos, abre `server/uploads/` y confirma que se guardó una imagen con un nombre generado por la aplicación.
5. En pgAdmin o `psql`, ejecuta esta consulta de solo lectura para revisar los reportes con imagen. No requiere reemplazar títulos de ejemplo:

   ```sql
   SELECT
     r.id,
     r.titulo,
     u.correo_electronico AS autor,
     a.nombre_original,
     a.nombre_fisico,
     a.ruta_url,
     a.mime_type,
     a.extension,
     a.peso_bytes,
     a.fecha_subida
   FROM reportes_objetos AS r
   JOIN usuarios AS u ON u.id = r.usuario_creador_id
   JOIN archivos_metadatos AS a ON a.reporte_id = r.id
   ORDER BY r.fecha_creacion DESC
   LIMIT 10;
   ```

   La consulta debe mostrar el reporte recién creado entre los más recientes. La ruta pública empieza con `/uploads/`; la API no expone la ruta física del servidor.

### 4. Editar y eliminar

1. En la tarjeta del reporte recién creado, selecciona **Editar**. Cambia el título o la descripción y guarda sin adjuntar otra imagen; la imagen actual debe conservarse.
2. Si quieres comprobar el reemplazo de imagen, vuelve a editar y selecciona otra imagen válida.
3. Anota el ID del reporte, selecciona **Eliminar** y confirma la acción. Comprueba que desaparece de la lista.
4. Reemplaza `123` por el ID que anotaste y ejecuta esta consulta. Ambos resultados deben ser `0`:

   ```sql
   SELECT
     (SELECT COUNT(*) FROM reportes_objetos WHERE id = 123) AS reportes,
     (SELECT COUNT(*) FROM archivos_metadatos WHERE reporte_id = 123) AS metadatos;
   ```

5. Confirma que el archivo físico correspondiente ya no está en `server/uploads/`.

## Comprobaciones de API y validación

- Sin sesión, `GET /api/v1/reportes?mios=true` responde `401` con el contrato estándar de error.
- Registro con un correo duplicado responde `409`; correo fuera de `@uao.edu.co` y contraseña menor de ocho caracteres responden `400`.
- Publicar sin imagen, con MIME no admitido o con campos inválidos responde `400`; un archivo mayor de 5 MB responde `413`.
- Un usuario distinto no puede editar o borrar un reporte ajeno (`403`). Un identificador inexistente responde `404`.
- Los errores no incluyen `contrasena_hash`, JWT, secretos, rutas absolutas, trazas ni mensajes internos de PostgreSQL.

## Cierre

Ejecuta las comprobaciones automatizadas desde la raíz:

```bash
npm test --prefix server
npm test --prefix client -- --pool=threads --maxWorkers=1 --reporter=dot
npm run build --prefix client
```

La entrega de Avance 2 no incluye reclamaciones, administración completa, chat, notificaciones ni almacenamiento cloud.
