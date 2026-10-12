'use client'

// Fase 6 · F1 Terceros (/terceros): pestañas Cuentas y Médicos, con su detalle y los formularios para crear.
// Contrato: docs/fases/fase6-visitas-f1-terceros.md (sección "Interfaz"). Permisos: terceros:view para ver,
// terceros:create para crear, terceros:manage para editar y ver documentos, visitantes:manage para asignar
// visitantes. Los terceros no entran a hospitals (ni zonas, ni mapa, ni rutas).
import { useCallback, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import CuentaDetalleModal from '@/components/terceros/CuentaDetalleModal'
import CuentaForm from '@/components/terceros/CuentaForm'
import CuentasTab from '@/components/terceros/CuentasTab'
import MedicoDetalleModal from '@/components/terceros/MedicoDetalleModal'
import MedicoForm from '@/components/terceros/MedicoForm'
import MedicosTab from '@/components/terceros/MedicosTab'
import { AvisoOk, CAPA_MODAL } from '@/components/terceros/comun'

type Pestana = 'cuentas' | 'medicos'

type Abierto =
  | { tipo: 'cuenta'; id: string }
  | { tipo: 'medico'; id: string }
  | { tipo: 'nueva-cuenta' }
  | { tipo: 'nuevo-medico' }

export default function TercerosPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="terceros:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <strong className="font-semibold">Acceso denegado</strong>
              <p className="text-sm mt-1">No tienes permisos para ver las cuentas y los médicos.</p>
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
  const puedeAsignarVisitantes = can('visitantes:manage')

  const [pestana, setPestana] = useState<Pestana>('cuentas')
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const [version, setVersion] = useState(0)
  const [aviso, setAviso] = useState('')

  const refrescar = useCallback(() => setVersion(v => v + 1), [])
  const cerrar = useCallback(() => setAbierto(null), [])
  const abrirCuenta = useCallback((id: string) => setAbierto({ tipo: 'cuenta', id }), [])
  const abrirMedico = useCallback((id: string) => setAbierto({ tipo: 'medico', id }), [])

  const pestanas: { clave: Pestana; etiqueta: string }[] = [
    { clave: 'cuentas', etiqueta: 'Cuentas' },
    { clave: 'medicos', etiqueta: 'Médicos' },
  ]

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-5 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Terceros</h1>
            <p className="text-gray-300 mt-2 text-sm sm:text-base">
              Cuentas con sus sedes y contactos, y médicos con las sedes donde atienden y quién los visita
            </p>
          </div>
          {puedeCrear && (
            <button
              type="button"
              onClick={() => {
                setAviso('')
                setAbierto({ tipo: pestana === 'cuentas' ? 'nueva-cuenta' : 'nuevo-medico' })
              }}
              className="w-full sm:w-auto px-5 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 shadow-md font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              {pestana === 'cuentas' ? 'Nueva cuenta' : 'Nuevo médico'}
            </button>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 mb-4" role="tablist" aria-label="Terceros">
        {pestanas.map(p => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestana === p.clave}
            onClick={() => {
              setPestana(p.clave)
              setAviso('')
            }}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
              pestana === p.clave
                ? 'bg-gray-900 border-gray-900 text-white shadow-md'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {aviso && (
        <div className="mb-4">
          <AvisoOk>{aviso}</AvisoOk>
        </div>
      )}

      {pestana === 'cuentas' ? (
        <CuentasTab version={version} onAbrir={abrirCuenta} />
      ) : (
        <MedicosTab version={version} onAbrir={abrirMedico} />
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

      {abierto?.tipo === 'nuevo-medico' && (
        <MedicoForm
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
