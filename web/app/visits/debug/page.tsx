'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugVisitsPage() {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadVisits = async () => {
      try {
        const { data, error } = await supabase
          .from('visits')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error
        
        setVisits(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadVisits()
  }, [])

  if (loading) return <div className="p-8">Cargando...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug: Visitas en Base de Datos</h1>
      
      <div className="mb-4 p-4 bg-blue-50 rounded">
        <p className="font-semibold">Total de visitas encontradas: {visits.length}</p>
      </div>

      {visits.length === 0 ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">No hay visitas en la base de datos.</p>
          <p className="text-sm text-gray-600 mt-2">
            Por favor, importe visitas desde la página de gestión de visitas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Últimas 10 visitas:</h2>
          {visits.map((visit, index) => (
            <div key={visit.id} className="border p-4 rounded bg-gray-50">
              <h3 className="font-semibold text-blue-600">Visita {index + 1}</h3>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div><strong>ID:</strong> {visit.id}</div>
                <div><strong>KAM:</strong> {visit.kam_name} ({visit.kam_id})</div>
                <div><strong>Tipo:</strong> {visit.visit_type}</div>
                <div><strong>Contacto:</strong> {visit.contact_type}</div>
                <div><strong>Fecha:</strong> {new Date(visit.visit_date).toLocaleString('es-CO')}</div>
                <div><strong>Coordenadas:</strong> {visit.lat}, {visit.lng}</div>
                {visit.hospital_name && (
                  <div className="col-span-2"><strong>Hospital:</strong> {visit.hospital_name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Información para el mapa de calor:</h3>
        <pre className="text-xs overflow-auto">
{JSON.stringify(visits.map(v => ({
  lat: v.lat,
  lng: v.lng,
  visit_type: v.visit_type,
  contact_type: v.contact_type,
  kam_name: v.kam_name
})), null, 2)}
        </pre>
      </div>
    </div>
  )
}