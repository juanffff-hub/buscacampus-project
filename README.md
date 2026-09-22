# BuscaCampus · Avance 1

Prototipo de una plataforma web para objetos perdidos y encontrados en la Universidad Autónoma de Occidente (UAO). Este repositorio entrega la definición del problema, alcance y arquitectura; el modelo entidad–relación de seis entidades; una API con `GET /api/v1/health` que consulta PostgreSQL; y las vistas responsive de inicio, inicio de sesión y registro.

## Problema y objetivo

En aulas, laboratorios, biblioteca, cafetería y plazoletas del campus se pierden o encuentran pertenencias como carnés, llaves, cargadores y prendas. La búsqueda por canales informales dificulta localizar al dueño y seguir el proceso de devolución. BuscaCampus busca ofrecer un punto de consulta y reporte para la comunidad UAO, con trazabilidad de publicaciones, evidencias y reclamaciones.

El objetivo del proyecto completo es que un visitante pueda consultar reportes, que un usuario registrado publique pérdidas o hallazgos con fotografías, y que los involucrados gestionen una reclamación hasta la devolución. En este **Avance 1**, la interfaz usa datos de muestra y los formularios de acceso son maquetas con validación local. La autenticación, los reportes persistidos, la carga de archivos y el flujo de reclamación quedan modelados para siguientes avances; todavía no se presentan como operaciones funcionales.

### Historias de usuario principales

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

`client/` y `server/` son proyectos npm independientes. La ruta de salud del backend ejecuta `SELECT NOW()` sobre PostgreSQL en cada solicitud. Su HTTP 200 confirma que **servidor y base de datos** responden; si la consulta falla, devuelve HTTP 503 sin exponer credenciales. El esquema SQL implementa [el MER](docs/mer.md) y contiene usuarios, categorías, ubicaciones, reportes, archivos y reclamaciones. La carpeta `uploads/` está preparada y excluida de Git salvo el archivo que preserva su estructura. No hay subida de archivos implementada aún.

## Estructura

```text
buscacampus-project/
├── .gitignore
├── .env.example
├── README.md
├── docs/
│   ├── mer.md
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
    ├── sql/                  Esquema y catálogos iniciales
    ├── uploads/
    ├── .env.example
    ├── package.json
    └── server.js
```
El archivo `docs/mer-buscacampus.mdj` contiene el modelo entidad–relación editable realizado en StarUML. También se incluye una versión visual exportada como imagen para facilitar su lectura directamente desde GitHub.

![Modelo entidad–relación de BuscaCampus](docs/mer-buscacampus.png)

El archivo [`docs/mer.md`](docs/mer.md) contiene una versión textual alternativa del modelo y sus cardinalidades. El archivo [`server/sql/schema.sql`](server/sql/schema.sql) lleva este modelo a tablas, claves y restricciones.

## Alcance de la entrega

| Requisito | Evidencia |
| --- | --- |
| Problema, alcance y arquitectura | Este README |
| Diagrama E/R o NoSQL | `docs/mer-buscacampus.png`, `docs/mer-buscacampus.mdj`, `docs/mer.md`, `server/sql/schema.sql` |
| Repositorio base frontend/backend | `client/`, `server/`, `.gitignore`, ejemplos de entorno |
| `/health` y consulta a la base | `server/src/controllers/healthController.js`; las pruebas automáticas cubren respuesta y falla de la consulta. La verificación HTTP 200 contra PostgreSQL requiere ejecutar los pasos anteriores en una instancia disponible. |
| Landing y Login/Registro responsive | `client/src/pages/`, `client/src/styles.css` |
