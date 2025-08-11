-- Agregar campos de indicadores requeridos a la tabla hospital_contracts
ALTER TABLE hospital_contracts
ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id),
ADD COLUMN IF NOT EXISTS requires_liquidez BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS min_liquidez DECIMAL(10,2) DEFAULT 1.2,
ADD COLUMN IF NOT EXISTS requires_endeudamiento BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS max_endeudamiento DECIMAL(5,4) DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS requires_cobertura BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS min_cobertura DECIMAL(10,2) DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS requires_capital_trabajo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_capital_trabajo DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_rentabilidad BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_rentabilidad DECIMAL(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_experiencia BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_experiencia_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_requirements TEXT;

-- Agregar índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_hospital_contracts_proveedor ON hospital_contracts(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_hospital_contracts_requirements ON hospital_contracts(
  requires_liquidez,
  requires_endeudamiento,
  requires_cobertura
);

-- Crear vista para evaluar cumplimiento de contratos
CREATE OR REPLACE VIEW contract_compliance AS
SELECT 
  hc.id as contract_id,
  hc.contract_number,
  hc.hospital_id,
  h.name as hospital_name,
  hc.proveedor_id,
  p.nombre as proveedor_name,
  hc.contract_value,
  hc.start_date,
  hc.end_date,
  hc.contract_type,
  -- Indicadores requeridos
  hc.requires_liquidez,
  hc.min_liquidez,
  hc.requires_endeudamiento,
  hc.max_endeudamiento,
  hc.requires_cobertura,
  hc.min_cobertura,
  hc.requires_capital_trabajo,
  hc.min_capital_trabajo,
  hc.requires_rentabilidad,
  hc.min_rentabilidad,
  hc.requires_experiencia,
  hc.min_experiencia_years,
  -- Indicadores actuales del proveedor (último año)
  pi.indice_liquidez,
  pi.indice_endeudamiento,
  pi.cobertura_intereses,
  pi.capital_trabajo_neto,
  pi.margen_neto as rentabilidad,
  -- Evaluación de cumplimiento
  CASE 
    WHEN hc.requires_liquidez AND (pi.indice_liquidez IS NULL OR pi.indice_liquidez < hc.min_liquidez) THEN false
    WHEN hc.requires_endeudamiento AND (pi.indice_endeudamiento IS NULL OR pi.indice_endeudamiento > hc.max_endeudamiento) THEN false
    WHEN hc.requires_cobertura AND (pi.cobertura_intereses IS NULL OR pi.cobertura_intereses < hc.min_cobertura) THEN false
    WHEN hc.requires_capital_trabajo AND (pi.capital_trabajo_neto IS NULL OR pi.capital_trabajo_neto < hc.min_capital_trabajo) THEN false
    WHEN hc.requires_rentabilidad AND (pi.margen_neto IS NULL OR pi.margen_neto < hc.min_rentabilidad) THEN false
    ELSE true
  END as cumple_requisitos,
  -- Detalle de cumplimiento
  (NOT hc.requires_liquidez OR (pi.indice_liquidez >= hc.min_liquidez)) as cumple_liquidez,
  (NOT hc.requires_endeudamiento OR (pi.indice_endeudamiento <= hc.max_endeudamiento)) as cumple_endeudamiento,
  (NOT hc.requires_cobertura OR (pi.cobertura_intereses >= hc.min_cobertura)) as cumple_cobertura,
  (NOT hc.requires_capital_trabajo OR (pi.capital_trabajo_neto >= hc.min_capital_trabajo)) as cumple_capital_trabajo,
  (NOT hc.requires_rentabilidad OR (pi.margen_neto >= hc.min_rentabilidad)) as cumple_rentabilidad
FROM hospital_contracts hc
LEFT JOIN hospitals h ON hc.hospital_id = h.id
LEFT JOIN proveedores p ON hc.proveedor_id = p.id
LEFT JOIN LATERAL (
  SELECT *
  FROM proveedor_indicadores
  WHERE proveedor_id = hc.proveedor_id
  ORDER BY anio DESC
  LIMIT 1
) pi ON true
WHERE hc.active = true;

-- Comentarios para documentación
COMMENT ON COLUMN hospital_contracts.requires_liquidez IS 'Indica si este contrato requiere un índice de liquidez mínimo';
COMMENT ON COLUMN hospital_contracts.min_liquidez IS 'Índice de liquidez mínimo requerido (ej: 1.2)';
COMMENT ON COLUMN hospital_contracts.requires_endeudamiento IS 'Indica si este contrato requiere un límite de endeudamiento';
COMMENT ON COLUMN hospital_contracts.max_endeudamiento IS 'Índice de endeudamiento máximo permitido (ej: 0.7 = 70%)';
COMMENT ON COLUMN hospital_contracts.requires_cobertura IS 'Indica si este contrato requiere cobertura de intereses mínima';
COMMENT ON COLUMN hospital_contracts.min_cobertura IS 'Cobertura de intereses mínima requerida (ej: 1.5)';
COMMENT ON COLUMN hospital_contracts.requires_capital_trabajo IS 'Indica si este contrato requiere capital de trabajo mínimo';
COMMENT ON COLUMN hospital_contracts.min_capital_trabajo IS 'Capital de trabajo mínimo en millones de pesos';
COMMENT ON COLUMN hospital_contracts.requires_rentabilidad IS 'Indica si este contrato requiere margen de rentabilidad mínimo';
COMMENT ON COLUMN hospital_contracts.min_rentabilidad IS 'Margen de rentabilidad mínimo (ej: 0.05 = 5%)';
COMMENT ON COLUMN hospital_contracts.requires_experiencia IS 'Indica si este contrato requiere experiencia mínima';
COMMENT ON COLUMN hospital_contracts.min_experiencia_years IS 'Años de experiencia mínimos requeridos';
COMMENT ON COLUMN hospital_contracts.custom_requirements IS 'Requisitos adicionales en texto libre';