'use client'

// "/" ya no tiene dashboard (dueño, 2026-10-14: los indicadores de cobertura, oportunidades y hospitales no tienen
// sentido por ahora; se generarán después). Lleva a la página de inicio del rol (getHomeRoute): desde el 2026-10-31,
// /inicio, la cuadrícula de módulos tipo iPhone (antes, el Mapa). Recalcular asignaciones y Calcular rutas, que vivían aquí,
// están en Configuración → Asignación. El login sigue mandando a "?next=" o, sin él, a "/" y de aquí al inicio.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { usePermissions } from '@/hooks/usePermissions'
import { getHomeRoute } from '@/lib/permissions'

export default function HomePage() {
  return (
    <ProtectedRoute>
      <IrAlInicio />
    </ProtectedRoute>
  )
}

function IrAlInicio() {
  const router = useRouter()
  const { role, loading } = usePermissions()
  const inicio = getHomeRoute(role)

  useEffect(() => {
    if (!loading && inicio) router.replace(inicio)
  }, [loading, inicio, router])

  if (!loading && !inicio) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full p-6 border border-gray-200 rounded-xl bg-white">
          <p className="text-gray-900 font-medium">Tu usuario todavía no tiene ninguna opción del menú.</p>
          <p className="text-sm text-gray-600 mt-1">Pide al administrador que revise tu rol.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-gray-600">Cargando...</div>
    </div>
  )
}
