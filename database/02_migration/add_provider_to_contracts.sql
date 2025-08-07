-- Agregar campo provider a hospital_contracts
ALTER TABLE hospital_contracts
ADD COLUMN IF NOT EXISTS provider text;

-- Comentario para documentar el campo
COMMENT ON COLUMN hospital_contracts.provider IS 'Proveedor del contrato';