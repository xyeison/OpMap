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
8. Método de trabajo: skills de Superpowers copiadas en `.claude/skills/` (brainstorming, writing-plans,
   test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review…;
   `docs/superpowers.md`). Este archivo manda sobre ellas: PR con `/entregar`, no merge local.

## Reglas que no se deducen del código (IMPORTANTE)

- **Terminología en la UI**: persona → "Ejecutivo Comercial", territorio → "Zona", hospital → "IPS" (dueño, 2026-10-29;
  la ruta `/hospitals` y la tabla `hospitals` no cambian). El menú va por grupos (Terceros, Empleados, Inteligencia de
  Mercado, Configuración: `docs/specs/2026-10-29-menu-por-grupos.md`). Las Regiones (tabla `zones`)
  se quitaron de la interfaz el 2026-10-14; la tabla queda sin uso. Nunca "KAM" en texto visible. En código siguen
  `kams`, `kam_id`, rutas `/kams`.
- **Modelo**: cada fila de `kams` es una ZONA (ciudad base = `area_id`), no una persona. Personas =
  `executives`; líneas de negocio = `business_lines`; quién cubre cada zona por línea = `coverage`.
- **Unidades**: `travel_time` en `assignments` y `hospital_kam_distances` está en SEGUNDOS. Minutos solo
  en `kams.max_travel_time` y `business_lines.max_reach_minutes`. Coordenadas con 6 decimales.
- **Bogotá en 4 sectores** (dueño, 2026-10-28, `docs/decisiones/2026-10-28-bogota-4-sectores.md`): Zonas "Bogotá Norte, Occidente, Sur y Oriente"; dentro de Bogotá cada IPS va a la Zona del sector (corredor) de su localidad (`CORREDOR_DE_LOCALIDAD`), sin minutos, antes del territorio base y después de las forzadas. **Hacia afuera** compite como UNA ciudad: mejor tiempo entre sus celdas, tope único `bogota_config.max_travel_minutes` (no el `max_travel_time` de cada celda; 380 min, 6 h 20, desde el 2026-10-28: `docs/decisiones/2026-10-28-bogota-tope-380.md`) y la celda la decide el corredor del municipio (`bogota_corredores` + `bogota_config.grupos`), no los minutos (`docs/algoritmo-asignacion.md`). Vale para las IPS y, desde el 2026-10-28, también para los municipios sin IPS (`lib/municipality-coverage.ts`, `docs/decisiones/2026-10-28-municipios-por-corredor-de-bogota.md`). Guardar la configuración no recalcula.
- **Municipios sin IPS** se reparten por tiempo REAL de carretera (Google, driving). Nunca por línea
  recta. Sin ruta → `no_road` (nadie); sobre el tope de la zona → `out_of_reach` (nadie).
- **Google Maps cuesta dinero** (0,005 USD/elemento). Solo llama `web/lib/google-distance.ts` y los flujos
  documentados (`process-pending`, `ensure-routes`, `scripts/fase2b-municipios.ts --run`,
  `scripts/tiempos-bogota-refrescar.ts --run` y `scripts/zona-punto-base-tiempos.ts --run`, que REEMPLAZAN tiempos
  guardados). Cualquier
  llamada nueva o masiva: dry-run con cifra y autorización explícita del dueño antes. Los tiempos de IPS
  (`hospital_kam_distances`) son de agosto de 2025: si uno se ve raro, puede ser una vía cerrada ese mes.
- **Crear/editar/activar una IPS NO recalcula** la asignación: queda en la cola de pendientes y el dueño
  decide cuándo correr "Calcular rutas y asignar pendientes" (ver `docs/ips-pendientes.md`).
- **Estética del mapa**: estilo autorizado por el dueño el 2026-10-11 (`web/components/mapStyles.ts`,
  detalle en `docs/mapa-estetica.md`). No añadir capas, marcadores (incluidos los de población 👥) ni
  cambiar colores/opacidades sin autorización explícita. Desde el 2026-10-28 las dos vistas (Zonas y Ejecutivos
  Comerciales) pintan cada Zona con su color (`kams.color`); el color de la persona ya no se usa en el mapa. Desde el
  2026-10-29 la lista de personas (o Zonas) va UNA vez, en la leyenda, y al tocarla hace "Ver solo" (lo demás casi
  blanco, `lib/mapa-ver-solo.ts`); "Ver por", línea, "Mostrar" e IPS van en Filtros, y hay un solo buscador sobre el
  mapa (municipio, departamento, localidad o IPS; `docs/specs/2026-10-29-mapa-filtros-y-leyenda.md`).
  Los polígonos son los del MGN 2025 del DANE (2026-10-29): los genera `scripts/build-geojson.ts` (vista de país
  liviana y `public/geo/detalle/<dd>.json` desde zoom 10) y no se editan a mano.
- **El mapa muestra giros ADRES y compras SECOP de 12 meses, no los contratos cargados a mano** (dueño, 2026-10-24, `docs/decisiones/2026-10-24-mapa-giros-y-compras.md`): las tarjetas de municipio, localidad e IPS piden `GET /api/map/detalle/*` al abrirse, solo con `intelligence:view` (`/api/map/data` ya no lee `hospital_contracts` ni manda contratos; "Solo con Contratos" y la fila "Contratos" se quitaron; `contracts:view` no influye en el mapa); ventana única `MAPA_VENTANA_MESES = 12` (giros hasta el último mes cargado, SECOP hasta hoy; la ficha y `/inteligencia` siguen en 24); solo material de las 6 líneas, con "sin clasificar", especialistas y personas naturales aparte, contados y sin nombres; nunca "sin compras"; los globos siguen sin cifras y la estética no cambia (salvo el alto máximo de la tarjeta, con desplazamiento). Migración 0880 (`adres_giros_nits`) APLICADA el 2026-10-25. Desde el 2026-10-25 (`docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md`) debajo de las compras va "Procesos publicados sin contrato (SECOP II)" (vista `secop_procesos_radar`, migración 0890 APLICADA el 2026-10-25 y carga inicial de 24 meses hecha: 2.203 procesos; fuente diaria `secop_procesos`; la 0891, aplicada ese día, le pone índices de igualdad a "ya tiene contrato": sin ellos la tarjeta de Medellín tardaba 8 s): solo IPS públicas, 12 meses por fecha de publicación, máximo 20, precio base por proceso y nunca sumado, proveedor que "figura" (nunca "adjudicado a"); las rutas aceptan `intelligence:view` O `secop:procesos` y con solo `secop:procesos` (Ejecutivos Comerciales) responden `alcance: 'procesos'` sin giros ni compras (`/api/map/data` manda `procesosIncluidos`).
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
- **Solo el administrador y la dirección comercial asignan** (dueño, 2026-10-29, `docs/decisiones/2026-10-29-solo-admin-y-direccion-asignan.md`): dar o quitar líneas en Zonas, ajustes de cobertura, editar líneas, anexos y visitantes; la líder de negocio y el Ejecutivo Comercial son de consulta (conservan lo que usa la app de visita). Perfiles: Administrador, Director comercial (Laura Beltrán), Líder de negocio, Ejecutivo comercial. Lo que sigue de la regla del 2026-10-23 vale, salvo que la líder ya no asigna.
- **Las líderes asignaban su línea por Zona** (dueño, 2026-10-23, `docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md`; desde el 2026-10-29 lo hacen la dirección o el administrador): en `/kams` ("Zonas") se da o quita una línea a quien vive en la Zona, persona o vacante (una vacante ES una persona autorizada por la gerencia: compite por alcance igual); la dirección puede fijar "líneas permitidas" por persona (`executive_allowed_lines`, 0860 APLICADA el 2026-10-23; el 2026-10-24 el dueño quitó todas: hoy nadie está restringido y todas pueden tener todas las líneas; sin filas = sin restricción; la API rechaza líneas fuera); si otra persona de la misma Zona ya lleva la línea, Zonas avisa y ofrece pasarla de una a la otra en un paso; la celda sin nadie se llama "Sin cobertura" (nunca "Vacante") y en el mapa por línea va en gris con un tono por Zona (`grisDeZona`, autorizado el 2026-10-23); la 0870 BORRA `executive_lines` con respaldo (`executive_lines_respaldo_20261023`) y solo se aplica con autorización del dueño, seguida del recálculo.
- **Visitas de VMO = puente del mapa de calor** (dueño, 2026-10-29, `docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md`):
  en `/visits` se sube el Excel de VMO › Visitas; entran solo las hechas ("Visita realizada" y "Visita extra") con
  coordenadas, con fecha real y por persona (llaves `visits.vmo_id` y `executives.vmo_nombre`; si la persona no existe se
  crea, activa si visitó en 60 días; la Zona de la visita sigue a la de la persona); nada del médico sale del navegador;
  reimportar no duplica. Sin `visits:view` cada quien ve solo sus visitas de VMO. Sin IPS por visita. Migración 0910
  (rollback 9956).
- **Seguimiento de las líderes con el Excel "Tracker Líderes"** (dueño, 2026-10-29, `docs/decisiones/2026-10-29-historico-tracker-lideres.md`;
  reemplaza la A15 del 2026-10-15): en `/lideres` (permiso `lideres:seguimiento`: admin y dirección) la directora sube el
  Excel; el navegador manda solo fecha, líder, ciudad, tipo, estado, cuántos contactos y si había observación (ningún
  texto libre: ni nombres de médicos, ni observaciones, ni el tipo escrito a mano) y cada carga reemplaza el histórico
  (`lideres_historico`, migración 0920 APLICADA el 2026-10-29; su DELETE lleva WHERE por pg-safeupdate de PostgREST). Cuando las líderes reporten en la app (PR #48 y sus fases), se deja de subir el Excel.
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
- `docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md` – app de visita F3+F4: visitas de la app en `visits` + `visit_lines`, `visitas_registrar/editar/anular`, `/api/me/*` (contexto, visitas, voz, números), token de portador, app Expo en `mobile/` (migración 0830 aplicada 2026-10-14); F4.1 agenda (`visitas_agenda`, `/api/me/agenda*`, `/api/me/voz/campos`; 0840 aplicada 2026-10-14); desde 2026-10-15 la cita lleva hora obligatoria y la agenda es un calendario, y `/api/me/*` mide con `Server-Timing` y líneas `[tiempos]` (`docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md`).
- `docs/arquitectura-y-scripts.md` – scripts Python, estructura de carpetas, archivos clave.
- `docs/historico-resultados.md` – cifras de 2025 y colores originales (histórico, no vigente).
- `docs/FLUJO_DE_TRABAJO_IA.md` – cómo trabajamos con Claude Code en este repo y por qué.
- `docs/superpowers.md` – skills de Superpowers (obra) instaladas en el repo: versión, hook de inicio, precedencia y cómo actualizar.
- `web/docs/ROLES_AND_PERMISSIONS.md` – roles y permisos.

## Al compactar el contexto

Conservar siempre: lista de archivos modificados, comandos de verificación ejecutados y su resultado,
decisiones del dueño tomadas en la sesión y cifras de costo de Google autorizadas.
