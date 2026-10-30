// Allow-lists de columnas editables por tabla (columnas reales según el esquema de Supabase).
// Evitan el mass assignment: nunca se pasa el body entero a insert/update.

// hospital_contracts: se excluyen id, created_by, created_at y updated_at (los fija el servidor).
export const CONTRACT_EDITABLE_COLUMNS = [
  'hospital_id',
  'contract_number',
  'contract_type',
  'contracting_model',
  'contract_value',
  'start_date',
  'end_date',
  'duration_months',
  'current_provider',
  'provider',
  'proveedor_id',
  'description',
  'active',
  'documents_link',
  'requisitos_financieros',
  'indice_liquidez_requerido',
  'indice_endeudamiento_maximo',
  'cobertura_intereses_minimo',
  'patrimonio_minimo',
  'capital_trabajo_minimo',
  'experiencia_anos_minimo',
  'facturacion_anual_minima',
  'rentabilidad_minima',
  'otros_requisitos',
  'cumple_requisitos',
  'fecha_validacion_requisitos',
  'notas_cumplimiento',
  'requires_liquidez',
  'min_liquidez',
  'requires_endeudamiento',
  'max_endeudamiento',
  'requires_cobertura',
  'min_cobertura',
  'requires_capital_trabajo',
  'min_capital_trabajo',
  'requires_rentabilidad',
  'min_rentabilidad',
  'requires_experiencia',
  'min_experiencia_years',
  'custom_requirements',
  // SIA Observa (migración 0920): de dónde se importó el contrato y sus líneas. Se validan con sanearEnlacesContrato.
  'sia_contrato_id',
  'secop_contrato_id',
  'lineas',
] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LINEAS_CLASIFICADOR = new Set(['trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes'])

/**
 * Enlaces a SIA y SECOP y líneas del contrato: un id que no es UUID queda en null y las líneas solo con los valores del
 * clasificador de SECOP (si no queda ninguna, null). Solo toca las claves que vienen en el cuerpo.
 */
export function sanearEnlacesContrato(data: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['sia_contrato_id', 'secop_contrato_id']) {
    if (key in data) data[key] = typeof data[key] === 'string' && UUID.test(data[key] as string) ? data[key] : null
  }
  if ('lineas' in data) {
    const lineas = Array.isArray(data.lineas) ? Array.from(new Set(data.lineas.filter((l): l is string => typeof l === 'string' && LINEAS_CLASIFICADOR.has(l)))) : []
    data.lineas = lineas.length > 0 ? lineas : null
  }
  return data
}

/**
 * Copia solo las claves permitidas (y definidas) de `body`.
 */
export function pickAllowed(
  body: Record<string, unknown>,
  allowed: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      result[key] = body[key]
    }
  }
  return result
}

// proveedores: columnas editables (sin id, created_by, created_at, updated_at, nombre_normalizado)
export const PROVIDER_CREATE_COLUMNS = [
  'nit',
  'nombre',
  'website_url',
  'descripcion_corta',
  'telefono',
  'email',
  'ciudad',
  'departamento',
  'direccion',
  'pais',
  'notas_internas',
] as const

export const PROVIDER_UPDATE_COLUMNS = [...PROVIDER_CREATE_COLUMNS, 'estado'] as const

export const PROVIDER_STATES = ['activo', 'inactivo', 'prospecto'] as const

/**
 * Limpia un texto de búsqueda para usarlo dentro de un filtro .or() de PostgREST
 * (las comas, paréntesis y comillas alteran la sintaxis del filtro).
 */
export function sanitizeSearchTerm(value: string): string {
  return value.replace(/[,()"'\\*%]/g, ' ').trim().slice(0, 100)
}

/**
 * Escapa los comodines de LIKE para comparar un texto literal con ilike.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, char => `\\${char}`)
}

// proveedor_finanzas: columnas editables (sin id, proveedor_id, created_by, created_at, updated_at)
export const PROVIDER_FINANCE_COLUMNS = [
  'anio',
  'activo_corriente',
  'activo_no_corriente',
  'activo_total',
  'pasivo_corriente',
  'pasivo_no_corriente',
  'pasivo_total',
  'patrimonio',
  'ingresos_operacionales',
  'costos_ventas',
  'utilidad_bruta',
  'gastos_operacionales',
  'utilidad_operacional',
  'gastos_intereses',
  'otros_ingresos',
  'otros_gastos',
  'utilidad_antes_impuestos',
  'impuestos',
  'utilidad_neta',
  'inventarios',
  'cuentas_por_cobrar',
  'efectivo',
  'capital_trabajo',
  'ebitda',
  'fecha_corte',
  'notas',
  'fuente',
  'moneda',
  'tipo_cambio',
  'auditado',
] as const

// proveedor_indicadores: columnas que puede enviar el formulario (los cumple_* se calculan aquí)
export const PROVIDER_INDICATOR_COLUMNS = [
  'anio',
  'indice_liquidez',
  'prueba_acida',
  'capital_trabajo_neto',
  'indice_endeudamiento',
  'apalancamiento_financiero',
  'cobertura_intereses',
  'margen_bruto',
  'margen_operacional',
  'margen_neto',
  'margen_ebitda',
  'roe',
  'roa',
  'roic',
  'rotacion_activos',
  'rotacion_cartera',
  'dias_cartera',
  'rotacion_inventarios',
  'dias_inventario',
  'score_salud_financiera',
  'categoria_riesgo',
] as const
