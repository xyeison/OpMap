'use client';

import React, { useState } from 'react';
import { ContractRequirements } from '@/types/contract-requirements';

interface RequirementsEditModalProps {
  contractId: string;
  contractNumber?: string;
  initialData?: ContractRequirements;
  onSave: (requirements: ContractRequirements) => void;
  onClose: () => void;
}

export default function RequirementsEditModal({
  contractId,
  contractNumber,
  initialData,
  onSave,
  onClose
}: RequirementsEditModalProps) {
  const [requirements, setRequirements] = useState<ContractRequirements>({
    indice_liquidez_requerido: initialData?.indice_liquidez_requerido,
    indice_endeudamiento_maximo: initialData?.indice_endeudamiento_maximo,
    cobertura_intereses_minimo: initialData?.cobertura_intereses_minimo,
    patrimonio_minimo: initialData?.patrimonio_minimo,
    capital_trabajo_minimo: initialData?.capital_trabajo_minimo,
    experiencia_anos_minimo: initialData?.experiencia_anos_minimo,
    facturacion_anual_minima: initialData?.facturacion_anual_minima,
    rentabilidad_minima: initialData?.rentabilidad_minima,
    otros_requisitos: initialData?.otros_requisitos || ''
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/contracts/${contractId}/requirements`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requirements)
      });

      if (response.ok) {
        onSave(requirements);
        onClose();
      } else {
        const error = await response.json();
        alert(`Error al guardar requisitos: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving requirements:', error);
      alert('Error al guardar requisitos');
    } finally {
      setSaving(false);
    }
  };

  const handleNumberChange = (field: keyof ContractRequirements, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setRequirements({ ...requirements, [field]: numValue });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Requisitos Financieros del Contrato
              </h2>
              {contractNumber && (
                <p className="text-sm text-gray-500 mt-1">
                  Contrato: {contractNumber}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Indicadores Financieros Principales */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Indicadores Financieros Requeridos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Índice de Liquidez Mínimo
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={requirements.indice_liquidez_requerido || ''}
                  onChange={(e) => handleNumberChange('indice_liquidez_requerido', e.target.value)}
                  placeholder="Ej: 1.2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Activo Corriente / Pasivo Corriente
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Índice de Endeudamiento Máximo (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={requirements.indice_endeudamiento_maximo ? requirements.indice_endeudamiento_maximo * 100 : ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                    setRequirements({ ...requirements, indice_endeudamiento_maximo: value });
                  }}
                  placeholder="Ej: 70"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Pasivo Total / Activo Total × 100
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cobertura de Intereses Mínima
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={requirements.cobertura_intereses_minimo || ''}
                  onChange={(e) => handleNumberChange('cobertura_intereses_minimo', e.target.value)}
                  placeholder="Ej: 1.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilidad Operacional / Gastos Intereses
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rentabilidad Mínima (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={requirements.rentabilidad_minima || ''}
                  onChange={(e) => handleNumberChange('rentabilidad_minima', e.target.value)}
                  placeholder="Ej: 5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Margen neto sobre ventas
                </p>
              </div>
            </div>
          </div>

          {/* Requisitos de Capital */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Requisitos de Capital y Patrimonio
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patrimonio Mínimo (Millones COP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={requirements.patrimonio_minimo || ''}
                  onChange={(e) => handleNumberChange('patrimonio_minimo', e.target.value)}
                  placeholder="Ej: 5000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capital de Trabajo Mínimo (Millones COP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={requirements.capital_trabajo_minimo || ''}
                  onChange={(e) => handleNumberChange('capital_trabajo_minimo', e.target.value)}
                  placeholder="Ej: 2000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Activo Corriente - Pasivo Corriente
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facturación Anual Mínima (Millones COP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={requirements.facturacion_anual_minima || ''}
                  onChange={(e) => handleNumberChange('facturacion_anual_minima', e.target.value)}
                  placeholder="Ej: 10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Años de Experiencia Mínimos
                </label>
                <input
                  type="number"
                  value={requirements.experiencia_anos_minimo || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                    setRequirements({ ...requirements, experiencia_anos_minimo: value });
                  }}
                  placeholder="Ej: 5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Otros Requisitos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Otros Requisitos o Notas
            </label>
            <textarea
              value={requirements.otros_requisitos || ''}
              onChange={(e) => setRequirements({ ...requirements, otros_requisitos: e.target.value })}
              rows={3}
              placeholder="Certificaciones requeridas, experiencia específica, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>

          {/* Resumen de Requisitos Típicos */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Valores Típicos de Referencia:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
              <div>• Índice de Liquidez: ≥ 1.2 (estándar) o ≥ 1.5 (exigente)</div>
              <div>• Índice de Endeudamiento: ≤ 70% (estándar) o ≤ 50% (conservador)</div>
              <div>• Cobertura de Intereses: ≥ 1.5 (mínimo) o ≥ 3.0 (sólido)</div>
              <div>• Experiencia: 3-5 años (básico) o 5-10 años (consolidado)</div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Requisitos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}