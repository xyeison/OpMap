'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Proveedor } from '@/types/providers';

// Implementación propia de debounce para evitar dependencias externas
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function debounced(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

interface ProviderSelectProps {
  value?: string;
  onChange: (providerId: string | null, provider?: Proveedor) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onProviderCreated?: (provider: Proveedor) => void;
}

interface SearchResult {
  value: string;
  label: string;
  data: any;
}

export default function ProviderSelect({
  value,
  onChange,
  placeholder = 'Buscar o crear proveedor...',
  required = false,
  disabled = false,
  className = '',
  onProviderCreated
}: ProviderSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Proveedor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    nombre: '',
    nit: '',
    email: '',
    telefono: ''
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar proveedor seleccionado si hay un valor inicial
  useEffect(() => {
    if (value && !selectedProvider) {
      fetchProvider(value);
    }
  }, [value]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProvider = async (providerId: string) => {
    try {
      const response = await fetch(`/api/providers/${providerId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedProvider(data.data);
      }
    } catch (error) {
      console.error('Error fetching provider:', error);
    }
  };

  // Búsqueda de proveedores con debounce
  const searchProviders = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/providers/search?q=${encodeURIComponent(query)}&active=true`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.data);
        }
      } catch (error) {
        console.error('Error searching providers:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    searchProviders(query);
    setIsOpen(true);
  };

  const handleSelectProvider = (result: SearchResult) => {
    if (result.value === 'create-new') {
      // Mostrar formulario de creación
      setCreateFormData({
        nombre: result.data?.nombre || searchTerm,
        nit: '',
        email: '',
        telefono: ''
      });
      setShowCreateForm(true);
      setIsOpen(false);
    } else {
      // Seleccionar proveedor existente
      setSelectedProvider(result.data);
      onChange(result.value, result.data);
      setSearchTerm('');
      setIsOpen(false);
    }
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createFormData,
          tipo_empresa: 'competidor' // Por defecto
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedProvider(data.data);
        onChange(data.data.id, data.data);
        setShowCreateForm(false);
        setSearchTerm('');
        setCreateFormData({ nombre: '', nit: '', email: '', telefono: '' });
        
        if (onProviderCreated) {
          onProviderCreated(data.data);
        }
      } else {
        const error = await response.json();
        alert(`Error al crear proveedor: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating provider:', error);
      alert('Error al crear proveedor');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedProvider(null);
    onChange(null);
    setSearchTerm('');
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Input de búsqueda o proveedor seleccionado */}
      {selectedProvider ? (
        <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
          <div>
            <div className="font-medium">{selectedProvider.nombre}</div>
            <div className="text-sm text-gray-500">NIT: {selectedProvider.nit}</div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          {isLoading && (
            <div className="absolute right-2 top-2">
              <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Dropdown de resultados */}
      {isOpen && searchResults.length > 0 && !selectedProvider && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto">
          {searchResults.map((result) => (
            <button
              key={result.value}
              type="button"
              onClick={() => handleSelectProvider(result)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            >
              <div className="font-medium">
                {result.value === 'create-new' ? (
                  <span className="flex items-center text-gray-700">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {result.label}
                  </span>
                ) : (
                  <>
                    <div>{result.data.nombre}</div>
                    <div className="text-sm text-gray-500">
                      NIT: {result.data.nit}
                      {result.data.tipo_empresa && ` • ${result.data.tipo_empresa}`}
                    </div>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal de creación de proveedor */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Crear nuevo proveedor</h3>
            <form onSubmit={handleCreateProvider}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={createFormData.nombre}
                    onChange={(e) => setCreateFormData({ ...createFormData, nombre: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
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
                    placeholder="Ej: 900123456-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateFormData({ nombre: '', nit: '', email: '', telefono: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isCreating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-black disabled:opacity-50 transition-all"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creando...' : 'Crear Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}