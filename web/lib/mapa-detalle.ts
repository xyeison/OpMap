// Tarjetas del mapa · giros ADRES y compras públicas SECOP de 12 meses: cuentas PURAS (sin red ni base de datos).
// Spec: docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md. Las usan app/api/map/_lib/detalle-server.ts (las dos
// rutas de detalle) y scripts/mapa-detalle-check.ts.
//
// Por qué existe: la tarjeta de municipio / localidad y la de IPS suman con las mismas reglas que /inteligencia
// (aggregateSecopRanking) y la ficha, sin inventar reglas nuevas, pero sobre un territorio (un municipio, una localidad
// de Bogotá o una sola sede) y en una ventana de 12 meses. Dos diferencias deliberadas con el ranking: solo suman las
// entidades de compra pública (resolverCompraPublica, como la ficha) y las personas naturales con línea van aparte,
// contadas y sin nombre (el ranking las suma como un proveedor más). Reglas reutilizadas, no copiadas:
//   - La ADRES gira al NIT y SECOP contrata con el NIT. Si el NIT tiene varias sedes activas en OpMap, su giro y sus
//     compras se reparten entre ellas por camas (sedeShares de lib/adres-intelligence.ts; sin camas, a partes iguales).
//     Giro / compra de un territorio = Σ (valor del NIT × parte de cada sede del territorio): un NIT con sedes en dos
//     municipios se reparte y la suma de los dos municipios es el valor del NIT. Nada se cuenta dos veces.
//   - Compras: solo material de las 6 líneas ortopédicas (esOrto / lineaPasaFiltro); servicios de especialistas
//     (esServicio), fuera de escala (esFueraEscala) y personas naturales NO suman y se cuentan aparte; "sin clasificar"
//     (proveedores vigilados sin línea) aparte y con valor; los estimados de SECOP I suman (decisión 2026-10-12) y se
//     cuentan para la nota. El orden servicio → fuera de escala es el de aggregateSecopRanking (lib/compras-publicas.ts),
//     que no se toca.
//   - Ventanas: giros = 12 meses que terminan en el ÚLTIMO mes con giros cargados (no en hoy), como /inteligencia;
//     SECOP = 12 meses calendario hasta hoy (ventanaMeses). Constante única MAPA_VENTANA_MESES.
// Privacidad: la respuesta nunca lleva `proveedor_key`, `proveedor_hash`, documentos ni nombres de personas naturales
// ni de médicos. El proveedor que se nombra es una empresa (NIT de 9 dígitos). Las personas van agrupadas y contadas.
// Terminología visible: "Ejecutivo Comercial", "Zona", "Sin cobertura"; nunca "KAM", "panel", "representante" ni
// "sin compras" (es "sin contratos de ortopedia o neurocirugía en SECOP en los últimos 12 meses").
// Imports relativos (no '@/') para que las pruebas con tsx lo usen tal cual.
import { addMonths, nitOfHospital, resolveGirosRange, sedeShares, type GiroNitResumen, type IntelHospital } from './adres-intelligence'
import { SIN_CLASIFICAR, compareLineas, esFueraEscala, esOrto, esServicio, lineaPasaFiltro, normalizeLinea, safeUrl, ventanaMeses, type SecopFact } from './compras-publicas'
import type { ProcesoRadarFila } from './secop-procesos'
import {
  MAPA_VENTANA_MESES,
  type ComprasDetalle,
  type ComprasEstado,
  type EmpresaEnProcesos,
  type GirosDetalle,
  type ProcesoDetalle,
  type ProcesoEstadoRadar,
  type ProcesosDetalle,
  type ProveedorDetalle,
  type Ventana,
} from './types/mapa-detalle'

export { MAPA_VENTANA_MESES }

// ---------------------------------------------------------------------------
// Textos visibles (una sola fuente para la ruta, la tarjeta y las pruebas de terminología)
// ---------------------------------------------------------------------------

export const MAPA_DETALLE_TEXTOS = {
  tituloGiros: 'Giros ADRES',
  tituloCompras: 'Compras públicas de material ortopédico y neurocirugía (SECOP)',
  /** Municipio de alcance sin IPS en OpMap (kind 'other'): una sola línea, sin llamada. */
  sinIps: 'Giros y compras se cuentan donde está la IPS; este municipio no tiene IPS en OpMap',
  /** Municipio con IPS pero ninguna entidad de compra pública (se muestran los giros). */
  sinEntidadPublica: 'Sin entidades públicas de compra en OpMap en este municipio',
  /** Lo mismo en una localidad de Bogotá. */
  sinEntidadPublicaLocalidad: 'Sin entidades públicas de compra en OpMap en esta localidad',
  /** IPS cuyo código no es un NIT válido: estado neutro (ni pública ni privada), sin cifras. */
  sinNit: 'El código de esta IPS no es un NIT válido; no se puede cruzar con la ADRES ni con SECOP',
  /** Territorio cuyas IPS no tienen ningún NIT válido: el mismo estado neutro. */
  sinNitTerritorio: 'Ninguna IPS de este municipio tiene un NIT válido en OpMap; no se pueden cruzar con la ADRES ni con SECOP',
  /** Entidad pública con hechos en la ventana, pero ninguno suma al valor (solo lo que se cuenta aparte). */
  sinContratosQueSuman: `Ningún contrato suma al valor en los últimos ${MAPA_VENTANA_MESES} meses; se cuenta aparte:`,
  /** IPS que no es entidad de compra pública (resolverCompraPublica; la marca manual manda). */
  ipsPrivada: 'IPS privada: sin contratación pública (SECOP)',
  /** Entidad pública sin hechos en la ventana. Nunca "sin compras". */
  sinContratos12m: `Sin contratos de ortopedia o neurocirugía en SECOP en los últimos ${MAPA_VENTANA_MESES} meses`,
  /** Algún NIT con giro tiene sedes fuera del territorio: la parte que se muestra es un reparto por camas. */
  estimadoPorCamas: 'Giro del NIT repartido entre sus sedes: parte por camas (estimación)',
  sinClasificar: 'Sin clasificar (proveedores vigilados)',
  especialistas: 'Servicios de especialistas',
  personasNaturales: 'Personas naturales',
  estimados: 'Estimados (SECOP I sin valor adjudicado)',
  fueraEscala: 'Fuera de escala (más de 50.000 millones por contrato, no suman)',
  fuentes: 'Fuentes: ADRES Identifica tu Giro (giro del NIT repartido por camas) · SECOP I/II (valor adjudicado)',
  // Procesos de SECOP II publicados sin contrato (radar comercial, spec 2026-10-25). Nunca "abierto", "en curso",
  // "licitación" ni "adjudicado a": en régimen especial el proceso queda "publicado" para siempre y el proveedor FIGURA.
  /** Título de la sección (+ " · " + ventana.texto, como compras). */
  tituloProcesos: 'Procesos publicados sin contrato (SECOP II)',
  /** Nota fija de la sección: el precio base no es una compra ni se suma. */
  notaProcesos: 'Precio base de la convocatoria. La entidad no registró el contrato en SECOP: confirmar con la entidad. No suma a las compras.',
  /** Proceso sin ninguna empresa que figure. */
  proveedorNoPublicado: 'Proveedor no publicado',
  /** Empresa sacada del título del proceso (proveedor.origen = 'titulo'): a veces es otra empresa. */
  proveedorTitulo: 'según el título del proceso',
  /** Proveedor persona natural: nunca su nombre ni su documento. */
  proveedorPersona: 'persona natural',
  /** Enlace al expediente en SECOP. */
  verProceso: 'Ver proceso',
  /** Tarjeta del mapa (concisa, solo nombres de empresa; + " · " + ventana.texto). La ficha conserva el detalle. */
  tituloEmpresasProcesos: 'Empresas en procesos sin contrato (SECOP II)',
  /** Aviso corto de la tarjeta del mapa: figuran, no están adjudicados. */
  notaEmpresasProcesos: 'Figuran en procesos publicados sin contrato registrado. Confirmar con la entidad.',
} as const

/** Procesos que manda el servidor y que se ven sin desplegar: mapa 20 y 3 (12 meses); ficha 50 y 5 (24 meses). */
export const PROCESOS_MAPA_MAX = 20
export const PROCESOS_MAPA_VISIBLES = 3
export const PROCESOS_FICHA_MAX = 50
export const PROCESOS_FICHA_VISIBLES = 5

export type TipoTerritorio = 'municipio' | 'localidad'

/**
 * Nota de la tarjeta según el estado de compras (null cuando hay datos: la sección habla por sí sola). `tipo` es el del
 * territorio y la tarjeta de IPS no lo pasa: cambia "en este municipio" / "en esta localidad" y, en 'sin_nit', la nota
 * de la IPS por la del territorio.
 */
export function notaEstadoCompras(estado: ComprasEstado, tipo?: TipoTerritorio): string | null {
  const enLocalidad = (texto: string) => (tipo === 'localidad' ? texto.replace('este municipio', 'esta localidad') : texto)
  if (estado === 'sin_entidad_publica') return tipo === 'localidad' ? MAPA_DETALLE_TEXTOS.sinEntidadPublicaLocalidad : MAPA_DETALLE_TEXTOS.sinEntidadPublica
  if (estado === 'ips_privada') return MAPA_DETALLE_TEXTOS.ipsPrivada
  if (estado === 'sin_contratos_12m') return MAPA_DETALLE_TEXTOS.sinContratos12m
  if (estado === 'sin_nit') return tipo ? enLocalidad(MAPA_DETALLE_TEXTOS.sinNitTerritorio) : MAPA_DETALLE_TEXTOS.sinNit
  return null
}

/** "Giros y compras se cuentan donde está la IPS; este municipio / esta localidad no tiene IPS en OpMap". */
export function textoSinIps(tipo: TipoTerritorio = 'municipio'): string {
  return tipo === 'localidad' ? MAPA_DETALLE_TEXTOS.sinIps.replace('este municipio', 'esta localidad') : MAPA_DETALLE_TEXTOS.sinIps
}

/** Tarjeta de IPS cuyo NIT tiene n > 1 sedes activas: la cifra es la parte de ESTA sede. null si es la única. */
export function notaParteSede(nit: string | null, sedesNit: number): string | null {
  if (!nit || sedesNit <= 1) return null
  return `Parte de esta sede: 1 de ${sedesNit} sedes del NIT ${nit}, reparto por camas. La ficha muestra el NIT completo.`
}

// ---------------------------------------------------------------------------
// Ventanas
// ---------------------------------------------------------------------------

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])/
const ISO_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/

/** 'YYYY-MM' (o 'YYYY-MM-DD') → 'oct-2025'. Devuelve la entrada tal cual si no es un mes. */
export function mesCortoEs(value: string): string {
  if (!YM_RE.test(value)) return value
  const [y, m] = value.slice(0, 7).split('-').map(Number)
  return `${MESES_CORTOS[m - 1]}-${y}`
}

/** Texto del título de la sección: 'oct-2025 a sep-2026'; con hasta = 'hoy', 'nov-2025 a hoy'. */
export function textoVentana(desde: string, hasta: string | 'hoy'): string {
  return `${mesCortoEs(desde)} a ${hasta === 'hoy' ? 'hoy' : mesCortoEs(hasta)}`
}

/**
 * Ventana de giros: MAPA_VENTANA_MESES meses que terminan en el ÚLTIMO mes con giros cargados (`latest`, 'YYYY-MM' o
 * 'YYYY-MM-DD' de loadIdentificaBounds().max), nunca en hoy: igual que /inteligencia (resolveGirosRange). null si
 * aún no hay giros cargados. desde/hasta en 'YYYY-MM', como los toma loadGirosIntel.
 */
export function ventanaGiros(latest: string | null | undefined): Ventana | null {
  if (!latest || !YM_RE.test(latest)) return null
  const hasta = latest.slice(0, 7)
  const range = resolveGirosRange(addMonths(hasta, -(MAPA_VENTANA_MESES - 1)), hasta, hasta)
  if (!range) return null
  return { desde: range.desde, hasta: range.hasta, texto: textoVentana(range.desde, range.hasta) }
}

/**
 * Ventana de SECOP: MAPA_VENTANA_MESES meses calendario hasta hoy (`hoy` = hoyBogota(), 'YYYY-MM-DD'): desde = primer
 * día de hace 11 meses ('YYYY-MM-01'), hasta = hoy. Tal cual los toma loadHechos({ desde, hasta, nits }).
 */
export function ventanaSecop(hoy: string): Ventana {
  if (!ISO_RE.test(hoy)) throw new Error(`ventanaSecop: hoy debe ser 'YYYY-MM-DD' (llegó ${JSON.stringify(hoy)})`)
  const { desde, hasta } = ventanaMeses(hoy.slice(0, 10), MAPA_VENTANA_MESES)
  return { desde, hasta, texto: textoVentana(desde, 'hoy') }
}

// ---------------------------------------------------------------------------
// Sedes: parte por camas y territorio
// ---------------------------------------------------------------------------

/** Lo mínimo de una IPS activa para ubicarla y repartir por camas (IntelHospital cumple; locality_id solo en Bogotá). */
export type SedeMapa = Pick<IntelHospital, 'id' | 'code' | 'beds' | 'municipality_id'> & { locality_id?: string | null }

/** Ids de las IPS activas del territorio: municipio por hospitals.municipality_id, localidad por hospitals.locality_id. */
export function ipsDelTerritorio(hospitals: SedeMapa[], tipo: 'municipio' | 'localidad', code: string): Set<string> {
  const out = new Set<string>()
  for (const hospital of hospitals) {
    const key = tipo === 'localidad' ? hospital.locality_id ?? null : hospital.municipality_id
    if (key && key === code) out.add(hospital.id)
  }
  return out
}

interface SedesIndex {
  /** hospital id → parte del NIT (0-1) por camas; 1/n sin camas. */
  shares: Map<string, number>
  /** NIT → sedes activas con ese NIT. */
  sedesPorNit: Map<string, SedeMapa[]>
}

/** Índice sobre TODAS las IPS activas (si se pasaran solo las del territorio, la parte saldría 1 y se contaría dos veces). */
function indexarSedes(hospitals: SedeMapa[]): SedesIndex {
  const sedesPorNit = new Map<string, SedeMapa[]>()
  for (const hospital of hospitals) {
    const nit = nitOfHospital(hospital)
    if (!nit) continue
    const list = sedesPorNit.get(nit)
    if (list) list.push(hospital)
    else sedesPorNit.set(nit, [hospital])
  }
  return { shares: sedeShares(hospitals), sedesPorNit }
}

/**
 * NIT, nº de sedes activas del NIT y parte (0-1, por camas) de UNA IPS, para IpsDetalle.hospital. Sin NIT válido en
 * hospitals.code: nit null, 1 sede, parte 1 (no se puede cruzar con la ADRES ni con SECOP). null si el id no está.
 */
export function parteDeSede(hospitalId: string, hospitals: SedeMapa[]): { nit: string | null; sedesNit: number; parte: number } | null {
  const hospital = hospitals.find(item => item.id === hospitalId)
  if (!hospital) return null
  const nit = nitOfHospital(hospital)
  if (!nit) return { nit: null, sedesNit: 1, parte: 1 }
  const { shares, sedesPorNit } = indexarSedes(hospitals)
  return { nit, sedesNit: sedesPorNit.get(nit)?.length ?? 1, parte: shares.get(hospital.id) ?? 1 }
}

const round2 = (value: number) => Math.round(value * 100) / 100
const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b)

// ---------------------------------------------------------------------------
// Giros ADRES del territorio
// ---------------------------------------------------------------------------

/**
 * Giros del territorio: Σ (giro del NIT × parte por camas de cada sede del territorio), por régimen; total = todos los
 * regímenes (contributivo + subsidiado + otro, como /inteligencia). `resumen` = parseResumen(...) de adres_giros_nits
 * o de adres_giros_intel (puede traer NIT de fuera: se ignoran). `hospitals` = TODAS las IPS activas; `ips` = ids del
 * territorio (ipsDelTerritorio) o [id] para una sola sede. nits = NIT distintos de las IPS del territorio; nitsConGiro
 * = los que tienen giro en la ventana. estimadoPorCamas = algún NIT con giro tiene sedes activas fuera del territorio
 * (en otro municipio o localidad; para una sede, cualquier NIT con n > 1): la cifra es un reparto, no el giro exacto.
 */
export function resumirGiros(params: {
  resumen: GiroNitResumen[]
  hospitals: SedeMapa[]
  ips: Iterable<string>
  ventana: Ventana
  fuente?: GirosDetalle['fuente']
}): GirosDetalle {
  const { resumen, hospitals, ventana } = params
  const set = new Set(params.ips)
  const { shares, sedesPorNit } = indexarSedes(hospitals)
  const porNit = new Map(resumen.map(item => [item.nit, item]))
  const nits = new Set<string>()
  const nitsConGiro = new Set<string>()
  let total = 0
  let contributivo = 0
  let subsidiado = 0
  let otro = 0
  let ultimaFecha: string | null = null
  let estimadoPorCamas = false

  for (const hospital of hospitals) {
    if (!set.has(hospital.id)) continue
    const nit = nitOfHospital(hospital)
    if (!nit) continue
    nits.add(nit)
    const giro = porNit.get(nit)
    if (!giro || !(giro.total > 0)) continue
    nitsConGiro.add(nit)
    const parte = shares.get(hospital.id) ?? 1
    total += giro.total * parte
    contributivo += giro.contributivo * parte
    subsidiado += giro.subsidiado * parte
    otro += giro.otro * parte
    ultimaFecha = maxDate(ultimaFecha, giro.ultima)
    if ((sedesPorNit.get(nit) ?? []).some(sede => !set.has(sede.id))) estimadoPorCamas = true
  }

  return {
    fuente: params.fuente ?? 'identifica',
    ventana,
    total: round2(total),
    contributivo: round2(contributivo),
    subsidiado: round2(subsidiado),
    otro: round2(otro),
    ultimaFecha,
    nits: nits.size,
    nitsConGiro: nitsConGiro.size,
    estimadoPorCamas,
  }
}

// ---------------------------------------------------------------------------
// Compras públicas (SECOP) del territorio
// ---------------------------------------------------------------------------

interface ProveedorAcc {
  nit: string
  nombre: string
  valor: number
  contratos: number
  ultimaFecha: string | null
  lineas: Set<string>
  entidades: Set<string>
  vigilado: boolean
}

/**
 * Compras del territorio en la ventana (hechos de loadHechos({ desde, hasta, nits }) de los NIT de sus IPS; los de
 * NIT sin sede en el territorio o firmados fuera de la ventana se ignoran). Cada hecho vale `valor × Σ parte de las
 * sedes del NIT que están en el territorio`; los contratos se cuentan enteros (un contrato de un NIT con sedes en dos
 * municipios cuenta en los dos; el valor no se duplica), como el ranking por zona.
 *   - Suman (valor, contratos, entidades, proveedores): material de las 6 líneas (esOrto), empresas. Los `estimado`
 *     suman y además se cuentan en `estimados`.
 *   - Aparte, sin sumar: especialistas (esServicio: personas o empresas con especialidad y sin línea; solo contratos),
 *     personasNaturales (persona con línea ortopédica: contratos y valor, sin nombre), sinClasificar (vigilados sin
 *     línea: contratos y valor). Fuera de escala (esFueraEscala) no suma y se cuenta aparte (solo contratos: su valor
 *     es el error de digitación que lo saca de escala).
 *   - proveedores: una fila por empresa, orden valor desc · contratos desc · nombre; `lineas` = códigos (lineaLabel
 *     para pintar) en el orden de compareLineas; `vigilado` = NIT en la lista vigilada activa; `nit` = '' si SECOP no
 *     trajo documento (clave 'nombre:'). Nunca `proveedor_key` ni `proveedor_hash`.
 */
export function resumirCompras(params: {
  facts: SecopFact[]
  hospitals: SedeMapa[]
  ips: Iterable<string>
  vigilados: Set<string>
  ventana: Ventana
  actualizado?: string | null
}): ComprasDetalle {
  const { facts, hospitals, vigilados, ventana } = params
  const set = new Set(params.ips)
  const { shares, sedesPorNit } = indexarSedes(hospitals)
  const out: ComprasDetalle = {
    ventana,
    actualizado: params.actualizado ?? null,
    valor: 0,
    contratos: 0,
    entidades: 0,
    proveedores: [],
    sinClasificar: { contratos: 0, valor: 0 },
    especialistas: { contratos: 0 },
    personasNaturales: { contratos: 0, valor: 0 },
    estimados: { contratos: 0, valor: 0 },
    fueraEscala: { contratos: 0 },
  }
  const entidades = new Set<string>()
  const proveedores = new Map<string, ProveedorAcc>()

  for (const fact of facts) {
    if (!fact.fecha || fact.fecha < ventana.desde || fact.fecha > ventana.hasta) continue
    const sedes = (sedesPorNit.get(fact.nit_entidad) ?? []).filter(sede => set.has(sede.id))
    if (sedes.length === 0) continue
    const fraccion = sedes.reduce((acc, sede) => acc + (shares.get(sede.id) ?? 1), 0)
    const n = fact.contratos || 1
    const valor = (Number.isFinite(fact.valor) ? fact.valor : 0) * fraccion

    if (esServicio(fact)) {
      out.especialistas.contratos += n
      continue
    }
    if (esFueraEscala(fact)) {
      out.fueraEscala.contratos += n
      continue
    }
    const linea = fact.linea || SIN_CLASIFICAR
    if (fact.es_persona) {
      // Persona natural con línea ortopédica (suministro): cuenta, pero no se nombra ni entra en proveedores.
      out.personasNaturales.contratos += n
      out.personasNaturales.valor += valor
      continue
    }
    if (!lineaPasaFiltro(linea, null)) {
      out.sinClasificar.contratos += n
      out.sinClasificar.valor += valor
      continue
    }

    out.valor += valor
    out.contratos += n
    entidades.add(fact.nit_entidad)
    if (fact.estimado) {
      out.estimados.contratos += n
      out.estimados.valor += valor
    }
    const key = fact.proveedor_key
    const acc =
      proveedores.get(key) ??
      {
        nit: fact.proveedor_nit ?? '',
        nombre: fact.proveedor_nombre || 'Sin nombre',
        valor: 0,
        contratos: 0,
        ultimaFecha: null,
        lineas: new Set<string>(),
        entidades: new Set<string>(),
        vigilado: Boolean(fact.proveedor_nit && vigilados.has(fact.proveedor_nit)),
      }
    acc.valor += valor
    acc.contratos += n
    acc.ultimaFecha = maxDate(acc.ultimaFecha, fact.fecha)
    acc.lineas.add(linea)
    acc.entidades.add(fact.nit_entidad)
    proveedores.set(key, acc)
  }

  out.valor = round2(out.valor)
  out.entidades = entidades.size
  out.sinClasificar.valor = round2(out.sinClasificar.valor)
  out.personasNaturales.valor = round2(out.personasNaturales.valor)
  out.estimados.valor = round2(out.estimados.valor)
  out.proveedores = Array.from(proveedores.values())
    .map(
      (acc): ProveedorDetalle => ({
        nit: acc.nit,
        nombre: acc.nombre,
        valor: round2(acc.valor),
        contratos: acc.contratos,
        ultimaFecha: acc.ultimaFecha,
        lineas: Array.from(acc.lineas).filter(esOrto).sort(compareLineas),
        entidades: acc.entidades.size,
        vigilado: acc.vigilado,
      })
    )
    .sort((a, b) => b.valor - a.valor || b.contratos - a.contratos || a.nombre.localeCompare(b.nombre, 'es'))
  return out
}

/** Hechos de la ventana que la tarjeta puede mostrar (sumen o no): decide entre con_datos y sin_contratos_12m. */
export function contratosEnVentana(compras: ComprasDetalle | null): number {
  if (!compras) return 0
  return (
    compras.contratos +
    compras.sinClasificar.contratos +
    compras.especialistas.contratos +
    compras.personasNaturales.contratos +
    compras.fueraEscala.contratos
  )
}

/**
 * Estado de la sección de compras. Territorio: ipsPublicas = IPS del territorio que son entidad de compra pública
 * (resolverCompraPublica por NIT), hechos = contratosEnVentana(compras), esPrivada = false. IPS: ipsPublicas = 1 o 0,
 * esPrivada = !compraPublica (la marca manual hospitals.compra_publica = false gana sobre el REPS "Pública").
 */
export function estadoCompras(ipsPublicas: number, hechos: number, esPrivada = false): ComprasEstado {
  if (esPrivada) return 'ips_privada'
  if (ipsPublicas <= 0) return 'sin_entidad_publica'
  if (hechos <= 0) return 'sin_contratos_12m'
  return 'con_datos'
}

// ---------------------------------------------------------------------------
// Procesos de SECOP II publicados sin contrato (radar comercial, spec 2026-10-25)
// ---------------------------------------------------------------------------

const ESTADOS_RADAR: ReadonlySet<string> = new Set<ProcesoEstadoRadar>(['publicado', 'evaluacion', 'abierto', 'seleccionado'])

/**
 * Procesos del radar de un territorio (los NIT de sus IPS públicas) o de una IPS (su NIT entero: el precio base no se
 * reparte entre sedes), a partir de las filas de loadProcesosRadar (vista secop_procesos_radar: ya sin contrato cargado).
 *   - Solo los de la ventana (fecha de publicación entre ventana.desde y ventana.hasta) y en estado de radar; sin
 *     repetidos por id. Orden: más reciente primero, luego precio base desc, luego id.
 *   - total = todos los que pasan; procesos = los primeros `limite` (mapa PROCESOS_MAPA_MAX, ficha PROCESOS_FICHA_MAX).
 *   - NUNCA suma el precio base: no hay ningún total de valor (no es una compra).
 *   - Líneas con los códigos del catálogo de la UI (normalizeLinea: 'otros_implantes' → 'otros'), orden compareLineas.
 *   - Proveedor: la empresa que figura (nombre; si la fuente solo trae el NIT, "NIT …"); persona natural → proveedor
 *     null y proveedorPersona true, sin nombre ni documento; sin nadie → null ("Proveedor no publicado"). `vigilado` con
 *     la lista vigilada activa si se pasa (si no, la marca guardada en la carga).
 *   - null si no queda ninguno: la sección no aparece.
 */
export function resumirProcesos(
  filas: readonly ProcesoRadarFila[],
  opciones: { limite: number; ventana: Ventana; vigilados?: ReadonlySet<string> | null }
): ProcesosDetalle | null {
  const { ventana, vigilados } = opciones
  const vistos = new Set<string>()
  const enVentana: ProcesoRadarFila[] = []
  for (const fila of filas) {
    const fecha = fila.fecha_publicacion ? String(fila.fecha_publicacion).slice(0, 10) : null
    if (!fecha || fecha < ventana.desde || fecha > ventana.hasta) continue
    if (!ESTADOS_RADAR.has(fila.estado)) continue
    if (vistos.has(fila.id_proceso)) continue
    vistos.add(fila.id_proceso)
    enVentana.push(fila)
  }
  if (enVentana.length === 0) return null
  enVentana.sort(
    (a, b) =>
      String(b.fecha_publicacion).localeCompare(String(a.fecha_publicacion)) ||
      (b.precio_base ?? -1) - (a.precio_base ?? -1) ||
      a.id_proceso.localeCompare(b.id_proceso)
  )
  const limite = Math.max(0, Math.floor(opciones.limite))
  const procesos = enVentana.slice(0, limite).map((fila): ProcesoDetalle => {
    const nit = fila.es_persona ? null : fila.proveedor_nit ?? null
    const nombre = fila.es_persona ? null : fila.proveedor_nombre ?? (nit ? `NIT ${nit}` : null)
    const proveedor: ProcesoDetalle['proveedor'] =
      !fila.es_persona && fila.proveedor_origen && nombre
        ? {
            nombre,
            nit,
            origen: fila.proveedor_origen,
            vigilado: nit ? (vigilados ? vigilados.has(nit) : Boolean(fila.proveedor_vigilado_id)) : false,
          }
        : null
    // Códigos del catálogo de la UI (normalizeLinea: 'otros_implantes' de la base → 'otros'), como las compras
    const linea = normalizeLinea(fila.linea) ?? fila.linea
    const lineas = Array.from(new Set([linea, ...(fila.lineas ?? []).map(l => normalizeLinea(l) ?? l)].filter(esOrto))).sort(compareLineas)
    return {
      id: fila.id_proceso,
      referencia: fila.referencia ?? null,
      entidad: fila.nombre_entidad ?? null,
      nitEntidad: fila.nit_entidad,
      precioBase: fila.precio_base === null || fila.precio_base === undefined ? null : Number(fila.precio_base),
      fechaPublicacion: fila.fecha_publicacion ? String(fila.fecha_publicacion).slice(0, 10) : null,
      lineas,
      linea,
      estado: fila.estado as ProcesoEstadoRadar,
      proveedor,
      proveedorPersona: Boolean(fila.es_persona),
      url: safeUrl(fila.url),
    }
  })
  const { empresas, sinEmpresa } = empresasDeProcesos(enVentana, vigilados ?? null)
  return { ventana, total: enVentana.length, procesos, empresas, sinEmpresa }
}

/** Nombre de empresa para agrupar: mayúsculas, sin tildes, sin puntos ni comas y con un solo espacio. */
export function claveEmpresa(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Empresas que figuran en los procesos de la ventana (sobre TODOS, no solo los que viajan en `procesos`). Agrupa por NIT
 * y, sin NIT, por claveEmpresa; un nombre sin NIT que coincide con el de una empresa con NIT se suma a esa. Personas
 * naturales y procesos sin empresa van a `sinEmpresa`. Orden: más procesos, luego la fecha más reciente, luego el nombre.
 */
export function empresasDeProcesos(
  filas: readonly ProcesoRadarFila[],
  vigilados: ReadonlySet<string> | null
): { empresas: EmpresaEnProcesos[]; sinEmpresa: number } {
  const porClave = new Map<string, EmpresaEnProcesos & { fechaNombre: string }>()
  const nitPorNombre = new Map<string, string>()
  // Primero las que traen NIT (fijan el nombre y la llave de su nombre)
  const ordenadas = [...filas].sort((a, b) => Number(Boolean(b.proveedor_nit)) - Number(Boolean(a.proveedor_nit)))
  let sinEmpresa = 0
  for (const fila of ordenadas) {
    const nit = fila.es_persona ? null : fila.proveedor_nit ?? null
    const nombreFuente = fila.es_persona ? null : fila.proveedor_nombre ?? null
    if (fila.es_persona || !fila.proveedor_origen || (!nit && !nombreFuente)) {
      sinEmpresa++
      continue
    }
    const nombre = nombreFuente ?? `NIT ${nit}`
    const claveNombre = nombreFuente ? claveEmpresa(nombreFuente) : null
    const clave = nit ? `nit:${nit}` : (claveNombre && nitPorNombre.get(claveNombre)) ?? `nombre:${claveNombre}`
    if (nit && claveNombre && !nitPorNombre.has(claveNombre)) nitPorNombre.set(claveNombre, `nit:${nit}`)
    const fecha = fila.fecha_publicacion ? String(fila.fecha_publicacion).slice(0, 10) : null
    const actual = porClave.get(clave)
    if (!actual) {
      porClave.set(clave, {
        nombre,
        nit,
        procesos: 1,
        ultimaFecha: fecha,
        vigilado: nit ? (vigilados ? vigilados.has(nit) : Boolean(fila.proveedor_vigilado_id)) : false,
        fechaNombre: fecha ?? '',
      })
      continue
    }
    actual.procesos++
    if (fecha && (!actual.ultimaFecha || fecha > actual.ultimaFecha)) actual.ultimaFecha = fecha
    // El nombre de la empresa con NIT manda; entre nombres sin NIT, el del proceso más reciente
    if (!actual.nit && nit) {
      actual.nit = nit
      actual.nombre = nombre
    } else if (!actual.nit && fecha && fecha > actual.fechaNombre && nombreFuente) {
      actual.nombre = nombreFuente
      actual.fechaNombre = fecha
    }
  }
  const empresas = Array.from(porClave.values())
    .map(({ fechaNombre: _f, ...empresa }) => empresa)
    .sort(
      (a, b) =>
        b.procesos - a.procesos ||
        String(b.ultimaFecha ?? '').localeCompare(String(a.ultimaFecha ?? '')) ||
        a.nombre.localeCompare(b.nombre, 'es')
    )
  return { empresas, sinEmpresa }
}
