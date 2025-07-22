-- Seed data for OpMap database
-- This script populates the database with initial data from the existing JSON/PSV files

-- First, let's add some example departments
INSERT INTO departments (code, name, excluded) VALUES
('08', 'Atlántico', false),
('11', 'Bogotá D.C.', false),
('73', 'Tolima', false),
('76', 'Valle del Cauca', false),
('50', 'Meta', false),
('15', 'Boyacá', false),
('25', 'Cundinamarca', false),
('41', 'Huila', false),
('52', 'Nariño', false),
('70', 'Sucre', false),
('13', 'Bolívar', false),
('66', 'Risaralda', false),
('05', 'Antioquia', false),
('17', 'Caldas', false),
('63', 'Quindío', false),
('23', 'Córdoba', false),
('20', 'Cesar', false),
('47', 'Magdalena', false),
('44', 'La Guajira', false),
('54', 'Norte de Santander', false),
('68', 'Santander', false),
('18', 'Caquetá', false),
('19', 'Cauca', false),
('85', 'Casanare', false),
('86', 'Putumayo', false),
('27', 'Chocó', true),
('88', 'San Andrés y Providencia', true),
('91', 'Amazonas', true),
('94', 'Guainía', true),
('95', 'Guaviare', true),
('97', 'Vaupés', true),
('99', 'Vichada', true);

-- Example municipalities (just a few for demonstration)
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08001', 'Barranquilla', '08', 10.968200, -74.781300, 1206946),
('11001', 'Bogotá', '11', 4.710989, -74.072090, 7181469),
('73001', 'Ibagué', '73', 4.448269, -75.232080, 529635),
('76001', 'Cali', '76', 3.451647, -76.531982, 2227642),
('50001', 'Villavicencio', '50', 4.151382, -73.637690, 531275),
('15001', 'Tunja', '15', 5.539823, -73.361160, 195496),
('25754', 'Soacha', '25', 4.587639, -74.221600, 533718),
('41001', 'Neiva', '41', 2.927300, -75.281800, 347479),
('52001', 'Pasto', '52', 1.213610, -77.281111, 392054),
('70001', 'Sincelejo', '70', 9.304570, -75.397700, 279031),
('13001', 'Cartagena', '13', 10.391050, -75.479426, 914552),
('66001', 'Pereira', '66', 4.814435, -75.694541, 467185);

-- Example KAMs (from sellers.json)
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('Barranquilla', '08001', 10.972149, -74.804089, true, 240, 1, '#0000FF'),
('Chapinero', '11001', 4.642665, -74.063644, true, 240, 1, '#FFFF00'),
('Ibagué', '73001', 4.438889, -75.232222, true, 240, 1, '#0000FF'),
('Cali', '76001', 3.451647, -76.531982, true, 240, 1, '#008000'),
('Villavicencio', '50001', 4.153031, -73.634963, true, 240, 1, '#800080'),
('Tunja', '15001', 5.544642, -73.357557, true, 240, 1, '#FF00FF'),
('San Cristóbal', '11001', 4.563182, -74.086491, true, 240, 1, '#00FFFF'),
('Soacha Kennedy', '11001', 4.606402, -74.166648, true, 240, 1, '#FFA500'),
('Neiva', '41001', 2.934448, -75.288142, true, 240, 1, '#8B4513'),
('Pasto', '52001', 1.213679, -77.281200, true, 240, 1, '#808080'),
('Sincelejo', '70001', 9.299580, -75.396293, true, 240, 1, '#00FF00'),
('Cartagena', '13001', 10.414395, -75.544624, true, 240, 1, '#FFC0CB'),
('Pereira', '66001', 4.813872, -75.695742, true, 240, 1, '#4B0082'),
('Buenaventura', '76109', 3.880899, -77.031700, true, 240, 1, '#FFD700'),
('Plato', '47001', 9.792736, -74.788056, true, 240, 1, '#8A2BE2'),
('Medellín', '05001', 6.251477, -75.563591, true, 240, 1, '#FF1493');

-- Note: To import hospitals from the PSV file, you would need to:
-- 1. Convert the PSV to CSV
-- 2. Use PostgreSQL's COPY command or a data import tool
-- 3. Or write a script to read the PSV and generate INSERT statements

-- Example hospital entries
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('0800100101', 'CLINICA REINA CATALINA S.A.', '08', '08001', NULL, 10.992817, -74.788617, 150),
('1100100001', 'CLINICA NUEVA', '11', '11001', '11002', 4.650000, -74.070000, 200),
('7300100001', 'HOSPITAL FEDERICO LLERAS ACOSTA', '73', '73001', NULL, 4.438889, -75.232222, 350);

-- Example opportunities
INSERT INTO opportunities (hospital_id, annual_contract_value, current_provider, notes) VALUES
((SELECT id FROM hospitals WHERE code = '1100100001'), 1800000.00, 'Stryker', 'Contrato vence en diciembre 2024, buena relación con el hospital'),
((SELECT id FROM hospitals WHERE code = '0800100101'), 2500000.00, 'Synthes', 'Mayor hospital de la región, oportunidad clave');

-- Department adjacency matrix (example entries)
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('08', '13'), ('08', '70'), ('08', '20'), ('08', '47'),
('11', '25'), ('11', '50'), ('11', '15'), ('11', '73'),
('25', '11'), ('25', '15'), ('25', '50'), ('25', '73'), ('25', '41'),
('50', '11'), ('50', '25'), ('50', '15'), ('50', '73'), ('50', '41'), ('50', '85'), ('50', '95'), ('50', '99');

-- Note: This is just example seed data. The complete data should be imported from the existing JSON/PSV files