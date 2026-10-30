'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import Proximamente from '@/components/Proximamente'
import SeguimientoLideres from '@/components/lideres/SeguimientoLideres'

// Líderes de negocio (menú Empleados). Con lideres:seguimiento (admin y dirección comercial): el seguimiento de las
// líderes, hoy desde el Excel "Tracker Líderes" (dueño, 2026-10-29, docs/decisiones/2026-10-29-historico-tracker-lideres.md).
// Para los demás, "Próximamente".
export default function LideresPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="lideres:seguimiento"
        fallback={<Proximamente titulo="Líderes de negocio" permiso="executives:view" descripcion="Esta sección está en preparación." />}
      >
        <div className="container mx-auto p-4 sm:p-6">
          <SeguimientoLideres />
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}
