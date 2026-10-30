'use client'

// Médicos (/medicos, menú Terceros): vuelve el 2026-10-30 (dueño: "En la web también, recuerda que son 1 sola tabla para
// web+app"). La misma tabla y la misma API que la app de visita: lista con buscador, detalle y crear, que solo se hace con
// cédula de ciudadanía (CC) o de extranjería (CE). Crear sin repetir (dueño, 2026-10-30): "Nuevo médico" arriba solo si
// la lista cabe en una página; con más, se busca por nombre y "Crear médico" aparece cuando la búsqueda no encuentra a
// nadie, con ese nombre. Permisos: terceros:view para ver, terceros:create para crear, terceros:manage para editar y ver
// documentos, visitantes:manage para asignar visitantes.
// Spec: docs/specs/2026-10-30-medicos-y-contactos-sin-duplicados.md.
import { useCallback, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import CuentaDetalleModal from '@/components/terceros/CuentaDetalleModal'
import MedicoDetalleModal from '@/components/terceros/MedicoDetalleModal'
import MedicoForm from '@/components/terceros/MedicoForm'
import MedicosTab from '@/components/terceros/MedicosTab'
import { AvisoOk } from '@/components/terceros/comun'

type Abierto = { tipo: 'medico'; id: string } | { tipo: 'cuenta'; id: string } | { tipo: 'nuevo-medico'; nombre?: string }

export default function MedicosPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="terceros:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <strong className="font-semibold">Acceso denegado</strong>
              <p className="text-sm mt-1">No tienes permisos para ver los médicos.</p>
            </div>
          </div>
        }
      >
        <MedicosContenido />
      </PermissionGuard>
    </ProtectedRoute>
  )
}

function MedicosContenido() {
  const { can } = usePermissions()
  const puedeCrear = can('terceros:create')
  const puedeAdministrar = can('terceros:manage')
  const puedeAsignarVisitantes = can('visitantes:manage')

  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const [version, setVersion] = useState(0)
  const [aviso, setAviso] = useState('')
  /** Si la lista pasa de una página (null: aún no se sabe): con varias, se busca primero y se crea desde la búsqueda. */
  const [hayVariasPaginas, setHayVariasPaginas] = useState<boolean | null>(null)
  const crearConNombre = useCallback((nombre: string) => {
    setAviso('')
    setAbierto({ tipo: 'nuevo-medico', nombre })
  }, [])

  const refrescar = useCallback(() => setVersion(v => v + 1), [])
  const cerrar = useCallback(() => setAbierto(null), [])
  const abrirMedico = useCallback((id: string) => setAbierto({ tipo: 'medico', id }), [])
  const abrirCuenta = useCallback((id: string) => setAbierto({ tipo: 'cuenta', id }), [])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-5 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Médicos</h1>
            <p className="text-gray-300 mt-2 text-sm sm:text-base">Las sedes donde atienden y quién los visita. Los mismos de la app de visita.</p>
          </div>
          {puedeCrear && hayVariasPaginas === false && (
            <button
              type="button"
              onClick={() => {
                setAviso('')
                setAbierto({ tipo: 'nuevo-medico' })
              }}
              className="w-full sm:w-auto px-5 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 shadow-md font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Nuevo médico
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <div className="mb-4">
          <AvisoOk>{aviso}</AvisoOk>
        </div>
      )}

      <MedicosTab version={version} onAbrir={abrirMedico} onCrear={puedeCrear ? crearConNombre : undefined} onPaginacion={setHayVariasPaginas} />

      {abierto?.tipo === 'medico' && (
        <MedicoDetalleModal
          key={abierto.id}
          medicoId={abierto.id}
          puedeCrear={puedeCrear}
          puedeAdministrar={puedeAdministrar}
          puedeAsignarVisitantes={puedeAsignarVisitantes}
          onCerrar={cerrar}
          onCambio={refrescar}
          onAbrirCuenta={abrirCuenta}
        />
      )}

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

      {abierto?.tipo === 'nuevo-medico' && (
        <MedicoForm
          nombreInicial={abierto.nombre}
          puedeAdministrar={puedeAdministrar}
          onCerrar={cerrar}
          onAbrirMedico={abrirMedico}
          onCreado={medico => {
            setAviso(`Se creó el médico ${medico.nombre}.`)
            refrescar()
            abrirMedico(medico.id)
          }}
        />
      )}
    </div>
  )
}
