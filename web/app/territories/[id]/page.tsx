'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface TerritoryDetail {
  id: string
  name: string
  type: 'municipality' | 'locality'
  departmentName?: string
  hospitalCount: number
  totalBeds: number
  highLevelHospitals: number
  activeHospitals: number
  population?: number
  isForced: boolean
  forcedKamId?: string
  forcedKamName?: string
  forcedKamColor?: string
  forcedReason?: string
  currentKamId?: string
  currentKamName?: string
  currentKamColor?: string
}

export default function TerritoryDetailPage() {
  const params = useParams()
  const territoryId = params.id as string
  
  const [territory, setTerritory] = useState<TerritoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (territoryId) {
      loadTerritoryData()
    }
  }, [territoryId])

  const loadTerritoryData = async () => {
    setLoading(true)
    
    try {
      // Cargar estadísticas del territorio
      const { data: statsData } = await supabase
        .from('territory_statistics')
        .select('*')
        .eq('territory_id', territoryId)
        .single()
      
      if (statsData) {
        setTerritory({
          id: statsData.territory_id,
          name: statsData.territory_name,
          type: statsData.territory_type,
          hospitalCount: statsData.hospital_count || 0,
          totalBeds: statsData.total_beds || 0,
          highLevelHospitals: statsData.high_level_hospitals || 0,
          activeHospitals: statsData.active_hospitals || 0,
          isForced: statsData.is_forced || false,
          forcedKamId: statsData.forced_kam_id,
          forcedKamName: statsData.forced_kam_name,
          forcedKamColor: statsData.forced_kam_color,
          forcedReason: statsData.forced_reason
        })
      }
    } catch (error) {
      console.error('Error loading territory:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/territories" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
        ← Volver a territorios
      </Link>
      <h1 className="text-3xl font-bold">{territory?.name}</h1>
      <p>Detalles del territorio - En construcción</p>
    </div>
  )
}