# Spec: PR 7 – compras públicas (SECOP) y fuentes de datos automáticas  (2026-10-11)

**Estado**: implementada (PR pendiente). Rama `feat/secop-compras-publicas`, creada desde `master` (c219a4c).
Las migraciones 0710 y 0720 ya están **aplicadas** en Supabase (proyecto norvxqgohddgsdkggqzq); las dos son
aditivas y tienen rollback (9930 y 9929). La carga inicial real de SECOP ya corrió.

Detalle: `docs/fases/fase5-secop.md` (fuentes, alcance, clasificación, privacidad, API, cómo añadir un NIT
vigilado) y `docs/fases/fase5-fuentes-automaticas.md` (cron, GitHub Actions, secretos, panel, carga
reanudable). Migraciones: `database/migrations/README.md`.

## Problema
OpMap no sabía qué compran las IPS públicas en material ortopédico, a qué proveedores ni qué especialistas
contratan. Además, todas las cargas de datos (REPS, BDUA, cifras de MinSalud, ADRES) se habían corrido a mano.

Pedido del dueño (2026-10-11): "Dale. Pero… ¿estamos haciendo algo que consulte estas fuentes y esté
actualizado?".

## Resultado esperado
- Contratos de SECOP II (jbjy-vk9h) y SECOP Integrado (rpmr-utcd) de las IPS públicas o mixtas de OpMap
  (material ortopédico por línea, proveedores vigilados y médicos especialistas), y todos los contratos de los
  76 proveedores vigilados de Odoo con cualquier entidad.
- Ficha de IPS pública: tarjeta "Contratación pública (SECOP)" con KPIs por línea a 24 meses, gráfico anual,
  proveedores (marca "Vigilado"), médicos contratados y enlace al expediente. IPS privada: una línea.
- `/inteligencia`: pestaña "Compras públicas" (filtros, ranking por hospital, proveedor, zona o ejecutivo,
  tabla proveedor × hospital, CSV), lista vigilada (admin) y pestaña "Fuentes de datos" (admin) con estado,
  último OK, filas, siguiente ejecución y "Actualizar ahora".
- Cargas automáticas: Vercel Cron para las ligeras (SECOP II diario, Integrado semanal, REPS, BDUA y cifras
  de MinSalud mensuales, más un cron "continuar") y GitHub Actions mensual para la ADRES.

## Criterios de aceptación (se convierten en pruebas)
- [x] NIT a 9 dígitos desde '900294380', '9002943801' y '900.294.380-1' (`secop-check`).
- [x] Clasificación por línea con objetos reales (46 casos, entre ellos los de la revisión: aneurisma de aorta
      fuera de neurocirugía, ítems "tornillo cortical" / "placa tibia" / "clavo intra medular" a trauma,
      tornillos de cotilo a reemplazo y tornillo interferencial a deportiva) (`secop-check`).
- [x] Prefiltro SoQL de la carga inicial = superconjunto de la clasificación (`secop-check`).
- [x] Especialidad del médico y exclusión de otros roles (auxiliar, instrumentación, médico general…).
- [x] Personas naturales sin documento en claro: CHECK en la tabla y SELECT = 0 filas.
- [x] Atípicos: > 50.000 M o > p99 de la entidad con 100+ contratos (`esAtipico` = `secop_marcar_atipicos`).
- [x] Mapeo de filas de los dos datasets con fixtures literales y cursor incremental (pasadas, reanudación,
      tiempo agotado, NIT nuevos con histórico) (`secop-check`).
- [x] Agregaciones de la API por grupo y línea, ranking, filtros, reparto de SECOP I y "fuera de escala"
      (`secop-api-check`).
- [x] `/api/cron/<fuente>`: sin `CRON_SECRET` → 503; sin cabecera o Bearer erróneo → 401; fuente desconocida
      → 404; con secreto corre la carga con presupuesto de 50 s y deja cursor en `fuentes_estado`.
- [x] "Actualizar ahora" llama al mismo `ejecutarFuente` que el cron (solo admin, `fuentes:manage`).

## Fuera de alcance
- SECOP II Procesos (p6dx-8zbt, licitaciones abiertas como oportunidades).
- Dental, oftálmico y cardiovascular (excluidos salvo que el dueño lo pida).
- Cambios en el algoritmo de asignación, en la cobertura o en la estética del mapa.

## Impacto
- Datos / migración: `2026-10-11_0710_secop.sql` (4 tablas, vista `secop_contratos_unicos`, funciones
  `secop_nits_ips()` y `secop_marcar_atipicos()`; rollback `9930_secop_rollback.sql`) y
  `2026-10-11_0720_secop_api.sql` (función `secop_hechos()`; rollback `9929_secop_api_rollback.sql`, antes
  de 9930). Todo con RLS, sin políticas y solo service_role. Aplicadas.
- Costo Google Maps: 0 (no se usa Google). datos.gov.co es gratuito.
- Estética del mapa: no cambia.
- Permisos: nuevo `fuentes:manage` (solo admin). Lectura de SECOP con `intelligence:view`.
- Configuración que debe crear el dueño: `CRON_SECRET` en Vercel (Production) y los secretos
  `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en GitHub (Actions). Sin ellos las cargas
  automáticas quedan apagadas; "Actualizar ahora" sí funciona.

## Reglas que el dueño debe confirmar
1. SECOP I repite el valor del proceso en cada contratista: la API lo cuenta una vez y lo reparte por partes
   iguales (total SECOP I de $ 5,09 a $ 3,82 billones según S2).
2. Solo los contratos de más de 50.000 M ("fuera de escala") no suman; los que superan el p99 de su entidad
   suman y llevan la marca "valor alto".
3. Clasificación v2 (revisión del 2026-10-11): los ítems de osteosíntesis con calificativo cuentan como
   trauma (1.135 contratos que antes iban a "sin clasificar") y el aneurisma de aorta no es neurocirugía
   (18 contratos salieron del alcance).

## Plan (archivos e interfaces)
- `web/lib/secop.ts` (puro), `web/lib/secop-hash.ts`, `web/lib/secop-sync.ts`, `web/scripts/secop-load.ts`,
  `web/scripts/secop-reclasificar.ts`.
- `web/lib/fuentes-estado.ts`, `web/lib/fuentes-runner.ts`, `web/app/api/cron/[fuente]/route.ts`,
  `web/vercel.json` (crons), `.github/workflows/datos.yml`, `web/scripts/fuente-estado.ts`.
- REPS, BDUA y cifras pasados a lib (`reps-sedes-sync.ts`, `bdua-sync.ts`, `cifras-sync.ts`,
  `poblacion-db.ts`) sin cambiar el comportamiento de sus scripts.
- API: `web/app/api/secop/*`, `web/app/api/fuentes/*`; lógica pura en `web/lib/compras-publicas.ts`.
- UI: `HospitalSecopCard`, `SecopAnnualChart`, `IntelligenceSecop`, `SecopVigilados`, `FuentesDatosPanel`;
  pestañas en `web/app/inteligencia/page.tsx`.
- Pruebas: `web/scripts/secop-check.ts` y `web/scripts/secop-api-check.ts` (en `npm run test`).

## Verificación final
- `cd web && GOOGLE_ROUTES_DISABLED=true npm run check` → EXIT=0 (secop-check 199, secop-api-check 137).
- `npx next build` → EXIT=0 (rutas `/api/cron/[fuente]`, `/api/fuentes*`, `/api/secop/*`).
- SELECT tras la revisión: 45.547 contratos sin duplicados (2005-03-04 a 2026-10-08), 116 de 131 entidades
  objetivo con datos, 54 de 76 vigilados con contratos, 799 médicos distintos, 449 atípicos, 0 personas con
  documento en claro, todas las filas en `clasificacion_version = 'v2'`.
- Capturas de escritorio y celular: ficha del Hospital Militar Central, "Compras públicas" y "Fuentes de
  datos" (scratchpad `shots-rev7/`).
