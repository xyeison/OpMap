# 2026-10-28 – Los municipios también se reparten por corredor de Bogotá, con un tope único de 6 horas

**Contexto**: el dueño vio Puerto Gaitán (Meta) en Chapinero, más allá de Villavicencio, que es de San Cristóbal:
"Yo veo rara es la distribución, debería ser equitativa y como visualmente también razonable. Si tu partes
bogotá en cuatro. Arriba a la derecha todo lo que haya es para X / Arriba a la izquierda, para Y / Abajo a la
derecha para Z / Abajo a la izquierda para M". La causa: el motor de municipios no aplicaba la regla de Bogotá
del 2026-10-11 (cada celda con su propio tope; Chapinero tenía 360 y las demás 240) y nada se había recalculado
desde que se guardó esa regla. Propuesta en el chat: arreglar el motor de municipios para que use los
corredores, poner el tope de Bogotá en 6 h y recalcular IPS y municipios sin costo de Google. Respuesta del
dueño: "Si dale."

**Decisión**:
1. Fuera de Bogotá, los municipios sin IPS siguen la misma regla que las IPS: Bogotá compite como una ciudad
   (su mejor tiempo, tope único) y la celda la decide el corredor del municipio: norte → Chapinero, occidente →
   Engativá, sur → Kennedy, oriente → San Cristóbal (`docs/algoritmo-asignacion.md`, "Bogotá hacia afuera").
2. El tope único de Bogotá (`bogota_config.max_travel_minutes`) pasa de 240 a **360 min (6 h)**, el mismo que ya
   tenía Chapinero, para que ningún municipio ni IPS que hoy tiene zona la pierda.
3. Se recalculan las IPS y los municipios desde la caché de tiempos (sin llamar a Google), con respaldo previo
   de `assignments` y `municipality_zone`.

**Consecuencias**:
- Simulación (solo lectura, 2026-10-28): 27 IPS cambian, todas entre celdas de Bogotá (Chapinero 42 → 67,
  Engativá 85 → 59, Kennedy 24, San Cristóbal 31 → 32); ninguna queda sin zona. 47 municipios cambian, ninguno
  pierde zona. Puerto Gaitán y San Carlos de Guaroa pasan a San Cristóbal; Chía y Tunja a Chapinero; Gachetá a
  San Cristóbal.
- El reparto queda por cuadrantes, pero no parejo en número de municipios: fuera de Bogotá, Chapinero 150 (casi
  todo Boyacá), San Cristóbal 46, Engativá 36 y Kennedy 18 (al sur, Huila es de Neiva y Tolima de Ibagué). Si el
  dueño quiere emparejarlo, se mueven corredores (por ejemplo, provincias de Boyacá al oriente): es otra decisión.
- Las asignaciones forzadas no cambian. **Yopal** (Casanare, corredor oriente) sigue forzado a Kennedy
  ("trayecto aéreo"): queda como una isla de Kennedy dentro de San Cristóbal. Pregunta abierta al dueño.
- Guardar la configuración de Bogotá en `/kams` sigue sin recalcular: aplica en el próximo recálculo.

**Dónde vive en el código**: `decideByTravelTime` en `web/lib/municipality-coverage.ts` (usa
`bogotaVirtualCandidate` y `chooseBogotaCell` de `web/lib/opmap-algorithm-simplified.ts`); pruebas en
`web/scripts/municipios-check.ts`. Spec: `docs/specs/2026-10-28-municipios-regla-bogota.md`.
