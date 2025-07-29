-- Script para corregir los departamentos faltantes
-- Ejecutar este script ANTES de migration_data.sql

-- Primero limpiamos las tablas en el orden correcto para evitar violaciones de FK
TRUNCATE TABLE assignments CASCADE;
TRUNCATE TABLE opportunities CASCADE;
TRUNCATE TABLE hospitals CASCADE;
TRUNCATE TABLE kams CASCADE;
TRUNCATE TABLE department_adjacency CASCADE;
TRUNCATE TABLE municipalities CASCADE;
TRUNCATE TABLE departments CASCADE;

-- Insertar TODOS los departamentos de Colombia
INSERT INTO departments (code, name, excluded) VALUES
('05', 'Antioquia', false),
('08', 'Atlántico', false),
('11', 'Bogotá D.C.', false),
('13', 'Bolívar', false),
('15', 'Boyacá', false),
('17', 'Caldas', false),
('18', 'Caquetá', false),
('19', 'Cauca', false),
('20', 'Cesar', false),
('23', 'Córdoba', false),
('25', 'Cundinamarca', false),
('27', 'Chocó', true),
('41', 'Huila', false),
('44', 'La Guajira', false),
('47', 'Magdalena', false),
('50', 'Meta', false),
('52', 'Nariño', false),
('54', 'Norte de Santander', false),
('63', 'Quindío', false),
('66', 'Risaralda', false),
('68', 'Santander', false),
('70', 'Sucre', false),
('73', 'Tolima', false),
('76', 'Valle del Cauca', false),
('81', 'Arauca', false),
('85', 'Casanare', false),
('86', 'Putumayo', false),
('88', 'San Andrés y Providencia', true),
('91', 'Amazonas', true),
('94', 'Guainía', true),
('95', 'Guaviare', true),
('97', 'Vaupés', true),
('99', 'Vichada', true);

-- Ahora puedes ejecutar el resto del script migration_data.sql
-- pero comenta o elimina la sección "-- 1. Insertar departamentos" ya que ya están insertados