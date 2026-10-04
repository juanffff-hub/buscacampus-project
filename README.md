# BuscaCampus · Avance 1

Prototipo de una plataforma web para objetos perdidos y encontrados en la Universidad Autónoma de Occidente (UAO). Este repositorio entrega la definición del problema, alcance y arquitectura; el modelo entidad–relación de seis entidades; una API con `GET /api/v1/health` que consulta PostgreSQL; y las vistas responsive de inicio, inicio de sesión y registro.

## Problema y objetivo

En aulas, laboratorios, biblioteca, cafetería y plazoletas del campus se pierden o encuentran pertenencias como carnés, llaves, cargadores y prendas. La búsqueda por canales informales dificulta localizar al dueño y seguir el proceso de devolución. BuscaCampus busca ofrecer un punto de consulta y reporte para la comunidad UAO, con trazabilidad de publicaciones, evidencias y reclamaciones.

El objetivo del proyecto completo es que un visitante pueda consultar reportes, que un usuario registrado publique pérdidas o hallazgos con fotografías, y que los involucrados gestionen una reclamación hasta la devolución. En este Avance 1, la interfaz usa datos de muestra y los formularios de acceso son maquetas con validación local. La autenticación, los reportes persistidos, la carga de archivos y el flujo de reclamación quedan modelados para siguientes avances; todavía no se presentan como operaciones funcionales.

## Historias de usuario principales

1. Como visitante, quiero buscar y filtrar los reportes por categoría y lugar para identificar un objeto.
2. Como integrante de la comunidad, quiero registrarme e iniciar sesión para publicar objetos perdidos o encontrados con evidencia.
3. Como autor de un reporte, quiero gestionar su estado hasta marcarlo como devuelto.
4. Como posible dueño, quiero reclamar un objeto aportando detalles que prueben su propiedad.

## Arquitectura

```text
Navegador ── React + Vite (client/) ── HTTP/JSON ── Express (server/)
                                                   │
                                                   ├── PostgreSQL: datos relacionales y metadatos
                                                   └── uploads/: archivos físicos (fase posterior)
```

`client/` y `server/` son proyectos npm independientes. El backend expone la ruta `GET /api/v1/health`, que ejecuta `SELECT NOW()` sobre PostgreSQL en cada solicitud. Una respuesta HTTP 200 confirma que el servidor y la base de datos responden; si la consulta falla, devuelve HTTP 503 sin exponer credenciales.

## ¿Por qué PostgreSQL?

BuscaCampus utiliza PostgreSQL porque el dominio tiene relaciones claras entre usuarios, categorías, ubicaciones, reportes, archivos y reclamaciones. PostgreSQL permite:

- Garantizar integridad referencial mediante claves primarias y foráneas.
- Aplicar restricciones de unicidad y validaciones `CHECK` directamente en la base de datos.
- Ejecutar operaciones transaccionales para crear reportes y asociar sus archivos de forma consistente.
- Consultar y filtrar reportes por categoría, ubicación, tipo y estado.
- Conservar metadatos de archivos de forma estructurada, mientras los archivos físicos se preparan para almacenarse en `server/uploads/`.

El esquema relacional está definido en [`server/sql/schema.sql`](server/sql/schema.sql) y los datos iniciales en [`server/sql/seed.sql`](server/sql/seed.sql). El modelo entidad–relación se encuentra en [`docs/mer.md`](docs/mer.md), [`docs/mer-buscacampus.mdj`](docs/mer-buscacampus.mdj) y [`docs/mer-buscacampus.jpg`](docs/mer-buscacampus.jpg).

## Conexión y prueba de PostgreSQL desde pgAdmin 4

El backend utiliza PostgreSQL porque el proyecto maneja datos relacionados entre usuarios, categorías, ubicaciones, reportes, archivos y reclamaciones. Esto permite usar claves foráneas, restricciones y transacciones para mantener la integridad de la información.

### 1. Abrir la base de datos en pgAdmin

1. Abrir **pgAdmin 4**.
2. En el panel **Object Explorer**, expandir **Servers** y seleccionar el servidor instalado, por ejemplo **PostgreSQL 18**.
3. Expandir **Databases** y seleccionar la base de datos `buscacampus`.
4. Hacer clic derecho sobre `buscacampus` y elegir **Query Tool**. La pestaña debe mostrar una conexión similar a `buscacampus/postgres@PostgreSQL 18`.

Si la base todavía no existe, crearla desde **Databases → clic derecho → Create → Database**, usando el nombre `buscacampus` y el propietario `postgres`.

### 2. Ejecutar el esquema

En el Query Tool de la base `buscacampus`:

1. Hacer clic en el botón **Open File** (icono de carpeta).
2. Seleccionar `server/sql/schema.sql`.
3. Verificar que el archivo se abrió en la pestaña conectada a `buscacampus`.
4. Ejecutar el script con el botón **Execute/Run** (icono de ▶).

Este archivo crea las tablas, claves, relaciones, restricciones e índices del proyecto.

### 3. Ejecutar los datos iniciales

Repetir el procedimiento anterior con `server/sql/seed.sql`:

1. Abrir `server/sql/seed.sql` desde **Open File**.
2. Confirmar que la conexión seleccionada sigue siendo `buscacampus`.
3. Presionar **Execute/Run**.

Este script inserta las categorías y ubicaciones iniciales. Después de ejecutarlo, hacer clic derecho sobre **Schemas → public → Tables** y seleccionar **Refresh** para comprobar que las tablas aparecen.

### 4. Conectar el backend

Configurar `server/.env` con la misma base, usuario, contraseña y puerto utilizados en pgAdmin:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/buscacampus
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

Luego, desde la carpeta `server/`, iniciar el backend:

```bash
npm run dev
```

### 5. Probar la conexión

Con el backend encendido, abrir en el navegador o en Postman:

```text
GET http://localhost:4000/api/v1/health
```

La conexión es correcta cuando el endpoint responde HTTP 200 con `status: "OK"` y `database.connected: true`. Si PostgreSQL no está disponible o las credenciales no coinciden, responde HTTP 503. La prueba fue realizada con éxito y confirmó la conexión entre el backend y la base de datos.

## Estructura

```text
buscacampus-project/
├── .gitignore
├── .env.example
├── README.md
├── docs/
│   ├── mer.md
│   ├── mer-buscacampus.jpg
│   └── mer-buscacampus.mdj
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/       Navbar, Footer y tarjetas
│   │   ├── pages/            LandingPage, Login, Register, Dashboard
│   │   ├── services/         Cliente de API
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── server/
    ├── src/
    │   ├── config/           Pool de PostgreSQL
    │   ├── controllers/      Lógica de /health
    │   ├── routes/           Rutas REST
    │   └── app.js
    ├── sql/
    │   ├── schema.sql        Tablas, claves y restricciones
    │   └── seed.sql          Datos iniciales
    ├── uploads/
    ├── .env.example
    ├── package.json
    └── server.js
```

La carpeta `uploads/` está preparada y excluida de Git salvo el archivo que preserva su estructura. No hay subida de archivos implementada aún.

## Alcance de la entrega

| Requisito | Evidencia |
|---|---|
| Problema, alcance y arquitectura | Este README |
| Diagrama E/R o NoSQL | `docs/mer-buscacampus.jpg`, `docs/mer-buscacampus.mdj`, `docs/mer.md`, `server/sql/schema.sql` |
| Repositorio base frontend/backend | `client/`, `server/`, `.gitignore`, ejemplos de entorno |
| `/health` y consulta a PostgreSQL | `server/src/controllers/healthController.js` |
| Esquema y datos iniciales | `server/sql/schema.sql`, `server/sql/seed.sql` |
| Landing y Login/Registro responsive | `client/src/pages/`, `client/src/styles.css` |

### Evidencia de la prueba

La siguiente captura muestra la respuesta exitosa del endpoint `/api/v1/health`
con PostgreSQL conectado:

![Prueba de conexión entre el backend y PostgreSQL](docs/health-postgresql.png)