'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ContractCompliance {
  id: string;
  contract_number: string;
  hospital_name: string;
  proveedor_name?: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  contract_type: string;
  // Requisitos
  requires_liquidez: boolean;
  min_liquidez?: number;
  requires_endeudamiento: boolean;
  max_endeudamiento?: number;
  requires_cobertura: boolean;
  min_cobertura?: number;
  requires_capital_trabajo: boolean;
  min_capital_trabajo?: number;
  requires_rentabilidad: boolean;
  min_rentabilidad?: number;
  // Valores actuales
  indice_liquidez?: number;
  indice_endeudamiento?: number;
  cobertura_intereses?: number;
  capital_trabajo_neto?: number;
  rentabilidad?: number;
  // Cumplimiento
  cumple_requisitos: boolean;
  cumple_liquidez?: boolean;
  cumple_endeudamiento?: boolean;
  cumple_cobertura?: boolean;
  cumple_capital_trabajo?: boolean;
  cumple_rentabilidad?: boolean;
}

export default function ComplianceDashboardPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractCompliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'cumple' | 'no_cumple'>('all');
  const [stats, setStats] = useState({
    total: 0,
    cumple: 0,
    noCumple: 0,
    valorCumple: 0,
    valorNoCumple: 0
  });

  useEffect(() => {
    fetchCompliance();
  }, []);

  const fetchCompliance = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contracts/compliance');
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        
        // Calcular estadísticas
        const stats = {
          total: data.contracts?.length || 0,
          cumple: 0,
          noCumple: 0,
          valorCumple: 0,
          valorNoCumple: 0
        };

        data.contracts?.forEach((contract: ContractCompliance) => {
          if (contract.cumple_requisitos) {
            stats.cumple++;
            stats.valorCumple += contract.contract_value;
          } else {
            stats.noCumple++;
            stats.valorNoCumple += contract.contract_value;
          }
        });

        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching compliance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value?: number, decimals = 2) => {
    if (value === undefined || value === null) return '—';
    return value.toFixed(decimals);
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusBadge = (cumple: boolean) => {
    if (cumple) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Cumple
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        No Cumple
      </span>
    );
  };

  const getIndicatorStatus = (required: boolean, cumple?: boolean) => {
    if (!required) {
      return <span className="text-gray-400 text-xs">No requerido</span>;
    }
    if (cumple) {
      return <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>;
    }
    return <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>;
  };

  const filteredContracts = contracts.filter(contract => {
    if (filter === 'all') return true;
    if (filter === 'cumple') return contract.cumple_requisitos;
    return !contract.cumple_requisitos;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Cumplimiento de Indicadores
        </h1>
        <p className="text-gray-600">
          Evaluación de cumplimiento de requisitos financieros para contratos activos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Contratos</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Cumplen</div>
          <div className="text-2xl font-bold text-green-600">{stats.cumple}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.total > 0 ? `${((stats.cumple / stats.total) * 100).toFixed(0)}%` : '0%'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">No Cumplen</div>
          <div className="text-2xl font-bold text-red-600">{stats.noCumple}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.total > 0 ? `${((stats.noCumple / stats.total) * 100).toFixed(0)}%` : '0%'}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Valor Total (Cumple)</div>
          <div className="text-lg font-bold text-green-600">
            {formatCurrency(stats.valorCumple)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Valor Total (No Cumple)</div>
          <div className="text-lg font-bold text-red-600">
            {formatCurrency(stats.valorNoCumple)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setFilter('cumple')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'cumple'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cumplen ({stats.cumple})
          </button>
          <button
            onClick={() => setFilter('no_cumple')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'no_cumple'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            No Cumplen ({stats.noCumple})
          </button>
        </div>
        <button
          onClick={() => router.push('/contracts/new/edit')}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
        >
          + Nuevo Contrato
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredContracts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay contratos para mostrar
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contrato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hospital
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    Capital Trabajo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {contract.contract_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contract.hospital_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div>
                        <div className="text-gray-900">{contract.proveedor_name || '—'}</div>
                        {contract.proveedor_name && !contract.indice_liquidez && (
                          <div className="text-xs text-orange-600 mt-1">
                            ⚠️ Sin indicadores financieros
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(contract.contract_value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        {getIndicatorStatus(contract.requires_liquidez, contract.cumple_liquidez)}
                        {contract.requires_liquidez && (
                          <span className="text-xs text-gray-500 mt-1">
                            {contract.indice_liquidez !== null && contract.indice_liquidez !== undefined 
                              ? `${formatNumber(contract.indice_liquidez)} / ${formatNumber(contract.min_liquidez)}`
                              : `Sin datos / ${formatNumber(contract.min_liquidez)}`
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        {getIndicatorStatus(contract.requires_endeudamiento, contract.cumple_endeudamiento)}
                        {contract.requires_endeudamiento && (
                          <span className="text-xs text-gray-500 mt-1">
                            {contract.indice_endeudamiento !== null && contract.indice_endeudamiento !== undefined
                              ? `${formatPercentage(contract.indice_endeudamiento)} / ${formatPercentage(contract.max_endeudamiento)}`
                              : `Sin datos / ${formatPercentage(contract.max_endeudamiento)}`
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        {getIndicatorStatus(contract.requires_cobertura, contract.cumple_cobertura)}
                        {contract.requires_cobertura && (
                          <span className="text-xs text-gray-500 mt-1">
                            {contract.cobertura_intereses !== null && contract.cobertura_intereses !== undefined
                              ? `${formatNumber(contract.cobertura_intereses)} / ${formatNumber(contract.min_cobertura)}`
                              : `Sin datos / ${formatNumber(contract.min_cobertura)}`
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        {getIndicatorStatus(contract.requires_capital_trabajo, contract.cumple_capital_trabajo)}
                        {contract.requires_capital_trabajo && (
                          <span className="text-xs text-gray-500 mt-1">
                            {contract.capital_trabajo_neto !== null && contract.capital_trabajo_neto !== undefined
                              ? `${formatNumber(contract.capital_trabajo_neto, 0)}M / ${formatNumber(contract.min_capital_trabajo, 0)}M`
                              : `Sin datos / ${formatNumber(contract.min_capital_trabajo, 0)}M`
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(contract.cumple_requisitos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/contracts/${contract.id}/edit`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}