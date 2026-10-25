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
/** 'sin_nit': el código de la IPS no es un NIT válido; no se puede cruzar con la ADRES ni con SECOP (estado neutro). */
export type ComprasEstado = 'con_datos' | 'sin_contratos_12m' | 'sin_entidad_publica' | 'ips_privada' | 'sin_nit'
export interface TerritorioDetalle {
  territorio: { code: string; tipo: 'municipio' | 'localidad'; nombre: string; departamento: string | null }
  ips: { total: number; publicas: number }
  giros: GirosDetalle | null; compras: ComprasDetalle | null; comprasEstado: ComprasEstado; notas: string[]
}
export interface IpsDetalle {
  hospital: { id: string; nombre: string; nit: string | null; sedesNit: number; parte: number   // 0-1, por camas
              compraPublica: boolean; compraPublicaOrigen: 'manual' | 'reps' | 'contratos' | 'ninguno' }
  giros: GirosDetalle | null; compras: ComprasDetalle | null; comprasEstado: ComprasEstado; notas: string[]
}
