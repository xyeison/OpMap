'use client';

import React, { useState, useEffect } from 'react';
import { MiEmpresaConfig } from '@/types/contract-requirements';

export default function MiEmpresaPage() {
  const [config, setConfig] = useState<MiEmpresaConfig>({
    nombre: '',
    nit: '',
    anio_fiscal: new Date().getFullYear(),
    activo_corriente: undefined,
    activo_total: undefined,
    pasivo_corriente: undefined,
    pasivo_total: undefined,
    patrimonio: undefined,
    ingresos_anuales: undefined,
    utilidad_neta: undefined,
    gastos_intereses: undefined,
    utilidad_operacional: undefined,
    anos_experiencia: undefined
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/mi-empresa');
      const result = await response.json();
      
      if (result.data) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      setMessage({ type: 'error', text: 'Error al cargar la configuración' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/mi-empresa', {
        method: config.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        const result = await response.json();
        setConfig(result.data);
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Error al guardar configuración' });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: 'Error al guardar configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleNumberChange = (field: keyof MiEmpresaConfig, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setConfig({ ...config, [field]: numValue });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Configuración de Mi Empresa
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Configure los datos financieros de su empresa para validar el cumplimiento de requisitos en contratos
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Información General */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Información General
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  value={config.nombre}
                  onChange={(e) => setConfig({ ...config, nombre: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIT
                </label>
                <input
                  type="text"
                  value={config.nit || ''}
                  onChange={(e) => setConfig({ ...config, nit: e.target.value })}
                  placeholder="900123456-1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Año Fiscal *
                </label>
                <input
                  type="number"
                  value={config.anio_fiscal}
                  onChange={(e) => setConfig({ ...config, anio_fiscal: parseInt(e.target.value) })}
                  required
                  min="2020"
                  max="2030"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Años de Experiencia
                </label>
                <input
                  type="number"
                  value={config.anos_experiencia || ''}
                  onChange={(e) => handleNumberChange('anos_experiencia', e.target.value)}
                  min="0"
                  placeholder="Ej: 10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Balance General */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Balance General (Millones COP)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activo Corriente
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.activo_corriente || ''}
                  onChange={(e) => handleNumberChange('activo_corriente', e.target.value)}
                  placeholder="Ej: 5000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Efectivo + Cuentas por cobrar + Inventarios</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activo Total
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.activo_total || ''}
                  onChange={(e) => handleNumberChange('activo_total', e.target.value)}
                  placeholder="Ej: 15000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Activo corriente + Activo no corriente</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pasivo Corriente
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.pasivo_corriente || ''}
                  onChange={(e) => handleNumberChange('pasivo_corriente', e.target.value)}
                  placeholder="Ej: 3000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Deudas a corto plazo (< 1 año)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pasivo Total
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.pasivo_total || ''}
                  onChange={(e) => handleNumberChange('pasivo_total', e.target.value)}
                  placeholder="Ej: 7000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Pasivo corriente + Pasivo no corriente</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patrimonio
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.patrimonio || ''}
                  onChange={(e) => handleNumberChange('patrimonio', e.target.value)}
                  placeholder="Ej: 8000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Activo total - Pasivo total</p>
              </div>
            </div>
          </div>

          {/* Estado de Resultados */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Estado de Resultados (Millones COP)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingresos Anuales
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.ingresos_anuales || ''}
                  onChange={(e) => handleNumberChange('ingresos_anuales', e.target.value)}
                  placeholder="Ej: 20000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Ventas totales del año</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Utilidad Operacional
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.utilidad_operacional || ''}
                  onChange={(e) => handleNumberChange('utilidad_operacional', e.target.value)}
                  placeholder="Ej: 2500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">EBIT</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gastos por Intereses
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.gastos_intereses || ''}
                  onChange={(e) => handleNumberChange('gastos_intereses', e.target.value)}
                  placeholder="Ej: 500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Intereses pagados por deudas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Utilidad Neta
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={config.utilidad_neta || ''}
                  onChange={(e) => handleNumberChange('utilidad_neta', e.target.value)}
                  placeholder="Ej: 1500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Utilidad después de impuestos</p>
              </div>
            </div>
          </div>

          {/* Indicadores Calculados */}
          {config.id && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Indicadores Calculados Automáticamente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Índice de Liquidez</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {config.indice_liquidez ? config.indice_liquidez.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Activo Corriente / Pasivo Corriente</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Índice de Endeudamiento</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {config.indice_endeudamiento ? `${(config.indice_endeudamiento * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Pasivo Total / Activo Total</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Cobertura de Intereses</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {config.cobertura_intereses ? `${config.cobertura_intereses.toFixed(2)}x` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Utilidad Operacional / Gastos Intereses</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Capital de Trabajo</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {config.capital_trabajo !== undefined ? 
                      `$${config.capital_trabajo.toLocaleString('es-CO')}M` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Activo Corriente - Pasivo Corriente</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">ROE</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {config.roe ? `${(config.roe * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Utilidad Neta / Patrimonio</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Margen Neto</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {config.margen_neto ? `${(config.margen_neto * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Utilidad Neta / Ingresos</p>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}