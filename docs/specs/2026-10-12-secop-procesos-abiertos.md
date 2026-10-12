# Spec: procesos de compra abiertos y adjudicados de SECOP II (tubería de licitaciones)  (2026-10-12)

**Estado**: aprobada por el dueño por delegación (chat 2026-10-11: "Toma todas las decisiones adicionales tú")
| pendiente de implementar (después del PR de SECOP I valor real)

## Problema
OpMap solo conoce contratos ya firmados. Los **procesos** de SECOP II (dataset `p6dx-8zbt`, "SECOP II -
Procesos de Contratación", 8,7 M de filas, actualización diaria) dicen qué IPS está comprando material
ortopédico **ahora** (fase "Presentación de oferta", estado "Publicado" o "Evaluación"), con qué precio base,
cuándo cierra la recepción de ofertas y, cuando termina, a quién se lo adjudicó y por cuánto. Ejemplo real
(2026-10-11): el Hospital Universitario del Caribe tiene publicado el proceso CO1.REQ.10254526 "Suministro de
material médico quirúrgico de osteosíntesis (ortopedia, maxilofacial, neurocirugía)" con precio base
1.760 M, abierto desde el 2026-03-10, y OpMap no lo muestra. buscadorsecop.com sí lista esos procesos.

TVEC (Tienda Virtual, `rgxm-mmea`) queda descartada: el dataset trae `nit_entidad` "No Definido", solo
720 órdenes con "HOSPITAL" en el nombre y son papelería, software y medicamentos de control especial.

## Resultado esperado
1. En `/inteligencia`, pestaña **"Licitaciones"**: lista de procesos ortopédicos de las entidades objetivo
   (las mismas de SECOP: IPS públicas/mixtas o con `compra_publica = true`), con filtros por estado
   (abiertos / en evaluación / adjudicados / cancelados), línea, departamento y Ejecutivo Comercial
   (por la zona de la IPS), ordenados por fecha de cierre de ofertas. KPIs: procesos abiertos y su valor
   base, adjudicados en los últimos 90 días y su valor, % adjudicado a proveedores vigilados.
2. En la ficha de la IPS, tarjeta **"Procesos en curso (SECOP II)"**: abiertos y en evaluación (nombre,
   línea, precio base, cierra el…, enlace al expediente) y los adjudicados de los últimos 12 meses (proveedor
   ganador, valor adjudicado, fecha). Si no hay nada: "Sin procesos ortopédicos en curso".
3. Un proceso adjudicado enlaza al proveedor (ficha `/api/secop/proveedor/[nit]`) y el proveedor vigilado
   muestra sus procesos ganados y perdidos recientes.
4. Carga diaria automática (cron `secop_procesos`, 06:30 UTC) con la misma mecánica de cursor, prefiltro y
   "Actualizar ahora" que las demás fuentes; fila en "Fuentes de datos".
5. Privacidad: un adjudicatario persona natural se guarda con hash, nunca con documento en claro.

## Criterios de aceptación (se convierten en pruebas)
- [ ] Dado la fila real CO1.REQ.10254526 (precio_base 1760000000, estado "Publicado", fase "Presentación de
      oferta", adjudicado "No", nombre_del_proveedor "VG MEDICAL SAS", nit_del_proveedor_adjudicado
      901080496), cuando se mapea, entonces queda `estado = 'abierto'`, `linea` = trauma (osteosíntesis) con
      `lineas` que incluye neurocirugía, `precio_base = 1760000000`, `valor_adjudicado = null`, proveedor
      candidato VG con NIT, y `url` del expediente.
- [ ] Dado un proceso con `adjudicado = 'Si'`, `valor_total_adjudicacion > 0` y fecha de adjudicación,
      entonces `estado = 'adjudicado'` y el proveedor ganador y su NIT quedan guardados.
- [ ] Dado `estado_del_procedimiento` "Cancelado" o "Suspendido" → `estado = 'cancelado'`; "Evaluación" →
      `'evaluacion'`; "Seleccionado" sin adjudicación registrada → `'seleccionado'`.
- [ ] Dado un adjudicatario con tipo de documento de persona natural, el documento no se guarda; se guarda
      el hash con la sal de `secop_ajustes`.
- [ ] Dado la URL SoQL de una tarea de entidades, filtra por `nit_entidad` (texto, variantes del NIT), aplica
      el prefiltro ortopédico sobre `nombre_del_procedimiento` y `descripci_n_del_procedimiento` y
      `codigo_principal_de_categoria like 'V1.4231%' / 'V1.4232%' / 'V1.4229%'`, y en incremental filtra
      por `fecha_de_ultima_publicaci`.
- [ ] El mismo proceso leído dos veces (publicado y luego adjudicado) se actualiza en su sitio
      (`id_del_proceso` único), sin duplicar.
- [ ] La API de licitaciones devuelve 403 a quien no tiene `intelligence:view`.
- [ ] Regresión: `npm run check` en verde con las pruebas actuales.

## Fuera de alcance
- TVEC (ver arriba), SECOP I procesos (los contratos ya entran por `f789-7hwg`), alertas por correo o
  WhatsApp de cierres próximos (idea para después), procesos de entidades que no son IPS objetivo.
- Estética del mapa: no se toca.

## Impacto
- Datos / migración: sí, `database/migrations/2026-10-1x_0740_secop_procesos.sql` + rollback: tabla
  `secop_procesos` (id_proceso único, referencia, nit_entidad, nombre_entidad, hospital_id, nombre,
  descripcion, fase, estado_secop, estado (abierto | evaluacion | seleccionado | adjudicado | cancelado |
  borrador), adjudicado, modalidad, tipo_contrato, precio_base, valor_adjudicado, proveedor_nombre,
  proveedor_nit, proveedor_hash, proveedor_vigilado_id, es_persona, fecha_publicacion,
  fecha_ultima_publicacion, fecha_cierre_ofertas (`fecha_de_recepcion_de`), fecha_adjudicacion, duracion,
  unidad_duracion, proveedores_invitados, respuestas, lotes, categoria_unspsc, linea, lineas,
  clasificacion_version, url, ultima_actualizacion, imported_at); RLS sin políticas, solo service_role;
  fila `secop_procesos` en `fuentes_estado`.
- Costo Google Maps: 0.
- Estética del mapa: no cambia.
- Permisos: `intelligence:view` para ver; la carga, como las demás fuentes.

## Plan (archivos e interfaces)
- `web/lib/secop-procesos.ts` (puro): tipos, `mapSecopProceso(raw, ctx)`, `estadoDeProceso()`,
  `prefiltroProcesosSoql()`, `buildProcesosUrl()`; reutiliza `clasificarContrato`, `esDocumentoPersona`,
  `normalizeNit`, `variantesNit` de `lib/secop.ts`.
- `web/lib/secop-procesos-sync.ts`: pasada reanudable con el cursor de `fuentes_estado` (mismo patrón que
  `secop-sync.ts`), upsert por `id_proceso` en lotes de 500.
- `web/lib/fuentes-estado.ts` (+ `secop_procesos`, `'30 6 * * *'`), `fuentes-runner.ts`, `catalogo.ts`,
  `vercel.json`, `scripts/secop-procesos-load.ts` (carga inicial y `--dry-run`).
- API: `GET /api/secop/procesos?estado=&linea=&departamento=&line=&ejecutivo=&desde=&hasta=` (KPIs + lista
  paginada), `GET /api/secop/hospital/[id]` añade `procesos` (abiertos/evaluación + adjudicados 12 meses),
  `GET /api/secop/proveedor/[nit]` añade procesos ganados/perdidos recientes.
- UI: `components/HospitalProcesosCard.tsx`, `components/IntelligenceLicitaciones.tsx`, pestaña en
  `app/inteligencia/page.tsx`.
- Pruebas: `web/scripts/secop-procesos-check.ts` (puras, en `npm run test`).
- Docs: `docs/fases/fase5-secop.md` (sección Procesos), `docs/fases/fase5-fuentes-automaticas.md`.

## Verificación final
`npm run check`; dry-run `scripts/secop-procesos-load.ts --dry-run --max-paginas 1` con el proceso del
HU del Caribe mapeado; capturas de escritorio y celular de la pestaña "Licitaciones" y de la tarjeta de la
ficha.
