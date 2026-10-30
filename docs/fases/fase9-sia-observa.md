# Fase 9 (2026-10-30): SIA Observa — contratos, documentos y lectura con IA

Spec: `docs/specs/2026-10-29-agente-sia-observa.md` (incluye las notas de implementación de la Fase 0). Decisión:
`docs/decisiones/2026-10-29-sia-observa-contratos-y-documentos.md`. Rama `feat/agente-sia-observa`.

## Dónde corre cada cosa

| Pieza | Dónde | Por qué |
| --- | --- | --- |
| Descarga de SIA (contratos, fichas, PDF) | Mac del dueño (`launchd` 02:00 Bogotá) | SIA corta conexiones fuera de Colombia (Vercel `iad1` y GitHub Actions salen por EE. UU.) |
| Lectura con Claude (`sia-extraer.ts`) | Mac del dueño, después de la descarga | Lee del bucket; no necesita SIA, pero va en la misma corrida |
| Tarjeta "Contratos SIA", importar, documentos, bandeja | Vercel (lee Supabase) | — |

`GET /api/sia/diagnostico` (admin) dice si SIA responde desde Vercel; si algún día responde, el mismo `lib/sia-observa/sync.ts`
puede correr en una ruta de cron.

## Pasos del dueño (una vez)

1. **Migración**: `database/migrations/2026-10-30_0930_sia_observa.sql` (aditiva; rollback 9958) APLICADA el 2026-10-30 con
   autorización del dueño, en la misma ventana que el despliegue del PR #50, seguida de `NOTIFY pgrst, 'reload schema';`.
2. **En el Mac** (en Colombia), en `web/.env.local`, además de lo que ya hay (`NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`):
   - `SIA_CONTACTO=<correo de la empresa>`: va en el User-Agent para que la Auditoría sepa quién consulta.
   - `ANTHROPIC_API_KEY=<clave>` (solo para la lectura con IA; o `ant auth login`). En Vercel no hace falta.
3. Prueba de humo: `cd web && npx tsx scripts/sia-smoke.ts --guardar-fixtures`. Responde la sección 3.7 (cookies, Referer) y
   guarda los fixtures reales en `web/scripts/__fixtures__/sia/` (sin personas). Correr `npm run sia:check` con ellos: si algo
   falla, el parser se ajusta al HTML real.
4. Entidades: `npx tsx scripts/sia-entidades.ts --desde-contratos` (sin navegador, con los 53 enlaces que ya hay) y, para el
   resto, `npm i -D playwright && npx playwright install chromium` y `npx tsx scripts/sia-entidades.ts --cascada`
   (`--departamentos 26` para empezar por Casanare).
5. Backfill: `npx tsx scripts/sia-load.ts --desde 2024-01-01` (mes a mes; reanudable). Luego `--enlazar` enlaza los 53.
6. `launchd`: copiar `web/scripts/launchd/co.vgmedical.opmap.sia.plist` a `~/Library/LaunchAgents/` (cambiar `RUTA_AL_REPO`) y
   `launchctl load …`. Registro en `/tmp/opmap-sia.log`.

## Qué hace la corrida diaria (`sia-load.ts`)

1. Contratos de cada entidad validada de IPS pública (primero las de más contratos clasificados en SECOP), ventanas de un mes de
   los últimos 60 días. Solo empresas (NIT de persona jurídica) con objeto de las líneas (clasificador de SECOP `v2`).
   Personas naturales: nada (ni hash). Upsert por `sia_idc` sin pisar la revisión (`estado_revision`, motivo, enlace).
2. Cruce con SECOP: misma entidad + código normalizado (`CD/26-1262` = `CD261262`, en SECOP va en `referencia`), y además
   el mismo contratista o la firma a ±60 días (los códigos cortos se repiten cada año); si casan varios, desempate por NIT y
   firma ±7 días; si no hay código que case, NIT + firma ±7 días + valor. Prefiere la fila del mismo contratista y de `secop2`.
   Ante la duda, no cruza.
3. Enlace con Contratos: primero el `idc` del `documents_link`; por número solo si es inequívoco (un contrato a cada lado) y
   con el inicio a ±180 días. Solo escribe lo vacío. Una entidad que falla se anota en el mensaje y se sigue con la siguiente.
4. Fichas de hasta 40 contratos nuevos (y los "Actualizar desde SIA" pedidos, que además vuelven a pedir a `Get_CTOs_Base` el
   mes de la firma para traer valor vigente, adiciones, liberaciones y fechas nuevos): documentos deduplicados por `(ianx, ianxa)`,
   copia al bucket de los tipos clave (contrato, estudio previo, anexo técnico, propuesta, novedad, liquidación) y estado de los
   demás (`solo_enlace`, `anonimizacion_pendiente`, `restringido`, `error`). Nunca se envía el correo de anonimización. Una
   ficha que falla suma un intento (`ficha_intentos`) y a la tercera se deja hasta que alguien pida actualizar.
5. Estado en `fuentes_estado` (`sia_observa`, ejecutor `manual`): bloqueo de 30 min, cursor por entidad, mensaje con cifras.

Carga al portal: una petición a la vez, 1,5 s entre peticiones, 3 reintentos con espera creciente, 60 s de timeout, redirecciones
solo dentro de SIA. Caché de 20 h de `Get_CTOs_Base` en `web/.sia-cache/` (no va a git) con SOLO las filas de empresas; lo vencido se
borra al arrancar; las fichas no se guardan en caché.

## Lectura con IA (`sia-extraer.ts`)

- `--dry-run`: cuántos contratos y páginas. `--lote`: crea un lote de la Batch API (mitad de precio; queda en
  `sia_contratos.ia_lote_id` y no se reenvía mientras esté en vuelo); `--recoger`: guarda los resultados. `--directo --idc N`: uno
  ya. Máximo 2 intentos por contrato (`ia_intentos`): un rechazo o una respuesta sin la herramienta no se paga cada noche.
- Modelo `claude-opus-5-5`, pensamiento adaptativo, esfuerzo alto, herramienta estricta `registrar_contrato` (esquema de la
  sección 7 de la spec; cada dato con su documento y página). Máximo 32 MB y 600 páginas por solicitud: van primero contrato y
  estudio previo.
- Se sanea (sin cédulas; cotizantes solo empresas con NIT o razón social inequívoca; supervisión solo el cargo, o nada; ganador solo
  si es una de esas empresas), se compara con SIA (`discrepancias`) y se guarda
  en `contrato_extracciones` con el modelo y `version_prompt`. Nada pasa a Contratos solo.

## En la app

- Ficha de la IPS → **Contratos SIA** (`contracts:view`).
- `/contracts/new/edit` → **Importar desde SIA / SECOP** (`contracts:edit`): precarga número, proveedor, valor vigente (con el de
  SECOP al lado si difiere), fechas (acta o firma; fin ampliada o fin), modelo, tipo evento, descripción, ficha de SIA y, si ya se
  leyeron, los indicadores (liquidez, endeudamiento en fracción, capital de trabajo en millones, requisitos adicionales).
- Detalle del contrato → **SIA Observa**: documentos (los copiados con enlace firmado de 10 minutos), diferencias para aplicar una
  a una y **Actualizar desde SIA**.
- `/contracts/detectados` (`contracts:edit`): bandeja de SIA y SECOP de las líneas que no están en Contratos; filtros por línea,
  Zona y fecha; Importar o Descartar con motivo (los de SECOP van a `secop_descartes_bandeja`; `secop_contratos` no cambia).

## Pruebas

`npm run test` incluye `scripts/sia-observa-check.ts` (lectura de Get_CTOs_Base, privacidad, cruce con filas reales de SECOP,
precarga de CD/26-1262, diferencias de CD/25-1111, ficha y handler, cliente HTTP con fetch falso, sync con Supabase falso,
lectura con IA sin red) y `scripts/sia-observa-api-check.ts` (manejadores de `/api/sia/*`). Los fixtures son sintéticos con el
formato verificado hasta que `sia-smoke.ts --guardar-fixtures` traiga los reales.
