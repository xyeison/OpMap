# 2026-10-30 – La app de campo funciona sin señal: la visita siempre se guarda y el servidor marca, no rechaza

**Contexto**: el dueño pidió que el reporte de visitas de la app de campo funcione sin internet desde el navegador del
celular (PWA, sin tiendas): "la comercial reporta la visita con su ubicación aunque no tenga señal, el reporte queda
guardado en el teléfono y se sube solo cuando vuelve la conexión, sin perderse y sin duplicarse" y "una app web no puede
detectar el GPS falso. No bloquees a nadie por sospechas, solo deja las marcas". Hasta hoy el servidor rechazaba la
visita de otro día, la que estaba a más del radio (500 m) de la sede, la que llegaba sin GPS y la de una sede sin
coordenadas (decisiones 5 y 6 de la fase 8). Aprobado por el dueño el 2026-10-30 ("Sí, adelante").

**Decisión**:
1. **Otro día**: el servidor acepta visitas de días anteriores. `visit_date` sigue siendo la fecha del teléfono en Bogotá.
   Si la hora del teléfono es posterior a la llegada al servidor (más de 5 minutos) o la visita tiene más de 7 días, se
   marca `hora_inconsistente`. La cola del teléfono ya no descarta nada a medianoche.
2. **Lejos o sin GPS**: la visita se guarda siempre. Marcas: `en_sitio` cuando la distancia a la sede menos la precisión
   del GPS cabe en el radio (300 m por defecto desde hoy, `radio_presencial_m`, configurable en /configuracion);
   `lejos_de_ips` cuando no; `sin_ubicacion` sin GPS; `precision_baja` con más de 100 m de precisión;
   `ips_sin_coordenadas` cuando la sede no tiene lat/lng. Nadie queda bloqueado por la ubicación.
3. **Motivo de la no efectiva** pasa a lista cerrada (`motivos_no_efectiva`, se administra en la base; el texto libre se
   conserva como respaldo para visitas anteriores y para "Otro").
4. **Médico no listado**: la visita puede ir con `medico_no_listado` (nombre y especialidad) en vez de `medico_id`; queda
   marcada `medico_por_validar` para que quien tiene `terceros:create` lo cree o lo cruce después. No se crea el médico
   desde la visita (la regla "médicos completos o no se crean" sigue).
5. Los topes de negocio siguen rechazando como antes: perfil, tope por médico, telefónica no habilitada, líneas ajenas.

**Consecuencias**:
- Las marcas alimentan el mapa de calor y el tablero (`/api/visits/filtered?marca=`). Una visita "lejos de la IPS" cuenta
  igual que antes en la cuota: la dirección la revisa con la marca.
- La app toma la ubicación hasta 20 segundos y se queda con la lectura más precisa; guarda la precisión y la hora de la
  lectura. Nunca en segundo plano.
- Foto opcional por visita (bucket privado `visitas-fotos`), comprimida en el teléfono.
- Migración 0940 (rollback 9959). Decisiones 5 y 6 de la fase 8 quedan reemplazadas en lo que aquí se dice.
- Lo que una app web no puede: detectar GPS falso. Queda para Capacitor si algún día hace falta; el código puro de la
  app (`mobile/lib/*`) no depende del navegador.

**Dónde vive en el código**:
- `database/migrations/2026-10-30_0940_campo_sin_senal.sql` (`visitas_registrar`, `visits_app_check`, `motivos_no_efectiva`).
- `web/lib/reporte-visitas.ts` (`marcasDeVisita`, `MARCAS_VISITA`, `PRECISION_BAJA_M`, `DIAS_MAX_ATRAS`), `web/lib/reporte-visitas-schemas.ts`.
- `mobile/lib/cola.ts` (v2), `mobile/lib/propuesta.ts` (`marcasPrevistas`), `mobile/lib/ubicacion-pasos.ts` (`mejorLectura`).
- Pruebas: `web/scripts/reporte-check.ts`, `web/scripts/reporte-api-check.ts`, `web/scripts/campo-web-check.ts`,
  `mobile/scripts/checks/22-sin-senal.ts`.
