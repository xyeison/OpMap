'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Proveedor, 
  ProveedorFinanzas, 
  ProveedorIndicadores,
  ProveedorContacto,
  ProveedorEnlace
} from '@/types/providers';
import FinancialIndicators from '@/components/providers/FinancialIndicators';
import ProviderContracts from '@/components/providers/ProviderContracts';
import FinancialDataForm from '@/components/providers/FinancialDataForm';
import ProviderEditModal from '@/components/providers/ProviderEditModal';
import LinksList from '@/components/providers/LinksList';
import ProviderIndicatorsForm from '@/components/ProviderIndicatorsForm';

type TabType = 'general' | 'financiero' | 'contratos' | 'enlaces';

const tabs = [
  { 
    id: 'general', 
    label: 'General',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  { 
    id: 'financiero', 
    label: 'Financiero',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  { 
    id: 'contratos', 
    label: 'Contratos',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  { 
    id: 'enlaces', 
    label: 'Enlaces',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    )
  }
];

// Add CSS animations
const animationStyles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

export default function ProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [provider, setProvider] = useState<Proveedor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingFinancialId, setEditingFinancialId] = useState<string | null>(null);
  const [showAddFinancial, setShowAddFinancial] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showIndicatorsForm, setShowIndicatorsForm] = useState(false);

  const fetchProvider = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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
  }, [providerId]);

  useEffect(() => {
    fetchProvider();
  }, [fetchProvider]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Navigate tabs with arrow keys
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setActiveTab(tabs[currentIndex - 1].id as TabType);
        } else if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
          setActiveTab(tabs[currentIndex + 1].id as TabType);
        }
      }
      // Open edit modal with Cmd/Ctrl + E
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setShowEditModal(true);
      }
      // Refresh with Cmd/Ctrl + R
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        fetchProvider();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, fetchProvider]);

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
    }).format(value * 1000000);
  };

  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null) return '—';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatIndicator = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null) return '—';
    return value.toFixed(decimals);
  };

  const handleDeleteFinancial = async (financialId: string, year: number) => {
    if (!confirm(`¿Está seguro de eliminar los datos financieros del año ${year}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/providers/${providerId}/finances?financeId=${financialId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Datos financieros eliminados exitosamente');
        fetchProvider();
      } else {
        const error = await response.json();
        alert(`Error al eliminar: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting financial data:', error);
      alert('Error al eliminar datos financieros');
    }
  };

  const handleFinancialSaved = () => {
    setEditingFinancialId(null);
    setShowAddFinancial(false);
    fetchProvider();
  };

  const handleEditFinancial = (financialData: ProveedorFinanzas) => {
    setEditingFinancialId(financialData.id);
    setShowAddFinancial(false);
  };

  const handleDelete = async () => {
    if (!confirm('¿Está seguro de que desea eliminar este proveedor? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Proveedor eliminado exitosamente');
        router.push('/providers');
      } else {
        const error = await response.json();
        alert(`Error al eliminar proveedor: ${error.error || 'Error desconocido'}${error.suggestion ? '\n\n' + error.suggestion : ''}`);
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
      alert('Error de conexión al eliminar proveedor');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-gray-200 border-t-gray-900 mx-auto"></div>
            <div className="mt-4 text-sm text-gray-600 animate-pulse">Cargando información...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-md bg-white rounded-xl p-8 shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No se pudo cargar el proveedor</h3>
          <p className="text-gray-600 mb-6">{error || 'El proveedor solicitado no existe o fue eliminado'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fetchProvider()}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push('/providers')}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all duration-200"
            >
              Volver a Proveedores
            </button>
          </div>
        </div>
      </div>
    );
  }

  const latestFinancials = getLatestFinancialData();
  const latestIndicators = getLatestIndicators();

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'activo':
        return 'bg-gray-900 text-white';
      case 'inactivo':
        return 'bg-gray-200 text-gray-600';
      case 'prospecto':
        return 'bg-gray-100 text-gray-900 border border-gray-300';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <>
      <style jsx>{animationStyles}</style>
      <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top bar with all controls */}
          <div className="py-4">
            {/* First row: Back button, provider info, and action buttons */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/providers')}
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Volver"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-600">
                      {provider.nombre.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">{provider.nombre}</h1>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(provider.estado)}`}>
                        {provider.estado.toUpperCase()}
                      </span>
                      <span className="text-gray-500">NIT: {provider.nit}</span>
                      {provider.ciudad && (
                        <span className="text-gray-500">• {provider.ciudad}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    await fetchProvider();
                    setIsRefreshing(false);
                  }}
                  className={`p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                  title="Actualizar"
                  disabled={isRefreshing}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar proveedor"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                >
                  Editar
                </button>
              </div>
            </div>

            {/* Second row: Navigation tabs */}
            <div className="flex gap-4 border-t pt-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area with proper spacing */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* General Tab with Animations */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Quick Stats Card */}
            {latestIndicators && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-semibold text-gray-900">
                    Indicadores de Licitación ({latestIndicators.anio})
                  </h2>
                  <button
                    onClick={() => setShowIndicatorsForm(true)}
                    className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                  >
                    Actualizar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-lg transition-all duration-300 hover:scale-[1.02] cursor-default ${latestIndicators.cumple_liquidez ? 'bg-gray-50 border border-gray-200' : 'bg-gray-100 border border-gray-300'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-600">Índice de Liquidez</p>
                        <p className={`text-2xl font-semibold mt-1 ${latestIndicators.cumple_liquidez ? 'text-gray-900' : 'text-gray-600'}`}>
                          {formatIndicator(latestIndicators.indice_liquidez)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Mínimo: 1.2</p>
                      </div>
                      {latestIndicators.cumple_liquidez ? (
                        <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg transition-all duration-300 hover:scale-[1.02] cursor-default ${latestIndicators.cumple_endeudamiento ? 'bg-gray-50 border border-gray-200' : 'bg-gray-100 border border-gray-300'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-600">Endeudamiento</p>
                        <p className={`text-2xl font-semibold mt-1 ${latestIndicators.cumple_endeudamiento ? 'text-gray-900' : 'text-gray-600'}`}>
                          {formatPercentage(latestIndicators.indice_endeudamiento)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Máximo: 70%</p>
                      </div>
                      {latestIndicators.cumple_endeudamiento ? (
                        <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg transition-all duration-300 hover:scale-[1.02] cursor-default ${latestIndicators.cumple_cobertura ? 'bg-gray-50 border border-gray-200' : 'bg-gray-100 border border-gray-300'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-600">Cobertura Intereses</p>
                        <p className={`text-2xl font-semibold mt-1 ${latestIndicators.cumple_cobertura ? 'text-gray-900' : 'text-gray-600'}`}>
                          {formatIndicator(latestIndicators.cobertura_intereses)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Mínimo: 1.5</p>
                      </div>
                      {latestIndicators.cumple_cobertura ? (
                        <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
                {latestIndicators.cumple_todos_requisitos && (
                  <div className="mt-4 p-3 bg-gray-100 text-gray-900 rounded-lg text-center text-sm font-medium">
                    Cumple todos los requisitos para participar en licitaciones
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Company Info Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Información de la Empresa
                </h2>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm text-gray-500">Razón Social</dt>
                    <dd className="mt-1 text-gray-900 font-medium">{provider.nombre}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">NIT</dt>
                    <dd className="mt-1 text-gray-900">{provider.nit}</dd>
                  </div>
                  {provider.website_url && (
                    <div>
                      <dt className="text-sm text-gray-500">Sitio Web</dt>
                      <dd className="mt-1">
                        <a href={provider.website_url} target="_blank" rel="noopener noreferrer" 
                           className="text-gray-900 hover:text-gray-700 underline flex items-center">
                          {provider.website_url}
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </dd>
                    </div>
                  )}
                  {provider.descripcion_corta && (
                    <div>
                      <dt className="text-sm text-gray-500">Descripción</dt>
                      <dd className="mt-1 text-gray-900">{provider.descripcion_corta}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Contact Info Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Información de Contacto
                </h2>
                <dl className="space-y-4">
                  {provider.telefono && (
                    <div>
                      <dt className="text-sm text-gray-500">Teléfono</dt>
                      <dd className="mt-1 text-gray-900">{provider.telefono}</dd>
                    </div>
                  )}
                  {provider.email && (
                    <div>
                      <dt className="text-sm text-gray-500">Email</dt>
                      <dd className="mt-1">
                        <a href={`mailto:${provider.email}`} className="text-gray-900 hover:text-gray-700 underline">
                          {provider.email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {provider.ciudad && (
                    <div>
                      <dt className="text-sm text-gray-500">Ciudad</dt>
                      <dd className="mt-1 text-gray-900">{provider.ciudad}</dd>
                    </div>
                  )}
                  {provider.direccion && (
                    <div>
                      <dt className="text-sm text-gray-500">Dirección</dt>
                      <dd className="mt-1 text-gray-900">{provider.direccion}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Financiero Tab with Animations */}
        {activeTab === 'financiero' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-end">
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {isEditing ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Cancelar</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Agregar Datos Financieros</span>
                  </>
                )}
              </button>
            </div>

            {isEditing && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <FinancialDataForm
                  proveedorId={providerId}
                  onSave={() => {
                    setIsEditing(false);
                    fetchProvider();
                  }}
                  onCancel={() => setIsEditing(false)}
                />
              </div>
            )}

            {latestIndicators && !isEditing && (
              <FinancialIndicators 
                indicadores={latestIndicators}
                anio={latestIndicators.anio}
              />
            )}

            {(!provider.finanzas || provider.finanzas.length === 0) && !isEditing && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin información financiera</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Registra los estados financieros para calcular automáticamente los indicadores requeridos en licitaciones.
                </p>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                >
                  Agregar Información Financiera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Contratos Tab with Animation */}
        {activeTab === 'contratos' && (
          <div className="animate-fadeIn">
            <ProviderContracts proveedorId={providerId} />
          </div>
        )}

        {/* Enlaces Tab with Animation */}
        {activeTab === 'enlaces' && (
          <div className="animate-fadeIn">
            <LinksList proveedorId={providerId} />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && provider && (
        <ProviderEditModal
          provider={provider}
          onClose={() => setShowEditModal(false)}
          onSave={(updatedProvider) => {
            setProvider(updatedProvider);
            setShowEditModal(false);
            fetchProvider();
          }}
        />
      )}

      {/* Modal de Indicadores Financieros */}
      {showIndicatorsForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-gray-50 rounded-xl">
            <ProviderIndicatorsForm
              providerId={providerId}
              year={new Date().getFullYear()}
              onSaved={() => {
                setShowIndicatorsForm(false);
                fetchProvider();
              }}
              onCancel={() => setShowIndicatorsForm(false)}
            />
          </div>
        </div>
      )}
      </div>
    </>
  );
}