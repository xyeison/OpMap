'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Proveedor, 
  ProveedorFinanzas, 
  ProveedorIndicadores,
  ProveedorContacto 
} from '@/types/providers';

type TabType = 'general' | 'financiero' | 'contratos' | 'oportunidades' | 'archivos';

export default function ProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [provider, setProvider] = useState<Proveedor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchProvider();
  }, [providerId]);

  const fetchProvider = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/providers/${providerId}`);
      if (!response.ok) {
        throw new Error('Error al cargar proveedor');
      }
      const data = await response.json();
      setProvider(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const getLatestFinancialData = (): ProveedorFinanzas | undefined => {
    return provider?.finanzas?.[0];
  };

  const getLatestIndicators = (): ProveedorIndicadores | undefined => {
    return provider?.indicadores?.[0];
  };

  const formatCurrency = (value: number | undefined): string => {
    if (value === undefined || value === null) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value * 1000000); // Valores en millones
  };

  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null) return '—';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatIndicator = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null) return '—';
    return value.toFixed(decimals);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 mb-4">{error || 'Proveedor no encontrado'}</p>
        <button
          onClick={() => router.push('/providers')}
          className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-black transition-all"
        >
          Volver a proveedores
        </button>
      </div>
    );
  }

  const latestFinancials = getLatestFinancialData();
  const latestIndicators = getLatestIndicators();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{provider.nombre}</h1>
                <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                  <span>NIT: {provider.nit}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    provider.estado === 'activo' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {provider.estado}
                  </span>
                </div>
              </div>
              <button
                onClick={() => router.push('/providers')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-all"
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'general', label: 'General' },
              { id: 'financiero', label: 'Financiero' },
              { id: 'contratos', label: 'Contratos' },
              { id: 'oportunidades', label: 'Oportunidades' },
              { id: 'archivos', label: 'Archivos' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Información General</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                  <dd className="mt-1 text-sm text-gray-900">{provider.nombre}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">NIT</dt>
                  <dd className="mt-1 text-sm text-gray-900">{provider.nit}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Sitio Web</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {provider.website_url ? (
                      <a href={provider.website_url} target="_blank" rel="noopener noreferrer" 
                         className="text-gray-700 hover:text-black underline">
                        {provider.website_url}
                      </a>
                    ) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Descripción</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {provider.descripcion_corta || '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Contacto</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
                  <dd className="mt-1 text-sm text-gray-900">{provider.telefono || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{provider.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Ciudad</dt>
                  <dd className="mt-1 text-sm text-gray-900">{provider.ciudad || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Dirección</dt>
                  <dd className="mt-1 text-sm text-gray-900">{provider.direccion || '—'}</dd>
                </div>
              </dl>
            </div>

            {latestIndicators && (
              <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold mb-4">
                  Cumplimiento Requisitos Licitación ({latestIndicators.anio})
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      latestIndicators.cumple_liquidez ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatIndicator(latestIndicators.indice_liquidez)}
                    </div>
                    <div className="text-sm text-gray-500">Índice de Liquidez</div>
                    <div className="text-xs text-gray-400">Mínimo: 1.2</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      latestIndicators.cumple_endeudamiento ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercentage(latestIndicators.indice_endeudamiento)}
                    </div>
                    <div className="text-sm text-gray-500">Endeudamiento</div>
                    <div className="text-xs text-gray-400">Máximo: 70%</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      latestIndicators.cumple_cobertura ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatIndicator(latestIndicators.cobertura_intereses)}
                    </div>
                    <div className="text-sm text-gray-500">Cobertura Intereses</div>
                    <div className="text-xs text-gray-400">Mínimo: 1.5</div>
                  </div>
                </div>
                {latestIndicators.cumple_todos_requisitos && (
                  <div className="mt-4 p-3 bg-green-50 text-green-800 rounded text-center">
                    ✓ Cumple todos los requisitos para licitación
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Financiero Tab */}
        {activeTab === 'financiero' && (
          <div className="space-y-6">
            {/* Resumen Financiero */}
            {latestFinancials && (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">
                    Estados Financieros - Año {latestFinancials.anio}
                  </h2>
                  <button className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-black transition-all">
                    Agregar Año
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Balance General</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Activo Corriente</dt>
                        <dd className="text-sm font-medium">{formatCurrency(latestFinancials.activo_corriente)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Pasivo Corriente</dt>
                        <dd className="text-sm font-medium">{formatCurrency(latestFinancials.pasivo_corriente)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Activo Total</dt>
                        <dd className="text-sm font-medium">{formatCurrency(latestFinancials.activo_total)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Pasivo Total</dt>
                        <dd className="text-sm font-medium">{formatCurrency(latestFinancials.pasivo_total)}</dd>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <dt className="text-sm text-gray-500 font-medium">Patrimonio</dt>
                        <dd className="text-sm font-bold">{formatCurrency(latestFinancials.patrimonio)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Estado de Resultados</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Ingresos</dt>
                        <dd className="text-sm font-medium">{formatCurrency(latestFinancials.ingresos_operacionales)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Utilidad Operacional</dt>
                        <dd className="text-sm font-medium">{formatCurrency(latestFinancials.utilidad_operacional)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Gastos Intereses</dt>
                        <dd className="text-sm font-medium">{formatCurrency(latestFinancials.gastos_intereses)}</dd>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <dt className="text-sm text-gray-500 font-medium">Utilidad Neta</dt>
                        <dd className="text-sm font-bold">{formatCurrency(latestFinancials.utilidad_neta)}</dd>
                      </div>
                    </dl>
                  </div>

                  {latestIndicators && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-2">Indicadores Clave</h3>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">ROE</dt>
                          <dd className="text-sm font-medium">{formatPercentage(latestIndicators.roe)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">ROA</dt>
                          <dd className="text-sm font-medium">{formatPercentage(latestIndicators.roa)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Margen Operacional</dt>
                          <dd className="text-sm font-medium">{formatPercentage(latestIndicators.margen_operacional)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Margen Neto</dt>
                          <dd className="text-sm font-medium">{formatPercentage(latestIndicators.margen_neto)}</dd>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <dt className="text-sm text-gray-500 font-medium">Score Salud</dt>
                          <dd className="text-sm font-bold">{latestIndicators.score_salud_financiera}/100</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tabla de histórico */}
            {provider.finanzas && provider.finanzas.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Histórico Financiero</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Año</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Utilidad Neta</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Activos</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Patrimonio</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">ROE</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {provider.finanzas.map((fin) => {
                        const indicators = provider.indicadores?.find(i => i.anio === fin.anio);
                        return (
                          <tr key={fin.id}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{fin.anio}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(fin.ingresos_operacionales)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(fin.utilidad_neta)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(fin.activo_total)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(fin.patrimonio)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatPercentage(indicators?.roe)}</td>
                            <td className="px-4 py-2 text-sm text-center">
                              <button className="text-gray-700 hover:text-black font-medium">Editar</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!provider.finanzas || provider.finanzas.length === 0) && (
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin información financiera</h3>
                <p className="text-gray-500 mb-6">
                  Aquí podrás registrar los estados financieros de la empresa por año.<br/>
                  Se calcularán automáticamente los indicadores requeridos para licitaciones.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                  <p className="text-sm font-medium text-gray-700 mb-2">Información que podrás registrar:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Balance General (Activos, Pasivos, Patrimonio)</li>
                    <li>• Estado de Resultados (Ingresos, Utilidades)</li>
                    <li>• Indicadores calculados automáticamente</li>
                    <li>• Validación de requisitos para licitaciones</li>
                  </ul>
                </div>
                <button className="px-6 py-2 bg-gray-900 text-white rounded hover:bg-black transition-all">
                  Agregar Información Financiera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Contratos Tab */}
        {activeTab === 'contratos' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Contratos Asociados</h2>
            {provider.contratos && provider.contratos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Municipio</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Fecha Inicio</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Fecha Fin</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {provider.contratos.map((contrato: any) => (
                      <tr key={contrato.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {contrato.hospital?.name || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {contrato.hospital?.municipality_name || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {formatCurrency(contrato.contract_value / 1000000)}
                        </td>
                        <td className="px-4 py-2 text-sm text-center">
                          {contrato.start_date ? new Date(contrato.start_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-center">
                          {contrato.end_date ? new Date(contrato.end_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            contrato.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {contrato.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center">No hay contratos asociados a este proveedor</p>
            )}
          </div>
        )}

        {/* Oportunidades Tab */}
        {activeTab === 'oportunidades' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Oportunidades</h2>
            <p className="text-gray-500 text-center">Próximamente: análisis de oportunidades comerciales</p>
          </div>
        )}

        {/* Archivos Tab */}
        {activeTab === 'archivos' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Documentos y Archivos</h2>
            <p className="text-gray-500 text-center">Próximamente: gestión de documentos</p>
          </div>
        )}
      </div>
    </div>
  );
}