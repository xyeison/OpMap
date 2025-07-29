-- Script de migración del caché de tiempos de viaje
-- Generado el 2025-07-22 12:05:35
-- Total de rutas: 3399
-- Fuente: Google Distance Matrix API

-- Limpiar caché existente de Google Maps (opcional)
-- DELETE FROM travel_time_cache WHERE source = 'google_maps';

-- Insertar tiempos de viaje calculados
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.408202568951646, -75.50435472476818, 146, 100.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.396941284929628, -75.55682774891326, 141, 105.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.39187475946568, -75.47903273304597, 152, 99.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.92906093046752, -74.76399515516277, 34, 9.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.746768823999886, -75.88095883468498, 383, 276.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.456428959171118, -73.24808244570872, 399, 181.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.237766142852204, -74.2013196639611, 130, 71.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.391861874486914, -75.48683757967747, 150, 100.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.79542456975034, -74.91353432412144, 46, 25.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.506879720459802, -75.46667318943247, 121, 90.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.476918028096458, -73.24940512956763, 439, 180.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.32019936103718, -74.57263155765082, 337, 188.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.431934538542462, -75.53473697419038, 132, 101.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.009276795140783, -74.25211573685867, 88, 61.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.245670191054826, -75.81275798184588, 301, 223.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.751278481543796, -75.88631906168824, 384, 276.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.513080215357634, -74.18331054986287, 167, 87.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.407398963989133, -75.51737227761859, 145, 101.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.412309098938977, -75.53662977418323, 143, 102.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.2375398991436, -74.20112766937876, 129, 71.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.237965696710868, -74.18694497441662, 131, 73.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.781690771044536, -75.8605440856462, 374, 272.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.760010180469244, -75.8712087012664, 379, 274.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.306969528437614, -75.393813910799, 265, 198.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.39579516112651, -75.5558846411193, 142, 105.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.241200467025372, -74.18581325919199, 131, 73.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.239323012620996, -74.19202633973426, 130, 72.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.3886419947529, -75.46899683102603, 151, 98.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.001528000262075, -74.81305688946982, 5, 0.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.40555614601419, -75.50808316738481, 147, 100.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.745267339219136, -75.89163933111695, 386, 277.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.227202020205432, -75.82012121567314, 310, 226.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.420490458050551, -75.53831127419171, 138, 102.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.241269105955974, -74.1899972696521, 133, 73.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.400421936704827, -75.5035194907442, 150, 100.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.901661178142346, -74.78280705783865, 37, 11.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.751848746134115, -75.88059360598709, 382, 276.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.914332963163876, -74.77331212565508, 36, 10.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.418024039176418, -75.5331332036317, 139, 101.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.752217881483405, -75.88708866352243, 384, 276.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.640200586841583, -74.91121164496546, 68, 41.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.996134204235979, -73.97231349896727, 392, 241.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.751602745454349, -75.88387485427573, 383, 276.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.630555466618128, -74.92171572163319, 70, 43.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.306946691921432, -75.39496098800981, 266, 198.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.02381645673148, -73.2393653929536, 347, 203.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.23699785089421, -74.21078200556975, 130, 70.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.237564632923002, -74.20043453615679, 130, 71.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.392855855765928, -75.47484764872102, 148, 99.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.407697499174576, -75.50221350360832, 146, 100.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.004559420467931, -74.24398851743851, 90, 62.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.62992172940839, -74.92103795222557, 70, 43.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.305009132203995, -75.39270295664255, 265, 199.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.307145651635354, -75.36995645278405, 256, 198.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.754573354095243, -75.88434012242462, 383, 276.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.888590725407752, -74.79057718624698, 40, 12.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.878793791460454, -75.79585243696457, 355, 259.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.420482095259048, -75.53300502853601, 138, 101.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.30408945161078, -75.40005300080838, 268, 199.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.30569404704766, -75.39303007129625, 265, 199.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.927618399430711, -74.77152621454748, 34, 9.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.238544227432085, -74.20250887561788, 137, 71.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.71368198845475, -75.11704925015722, 187, 147.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.790174197944722, -74.7573227829181, 48, 24.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.394730083115162, -75.47652882850181, 148, 99.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.404322365094073, -75.55333796645938, 139, 104.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.38901570068514, -75.5198496179919, 150, 102.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.237271442422534, -74.20183517668754, 130, 71.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.746049174832741, -75.87664970716389, 381, 276.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.235182995834718, -74.21294966635416, 128, 70.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.394364577601245, -75.47695063287843, 153, 99.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.753391306943337, -75.88672271628357, 384, 276.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.974706856790004, -73.88401171623957, 245, 153.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.397364273763598, -75.48699066553472, 152, 99.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.233125707689602, -74.19485567587951, 127, 72.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.929854444808896, -74.7806659935753, 32, 8.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.754025864104102, -75.8838653800895, 383, 276.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.918553095805152, -74.8165390334128, 24, 9.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.407780897430044, -75.51438834812856, 145, 101.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.471465536735424, -73.25216873405172, 405, 180.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.305467561865347, -75.39146220712489, 264, 199.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.487808054689046, -73.26433467515595, 433, 178.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.636587936350422, -74.92332080590461, 67, 42.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.753555927215924, -75.88585824991253, 383, 276.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.39584522057028, -75.49168734776028, 152, 100.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.476768858373571, -73.25124484570827, 438, 180.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.424572698369555, -75.5468958447697, 136, 102.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.787028325097832, -74.78801388432187, 336, 135.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.238483980615063, -74.213353477533, 130, 70.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.30067570057815, -75.38575789154602, 261, 199.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.74988382673178, -75.88058487028509, 381, 276.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.750732569763048, -75.88193752306822, 382, 276.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.948212880370965, -75.44670829028509, 308, 238.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.295991880950616, -75.396998603236, 265, 200.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.657358678233331, -75.13105536583748, 354, 263.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.420108081092206, -75.53540679682564, 138, 101.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.472075793007388, -73.25215101626061, 406, 180.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.23572561987276, -74.19026143190118, 129, 72.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.008168238679366, -73.97154923894504, 392, 240.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.771535355441975, -75.86780625628485, 374, 273.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.4092291082002, -75.51742123513202, 144, 101.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.24315875309, -74.75423677086704, 292, 195.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.01550816729142, -74.84682148793752, 15, 3.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.47007387741137, -73.25230449294729, 405, 180.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.238715360702871, -74.21329504632368, 130, 70.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.755805351387062, -75.88347474979753, 382, 275.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.751087752455105, -75.88160295546388, 381, 276.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.301328928818911, -75.39908408222519, 267, 199.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.015036247181252, -74.24590639202314, 92, 62.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.187691724, -75.55713812, 309, 217.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.388800806506891, -75.50174661522674, 155, 101.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.476253036465966, -73.24938910215522, 407, 180.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.750240026700576, -75.88053582794029, 381, 276.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.362653485071926, -73.59935451293644, 324, 225.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.47240053977978, -73.2474200046039, 404, 181.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.473323636650631, -73.2534400457083, 406, 180.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.397452100088218, -75.55632827080744, 140, 105.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.236867956797989, -74.19475579199332, 136, 72.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.794765843536904, -74.78814979479124, 332, 134.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.760952432222027, -75.87843244575458, 381, 275.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.306486294919177, -75.39371686890806, 265, 198.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.75962105957378, -75.87022253439979, 379, 274.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.790126630832331, -74.75343673250259, 50, 24.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.916144967214288, -74.76624609422578, 37, 10.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.466454618269804, -73.25437747539914, 402, 180.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.758066955897124, -75.88029117518333, 382, 275.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.955324223880298, -75.45059553259931, 310, 238.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.520375814217918, -74.18631352658772, 170, 87.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.463624229496284, -73.25459518090456, 402, 180.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.011500052468406, -74.25027660345583, 91, 61.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 11.006773299080791, -74.24587280331558, 90, 62.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.238371080492632, -75.81224004571833, 304, 224.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.467260552064932, -74.53814242101261, 460, 283.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.406562599213952, -75.5148384035649, 146, 101.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.006986200710864, -73.97232137539119, 388, 240.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.807828939987235, -74.91604813586802, 41, 24.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.302757531147142, -75.388549995347, 261, 199.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.411042289702516, -75.53613529541818, 143, 102.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.459157978485218, -74.61761306898423, 152, 64.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.51383857416534, -74.18236003789706, 168, 87.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.75214859521082, -75.8827396285672, 382, 276.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.30441809833842, -75.39193806664595, 263, 199.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.46910006885733, -73.25473123303443, 405, 180.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.148430083177209, -74.2254023999125, 399, 216.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.99248675980801, -73.97011575465736, 394, 241.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 8.664053610222613, -75.13472082180456, 351, 262.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.034394333868445, -73.23102398223246, 349, 203.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.298441735784966, -75.39363012607137, 265, 199.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.320778873164969, -75.28845300804274, 244, 194.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.407721468048376, -75.5163225426453, 145, 101.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.379221793692704, -75.4756224646012, 153, 100.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.244150307697137, -74.75526796450302, 292, 195.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 9.256473373662336, -74.43099848346431, 358, 198.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.462320005653204, -73.25117133688875, 400, 181.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(11.002689878603764, -74.81448489302309, 10.47066166333449, -73.25746149950697, 405, 180.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.811809594399092, -73.03132800552976, 394, 146.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.915446839579079, -74.02548280112961, 492, 265.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.215478559392075, -75.56977939900673, 412, 289.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.195493743750158, -73.14269592674758, 565, 214.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.062145747111648, -73.85954526159104, 138, 82.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.879263273494847, -72.498303857623, 290, 107.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.286464322006945, -75.57412433595582, 402, 287.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.309270302327848, -73.60855947238545, 210, 142.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.97325419126968, -74.57780835194671, 275, 206.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.337651871793532, -75.54578535372055, 387, 282.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.540442503611016, -73.36126107027229, 389, 178.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.130649273498971, -74.16030421683267, 543, 250.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.342933259564552, -75.54606044968178, 390, 282.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.242847418268389, -75.55734870218697, 412, 287.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.222452448815396, -75.5748578478459, 411, 289.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.32019936103718, -74.57263155765082, 431, 291.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.254393810926054, -73.35847408706732, 282, 128.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.716517085893189, -72.92556490829342, 423, 158.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.590470955897048, -75.01753906554808, 358, 218.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.262664587034767, -75.56560692494656, 403, 287.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.888800625522722, -72.49070508021187, 290, 109.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.97265356130759, -74.57782846189266, 275, 206.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.377458747214097, -72.64649741661295, 208, 58.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.072752947086473, -73.11015799172242, 16, 6.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.252429230221559, -75.56340068985605, 404, 287.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.995896895722694, -75.19687574284218, 508, 249.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.016202457050314, -74.00384034464943, 478, 254.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.0843597938188845, -70.75101976008281, 770, 260.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.9562034544150215, -71.8821613359353, 594, 137.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.552798357807002, -73.13467223740737, 152, 63.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.239036958943368, -75.58787304427861, 407, 290.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.2455889729430645, -75.61409043745469, 414, 292.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.069962305436829, -73.11504842945598, 18, 6.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.311660490237674, -73.6149151167801, 212, 142.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.04337842658972, -75.4276711314434, 458, 282.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.14070730900199, -75.3775172255897, 436, 272.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.72469182241783, -72.9240704549527, 422, 157.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.982166373787864, -75.20211863480455, 504, 249.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.466746757541894, -73.26392809897133, 182, 75.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.519396164446258, -73.35814739089614, 393, 180.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.236277639717617, -73.35225958873815, 285, 126.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.70220917848447, -72.7294593322646, 279, 63.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.239248877078907, -75.59491146526634, 407, 291.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.569644816440005, -73.33675852423836, 389, 174.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.187845664428742, -75.57886515446782, 413, 291.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.061573448497247, -73.1145911853108, 19, 7.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.215288552445342, -75.57699221885478, 410, 290.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.891013115914071, -72.4890724788446, 291, 109.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.964806467372122, -73.91075596, 474, 256.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.989547285539411, -73.04805011346485, 29, 16.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.250735793510452, -75.55933969694411, 407, 287.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.4535554073119625, -74.67505500725518, 337, 253.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.169941512201537, -75.61129763020115, 421, 295.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.856313949142596, -74.03049273464286, 490, 272.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.058470441833496, -73.85075022837326, 132, 81.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.3487542254486495, -72.39150595551668, 630, 213.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.234056988560798, -75.5731264217, 408, 289.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.304662315718689, -73.81387392237731, 422, 216.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.237235322211198, -73.35275537215867, 285, 126.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.882533707121409, -72.49889908611824, 291, 108.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.182452709273006, -75.56458513049525, 418, 290.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.262664622282357, -75.56560763653907, 403, 287.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.814854035339171, -73.03084155847718, 394, 146.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.248921513187596, -75.56448054020044, 410, 287.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.996134204235979, -73.97231349896727, 311, 228.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.067911527803675, -73.86129685440564, 139, 82.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.85815981939269, -74.06035557374979, 506, 273.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.261685552463122, -75.56151168302485, 405, 286.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.884278789090757, -72.49622673527581, 292, 108.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.07314911513701, -73.11040024832236, 16, 5.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.826837034490856, -73.03308202169862, 392, 144.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.724097272859434, -72.92516047663935, 421, 157.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.343806568025213, -72.39333951684215, 628, 213.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.198919435871809, -75.56160865895626, 416, 289.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.258715094815948, -75.59118702828081, 406, 290.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.856509125138024, -74.06255632904957, 506, 273.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.89263443712793, -72.48948761044065, 292, 109.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.332825178390964, -72.68544202625188, 373, 100.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.880447543048789, -72.49813150215101, 291, 107.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.245828870928576, -75.5837323486538, 403, 289.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.341632319105894, -72.40751299360149, 625, 213.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.905344688165043, -72.4911466863709, 297, 110.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.80635528176181, -74.3498904025329, 541, 291.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.175370204979727, -75.58477773761749, 417, 292.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.203155377602498, -75.57639711635746, 412, 290.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.373947483760963, -72.64417526051112, 211, 58.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.887167350964934, -72.49984133541251, 293, 108.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.554838472250853, -73.13412043763671, 154, 63.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.250225082640299, -75.56186027777261, 406, 287.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.246125877425413, -75.56652839887359, 408, 287.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.37404910377429, -72.64376201625608, 211, 58.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.07425836774148, -73.11001516382542, 17, 5.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.450751115643527, -74.66303999929907, 340, 253.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.2665456922934535, -75.56441901980929, 404, 286.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.309092038381918, -73.60468941979103, 210, 142.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.165927324015932, -75.60063176456407, 418, 294.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.31003164814464, -73.60865334342499, 210, 142.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.817723886800714, -73.64111126879179, 565, 263.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.904012604653347, -72.49106532653165, 296, 110.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.276832786492548, -75.58197126841301, 405, 288.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.060501105844701, -73.85411843375279, 134, 81.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.240590992661879, -75.57942385752102, 405, 289.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.8993573697824, -72.4849641633644, 291, 110.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.1698655191537455, -75.61293070967672, 422, 295.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.543940677699163, -73.35963211900868, 388, 178.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.810106648759004, -73.02968479769682, 396, 146.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.171531679370999, -75.61323271557029, 422, 295.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.264859131802446, -75.56513154731599, 405, 287.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.250040042541063, -75.56324838688532, 407, 287.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.88074358499243, -72.49807653656852, 291, 107.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.2247323393771, -75.57472653079203, 409, 289.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.551447691465368, -73.3459988987755, 388, 177.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.657358678233331, -75.13105536583748, 646, 279.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.867005740079229, -73.57548469284822, 317, 149.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.166790072452807, -75.57991395059874, 422, 292.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.268146902983646, -75.55880177540507, 406, 286.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.008168238679366, -73.97154923894504, 311, 229.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.209352348721864, -75.5691372366181, 412, 289.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.015643915823461, -73.67397298753647, 331, 138.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.309986825026062, -73.60414686237884, 209, 142.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.24315875309, -74.75423677086704, 459, 296.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.255919136466036, -75.5633838490626, 406, 287.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.240621940956888, -75.59215703661721, 406, 290.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.874790044847957, -74.03663300583376, 495, 270.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.229037754507554, -75.56906210189958, 409, 288.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.020571002814866, -73.99840632951783, 477, 253.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.006797808668356, -74.47037745361445, 457, 279.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.342512112689748, -72.38951509031787, 628, 213.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.058534889811466, -73.85627905164773, 135, 82.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.14602941353705, -73.6829682367289, 446, 229.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.277077365105349, -75.57981446722712, 404, 288.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.957047281945735, -75.41404198859608, 475, 254.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.228877078651102, -75.57449914379896, 409, 289.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.212338962953221, -75.57606462080716, 409, 290.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.362653485071926, -73.59935451293644, 350, 254.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.148330425548087, -75.62169143981981, 425, 297.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.827564407826667, -73.03607008328949, 391, 144.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.543827868898156, -73.35768623868552, 387, 178.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.892704728489178, -72.48856444517669, 292, 109.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.985374396597971, -75.42223666353838, 536, 271.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.1816550965589485, -75.58046049982073, 416, 291.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.98317046885833, -75.19816310145387, 505, 248.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.896449440560355, -72.48859906911197, 292, 109.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.451827603722345, -74.66204757151326, 340, 252.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.346510840541617, -72.39586207956954, 628, 213.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.835207027472385, -72.50930936671243, 279, 103.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.712155609265651, -74.21291775978908, 544, 294.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.066221878399396, -73.86300314267231, 140, 82.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.132094686227901, -75.39607365481521, 439, 275.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.735301370055316, -74.25970960275433, 559, 294.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.326931191715864, -72.38818014169568, 627, 215.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.2509324089499465, -75.56425545461593, 406, 287.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.256915299127405, -75.56552125570319, 406, 287.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.703668901408699, -74.22802587262129, 548, 296.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.339028454629744, -75.54153378388999, 386, 281.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.2232491805788674, -75.57488273243887, 412, 289.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.239883669644668, -75.57902098716264, 403, 289.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.209688878250489, -75.57324458373296, 411, 290.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.885342652790882, -72.49666241095551, 291, 108.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.206468590559931, -75.57013154976663, 412, 289.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.467260552064932, -74.53814242101261, 720, 216.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.082081567570154, -70.7530728862096, 768, 260.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.006986200710864, -73.97232137539119, 313, 229.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.34843075291234, -72.39109612890122, 629, 213.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.45163749812887, -74.66306446297159, 340, 252.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.892758345718986, -72.4915077982712, 292, 109.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.713510638256742, -72.93111536811632, 422, 158.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 4.819573395709, -74.35756868602301, 539, 291.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.450818931768424, -74.66409760290912, 340, 253.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.307011886997111, -73.81596443286014, 425, 216.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.182100253692157, -75.57998873926789, 417, 291.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.239047182685356, -75.59939137807866, 408, 291.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.070776745885852, -74.60158753464276, 389, 281.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 5.555010271030024, -73.3508360772187, 387, 176.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.148430083177209, -74.2254023999125, 351, 255.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.99248675980801, -73.97011575465736, 313, 227.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 8.664053610222613, -75.13472082180456, 643, 280.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.070787873329211, -73.1131064300106, 18, 6.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.281196734519334, -75.61280101015168, 416, 291.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.229164316646731, -75.59827735779197, 411, 291.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.178735755814528, -75.58373186925999, 419, 292.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.255389163710516, -75.55624920406696, 408, 286.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.193934759283139, -75.55736155291557, 418, 289.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.232845530012286, -75.58434310291331, 407, 290.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.206828073910518, -75.57124309846765, 411, 289.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.191537199908636, -75.5799238444711, 414, 291.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.140091467622188, -75.37888341078576, 436, 273.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.214012744137268, -75.5946677108424, 415, 292.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.488707707033675, -74.40424341911705, 226, 159.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 6.160166529862376, -75.60508211631037, 420, 295.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.244150307697137, -74.75526796450302, 460, 296.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 9.256473373662336, -74.43099848346431, 391, 277.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.060940691829962, -73.08822990241045, 19, 7.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.061051756317317, -73.08831134697559, 19, 7.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.035227132594248, -73.06969724875334, 22, 11.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.126714307270854, -73.11446761061566, 7.035943102577871, -73.06858903276776, 23, 11.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.430546544280079, -75.19983495103688, 299, 180.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.437339515698292, -76.61925030199892, 194, 113.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2207400733234774, -77.28178874184842, 506, 263.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.1533600674989988, -76.64677850905524, 564, 256.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.81354221805447, -75.69973815499264, 202, 175.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.4549080885748524, -76.60173091540837, 185, 111.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.1530365848976196, -76.65244556868763, 565, 256.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.085609639177904, -76.1911142619817, 93, 77.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.272561477, -74.41677569, 430, 247.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.404512810292477, -76.15219594503776, 137, 112.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.437434942637705, -75.21989550957662, 296, 178.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.4592439466742224, -76.60284635580634, 182, 111.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.452023018228608, -76.59935641235616, 184, 111.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2255215713956804, -77.28454547000314, 504, 262.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.438571704025374, -75.19980348835635, 303, 180.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.296626982346849, -74.79827393464505, 346, 210.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.428477542352105, -75.70296787055099, 296, 236.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.083786615485008, -76.19045328382761, 92, 77.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.441795240749036, -75.24176954557169, 293, 177.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.4788484515927336, -76.59480142720301, 176, 108.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.544850577005966, -75.66150942255632, 187, 152.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.8453787284778376, -76.05026934988028, 409, 185.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.440379430310564, -75.18579262639979, 303, 181.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.827118175857049, -75.73466619198886, 198, 174.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.059100468040345, -75.487096603177, 275, 210.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.81436783419481, -75.71911397056707, 195, 174.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.4500386862540964, -76.59964015901005, 188, 112.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.806793645742162, -75.68091334414372, 207, 175.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.43606317550154, -75.20467167262206, 300, 179.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.151903594542589, -74.87869085255952, 341, 195.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.585391853068709, -74.21979452851143, 466, 281.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.409757352047175, -75.48560202396766, 349, 244.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.544043680970043, -75.66157140260101, 185, 152.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.375254362417903, -75.11680955506604, 305, 183.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.726830409785917, -75.48449582189878, 442, 116.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.5363974414619648, -76.298105520147, 38, 23.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.538520985223959, -75.66830247826785, 183, 151.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.083147969171344, -76.18638702521596, 91, 77.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.824137586077557, -75.67992977564725, 209, 177.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.081705037204574, -76.18810663171129, 91, 77.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.269291572231827, -75.92861589946583, 148, 110.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2237686095919054, -77.28588324815694, 505, 263.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.066029855266994, -75.50643462351162, 265, 210.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.808824633188668, -75.68661069543123, 206, 175.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.336169248257587, -74.36648795354124, 411, 255.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2133514509162897, -77.29608910943118, 507, 264.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.859137782543064, -74.91700131372991, 364, 234.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.906711841122428, -76.29220111590968, 73, 55.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.0045884629064807, -76.48286494826128, 76, 49.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.393225461825606, -75.8858674899205, 362, 135.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.816124756112588, -75.69568472060982, 205, 175.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2302229959744138, -77.28570549692422, 501, 262.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.8823408914627775, -77.06500215852891, 170, 79.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.06409428569463, -75.49856950369147, 267, 210.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.933039019027149, -75.28678886579837, 466, 145.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.606830391179642, -74.21754793955, 471, 283.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.545222305238224, -75.6607542294554, 186, 152.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.547286287132974, -75.66215641958136, 186, 152.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.451895331602328, -76.59888399986963, 185, 111.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.08563605016211, -77.61466465082599, 583, 291.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.217486115798178, -77.28284278696307, 508, 263.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.4451591883036805, -75.2393580654277, 296, 177.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.444461696988133, -76.6108346245746, 191, 112.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.80635528176181, -74.3498904025329, 506, 281.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.929708748197588, -75.28564368138892, 466, 146.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.053560179496941, -75.48614205694084, 273, 210.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.190315172829236, -74.892602302376, 401, 262.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.199214416853246, -74.75141752421972, 422, 273.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.818031256341327, -75.69881051093883, 203, 175.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.619954663481375, -75.61132981882044, 573, 226.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.607788382412779, -75.6077700366115, 577, 227.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.899929151241664, -76.30954715474793, 68, 53.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.451566781001903, -76.59618581131946, 186, 111.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.540210801930236, -76.29750888373307, 39, 23.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.547083450505866, -75.66290819501393, 186, 152.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.806090982447353, -75.68660393118031, 205, 175.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.1987814282486142, -75.63139018627294, 450, 169.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.4120955707337774, -75.17247600830773, 299, 181.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.804742004603501, -75.69023647949913, 203, 174.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.582387927255063, -74.20044533434208, 468, 283.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.443140828259608, -75.24150290259804, 295, 177.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2050280149623955, -77.26811723612913, 508, 264.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.433408613861449, -75.21950652256278, 294, 178.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.8485726573147163, -76.04333193022148, 411, 185.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.544886743428225, -75.66062417267933, 186, 152.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.453906402696936, -76.60437168061604, 185, 111.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.581446036671879, -76.49211173752738, 36, 14.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2313668122112458, -77.28557005875523, 501, 262.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2229956730344265, -77.28016302502749, 505, 262.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.845967999326102, -76.00934724666293, 372, 271.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.293636834730153, -74.80831622758103, 347, 209.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.815790551641994, -75.69502544356473, 205, 175.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.920873207964668, -75.05795597622735, 419, 228.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.39003020123944, -76.07223183214506, 122, 114.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.430547212828513, -75.1998356215891, 299, 180.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.760211937808062, -75.91769424375231, 168, 158.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.93354680824614, -75.24777521938873, 477, 149.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.436941429740907, -75.20302557746328, 302, 180.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.556146759628807, -75.6567642788959, 189, 153.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.807083532675607, -75.6813944681382, 206, 175.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2173294120006173, -77.27652970184933, 507, 263.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.801674549750414, -75.68643755296132, 205, 174.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.541040084826642, -76.29715010427459, 38, 23.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.15232530954044, -74.87894896111915, 341, 195.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.256385884391788, -76.53634057475321, 43, 22.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.9057067402869015, -76.29805387783745, 70, 54.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.812882197284504, -75.76566375502401, 185, 171.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.925163649083877, -75.28641019017091, 466, 146.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.6044616648335903, -77.13102378021316, 432, 217.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.611184816604719, -75.60812590010872, 576, 227.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.006797808668356, -74.47037745361445, 530, 283.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.9839573117486, -75.61010387421261, 236, 196.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.062785608992201, -75.49777100988332, 269, 210.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.391646558306562, -76.07414140622917, 123, 114.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.0574259899262834, -75.52990347737935, 257, 207.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.035968295929141, -75.46934968659556, 269, 209.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.880451902097991, -77.02020172471978, 166, 75.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.528957817044841, -76.3012638562301, 40, 22.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.544629395283769, -75.66274868961301, 187, 152.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.807106195492069, -75.68987882478265, 203, 175.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.060620928679347, -75.49172147738162, 271, 210.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.083715807221048, -75.52602470674671, 269, 210.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.1585253025416655, -76.64756616671626, 563, 255.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.93604796895587, -75.28941796624622, 463, 145.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2049456488643373, -77.25390636081767, 508, 263.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.712155609265651, -74.21291775978908, 490, 289.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.450552976076464, -76.59735837421597, 186, 112.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.424915421627889, -75.17640597256478, 300, 181.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.091637297388592, -76.18819741515246, 94, 78.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.735301370055316, -74.25970960275433, 490, 285.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.03544193373487, -75.46828872364509, 269, 209.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.8566565834421698, -74.93439990018517, 377, 178.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.433238543886525, -75.21017268019192, 300, 179.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.703668901408699, -74.22802587262129, 481, 287.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.530612438094217, -76.3048292989773, 36, 22.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2186520343261376, -77.28642997507865, 507, 263.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.225844921181512, -77.28723420725547, 504, 262.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2159357877558352, -77.287805951748, 508, 263.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.817450089402223, -75.69768318707446, 204, 175.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.2239986948718824, -77.29128189963187, 505, 263.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.9321403288008034, -75.28119405007203, 468, 146.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.062962905741833, -75.50092978050142, 266, 210.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.333364599102096, -74.37094312063512, 411, 254.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.819573395709, -74.35756868602301, 510, 281.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.751603419313227, -75.90359069831736, 165, 158.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.803489669258103, -75.68430130350818, 205, 174.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.070776745885852, -74.60158753464276, 461, 276.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.8088902120775225, -75.68708657968855, 205, 175.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.749874524351586, -75.90936941182207, 165, 158.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 5.1992399147700965, -74.75084414834289, 422, 273.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.581903784721273, -74.21285346668061, 461, 282.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 1.0821127112023836, -77.61519444537684, 585, 291.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.296665623883847, -74.80343867014477, 346, 209.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.93068011257469, -75.28782237321727, 465, 145.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.941213385014256, -75.29949745576265, 459, 144.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.9234378694335006, -75.28594585077484, 465, 146.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 2.93457196313154, -75.28979500244712, 464, 145.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.801648579691926, -75.74136118146443, 191, 171.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.803812822531239, -75.6897342726292, 204, 174.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.899667118617229, -76.30453417533178, 68, 53.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.8999303182123226, -76.30954864258992, 68, 53.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.8951186683525454, -76.30372449033906, 67, 53.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 4.759816377549786, -75.92529574209294, 169, 158.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(3.452424382685351, -76.4931246763714, 3.528369175485316, -76.29332123914223, 42, 23.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.92906093046752, -74.76399515516277, 140, 101.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.746768823999886, -75.88095883468498, 280, 189.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.456428959171118, -73.24808244570872, 507, 249.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.237766142852204, -74.2013196639611, 238, 171.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.001552408643978, -74.81170082509617, 120, 101.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.79542456975034, -74.91353432412144, 112, 79.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.001534421459144, -74.81305650189144, 121, 101.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.476918028096458, -73.24940512956763, 547, 249.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.32019936103718, -74.57263155765082, 289, 161.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.009276795140783, -74.25211573685867, 197, 154.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.245670191054826, -75.81275798184588, 201, 134.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.094265007594469, -76.71451682270741, 476, 289.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.751278481543796, -75.88631906168824, 281, 189.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.513080215357634, -74.18331054986287, 275, 148.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.98362158337306, -74.79816164809509, 126, 101.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 7.995896895722694, -75.19687574284218, 370, 272.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.2375398991436, -74.20112766937876, 237, 171.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.237965696710868, -74.18694497441662, 239, 172.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.781690771044536, -75.8605440856462, 271, 185.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.99295543792665, -74.81463099036876, 121, 101.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.760010180469244, -75.8712087012664, 276, 188.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 7.982166373787864, -75.20211863480455, 372, 273.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.306969528437614, -75.393813910799, 192, 124.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.939891242985729, -74.83359759763357, 129, 95.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.241200467025372, -74.18581325919199, 239, 173.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.239323012620996, -74.19202633973426, 238, 172.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.981734001537337, -74.79121937494087, 130, 102.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.001528000262075, -74.81305688946982, 121, 101.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.745267339219136, -75.89163933111695, 283, 190.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.227202020205432, -75.82012121567314, 210, 136.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.241269105955974, -74.1899972696521, 241, 172.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.901661178142346, -74.78280705783865, 140, 97.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.887750833750966, -72.85486343283462, 471, 297.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.751848746134115, -75.88059360598709, 279, 189.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.001058868175846, -74.81445897600331, 119, 101.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.960605706895503, -74.79393603693434, 135, 100.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.990361471208564, -74.7951680136852, 127, 102.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.914332963163876, -74.77331212565508, 139, 99.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.982562388202735, -74.79599102917764, 127, 102.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.752217881483405, -75.88708866352243, 281, 189.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.640200586841583, -74.91121164496546, 106, 72.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.996134204235979, -73.97231349896727, 391, 233.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.001486576555097, -74.81623401975469, 119, 101.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.751602745454349, -75.88387485427573, 280, 189.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.630555466618128, -74.92171572163319, 103, 70.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.306946691921432, -75.39496098800981, 192, 124.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.02381645673148, -73.2393653929536, 455, 254.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.23699785089421, -74.21078200556975, 238, 170.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.237564632923002, -74.20043453615679, 238, 171.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.955098120154062, -74.81540027877305, 125, 98.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.004559420467931, -74.24398851743851, 198, 155.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.62992172940839, -74.92103795222557, 104, 70.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.305009132203995, -75.39270295664255, 193, 125.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.994855120431756, -74.79465910962541, 127, 102.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.307145651635354, -75.36995645278405, 202, 125.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.97150664937677, -74.80136058125636, 129, 100.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.754573354095243, -75.88434012242462, 280, 189.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.888590725407752, -74.79057718624698, 139, 96.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.878793791460454, -75.79585243696457, 251, 173.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.30408945161078, -75.40005300080838, 190, 125.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.408284548444449, -75.58510798432661, 310, 223.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.30569404704766, -75.39303007129625, 192, 124.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.990190730551152, -74.80614284634878, 125, 101.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.927618399430711, -74.77152621454748, 137, 100.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.238544227432085, -74.20250887561788, 245, 171.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.71368198845475, -75.11704925015722, 139, 90.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.790174197944722, -74.7573227829181, 132, 94.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.237271442422534, -74.20183517668754, 238, 171.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.746049174832741, -75.87664970716389, 278, 189.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.235182995834718, -74.21294966635416, 237, 170.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.753391306943337, -75.88672271628357, 281, 189.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.001445243756596, -74.81520291337473, 119, 101.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.974706856790004, -73.88401171623957, 353, 187.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.233125707689602, -74.19485567587951, 235, 171.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.929854444808896, -74.7806659935753, 134, 99.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.754025864104102, -75.8838653800895, 280, 189.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.954997260390527, -74.79602195477653, 134, 100.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.918553095805152, -74.8165390334128, 126, 95.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.771094987542703, -73.00957872412717, 497, 278.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.981684752429103, -74.78183397257915, 129, 103.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.471465536735424, -73.25216873405172, 513, 249.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.305467561865347, -75.39146220712489, 193, 124.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.487808054689046, -73.26433467515595, 541, 248.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.636587936350422, -74.92332080590461, 101, 70.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.753555927215924, -75.88585824991253, 280, 189.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.014376414952698, -74.79655025959862, 120, 104.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.476768858373571, -73.25124484570827, 547, 249.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.787028325097832, -74.78801388432187, 278, 107.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.238483980615063, -74.213353477533, 238, 170.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.002040046183016, -74.81746226547014, 119, 101.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.30067570057815, -75.38575789154602, 196, 125.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.74988382673178, -75.88058487028509, 278, 189.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.750732569763048, -75.88193752306822, 279, 189.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.948212880370965, -75.44670829028509, 238, 163.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.295991880950616, -75.396998603236, 194, 125.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.657358678233331, -75.13105536583748, 284, 200.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.472075793007388, -73.25215101626061, 514, 249.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.23572561987276, -74.19026143190118, 238, 172.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.000778611659854, -74.81567011333571, 119, 101.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.008168238679366, -73.97154923894504, 389, 232.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.771535355441975, -75.86780625628485, 271, 186.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.24315875309, -74.75423677086704, 244, 156.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.98941273566892, -74.80751740863448, 124, 101.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.01550816729142, -74.84682148793752, 113, 100.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.47007387741137, -73.25230449294729, 513, 249.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.238715360702871, -74.21329504632368, 238, 170.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.755805351387062, -75.88347474979753, 279, 189.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.751087752455105, -75.88160295546388, 278, 189.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.301328928818911, -75.39908408222519, 191, 125.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.946836845218732, -74.82156671053247, 124, 97.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.766125742650726, -73.01136650115583, 498, 278.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.015036247181252, -74.24590639202314, 200, 155.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.003705195659707, -74.81981778694751, 116, 101.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.187691724, -75.55713812, 219, 137.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.476253036465966, -73.24938910215522, 515, 249.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.750240026700576, -75.88053582794029, 278, 189.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.991327622786809, -74.80597805289156, 125, 101.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.362653485071926, -73.59935451293644, 433, 242.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.002315272962532, -74.81317748071436, 121, 101.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.99944488803384, -74.81774526553366, 117, 101.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.47240053977978, -73.2474200046039, 513, 250.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 7.985374396597971, -75.42223666353838, 365, 271.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.970666810551544, -74.8006546854266, 130, 100.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 7.98317046885833, -75.19816310145387, 374, 273.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.95210184894636, -74.78761977473151, 136, 100.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.473323636650631, -73.2534400457083, 514, 249.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.002214550788391, -74.81667495568318, 118, 101.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.236867956797989, -74.19475579199332, 239, 172.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.794765843536904, -74.78814979479124, 273, 107.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.000170385711456, -74.81553668648547, 117, 101.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.760952432222027, -75.87843244575458, 277, 188.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.306486294919177, -75.39371686890806, 192, 124.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.75962105957378, -75.87022253439979, 276, 188.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.972892628754655, -74.78150957770686, 132, 102.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.790126630832331, -74.75343673250259, 133, 94.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.916144967214288, -74.76624609422578, 139, 100.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.466454618269804, -73.25437747539914, 510, 249.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.758066955897124, -75.88029117518333, 278, 188.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.955324223880298, -75.45059553259931, 240, 163.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.520375814217918, -74.18631352658772, 278, 147.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.007588229824805, -74.8203278685951, 116, 101.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.463624229496284, -73.25459518090456, 511, 249.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.011500052468406, -74.25027660345583, 199, 154.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.004807596375484, -74.8208795518576, 115, 101.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.006773299080791, -74.24587280331558, 198, 155.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.238371080492632, -75.81224004571833, 204, 134.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.467260552064932, -74.53814242101261, 391, 243.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.989739189385755, -74.80709839519076, 124, 101.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.006986200710864, -73.97232137539119, 390, 232.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.000140822389303, -74.81455694243897, 118, 101.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.991077292052635, -74.80567723757554, 125, 101.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.807828939987235, -74.91604813586802, 112, 80.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.302757531147142, -75.388549995347, 195, 125.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.993998188650178, -74.7948293327532, 127, 102.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.459157978485218, -74.61761306898423, 260, 100.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.51383857416534, -74.18236003789706, 276, 148.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.75214859521082, -75.8827396285672, 279, 189.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.30441809833842, -75.39193806664595, 194, 125.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.004875435524845, -74.82162482176349, 115, 101.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.46910006885733, -73.25473123303443, 513, 249.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.148430083177209, -74.2254023999125, 351, 201.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.990976029466909, -74.81040687642212, 122, 101.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.99248675980801, -73.97011575465736, 393, 233.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 8.664053610222613, -75.13472082180456, 281, 200.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.034394333868445, -73.23102398223246, 457, 255.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.298441735784966, -75.39363012607137, 195, 125.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.320778873164969, -75.28845300804274, 196, 125.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.985183550761688, -74.80987335022702, 123, 100.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.005511437000468, -74.8205215843762, 118, 101.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.991834510779826, -74.79353615495019, 127, 102.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 11.003944263622737, -74.81958183836898, 116, 101.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.962956452403672, -74.83947341946782, 117, 96.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.965154826668478, -74.79795937490105, 133, 100.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.244150307697137, -74.75526796450302, 245, 156.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 9.256473373662336, -74.43099848346431, 310, 177.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.462320005653204, -73.25117133688875, 508, 249.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.420495819286762, -75.53385812286801, 10.47066166333449, -73.25746149950697, 513, 248.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.811809594399092, -73.03132800552976, 520, 239.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.062145747111648, -73.85954526159104, 419, 175.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.309270302327848, -73.60855947238545, 385, 129.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.456428959171118, -73.24808244570872, 650, 295.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.540442503611016, -73.36126107027229, 576, 278.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.1141325787093725, -73.10775991929727, 288, 109.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.110657522025528, -73.11315140271121, 290, 110.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.476918028096458, -73.24940512956763, 658, 298.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.32019936103718, -74.57263155765082, 605, 276.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.14904863058648, -73.13468365866615, 295, 108.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.254393810926054, -73.35847408706732, 301, 101.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.716517085893189, -72.92556490829342, 546, 246.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.377458747214097, -72.64649741661295, 93, 59.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.072752947086473, -73.11015799172242, 297, 113.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.995896895722694, -75.19687574284218, 789, 296.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.0843597938188845, -70.75101976008281, 374, 213.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.9562034544150215, -71.8821613359353, 475, 125.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.552798357807002, -73.13467223740737, 433, 164.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.069962305436829, -73.11504842945598, 299, 113.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.311660490237674, -73.6149151167801, 387, 130.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.72469182241783, -72.9240704549527, 545, 245.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.982166373787864, -75.20211863480455, 785, 297.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.466746757541894, -73.26392809897133, 463, 179.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.519396164446258, -73.35814739089614, 571, 280.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.236277639717617, -73.35225958873815, 300, 100.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.70220917848447, -72.7294593322646, 286, 135.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.111433742252224, -73.11001572483768, 289, 109.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.569644816440005, -73.33675852423836, 567, 274.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.061573448497247, -73.1145911853108, 300, 114.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.115512961775174, -73.1070391304439, 284, 109.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.989547285539411, -73.04805011346485, 310, 117.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.1154010153317975, -73.1185440258165, 289, 110.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.058470441833496, -73.85075022837326, 413, 175.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.3487542254486495, -72.39150595551668, 734, 283.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.237235322211198, -73.35275537215867, 299, 100.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.814854035339171, -73.03084155847718, 518, 238.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.996134204235979, -73.97231349896727, 485, 202.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.067911527803675, -73.86129685440564, 421, 175.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.117181335326224, -73.1101184013692, 288, 109.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.07314911513701, -73.11040024832236, 297, 113.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.02381645673148, -73.2393653929536, 598, 249.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.826837034490856, -73.03308202169862, 521, 237.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.724097272859434, -72.92516047663935, 544, 246.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.343806568025213, -72.39333951684215, 733, 284.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.332825178390964, -72.68544202625188, 380, 175.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.121260790240512, -73.11910346114853, 287, 109.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.128043298301729, -73.11402678432134, 284, 108.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.341632319105894, -72.40751299360149, 732, 284.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.373947483760963, -72.64417526051112, 92, 60.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.554838472250853, -73.13412043763671, 435, 164.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.117648187467569, -73.10883100131653, 286, 109.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.11667736216081, -73.11614370486467, 288, 109.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.111811135085474, -73.10944207023199, 288, 109.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.37404910377429, -72.64376201625608, 92, 60.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.07425836774148, -73.11001516382542, 298, 113.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.974706856790004, -73.88401171623957, 589, 276.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.309092038381918, -73.60468941979103, 384, 129.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.31003164814464, -73.60865334342499, 384, 129.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.060501105844701, -73.85411843375279, 415, 175.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.471465536735424, -73.25216873405172, 656, 297.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.487808054689046, -73.26433467515595, 664, 299.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.543940677699163, -73.35963211900868, 577, 278.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.476768858373571, -73.25124484570827, 657, 298.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.810106648759004, -73.02968479769682, 522, 239.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.551447691465368, -73.3459988987755, 570, 276.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.472075793007388, -73.25215101626061, 657, 297.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.867005740079229, -73.57548469284822, 598, 254.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.008168238679366, -73.97154923894504, 486, 203.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.015643915823461, -73.67397298753647, 613, 245.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.309986825026062, -73.60414686237884, 384, 129.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.24315875309, -74.75423677086704, 634, 288.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.47007387741137, -73.25230449294729, 656, 297.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.342512112689748, -72.38951509031787, 734, 284.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.058534889811466, -73.85627905164773, 417, 175.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.476253036465966, -73.24938910215522, 658, 298.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.362653485071926, -73.59935451293644, 525, 202.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.827564407826667, -73.03607008328949, 520, 237.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.47240053977978, -73.2474200046039, 655, 297.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.543827868898156, -73.35768623868552, 576, 278.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.98317046885833, -75.19816310145387, 786, 296.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.473323636650631, -73.2534400457083, 657, 297.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.346510840541617, -72.39586207956954, 731, 283.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.835207027472385, -72.50930936671243, 21, 6.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.066221878399396, -73.86300314267231, 421, 175.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.326931191715864, -72.38818014169568, 737, 286.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.126085678332449, -73.11808662770163, 286, 109.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.466454618269804, -73.25437747539914, 653, 297.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.463624229496284, -73.25459518090456, 653, 296.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.082081567570154, -70.7530728862096, 374, 213.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.006986200710864, -73.97232137539119, 488, 203.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.34843075291234, -72.39109612890122, 733, 283.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.110784954875528, -73.1110530100441, 290, 110.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.713510638256742, -72.93111536811632, 544, 247.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 5.555010271030024, -73.3508360772187, 575, 276.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.46910006885733, -73.25473123303443, 656, 297.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.148430083177209, -74.2254023999125, 525, 234.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 8.99248675980801, -73.97011575465736, 488, 201.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.034394333868445, -73.23102398223246, 600, 250.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.070787873329211, -73.1131064300106, 299, 113.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 6.488707707033675, -74.40424341911705, 507, 261.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.244150307697137, -74.75526796450302, 634, 289.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 9.256473373662336, -74.43099848346431, 565, 260.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.462320005653204, -73.25117133688875, 651, 296.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 10.47066166333449, -73.25746149950697, 656, 297.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.120665236822153, -73.11478833225361, 286, 109.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.110055748780144, -73.1116906324252, 291, 110.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.120979583764418, -73.11480397326893, 286, 109.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.060940691829962, -73.08822990241045, 300, 113.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.061051756317317, -73.08831134697559, 300, 113.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.035227132594248, -73.06969724875334, 303, 114.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(7.89752044391865, -72.5062011718628, 7.035943102577871, -73.06858903276776, 304, 114.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.811809594399092, -73.03132800552976, 553, 284.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.915446839579079, -74.02548280112961, 527, 226.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.430546544280079, -75.19983495103688, 427, 207.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.195493743750158, -73.14269592674758, 693, 292.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.062145747111648, -73.85954526159104, 302, 208.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.746768823999886, -75.88095883468498, 453, 278.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.405993675648094, -73.94911449516907, 602, 273.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.97325419126968, -74.57780835194671, 252, 113.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.337651871793532, -75.54578535372055, 20, 8.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.81354221805447, -75.69973815499264, 269, 161.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.540442503611016, -73.36126107027229, 517, 256.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.130649273498971, -74.16030421683267, 487, 199.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.1141325787093725, -73.10775991929727, 398, 287.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.342933259564552, -75.54606044968178, 23, 9.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.085609639177904, -76.1911142619817, 358, 251.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.272561477, -74.41677569, 507, 255.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.404512810292477, -76.15219594503776, 321, 216.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.110657522025528, -73.11315140271121, 394, 286.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.437434942637705, -75.21989550957662, 425, 206.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.14904863058648, -73.13468365866615, 400, 285.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.716517085893189, -72.92556490829342, 578, 298.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.590470955897048, -75.01753906554808, 107, 70.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.438571704025374, -75.19980348835635, 431, 206.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.296626982346849, -74.79827393464505, 424, 234.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.428477542352105, -75.70296787055099, 212, 94.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.083786615485008, -76.19045328382761, 358, 251.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.094265007594469, -76.71451682270741, 345, 240.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.97265356130759, -74.57782846189266, 253, 113.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.751278481543796, -75.88631906168824, 455, 279.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.072752947086473, -73.11015799172242, 398, 285.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.441795240749036, -75.24176954557169, 422, 205.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.995896895722694, -75.19687574284218, 346, 196.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.544850577005966, -75.66150942255632, 320, 191.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.016202457050314, -74.00384034464943, 540, 221.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.552798357807002, -73.13467223740737, 530, 270.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.781690771044536, -75.8605440856462, 457, 282.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.55379960915319, -75.82315634392022, 67, 43.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.069962305436829, -73.11504842945598, 392, 284.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.440379430310564, -75.18579262639979, 432, 206.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.827118175857049, -75.73466619198886, 271, 160.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.04337842658972, -75.4276711314434, 74, 28.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.14070730900199, -75.3775172255897, 56, 24.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.760010180469244, -75.8712087012664, 451, 279.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.72469182241783, -72.9240704549527, 577, 298.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.982166373787864, -75.20211863480455, 343, 195.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.059100468040345, -75.487096603177, 258, 134.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.81436783419481, -75.71911397056707, 275, 161.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.466746757541894, -73.26392809897133, 552, 255.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.519396164446258, -73.35814739089614, 521, 257.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.806793645742162, -75.68091334414372, 270, 162.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.43606317550154, -75.20467167262206, 429, 206.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.151903594542589, -74.87869085255952, 428, 246.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.111433742252224, -73.11001572483768, 394, 286.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.585391853068709, -74.21979452851143, 545, 238.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.887434774810714, -76.63720000804399, 323, 216.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.569644816440005, -73.33675852423836, 517, 258.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.409757352047175, -75.48560202396766, 261, 95.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.061573448497247, -73.1145911853108, 395, 284.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.544043680970043, -75.66157140260101, 319, 191.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.115512961775174, -73.1070391304439, 398, 287.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.375254362417903, -75.11680955506604, 434, 215.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.964806467372122, -73.91075596, 538, 233.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.989547285539411, -73.04805011346485, 407, 289.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.726830409785917, -75.48449582189878, 536, 282.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.1154010153317975, -73.1185440258165, 397, 286.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.4535554073119625, -74.67505500725518, 278, 133.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.745267339219136, -75.89163933111695, 458, 278.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.169941512201537, -75.61129763020115, 27, 11.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.538520985223959, -75.66830247826785, 322, 192.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.083147969171344, -76.18638702521596, 356, 251.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.856313949142596, -74.03049273464286, 522, 230.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.824137586077557, -75.67992977564725, 264, 160.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.058470441833496, -73.85075022837326, 296, 208.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.081705037204574, -76.18810663171129, 357, 252.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.751848746134115, -75.88059360598709, 452, 279.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.304662315718689, -73.81387392237731, 545, 220.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.269291572231827, -75.92861589946583, 376, 225.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.086962460742646, -75.63444849825007, 40, 21.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.066029855266994, -75.50643462351162, 248, 133.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.808824633188668, -75.68661069543123, 267, 162.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.336169248257587, -74.36648795354124, 489, 251.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.814854035339171, -73.03084155847718, 554, 284.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.859137782543064, -74.91700131372991, 369, 171.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.752217881483405, -75.88708866352243, 454, 279.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.906711841122428, -76.29220111590968, 380, 274.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.067911527803675, -73.86129685440564, 304, 208.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.85815981939269, -74.06035557374979, 506, 228.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.117181335326224, -73.1101184013692, 398, 287.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.751602745454349, -75.88387485427573, 454, 279.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.07314911513701, -73.11040024832236, 395, 285.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.826837034490856, -73.03308202169862, 560, 284.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.724097272859434, -72.92516047663935, 576, 297.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.816124756112588, -75.69568472060982, 269, 161.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.856509125138024, -74.06255632904957, 506, 228.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.06409428569463, -75.49856950369147, 250, 133.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.121260790240512, -73.11910346114853, 401, 286.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.852118706855236, -76.64077723711995, 312, 212.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.606830391179642, -74.21754793955, 548, 236.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.545222305238224, -75.6607542294554, 320, 191.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.754573354095243, -75.88434012242462, 453, 279.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.547286287132974, -75.66215641958136, 322, 191.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.128043298301729, -73.11402678432134, 403, 287.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.4451591883036805, -75.2393580654277, 424, 205.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.878793791460454, -75.79585243696457, 465, 292.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.80635528176181, -74.3498904025329, 482, 210.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.175370204979727, -75.58477773761749, 23, 9.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.053560179496941, -75.48614205694084, 256, 134.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.190315172829236, -74.892602302376, 328, 140.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.199214416853246, -74.75141752421972, 308, 148.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.408284548444449, -75.58510798432661, 406, 238.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.818031256341327, -75.69881051093883, 268, 161.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.899929151241664, -76.30954715474793, 381, 275.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.554838472250853, -73.13412043763671, 532, 270.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.117648187467569, -73.10883100131653, 398, 287.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.11667736216081, -73.11614370486467, 398, 286.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.111811135085474, -73.10944207023199, 398, 287.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.547083450505866, -75.66290819501393, 321, 191.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.806090982447353, -75.68660393118031, 269, 162.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.746049174832741, -75.87664970716389, 452, 278.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.4120955707337774, -75.17247600830773, 428, 210.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.753391306943337, -75.88672271628357, 454, 279.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.804742004603501, -75.69023647949913, 268, 162.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.582387927255063, -74.20044533434208, 546, 240.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.443140828259608, -75.24150290259804, 424, 205.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.433408613861449, -75.21950652256278, 423, 206.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.07425836774148, -73.11001516382542, 396, 285.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.450751115643527, -74.66303999929907, 281, 134.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.165927324015932, -75.60063176456407, 25, 11.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.754025864104102, -75.8838653800895, 454, 279.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.817723886800714, -73.64111126879179, 633, 266.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.544886743428225, -75.66062417267933, 319, 191.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.060501105844701, -73.85411843375279, 299, 208.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.1698655191537455, -75.61293070967672, 28, 11.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.845967999326102, -76.00934724666293, 160, 67.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.753555927215924, -75.88585824991253, 453, 279.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.293636834730153, -74.80831622758103, 420, 234.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.543940677699163, -73.35963211900868, 516, 256.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.815790551641994, -75.69502544356473, 267, 161.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.920873207964668, -75.05795597622735, 400, 159.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.810106648759004, -73.02968479769682, 553, 284.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.39003020123944, -76.07223183214506, 324, 215.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.171531679370999, -75.61323271557029, 28, 11.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.74988382673178, -75.88058487028509, 451, 278.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.430547212828513, -75.1998356215891, 427, 207.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.760211937808062, -75.91769424375231, 284, 171.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.750732569763048, -75.88193752306822, 453, 278.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.948212880370965, -75.44670829028509, 479, 298.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.436941429740907, -75.20302557746328, 430, 206.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.551447691465368, -73.3459988987755, 517, 257.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.657358678233331, -75.13105536583748, 484, 270.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.556146759628807, -75.6567642788959, 319, 190.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.807083532675607, -75.6813944681382, 269, 162.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.867005740079229, -73.57548469284822, 445, 224.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.801674549750414, -75.68643755296132, 270, 162.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.166790072452807, -75.57991395059874, 28, 10.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.15232530954044, -74.87894896111915, 428, 246.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.771535355441975, -75.86780625628485, 457, 281.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.015643915823461, -73.67397298753647, 404, 210.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.9057067402869015, -76.29805387783745, 379, 274.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.812882197284504, -75.76566375502401, 274, 162.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.874790044847957, -74.03663300583376, 518, 228.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.020571002814866, -73.99840632951783, 541, 221.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.006797808668356, -74.47037745361445, 398, 184.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.9839573117486, -75.61010387421261, 232, 142.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.755805351387062, -75.88347474979753, 453, 279.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.062785608992201, -75.49777100988332, 252, 133.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.391646558306562, -76.07414140622917, 325, 215.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.0574259899262834, -75.52990347737935, 240, 134.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.751087752455105, -75.88160295546388, 452, 278.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.058534889811466, -73.85627905164773, 300, 208.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.14602941353705, -73.6829682367289, 574, 242.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.035968295929141, -75.46934968659556, 252, 136.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.957047281945735, -75.41404198859608, 158, 78.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.750240026700576, -75.88053582794029, 451, 278.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.148330425548087, -75.62169143981981, 31, 14.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.544629395283769, -75.66274868961301, 321, 191.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.807106195492069, -75.68987882478265, 268, 162.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.060620928679347, -75.49172147738162, 254, 133.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.827564407826667, -73.03607008328949, 559, 283.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.083715807221048, -75.52602470674671, 252, 131.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.543827868898156, -73.35768623868552, 516, 256.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.985374396597971, -75.42223666353838, 374, 192.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.1816550965589485, -75.58046049982073, 22, 9.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.98317046885833, -75.19816310145387, 344, 195.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.451827603722345, -74.66204757151326, 281, 134.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.712155609265651, -74.21291775978908, 492, 228.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.066221878399396, -73.86300314267231, 304, 208.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.132094686227901, -75.39607365481521, 55, 23.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.424915421627889, -75.17640597256478, 429, 208.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.760952432222027, -75.87843244575458, 453, 279.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.091637297388592, -76.18819741515246, 358, 251.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.75962105957378, -75.87022253439979, 451, 279.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.735301370055316, -74.25970960275433, 493, 222.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.03544193373487, -75.46828872364509, 252, 136.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.8566565834421698, -74.93439990018517, 471, 276.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.433238543886525, -75.21017268019192, 428, 207.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.126085678332449, -73.11808662770163, 398, 286.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.703668901408699, -74.22802587262129, 496, 227.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.758066955897124, -75.88029117518333, 453, 279.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.339028454629744, -75.54153378388999, 19, 8.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.955324223880298, -75.45059553259931, 480, 299.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.886150338172923, -76.62997720042644, 321, 215.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.467260552064932, -74.53814242101261, 559, 270.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.817450089402223, -75.69768318707446, 267, 161.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.45163749812887, -74.66306446297159, 281, 134.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.062962905741833, -75.50092978050142, 249, 133.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.110784954875528, -73.1110530100441, 396, 286.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.713510638256742, -72.93111536811632, 576, 297.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.333364599102096, -74.37094312063512, 489, 251.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.819573395709, -74.35756868602301, 480, 208.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.450818931768424, -74.66409760290912, 281, 134.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.307011886997111, -73.81596443286014, 548, 220.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.751603419313227, -75.90359069831736, 278, 172.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.182100253692157, -75.57998873926789, 23, 9.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.803489669258103, -75.68430130350818, 270, 162.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.070776745885852, -74.60158753464276, 331, 170.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.8088902120775225, -75.68708657968855, 268, 162.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.749874524351586, -75.90936941182207, 280, 172.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.555010271030024, -73.3508360772187, 515, 257.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 5.1992399147700965, -74.75084414834289, 308, 148.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.75214859521082, -75.8827396285672, 452, 279.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.581903784721273, -74.21285346668061, 538, 239.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 8.664053610222613, -75.13472082180456, 482, 271.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.070787873329211, -73.1131064300106, 395, 285.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.296665623883847, -74.80343867014477, 423, 234.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.140091467622188, -75.37888341078576, 56, 24.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.214012744137268, -75.5946677108424, 20, 6.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.488707707033675, -74.40424341911705, 177, 130.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 6.160166529862376, -75.60508211631037, 26, 12.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.801648579691926, -75.74136118146443, 279, 163.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.803812822531239, -75.6897342726292, 269, 162.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.120665236822153, -73.11478833225361, 398, 286.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.110055748780144, -73.1116906324252, 395, 286.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.120979583764418, -73.11480397326893, 398, 286.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.060940691829962, -73.08822990241045, 396, 287.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.061051756317317, -73.08831134697559, 396, 287.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.035227132594248, -73.06969724875334, 400, 288.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 7.035943102577871, -73.06858903276776, 401, 288.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.899667118617229, -76.30453417533178, 381, 275.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.8999303182123226, -76.30954864258992, 381, 275.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 3.8951186683525454, -76.30372449033906, 382, 275.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(6.262431895656156, -75.56404755453853, 4.759816377549786, -75.92529574209294, 285, 171.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.408202568951646, -75.50435472476818, 275, 188.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.396941284929628, -75.55682774891326, 291, 186.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.215478559392075, -75.56977939900673, 466, 284.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.39187475946568, -75.47903273304597, 268, 187.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.062145747111648, -73.85954526159104, 518, 291.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.92906093046752, -74.76399515516277, 359, 271.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.286464322006945, -75.57412433595582, 455, 276.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.309270302327848, -73.60855947238545, 468, 254.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.337651871793532, -75.54578535372055, 441, 270.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.391861874486914, -75.48683757967747, 271, 187.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.001552408643978, -74.81170082509617, 379, 276.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.79542456975034, -74.91353432412144, 350, 250.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.506879720459802, -75.46667318943247, 288, 200.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.001534421459144, -74.81305650189144, 380, 276.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.342933259564552, -75.54606044968178, 443, 270.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.242847418268389, -75.55734870218697, 466, 281.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.222452448815396, -75.5748578478459, 464, 283.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.32019936103718, -74.57263155765082, 262, 157.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.431934538542462, -75.53473697419038, 283, 190.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.590470955897048, -75.01753906554808, 374, 258.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.245670191054826, -75.81275798184588, 75, 55.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.262664587034767, -75.56560692494656, 457, 278.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.094265007594469, -76.71451682270741, 236, 117.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.513080215357634, -74.18331054986287, 502, 270.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.252429230221559, -75.56340068985605, 458, 280.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.98362158337306, -74.79816164809509, 374, 275.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.995896895722694, -75.19687574284218, 114, 113.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.407398963989133, -75.51737227761859, 272, 188.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.412309098938977, -75.53662977418323, 276, 188.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.239036958943368, -75.58787304427861, 460, 281.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.55379960915319, -75.82315634392022, 502, 244.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.2455889729430645, -75.61409043745469, 468, 280.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.99295543792665, -74.81463099036876, 373, 275.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.311660490237674, -73.6149151167801, 468, 254.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.14070730900199, -75.3775172255897, 489, 295.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.982166373787864, -75.20211863480455, 116, 113.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.306969528437614, -75.393813910799, 130, 81.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.39579516112651, -75.5558846411193, 292, 186.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.939891242985729, -74.83359759763357, 367, 269.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.239248877078907, -75.59491146526634, 461, 281.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.887434774810714, -76.63720000804399, 255, 126.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.187845664428742, -75.57886515446782, 467, 287.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.981734001537337, -74.79121937494087, 374, 275.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.215288552445342, -75.57699221885478, 464, 284.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.3886419947529, -75.46899683102603, 265, 187.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.001528000262075, -74.81305688946982, 380, 276.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.250735793510452, -75.55933969694411, 461, 280.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.40555614601419, -75.50808316738481, 273, 188.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.169941512201537, -75.61129763020115, 474, 288.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.227202020205432, -75.82012121567314, 73, 53.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.058470441833496, -73.85075022837326, 512, 292.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.420490458050551, -75.53831127419171, 281, 189.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.400421936704827, -75.5035194907442, 271, 188.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.901661178142346, -74.78280705783865, 355, 267.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.234056988560798, -75.5731264217, 462, 282.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.001058868175846, -74.81445897600331, 377, 276.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.960605706895503, -74.79393603693434, 368, 273.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.990361471208564, -74.7951680136852, 377, 276.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.086962460742646, -75.63444849825007, 487, 297.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.914332963163876, -74.77331212565508, 350, 269.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.182452709273006, -75.56458513049525, 472, 287.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.262664622282357, -75.56560763653907, 457, 278.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.418024039176418, -75.5331332036317, 279, 189.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.248921513187596, -75.56448054020044, 463, 280.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.982562388202735, -74.79599102917764, 373, 275.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.640200586841583, -74.91121164496546, 325, 235.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.996134204235979, -73.97231349896727, 363, 211.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.067911527803675, -73.86129685440564, 519, 290.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.001486576555097, -74.81623401975469, 377, 276.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.261685552463122, -75.56151168302485, 459, 279.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.630555466618128, -74.92171572163319, 329, 234.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.306946691921432, -75.39496098800981, 130, 81.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.198919435871809, -75.56160865895626, 470, 286.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.258715094815948, -75.59118702828081, 460, 279.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.955098120154062, -74.81540027877305, 365, 271.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.392855855765928, -75.47484764872102, 267, 187.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.407697499174576, -75.50221350360832, 274, 188.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.62992172940839, -74.92103795222557, 329, 234.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.305009132203995, -75.39270295664255, 131, 81.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.994855120431756, -74.79465910962541, 377, 276.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.852118706855236, -76.64077723711995, 256, 130.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.307145651635354, -75.36995645278405, 130, 83.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.97150664937677, -74.80136058125636, 371, 273.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.245828870928576, -75.5837323486538, 456, 280.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.888590725407752, -74.79057718624698, 357, 266.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.878793791460454, -75.79585243696457, 27, 17.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.420482095259048, -75.53300502853601, 280, 189.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.175370204979727, -75.58477773761749, 471, 288.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.30408945161078, -75.40005300080838, 129, 81.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.203155377602498, -75.57639711635746, 466, 285.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.408284548444449, -75.58510798432661, 53, 50.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.30569404704766, -75.39303007129625, 131, 81.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.990190730551152, -74.80614284634878, 380, 275.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.927618399430711, -74.77152621454748, 356, 270.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.71368198845475, -75.11704925015722, 197, 136.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.790174197944722, -74.7573227829181, 331, 258.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.394730083115162, -75.47652882850181, 267, 188.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.404322365094073, -75.55333796645938, 290, 187.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.38901570068514, -75.5198496179919, 269, 186.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.250225082640299, -75.56186027777261, 460, 280.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.394364577601245, -75.47695063287843, 269, 188.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.246125877425413, -75.56652839887359, 462, 280.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.001445243756596, -74.81520291337473, 377, 276.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.2665456922934535, -75.56441901980929, 458, 278.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.974706856790004, -73.88401171623957, 466, 258.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.309092038381918, -73.60468941979103, 468, 255.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.397364273763598, -75.48699066553472, 273, 188.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.165927324015932, -75.60063176456407, 472, 289.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.31003164814464, -73.60865334342499, 468, 254.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.929854444808896, -74.7806659935753, 357, 270.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.954997260390527, -74.79602195477653, 365, 272.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.918553095805152, -74.8165390334128, 364, 267.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.407780897430044, -75.51438834812856, 274, 188.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.276832786492548, -75.58197126841301, 459, 277.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.981684752429103, -74.78183397257915, 371, 275.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.060501105844701, -73.85411843375279, 514, 292.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.240590992661879, -75.57942385752102, 458, 281.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.305467561865347, -75.39146220712489, 130, 81.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.1698655191537455, -75.61293070967672, 476, 288.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.636587936350422, -74.92332080590461, 329, 234.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.014376414952698, -74.79655025959862, 378, 278.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.39584522057028, -75.49168734776028, 272, 187.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.424572698369555, -75.5468958447697, 285, 189.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.171531679370999, -75.61323271557029, 475, 288.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.787028325097832, -74.78801388432187, 283, 166.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.264859131802446, -75.56513154731599, 459, 278.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.002040046183016, -74.81746226547014, 376, 276.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.30067570057815, -75.38575789154602, 127, 81.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.250040042541063, -75.56324838688532, 460, 280.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.948212880370965, -75.44670829028509, 75, 52.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.2247323393771, -75.57472653079203, 463, 283.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.295991880950616, -75.396998603236, 124, 80.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.657358678233331, -75.13105536583748, 125, 83.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.420108081092206, -75.53540679682564, 281, 189.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.166790072452807, -75.57991395059874, 475, 289.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.268146902983646, -75.55880177540507, 459, 278.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.000778611659854, -74.81567011333571, 378, 276.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.008168238679366, -73.97154923894504, 361, 212.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.209352348721864, -75.5691372366181, 466, 284.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.309986825026062, -73.60414686237884, 467, 255.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.4092291082002, -75.51742123513202, 273, 188.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.24315875309, -74.75423677086704, 216, 135.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.255919136466036, -75.5633838490626, 459, 279.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.240621940956888, -75.59215703661721, 460, 281.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.98941273566892, -74.80751740863448, 380, 275.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.01550816729142, -74.84682148793752, 371, 276.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.229037754507554, -75.56906210189958, 462, 282.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.058534889811466, -73.85627905164773, 515, 292.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.301328928818911, -75.39908408222519, 127, 81.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.946836845218732, -74.82156671053247, 361, 270.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.277077365105349, -75.57981446722712, 457, 277.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.003705195659707, -74.81981778694751, 374, 276.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.957047281945735, -75.41404198859608, 330, 206.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.187691724, -75.55713812, 88, 60.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.388800806506891, -75.50174661522674, 267, 186.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.228877078651102, -75.57449914379896, 463, 282.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.991327622786809, -74.80597805289156, 379, 275.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.212338962953221, -75.57606462080716, 463, 284.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.362653485071926, -73.59935451293644, 488, 259.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.148330425548087, -75.62169143981981, 478, 290.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.002315272962532, -74.81317748071436, 379, 276.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.99944488803384, -74.81774526553366, 376, 275.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.985374396597971, -75.42223666353838, 109, 99.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.1816550965589485, -75.58046049982073, 470, 287.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.970666810551544, -74.8006546854266, 371, 273.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.98317046885833, -75.19816310145387, 117, 113.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.95210184894636, -74.78761977473151, 361, 272.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.397452100088218, -75.55632827080744, 291, 186.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.066221878399396, -73.86300314267231, 520, 290.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.132094686227901, -75.39607365481521, 493, 296.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.002214550788391, -74.81667495568318, 376, 276.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.794765843536904, -74.78814979479124, 279, 167.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.000170385711456, -74.81553668648547, 376, 276.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.306486294919177, -75.39371686890806, 130, 81.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.2509324089499465, -75.56425545461593, 459, 280.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.972892628754655, -74.78150957770686, 366, 274.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.790126630832331, -74.75343673250259, 332, 258.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.916144967214288, -74.76624609422578, 354, 270.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.256915299127405, -75.56552125570319, 460, 279.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.339028454629744, -75.54153378388999, 440, 270.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.955324223880298, -75.45059553259931, 76, 52.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.2232491805788674, -75.57488273243887, 466, 283.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.239883669644668, -75.57902098716264, 457, 281.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.520375814217918, -74.18631352658772, 505, 270.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.007588229824805, -74.8203278685951, 375, 276.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.209688878250489, -75.57324458373296, 464, 284.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.004807596375484, -74.8208795518576, 374, 276.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.238371080492632, -75.81224004571833, 73, 54.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 7.886150338172923, -76.62997720042644, 253, 126.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.206468590559931, -75.57013154976663, 465, 285.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.467260552064932, -74.53814242101261, 232, 151.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.406562599213952, -75.5148384035649, 273, 188.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.989739189385755, -74.80709839519076, 380, 275.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.006986200710864, -73.97232137539119, 362, 211.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.000140822389303, -74.81455694243897, 376, 276.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.991077292052635, -74.80567723757554, 379, 275.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.807828939987235, -74.91604813586802, 349, 252.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.302757531147142, -75.388549995347, 128, 81.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.182100253692157, -75.57998873926789, 470, 287.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.993998188650178, -74.7948293327532, 377, 276.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.411042289702516, -75.53613529541818, 275, 188.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.239047182685356, -75.59939137807866, 462, 281.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.459157978485218, -74.61761306898423, 461, 235.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.51383857416534, -74.18236003789706, 503, 270.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.30441809833842, -75.39193806664595, 130, 81.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.004875435524845, -74.82162482176349, 373, 276.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.148430083177209, -74.2254023999125, 323, 187.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.990976029466909, -74.81040687642212, 377, 275.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.99248675980801, -73.97011575465736, 366, 211.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 8.664053610222613, -75.13472082180456, 123, 82.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.298441735784966, -75.39363012607137, 126, 81.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.320778873164969, -75.28845300804274, 137, 90.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.281196734519334, -75.61280101015168, 470, 276.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.229164316646731, -75.59827735779197, 465, 282.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.178735755814528, -75.58373186925999, 472, 287.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.255389163710516, -75.55624920406696, 462, 279.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.193934759283139, -75.55736155291557, 472, 286.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.232845530012286, -75.58434310291331, 461, 282.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.206828073910518, -75.57124309846765, 465, 285.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.191537199908636, -75.5799238444711, 468, 286.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.140091467622188, -75.37888341078576, 489, 295.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.214012744137268, -75.5946677108424, 469, 283.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.488707707033675, -74.40424341911705, 393, 299.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 6.160166529862376, -75.60508211631037, 474, 289.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.985183550761688, -74.80987335022702, 378, 274.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.005511437000468, -74.8205215843762, 376, 276.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.991834510779826, -74.79353615495019, 376, 276.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 11.003944263622737, -74.81958183836898, 374, 276.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.962956452403672, -74.83947341946782, 365, 271.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.965154826668478, -74.79795937490105, 368, 273.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.407721468048376, -75.5163225426453, 274, 188.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 10.379221793692704, -75.4756224646012, 266, 186.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.244150307697137, -74.75526796450302, 217, 135.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(8.751549528798737, -75.88373388085706, 9.256473373662336, -74.43099848346431, 282, 169.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.704414702155407, -74.0410900002528, 334, 240.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.915446839579079, -74.02548280112961, 360, 261.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.430546544280079, -75.19983495103688, 182, 166.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.437339515698292, -76.61925030199892, 363, 158.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2207400733234774, -77.28178874184842, 677, 292.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.405993675648094, -73.94911449516907, 364, 220.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.1533600674989988, -76.64677850905524, 400, 249.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.684992538249309, -74.05647242070954, 326, 237.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.703419656527395, -74.02930098036175, 330, 241.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.81354221805447, -75.69973815499264, 363, 214.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.682832968516384, -74.0571619852809, 323, 237.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.3870349535966984, -76.55803413311428, 487, 150.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.419853774870415, -76.54739142400949, 488, 150.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.130649273498971, -74.16030421683267, 437, 274.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.4549080885748524, -76.60173091540837, 356, 155.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.1530365848976196, -76.65244556868763, 401, 249.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.710636981918698, -74.03229634336445, 330, 241.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.42681918146714, -76.53832017784602, 488, 149.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.085609639177904, -76.1911142619817, 413, 162.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.272561477, -74.41677569, 240, 177.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.404512810292477, -76.15219594503776, 403, 189.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.415911084483553, -76.53785548241716, 485, 149.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.437434942637705, -75.21989550957662, 190, 167.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.4592439466742224, -76.60284635580634, 353, 155.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.729950583606929, -74.04631249290854, 331, 242.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.635511182922544, -74.06222077819245, 322, 232.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4232113756081683, -76.54637971425878, 489, 150.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.452023018228608, -76.59935641235616, 355, 155.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.55268182176747, -74.09457411403845, 316, 223.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.1448063015300365, -73.64374994059658, 455, 226.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.628464444859768, -74.0642961859758, 320, 232.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.140610304736505, -73.6371507716327, 450, 226.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.703851089887817, -74.02986652630322, 330, 241.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.427928795498013, -76.54585322047699, 493, 150.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.695803118796537, -74.03126236811453, 332, 240.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2255215713956804, -77.28454547000314, 675, 292.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.438571704025374, -75.19980348835635, 187, 167.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.296626982346849, -74.79827393464505, 155, 161.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.428477542352105, -75.70296787055099, 484, 281.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.083786615485008, -76.19045328382761, 414, 162.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4148870554322235, -76.53819734799957, 486, 149.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.688444734184593, -74.05187997080502, 325, 238.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.425181072537963, -76.53350321094399, 484, 149.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.696599111926684, -74.0755832327179, 324, 237.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.441795240749036, -75.24176954557169, 188, 167.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.4788484515927336, -76.59480142720301, 347, 153.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.544850577005966, -75.66150942255632, 321, 184.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.016202457050314, -74.00384034464943, 373, 271.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.8453787284778376, -76.05026934988028, 231, 147.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.665136315274092, -74.07893605007945, 318, 234.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.447690347011355, -76.53610909070377, 495, 150.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.440379430310564, -75.18579262639979, 183, 168.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.827118175857049, -75.73466619198886, 372, 216.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.145135021452405, -73.63546935449075, 454, 227.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.059100468040345, -75.487096603177, 452, 237.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.81436783419481, -75.71911397056707, 366, 214.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.143249373265375, -73.6429095792248, 454, 226.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.711556752847948, -74.02981032471102, 331, 241.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.4500386862540964, -76.59964015901005, 359, 155.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.6059614743385255, -74.08289904981226, 310, 228.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.806793645742162, -75.68091334414372, 365, 212.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.43606317550154, -75.20467167262206, 185, 167.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.6398015058636535, -74.06666611649929, 319, 233.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.68460811507536, -74.05699970633655, 322, 237.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.151903594542589, -74.87869085255952, 137, 142.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.747951369480355, -74.03629379979768, 339, 244.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.414852937439477, -76.53803885337253, 486, 149.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.585391853068709, -74.21979452851143, 276, 218.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.5932314879917, -74.08860809031177, 311, 227.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.409757352047175, -75.48560202396766, 544, 276.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.461679713686712, -76.52763731363821, 496, 149.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.544043680970043, -75.66157140260101, 320, 184.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.375254362417903, -75.11680955506604, 168, 161.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.420869715974135, -76.53847340521904, 486, 149.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.964806467372122, -73.91075596, 368, 272.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.726830409785917, -75.48449582189878, 194, 91.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.664277509167347, -74.08069739172724, 318, 234.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.671878955766082, -74.0551427023997, 328, 236.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4523723275113123, -76.49387199146462, 490, 146.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.4535554073119625, -74.67505500725518, 291, 288.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4603340572551997, -76.53042955291697, 496, 150.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.5363974414619648, -76.298105520147, 480, 131.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.732806289538411, -74.08896457786379, 330, 240.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.466936122423338, -76.52473752827679, 496, 149.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.538520985223959, -75.66830247826785, 319, 183.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.083147969171344, -76.18638702521596, 412, 162.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.365473573195246, -76.53243130654386, 472, 146.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.856313949142596, -74.03049273464286, 350, 255.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.824137586077557, -75.67992977564725, 371, 214.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.694821702358422, -74.03386783927365, 327, 240.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.081705037204574, -76.18810663171129, 413, 162.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.144191889209991, -73.63910797916533, 453, 226.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.699547833960588, -74.03244034135732, 328, 240.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.269291572231827, -75.92861589946583, 380, 164.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2237686095919054, -77.28588324815694, 676, 292.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4226909357344706, -76.5465871291686, 489, 150.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.066029855266994, -75.50643462351162, 438, 238.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.808824633188668, -75.68661069543123, 364, 213.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.634963646193039, -74.07764157019083, 312, 231.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.336169248257587, -74.36648795354124, 221, 186.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2133514509162897, -77.29608910943118, 680, 294.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.683063321707407, -74.05894772672856, 326, 237.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.859137782543064, -74.91700131372991, 238, 218.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.480745503039156, -76.52147196822507, 498, 150.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.634211624880233, -74.07088708227077, 317, 232.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.906711841122428, -76.29220111590968, 436, 155.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.692242901810987, -74.0558224683915, 324, 238.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.85815981939269, -74.06035557374979, 337, 253.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.0045884629064807, -76.48286494826128, 421, 133.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.462265983087685, -76.52808317421918, 494, 150.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.695657749101086, -74.0330267997836, 329, 240.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.667713546606596, -74.05821946136808, 326, 236.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.393225461825606, -75.8858674899205, 137, 89.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.816124756112588, -75.69568472060982, 365, 214.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.856509125138024, -74.06255632904957, 336, 253.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2302229959744138, -77.28570549692422, 674, 291.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.706503833820006, -74.04896688246171, 329, 240.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.6681722988700445, -74.05744000852908, 325, 236.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.8823408914627775, -77.06500215852891, 568, 224.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.698267419648344, -74.073075391367, 326, 237.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.06409428569463, -75.49856950369147, 440, 238.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.648774301848993, -74.09553561603367, 312, 232.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.606830391179642, -74.21754793955, 281, 220.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.636050248617544, -74.0738095821962, 317, 232.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.545222305238224, -75.6607542294554, 321, 184.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.547286287132974, -75.66215641958136, 322, 184.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.451895331602328, -76.59888399986963, 356, 155.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.217486115798178, -77.28284278696307, 680, 292.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.4451591883036805, -75.2393580654277, 190, 168.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.444461696988133, -76.6108346245746, 362, 156.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.5470808931969287, -73.6969222782707, 540, 189.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.80635528176181, -74.3498904025329, 316, 232.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.621601987584569, -74.07037866514302, 315, 231.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.741412047036608, -74.03451508737604, 339, 244.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.454893886338568, -76.52778590457024, 493, 149.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.053560179496941, -75.48614205694084, 451, 236.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.190315172829236, -74.892602302376, 264, 254.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.199214416853246, -74.75141752421972, 259, 258.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.818031256341327, -75.69881051093883, 367, 214.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.619954663481375, -75.61132981882044, 287, 150.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.423318585950682, -76.54242220275138, 488, 149.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.607788382412779, -75.6077700366115, 291, 151.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4398428011105446, -76.53795482247835, 495, 150.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.463425331810051, -76.52850635153992, 495, 150.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.899929151241664, -76.30954715474793, 436, 156.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.587944782855312, -74.08454612585771, 311, 227.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.45735645918835, -76.5320520097048, 498, 150.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.451566781001903, -76.59618581131946, 357, 155.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.540210801930236, -76.29750888373307, 479, 131.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.7114770279653575, -74.03013559347686, 331, 241.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.547083450505866, -75.66290819501393, 322, 184.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.447520964848531, -76.49876280111435, 493, 146.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.421981700458277, -76.54425383143996, 488, 150.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.607992588381057, -74.08046409656349, 311, 229.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.806090982447353, -75.68660393118031, 363, 213.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.1987814282486142, -75.63139018627294, 138, 90.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.4120955707337774, -75.17247600830773, 180, 165.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.630446235347357, -74.13076230024579, 304, 228.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.147848366224331, -73.63931570323442, 454, 227.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.804742004603501, -75.69023647949913, 361, 212.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.582387927255063, -74.20044533434208, 278, 219.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.627059446119183, -74.06922755095722, 316, 231.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.646616972443036, -74.06754190740598, 318, 233.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.443140828259608, -75.24150290259804, 189, 168.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2050280149623955, -77.26811723612913, 679, 292.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.433408613861449, -75.21950652256278, 188, 167.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.148347238433793, -73.63812499884176, 453, 227.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4190362878395715, -76.54418003149893, 489, 149.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.450751115643527, -74.66303999929907, 287, 288.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4609028017955383, -76.526540130689, 492, 149.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.668673932964532, -74.10775255487931, 307, 233.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.587462743354136, -74.08371599169818, 311, 227.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.817723886800714, -73.64111126879179, 461, 277.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.8485726573147163, -76.04333193022148, 230, 147.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.420919662785763, -76.54721437298436, 488, 150.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.669998542374641, -74.05872983488439, 325, 236.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.720093798003992, -74.04648097535063, 330, 241.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.544886743428225, -75.66062417267933, 320, 184.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.453906402696936, -76.60437168061604, 356, 155.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4547039263337367, -76.53713128965643, 499, 150.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.581446036671879, -76.49211173752738, 489, 152.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2313668122112458, -77.28557005875523, 672, 291.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2229956730344265, -77.28016302502749, 676, 292.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.698921738486702, -74.03857687779292, 332, 240.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.583708067866765, -74.10506147080226, 303, 225.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.41566608774086, -76.54007295083419, 484, 149.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.293636834730153, -74.80831622758103, 156, 160.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.668720818547481, -74.0568049617321, 328, 236.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.815790551641994, -75.69502544356473, 367, 214.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.920873207964668, -75.05795597622735, 283, 222.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.39003020123944, -76.07223183214506, 388, 184.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.670791475842875, -74.05805653142637, 327, 236.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.677125932482472, -74.05982115914789, 322, 236.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.430547212828513, -75.1998356215891, 182, 166.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.464182071008031, -76.52809412668324, 495, 150.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.760211937808062, -75.91769424375231, 393, 215.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.696366327777668, -74.03219228774293, 328, 240.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.436941429740907, -75.20302557746328, 185, 167.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.705330402136046, -74.03185474135735, 329, 241.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.556146759628807, -75.6567642788959, 324, 185.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.807083532675607, -75.6813944681382, 363, 213.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2173294120006173, -77.27652970184933, 678, 292.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.697191883095981, -74.03985830853621, 331, 239.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.801674549750414, -75.68643755296132, 361, 212.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.541040084826642, -76.29715010427459, 478, 131.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.621702291854586, -74.07131325605974, 315, 231.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.15232530954044, -74.87894896111915, 137, 142.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.623276238030671, -74.06996389022076, 317, 231.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.256385884391788, -76.53634057475321, 453, 143.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.462734765733817, -76.52246353876669, 491, 149.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.9057067402869015, -76.29805387783745, 435, 156.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.76121742523095, -74.09279609153855, 338, 242.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.812882197284504, -75.76566375502401, 360, 215.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.66288147136409, -74.0597225413573, 326, 235.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.677687053419595, -74.05725897279952, 324, 237.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.7216268713601455, -74.04713888949965, 331, 241.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.144664793356877, -73.6416306720323, 455, 226.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.874790044847957, -74.03663300583376, 353, 256.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.7499782678533125, -74.06557082923554, 339, 243.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.6044616648335903, -77.13102378021316, 603, 252.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.611184816604719, -75.60812590010872, 290, 151.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.020571002814866, -73.99840632951783, 374, 272.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.006797808668356, -74.47037745361445, 352, 247.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4202131599776444, -76.54630902512683, 489, 150.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.9839573117486, -75.61010387421261, 401, 230.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.062785608992201, -75.49777100988332, 441, 238.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.391646558306562, -76.07414140622917, 389, 184.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.0574259899262834, -75.52990347737935, 430, 237.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.035968295929141, -75.46934968659556, 443, 234.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4220922736960877, -76.5430866013096, 488, 149.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.695101767331468, -74.0361860034745, 330, 240.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.697778714574997, -74.05097658705961, 327, 239.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.686486774082736, -74.04483128811002, 324, 238.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.880451902097991, -77.02020172471978, 564, 219.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.528957817044841, -76.3012638562301, 481, 130.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.570862077311099, -74.10720036924138, 308, 224.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.544629395283769, -75.66274868961301, 323, 184.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.807106195492069, -75.68987882478265, 361, 213.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.144465938767297, -73.63681391341032, 453, 227.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.060620928679347, -75.49172147738162, 444, 237.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.083715807221048, -75.52602470674671, 442, 240.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.1585253025416655, -76.64756616671626, 399, 248.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.576725390133819, -74.09120722887337, 308, 225.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4178864963323674, -76.49429657292625, 486, 144.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.691560901289351, -74.04861332601517, 327, 238.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.426865560660316, -76.54427087371079, 491, 150.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2049456488643373, -77.25390636081767, 679, 291.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.451827603722345, -74.66204757151326, 287, 288.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.672054538171513, -74.13683819123395, 313, 231.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.712155609265651, -74.21291775978908, 300, 230.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 2.450552976076464, -76.59735837421597, 357, 155.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.679811934359848, -74.06481140025285, 323, 236.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.424915421627889, -75.17640597256478, 181, 166.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.091637297388592, -76.18819741515246, 414, 163.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.364603637572123, -76.53462964262415, 472, 146.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.735301370055316, -74.25970960275433, 299, 230.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.426349405579722, -76.54528265510793, 489, 150.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.629489513192148, -74.13574666109238, 298, 227.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.03544193373487, -75.46828872364509, 442, 234.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.8566565834421698, -74.93439990018517, 124, 109.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.433238543886525, -75.21017268019192, 186, 167.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.461572441006408, -76.52906928676589, 495, 150.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.703668901408699, -74.22802587262129, 291, 229.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.602991744957953, -74.08673210063722, 309, 228.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.530612438094217, -76.3048292989773, 478, 131.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.469612004364324, -76.52202905334181, 493, 149.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2186520343261376, -77.28642997507865, 679, 292.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.143006053568595, -73.63991937949662, 453, 226.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4206191572587814, -76.54770437137684, 487, 150.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4302251199673823, -76.54487805131703, 493, 150.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4765288519777133, -76.52366932148534, 495, 150.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.225844921181512, -77.28723420725547, 677, 292.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2159357877558352, -77.287805951748, 679, 293.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.817450089402223, -75.69768318707446, 367, 214.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.144312746253328, -73.63501099558127, 454, 227.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.45163749812887, -74.66306446297159, 287, 288.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 1.2239986948718824, -77.29128189963187, 676, 292.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.062962905741833, -75.50092978050142, 439, 238.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.679119486879289, -74.04668013644728, 327, 237.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.333364599102096, -74.37094312063512, 221, 185.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.819573395709, -74.35756868602301, 319, 233.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.450818931768424, -74.66409760290912, 287, 288.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.751603419313227, -75.90359069831736, 387, 213.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.803489669258103, -75.68430130350818, 362, 212.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.070776745885852, -74.60158753464276, 284, 249.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.8088902120775225, -75.68708657968855, 363, 213.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.749874524351586, -75.90936941182207, 389, 213.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 5.1992399147700965, -74.75084414834289, 259, 258.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.686565397478874, -74.06059060182486, 328, 237.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.581903784721273, -74.21285346668061, 270, 218.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.142268817437598, -73.64029695970503, 454, 226.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4679074313619087, -76.5238256666329, 495, 149.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.296665623883847, -74.80343867014477, 155, 160.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.692296265865653, -74.0980832655579, 318, 235.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.706486734767949, -74.05090403083918, 332, 240.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.634125692982733, -74.11254877372549, 308, 229.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.70691276552089, -74.05198997080508, 330, 240.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.70456541913689, -74.0504919291778, 328, 239.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.648190895677362, -74.10622197080231, 310, 231.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.642493103460875, -74.06875977080995, 319, 233.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.6276282037710414, -74.1449911413587, 299, 226.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.592807598432202, -74.08996216363073, 308, 227.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.682677508315564, -74.05836949820933, 326, 237.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.703952553243483, -74.04423288583504, 330, 240.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.615206288069383, -74.17244620622692, 287, 224.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.652268002379629, -74.06095451577245, 323, 234.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.686214969329195, -74.0567466582241, 323, 237.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.679203904008197, -74.05717473918122, 324, 237.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.704093560003992, -74.04490194640884, 329, 240.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.638794194168213, -74.06811025185188, 320, 232.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.623887607387683, -74.15362927793012, 297, 226.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.681162219812539, -74.05749309377944, 324, 237.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.595580550757874, -74.17315277116823, 282, 222.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.652630575006434, -74.10172733130143, 311, 231.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.623334508148629, -74.08270645731737, 310, 230.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.663672497013976, -74.07987710908219, 318, 234.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.63677661886124, -74.06505785147387, 322, 232.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.571719789112955, -74.12867513035278, 297, 222.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.559514676580857, -74.13830035356666, 297, 221.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.651595014209306, -74.14898257955721, 310, 228.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.635115274801236, -74.20607237056706, 296, 223.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.671682507396267, -74.146343723427, 313, 230.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.616540119066279, -74.15332009038653, 292, 225.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.569752102622589, -74.08350650001482, 310, 225.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.591492872737771, -74.09232595286191, 307, 227.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.742868427155099, -74.02301168124903, 341, 245.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.710961913786103, -74.10972923393435, 325, 236.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.753542117244553, -74.0919445837163, 334, 241.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.623546083734686, -74.06959885946479, 317, 231.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.156459201191459, -73.63718289107166, 458, 227.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.144691127830611, -73.63939016931985, 454, 226.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.801648579691926, -75.74136118146443, 359, 213.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.803812822531239, -75.6897342726292, 362, 212.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.364012560148381, -76.53396545207518, 472, 146.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4100537484986706, -76.53953159605796, 484, 149.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.37275091944751, -76.52562880541036, 474, 146.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.3933476327421648, -76.52556446113552, 474, 146.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.4208907260885724, -76.53896469390261, 486, 149.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.457008635349081, -76.53222931256545, 498, 150.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.899667118617229, -76.30453417533178, 436, 156.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.8999303182123226, -76.30954864258992, 436, 156.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.8951186683525454, -76.30372449033906, 437, 155.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 4.759816377549786, -75.92529574209294, 395, 215.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(2.932486149243003, -75.28494502446691, 3.528369175485316, -76.29332123914223, 483, 130.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.437339515698292, -76.61925030199892, 309, 153.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.1533600674989988, -76.64677850905524, 694, 71.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.4549080885748524, -76.60173091540837, 314, 156.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.1530365848976196, -76.65244556868763, 695, 70.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.4592439466742224, -76.60284635580634, 319, 156.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.452023018228608, -76.59935641235616, 315, 156.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.8075399253154312, -78.76437277668485, 329, 177.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.4788484515927336, -76.59480142720301, 320, 159.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.8453787284778376, -76.05026934988028, 539, 153.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 0.4958042818916441, -76.49613693611353, 575, 119.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.4500386862540964, -76.59964015901005, 318, 156.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 0.8287170586886025, -77.61389591585777, 96, 57.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 3.0045884629064807, -76.48286494826128, 419, 217.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.393225461825606, -75.8858674899205, 532, 202.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 0.4141738332125925, -76.91186629455157, 466, 98.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.933039019027149, -75.28678886579837, 666, 292.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.451895331602328, -76.59888399986963, 317, 156.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.08563605016211, -77.61466465082599, 90, 39.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.444461696988133, -76.6108346245746, 312, 155.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.929708748197588, -75.28564368138892, 664, 292.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.619954663481375, -75.61132981882044, 703, 190.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.607788382412779, -75.6077700366115, 707, 191.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.451566781001903, -76.59618581131946, 320, 156.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.1987814282486142, -75.63139018627294, 620, 213.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 0.8320290100410308, -77.6489815251949, 105, 59.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.6721231819747828, -78.75238407542872, 303, 170.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.8485726573147163, -76.04333193022148, 541, 154.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.453906402696936, -76.60437168061604, 313, 156.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.93354680824614, -75.24777521938873, 670, 295.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.925163649083877, -75.28641019017091, 662, 291.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 0.5044234780107273, -76.48328864070471, 578, 119.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.6044616648335903, -77.13102378021316, 149, 45.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.611184816604719, -75.60812590010872, 706, 191.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.1585253025416655, -76.64756616671626, 693, 70.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.93604796895587, -75.28941796624622, 666, 292.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.450552976076464, -76.59735837421597, 319, 156.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.9321403288008034, -75.28119405007203, 663, 292.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 1.0821127112023836, -77.61519444537684, 91, 40.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.93068011257469, -75.28782237321727, 665, 291.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.941213385014256, -75.29949745576265, 663, 291.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.9234378694335006, -75.28594585077484, 661, 291.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(1.222545892365123, -77.28277453386823, 2.93457196313154, -75.28979500244712, 665, 292.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.915446839579079, -74.02548280112961, 420, 185.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.430546544280079, -75.19983495103688, 169, 70.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.437339515698292, -76.61925030199892, 357, 283.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.215478559392075, -75.56977939900673, 273, 156.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.195493743750158, -73.14269592674758, 671, 286.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.286464322006945, -75.57412433595582, 278, 163.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.405993675648094, -73.94911449516907, 424, 199.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.97325419126968, -74.57780835194671, 364, 178.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.337651871793532, -75.54578535372055, 287, 169.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.540442503611016, -73.36126107027229, 519, 271.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.3870349535966984, -76.55803413311428, 219, 185.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.419853774870415, -76.54739142400949, 214, 181.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.130649273498971, -74.16030421683267, 498, 174.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.4549080885748524, -76.60173091540837, 350, 281.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.42681918146714, -76.53832017784602, 208, 180.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.342933259564552, -75.54606044968178, 289, 170.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.085609639177904, -76.1911142619817, 117, 97.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.272561477, -74.41677569, 300, 154.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.404512810292477, -76.15219594503776, 98, 68.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.415911084483553, -76.53785548241716, 208, 181.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.437434942637705, -75.21989550957662, 166, 67.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.4592439466742224, -76.60284635580634, 347, 280.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.242847418268389, -75.55734870218697, 279, 159.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4232113756081683, -76.54637971425878, 212, 181.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.222452448815396, -75.5748578478459, 271, 156.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.452023018228608, -76.59935641235616, 349, 281.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.590470955897048, -75.01753906554808, 374, 211.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.427928795498013, -76.54585322047699, 210, 180.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.438571704025374, -75.19980348835635, 173, 69.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.262664587034767, -75.56560692494656, 275, 161.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.296626982346849, -74.79827393464505, 216, 115.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.428477542352105, -75.70296787055099, 131, 67.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.083786615485008, -76.19045328382761, 117, 98.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.97265356130759, -74.57782846189266, 364, 178.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4148870554322235, -76.53819734799957, 208, 181.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.425181072537963, -76.53350321094399, 207, 180.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.252429230221559, -75.56340068985605, 279, 160.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.441795240749036, -75.24176954557169, 164, 65.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.4788484515927336, -76.59480142720301, 341, 278.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.544850577005966, -75.66150942255632, 61, 30.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.016202457050314, -74.00384034464943, 433, 189.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.447690347011355, -76.53610909070377, 207, 178.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.239036958943368, -75.58787304427861, 276, 158.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.55379960915319, -75.82315634392022, 250, 193.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.2455889729430645, -75.61409043745469, 282, 159.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.440379430310564, -75.18579262639979, 173, 70.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.04337842658972, -75.4276711314434, 304, 139.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.14070730900199, -75.3775172255897, 312, 151.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.059100468040345, -75.487096603177, 87, 35.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.4500386862540964, -76.59964015901005, 353, 281.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.519396164446258, -73.35814739089614, 511, 270.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.43606317550154, -75.20467167262206, 170, 69.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.151903594542589, -74.87869085255952, 211, 117.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.414852937439477, -76.53803885337253, 208, 181.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.585391853068709, -74.21979452851143, 336, 166.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.239248877078907, -75.59491146526634, 274, 158.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.569644816440005, -73.33675852423836, 521, 274.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.187845664428742, -75.57886515446782, 267, 152.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.409757352047175, -75.48560202396766, 184, 69.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.215288552445342, -75.57699221885478, 267, 155.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.461679713686712, -76.52763731363821, 201, 176.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.544043680970043, -75.66157140260101, 60, 30.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.375254362417903, -75.11680955506604, 175, 81.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.420869715974135, -76.53847340521904, 208, 181.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.964806467372122, -73.91075596, 428, 198.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.726830409785917, -75.48449582189878, 312, 123.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.250735793510452, -75.55933969694411, 280, 160.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4523723275113123, -76.49387199146462, 199, 175.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.4535554073119625, -74.67505500725518, 310, 133.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4603340572551997, -76.53042955291697, 202, 176.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.5363974414619648, -76.298105520147, 183, 157.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.169941512201537, -75.61129763020115, 264, 150.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.466936122423338, -76.52473752827679, 200, 175.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.538520985223959, -75.66830247826785, 64, 31.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.083147969171344, -76.18638702521596, 116, 97.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.365473573195246, -76.53243130654386, 221, 186.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.856313949142596, -74.03049273464286, 410, 185.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.824137586077557, -75.67992977564725, 11, 2.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.081705037204574, -76.18810663171129, 117, 98.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.234056988560798, -75.5731264217, 271, 158.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.304662315718689, -73.81387392237731, 482, 215.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.269291572231827, -75.92861589946583, 135, 66.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4226909357344706, -76.5465871291686, 212, 181.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.086962460742646, -75.63444849825007, 249, 141.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.066029855266994, -75.50643462351162, 76, 34.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.336169248257587, -74.36648795354124, 281, 157.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.182452709273006, -75.56458513049525, 272, 152.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.262664622282357, -75.56560763653907, 276, 161.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.248921513187596, -75.56448054020044, 276, 159.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.859137782543064, -74.91700131372991, 234, 86.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.480745503039156, -76.52147196822507, 197, 174.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.906711841122428, -76.29220111590968, 140, 120.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.85815981939269, -74.06035557374979, 397, 181.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.0045884629064807, -76.48286494826128, 241, 219.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.261685552463122, -75.56151168302485, 277, 161.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.462265983087685, -76.52808317421918, 200, 176.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.198919435871809, -75.56160865895626, 272, 154.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.258715094815948, -75.59118702828081, 277, 160.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.393225461825606, -75.8858674899205, 458, 270.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.856509125138024, -74.06255632904957, 396, 181.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.8823408914627775, -77.06500215852891, 272, 183.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.06409428569463, -75.49856950369147, 79, 35.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.933039019027149, -75.28678886579837, 336, 214.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.606830391179642, -74.21754793955, 342, 165.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.545222305238224, -75.6607542294554, 61, 30.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.547286287132974, -75.66215641958136, 63, 30.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.245828870928576, -75.5837323486538, 272, 159.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.451895331602328, -76.59888399986963, 350, 281.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.4451591883036805, -75.2393580654277, 166, 65.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.444461696988133, -76.6108346245746, 356, 282.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.80635528176181, -74.3498904025329, 376, 149.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.175370204979727, -75.58477773761749, 269, 151.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.929708748197588, -75.28564368138892, 336, 214.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.454893886338568, -76.52778590457024, 199, 177.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.053560179496941, -75.48614205694084, 86, 35.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.190315172829236, -74.892602302376, 253, 98.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.199214416853246, -74.75141752421972, 270, 113.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.203155377602498, -75.57639711635746, 269, 154.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.423318585950682, -76.54242220275138, 210, 181.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4398428011105446, -76.53795482247835, 206, 179.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.463425331810051, -76.52850635153992, 200, 176.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.899929151241664, -76.30954715474793, 140, 122.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.45735645918835, -76.5320520097048, 204, 177.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.451566781001903, -76.59618581131946, 351, 281.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.540210801930236, -76.29750888373307, 182, 156.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.547083450505866, -75.66290819501393, 62, 30.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.447520964848531, -76.49876280111435, 202, 176.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.421981700458277, -76.54425383143996, 210, 181.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.250225082640299, -75.56186027777261, 280, 160.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.1987814282486142, -75.63139018627294, 459, 291.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.4120955707337774, -75.17247600830773, 169, 73.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.582387927255063, -74.20044533434208, 338, 168.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.443140828259608, -75.24150290259804, 165, 65.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.246125877425413, -75.56652839887359, 274, 159.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.433408613861449, -75.21950652256278, 164, 68.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4190362878395715, -76.54418003149893, 211, 181.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.450751115643527, -74.66303999929907, 306, 134.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.2665456922934535, -75.56441901980929, 277, 161.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.165927324015932, -75.60063176456407, 261, 150.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4609028017955383, -76.526540130689, 198, 176.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.817723886800714, -73.64111126879179, 521, 228.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.420919662785763, -76.54721437298436, 213, 181.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.544886743428225, -75.66062417267933, 61, 30.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.453906402696936, -76.60437168061604, 350, 281.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.276832786492548, -75.58197126841301, 281, 162.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4547039263337367, -76.53713128965643, 205, 177.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.581446036671879, -76.49211173752738, 193, 163.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.240590992661879, -75.57942385752102, 272, 158.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.1698655191537455, -75.61293070967672, 264, 150.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.845967999326102, -76.00934724666293, 206, 119.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.41566608774086, -76.54007295083419, 209, 181.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.293636834730153, -74.80831622758103, 217, 114.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.543940677699163, -73.35963211900868, 520, 271.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.920873207964668, -75.05795597622735, 241, 72.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.39003020123944, -76.07223183214506, 83, 62.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.171531679370999, -75.61323271557029, 265, 150.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.264859131802446, -75.56513154731599, 278, 161.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.430547212828513, -75.1998356215891, 169, 70.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.464182071008031, -76.52809412668324, 201, 176.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.760211937808062, -75.91769424375231, 43, 24.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.250040042541063, -75.56324838688532, 277, 159.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.93354680824614, -75.24777521938873, 347, 215.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.2247323393771, -75.57472653079203, 271, 157.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.436941429740907, -75.20302557746328, 172, 69.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.551447691465368, -73.3459988987755, 518, 273.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.556146759628807, -75.6567642788959, 60, 29.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.867005740079229, -73.57548469284822, 591, 262.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.541040084826642, -76.29715010427459, 182, 156.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.166790072452807, -75.57991395059874, 270, 150.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.268146902983646, -75.55880177540507, 279, 162.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.15232530954044, -74.87894896111915, 211, 117.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.209352348721864, -75.5691372366181, 273, 155.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.015643915823461, -73.67397298753647, 630, 260.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.256385884391788, -76.53634057475321, 238, 196.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.462734765733817, -76.52246353876669, 197, 176.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.255919136466036, -75.5633838490626, 280, 160.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.9057067402869015, -76.29805387783745, 139, 121.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.240621940956888, -75.59215703661721, 276, 158.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.925163649083877, -75.28641019017091, 336, 215.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.874790044847957, -74.03663300583376, 413, 184.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.229037754507554, -75.56906210189958, 273, 157.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.020571002814866, -73.99840632951783, 433, 189.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.006797808668356, -74.47037745361445, 384, 137.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4202131599776444, -76.54630902512683, 214, 181.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.9839573117486, -75.61010387421261, 47, 20.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.062785608992201, -75.49777100988332, 81, 35.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.391646558306562, -76.07414140622917, 84, 62.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.0574259899262834, -75.52990347737935, 69, 32.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.14602941353705, -73.6829682367289, 458, 226.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.277077365105349, -75.57981446722712, 279, 162.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.035968295929141, -75.46934968659556, 82, 35.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.957047281945735, -75.41404198859608, 425, 239.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4220922736960877, -76.5430866013096, 210, 181.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.228877078651102, -75.57449914379896, 270, 157.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.880451902097991, -77.02020172471978, 267, 179.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.528957817044841, -76.3012638562301, 185, 158.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.212338962953221, -75.57606462080716, 267, 155.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.148330425548087, -75.62169143981981, 259, 148.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.544629395283769, -75.66274868961301, 62, 30.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.060620928679347, -75.49172147738162, 84, 35.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.083715807221048, -75.52602470674671, 81, 35.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.543827868898156, -73.35768623868552, 518, 271.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.1816550965589485, -75.58046049982073, 267, 152.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.93604796895587, -75.28941796624622, 333, 214.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4178864963323674, -76.49429657292625, 208, 178.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.426865560660316, -76.54427087371079, 212, 180.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.451827603722345, -74.66204757151326, 306, 134.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.712155609265651, -74.21291775978908, 360, 165.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.450552976076464, -76.59735837421597, 350, 281.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.132094686227901, -75.39607365481521, 312, 149.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.424915421627889, -75.17640597256478, 170, 72.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.091637297388592, -76.18819741515246, 117, 97.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.364603637572123, -76.53462964262415, 222, 186.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.735301370055316, -74.25970960275433, 360, 159.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.426349405579722, -76.54528265510793, 211, 180.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.2509324089499465, -75.56425545461593, 281, 160.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.03544193373487, -75.46828872364509, 81, 35.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.8566565834421698, -74.93439990018517, 247, 136.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.433238543886525, -75.21017268019192, 170, 69.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.256915299127405, -75.56552125570319, 279, 160.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.461572441006408, -76.52906928676589, 201, 176.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.703668901408699, -74.22802587262129, 352, 163.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.339028454629744, -75.54153378388999, 286, 170.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.2232491805788674, -75.57488273243887, 270, 156.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.239883669644668, -75.57902098716264, 274, 158.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.530612438094217, -76.3048292989773, 182, 158.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.469612004364324, -76.52202905334181, 199, 175.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4206191572587814, -76.54770437137684, 213, 181.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.209688878250489, -75.57324458373296, 270, 155.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4302251199673823, -76.54487805131703, 210, 180.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4765288519777133, -76.52366932148534, 197, 174.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.206468590559931, -75.57013154976663, 271, 155.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.45163749812887, -74.66306446297159, 306, 134.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.9321403288008034, -75.28119405007203, 338, 214.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.062962905741833, -75.50092978050142, 77, 35.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.333364599102096, -74.37094312063512, 281, 156.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.819573395709, -74.35756868602301, 380, 148.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.450818931768424, -74.66409760290912, 305, 134.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.307011886997111, -73.81596443286014, 483, 215.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.751603419313227, -75.90359069831736, 37, 23.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.182100253692157, -75.57998873926789, 267, 152.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.239047182685356, -75.59939137807866, 276, 158.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.070776745885852, -74.60158753464276, 316, 124.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.749874524351586, -75.90936941182207, 39, 24.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.555010271030024, -73.3508360772187, 517, 272.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 5.1992399147700965, -74.75084414834289, 270, 113.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.581903784721273, -74.21285346668061, 331, 166.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4679074313619087, -76.5238256666329, 200, 175.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.296665623883847, -74.80343867014477, 217, 115.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.281196734519334, -75.61280101015168, 289, 163.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.229164316646731, -75.59827735779197, 278, 157.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.178735755814528, -75.58373186925999, 268, 151.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.255389163710516, -75.55624920406696, 282, 160.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.193934759283139, -75.55736155291557, 274, 153.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.232845530012286, -75.58434310291331, 272, 157.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.206828073910518, -75.57124309846765, 271, 155.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.191537199908636, -75.5799238444711, 265, 153.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.140091467622188, -75.37888341078576, 312, 151.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.214012744137268, -75.5946677108424, 271, 155.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.488707707033675, -74.40424341911705, 445, 234.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 6.160166529862376, -75.60508211631037, 264, 149.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.93068011257469, -75.28782237321727, 335, 214.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.941213385014256, -75.29949745576265, 329, 213.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.9234378694335006, -75.28594585077484, 335, 215.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 2.93457196313154, -75.28979500244712, 334, 214.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.364012560148381, -76.53396545207518, 222, 186.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4100537484986706, -76.53953159605796, 209, 182.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.37275091944751, -76.52562880541036, 220, 184.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.3933476327421648, -76.52556446113552, 216, 182.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.4208907260885724, -76.53896469390261, 208, 181.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.457008635349081, -76.53222931256545, 204, 177.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.899667118617229, -76.30453417533178, 140, 122.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.8999303182123226, -76.30954864258992, 140, 122.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.8951186683525454, -76.30372449033906, 141, 122.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 4.759816377549786, -75.92529574209294, 44, 25.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.817888136171111, -75.69976105300874, 3.528369175485316, -76.29332123914223, 187, 157.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.408202568951646, -75.50435472476818, 187, 123.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.396941284929628, -75.55682774891326, 203, 122.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.39187475946568, -75.47903273304597, 180, 121.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.92906093046752, -74.76399515516277, 246, 193.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.746768823999886, -75.88095883468498, 134, 81.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.309270302327848, -73.60855947238545, 355, 225.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.456428959171118, -73.24808244570872, 449, 267.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.237766142852204, -74.2013196639611, 352, 251.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.391861874486914, -75.48683757967747, 184, 121.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.001552408643978, -74.81170082509617, 266, 199.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.79542456975034, -74.91353432412144, 237, 173.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.506879720459802, -75.46667318943247, 201, 134.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.001534421459144, -74.81305650189144, 267, 199.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.476918028096458, -73.24940512956763, 458, 268.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.32019936103718, -74.57263155765082, 149, 90.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.431934538542462, -75.53473697419038, 196, 126.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.009276795140783, -74.25211573685867, 311, 227.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.245670191054826, -75.81275798184588, 77, 46.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.094265007594469, -76.71451682270741, 352, 197.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.751278481543796, -75.88631906168824, 135, 81.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.513080215357634, -74.18331054986287, 389, 188.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.98362158337306, -74.79816164809509, 261, 197.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 7.995896895722694, -75.19687574284218, 194, 147.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.407398963989133, -75.51737227761859, 185, 123.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.412309098938977, -75.53662977418323, 188, 124.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.2375398991436, -74.20112766937876, 351, 251.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.237965696710868, -74.18694497441662, 353, 252.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.781690771044536, -75.8605440856462, 125, 77.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.99295543792665, -74.81463099036876, 261, 198.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.311660490237674, -73.6149151167801, 355, 224.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.760010180469244, -75.8712087012664, 130, 80.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 7.982166373787864, -75.20211863480455, 196, 148.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.39579516112651, -75.5558846411193, 204, 122.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.939891242985729, -74.83359759763357, 255, 191.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.241200467025372, -74.18581325919199, 353, 252.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.239323012620996, -74.19202633973426, 352, 252.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 7.887434774810714, -76.63720000804399, 371, 208.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.981734001537337, -74.79121937494087, 261, 197.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.3886419947529, -75.46899683102603, 177, 120.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.001528000262075, -74.81305688946982, 267, 199.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.40555614601419, -75.50808316738481, 185, 123.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.745267339219136, -75.89163933111695, 137, 82.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.227202020205432, -75.82012121567314, 84, 47.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.420490458050551, -75.53831127419171, 193, 125.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.241269105955974, -74.1899972696521, 355, 252.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.400421936704827, -75.5035194907442, 183, 122.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.901661178142346, -74.78280705783865, 242, 189.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.751848746134115, -75.88059360598709, 132, 81.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.001058868175846, -74.81445897600331, 265, 199.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.960605706895503, -74.79393603693434, 255, 195.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.990361471208564, -74.7951680136852, 264, 198.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.914332963163876, -74.77331212565508, 237, 191.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.418024039176418, -75.5331332036317, 191, 124.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.982562388202735, -74.79599102917764, 260, 197.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.752217881483405, -75.88708866352243, 134, 81.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.640200586841583, -74.91121164496546, 212, 157.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.996134204235979, -73.97231349896727, 250, 159.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.001486576555097, -74.81623401975469, 264, 199.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.751602745454349, -75.88387485427573, 133, 81.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.630555466618128, -74.92171572163319, 216, 156.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.02381645673148, -73.2393653929536, 397, 249.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.23699785089421, -74.21078200556975, 352, 250.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.237564632923002, -74.20043453615679, 352, 251.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.955098120154062, -74.81540027877305, 252, 194.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.392855855765928, -75.47484764872102, 179, 121.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.407697499174576, -75.50221350360832, 186, 123.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.004559420467931, -74.24398851743851, 312, 227.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.62992172940839, -74.92103795222557, 216, 156.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.994855120431756, -74.79465910962541, 264, 199.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 7.852118706855236, -76.64077723711995, 372, 211.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.97150664937677, -74.80136058125636, 258, 196.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.754573354095243, -75.88434012242462, 133, 81.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.888590725407752, -74.79057718624698, 244, 188.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.878793791460454, -75.79585243696457, 105, 64.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.420482095259048, -75.53300502853601, 192, 125.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.408284548444449, -75.58510798432661, 133, 101.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.990190730551152, -74.80614284634878, 267, 198.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.927618399430711, -74.77152621454748, 243, 192.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.238544227432085, -74.20250887561788, 359, 251.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.71368198845475, -75.11704925015722, 84, 54.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.790174197944722, -74.7573227829181, 218, 179.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.394730083115162, -75.47652882850181, 180, 121.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.404322365094073, -75.55333796645938, 202, 123.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.38901570068514, -75.5198496179919, 181, 121.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.237271442422534, -74.20183517668754, 352, 251.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.746049174832741, -75.87664970716389, 132, 81.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.235182995834718, -74.21294966635416, 351, 250.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.394364577601245, -75.47695063287843, 181, 121.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.753391306943337, -75.88672271628357, 134, 81.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.001445243756596, -74.81520291337473, 264, 199.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.974706856790004, -73.88401171623957, 354, 181.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.309092038381918, -73.60468941979103, 355, 225.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.397364273763598, -75.48699066553472, 185, 122.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.31003164814464, -73.60865334342499, 355, 225.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.233125707689602, -74.19485567587951, 349, 251.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.929854444808896, -74.7806659935753, 245, 192.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.754025864104102, -75.8838653800895, 133, 81.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.954997260390527, -74.79602195477653, 252, 194.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.918553095805152, -74.8165390334128, 251, 190.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.407780897430044, -75.51438834812856, 186, 123.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.981684752429103, -74.78183397257915, 259, 198.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.471465536735424, -73.25216873405172, 455, 268.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.487808054689046, -73.26433467515595, 463, 267.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.636587936350422, -74.92332080590461, 216, 156.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.753555927215924, -75.88585824991253, 134, 81.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.014376414952698, -74.79655025959862, 265, 201.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.39584522057028, -75.49168734776028, 184, 121.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.476768858373571, -73.25124484570827, 457, 268.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.424572698369555, -75.5468958447697, 197, 125.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.787028325097832, -74.78801388432187, 170, 85.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.238483980615063, -74.213353477533, 352, 250.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.002040046183016, -74.81746226547014, 263, 199.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.74988382673178, -75.88058487028509, 131, 81.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.750732569763048, -75.88193752306822, 133, 81.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.948212880370965, -75.44670829028509, 58, 39.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.657358678233331, -75.13105536583748, 104, 77.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.420108081092206, -75.53540679682564, 193, 125.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.472075793007388, -73.25215101626061, 456, 268.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.23572561987276, -74.19026143190118, 352, 251.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.000778611659854, -74.81567011333571, 265, 198.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.008168238679366, -73.97154923894504, 248, 159.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.771535355441975, -75.86780625628485, 124, 78.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.309986825026062, -73.60414686237884, 354, 225.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.4092291082002, -75.51742123513202, 185, 123.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.24315875309, -74.75423677086704, 103, 70.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.98941273566892, -74.80751740863448, 267, 198.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.01550816729142, -74.84682148793752, 259, 199.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.47007387741137, -73.25230449294729, 455, 267.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.238715360702871, -74.21329504632368, 352, 250.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.755805351387062, -75.88347474979753, 132, 81.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.751087752455105, -75.88160295546388, 131, 81.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.946836845218732, -74.82156671053247, 248, 193.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.015036247181252, -74.24590639202314, 314, 227.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.003705195659707, -74.81981778694751, 261, 199.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 6.957047281945735, -75.41404198859608, 410, 260.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.187691724, -75.55713812, 59, 22.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.388800806506891, -75.50174661522674, 179, 121.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.476253036465966, -73.24938910215522, 457, 268.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.750240026700576, -75.88053582794029, 131, 81.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.991327622786809, -74.80597805289156, 266, 198.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.362653485071926, -73.59935451293644, 375, 196.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.002315272962532, -74.81317748071436, 267, 199.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.99944488803384, -74.81774526553366, 263, 198.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.47240053977978, -73.2474200046039, 455, 268.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 7.985374396597971, -75.42223666353838, 189, 146.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.970666810551544, -74.8006546854266, 258, 196.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 7.98317046885833, -75.19816310145387, 197, 148.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.95210184894636, -74.78761977473151, 248, 194.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.473323636650631, -73.2534400457083, 456, 268.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.397452100088218, -75.55632827080744, 203, 122.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.002214550788391, -74.81667495568318, 263, 199.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.236867956797989, -74.19475579199332, 358, 251.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.794765843536904, -74.78814979479124, 166, 85.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.000170385711456, -74.81553668648547, 263, 198.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.760952432222027, -75.87843244575458, 131, 80.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.75962105957378, -75.87022253439979, 129, 80.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.972892628754655, -74.78150957770686, 253, 197.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.790126630832331, -74.75343673250259, 219, 179.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.916144967214288, -74.76624609422578, 241, 191.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.466454618269804, -73.25437747539914, 452, 267.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.758066955897124, -75.88029117518333, 132, 80.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.955324223880298, -75.45059553259931, 60, 39.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.520375814217918, -74.18631352658772, 392, 189.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.007588229824805, -74.8203278685951, 262, 199.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.463624229496284, -73.25459518090456, 452, 267.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.011500052468406, -74.25027660345583, 313, 227.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.004807596375484, -74.8208795518576, 261, 199.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.006773299080791, -74.24587280331558, 312, 227.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.238371080492632, -75.81224004571833, 78, 46.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 7.886150338172923, -76.62997720042644, 369, 208.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.467260552064932, -74.53814242101261, 211, 132.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.406562599213952, -75.5148384035649, 185, 123.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.989739189385755, -74.80709839519076, 267, 198.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.006986200710864, -73.97232137539119, 249, 159.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.000140822389303, -74.81455694243897, 263, 198.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.991077292052635, -74.80567723757554, 266, 198.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.807828939987235, -74.91604813586802, 236, 175.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.993998188650178, -74.7948293327532, 264, 199.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.411042289702516, -75.53613529541818, 188, 124.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.459157978485218, -74.61761306898423, 348, 153.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.51383857416534, -74.18236003789706, 390, 188.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.75214859521082, -75.8827396285672, 132, 81.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.004875435524845, -74.82162482176349, 261, 199.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.46910006885733, -73.25473123303443, 455, 267.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.148430083177209, -74.2254023999125, 210, 129.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.990976029466909, -74.81040687642212, 264, 198.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.99248675980801, -73.97011575465736, 253, 159.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 8.664053610222613, -75.13472082180456, 101, 76.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.034394333868445, -73.23102398223246, 399, 250.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.320778873164969, -75.28845300804274, 24, 11.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.985183550761688, -74.80987335022702, 265, 197.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.005511437000468, -74.8205215843762, 263, 199.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.991834510779826, -74.79353615495019, 263, 198.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 11.003944263622737, -74.81958183836898, 261, 199.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.962956452403672, -74.83947341946782, 252, 194.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.965154826668478, -74.79795937490105, 255, 195.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.407721468048376, -75.5163225426453, 187, 123.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.379221793692704, -75.4756224646012, 178, 119.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.244150307697137, -74.75526796450302, 104, 70.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 9.256473373662336, -74.43099848346431, 169, 105.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.462320005653204, -73.25117133688875, 450, 267.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(9.303929148438568, -75.39277521496017, 10.47066166333449, -73.25746149950697, 455, 267.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.811809594399092, -73.03132800552976, 194, 174.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.704414702155407, -74.0410900002528, 30, 8.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.915446839579079, -74.02548280112961, 56, 31.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.430546544280079, -75.19983495103688, 216, 127.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.215478559392075, -75.56977939900673, 527, 242.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.195493743750158, -73.14269592674758, 306, 119.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.062145747111648, -73.85954526159104, 476, 271.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.286464322006945, -75.57412433595582, 528, 248.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.405993675648094, -73.94911449516907, 106, 28.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.97325419126968, -74.57780835194671, 300, 159.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.337651871793532, -75.54578535372055, 527, 250.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.703419656527395, -74.02930098036175, 26, 8.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.81354221805447, -75.69973815499264, 398, 182.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.540442503611016, -73.36126107027229, 155, 127.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.130649273498971, -74.16030421683267, 133, 56.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.710636981918698, -74.03229634336445, 26, 9.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.1141325787093725, -73.10775991929727, 548, 295.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.342933259564552, -75.54606044968178, 530, 250.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.085609639177904, -76.1911142619817, 448, 243.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.272561477, -74.41677569, 136, 55.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.404512810292477, -76.15219594503776, 437, 232.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.110657522025528, -73.11315140271121, 545, 294.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.437434942637705, -75.21989550957662, 224, 129.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.242847418268389, -75.55734870218697, 532, 243.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.729950583606929, -74.04631249290854, 27, 10.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.222452448815396, -75.5748578478459, 534, 243.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.14904863058648, -73.13468365866615, 563, 298.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.55268182176747, -74.09457411403845, 34, 9.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.1448063015300365, -73.64374994059658, 198, 71.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.716517085893189, -72.92556490829342, 219, 174.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.140610304736505, -73.6371507716327, 193, 72.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.703851089887817, -74.02986652630322, 26, 8.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.590470955897048, -75.01753906554808, 514, 241.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.695803118796537, -74.03126236811453, 28, 7.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.438571704025374, -75.19980348835635, 221, 127.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.262664587034767, -75.56560692494656, 530, 245.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.296626982346849, -74.79827393464505, 169, 89.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.428477542352105, -75.70296787055099, 526, 201.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.083786615485008, -76.19045328382761, 448, 243.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.97265356130759, -74.57782846189266, 301, 159.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.072752947086473, -73.11015799172242, 546, 291.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.688444734184593, -74.05187997080502, 21, 6.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.252429230221559, -75.56340068985605, 530, 244.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.696599111926684, -74.0755832327179, 27, 7.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.441795240749036, -75.24176954557169, 222, 131.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.544850577005966, -75.66150942255632, 356, 176.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.016202457050314, -74.00384034464943, 69, 43.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.665136315274092, -74.07893605007945, 16, 3.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.552798357807002, -73.13467223740737, 393, 237.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.239036958943368, -75.58787304427861, 534, 245.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.55379960915319, -75.82315634392022, 587, 288.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.2455889729430645, -75.61409043745469, 543, 247.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.069962305436829, -73.11504842945598, 543, 290.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.440379430310564, -75.18579262639979, 218, 125.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.827118175857049, -75.73466619198886, 407, 186.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.145135021452405, -73.63546935449075, 196, 72.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.04337842658972, -75.4276711314434, 519, 217.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.14070730900199, -75.3775172255897, 492, 221.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.72469182241783, -72.9240704549527, 218, 175.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.059100468040345, -75.487096603177, 441, 164.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.81436783419481, -75.71911397056707, 401, 184.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.466746757541894, -73.26392809897133, 364, 222.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.143249373265375, -73.6429095792248, 197, 72.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.711556752847948, -74.02981032471102, 27, 9.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.519396164446258, -73.35814739089614, 147, 125.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.6059614743385255, -74.08289904981226, 16, 3.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.806793645742162, -75.68091334414372, 399, 179.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.43606317550154, -75.20467167262206, 220, 127.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.6398015058636535, -74.06666611649929, 8, 0.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.70220917848447, -72.7294593322646, 432, 273.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.151903594542589, -74.87869085255952, 178, 104.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.747951369480355, -74.03629379979768, 34, 13.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.111433742252224, -73.11001572483768, 545, 295.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.585391853068709, -74.21979452851143, 49, 17.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.239248877078907, -75.59491146526634, 535, 245.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.5932314879917, -74.08860809031177, 23, 5.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.569644816440005, -73.33675852423836, 156, 131.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.187845664428742, -75.57886515446782, 537, 240.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.409757352047175, -75.48560202396766, 568, 179.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.061573448497247, -73.1145911853108, 540, 289.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.215288552445342, -75.57699221885478, 531, 242.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.544043680970043, -75.66157140260101, 354, 176.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.115512961775174, -73.1070391304439, 549, 295.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.375254362417903, -75.11680955506604, 202, 119.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.964806467372122, -73.91075596, 63, 40.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.989547285539411, -73.04805011346485, 527, 285.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.726830409785917, -75.48449582189878, 286, 186.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.664277509167347, -74.08069739172724, 17, 3.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.250735793510452, -75.55933969694411, 534, 244.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.4523723275113123, -76.49387199146462, 530, 299.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.1154010153317975, -73.1185440258165, 547, 295.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.4535554073119625, -74.67505500725518, 265, 113.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.5363974414619648, -76.298105520147, 514, 275.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.732806289538411, -74.08896457786379, 39, 11.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.169941512201537, -75.61129763020115, 545, 241.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.538520985223959, -75.66830247826785, 353, 177.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.083147969171344, -76.18638702521596, 446, 242.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.856313949142596, -74.03049273464286, 46, 25.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.824137586077557, -75.67992977564725, 406, 179.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.058470441833496, -73.85075022837326, 470, 270.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.3487542254486495, -72.39150595551668, 404, 201.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.694821702358422, -74.03386783927365, 22, 7.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.081705037204574, -76.18810663171129, 447, 243.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.144191889209991, -73.63910797916533, 196, 72.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.234056988560798, -75.5731264217, 531, 243.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.699547833960588, -74.03244034135732, 24, 8.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.304662315718689, -73.81387392237731, 117, 79.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.269291572231827, -75.92861589946583, 414, 210.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.086962460742646, -75.63444849825007, 558, 237.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.066029855266994, -75.50643462351162, 448, 166.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.808824633188668, -75.68661069543123, 399, 180.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.634963646193039, -74.07764157019083, 7, 1.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.336169248257587, -74.36648795354124, 108, 46.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.182452709273006, -75.56458513049525, 535, 239.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.262664622282357, -75.56560763653907, 530, 245.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.814854035339171, -73.03084155847718, 195, 174.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.248921513187596, -75.56448054020044, 532, 244.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.683063321707407, -74.05894772672856, 22, 5.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.859137782543064, -74.91700131372991, 241, 97.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.634211624880233, -74.07088708227077, 4, 0.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.906711841122428, -76.29220111590968, 470, 259.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.692242901810987, -74.0558224683915, 19, 6.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.067911527803675, -73.86129685440564, 478, 271.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.85815981939269, -74.06035557374979, 61, 24.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.117181335326224, -73.1101184013692, 548, 295.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.261685552463122, -75.56151168302485, 532, 245.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.695657749101086, -74.0330267997836, 25, 7.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.07314911513701, -73.11040024832236, 543, 291.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.826837034490856, -73.03308202169862, 201, 175.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.724097272859434, -72.92516047663935, 217, 175.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.343806568025213, -72.39333951684215, 401, 201.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.198919435871809, -75.56160865895626, 532, 240.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.258715094815948, -75.59118702828081, 534, 247.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.816124756112588, -75.69568472060982, 400, 181.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.856509125138024, -74.06255632904957, 61, 24.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.332825178390964, -72.68544202625188, 334, 243.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.706503833820006, -74.04896688246171, 26, 8.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.698267419648344, -74.073075391367, 29, 7.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.06409428569463, -75.49856950369147, 445, 165.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.121260790240512, -73.11910346114853, 551, 295.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.648774301848993, -74.09553561603367, 14, 3.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.933039019027149, -75.28678886579837, 310, 232.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.606830391179642, -74.21754793955, 51, 16.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.636050248617544, -74.0738095821962, 6, 0.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.545222305238224, -75.6607542294554, 355, 176.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.547286287132974, -75.66215641958136, 357, 177.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.245828870928576, -75.5837323486538, 531, 245.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.128043298301729, -73.11402678432134, 555, 296.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.341632319105894, -72.40751299360149, 398, 200.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.4451591883036805, -75.2393580654277, 224, 131.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.5470808931969287, -73.6969222782707, 283, 127.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.80635528176181, -74.3498904025329, 73, 36.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.175370204979727, -75.58477773761749, 543, 240.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.621601987584569, -74.07037866514302, 8, 1.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.929708748197588, -75.28564368138892, 310, 232.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.741412047036608, -74.03451508737604, 35, 12.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.053560179496941, -75.48614205694084, 440, 163.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.190315172829236, -74.892602302376, 253, 110.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.199214416853246, -74.75141752421972, 238, 98.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.203155377602498, -75.57639711635746, 533, 241.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.818031256341327, -75.69881051093883, 402, 181.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.899929151241664, -76.30954715474793, 471, 261.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.554838472250853, -73.13412043763671, 395, 237.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.117648187467569, -73.10883100131653, 548, 295.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.587944782855312, -74.08454612585771, 21, 5.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.11667736216081, -73.11614370486467, 548, 295.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.111811135085474, -73.10944207023199, 549, 295.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.540210801930236, -76.29750888373307, 513, 275.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.7114770279653575, -74.03013559347686, 27, 9.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.547083450505866, -75.66290819501393, 357, 177.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.607992588381057, -74.08046409656349, 14, 3.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.806090982447353, -75.68660393118031, 397, 180.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.250225082640299, -75.56186027777261, 533, 244.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.4120955707337774, -75.17247600830773, 214, 124.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.630446235347357, -74.13076230024579, 21, 7.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.147848366224331, -73.63931570323442, 197, 71.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.804742004603501, -75.69023647949913, 395, 180.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.582387927255063, -74.20044533434208, 48, 15.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.627059446119183, -74.06922755095722, 8, 0.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.646616972443036, -74.06754190740598, 9, 1.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.443140828259608, -75.24150290259804, 224, 131.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.246125877425413, -75.56652839887359, 531, 244.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.433408613861449, -75.21950652256278, 222, 129.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.07425836774148, -73.11001516382542, 544, 291.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.148347238433793, -73.63812499884176, 196, 71.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.450751115643527, -74.66303999929907, 265, 112.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.2665456922934535, -75.56441901980929, 530, 245.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.165927324015932, -75.60063176456407, 544, 240.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.668673932964532, -74.10775255487931, 18, 5.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.587462743354136, -74.08371599169818, 21, 5.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.817723886800714, -73.64111126879179, 148, 51.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.720093798003992, -74.04648097535063, 26, 9.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.544886743428225, -75.66062417267933, 355, 176.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.276832786492548, -75.58197126841301, 531, 247.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.060501105844701, -73.85411843375279, 472, 270.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.581446036671879, -76.49211173752738, 523, 293.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.240590992661879, -75.57942385752102, 533, 244.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.698921738486702, -74.03857687779292, 28, 7.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.1698655191537455, -75.61293070967672, 546, 241.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.845967999326102, -76.00934724666293, 601, 253.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.583708067866765, -74.10506147080226, 28, 6.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.293636834730153, -74.80831622758103, 173, 90.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.543940677699163, -73.35963211900868, 155, 128.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.815790551641994, -75.69502544356473, 401, 181.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.920873207964668, -75.05795597622735, 272, 114.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.810106648759004, -73.02968479769682, 194, 174.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.39003020123944, -76.07223183214506, 422, 223.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.171531679370999, -75.61323271557029, 545, 241.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.264859131802446, -75.56513154731599, 532, 245.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.677125932482472, -74.05982115914789, 18, 4.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.430547212828513, -75.1998356215891, 216, 127.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.760211937808062, -75.91769424375231, 428, 205.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.250040042541063, -75.56324838688532, 534, 244.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.696366327777668, -74.03219228774293, 23, 7.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.93354680824614, -75.24777521938873, 321, 229.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.2247323393771, -75.57472653079203, 532, 243.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.436941429740907, -75.20302557746328, 219, 127.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.705330402136046, -74.03185474135735, 25, 8.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.551447691465368, -73.3459988987755, 153, 129.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.556146759628807, -75.6567642788959, 358, 176.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.807083532675607, -75.6813944681382, 398, 179.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.867005740079229, -73.57548469284822, 226, 147.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.697191883095981, -74.03985830853621, 26, 7.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.801674549750414, -75.68643755296132, 395, 180.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.541040084826642, -76.29715010427459, 512, 275.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.166790072452807, -75.57991395059874, 545, 238.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.268146902983646, -75.55880177540507, 532, 245.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.621702291854586, -74.07131325605974, 8, 1.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.15232530954044, -74.87894896111915, 178, 104.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.209352348721864, -75.5691372366181, 529, 241.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.015643915823461, -73.67397298753647, 266, 159.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.623276238030671, -74.06996389022076, 11, 1.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.255919136466036, -75.5633838490626, 532, 244.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.9057067402869015, -76.29805387783745, 469, 260.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.240621940956888, -75.59215703661721, 534, 245.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.76121742523095, -74.09279609153855, 46, 14.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.812882197284504, -75.76566375502401, 395, 189.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.7216268713601455, -74.04713888949965, 27, 10.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.925163649083877, -75.28641019017091, 310, 233.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.144664793356877, -73.6416306720323, 198, 72.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.874790044847957, -74.03663300583376, 48, 27.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.229037754507554, -75.56906210189958, 530, 243.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.7499782678533125, -74.06557082923554, 39, 12.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.020571002814866, -73.99840632951783, 69, 43.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.006797808668356, -74.47037745361445, 131, 60.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.9839573117486, -75.61010387421261, 443, 175.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.342512112689748, -72.38951509031787, 402, 201.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.062785608992201, -75.49777100988332, 446, 165.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.391646558306562, -76.07414140622917, 423, 224.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.0574259899262834, -75.52990347737935, 446, 168.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.058534889811466, -73.85627905164773, 474, 270.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.14602941353705, -73.6829682367289, 93, 71.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.277077365105349, -75.57981446722712, 530, 247.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.035968295929141, -75.46934968659556, 431, 161.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.957047281945735, -75.41404198859608, 631, 298.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.695101767331468, -74.0361860034745, 25, 7.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.228877078651102, -75.57449914379896, 533, 243.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.697778714574997, -74.05097658705961, 22, 7.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.686486774082736, -74.04483128811002, 19, 6.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.528957817044841, -76.3012638562301, 516, 276.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.570862077311099, -74.10720036924138, 31, 8.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.212338962953221, -75.57606462080716, 532, 242.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.148330425548087, -75.62169143981981, 548, 240.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.544629395283769, -75.66274868961301, 357, 177.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.807106195492069, -75.68987882478265, 395, 180.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.144465938767297, -73.63681391341032, 196, 72.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.060620928679347, -75.49172147738162, 444, 164.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.827564407826667, -73.03607008328949, 200, 175.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.083715807221048, -75.52602470674671, 455, 169.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.543827868898156, -73.35768623868552, 154, 128.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.1816550965589485, -75.58046049982073, 540, 240.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.93604796895587, -75.28941796624622, 308, 232.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.576725390133819, -74.09120722887337, 23, 6.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.691560901289351, -74.04861332601517, 22, 6.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.451827603722345, -74.66204757151326, 265, 112.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.346510840541617, -72.39586207956954, 401, 201.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.672054538171513, -74.13683819123395, 27, 8.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.712155609265651, -74.21291775978908, 49, 18.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.679811934359848, -74.06481140025285, 19, 5.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.066221878399396, -73.86300314267231, 478, 271.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.132094686227901, -75.39607365481521, 499, 222.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.424915421627889, -75.17640597256478, 215, 125.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.091637297388592, -76.18819741515246, 448, 242.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.735301370055316, -74.25970960275433, 57, 24.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.326931191715864, -72.38818014169568, 401, 201.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.2509324089499465, -75.56425545461593, 532, 244.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.629489513192148, -74.13574666109238, 25, 7.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.03544193373487, -75.46828872364509, 431, 161.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.8566565834421698, -74.93439990018517, 222, 129.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.433238543886525, -75.21017268019192, 220, 128.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.256915299127405, -75.56552125570319, 532, 245.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.126085678332449, -73.11808662770163, 549, 296.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.703668901408699, -74.22802587262129, 46, 19.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.339028454629744, -75.54153378388999, 526, 250.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.2232491805788674, -75.57488273243887, 533, 243.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.602991744957953, -74.08673210063722, 18, 4.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.239883669644668, -75.57902098716264, 531, 244.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.530612438094217, -76.3048292989773, 512, 276.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.143006053568595, -73.63991937949662, 196, 72.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.209688878250489, -75.57324458373296, 532, 241.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.206468590559931, -75.57013154976663, 533, 241.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.817450089402223, -75.69768318707446, 401, 181.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.34843075291234, -72.39109612890122, 403, 201.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.144312746253328, -73.63501099558127, 197, 72.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.45163749812887, -74.66306446297159, 265, 112.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.9321403288008034, -75.28119405007203, 312, 232.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.062962905741833, -75.50092978050142, 444, 165.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.110784954875528, -73.1110530100441, 546, 295.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.713510638256742, -72.93111536811632, 217, 173.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.333364599102096, -74.37094312063512, 108, 47.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.819573395709, -74.35756868602301, 77, 38.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.450818931768424, -74.66409760290912, 265, 112.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.307011886997111, -73.81596443286014, 119, 79.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.751603419313227, -75.90359069831736, 422, 203.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.182100253692157, -75.57998873926789, 540, 240.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.803489669258103, -75.68430130350818, 396, 180.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.239047182685356, -75.59939137807866, 536, 246.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.070776745885852, -74.60158753464276, 189, 76.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.8088902120775225, -75.68708657968855, 398, 180.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.749874524351586, -75.90936941182207, 424, 204.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.555010271030024, -73.3508360772187, 153, 129.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 5.1992399147700965, -74.75084414834289, 237, 98.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.686565397478874, -74.06059060182486, 23, 5.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.581903784721273, -74.21285346668061, 49, 17.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.142268817437598, -73.64029695970503, 197, 72.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.070787873329211, -73.1131064300106, 546, 290.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.296665623883847, -74.80343867014477, 170, 89.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.281196734519334, -75.61280101015168, 543, 250.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.229164316646731, -75.59827735779197, 539, 245.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.178735755814528, -75.58373186925999, 543, 240.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.255389163710516, -75.55624920406696, 534, 244.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.193934759283139, -75.55736155291557, 533, 239.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.232845530012286, -75.58434310291331, 535, 244.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.206828073910518, -75.57124309846765, 533, 241.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.191537199908636, -75.5799238444711, 537, 240.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.140091467622188, -75.37888341078576, 492, 221.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.214012744137268, -75.5946677108424, 539, 243.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.488707707033675, -74.40424341911705, 382, 209.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 6.160166529862376, -75.60508211631037, 544, 240.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.692296265865653, -74.0980832655579, 26, 7.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.706486734767949, -74.05090403083918, 27, 8.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.634125692982733, -74.11254877372549, 19, 5.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.70691276552089, -74.05198997080508, 26, 8.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.70456541913689, -74.0504919291778, 24, 8.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.648190895677362, -74.10622197080231, 21, 4.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.642493103460875, -74.06875977080995, 8, 0.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.6276282037710414, -74.1449911413587, 26, 8.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.592807598432202, -74.08996216363073, 22, 5.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.682677508315564, -74.05836949820933, 21, 5.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.703952553243483, -74.04423288583504, 25, 8.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.615206288069383, -74.17244620622692, 35, 11.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.704093560003992, -74.04490194640884, 25, 8.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.638794194168213, -74.06811025185188, 8, 0.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.623887607387683, -74.15362927793012, 28, 9.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.595580550757874, -74.17315277116823, 43, 12.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.652630575006434, -74.10172733130143, 15, 4.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.623334508148629, -74.08270645731737, 13, 2.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.663672497013976, -74.07987710908219, 17, 3.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.571719789112955, -74.12867513035278, 35, 9.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.559514676580857, -74.13830035356666, 40, 11.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.651595014209306, -74.14898257955721, 29, 9.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.635115274801236, -74.20607237056706, 48, 15.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.671682507396267, -74.146343723427, 32, 9.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.616540119066279, -74.15332009038653, 33, 9.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.569752102622589, -74.08350650001482, 29, 7.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.591492872737771, -74.09232595286191, 23, 5.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.742868427155099, -74.02301168124903, 37, 13.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.710961913786103, -74.10972923393435, 35, 9.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.753542117244553, -74.0919445837163, 42, 13.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.623546083734686, -74.06959885946479, 11, 1.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.93068011257469, -75.28782237321727, 310, 232.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.941213385014256, -75.29949745576265, 303, 232.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.9234378694335006, -75.28594585077484, 310, 233.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 2.93457196313154, -75.28979500244712, 309, 232.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.156459201191459, -73.63718289107166, 201, 71.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.144691127830611, -73.63939016931985, 197, 72.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.801648579691926, -75.74136118146443, 394, 186.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.803812822531239, -75.6897342726292, 396, 180.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.120665236822153, -73.11478833225361, 550, 295.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.110055748780144, -73.1116906324252, 546, 294.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.120979583764418, -73.11480397326893, 549, 295.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.060940691829962, -73.08822990241045, 538, 290.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.061051756317317, -73.08831134697559, 538, 290.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.035227132594248, -73.06969724875334, 534, 288.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 7.035943102577871, -73.06858903276776, 535, 289.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.899667118617229, -76.30453417533178, 470, 261.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.8999303182123226, -76.30954864258992, 471, 261.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.8951186683525454, -76.30372449033906, 472, 261.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 4.759816377549786, -75.92529574209294, 429, 206.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.633794896229732, -74.06733995774036, 3.528369175485316, -76.29332123914223, 518, 275.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.811809594399092, -73.03132800552976, 192, 171.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.704414702155407, -74.0410900002528, 28, 7.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.915446839579079, -74.02548280112961, 54, 24.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.430546544280079, -75.19983495103688, 219, 124.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.215478559392075, -75.56977939900673, 499, 232.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.195493743750158, -73.14269592674758, 304, 120.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.062145747111648, -73.85954526159104, 448, 263.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.286464322006945, -75.57412433595582, 499, 239.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.405993675648094, -73.94911449516907, 108, 37.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.684992538249309, -74.05647242070954, 21, 6.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.97325419126968, -74.57780835194671, 272, 150.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.337651871793532, -75.54578535372055, 499, 241.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.703419656527395, -74.02930098036175, 25, 8.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.81354221805447, -75.69973815499264, 400, 176.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.682832968516384, -74.0571619852809, 18, 6.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.540442503611016, -73.36126107027229, 153, 124.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.130649273498971, -74.16030421683267, 131, 47.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.710636981918698, -74.03229634336445, 24, 8.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.1141325787093725, -73.10775991929727, 547, 289.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.342933259564552, -75.54606044968178, 501, 241.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.085609639177904, -76.1911142619817, 450, 240.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.272561477, -74.41677569, 139, 59.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.404512810292477, -76.15219594503776, 440, 228.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.110657522025528, -73.11315140271121, 544, 289.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.437434942637705, -75.21989550957662, 227, 126.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.242847418268389, -75.55734870218697, 504, 234.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.729950583606929, -74.04631249290854, 25, 7.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.635511182922544, -74.06222077819245, 29, 9.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.222452448815396, -75.5748578478459, 505, 233.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.14904863058648, -73.13468365866615, 558, 292.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.55268182176747, -74.09457411403845, 51, 17.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.1448063015300365, -73.64374994059658, 199, 81.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.628464444859768, -74.0642961859758, 30, 10.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.716517085893189, -72.92556490829342, 217, 172.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.140610304736505, -73.6371507716327, 195, 81.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.703851089887817, -74.02986652630322, 24, 8.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.590470955897048, -75.01753906554808, 485, 232.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.695803118796537, -74.03126236811453, 27, 8.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.438571704025374, -75.19980348835635, 224, 124.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.262664587034767, -75.56560692494656, 502, 236.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.296626982346849, -74.79827393464505, 171, 88.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.428477542352105, -75.70296787055099, 510, 193.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.083786615485008, -76.19045328382761, 451, 240.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.97265356130759, -74.57782846189266, 273, 149.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.072752947086473, -73.11015799172242, 544, 285.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.688444734184593, -74.05187997080502, 19, 6.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.252429230221559, -75.56340068985605, 502, 235.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.696599111926684, -74.0755832327179, 14, 3.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.441795240749036, -75.24176954557169, 225, 128.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.544850577005966, -75.66150942255632, 358, 172.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.016202457050314, -74.00384034464943, 67, 36.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.552798357807002, -73.13467223740737, 391, 231.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.239036958943368, -75.58787304427861, 506, 236.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.55379960915319, -75.82315634392022, 559, 279.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.2455889729430645, -75.61409043745469, 514, 238.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.069962305436829, -73.11504842945598, 541, 284.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.440379430310564, -75.18579262639979, 221, 122.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.827118175857049, -75.73466619198886, 410, 180.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.145135021452405, -73.63546935449075, 198, 81.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.04337842658972, -75.4276711314434, 491, 208.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.14070730900199, -75.3775172255897, 463, 212.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.72469182241783, -72.9240704549527, 216, 173.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.059100468040345, -75.487096603177, 412, 157.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.81436783419481, -75.71911397056707, 403, 178.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.466746757541894, -73.26392809897133, 361, 216.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.143249373265375, -73.6429095792248, 198, 81.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.711556752847948, -74.02981032471102, 25, 8.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.519396164446258, -73.35814739089614, 145, 122.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.6059614743385255, -74.08289904981226, 29, 11.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.806793645742162, -75.68091334414372, 402, 174.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.43606317550154, -75.20467167262206, 222, 125.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.6398015058636535, -74.06666611649929, 24, 8.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.70220917848447, -72.7294593322646, 431, 269.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.68460811507536, -74.05699970633655, 16, 6.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.151903594542589, -74.87869085255952, 181, 105.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.747951369480355, -74.03629379979768, 33, 9.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.111433742252224, -73.11001572483768, 543, 289.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.585391853068709, -74.21979452851143, 52, 18.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.239248877078907, -75.59491146526634, 506, 236.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.5932314879917, -74.08860809031177, 35, 12.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.569644816440005, -73.33675852423836, 155, 128.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.187845664428742, -75.57886515446782, 509, 231.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.409757352047175, -75.48560202396766, 538, 171.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.061573448497247, -73.1145911853108, 538, 283.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.215288552445342, -75.57699221885478, 503, 233.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.544043680970043, -75.66157140260101, 357, 172.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.115512961775174, -73.1070391304439, 547, 289.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.375254362417903, -75.11680955506604, 205, 117.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.964806467372122, -73.91075596, 62, 36.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.989547285539411, -73.04805011346485, 526, 279.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.726830409785917, -75.48449582189878, 289, 187.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.664277509167347, -74.08069739172724, 16, 5.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.250735793510452, -75.55933969694411, 505, 234.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.671878955766082, -74.0551427023997, 19, 7.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.4523723275113123, -76.49387199146462, 533, 299.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.1154010153317975, -73.1185440258165, 546, 289.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.4535554073119625, -74.67505500725518, 236, 103.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.5363974414619648, -76.298105520147, 517, 275.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.732806289538411, -74.08896457786379, 15, 3.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.169941512201537, -75.61129763020115, 516, 232.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.538520985223959, -75.66830247826785, 356, 173.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.083147969171344, -76.18638702521596, 449, 240.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.856313949142596, -74.03049273464286, 45, 18.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.824137586077557, -75.67992977564725, 408, 174.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.058470441833496, -73.85075022837326, 442, 263.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.3487542254486495, -72.39150595551668, 401, 203.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.694821702358422, -74.03386783927365, 21, 8.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.081705037204574, -76.18810663171129, 450, 240.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.144191889209991, -73.63910797916533, 198, 81.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.234056988560798, -75.5731264217, 503, 234.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.699547833960588, -74.03244034135732, 22, 8.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.304662315718689, -73.81387392237731, 115, 74.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.269291572231827, -75.92861589946583, 417, 207.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.086962460742646, -75.63444849825007, 529, 228.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.066029855266994, -75.50643462351162, 419, 159.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.808824633188668, -75.68661069543123, 401, 175.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.634963646193039, -74.07764157019083, 21, 8.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.336169248257587, -74.36648795354124, 111, 50.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.182452709273006, -75.56458513049525, 507, 229.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.262664622282357, -75.56560763653907, 502, 236.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.814854035339171, -73.03084155847718, 192, 171.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.248921513187596, -75.56448054020044, 504, 235.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.683063321707407, -74.05894772672856, 19, 6.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.859137782543064, -74.91700131372991, 224, 91.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.634211624880233, -74.07088708227077, 26, 9.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.906711841122428, -76.29220111590968, 473, 257.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.692242901810987, -74.0558224683915, 18, 6.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.067911527803675, -73.86129685440564, 449, 263.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.85815981939269, -74.06035557374979, 45, 17.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.117181335326224, -73.1101184013692, 547, 289.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.261685552463122, -75.56151168302485, 504, 236.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.695657749101086, -74.0330267997836, 23, 8.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.07314911513701, -73.11040024832236, 541, 285.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.826837034490856, -73.03308202169862, 198, 172.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.724097272859434, -72.92516047663935, 215, 173.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.343806568025213, -72.39333951684215, 400, 202.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.198919435871809, -75.56160865895626, 503, 230.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.258715094815948, -75.59118702828081, 505, 238.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.667713546606596, -74.05821946136808, 17, 7.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.816124756112588, -75.69568472060982, 402, 176.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.856509125138024, -74.06255632904957, 44, 17.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.332825178390964, -72.68544202625188, 331, 239.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.706503833820006, -74.04896688246171, 24, 6.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.6681722988700445, -74.05744000852908, 17, 7.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.698267419648344, -74.073075391367, 16, 4.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.06409428569463, -75.49856950369147, 416, 158.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.121260790240512, -73.11910346114853, 549, 289.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.648774301848993, -74.09553561603367, 18, 6.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 2.933039019027149, -75.28678886579837, 313, 236.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.606830391179642, -74.21754793955, 53, 16.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.636050248617544, -74.0738095821962, 24, 8.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.545222305238224, -75.6607542294554, 358, 172.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.547286287132974, -75.66215641958136, 360, 173.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.245828870928576, -75.5837323486538, 502, 236.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.128043298301729, -73.11402678432134, 554, 290.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.341632319105894, -72.40751299360149, 396, 201.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.4451591883036805, -75.2393580654277, 227, 128.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.5470808931969287, -73.6969222782707, 284, 136.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.80635528176181, -74.3498904025329, 55, 28.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.175370204979727, -75.58477773761749, 515, 230.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.621601987584569, -74.07037866514302, 26, 10.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 2.929708748197588, -75.28564368138892, 313, 236.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.741412047036608, -74.03451508737604, 33, 9.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.053560179496941, -75.48614205694084, 410, 157.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.190315172829236, -74.892602302376, 236, 102.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.199214416853246, -74.75141752421972, 209, 89.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.203155377602498, -75.57639711635746, 505, 232.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.818031256341327, -75.69881051093883, 404, 176.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.899929151241664, -76.30954715474793, 473, 259.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.554838472250853, -73.13412043763671, 394, 232.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.117648187467569, -73.10883100131653, 546, 289.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.587944782855312, -74.08454612585771, 38, 13.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.11667736216081, -73.11614370486467, 547, 289.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.111811135085474, -73.10944207023199, 546, 289.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.540210801930236, -76.29750888373307, 516, 275.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.7114770279653575, -74.03013559347686, 25, 8.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.547083450505866, -75.66290819501393, 359, 173.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.447520964848531, -76.49876280111435, 536, 299.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.607992588381057, -74.08046409656349, 29, 11.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.806090982447353, -75.68660393118031, 400, 175.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.250225082640299, -75.56186027777261, 504, 235.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.4120955707337774, -75.17247600830773, 217, 122.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.630446235347357, -74.13076230024579, 26, 8.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.147848366224331, -73.63931570323442, 199, 81.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.804742004603501, -75.69023647949913, 398, 175.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.582387927255063, -74.20044533434208, 51, 17.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.627059446119183, -74.06922755095722, 25, 9.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.646616972443036, -74.06754190740598, 22, 8.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.443140828259608, -75.24150290259804, 227, 128.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.246125877425413, -75.56652839887359, 502, 235.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.433408613861449, -75.21950652256278, 225, 126.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.07425836774148, -73.11001516382542, 542, 285.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.148347238433793, -73.63812499884176, 197, 81.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.450751115643527, -74.66303999929907, 237, 102.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.2665456922934535, -75.56441901980929, 502, 236.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.165927324015932, -75.60063176456407, 515, 231.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.587462743354136, -74.08371599169818, 38, 13.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.817723886800714, -73.64111126879179, 156, 53.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.669998542374641, -74.05872983488439, 17, 6.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.720093798003992, -74.04648097535063, 23, 7.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.544886743428225, -75.66062417267933, 357, 172.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.276832786492548, -75.58197126841301, 503, 238.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.060501105844701, -73.85411843375279, 444, 263.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.581446036671879, -76.49211173752738, 526, 292.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.240590992661879, -75.57942385752102, 504, 235.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.698921738486702, -74.03857687779292, 26, 7.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.1698655191537455, -75.61293070967672, 517, 232.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.845967999326102, -76.00934724666293, 585, 245.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.583708067866765, -74.10506147080226, 40, 13.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.293636834730153, -74.80831622758103, 176, 90.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.668720818547481, -74.0568049617321, 19, 7.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.543940677699163, -73.35963211900868, 154, 124.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.815790551641994, -75.69502544356473, 404, 176.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.920873207964668, -75.05795597622735, 255, 107.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.810106648759004, -73.02968479769682, 192, 171.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.39003020123944, -76.07223183214506, 425, 220.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.171531679370999, -75.61323271557029, 517, 232.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.264859131802446, -75.56513154731599, 504, 236.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.670791475842875, -74.05805653142637, 18, 6.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.677125932482472, -74.05982115914789, 16, 6.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.430547212828513, -75.1998356215891, 219, 124.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.760211937808062, -75.91769424375231, 431, 200.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.250040042541063, -75.56324838688532, 505, 235.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.696366327777668, -74.03219228774293, 22, 8.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 2.93354680824614, -75.24777521938873, 324, 234.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.2247323393771, -75.57472653079203, 504, 234.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.436941429740907, -75.20302557746328, 222, 124.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.705330402136046, -74.03185474135735, 23, 8.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.551447691465368, -73.3459988987755, 152, 126.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.556146759628807, -75.6567642788959, 361, 172.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.807083532675607, -75.6813944681382, 401, 174.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.867005740079229, -73.57548469284822, 224, 141.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.697191883095981, -74.03985830853621, 25, 7.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.801674549750414, -75.68643755296132, 398, 175.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.541040084826642, -76.29715010427459, 515, 275.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.166790072452807, -75.57991395059874, 517, 229.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.268146902983646, -75.55880177540507, 504, 236.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.621702291854586, -74.07131325605974, 25, 10.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.15232530954044, -74.87894896111915, 181, 105.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.209352348721864, -75.5691372366181, 501, 232.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.015643915823461, -73.67397298753647, 265, 153.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.623276238030671, -74.06996389022076, 27, 10.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.255919136466036, -75.5633838490626, 504, 235.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.9057067402869015, -76.29805387783745, 472, 258.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.240621940956888, -75.59215703661721, 506, 236.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.76121742523095, -74.09279609153855, 24, 6.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.812882197284504, -75.76566375502401, 397, 183.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.66288147136409, -74.0597225413573, 20, 7.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.677687053419595, -74.05725897279952, 19, 6.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.7216268713601455, -74.04713888949965, 25, 7.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 2.925163649083877, -75.28641019017091, 313, 237.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.144664793356877, -73.6416306720323, 199, 81.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.874790044847957, -74.03663300583376, 47, 20.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.229037754507554, -75.56906210189958, 502, 233.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.7499782678533125, -74.06557082923554, 27, 6.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.020571002814866, -73.99840632951783, 68, 36.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.006797808668356, -74.47037745361445, 102, 52.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.9839573117486, -75.61010387421261, 441, 169.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.342512112689748, -72.38951509031787, 400, 203.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.062785608992201, -75.49777100988332, 417, 158.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.391646558306562, -76.07414140622917, 426, 220.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.0574259899262834, -75.52990347737935, 417, 162.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.058534889811466, -73.85627905164773, 445, 262.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.14602941353705, -73.6829682367289, 91, 67.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.277077365105349, -75.57981446722712, 502, 238.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.035968295929141, -75.46934968659556, 402, 155.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.957047281945735, -75.41404198859608, 602, 288.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.695101767331468, -74.0361860034745, 24, 8.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.228877078651102, -75.57449914379896, 505, 234.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.697778714574997, -74.05097658705961, 21, 6.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.686486774082736, -74.04483128811002, 18, 7.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.528957817044841, -76.3012638562301, 519, 276.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.570862077311099, -74.10720036924138, 46, 15.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.212338962953221, -75.57606462080716, 503, 233.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.148330425548087, -75.62169143981981, 520, 231.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.544629395283769, -75.66274868961301, 360, 173.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.807106195492069, -75.68987882478265, 398, 175.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.144465938767297, -73.63681391341032, 197, 81.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.060620928679347, -75.49172147738162, 414, 158.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.827564407826667, -73.03607008328949, 198, 172.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.083715807221048, -75.52602470674671, 425, 162.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.543827868898156, -73.35768623868552, 152, 124.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.1816550965589485, -75.58046049982073, 512, 231.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 2.93604796895587, -75.28941796624622, 311, 236.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.576725390133819, -74.09120722887337, 40, 14.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.691560901289351, -74.04861332601517, 21, 6.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.451827603722345, -74.66204757151326, 236, 102.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.346510840541617, -72.39586207956954, 400, 202.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.672054538171513, -74.13683819123395, 19, 4.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.712155609265651, -74.21291775978908, 31, 11.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.679811934359848, -74.06481140025285, 16, 5.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.066221878399396, -73.86300314267231, 450, 263.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.132094686227901, -75.39607365481521, 470, 213.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.424915421627889, -75.17640597256478, 218, 122.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.091637297388592, -76.18819741515246, 451, 240.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.735301370055316, -74.25970960275433, 48, 16.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.326931191715864, -72.38818014169568, 399, 202.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.2509324089499465, -75.56425545461593, 504, 235.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.629489513192148, -74.13574666109238, 24, 9.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.03544193373487, -75.46828872364509, 402, 154.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.8566565834421698, -74.93439990018517, 224, 131.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.433238543886525, -75.21017268019192, 223, 125.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.256915299127405, -75.56552125570319, 504, 235.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.126085678332449, -73.11808662770163, 548, 290.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.703668901408699, -74.22802587262129, 35, 13.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.339028454629744, -75.54153378388999, 498, 240.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.2232491805788674, -75.57488273243887, 505, 233.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.602991744957953, -74.08673210063722, 31, 11.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.239883669644668, -75.57902098716264, 503, 235.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 3.530612438094217, -76.3048292989773, 515, 276.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.143006053568595, -73.63991937949662, 197, 81.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.209688878250489, -75.57324458373296, 503, 232.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.206468590559931, -75.57013154976663, 505, 232.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.817450089402223, -75.69768318707446, 404, 176.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.34843075291234, -72.39109612890122, 401, 203.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.144312746253328, -73.63501099558127, 199, 81.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.45163749812887, -74.66306446297159, 237, 103.02, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 2.9321403288008034, -75.28119405007203, 315, 236.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.63677661886124, -74.06505785147387, 27, 9.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.062962905741833, -75.50092978050142, 415, 159.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.679119486879289, -74.04668013644728, 21, 7.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.110784954875528, -73.1110530100441, 544, 289.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.713510638256742, -72.93111536811632, 216, 171.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.333364599102096, -74.37094312063512, 110, 50.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.819573395709, -74.35756868602301, 56, 30.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.450818931768424, -74.66409760290912, 237, 103.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.307011886997111, -73.81596443286014, 117, 74.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.751603419313227, -75.90359069831736, 425, 198.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.182100253692157, -75.57998873926789, 512, 231.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.803489669258103, -75.68430130350818, 399, 174.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.239047182685356, -75.59939137807866, 508, 237.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.070776745885852, -74.60158753464276, 161, 67.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.8088902120775225, -75.68708657968855, 400, 175.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.749874524351586, -75.90936941182207, 426, 199.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.555010271030024, -73.3508360772187, 150, 126.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 5.1992399147700965, -74.75084414834289, 209, 89.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.686565397478874, -74.06059060182486, 19, 5.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.581903784721273, -74.21285346668061, 52, 18.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.142268817437598, -73.64029695970503, 198, 81.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 7.070787873329211, -73.1131064300106, 543, 285.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.296665623883847, -74.80343867014477, 172, 89.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.281196734519334, -75.61280101015168, 514, 241.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.229164316646731, -75.59827735779197, 511, 236.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.178735755814528, -75.58373186925999, 514, 231.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.255389163710516, -75.55624920406696, 506, 235.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.193934759283139, -75.55736155291557, 505, 230.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.232845530012286, -75.58434310291331, 507, 235.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.206828073910518, -75.57124309846765, 504, 232.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.191537199908636, -75.5799238444711, 509, 231.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.140091467622188, -75.37888341078576, 463, 212.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.214012744137268, -75.5946677108424, 511, 234.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.488707707033675, -74.40424341911705, 353, 200.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 6.160166529862376, -75.60508211631037, 515, 231.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.706486734767949, -74.05090403083918, 24, 6.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.634125692982733, -74.11254877372549, 25, 8.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.70691276552089, -74.05198997080508, 23, 6.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.70456541913689, -74.0504919291778, 21, 6.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.648190895677362, -74.10622197080231, 22, 6.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.642493103460875, -74.06875977080995, 23, 8.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.6276282037710414, -74.1449911413587, 25, 9.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.592807598432202, -74.08996216363073, 34, 12.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.576725390133819, -74.09120722887337, 6, 0.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.570862077311099, -74.10720036924138, 12, 2.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.583708067866765, -74.10506147080226, 12, 2.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.591492872737771, -74.09232595286191, 14, 2.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.592807598432202, -74.08996216363073, 15, 2.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.5932314879917, -74.08860809031177, 18, 2.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.595580550757874, -74.17315277116823, 18, 2.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.602991744957953, -74.08673210063722, 17, 3.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.6059614743385255, -74.08289904981226, 19, 4.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.607992588381057, -74.08046409656349, 20, 4.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.571719789112955, -74.12867513035278, 20, 4.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.634125692982733, -74.11254877372549, 20, 5.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.753542117244553, -74.0919445837163, 19, 5.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.559514676580857, -74.13830035356666, 24, 5.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.671682507396267, -74.146343723427, 23, 5.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.665136315274092, -74.07893605007945, 15, 5.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.571719789112955, -74.12867513035278, 19, 5.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.663672497013976, -74.07987710908219, 15, 5.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.635115274801236, -74.20607237056706, 25, 5.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.623334508148629, -74.08270645731737, 26, 5.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.621702291854586, -74.07131325605974, 24, 6.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.621601987584569, -74.07037866514302, 24, 6.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.652630575006434, -74.10172733130143, 20, 6.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.582387927255063, -74.20044533434208, 23, 6.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.623276238030671, -74.06996389022076, 27, 6.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.671682507396267, -74.146343723427, 27, 6.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.623546083734686, -74.06959885946479, 26, 6.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.682677508315564, -74.05836949820933, 19, 6.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.686214969329195, -74.0567466582241, 17, 6.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.681162219812539, -74.05749309377944, 18, 6.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.672054538171513, -74.13683819123395, 26, 6.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.648190895677362, -74.10622197080231, 23, 6.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.679203904008197, -74.05717473918122, 19, 6.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.559514676580857, -74.13830035356666, 20, 6.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.627059446119183, -74.06922755095722, 27, 6.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.583708067866765, -74.10506147080226, 27, 6.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.606830391179642, -74.21754793955, 25, 6.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.628464444859768, -74.0642961859758, 26, 6.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.704093560003992, -74.04490194640884, 22, 7.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.703952553243483, -74.04423288583504, 22, 7.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.652630575006434, -74.10172733130143, 23, 7.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.634963646193039, -74.07764157019083, 28, 7.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.581903784721273, -74.21285346668061, 24, 7.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.634211624880233, -74.07088708227077, 29, 7.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.570862077311099, -74.10720036924138, 31, 7.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.636050248617544, -74.0738095821962, 30, 7.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.651595014209306, -74.14898257955721, 21, 7.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.634125692982733, -74.11254877372549, 29, 7.58, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.591492872737771, -74.09232595286191, 31, 7.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.648774301848993, -74.09553561603367, 25, 7.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.592807598432202, -74.08996216363073, 29, 7.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.635511182922544, -74.06222077819245, 29, 7.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.63677661886124, -74.06505785147387, 32, 7.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.585391853068709, -74.21979452851143, 24, 7.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.602991744957953, -74.08673210063722, 27, 7.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.668673932964532, -74.10775255487931, 21, 7.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.5932314879917, -74.08860809031177, 30, 7.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.638794194168213, -74.06811025185188, 33, 7.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.6398015058636535, -74.06666611649929, 32, 8.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.652268002379629, -74.06095451577245, 23, 8.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.630446235347357, -74.13076230024579, 32, 8.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.623334508148629, -74.08270645731737, 24, 8.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.6059614743385255, -74.08289904981226, 25, 8.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.642493103460875, -74.06875977080995, 32, 8.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.629489513192148, -74.13574666109238, 31, 8.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.607992588381057, -74.08046409656349, 25, 8.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.576725390133819, -74.09120722887337, 32, 8.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.587944782855312, -74.08454612585771, 33, 8.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.587462743354136, -74.08371599169818, 33, 8.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.648774301848993, -74.09553561603367, 30, 8.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.646616972443036, -74.06754190740598, 33, 8.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.616540119066279, -74.15332009038653, 33, 8.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.638794194168213, -74.06811025185188, 24, 8.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.648190895677362, -74.10622197080231, 37, 8.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.6276282037710414, -74.1449911413587, 32, 8.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.634963646193039, -74.07764157019083, 25, 8.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.652630575006434, -74.10172733130143, 31, 9.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.623887607387683, -74.15362927793012, 36, 9.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.636050248617544, -74.0738095821962, 30, 9.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.621702291854586, -74.07131325605974, 27, 9.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.621601987584569, -74.07037866514302, 27, 9.53, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.569752102622589, -74.08350650001482, 34, 9.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.623276238030671, -74.06996389022076, 29, 9.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.652268002379629, -74.06095451577245, 36, 9.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.623546083734686, -74.06959885946479, 28, 9.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.634211624880233, -74.07088708227077, 31, 9.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.627059446119183, -74.06922755095722, 29, 9.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.623334508148629, -74.08270645731737, 25, 9.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.595580550757874, -74.17315277116823, 34, 9.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.55268182176747, -74.09457411403845, 40, 9.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.664277509167347, -74.08069739172724, 31, 9.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.663672497013976, -74.07987710908219, 31, 9.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.638794194168213, -74.06811025185188, 33, 10.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.642493103460875, -74.06875977080995, 32, 10.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.665136315274092, -74.07893605007945, 32, 10.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.6398015058636535, -74.06666611649929, 32, 10.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.628464444859768, -74.0642961859758, 31, 10.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.623546083734686, -74.06959885946479, 26, 10.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.63677661886124, -74.06505785147387, 35, 10.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.742868427155099, -74.02301168124903, 35, 10.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.646616972443036, -74.06754190740598, 32, 10.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.663672497013976, -74.07987710908219, 36, 10.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.623887607387683, -74.15362927793012, 28, 10.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.664277509167347, -74.08069739172724, 36, 10.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.615206288069383, -74.17244620622692, 34, 10.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.665136315274092, -74.07893605007945, 37, 10.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.692296265865653, -74.0980832655579, 31, 10.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.635511182922544, -74.06222077819245, 35, 10.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.66288147136409, -74.0597225413573, 41, 10.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.668673932964532, -74.10775255487931, 34, 11.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.616540119066279, -74.15332009038653, 32, 11.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.651595014209306, -74.14898257955721, 41, 11.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.652268002379629, -74.06095451577245, 36, 11.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.667713546606596, -74.05821946136808, 42, 11.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.6681722988700445, -74.05744000852908, 41, 11.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.668720818547481, -74.0568049617321, 45, 11.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.669998542374641, -74.05872983488439, 41, 11.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.670791475842875, -74.05805653142637, 43, 11.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.710961913786103, -74.10972923393435, 38, 11.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.671878955766082, -74.0551427023997, 44, 11.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.66288147136409, -74.0597225413573, 40, 11.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.667713546606596, -74.05821946136808, 40, 12.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.677125932482472, -74.05982115914789, 38, 12.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.669998542374641, -74.05872983488439, 40, 12.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.679811934359848, -74.06481140025285, 37, 12.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.712155609265651, -74.21291775978908, 46, 12.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.6681722988700445, -74.05744000852908, 40, 12.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.615206288069383, -74.17244620622692, 35, 12.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.677687053419595, -74.05725897279952, 40, 12.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.679811934359848, -74.06481140025285, 39, 12.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.670791475842875, -74.05805653142637, 42, 12.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.668720818547481, -74.0568049617321, 42, 12.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.582387927255063, -74.20044533434208, 40, 12.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.672054538171513, -74.13683819123395, 41, 12.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.703668901408699, -74.22802587262129, 43, 12.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.679203904008197, -74.05717473918122, 40, 12.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.696599111926684, -74.0755832327179, 32, 12.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.677125932482472, -74.05982115914789, 36, 12.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.681162219812539, -74.05749309377944, 40, 12.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.671878955766082, -74.0551427023997, 42, 12.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.677687053419595, -74.05725897279952, 38, 12.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.682677508315564, -74.05836949820933, 42, 12.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.679119486879289, -74.04668013644728, 42, 12.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.683063321707407, -74.05894772672856, 42, 12.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.698267419648344, -74.073075391367, 34, 12.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.671682507396267, -74.146343723427, 43, 12.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.682832968516384, -74.0571619852809, 39, 12.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.591492872737771, -74.09232595286191, 37, 12.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.679203904008197, -74.05717473918122, 38, 13.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.683063321707407, -74.05894772672856, 41, 13.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.681162219812539, -74.05749309377944, 38, 13.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.682677508315564, -74.05836949820933, 41, 13.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.686565397478874, -74.06059060182486, 41, 13.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.68460811507536, -74.05699970633655, 38, 13.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.684992538249309, -74.05647242070954, 42, 13.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.682832968516384, -74.0571619852809, 37, 13.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.686565397478874, -74.06059060182486, 43, 13.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.686214969329195, -74.0567466582241, 39, 13.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.68460811507536, -74.05699970633655, 36, 13.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.635115274801236, -74.20607237056706, 42, 13.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.684992538249309, -74.05647242070954, 40, 13.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.686214969329195, -74.0567466582241, 37, 13.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.692296265865653, -74.0980832655579, 45, 13.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.688444734184593, -74.05187997080502, 41, 13.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.686486774082736, -74.04483128811002, 39, 13.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.581903784721273, -74.21285346668061, 41, 13.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.692242901810987, -74.0558224683915, 38, 13.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.679119486879289, -74.04668013644728, 41, 14.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.692242901810987, -74.0558224683915, 40, 14.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.688444734184593, -74.05187997080502, 39, 14.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.696599111926684, -74.0755832327179, 46, 14.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.691560901289351, -74.04861332601517, 42, 14.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.595580550757874, -74.17315277116823, 46, 14.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.698267419648344, -74.073075391367, 49, 14.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.691560901289351, -74.04861332601517, 41, 14.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.686486774082736, -74.04483128811002, 38, 14.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.585391853068709, -74.21979452851143, 41, 14.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.697778714574997, -74.05097658705961, 43, 14.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.697778714574997, -74.05097658705961, 40, 14.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.606830391179642, -74.21754793955, 42, 14.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.635115274801236, -74.20607237056706, 45, 14.90, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.732806289538411, -74.08896457786379, 43, 14.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.695101767331468, -74.0361860034745, 46, 15.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.697191883095981, -74.03985830853621, 46, 15.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.694821702358422, -74.03386783927365, 42, 15.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.571719789112955, -74.12867513035278, 41, 15.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.695657749101086, -74.0330267997836, 44, 15.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.70456541913689, -74.0504919291778, 39, 15.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.695803118796537, -74.03126236811453, 46, 15.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.70691276552089, -74.05198997080508, 42, 15.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.698921738486702, -74.03857687779292, 48, 15.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.696366327777668, -74.03219228774293, 44, 15.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.706486734767949, -74.05090403083918, 42, 15.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.70456541913689, -74.0504919291778, 44, 15.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.569752102622589, -74.08350650001482, 46, 15.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.706503833820006, -74.04896688246171, 43, 15.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.704093560003992, -74.04490194640884, 45, 15.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.703952553243483, -74.04423288583504, 45, 15.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.699547833960588, -74.03244034135732, 44, 15.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.706486734767949, -74.05090403083918, 48, 15.70, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.70691276552089, -74.05198997080508, 46, 15.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.697191883095981, -74.03985830853621, 46, 15.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.704093560003992, -74.04490194640884, 40, 15.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.706503833820006, -74.04896688246171, 47, 15.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.703952553243483, -74.04423288583504, 44, 15.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.704414702155407, -74.0410900002528, 50, 15.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.710961913786103, -74.10972923393435, 52, 15.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.695101767331468, -74.0361860034745, 44, 15.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.698921738486702, -74.03857687779292, 46, 15.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.704414702155407, -74.0410900002528, 48, 16.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.694821702358422, -74.03386783927365, 40, 16.12, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.703419656527395, -74.02930098036175, 46, 16.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.703851089887817, -74.02986652630322, 46, 16.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.695657749101086, -74.0330267997836, 43, 16.25, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.705330402136046, -74.03185474135735, 45, 16.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.696366327777668, -74.03219228774293, 42, 16.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.695803118796537, -74.03126236811453, 46, 16.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.699547833960588, -74.03244034135732, 42, 16.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.559514676580857, -74.13830035356666, 41, 16.72, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.720093798003992, -74.04648097535063, 43, 16.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.710636981918698, -74.03229634336445, 46, 16.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.7216268713601455, -74.04713888949965, 45, 16.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.753542117244553, -74.0919445837163, 47, 16.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.705330402136046, -74.03185474135735, 43, 16.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.7114770279653575, -74.03013559347686, 47, 16.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.711556752847948, -74.02981032471102, 47, 16.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.703851089887817, -74.02986652630322, 44, 17.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.703419656527395, -74.02930098036175, 44, 17.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.710636981918698, -74.03229634336445, 44, 17.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.720093798003992, -74.04648097535063, 46, 17.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.7216268713601455, -74.04713888949965, 47, 17.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.735301370055316, -74.25970960275433, 54, 17.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.7114770279653575, -74.03013559347686, 45, 17.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.729950583606929, -74.04631249290854, 44, 17.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.711556752847948, -74.02981032471102, 45, 17.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.76121742523095, -74.09279609153855, 52, 17.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.7499782678533125, -74.06557082923554, 52, 17.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.732806289538411, -74.08896457786379, 55, 18.06, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.729950583606929, -74.04631249290854, 47, 18.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.741412047036608, -74.03451508737604, 52, 19.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.747951369480355, -74.03629379979768, 53, 19.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.741412047036608, -74.03451508737604, 55, 19.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.7499782678533125, -74.06557082923554, 58, 20.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.753542117244553, -74.0919445837163, 58, 20.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.742868427155099, -74.02301168124903, 55, 20.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.742868427155099, -74.02301168124903, 57, 20.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.747951369480355, -74.03629379979768, 55, 20.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.712155609265651, -74.21291775978908, 61, 20.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.76121742523095, -74.09279609153855, 63, 21.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.703668901408699, -74.22802587262129, 58, 21.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.405993675648094, -73.94911449516907, 79, 23.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.735301370055316, -74.25970960275433, 69, 26.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.856509125138024, -74.06255632904957, 79, 28.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.85815981939269, -74.06035557374979, 80, 28.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.856313949142596, -74.03049273464286, 63, 30.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.80635528176181, -74.3498904025329, 70, 30.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.874790044847957, -74.03663300583376, 65, 31.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.819573395709, -74.35756868602301, 74, 31.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.856509125138024, -74.06255632904957, 81, 31.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.85815981939269, -74.06035557374979, 81, 32.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.856313949142596, -74.03049273464286, 67, 32.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.405993675648094, -73.94911449516907, 86, 32.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.874790044847957, -74.03663300583376, 69, 34.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.915446839579079, -74.02548280112961, 74, 36.27, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.336169248257587, -74.36648795354124, 83, 38.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.915446839579079, -74.02548280112961, 76, 39.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.80635528176181, -74.3498904025329, 85, 39.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.333364599102096, -74.37094312063512, 82, 39.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.336169248257587, -74.36648795354124, 100, 40.35, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.819573395709, -74.35756868602301, 89, 40.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.333364599102096, -74.37094312063512, 99, 40.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.766125742650726, -73.01136650115583, 59, 42.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.771094987542703, -73.00957872412717, 57, 42.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.964806467372122, -73.91075596, 82, 47.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.016202457050314, -74.00384034464943, 86, 47.55, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.272561477, -74.41677569, 111, 47.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.964806467372122, -73.91075596, 84, 48.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.020571002814866, -73.99840632951783, 86, 48.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.034394333868445, -73.23102398223246, 67, 48.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.272561477, -74.41677569, 128, 49.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.02381645673148, -73.2393653929536, 69, 49.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.016202457050314, -74.00384034464943, 89, 50.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.020571002814866, -73.99840632951783, 89, 51.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.006797808668356, -74.47037745361445, 134, 55.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.817723886800714, -73.64111126879179, 164, 56.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.130649273498971, -74.16030421683267, 150, 57.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.817723886800714, -73.64111126879179, 174, 61.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.130649273498971, -74.16030421683267, 153, 62.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.887750833750966, -72.85486343283462, 79, 63.63, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.006797808668356, -74.47037745361445, 147, 64.39, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.156459201191459, -73.63718289107166, 173, 67.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.1448063015300365, -73.64374994059658, 171, 68.33, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.147848366224331, -73.63931570323442, 170, 68.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.144664793356877, -73.6416306720323, 171, 68.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.148347238433793, -73.63812499884176, 169, 68.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.143249373265375, -73.6429095792248, 170, 68.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.144691127830611, -73.63939016931985, 169, 68.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.144191889209991, -73.63910797916533, 169, 68.75, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.143006053568595, -73.63991937949662, 169, 68.78, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.142268817437598, -73.64029695970503, 169, 68.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.144465938767297, -73.63681391341032, 169, 68.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.145135021452405, -73.63546935449075, 169, 68.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.144312746253328, -73.63501099558127, 170, 69.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.140610304736505, -73.6371507716327, 166, 69.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.070776745885852, -74.60158753464276, 193, 70.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.156459201191459, -73.63718289107166, 180, 76.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.1448063015300365, -73.64374994059658, 178, 77.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.147848366224331, -73.63931570323442, 177, 77.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.144664793356877, -73.6416306720323, 178, 77.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.143249373265375, -73.6429095792248, 177, 77.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.148347238433793, -73.63812499884176, 176, 77.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.144691127830611, -73.63939016931985, 177, 77.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.144191889209991, -73.63910797916533, 176, 77.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.143006053568595, -73.63991937949662, 176, 77.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.142268817437598, -73.64029695970503, 176, 77.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.144465938767297, -73.63681391341032, 176, 77.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.145135021452405, -73.63546935449075, 176, 77.97, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.144312746253328, -73.63501099558127, 177, 78.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.140610304736505, -73.6371507716327, 173, 78.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.14602941353705, -73.6829682367289, 114, 78.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.14602941353705, -73.6829682367289, 112, 78.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.070776745885852, -74.60158753464276, 205, 79.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.296626982346849, -74.79827393464505, 143, 79.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.296665623883847, -74.80343867014477, 144, 80.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.156459201191459, -73.63718289107166, 202, 80.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.293636834730153, -74.80831622758103, 148, 80.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.7070992225391795, -74.10950060822498, 4.144691127830611, -73.63939016931985, 198, 81.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.296626982346849, -74.79827393464505, 160, 84.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.296665623883847, -74.80343867014477, 161, 84.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.304662315718689, -73.81387392237731, 135, 85.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.293636834730153, -74.80831622758103, 165, 85.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.307011886997111, -73.81596443286014, 136, 85.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.304662315718689, -73.81387392237731, 137, 87.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.307011886997111, -73.81596443286014, 139, 87.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 9.974706856790004, -73.88401171623957, 165, 88.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.859137782543064, -74.91700131372991, 238, 88.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.1992399147700965, -74.75084414834289, 245, 92.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.199214416853246, -74.75141752421972, 245, 92.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.15232530954044, -74.87894896111915, 153, 95.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.151903594542589, -74.87869085255952, 153, 95.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.859137782543064, -74.91700131372991, 253, 97.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.151903594542589, -74.87869085255952, 170, 99.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.15232530954044, -74.87894896111915, 169, 99.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.1992399147700965, -74.75084414834289, 260, 101.37, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.199214416853246, -74.75141752421972, 261, 101.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.51383857416534, -74.18236003789706, 352, 101.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.513080215357634, -74.18331054986287, 352, 101.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.520375814217918, -74.18631352658772, 354, 102.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.190315172829236, -74.892602302376, 250, 103.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.920873207964668, -75.05795597622735, 269, 105.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.450751115643527, -74.66303999929907, 273, 108.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.451827603722345, -74.66204757151326, 272, 108.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.450818931768424, -74.66409760290912, 273, 108.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.45163749812887, -74.66306446297159, 273, 108.52, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.4535554073119625, -74.67505500725518, 268, 109.40, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.375254362417903, -75.11680955506604, 177, 109.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.190315172829236, -74.892602302376, 265, 112.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.920873207964668, -75.05795597622735, 284, 114.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.4120955707337774, -75.17247600830773, 189, 114.92, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.424915421627889, -75.17640597256478, 190, 115.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.440379430310564, -75.18579262639979, 192, 115.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.375254362417903, -75.11680955506604, 194, 116.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.450751115643527, -74.66303999929907, 288, 116.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.451827603722345, -74.66204757151326, 288, 116.81, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.450818931768424, -74.66409760290912, 288, 116.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.45163749812887, -74.66306446297159, 288, 116.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.438571704025374, -75.19980348835635, 196, 117.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.430546544280079, -75.19983495103688, 191, 117.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.430547212828513, -75.1998356215891, 191, 117.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.436941429740907, -75.20302557746328, 194, 117.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.4535554073119625, -74.67505500725518, 281, 117.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.43606317550154, -75.20467167262206, 194, 117.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.433238543886525, -75.21017268019192, 195, 118.59, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.437434942637705, -75.21989550957662, 199, 119.57, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.433408613861449, -75.21950652256278, 197, 119.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 3.8566565834421698, -74.93439990018517, 196, 120.76, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.4120955707337774, -75.17247600830773, 206, 121.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.4451591883036805, -75.2393580654277, 199, 121.56, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.424915421627889, -75.17640597256478, 207, 121.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 3.5470808931969287, -73.6969222782707, 256, 121.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.443140828259608, -75.24150290259804, 198, 121.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.441795240749036, -75.24176954557169, 197, 121.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.440379430310564, -75.18579262639979, 209, 122.50, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 3.8566565834421698, -74.93439990018517, 213, 122.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.004559420467931, -74.24398851743851, 354, 123.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.006773299080791, -74.24587280331558, 354, 123.68, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.438571704025374, -75.19980348835635, 212, 124.07, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.015036247181252, -74.24590639202314, 356, 124.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.430546544280079, -75.19983495103688, 207, 124.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.430547212828513, -75.1998356215891, 207, 124.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.011500052468406, -74.25027660345583, 357, 124.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.009276795140783, -74.25211573685867, 357, 124.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.436941429740907, -75.20302557746328, 210, 124.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.43606317550154, -75.20467167262206, 211, 124.64, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.54310523, -72.91138675, 194, 124.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.542767771478212, -72.90936434616454, 193, 124.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.544792752832713, -72.91221974838221, 195, 125.10, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.546155428735409, -72.9134959309382, 195, 125.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.546911030626, -72.91571186723444, 196, 125.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.546719830596802, -72.9136377337463, 195, 125.26, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.433238543886525, -75.21017268019192, 212, 125.28, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.54586071237626, -72.90950921945657, 194, 125.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.54663974295849, -72.91140248788066, 194, 125.32, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.195493743750158, -73.14269592674758, 326, 125.74, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.437434942637705, -75.21989550957662, 215, 126.30, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.433408613861449, -75.21950652256278, 214, 126.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.4451591883036805, -75.2393580654277, 216, 128.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.443140828259608, -75.24150290259804, 215, 128.60, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.441795240749036, -75.24176954557169, 214, 128.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 9.362653485071926, -73.59935451293644, 155, 128.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 3.5470808931969287, -73.6969222782707, 263, 129.36, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.195493743750158, -73.14269592674758, 324, 129.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.237965696710868, -74.18694497441662, 330, 132.89, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.519396164446258, -73.35814739089614, 167, 132.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.23572561987276, -74.19026143190118, 329, 133.01, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.241200467025372, -74.18581325919199, 328, 133.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.233125707689602, -74.19485567587951, 329, 133.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.241269105955974, -74.1899972696521, 328, 133.38, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.239323012620996, -74.19202633973426, 330, 133.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.236867956797989, -74.19475579199332, 334, 133.47, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.519396164446258, -73.35814739089614, 165, 133.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.237564632923002, -74.20043453615679, 332, 133.99, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.2375398991436, -74.20112766937876, 333, 134.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.237766142852204, -74.2013196639611, 333, 134.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.237271442422534, -74.20183517668754, 333, 134.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.238544227432085, -74.20250887561788, 334, 134.24, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.540442503611016, -73.36126107027229, 175, 134.62, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.23699785089421, -74.21078200556975, 334, 134.83, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.235182995834718, -74.21294966635416, 332, 134.88, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.543940677699163, -73.35963211900868, 175, 135.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.238483980615063, -74.213353477533, 334, 135.15, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.543827868898156, -73.35768623868552, 174, 135.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.238715360702871, -74.21329504632368, 333, 135.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.540442503611016, -73.36126107027229, 172, 135.31, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.543940677699163, -73.35963211900868, 172, 135.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.543827868898156, -73.35768623868552, 172, 135.86, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.555010271030024, -73.3508360772187, 173, 136.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.551447691465368, -73.3459988987755, 174, 136.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.555010271030024, -73.3508360772187, 170, 137.29, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.551447691465368, -73.3459988987755, 172, 137.34, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.569644816440005, -73.33675852423836, 176, 138.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.569644816440005, -73.33675852423836, 173, 139.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.38195477284434, -72.26588254825266, 182, 147.98, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.459157978485218, -74.61761306898423, 356, 149.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.378446129185525, -72.24401048102693, 181, 149.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.382590055985297, -72.24523433734284, 181, 149.67, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.380763118212595, -72.23814560600343, 182, 150.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.37720259348561, -72.23345497554617, 184, 150.22, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 11.381319613969712, -72.23452267581709, 184, 150.44, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.03544193373487, -75.46828872364509, 428, 152.66, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.035968295929141, -75.46934968659556, 428, 152.79, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.867005740079229, -73.57548469284822, 243, 153.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.867005740079229, -73.57548469284822, 246, 154.96, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.053560179496941, -75.48614205694084, 437, 155.16, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.059100468040345, -75.487096603177, 438, 155.46, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.060620928679347, -75.49172147738162, 441, 156.00, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.062785608992201, -75.49777100988332, 443, 156.71, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.06409428569463, -75.49856950369147, 442, 156.84, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.062962905741833, -75.50092978050142, 441, 157.05, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.066029855266994, -75.50643462351162, 445, 157.73, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.97265356130759, -74.57782846189266, 304, 157.87, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.97325419126968, -74.57780835194671, 304, 157.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.0574259899262834, -75.52990347737935, 431, 159.91, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.083715807221048, -75.52602470674671, 443, 160.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.03544193373487, -75.46828872364509, 443, 161.41, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.035968295929141, -75.46934968659556, 444, 161.54, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.053560179496941, -75.48614205694084, 452, 163.93, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.059100468040345, -75.487096603177, 453, 164.23, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 6.015643915823461, -73.67397298753647, 285, 164.49, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.060620928679347, -75.49172147738162, 456, 164.77, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.97265356130759, -74.57782846189266, 317, 165.08, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.97325419126968, -74.57780835194671, 316, 165.14, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.062785608992201, -75.49777100988332, 458, 165.48, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.06409428569463, -75.49856950369147, 458, 165.61, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.062962905741833, -75.50092978050142, 457, 165.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.9839573117486, -75.61010387421261, 410, 166.20, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.556146759628807, -75.6567642788959, 333, 166.45, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.066029855266994, -75.50643462351162, 460, 166.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.544886743428225, -75.66062417267933, 329, 166.94, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.545222305238224, -75.6607542294554, 330, 166.95, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.544850577005966, -75.66150942255632, 330, 167.03, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.544043680970043, -75.66157140260101, 329, 167.04, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.547286287132974, -75.66215641958136, 332, 167.09, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 6.015643915823461, -73.67397298753647, 286, 167.13, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.544629395283769, -75.66274868961301, 332, 167.17, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.547083450505866, -75.66290819501393, 331, 167.18, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.790126630832331, -74.75343673250259, 453, 167.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.538520985223959, -75.66830247826785, 328, 167.82, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.790174197944722, -74.7573227829181, 452, 168.11, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.0574259899262834, -75.52990347737935, 448, 168.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 5.083715807221048, -75.52602470674671, 467, 169.21, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 4.824137586077557, -75.67992977564725, 375, 170.42, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.616406790731776, -74.15623608648288, 5.409757352047175, -75.48560202396766, 565, 171.65, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.916144967214288, -74.76624609422578, 431, 172.51, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.92906093046752, -74.76399515516277, 425, 172.69, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.914332963163876, -74.77331212565508, 432, 173.19, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.927618399430711, -74.77152621454748, 427, 173.43, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.901661178142346, -74.78280705783865, 438, 173.80, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(4.570360700521882, -74.0884026481501, 4.556146759628807, -75.6567642788959, 349, 173.85, 'google_maps');
INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, distance, source) VALUES
(10.47088147604149, -73.2538037172899, 10.888590725407752, -74.79057718624698, 443, 174.23, 'google_maps');

-- Verificar resultados
-- SELECT COUNT(*) as total_routes FROM travel_time_cache WHERE source = 'google_maps';
-- SELECT 
--   AVG(travel_time) as avg_time_minutes,
--   MIN(travel_time) as min_time_minutes,
--   MAX(travel_time) as max_time_minutes,
--   AVG(distance) as avg_distance_km
-- FROM travel_time_cache 
-- WHERE source = 'google_maps';
