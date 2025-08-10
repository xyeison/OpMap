'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Contract {
  id: string;
  hospital_id: string;
  hospital_name?: string;
  municipality_name?: string;
  department_name?: string;
  contract_number: string;
  contract_type: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  description?: string;
  estado_vigencia?: string;
  dias_vigencia?: number;
}

interface ProviderContractsProps {
  proveedorId: string;
}

export default function ProviderContracts({ proveedorId }: ProviderContractsProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'vigente' | 'vencido'>('all');
  const [stats, setStats] = useState({
    total: 0,
    vigentes: 0,
    vencidos: 0,
    valorTotal: 0,
    valorVigente: 0
  });

  useEffect(() => {
    fetchContracts();
  }, [proveedorId]);

  const fetchContracts = async () => {
    try {
      const response = await fetch(`/api/providers/${proveedorId}/contracts`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        
        // Calcular estadísticas
        const stats = {
          total: data.contracts?.length || 0,
          vigentes: 0,
          vencidos: 0,
          valorTotal: 0,
          valorVigente: 0
        };

        data.contracts?.forEach((contract: Contract) => {
          const isVigente = new Date(contract.end_date) >= new Date();
          if (isVigente) {
            stats.vigentes++;
            stats.valorVigente += contract.contract_value || 0;
          } else {
            stats.vencidos++;
          }
          stats.valorTotal += contract.contract_value || 0;
        });

        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          Vencido hace {Math.abs(diffDays)} días
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          Vence en {diffDays} días
        </span>
      );
    } else if (diffDays <= 90) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
          Vence en {diffDays} días
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          Vigente ({diffDays} días)
        </span>
      );
    }
  };

  const filteredContracts = contracts.filter(contract => {
    if (filter === 'all') return true;
    const isVigente = new Date(contract.end_date) >= new Date();
    return filter === 'vigente' ? isVigente : !isVigente;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Contratos</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Vigentes</div>
          <div className="text-2xl font-bold text-green-600">{stats.vigentes}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Vencidos</div>
          <div className="text-2xl font-bold text-red-600">{stats.vencidos}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Valor Total</div>
          <div className="text-lg font-bold text-gray-900">
            {formatCurrency(stats.valorTotal)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Valor Vigente</div>
          <div className="text-lg font-bold text-green-600">
            {formatCurrency(stats.valorVigente)}
          </div>
        </div>
      </div>

      {/* Lista de contratos */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Contratos/Oportunidades
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todos ({stats.total})
              </button>
              <button
                onClick={() => setFilter('vigente')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'vigente' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Vigentes ({stats.vigentes})
              </button>
              <button
                onClick={() => setFilter('vencido')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'vencido' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Vencidos ({stats.vencidos})
              </button>
            </div>
          </div>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No hay contratos {filter !== 'all' ? filter + 's' : ''} para mostrar
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hospital
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contrato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Período
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {contract.hospital_name || 'Hospital'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {contract.municipality_name}, {contract.department_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contract.contract_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                        {contract.contract_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(contract.contract_value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div>{formatDate(contract.start_date)}</div>
                        <div>{formatDate(contract.end_date)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(contract.end_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/hospitals/${contract.hospital_id}`}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Ver Hospital →
                      </Link>
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