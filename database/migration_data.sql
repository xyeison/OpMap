-- Script de migración de datos OpMap a Supabase
-- Generado el 2025-07-22 11:22:39

-- IMPORTANTE: Este script contiene datos de ejemplo.
-- Para la migración completa, use el script Python directamente.

-- Limpiar tablas existentes (opcional)
-- TRUNCATE TABLE assignments CASCADE;
-- TRUNCATE TABLE opportunities CASCADE;
-- TRUNCATE TABLE hospitals CASCADE;
-- TRUNCATE TABLE kams CASCADE;
-- TRUNCATE TABLE department_adjacency CASCADE;
-- TRUNCATE TABLE municipalities CASCADE;
-- TRUNCATE TABLE departments CASCADE;

-- 1. Insertar departamentos
INSERT INTO departments (code, name, excluded) VALUES
('08', 'Atlántico', false);
INSERT INTO departments (code, name, excluded) VALUES
('11', 'Bogotá D.C.', false);
INSERT INTO departments (code, name, excluded) VALUES
('73', 'Tolima', false);
INSERT INTO departments (code, name, excluded) VALUES
('76', 'Valle del Cauca', false);
INSERT INTO departments (code, name, excluded) VALUES
('50', 'Meta', false);
INSERT INTO departments (code, name, excluded) VALUES
('15', 'Boyacá', false);
INSERT INTO departments (code, name, excluded) VALUES
('25', 'Cundinamarca', false);
INSERT INTO departments (code, name, excluded) VALUES
('41', 'Huila', false);
INSERT INTO departments (code, name, excluded) VALUES
('52', 'Nariño', false);
INSERT INTO departments (code, name, excluded) VALUES
('70', 'Sucre', false);
INSERT INTO departments (code, name, excluded) VALUES
('13', 'Bolívar', false);
INSERT INTO departments (code, name, excluded) VALUES
('66', 'Risaralda', false);
INSERT INTO departments (code, name, excluded) VALUES
('05', 'Antioquia', false);
INSERT INTO departments (code, name, excluded) VALUES
('17', 'Caldas', false);
INSERT INTO departments (code, name, excluded) VALUES
('63', 'Quindío', false);
INSERT INTO departments (code, name, excluded) VALUES
('23', 'Córdoba', false);
INSERT INTO departments (code, name, excluded) VALUES
('20', 'Cesar', false);
INSERT INTO departments (code, name, excluded) VALUES
('47', 'Magdalena', false);
INSERT INTO departments (code, name, excluded) VALUES
('44', 'La Guajira', false);
INSERT INTO departments (code, name, excluded) VALUES
('54', 'Norte de Santander', false);
INSERT INTO departments (code, name, excluded) VALUES
('68', 'Santander', false);
INSERT INTO departments (code, name, excluded) VALUES
('18', 'Caquetá', false);
INSERT INTO departments (code, name, excluded) VALUES
('19', 'Cauca', false);
INSERT INTO departments (code, name, excluded) VALUES
('85', 'Casanare', false);
INSERT INTO departments (code, name, excluded) VALUES
('86', 'Putumayo', false);
INSERT INTO departments (code, name, excluded) VALUES
('27', 'Chocó', true);
INSERT INTO departments (code, name, excluded) VALUES
('88', 'San Andrés y Providencia', true);
INSERT INTO departments (code, name, excluded) VALUES
('91', 'Amazonas', true);
INSERT INTO departments (code, name, excluded) VALUES
('94', 'Guainía', true);
INSERT INTO departments (code, name, excluded) VALUES
('95', 'Guaviare', true);
INSERT INTO departments (code, name, excluded) VALUES
('97', 'Vaupés', true);
INSERT INTO departments (code, name, excluded) VALUES
('99', 'Vichada', true);

-- 2. Insertar municipios (muestra de 100)
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05001', 'Medellín', '05', 6.2476433298350456, -75.56581512674175, 2634570);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05002', 'Abejorral', '05', 5.789752220317858, -75.42801798081977, 21622);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05004', 'Abriaquí', '05', 6.632671855611354, -76.06634729235577, 2872);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05021', 'Alejandría', '05', 6.3758395606004665, -75.14173816788407, 4989);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05030', 'Amagá', '05', 6.037330096067161, -75.70228728755724, 32628);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05031', 'Amalfi', '05', 6.907850375000348, -75.07445844933291, 28059);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05034', 'Andes', '05', 5.65640743604768, -75.8797579694556, 46485);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05036', 'Angelópolis', '05', 6.111378005880063, -75.7094403248297, 6183);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05038', 'Angostura', '05', 6.885613001759138, -75.33583665790619, 12190);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05040', 'Anorí', '05', 7.0736014341519295, -75.14696696735851, 19812);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05042', 'Santa Fe de Antioquia', '05', 6.559304746853023, -75.82554116710203, 28246);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05044', 'Anzá', '05', 6.303238881174947, -75.85388812497597, 7537);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05045', 'Apartadó', '05', 7.882769586844133, -76.6246924930277, 132328);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05051', 'Arboletes', '05', 8.850274356239412, -76.42637467965854, 32478);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05055', 'Argelia', '05', 5.7308674957602515, -75.14247722196589, 8075);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05059', 'Armenia', '05', 6.156330024755748, -75.78762726825538, 5450);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05079', 'Barbosa', '05', 6.437959528588674, -75.33181557795535, 56505);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05086', 'Belmira', '05', 6.605081889642885, -75.66637956683675, 6436);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05088', 'Bello', '05', 6.336763653573097, -75.55959318370923, 570329);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05091', 'Betania', '05', 5.7465062602781725, -75.97766476712631, 10985);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05093', 'Betulia', '05', 6.112734623288922, -75.9844927934408, 16722);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05101', 'Ciudad Bolívar', '05', 5.850500392183661, -76.02211169407822, 27884);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05107', 'Briceño', '05', 7.113101872390654, -75.55111020393029, 8599);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05113', 'Buriticá', '05', 6.71929640851882, -75.90801482355174, 10105);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05120', 'Cáceres', '05', 7.579035704425523, -75.34959846701801, 31368);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05125', 'Caicedo', '05', 6.40528772140429, -75.98355033800924, 8938);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05129', 'Caldas', '05', 6.09148251360607, -75.63527279939754, 86667);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05134', 'Campamento', '05', 6.979542492897042, -75.2965070416172, 9839);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05138', 'Cañasgordas', '05', 6.750924304278618, -76.0259782283167, 16487);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05142', 'Caracolí', '05', 6.408632055869871, -74.75760976793387, 4850);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05145', 'Caramanta', '05', 5.548931830943378, -75.64347491624282, 4973);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05147', 'Carepa', '05', 7.755265645030667, -76.65576935168818, 52540);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05148', 'El Carmen de Viboral', '05', 6.0879187954086635, -75.33749033658717, 64717);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05150', 'Carolina', '05', 6.72376952619297, -75.2810908789624, 4242);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05154', 'Caucasia', '05', 7.9832059610386175, -75.19816855645493, 98488);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05172', 'Chigorodó', '05', 7.664552020907265, -76.67748789767046, 62675);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05190', 'Cisneros', '05', 6.538261737928017, -75.08703128733278, 10495);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05197', 'Cocorná', '05', 6.057353796248057, -75.18553604732078, 16686);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05206', 'Concepción', '05', 6.394628052728446, -75.25756740774064, 5093);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05209', 'Concordia', '05', 6.04628007144264, -75.90674378923651, 22905);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05212', 'Copacabana', '05', 6.3578708942762026, -75.50510827542881, 84787);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05234', 'Dabeiba', '05', 6.998103222440198, -76.25950941641788, 24765);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05237', 'Donmatías', '05', 6.485679854635288, -75.3938152676658, 20498);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05240', 'Ebéjico', '05', 6.3266485461438355, -75.76741843443607, 12914);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05250', 'El Bagre', '05', 7.604943133556276, -74.80900367820118, 56681);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05264', 'Entrerríos', '05', 6.566282959717698, -75.51697700819486, 12158);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05266', 'Envigado', '05', 6.167291852827353, -75.58369497631188, 250012);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05282', 'Fredonia', '05', 5.927175691712644, -75.6721987799032, 26163);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05284', 'Frontino', '05', 6.7730070924247485, -76.13134509980789, 22049);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05306', 'Giraldo', '05', 6.680772118405426, -75.95322325454516, 5988);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05308', 'Girardota', '05', 6.377428995821943, -75.44556767918492, 56312);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05310', 'Gómez Plata', '05', 6.681796677634777, -75.21973962834645, 10464);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05313', 'Granada', '05', 6.139836264452333, -75.18283515819974, 10855);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05315', 'Guadalupe', '05', 6.81474647043332, -75.24018030579002, 7015);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05318', 'Guarne', '05', 6.282546759556999, -75.44464353324024, 60148);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05321', 'Guatapé', '05', 6.2338496770873935, -75.15929455085814, 9072);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05347', 'Heliconia', '05', 6.208321434703683, -75.73267016303923, 5754);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05353', 'Hispania', '05', 5.799136942336142, -75.9084036607576, 5876);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05360', 'Itagüí', '05', 6.168297587984889, -75.61879464100878, 301428);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05361', 'Ituango', '05', 7.172231174068721, -75.76439900558287, 29074);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05364', 'Jardín', '05', 5.598821019865199, -75.81981810182697, 15637);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05368', 'Jericó', '05', 5.7914371414059, -75.78472803664121, 14576);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05376', 'La Ceja', '05', 6.029905137698197, -75.43057258236018, 70868);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05380', 'La Estrella', '05', 6.151153193679575, -75.63662451337399, 78143);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05390', 'La Pintada', '05', 5.7469939793022045, -75.60596691210307, 8689);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05400', 'La Unión', '05', 5.973846915386043, -75.36097782604449, 23240);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05411', 'Liborina', '05', 6.677599170129652, -75.811829980769, 10709);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05425', 'Maceo', '05', 6.551319161960968, -74.78769076527406, 8785);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05440', 'Marinilla', '05', 6.173043272545287, -75.33789137869697, 70392);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05467', 'Montebello', '05', 5.945736427098339, -75.52418258484511, 7062);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05475', 'Murindó', '05', 6.980630530762106, -76.82168912309928, 5332);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05480', 'Mutatá', '05', 7.244097191947022, -76.43672519645885, 15148);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05483', 'Nariño', '05', 5.609707775486118, -75.17727730781434, 10889);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05490', 'Necoclí', '05', 8.42578818064993, -76.7825615065924, 45834);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05495', 'Nechí', '05', 8.091723256420707, -74.77564629452856, 28100);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05501', 'Olaya', '05', 6.628041360364222, -75.81247572775065, 3350);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05541', 'Peñol', '05', 6.220020099829339, -75.24352824273964, 22736);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05543', 'Peque', '05', 7.02143107093327, -75.9088118183259, 8717);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05576', 'Pueblorrico', '05', 5.793652496081632, -75.83838069933195, 9280);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05579', 'Puerto Berrío', '05', 6.48954233810127, -74.4047633986412, 42468);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05585', 'Puerto Nare', '05', 6.186440738286221, -74.58374552007751, 15350);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05591', 'Puerto Triunfo', '05', 5.872525375961843, -74.63988606625897, 19688);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05604', 'Remedios', '05', 7.028136873596584, -74.69360480152031, 30723);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05607', 'Retiro', '05', 6.06097687967412, -75.50263076532227, 25589);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05615', 'Rionegro', '05', 6.149025305920226, -75.37895302164341, 147907);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05628', 'Sabanalarga', '05', 6.853736954193193, -75.8169670780503, 9731);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05631', 'Sabaneta', '05', 6.150394685310916, -75.61681204228806, 90253);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05642', 'Salgar', '05', 5.963483193342744, -75.96372255693913, 19448);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05647', 'San Andrés de Cuerquía', '05', 6.913258250682361, -75.67563985786794, 7697);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05649', 'San Carlos', '05', 6.188012917274818, -74.99315482711108, 17103);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05652', 'San Francisco', '05', 5.964393423381931, -75.10370803996481, 6048);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05656', 'San Jerónimo', '05', 6.442835958971035, -75.72777044109547, 16609);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05658', 'San José de la Montaña', '05', 6.849739572087521, -75.68411764742098, 3941);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05659', 'San Juan de Urabá', '05', 8.760647546551176, -76.52821477997475, 21853);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05660', 'San Luis', '05', 6.043262085245662, -74.99450365667005, 13893);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05664', 'San Pedro de los Milagros', '05', 6.459785681071824, -75.5598940118175, 23751);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05665', 'San Pedro de Urabá', '05', 8.277285516357935, -76.3795712602558, 33393);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05667', 'San Rafael', '05', 6.295134948815488, -75.0278689086913, 16753);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05670', 'San Roque', '05', 6.485843328863505, -75.0196221562986, 23105);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05674', 'San Vicente Ferrer', '05', 6.281219458487696, -75.33312535853946, 23714);

-- 3. Insertar matriz de adyacencia
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('05', '13');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('05', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('05', '17');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('05', '23');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('05', '27');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('05', '66');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('05', '68');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('08', '13');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('08', '47');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '17');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '25');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '41');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '50');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('11', '85');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('13', '08');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('13', '20');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('13', '23');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('13', '47');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('13', '68');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('13', '70');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('15', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('15', '17');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('15', '25');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('15', '54');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('15', '68');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('15', '81');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('15', '85');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('17', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('17', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('17', '25');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('17', '66');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('17', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('18', '19');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('18', '41');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('18', '50');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('18', '86');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('18', '91');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('18', '95');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('18', '97');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('19', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('19', '41');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('19', '52');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('19', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('19', '76');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('19', '86');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('20', '13');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('20', '44');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('20', '47');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('20', '54');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('20', '68');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('23', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('23', '13');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('23', '70');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '11');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '17');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '41');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '50');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('25', '85');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('27', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('27', '66');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('27', '76');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('41', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('41', '19');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('41', '25');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('41', '50');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('41', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('44', '20');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('44', '47');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('47', '08');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('47', '13');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('47', '20');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('50', '11');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('50', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('50', '25');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('50', '41');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('50', '85');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('50', '95');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('50', '99');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('52', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('52', '86');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('54', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('54', '20');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('54', '68');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('54', '81');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('63', '66');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('63', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('63', '76');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('66', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('66', '17');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('66', '27');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('66', '63');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('66', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('66', '76');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('68', '05');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('68', '13');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('68', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('68', '20');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('68', '54');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('70', '13');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('70', '23');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('73', '17');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('73', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('73', '25');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('73', '41');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('73', '63');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('73', '66');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('73', '76');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('76', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('76', '19');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('76', '27');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('76', '63');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('76', '66');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('76', '73');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('81', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('81', '54');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('81', '85');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('81', '99');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('85', '15');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('85', '25');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('85', '50');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('85', '81');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('85', '99');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('86', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('86', '19');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('86', '52');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('86', '91');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('91', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('91', '86');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('91', '97');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('94', '95');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('94', '97');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('94', '99');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('95', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('95', '50');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('95', '94');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('95', '97');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('95', '99');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('97', '18');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('97', '91');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('97', '94');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('97', '95');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('99', '50');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('99', '81');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('99', '85');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('99', '94');
INSERT INTO department_adjacency (department_code, adjacent_department_code) VALUES
('99', '95');

-- 4. Insertar KAMs
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Barranquilla', '08001', 11.002689878603764, -74.81448489302309, true, 240, 2, '#0000FF');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Bucaramanga', '68001', 7.126714307270854, -73.11446761061566, true, 240, 2, '#000000');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Cali', '76001', 3.452424382685351, -76.4931246763714, true, 240, 2, '#008000');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Cartagena', '13001', 10.420495819286762, -75.53385812286801, true, 240, 2, '#FFC0CB');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Cúcuta', '54001', 7.89752044391865, -72.5062011718628, true, 240, 2, '#000000');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Medellín', '05001', 6.262431895656156, -75.56404755453853, true, 240, 2, '#FF1493');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Montería', '23001', 8.751549528798737, -75.88373388085706, true, 240, 2, '#000000');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Neiva', '41001', 2.932486149243003, -75.28494502446691, true, 240, 2, '#8B4513');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Pasto', '52001', 1.222545892365123, -77.28277453386823, true, 240, 2, '#808080');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Pereira', '66001', 4.817888136171111, -75.69976105300874, true, 240, 2, '#4B0082');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Sincelejo', '70001', 9.303929148438568, -75.39277521496017, true, 240, 2, '#00FF00');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Chapinero', '1100102', 4.633794896229732, -74.06733995774036, true, 240, 2, '#FFFF00');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Engativá', '1100110', 4.7070992225391795, -74.10950060822498, true, 240, 2, '#000000');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM San Cristóbal', '1100104', 4.570360700521882, -74.0884026481501, true, 240, 2, '#00FFFF');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Kennedy', '1100108', 4.616406790731776, -74.15623608648288, true, 240, 2, '#000000');
INSERT INTO kams (name, area_id, lat, lng, enable_level2, max_travel_time, priority, color) VALUES
('KAM Valledupar', '20001', 10.47088147604149, -73.2538037172899, true, 240, 2, '#000000');

-- 5. Insertar hospitales (muestra de 100)
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891855438-1', 'Empresa Social del Estado Hospital Regional de Duitama', '15', '15238', NULL, 5.811809594399092, -73.03132800552976, 135);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800099652-1', 'Clínica La Carolina S.A.S.', '11', '11001', '1100101', 4.704414702155407, -74.0410900002528, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900218628-1', 'Centro Médico San Luis Clínica Quirúrgica S.A.S.', '25', '25126', NULL, 4.915446839579079, -74.02548280112961, 33);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901602010-1', 'Clínica Mar Azul IPS S.A.S.', '13', '13001', NULL, 10.408202568951646, -75.50435472476818, 7);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800234860-1', 'Litotricia S.A.', '13', '13001', NULL, 10.396941284929628, -75.55682774891326, 7);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805023423-2', 'Clínica Nuestra Sede Ibagué', '73', '73001', NULL, 4.430546544280079, -75.19983495103688, 94);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891501676-1', 'Hospital Susana López de Valencia', '19', '19001', NULL, 2.437339515698292, -76.61925030199892, 230);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900957139-1', 'Servicios de Salud Especializados S.A.S.', '44', '44001', NULL, 11.54586071237626, -72.90950921945657, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890900650-1', 'Clínica de Oftalmología Santa Lucía', '05', '05001', NULL, 6.215478559392075, -75.56977939900673, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800152970-1', 'Hospital Regional de Miraflores E.S.E.', '15', '15455', NULL, 5.195493743750158, -73.14269592674758, 19);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900335692-1', 'Corporación Para La Salud Integral S.A.S. - Corposalud S.A.S.', '52', '52001', NULL, 1.2207400733234774, -77.28178874184842, 78);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805023423-1', 'Clínica Nuestra Sede Cartagena', '13', '13001', NULL, 10.39187475946568, -75.47903273304597, 88);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900064250-1', 'Unidad Clínica San Nicolas Limitada', '68', '68081', NULL, 7.062145747111648, -73.85954526159104, 39);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802019573-1', 'Clínica Porvenir Limitada', '08', '08758', NULL, 10.92906093046752, -74.76399515516277, 66);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890500309-1', 'Clínica Norte S.A.', '54', '54001', NULL, 7.879263273494847, -72.498303857623, 42);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891079999-1', 'E.S.E. Hospital San Jerónimo de Montería', '23', '23001', NULL, 8.746768823999886, -75.88095883468498, 195);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890905177-1', 'E.S.E. Hospital La María', '05', '05001', NULL, 6.286464322006945, -75.57412433595582, 201);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('832001411-1', 'Empresa Social del Estado Hospital San Rafael de Cáqueza', '25', '25151', NULL, 4.405993675648094, -73.94911449516907, 59);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('846003067-1', 'Clínica Crear Visión', '86', '86001', NULL, 1.1533600674989988, -76.64677850905524, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900485519-1', 'Clínica VIP Centro de Medicina Internacional', '11', '11001', '1100102', 4.684992538249309, -74.05647242070954, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900772387-1', 'Clínica Alta Complejidad de Aguachica S.A.S.', '20', '20011', NULL, 8.309270302327848, -73.60855947238545, 155);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900678145-1', 'IPS Clinitrauma', '15', '15572', NULL, 5.97325419126968, -74.57780835194671, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901597551-1', 'Cliniverso', '05', '05088', NULL, 6.337651871793532, -75.54578535372055, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900374792-1', 'Instituto Nacional de Oftalmología S.A.', '11', '11001', '1100101', 4.703419656527395, -74.02930098036175, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891409981-1', 'Clínica Los Rosales S.A.', '66', '66001', NULL, 4.81354221805447, -75.69973815499264, 239);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900601052-1', 'Unidad Pediátrica Simón Bolívar IPS S.A.S.', '20', '20001', NULL, 10.456428959171118, -73.24808244570872, 263);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900038029-1', 'Odontig Clínica dental', '47', '47001', NULL, 11.237766142852204, -74.2013196639611, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900291018-1', 'Clínica Los Nogales S.A.S.', '11', '11001', '1100102', 4.682832968516384, -74.0571619852809, 241);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891800231-1', 'Empresa Social del Estado Hospital Universitario San Rafael de Tunja', '15', '15001', NULL, 5.540442503611016, -73.36126107027229, 226);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890400693-1', 'Clínica Blas de Lezo S.A.', '13', '13001', NULL, 10.391861874486914, -75.48683757967747, 205);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890399047-1', 'E.S.E. Hospital departamental Mario Correa Rengifo', '76', '76001', NULL, 3.3870349535966984, -76.55803413311428, 121);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900753224-1', 'Unidad Quirúrgica Cálida S.A.S.', '76', '76001', NULL, 3.419853774870415, -76.54739142400949, 14);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901221353-1', 'Clínica Altos del Prado', '08', '08001', NULL, 11.001552408643978, -74.81170082509617, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800099860-1', 'E.S.E. Hospital San Rafael de Pacho', '25', '25513', NULL, 5.130649273498971, -74.16030421683267, 86);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802001084-1', 'I.P.S. Clínica Santa Ana de Baranoa Ltda.', '08', '08078', NULL, 10.79542456975034, -74.91353432412144, 38);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900482242-1', 'Centro Hospitalario Serena del Mar Sa', '13', '13001', NULL, 10.506879720459802, -75.46667318943247, 152);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901535908-1', 'Central de Especialidades Hospitalarias Y Quirúrgicas S.A.S.', '44', '44001', NULL, 11.54663974295849, -72.91140248788066, 36);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('817001773-1', 'IPSI MINGA AICIpsi Minga Sede Manuel Quintín Lame', '19', '19001', NULL, 2.4549080885748524, -76.60173091540837, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900012404-1', 'Clínica Aynan Ltda.', '86', '86001', NULL, 1.1530365848976196, -76.65244556868763, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890100275-1', 'IPS Clínica del Caribe', '08', '08001', NULL, 11.001534421459144, -74.81305650189144, 87);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901145394-1', 'Loscobos Medical Center S.A.S. - Loscobos', '11', '11001', '1100101', 4.710636981918698, -74.03229634336445, 254);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830023202-2', 'Clínica Rey David', '76', '76001', NULL, 3.42681918146714, -76.53832017784602, 109);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900884937-1', 'IPS Cabecera S.A.S.', '68', '68001', NULL, 7.1141325787093725, -73.10775991929727, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900421895-1', 'Fundación Clínica del Norte', '05', '05088', NULL, 6.342933259564552, -75.54606044968178, 138);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900442930-1', 'Dolormed Centro Integral En Manejo de Dolor S.A.S.', '76', '76834', NULL, 4.085609639177904, -76.1911142619817, 3);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890680031-1', 'E.S.E. Hospital San Antonio de Arbeláez', '25', '25053', NULL, 4.272561477, -74.41677569, 13);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891900343-1', 'E.S.E. Hospital departamental San Antonio de Roldanillo Empresa Social del Estado', '76', '76622', NULL, 4.404512810292477, -76.15219594503776, 35);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900550254-1', 'Clínica Esensa', '76', '76001', NULL, 3.415911084483553, -76.53785548241716, 91);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800153463-1', 'Clínica Revivir Sa', '68', '68001', NULL, 7.110657522025528, -73.11315140271121, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800209891-1', 'Clínica Asotrauma S.A.S.', '73', '73001', NULL, 4.437434942637705, -75.21989550957662, 38);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805027743-1', 'Clínica Santa Gracia - Dumian Medical S.A.S.', '19', '19001', NULL, 2.4592439466742224, -76.60284635580634, 92);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900408220-1', 'Nueva Clínica Sagrado Corazón S.A.S.', '05', '05001', NULL, 6.242847418268389, -75.55734870218697, 104);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900393235-1', 'Klinimeqx 147', '11', '11001', '1100101', 4.729950583606929, -74.04631249290854, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830040256-1', 'Hospital Militar Central', '11', '11001', '1100102', 4.635511182922544, -74.06222077819245, 475);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901781428-1', 'Clínica Santo Tomas Salud IPS S.A.S.', '20', '20001', NULL, 10.476918028096458, -73.24940512956763, 82);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805026771-1', 'Recuperar S.A. IPS - 3', '76', '76001', NULL, 3.4232113756081683, -76.54637971425878, 56);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890938774-1', 'Clínica del Prado Ciudad del Rio', '05', '05001', NULL, 6.222452448815396, -75.5748578478459, 150);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900146633-1', 'Unidad Vascular S.A.S.', '19', '19001', NULL, 2.452023018228608, -76.59935641235616, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901439816-1', 'IPS San José de Santa Ana S.A.S.', '47', '47707', NULL, 9.32019936103718, -74.57263155765082, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800084206-1', 'Hospital Local del Norte', '68', '68001', NULL, 7.14904863058648, -73.13468365866615, 65);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900484802-1', 'Clínica Victoria', '11', '11001', '1100104', 4.55268182176747, -74.09457411403845, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900304958-1', 'Sociedad San José de Torices S.A.', '13', '13001', NULL, 10.431934538542462, -75.53473697419038, 59);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892000501-1', 'Hospital departamental de Villavicencio E.S.E.', '50', '50001', NULL, 4.1448063015300365, -73.64374994059658, 281);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890501438-1', 'Empresa Social del Estado Hospital Emiro Quintero Cañizares', '54', '54498', NULL, 8.254393810926054, -73.35847408706732, 160);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860015536-1', 'Hospital Universitario San Ignacio', '11', '11001', '1100102', 4.628464444859768, -74.0642961859758, 310);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900180747-1', 'IPS Puente del Medio', '52', '52835', NULL, 1.8075399253154312, -78.76437277668485, 142);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891856372-1', 'Clínica de Especialistas S.A.', '15', '15759', NULL, 5.716517085893189, -72.92556490829342, 51);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901421601-1', 'Hospital de La Gente Sede Quirúrgica', '50', '50001', NULL, 4.140610304736505, -73.6371507716327, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830073010-1', 'Mediport Bs', '11', '11001', '1100101', 4.703851089887817, -74.02986652630322, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890981536-1', 'Empresa Social del Estado Hospital San Rafael de Yolombó', '05', '05890', NULL, 6.590470955897048, -75.01753906554808, 67);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890300516-1', 'Clínica San Fernando S.A.', '76', '76001', NULL, 3.427928795498013, -76.54585322047699, 9);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901227264-1', 'Clínica Inmaculada', '47', '47189', NULL, 11.009276795140783, -74.25211573685867, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901043802-1', 'Clínica Integral de Fracturas Lomas Verdes', '23', '23417', NULL, 9.245670191054826, -75.81275798184588, 38);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800162636-1', 'Centro Quirúrgico de La Sabana S.A. - Cirusabana S.A.', '11', '11001', '1100101', 4.695803118796537, -74.03126236811453, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('814006170-1', 'Clínica de Ortopedia Y Fracturas Traumedical S.A.S.', '52', '52001', NULL, 1.2255215713956804, -77.28454547000314, 30);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900138815-1', 'Clínica Unidad Materno Infantil del Tolima', '73', '73001', NULL, 4.438571704025374, -75.19980348835635, 48);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900261353-1', 'Fundación Hospital San Vicente de Paul Rionegro', '05', '05001', NULL, 6.262664587034767, -75.56560692494656, 203);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805027743-2', 'Clínica San Rafael Dumian Girardot', '25', '25307', NULL, 4.296626982346849, -74.79827393464505, 105);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890801989-1', 'Hospital departamental San Juan de Dios de Riosucio Caldas E.S.E.', '17', '17614', NULL, 5.428477542352105, -75.70296787055099, 47);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900722891-1', 'Leblanc Clínica de Cirugía Plástica', '54', '54001', NULL, 7.888800625522722, -72.49070508021187, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800191916-1', 'Clínica San Francisco S.A.', '76', '76834', NULL, 4.083786615485008, -76.19045328382761, 66);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890981137-1', 'Empresa Social del Estado Hospital Francisco Valderrama', '05', '05837', NULL, 8.094265007594469, -76.71451682270741, 102);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891800570-1', 'Empresa Social del Estado Hospital José Cayetano Vásquez', '15', '15572', NULL, 5.97265356130759, -74.57782846189266, 35);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805029464-1', 'Unidad Quirúrgica Plásticos Cirujanos S.A.', '76', '76001', NULL, 3.4148870554322235, -76.53819734799957, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900540156-1', 'Fundación Clínica del Rio', '23', '23001', NULL, 8.751278481543796, -75.88631906168824, 71);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900282439-1', 'Fundación Amiga del Paciente', '54', '54518', NULL, 7.377458747214097, -72.64649741661295, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890212568-1', 'Fundación Cardiovascular de Colombia - Instituto Cardiovascular', '68', '68276', NULL, 7.072752947086473, -73.11015799172242, 693);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800017308-1', 'Clínica La Sabana S.A.', '11', '11001', '1100101', 4.688444734184593, -74.05187997080502, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805023423-3', 'Clínica Nuestra', '76', '76001', NULL, 3.425181072537963, -76.53350321094399, 223);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900720497-1', 'Quirutraumas del Caribe S.A.S.', '47', '47288', NULL, 10.513080215357634, -74.18331054986287, 47);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890981374-1', 'Fundación Instituto Neurológico de Colombia', '05', '05001', NULL, 6.252429230221559, -75.56340068985605, 40);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900102024-1', 'Mediclínico Santa Ana IPS S.A.S.', '11', '11001', '1100111', 4.696599111926684, -74.0755832327179, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800094898-1', 'Katzweingort Y Cia Ltda. Clínica La Merced', '08', '08001', NULL, 10.98362158337306, -74.79816164809509, 175);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890703630-1', 'Sociedad Médicoquirúrgica del Tolima Sociedad Anónima Y/O Clínica Tolima S.A.', '73', '73001', NULL, 4.441795240749036, -75.24176954557169, 116);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901190692-1', 'Espíritu Santo Cirugía Ambulatoria S.A.S. IPS', '19', '19001', NULL, 2.4788484515927336, -76.59480142720301, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890980757-1', 'E.S.E. Hospital Cesar Uribe Piedrahita', '05', '05154', NULL, 7.995896895722694, -75.19687574284218, 111);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900848340-1', 'Clínica Central del Quindío S.A.S.', '63', '63001', NULL, 4.544850577005966, -75.66150942255632, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999032-2', 'Hospital Regional de Zipaquirá', '25', '25899', NULL, 5.016202457050314, -74.00384034464943, 232);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900011833-1', 'Clínica Santana', '81', '81001', NULL, 7.0843597938188845, -70.75101976008281, 7);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890480135-1', 'Hospital Infantil Napoleón Franco Pareja', '13', '13001', NULL, 10.407398963989133, -75.51737227761859, 195);

-- Nota: Las asignaciones se deben generar ejecutando el algoritmo OpMap
-- y guardando los resultados en la tabla 'assignments'
