-- ==================================================================
-- SCRIPT PARA CREAR PROVEEDOR DE PRUEBA
-- ==================================================================
-- Ejecutar después del script 04_fix_dependencies.sql
-- ==================================================================

DO $$
DECLARE
    v_count INTEGER;
    v_proveedor_id UUID;
BEGIN
    -- Verificar si ya existen proveedores
    SELECT COUNT(*) INTO v_count FROM proveedores;
    
    IF v_count = 0 THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE 'CREANDO PROVEEDORES DE PRUEBA';
        RAISE NOTICE '========================================';
        
        -- Crear varios proveedores de ejemplo
        INSERT INTO proveedores (nit, nombre, email, telefono, ciudad, departamento, estado, descripcion_corta)
        VALUES 
        ('900123456-1', 'Soluciones Médicas S.A.S', 'contacto@solucionesmedicas.com', '(1) 234-5678', 
         'Bogotá', 'Cundinamarca', 'activo', 'Proveedor líder en equipos médicos y suministros hospitalarios'),
        
        ('800987654-2', 'Tecnología Hospitalaria Ltda', 'info@techhospital.com', '(2) 345-6789',
         'Cali', 'Valle del Cauca', 'activo', 'Especialistas en tecnología para el sector salud'),
        
        ('901234567-3', 'Insumos Clínicos del Norte', 'ventas@insumosclinicos.com', '(5) 456-7890',
         'Barranquilla', 'Atlántico', 'activo', 'Distribución de insumos médicos en la costa atlántica'),
        
        ('811223344-4', 'Pharma Solutions Colombia', 'pharma@solutions.co', '(4) 567-8901',
         'Medellín', 'Antioquia', 'prospecto', 'Soluciones farmacéuticas integrales'),
        
        ('900555666-5', 'Equipos Biomédicos S.A', 'equipos@biomedicos.com', '(1) 678-9012',
         'Bogotá', 'Cundinamarca', 'inactivo', 'Mantenimiento y venta de equipos biomédicos');
        
        RAISE NOTICE '✅ 5 proveedores de ejemplo creados';
        
        -- Obtener el ID del primer proveedor para agregar datos financieros
        SELECT id INTO v_proveedor_id 
        FROM proveedores 
        WHERE nit = '900123456-1';
        
        -- Agregar datos financieros para el primer proveedor
        INSERT INTO proveedor_finanzas (
            proveedor_id, anio,
            activo_corriente, activo_no_corriente, activo_total,
            pasivo_corriente, pasivo_no_corriente, pasivo_total,
            patrimonio,
            ingresos_operacionales, costos_ventas, utilidad_bruta,
            gastos_operacionales, utilidad_operacional,
            gastos_intereses, utilidad_neta,
            inventarios, cuentas_por_cobrar, efectivo,
            ebitda,
            fuente, moneda
        ) VALUES 
        -- Año 2023
        (v_proveedor_id, 2023,
         1200000, 800000, 2000000,      -- Activos
         350000, 250000, 600000,         -- Pasivos
         1400000,                        -- Patrimonio
         3500000, 2100000, 1400000,      -- Ingresos y costos
         900000, 500000,                 -- Gastos y utilidad operacional
         45000, 320000,                  -- Intereses y utilidad neta
         180000, 280000, 200000,         -- Inventarios, CxC, efectivo
         550000,                         -- EBITDA
         'auditoria', 'COP'),
        
        -- Año 2024
        (v_proveedor_id, 2024,
         1500000, 900000, 2400000,       -- Activos
         400000, 300000, 700000,          -- Pasivos
         1700000,                        -- Patrimonio
         4200000, 2520000, 1680000,      -- Ingresos y costos
         1050000, 630000,                -- Gastos y utilidad operacional
         50000, 420000,                  -- Intereses y utilidad neta
         200000, 320000, 250000,         -- Inventarios, CxC, efectivo
         680000,                         -- EBITDA
         'auditoria', 'COP');
        
        RAISE NOTICE '✅ Datos financieros agregados para Soluciones Médicas S.A.S (2023-2024)';
        
        -- Agregar algunos contactos
        INSERT INTO proveedor_contactos (
            proveedor_id, nombre, cargo, telefono, celular, email, es_principal
        ) VALUES 
        (v_proveedor_id, 'Juan Pérez', 'Gerente Comercial', '(1) 234-5678', '310-123-4567', 
         'juan.perez@solucionesmedicas.com', true),
        (v_proveedor_id, 'María García', 'Coordinadora de Ventas', '(1) 234-5679', '320-987-6543',
         'maria.garcia@solucionesmedicas.com', false);
        
        RAISE NOTICE '✅ Contactos agregados para Soluciones Médicas S.A.S';
        
    ELSE
        RAISE NOTICE 'ℹ️  Ya existen % proveedores en el sistema', v_count;
        RAISE NOTICE 'ℹ️  No se crearán datos de prueba adicionales';
    END IF;
    
    -- Mostrar resumen
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DEL SISTEMA';
    RAISE NOTICE '========================================';
    
    SELECT COUNT(*) INTO v_count FROM proveedores;
    RAISE NOTICE 'Total proveedores: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM proveedor_finanzas;
    RAISE NOTICE 'Total registros financieros: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM proveedor_indicadores;
    RAISE NOTICE 'Total indicadores calculados: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM proveedor_contactos;
    RAISE NOTICE 'Total contactos: %', v_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sistema de proveedores listo para usar';
    RAISE NOTICE '';
END $$;

-- Mostrar los proveedores creados
SELECT 
    id,
    nit,
    nombre,
    estado,
    ciudad,
    departamento
FROM proveedores
ORDER BY nombre
LIMIT 10;