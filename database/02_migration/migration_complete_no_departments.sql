-- Script de migración COMPLETO de datos OpMap a Supabase
-- Versión SIN DEPARTAMENTOS (usar después de fix_departments.sql)
-- Generado el 2025-07-22 11:41:30

-- IMPORTANTE: Este script asume que ya ejecutaste fix_departments.sql
-- que insertó todos los departamentos.

-- 1. Insertar municipios (TODOS)
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
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05679', 'Santa Bárbara', '05', 5.87410568600538, -75.56740006448115, 28051);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05686', 'Santa Rosa de Osos', '05', 6.647108830203023, -75.46050652257576, 39340);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05690', 'Santo Domingo', '05', 6.471626965553041, -75.16442274331352, 13163);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05697', 'El Santuario', '05', 6.139287742034456, -75.26367405709074, 38386);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05736', 'Segovia', '05', 7.079749089154808, -74.70043789520054, 41222);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05756', 'Sonsón', '05', 5.7120521900469186, -75.31013913944072, 38784);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05761', 'Sopetrán', '05', 6.501557779986573, -75.7433156086783, 16200);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05789', 'Támesis', '05', 5.664906839988118, -75.7144535736408, 17270);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05790', 'Tarazá', '05', 7.58319813731093, -75.39996812928072, 29306);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05792', 'Tarso', '05', 5.864972221407948, -75.82245120120277, 6593);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05809', 'Titiribí', '05', 6.06318702612337, -75.79392831148355, 11457);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05819', 'Toledo', '05', 7.011146974914459, -75.69226740182316, 5296);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05837', 'Turbo', '05', 8.095165894266112, -76.72845693563642, 135464);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05842', 'Uramita', '05', 6.899409716143165, -76.1745155374517, 7329);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05847', 'Urrao', '05', 6.314354579048927, -76.13206597768878, 32366);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05854', 'Valdivia', '05', 7.163650109054342, -75.43921452357843, 14823);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05856', 'Valparaíso', '05', 5.615871640766776, -75.62464165783514, 6966);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05858', 'Vegachí', '05', 6.778731149212714, -74.80216270093074, 12644);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05861', 'Venecia', '05', 5.963918769786514, -75.73544896200112, 12407);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05873', 'Vigía del Fuerte', '05', 6.588134779571634, -76.89642514853887, 9827);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05885', 'Yalí', '05', 6.672814865050634, -74.84210749359434, 8152);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05887', 'Yarumal', '05', 6.962168490020818, -75.4191766839144, 44770);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05890', 'Yolombó', '05', 6.594897536970474, -75.01549856759057, 24178);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05893', 'Yondó', '05', 7.009064052933371, -73.90980146787541, 20870);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('05895', 'Zaragoza', '05', 7.4868019890958175, -74.8673622375353, 26392);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08001', 'Barranquilla', '08', 11.004103766271351, -74.80690357284891, 1342818);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08078', 'Baranoa', '08', 10.79658034618758, -74.91494729976792, 70200);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08137', 'Campo de la Cruz', '08', 10.379871565966694, -74.88192651114727, 25218);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08141', 'Candelaria', '08', 10.459783068316169, -74.88125224834953, 17839);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08296', 'Galapa', '08', 10.899645173179108, -74.88619203559703, 69022);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08372', 'Juan de Acosta', '08', 10.829190501390851, -75.0359429727773, 23730);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08421', 'Luruaco', '08', 10.610421697523464, -75.14324593883485, 31388);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08433', 'Malambo', '08', 10.857592485359877, -74.77468411530258, 144883);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08436', 'Manatí', '08', 10.449238826462924, -74.95947457374507, 22014);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08520', 'Palmar de Varela', '08', 10.740601989086327, -74.75554942150644, 32573);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08549', 'Piojó', '08', 10.748718956741547, -75.10777295040769, 7374);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08558', 'Polonuevo', '08', 10.777497046952663, -74.8530673970929, 20317);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08560', 'Ponedera', '08', 10.641770629786864, -74.75362011283909, 26872);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08573', 'Puerto Colombia', '08', 10.991383510443393, -74.95628676940662, 55835);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08606', 'Repelón', '08', 10.49476744605206, -75.12370930106897, 29193);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08634', 'Sabanagrande', '08', 10.789668379296643, -74.75539436591214, 36547);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08638', 'Sabanalarga', '08', 10.632447527143066, -74.92029225289093, 104983);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08675', 'Santa Lucía', '08', 10.325579357774712, -74.96105428817988, 18054);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08685', 'Santo Tomás', '08', 10.763375531057498, -74.75653678036066, 33555);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08758', 'Soledad', '08', 10.917118979045709, -74.7991504122788, 686339);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08770', 'Suan', '08', 10.333274784265818, -74.8800566538777, 13274);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08832', 'Tubará', '08', 10.8732219084027, -74.97802503261308, 19362);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('08849', 'Usiacurí', '08', 10.742844994831925, -74.97833782918751, 13779);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('11001', 'Bogotá, D.C.', '11', 4.711098991420385, -74.07223532804608, 7937898);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13001', 'Cartagena de Indias', '13', 10.393235522924838, -75.48322967204554, 1065881);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13006', 'Achí', '13', 8.567670252662932, -74.55580095100152, 27510);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13030', 'Altos del Rosario', '13', 8.793072639596645, -74.16103157147194, 12279);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13042', 'Arenal', '13', 8.459219749702461, -73.94098279447394, 8051);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13052', 'Arjona', '13', 10.25226484034366, -75.34822563196623, 76455);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13062', 'Arroyohondo', '13', 10.252389240026188, -75.01993868323439, 8872);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13074', 'Barranco de Loba', '13', 8.94813073689456, -74.10655238415131, 16421);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13140', 'Calamar', '13', 10.248359426313966, -74.91522024027115, 24982);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13160', 'Cantagallo', '13', 7.379717316883307, -73.91759615972336, 9148);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13188', 'Cicuco', '13', 9.276942450274882, -74.64169383872922, 14845);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13212', 'Córdoba', '13', 9.58660443480364, -74.82710058381706, 17685);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13222', 'Clemencia', '13', 10.569002564781325, -75.32579812834663, 16365);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13244', 'El Carmen de Bolívar', '13', 9.718018835467284, -75.12102606734514, 77061);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13248', 'El Guamo', '13', 10.031326700835542, -74.97605179527909, 9549);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13268', 'El Peñón', '13', 8.989708183129244, -73.95010223762205, 8209);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13300', 'Hatillo de Loba', '13', 8.956263048936508, -74.07743771058796, 13353);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13430', 'Magangué', '13', 9.241519147823594, -74.75269626514407, 147190);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13433', 'Mahates', '13', 10.237004747078515, -75.18847223264191, 30573);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13440', 'Margarita', '13', 9.153309973884339, -74.28800528821554, 11883);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13442', 'María la Baja', '13', 9.983442309118644, -75.30223951639033, 51264);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13458', 'Montecristo', '13', 8.294760401880856, -74.4751430165863, 18500);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13468', 'Santa Cruz de Mompox', '13', 9.239662800090231, -74.42544687486428, 49152);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13473', 'Morales', '13', 8.275399555811875, -73.8684266079118, 24959);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13490', 'Norosí', '13', 8.527222651157478, -74.03743465616627, 10957);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13549', 'Pinillos', '13', 8.915222321962226, -74.46228023598695, 26866);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13580', 'Regidor', '13', 8.665662596967218, -73.82195241467136, 7634);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13600', 'Río Viejo', '13', 8.588369492986079, -73.84041275192531, 11617);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13620', 'San Cristóbal', '13', 10.394317371328665, -75.06423616018165, 8798);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13647', 'San Estanislao', '13', 10.398840182386193, -75.14912822842949, 20100);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13650', 'San Fernando', '13', 9.221075893472364, -74.33335548516753, 13934);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13654', 'San Jacinto', '13', 9.829745785359949, -75.12285292736755, 26099);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13655', 'San Jacinto del Cauca', '13', 8.249727218313804, -74.7200013885019, 11175);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13657', 'San Juan Nepomuceno', '13', 9.951607170218665, -75.08372079437954, 40621);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13667', 'San Martín de Loba', '13', 8.939733506899811, -74.03912125674962, 16176);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13670', 'San Pablo', '13', 7.477781760757036, -73.9244163914293, 29948);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13673', 'Santa Catalina', '13', 10.60501078104706, -75.28851086357064, 16156);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13683', 'Santa Rosa', '13', 10.445592260968214, -75.36878318417061, 23042);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13688', 'Santa Rosa del Sur', '13', 7.9630697367334955, -74.05097864566338, 36335);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13744', 'Simití', '13', 7.957156274282577, -73.94636761262473, 20209);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13760', 'Soplaviento', '13', 10.390248557305508, -75.13976066292436, 11701);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13780', 'Talaigua Nuevo', '13', 9.303480381392577, -74.56797529858318, 14092);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13810', 'Tiquisio', '13', 8.555595281710165, -74.26470457354166, 19763);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13836', 'Turbaco', '13', 10.334696977535314, -75.41256819374053, 116223);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13838', 'Turbana', '13', 10.27318253019457, -75.44303859081624, 18037);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13873', 'Villanueva', '13', 10.444215226432199, -75.27483818715861, 26130);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('13894', 'Zambrano', '13', 9.744655701147583, -74.81640351665666, 12970);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15001', 'Tunja', '15', 5.544652121509272, -73.3578138497595, 188945);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15022', 'Almeida', '15', 4.970733825563621, -73.37863432333464, 2076);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15047', 'Aquitania', '15', 5.518208651766378, -72.88343205630555, 16648);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15051', 'Arcabuco', '15', 5.755041163067135, -73.43671533665555, 6392);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15087', 'Belén', '15', 5.989651430040601, -72.91080700511503, 8070);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15090', 'Berbeo', '15', 5.227040100279625, -73.12714952891966, 1703);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15092', 'Betéitiva', '15', 5.911137533908119, -72.80907277646641, 2083);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15097', 'Boavita', '15', 6.32978258603714, -72.58535974224527, 5487);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15104', 'Boyacá', '15', 5.45453362885332, -73.36199612291439, 5504);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15106', 'Briceño', '15', 5.690569888487606, -73.92314643614748, 2331);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15109', 'Buenavista', '15', 5.511958939235667, -73.9416773452119, 4732);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15114', 'Busbanzá', '15', 5.830404105130933, -72.88386471835176, 1219);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15131', 'Caldas', '15', 5.5543742362892505, -73.86519506521246, 3361);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15135', 'Campohermoso', '15', 5.031058061484768, -73.10386815811925, 3320);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15162', 'Cerinza', '15', 5.956477085559757, -72.94885148549832, 3991);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15172', 'Chinavita', '15', 5.166623688977558, -73.36876982876285, 3436);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15176', 'Chiquinquirá', '15', 5.615243540976909, -73.81963433870912, 61289);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15180', 'Chiscas', '15', 6.552737344153009, -72.49946186781075, 4234);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15183', 'Chita', '15', 6.1874497157047745, -72.47326557324787, 8475);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15185', 'Chitaraque', '15', 6.027576816371368, -73.44664288266773, 6306);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15187', 'Chivatá', '15', 5.558574467423203, -73.28281993521522, 3012);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15189', 'Ciénega', '15', 5.408878459518637, -73.2961057668979, 5007);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15204', 'Cómbita', '15', 5.634290640168685, -73.32319107936121, 14183);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15212', 'Coper', '15', 5.4751309789992675, -74.04512481589379, 3881);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15215', 'Corrales', '15', 5.828304818993662, -72.84473257253286, 2698);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15218', 'Covarachía', '15', 6.500159560111374, -72.73910157072861, 2967);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15223', 'Cubará', '15', 7.002081423855647, -72.10821935945506, 11392);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15224', 'Cucaita', '15', 5.543437761119535, -73.45478281222017, 4047);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15226', 'Cuítiva', '15', 5.580515503643618, -72.96602083061364, 1944);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15232', 'Chíquiza', '15', 5.639686415490562, -73.44957727536102, 5061);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15236', 'Chivor', '15', 4.88783320047785, -73.3669147498811, 2698);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15238', 'Duitama', '15', 5.8268538844936755, -73.03293608364373, 134091);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15244', 'El Cocuy', '15', 6.408897819144567, -72.44544702904734, 4477);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15248', 'El Espino', '15', 6.48292605752333, -72.49678674047743, 3269);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15272', 'Firavitoba', '15', 5.668905551329548, -72.99409638173736, 7261);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15276', 'Floresta', '15', 5.8590271466595745, -72.91965734081775, 3493);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15293', 'Gachantivá', '15', 5.7521597757396, -73.54968044512057, 3009);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15296', 'Gámeza', '15', 5.80258418936535, -72.80614079028278, 5203);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15299', 'Garagoa', '15', 5.082435791088374, -73.36485195152588, 19582);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15317', 'Guacamayas', '15', 6.459330137129847, -72.49996675467794, 1983);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15322', 'Guateque', '15', 5.0063282688086534, -73.47129207123713, 11631);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15325', 'Guayatá', '15', 4.966533242932359, -73.49025040615123, 3579);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15332', 'Güicán de la Sierra', '15', 6.463025537611531, -72.41186741119041, 4570);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15362', 'Iza', '15', 5.61288310648083, -72.98027534288173, 2125);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15367', 'Jenesano', '15', 5.385042707446118, -73.36413819233465, 7829);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15368', 'Jericó', '15', 6.145990643965923, -72.57056228800062, 4208);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15377', 'Labranzagrande', '15', 5.5626396487348515, -72.57763224847687, 3755);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15380', 'la Capilla', '15', 5.095652417719902, -73.4450480424087, 2882);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15401', 'la Victoria', '15', 5.523779717414648, -74.23449482267512, 1202);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15403', 'la Uvita', '15', 6.317518244163979, -72.55986394991714, 3246);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15407', 'Villa de Leyva', '15', 5.636425592914822, -73.52699713693006, 17787);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15425', 'Macanal', '15', 4.972209707501339, -73.31994716463079, 5396);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15442', 'Maripí', '15', 5.54952279769397, -74.00460825043582, 6147);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15455', 'Miraflores', '15', 5.195437283947027, -73.14432074801773, 9575);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15464', 'Mongua', '15', 5.754217190691956, -72.80015201017802, 4980);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15466', 'Monguí', '15', 5.724054662199831, -72.84855717116662, 4527);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15469', 'Moniquirá', '15', 5.8762145217224475, -73.57383825428185, 24596);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15476', 'Motavita', '15', 5.577893594032196, -73.36834139200715, 6072);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15480', 'Muzo', '15', 5.531604886157412, -74.10302991013948, 9186);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15491', 'Nobsa', '15', 5.771130383318033, -72.9395616049219, 17500);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15494', 'Nuevo Colón', '15', 5.3541518877627965, -73.45746446119446, 5538);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15500', 'Oicatá', '15', 5.5945618672197615, -73.3084804869918, 3085);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15507', 'Otanche', '15', 5.658378563204305, -74.18131884444782, 8699);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15511', 'Pachavita', '15', 5.140586743534425, -73.3975828658019, 2637);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15514', 'Páez', '15', 5.100429363223102, -73.05178222160563, 3499);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15516', 'Paipa', '15', 5.781334912364519, -73.11425349293461, 36778);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15518', 'Pajarito', '15', 5.293159213272934, -72.70306675912734, 2560);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15522', 'Panqueba', '15', 6.442671305249202, -72.45959531468534, 1845);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15531', 'Pauna', '15', 5.657402009128509, -73.97942944559088, 7689);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15533', 'Paya', '15', 5.626155616704864, -72.42351461483923, 2812);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15537', 'Paz de Río', '15', 5.987273067160137, -72.74854426864762, 4560);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15542', 'Pesca', '15', 5.558876422254378, -73.05075365596352, 7256);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15550', 'Pisba', '15', 5.723002926206098, -72.48486378411955, 1899);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15572', 'Puerto Boyacá', '15', 5.975494171326384, -74.59210191757816, 51143);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15580', 'Quípama', '15', 5.519771056536304, -74.17934486118989, 5308);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15599', 'Ramiriquí', '15', 5.401848228216095, -73.33574037810284, 10743);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15600', 'Ráquira', '15', 5.538595271078958, -73.63173135871689, 8618);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15621', 'Rondón', '15', 5.357278051007316, -73.2082087826057, 2564);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15632', 'Saboyá', '15', 5.697788688324622, -73.76493375470872, 14765);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15638', 'Sáchica', '15', 5.58327045714816, -73.54228514928684, 5989);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15646', 'Samacá', '15', 5.49240418194436, -73.48631971380887, 20038);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15660', 'San Eduardo', '15', 5.224597308795298, -73.07844534938644, 1793);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15664', 'San José de Pare', '15', 6.017294492532563, -73.54727343289659, 5380);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15667', 'San Luis de Gaceno', '15', 4.819269182678863, -73.16914554024801, 5919);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15673', 'San Mateo', '15', 6.40201835562792, -72.55463428705987, 3606);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15676', 'San Miguel de Sema', '15', 5.5182819049864, -73.72153271101641, 3228);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15681', 'San Pablo de Borbur', '15', 5.6519970446968815, -74.06963195478828, 7166);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15686', 'Santana', '15', 6.057185610947577, -73.48225585261763, 8230);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15690', 'Santa María', '15', 4.858749423072224, -73.26062369354759, 3767);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15693', 'Santa Rosa de Viterbo', '15', 5.874139697023975, -72.98287221005809, 14257);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15696', 'Santa Sofía', '15', 5.713735355675475, -73.6021504623923, 3442);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15720', 'Sativanorte', '15', 6.1317603960249345, -72.70783039043671, 2347);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15723', 'Sativasur', '15', 6.093247906815698, -72.71258549636124, 1177);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15740', 'Siachoque', '15', 5.512509013080537, -73.24460540513107, 7275);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15753', 'Soatá', '15', 6.333730473095847, -72.68290273216519, 9597);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15755', 'Socotá', '15', 6.041409850748205, -72.63678832782706, 7770);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15757', 'Socha', '15', 5.997114993124162, -72.69284177962255, 8592);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15759', 'Sogamoso', '15', 5.71609000416636, -72.93112738680335, 139021);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15761', 'Somondoco', '15', 4.98595662021461, -73.43300626691988, 3096);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15762', 'Sora', '15', 5.500725963705287, -73.33296991842217, 3292);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15763', 'Sotaquirá', '15', 5.765607139657373, -73.24738333001777, 8876);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15764', 'Soracá', '15', 5.500724008067542, -73.33297153155983, 6481);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15774', 'Susacón', '15', 6.230772783058625, -72.68980806370114, 2882);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15776', 'Sutamarchán', '15', 5.620000725062954, -73.6209411529527, 6648);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15778', 'Sutatenza', '15', 5.02210886449393, -73.45311921184847, 4575);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15790', 'Tasco', '15', 5.909398850322273, -72.78080951193878, 6289);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15798', 'Tenza', '15', 5.077306773601924, -73.42148045967943, 4143);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15804', 'Tibaná', '15', 5.316773598259996, -73.39794125921219, 9781);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15806', 'Tibasosa', '15', 5.747044456223945, -72.99967567172119, 14184);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15808', 'Tinjacá', '15', 5.578688375897455, -73.64719433571129, 3563);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15810', 'Tipacoque', '15', 6.420762986396344, -72.69105023102226, 3548);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15814', 'Toca', '15', 5.5663974254526085, -73.18505045182249, 9540);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15816', 'Togüí', '15', 5.937360139688568, -73.51306213435576, 4659);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15820', 'Tópaga', '15', 5.76855388162761, -72.83244780504734, 3906);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15822', 'Tota', '15', 5.560332955886766, -72.98594488339705, 5627);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15832', 'Tununguá', '15', 5.730499641045809, -73.93340769537984, 1645);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15835', 'Turmequé', '15', 5.3246458263234455, -73.49053005409478, 6598);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15837', 'Tuta', '15', 5.690540606773233, -73.22780145291603, 9008);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15839', 'Tutazá', '15', 6.032098656369384, -72.85641350439582, 2204);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15842', 'Úmbita', '15', 5.220955989991298, -73.45691559524002, 8120);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15861', 'Ventaquemada', '15', 5.366724954064965, -73.52096850929846, 17192);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15879', 'Viracachá', '15', 5.437027410888333, -73.29644808946195, 3024);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('15897', 'Zetaquira', '15', 5.282204105642063, -73.16905248701397, 4996);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17001', 'Manizales', '17', 5.06297616390714, -75.50276932023247, 459262);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17013', 'Aguadas', '17', 5.613572213190936, -75.45751233021032, 23649);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17042', 'Anserma', '17', 5.242600460537975, -75.78183433590225, 37757);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17050', 'Aranzazu', '17', 5.271896716486918, -75.4905794628789, 10910);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17088', 'Belalcázar', '17', 4.993660991425738, -75.81211815146759, 10995);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17174', 'Chinchiná', '17', 4.982736286537901, -75.60526206926417, 53884);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17272', 'Filadelfia', '17', 5.297692031536139, -75.56234391979854, 11779);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17380', 'la Dorada', '17', 5.472711167193209, -74.66798886905691, 75837);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17388', 'la Merced', '17', 5.398211979667667, -75.54703400918184, 6312);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17433', 'Manzanares', '17', 5.253721207694619, -75.15416746880176, 18872);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17442', 'Marmato', '17', 5.474719836518462, -75.60105472222679, 9341);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17444', 'Marquetalia', '17', 5.298841371433113, -75.05371819255974, 13763);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17446', 'Marulanda', '17', 5.284595859415775, -75.26064922396185, 2743);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17486', 'Neira', '17', 5.166440596888594, -75.5205466590853, 21755);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17495', 'Norcasia', '17', 5.5762649371600235, -74.8895625187849, 6168);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17513', 'Pácora', '17', 5.527998953709661, -75.45988321458096, 15866);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17524', 'Palestina', '17', 5.020183449093079, -75.62017277559156, 16121);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17541', 'Pensilvania', '17', 5.382104685028079, -75.16143087132421, 20450);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17614', 'Riosucio', '17', 5.4206842251979035, -75.70539113478804, 54360);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17616', 'Risaralda', '17', 5.163673988349153, -75.7684682397452, 11367);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17653', 'Salamina', '17', 5.402357408187402, -75.48647115694152, 20172);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17662', 'Samaná', '17', 5.413049439816149, -74.99146315893259, 21527);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17665', 'San José', '17', 5.080655713019697, -75.79168981750797, 4978);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17777', 'Supía', '17', 5.446387508063821, -75.64942061159653, 30136);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17867', 'Victoria', '17', 5.317083383957139, -74.91165195255806, 10571);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17873', 'Villamaría', '17', 5.046221787519929, -75.51139344367088, 69415);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('17877', 'Viterbo', '17', 5.060651070166173, -75.8733267621685, 13292);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18001', 'Florencia', '18', 1.615386052335481, -75.60424032437716, 180323);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18029', 'Albania', '18', 1.3291402887861492, -75.87856816845778, 4835);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18094', 'Belén de los Andaquíes', '18', 1.4161102336872486, -75.87272645345678, 11644);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18150', 'Cartagena del Chairá', '18', 1.3338497805683427, -74.84340476396609, 33032);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18205', 'Curillo', '18', 1.0340105541253617, -75.92143853108396, 8150);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18247', 'El Doncello', '18', 1.6800473730179897, -75.28332900789108, 20491);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18256', 'El Paujíl', '18', 1.571085128011277, -75.32683696526132, 19426);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18410', 'la Montañita', '18', 1.4795943690880606, -75.43646151411853, 15695);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18460', 'Milán', '18', 1.290570495896652, -75.50751040006567, 10421);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18479', 'Morelia', '18', 1.485692429005579, -75.72318144384643, 3953);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18592', 'Puerto Rico', '18', 1.9099153866817016, -75.15723577279304, 28084);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18610', 'San José del Fragua', '18', 1.331577046736058, -75.9733120317775, 13886);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18753', 'San Vicente del Caguán', '18', 2.1136490705809963, -74.77320728793244, 54932);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18756', 'Solano', '18', 0.6991492569174605, -75.25355823697653, 12196);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18785', 'Solita', '18', 0.8731202471757693, -75.61959235228342, 6421);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('18860', 'Valparaíso', '18', 1.1951581301943044, -75.70532895426034, 7395);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19001', 'Popayán', '19', 2.4448110373331895, -76.61473862390861, 346403);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19022', 'Almaguer', '19', 1.9141836882134438, -76.85483765376755, 19850);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19050', 'Argelia', '19', 2.2558091920712853, -77.24905853453696, 28420);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19075', 'Balboa', '19', 2.040975531458691, -77.21641153235113, 22863);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19100', 'Bolívar', '19', 1.836014061994789, -76.96917910990081, 40107);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19110', 'Buenos Aires', '19', 3.016102497982968, -76.64250302643092, 36190);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19130', 'Cajibío', '19', 2.623087696425075, -76.56986754584229, 45481);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19137', 'Caldono', '19', 2.797761809534986, -76.48348057825044, 43643);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19142', 'Caloto', '19', 3.0319768549360795, -76.40871578670495, 31802);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19212', 'Corinto', '19', 3.175643707791495, -76.25919555865339, 27394);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19256', 'El Tambo', '19', 2.4526998303072065, -76.811321731319, 58323);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19290', 'Florencia', '19', 1.6828786322548988, -77.07264297525654, 5572);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19300', 'Guachené', '19', 3.1329199776468224, -76.39379753788938, 20785);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19318', 'Guapi', '19', 2.572874568030281, -77.88893434912737, 29836);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19355', 'Inzá', '19', 2.548627315182827, -76.06212793875548, 31405);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19364', 'Jambaló', '19', 2.776885367966454, -76.3247569062079, 19482);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19392', 'la Sierra', '19', 2.1791991384442833, -76.76338589247668, 11518);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19397', 'la Vega', '19', 2.0024852317689987, -76.78043373642204, 26557);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19418', 'López de Micay', '19', 2.8458178014305457, -77.2480379141351, 20176);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19450', 'Mercaderes', '19', 1.795109066880756, -77.16374274617104, 25437);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19455', 'Miranda', '19', 3.2515261172278715, -76.22902322823026, 34092);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19473', 'Morales', '19', 2.753912531827919, -76.62811487342319, 42419);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19513', 'Padilla', '19', 3.2235902641081844, -76.3133516460269, 10720);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19517', 'Páez', '19', 2.6463739356192257, -75.97238675900951, 50082);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19532', 'Patía', '19', 2.0706324045225024, -77.05160270316712, 39800);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19533', 'Piamonte', '19', 1.1178555949714395, -76.32730666159424, 9919);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19548', 'Piendamó - Tunía', '19', 2.6755567095970254, -76.53337271565687, 44400);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19573', 'Puerto Tejada', '19', 3.226154939234144, -76.42304568634707, 45047);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19585', 'Puracé', '19', 2.380758494147157, -76.45562460653596, 18804);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19622', 'Rosas', '19', 2.261859160178061, -76.74062053354659, 12393);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19693', 'San Sebastián', '19', 1.8390350303232186, -76.7698011538398, 11872);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19698', 'Santander de Quilichao', '19', 3.0090086501412405, -76.48630114481463, 119121);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19701', 'Santa Rosa', '19', 1.7008664241041156, -76.57307963597943, 5757);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19743', 'Silvia', '19', 2.611610545521686, -76.37754311303887, 40773);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19760', 'Sotará Paispamba', '19', 2.2552636391993786, -76.61408998387265, 15164);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19780', 'Suárez', '19', 2.9532083349906064, -76.69369989932615, 34402);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19785', 'Sucre', '19', 2.0382628085919188, -76.92543281873792, 10163);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19807', 'Timbío', '19', 2.352688277278708, -76.68334900720885, 38470);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19809', 'Timbiquí', '19', 2.772958667267278, -77.66684802604487, 28375);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19821', 'Toribío', '19', 2.9555842395191005, -76.26843944488405, 37962);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19824', 'Totoró', '19', 2.5118097487573787, -76.4018067291364, 26832);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('19845', 'Villa Rica', '19', 3.177867078792282, -76.46788221541306, 22360);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20001', 'Valledupar', '20', 10.474247671832087, -73.24362964409679, 575225);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20011', 'Aguachica', '20', 8.309744197174643, -73.61449222371529, 130258);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20013', 'Agustín Codazzi', '20', 10.034718211695688, -73.23710691877659, 71966);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20032', 'Astrea', '20', 9.496120930914154, -73.9761195990295, 23636);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20045', 'Becerril', '20', 9.703452204706064, -73.278272457213, 25570);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20060', 'Bosconia', '20', 9.970360345261414, -73.89053365973443, 47521);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20175', 'Chimichagua', '20', 9.258034653836635, -73.81424137270835, 40249);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20178', 'Chiriguaná', '20', 9.36146321899867, -73.59969697879481, 32749);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20228', 'Curumaní', '20', 9.201060861848978, -73.54256681656113, 44176);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20238', 'El Copey', '20', 10.1489760627225, -73.96022852375019, 35502);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20250', 'El Paso', '20', 9.661434949478934, -73.74642405828267, 44223);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20295', 'Gamarra', '20', 8.31932125299743, -73.7439358394209, 17686);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20310', 'González', '20', 8.389760870303427, -73.38033634897239, 4976);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20383', 'la Gloria', '20', 8.61801496512976, -73.80227893466437, 20247);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20400', 'la Jagua de Ibirico', '20', 9.564293849616197, -73.3358978825867, 55073);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20443', 'Manaure Balcón del Cesar', '20', 10.392366935617543, -73.02708856578556, 11944);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20517', 'Pailitas', '20', 8.959665771269906, -73.62627325059375, 21933);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20550', 'Pelaya', '20', 8.688026397659014, -73.66637697987929, 24516);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20570', 'Pueblo Bello', '20', 10.415497321481938, -73.58636099660545, 31738);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20614', 'Río de Oro', '20', 8.291041407750544, -73.38756786878952, 19859);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20621', 'la Paz', '20', 10.386839347262729, -73.17063986974156, 32819);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20710', 'San Alberto', '20', 7.763669958641921, -73.39321071424585, 31090);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20750', 'San Diego', '20', 10.333971327967777, -73.18071457822835, 22369);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20770', 'San Martín', '20', 8.002576778450383, -73.51308495726201, 31503);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('20787', 'Tamalameque', '20', 8.861751353526143, -73.81075478206891, 18031);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23001', 'Montería', '23', 8.750985995766907, -75.87853574973315, 531424);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23068', 'Ayapel', '23', 8.30954236938167, -75.13996984943851, 49553);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23079', 'Buenavista', '23', 8.222948073899158, -75.4829836180483, 22969);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23090', 'Canalete', '23', 8.788162691798744, -76.24038527364964, 16690);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23162', 'Cereté', '23', 8.8889197690457, -75.78959463181658, 115013);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23168', 'Chimá', '23', 9.149384126341655, -75.6280374295696, 19160);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23182', 'Chinú', '23', 9.105966957376268, -75.40153028122899, 52063);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23189', 'Ciénaga de Oro', '23', 8.879220077208553, -75.62133261314749, 64223);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23300', 'Cotorra', '23', 9.039260214808758, -75.79051650006049, 20741);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23350', 'la Apartada', '23', 8.048051969782431, -75.33409910085334, 15933);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23417', 'Lorica', '23', 9.237640933691791, -75.81362701913534, 119228);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23419', 'los Córdobas', '23', 8.895077573418163, -76.35459518754494, 20509);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23464', 'Momil', '23', 9.23938754097532, -75.67653264690412, 21271);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23466', 'Montelíbano', '23', 7.976799169393112, -75.41720478179165, 87197);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23500', 'Moñitos', '23', 9.246122513345794, -76.13170235544526, 32657);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23555', 'Planeta Rica', '23', 8.412751382411612, -75.58404975598263, 69377);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23570', 'Pueblo Nuevo', '23', 8.50317719429044, -75.50752037506392, 38947);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23574', 'Puerto Escondido', '23', 9.019180279194446, -76.26139090560162, 25919);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23580', 'Puerto Libertador', '23', 7.887707630423631, -75.67099540576915, 45766);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23586', 'Purísima de la Concepción', '23', 9.236813340663657, -75.72353585056658, 18734);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23660', 'Sahagún', '23', 8.950637770727102, -75.4460015758558, 116988);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23670', 'San Andrés de Sotavento', '23', 9.146745240714157, -75.50901163385014, 51180);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23672', 'San Antero', '23', 9.374641301236958, -75.75852160076406, 36854);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23675', 'San Bernardo del Viento', '23', 9.352582618555378, -75.95358243375564, 40391);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23678', 'San Carlos', '23', 8.794641354597413, -75.69952472978898, 29454);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23682', 'San José de Uré', '23', 7.787321341902164, -75.53590958931923, 14830);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23686', 'San Pelayo', '23', 8.958194297056313, -75.83816329693502, 55444);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23807', 'Tierralta', '23', 8.171573742568896, -76.06230850780317, 100610);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23815', 'Tuchín', '23', 9.185871050202941, -75.55519646409843, 57361);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('23855', 'Valencia', '23', 8.25865762018739, -76.14948147503648, 38850);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25001', 'Agua de Dios', '25', 4.376580797890355, -74.67025196112753, 14503);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25019', 'Albán', '25', 4.87799119156852, -74.43828553732376, 7978);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25035', 'Anapoima', '25', 4.548939199204933, -74.53523201317248, 18246);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25040', 'Anolaima', '25', 4.76161078893528, -74.4645816278569, 17043);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25053', 'Arbeláez', '25', 4.272794908519306, -74.41601060365447, 12959);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25086', 'Beltrán', '25', 4.800987525514174, -74.74094497468103, 2217);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25095', 'Bituima', '25', 4.87281749469337, -74.53982058948893, 3004);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25099', 'Bojacá', '25', 4.732613101148535, -74.34177642079528, 12557);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25120', 'Cabrera', '25', 3.98423147817536, -74.4842241321046, 5866);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25123', 'Cachipay', '25', 4.730883021447705, -74.43736181954307, 12348);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25126', 'Cajicá', '25', 4.918716919966535, -74.02255259942926, 104598);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25148', 'Caparrapí', '25', 5.345617533327719, -74.49184181106037, 15244);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25151', 'Cáqueza', '25', 4.405632775408137, -73.94668887460581, 21147);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25154', 'Carmen de Carupa', '25', 5.348830617227363, -73.9012756469843, 9285);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25168', 'Chaguaní', '25', 4.949345758593553, -74.5938624980813, 5111);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25175', 'Chía', '25', 4.862607836423497, -74.05598462957012, 168167);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25178', 'Chipaque', '25', 4.443040859191366, -74.04400981111203, 11715);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25181', 'Choachí', '25', 4.528660947695596, -73.92296879396729, 13519);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25183', 'Chocontá', '25', 5.144813851101747, -73.68467081125715, 25682);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25200', 'Cogua', '25', 5.061245034777739, -73.97640810644133, 27695);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25214', 'Cota', '25', 4.809847838392852, -74.10183845712965, 41477);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25224', 'Cucunubá', '25', 5.250217821386958, -73.76610162812344, 9477);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25245', 'El Colegio', '25', 4.5841994442580285, -74.4452384888938, 29955);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25258', 'El Peñón', '25', 5.24862742450303, -74.29033354037846, 5665);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25260', 'El Rosal', '25', 4.852250977716167, -74.26482305166111, 26738);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25269', 'Facatativá', '25', 4.809987524986254, -74.35401059692653, 177093);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25279', 'Fómeque', '25', 4.4852170850096424, -73.89376453980682, 14841);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25281', 'Fosca', '25', 4.338955120164066, -73.93892314752662, 7068);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25286', 'Funza', '25', 4.717663996650696, -74.21187186898327, 118669);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25288', 'Fúquene', '25', 5.403937005191393, -73.7958527979354, 6002);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25290', 'Fusagasugá', '25', 4.345148172969756, -74.36181938870511, 175589);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25293', 'Gachalá', '25', 4.693040555828315, -73.5199710296332, 5279);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25295', 'Gachancipá', '25', 4.993756711593259, -73.87194964745055, 21353);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25297', 'Gachetá', '25', 4.816968255605164, -73.63630500500871, 10166);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25299', 'Gama', '25', 4.7620386653015725, -73.6103186255824, 3773);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25307', 'Girardot', '25', 4.304590308376704, -74.80314024537174, 127078);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25312', 'Granada', '25', 4.519451839293296, -74.35102841596913, 8708);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25317', 'Guachetá', '25', 5.383678595285245, -73.68693346721594, 16514);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25320', 'Guaduas', '25', 5.06780765366912, -74.59532487300598, 38181);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25322', 'Guasca', '25', 4.86723819689796, -73.87740234988993, 19120);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25324', 'Guataquí', '25', 4.517729736476331, -74.78974938238154, 3534);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25326', 'Guatavita', '25', 4.9344520027354495, -73.83133196402557, 7840);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25328', 'Guayabal de Síquima', '25', 4.876140614097077, -74.46746250209685, 5516);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25335', 'Guayabetal', '25', 4.216075599389148, -73.81429524657469, 7763);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25339', 'Gutiérrez', '25', 4.255065484728866, -74.0027694771865, 4178);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25368', 'Jerusalén', '25', 4.562725597004154, -74.69472587085313, 2741);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25372', 'Junín', '25', 4.791033172653468, -73.66303013587464, 7057);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25377', 'la Calera', '25', 4.719195482085436, -73.96908079155226, 37538);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25386', 'la Mesa', '25', 4.632143680728462, -74.46301458426156, 41213);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25394', 'la Palma', '25', 5.35843457431178, -74.39068191816165, 11494);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25398', 'la Peña', '25', 5.198887209492052, -74.39399453693913, 7175);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25402', 'la Vega', '25', 5.000530250461255, -74.3394405620176, 21300);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25407', 'Lenguazaque', '25', 5.306056849803503, -73.71214718573654, 12486);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25426', 'Machetá', '25', 5.081006362903005, -73.6080556587522, 7396);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25430', 'Madrid', '25', 4.733534546019082, -74.26240645058418, 143167);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25436', 'Manta', '25', 5.008933481702232, -73.54138555503982, 4496);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25438', 'Medina', '25', 4.508405305507038, -73.34985400662941, 9667);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25473', 'Mosquera', '25', 4.709263208858768, -74.22622993114466, 159527);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25483', 'Nariño', '25', 4.398273036282569, -74.82871789003329, 2908);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25486', 'Nemocón', '25', 5.066973674751145, -73.88069770340685, 16563);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25488', 'Nilo', '25', 4.307342024841263, -74.61993495898095, 13524);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25489', 'Nimaima', '25', 5.125363967588063, -74.3866793822239, 4392);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25491', 'Nocaima', '25', 5.069430159503291, -74.38030708824841, 7529);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25506', 'Venecia', '25', 4.08901635278008, -74.47790390076743, 5179);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25513', 'Pacho', '25', 5.132310978039392, -74.15770420036905, 30219);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25518', 'Paime', '25', 5.370625359087652, -74.1527993643722, 5033);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25524', 'Pandi', '25', 4.190653289587957, -74.48674743034769, 6148);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25530', 'Paratebueno', '25', 4.374695438198744, -73.21208450237839, 10470);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25535', 'Pasca', '25', 4.308499274413772, -74.2999926202886, 11194);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25572', 'Puerto Salgar', '25', 5.467413880625076, -74.65269167538683, 19352);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25580', 'Pulí', '25', 4.682593535308764, -74.71359812041979, 4044);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25592', 'Quebradanegra', '25', 5.117724779220447, -74.47924639869218, 5766);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25594', 'Quetame', '25', 4.3299808540325255, -73.86318796363373, 6191);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25596', 'Quipile', '25', 4.7446209953519505, -74.53336369341906, 7590);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25599', 'Apulo', '25', 4.521306005959759, -74.59370204107893, 10162);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25612', 'Ricaurte', '25', 4.277311134153332, -74.77230460347032, 16295);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25645', 'San Antonio del Tequendama', '25', 4.615942069875669, -74.35194059675088, 14706);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25649', 'San Bernardo', '25', 4.1794396423057565, -74.42156880928033, 10304);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25653', 'San Cayetano', '25', 5.301219361517314, -74.06970759607488, 5901);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25658', 'San Francisco', '25', 4.974676809144064, -74.28906927082379, 13482);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25662', 'San Juan de Rioseco', '25', 4.846894269645632, -74.622306989791, 9988);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25718', 'Sasaima', '25', 4.964426138184889, -74.43463640046298, 13312);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25736', 'Sesquilé', '25', 5.044596183183968, -73.79679666780997, 14342);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25740', 'Sibaté', '25', 4.491194427231571, -74.2593819318611, 42286);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25743', 'Silvania', '25', 4.386731974842141, -74.39944575923391, 26959);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25745', 'Simijaca', '25', 5.503844202222323, -73.85197575192754, 16111);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25754', 'Soacha', '25', 4.582726961074962, -74.21174620179644, 828947);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25758', 'Sopó', '25', 4.908607325951705, -73.9414552942233, 32725);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25769', 'Subachoque', '25', 4.929004224584823, -74.17246795886393, 18567);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25772', 'Suesca', '25', 5.103929836209151, -73.79863362685221, 21387);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25777', 'Supatá', '25', 5.061609699957192, -74.23554280117189, 6428);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25779', 'Susa', '25', 5.453831641201999, -73.81374973904302, 7982);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25781', 'Sutatausa', '25', 5.247292922947501, -73.85266225739035, 7357);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25785', 'Tabio', '25', 4.916966323841228, -74.09635747560755, 27305);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25793', 'Tausa', '25', 5.196187865418859, -73.88654546913155, 9997);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25797', 'Tena', '25', 4.655625062000378, -74.38957523381578, 11922);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25799', 'Tenjo', '25', 4.87247644654009, -74.14577493886594, 27644);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25805', 'Tibacuy', '25', 4.347832368550894, -74.45254117149939, 5334);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25807', 'Tibirita', '25', 5.052645359328284, -73.5054015466244, 3862);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25815', 'Tocaima', '25', 4.4585296891653625, -74.63684400027708, 19453);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25817', 'Tocancipá', '25', 4.965944173715194, -73.91305702740306, 49642);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25823', 'Topaipí', '25', 5.335777794937232, -74.30147057578105, 4996);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25839', 'Ubalá', '25', 4.74364863175319, -73.53499160640062, 9257);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25841', 'Ubaque', '25', 4.483763985712553, -73.93377241901774, 8231);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25843', 'Villa de San Diego de Ubaté', '25', 5.305995569774378, -73.81488684531628, 53790);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25845', 'Une', '25', 4.4025846338007035, -74.02538681594706, 8569);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25851', 'Útica', '25', 5.187957541739219, -74.48070704316096, 5202);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25862', 'Vergara', '25', 5.118237102230635, -74.34495648047555, 8304);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25867', 'Vianí', '25', 4.875745525870439, -74.5605180372361, 5380);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25871', 'Villagómez', '25', 5.273307237278285, -74.19517146228964, 2133);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25873', 'Villapinzón', '25', 5.215203853173559, -73.59462304704012, 21353);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25875', 'Villeta', '25', 5.011709460438414, -74.47036553607924, 33643);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25878', 'Viotá', '25', 4.437318149970961, -74.5218222117585, 16218);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25885', 'Yacopí', '25', 5.4599711063889345, -74.33817390485066, 14856);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25898', 'Zipacón', '25', 4.759633315906249, -74.38005054707891, 5782);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('25899', 'Zipaquirá', '25', 5.025871105779169, -74.00129919593623, 165473);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27001', 'Quibdó', '27', 5.695631183380456, -76.64980850150003, 146875);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27006', 'Acandí', '27', 8.510104660067876, -77.27898011995336, 16096);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27025', 'Alto Baudó', '27', 5.515695155758518, -76.97499968615008, 31745);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27050', 'Atrato', '27', 5.53182799412184, -76.63639857335455, 6962);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27073', 'Bagadó', '27', 5.411396817811972, -76.41637108498816, 11959);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27075', 'Bahía Solano', '27', 6.222069326798719, -77.40235228068775, 11671);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27077', 'Bajo Baudó', '27', 4.95361514482118, -77.36603395175173, 34457);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27099', 'Bojayá', '27', 6.521322647479052, -76.97284253829389, 13935);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27135', 'El Cantón del San Pablo', '27', 5.335342299907734, -76.72616036363117, 7016);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27150', 'Carmen del Darién', '27', 7.157516700510234, -76.97182497601787, 22466);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27160', 'Cértegui', '27', 5.371635547886991, -76.60856840542468, 6302);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27205', 'Condoto', '27', 5.08954569408775, -76.65208365663261, 14183);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27245', 'El Carmen de Atrato', '27', 5.899859648855042, -76.14222959857227, 9413);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27250', 'El Litoral del San Juan', '27', 4.260738727118775, -77.36578697923034, 25814);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27361', 'Istmina', '27', 5.156354685765904, -76.68735271173152, 34414);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27372', 'Juradó', '27', 7.102626674710854, -77.7620449601956, 7637);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27413', 'Lloró', '27', 5.49896688222135, -76.5413193828837, 10745);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27425', 'Medio Atrato', '27', 5.995157626858746, -76.78160992303057, 13100);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27430', 'Medio Baudó', '27', 5.049732606242704, -77.05222206164257, 17139);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27450', 'Medio San Juan', '27', 5.09765964345011, -76.69685661168967, 11945);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27491', 'Nóvita', '27', 4.956397391847059, -76.60882486139069, 10551);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27495', 'Nuquí', '27', 5.7095664395241235, -77.26669498132777, 18502);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27580', 'Río Iró', '27', 5.184751191059727, -76.47436454444897, 5983);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27600', 'Río Quito', '27', 5.555561645580824, -76.75651985159858, 9296);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27615', 'Riosucio', '27', 7.4353649400288875, -77.11126086894114, 64544);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27660', 'San José del Palmar', '27', 4.896669218286338, -76.23368181475205, 5809);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27745', 'Sipí', '27', 4.653085535995803, -76.64440653488501, 3664);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27787', 'Tadó', '27', 5.2649352045211675, -76.55953072978593, 20476);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27800', 'Unguía', '27', 8.04104972512658, -77.0931017372605, 14756);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('27810', 'Unión Panamericana', '27', 5.281226282343465, -76.6296518064154, 7627);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41001', 'Neiva', '41', 2.9344919699395953, -75.28090303119589, 388229);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41006', 'Acevedo', '41', 1.8051718664468759, -75.88834158770328, 27418);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41013', 'Agrado', '41', 2.259066405676921, -75.77247956748049, 9630);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41016', 'Aipe', '41', 3.222110533249547, -75.2374503274918, 17715);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41020', 'Algeciras', '41', 2.5232644397609723, -75.31562368530952, 24605);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41026', 'Altamira', '41', 2.0632642540247623, -75.78766553254653, 4660);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41078', 'Baraya', '41', 3.152000988675374, -75.05453173013278, 9078);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41132', 'Campoalegre', '41', 2.6851080386532233, -75.32673613762263, 33882);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41206', 'Colombia', '41', 3.3762492153943344, -74.80236608342672, 7866);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41244', 'Elías', '41', 2.0136703612635043, -75.93799913580955, 4635);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41298', 'Garzón', '41', 2.1953025940517663, -75.62734837432514, 79609);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41306', 'Gigante', '41', 2.3867695465092167, -75.54769636280203, 26926);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41319', 'Guadalupe', '41', 2.0255591675510334, -75.75895124915303, 19729);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41349', 'Hobo', '41', 2.5823992910592635, -75.44986100398144, 7927);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41357', 'Íquira', '41', 2.6491917854885574, -75.63475151833423, 10179);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41359', 'Isnos', '41', 1.9305051967919293, -76.21538175802706, 27847);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41378', 'la Argentina', '41', 2.1985656165912393, -75.97883173450275, 14218);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41396', 'la Plata', '41', 2.3889475355219383, -75.89412988524303, 67206);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41483', 'Nátaga', '41', 2.5446585268366735, -75.80886418982259, 7117);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41503', 'Oporapa', '41', 2.0257570318017093, -75.99425774158766, 12843);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41518', 'Paicol', '41', 2.449404409389622, -75.77437588230437, 7247);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41524', 'Palermo', '41', 2.8865252737332536, -75.43326831848181, 28899);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41530', 'Palestina', '41', 1.723932853253074, -76.13449292464273, 12359);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41548', 'Pital', '41', 2.2671150003707035, -75.80422401300298, 15141);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41551', 'Pitalito', '41', 1.8565250743087733, -76.04640026126769, 137170);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41615', 'Rivera', '41', 2.777885606152377, -75.25936397424343, 26742);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41660', 'Saladoblanco', '41', 1.992970165527011, -76.04416457063121, 11545);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41668', 'San Agustín', '41', 1.8799189697112932, -76.27021031031136, 36382);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41676', 'Santa María', '41', 2.938716981606838, -75.58644374275606, 11445);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41770', 'Suaza', '41', 1.976966137801251, -75.79504307299372, 24108);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41791', 'Tarqui', '41', 2.113169349605395, -75.82510449353555, 19213);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41797', 'Tesalia', '41', 2.485424413632442, -75.72732349562524, 11728);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41799', 'Tello', '41', 3.06708694712391, -75.13860175722405, 12908);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41801', 'Teruel', '41', 2.7412657810901573, -75.56847831382548, 8792);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41807', 'Timaná', '41', 1.9745277460059876, -75.93259671719416, 23943);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41872', 'Villavieja', '41', 3.220780561986935, -75.21889887306715, 7979);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('41885', 'Yaguará', '41', 2.664528636735906, -75.51804671826538, 8398);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44001', 'Riohacha', '44', 11.538425336925584, -72.91678562143163, 230407);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44035', 'Albania', '44', 11.160518339449016, -72.5916282113943, 36376);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44078', 'Barrancas', '44', 10.955556922981478, -72.79577220066106, 44488);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44090', 'Dibulla', '44', 11.272476088725801, -73.3094962539336, 47487);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44098', 'Distracción', '44', 10.896908870251398, -72.88654191134583, 15873);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44110', 'El Molino', '44', 10.652403054821297, -72.92116454613446, 8741);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44279', 'Fonseca', '44', 10.886082719247417, -72.85148195525028, 51998);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44378', 'Hatonuevo', '44', 11.066139284002018, -72.76313318489454, 24792);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44420', 'La Jagua del Pilar', '44', 10.508939639491723, -73.07175242073438, 4192);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44430', 'Maicao', '44', 11.380061586952795, -72.24224758017401, 206963);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44560', 'Manaure', '44', 11.773072762164185, -72.44590242852584, 99991);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44650', 'San Juan del Cesar', '44', 10.773137085617446, -73.00154436618197, 56829);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44847', 'Uribia', '44', 11.714780837487417, -72.26647908438422, 198368);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44855', 'Urumita', '44', 10.559937596742346, -73.01288202538066, 13016);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('44874', 'Villanueva', '44', 10.60389038806481, -72.98201896197759, 34330);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47001', 'Santa Marta', '47', 11.240363997001298, -74.21102423077524, 566650);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47030', 'Algarrobo', '47', 10.185349702518115, -74.062416346006, 17989);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47053', 'Aracataca', '47', 10.591811070322397, -74.18607067422319, 45859);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47058', 'Ariguaní', '47', 9.846947954288652, -74.23667102791677, 34491);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47161', 'Cerro de San Antonio', '47', 10.327102044661332, -74.86900208674588, 11410);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47170', 'Chivolo', '47', 10.027455206512384, -74.62384177680205, 25186);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47189', 'Ciénaga', '47', 11.008098230561158, -74.24904690950608, 134841);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47205', 'Concordia', '47', 10.258269541050746, -74.83279078573813, 12035);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47245', 'El Banco', '47', 9.003515295239511, -73.97386323682365, 74942);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47258', 'El Piñón', '47', 10.404901109982593, -74.82336358474093, 25974);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47268', 'El Retén', '47', 10.611891285070202, -74.26948417505552, 22071);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47288', 'Fundación', '47', 10.517152696003752, -74.18192685347093, 75845);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47318', 'Guamal', '47', 9.144469554602395, -74.22630548580415, 30709);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47460', 'Nueva Granada', '47', 9.800028648540211, -74.39126545755728, 22571);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47541', 'Pedraza', '47', 10.188810389349221, -74.91576058416548, 10666);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47545', 'Pijiño del Carmen', '47', 9.330180343117277, -74.4534374949762, 13842);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47551', 'Pivijay', '47', 10.462185290231632, -74.61691526985531, 42579);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47555', 'Plato', '47', 9.793830811157095, -74.78275922782771, 71294);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47570', 'Puebloviejo', '47', 10.992361417572557, -74.28403714141875, 34583);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47605', 'Remolino', '47', 10.701720072693856, -74.71667909720198, 13084);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47660', 'Sabanas de San Ángel', '47', 10.029571249141354, -74.21496381066073, 17856);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47675', 'Salamina', '47', 10.491427684239053, -74.79476553469082, 12258);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47692', 'San Sebastián de Buenavista', '47', 9.238934902877855, -74.35001574780573, 22641);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47703', 'San Zenón', '47', 9.244883995035316, -74.49845144625925, 13629);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47707', 'Santa Ana', '47', 9.3231038419589, -74.57036058403169, 28257);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47720', 'Santa Bárbara de Pinto', '47', 9.432313601177425, -74.7048735470439, 11867);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47745', 'Sitionuevo', '47', 10.776614045236265, -74.7209026012119, 31194);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47798', 'Tenerife', '47', 9.898291776582722, -74.85820471639856, 15071);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47960', 'Zapayán', '47', 10.18882021325505, -74.91595367960956, 11118);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('47980', 'Zona Bananera', '47', 10.767426350788927, -74.15888928432581, 78526);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50001', 'Villavicencio', '50', 4.149179769352355, -73.62854934236475, 593273);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50006', 'Acacías', '50', 3.9915817002884215,  -73.76528996976832, 97925);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50110', 'Barranca de Upía', '50', 4.569828687882557, -72.96530364065032, 7266);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50124', 'Cabuyaro', '50', 4.286776407048547, -72.79311725056789, 6736);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50150', 'Castilla la Nueva', '50', 3.8284842125781116, -73.6887496128273, 16102);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50223', 'Cubarral', '50', 3.7943570582051254, -73.83857487447825, 7946);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50226', 'Cumaral', '50', 4.271319945705532, -73.48829712566422, 25518);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50245', 'El Calvario', '50', 4.352403530090576, -73.71270884257854, 1930);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50251', 'El Castillo', '50', 3.5651407111929685, -73.79570326783578, 8768);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50270', 'El Dorado', '50', 3.739035238825355, -73.83512035815917, 4424);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50287', 'Fuente de Oro', '50', 3.4603732053867486, -73.61951186167423, 13503);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50313', 'Granada', '50', 3.5436513174017805, -73.70281187307246, 77074);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50318', 'Guamal', '50', 3.880475337741163, -73.7699203174537, 15783);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50325', 'Mapiripán', '50', 2.8928344013108087, -72.13381176208674, 7678);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50330', 'Mesetas', '50', 3.381996919607093, -74.043795759445, 12530);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50350', 'la Macarena', '50', 2.183197654783985, -73.78437264909928, 29573);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50370', 'Uribe', '50', 3.2392383171117887, -74.35066278063148, 10260);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50400', 'Lejanías', '50', 3.5272255049495467, -74.02241271465424, 12721);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50450', 'Puerto Concordia', '50', 2.6227898436234653, -72.75984462196358, 9296);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50568', 'Puerto Gaitán', '50', 4.314182338242533, -72.08250115320716, 46689);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50573', 'Puerto López', '50', 4.091349108853851, -72.95591416376105, 33995);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50577', 'Puerto Lleras', '50', 3.272411085892321, -73.36954129460295, 11627);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50590', 'Puerto Rico', '50', 2.941220266365981, -73.20747254058162, 13997);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50606', 'Restrepo', '50', 4.263079298126954, -73.56256540256875, 20430);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50680', 'San Carlos de Guaroa', '50', 3.7111361281511757, -73.24201070489882, 13793);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50683', 'San Juan de Arama', '50', 3.3697543974156265, -73.87160853589113, 10127);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50686', 'San Juanito', '50', 4.457918108199394, -73.67619474071392, 1447);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50689', 'San Martín', '50', 3.698491506523522, -73.6973081287852, 30310);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('50711', 'Vistahermosa', '50', 3.1278858232091693, -73.75250946286518, 19630);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52001', 'Pasto', '52', 1.205885363949564, -77.28578424437005, 415937);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52019', 'Albán', '52', 1.4737765390624853, -77.08151947313974, 10113);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52022', 'Aldana', '52', 0.882540706111575, -77.70043085740582, 7818);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52036', 'Ancuya', '52', 1.2625223147737294, -77.51446768238385, 9165);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52051', 'Arboleda', '52', 1.5030701790075562, -77.13583366462906, 9222);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52079', 'Barbacoas', '52', 1.6711130176629656, -78.13939059852908, 58878);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52083', 'Belén', '52', 1.595515472386366, -77.01644600386184, 6670);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52110', 'Buesaco', '52', 1.3846347097261782, -77.15623069094106, 25213);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52203', 'Colón', '52', 1.6446164315215988, -77.01900107400316, 8950);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52207', 'Consacá', '52', 1.2076221759929402, -77.4656610295139, 14561);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52210', 'Contadero', '52', 0.9088672812497767, -77.54800506419292, 7666);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52215', 'Córdoba', '52', 0.8535327893784895, -77.51801980208185, 16398);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52224', 'Cuaspud Carlosama', '52', 0.862317282452376, -77.72840226178282, 9753);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52227', 'Cumbal', '52', 0.9073981562187555, -77.79141050253745, 38963);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52233', 'Cumbitara', '52', 1.6479678967544293, -77.57850899337564, 6232);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52240', 'Chachagüí', '52', 1.359870839361509, -77.28284241531429, 16022);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52250', 'El Charco', '52', 2.479316687971258, -78.11020786985873, 23396);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52254', 'El Peñol', '52', 1.4534727779326582, -77.44046001828681, 7804);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52256', 'El Rosario', '52', 1.7428985569646547, -77.33513532765075, 13010);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52258', 'El Tablón de Gómez', '52', 1.4276225626058487, -77.09722377604147, 15184);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52260', 'El Tambo', '52', 1.4081133724858097, -77.39152384083583, 14996);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52287', 'Funes', '52', 1.000263729471168, -77.44916019642521, 7566);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52317', 'Guachucal', '52', 0.9610671967775076, -77.73147927511285, 20578);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52320', 'Guaitarilla', '52', 1.1303493857603801, -77.55099956028124, 12049);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52323', 'Gualmatán', '52', 0.9196475282475614, -77.56713407170993, 7445);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52352', 'Iles', '52', 0.9682296237919716, -77.52130225258678, 8049);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52354', 'Imués', '52', 1.0553034190821364, -77.49609055977352, 8029);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52356', 'Ipiales', '52', 0.8300186909408434, -77.64155018408319, 122161);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52378', 'la Cruz', '52', 1.6006727766628923, -76.97111526383307, 19655);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52381', 'la Florida', '52', 1.2986368283164957, -77.40442230641843, 10591);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52385', 'la Llanada', '52', 1.4728507773980017, -77.57984970814502, 6699);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52390', 'la Tola', '52', 2.399576011751138, -78.18970956495168, 7739);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52399', 'la Unión', '52', 1.5995478849106581, -77.13196331807166, 33657);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52405', 'Leiva', '52', 1.9354144719946609, -77.30355972545894, 10263);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52411', 'Linares', '52', 1.3509368324075235, -77.52386521554227, 10651);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52418', 'los Andes', '52', 1.4935839081807782, -77.52058504469696, 9880);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52427', 'Magüí', '52', 1.765848103585029, -78.18383054043142, 26239);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52435', 'Mallama', '52', 1.1413616303203602, -77.86473519610034, 9492);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52473', 'Mosquera', '52', 2.5072188908295905, -78.4537762603852, 12687);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52480', 'Nariño', '52', 1.2897552918877542, -77.35800831381664, 4594);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52490', 'Olaya Herrera', '52', 2.3471131285299327, -78.325457580462, 26611);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52506', 'Ospina', '52', 1.058006983114733, -77.5659417678239, 7475);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52520', 'Francisco Pizarro', '52', 2.037190346416712, -78.65848200914755, 15025);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52540', 'Policarpa', '52', 1.6289613411822241, -77.45920806201455, 10435);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52560', 'Potosí', '52', 0.8074384027158389, -77.57254429180759, 10848);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52565', 'Providencia', '52', 1.2391156467551319, -77.59746457145204, 5864);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52573', 'Puerres', '52', 0.8831548100086788, -77.50396916348846, 8943);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52585', 'Pupiales', '52', 0.8691609143075492, -77.6382257807835, 18412);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52612', 'Ricaurte', '52', 1.2116529796217388, -77.99524546772584, 20762);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52621', 'Roberto Payán', '52', 1.6964545468597325, -78.2454929804186, 13391);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52678', 'Samaniego', '52', 1.3351349438378854, -77.59619884579348, 30311);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52683', 'Sandoná', '52', 1.2835069180135024, -77.47290388698023, 21513);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52685', 'San Bernardo', '52', 1.5157566005186027, -77.04618211548147, 9695);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52687', 'San Lorenzo', '52', 1.5033397876291696, -77.21441208628266, 19508);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52693', 'San Pablo', '52', 1.6691473353935715, -77.01194156942927, 16047);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52694', 'San Pedro de Cartago', '52', 1.5528570072973038, -77.1203015325096, 7179);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52696', 'Santa Bárbara', '52', 2.450281637848745, -77.97961721152173, 14223);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52699', 'Santacruz', '52', 1.2217761284239537, -77.67702439177279, 11413);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52720', 'Sapuyes', '52', 1.0371585533190069, -77.6217507476532, 7735);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52786', 'Taminango', '52', 1.5702760597097247, -77.2808552317286, 18726);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52788', 'Tangua', '52', 1.0949320862150351, -77.39396475903885, 14244);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52835', 'San Andrés de Tumaco', '52', 1.7873049353017885, -78.7914219556191, 268311);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52838', 'Túquerres', '52', 1.0857787893386426, -77.61854601753001, 47092);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('52885', 'Yacuanquer', '52', 1.1159027320773405, -77.40054802184876, 11543);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54001', 'San José de Cúcuta', '54', 7.889099735465134, -72.49669009242636, 815891);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54003', 'Ábrego', '54', 8.07604812269331, -73.2219434422362, 36177);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54051', 'Arboledas', '54', 7.6432043674184715, -72.79920868233745, 11081);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54099', 'Bochalema', '54', 7.611241774771663, -72.64809716736532, 9436);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54109', 'Bucarasica', '54', 8.039505791142162, -72.86707365823804, 7307);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54125', 'Cácota', '54', 7.268586054116335, -72.64248721409619, 3206);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54128', 'Cáchira', '54', 7.741557117118418, -73.04966202259975, 12588);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54172', 'Chinácota', '54', 7.607077826252158, -72.60161057118562, 19976);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54174', 'Chitagá', '54', 7.1375328396703175, -72.66609275429393, 13374);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54206', 'Convención', '54', 8.469226536121829, -73.33772516887946, 21297);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54223', 'Cucutilla', '54', 7.539224486065546, -72.77299302993596, 9336);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54239', 'Durania', '54', 7.714488677954659, -72.65621604094737, 5220);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54245', 'El Carmen', '54', 8.511094722117656, -73.44760530981542, 15178);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54250', 'El Tarra', '54', 8.576745185324846, -73.09377548205303, 23617);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54261', 'El Zulia', '54', 7.938512742212863, -72.60302814278975, 30948);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54313', 'Gramalote', '54', 7.887689175040239, -72.79796546502622, 8399);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54344', 'Hacarí', '54', 8.320624781389657, -73.14625098215738, 11624);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54347', 'Herrán', '54', 7.5075245878185095, -72.48399982582949, 7905);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54377', 'Labateca', '54', 7.2992876663020425, -72.49641636857554, 7226);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54385', 'la Esperanza', '54', 7.639511152568774, -73.32731639563502, 13189);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54398', 'la Playa', '54', 8.21513954190619, -73.23781996984839, 8786);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54405', 'los Patios', '54', 7.834165541486803, -72.509909126423, 104287);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54418', 'Lourdes', '54', 7.945174839577243, -72.83228267874395, 4555);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54480', 'Mutiscua', '54', 7.300208301811713, -72.74680449986525, 4876);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54498', 'Ocaña', '54', 8.249730051740993, -73.35722618410637, 135990);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54518', 'Pamplona', '54', 7.372402721616504, -72.64745571445435, 57176);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54520', 'Pamplonita', '54', 7.436504071828439, -72.63849617645013, 6282);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54553', 'Puerto Santander', '54', 8.361492520028271, -72.41039013028514, 9935);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54599', 'Ragonvalia', '54', 7.578037457472905, -72.47555780562217, 6792);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54660', 'Salazar', '54', 7.773447070449328, -72.80943215922548, 11733);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54670', 'San Calixto', '54', 8.403177462561443, -73.20709106958836, 14618);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54673', 'San Cayetano', '54', 7.877469436033804, -72.62468841945349, 8128);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54680', 'Santiago', '54', 7.864093048445313, -72.71782436273595, 3901);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54720', 'Sardinata', '54', 8.085224042551904, -72.80085950185405, 29146);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54743', 'Silos', '54', 7.20443904978491, -72.75708898610368, 7153);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54800', 'Teorama', '54', 8.43752423782561, -73.28779100693284, 18839);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54810', 'Tibú', '54', 8.636248749202386, -72.73691139384155, 62474);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54820', 'Toledo', '54', 7.309217702735885, -72.48278815939233, 17811);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54871', 'Villa Caro', '54', 7.914828834131621, -72.97302043710025, 5778);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('54874', 'Villa del Rosario', '54', 7.8437994349862885, -72.46969246104767, 116757);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63001', 'Armenia', '63', 4.535003026966215, -75.6756913894623, 310817);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63111', 'Buenavista', '63', 4.359467501863782, -75.73856160542528, 3257);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63130', 'Calarcá', '63', 4.526781238340544, -75.63683608740477, 76735);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63190', 'Circasia', '63', 4.616127789261371, -75.63589583370573, 29789);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63212', 'Córdoba', '63', 4.391708765021685, -75.68711665913688, 5954);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63272', 'Filandia', '63', 4.674704943581444, -75.65770587174937, 12729);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63302', 'Génova', '63', 4.205333884107257, -75.7921821234845, 7809);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63401', 'la Tebaida', '63', 4.45397672089343, -75.78990132609573, 35343);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63470', 'Montenegro', '63', 4.566995612393435, -75.75009397116331, 38619);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63548', 'Pijao', '63', 4.335048412753885, -75.70500036379397, 5487);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63594', 'Quimbaya', '63', 4.624811110183964, -75.76732788682479, 32175);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('63690', 'Salento', '63', 4.640282718203164, -75.57120936631576, 9846);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66001', 'Pereira', '66', 4.8094304204408225, -75.69280287177104, 482824);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66045', 'Apía', '66', 5.106838653497836, -75.94530031326967, 12645);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66075', 'Balboa', '66', 4.949079918573092, -75.95843297969745, 6525);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66088', 'Belén de Umbría', '66', 5.200511501104144, -75.8688752888594, 25339);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66170', 'Dosquebradas', '66', 4.831860876830511, -75.68059339500091, 226152);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66318', 'Guática', '66', 5.316682870803746, -75.79942678260574, 12451);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66383', 'la Celia', '66', 5.003627098646173, -76.00329475795189, 7669);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66400', 'la Virginia', '66', 4.902238537105608, -75.88475434410445, 28555);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66440', 'Marsella', '66', 4.935962876057781, -75.73716714614113, 17240);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66456', 'Mistrató', '66', 5.297510719503161, -75.88275634824319, 17587);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66572', 'Pueblo Rico', '66', 5.222189499391521, -76.03042473675343, 16792);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66594', 'Quinchía', '66', 5.341123792232876, -75.73047943754463, 27980);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66682', 'Santa Rosa de Cabal', '66', 4.879662985829985, -75.63237339529688, 80012);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('66687', 'Santuario', '66', 5.073008129039087, -75.96344054404207, 12868);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68001', 'Bucaramanga', '68', 7.121005660154041, -73.11649845337925, 623881);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68013', 'Aguada', '68', 6.161826424006276, -73.52235726374964, 1958);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68020', 'Albania', '68', 5.7589670162252915, -73.91375697389131, 4352);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68051', 'Aratoca', '68', 6.693581688102423, -73.0188564497854, 8787);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68077', 'Barbosa', '68', 5.934368251226882, -73.61567738281019, 33341);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68079', 'Barichara', '68', 6.63535561678362, -73.22206216055164, 11242);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68081', 'Barrancabermeja', '68', 7.061719345504758, -73.85193483293516, 217742);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68092', 'Betulia', '68', 6.899245404045499, -73.2837645550673, 6313);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68101', 'Bolívar', '68', 5.986466637674426, -73.77071048093948, 12000);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68121', 'Cabrera', '68', 6.589914679257655, -73.24595122698307, 2046);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68132', 'California', '68', 7.347443371450535, -72.94641143137065, 2275);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68147', 'Capitanejo', '68', 6.529627926710332, -72.69695601738917, 5777);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68152', 'Carcasí', '68', 6.62664632761978, -72.62674302437846, 4494);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68160', 'Cepitá', '68', 6.754072960473654, -72.97280906612211, 2133);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68162', 'Cerrito', '68', 6.839904153743519, -72.69644275853089, 7159);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68167', 'Charalá', '68', 6.286774392592463, -73.14619624880163, 12924);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68169', 'Charta', '68', 7.281282000332227, -72.9681963222679, 3040);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68176', 'Chima', '68', 6.344151072316185, -73.37319213158032, 3030);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68179', 'Chipatá', '68', 6.061623782611697, -73.63719914429409, 5399);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68190', 'Cimitarra', '68', 6.315244373346802, -73.94886446961098, 35979);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68207', 'Concepción', '68', 6.769638007345738, -72.69474770117597, 6086);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68209', 'Confines', '68', 6.356580716105729, -73.24152113131872, 3272);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68211', 'Contratación', '68', 6.291077691825653, -73.47394338863982, 3896);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68217', 'Coromoro', '68', 6.295697886792039, -73.04043854388394, 5334);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68229', 'Curití', '68', 6.6063739397037535, -73.06891037583381, 13398);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68235', 'El Carmen de Chucurí', '68', 6.698247811732647, -73.51117354311997, 22758);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68245', 'El Guacamayo', '68', 6.245197047136987, -73.49745467217429, 2291);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68250', 'El Peñón', '68', 6.054727518520468, -73.8159130559625, 5443);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68255', 'El Playón', '68', 7.470681925514748, -73.20306750708917, 14313);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68264', 'Encino', '68', 6.136038036632733, -73.09866218409631, 2756);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68266', 'Enciso', '68', 6.667666189501608, -72.70024215424903, 3677);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68271', 'Florián', '68', 5.803263190836916, -73.97042687720301, 6127);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68276', 'Floridablanca', '68', 7.072104569249574, -73.1066867202435, 342373);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68296', 'Galán', '68', 6.638208427857053, -73.2874665726864, 3059);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68298', 'Gámbita', '68', 5.9461434796932435, -73.344477973935, 4251);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68307', 'Girón', '68', 7.0804329050659005, -73.17104517729639, 176745);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68318', 'Guaca', '68', 6.8762289035313255, -72.85622066348458, 6339);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68320', 'Guadalupe', '68', 6.245927751339743, -73.4184836635658, 4782);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68322', 'Guapotá', '68', 6.308335608567723, -73.32116049477358, 2533);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68324', 'Guavatá', '68', 5.955814043746505, -73.70164248557955, 4484);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68327', 'Güepsa', '68', 6.025470142856618, -73.57307507020313, 5441);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68344', 'Hato', '68', 6.543004521052229, -73.30808174342344, 2443);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68368', 'Jesús María', '68', 5.876809931088255, -73.78346863294357, 3469);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68370', 'Jordán', '68', 6.732392536633255, -73.0963415313951, 1413);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68377', 'la Belleza', '68', 5.858810469948792, -73.96548830352478, 6727);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68385', 'Landázuri', '68', 6.218838707221135, -73.80972520291695, 10782);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68397', 'la Paz', '68', 6.178945684422556, -73.59003184409164, 5267);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68406', 'Lebrija', '68', 7.114213463453681, -73.21708090667062, 46375);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68418', 'los Santos', '68', 6.755741928083391, -73.1023064841093, 15608);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68425', 'Macaravita', '68', 6.506428895709298, -72.59324398459775, 2289);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68432', 'Málaga', '68', 6.701790161518051, -72.73216779036375, 21866);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68444', 'Matanza', '68', 7.3228842111265235, -73.01580860864314, 5377);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68464', 'Mogotes', '68', 6.476788438654711, -72.97118818465393, 10966);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68468', 'Molagavita', '68', 6.673966312312174, -72.80877225517607, 4355);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68498', 'Ocamonte', '68', 6.339790988301781, -73.12215983590347, 6252);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68500', 'Oiba', '68', 6.267435503976893, -73.29994213751651, 11194);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68502', 'Onzaga', '68', 6.343555275697196, -72.81669345259559, 4329);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68522', 'Palmar', '68', 6.538814087499393, -73.29126456733792, 1501);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68524', 'Palmas del Socorro', '68', 6.406261894483545, -73.28777777873796, 2688);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68533', 'Páramo', '68', 6.416940531520439, -73.17082324169496, 4947);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68547', 'Piedecuesta', '68', 6.992000459282954, -73.05384629583565, 193440);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68549', 'Pinchote', '68', 6.532839297724515, -73.1725797125298, 5544);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68572', 'Puente Nacional', '68', 5.879071392805774, -73.67830021560728, 15716);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68573', 'Puerto Parra', '68', 6.650804620601946, -74.0565110712796, 8003);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68575', 'Puerto Wilches', '68', 7.348387572165321, -73.90277707116707, 36165);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68615', 'Rionegro', '68', 7.265061795758783, -73.15041135542356, 27283);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68655', 'Sabana de Torres', '68', 7.391880472298925, -73.49987931100723, 35145);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68669', 'San Andrés', '68', 6.813340549949007, -72.84884576423077, 9227);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68673', 'San Benito', '68', 6.127396325513065, -73.50938741602279, 3089);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68679', 'San Gil', '68', 6.554710403738718, -73.13410373293513, 64138);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68682', 'San Joaquín', '68', 6.427683569881438, -72.86766922402272, 2325);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68684', 'San José de Miranda', '68', 6.658715516441372, -72.73390403762099, 4489);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68686', 'San Miguel', '68', 6.576249808431722, -72.64529960631586, 2711);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68689', 'San Vicente de Chucurí', '68', 6.879675659561578, -73.41020150936963, 37031);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68705', 'Santa Bárbara', '68', 6.990167020829196, -72.90705687269501, 2532);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68720', 'Santa Helena del Opón', '68', 6.339464408913565, -73.6163868090741, 3601);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68745', 'Simacota', '68', 6.44311774334418, -73.3375235827599, 10882);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68755', 'Socorro', '68', 6.46867288539927, -73.264044178996, 36199);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68770', 'Suaita', '68', 6.099365070033407, -73.44317482711543, 10783);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68773', 'Sucre', '68', 5.918341304152277, -73.79166280274775, 7643);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68780', 'Suratá', '68', 7.366523878541254, -72.98398478474833, 4167);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68820', 'Tona', '68', 7.20178225454798, -72.96672243762056, 7718);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68855', 'Valle de San José', '68', 6.448162759986241, -73.14390552714332, 6444);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68861', 'Vélez', '68', 6.0098099591295355, -73.67210438816593, 26504);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68867', 'Vetas', '68', 7.3097567730998625, -72.8708299736585, 2388);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68872', 'Villanueva', '68', 6.670893998752412, -73.17483532601682, 8875);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('68895', 'Zapatoca', '68', 6.813372716778603, -73.27281119592772, 10094);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70001', 'Sincelejo', '70', 9.304668496386476, -75.39076945647705, 317629);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70110', 'Buenavista', '70', 9.320161973037074, -74.97393745910098, 11469);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70124', 'Caimito', '70', 8.790676503011378, -75.11715363142284, 17392);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70204', 'Colosó', '70', 9.494000204405086, -75.35316177865748, 9522);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70215', 'Corozal', '70', 9.323431440503246, -75.29491169987277, 72063);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70221', 'Coveñas', '70', 9.403429996905741, -75.6799383257889, 21626);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70230', 'Chalán', '70', 9.545006795464985, -75.31214732213525, 4897);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70233', 'El Roble', '70', 9.10593406917108, -75.19514340323235, 10551);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70235', 'Galeras', '70', 9.11470489680078, -75.00305865554678, 24801);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70265', 'Guaranda', '70', 8.33283576056134, -74.72498171999734, 19364);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70400', 'la Unión', '70', 8.856379284958518, -75.27783379148862, 14662);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70418', 'los Palmitos', '70', 9.380499805707695, -75.27095114597094, 25179);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70429', 'Majagual', '70', 8.539822118786986, -74.6282730806406, 42660);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70473', 'Morroa', '70', 9.331383469179094, -75.305685263793, 16734);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70508', 'Ovejas', '70', 9.525224055675725, -75.22959683721803, 24361);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70523', 'Palmito', '70', 9.332563475926637, -75.54141249108527, 16630);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70670', 'Sampués', '70', 9.184581977567817, -75.37975870730405, 53829);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70678', 'San Benito Abad', '70', 8.931473608411997, -75.03082228704501, 31633);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70702', 'San Juan de Betulia', '70', 9.273904498293431, -75.24200860587831, 14615);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70708', 'San Marcos', '70', 8.663769116288828, -75.13268607488372, 62967);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70713', 'San Onofre', '70', 9.740842155995637, -75.52013132053489, 57776);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70717', 'San Pedro', '70', 9.393756338938996, -75.06439740858453, 20515);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70742', 'San Luis de Sincé', '70', 9.245780059016543, -75.14700204135164, 33783);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70771', 'Sucre', '70', 8.812962410960049, -74.71929253780867, 33360);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70820', 'Santiago de Tolú', '70', 9.527692811893262, -75.5812937370693, 35167);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('70823', 'San José de Toluviejo', '70', 9.451370787683967, -75.43903544089322, 23641);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73001', 'Ibagué', '73', 4.444839186383243, -75.242394027038, 546003);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73024', 'Alpujarra', '73', 3.391935243215551, -74.93267023400409, 4755);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73026', 'Alvarado', '73', 4.567523261664753, -74.95290498607874, 9402);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73030', 'Ambalema', '73', 4.783107561667462, -74.76345365792179, 6929);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73043', 'Anzoátegui', '73', 4.631204506292902, -75.09461392313374, 10639);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73055', 'Armero', '73', 4.964661790622186, -74.90480064579778, 13630);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73067', 'Ataco', '73', 3.5910764123751338, -75.38172758970228, 20204);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73124', 'Cajamarca', '73', 4.441681637935325, -75.42696937599356, 19520);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73148', 'Carmen de Apicalá', '73', 4.149689151213112, -74.7202873889162, 11267);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73152', 'Casabianca', '73', 5.078554003353434, -75.11969000653797, 6469);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73168', 'Chaparral', '73', 3.7242702671668084, -75.48269790515847, 55128);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73200', 'Coello', '73', 4.287153247799448, -74.89895844281911, 8575);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73217', 'Coyaima', '73', 3.798137847638616, -75.19467960782119, 23736);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73226', 'Cunday', '73', 4.06065445592855, -74.69229566354602, 8824);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73236', 'Dolores', '73', 3.5391350105824926, -74.8981125238158, 8701);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73268', 'Espinal', '73', 4.146751144755949, -74.89642465036943, 75639);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73270', 'Falan', '73', 5.12062838430991, -74.95246959955907, 8000);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73275', 'Flandes', '73', 4.286737755067612, -74.81229680534656, 30466);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73283', 'Fresno', '73', 5.151955697757381, -75.03626770338332, 32313);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73319', 'Guamo', '73', 4.029144269789956, -74.96677272793394, 35079);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73347', 'Herveo', '73', 5.080427779936381, -75.1782505191365, 7743);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73349', 'Honda', '73', 5.207219054717311, -74.73632386584828, 26269);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73352', 'Icononzo', '73', 4.177022433177197, -74.53190320921678, 12700);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73408', 'Lérida', '73', 4.86067596420094, -74.90656288979932, 18848);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73411', 'Líbano', '73', 4.922466470009984, -75.06422792543492, 38239);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73443', 'San Sebastián de Mariquita', '73', 5.200156462417182, -74.8869177739425, 39696);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73449', 'Melgar', '73', 4.2044108645981435, -74.64441883346821, 38299);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73461', 'Murillo', '73', 4.874189096647568, -75.17042945407904, 4499);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73483', 'Natagaima', '73', 3.6254972167159827, -75.09316138933114, 14994);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73504', 'Ortega', '73', 3.935794880493022, -75.2204917497938, 34958);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73520', 'Palocabildo', '73', 5.119316199520221, -75.0238046566625, 9821);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73547', 'Piedras', '73', 4.542928044166783, -74.87810060717763, 7102);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73555', 'Planadas', '73', 3.1973576100856524, -75.6435473795443, 27601);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73563', 'Prado', '73', 3.750255628120606, -74.92963284724519, 8860);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73585', 'Purificación', '73', 3.8568333523221896, -74.93366803261648, 24185);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73616', 'Rioblanco', '73', 3.5304569020737846, -75.64350453451122, 23540);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73622', 'Roncesvalles', '73', 4.010323063247387, -75.60480511011265, 5673);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73624', 'Rovira', '73', 4.240078611966004, -75.23940401433225, 22594);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73671', 'Saldaña', '73', 3.9286228911268886, -75.01748324268766, 15013);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73675', 'San Antonio', '73', 3.9141078304120054, -75.47986418377698, 13592);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73678', 'San Luis', '73', 4.133534544071335, -75.09507674097011, 13541);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73686', 'Santa Isabel', '73', 4.713976796511572, -75.09729080041112, 5837);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73770', 'Suárez', '73', 4.047628489860037, -74.8323608945241, 3973);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73854', 'Valle de San Juan', '73', 4.197548978478175, -75.11644745110694, 5559);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73861', 'Venadillo', '73', 4.714786876004775, -74.93142118061027, 13324);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73870', 'Villahermosa', '73', 5.029594288573472, -75.11691413018936, 9842);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('73873', 'Villarrica', '73', 3.936275143199386, -74.60177955813668, 5245);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76001', 'Cali', '76', 3.451653844867965, -76.5319858999014, 2285099);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76020', 'Alcalá', '76', 4.673568180557635, -75.77912250137061, 14929);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76036', 'Andalucía', '76', 4.169247294864487, -76.16759116648386, 23054);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76041', 'Ansermanuevo', '76', 4.794533548831903, -75.994756273819, 18399);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76054', 'Argelia', '76', 4.72809776839904, -76.1208003846525, 5558);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76100', 'Bolívar', '76', 4.3383428225949165, -76.18649940578183, 16496);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76109', 'Buenaventura', '76', 3.883111289169568, -77.01931766697079, 324644);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76111', 'Guadalajara de Buga', '76', 3.894995832261334, -76.30539397042, 133907);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76113', 'Bugalagrande', '76', 4.211477864044121, -76.15568248129189, 26208);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76122', 'Caicedonia', '76', 4.334692344875573, -75.82848588646303, 29646);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76126', 'Calima', '76', 3.93027279541411, -76.48515028404002, 19461);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76130', 'Candelaria', '76', 3.4105516849246844, -76.35083101372481, 94202);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76147', 'Cartago', '76', 4.747211959282861, -75.91147651434422, 143522);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76233', 'Dagua', '76', 3.66062554238792, -76.68650864094464, 49864);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76243', 'el Águila', '76', 4.908410262890221, -76.04172752946204, 9185);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76246', 'El Cairo', '76', 4.765587476104955, -76.21985930832575, 7059);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76248', 'El Cerrito', '76', 3.684075689201308, -76.31294486933987, 58042);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76250', 'El Dovio', '76', 4.510539766597931, -76.23694948841766, 9246);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76275', 'Florida', '76', 3.3231686627727677, -76.23269716312261, 58566);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76306', 'Ginebra', '76', 3.7258938557499963, -76.26772988337395, 25186);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76318', 'Guacarí', '76', 3.7629879746135795, -76.33246972759727, 35614);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76364', 'Jamundí', '76', 3.2618585670312035, -76.54016818170662, 181942);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76377', 'la Cumbre', '76', 3.650949256616733, -76.57013162387909, 17397);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76400', 'la Unión', '76', 4.533216787718823, -76.10333854190696, 34788);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76403', 'la Victoria', '76', 4.523744935395222, -76.03613965689969, 12511);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76497', 'Obando', '76', 4.575490870447004, -75.97481973594894, 12663);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76520', 'Palmira', '76', 3.5377330254637003, -76.29723635751265, 359888);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76563', 'Pradera', '76', 3.419046240820364, -76.24122755661674, 49487);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76606', 'Restrepo', '76', 3.8235030249226742, -76.5223713250181, 16596);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76616', 'Riofrío', '76', 4.156380115329948, -76.28778084967145, 16014);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76622', 'Roldanillo', '76', 4.415371746860378, -76.15085118862136, 37806);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76670', 'San Pedro', '76', 3.994283189833093, -76.22759569238232, 18196);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76736', 'Sevilla', '76', 4.267122855101231, -75.93140406871515, 43890);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76823', 'Toro', '76', 4.609187346523071, -76.07852677096481, 15013);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76828', 'Trujillo', '76', 4.211646354478951, -76.31876639916975, 19790);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76834', 'Tuluá', '76', 4.089874338949509, -76.1915007844833, 233385);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76845', 'Ulloa', '76', 4.703044455321823, -75.73774001799131, 5847);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76863', 'Versalles', '76', 4.571045336724248, -76.19921380808003, 7475);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76869', 'Vijes', '76', 3.699864172896106, -76.44261261182622, 13324);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76890', 'Yotoco', '76', 3.8602900901860457, -76.38463551142013, 16466);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76892', 'Yumbo', '76', 3.5453401206089956, -76.4950347508657, 108895);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('76895', 'Zarzal', '76', 4.39487985606601, -76.07285660057013, 43252);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('81001', 'Arauca', '81', 7.0837980496842565, -70.76154534334523, 101658);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('81065', 'Arauquita', '81', 7.029331053836979, -71.42948090198105, 64172);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('81220', 'Cravo Norte', '81', 6.304361512530622, -70.20265908522286, 4631);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('81300', 'Fortul', '81', 6.794382963292397, -71.77155155772586, 24446);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('81591', 'Puerto Rondón', '81', 6.2826481676757195, -71.09633566403117, 5290);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('81736', 'Saravena', '81', 6.95612441755342, -71.87259174411024, 65754);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('81794', 'Tame', '81', 6.4586794276184305, -71.73478069721851, 54772);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85001', 'Yopal', '85', 5.34892403829287, -72.40052417827887, 196758);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85010', 'Aguazul', '85', 5.170858499628678, -72.55081404885269, 41758);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85015', 'Chámeza', '85', 5.213350971855745, -72.87038156641562, 2581);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85125', 'Hato Corozal', '85', 6.15861246361239, -71.761810148193, 14092);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85136', 'la Salina', '85', 6.128120587519737, -72.33434957006276, 1450);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85139', 'Maní', '85', 4.81702406015076, -72.28271125288117, 18551);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85162', 'Monterrey', '85', 4.878144164450038, -72.8964772057376, 19752);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85225', 'Nunchía', '85', 5.638113597783204, -72.19552943983442, 10139);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85230', 'Orocué', '85', 4.789404028021441, -71.33936879214407, 14280);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85250', 'Paz de Ariporo', '85', 5.880654883404679, -71.8929128611111, 41591);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85263', 'Pore', '85', 5.726577730986083, -71.99394476947698, 13068);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85279', 'Recetor', '85', 5.229559633572814, -72.76064969985558, 1601);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85300', 'Sabanalarga', '85', 4.854199282734495, -73.03929781216034, 4156);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85315', 'Sácama', '85', 6.099009949007201, -72.24819806687104, 2413);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85325', 'San Luis de Palenque', '85', 5.422616230158797, -71.73099382589623, 9135);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85400', 'Támara', '85', 5.830353224260919, -72.16305289824125, 7181);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85410', 'Tauramena', '85', 5.017089367129811, -72.7515981191885, 27184);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85430', 'Trinidad', '85', 5.407812017960988, -71.66137350432842, 15432);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('85440', 'Villanueva', '85', 4.611253918141333, -72.92812725072284, 40816);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86001', 'Mocoa', '86', 1.1478060167200232, -76.64812541590032, 65894);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86219', 'Colón', '86', 1.1900789442758017, -76.97286633581479, 5954);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86320', 'Orito', '86', 0.667715749837178, -76.87049279673411, 41474);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86568', 'Puerto Asís', '86', 0.4985085115758576, -76.497738655581, 74264);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86569', 'Puerto Caicedo', '86', 0.6842075154478708, -76.60416306879236, 17244);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86571', 'Puerto Guzmán', '86', 0.9638047481861342, -76.40798211627114, 39052);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86573', 'Puerto Leguízamo', '86', -0.19133865937602385, -74.78374787671048, 33166);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86749', 'Sibundoy', '86', 1.2046056619696601, -76.91949276297501, 17211);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86755', 'San Francisco', '86', 1.1761835428469383, -76.87571408293876, 6419);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86757', 'San Miguel', '86', 0.32939750965381104, -76.87069819899673, 21564);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86760', 'Santiago', '86', 1.1471934113988407, -77.00407544925558, 7917);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86865', 'Valle del Guamuez', '86', 0.4242071197632995, -76.90413228747988, 36335);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('86885', 'Villagarzón', '86', 1.0286794122543763, -76.61723575877888, 27494);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('88001', 'San Andrés', '88', 12.576887495093533, -81.70505272881789, 56241);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('88564', 'Providencia', '88', 13.381457070853333, -81.36574400140925, 5940);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91001', 'Leticia', '91', -4.203128361586677, -69.93591088237095, 55691);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91263', 'El Encanto', '91', -1.7471146276476341, -73.20910360440074, 2172);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91405', 'la Chorrera', '91', -1.4433486220893506, -72.78894457451256, 3246);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91407', 'la Pedrera', '91', -1.3219715451825875, -69.57838492486692, 4307);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91430', 'la Victoria', '91', -0.10598947726919503, -71.14485328122224, 702);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91460', 'Mirití - Paraná', '91', -0.7164958126997738, -71.10179895356278, 1963);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91530', 'Puerto Alegría', '91', -1.0055896789916652, -74.01424963468214, 803);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91536', 'Puerto Arica', '91', -2.149474264784632, -71.75459625907536, 1119);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91540', 'Puerto Nariño', '91', -3.780851906009626, -70.36399423046312, 11048);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91669', 'Puerto Santander', '91', -0.6218579073245563, -72.38255449030564, 1994);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('91798', 'Tarapacá', '91', -2.891828489903678, -69.74191900038201, 4435);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94001', 'Inírida', '94', 3.8702212750556986, -67.92433545671202, 38767);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94343', 'Barrancominas', '94', 3.4944590593168208, -69.81538045372938, 11326);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94883', 'San Felipe', '94', 1.9129291373241375, -67.06782114492273, 2051);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94884', 'Puerto Colombia', '94', 2.7201370436116163, -67.56526808735673, 2273);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94885', 'la Guadalupe', '94', 1.364904199077111, -67.04646217282423, 341);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94886', 'Cacahual', '94', 3.526190949911223, -67.41249661392379, 1039);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94887', 'Pana Pana', '94', 1.840811858744423, -69.00479451923952, 2371);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('94888', 'Morichal', '94', 2.263714947178891, -69.91847301821471, 1072);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('95001', 'San José del Guaviare', '95', 2.567778946213069, -72.63964960202927, 64930);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('95015', 'Calamar', '95', 1.959764769493999, -72.65428718977425, 11935);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('95025', 'El Retorno', '95', 2.3319162295259668, -72.6281279220751, 17957);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('95200', 'Miraflores', '95', 1.3374702831292078, -71.9509115074099, 8415);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('97001', 'Mitú', '97', 1.252185674391633, -70.23362136342776, 35749);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('97161', 'Carurú', '97', 1.0126482222574313, -71.29651824203697, 3708);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('97511', 'Pacoa', '97', 0.02166250603582368, -71.00379865843756, 4918);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('97666', 'Taraira', '97', -0.5643966484753307, -69.63385844136037, 2658);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('97777', 'Papunahua', '97', 1.8028602217992455, -70.71684844137091, 844);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('97889', 'Yavaraté', '97', 0.6093780896809952, -69.20323264636178, 1265);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('99001', 'Puerto Carreño', '99', 6.189911157868091, -67.48256682184875, 22963);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('99524', 'la Primavera', '99', 5.491608182717895, -70.41399522236665, 11380);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('99624', 'Santa Rosalía', '99', 5.140960459670461, -70.8590438011805, 4732);
INSERT INTO municipalities (code, name, department_code, lat, lng, population_2025) VALUES
('99773', 'Cumaribo', '99', 4.444988213476003, -69.79807667429911, 88392);

-- 2. Insertar matriz de adyacencia
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

-- 3. Insertar KAMs
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

-- 4. Insertar hospitales (TODOS)
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
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891180134-1', 'E.S.E. Hospital departamental San Antonio de Pitalito', '41', '41551', NULL, 1.8453787284778376, -76.05026934988028, 157);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900520429-1', 'Clínica Quirúrgica de Manga', '13', '13001', NULL, 10.412309098938977, -75.53662977418323, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900098476-1', 'Fundación Hospital Infantil Universitario de San José', '11', '11001', '1100112', 4.665136315274092, -74.07893605007945, 174);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800231215-1', 'Hospital del Sarare E.S.E.', '81', '81736', NULL, 6.9562034544150215, -71.8821613359353, 148);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900099151-1', 'Clínica Benedicto S.A.', '47', '47001', NULL, 11.2375398991436, -74.20112766937876, 64);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900553752-1', 'Clínica de Fracturas Tayrona IPS S.A.S.', '47', '47001', NULL, 11.237965696710868, -74.18694497441662, 9);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800215758-1', 'Clínica Santa Cruz de La Loma S.A.', '68', '68679', NULL, 6.552798357807002, -73.13467223740737, 30);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901158187-1', 'Clínica Nueva de Cali S.A.S. Sede La Quinta', '76', '76001', NULL, 3.447690347011355, -76.53610909070377, 80);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812007194-1', 'Oncomedica S.A.', '23', '23001', NULL, 8.781690771044536, -75.8605440856462, 104);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901180382-1', 'Visión Integrados S.A.S.', '05', '05001', NULL, 6.239036958943368, -75.58787304427861, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890982264-1', 'Empresa Social del Estado Hospital San Juan de Dios', '05', '05042', NULL, 6.55379960915319, -75.82315634392022, 82);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900547542-1', 'Funsalud- IPS Alianza Y Salud', '05', '05001', NULL, 6.2455889729430645, -75.61409043745469, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900330752-1', 'Fundación Fosunab', '68', '68276', NULL, 7.069962305436829, -73.11504842945598, 377);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900701446-1', 'de La Rosa Clínica & Estética S.A.S.', '08', '08001', NULL, 10.99295543792665, -74.81463099036876, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901223046-1', 'Sharon Médical Group', '73', '73001', NULL, 4.440379430310564, -75.18579262639979, 52);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('816007055-1', 'Instituto de Epilepsia Y Parkinson del Eje Cafetero S.A.', '66', '66001', NULL, 4.827118175857049, -75.73466619198886, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900910007-1', 'Cendit Centro de Diagnostico Y Tratamiento', '50', '50001', NULL, 4.145135021452405, -73.63546935449075, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901547282-1', 'Clínica Integral del Sur', '20', '20011', NULL, 8.311660490237674, -73.6149151167801, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890905154-1', 'Clínica San Juan de Dios La Ceja', '05', '05376', NULL, 6.04337842658972, -75.4276711314434, 260);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890939936-1', 'Sociedad Médica Rionegro S.A. Somer S.A.', '05', '05615', NULL, 6.14070730900199, -75.3775172255897, 275);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800250634-1', 'Medicina Integral S.A.', '23', '23001', NULL, 8.760010180469244, -75.8712087012664, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891856161-1', 'Clínica El Laguito S.A.', '15', '15759', NULL, 5.72469182241783, -72.9240704549527, 61);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('811002429-1', 'Clínica Pajonal Limitada', '05', '05154', NULL, 7.982166373787864, -75.20211863480455, 48);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('823002342-1', 'IPS Clínica de Varices S.A.S.', '70', '70001', NULL, 9.306969528437614, -75.393813910799, 3);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900279660-1', 'Promotora Bocagrande S.A. Proboca S.A.', '13', '13001', NULL, 10.39579516112651, -75.5558846411193, 86);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800112414-1', 'Clínica Ángel', '17', '17001', NULL, 5.059100468040345, -75.487096603177, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('801000713-3', 'Clínica Maraya', '66', '66001', NULL, 4.81436783419481, -75.71911397056707, 80);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900190045-1', 'Hospital Regional Manuela Beltrán Socorro', '68', '68755', NULL, 6.466746757541894, -73.26392809897133, 90);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('846000253-1', 'E.S.E. Hospital Local', '86', '86568', NULL, 0.4958042818916441, -76.49613693611353, 54);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901041691-1', 'Centro Médico Colsanitas Premium Villavicencio', '50', '50001', NULL, 4.143249373265375, -73.6429095792248, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900126068-1', 'Unidad Quirúrgica depiel', '11', '11001', '1100101', 4.711556752847948, -74.02981032471102, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891580002-1', 'Hospital Universitario San José de Popayán Empresa Social del Estado', '19', '19001', NULL, 2.4500386862540964, -76.59964015901005, 428);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901627949-1', 'Clínica Abaton IPS S.A.S.', '08', '08001', NULL, 10.939891242985729, -74.83359759763357, 39);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('820003850-1', 'Hospital Metropolitano Santiago de Tunja', '15', '15001', NULL, 5.519396164446258, -73.35814739089614, 31);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900702981-1', 'Clínica Centenario S.A.S.', '11', '11001', '1100114', 4.6059614743385255, -74.08289904981226, 150);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891480000-1', 'Clínica Comfamiliar', '66', '66001', NULL, 4.806793645742162, -75.68091334414372, 196);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890506459-1', 'Clínica Y Droguería Nuestra Señora de Torcoroma Sede 1', '54', '54498', NULL, 8.236277639717617, -73.35225958873815, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901394627-1', 'Unitrauma del Tolima IPS S.A.S.', '73', '73001', NULL, 4.43606317550154, -75.20467167262206, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900219120-2', 'Viva 1a IPS Chapinero Calle 52', '11', '11001', '1100113', 4.6398015058636535, -74.06666611649929, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900067169-1', 'Empresa Social del Estado Hospital Regional de García Rovira', '68', '68432', NULL, 6.70220917848447, -72.7294593322646, 67);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830095073-1', 'Centro Colombiano de Cirugía Plástica S.A.S.', '11', '11001', '1100102', 4.68460811507536, -74.05699970633655, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900471504-1', 'Clínica Las Victorias - Fracturas', '73', '73268', NULL, 4.151903594542589, -74.87869085255952, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806015201-3', 'Gestión Salud - Santa Marta', '47', '47001', NULL, 11.241200467025372, -74.18581325919199, 122);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901002487-1', 'Fundación CTIC - Centro de Tratamiento E Investigación Sobre Cáncer Luis Carlos Sarmiento Angulo', '11', '11001', '1100101', 4.747951369480355, -74.03629379979768, 130);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('839000356-1', 'Sociedad Médica Clínica Maicao Ltda.', '44', '44430', NULL, 11.381319613969712, -72.23452267581709, 246);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900581702-1', 'Clínica de Urgencias Bucaramanga S.A.S.', '68', '68001', NULL, 7.111433742252224, -73.11001572483768, 122);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900223667-1', 'Perfect Body Medical Center', '47', '47001', NULL, 11.239323012620996, -74.19202633973426, 25);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900242742-1', 'Clínica Colombia Es', '76', '76001', NULL, 3.414852937439477, -76.53803885337253, 345);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800006850-1', 'Hospital Mario Gaitán Yanguas - Empresa Social del Estado Región de Salud Soacha', '25', '25754', NULL, 4.585391853068709, -74.21979452851143, 55);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900274660-1', 'Instituto Colombiano del Dolor S.A.S. Poblado', '05', '05001', NULL, 6.239248877078907, -75.59491146526634, 94);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800058856-1', 'Clínica de Urabá S.A.', '05', '05045', NULL, 7.887434774810714, -76.63720000804399, 19);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999123-1', 'Fundación Hospital de La Misericordia', '11', '11001', '1100114', 4.5932314879917, -74.08860809031177, 442);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('813001952-1', 'Clínica Medilaser S.A.S. Sucursal Tunja', '15', '15001', NULL, 5.569644816440005, -73.33675852423836, 141);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900033806-1', 'Clínica del Campestre S A', '05', '05001', NULL, 6.187845664428742, -75.57886515446782, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900600256-1', 'Clínica General San Diego', '08', '08001', NULL, 10.981734001537337, -74.79121937494087, 59);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890801026-1', 'E.S.E. Hospital departamental Felipe Suarez', '17', '17653', NULL, 5.409757352047175, -75.48560202396766, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900069163-1', 'Centro Médico-Quirúrgico Bayos S.A. Clínica El Pinar', '68', '68276', NULL, 7.061573448497247, -73.1145911853108, 5);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890901825-1', 'Fundación Clínica Noel', '05', '05001', NULL, 6.215288552445342, -75.57699221885478, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901211457-1', 'Clínica Al Alba', '76', '76001', NULL, 3.461679713686712, -76.52763731363821, 67);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900269029-1', 'Fundación Centro Colombiano de Epilepsia Y Enfermedades Neurológicas', '13', '13001', NULL, 10.3886419947529, -75.46899683102603, 80);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805027743-3', 'Clínica del Café Dumian Medical', '63', '63001', NULL, 4.544043680970043, -75.66157140260101, 102);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901336751-1', 'Clinivida Y Salud IPS S.A.S.', '44', '44001', NULL, 11.546911030626, -72.91571186723444, 69);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900110992-1', 'Centro Médico-Quirúrgico La Riviera S.A.S.', '68', '68001', NULL, 7.115512961775174, -73.1070391304439, 3);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900718172-1', 'Clínica Internacional de Alta Tecnología S.A.S.', '73', '73001', NULL, 4.375254362417903, -75.11680955506604, 59);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890500060-1', 'Clínica Santa Ana S.A.', '54', '54001', NULL, 7.891013115914071, -72.4890724788446, 170);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900900754-1', 'Clínica Valle Salud San Fernando S.A.S.', '76', '76001', NULL, 3.420869715974135, -76.53847340521904, 39);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901339938-1', 'Hospital Nuestra Señora del Transito del Municipio de Tocancipá', '25', '25817', NULL, 4.964806467372122, -73.91075596, 23);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901653898-1', 'Clínica Trauma Center del Caribe S.A.S.', '08', '08296', NULL, 11.001528000262075, -74.81305688946982, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800090749-1', 'Clínica Piedecuesta S.A.', '68', '68547', NULL, 6.989547285539411, -73.04805011346485, 56);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890701459-1', 'Hospital San Juan Bautista E.S.E.', '73', '73168', NULL, 3.726830409785917, -75.48449582189878, 71);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013874-1', 'Instituto de Ortopedia Infantil Roosevelt', '11', '11001', '1100112', 4.664277509167347, -74.08069739172724, 40);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900219120-1', 'Viva 1a IPS Bolivia', '05', '05001', NULL, 6.250735793510452, -75.55933969694411, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806007650-1', 'Centro Radio-Oncológico del Caribe S.A.S.', '13', '13001', NULL, 10.40555614601419, -75.50808316738481, 27);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860073087-1', 'La Font S.A.S.', '11', '11001', '1100102', 4.671878955766082, -74.0551427023997, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901149757-1', 'Traumaoriente del Valle', '76', '76001', NULL, 3.4523723275113123, -76.49387199146462, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900073081-1', 'Serviclínicos Dromedica S.A.', '68', '68001', NULL, 7.1154010153317975, -73.1185440258165, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901532463-1', 'Hospital de Alta Complejidad del Magdalena Centro S.A.S.', '17', '17380', NULL, 5.4535554073119625, -74.67505500725518, 168);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890300513-1', 'Clínica de Occidente', '76', '76001', NULL, 3.4603340572551997, -76.53042955291697, 363);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('815000316-1', 'Hospital Raúl Orejuela Bueno E.S.E. - Sede San Vicente', '76', '76520', NULL, 3.5363974414619648, -76.298105520147, 96);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900005955-1', 'Clínica La Esperanza Montería', '23', '23001', NULL, 8.745267339219136, -75.89163933111695, 123);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892115009-1', 'Empresa Social del Estado Hospital Nuestra Señora de Los Remedios', '44', '44001', NULL, 11.546719830596802, -72.9136377337463, 60);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900385628-1', 'Clínica Medicentro Familiar Sede Suba', '11', '11001', '1100111', 4.732806289538411, -74.08896457786379, 84);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891600091-1', 'Caja de Compensación Familiar del Choco', '27', '27001', NULL, 5.693567018912619, -76.65928100461088, 79);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900857186-1', 'Clínica Angiosur', '05', '05360', NULL, 6.169941512201537, -75.61129763020115, 48);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900891513-1', 'Clínica Nueva Rafael Uribe Uribe S.A.S.', '76', '76001', NULL, 3.466936122423338, -76.52473752827679, 76);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901352353-1', 'Clínica La Sagrada Familia S.A.S.', '63', '63001', NULL, 4.538520985223959, -75.66830247826785, 177);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805027743-4', 'Clínica Mariángel Dumian Medical', '76', '76834', NULL, 4.083147969171344, -76.18638702521596, 186);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900464965-1', 'Cerio IPS Ciudad Jardín', '76', '76001', NULL, 3.365473573195246, -76.53243130654386, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('845000038-1', 'E.S.E. Hospital San Antonio', '97', '97001', NULL, 1.2599954457012994, -70.23509985770859, 39);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812002958-1', 'Clínica La Trinidad IPS Ltda.', '23', '23417', NULL, 9.227202020205432, -75.82012121567314, 95);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('832003167-1', 'Clínica Universidad de La Sabana', '25', '25175', NULL, 4.856313949142596, -74.03049273464286, 150);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891411663-1', 'Empresa Social del Estado Hospital Santa Mónica', '66', '66170', NULL, 4.824137586077557, -75.67992977564725, 68);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800255963-1', 'Clínica San José S.A.S.', '68', '68081', NULL, 7.058470441833496, -73.85075022837326, 36);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900219120-3', 'Viva 1a San Felipe', '13', '13001', NULL, 10.420490458050551, -75.53831127419171, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900769055-1', 'Servicio Integral de Medicina Ambulatoria-Sima.Link S.A.S.', '85', '85001', NULL, 5.3487542254486495, -72.39150595551668, 34);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900247184-1', 'Clinidental Fm S.A.S.', '47', '47001', NULL, 11.241269105955974, -74.1899972696521, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800112384-1', 'Cirulaser Andes S.A.', '11', '11001', '1100101', 4.694821702358422, -74.03386783927365, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900042103-1', 'Empresa Social del Estado Hospital Universitario del Caribe', '13', '13001', NULL, 10.400421936704827, -75.5035194907442, 463);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891901158-1', 'E.S.E. Hospital departamental Tomas Uribe Uribe de Tuluá E.S.E. Empresa Social del Estado', '76', '76834', NULL, 4.081705037204574, -76.18810663171129, 221);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900423126-1', 'Fundación Clínica Materno Infantil Adela de Char', '08', '08758', NULL, 10.901661178142346, -74.78280705783865, 114);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900273700-1', 'Clínica Sanar', '50', '50001', NULL, 4.144191889209991, -73.63910797916533, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900778696-1', 'Fundación Florecer Bienestar Y desarrollo Guajiro', '44', '44279', NULL, 10.887750833750966, -72.85486343283462, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890904646-1', 'Hospital General de Medellín Luz Castro de Gutiérrez, Empresa Social del Estado', '05', '05001', NULL, 6.234056988560798, -75.5731264217, 460);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901597483-1', 'Unidad Médica Integral Emauss IPS S.A.S.', '23', '23001', NULL, 8.751848746134115, -75.88059360598709, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901254142-1', 'Meisar IPS S.A.S.', '11', '11001', '1100101', 4.699547833960588, -74.03244034135732, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999147-1', 'Empresa Social del Estado Hospital El Salvador de Ubaté', '25', '25843', NULL, 5.304662315718689, -73.81387392237731, 59);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('821003143-1', 'E.S.E. Hospital departamental Centenario de Sevilla Empresa Social del Estado', '76', '76736', NULL, 4.269291572231827, -75.92861589946583, 30);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900318964-1', 'Clivelam I.P.S. S.A.S.', '08', '08001', NULL, 11.001058868175846, -74.81445897600331, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901389106-1', 'Clínica Divino Niño Ghb Medical', '54', '54498', NULL, 8.237235322211198, -73.35275537215867, 25);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800084362-1', 'E.S.E. Hospital Civil de Ipiales', '52', '52356', NULL, 0.8287170586886025, -77.61389591585777, 176);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('814006248-1', 'Unidad Cardioquirúrgica de Nariño Ltda.', '52', '52001', NULL, 1.2237686095919054, -77.28588324815694, 36);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802020128-1', 'Inverclínicas S.A.S.', '08', '08001', NULL, 10.960605706895503, -74.79393603693434, 92);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900191362-1', 'Clínica de Oftalmología San Diego Cúcuta', '54', '54001', NULL, 7.882533707121409, -72.49889908611824, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900098008-1', 'Fundación Médica Integral de La Costa Limitada - Funmedic IPS Ltda.', '08', '08001', NULL, 10.990361471208564, -74.7951680136852, 14);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900208912-1', 'Clínica Internacional de Cirugía Plástica', '76', '76001', NULL, 3.4226909357344706, -76.5465871291686, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890907215-1', 'E.S.E. Hospital San Vicente de Paúl de Caldas', '05', '05129', NULL, 6.086962460742646, -75.63444849825007, 71);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900181419-1', 'Clínica Meintegral S.A.S.', '17', '17001', NULL, 5.066029855266994, -75.50643462351162, 34);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891411743-1', 'Clínica de Fracturas S.A.S.', '66', '66001', NULL, 4.808824633188668, -75.68661069543123, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901622460-1', 'Clínica de Ortopedia Función Y Educación', '11', '11001', '1100113', 4.634963646193039, -74.07764157019083, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800174851-1', 'Sociedad Médico-Quirúrgica Nuestra Señora de Belén de Fusagasugá S.A.S.', '25', '25290', NULL, 4.336169248257587, -74.36648795354124, 44);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901721622-1', 'Nova Salud Integrales IPS S.A.S.', '08', '08758', NULL, 10.914332963163876, -74.77331212565508, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('811026259-1', 'Bioforma S.A. Medicina Especializada', '05', '05001', NULL, 6.182452709273006, -75.56458513049525, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890900518-1', 'Fundación Hospitalaria San Vicente de Paul', '05', '05001', NULL, 6.262664622282357, -75.56560763653907, 482);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891856507-1', 'Sociedad Clínica Boyacá Limitada', '15', '15238', NULL, 5.814854035339171, -73.03084155847718, 30);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900491883-1', 'Clínica La Ermita de Cartagena - Sede 1', '13', '13001', NULL, 10.418024039176418, -75.5331332036317, 135);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900900155-1', 'Centro de Cuidados Cardioneurovasculares Pabón S.A.S.', '52', '52001', NULL, 1.2133514509162897, -77.29608910943118, 122);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890903777-1', 'Sociedad Médica Antioqueña S.A. Soma', '05', '05001', NULL, 6.248921513187596, -75.56448054020044, 196);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800088346-1', 'IPS Clínica General El Recreo Ltda.', '08', '08001', NULL, 10.982562388202735, -74.79599102917764, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900769549-1', 'Red Humana S.A.S.', '11', '11001', '1100112', 4.683063321707407, -74.05894772672856, 49);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890706823-1', 'Hospital Reina Sofía de España Empresa Social del Estado', '73', '73408', NULL, 4.859137782543064, -74.91700131372991, 37);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901085352-1', 'Instituto Médico de Alta Tecnología S.A.S.', '23', '23001', NULL, 8.752217881483405, -75.88708866352243, 193);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800220806-1', 'Centro Especializado En Fracturas Y Lesiones deportivas', '76', '76001', NULL, 3.480745503039156, -76.52147196822507, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860010783-1', 'Clínica Nueva', '11', '11001', '1100113', 4.634211624880233, -74.07088708227077, 95);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891380054-1', 'Fundación Hospital San José', '76', '76111', NULL, 3.906711841122428, -76.29220111590968, 161);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901089614-1', 'Clínica San Rafael Alta Complejidad S.A.S.', '08', '08638', NULL, 10.640200586841583, -74.91121164496546, 145);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830078325-1', 'Unidad Médica Cecimin', '11', '11001', '1100101', 4.692242901810987, -74.0558224683915, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819004276-1', 'Clínica La Esperanza IPS S.A.S. - Calle Nueva', '47', '47245', NULL, 8.996134204235979, -73.97231349896727, 23);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900136865-1', 'Empresa Social del Estado Hospital Regional del Magdalena Medio', '68', '68081', NULL, 7.067911527803675, -73.86129685440564, 72);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999156-1', 'E.S.E. Hospital San Antonio de Chía - (251750002001)', '25', '25175', NULL, 4.85815981939269, -74.06035557374979, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901809401-1', 'Promesalud Integral - IPS Nororiente', '68', '68001', NULL, 7.117181335326224, -73.1101184013692, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891500084-1', 'Hospital Francisco de Paula Santander E.S.E. Nivel II Unidad de Atención En Salud Sede I', '19', '19698', NULL, 3.0045884629064807, -76.48286494826128, 102);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800179966-2', 'Clínica Reina Catalina S.A.S.', '08', '08001', NULL, 11.001486576555097, -74.81623401975469, 272);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800107179-1', 'Clínica Ama', '05', '05001', NULL, 6.261685552463122, -75.56151168302485, 68);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900668922-1', 'Clínica Castellana', '76', '76001', NULL, 3.462265983087685, -76.52808317421918, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800215019-1', 'Sociedad Cordobesa de Cirugía Vascular S.A.S.', '23', '23001', NULL, 8.751602745454349, -75.88387485427573, 32);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('807000799-1', 'Centro Quirúrgico Uronorte', '54', '54001', NULL, 7.884278789090757, -72.49622673527581, 11);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901270747-1', 'Unidad Médica San Vicente S.A.S.', '08', '08638', NULL, 10.630555466618128, -74.92171572163319, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860037950-1', 'Fundación Santa Fe de Bogotá', '11', '11001', '1100101', 4.695657749101086, -74.0330267997836, 380);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900164946-1', 'Clínica Pediátrica Niño Jesús Limitada', '70', '70001', NULL, 9.306946691921432, -75.39496098800981, 93);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890205361-1', 'Fundación Oftalmológica de Santander Foscal', '68', '68276', NULL, 7.07314911513701, -73.11040024832236, 284);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901353174-1', 'IPS Clínica San Martin Codazzi S.A.S.', '20', '20013', NULL, 10.02381645673148, -73.2393653929536, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900405505-1', 'Famedic Cca Duitama', '15', '15238', NULL, 5.826837034490856, -73.03308202169862, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900531397-1', 'Clínica Bellanova IPS S.A.S.', '15', '15759', NULL, 5.724097272859434, -72.92516047663935, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900501859-1', 'Health Care Cirugía Plástica S.A.S.', '85', '85001', NULL, 5.343806568025213, -72.39333951684215, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900618986-1', 'Quirófanos El Tesoro', '05', '05001', NULL, 6.198919435871809, -75.56160865895626, 11);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890933857-1', 'Centro de Ortopedia Y Traumatología El Estadio S.A.', '05', '05001', NULL, 6.258715094815948, -75.59118702828081, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901582380-1', 'Symmetry Plastic Surgery', '11', '11001', '1100102', 4.667713546606596, -74.05821946136808, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891701664-1', 'Clínica Prado', '47', '47001', NULL, 11.23699785089421, -74.21078200556975, 182);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891180117-1', 'E.S.E. Hospital departamental San Antonio de Padua', '41', '41396', NULL, 2.393225461825606, -75.8858674899205, 56);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800222727-1', 'Quirófano Casalud S.A.S.', '66', '66001', NULL, 4.816124756112588, -75.69568472060982, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800200789-1', 'Clínica Chía S.A.S.', '25', '25175', NULL, 4.856509125138024, -74.06255632904957, 43);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('814004714-1', 'Clínica Bellatriz S.A.S.', '52', '52001', NULL, 1.2302229959744138, -77.28570549692422, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900075758-1', 'Gastroquirúrgica S.A.S.', '54', '54001', NULL, 7.89263443712793, -72.48948761044065, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891800611-1', 'Empresa Social del Estado Hospital San Antonio de Soatá', '15', '15753', NULL, 6.332825178390964, -72.68544202625188, 49);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901216620-1', 'Guadalupe Medical Center Mp Calleja', '11', '11001', '1100101', 4.706503833820006, -74.04896688246171, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900520510-1', 'Centros Hospitalarios del Caribe S.A.S.', '47', '47001', NULL, 11.237564632923002, -74.20043453615679, 189);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802007056-1', 'Servicios Médicos Integrales del Norte', '08', '08001', NULL, 10.955098120154062, -74.81540027877305, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901108114-1', 'Nueva Empresa Social del Estado Hospital departamental San Francisco de Asís', '27', '27001', NULL, 5.695493224469064, -76.66094625891078, 137);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806012426-1', 'Clínica Cardiovascular Jesús de Nazareth Transformación En S.A.S.', '13', '13001', NULL, 10.392855855765928, -75.47484764872102, 52);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830117846-1', 'Medsport Colombia', '11', '11001', '1100102', 4.6681722988700445, -74.05744000852908, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901440000-1', 'Hospital departamental Clarance Lynd Newball Memorial Hospital', '88', '88001', NULL, 12.571595221172991, -81.70925050043283, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890503532-1', 'Clínica Los Andes Ltda.', '54', '54001', NULL, 7.880447543048789, -72.49813150215101, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('835000972-1', 'Hospital Distrital Luis Ablanque de La Plata', '76', '76109', NULL, 3.8823408914627775, -77.06500215852891, 93);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860006656-1', 'Fundación Abood Shaio', '11', '11001', '1100111', 4.698267419648344, -74.073075391367, 242);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('846000471-1', 'E.S.E. Hospital Sagrado Corazón de Jesús', '86', '86865', NULL, 0.4141738332125925, -76.91186629455157, 28);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806016797-1', 'Somedyt IPS E.U. Servicios Médicos de Diagnostico Y Terapia', '13', '13001', NULL, 10.407697499174576, -75.50221350360832, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900873344-1', 'Polifracturas Ciénaga I.P.S.', '47', '47189', NULL, 11.004559420467931, -74.24398851743851, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890801201-1', 'Sede Hospital Infantil Universitario', '17', '17001', NULL, 5.06409428569463, -75.49856950369147, 70);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901523434-1', 'IPS Servimedi del Norte S.A.S.', '08', '08638', NULL, 10.62992172940839, -74.92103795222557, 6);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806016920-1', 'IPS Vida Plena S.A.S.', '70', '70001', NULL, 9.305009132203995, -75.39270295664255, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900101736-1', 'IPS Clínica Gestionar bienestar', '68', '68001', NULL, 7.121260790240512, -73.11910346114853, 23);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802012998-1', 'Unión Vital S.A.S.', '08', '08001', NULL, 10.994855120431756, -74.79465910962541, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900390423-1', 'Promotora Clínica Zona Franca de Urabá', '05', '05045', NULL, 7.852118706855236, -76.64077723711995, 178);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900578105-1', 'Hospital Universitario Nacional de Colombia', '11', '11001', '1100113', 4.648774301848993, -74.09553561603367, 228);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892120115-1', 'E.S.E. Hospital San José de Maicao', '44', '44430', NULL, 11.38195477284434, -72.26588254825266, 190);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900422195-1', 'Clínica Alejandría S.A.S.', '41', '41001', NULL, 2.933039019027149, -75.28678886579837, 7);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830510991-1', 'Clínica Especializada La Concepción S.A.S.', '70', '70001', NULL, 9.307145651635354, -75.36995645278405, 296);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900777755-1', 'Clínica Avidanti Ciudad Verde', '25', '25754', NULL, 4.606830391179642, -74.21754793955, 188);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860006745-1', 'Clínica Palermo', '11', '11001', '1100113', 4.636050248617544, -74.0738095821962, 191);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('801000713-2', 'Oncólogos del Occidente S.A.S. Clínica de Alta Tecnología Armenia', '63', '63001', NULL, 4.545222305238224, -75.6607542294554, 86);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900744456-1', 'IPS-Clínica Betel S.A.S.', '08', '08001', NULL, 10.97150664937677, -74.80136058125636, 3);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812000924-1', 'Ambulatorios Limitada', '23', '23001', NULL, 8.754573354095243, -75.88434012242462, 3);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900204682-1', 'Sociedad Cardiovascular del eje cafetero', '63', '63001', NULL, 4.547286287132974, -75.66215641958136, 17);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901094037-1', 'Traumacentro S.A.A.', '05', '05001', NULL, 6.245828870928576, -75.5837323486538, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('817007598-1', 'Clínica Palmares', '19', '19001', NULL, 2.451895331602328, -76.59888399986963, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900685946-1', 'Hospital Las Américas Ltda.', '08', '08758', NULL, 10.888590725407752, -74.79057718624698, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900006037-1', 'Hospital Universitario de Santander', '68', '68001', NULL, 7.128043298301729, -73.11402678432134, 351);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891855029-1', 'Hospital Regional de La Orinoquia E.S.E.', '85', '85001', NULL, 5.341632319105894, -72.40751299360149, 184);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901180926-1', 'IPS Clínica Mariana Tuquerres S.A.S.', '52', '52838', NULL, 1.08563605016211, -77.61466465082599, 13);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800176890-1', 'Clínica Médico-Quirúrgica S.A. Sede 1', '54', '54001', NULL, 7.905344688165043, -72.4911466863709, 132);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830504400-1', 'Centro Médico Valle de Atriz E.U.', '52', '52001', NULL, 1.217486115798178, -77.28284278696307, 68);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800036400-1', 'Clínica Ibagué S.A.', '73', '73001', NULL, 4.4451591883036805, -75.2393580654277, 49);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900051107-1', 'Corazón Y Aorta Popayán', '19', '19001', NULL, 2.444461696988133, -76.6108346245746, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800037021-1', 'Hospital departamental de Granada. Empresa Social del Estado', '50', '50313', NULL, 3.5470808931969287, -73.6969222782707, 138);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891080015-1', 'Empresa Social del Estado Hospital Sandiego de Cereté', '23', '23162', NULL, 8.878793791460454, -75.79585243696457, 139);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999151-1', 'Empresa Social del Estado Hospital San Rafael de Facatativá', '25', '25269', NULL, 4.80635528176181, -74.3498904025329, 193);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806008439-1', 'Clínica Cartagena del Mar S.A.S.', '13', '13001', NULL, 10.420482095259048, -75.53300502853601, 92);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800092616-1', 'Clínica de Especialistas Envigado', '05', '05266', NULL, 6.175370204979727, -75.58477773761749, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830099212-1', 'Centro Integral de Innovación Y Tecnología Clínica Onkos S.A.S.', '11', '11001', '1100113', 4.621601987584569, -74.07037866514302, 72);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900523628-1', 'Clínica Saludent S.A.S.', '41', '41001', NULL, 2.929708748197588, -75.28564368138892, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892280033-1', 'Hospital Universitario de Sincelejo E.S.E.', '70', '70001', NULL, 9.30408945161078, -75.40005300080838, 355);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860035992-1', 'Fundación Cardio Infantil Instituto de Cardiología', '11', '11001', '1100101', 4.741412047036608, -74.03451508737604, 354);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890303841-1', 'Hospital San Juan de Dios', '76', '76001', NULL, 3.454893886338568, -76.52778590457024, 169);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('832001966-1', 'Empresa Social del Estado Hospital San José del Guaviare', '95', '95001', NULL, 2.5661732593838424, -72.64288715154437, 91);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900234000-1', 'Citara Oral And Maxillofacial Center S.A.S.', '27', '27001', NULL, 5.689463370225576, -76.65651012427887, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890804817-1', 'Instituto Médico Integrado de Ortopedia Clínica de Fracturas Rehabilitación Y Cirugía Plástica S.A.', '17', '17001', NULL, 5.053560179496941, -75.48614205694084, 3);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901100223-1', 'Clínica Traumanorte S.A.S.', '73', '73443', NULL, 5.190315172829236, -74.892602302376, 40);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('809011517-1', 'Medicina Intensiva del Tolima', '73', '73349', NULL, 5.199214416853246, -74.75141752421972, 15);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800044402-1', 'Inversiones Médicas de Antioquia S.A. Clínica Las Vegas', '05', '05001', NULL, 6.203155377602498, -75.57639711635746, 170);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890501019-1', 'Hospital San Juan de Dios de Pamplona', '54', '54518', NULL, 7.373947483760963, -72.64417526051112, 49);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830507245-1', 'Clínica Jerusalén', '23', '23555', NULL, 8.408284548444449, -75.58510798432661, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800231235-1', 'Empresa Social del Estado Hospital Universitario San Jorge', '66', '66001', NULL, 4.818031256341327, -75.69881051093883, 344);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891180098-1', 'Hospital departamental Hospital María Inmaculada E.S.E.', '18', '18001', NULL, 1.619954663481375, -75.61132981882044, 204);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900771349-1', 'Clínica desa S.A.S.', '76', '76001', NULL, 3.423318585950682, -76.54242220275138, 217);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('813001952-2', 'Clínica Medilaser S.A.S. Sucursal Florencia', '18', '18001', NULL, 1.607788382412779, -75.6077700366115, 130);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900995574-1', 'Medipohds', '70', '70001', NULL, 9.30569404704766, -75.39303007129625, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900394575-1', 'Uba Vihonco Sede 5 Clínica', '54', '54001', NULL, 7.887167350964934, -72.49984133541251, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900839869-1', 'Clínica Santa Ana de Dios S.A.S.', '08', '08001', NULL, 10.990190730551152, -74.80614284634878, 187);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890399020-1', 'Fundación Clínica Infantil Club Noel', '76', '76001', NULL, 3.4398428011105446, -76.53795482247835, 96);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800193618-1', 'Unidad Quirúrgica Ramón Y Cajal', '76', '76001', NULL, 3.463425331810051, -76.52850635153992, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891304097-1', 'Urgencias Médicas S.A.S.', '76', '76111', NULL, 3.899929151241664, -76.30954715474793, 34);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901152693-1', 'Costa Caribe Y/O IPS Salud Vida S.A.S.', '08', '08758', NULL, 10.927618399430711, -74.77152621454748, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900066347-1', 'E.S.E. Hospital Regional San Gil', '68', '68679', NULL, 6.554838472250853, -73.13412043763671, 72);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800067515-1', 'Clínica La Milagrosa S.A.', '47', '47001', NULL, 11.238544227432085, -74.20250887561788, 204);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901026947-1', 'Evoluzion Care', '68', '68001', NULL, 7.117648187467569, -73.10883100131653, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999092-1', 'Instituto Nacional de Cancerología', '11', '11001', '1100104', 4.587944782855312, -74.08454612585771, 202);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890208758-1', 'Clínica Materno Infantil San Luis Sa', '68', '68001', NULL, 7.11667736216081, -73.11614370486467, 185);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900110631-1', 'Clínica de Ortopedia Mínimamente Invasiva', '68', '68001', NULL, 7.111811135085474, -73.10944207023199, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800138186-1', 'Clínica de Otorrinolaringología Cirugía Plástica', '76', '76001', NULL, 3.45735645918835, -76.5320520097048, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901552405-1', 'Clínica San Rafael de Popayán S.A.S.', '19', '19001', NULL, 2.451566781001903, -76.59618581131946, 149);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900196346-1', 'E.S.E. Hospital Nuestra Señora del Carmen', '13', '13244', NULL, 9.71368198845475, -75.11704925015722, 70);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900699086-1', 'Christus Sinergia Clínica Palma Real S.A.S.', '76', '76520', NULL, 3.540210801930236, -76.29750888373307, 56);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900800086-1', 'Clínica 134 S.A.S.', '11', '11001', '1100101', 4.7114770279653575, -74.03013559347686, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900342064-1', 'Clínica San Rafael Armenia', '63', '63001', NULL, 4.547083450505866, -75.66290819501393, 71);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901314126-1', 'Occisalud S.A.S.', '76', '76001', NULL, 3.447520964848531, -76.49876280111435, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800116511-1', 'Centro Quirúrgico de La Belleza', '76', '76001', NULL, 3.421981700458277, -76.54425383143996, 6);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901266096-1', 'IPS Cersalud Medicina Integral', '08', '08634', NULL, 10.790174197944722, -74.7573227829181, 42);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800003765-2', 'Virrey Solís IPS Sa Clínica Divina Providencia', '13', '13001', NULL, 10.394730083115162, -75.47652882850181, 44);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901828276-1', 'Clínica Maternidad de Bocagrande', '13', '13001', NULL, 10.404322365094073, -75.55333796645938, 44);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800193989-1', 'Clínica Cedes Ltda.', '44', '44001', NULL, 11.544792752832713, -72.91221974838221, 132);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900613550-1', 'Clínica San Francisco de Asís S.A.S.', '11', '11001', '1100114', 4.607992588381057, -74.08046409656349, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806013568-1', 'Neurodinamia - Clínica Neuro Cardio Vascular', '13', '13001', NULL, 10.38901570068514, -75.5198496179919, 62);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('816002451-1', 'Calculaser S.A.', '66', '66001', NULL, 4.806090982447353, -75.68660393118031, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013779-1', 'Profamilia Medellín Centro', '05', '05001', NULL, 6.250225082640299, -75.56186027777261, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891180026-1', 'E.S.E. San Vicente de Paul de Garzón', '41', '41298', NULL, 2.1987814282486142, -75.63139018627294, 122);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891780185-1', 'Hospital Universitario Julio Méndez Barreneche', '47', '47001', NULL, 11.237271442422534, -74.20183517668754, 334);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901168777-1', 'Sinu Trauma', '23', '23001', NULL, 8.746049174832741, -75.87664970716389, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800185449-3', 'Clínica Avidanti Ibagué', '73', '73001', NULL, 4.4120955707337774, -75.17247600830773, 182);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800185449-2', 'Clínica Avidanti Santa Marta', '47', '47001', NULL, 11.235182995834718, -74.21294966635416, 148);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900177624-1', 'Anashiwaya', '44', '44001', NULL, 11.542767771478212, -72.90936434616454, 44);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800201496-1', 'Clínica de Ortopedia Y Accidentes Laborales', '11', '11001', '1100108', 4.630446235347357, -74.13076230024579, 11);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900213617-1', 'Corporación Clínica Primavera', '50', '50001', NULL, 4.147848366224331, -73.63931570323442, 152);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860028947-1', 'Clínica Madre Bernarda.', '13', '13001', NULL, 10.394364577601245, -75.47695063287843, 130);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812005831-1', 'Ortosalud IPS', '23', '23001', NULL, 8.753391306943337, -75.88672271628357, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('816003270-1', 'Diagnostico Oftalmológico S.A.S.', '66', '66001', NULL, 4.804742004603501, -75.69023647949913, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830104627-1', 'Hospital Cardiovascular de Cundinamarca S.A.', '25', '25754', NULL, 4.582387927255063, -74.20044533434208, 176);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860502092-1', 'Nueva Clínica Magdalena', '11', '11001', '1100113', 4.627059446119183, -74.06922755095722, 72);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830090073-1', 'Proseguir Sede 3', '11', '11001', '1100113', 4.646616972443036, -74.06754190740598, 92);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900219120-4', 'Viva 1a IPS Carrera 2', '73', '73001', NULL, 4.443140828259608, -75.24150290259804, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('842000004-1', 'E.S.E. Hospital departamental San Juan de Dios', '99', '99001', NULL, 6.185329274965461, -67.48467294452061, 71);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901212900-1', 'Especialistas En Salud IPS S.A.S.', '05', '05001', NULL, 6.246125877425413, -75.56652839887359, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891200528-1', 'Hospital Universitario departamental de Nariño', '52', '52001', NULL, 1.2050280149623955, -77.26811723612913, 231);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890706833-1', 'Hospital Federico Lleras Acosta E.S.E.', '73', '73001', NULL, 4.433408613861449, -75.21950652256278, 384);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901220248-1', 'Help Trauma Salud Y Ortopedia IPS S.A.S.', '54', '54518', NULL, 7.37404910377429, -72.64376201625608, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('804010540-1', 'Sociedad Especializada de Anestesiología', '68', '68276', NULL, 7.07425836774148, -73.11001516382542, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900470909-1', 'Nueva Clínica El Barzal Sede 2', '50', '50001', NULL, 4.148347238433793, -73.63812499884176, 40);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901828182-1', 'Clínica Médica Índigo', '76', '76001', NULL, 3.4190362878395715, -76.54418003149893, 15);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901168482-1', 'Victoria S.A.S. Clínica Médico-quirúrgica', '17', '17380', NULL, 5.450751115643527, -74.66303999929907, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802017597-1', 'Instituto Cardiovascular Y Quirúrgico de La Costa S.A.S.', '08', '08001', NULL, 11.001445243756596, -74.81520291337473, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('811016192-1', 'Sede Principal Hospital Alma Máter de Antioquia', '05', '05001', NULL, 6.2665456922934535, -75.56441901980929, 430);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901402625-1', 'Mayerlis Arrieta Clínica Odontológica Especializada', '44', '44430', NULL, 11.378446129185525, -72.24401048102693, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900498069-1', 'Clínica Regional de Especialistas Sinais Vitais S.A.S.', '20', '20060', NULL, 9.974706856790004, -73.88401171623957, 160);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892300445-1', 'E.S.E. Hospital Regional de Aguachica José David Padilla Villafañe', '20', '20011', NULL, 8.309092038381918, -73.60468941979103, 168);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900233294-1', 'Clínica General del Caribe S.A.', '13', '13001', NULL, 10.397364273763598, -75.48699066553472, 90);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900236850-1', 'Centro Oncológico de Antioquia S.A.', '05', '05266', NULL, 6.165927324015932, -75.60063176456407, 60);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800004579-1', 'Centro de Ortopedia Y Fracturas', '76', '76001', NULL, 3.4609028017955383, -76.526540130689, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900008376-1', 'Clínica Médica de Aguachica S.A.S.', '20', '20011', NULL, 8.31003164814464, -73.60865334342499, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900267064-1', 'Clínica Bahía', '47', '47001', NULL, 11.233125707689602, -74.19485567587951, 53);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890112801-1', 'Hospital Universidad del Norte', '08', '08758', NULL, 10.929854444808896, -74.7806659935753, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900214926-1', 'Clínica de Especialistas Guajira S.A.', '44', '44430', NULL, 11.380763118212595, -72.23814560600343, 26);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800074112-1', 'Clínica Zayma', '23', '23001', NULL, 8.754025864104102, -75.8838653800895, 111);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900284591-1', 'Clínica Santa Teresita de Normandía', '11', '11001', '1100110', 4.668673932964532, -74.10775255487931, 34);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('837000974-1', 'Sociedad Las Lajas S.A.S.', '52', '52356', NULL, 0.8320290100410308, -77.6489815251949, 58);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800179870-1', 'Hospital San Andrés Tumaco E.S.E.', '52', '52835', NULL, 1.6721231819747828, -78.75238407542872, 137);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999032-1', 'Empresa Social del Estado Hospital Universitario de La Samaritana', '11', '11001', '1100104', 4.587462743354136, -74.08371599169818, 221);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999163-1', 'Empresa Social del Estado Hospital San Francisco de Gacheta', '25', '25297', NULL, 4.817723886800714, -73.64111126879179, 29);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900807126-1', 'Clínica Reina Isabel S.A.S.', '41', '41551', NULL, 1.8485726573147163, -76.04333193022148, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900471348-1', 'Clínica Dalí', '76', '76001', NULL, 3.420919662785763, -76.54721437298436, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800172517-1', 'Clínica Izka S.A.S.', '11', '11001', '1100102', 4.669998542374641, -74.05872983488439, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901138410-1', 'Sociedad Médica Alcalá S.A.S.', '11', '11001', '1100101', 4.720093798003992, -74.04648097535063, 14);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900431550-1', 'Clínica La Victoria S.A.S.', '08', '08001', NULL, 10.954997260390527, -74.79602195477653, 34);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802000909-1', 'Clínica Los Almendros', '08', '08758', NULL, 10.918553095805152, -74.8165390334128, 69);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('825001800-1', 'Clínica Someda', '44', '44650', NULL, 10.771094987542703, -73.00957872412717, 39);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900725987-1', 'Clínica de Fracturas Y Medicina Laboral S.A.S. Framedic S.A.S.', '13', '13001', NULL, 10.407780897430044, -75.51438834812856, 5);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900066955-1', 'Clínica Fundadores Armenia S.A.', '63', '63001', NULL, 4.544886743428225, -75.66062417267933, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800014918-1', 'E.S.E. Hospital Universitario Erasmo Meoz', '54', '54001', NULL, 7.904012604653347, -72.49106532653165, 357);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901477409-1', 'Clínica Oceanía S.A.S.', '19', '19001', NULL, 2.453906402696936, -76.60437168061604, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890902922-1', 'Clínica Universitaria Bolivariana', '05', '05001', NULL, 6.276832786492548, -75.58197126841301, 205);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-10', 'Clínica Colsanitas S.A. Sebastián del Belalcázar', '76', '76001', NULL, 3.4547039263337367, -76.53713128965643, 83);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802021332-1', 'Clínica Centro S.A.', '08', '08001', NULL, 10.981684752429103, -74.78183397257915, 155);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800038024-1', 'Unidad Clínica La Magdalena S.A.S.', '68', '68081', NULL, 7.060501105844701, -73.85411843375279, 101);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800030924-1', 'E.S.E. Hospital La Buena Esperanza', '76', '76892', NULL, 3.581446036671879, -76.49211173752738, 17);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892300708-1', 'Clínica Valledupar', '20', '20001', NULL, 10.471465536735424, -73.25216873405172, 120);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900335691-1', 'Clínica Hispanoamérica', '52', '52001', NULL, 1.2313668122112458, -77.28557005875523, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891200240-1', 'Hospital Infantil Los Ángeles', '52', '52001', NULL, 1.2229956730344265, -77.28016302502749, 118);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800024834-1', 'Clínica de Otorrinolaringología de Antioquia S.A. - Orlant Sa', '05', '05001', NULL, 6.240590992661879, -75.57942385752102, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830104410-1', 'Evolution Medical Center S.A.S.', '11', '11001', '1100101', 4.698921738486702, -74.03857687779292, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('823003752-1', 'Unidad Médica El Bosque Y Cia Ltda.', '70', '70001', NULL, 9.305467561865347, -75.39146220712489, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900470642-1', 'Clínica Médical Duarte', '54', '54001', NULL, 7.8993573697824, -72.4849641633644, 379);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800190884-1', 'Clínica Antioquia S.A.', '05', '05360', NULL, 6.1698655191537455, -75.61293070967672, 168);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890907241-1', 'E.S.E. Hospital La Merced de Ciudad Bolívar', '05', '05101', NULL, 5.845967999326102, -76.00934724666293, 33);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149453-1', 'Centro Policlínico del Olaya', '11', '11001', '1100118', 4.583708067866765, -74.10506147080226, 245);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('824001252-1', 'Clínica Erasmo Ltda.', '20', '20001', NULL, 10.487808054689046, -73.26433467515595, 35);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901690556-1', 'Clínica Costanera S.A.S.', '08', '08638', NULL, 10.636587936350422, -74.92332080590461, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900908245-1', 'Unidad Médica-Quirúrgica Salud Cali', '76', '76001', NULL, 3.41566608774086, -76.54007295083419, 11);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900842629-1', 'Clínica Gestar Salud IPS', '23', '23001', NULL, 8.753555927215924, -75.88585824991253, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890601210-1', 'Clínica de Especialistas', '25', '25307', NULL, 4.293636834730153, -74.80831622758103, 26);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830005028-1', 'Clínica del Country IPS', '11', '11001', '1100102', 4.668720818547481, -74.0568049617321, 252);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900371613-1', 'Clínica de Los Andes IPS', '15', '15001', NULL, 5.543940677699163, -73.35963211900868, 77);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900465319-1', 'Clínica Misericordia', '08', '08001', NULL, 11.014376414952698, -74.79655025959862, 245);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900797064-1', 'Clínica Los Nevados S.A.S.', '66', '66001', NULL, 4.815790551641994, -75.69502544356473, 157);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900600550-1', 'Clínica Barú', '13', '13001', NULL, 10.39584522057028, -75.49168734776028, 24);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890701718-1', 'Hospital Regional Alfonso Jaramillo Salazar E.S.E.', '73', '73411', NULL, 4.920873207964668, -75.05795597622735, 121);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900009080-1', 'Clínica Odontológica dentisana', '20', '20001', NULL, 10.476768858373571, -73.25124484570827, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('826003824-1', 'Centro de Especialidades Y Cirugía Ambulatoria Ceyca', '15', '15238', NULL, 5.810106648759004, -73.02968479769682, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891900441-1', 'E.S.E. Hospital departamental San Rafael Empresa Social del Estado', '76', '76895', NULL, 4.39003020123944, -76.07223183214506, 39);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806010200-1', 'Gente Feliz Ltda.', '13', '13001', NULL, 10.424572698369555, -75.5468958447697, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890980066-1', 'E.S.E. Hospital San Rafael de Itagüí', '05', '05360', NULL, 6.171531679370999, -75.61323271557029, 95);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819001895-1', 'Clínica Regional Inmaculada Concepción', '47', '47555', NULL, 9.787028325097832, -74.78801388432187, 33);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900464696-1', 'Centro Clínico Santiago', '47', '47001', NULL, 11.238483980615063, -74.213353477533, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890919272-1', 'Asociación Medellín de Lucha Contra El Cáncer Medicáncer', '05', '05001', NULL, 6.264859131802446, -75.56513154731599, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900756475-1', 'Centro Pediátrico Carreño S.A.S.', '08', '08001', NULL, 11.002040046183016, -74.81746226547014, 16);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('823002800-1', 'Oftalmólogos Asociados de La Costa S.A.S.', '70', '70001', NULL, 9.30067570057815, -75.38575789154602, 53);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812004479-1', 'Umbral Oncológicos S.A.S.', '23', '23001', NULL, 8.74988382673178, -75.88058487028509, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830103995-1', 'Clínica Loyola', '11', '11001', '1100102', 4.670791475842875, -74.05805653142637, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830005127-1', 'Centro de Cirugía Ambulatoria IPS Ltda.', '11', '11001', '1100112', 4.677125932482472, -74.05982115914789, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('809012505-1', 'Urocadiz Especialidades Médico Quirúrgicas S.A.S.', '73', '73001', NULL, 4.430547212828513, -75.1998356215891, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800048954-1', 'Clínica Versalles', '76', '76001', NULL, 3.464182071008031, -76.52809412668324, 257);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900850834-1', 'Clínica Nueva de Cartago S.A.S.', '76', '76147', NULL, 4.760211937808062, -75.91769424375231, 19);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('811016273-1', 'Salud Reproductiva', '05', '05001', NULL, 6.250040042541063, -75.56324838688532, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901526275-1', 'Ciru Santa Ana S.A.S.', '11', '11001', '1100101', 4.696366327777668, -74.03219228774293, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900215983-1', 'Clínica Belo Horizonte Ltda.', '41', '41001', NULL, 2.93354680824614, -75.24777521938873, 89);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900193988-1', 'Uroclínica de Córdoba S.A.S.', '23', '23001', NULL, 8.750732569763048, -75.88193752306822, 24);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812000527-1', 'Clínica Sahagún IPS S.A.S.', '23', '23660', NULL, 8.948212880370965, -75.44670829028509, 22);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('807002152-1', 'Clínica Oftalmológica Peñaranda', '54', '54001', NULL, 7.88074358499243, -72.49807653656852, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('811046900-1', 'Clínica Cardio Vid', '05', '05001', NULL, 6.2247323393771, -75.57472653079203, 173);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-9', 'Clínica Keralty Ibagué', '73', '73001', NULL, 4.436941429740907, -75.20302557746328, 99);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901249661-1', 'Clínica Bella Suiza', '11', '11001', '1100101', 4.705330402136046, -74.03185474135735, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('823002991-1', 'Clínica Salud Social S.A.S.', '70', '70001', NULL, 9.295991880950616, -75.396998603236, 249);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('839000145-1', 'Asociación de Cabildos Y/O Autoridades Tradicionales de La Guajira', '44', '44430', NULL, 11.382590055985297, -72.24523433734284, 88);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('820001277-1', 'Centro de Cancerología de Boyacá S.A.S.', '15', '15001', NULL, 5.551447691465368, -73.3459988987755, 81);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('823004895-1', 'Unidad Médica Integral del San Jorge S.A.S.', '70', '70708', NULL, 8.657358678233331, -75.13105536583748, 18);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901315311-2', 'Clínica Aurora del Mar', '13', '13001', NULL, 10.420108081092206, -75.53540679682564, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800000118-1', 'Empresa Social del Estado Hospital departamental Universitario del Quindío San Juan de Dios', '63', '63001', NULL, 4.556146759628807, -75.6567642788959, 311);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('816002834-1', 'Clínica Ver Bien S.A.', '66', '66001', NULL, 4.807083532675607, -75.6813944681382, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892300979-1', 'Clínica del Cesar S.A.', '20', '20001', NULL, 10.472075793007388, -73.25215101626061, 160);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891200032-1', 'Clínica Nuestra Señora de Fátima', '52', '52001', NULL, 1.2173294120006173, -77.27652970184933, 72);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819000364-1', 'Clínica de La Mujer S.A.', '47', '47001', NULL, 11.23572561987276, -74.19026143190118, 82);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891800395-1', 'Hospital Regional de Moniquirá E.S.E.', '15', '15469', NULL, 5.867005740079229, -73.57548469284822, 49);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900439194-1', 'Stemwell', '11', '11001', '1100101', 4.697191883095981, -74.03985830853621, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900611653-1', 'Clínica Vivir', '66', '66001', NULL, 4.801674549750414, -75.68643755296132, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800254141-1', 'Clínica de Fracturas S.A.S.', '76', '76520', NULL, 3.541040084826642, -76.29715010427459, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890906347-1', 'E.S.E. Hospital Manuel Uribe Ángel', '05', '05266', NULL, 6.166790072452807, -75.57991395059874, 326);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900625317-1', 'Corporación Hospital Infantil Concejo de Medellín', '05', '05001', NULL, 6.268146902983646, -75.55880177540507, 105);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900422064-1', 'Centro Especializado de Urología S.A.S. Barranquilla', '08', '08001', NULL, 11.000778611659854, -74.81567011333571, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900829069-1', 'Grupo Empresarial Jarbsalud IPS S.A.S.', '11', '11001', '1100113', 4.621702291854586, -74.07131325605974, 19);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890701033-1', 'Hospital San Rafael de El Espinal Empresa Social del Estado E.S.E.', '73', '73268', NULL, 4.15232530954044, -74.87894896111915, 148);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800154347-1', 'Empresa Social del Estado Hospital La Candelaria', '47', '47245', NULL, 9.008168238679366, -73.97154923894504, 59);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891001122-1', 'Clínica Montería S.A.', '23', '23001', NULL, 8.771535355441975, -75.86780625628485, 107);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890936927-1', 'Centro de Ortopedia del Poblado S.A.S.', '05', '05001', NULL, 6.209352348721864, -75.5691372366181, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900067136-1', 'E.S.E. Hospital Regional de Vélez', '68', '68861', NULL, 6.015643915823461, -73.67397298753647, 35);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800197217-1', 'Clínica de Especialistas María Auxiliadora S.A.S.', '20', '20011', NULL, 8.309986825026062, -73.60414686237884, 34);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806004548-1', 'Centro médico Crecer Ltda.', '13', '13001', NULL, 10.4092291082002, -75.51742123513202, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013779-2', 'Profamilia Bogotá Teusaquillo', '11', '11001', '1100113', 4.623276238030671, -74.06996389022076, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900638867-1', 'Integrales Health S.A.S. - Clínica de Los Ríos', '13', '13430', NULL, 9.24315875309, -74.75423677086704, 103);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900469882-1', 'Centro Trauma Vallesalud', '76', '76364', NULL, 3.256385884391788, -76.53634057475321, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890301430-1', 'Clínica Nuestra Señora de Los Remedios', '76', '76001', NULL, 3.462734765733817, -76.52246353876669, 274);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900033371-1', 'Clínica Victoriana', '05', '05001', NULL, 6.255919136466036, -75.5633838490626, 108);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900570697-1', 'Redes Imat Buga', '76', '76111', NULL, 3.9057067402869015, -76.29805387783745, 7);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900063460-1', 'Cliniq dermoestética Y Laser S.A.', '05', '05001', NULL, 6.240621940956888, -75.59215703661721, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830113849-1', 'Clínica Juan N Corpas Ltda.', '11', '11001', '1100111', 4.76121742523095, -74.09279609153855, 149);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901685966-1', 'Clínica Central del Eje S.A.S.', '66', '66001', NULL, 4.812882197284504, -75.76566375502401, 57);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901153925-1', 'Clínica Nueva El Lago S.A.S. - Sede Calle 76', '11', '11001', '1100102', 4.66288147136409, -74.0597225413573, 91);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800117564-1', 'Clínica de La Mujer', '11', '11001', '1100102', 4.677687053419595, -74.05725897279952, 83);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900090619-1', 'Tpf Cirujanos Y Cia Ltda.- Nueva Clínica Los Cedros', '11', '11001', '1100101', 4.7216268713601455, -74.04713888949965, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('813005431-1', 'Sociedad Clínica Emcosalud S.A.', '41', '41001', NULL, 2.925163649083877, -75.28641019017091, 86);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800074742-1', 'Instituto de Reproducción Humana Procrear Ltda.', '08', '08001', NULL, 10.98941273566892, -74.80751740863448, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900958401-1', 'VIP Clinic Center S.A.S.', '50', '50001', NULL, 4.144664793356877, -73.6416306720323, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900817788-1', 'Clínica de Marly Jorge Cavelier Gaviria S.A.S.', '25', '25175', NULL, 4.874790044847957, -74.03663300583376, 87);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900248882-1', 'Clínica Portoazul S.A. Sigla Cpa', '08', '08573', NULL, 11.01550816729142, -74.84682148793752, 186);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901201887-1', 'Hospital de Alta Complejidad del Putumayo S.A.S. Zomac', '86', '86568', NULL, 0.5044234780107273, -76.48328864070471, 162);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900016598-1', 'Instituto Cardiovascular del Cesar S.A.', '20', '20001', NULL, 10.47007387741137, -73.25230449294729, 125);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800051998-1', 'Clínica de Oftalmología Sandiego S.A.', '05', '05001', NULL, 6.229037754507554, -75.56906210189958, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900582598-1', 'Cirugía Ambulatoria La Colina 122', '11', '11001', '1100111', 4.7499782678533125, -74.06557082923554, 151);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891200952-1', 'E.S.E. Hospital Eduardo Santos', '52', '52399', NULL, 1.6044616648335903, -77.13102378021316, 44);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900559103-2', 'Clínica Gloria Patricia Pinzón', '18', '18001', NULL, 1.611184816604719, -75.60812590010872, 55);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900181419-2', 'Meintegral Zipaquirá', '25', '25899', NULL, 5.020571002814866, -73.99840632951783, 36);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900196366-1', 'E.S.E. Hospital San Antonio de Padua', '13', '13744', NULL, 7.945453327746249, -73.95306982253719, 37);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860015929-1', 'Empresa Social del Estado Hospital Salazar de Villeta', '25', '25875', NULL, 5.006797808668356, -74.47037745361445, 36);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900373079-1', 'Fundación Reina Isabel', '76', '76001', NULL, 3.4202131599776444, -76.54630902512683, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890802036-1', 'E.S.E. Hospital San Marcos', '17', '17174', NULL, 4.9839573117486, -75.61010387421261, 41);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819006339-1', 'Central Quirúrgica Surgifast S.A.', '47', '47001', NULL, 11.238715360702871, -74.21329504632368, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900438315-1', 'Cemediq', '85', '85001', NULL, 5.342512112689748, -72.38951509031787, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900082202-1', 'Clínica Central O.H.L. Ltda.', '23', '23001', NULL, 8.755805351387062, -75.88347474979753, 86);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('810003245-1', 'Clínica Ospedale Manizales S.A.', '17', '17001', NULL, 5.062785608992201, -75.49777100988332, 146);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901576207-1', 'Nuevo Centro Médico-Quirúrgico Zarzal S.A.S.', '76', '76895', NULL, 4.391646558306562, -76.07414140622917, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890801099-1', 'Hospital departamental Universitario Santa Sofia de Caldas', '17', '17001', NULL, 5.0574259899262834, -75.52990347737935, 141);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812005522-1', 'Fundación Amigos de La Salud', '23', '23001', NULL, 8.751087752455105, -75.88160295546388, 656);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901228997-1', 'Clínica Primero de Mayo Integral S.A.S.', '68', '68081', NULL, 7.058534889811466, -73.85627905164773, 55);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860024766-1', 'Hospital San Martin de Porres de Chocontá- Empresa Social del Estado Región de Salud Centro Oriente Almeidas', '25', '25183', NULL, 5.14602941353705, -73.6829682367289, 43);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901504183-1', 'Medicina Integral Av IPS S.A.S.', '70', '70001', NULL, 9.301328928818911, -75.39908408222519, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800025755-1', 'IPS Clínica San Ignacio Ltda.', '08', '08001', NULL, 10.946836845218732, -74.82156671053247, 41);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892115010-1', 'Empresa Social del Estado Hospital San Rafael', '44', '44650', NULL, 10.766125742650726, -73.01136650115583, 73);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890901826-1', 'Hospital Pablo Tobón Uribe', '05', '05001', NULL, 6.277077365105349, -75.57981446722712, 516);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('801000713-1', 'Oncólogos del Occidente S.A.S.', '17', '17001', NULL, 5.035968295929141, -75.46934968659556, 150);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800130625-1', 'Hospital San Cristóbal Empresa Social del Estado', '47', '47189', NULL, 11.015036247181252, -74.24590639202314, 58);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900138649-1', 'Medicenter Especializado Ltda.', '44', '44001', NULL, 11.546155428735409, -72.9134959309382, 7);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890117677-1', 'Clínica Mediesp S.A.S.', '08', '08001', NULL, 11.003705195659707, -74.81981778694751, 29);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890981726-1', 'Empresa Social del Estado Hospital San Juan de Dios Yarumal', '05', '05887', NULL, 6.957047281945735, -75.41404198859608, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800178948-1', 'Clínica Los Andes S.A.', '76', '76001', NULL, 3.4220922736960877, -76.5430866013096, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901639560-1', 'IPS Meditraumas del Sinú S.A.S.', '23', '23815', NULL, 9.187691724, -75.55713812, 3);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830023202-1', 'Clínica del Bosque', '13', '13001', NULL, 10.388800806506891, -75.50174661522674, 57);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900341876-1', 'World Medical Center', '11', '11001', '1100101', 4.695101767331468, -74.0361860034745, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('811007832-1', 'IPS Sura Industriales Medellín', '05', '05001', NULL, 6.228877078651102, -75.57449914379896, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860514752-1', 'Instituto de Ortopedia Y Cirugía Plástica S.A.S.', '11', '11001', '1100101', 4.697778714574997, -74.05097658705961, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900874361-1', 'Centro Ortopédico del Cesar S.A.S.', '20', '20001', NULL, 10.476253036465966, -73.24938910215522, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812005130-1', 'Clínica de Traumas Y Fracturas Ulises Herrera Sánchez Especialista Asociados', '23', '23001', NULL, 8.750240026700576, -75.88053582794029, 73);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901700170-1', 'E.S.E. Renacer - Inírida', '94', '94001', NULL, 3.8657756129427367, -67.92507790066944, 61);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830146310-1', 'Clínica Corpolaser', '11', '11001', '1100101', 4.686486774082736, -74.04483128811002, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900228989-1', 'Clínica Santa Sofia del Pacifico S.A.S.', '76', '76109', NULL, 3.880451902097991, -77.02020172471978, 105);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891300047-1', 'Clínica Palmira S.A.', '76', '76520', NULL, 3.528957817044841, -76.3012638562301, 63);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860007373-1', 'Fundación Hospital San Carlos', '11', '11001', '1100118', 4.570862077311099, -74.10720036924138, 285);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901049966-1', 'Centro Hospitalario Regional Santa Mónica S.A.S.', '08', '08001', NULL, 10.991327622786809, -74.80597805289156, 92);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890934747-1', 'Clínica de Fracturas de Medellín Ltda.', '05', '05001', NULL, 6.212338962953221, -75.57606462080716, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892300175-1', 'Hospital Regional San Andrés E.S.E.', '20', '20178', NULL, 9.362653485071926, -73.59935451293644, 103);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800123106-1', 'E.S.E. Hospital Venancio Díaz Díaz', '05', '05631', NULL, 6.148330425548087, -75.62169143981981, 30);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800129856-1', 'IPS Clínica de La Costa S.A.S.', '08', '08001', NULL, 11.002315272962532, -74.81317748071436, 238);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800198174-1', 'Mediservicios S.A.', '63', '63001', NULL, 4.544629395283769, -75.66274868961301, 6);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900189664-1', 'Clínica de Cirugía Plástica Dr. César Bolaños', '66', '66001', NULL, 4.807106195492069, -75.68987882478265, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892000401-1', 'Inversiones Clínica del Meta S.A.', '50', '50001', NULL, 4.144465938767297, -73.63681391341032, 135);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802024077-1', 'Doral Medical de Colombia Ltda.', '08', '08001', NULL, 10.99944488803384, -74.81774526553366, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800219192-1', 'Clínica Santillana', '17', '17001', NULL, 5.060620928679347, -75.49172147738162, 25);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891800023-1', 'Clínica Tundama S.A.', '15', '15238', NULL, 5.827564407826667, -73.03607008328949, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('824001041-1', 'Clínica Médicos Sa', '20', '20001', NULL, 10.47240053977978, -73.2474200046039, 424);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800185449-1', 'Clínica Avidanti Manizales', '17', '17001', NULL, 5.083715807221048, -75.52602470674671, 283);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013779-3', 'Profamilia Tunja', '15', '15001', NULL, 5.543827868898156, -73.35768623868552, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900272320-1', 'Compañía de Neurólogos Neurocirujanos Y Especialidades Afines Sociedad Por Acciones Simplificada', '54', '54001', NULL, 7.892704728489178, -72.48856444517669, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812005644-1', 'Clínica Regional del San Jorge I.P.S. Sa', '23', '23466', NULL, 7.985374396597971, -75.42223666353838, 33);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900245405-1', 'Clínica Isis S.A.S.', '05', '05266', NULL, 6.1816550965589485, -75.58046049982073, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901536799-1', 'Centro de Atención Complementaria Especializado Alta Complejidad Adultos - Cace Alta Complejidad Adultos', '08', '08001', NULL, 10.970666810551544, -74.8006546854266, 314);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891200679-1', 'E.S.E. Hospital José María Hernández de Mediana Y Alta Complejidad', '86', '86001', NULL, 1.1585253025416655, -76.64756616671626, 197);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800110181-1', 'Clínica de Fracturas Y Ortopedia Ltda.', '41', '41001', NULL, 2.93604796895587, -75.28941796624622, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900891534-1', 'Mefesalud IPS Caucasia Sede 2', '05', '05154', NULL, 7.98317046885833, -75.19816310145387, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900002780-1', 'Fundación Campbell', '08', '08001', NULL, 10.95210184894636, -74.78761977473151, 79);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860015888-1', 'Hospital Universitario Clínica San Rafael', '11', '11001', '1100118', 4.576725390133819, -74.09120722887337, 338);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('838000096-1', 'E.S.E. Hospital San Rafael', '91', '91001', NULL, -4.208698433230071, -69.94302403577632, 132);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900176496-1', 'Sociedad Médica Los Samanes S.A.S.', '54', '54001', NULL, 7.896449440560355, -72.48859906911197, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805019703-1', 'Centro Médico Ip Salud S.A.S.', '76', '76001', NULL, 3.4178864963323674, -76.49429657292625, 14);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800006602-1', 'Clínica Avellaneda Hernández S.A.S.', '11', '11001', '1100101', 4.691560901289351, -74.04861332601517, 2);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('824002277-1', 'Clínica Buenos Aires', '20', '20001', NULL, 10.473323636650631, -73.2534400457083, 15);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900124603-1', 'Clínica Med S.A.S.', '76', '76001', NULL, 3.426865560660316, -76.54427087371079, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900091143-1', 'Hospital Santa Mónica', '52', '52001', NULL, 1.2049456488643373, -77.25390636081767, 42);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900171988-1', 'Clínica de Fracturas Vita S.A.S.', '17', '17380', NULL, 5.451827603722345, -74.66204757151326, 6);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900685235-1', 'Clínica Medicenter Ficubo S.A.S.', '85', '85001', NULL, 5.346510840541617, -72.39586207956954, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('807001041-1', 'Centro Médico La Samaritana Ltda.', '54', '54405', NULL, 7.835207027472385, -72.50930936671243, 27);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830066626-1', 'Clínica Medihelp Services', '13', '13001', NULL, 10.397452100088218, -75.55632827080744, 54);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900211668-1', 'Clínica Santa Teresita del Niño Jesús S.A.', '11', '11001', '1100109', 4.672054538171513, -74.13683819123395, 15);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900750333-1', 'Empresa Social del Estado del Orden departamental Hospital Nuestra Señora de Las Mercedes del Municipio de Funza', '25', '25286', NULL, 4.712155609265651, -74.21291775978908, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('817003166-1', 'Clínica La Estancia S.A.', '19', '19001', NULL, 2.450552976076464, -76.59735837421597, 121);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901060053-1', 'Clínica Azul', '11', '11001', '1100112', 4.679811934359848, -74.06481140025285, 92);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900936058-1', 'Clínica Reina Lucia S.A.S.', '68', '68081', NULL, 7.066221878399396, -73.86300314267231, 35);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800146467-1', 'Quirófanos Llanogrande By Orve', '05', '05615', NULL, 6.132094686227901, -75.39607365481521, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800194798-1', 'Organización Clínica Bonnadona Prevenir S.A.S.', '08', '08001', NULL, 11.002214550788391, -74.81667495568318, 315);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800254132-1', 'Medicadiz S.A.S.', '73', '73001', NULL, 4.424915421627889, -75.17640597256478, 216);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819002176-1', 'Compañía Colombiana de Salud Colsalud S.A.', '47', '47001', NULL, 11.236867956797989, -74.19475579199332, 233);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819001483-1', 'E.S.E. Hospital Fray Luis de León', '47', '47555', NULL, 9.794765843536904, -74.78814979479124, 84);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901377982-1', 'Diamanti Clínica Boutique S.A.S.', '08', '08001', NULL, 11.000170385711456, -74.81553668648547, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812004935-1', 'Clínica Materno Infantil Casa del Niño Sede Principal', '23', '23001', NULL, 8.760952432222027, -75.87843244575458, 206);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900615608-1', 'Bonsana IPS S.A.S.', '76', '76834', NULL, 4.091637297388592, -76.18819741515246, 11);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800183943-1', 'Clínica Santa María S.A.S.', '70', '70001', NULL, 9.306486294919177, -75.39371686890806, 305);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900740827-1', 'Clínica Cumi S.A.S.', '23', '23001', NULL, 8.75962105957378, -75.87022253439979, 197);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900126941-1', 'Clínica Excellence', '76', '76001', NULL, 3.364603637572123, -76.53462964262415, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860009555-1', 'E.S.E.Hospital Santa Matilde de Madrid', '25', '25430', NULL, 4.735301370055316, -74.25970960275433, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890307200-1', 'Clínica Imbanaco S.A.S. Sede Principal', '76', '76001', NULL, 3.426349405579722, -76.54528265510793, 362);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900627725-1', 'Clínica Nieves Centro de Excelencia Vascular', '85', '85001', NULL, 5.326931191715864, -72.38818014169568, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900038926-1', 'Clínica Central Fundadores', '05', '05001', NULL, 6.2509324089499465, -75.56425545461593, 94);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860090566-1', 'Clínica del Occidente S.A.', '11', '11001', '1100108', 4.629489513192148, -74.13574666109238, 256);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900594169-1', 'Clínica Equipo Médico de Especialista de Colombia', '08', '08001', NULL, 10.972892628754655, -74.78150957770686, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890806490-1', 'Caja de Compensación Familiar de Caldas Confa Salud Sede Clínica San Marcel', '17', '17001', NULL, 5.03544193373487, -75.46828872364509, 62);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901437002-1', 'ESCAF S.A.S.', '08', '08634', NULL, 10.790126630832331, -74.75343673250259, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890701353-1', 'Nuevo Hospital La Candelaria', '73', '73585', NULL, 3.8566565834421698, -74.93439990018517, 35);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800024744-1', 'Unidad de Cirugía del Tolima', '73', '73001', NULL, 4.433238543886525, -75.21017268019192, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901267161-1', 'Centro Médico Aura Elena S.A.S.', '08', '08758', NULL, 10.916144967214288, -74.76624609422578, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890982608-1', 'Corporación Para Estudios En Salud Clínica Ces', '05', '05001', NULL, 6.256915299127405, -75.56552125570319, 197);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800024390-1', 'Dime Clínica Neurocardiovascular S.A.', '76', '76001', NULL, 3.461572441006408, -76.52906928676589, 52);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900240018-1', 'Los Comuneros Hospital Universitario de Bucaramanga', '68', '68001', NULL, 7.126085678332449, -73.11808662770163, 221);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901323248-1', 'Clínica Santa María del Caribe S.A.S.', '20', '20001', NULL, 10.466454618269804, -73.25437747539914, 93);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('832010436-1', 'Hospital María Auxiliadora Empresa Social de Estado del Municipio de Mosquera', '25', '25473', NULL, 4.703668901408699, -74.22802587262129, 24);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901129333-1', 'Clínica San Sebastián IPS', '23', '23001', NULL, 8.758066955897124, -75.88029117518333, 190);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900226451-1', 'Especialidades Médicas Metropolitanas S.A.S.', '05', '05088', NULL, 6.339028454629744, -75.54153378388999, 40);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('812003851-1', 'E.S.E. Hospital San Juan de Sahagún', '23', '23660', NULL, 8.955324223880298, -75.45059553259931, 85);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890933408-1', 'Clínica Oftalmológica de Antioquia', '05', '05001', NULL, 6.2232491805788674, -75.57488273243887, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('899999017-1', 'Sociedad de Cirugía de Bogotá - Hospital de San José', '11', '11001', '1100114', 4.602991744957953, -74.08673210063722, 245);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800241602-1', 'Fundación Colombiana de Cancerología Clínica Vida', '05', '05001', NULL, 6.239883669644668, -75.57902098716264, 222);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900517542-1', 'Clínica Fundación IPS - Sede 02', '47', '47288', NULL, 10.520375814217918, -74.18631352658772, 72);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890110705-1', 'Clínica de Fracturas Centro de Ortopedia Y Traumatología S.A.', '08', '08001', NULL, 11.007588229824805, -74.8203278685951, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900855509-1', 'Clínica de Fracturas Valledupar S.A.S.', '20', '20001', NULL, 10.463624229496284, -73.25459518090456, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901108368-1', 'Clínica de Alta Complejidad Santa Bárbara S.A.S.', '76', '76520', NULL, 3.530612438094217, -76.3048292989773, 106);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901714987-1', 'Clínica Cali', '76', '76001', NULL, 3.469612004364324, -76.52202905334181, 215);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800176807-1', 'Profesionales de La Salud S.A. Proinsalud S.A.', '52', '52001', NULL, 1.2186520343261376, -77.28642997507865, 86);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800201726-1', 'Fundación Policlínica Ciénaga', '47', '47189', NULL, 11.011500052468406, -74.25027660345583, 111);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900148265-1', 'Clínica Cardiovascular', '50', '50001', NULL, 4.143006053568595, -73.63991937949662, 50);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890303208-1', 'IPS Especialistas Tequendama', '76', '76001', NULL, 3.4206191572587814, -76.54770437137684, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('811038014-1', 'Clínica de Oncología Astorga', '05', '05001', NULL, 6.209688878250489, -75.57324458373296, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800212086-1', 'Instituto Urológico del Norte', '08', '08001', NULL, 11.004807596375484, -74.8208795518576, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819000413-1', 'Clínica General de Ciénaga S.A.S.', '47', '47189', NULL, 11.006773299080791, -74.24587280331558, 17);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800204153-1', 'E.S.E. Hospital San Vicente de Paul de Lorica', '23', '23417', NULL, 9.238371080492632, -75.81224004571833, 127);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800123572-1', 'Clínica Chinita Sa', '05', '05045', NULL, 7.886150338172923, -76.62997720042644, 18);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890303461-1', 'E.S.E. Hospital Universitario del Valle Evaristo García Empresa Social del Estado', '76', '76001', NULL, 3.4302251199673823, -76.54487805131703, 499);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('805002370-1', 'Hospitrauma Limitada', '76', '76001', NULL, 3.4765288519777133, -76.52366932148534, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800012189-1', 'Clínica San José de Cúcuta Sa', '54', '54001', NULL, 7.885342652790882, -72.49666241095551, 267);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900071466-1', 'Iq Interquirófanos S.A.', '05', '05001', NULL, 6.206468590559931, -75.57013154976663, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('823004881-1', 'I.P.S. Clínica Guaranda Sana S.A.S.', '70', '70265', NULL, 8.467260552064932, -74.53814242101261, 48);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900047319-1', 'Clinical Spa Cirugía Plástica & Laser Ltda.', '52', '52001', NULL, 1.225844921181512, -77.28723420725547, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900027397-1', 'Clínica Higea IPS S.A.', '13', '13001', NULL, 10.406562599213952, -75.5148384035649, 54);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800218979-1', 'Hospital San Vicente E.S.E.', '81', '81001', NULL, 7.082081567570154, -70.7530728862096, 130);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900442870-1', 'Clínica Oncológica Aurora S.A.S.', '52', '52001', NULL, 1.2159357877558352, -77.287805951748, 65);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890102140-1', 'Clínica La Asunción', '08', '08001', NULL, 10.989739189385755, -74.80709839519076, 162);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819003863-1', 'Prevención Y Salud IPS Limitada', '47', '47245', NULL, 9.006986200710864, -73.97232137539119, 128);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('825003080-1', 'Unidad de Cuidados Intensivos Renacer', '44', '44001', NULL, 11.54310523, -72.91138675, 77);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891408586-1', 'Liga Contra El Cáncer Risaralda', '66', '66001', NULL, 4.817450089402223, -75.69768318707446, 47);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891855847-1', 'Clínica Casanare S.A.', '85', '85001', NULL, 5.34843075291234, -72.39109612890122, 90);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901324466-1', 'Unidad Ambulatoria de Alta Complejidad S.A.S.', '50', '50001', NULL, 4.144312746253328, -73.63501099558127, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900419180-1', 'Clínica Flavio Restrepo S.A.S.', '17', '17380', NULL, 5.45163749812887, -74.66306446297159, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891200209-1', 'Fundación Hospital San Pedro', '52', '52001', NULL, 1.2239986948718824, -77.29128189963187, 209);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900263250-1', 'Mediclínica Soluciones Integrales En Salud IPS S.A.S.', '08', '08001', NULL, 11.000140822389303, -74.81455694243897, 18);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891180268-1', 'E.S.E. Hospital Universitario Hernando Moncaleano Perdomo de Neiva', '41', '41001', NULL, 2.9321403288008034, -75.28119405007203, 332);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860002541-1', 'Clínica de Marly', '11', '11001', '1100102', 4.63677661886124, -74.06505785147387, 128);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900164285-1', 'Clínica San Martin Barranquilla Ltda.', '08', '08001', NULL, 10.991077292052635, -74.80567723757554, 147);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890807591-1', 'Servicios Especiales de Salud-Ses Hospital Universitario de Caldas', '17', '17001', NULL, 5.062962905741833, -75.50092978050142, 196);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901326028-1', 'Perfect Clinic', '54', '54001', NULL, 7.892758345718986, -72.4915077982712, 22);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901541935-1', 'Bodyinstitute', '11', '11001', '1100102', 4.679119486879289, -74.04668013644728, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901241255-1', 'Clinisports de Colombia S.A.S.', '68', '68001', NULL, 7.110784954875528, -73.1110530100441, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891855039-1', 'Hospital Regional de Sogamoso Empresa Social del Estado', '15', '15759', NULL, 5.713510638256742, -72.93111536811632, 161);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800179966-1', 'Clínica Reina Catalina Baranoa', '08', '08078', NULL, 10.807828939987235, -74.91604813586802, 357);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900142282-1', 'Fundación Clínica Leticia', '91', '91001', NULL, -4.216814029929684, -69.93726759748398, 39);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892200273-1', 'Clínica Las Peñitas Sede Hospitalaria', '70', '70001', NULL, 9.302757531147142, -75.388549995347, 68);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890680025-1', 'Empresa Social del Estado Hospital San Rafael de Fusagasugá', '25', '25290', NULL, 4.333364599102096, -74.37094312063512, 145);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900529056-1', 'Medifaca IPS S.A.S.', '25', '25269', NULL, 4.819573395709, -74.35756868602301, 82);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('810000913-1', 'E.S.E. Hospital San Félix', '17', '17380', NULL, 5.450818931768424, -74.66409760290912, 101);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('832004115-1', 'Clínica San Luis', '25', '25843', NULL, 5.307011886997111, -73.81596443286014, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890303461-2', 'Hospital Universitario del Valle Evaristo García E.S.E. Sede Cartago', '76', '76147', NULL, 4.751603419313227, -75.90359069831736, 81);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901273698-1', 'Clínica Activecare', '05', '05266', NULL, 6.182100253692157, -75.57998873926789, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802016761-1', 'Clínica Jaller S.A.S.', '08', '08001', NULL, 10.993998188650178, -74.7948293327532, 40);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901031682-1', 'Clínica de La Mujer Cartagena IPS', '13', '13001', NULL, 10.411042289702516, -75.53613529541818, 72);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900743259-1', 'Clínica Oat', '66', '66001', NULL, 4.803489669258103, -75.68430130350818, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800168083-1', 'Cooperativa Antioqueña de Salud Sede Spazio', '05', '05001', NULL, 6.239047182685356, -75.59939137807866, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('819002025-1', 'E.S.E. Hospital Santander Herrera de Pivijay', '47', '47551', NULL, 10.459157978485218, -74.61761306898423, 41);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860020283-1', 'Empresa Social del Estado Hospital San José de Guaduas', '25', '25320', NULL, 5.070776745885852, -74.60158753464276, 20);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900191332-1', 'Centro Médico Prevenimos S.A.', '66', '66001', NULL, 4.8088902120775225, -75.68708657968855, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901403201-1', 'Servicios Óptimos En Salud S.A.S. Cartago', '76', '76147', NULL, 4.749874524351586, -75.90936941182207, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('820001181-1', 'Asorsalud Sm Ltda.', '15', '15001', NULL, 5.555010271030024, -73.3508360772187, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('891780008-1', 'E.S.E. Hospital San Rafael', '47', '47288', NULL, 10.51383857416534, -74.18236003789706, 79);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890700666-1', 'Hospital San Juan de Dios Honda Empresa Social del Estado - (733490092601)', '73', '73349', NULL, 5.1992399147700965, -74.75084414834289, 77);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900192459-1', 'Promosalud Sede Quirúrgica', '23', '23001', NULL, 8.75214859521082, -75.8827396285672, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900073857-1', 'Fundación Clínica Integral Sincelejo', '70', '70001', NULL, 9.30441809833842, -75.39193806664595, 51);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('802000774-1', 'Clínica Altos de San Vicente', '08', '08001', NULL, 11.004875435524845, -74.82162482176349, 66);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800003765-1', 'Virrey Solís IPS Sa Umeq Calle 100', '11', '11001', '1100112', 4.686565397478874, -74.06059060182486, 56);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('892399994-1', 'Hospital Rosario Pumarejo de López', '20', '20001', NULL, 10.46910006885733, -73.25473123303443, 269);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900558281-1', 'Meddyz del Norte IPS', '47', '47318', NULL, 9.148430083177209, -74.2254023999125, 18);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900110940-1', 'San Luis Medical Center', '25', '25754', NULL, 4.581903784721273, -74.21285346668061, 37);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901549486-1', 'Vital Health Services IPS S.A.S.', '08', '08001', NULL, 10.990976029466909, -74.81040687642212, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900217463-1', 'Clínica Sanasalud IPS', '47', '47245', NULL, 8.99248675980801, -73.97011575465736, 4);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800191643-1', 'E.S.E. Hospital Regional II Nivel de San Marcos', '70', '70708', NULL, 8.664053610222613, -75.13472082180456, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800162035-1', 'Clínica Centauros I.P.S.', '50', '50001', NULL, 4.142268817437598, -73.64029695970503, 142);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900345765-1', 'Clínica Codazzi Gold', '20', '20013', NULL, 10.034394333868445, -73.23102398223246, 81);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900922290-1', 'Salud Integra IPS S.A.S. Rio Cauca', '76', '76001', NULL, 3.4679074313619087, -76.5238256666329, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900139859-1', 'Fundación Vida Con Amor', '44', '44430', NULL, 11.37720259348561, -72.23345497554617, 6);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900513306-1', 'Fundación María Reina', '70', '70001', NULL, 9.298441735784966, -75.39363012607137, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890480113-1', 'Hospital Regional II Nivel Nuestra Señora de Las Mercedes de Corozal E.S.E.', '70', '70215', NULL, 9.320778873164969, -75.28845300804274, 0);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900357414-1', 'Fundación Avanzar Fos Sede Piedecuesta', '68', '68547', NULL, 7.070787873329211, -73.1131064300106, 2);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900077584-1', 'Red Medicron IPS - Hospital San José de Tuquerres', '52', '52838', NULL, 1.0821127112023836, -77.61519444537684, 40);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860007336-5', 'Clínica Colsubsidio Girardot', '25', '25307', NULL, 4.296665623883847, -74.80343867014477, 103);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800058016-1', 'Unidad Hospitalaria Nuevo Occidente', '05', '05001', NULL, 6.281196734519334, -75.61280101015168, 53);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800058016-2', 'Unidad Hospitalaria de Belén Héctor Abad Gómez', '05', '05001', NULL, 6.229164316646731, -75.59827735779197, 53);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800067065-1', 'Clínica Las Américas', '05', '05001', NULL, 6.178735755814528, -75.58373186925999, 262);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890905843-1', 'Clínica El Rosario Sede Centro', '05', '05001', NULL, 6.255389163710516, -75.55624920406696, 150);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890905843-2', 'Clínica El Rosario Sede El Tesoro', '05', '05001', NULL, 6.193934759283139, -75.55736155291557, 150);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890911816-1', 'Clínica Medellín Occidente', '05', '05001', NULL, 6.232845530012286, -75.58434310291331, 159);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890911816-2', 'Clínica Medellín Poblado', '05', '05001', NULL, 6.206828073910518, -75.57124309846765, 159);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900438216-1', 'Clínica Genezen S.A.S.', '05', '05001', NULL, 6.191537199908636, -75.5799238444711, 63);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900699359-1', 'Neuromédica Rionegro', '05', '05615', NULL, 6.140091467622188, -75.37888341078576, 14);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800067065-2', 'Clínica Las Américas Auna - Sede Sur', '05', '05266', NULL, 6.214012744137268, -75.5946677108424, 262);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900438216-2', 'Clínica Genezen Sede Puerto Berrío', '05', '05579', NULL, 6.488707707033675, -74.40424341911705, 63);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900699359-2', 'Neuromédica Mayorca', '05', '05631', NULL, 6.160166529862376, -75.60508211631037, 14);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-1', 'Clínica El Carmen', '08', '08001', NULL, 10.985183550761688, -74.80987335022702, 75);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-2', 'Clínica Iberoamérica', '08', '08001', NULL, 11.005511437000468, -74.8205215843762, 75);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890102768-1', 'Clínica General del Norte Sede Hospitalaria 2', '08', '08001', NULL, 10.991834510779826, -74.79353615495019, 410);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890102768-2', 'Organización Clínica General del Norte S.A.', '08', '08001', NULL, 11.003944263622737, -74.81958183836898, 410);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901139193-1', 'Mired Barranquilla Camino Sur Occidente', '08', '08001', NULL, 10.962956452403672, -74.83947341946782, 114);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('901139193-2', 'Mired Barranquilla Camino Universitario Distrital Adelita de Char', '08', '08001', NULL, 10.965154826668478, -74.79795937490105, 114);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-3', 'Clínica Infantil Santa María del Lago', '11', '11001', '1100110', 4.692296265865653, -74.0980832655579, 286);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-4', 'Clínica Reina Sofia Pediátrica Y Mujer', '11', '11001', '1100101', 4.706486734767949, -74.05090403083918, 286);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-5', 'Centro Médico Puente Aranda', '11', '11001', '1100116', 4.634125692982733, -74.11254877372549, 286);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-6', 'Clínica Reina Sofia', '11', '11001', '1100101', 4.70691276552089, -74.05198997080508, 286);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-7', 'Clínica Reina Sofia Medicina Avanzada 125', '11', '11001', '1100101', 4.70456541913689, -74.0504919291778, 286);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800149384-8', 'Clínica Universitaria Colombia', '11', '11001', '1100113', 4.648190895677362, -74.10622197080231, 286);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800227072-1', 'Clínica Materno Infantil Eusalud', '11', '11001', '1100113', 4.642493103460875, -74.06875977080995, 52);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800227072-2', 'Eusalud Clínica de Traumatología Y Ortopedia', '11', '11001', '1100108', 4.6276282037710414, -74.1449911413587, 52);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830507718-1', 'Clínica Medical S.A.S.', '11', '11001', '1100114', 4.592807598432202, -74.08996216363073, 158);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('830507718-2', 'Clínica Medical S.A.S. Sede Norte', '11', '11001', '1100112', 4.682677508315564, -74.05836949820933, 158);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860007336-1', 'Colsubsidio Clínica 127', '11', '11001', '1100101', 4.703952553243483, -74.04423288583504, 178);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860007336-2', 'Clínica Colsubsidio Ciudad Roma', '11', '11001', '1100108', 4.615206288069383, -74.17244620622692, 178);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860007336-3', 'Clínica Infantil Colsubsidio', '11', '11001', '1100102', 4.652268002379629, -74.06095451577245, 178);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860007336-4', 'Clínica Colsubsidio Calle 100', '11', '11001', '1100102', 4.686214969329195, -74.0567466582241, 178);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013570-1', 'Centro de Atención En Salud Cafam Clínica Calle 93', '11', '11001', '1100102', 4.679203904008197, -74.05717473918122, 88);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013570-2', 'Centro de Atención En Salud Cafam Clínica Santa Bárbara', '11', '11001', '1100101', 4.704093560003992, -74.04490194640884, 88);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013570-3', 'Centro de Atención En Salud Cafam Clínica Calle 51', '11', '11001', '1100113', 4.638794194168213, -74.06811025185188, 88);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860013570-4', 'Centro de Atención En Salud Cafam Kennedy', '11', '11001', '1100108', 4.623887607387683, -74.15362927793012, 88);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860066942-1', 'Unidad de Servicios Calle 94', '11', '11001', '1100102', 4.681162219812539, -74.05749309377944, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860066942-2', 'Unidad de Servicios de Salud Autopista Sur', '11', '11001', '1100119', 4.595580550757874, -74.17315277116823, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('860066942-3', 'Unidad de Servicios Calle 26', '11', '11001', '1100113', 4.652630575006434, -74.10172733130143, 10);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900210981-1', 'Hospital Universitario Mayor-Mederi', '11', '11001', '1100114', 4.623334508148629, -74.08270645731737, 583);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900210981-2', 'Hospital Universitario Barrios Unidos-Mederi', '11', '11001', '1100112', 4.663672497013976, -74.07987710908219, 583);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900958564-1', 'Unidad de Servicios de Salud El Tunal', '11', '11001', '1100106', 4.571719789112955, -74.12867513035278, 190);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900958564-2', 'Unidad de Servicios de Salud Meissen', '11', '11001', '1100118', 4.559514676580857, -74.13830035356666, 190);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900959048-1', 'Hospital Pediátrico Tintal', '11', '11001', '1100108', 4.651595014209306, -74.14898257955721, 186);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900959048-2', 'Hospital de Bosa', '11', '11001', '1100107', 4.635115274801236, -74.20607237056706, 186);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900959048-3', 'Hospital Fontibón', '11', '11001', '1100109', 4.671682507396267, -74.146343723427, 186);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900959048-4', 'Hospital Occidente de Kennedy', '11', '11001', '1100108', 4.616540119066279, -74.15332009038653, 186);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900959051-1', 'Unidad de Servicios de Salud San Blas', '11', '11001', '1100104', 4.569752102622589, -74.08350650001482, 200);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900959051-2', 'Unidad de Servicios de Salud Santa Clara Hospital Universitario', '11', '11001', '1100115', 4.591492872737771, -74.09232595286191, 200);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900971006-1', 'Unidad de Servicios de Salud Simón Bolívar', '11', '11001', '1100101', 4.742868427155099, -74.02301168124903, 226);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900971006-2', 'Unidad de Servicios de Salud Engativá Calle 80', '11', '11001', '1100110', 4.710961913786103, -74.10972923393435, 226);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900971006-3', 'Unidad de Servicios de Salud Centro de Servicios Especializado', '11', '11001', '1100111', 4.753542117244553, -74.0919445837163, 226);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('804014839-1', 'Instituto del Corazón de Bucaramanga-sede Bogotá', '11', '11001', '1100113', 4.623546083734686, -74.06959885946479, 22);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806015201-1', 'Gestión Salud - Amberes', '13', '13001', NULL, 10.407721468048376, -75.5163225426453, 89);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('806015201-2', 'Gestión Salud-San Fernando', '13', '13001', NULL, 10.379221793692704, -75.4756224646012, 89);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900196347-1', 'Empresa Social del Estado Hospital La Divina Misericordia', '13', '13430', NULL, 9.244150307697137, -74.75526796450302, 140);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900196347-2', 'E.S.E. Hospital La Divina Misericordia Sede San Juan de Dios Mompós', '13', '13468', NULL, 9.256473373662336, -74.43099848346431, 140);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900008328-1', 'Clínica Santa Isabel L.D.', '20', '20001', NULL, 10.462320005653204, -73.25117133688875, 214);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900008328-2', 'Ohi Organización Humana Integral S.A.', '20', '20001', NULL, 10.47066166333449, -73.25746149950697, 214);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('813001952-3', 'Clínica Medilaser S.A.', '41', '41001', NULL, 2.93068011257469, -75.28782237321727, 168);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('813001952-4', 'Clínica Medilaser Sede Abner Lozano', '41', '41001', NULL, 2.941213385014256, -75.29949745576265, 168);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('813011577-1', 'Clínica Uros S.A.S. - Sede Centro', '41', '41001', NULL, 2.9234378694335006, -75.28594585077484, 80);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('813011577-2', 'Clínica Uros S.A.S. - Torre A', '41', '41001', NULL, 2.93457196313154, -75.28979500244712, 80);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800175901-1', 'Clínica Emperatriz S.A.S.', '50', '50001', NULL, 4.156459201191459, -73.63718289107166, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800175901-2', 'Clínica Emperatriz Sede Barzal', '50', '50001', NULL, 4.144691127830611, -73.63939016931985, 8);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900342064-2', 'Clínica San Rafael Sede Cuba', '66', '66001', NULL, 4.801648579691926, -75.74136118146443, 201);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900342064-3', 'Clínica San Rafael Sede Megacentro', '66', '66001', NULL, 4.803812822531239, -75.6897342726292, 201);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890209698-1', 'Clínica Chicamocha Sa', '68', '68001', NULL, 7.120665236822153, -73.11478833225361, 101);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890209698-2', 'Clínica Chicamocha Sede González Valencia', '68', '68001', NULL, 7.110055748780144, -73.1116906324252, 101);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('804014839-2', 'Instituto del Corazón de Bucaramanga', '68', '68001', NULL, 7.120979583764418, -73.11480397326893, 22);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890202024-1', 'Empresa Social del Estado Hospital San Juan de Dios de Floridablanca', '68', '68276', NULL, 7.060940691829962, -73.08822990241045, 46);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890202024-2', 'Unidad Materno Infantil - Umi', '68', '68276', NULL, 7.061051756317317, -73.08831134697559, 46);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890212568-2', 'Instituto Cardiovascular Sede Ambulatoria', '68', '68547', NULL, 7.035227132594248, -73.06969724875334, 453);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890212568-3', 'Hospital Internacional de Colombia', '68', '68547', NULL, 7.035943102577871, -73.06858903276776, 453);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800212422-1', 'Christus Sinergia Clínica Lungavita', '76', '76001', NULL, 3.364012560148381, -76.53396545207518, 67);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('800212422-2', 'Clínica Farallones', '76', '76001', NULL, 3.4100537484986706, -76.53953159605796, 67);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890324177-1', 'Fundación Valle del Lili', '76', '76001', NULL, 3.37275091944751, -76.52562880541036, 567);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890324177-2', 'Fundación Valle del Lili Sede Limonar', '76', '76001', NULL, 3.3933476327421648, -76.52556446113552, 567);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900631361-1', 'Clínica Valle Salud Sede Sur', '76', '76001', NULL, 3.4208907260885724, -76.53896469390261, 27);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900631361-2', 'Clínica Valle Salud', '76', '76001', NULL, 3.457008635349081, -76.53222931256545, 27);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890303208-2', 'IPS Comfandi Buga', '76', '76111', NULL, 3.899667118617229, -76.30453417533178, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900051107-2', 'Corazón Y Aorta Buga 2', '76', '76111', NULL, 3.8999303182123226, -76.30954864258992, 5);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('900051107-3', 'Corazon y Aorta Buga sede 1', '76', '76111', NULL, 3.8951186683525454, -76.30372449033906, 5);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890303208-3', 'Clínica Comfandi Cartago', '76', '76147', NULL, 4.759816377549786, -75.92529574209294, 12);
INSERT INTO hospitals (code, name, department_id, municipality_id, locality_id, lat, lng, beds) VALUES
('890303208-4', 'IPS Comfandi Palmira', '76', '76520', NULL, 3.528369175485316, -76.29332123914223, 12);

-- Nota: Las asignaciones se deben generar ejecutando el algoritmo OpMap
-- y guardando los resultados en la tabla 'assignments'
