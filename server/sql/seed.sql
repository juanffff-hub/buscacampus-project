INSERT INTO categorias (nombre, descripcion) VALUES
  ('Electrónicos', 'Celulares, computadores, cargadores y accesorios.'),
  ('Documentos', 'Carnés, documentos y tarjetas.'),
  ('Llaves', 'Llaveros y juegos de llaves.'),
  ('Ropa', 'Prendas y accesorios personales.'),
  ('Otros', 'Objetos que no pertenecen a otra categoría.')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO ubicaciones (nombre_zona) VALUES
  ('Biblioteca'),
  ('Cafetería Central'),
  ('Bloque A'),
  ('Bloque C'),
  ('Plazoleta Central'),
  ('Laboratorios')
ON CONFLICT (nombre_zona) DO NOTHING;

