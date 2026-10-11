# OpMap – asignación territorial por tiempos reales de carretera

App Next.js 14 + TypeScript en `web/` (Supabase/PostgreSQL, Leaflet, React Query, Vercel). Los scripts
Python de la raíz son el motor original; hoy la fuente de verdad es `web/`. Idioma del proyecto: español.

## Comandos (todos desde `web/`)

```bash
npm run dev          # servidor local (o preview "opmap-web" en .claude/launch.json)
npm run check        # typecheck + lint + pruebas sin red  ← correr SIEMPRE antes de dar algo por terminado
npm run typecheck    # tsc --noEmit (≈3 s)
npm run test         # ips-routes-check (109, Supabase falso, sin Google) + reps-check (55) + reps-import-check (90) + adres-check (112)
npm run fase2:check  # reglas de cobertura vs documento de producto (NECESITA Supabase real, solo lectura)
npm run fase1:simulate   # simulación de zonas, solo lectura
npm run reps:check   # cruce IPS ↔ sedes del REPS: pruebas puras sin red
npm run adres:check  # giros ADRES: lectura del reporte y agregación, pruebas puras sin red
npm run reps-import:check  # importador de servicios/capacidad del REPS (Excel, CSV, PDF): puras sin red
```

Variables en `web/.env.local` (ver `web/VERCEL_ENV_VARS.md`): `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `GOOGLE_MAPS_API_KEY`. Con `GOOGLE_ROUTES_DISABLED=true`
nada llama a Google.

## Verificación: evidencia, no afirmaciones

- Termina cada cambio de código con `npm run check` y muestra la salida. Si algo falla, dilo.
- Cambios visibles en el mapa o la UI: abrir el preview y adjuntar captura; en celular probar también
  (el mapa tiene reglas propias en móvil).
- Un hook corre `tsc` tras cada edición de `.ts/.tsx` y otro corre `check` al terminar si hay cambios en
  `web/`: no los esquives, arregla la causa.
- Cambios al motor de asignación o cobertura: añade o ajusta pruebas en `web/scripts/*-check.ts` (puras,
  sin red). Las reglas de negocio se prueban ahí.

## Flujo de trabajo

1. Trabajo mediano o grande (varios archivos, migración, regla de negocio): primero spec corta en
   `docs/specs/<fecha>-<tema>.md` (plantilla en `docs/specs/TEMPLATE.md`) y plan; luego implementar.
   Un arreglo de una línea no necesita spec.
2. Rama por cambio (`feat/…`, `fix/…`, `chore/…`) desde `master`; nunca commits directos a `master`.
3. PR a `master` con la plantilla; CI (`.github/workflows/ci.yml`) debe estar en verde. `/entregar` hace
   commit + push + PR.
4. `git push origin master` despliega a PRODUCCIÓN solo (Vercel). Cada rama empujada tiene preview
   `https://op-map-git-<rama-con-guiones>-xyeisons-projects.vercel.app` (pide login de Vercel).
5. Commits en español, prefijo convencional (`feat(ips): …`, `fix(mapa): …`), cuerpo con el porqué.
6. Decisiones del dueño que cambian reglas de negocio: anotar en `docs/decisiones/` (plantilla ahí).
7. Antes de `/entregar` un cambio mediano o grande: subagente `revisor` (`.claude/agents/revisor.md`) sobre
   el diff y la spec; corregir solo lo que afecte corrección o reglas.

## Reglas que no se deducen del código (IMPORTANTE)

- **Terminología en la UI**: persona → "Ejecutivo Comercial", territorio → "Zona", tabla `zones` →
  "Región". Nunca "KAM" en texto visible. En código siguen `kams`, `kam_id`, rutas `/kams`.
- **Modelo**: cada fila de `kams` es una ZONA (ciudad base = `area_id`), no una persona. Personas =
  `executives`; líneas de negocio = `business_lines`; quién cubre cada zona por línea = `coverage`.
- **Unidades**: `travel_time` en `assignments` y `hospital_kam_distances` está en SEGUNDOS. Minutos solo
  en `kams.max_travel_time` y `business_lines.max_reach_minutes`. Coordenadas con 6 decimales.
- **Municipios sin IPS** se reparten por tiempo REAL de carretera (Google, driving). Nunca por línea
  recta. Sin ruta → `no_road` (nadie); sobre el tope de la zona → `out_of_reach` (nadie).
- **Google Maps cuesta dinero** (0,005 USD/elemento). Solo llama `web/lib/google-distance.ts` y los flujos
  documentados (`process-pending`, `ensure-routes`, `scripts/fase2b-municipios.ts --run`). Cualquier
  llamada nueva o masiva: dry-run con cifra y autorización explícita del dueño antes.
- **Crear/editar/activar una IPS NO recalcula** la asignación: queda en la cola de pendientes y el dueño
  decide cuándo correr "Calcular rutas y asignar pendientes" (ver `docs/ips-pendientes.md`).
- **Estética del mapa**: estilo autorizado por el dueño el 2026-10-11 (`web/components/mapStyles.ts`,
  detalle en `docs/mapa-estetica.md`). No añadir capas, marcadores (incluidos los de población 👥) ni
  cambiar colores/opacidades sin autorización explícita.
- **Base de datos**: las migraciones se ESCRIBEN en `database/migrations/` con su rollback; se aplican
  solo con autorización del dueño y en la misma ventana que el despliegue del código. Acceso a datos
  desde el servidor con `service_role` (`lib/supabase-admin.ts`); permisos por rol con `requirePermission`
  (`lib/require-role.ts` + `lib/permissions.ts`), no con políticas RLS por rol.
- **Caché de Next.js**: el cliente de `lib/supabase-admin.ts` hace todas sus consultas con
  `cache: 'no-store'`. No quitarlo: en Next 14 las rutas GET con `dynamic = 'force-dynamic'` guardaban
  el fetch de supabase-js para siempre en la Data Cache (datos y sesión de usuario viejos).
- **Territorio y contratos**: el anexo de territorio (Anexo A IPS, Anexo B municipios) va al contrato de
  cada Ejecutivo Comercial; las versiones (`territory_snapshots`) son inmutables.
- Nunca leer ni editar `.env*`; nunca imprimir claves. `.env.example` de la raíz tuvo una clave real de
  Google expuesta: hay que rotarla (tarea del dueño).

## Fase 3: sedes del REPS

- La IPS es la **sede** del REPS (código de habilitación, 12 dígitos), no el NIT: `hospitals.reps_code`
  (UNIQUE, FK suave a `reps_sedes`) y `reps_match_status` (`matched` | `ambiguous` | `unmatched`).
  `hospitals.nit` es columna GENERADA desde `code`: no se escribe. El sufijo de `code` no es el DV DIAN.
- Carga mensual: `scripts/reps-load-sedes.ts --file <csv>` (solo IPS, objeto social diferente y
  transporte; nunca profesionales independientes). Cruce: `scripts/reps-match.ts` (informe) y `--apply`
  (no pisa vínculos existentes). Reglas puras en `lib/reps-match.ts`, pruebas `npm run reps:check`.
- UI: sección "Sede REPS" de la ficha (vincular a mano) y `/hospitals/reps` (Cruce REPS). Detalle:
  `docs/fases/fase3-reps.md`.

## Fase 3: giros ADRES

- Fuente: ADRES, Reporte 29 "Giro a IPS" (`SII_LMA_WEB/LMA/frmReportes.aspx?Reporte=29`), público. Solo
  **régimen subsidiado** (el contributivo, servicios.adres.gov.co, daba error el 2026-10-11). Por mes de
  proceso, tipo (Capitación/Evento) y EPS. A 2026-10-11 publica hasta **junio-2025**.
- **El giro es por NIT del prestador, no por sede**: si un NIT tiene varias sedes en OpMap, para agregar
  por municipio/zona/ejecutivo se reparte por camas (nunca se suma dos veces). NIT de la IPS = misma regla
  que `hospitals.nit` (`nitFromHospitalCode()` en `web/lib/adres-parse.mjs`).
- Tablas `adres_giros` / `adres_fetch_log` + función `adres_giros_resumen()` (migración 0610, aplicada).
  Carga: `cd web && node scripts/adres-giros.mjs` (HTTP con User-Agent propio que se identifica; el
  firewall de la ADRES bloquea Chrome headless y no se evade; reanudable). Pruebas `npm run adres:check`.
- UI: `/inteligencia` (permiso `intelligence:view`) y tarjeta "Giros ADRES" en la ficha de IPS. Detalle:
  `docs/fases/fase3-adres.md`.

## Fase 3: servicios y capacidad del REPS

- Procedimiento humano: portal del REPS (perfil invitado, requiere login) → consultas **Servicios** y
  **Capacidades instaladas** por departamento/municipio, exportar a Excel o texto `;` (máx. 4 MB) →
  Hospitales → "Importar del REPS" (solo `admin`/`data_manager`) → simulación → "Aplicar". PDF: solo
  **con texto**; uno escaneado responde "requiere OCR" (no hay OCR).
- Importar NO recalcula asignaciones ni llama a Google. Solo se guardan las sedes con cruce (por
  `hospitals.reps_code`, importación previa o NIT inequívoco); las ambiguas se vinculan en la ficha y
  se reimporta. "Reemplazar" retira solo dentro de los grupos que trae el archivo.
- Tablas `hospital_services`, `hospital_capacity`, `hospital_import_jobs` (token, 30 min) y en
  `hospitals`: `quirofanos`, `reps_beds` (≠ `beds` manual), `service_flags`, `reps_services_count`,
  `reps_updated_at` (migración 0620, aplicada). Lógica pura `web/lib/reps-import.ts`; filtro único
  lista/mapa `web/lib/hospital-service-filters.ts` ("Columna" = columna o neurocirugía). Detalle:
  `docs/fases/fase3-servicios-capacidad-reps.md`.

## Dónde está el detalle (leer solo cuando toque)

- `docs/algoritmo-asignacion.md` – principios, 8 fases, regla de mayoría, departamentos excluidos.
- `docs/mapa-estetica.md` – estilo autorizado del mapa, filtros, insignias, racimos, tarjetas.
- `docs/base-de-datos.md` – tablas, vistas, RLS. `docs/fases/` – Fase 1, 2 y 2b (modelo y reglas de
  cobertura). `docs/ips-pendientes.md` – cola de pendientes y acción masiva.
- `docs/arquitectura-y-scripts.md` – scripts Python, estructura de carpetas, archivos clave.
- `docs/historico-resultados.md` – cifras de 2025 y colores originales (histórico, no vigente).
- `docs/FLUJO_DE_TRABAJO_IA.md` – cómo trabajamos con Claude Code en este repo y por qué.
- `web/docs/ROLES_AND_PERMISSIONS.md` – roles y permisos.

## Al compactar el contexto

Conservar siempre: lista de archivos modificados, comandos de verificación ejecutados y su resultado,
decisiones del dueño tomadas en la sesión y cifras de costo de Google autorizadas.
