# Guion de demo — BuscaCampus Avance 2

Duración sugerida: 6–8 minutos. La demo usa PostgreSQL local, la API Express y el cliente React. No requiere servicios cloud.

## Preparación

1. Sigue la configuración del README: instala dependencias, prepara el esquema y el seed, y configura `server/.env` y `client/.env`.
2. Inicia dos terminales desde la raíz del repositorio:

   ```bash
   npm run dev --prefix server
   npm run dev --prefix client
   ```

3. Abre `http://localhost:5173`. Comprueba también `GET http://localhost:4000/api/v1/health`; debe responder `success: true` y `data.database.connected: true`.
4. Ten a mano pgAdmin o `psql` para verificar la persistencia al final.

## Recorrido

### 1. Registro, login y sesión restaurable

1. Abre **Crear cuenta** (`/register`) y registra una cuenta de prueba con correo `@uao.edu.co`, nombre completo y contraseña de al menos ocho caracteres.
2. Inicia sesión desde `/login`. Muestra los mensajes de validación con un intento incompleto y luego entra con las credenciales correctas.
3. Comprueba que la navegación muestra el usuario y el enlace al panel.
4. Abre `/dashboard` directamente y recarga la página. La sesión debe restaurarse mediante `GET /api/v1/auth/me` y el dashboard debe seguir disponible.
5. Cierra sesión desde la navegación. Abre `/dashboard` directamente: debe redirigir a `/login`. La cookie de sesión no se guarda en localStorage o sessionStorage.

### 2. Landing con datos reales y filtros

1. Vuelve a iniciar sesión y abre `/`.
2. Muestra reportes cargados desde `GET /api/v1/reportes`, sus imágenes y los catálogos obtenidos desde `/categorias` y `/ubicaciones`.
3. Filtra por texto, categoría y ubicación. Verifica un resultado vacío y luego limpia los filtros.

### 3. Crear un reporte con imagen

1. Entra a `/dashboard` y selecciona **Publicar reporte**.
2. Completa título, descripción, categoría, ubicación, tipo y fecha/hora; elige un JPEG, PNG o WebP menor de 5 MB.
3. Muestra la vista previa y publica. El nuevo reporte debe aparecer en el panel sin recargar la página.
4. En la terminal o el explorador de archivos, confirma que hay un archivo con nombre UUID bajo `server/uploads/`.
5. Ejecuta esta consulta de solo lectura en pgAdmin o `psql` para comprobar el reporte y sus metadatos:

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
   WHERE r.titulo = 'Título usado en la demo'
   ORDER BY a.fecha_subida DESC;
   ```

   La ruta pública de la respuesta comienza con `/uploads/`; la API no expone rutas absolutas del servidor.

### 4. Editar y eliminar

1. En la tarjeta del reporte recién creado, selecciona **Editar**. Cambia el título o la descripción y guarda sin elegir otro archivo: la imagen actual debe conservarse.
2. Vuelve a editar y, opcionalmente, selecciona una imagen válida para mostrar su reemplazo.
3. Selecciona **Eliminar**, confirma la acción y comprueba que desaparece de la lista.
4. Repite la consulta SQL: el reporte y sus metadatos deben haber desaparecido. Confirma que el archivo correspondiente ya no está en `server/uploads/`.

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
