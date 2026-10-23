BEGIN;

UPDATE ubicaciones
SET estado = 'Inactivo'
WHERE nombre_zona IN (
  'Biblioteca',
  'Cafetería Central',
  'Bloque A',
  'Bloque C',
  'Plazoleta Central',
  'Laboratorios'
);

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

COMMIT;
