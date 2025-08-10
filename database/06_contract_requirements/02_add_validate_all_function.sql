-- ==================================================================
-- AGREGAR FUNCIÓN PARA VALIDAR TODOS LOS CONTRATOS
-- ==================================================================

CREATE OR REPLACE FUNCTION validar_todos_contratos()
RETURNS jsonb AS $$
DECLARE
    v_contract RECORD;
    v_result jsonb;
    v_count_validated integer := 0;
    v_count_cumple integer := 0;
    v_count_no_cumple integer := 0;
    v_errors jsonb := '[]'::jsonb;
BEGIN
    -- Iterate through all active contracts
    FOR v_contract IN 
        SELECT id 
        FROM hospital_contracts 
        WHERE active = true
    LOOP
        BEGIN
            -- Validate each contract
            SELECT validar_cumplimiento_contrato(v_contract.id) INTO v_result;
            
            v_count_validated := v_count_validated + 1;
            
            IF (v_result->>'cumple')::boolean = true THEN
                v_count_cumple := v_count_cumple + 1;
            ELSE
                v_count_no_cumple := v_count_no_cumple + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with other contracts
            v_errors := v_errors || jsonb_build_object(
                'contract_id', v_contract.id,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    -- Return summary
    RETURN jsonb_build_object(
        'validated', v_count_validated,
        'cumple', v_count_cumple,
        'no_cumple', v_count_no_cumple,
        'errors', v_errors,
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_todos_contratos() IS 'Valida el cumplimiento de requisitos para todos los contratos activos';

-- ==================================================================
-- FIN DEL SCRIPT
-- ==================================================================