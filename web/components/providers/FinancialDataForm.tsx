'use client';

import React, { useState, useEffect } from 'react';
import { CreateProveedorFinanzasDTO, ProveedorFinanzas } from '@/types/providers';

interface FinancialDataFormProps {
  proveedorId: string;
  initialData?: ProveedorFinanzas;
  onSave?: () => void;
  onCancel?: () => void;
}

export default function FinancialDataForm({ 
  proveedorId, 
  initialData,
  onSave, 
  onCancel 
}: FinancialDataFormProps) {
  const currentYear = new Date().getFullYear();
  const [saving, setSaving] = useState(false);
  const isEditing = !!initialData?.id;
  
  // Inicializar formData con initialData si está en modo edición
  const [formData, setFormData] = useState<CreateProveedorFinanzasDTO>({
    proveedor_id: proveedorId,
    anio: initialData?.anio || currentYear,
    // Balance General
    activo_corriente: initialData?.activo_corriente || undefined,
    activo_no_corriente: initialData?.activo_no_corriente || undefined,
    pasivo_corriente: initialData?.pasivo_corriente || undefined,
    pasivo_no_corriente: initialData?.pasivo_no_corriente || undefined,
    // Estado de Resultados
    ingresos_operacionales: initialData?.ingresos_operacionales || undefined,
    utilidad_operacional: initialData?.utilidad_operacional || undefined,
    gastos_intereses: initialData?.gastos_intereses || undefined,
    utilidad_neta: initialData?.utilidad_neta || undefined,
    inventarios: initialData?.inventarios || undefined,
    // Valores calculados automáticamente
    activo_total: initialData?.activo_total || undefined,
    pasivo_total: initialData?.pasivo_total || undefined,
    patrimonio: initialData?.patrimonio || undefined,
    // Otros
    fuente: initialData?.fuente || 'manual',
    moneda: initialData?.moneda || 'COP',
    fecha_corte: initialData?.fecha_corte || new Date().toISOString().split('T')[0]
  });
  
  // Actualizar formData si initialData cambia
  useEffect(() => {
    if (initialData) {
      setFormData({
        proveedor_id: proveedorId,
        anio: initialData.anio,
        activo_corriente: initialData.activo_corriente || undefined,
        activo_no_corriente: initialData.activo_no_corriente || undefined,
        pasivo_corriente: initialData.pasivo_corriente || undefined,
        pasivo_no_corriente: initialData.pasivo_no_corriente || undefined,
        ingresos_operacionales: initialData.ingresos_operacionales || undefined,
        utilidad_operacional: initialData.utilidad_operacional || undefined,
        gastos_intereses: initialData.gastos_intereses || undefined,
        utilidad_neta: initialData.utilidad_neta || undefined,
        inventarios: initialData.inventarios || undefined,
        activo_total: initialData.activo_total || undefined,
        pasivo_total: initialData.pasivo_total || undefined,
        patrimonio: initialData.patrimonio || undefined,
        fuente: initialData.fuente || 'manual',
        moneda: initialData.moneda || 'COP',
        fecha_corte: initialData.fecha_corte || new Date().toISOString().split('T')[0]
      });
    }
  }, [initialData, proveedorId]);

  // Calcular valores automáticamente
  const calculateTotals = (data: typeof formData) => {
    const activoTotal = (data.activo_corriente || 0) + (data.activo_no_corriente || 0);
    const pasivoTotal = (data.pasivo_corriente || 0) + (data.pasivo_no_corriente || 0);
    const patrimonio = activoTotal - pasivoTotal;

    return {
      ...data,
      activo_total: activoTotal || undefined,
      pasivo_total: pasivoTotal || undefined,
      patrimonio: patrimonio || undefined
    };
  };

  const handleNumberChange = (field: keyof CreateProveedorFinanzasDTO, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    const newData = {
      ...formData,
      [field]: numValue
    };
    
    // Recalcular totales si es necesario
    const calculatedData = calculateTotals(newData);
    setFormData(calculatedData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/providers/${proveedorId}/finances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        if (onSave) onSave();
      } else {
        const error = await response.json();
        // Mostrar mensaje de error específico o sugerencia si existe
        const errorMessage = error.error || 'Error desconocido';
        const suggestion = error.suggestion ? `\n\n${error.suggestion}` : '';
        alert(`${errorMessage}${suggestion}`);
      }
    } catch (error) {
      console.error('Error saving financial data:', error);
      alert('Error al guardar datos financieros');
    } finally {
      setSaving(false);
    }
  };

  // Calcular indicadores en tiempo real
  const calculateIndicators = () => {
    const indicators = {
      indice_liquidez: formData.pasivo_corriente ? 
        (formData.activo_corriente || 0) / formData.pasivo_corriente : null,
      indice_endeudamiento: formData.activo_total ? 
        (formData.pasivo_total || 0) / formData.activo_total : null,
      cobertura_intereses: formData.gastos_intereses ? 
        (formData.utilidad_operacional || 0) / formData.gastos_intereses : null
    };

    return {
      ...indicators,
      cumple_liquidez: indicators.indice_liquidez !== null && indicators.indice_liquidez >= 1.2,
      cumple_endeudamiento: indicators.indice_endeudamiento !== null && indicators.indice_endeudamiento <= 0.7,
      cumple_cobertura: indicators.cobertura_intereses !== null && indicators.cobertura_intereses >= 1.5
    };
  };

  const indicators = calculateIndicators();
  const cumpleTodos = indicators.cumple_liquidez && indicators.cumple_endeudamiento && indicators.cumple_cobertura;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {isEditing ? 'Editar' : 'Agregar'} Datos Financieros - Año {formData.anio}
        </h3>

        {/* Selector de año y fuente */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Año *
            </label>
            <select
              value={formData.anio}
              onChange={(e) => setFormData({ ...formData, anio: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              required
            >
              {[...Array(5)].map((_, i) => {
                const year = currentYear - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuente
            </label>
            <select
              value={formData.fuente}
              onChange={(e) => setFormData({ ...formData, fuente: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="manual">Manual</option>
              <option value="supersociedades">Supersociedades</option>
              <option value="rues">RUES</option>
              <option value="auditoria">Auditoría</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Corte
            </label>
            <input
              type="date"
              value={formData.fecha_corte}
              onChange={(e) => setFormData({ ...formData, fecha_corte: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
        </div>

        {/* Balance General */}
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            Balance General (valores en millones de COP)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activo Corriente
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.activo_corriente || ''}
                onChange={(e) => handleNumberChange('activo_corriente', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activo No Corriente
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.activo_no_corriente || ''}
                onChange={(e) => handleNumberChange('activo_no_corriente', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activo Total (calculado)
              </label>
              <input
                type="number"
                value={formData.activo_total || ''}
                className="w-full px-3 py-2 border bg-gray-100 rounded-lg"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pasivo Corriente
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pasivo_corriente || ''}
                onChange={(e) => handleNumberChange('pasivo_corriente', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pasivo No Corriente
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pasivo_no_corriente || ''}
                onChange={(e) => handleNumberChange('pasivo_no_corriente', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pasivo Total (calculado)
              </label>
              <input
                type="number"
                value={formData.pasivo_total || ''}
                className="w-full px-3 py-2 border bg-gray-100 rounded-lg"
                disabled
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patrimonio (calculado)
              </label>
              <input
                type="number"
                value={formData.patrimonio || ''}
                className="w-full px-3 py-2 border bg-gray-100 rounded-lg"
                disabled
              />
            </div>
          </div>
        </div>

        {/* Estado de Resultados */}
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            Estado de Resultados (valores en millones de COP)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ingresos Operacionales
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.ingresos_operacionales || ''}
                onChange={(e) => handleNumberChange('ingresos_operacionales', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Utilidad Operacional
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.utilidad_operacional || ''}
                onChange={(e) => handleNumberChange('utilidad_operacional', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gastos por Intereses
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.gastos_intereses || ''}
                onChange={(e) => handleNumberChange('gastos_intereses', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Utilidad Neta
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.utilidad_neta || ''}
                onChange={(e) => handleNumberChange('utilidad_neta', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inventarios
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.inventarios || ''}
                onChange={(e) => handleNumberChange('inventarios', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Vista previa de indicadores */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            Vista Previa de Indicadores Clave
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded p-3">
              <div className="text-sm text-gray-500">Índice de Liquidez</div>
              <div className={`text-xl font-bold ${indicators.cumple_liquidez ? 'text-green-600' : 'text-red-600'}`}>
                {indicators.indice_liquidez ? indicators.indice_liquidez.toFixed(2) : 'N/A'}
              </div>
              <div className="text-xs text-gray-400">Mínimo: 1.2</div>
            </div>

            <div className="bg-white rounded p-3">
              <div className="text-sm text-gray-500">Índice de Endeudamiento</div>
              <div className={`text-xl font-bold ${indicators.cumple_endeudamiento ? 'text-green-600' : 'text-red-600'}`}>
                {indicators.indice_endeudamiento ? 
                  `${(indicators.indice_endeudamiento * 100).toFixed(1)}%` : 'N/A'}
              </div>
              <div className="text-xs text-gray-400">Máximo: 70%</div>
            </div>

            <div className="bg-white rounded p-3">
              <div className="text-sm text-gray-500">Cobertura de Intereses</div>
              <div className={`text-xl font-bold ${indicators.cumple_cobertura ? 'text-green-600' : 'text-red-600'}`}>
                {indicators.cobertura_intereses ? 
                  `${indicators.cobertura_intereses.toFixed(2)}x` : 'N/A'}
              </div>
              <div className="text-xs text-gray-400">Mínimo: 1.5x</div>
            </div>
          </div>

          {formData.activo_total && formData.pasivo_total && (
            <div className="mt-3 p-3 bg-white rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Cumplimiento para Licitaciones:
                </span>
                {cumpleTodos ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Cumple requisitos
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    No cumple requisitos
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 mt-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={saving}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Guardando...' : isEditing ? 'Actualizar Datos Financieros' : 'Guardar Datos Financieros'}
          </button>
        </div>
      </div>
    </form>
  );
}