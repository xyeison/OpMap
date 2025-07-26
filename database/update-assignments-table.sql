-- Actualizar tabla assignments para soportar nuevas asignaciones

-- Agregar columnas si no existen
DO $$
BEGIN
    -- Columna is_base_territory
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'assignments' 
                  AND column_name = 'is_base_territory') THEN
        ALTER TABLE assignments ADD COLUMN is_base_territory BOOLEAN DEFAULT false;
    END IF;
    
    -- Columna assigned_at
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'assignments' 
                  AND column_name = 'assigned_at') THEN
        ALTER TABLE assignments ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Actualizar registros existentes
UPDATE assignments 
SET is_base_territory = true 
WHERE travel_time = 0 OR travel_time IS NULL;

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_assignments_is_base_territory ON assignments(is_base_territory);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_at ON assignments(assigned_at);

-- Comentarios
COMMENT ON COLUMN assignments.is_base_territory IS 'Indica si el hospital está en el territorio base del KAM';
COMMENT ON COLUMN assignments.assigned_at IS 'Fecha y hora de asignación';