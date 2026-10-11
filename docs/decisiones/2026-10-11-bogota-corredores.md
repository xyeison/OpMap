# 2026-10-11 – Bogotá compite hacia afuera como una sola ciudad y reparte por corredor de salida

**Contexto**: las cuatro celdas de Bogotá (Chapinero 1100102, Engativá 1100110, Kennedy 1100108, San
Cristóbal 1100104) competían cada una sola por las IPS de fuera de Bogotá y con topes distintos (Chapinero
360, las otras 240). El dueño vio una IPS a 4 h 31 de Engativá y 4 h 33 de Chapinero que quedaba en
Chapinero "porque alcanza". Pedido literal: "Bogotá o toda ciudad súper grande que se parta debe tener una
subconfiguración… bogotá inicialmente voy a dividirlo en 1, o en 2, o en 3… y que se vaya calculando la
asignación… en eso tú decide lo mejor". Spec aprobada en el chat ("Autorizo todo. Procede."):
`docs/specs/2026-10-11-bogota-corredores.md`.

**Decisión**:

1. Dentro de Bogotá nada cambia: las localidades se reparten entre las celdas de Bogotá por la regla de
   mayoría de siempre. Territorio base y asignaciones forzadas tampoco cambian.
2. Hacia afuera Bogotá compite como UNA ciudad: su tiempo es el mejor tiempo real entre sus celdas
   elegibles y su tope es único (`bogota_config.max_travel_minutes`, 240 al arrancar), sin mirar el
   `kams.max_travel_time` de cada celda. Las demás zonas conservan su tope.
3. Si Bogotá gana, la celda la decide el **corredor de salida** del municipio (`bogota_corredores`, por
   departamento y, en Cundinamarca, por municipio según su provincia), no los minutos: Norte → Chapinero,
   Occidente → Engativá, Sur → Kennedy, Oriente → San Cristóbal. Sin corredor → la celda con menor tiempo.
4. Subconfiguración "Bogotá en k celdas" (k = 1..4) en `/kams`, solo admin: k = 3 agrupa Sur + Oriente,
   k = 2 agrupa Norte + Oriente y Occidente + Sur, k = 1 manda todo a una celda. Guardar **no recalcula**:
   aplica al próximo recálculo; antes se puede simular en memoria.
5. Criterios tomados por Claude con la autorización del dueño ("tú decide lo mejor"), revisables:
   Casanare entero al Oriente (el dueño puede pasarlo al Norte); La Calera al Norte (se sale por la vía a
   La Calera desde Chapinero); grupo de k = 3 = Sur + Oriente; la asignación guarda el tiempo real de la
   celda elegida y en `assignments.detail` el mínimo de Bogotá y la celda que lo tenía.

**Consecuencias**:

- Datos: tablas nuevas `bogota_config` (una fila) y `bogota_corredores` (145 filas sembradas), columna
  `assignments.detail` y tipo de asignación `bogota_corredor` (migración
  `database/migrations/2026-10-11_0700_bogota_corredores.sql`, aplicada el 2026-10-11 por ser aditiva;
  rollback `2026-10-11_9930_bogota_rollback.sql`). No se recalculó nada.
- Simulación del 2026-10-11 con k = 4 y tope 240 (solo lectura): Chapinero 42 → 62, Engativá 85 → 59,
  Kennedy 24 → 24, San Cristóbal 31 → 32; 43 IPS en el cupo de Bogotá; 28 cambian y 4 de Boyacá quedan
  fuera de alcance (hoy dependen del tope 360 de Chapinero). El caso del pedido (Hospital Regional de Vélez,
  4 h 31 de Engativá / 4 h 33 de Chapinero) no queda sin zona: pasa a Bucaramanga (5 h 32) porque
  Bucaramanga conserva su tope de 360. Si el dueño quiere que quede sin zona, hay que bajar el tope de
  Bucaramanga, que es otra decisión.
- Asignaciones forzadas: se conservan. Villavicencio y Granada (Meta) → San Cristóbal coinciden con el
  corredor Oriente; Yopal → Kennedy no coincide (Casanare → Oriente): queda a decisión del dueño retirarla o
  pasar Casanare al Norte.
- `kams.max_travel_time` de las celdas (Chapinero 360) no se tocó: hacia afuera ya no se usa; homologarlo
  a 240 lo decide el dueño. Una "celda de largo alcance" se declara en la configuración, no con un tope
  distinto.
- Costo Google Maps: 0 (usa `hospital_kam_distances`). Estética del mapa: sin cambios (solo cambia quién
  gana). Cobertura por línea y `municipality_zone`: sin cambios; si el recálculo mueve IPS, `municipality_zone`
  se recalcula con el botón existente (sin Google).
- Descartado: repartir el cupo de Bogotá por tiempo entre celdas (los 15 min de diferencia entre celdas no
  son una razón comercial) y topes distintos por celda.

**Dónde vive en el código**:

- Motor: `competeForHospital`, `bogotaVirtualCandidate`, `chooseBogotaCell`, `loadBogotaRule` en
  `web/lib/opmap-algorithm-simplified.ts`; corredores, k y grupos en `web/lib/bogota-corredores.ts`.
- Configuración y simulación: `web/lib/bogota-admin.ts` (validación, resumen, fila "Bogotá" de la ficha),
  `web/app/api/kams/bogota-config/route.ts` (GET/PUT, permiso `kams:bogota-config`, solo admin),
  `web/app/api/kams/bogota-config/simulate/route.ts` (permiso `recalculate:complete`, solo lectura),
  `web/components/BogotaConfigCard.tsx` (tarjeta de `/kams`), `web/scripts/bogota-simulate.ts`.
- Ficha: `web/app/hospitals/[id]/page.tsx` y `web/app/api/hospitals/[id]/kam-distances/route.ts`.
- Pruebas: `web/scripts/bogota-check.ts` (reglas del motor y criterios de aceptación) y
  `web/scripts/corredores-config-check.ts` (configuración, simulación, ficha), ambas en `npm run test`.
- Detalle completo: `docs/algoritmo-asignacion.md`, sección "Bogotá hacia afuera: una ciudad, cuatro
  corredores".
