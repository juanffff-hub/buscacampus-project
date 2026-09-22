# Modelo entidad–relación · BuscaCampus

El universo del discurso es la gestión de objetos perdidos y encontrados dentro de la Universidad Autónoma de Occidente. Una persona registrada publica un reporte de pérdida o hallazgo en una zona del campus, lo clasifica y adjunta evidencia fotográfica. Otra persona puede presentar una reclamación con una prueba de propiedad. El archivo se conserva físicamente; sus datos descriptivos se guardan en PostgreSQL.

```mermaid
erDiagram
    USUARIOS ||--o{ REPORTES_OBJETOS : crea
    CATEGORIAS ||--o{ REPORTES_OBJETOS : clasifica
    UBICACIONES ||--o{ REPORTES_OBJETOS : ocurre_en
    REPORTES_OBJETOS ||--|{ ARCHIVOS_METADATOS : contiene
    USUARIOS ||--o{ ARCHIVOS_METADATOS : sube
    USUARIOS ||--o{ RECLAMACIONES : realiza
    REPORTES_OBJETOS ||--o{ RECLAMACIONES : recibe

    USUARIOS {
      bigint id PK
      string nombre_completo
      string correo_electronico UK
      string contrasena_hash
      string rol "Usuario | Administrador"
      datetime fecha_registro
      string estado "Activo | Inactivo"
    }
    CATEGORIAS {
      bigint id PK
      string nombre UK
      string descripcion
    }
    UBICACIONES {
      bigint id PK
      string nombre_zona UK
      string estado "Activo | Inactivo"
    }
    REPORTES_OBJETOS {
      bigint id PK
      bigint usuario_creador_id FK
      bigint categoria_id FK
      bigint ubicacion_id FK
      string titulo
      string descripcion
      string tipo_reporte "Perdido | Encontrado"
      datetime fecha_hora_evento
      datetime fecha_creacion
      string estado "Publicado | En reclamación | Devuelto"
    }
    ARCHIVOS_METADATOS {
      bigint id PK
      bigint reporte_id FK
      bigint usuario_autor_id FK
      string nombre_original
      string nombre_fisico UK
      string ruta_url
      string extension
      bigint peso_bytes
      datetime fecha_subida
    }
    RECLAMACIONES {
      bigint id PK
      bigint usuario_reclamante_id FK
      bigint reporte_id FK
      string mensaje_prueba
      datetime fecha_reclamacion
      string estado "Pendiente | Aprobada | Rechazada"
    }
```

## Cardinalidades y reglas

Cada reporte requiere exactamente un autor, una categoría y una ubicación. Cada archivo tiene exactamente un reporte y un usuario que lo subió. Una reclamación corresponde exactamente a un usuario y un reporte. Las entidades padre pueden existir sin hijos. El reporte exige **al menos un archivo** según el MER, regla que deberá comprobar la operación de creación en una transacción porque una clave foránea por sí sola no la garantiza. Se permite una reclamación por usuario y reporte; su estado permite registrar la decisión. La contraseña se guarda como hash, nunca en texto claro.

El SQL ejecutable está en [`server/sql/schema.sql`](../server/sql/schema.sql). Los nombres en plural de tablas corresponden a las seis entidades del diagrama entregado. La categoría, la ubicación y la autoría del archivo se modelan como relaciones explícitas, a diferencia del borrador de tres entidades de la primera descripción.

