# Guion de sustentación — Entrega Final (Avance 3)

Duración objetivo: 9 minutos. Haz el recorrido con dos cuentas sintéticas, PostgreSQL y archivos de prueba. No muestres contraseñas, secretos, correos personales ni datos reales. La duración deja un minuto para preguntas.

## Preparación

1. Sigue el arranque local de [README](../README.md#arranque-local-con-docker-compose) y verifica el endpoint de salud.
2. Usa dos cuentas de demostración @uao.edu.co y una imagen de prueba sin información personal.
3. Anota el ID del reporte creado; al final reemplázalo por REPORT_ID y CLAIM_ID en las consultas SQL.
4. Abre dos sesiones de navegador o cierra sesión entre roles. Ten pgAdmin o psql listo y una terminal para revisar los archivos.

## Recorrido cronometrado

| Tiempo | Responsable | Demostración y explicación |
| --- | --- | --- |
| 0:00–0:40 | Juan David Ortiz | Presenta BuscaCampus, la arquitectura React, Express y PostgreSQL, y el recorrido que se demostrará. Explica que el arranque es local porque todavía no hay una URL de producción comprobada. |
| 0:40–1:45 | David Neira | Desde la landing abre un reporte y muestra el detalle público. Registra o inicia sesión, recarga una ruta privada y explica la restauración de sesión con cookie HttpOnly. |
| 1:45–3:05 | Juan Felipe Fajardo | Con la cuenta autora publica un objeto Encontrado con imagen. Muestra el reporte y sus datos en PostgreSQL, junto con el archivo UUID en el directorio público. |
| 3:05–4:45 | David Neira | Cierra sesión. Como visitante selecciona Reclamar, inicia sesión con la segunda cuenta y verifica que vuelve al detalle solicitado. Envía mensaje e imagen de evidencia. |
| 4:45–6:25 | Sebastián Gómez | Como autor abre Reclamaciones recibidas, revisa la evidencia privada y aprueba. Explica transacción, autorización y bloqueo de filas para evitar decisiones contradictorias. |
| 6:25–7:25 | David Neira | Recarga Mis reclamaciones y muestra el estado Aprobada y la evidencia autorizada. Vuelve al detalle público y confirma estado Devuelto. |
| 7:25–8:20 | Juan Felipe Fajardo | Ejecuta las consultas de solo lectura y verifica que reporte, reclamación y metadatos están vinculados. Enseña las ubicaciones de ambos archivos físicos. |
| 8:20–9:00 | Juan David Ortiz | Resume CI, pruebas, migraciones, volúmenes y configuración HTTPS. Cada integrante comenta una decisión técnica, su ventaja y su costo. |

## Consultas de solo lectura

Reemplaza los valores 123 y 456 por los identificadores de la demostración. Estas consultas solo leen información y evitan mostrar nombres o correos personales.

~~~sql
SELECT id, titulo, tipo_reporte, estado
FROM reportes_objetos
WHERE id = 123;

SELECT reporte_id, nombre_original, nombre_fisico, mime_type, extension,
       peso_bytes, fecha_subida
FROM archivos_metadatos
WHERE reporte_id = 123;

SELECT id, reporte_id, usuario_reclamante_id, estado, fecha_reclamacion
FROM reclamaciones
WHERE id = 456;

SELECT reclamacion_id, usuario_autor_id, nombre_original, nombre_fisico,
       mime_type, extension, peso_bytes, ubicacion_interna, fecha_subida
FROM reclamaciones_archivos_metadatos
WHERE reclamacion_id = 456;
~~~

## Archivos físicos por comprobar

- Imagen pública del reporte: server/uploads/<nombre_fisico> en ejecución directa o el volumen report-uploads en Compose. El nombre físico se consulta en archivos_metadatos.
- Evidencia privada: server/private_uploads/<nombre_fisico> o el volumen claim-evidence. La ruta relativa de control está en reclamaciones_archivos_metadatos. No se debe abrir mediante /uploads.
- Con Compose se puede listar cada volumen desde la API:

  ~~~bash
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec api find /var/lib/buscacampus/uploads -maxdepth 1 -type f
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec api find /var/lib/buscacampus/private_uploads -maxdepth 1 -type f
  ~~~

Confirma en el navegador que la imagen del reporte se ve públicamente. La evidencia debe verse desde el historial autorizado, mientras que una petición sin sesión al endpoint de evidencia debe responder 401. Una ruta /uploads para evidencia privada debe responder 404.

## Reparto y decisiones técnicas

- Juan Felipe Fajardo: autenticación de servidor, cookies, hash de contraseñas y contrato de errores. Ventaja: sesión HttpOnly que no se expone al JavaScript; costo: depende de que el navegador acepte cookies y que HTTPS esté bien configurado.
- David Neira: AuthProvider, rutas de React, formularios y flujo de reclamación. Ventaja: navegación coherente y recuperación de la ruta solicitada; costo: hay que mantener estados de carga, error y actualización en cada vista.
- Sebastián Gómez: API REST, validaciones, PostgreSQL, permisos y persistencia dual. Ventaja: transacciones e integridad entre reporte, reclamación y metadatos; costo: la coordinación con archivos requiere compensar fallos del disco y de la base.
- Juan David Ortiz: integración, pruebas de flujo, ejecución con Docker, CI y documentación. Ventaja: entorno repetible con archivos persistentes y proxy del mismo origen; costo: operar contenedores, respaldos, certificados y almacenamiento.

En la discusión técnica, expliquen también estas ventajas y costos:

- PostgreSQL conserva relaciones, estados e historial con restricciones e índices; exige respaldos y migraciones.
- Los archivos locales guardan imágenes fuera de la base y con UUID; son sencillos de inspeccionar, pero requieren volúmenes persistentes y respaldo coordinado.
- La evidencia se descarga por un endpoint autorizado; añade una petición autenticada, pero evita exponerla como archivo público.
- Las decisiones usan transacciones y bloqueo de filas; mantienen estados coherentes bajo concurrencia, aunque pueden esperar si dos operaciones actúan sobre el mismo reporte.
- Caddy y el proxy del mismo origen facilitan HTTPS y cookies seguras; dependen de DNS válido y puertos 80/443 accesibles.

## Evidencias que el equipo debe revisar personalmente

- Ejecutar el flujo completo con dos cuentas de prueba y confirmar el retorno al reporte después del login.
- Comprobar el HTTP 201 de la reclamación, el estado En reclamación y luego Devuelto.
- Volver a cargar el historial y comprobar que conserva el estado y la evidencia.
- Ejecutar las cuatro consultas SQL, identificar los archivos físicos y comprobar que la evidencia privada no se sirve desde /uploads.
- Confirmar la URL y el flujo desde producción solo si el equipo aporta host, dominio, PostgreSQL y almacenamiento persistente. No se ha verificado una URL pública para esta entrega.

## Tomas para un video opcional

La consigna disponible no exige un video. Si el grupo decide grabarlo, puede registrar estas tomas breves en el mismo orden del guion:

1. Landing, búsqueda y detalle público.
2. Registro/login y recarga de ruta privada.
3. Publicación del reporte y su imagen.
4. Segunda cuenta, login de retorno y reclamación con vista previa de evidencia.
5. Autor revisando evidencia y aprobando la solicitud.
6. Historial tras recargar y estado Devuelto.
7. Consultas SQL y verificación de los dos directorios de archivos.
8. Cierre con CI, arquitectura y decisiones técnicas.

Graben con cuentas y archivos sintéticos. Revisen la captura para asegurarse de que no muestre credenciales, tokens, datos personales o valores de archivos .env.
