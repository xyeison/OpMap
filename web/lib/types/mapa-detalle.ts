// Contratos de las dos rutas de detalle del mapa (spec docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md,
// bloque "Contratos de API"): GET /api/map/detalle/territorio?tipo=&code= → TerritorioDetalle y
// GET /api/map/detalle/ips/[id] → IpsDetalle. Quien arma la respuesta (app/api/map/_lib/detalle-server.ts) y quien
// la pinta (components/MapPopups.tsx) se atienen a estas formas; las cuentas puras están en lib/mapa-detalle.ts.
//
// Por qué un contrato aparte: los giros ADRES y las compras SECOP de 12 meses no viajan en /api/map/data (≈1,1 MB);
// se piden al abrir la tarjeta, así que la respuesta debe ser pequeña y nunca llevar nombres de personas naturales,
// documentos ni `proveedor_hash` (el proveedor es una empresa con NIT; las personas van agrupadas y contadas).

/** Meses de las dos ventanas del mapa (giros y SECOP). La ficha y el ranking de /inteligencia siguen en 24. */
export const MAPA_VENTANA_MESES = 12

/**
 * Ventana de una fuente. `texto` es lo que lleva el título de la sección ("oct-2025 a sep-2026", "nov-2025 a hoy").
 * Giros: `desde`/`hasta` en 'YYYY-MM' (lo que reciben loadGirosIntel y resolveGirosRange; termina en el ÚLTIMO mes
 * con giros cargados). SECOP: `desde` = primer día de hace 11 meses ('YYYY-MM-01') y `hasta` = hoy en Bogotá
 * ('YYYY-MM-DD'), tal cual los toma loadHechos.
 */
export interface Ventana { desde: string; hasta: string; texto: string }            // 'YYYY-MM', "oct-2025 a sep-2026"
export interface GirosDetalle {
  fuente: 'identifica' | 'reporte29'; ventana: Ventana
  total: number; contributivo: number; subsidiado: number; otro: number; ultimaFecha: string | null
  nits: number; nitsConGiro: number; estimadoPorCamas: boolean          // algún NIT con sedes en varios municipios
}
export interface ProveedorDetalle {
  nit: string; nombre: string; valor: number; contratos: number; ultimaFecha: string | null
  lineas: string[]; entidades: number; vigilado: boolean
}
export interface ComprasDetalle {
  ventana: Ventana; actualizado: string | null                          // loadSecopActualizado
  valor: number; contratos: number; entidades: number; proveedores: ProveedorDetalle[]   // orden: valor desc
  sinClasificar: { contratos: number; valor: number }
  especialistas: { contratos: number }; personasNaturales: { contratos: number; valor: number }
  estimados: { contratos: number; valor: number }                       // SECOP I sin adjudicado (hoy 0 en 12 m)
  fueraEscala: { contratos: number }                                    // > 50.000 millones por contrato: no suman (hoy 0 en 12 m)
}
/** Estados de un proceso que entran al radar (vista secop_procesos_radar): sin contrato cargado de la misma entidad. */
export type ProcesoEstadoRadar = 'publicado' | 'evaluacion' | 'abierto' | 'seleccionado'
/**
 * Un proceso de SECOP II publicado sin contrato (radar comercial, spec docs/specs/2026-10-25-secop-procesos-radar.md).
 * Nunca lleva el título del proceso, documentos, `proveedor_hash` ni nombres de personas naturales. El precio base es
 * de la convocatoria: se muestra por proceso y NUNCA se suma (ni entre procesos ni con las compras).
 */
export interface ProcesoDetalle {
  id: string                                   // id_proceso: 'CO1.REQ.10254526'
  referencia: string | null                    // referencia_del_proceso: '000039-2026'
  entidad: string | null                       // nombre de la entidad (la tarjeta de municipio lo muestra)
  nitEntidad: string
  precioBase: number | null
  fechaPublicacion: string | null              // 'YYYY-MM-DD' (sin hora: fechaEs con hora local corre un día)
  lineas: string[]                             // códigos ortopédicos en el orden de compareLineas (lineaLabel para pintar)
  linea: string                                // línea principal
  estado: ProcesoEstadoRadar
  /** Empresa que FIGURA (nunca "adjudicada"). null: no figura ninguna ("Proveedor no publicado") o es persona natural. */
  proveedor: { nombre: string; nit: string | null; origen: 'nit' | 'nombre' | 'titulo'; vigilado: boolean } | null
  proveedorPersona: boolean                    // true → "persona natural", sin nombre ni documento
  url: string | null                           // expediente en SECOP ("Ver proceso"); solo http(s)
}
/** Procesos de un territorio o de una IPS: orden fecha de publicación desc; `total` cuenta todos, `procesos` va cortado. */
export interface ProcesosDetalle {
  ventana: Ventana                             // mapa: 12 meses (la de SECOP); ficha: 24
  total: number                                // procesos en la ventana (puede ser mayor que procesos.length)
  procesos: ProcesoDetalle[]                   // máximo 20 en el mapa y 50 en la ficha
}
/**
 * Qué trae la tarjeta: 'completo' (intelligence:view: giros, compras y procesos) o 'procesos' (solo secop:procesos, p. ej.
 * un Ejecutivo Comercial: giros y compras en null, solo la sección de procesos).
 */
export type AlcanceDetalle = 'completo' | 'procesos'
/** 'sin_nit': el código de la IPS no es un NIT válido; no se puede cruzar con la ADRES ni con SECOP (estado neutro). */
export type ComprasEstado = 'con_datos' | 'sin_contratos_12m' | 'sin_entidad_publica' | 'ips_privada' | 'sin_nit'
export interface TerritorioDetalle {
  territorio: { code: string; tipo: 'municipio' | 'localidad'; nombre: string; departamento: string | null }
  ips: { total: number; publicas: number }
  giros: GirosDetalle | null; compras: ComprasDetalle | null; comprasEstado: ComprasEstado; notas: string[]
  procesos: ProcesosDetalle | null; alcance: AlcanceDetalle            // null: sin procesos, sin la vista o sin permiso
}
export interface IpsDetalle {
  hospital: { id: string; nombre: string; nit: string | null; sedesNit: number; parte: number   // 0-1, por camas
              compraPublica: boolean; compraPublicaOrigen: 'manual' | 'reps' | 'contratos' | 'ninguno' }
  giros: GirosDetalle | null; compras: ComprasDetalle | null; comprasEstado: ComprasEstado; notas: string[]
  procesos: ProcesosDetalle | null; alcance: AlcanceDetalle            // procesos del NIT entero (el precio base no se reparte)
}
