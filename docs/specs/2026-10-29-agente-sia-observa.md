# Instrucción para Claude Code — Agente SIA Observa en OpMap

> **Primero:** guarda este documento en el repo como `docs/specs/2026-10-29-agente-sia-observa.md`.
> **Después:** ejecútalo de la Fase 0 a la Fase 3 sin detenerte, salvo en dos puntos: mostrar el SQL antes de aplicarlo en Supabase y pedir OK antes de cualquier deploy a producción.
>
> Lo marcado **verificado** se probó el 29-oct-2026 en el navegador del dueño contra el sitio real. Lo marcado **por verificar** lo resuelves tú en la Fase 0.

**Estado**: aprobada por el dueño (2026-10-29) · en implementación en `feat/agente-sia-observa`. Hallazgos de la Fase 0 y
decisiones de implementación al final ("Notas de implementación").

---

## 1. Objetivo

Agregar a OpMap una nueva fuente de datos, `sia_observa`, que:

1. Encuentre en SIA Observa (Auditoría General de la República) los contratos de las IPS públicas que sigue OpMap, en las líneas de negocio: trauma/osteosíntesis, columna, reemplazo articular, medicina deportiva y sustitutos óseos (y neurocirugía, como ya la clasifica SECOP).
2. Descargue y guarde los documentos clave: contrato, estudio previo, anexos, propuesta, adiciones y liquidación.
3. Los lea con Claude, incluidos los PDF escaneados, y extraiga datos estructurados.
4. Permita importarlos al módulo de contratos (`/contracts`, tabla `hospital_contracts`) con revisión humana, y complementar los que ya existen.

Decisiones ya tomadas por el dueño:
- Copia de los PDF clave en Supabase Storage (bucket privado) **y** enlace de SIA como fuente.
- Nada entra a `hospital_contracts` sin que una persona lo apruebe.
- Sin navegador en producción: todo por HTTP. Playwright solo para el mapeo inicial de entidades, en local.

---

## 2. Contexto de OpMap (ya existe, no lo rehagas)

- App Next.js (App Router) desplegada en Vercel, proyecto `op-map`. En local corre en `http://localhost:3000`.
  Rutas relevantes: `/contracts`, `/contracts/new/edit`, `/map`. API: `GET /api/contracts`, `/api/auth/me`, `/api/me/lines`.
- Base de datos: Supabase, proyecto **OpMap** (`norvxqgohddgsdkggqzq`, Postgres 17).
- Ya hay cargas automáticas de datos públicos con un patrón que debes copiar:
  - `secop_contratos` (75.305 filas; SECOP II `jbjy-vk9h`, SECOP I `f789-7hwg`, Integrado `rpmr-utcd`), cargada por `scripts/secop-load.ts` y un cron. Para sumar sin doble conteo se usa la vista `secop_contratos_unicos`.
  - `secop_procesos` (`web/lib/secop-procesos.ts`, `web/lib/secop-procesos-sync.ts`).
  - REPS, ADRES, BDUA y cifras de MinSalud (scripts en `scripts/` y `web/scripts/`).
- Estado de cada carga en `fuentes_estado`: `fuente`, `nombre`, `programacion`, `ejecutor`, `ultimo_ok`, `ultimo_intento`, `estado` (`ok | error | corriendo`), `filas`, `mensaje`, `cursor jsonb`, `siguiente_programado`, `bloqueo_hasta`, `updated_at`. Las cargas corren por Vercel Cron, GitHub Actions o el botón "Actualizar ahora".
- Personas naturales: en SECOP no se guarda el documento en claro; se usa `proveedor_hash` con la sal de `secop_ajustes`. Haz lo mismo.
- Líneas de negocio: tabla `business_lines` con códigos `perossal` (Sustitutos óseos), `reemplazo`, `deportiva`, `columna`, `trauma`. `secop_contratos` tiene `linea`, `lineas[]` y `clasificacion_version` (valores vistos: `trauma`, `neurocirugia`, `no_clasificado`). **Reutiliza el mismo clasificador** sobre el objeto del contrato.
- `hospitals.nit` es el NIT de 9 dígitos sin DV, igual que `entidad_nit` en SIA. Un NIT puede tener varias sedes: asigna `hospital_id` con la misma regla que usa `secop_contratos`.
- `hospital_contracts` (93 filas) es la tabla del módulo de contratos. Columnas:
  `id, hospital_id, contract_value, start_date, duration_months, current_provider, description, active, created_by, created_at, contract_number, contract_type (capita|evento|pgp), end_date, updated_at, provider, contracting_model (contratacion_directa|licitacion|invitacion_privada|subasta_inversa), proveedor_id, requisitos_financieros jsonb, indice_liquidez_requerido, indice_endeudamiento_maximo, cobertura_intereses_minimo, patrimonio_minimo, capital_trabajo_minimo, experiencia_anos_minimo, facturacion_anual_minima, rentabilidad_minima, otros_requisitos, cumple_requisitos, fecha_validacion_requisitos, notas_cumplimiento, requires_liquidez, min_liquidez, requires_endeudamiento, max_endeudamiento, requires_cobertura, min_cobertura, requires_capital_trabajo, min_capital_trabajo, requires_rentabilidad, min_rentabilidad, requires_experiencia, min_experiencia_years, custom_requirements, documents_link`.
- **52 filas** de `hospital_contracts` ya tienen en `documents_link` la ficha de SIA (`/guess/cto_ficha_resumen_guess.aspx?idc=…&ide=…`). Sirven para enriquecer desde el primer día.
- `proveedores` tiene 61 filas y no incluye a Farmaortopédicos: revisa cómo guarda hoy el formulario un proveedor escrito a mano (texto en `provider` / `current_provider` vs `proveedor_id`).

**Antes de escribir código, lee:** el pipeline de SECOP (scripts, crons, clasificador, hash de personas), `vercel.json`, cómo se protegen los crons, cómo se escribe en `fuentes_estado`, el formulario de `/contracts/new/edit` y su API de guardado, y las convenciones de migraciones, comentarios de tablas y RLS del repo (las tablas sensibles son "solo service_role").

---

## 3. SIA Observa: referencia técnica

### 3.1 Acceso de invitado (verificado)

- Base: `https://siaobserva.auditoria.gov.co`. Sin usuario, sin contraseña, sin captcha.
- `Login.aspx?redirect=Inicio` tiene el enlace **"Ingresa como Invitado"** (`href="javascript:;"`). Al pulsarlo el navegador hace `POST Login.aspx?redirect=Inicio` (postback ASP.NET) y aterriza en `/guess/`. Ahí sale un aviso informativo de tratamiento de datos con botón "Continuar"; no pide aceptar nada.
- El sitio es ASP.NET WebForms: ids `ctl00_contentMain_…`, `__VIEWSTATE`, UpdatePanel, jQuery 2.0.3, datepicker de jQuery UI con formato `yy/mm/dd` (= `2026/10/29`) y fecha máxima = hoy.

### 3.2 Contratos de una entidad — el endpoint clave (verificado desde el navegador con la sesión de invitado)

```
POST /guess/informe_cont_ciudadania1.aspx/Get_CTOs_Base
Content-Type: application/json; charset=utf-8

{"ENTIDADES_ID":"<GUID entidad>","txtFechaDesde":"2024/01/01","txtFechaHasta":"2026/10/29"}
```

- Respuesta: `{"d":"<string con JSON>"}` → `JSON.parse(d)` → `{ sEcho, iTotalRecords, aaData: [...] }`. **Sin paginación**: trae todo el rango.
- Tamaños reales:
  - Hospital Regional de la Orinoquía, 2024-01-01 → 2026-10-29: 5.212 contratos, 12 MB.
  - ESE Salud Yopal, 2020 → 2026: 7.326 contratos, 17 MB.
  - Red Salud Casanare, 2020 → 2026: 11.159 contratos, 27 MB, 18 s.
  - → Usa ventanas de **un mes**.
- Campos de cada fila (24):
  - `DT_RowId` — `"cto(12910254)"` → idc = 12910254
  - `entidad_nit`, `entidad_razon_social`
  - `cto_anio`, `cto_code`, `cto_objeto`
  - `cto_fecha_firma`, `cto_fecha_inicio`, `cto_fecha_termino`, `cto_fecha_ampliada` — formato `yyyy/mm/dd`
  - `cto_dias_termino`
  - `cto_valor`, `cto_adiciones`, `cto_liberaciones`, `cto_valor_vigente` — texto tipo `"$65,504,160.00"`
  - `cto_proc` (modalidad, p. ej. `RÉGIMEN ESPECIAL`), `cto_tipol`, `cto_tipologia_tipo` (p. ej. `Contrato de Prestación de Servicios`)
  - `cto_nit_contratistas`, `cto_contratistas`, `cto_tipo_contratistas` — vienen con espacios alrededor; en consorcios pueden venir varios (revisa el formato con fixtures)
  - `cto_fecha_creacion` — `"2024/02/12 07:03:21 PM"`, hora Colombia
  - `cto_estado` — `" Rendido "`
  - `cto_boton_detalle` — HTML de un botón con `location.href='cto_ficha_resumen_guess.aspx?idc=<id>'`
- La mayoría de filas son contratos de prestación de servicios con personas naturales (médicos): filtra temprano y no los guardes.

### 3.3 Catálogo de entidades (GUID) (verificado)

- En `informe_cont_ciudadania1.aspx` hay una cascada **Departamento → Municipio/Ciudad → Entidades en el municipio**. El último select es `ctl00_contentMain_cmbEntidades` y cada `option value` es el GUID. Cada cambio dispara un postback del UpdatePanel. Los ids de los selects de departamento y municipio confírmalos en la página (en `informe_rendidos_guess.aspx` son `ctl00_contentMain_cmbDepartamento` y `ctl00_contentMain_cmbMunicipio`).
- Ids de departamento: Amazonas 29, Antioquia 1, Arauca 25, Atlántico 2, Bogotá D.C. 3, Bolívar 4, Boyacá 5, Caldas 6, Caquetá 7, Casanare 26, Cauca 8, Cesar 9, Chocó 12, Córdoba 10, Cundinamarca 11, Guainía 30, Guaviare 31, Huila 13, La Guajira 14, Magdalena 15, Meta 16, Nariño 17, Norte de Santander 18, Putumayo 27, Quindío 19, Risaralda 20, San Andrés 28, Santander 21, Sucre 22, Tolima 23, Valle del Cauca 24, Vaupés 32, Vichada 33.
- Los municipios usan ids internos, no DANE (Casanare: Yopal 1052, Aguazul 1053 … Villanueva 1070). Cruza por nombre normalizado (puedes reusar `web/lib/municipio-alias.ts`).
- GUID verificados en Yopal:
  - Hospital Regional de la Orinoquía E.S.E — `fbb9612e-dd36-41a0-b4c3-757e281dcaf8` (NIT 891855029; en OpMap `hospitals.id = e7926149-4217-4b3d-9bd1-ef02e826e8f4`)
  - ESE Salud Yopal — `f2e00d42-0a4c-4a73-90e1-4bbe4998ec27`
  - Red Salud Casanare E.S.E. — `e5e3b082-3594-4848-ad7e-99c66ca9c1f2`

### 3.4 Ficha del contrato (verificado)

`GET /guess/cto_ficha_resumen_guess.aspx?idc=<id>` → HTML con estas secciones (encabezados h3/h4):

- Información Básica: objeto, valor inicial / adiciones / vigente, código, modalidad de selección, procedimiento/causal, tipo de contrato, fechas, plazo, vigencia, entidad, estado.
- Vigencias, Rubros, CDP, RP.
- Contratistas: identificación, nombre, tipo, fecha de vinculación.
- Supervisores - Interventores.
- Fechas Registradas: incluye "Fecha de Publicación en el SECOP" con enlace "Ver Pub".
- Documentos de Legalidad Anexados.
- Novedades: Adiciones, Prórroga, Adición/Prórroga, Cesión, Otrosí, Suspensión, Reinicio, Terminación, Liquidación.
- Traza del contrato.

Documentos: `<a href="/handlers/filehandler_guess_anonimo.ashx?ianx=<9 dígitos>&ianxa=<9 dígitos>&eid=<GUID entidad>">nombre.pdf --> 2026/07/09</a>`. Vienen duplicados: deduplica por `(ianx, ianxa)`.

### 3.5 Descarga de documentos (verificado)

- `GET` al handler → `200 application/pdf` con `Content-Disposition: attachment; filename=…`.
- Probado **sin cookies** (fetch con `credentials: 'omit'` desde el navegador): el contrato de 3,2 MB bajó en ~0,4 s. Los ids son estables (`eid` = GUID de la entidad).
- Respuestas que no son PDF (siempre `200 text/html`):
  - **Pide correo para anonimizar**: contiene `bootbox.prompt` con "Por favor, introduce tu correo electrónico" y luego "El proceso de anonimización de su solicitud se ha iniciado; en menos de 24 horas recibirá un correo con el enlace de descarga…". Estado `anonimizacion_pendiente`. **No envíes el correo automáticamente.**
  - **Restringido por Ley 1581**: `bootbox.alert` con "…se restringe su visualización". Estado `restringido`.
- Detecta PDF por `content-type` **y** por los primeros bytes `%PDF`.

### 3.6 Lo que no sirve

- `informe_rendidos_guess.aspx` (consolidado por municipio): Yopal 2020–2026 = 73.742 contratos; su detalle congeló la página.
- `informeB_guess.aspx`: solo contratos de la propia Auditoría.
- El portal de SECOP II (`community.secop.gov.co`) tiene captcha: no lo uses para documentos.

### 3.7 Por verificar (Fase 0)

1. Que `Get_CTOs_Base`, la ficha y el handler respondan desde **Node** sin cookies. Si `Get_CTOs_Base` o la ficha exigen sesión, implementa el login de invitado por HTTP: `GET Login.aspx` → leer `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION` y el target del postback del enlace "Ingresa como Invitado" → `POST` → guardar las cookies y reutilizarlas.
2. Que el sitio responda desde una **función de Vercel** (IP de EE. UU.). Si bloquea IPs fuera de Colombia, la sincronización corre desde el Mac del dueño (script + launchd) u otra máquina en Colombia, y Vercel solo lee de Supabase.
3. Si el handler exige el header `Referer` de la ficha.

---

## 4. Datos de prueba reales (son los criterios de aceptación)

### Contrato CD/26-1262 — Hospital Regional de la Orinoquía

idc 12910254 · SECOP II `CO1.PCCNTR.9587962` · ficha: `https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=12910254`

- Contratista FARMAORTOPEDICOS S.A.S, NIT 901386177.
- Valor $510.281.732, sin adiciones.
- Firma 2026/06/25 · inicio (acta) 2026/07/02 · fin 2026/12/31 · 182 días.
- En la ficha: modalidad "SIN OFERTAS", procedimiento "Manual de contratación", tipo "Suministro". Publicado en SECOP 2026/06/23; cargado en SIA 2026/07/09.
- La ficha tiene 10 documentos:
  - 9 PDF: solicitud de CDP (2 págs.), RP (1), estudio previo en 3 archivos (`ep_110_compressed_18.pdf` 10 págs., `ep_1121_compressed_14.pdf` 11, `ep_2225_compressed.pdf` 4), póliza RCE (2), póliza de cumplimiento (2), `13_contrato_1262_compressed.pdf` (8), designación de supervisor (1).
  - El acta de inicio responde con el aviso de anonimización.
  - 6 de los 9 PDF son escaneados sin texto: CDP, los 3 del estudio previo, contrato y designación.

**Lo que debe encontrar la extracción:**
- Objeto: osteosíntesis para neurocirugía, maxilofacial y plástica, equipos neuroquirúrgicos, columna y sustitutos óseos.
- Contratación directa 061/2026 con una sola oferta.
- Pago por actas parciales con factura por paciente (hoja de gastos de la instrumentadora, remisión e informe quirúrgico), sujeto a caja y PAC.
- Garantías: cumplimiento 20%, calidad 20%, RCE 200 SMMLV. Adiciones hasta 50%.
- Indicadores financieros (estudio previo, pág. 17): liquidez ≥ 1; endeudamiento ≤ 50%; capital de trabajo ≥ 1 vez el presupuesto ($510.281.732).
- Experiencia (pág. 16): contratos por ≥ 100% del presupuesto.
- CIIU 4645 y garantía de seriedad de la oferta del 10%.
- Base del presupuesto (pág. 10): CD/25-1658 ejecutó $425.234.777 en 5 meses (≈ $85.046.955 al mes).
- Gasto en el 2.º semestre de 2025 (pág. 3): $909.377.145.
- Cotizaron Farmaortopédicos y Traumaquirúrgicos S.A.S. (NIT 901996983); ganó la de menor valor.
- Precios unitarios: **no** publicados en SIA (están en el anexo técnico 001/002 y en la propuesta).

### Carga manual de referencia en el formulario de `/contracts/new/edit`

El 29-oct se llenó a mano, sin guardar. El importador debe reproducir esto:

| Campo | Valor |
| --- | --- |
| IPS | Hospital Regional de La Orinoquía E.S.E. (Yopal) |
| Número | CD/26-1262 |
| Proveedor | FARMAORTOPEDICOS S.A.S |
| Valor | 510281732 |
| Tipo | Evento |
| Modelo | Contratación Directa |
| Inicio / fin | 2026-07-02 / 2026-12-31 |
| Liquidez mínima | 1 |
| Endeudamiento máximo | 50 % |
| Cobertura de intereses | no aplica |
| Capital de trabajo | 510,28 millones |
| Experiencia en años | no aplica (va en requisitos adicionales) |
| Requisitos adicionales | experiencia por ≥ 100% del presupuesto, capital de trabajo de una vez el presupuesto, CIIU 4645, seriedad 10%, instrumentador quirúrgico profesional, INVIMA y autorización del importador |
| Link de documentos | ficha de SIA |

### Otros contratos de la Orinoquía para validar el sync y el cruce

Empresas con objeto de las líneas:

| Código | Firma | Contratista | Valor SECOP | Valor vigente SIA |
| --- | --- | --- | --- | --- |
| CD/26-1103 | 2026/03/24 | OSTEORIENTE S.A.S (en SECOP "ORITECH SAS", mismo NIT 900078411) | 4.524.124.620 | 4.524.124.620 |
| CD/25-1783 | 2025/12/06 | OSTEORIENTE S.A.S | 1.658.466.448 | 1.658.466.448 |
| CD/25-1437 | 2025/09/17 | OSTEORIENTE S.A.S | 1.000.000.000 | 682.313.892 |
| CD/25-1111 | 2025/03/21 | FARMAORTOPEDICOS | 1.256.302.480 | 1.222.105.002 |

- CD/25-1111 ya está en `hospital_contracts` con 1.256.302.480: debe salir como **diferencia para revisar**, no sobrescribirse sola.
- En la Orinoquía hay 32 contratos de 2020–2026 con empresas (NIT de 9 dígitos que empieza por 8 o 9) cuyo objeto toca las líneas.

---

## 5. Qué construir (en este orden)

### Fase 0 — Verificación y lectura del repo (sin cambios en producción)

1. Lee el repo como dice la sección 2.
2. Prueba de humo desde Node (`scripts/sia-smoke.ts`):
   - `Get_CTOs_Base` para la Orinoquía en 2026/06/01–2026/07/31: debe incluir idc 12910254.
   - La ficha de 12910254.
   - La descarga del contrato.
3. Resuelve los puntos de la sección 3.7.
4. Guarda respuestas reales como fixtures (`__fixtures__/sia/…`), sin datos de personas naturales.
5. Revisa el plan y los límites de Vercel (duración máxima de funciones, frecuencia de cron) y ajusta el tamaño de cada lote.

### Fase 1 — Contratos de SIA

1. **Migración** (sección 6). Muestra el SQL y espera OK antes de aplicarlo al proyecto OpMap.
2. **Cliente** `lib/sia-observa/client.ts`: `getContratosEntidad(guid, desde, hasta)`, `getFicha(idc)` y `descargarDocumento(url)`.
   - User-Agent identificable de la empresa (pide al dueño el correo de contacto).
   - Una petición a la vez, pausa de 1,5 s, 3 reintentos con espera creciente, timeout de 60 s.
3. **Normalización:**
   - Dinero a `numeric`, fechas a `date`, idc desde `DT_RowId`, trims.
   - `codigo_norm`: mayúsculas, sin espacios, `/`, `-` ni `.` (`CD/26-1262` y `CD-26-1262` → `CD261262`).
   - Persona natural vs empresa: reusa la regla de SECOP; si no la hay, NIT de 9 dígitos que empieza por 8 o 9 = empresa.
   - Hash para personas y clasificación de línea con el clasificador de SECOP.
4. **Mapeo de entidades** (`scripts/sia-entidades.ts`, Playwright en local):
   - Recorre la cascada para los municipios donde OpMap tiene IPS públicas (o todos, si es fácil).
   - Guarda el catálogo en `sia_entidades`.
   - Valida el NIT llamando a `Get_CTOs_Base` con una ventana corta (de la primera fila sale `entidad_nit`); si no hay filas, amplía a 12 meses.
   - Enlaza con `hospitals` por NIT y llena `hospitals.sia_entidad_id`.
   - Prioriza los 170 NIT que ya tienen contratos clasificados en `secop_contratos`.
5. **Sync** en la ruta `/api/cron/sia-observa`, protegida como los demás crons:
   - Una entidad por invocación, ventana móvil de 60 días hacia atrás partida en meses, cursor en `fuentes_estado` (fuente `sia_observa`), upsert por `sia_idc`.
   - Guarda solo filas de empresas cuyo objeto clasifique en alguna línea. De personas naturales no guardes nada.
   - De noche en Bogotá (2:00–5:00, es decir 07:00–10:00 UTC en el cron).
   - Backfill: `scripts/sia-load.ts --desde 2024-01-01`, mes a mes.
6. **Cruce con SECOP:** `secop_contrato_id` por `nit_entidad` + `codigo_norm`, con desempate por NIT del contratista y fecha de firma ±7 días.
7. **Vista en OpMap:** "Contratos SIA" en la ficha de cada IPS (o una pestaña en `/contracts`). Muestra código, firma, contratista, objeto, valor inicial / adiciones / liberaciones / vigente, línea, enlace a la ficha y si cruza con SECOP.

**Criterio:** la Orinoquía muestra los contratos de la tabla de la sección 4 con el valor vigente de SIA y el cruce correcto.

### Fase 2 — Documentos e importación al formulario

1. **Parser de la ficha** (cheerio): datos básicos, contratistas, fechas registradas (incluida la publicación en SECOP), documentos (nombre, fecha de cargue, `ianx`, `ianxa`, url) y novedades.
2. **Tipo de documento** según el nombre del archivo (ajústalo con los fixtures):

   | Tipo | Cuándo |
   | --- | --- |
   | `contrato` | contiene "contrato" y no "acta" |
   | `estudio_previo` | `ep_` o "estudio" |
   | `anexo_tecnico` | "anexo" |
   | `propuesta` | "propuesta", "oferta" o "cotiz" |
   | `poliza`, `rp`, `cdp`, `acta_inicio` | por su nombre |
   | `designacion_supervisor` | "desig" |
   | `novedad` | "adici", "otrosi", "prorrog" o "modific" |
   | `liquidacion` | "liquid" |
   | `otro` | el resto |

3. **Descarga y guardado:**
   - Guarda solo los tipos clave (contrato, estudio previo, anexo técnico, propuesta, novedad y liquidación) en el bucket privado `contratos-sia`, ruta `{nit_entidad}/{sia_idc}/{sha256}.pdf`.
   - El resto queda como `solo_enlace`.
   - Detecta `anonimizacion_pendiente` y `restringido` (sección 3.5).
   - Guarda el número de páginas y si el PDF tiene texto.
4. Solo para contratos con línea clasificada de IPS de OpMap. Usa una cola en la base o el patrón de cursor, para no pasarte del tiempo de la función.
5. **Botón "Importar desde SIA / SECOP"** en `/contracts/new/edit`:
   - Tras elegir la IPS, lista los contratos de `sia_contratos` y `secop_contratos` de ese NIT (últimos 24 meses, primero los de las líneas).
   - Al elegir uno, precarga el formulario:
     - Número y proveedor.
     - Valor: vigente de SIA; si el de SECOP difiere, muéstralo al lado.
     - Fechas: inicio = acta de inicio, o la firma si no hay acta; fin = fin ampliada, o fin.
     - Modelo de contratación: `contratacion_directa` por defecto; licitación → `licitacion`; subasta → `subasta_inversa`; invitación → `invitacion_privada`.
     - Tipo `evento` por defecto.
     - Descripción y link de documentos = ficha de SIA.
   - La persona revisa y pulsa "Crear Contrato". Al guardar, deja `sia_contrato_id`, `secop_contrato_id` y `lineas`.
6. **En el detalle o edición de un contrato:** sección "Documentos" (archivos con enlace firmado de 10 minutos, su estado y el enlace a SIA) y botón "Actualizar desde SIA".

**Criterio:** CD/26-1262 se importa con un clic con los datos de la carga manual (sección 4), y sus documentos quedan con el estado correcto (el acta en `anonimizacion_pendiente`).

### Fase 3 — Lectura con IA y bandeja de revisión

1. **Extracción** (`lib/sia-observa/extraccion.ts`):
   - SDK `@anthropic-ai/sdk`, con los PDF como bloques `document` en base64.
   - Salida estructurada con una herramienta (tool) cuyo `input_schema` es el esquema de la sección 7.
   - Usa el modelo vigente de Anthropic: consulta docs.claude.com (Context7) para el id actual y los límites de PDF por solicitud.
   - Variable `ANTHROPIC_API_KEY`: si no existe en Vercel, pídela al dueño.
   - Corridas nocturnas por la Batch API.
2. **Validación** contra SIA (valor, fechas, NIT): las diferencias van a `discrepancias`. Guarda el modelo y la `version_prompt`.
3. **Precarga desde la extracción:**
   - Indicadores: `requires_liquidez`/`min_liquidez`, `requires_endeudamiento`/`max_endeudamiento`, `requires_capital_trabajo`/`min_capital_trabajo` (en millones), etc.
   - `custom_requirements`: experiencia, CIIU, seriedad, instrumentación, INVIMA.
4. **Página `/contracts/detectados`:**
   - Bandeja de contratos SIA/SECOP de las líneas que aún no están en `hospital_contracts`.
   - Filtros por línea, zona (kam) y fecha.
   - Acciones: Importar (abre el formulario precargado) y Descartar (con motivo).
5. **Backfill de los 52** `hospital_contracts` con ficha de SIA: saca `idc` (e `ide`) del link, sincroniza, enlaza y muestra las diferencias para aprobar. No sobrescribas nada.

**Criterio:** la extracción de CD/26-1262 devuelve los valores de la sección 4 con su página fuente, y CD/25-1111 aparece con la diferencia de valor para revisión.

### Fase 4 — No ahora

Agente conversacional dentro de OpMap, con estas funciones como herramientas, y alertas a la ejecutiva de la zona cuando aparezca un contrato nuevo de su línea. Deja las funciones puras y reutilizables para eso.

---

## 6. Migración propuesta (ajústala a las convenciones del repo)

```sql
-- 1) Catálogo de entidades del portal de invitado
create table if not exists public.sia_entidades (
  guid uuid primary key,
  nombre text not null,
  departamento_sia_id int,
  departamento text,
  municipio_sia_id int,
  municipio text,
  nit text,                               -- 9 dígitos sin DV, validado con Get_CTOs_Base
  hospital_id uuid references public.hospitals(id),
  validado_at timestamptz,
  updated_at timestamptz not null default now()
);
comment on table public.sia_entidades is
  'Entidades del portal de invitado de SIA Observa (GUID de la cascada departamento → municipio → entidad). nit se valida con Get_CTOs_Base. Lo carga scripts/sia-entidades.ts.';

alter table public.hospitals
  add column if not exists sia_entidad_id uuid references public.sia_entidades(guid),
  add column if not exists sia_mapeado_at timestamptz;

-- 2) Contratos reportados a SIA (solo empresas con objeto de las líneas)
create table if not exists public.sia_contratos (
  id uuid primary key default gen_random_uuid(),
  sia_idc bigint not null unique,
  entidad_guid uuid not null references public.sia_entidades(guid),
  nit_entidad text not null,
  nombre_entidad text,
  hospital_id uuid references public.hospitals(id),
  anio int,
  codigo text,
  codigo_norm text,
  objeto text,
  fecha_firma date,
  fecha_inicio date,
  fecha_fin date,
  fecha_fin_ampliada date,
  dias int,
  valor_inicial numeric,
  adiciones numeric,
  liberaciones numeric,
  valor_vigente numeric,
  modalidad text,
  tipologia text,
  tipo_contrato text,
  nit_contratista text,
  contratista text,
  tipo_contratista text,
  es_persona boolean not null default false,
  proveedor_hash text,
  linea text,
  lineas text[],
  clasificacion_version text,
  estado_sia text,
  fecha_creacion_sia timestamptz,
  secop_contrato_id uuid references public.secop_contratos(id),
  hospital_contract_id uuid references public.hospital_contracts(id),
  ficha_url text,
  ficha_leida_at timestamptz,
  estado_revision text not null default 'nuevo'
    check (estado_revision in ('nuevo', 'importado', 'descartado')),
  motivo_descarte text,
  raw jsonb,                              -- fila original de Get_CTOs_Base
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sia_contratos_entidad_codigo_idx on public.sia_contratos (nit_entidad, codigo_norm);
create index if not exists sia_contratos_hospital_idx on public.sia_contratos (hospital_id);
create index if not exists sia_contratos_linea_idx on public.sia_contratos (linea);
comment on table public.sia_contratos is
  'Contratos reportados a SIA Observa (Get_CTOs_Base) de las IPS de OpMap, solo empresas con objeto de las líneas. No se suma con secop_contratos: se enlaza por secop_contrato_id. Lo cargan scripts/sia-load.ts y el cron sia_observa.';

-- 3) Documentos de la ficha
create table if not exists public.contrato_documentos (
  id uuid primary key default gen_random_uuid(),
  sia_contrato_id uuid not null references public.sia_contratos(id) on delete cascade,
  nombre_archivo text not null,
  tipo text not null check (tipo in (
    'contrato', 'estudio_previo', 'anexo_tecnico', 'propuesta', 'poliza', 'cdp', 'rp',
    'acta_inicio', 'designacion_supervisor', 'novedad', 'liquidacion', 'otro')),
  ianx bigint,
  ianxa bigint,
  fuente_url text not null,
  fecha_cargue_sia date,
  estado text not null check (estado in (
    'descargado', 'solo_enlace', 'anonimizacion_pendiente', 'restringido', 'error')),
  storage_path text,
  sha256 text,
  bytes int,
  paginas int,
  tiene_texto boolean,
  descargado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sia_contrato_id, ianx, ianxa)
);

-- 4) Lo que leyó la IA
create table if not exists public.contrato_extracciones (
  id uuid primary key default gen_random_uuid(),
  sia_contrato_id uuid not null references public.sia_contratos(id) on delete cascade,
  documento_ids uuid[] not null,
  modelo text not null,
  version_prompt text not null,
  datos jsonb not null,
  items jsonb,
  confianza numeric,
  discrepancias jsonb,
  revisado_por uuid,
  revisado_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5) Enlaces desde el módulo de contratos
alter table public.hospital_contracts
  add column if not exists sia_contrato_id uuid references public.sia_contratos(id),
  add column if not exists secop_contrato_id uuid references public.secop_contratos(id),
  add column if not exists lineas text[];

-- 6) RLS con el mismo patrón de las tablas "solo service_role"
alter table public.sia_entidades enable row level security;
alter table public.sia_contratos enable row level security;
alter table public.contrato_documentos enable row level security;
alter table public.contrato_extracciones enable row level security;

-- 7) Bucket privado para los PDF
insert into storage.buckets (id, name, public)
values ('contratos-sia', 'contratos-sia', false)
on conflict (id) do nothing;

-- 8) Estado de la fuente (ajusta a la forma real de fuentes_estado)
insert into public.fuentes_estado (fuente, nombre, programacion, ejecutor, estado)
values ('sia_observa', 'SIA Observa: contratos y documentos', 'diario 02:00 America/Bogota', 'vercel_cron', 'ok')
on conflict do nothing;
```

---

## 7. Esquema de extracción (salida de la herramienta de Claude)

```json
{
  "contrato": {
    "numero": "string",
    "proceso": "string | null",
    "modalidad": "string | null",
    "entidad": { "nombre": "string", "nit": "string" },
    "contratista": { "nombre": "string", "nit": "string" },
    "objeto": "string",
    "valor": "number",
    "incluye_impuestos": "boolean | null",
    "plazo_meses": "number | null",
    "fecha_firma": "YYYY-MM-DD | null",
    "fecha_inicio": "YYYY-MM-DD | null",
    "fecha_fin": "YYYY-MM-DD | null",
    "forma_pago": "string | null",
    "soportes_factura": ["string"],
    "garantias": [{ "tipo": "string", "porcentaje": "number | null", "valor_smmlv": "number | null", "vigencia": "string | null" }],
    "adiciones_max_pct": "number | null",
    "supervision": "string | null"
  },
  "requisitos": {
    "liquidez_min": "number | null",
    "endeudamiento_max_pct": "number | null",
    "cobertura_intereses_min": "number | null",
    "capital_trabajo_min_cop": "number | null",
    "capital_trabajo_regla": "string | null",
    "experiencia": "string | null",
    "experiencia_anos_min": "number | null",
    "ciiu": ["string"],
    "seriedad_oferta_pct": "number | null",
    "otros": ["string"]
  },
  "operacion": {
    "instrumentacion": "string | null",
    "tiempos_respuesta": "string | null",
    "registro_invima": "string | null"
  },
  "mercado": {
    "cotizantes": [{ "nombre": "string", "nit": "string | null" }],
    "ganador": "string | null",
    "base_presupuesto": "string | null",
    "gasto_historico": "string | null"
  },
  "items": [{ "referencia": "string | null", "descripcion": "string", "unidad": "string | null", "cantidad": "number | null", "valor_unitario": "number | null" }],
  "lineas": ["perossal | reemplazo | deportiva | columna | trauma | neurocirugia | otra"],
  "fuentes": [{ "campo": "string", "documento": "string", "pagina": "number" }],
  "faltantes": ["string"]
}
```

Reglas del prompt de extracción:
- Solo datos que estén en el documento; lo que no esté va en `faltantes`.
- Cada dato importante con su página en `fuentes`.
- Nada de cédulas ni nombres de personas naturales (representantes legales, supervisores): solo empresas.

---

## 8. Reglas

- **SIA como lo usaría un ciudadano.** No te saltes restricciones, no pruebes otros handlers y no envíes el correo de anonimización. Ese envío queda como función futura, detrás de un flag y con aprobación humana.
- **Carga baja al portal:** una petición a la vez, pausa de 1,5 s, ventanas de un mes, de noche y con caché de respuestas.
- **Datos personales:**
  - No guardes contratos de personas naturales con nombre o documento.
  - No guardes cédulas de representantes ni de supervisores, ni en tablas ni en la extracción.
  - Bucket privado y enlaces firmados de corta duración.
  - RLS en las tablas nuevas, con el patrón del repo.
- **No toques `secop_contratos` ni sus vistas:** SIA va en tablas propias y se enlaza.
- **Git y producción:**
  - Trabaja en la rama `feat/agente-sia-observa`, con commits por fase y un PR al final.
  - Nada de push a main ni de deploy a producción sin OK del dueño.
  - Muestra el SQL antes de aplicarlo en Supabase.
- UI en español, con los componentes y estilos que ya usa OpMap.
- Tests de los parsers con fixtures reales.

---

## 9. Cómo reportar

Al cerrar cada fase, reporta:
- Qué hiciste y qué archivos tocaste.
- Cómo probarlo en `localhost:3000`.
- El resultado de los criterios de aceptación.
- Las decisiones pendientes.

Pregunta solo lo que te bloquee.

---

## Notas de implementación (Fase 0, 2026-10-30)

Hallazgos con evidencia y decisiones que ajustan lo de arriba. Se mantienen al día durante la implementación.

### 3.7.2 — SIA corta las conexiones que no vienen de Colombia

Desde el contenedor de Claude Code (salida a internet en EE. UU.) `siaobserva.auditoria.gov.co:443` y también
`www.auditoria.gov.co:443` **cortan la conexión TLS** (`Connection reset by peer` justo después del ClientHello, 10 s,
39 bytes recibidos); en el mismo momento `www.datos.gov.co` responde 200. El proxy de salida dejó pasar el CONNECT (no
es una política nuestra): el corte viene del lado de la Auditoría. Es el comportamiento típico de un filtro geográfico.
Vercel (`iad1`, Virginia) y GitHub Actions también salen por EE. UU.

Consecuencia (la prevista en 3.7.2): **la descarga de SIA corre desde un equipo en Colombia** (el Mac del dueño, con
`launchd`), y Vercel solo lee de Supabase. Por eso:

- No hay cron de Vercel para SIA. La fuente `sia_observa` se registra en `fuentes_estado` con `ejecutor = 'manual'`
  (el CHECK de la tabla solo admite `vercel_cron | github_actions | manual`) y programación `0 7 * * *` (02:00 Bogotá),
  que es la hora a la que la llama `launchd`. El bloqueo y el cursor son los mismos de las otras fuentes.
- `scripts/sia-load.ts` es el único que habla con SIA (contratos, fichas y documentos). La lectura con IA
  (`scripts/sia-extraer.ts`) no necesita SIA: lee los PDF del bucket.
- "Actualizar desde SIA" en un contrato no puede ir a SIA desde Vercel: deja el contrato marcado para que la próxima
  corrida del Mac relea su ficha, y muestra lo que ya hay guardado.
- Para confirmarlo en Vercel sin adivinar: `GET /api/sia/diagnostico` (solo admin) hace UNA petición a la página de
  inicio de SIA desde la función y dice si respondió. Si algún día responde, el mismo código de sync puede correr en
  una ruta de cron.
- 3.7.1 y 3.7.3 (cookies, `Referer`) solo se pueden comprobar desde Colombia: `scripts/sia-smoke.ts` los prueba en
  orden (sin cookies → con sesión de invitado; handler sin y con `Referer`) y dice cuál funcionó. El cliente
  (`lib/sia-observa/client.ts`) intenta primero sin sesión y, si la respuesta no es la esperada, hace el login de
  invitado por HTTP una vez y reutiliza las cookies; manda `Referer` de la ficha en las descargas (inofensivo).

### Fixtures

Sin acceso a SIA desde aquí, los fixtures de `web/scripts/__fixtures__/sia/` son **sintéticos**: reproducen los
formatos verificados el 29-oct (los 24 campos de `Get_CTOs_Base`, el HTML de la ficha con sus secciones, los enlaces del
handler y los dos avisos de `bootbox`) con los datos públicos de CD/26-1262 y de los contratos de la sección 4. Cada
archivo lo dice en su cabecera. `scripts/sia-smoke.ts --guardar-fixtures` (en el Mac) guarda las respuestas reales
anonimizadas (sin filas de personas naturales, sin nombres de supervisores) para reemplazarlos; las pruebas deben pasar
igual con los reales, y si no, se ajusta el parser.

### Vercel (plan y límites)

`web/vercel.json`: región `iad1`, funciones de cron con `maxDuration = 60` (presupuesto de 50 s por invocación) y crons
diarios como máximo (plan Hobby, ver `docs/fases/fase5-fuentes-automaticas.md`). Como SIA no corre en Vercel, el lote
lo fija el script local: una entidad a la vez, ventanas de un mes, 1,5 s entre peticiones; sin límite de tiempo pero
con bloqueo de 30 min renovado tras cada ventana.

### Datos de la base vistos con SELECT (2026-10-30)

- `hospital_contracts`: 93 filas; **53** (no 52) con la ficha de SIA en `documents_link`, todas con `idc` **e `ide`**
  (el GUID de la entidad): sirven para sembrar `sia_entidades` sin Playwright. Algunos enlaces traen otro enlace detrás
  (`… ; https://community.secop…`): se toma solo el de SIA.
- CD/25-1111 está con `contract_value = 1256302480`, `contracting_model = 'licitacion'`, sin `documents_link` y con
  `proveedor_id` (Farmaortopédicos sí está en `proveedores` con ese contrato).
- En `secop_contratos` el código de la entidad (`CD/26-1262`) va en **`referencia`**, no en `numero_contrato`
  (`CO1.PCCNTR.…`). Cada contrato aparece dos veces (`secop2` e `integrado`): el cruce prefiere `secop2`.
- El CHECK `check_contracting_model` de `hospital_contracts` **no admite `subasta_inversa`** aunque el formulario la
  ofrece (guardar con esa opción falla hoy). La migración 0920 lo amplía.
- `business_lines.code` = `perossal, reemplazo, columna, deportiva, trauma`; el clasificador de SECOP usa además
  `neurocirugia` y `otros_implantes`. `sia_contratos.linea` usa los valores del clasificador (mismo CHECK que SECOP).
- `storage.buckets` solo tiene `geojson`.
