'use client'

// Cuentas clave (/terceros, menú Terceros desde el 2026-10-29): las cuentas con sus sedes y contactos (Fase 6 · F1), con
// su detalle y el formulario para crear. Hoy son las IPS; el dueño explicará qué más entra (clientes y competidores).
// Médicos salió de aquí y está en "Próximamente" (/medicos); su API y la app de visita no cambian.
// Contrato: docs/fases/fase6-visitas-f1-terceros.md (sección "Interfaz"). Permisos: terceros:view para ver,
// terceros:create para crear, terceros:manage para editar y ver documentos. Los terceros no entran a hospitals (ni
// zonas, ni mapa, ni rutas).
import { useCallback, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import CuentaDetalleModal from '@/components/terceros/CuentaDetalleModal'
import CuentaForm from '@/components/terceros/CuentaForm'
import CuentasTab from '@/components/terceros/CuentasTab'
import { AvisoOk, CAPA_MODAL } from '@/components/terceros/comun'

type Abierto = { tipo: 'cuenta'; id: string } | { tipo: 'nueva-cuenta' }

export default function TercerosPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="terceros:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <strong className="font-semibold">Acceso denegado</strong>
              <p className="text-sm mt-1">No tienes permisos para ver las cuentas.</p>
            </div>
          </div>
        }
      >
        <TercerosContenido />
      </PermissionGuard>
    </ProtectedRoute>
  )
}

function TercerosContenido() {
  const { can } = usePermissions()
  const puedeCrear = can('terceros:create')
  const puedeAdministrar = can('terceros:manage')

  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const [version, setVersion] = useState(0)
  const [aviso, setAviso] = useState('')

  const refrescar = useCallback(() => setVersion(v => v + 1), [])
  const cerrar = useCallback(() => setAbierto(null), [])
  const abrirCuenta = useCallback((id: string) => setAbierto({ tipo: 'cuenta', id }), [])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-5 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Cuentas clave</h1>
            <p className="text-gray-300 mt-2 text-sm sm:text-base">Cuentas con sus sedes y contactos</p>
          </div>
          {puedeCrear && (
            <button
              type="button"
              onClick={() => {
                setAviso('')
                setAbierto({ tipo: 'nueva-cuenta' })
              }}
              className="w-full sm:w-auto px-5 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 shadow-md font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Nueva cuenta
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <div className="mb-4">
          <AvisoOk>{aviso}</AvisoOk>
        </div>
      )}

      <CuentasTab version={version} onAbrir={abrirCuenta} />

      {abierto?.tipo === 'cuenta' && (
        <CuentaDetalleModal
          key={abierto.id}
          cuentaId={abierto.id}
          puedeCrear={puedeCrear}
          puedeAdministrar={puedeAdministrar}
          onCerrar={cerrar}
          onCambio={refrescar}
        />
      )}

      {abierto?.tipo === 'nueva-cuenta' && (
        <CuentaForm
          capa={CAPA_MODAL}
          puedeAdministrar={puedeAdministrar}
          onCerrar={cerrar}
          onAbrirExistente={abrirCuenta}
          onCreada={cuenta => {
            setAviso(`Se creó la cuenta ${cuenta.nombre} con su sede principal.`)
            refrescar()
            abrirCuenta(cuenta.id)
          }}
        />
      )}
    </div>
  )
}
