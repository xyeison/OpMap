'use client'

import { useState, useEffect } from 'react'

interface IndicatorData {
  id?: string
  proveedor_id: string
  anio: number
  // Indicadores de Liquidez
  indice_liquidez: number | null
  prueba_acida: number | null
  capital_trabajo_neto: number | null
  // Indicadores de Endeudamiento  
  indice_endeudamiento: number | null
  apalancamiento_financiero: number | null
  cobertura_intereses: number | null
  // Indicadores de Rentabilidad
  margen_bruto: number | null
  margen_operacional: number | null
  margen_neto: number | null
  margen_ebitda: number | null
  // Indicadores de Eficiencia
  roe: number | null
  roa: number | null
  roic: number | null
}

interface Props {
  providerId: string
  year?: number
  onSaved?: () => void
  onCancel?: () => void
}

export default function ProviderIndicatorsForm({ providerId, year, onSaved, onCancel }: Props) {
  const currentYear = new Date().getFullYear()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [indicators, setIndicators] = useState<IndicatorData>({
    proveedor_id: providerId,
    anio: year || currentYear,
    indice_liquidez: null,
    prueba_acida: null,
    capital_trabajo_neto: null,
    indice_endeudamiento: null,
    apalancamiento_financiero: null,
    cobertura_intereses: null,
    margen_bruto: null,
    margen_operacional: null,
    margen_neto: null,
    margen_ebitda: null,
    roe: null,
    roa: null,
    roic: null
  })

  useEffect(() => {
    if (year) {
      loadIndicators()
    }
  }, [year])

  const loadIndicators = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/providers/${providerId}/indicators`)
      if (response.ok) {
        const data = await response.json()
        const yearData = data.find((d: any) => d.anio === year)
        if (yearData) {
          setIndicators(yearData)
        }
      }
    } catch (error) {
      console.error('Error loading indicators:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(`/api/providers/${providerId}/indicators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(indicators)
      })

      if (response.ok) {
        alert('Indicadores guardados exitosamente')
        onSaved?.()
      } else {
        const error = await response.json()
        alert(`Error al guardar: ${error.error}`)
      }
    } catch (error) {
      console.error('Error saving indicators:', error)
      alert('Error al guardar los indicadores')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof IndicatorData, value: any) => {
    setIndicators(prev => ({
      ...prev,
      [field]: value === '' ? null : parseFloat(value)
    }))
  }

  const formatPercentageInput = (value: number | null) => {
    if (value === null) return ''
    return (value * 100).toFixed(2)
  }

  const handlePercentageChange = (field: keyof IndicatorData, value: string) => {
    const numValue = value === '' ? null : parseFloat(value) / 100
    handleChange(field, numValue)
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Indicadores Financieros - Año {indicators.anio}
        </h2>
        <div className="flex gap-2">
          <select
            value={indicators.anio}
            onChange={(e) => setIndicators(prev => ({ ...prev, anio: parseInt(e.target.value) }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {[...Array(5)].map((_, i) => {
              const y = currentYear - i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Indicadores de Liquidez */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            Indicadores de Liquidez
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Índice de Liquidez
              </label>
              <input
                type="number"
                step="0.01"
                value={indicators.indice_liquidez || ''}
                onChange={(e) => handleChange('indice_liquidez', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 1.5"
              />
              <p className="text-xs text-gray-500 mt-1">Activo corriente / Pasivo corriente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prueba Ácida
              </label>
              <input
                type="number"
                step="0.01"
                value={indicators.prueba_acida || ''}
                onChange={(e) => handleChange('prueba_acida', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 1.2"
              />
              <p className="text-xs text-gray-500 mt-1">(Activo corriente - Inventarios) / Pasivo corriente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capital de Trabajo (MM COP)
              </label>
              <input
                type="number"
                step="0.01"
                value={indicators.capital_trabajo_neto || ''}
                onChange={(e) => handleChange('capital_trabajo_neto', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 1500"
              />
              <p className="text-xs text-gray-500 mt-1">En millones de pesos</p>
            </div>
          </div>
        </div>

        {/* Indicadores de Endeudamiento */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Indicadores de Endeudamiento
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Índice de Endeudamiento (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.indice_endeudamiento)}
                onChange={(e) => handlePercentageChange('indice_endeudamiento', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 60"
              />
              <p className="text-xs text-gray-500 mt-1">Pasivo total / Activo total × 100</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apalancamiento Financiero
              </label>
              <input
                type="number"
                step="0.01"
                value={indicators.apalancamiento_financiero || ''}
                onChange={(e) => handleChange('apalancamiento_financiero', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 2.5"
              />
              <p className="text-xs text-gray-500 mt-1">Activo total / Patrimonio</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cobertura de Intereses
              </label>
              <input
                type="number"
                step="0.01"
                value={indicators.cobertura_intereses || ''}
                onChange={(e) => handleChange('cobertura_intereses', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 3.0"
              />
              <p className="text-xs text-gray-500 mt-1">EBITDA / Gastos financieros</p>
            </div>
          </div>
        </div>

        {/* Indicadores de Rentabilidad */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Indicadores de Rentabilidad
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margen Bruto (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.margen_bruto)}
                onChange={(e) => handlePercentageChange('margen_bruto', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 35"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margen Operacional (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.margen_operacional)}
                onChange={(e) => handlePercentageChange('margen_operacional', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margen Neto (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.margen_neto)}
                onChange={(e) => handlePercentageChange('margen_neto', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 8"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margen EBITDA (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.margen_ebitda)}
                onChange={(e) => handlePercentageChange('margen_ebitda', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 20"
              />
            </div>
          </div>
        </div>

        {/* Indicadores de Eficiencia */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Indicadores de Eficiencia
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ROE (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.roe)}
                onChange={(e) => handlePercentageChange('roe', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 15"
              />
              <p className="text-xs text-gray-500 mt-1">Retorno sobre patrimonio</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ROA (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.roa)}
                onChange={(e) => handlePercentageChange('roa', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 8"
              />
              <p className="text-xs text-gray-500 mt-1">Retorno sobre activos</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ROIC (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formatPercentageInput(indicators.roic)}
                onChange={(e) => handlePercentageChange('roic', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ej: 12"
              />
              <p className="text-xs text-gray-500 mt-1">Retorno sobre capital invertido</p>
            </div>
          </div>
        </div>

        {/* Evaluación de Cumplimiento */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Evaluación de Cumplimiento</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-600">Liquidez (≥ 1.2)</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                (indicators.indice_liquidez || 0) >= 1.2 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {(indicators.indice_liquidez || 0) >= 1.2 ? 'Cumple' : 'No Cumple'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-600">Endeudamiento (≤ 70%)</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                (indicators.indice_endeudamiento || 1) <= 0.7 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {(indicators.indice_endeudamiento || 1) <= 0.7 ? 'Cumple' : 'No Cumple'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-600">Cobertura (≥ 1.5)</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                (indicators.cobertura_intereses || 0) >= 1.5 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {(indicators.cobertura_intereses || 0) >= 1.5 ? 'Cumple' : 'No Cumple'}
              </span>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Indicadores'}
          </button>
        </div>
      </form>
    </div>
  )
}