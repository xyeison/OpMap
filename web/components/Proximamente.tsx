'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import type { Permission } from '@/lib/permissions'

// Página "Próximamente" del menú (dueño, 2026-10-29, docs/specs/2026-10-29-menu-por-grupos.md): la opción ya está en su
// lugar del menú y dice que viene; el contenido se define después.
export default function Proximamente({ titulo, permiso, descripcion }: { titulo: string; permiso: Permission; descripcion: string }) {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission={permiso}
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <strong className="font-semibold">Acceso denegado</strong>
              <p className="text-sm mt-1">No tienes permisos para ver esta sección.</p>
            </div>
          </div>
        }
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-5 sm:p-6 mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{titulo}</h1>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
            <span className="inline-block rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Próximamente
            </span>
            <p className="mx-auto mt-3 max-w-md text-gray-700">{descripcion}</p>
          </div>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}
