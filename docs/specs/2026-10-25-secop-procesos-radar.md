# Spec: procesos de SECOP II sin contrato como radar comercial (mapa y ficha)  (2026-10-25)

**Estado**: migración 0890 aplicada y carga inicial hecha el 2026-10-25 (2.203 procesos; radar de 12 meses: 817 procesos en 89 entidades); código en la rama `feat/secop-procesos`, sin desplegar. Aprobada en lo general por el dueño el 2026-10-25 ("Sí, entonces busquemos la forma de presentarlos"). Los
detalles siguen las recomendaciones de "Para decidir"; el dueño puede cambiarlas antes del despliegue. Reemplaza en parte a
`docs/specs/2026-10-12-secop-procesos-abiertos.md`: toma su capa de datos, corregida, y deja para después la pestaña
"Licitaciones" de `/inteligencia`. Decisión: `docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md`.

## Problema

83 de las 141 IPS públicas de OpMap publican sus compras en SECOP II solo como **procesos** ("Contratación régimen
especial", dataset `p6dx-8zbt`). Nunca crean el contrato electrónico, que es lo único que OpMap carga: SECOP II Contratos
`jbjy-vk9h`, SECOP I `f789-7hwg` e Integrado `rpmr-utcd`. Por eso la tarjeta del Hospital Universitario del Caribe y la de
Montería dicen "Sin contratos…", aunque el hospital sí compra.

Ejemplo real: el proceso CO1.REQ.10254526 (referencia 000039-2026) del Hospital Universitario del Caribe se publicó el
2026-03-10. Es de osteosíntesis, con precio base de 1.760 M, y en él figura VG MEDICAL SAS (NIT 901080496). Con las
palabras del dueño: "para cualquiera tener el radar a VG Medical para el Hospital Universitario del Caribe sería muy
bueno […] por lo menos le das herramienta al comercial para que se pregunte quién es VG Medical. ¿Será que sí es verdad
que tiene ese contrato?".

## Resultado esperado

1. **Tarjeta de IPS y de municipio o localidad en el mapa: súper concisa, solo los nombres de las empresas** (dueño,
   2026-10-25: "que sea súper conciso; la idea es que vea el nombre de las empresas con potencial, ya no tanta data").
   Debajo de "Compras públicas…" aparece **"Empresas en procesos sin contrato (SECOP II) · <ventana de 12 meses>"**:
   - una empresa por línea, en negrita, con el número de procesos si figura en más de uno ("OSTEOEQUIPOS SAS (2)"); las
     que figuran en más procesos primero; 6 visibles y "Ver las N empresas";
   - agrupadas por NIT y, sin NIT, por nombre normalizado ("VG MEDICAL S.A.S" = "VG MEDICAL SAS"); personas naturales nunca;
   - si hay procesos sin empresa: "3 procesos sin empresa publicada" (o "y 2 procesos sin empresa publicada" bajo la lista);
   - aviso corto: "Figuran en procesos publicados sin contrato registrado. Confirmar con la entidad.";
   - sin precio base, fechas, referencias ni enlaces (eso está en la ficha de la IPS, botón "Ver ficha");
   - **Si no hay procesos, la sección no aparece.**
2. **Ficha de la IPS.** Lleva una tarjeta aparte, "Procesos publicados sin contrato (SECOP II)", con los mismos campos,
   ventana de 24 meses, 5 filas visibles y como máximo 50.
3. **Nunca se suman los precios base**, ni entre sí ni con las compras. Las compras, el ranking, `/inteligencia` y
   `secop_hechos` no cambian.
4. **Quién lo ve.** Hay un permiso nuevo, `secop:procesos`. Lo tienen los roles con `intelligence:view` y, además, los
   Ejecutivos Comerciales (`sales_manager`).
   - Quien tiene `secop:procesos` pero no `intelligence:view` ve en la tarjeta del mapa solo esta sección, sin giros ni
     compras, y en la ficha solo la tarjeta de procesos.
   - Quien no tiene ninguno de los dos ve la tarjeta de siempre, sin llamadas extra.
5. **Carga diaria automática.** La fuente nueva es `secop_procesos`, con cron 06:30 UTC. Relee los últimos 120 días y
   hace upsert. La primera carga, de 24 meses, se corre con un script. Sale en "Fuentes de datos" con "Actualizar ahora".
6. **Privacidad.**
   - Ninguna persona natural se nombra ni se guarda con documento; solo su hash.
   - La descripción se guarda redactada: el nombre y el documento de un paciente se reemplazan por "[dato personal
     omitido]".
   - El título del proceso (`nombre_del_procedimiento`) nunca se muestra tal cual.

## Criterios de aceptación (se convierten en pruebas)

**Mapeo y reglas, sin red** (`scripts/secop-procesos-check.ts`):
- [ ] La fila real CO1.REQ.10254526 se mapea así:
  - `estado = 'publicado'`, `linea = 'trauma'` y `lineas` incluye `neurocirugia`;
  - `precio_base = 1760000000`, `fecha_publicacion = '2026-03-10'` (texto 'YYYY-MM-DD', sin hora);
  - `portafolio = 'CO1.BDOS.10084716'` y `notice_uid = 'CO1.NTC.10111634'`;
  - proveedor VG MEDICAL SAS con NIT 901080496 y `proveedor_origen = 'nit'`;
  - `url` es la del expediente.
- [ ] Las tres filas de Montería del 2026 (CTO-015, CTO-543 y CTO-1116) quedan `publicado`, en trauma, y sin proveedor.
- [ ] Estados:
  - "Publicado" pasa a `publicado`; "Evaluación" a `evaluacion`;
  - "Seleccionado" pasa a `seleccionado`, o a `adjudicado` si `adjudicado = 'Si'`;
  - "Abierto" pasa a `abierto`;
  - "Cancelado" o "Suspendido" pasan a `cancelado`;
  - "Borrador", "En aprobación" y "Aprobado" no se guardan.
- [ ] Proveedor que figura, en este orden:
  - (a) `nit_del_proveedor_adjudicado` con NIT de empresa;
  - (b) `nombre_del_proveedor` con marca de persona jurídica (SAS, S.A., LTDA, UNION TEMPORAL…);
  - (c) `nombre_del_procedimiento` con marca jurídica y sin verbo de objeto (SUMINISTRO, PRESTACION, COMPRA…), con
    `proveedor_origen = 'titulo'`. Nunca la propia entidad compradora: ni su nombre ni un título cuya única marca es
    E.S.E. o IPS (revisión del 2026-10-25).
  - En (b) y (c), un nombre con un dato personal (CC, cédula, un número de 6 o más dígitos, "PACIENTE", "SEÑOR(A)"…) no
    se guarda, y de "NOMBRE APELLIDO / EMPRESA SAS" solo queda el tramo con marca jurídica (revisión del 2026-10-25).
  - Una cédula o un nombre sin marca jurídica nunca se guardan como nombre: `es_persona = true` y solo el hash cuando hay
    documento.
- [ ] Un proceso que solo clasifica por UNSPSC (`motivo = 'unspsc'`, sin texto ortopédico) no se guarda. Esto evita el
      ruido de Yolombó. Los servicios de médicos (`motivo = 'servicio'`) tampoco.
- [ ] La redacción de pacientes reemplaza "PARA EL PACIENTE <NOMBRE> IDENTIFICADO CON CEDULA <NUM>" y no toca
      "PACIENTES" genérico ni números de contrato o resolución.
- [ ] La URL SoQL de una tarea lleva:
  - `nit_entidad in (…)`, con las variantes de 9 dígitos y de 10 con DV, sin guion;
  - el prefiltro ortopédico sobre `nombre_del_procedimiento` y `descripci_n_del_procedimiento`, y
    `codigo_principal_de_categoria like 'V1.4232%'`;
  - `fecha_de_publicacion_del >= desde`.
- [ ] Un proceso con varias filas (lotes) queda en una sola fila por `id_proceso`. El mismo proceso leído dos veces se
      actualiza en su sitio.

**Lectura y pantallas** (`mapa-detalle-check`, `mapa-detalle-api-check` y una prueba nueva de la ficha):
- [ ] Un proceso cuyo `portafolio` está en `secop_contratos.proceso`, o cuyo `notice_uid` está en la `url` de un contrato
      de la misma entidad, no sale en la sección.
- [ ] Solo salen los estados `publicado`, `evaluacion`, `abierto` y `seleccionado` sin contrato. `cancelado` y
      `adjudicado` no salen.
- [ ] La tarjeta del municipio reúne los procesos de las IPS públicas del territorio y la de la IPS solo los de su NIT.
      La ventana es de 12 meses por fecha de publicación, desde el primer día de hace 11 meses hasta hoy, igual que SECOP
      en el mapa.
- [ ] Si la tabla o la vista no existen, las rutas responden 200 con `procesos: null`. Así el código puede desplegarse
      antes que la migración.
- [ ] `sales_manager` recibe 200 en las rutas del mapa con `alcance = 'procesos'`, `giros` y `compras` en null y la lista
      de procesos. Un rol sin `secop:procesos` ni `intelligence:view` recibe 403 sin que se lea ninguna tabla.
- [ ] Ninguna respuesta lleva el título del proceso, un documento, un hash ni un nombre de persona natural. Ningún texto
      visible dice "abierto", "en curso", "licitación", "adjudicado a", "sin compras", "KAM", "panel" ni "representante".
- [ ] `loadSecopActualizado` ("SECOP actualizado el…" de compras) solo mira las tres fuentes de contratos.

## Fuera de alcance

- La pestaña "Licitaciones" de `/inteligencia`, los procesos ganados y perdidos por proveedor y las alertas de cierre (spec
  del 2026-10-12, para después).
- Mostrar los procesos a los Ejecutivos Comerciales en `/inteligencia`, o darles las compras de SECOP: decisión aparte.
- La limpieza de nombres de pacientes en `secop_contratos.objeto`, que ya está guardado: tarea aparte, ya propuesta.
- Avisar cuando `jbjy-vk9h` llega casi vacío y recargar el histórico de HOCEN: asuntos aparte.

## Impacto

- **Datos / migración.** `database/migrations/2026-10-25_0890_secop_procesos.sql`, con rollback
  `2026-10-25_9949_secop_procesos_rollback.sql`. Es solo aditiva:
  - Tabla `secop_procesos`. No tiene columnas `valor` ni `fecha_firma`, para que nadie la sume como compra.
  - Vista `secop_procesos_radar`, con `security_invoker`: estados del radar y sin contrato cargado de la misma entidad.
  - Índices. RLS activado sin políticas y permisos solo para `service_role`.
  - Fila `secop_procesos` en `fuentes_estado`.
  - No toca `secop_contratos`, `secop_contratos_unicos` ni `secop_hechos`.
- **Carga.** La inicial es de unos 10.600 registros prefiltrados en 24 meses: 3 a 6 peticiones a datos.gov.co, de minutos.
  La diaria hace 1 a 3 peticiones. Costo de Google: 0.
- **Estética del mapa.** No cambian colores, capas ni marcadores. Cambia el contenido de las tarjetas: una sección nueva,
  como la de giros y compras del 2026-10-24.
- **Permisos.** `secop:procesos` nuevo, para admin, commercial_director, line_leader, data_manager, viewer y
  sales_manager.

## Plan (archivos e interfaces)

- `web/lib/secop-procesos.ts`, puro:
  - tipos, `ProcesoRow`, `estadoDeProceso`, `proveedorQueFigura`, `redactarDatosPersonales`, `mapSecopProceso`,
    `buildProcesosUrl`;
  - reutiliza `normalizeNit`, `variantesNit`, `esNitJuridico`, `esDocumentoPersona`, `pasaPrefiltro`,
    `SECOP_PREFILTRO_RAICES` y `clasificarContrato` de `lib/secop.ts`, y `hashDocumento`.
  - No se añade la fuente al tipo `SecopFuente`.
- `web/lib/secop-procesos-sync.ts`:
  - una pasada reanudable con tareas por lotes de 50 NIT y el cursor en `fuentes_estado`;
  - modos `inicial` (24 meses) e `incremental` (120 días);
  - agrega los lotes por `id_proceso` y hace upsert en lotes de 500.
- Fuente automática:
  - `lib/fuentes-estado.ts`: `secop_procesos`, `'30 6 * * *'`;
  - `lib/fuentes-runner.ts`: rama propia, para que no caiga en MinSalud;
  - `app/api/fuentes/_lib/catalogo.ts`: texto de `COMO`;
  - `vercel.json`: cron;
  - `scripts/secop-procesos-load.ts`: `--inicial`, `--dry-run` y `--max-paginas`.
- `app/api/secop/_lib/secop-server.ts`:
  - `loadProcesosRadar({ nits, desde, hasta, limite })` lee `secop_procesos_radar` y devuelve [] si no existe;
  - `loadSecopActualizado` se limita a `secop_ii`, `secop_i` y `secop_integrado`.
- Mapa:
  - `lib/types/mapa-detalle.ts`: `ProcesoDetalle`, `ProcesosDetalle`, `procesos` y `alcance` en `TerritorioDetalle` e
    `IpsDetalle`;
  - `lib/mapa-detalle.ts`: `resumirProcesos` y textos;
  - `app/api/map/_lib/detalle-server.ts` y las dos rutas: permiso `intelligence:view` o `secop:procesos`;
  - `app/api/map/data/route.ts`: `procesosIncluidos`;
  - `components/MapComponent.tsx`: pide el detalle si hay inteligencia o procesos;
  - `components/MapPopups.tsx`: `ProcesosSection`.
- Ficha:
  - `GET /api/secop/hospital/[id]/procesos`, con `secop:procesos` y 24 meses;
  - `components/HospitalProcesosCard.tsx`, en la página de la IPS.
- Permisos: `lib/permissions.ts` y `web/docs/ROLES_AND_PERMISSIONS.md`.
- Pruebas:
  - `scripts/secop-procesos-check.ts`, nueva;
  - `mapa-detalle-check`, `mapa-detalle-api-check` y `secop-check` ajustadas;
  - `scripts/secop-procesos-api-check.ts`, nueva, para la ruta de la ficha;
  - todas en `npm run test`.
- Docs:
  - `docs/fases/fase5-secop.md`, sección "Procesos (radar)";
  - `docs/fases/fase5-fuentes-automaticas.md`;
  - `docs/mapa-estetica.md`;
  - CLAUDE.md;
  - nota en la spec del 2026-10-12.

## Para decidir (dueño). Se construye con la recomendación

1. **Ejecutivos Comerciales**: ven los procesos, con el permiso nuevo, pero no las compras ni `/inteligencia`.
   **Recomendación**: sí. Es el radar que pidió para el comercial.
2. **Precio base**: se muestra por proceso y nunca sumado. **Recomendación**: sí. Sumarlo parecería una compra.
3. **Proveedor sacado del título del proceso**: se muestra con la etiqueta "según el título del proceso" cuando lleva marca
   de empresa. A veces el título trae una empresa que no es el proveedor. **Recomendación**: mostrarlo con esa etiqueta;
   el objetivo es que el comercial pregunte.
   *Ajuste del 2026-10-25 ("súper conciso"):* la etiqueta se conserva en la ficha; en la tarjeta del mapa la empresa sale
   sin ella, con el aviso general "Figuran en procesos publicados sin contrato registrado. Confirmar con la entidad."
4. **Estados**: entran "Publicado", "Evaluación", "Abierto" y "Seleccionado" sin contrato cargado.
   **Recomendación**: sí.
5. **Ventanas**: 12 meses en el mapa y 24 en la ficha, como las compras. **Recomendación**: sí.

## Verificación final

- `npm run check`.
- `scripts/secop-procesos-load.ts --dry-run --max-paginas 1`, con el proceso del HU del Caribe mapeado.
- Con autorización: migración 0890, carga inicial y capturas de escritorio y de celular de la tarjeta del HU del Caribe,
  la de Montería y la ficha, con admin y con un Ejecutivo Comercial.

## Rendimiento (2026-10-25, después de la carga)

Con datos reales, la vista de la 0890 tardaba 7,85 s en Medellín (49 NIT, 324 procesos): el NOT EXISTS con OR y LIKE
recorría los 18.068 contratos del Hospital General por cada proceso. La migración `2026-10-25_0891_secop_procesos_radar_rapida.sql`
(rollback `9950`) agrega dos índices en `secop_contratos` ((nit_entidad, proceso) y (nit_entidad, noticeUID exacto de la
url)) y reescribe la vista con dos NOT EXISTS de igualdad: 2,9 ms, el mismo resultado (la migración lo comprueba sobre
todas las filas). Además, la revisión de "contratos en el histórico" de las IPS sin decidir va en una sola tanda de hasta 25
consultas en paralelo (antes, tandas de 10 en serie). Tarjetas medidas desde Colombia (cada consulta ≈ 0,13 s de red):
Medellín 9,5 s → 1,4 s; Cartagena 1,5 s → 1,2-1,3 s; IPS ≈ 0,7-0,8 s. En producción (Vercel iad1, Supabase us-east-2) la
red por consulta es ≈ 10 veces menor.
