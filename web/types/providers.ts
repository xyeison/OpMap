export interface Proveedor {
  id: string;
  nit: string;
  nombre: string;
  nombre_normalizado?: string;
  website_url?: string;
  descripcion_corta?: string;
  
  // Datos de contacto
  telefono?: string;
  email?: string;
  ciudad?: string;
  departamento?: string;
  pais?: string;
  direccion?: string;
  
  // Estado
  estado: 'activo' | 'inactivo' | 'prospecto';
  
  // Metadatos
  notas_internas?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Relaciones (opcionales para queries)
  finanzas?: ProveedorFinanzas[];
  indicadores?: ProveedorIndicadores[];
  contactos?: ProveedorContacto[];
  contratos?: any[]; // Hospital contracts
}

export interface ProveedorFinanzas {
  id: string;
  proveedor_id: string;
  anio: number;
  
  // Balance General
  activo_corriente?: number;
  activo_no_corriente?: number;
  activo_total?: number;
  pasivo_corriente?: number;
  pasivo_no_corriente?: number;
  pasivo_total?: number;
  patrimonio?: number;
  
  // Estado de Resultados
  ingresos_operacionales?: number;
  costos_ventas?: number;
  utilidad_bruta?: number;
  gastos_operacionales?: number;
  utilidad_operacional?: number;
  gastos_intereses?: number;
  otros_ingresos?: number;
  otros_gastos?: number;
  utilidad_antes_impuestos?: number;
  impuestos?: number;
  utilidad_neta?: number;
  
  // Otros valores
  inventarios?: number;
  cuentas_por_cobrar?: number;
  efectivo?: number;
  capital_trabajo?: number;
  ebitda?: number;
  
  // Información adicional
  fuente: 'manual' | 'supersociedades' | 'rues' | 'auditoria' | 'otro';
  moneda: string;
  tipo_cambio?: number;
  fecha_corte?: string;
  auditado?: boolean;
  notas?: string;
  
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ProveedorIndicadores {
  id: string;
  proveedor_id: string;
  anio: number;
  
  // Indicadores de Liquidez
  indice_liquidez?: number;
  prueba_acida?: number;
  capital_trabajo_neto?: number;
  
  // Indicadores de Endeudamiento
  indice_endeudamiento?: number;
  apalancamiento_financiero?: number;
  cobertura_intereses?: number;
  
  // Indicadores de Rentabilidad
  margen_bruto?: number;
  margen_operacional?: number;
  margen_neto?: number;
  margen_ebitda?: number;
  
  // Indicadores de Eficiencia
  roe?: number;
  roa?: number;
  roic?: number;
  
  // Indicadores de Actividad
  rotacion_activos?: number;
  rotacion_cartera?: number;
  dias_cartera?: number;
  rotacion_inventarios?: number;
  dias_inventario?: number;
  
  // Validación para licitaciones
  cumple_liquidez?: boolean;
  cumple_endeudamiento?: boolean;
  cumple_cobertura?: boolean;
  cumple_todos_requisitos?: boolean;
  
  // Score y categorización
  score_salud_financiera?: number;
  categoria_riesgo?: 'muy_bajo' | 'bajo' | 'medio' | 'alto' | 'muy_alto';
  
  calculado_at: string;
}

export interface ProveedorContacto {
  id: string;
  proveedor_id: string;
  nombre: string;
  cargo?: string;
  telefono?: string;
  celular?: string;
  email?: string;
  es_principal?: boolean;
  activo?: boolean;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface ProveedorDocumento {
  id: string;
  proveedor_id: string;
  tipo_documento: 'estados_financieros' | 'certificacion_bancaria' | 'rut' | 
                  'camara_comercio' | 'certificacion_experiencia' | 
                  'referencia_comercial' | 'otro';
  nombre_archivo: string;
  url_archivo?: string;
  anio?: number;
  descripcion?: string;
  uploaded_at: string;
  uploaded_by?: string;
}

// DTOs para creación y actualización
export interface CreateProveedorDTO {
  nit: string;
  nombre: string;
  website_url?: string;
  descripcion_corta?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  departamento?: string;
  direccion?: string;
}

export interface UpdateProveedorDTO extends Partial<CreateProveedorDTO> {
  estado?: 'activo' | 'inactivo' | 'prospecto';
  notas_internas?: string;
}

export interface CreateProveedorFinanzasDTO {
  proveedor_id: string;
  anio: number;
  activo_corriente?: number;
  activo_no_corriente?: number;
  pasivo_corriente?: number;
  pasivo_no_corriente?: number;
  activo_total?: number;
  pasivo_total?: number;
  patrimonio?: number;
  ingresos_operacionales?: number;
  utilidad_operacional?: number;
  gastos_intereses?: number;
  utilidad_neta?: number;
  inventarios?: number;
  fuente?: 'manual' | 'supersociedades' | 'rues' | 'auditoria' | 'otro';
  moneda?: string;
  tipo_cambio?: number;
  fecha_corte?: string;
}

// Interfaces para reportes
export interface ProveedorConIndicadores extends Proveedor {
  ultimo_anio_financiero?: number;
  indice_liquidez?: number;
  indice_endeudamiento?: number;
  cobertura_intereses?: number;
  margen_operacional?: number;
  margen_neto?: number;
  roe?: number;
  roa?: number;
  cumple_todos_requisitos?: boolean;
  score_salud_financiera?: number;
  categoria_riesgo?: string;
  ultimos_ingresos?: number;
  ultimo_activo_total?: number;
  ultimo_patrimonio?: number;
}

export interface CompetenciaHospital {
  hospital_id: string;
  hospital_nombre: string;
  municipality_name: string;
  department_name: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  contract_value?: number;
  start_date?: string;
  end_date?: string;
  contrato_activo?: boolean;
  estado_contrato?: 'vigente' | 'por_vencer' | 'vencido';
}

export interface RankingProveedor {
  id: string;
  nombre: string;
  ingresos_operacionales?: number;
  activo_total?: number;
  patrimonio?: number;
  anio?: number;
  total_contratos?: number;
  valor_total_contratos?: number;
  hospitales_atendidos?: number;
  score_salud_financiera?: number;
  categoria_riesgo?: string;
  ranking_ingresos?: number;
  ranking_patrimonio?: number;
  ranking_contratos?: number;
}

// Tipos para formularios y validación
export interface ProveedorFormData extends CreateProveedorDTO {
  id?: string;
}

export interface FinanzasFormData extends CreateProveedorFinanzasDTO {
  id?: string;
}

// Tipos para filtros y búsqueda
export interface ProveedorFilters {
  search?: string;
  estado?: 'activo' | 'inactivo' | 'prospecto';
  cumple_requisitos?: boolean;
  categoria_riesgo?: string;
  departamento?: string;
}

// Tipos para respuestas de API
export interface ProveedorResponse {
  data: Proveedor;
  success: boolean;
  message?: string;
}

export interface ProveedoresListResponse {
  data: Proveedor[];
  total: number;
  page: number;
  pageSize: number;
  success: boolean;
}

export interface IndicadoresCalculados {
  indicadores: ProveedorIndicadores;
  alertas?: string[];
  recomendaciones?: string[];
}