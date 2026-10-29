# 2026-10-28 – Bogotá se reparte en 4 sectores por localidad: Norte, Occidente, Sur y Oriente

**Contexto**: el dueño veía el mapa partido. Chapinero salía azul, Usaquén verde y Chía azul otra vez: "Porque
chapinero es azul, arriba usaquen es verde, arriba chia es azul... eso es lo que no entiendo". La causa eran dos
reglas distintas:
- Dentro de Bogotá decidía el tiempo por carretera. Las 32 IPS de Usaquén iban a Engativá por 2 minutos (24 contra 26,
  una sola medición de Google del 2025-08-07).
- Fuera de Bogotá decidía el corredor de salida: Chía va por el corredor norte, que recibe Chapinero.

Las camas también quedaban desparejas: Kennedy 2.001, San Cristóbal 4.509, Chapinero 5.411 y Engativá 5.716. El dueño
había pedido antes un reparto "equitativo y visualmente razonable", Bogotá en cuatro.

**Decisión** (dueño, 2026-10-28: "Si, hazlo. Norte, Occidente, Sur y Oriente."):
1. Cada localidad pertenece a un sector, que es el mismo corredor que ya usan los municipios de afuera:
   - Norte: Usaquén.
   - Occidente: Suba, Engativá, Fontibón, Barrios Unidos y Teusaquillo.
   - Sur: Kennedy, Bosa, Ciudad Bolívar, Tunjuelito, Puente Aranda, Los Mártires y Antonio Nariño.
   - Oriente: Chapinero, Santa Fe, La Candelaria, San Cristóbal, Rafael Uribe Uribe, Usme y Sumapaz.
2. Una IPS de Bogotá va a la Zona del sector de su localidad, sin minutos. Las forzadas siguen mandando y el sector
   va antes del territorio base. Fuera de Bogotá no cambia nada.
3. Las Zonas cambian de nombre:
   - Bogotá Norte (antes Chapinero).
   - Bogotá Occidente (antes Engativá).
   - Bogotá Sur (antes Kennedy).
   - Bogotá Oriente (antes San Cristóbal).

   Conservan su color, su punto base y su gente.

**Consecuencias**:
- Camas con los datos del 2026-10-28:
  | Zona | Camas en Bogotá | Camas fuera (corredor) | Total |
  | --- | ---: | ---: | ---: |
  | Bogotá Norte | 2.484 | 1.864 | 4.348 |
  | Bogotá Occidente | 3.986 | 473 | 4.459 |
  | Bogotá Sur | 3.597 | 658 | 4.255 |
  | Bogotá Oriente | 3.525 | 1.050 | 4.575 |

  La mayor queda en 1,08 veces la menor; antes era 2,86 veces.
- En el mapa cada sector queda de un solo color. Usaquén queda con Chía y el resto del corredor norte, y la localidad
  de Chapinero pasa al Oriente (morado). Las insignias de Bogotá muestran el sector (N, Oc, S, Or).
- El punto base del Norte estaba en Chapinero, que queda en el Oriente. Pasa a Usaquén, al centro de sus 32 IPS
  (4.706782, -74.039973), con sus tiempos rehechos con Google: 676 IPS y 795 municipios, 1.471 elementos, 7,36 USD.
  El dueño lo autorizó: "Recalculalo asumo el costo". Se hace con la migración 0903 y
  `scripts/zona-punto-base-tiempos.ts`. Los otros tres puntos ya están dentro de su sector y no se mueven.
- Incluye el arreglo de las localidades sin IPS (`2026-10-28-localidades-sin-ips-por-corredor.md`): ahora las 20
  localidades tienen sector y el sector manda sobre la zona residente en el mapa.
- Reemplaza la regla del 2026-10-11 según la cual dentro de Bogotá nada cambiaba (territorio base y mayoría por camas).

**Dónde vive en el código**:
- `CORREDOR_DE_LOCALIDAD` y `corredorDeLocalidad` en `web/lib/bogota-corredores.ts`.
- `bogotaSectorCell` y la fase 0b en `web/lib/opmap-algorithm-simplified.ts`; el mismo paso en
  `web/app/api/hospitals/assign-to-kam/route.ts`.
- `zonaDeLocalidadSinIps` en `web/lib/territory-rules.ts` y `bogotaSectorInitials` en `web/lib/zone-names.ts`.
- Pruebas: `web/scripts/bogota-check.ts` (secciones 5 y 6), `municipios-check.ts`, `mapa-estilo-check.ts` y
  `corredores-config-check.ts`.
- Migraciones de datos `database/migrations/2026-10-28_0902_bogota_sectores_nombres.sql` (rollback 9953) y
  `2026-10-28_0903_bogota_norte_punto_base_usaquen.sql` (rollback 9954).
- `web/scripts/zona-punto-base-tiempos.ts`: rehace con Google los tiempos de una zona desde su punto base nuevo.
- Spec: `docs/specs/2026-10-28-bogota-4-sectores.md`.
