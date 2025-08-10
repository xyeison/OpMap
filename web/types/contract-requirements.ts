// Tipos para requisitos financieros de contratos

export interface ContractRequirements {
  indice_liquidez_requerido?: number;
  indice_endeudamiento_maximo?: number;
  cobertura_intereses_minimo?: number;
  patrimonio_minimo?: number;
  capital_trabajo_minimo?: number;
  experiencia_anos_minimo?: number;
  facturacion_anual_minima?: number;
  rentabilidad_minima?: number;
  otros_requisitos?: string;
  requisitos_financieros?: any; // JSON flexible para requisitos adicionales
}

export interface ContractWithRequirements {
  id: string;
  contract_number?: string;
  contract_value?: number;
  hospital_name?: string;
  municipality_name?: string;
  department_name?: string;
  
  // Requisitos
  indice_liquidez_requerido?: number;
  indice_endeudamiento_maximo?: number;
  cobertura_intereses_minimo?: number;
  patrimonio_minimo?: number;
  capital_trabajo_minimo?: number;
  
  // Estado de cumplimiento
  cumple_requisitos?: boolean;
  fecha_validacion_requisitos?: string;
  notas_cumplimiento?: string;
  
  // Fechas del contrato
  start_date?: string;
  end_date?: string;
  active?: boolean;
}

export interface MiEmpresaConfig {
  id?: string;
  nombre: string;
  nit?: string;
  anio_fiscal: number;
  
  // Datos financieros
  activo_corriente?: number;
  activo_total?: number;
  pasivo_corriente?: number;
  pasivo_total?: number;
  patrimonio?: number;
  capital_trabajo?: number;
  ingresos_anuales?: number;
  utilidad_neta?: number;
  gastos_intereses?: number;
  utilidad_operacional?: number;
  
  // Indicadores calculados
  indice_liquidez?: number;
  indice_endeudamiento?: number;
  cobertura_intereses?: number;
  roe?: number;
  margen_neto?: number;
  
  // Otros
  anos_experiencia?: number;
  certificaciones?: string[];
  
  // Metadata
  created_at?: string;
  updated_at?: string;
}

export interface CumplimientoValidation {
  cumple: boolean;
  fecha_validacion: string;
  mi_empresa: {
    nombre: string;
    anio_fiscal: number;
    indice_liquidez?: number;
    indice_endeudamiento?: number;
    cobertura_intereses?: number;
    patrimonio?: number;
    capital_trabajo?: number;
  };
  detalles: RequisitoDetalle[];
}

export interface RequisitoDetalle {
  requisito: string;
  requerido?: number;
  maximo?: number;
  minimo?: number;
  actual: number;
  cumple: boolean;
}

export interface DashboardCumplimiento {
  id: string;
  contract_number?: string;
  contract_value?: number;
  hospital_name?: string;
  municipality_name?: string;
  department_name?: string;
  
  // Requisitos vs Actuales
  indice_liquidez_requerido?: number;
  mi_indice_liquidez?: number;
  cumple_liquidez?: boolean;
  
  indice_endeudamiento_maximo?: number;
  mi_indice_endeudamiento?: number;
  cumple_endeudamiento?: boolean;
  
  cobertura_intereses_minimo?: number;
  mi_cobertura_intereses?: number;
  cumple_cobertura?: boolean;
  
  patrimonio_minimo?: number;
  mi_patrimonio?: number;
  cumple_patrimonio?: boolean;
  
  capital_trabajo_minimo?: number;
  mi_capital_trabajo?: number;
  cumple_capital_trabajo?: boolean;
  
  // General
  cumple_requisitos?: boolean;
  fecha_validacion_requisitos?: string;
  prioridad_temporal?: number;
  valor_oportunidad?: number;
}