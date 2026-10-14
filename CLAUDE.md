# OpMap – asignación territorial por tiempos reales de carretera

App Next.js 14 + TypeScript en `web/` (Supabase/PostgreSQL, Leaflet, React Query, Vercel). Los scripts
Python de la raíz son el motor original; hoy la fuente de verdad es `web/`. Idioma del proyecto: español.

## Comandos (todos desde `web/`)

```bash
npm run dev          # servidor local (o preview "opmap-web" en .claude/launch.json)
npm run check        # typecheck + lint + pruebas sin red  ← correr SIEMPRE antes de dar algo por terminado
npm run typecheck    # tsc --noEmit (≈3 s)
npm run test         # 18 suites sin red (Supabase falso, sin Google ni OpenAI/Claude): ips-routes, reps, adres, población, bogotá, secop, terceros, visitas, traspaso, reporte…
npm run fase2:check  # reglas de cobertura vs documento de producto (NECESITA Supabase real, solo lectura)
npm run fase1:simulate   # simulación de zonas, solo lectura
npm run reps:check   # cruce IPS ↔ sedes del REPS: pruebas puras sin red
npm run adres:check  # giros ADRES: lectura del reporte y agregación, pruebas puras sin red
npm run reps-import:check  # importador de servicios/capacidad del REPS (Excel, CSV, PDF): puras sin red
# App móvil (Expo, en mobile/): npm run check (tsc + pruebas puras) · npx expo start (Expo Go) · npx expo start --web --port 8081
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
- **Bogotá hacia afuera** compite como UNA ciudad: mejor tiempo entre sus celdas, tope único `bogota_config.max_travel_minutes` (no el `max_travel_time` de cada celda) y la celda la decide el corredor del municipio (`bogota_corredores` + `bogota_config.grupos`), no los minutos; dentro de Bogotá, forzadas y territorio base no cambian (`docs/algoritmo-asignacion.md`).
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
- **Si un Ejecutivo Comercial se va o pierde una línea, ya no está** (dueño, 2026-10-12): lo suyo (líneas, zona,
  médicos, ajustes de cobertura, nombre del territorio) pasa en un paso con "Traspasar" en `/executives` a otra
  persona, una persona nueva o una vacante; una vacante se convierte en la persona con "Contratar"
  (`docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md`).
- **Territorio y contratos**: el anexo de territorio (Anexo A IPS, Anexo B municipios) va al contrato de
  cada Ejecutivo Comercial; las versiones (`territory_snapshots`) son inmutables.
- **SECOP I** se cuenta por el valor ADJUDICADO a cada contratista desde `f789-7hwg` (`fuente = 'secop1'`); el
  Integrado (`rpmr-utcd`) es solo respaldo estimado para lo que ese dataset no trae (sobre todo antes de 2018; la marca `estimado` va por fuente, no por fecha: valor del
  proceso repartido por partes iguales, marcado `estimado`). `hospitals.compra_publica` (Sí/No a mano) manda
  sobre el REPS para decidir si una IPS es entidad de compra pública (`docs/fases/fase5-secop.md`).
- Nunca leer ni editar `.env*`; nunca imprimir claves. `.env.example` de la raíz tuvo una clave real de
  Google expuesta: hay que rotarla (tarea del dueño).

## Fase 3: REPS y ADRES (detalle en `docs/fases/fase3-reps-adres.md`)

- **Una IPS = una sede del REPS** (`hospitals.reps_code`, código de habilitación de 12 dígitos), no un NIT.
  `hospitals.nit` es GENERADA desde `code` (no se escribe); el sufijo de `code` no es DV ni número de sede.
- **Coordenadas de sedes nuevas**: solo Google Maps por nombre y con certeza; nunca la dirección del REPS.
  Sin certeza → "sin ubicar" (pendiente D4: spec, dry-run y autorización de gasto antes).
- Vincular sede, importar servicios/capacidad o cargar giros NO recalcula ni llama a Google.
- **Giro ADRES por NIT**: entre sedes activas del mismo NIT se reparte por camas (nunca se suma dos veces).
  Solo régimen subsidiado, publicado hasta junio-2025. El script se identifica con su User-Agent; no evadir
  el firewall de la ADRES.
- Importar del REPS: solo `admin`/`data_manager`, PDF solo con texto (sin OCR); solo se guardan sedes con
  cruce. Permiso `intelligence:view` para `/inteligencia`.

## Dónde está el detalle (leer solo cuando toque)

- `docs/algoritmo-asignacion.md` – principios, 8 fases, regla de mayoría, departamentos excluidos.
- `docs/mapa-estetica.md` – estilo autorizado del mapa, filtros, insignias, racimos, tarjetas.
- `docs/base-de-datos.md` – tablas, vistas, RLS. `docs/fases/` – Fase 1, 2 y 2b (modelo y reglas de
  cobertura) y Fase 3 (`fase3-reps-adres.md`: sedes del REPS, servicios/capacidad, giros ADRES).
  `docs/ips-pendientes.md` – cola de pendientes y acción masiva.
- `docs/fases/fase4-poblacion.md` – población: afiliados BDUA, cifras mensuales de MinSalud y proyecciones
  DANE (estructura real de las fuentes, tablas 0640, alias de municipio, scripts de carga y cifras).
- `docs/fases/fase5-secop.md` – compras públicas (SECOP): reglas de suma (sin clasificar, fuera de escala,
  SECOP I por valor adjudicado y estimados del Integrado, `compra_publica`), privacidad de médicos (sin
  cédula), API `/api/secop/*` y `/api/fuentes/*`, ficha, /inteligencia ("Compras públicas", "Fuentes de
  datos") y lista vigilada.
- `docs/fases/fase5-fuentes-automaticas.md` – carga de SECOP (0710, clasificación, privacidad, cursor) y cargas
  automáticas: `/api/cron/<fuente>` (CRON_SECRET), `.github/workflows/datos.yml`, `fuentes_estado`.
- `docs/fases/fase6-visitas-f1-terceros.md` – app de visita F1: cuentas, sedes, médicos, visitantes y contactos (0800
  aplicada 2026-10-12), permisos `terceros:*` y `visitantes:manage`, API `/api/terceros/**` y página `/terceros`.
- `docs/fases/fase7-visitas-f2-config-calendario.md` – app de visita F2: configuración con vigencias (escrituras solo
  por `config_registrar`/`config_cerrar`), calendario y festivos, días libres con aprobación en bloque, rol `hr`,
  cuota del periodo; `/configuracion` y `/calendario` (migración 0810 aplicada 2026-10-12).
- `docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md` – traspaso de un Ejecutivo Comercial y "Contratar" (0820 aplicada 2026-10-12).
- `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` – app de visita F3+F4: visitas de la app en `visits` + `visit_lines`, `visitas_registrar/editar/anular`, `/api/me/*` (contexto, visitas, voz, números), token de portador, app Expo en `mobile/` (migración 0830 escrita, SIN APLICAR).
- `docs/arquitectura-y-scripts.md` – scripts Python, estructura de carpetas, archivos clave.
- `docs/historico-resultados.md` – cifras de 2025 y colores originales (histórico, no vigente).
- `docs/FLUJO_DE_TRABAJO_IA.md` – cómo trabajamos con Claude Code en este repo y por qué.
- `web/docs/ROLES_AND_PERMISSIONS.md` – roles y permisos.

## Al compactar el contexto

Conservar siempre: lista de archivos modificados, comandos de verificación ejecutados y su resultado,
decisiones del dueño tomadas en la sesión y cifras de costo de Google autorizadas.
