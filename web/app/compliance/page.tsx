'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardCumplimiento, MiEmpresaConfig } from '@/types/contract-requirements';

export default function ComplianceDashboardPage() {
  const [contracts, setContracts] = useState<DashboardCumplimiento[]>([]);
  const [miEmpresa, setMiEmpresa] = useState<MiEmpresaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    cumple: 0,
    noCumple: 0,
    sinValidar: 0,
    valorTotalCumple: 0,
    valorTotalNoCumple: 0,
    porcentajeCumplimiento: '0'
  });
  const [filter, setFilter] = useState<'all' | 'cumple' | 'no_cumple' | 'sin_validar'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch compliance dashboard
      const dashboardResponse = await fetch('/api/contracts/compliance-dashboard');
      const dashboardData = await dashboardResponse.json();
      
      if (dashboardData.data) {
        setContracts(dashboardData.data);
        setSummary(dashboardData.summary);
      }

      // Fetch mi empresa config
      const empresaResponse = await fetch('/api/mi-empresa');
      const empresaData = await empresaResponse.json();
      
      if (empresaData.data) {
        setMiEmpresa(empresaData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAll = async () => {
    setValidating(true);
    try {
      const response = await fetch('/api/contracts/compliance-dashboard', {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Error validating contracts:', error);
    } finally {
      setValidating(false);
    }
  };

  const formatCurrency = (value: number | undefined): string => {
    if (!value) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value * 1000000);
  };

  const formatNumber = (value: number | undefined, decimals = 2): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatPercentage = (value: number | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const getComplianceIcon = (cumple: boolean | null | undefined) => {
    if (cumple === true) {
      return <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>;
    }
    if (cumple === false) {
      return <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>;
    }
    return <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>;
  };

  const filteredContracts = contracts.filter(contract => {
    if (filter === 'all') return true;
    if (filter === 'cumple') return contract.cumple_requisitos === true;
    if (filter === 'no_cumple') return contract.cumple_requisitos === false;
    if (filter === 'sin_validar') return contract.cumple_requisitos === null;
    return true;
  });

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
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Dashboard de Cumplimiento
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Validación de requisitos financieros para contratos
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/mi-empresa"
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Configurar Mi Empresa
                </Link>
                <button
                  onClick={handleValidateAll}
                  disabled={validating}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
                >
                  {validating ? 'Validando...' : 'Validar Todos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mi Empresa Status */}
      {miEmpresa && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {miEmpresa.nombre} - Indicadores Actuales
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-gray-500">Liquidez</p>
                <p className="text-lg font-semibold">{formatNumber(miEmpresa.indice_liquidez)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Endeudamiento</p>
                <p className="text-lg font-semibold">{formatPercentage(miEmpresa.indice_endeudamiento)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cobertura</p>
                <p className="text-lg font-semibold">{formatNumber(miEmpresa.cobertura_intereses)}x</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Patrimonio</p>
                <p className="text-lg font-semibold">{formatCurrency(miEmpresa.patrimonio)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Capital Trabajo</p>
                <p className="text-lg font-semibold">{formatCurrency(miEmpresa.capital_trabajo)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Experiencia</p>
                <p className="text-lg font-semibold">{miEmpresa.anos_experiencia || 0} años</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Contratos</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              </div>
              <div className="text-gray-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cumple Requisitos</p>
                <p className="text-2xl font-bold text-green-600">{summary.cumple}</p>
                <p className="text-xs text-gray-500 mt-1">{formatCurrency(summary.valorTotalCumple)}</p>
              </div>
              <div className="text-green-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">No Cumple</p>
                <p className="text-2xl font-bold text-red-600">{summary.noCumple}</p>
                <p className="text-xs text-gray-500 mt-1">{formatCurrency(summary.valorTotalNoCumple)}</p>
              </div>
              <div className="text-red-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">% Cumplimiento</p>
                <p className="text-2xl font-bold text-gray-900">{summary.porcentajeCumplimiento}%</p>
                <p className="text-xs text-gray-500 mt-1">Sin validar: {summary.sinValidar}</p>
              </div>
              <div className="text-gray-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'all' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({summary.total})
            </button>
            <button
              onClick={() => setFilter('cumple')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'cumple' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              Cumple ({summary.cumple})
            </button>
            <button
              onClick={() => setFilter('no_cumple')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'no_cumple' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              No Cumple ({summary.noCumple})
            </button>
            <button
              onClick={() => setFilter('sin_validar')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'sin_validar' 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sin Validar ({summary.sinValidar})
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contrato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hospital
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Liquidez
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endeudamiento
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cobertura
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patrimonio
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capital T.
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getComplianceIcon(contract.cumple_requisitos)}
                        <span className="ml-2 text-sm text-gray-600">
                          {contract.cumple_requisitos === true ? 'Cumple' :
                           contract.cumple_requisitos === false ? 'No cumple' : 
                           'Sin validar'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {contract.contract_number || 'Sin número'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{contract.hospital_name}</div>
                      <div className="text-xs text-gray-500">
                        {contract.municipality_name}, {contract.department_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCurrency(contract.contract_value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-xs">
                        <div className={contract.cumple_liquidez ? 'text-green-600' : 'text-red-600'}>
                          {formatNumber(contract.mi_indice_liquidez)}
                        </div>
                        <div className="text-gray-500">
                          Req: {formatNumber(contract.indice_liquidez_requerido)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-xs">
                        <div className={contract.cumple_endeudamiento ? 'text-green-600' : 'text-red-600'}>
                          {formatPercentage(contract.mi_indice_endeudamiento)}
                        </div>
                        <div className="text-gray-500">
                          Max: {formatPercentage(contract.indice_endeudamiento_maximo)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-xs">
                        <div className={contract.cumple_cobertura ? 'text-green-600' : 'text-red-600'}>
                          {formatNumber(contract.mi_cobertura_intereses)}x
                        </div>
                        <div className="text-gray-500">
                          Min: {formatNumber(contract.cobertura_intereses_minimo)}x
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-xs">
                        <div className={contract.cumple_patrimonio ? 'text-green-600' : 'text-red-600'}>
                          ${(contract.mi_patrimonio || 0).toLocaleString('es-CO')}M
                        </div>
                        <div className="text-gray-500">
                          Min: ${(contract.patrimonio_minimo || 0).toLocaleString('es-CO')}M
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-xs">
                        <div className={contract.cumple_capital_trabajo ? 'text-green-600' : 'text-red-600'}>
                          ${(contract.mi_capital_trabajo || 0).toLocaleString('es-CO')}M
                        </div>
                        <div className="text-gray-500">
                          Min: ${(contract.capital_trabajo_minimo || 0).toLocaleString('es-CO')}M
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}