INSERT INTO categorias (nombre, descripcion) VALUES
  ('Electrónicos', 'Celulares, computadores, cargadores y accesorios.'),
  ('Documentos', 'Carnés, documentos y tarjetas.'),
  ('Llaves', 'Llaveros y juegos de llaves.'),
  ('Ropa', 'Prendas y accesorios personales.'),
  ('Otros', 'Objetos que no pertenecen a otra categoría.')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO ubicaciones (nombre_zona) VALUES
  ('Aula 1'),
  ('Aula 2'),
  ('Aula 3'),
  ('Aula 4'),
  ('Sotanos 1'),
  ('Sotanos 2'),
  ('Cafeteria Piso 1'),
  ('Cafeteria Piso 2'),
  ('Cafeteria Piso 3'),
  ('Biblioteca Piso 1'),
  ('Biblioteca Piso 2'),
  ('Biblioteca Piso 3')
ON CONFLICT (nombre_zona) DO NOTHING;

