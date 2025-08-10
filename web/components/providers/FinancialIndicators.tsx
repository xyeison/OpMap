'use client';

import React from 'react';
import { ProveedorIndicadores } from '@/types/providers';

interface FinancialIndicatorsProps {
  indicadores: ProveedorIndicadores | null;
  anio?: number;
}

export default function FinancialIndicators({ indicadores, anio }: FinancialIndicatorsProps) {
  if (!indicadores) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
        <p>No hay indicadores financieros calculados para este período</p>
      </div>
    );
  }

  const formatNumber = (num: number | null | undefined, decimals = 2) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toFixed(decimals);
  };

  const formatPercentage = (num: number | null | undefined) => {
    if (num === null || num === undefined) return 'N/A';
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatCurrency = (num: number | null | undefined) => {
    if (num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num * 1000000); // Convertir de millones a pesos
  };

  const getIndicatorColor = (value: number | null | undefined, type: 'liquidez' | 'endeudamiento' | 'cobertura') => {
    if (value === null || value === undefined) return 'text-gray-400';
    
    switch (type) {
      case 'liquidez':
        if (value >= 1.5) return 'text-green-600';
        if (value >= 1.2) return 'text-yellow-600';
        return 'text-red-600';
      
      case 'endeudamiento':
        if (value <= 0.5) return 'text-green-600';
        if (value <= 0.7) return 'text-yellow-600';
        return 'text-red-600';
      
      case 'cobertura':
        if (value >= 2) return 'text-green-600';
        if (value >= 1.5) return 'text-yellow-600';
        return 'text-red-600';
      
      default:
        return 'text-gray-600';
    }
  };

  const getRiskCategoryBadge = (category: string | undefined) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'muy_bajo': { bg: 'bg-green-100', text: 'text-green-800', label: 'Muy Bajo' },
      'bajo': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Bajo' },
      'medio': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medio' },
      'alto': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Alto' },
      'muy_alto': { bg: 'bg-red-100', text: 'text-red-800', label: 'Muy Alto' }
    };

    if (!category || !badges[category]) return null;
    const badge = badges[category];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con año y score */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Indicadores Financieros {anio || indicadores.anio}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Calculado: {new Date(indicadores.calculado_at).toLocaleDateString('es-CO')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Score de Salud</div>
            <div className="text-2xl font-bold text-gray-900">
              {indicadores.score_salud_financiera || 'N/A'}/100
            </div>
            {getRiskCategoryBadge(indicadores.categoria_riesgo)}
          </div>
        </div>
      </div>

      {/* Indicadores clave para licitaciones */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">
          Requisitos para Licitaciones
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Índice de Liquidez</p>
                <p className={`text-2xl font-bold ${getIndicatorColor(indicadores.indice_liquidez, 'liquidez')}`}>
                  {formatNumber(indicadores.indice_liquidez)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Mínimo: 1.2</p>
              </div>
              <div>
                {indicadores.cumple_liquidez ? (
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Índice de Endeudamiento</p>
                <p className={`text-2xl font-bold ${getIndicatorColor(indicadores.indice_endeudamiento, 'endeudamiento')}`}>
                  {formatPercentage(indicadores.indice_endeudamiento)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Máximo: 70%</p>
              </div>
              <div>
                {indicadores.cumple_endeudamiento ? (
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Cobertura de Intereses</p>
                <p className={`text-2xl font-bold ${getIndicatorColor(indicadores.cobertura_intereses, 'cobertura')}`}>
                  {formatNumber(indicadores.cobertura_intereses)}x
                </p>
                <p className="text-xs text-gray-400 mt-1">Mínimo: 1.5x</p>
              </div>
              <div>
                {indicadores.cumple_cobertura ? (
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Estado general de cumplimiento */}
        <div className="mt-4 p-4 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Cumplimiento de Requisitos para Licitación:
            </span>
            {indicadores.cumple_todos_requisitos ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cumple todos los requisitos
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                No cumple todos los requisitos
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Otros indicadores financieros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Indicadores de Rentabilidad */}
        <div className="bg-white rounded-lg shadow p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">Rentabilidad</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Margen Bruto</span>
              <span className="text-sm font-medium">{formatPercentage(indicadores.margen_bruto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Margen Operacional</span>
              <span className="text-sm font-medium">{formatPercentage(indicadores.margen_operacional)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Margen Neto</span>
              <span className="text-sm font-medium">{formatPercentage(indicadores.margen_neto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Margen EBITDA</span>
              <span className="text-sm font-medium">{formatPercentage(indicadores.margen_ebitda)}</span>
            </div>
          </div>
        </div>

        {/* Indicadores de Eficiencia */}
        <div className="bg-white rounded-lg shadow p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">Eficiencia</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">ROE</span>
              <span className="text-sm font-medium">{formatPercentage(indicadores.roe)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">ROA</span>
              <span className="text-sm font-medium">{formatPercentage(indicadores.roa)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">ROIC</span>
              <span className="text-sm font-medium">{formatPercentage(indicadores.roic)}</span>
            </div>
          </div>
        </div>

        {/* Indicadores de Actividad */}
        <div className="bg-white rounded-lg shadow p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">Actividad</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Rotación Activos</span>
              <span className="text-sm font-medium">{formatNumber(indicadores.rotacion_activos)}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Días Cartera</span>
              <span className="text-sm font-medium">{indicadores.dias_cartera || 'N/A'} días</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Días Inventario</span>
              <span className="text-sm font-medium">{indicadores.dias_inventario || 'N/A'} días</span>
            </div>
          </div>
        </div>

        {/* Indicadores de Liquidez adicionales */}
        <div className="bg-white rounded-lg shadow p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">Liquidez</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Prueba Ácida</span>
              <span className="text-sm font-medium">{formatNumber(indicadores.prueba_acida)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Capital de Trabajo</span>
              <span className="text-sm font-medium">{formatCurrency(indicadores.capital_trabajo_neto)}</span>
            </div>
          </div>
        </div>

        {/* Indicadores de Endeudamiento adicionales */}
        <div className="bg-white rounded-lg shadow p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">Endeudamiento</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Apalancamiento</span>
              <span className="text-sm font-medium">{formatNumber(indicadores.apalancamiento_financiero)}x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}