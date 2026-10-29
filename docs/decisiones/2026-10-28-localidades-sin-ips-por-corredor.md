# 2026-10-28 – Las localidades de Bogotá sin IPS van con la Zona de su corredor, no con la que gana Bogotá

**Contexto**: el dueño, con el mapa de Bogotá a la vista: "Porque los colores no respetan geograficamente mira el
verde esta arriba y abajo del morado". Santa Fe, La Candelaria, Usme y Sumapaz no tienen IPS objetivo ni zona
residente, y el mapa les ponía, como alcance, la Zona que gana Bogotá entera por camas (fila 11001 de
`municipality_zone`). Hoy es Engativá, así que Santa Fe y Usme salían en verde al otro lado de la ciudad, al sur y al
oriente de San Cristóbal.

**Decisión** (propuesta para responder al dueño; se publica con su OK):
1. Una localidad sin IPS y sin zona residente va con la celda de su corredor de salida, como los municipios vecinos
   de afuera (regla de Bogotá del 2026-10-11): Usme por la vía al Llano, Sumapaz (se entra por Usme), Santa Fe por la
   vía a Choachí y La Candelaria (rodeada por Santa Fe). Las cuatro van al corredor Oriente, que hoy recibe San
   Cristóbal.
2. La celda del corredor es la que dejó el último recálculo (la que más municipios del corredor recibieron), no la
   configuración guardada: si la gerencia cambia la celda del corredor Oriente, las cuatro la siguen al recalcular,
   junto con Choachí, Une y el Meta. Sin regla de Bogotá, o con esa celda inactiva, vuelve la regla anterior (la Zona
   que gana Bogotá).
3. Con IPS manda, como siempre, la mayoría de camas, y la zona residente manda sobre el corredor.

**Consecuencias**:
- En el mapa, las cuatro localidades pasan de verde claro (Engativá) a morado claro (San Cristóbal). La tarjeta dice
  "va con la zona de su corredor de salida (Oriente)". Colores, opacidades y capas no cambian.
- No cambia ninguna asignación de IPS ni ninguna cifra de camas. Las localidades sin IPS siguen sin entrar en ningún
  anexo, y no hay migración ni costo de Google.
- En la tarjeta de cada Zona, la cuenta de territorios "de alcance" pasa a Engativá −4 y San Cristóbal +4.
- La propuesta de 4 sectores por localidad sigue pendiente. Si se aprueba, reemplaza esta lista.

**Dónde vive en el código**: `CORREDOR_DE_LOCALIDAD`, `celdasAplicadasPorCorredor` y `localidadesPorCorredor` en
`web/lib/bogota-corredores.ts`;
`zonaDeLocalidadSinIps` en `web/lib/territory-rules.ts`; `localidadesDeBogota` y el campo `localidades` de GET
`/api/municipality-coverage` en `web/lib/municipality-coverage.ts`; `resolveTerritory` en
`web/components/MapComponent.tsx`. Pruebas en `web/scripts/bogota-check.ts` (sección 5) y
`web/scripts/municipios-check.ts` (sección 7). Spec: `docs/specs/2026-10-28-localidades-sin-ips-por-corredor.md`.
