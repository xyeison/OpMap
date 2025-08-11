'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Proveedor, ProveedorConIndicadores } from '@/types/providers';

export default function ProvidersListPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProveedorConIndicadores[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    nombre: '',
    nit: '',
    email: '',
    telefono: '',
    ciudad: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [currentPage, searchTerm, filterEstado]);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (filterEstado) params.append('estado', filterEstado);

      const response = await fetch(`/api/providers?${params}`);
      if (!response.ok) throw new Error('Error al cargar proveedores');
      
      const data = await response.json();
      setProviders(data.data || []);
      setTotalCount(data.total || 0);
      setTotalPages(Math.ceil(data.total / pageSize));
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProviders();
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

  const getRiskColor = (categoria: string | undefined) => {
    switch (categoria) {
      case 'muy_bajo': return 'bg-green-100 text-green-800';
      case 'bajo': return 'bg-gray-200 text-gray-800';
      case 'medio': return 'bg-yellow-100 text-yellow-800';
      case 'alto': return 'bg-orange-100 text-orange-800';
      case 'muy_alto': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createFormData)
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateModal(false);
        setCreateFormData({
          nombre: '',
          nit: '',
          email: '',
          telefono: '',
          ciudad: ''
        });
        fetchProviders(); // Recargar lista
        // Opcionalmente ir al perfil del nuevo proveedor
        router.push(`/providers/${data.data.id}`);
      } else {
        const error = await response.json();
        // Mostrar mensaje de error específico o sugerencia si existe
        const errorMessage = error.error || 'Error desconocido';
        const suggestion = error.suggestion ? `\n\n${error.suggestion}` : '';
        alert(`${errorMessage}${suggestion}`);
      }
    } catch (error) {
      console.error('Error creating provider:', error);
      alert('Error de conexión al crear proveedor');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Proveedores</h1>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 hidden sm:block">
                  Gestiona tu base de proveedores y su información financiera
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-2 sm:px-4 bg-gray-900 text-white rounded-lg hover:bg-black flex items-center justify-center gap-2 transition-all shadow-sm text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Nuevo Proveedor</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto pt-16 sm:pt-20">
        {/* Filters */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
            <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Buscar
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o NIT..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>
              
              <div className="sm:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="prospecto">Prospecto</option>
                </select>
              </div>
              
              <div className="flex items-end sm:col-span-2 lg:col-span-2">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-black transition-all"
                >
                  Aplicar Filtros
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Table/Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
              </div>
            ) : providers.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Proveedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          NIT
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
                      {providers.map((provider) => (
                        <tr key={provider.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {provider.nombre}
                              </div>
                              {provider.ciudad && (
                                <div className="text-sm text-gray-500">{provider.ciudad}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {provider.nit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              provider.estado === 'activo' 
                                ? 'bg-green-100 text-green-800' 
                                : provider.estado === 'inactivo'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {provider.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/providers/${provider.id}`}
                              className="text-gray-700 hover:text-black font-medium transition-colors"
                            >
                              Ver detalle
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-200">
                  {providers.map((provider) => (
                    <Link
                      key={provider.id}
                      href={`/providers/${provider.id}`}
                      className="block p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {provider.nombre}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            NIT: {provider.nit}
                          </div>
                          {provider.ciudad && (
                            <div className="text-xs text-gray-500">
                              {provider.ciudad}
                            </div>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          provider.estado === 'activo' 
                            ? 'bg-green-100 text-green-800' 
                            : provider.estado === 'inactivo'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {provider.estado}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          Ver detalle
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  {/* Mobile Pagination */}
                  <div className="flex-1 flex justify-between items-center sm:hidden">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Anterior
                    </button>
                    <span className="text-xs text-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                      <svg className="h-4 w-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Desktop Pagination */}
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> a{' '}
                        <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> de{' '}
                        <span className="font-medium">{totalCount}</span> resultados
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="sr-only">Anterior</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                                pageNum === currentPage
                                  ? 'z-10 bg-gray-900 border-gray-900 text-white'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="sr-only">Siguiente</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="mt-4 text-gray-500">No se encontraron proveedores</p>
                <p className="mt-1 text-sm text-gray-400">Ajusta los filtros o crea un nuevo proveedor</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de creación de proveedor - Responsive */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 sm:p-6 border-b">
                <h3 className="text-lg font-semibold">Crear nuevo proveedor</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <form id="createProviderForm" onSubmit={handleCreateProvider}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre de la empresa *
                      </label>
                      <input
                        type="text"
                        value={createFormData.nombre}
                        onChange={(e) => setCreateFormData({ ...createFormData, nombre: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NIT *
                      </label>
                      <input
                        type="text"
                        value={createFormData.nit}
                        onChange={(e) => setCreateFormData({ ...createFormData, nit: e.target.value })}
                        required
                        placeholder="900123456-1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ciudad
                      </label>
                      <input
                        type="text"
                        value={createFormData.ciudad}
                        onChange={(e) => setCreateFormData({ ...createFormData, ciudad: e.target.value })}
                        placeholder="Bogotá"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email corporativo
                      </label>
                      <input
                        type="email"
                        value={createFormData.email}
                        onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                        placeholder="contacto@empresa.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={createFormData.telefono}
                        onChange={(e) => setCreateFormData({ ...createFormData, telefono: e.target.value })}
                        placeholder="(601) 123 4567"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                      />
                    </div>
                  </div>
                </form>
              </div>
              
              {/* Modal Footer */}
              <div className="border-t px-4 py-3 sm:px-6 sm:py-4 bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  disabled={isCreating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="createProviderForm"
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creando...
                    </span>
                  ) : (
                    'Crear Proveedor'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}