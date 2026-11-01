'use client'

// Papeles de una persona por empresa (capas de empresas, capa 1). Un bloque por empresa: casillas para los papeles
// simples y, para líder de negocio, una fila por línea con sus Zonas (sin Zonas = líder nacional de la línea).
// Cada bloque guarda solo su empresa con PUT /api/users/[id]/papeles. Quitar Ejecutivo Comercial borra asignaciones:
// antes se simula (?simular=1) y se pide confirmar con lo que se pierde.

import { useRef, useState } from 'react'
import { getRoleTitle, type Role } from '@/lib/permissions'
import { ORDEN_PAPELES, type PapelActivo } from '@/lib/empresas-reglas'
import type { EmpresaMovil } from '@/lib/reporte-visitas'

export interface LineaOpcion {
  id: string
  name: string
  active: boolean
}

export interface ZonaOpcion {
  id: string
  name: string
}

export interface PapelEntradaEditor {
  papel: Role
  line_id?: string
  kam_ids?: string[]
}

interface FilaLider {
  clave: number
  line_id: string
  kam_ids: string[]
}

interface Borrador {
  simples: Role[]
  lideres: FilaLider[]
}

const MENSAJE_SIN_TABLA = 'Falta aplicar la migración 0960'

let contadorDeFilas = 0
const nuevaClave = () => ++contadorDeFilas

function borradorDe(papeles: readonly PapelActivo[]): Borrador {
  const simples = papeles.filter(p => p.papel !== 'line_leader').map(p => p.papel)
  const lideres = papeles
    .filter(p => p.papel === 'line_leader')
    .map(p => ({ clave: nuevaClave(), line_id: p.line_id ?? '', kam_ids: [...p.kam_ids] }))
  return { simples, lideres }
}

/** La lista de papeles que espera la API, o el motivo por el que el borrador no se puede guardar. */
function entradasDe(borrador: Borrador): { ok: true; entradas: PapelEntradaEditor[] } | { ok: false; error: string } {
  const lideres = borrador.lideres
  if (lideres.some(l => !l.line_id)) return { ok: false, error: 'Elige la línea de cada líder de negocio' }
  if (new Set(lideres.map(l => l.line_id)).size !== lideres.length) {
    return { ok: false, error: 'Hay una línea repetida en los líderes de negocio' }
  }
  const entradas: PapelEntradaEditor[] = [
    ...ORDEN_PAPELES.filter(p => p !== 'line_leader' && borrador.simples.includes(p)).map(papel => ({ papel })),
    ...lideres.map(l => ({ papel: 'line_leader' as Role, line_id: l.line_id, kam_ids: l.kam_ids })),
  ]
  return { ok: true, entradas }
}

function firmaDe(papeles: readonly PapelActivo[]): string {
  return papeles
    .map(p => `${p.papel}|${p.line_id ?? ''}|${[...p.kam_ids].sort().join(',')}`)
    .sort()
    .join(';')
}

// ---------------------------------------------------------------------------------------------
// Un bloque (una empresa): casillas y filas de líder
// ---------------------------------------------------------------------------------------------

function BloqueDeEmpresa({
  empresa,
  borrador,
  onChange,
  lineas,
  zonas,
  descripcion,
  idBase,
}: {
  empresa: EmpresaMovil
  borrador: Borrador
  onChange: (b: Borrador) => void
  lineas: LineaOpcion[]
  zonas: ZonaOpcion[]
  descripcion?: Partial<Record<Role, string>>
  idBase: string
}) {
  const alternarSimple = (papel: Role) => {
    const simples = borrador.simples.includes(papel) ? borrador.simples.filter(p => p !== papel) : [...borrador.simples, papel]
    onChange({ ...borrador, simples })
  }
  const alternarLider = () => {
    onChange({
      ...borrador,
      lideres: borrador.lideres.length > 0 ? [] : [{ clave: nuevaClave(), line_id: '', kam_ids: [] }],
    })
  }
  const cambiarFila = (clave: number, cambio: Partial<FilaLider>) => {
    onChange({ ...borrador, lideres: borrador.lideres.map(l => (l.clave === clave ? { ...l, ...cambio } : l)) })
  }
  const quitarFila = (clave: number) => onChange({ ...borrador, lideres: borrador.lideres.filter(l => l.clave !== clave) })
  const anadirFila = () => onChange({ ...borrador, lideres: [...borrador.lideres, { clave: nuevaClave(), line_id: '', kam_ids: [] }] })

  const nombreZona = (id: string) => zonas.find(z => z.id === id)?.name ?? 'Zona'

  return (
    <div className="space-y-2">
      {ORDEN_PAPELES.map(papel => {
        const idCasilla = `${idBase}-${papel}`
        if (papel !== 'line_leader') {
          return (
            <label key={papel} htmlFor={idCasilla} className="flex items-start gap-3 cursor-pointer">
              <input
                id={idCasilla}
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={borrador.simples.includes(papel)}
                onChange={() => alternarSimple(papel)}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{getRoleTitle(papel)}</span>
                {descripcion?.[papel] && <span className="block text-xs text-gray-500">{descripcion[papel]}</span>}
              </span>
            </label>
          )
        }
        const esLider = borrador.lideres.length > 0
        return (
          <div key={papel}>
            <label htmlFor={idCasilla} className="flex items-start gap-3 cursor-pointer">
              <input id={idCasilla} type="checkbox" className="mt-1 h-4 w-4" checked={esLider} onChange={alternarLider} />
              <span>
                <span className="block text-sm font-medium text-gray-900">{getRoleTitle(papel)}</span>
                {descripcion?.[papel] && <span className="block text-xs text-gray-500">{descripcion[papel]}</span>}
              </span>
            </label>
            {esLider && (
              <div className="ml-7 mt-2 space-y-2">
                {borrador.lideres.map(fila => {
                  const opciones = lineas.filter(l => l.active || l.id === fila.line_id)
                  const zonasLibres = zonas.filter(z => !fila.kam_ids.includes(z.id))
                  return (
                    <div key={fila.clave} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Línea del líder de negocio en ${empresa.nombre_corto}`}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                          value={fila.line_id}
                          onChange={e => cambiarFila(fila.clave, { line_id: e.target.value })}
                        >
                          <option value="">Elige la línea</option>
                          {opciones.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => quitarFila(fila.clave)}
                          className="px-2 py-1 text-xs text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
                        >
                          Quitar
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {fila.kam_ids.length === 0 && <span className="text-xs text-gray-500">Sin Zonas: líder nacional de la línea</span>}
                        {fila.kam_ids.map(id => (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-gray-300 rounded-full">
                            {nombreZona(id)}
                            <button
                              type="button"
                              aria-label={`Quitar la Zona ${nombreZona(id)}`}
                              onClick={() => cambiarFila(fila.clave, { kam_ids: fila.kam_ids.filter(k => k !== id) })}
                              className="text-gray-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {zonasLibres.length > 0 && (
                          <select
                            aria-label="Añadir una Zona a la líder"
                            className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white"
                            value=""
                            onChange={e => e.target.value && cambiarFila(fila.clave, { kam_ids: [...fila.kam_ids, e.target.value] })}
                          >
                            <option value="">Añadir Zona (opcional)</option>
                            {zonasLibres.map(z => (
                              <option key={z.id} value={z.id}>
                                {z.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                })}
                <button type="button" onClick={anadirFila} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Añadir línea
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Un bloque que guarda su empresa
// ---------------------------------------------------------------------------------------------

function BloqueGuardable({
  usuario,
  empresa,
  lineas,
  zonas,
  descripcion,
  onGuardado,
}: {
  usuario: { id: string; papeles: PapelActivo[] }
  empresa: EmpresaMovil
  lineas: LineaOpcion[]
  zonas: ZonaOpcion[]
  descripcion?: Partial<Record<Role, string>>
  onGuardado: () => void
}) {
  const actuales = usuario.papeles.filter(p => p.empresa_id === empresa.id)
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe(actuales))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardado, setGuardado] = useState('')
  const ocupado = useRef(false)

  const guardar = async () => {
    if (ocupado.current) return
    setError('')
    setAviso('')
    setGuardado('')
    const resultado = entradasDe(borrador)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    const { entradas } = resultado
    const teniaEjecutivo = actuales.some(p => p.papel === 'sales_manager')
    const quedaEjecutivo = entradas.some(p => p.papel === 'sales_manager')
    const url = `/api/users/${usuario.id}/papeles`
    const enviar = (query: string) =>
      fetch(`${url}${query}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresa.id, papeles: entradas }),
      })

    ocupado.current = true
    setGuardando(true)
    try {
      if (teniaEjecutivo && !quedaEjecutivo) {
        const simulacion = await enviar('?simular=1')
        const datosSimulacion = await simulacion.json().catch(() => ({}))
        if (!simulacion.ok) {
          setError(datosSimulacion.error || 'Error al calcular lo que se pierde')
          return
        }
        const { asignaciones = 0, visitantes = 0 } = datosSimulacion.afectados ?? {}
        if (!window.confirm(`Se borran ${asignaciones} asignaciones y terminan ${visitantes} visitantes`)) return
      }
      const respuesta = await enviar('')
      const datos = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) {
        setError(datos.error || 'Error al guardar los papeles')
        return
      }
      setGuardado(`Papeles de ${empresa.nombre_corto} guardados`)
      if (datos.cobertura_recalculada === false && typeof datos.aviso === 'string') setAviso(datos.aviso)
      onGuardado()
    } catch {
      setError('Error al guardar los papeles')
    } finally {
      ocupado.current = false
      setGuardando(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 p-4" aria-label={`Papeles en ${empresa.nombre_corto}`}>
      <h4 className="text-sm font-bold text-gray-900 mb-3">{empresa.nombre_corto}</h4>
      <BloqueDeEmpresa
        empresa={empresa}
        borrador={borrador}
        onChange={b => {
          setBorrador(b)
          setGuardado('')
        }}
        lineas={lineas}
        zonas={zonas}
        descripcion={descripcion}
        idBase={`papel-${usuario.id}-${empresa.id}`}
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {aviso}
        </p>
      )}
      {guardado && !error && (
        <p role="status" className="mt-3 text-sm text-green-700">
          {guardado}
        </p>
      )}
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// Editor de una persona existente
// ---------------------------------------------------------------------------------------------

export default function PapelesEditor({
  usuario,
  empresas,
  lineas,
  zonas,
  onGuardado,
  descripcion,
}: {
  usuario: { id: string; full_name: string; papeles: PapelActivo[] }
  empresas: EmpresaMovil[]
  lineas: LineaOpcion[]
  zonas: ZonaOpcion[]
  onGuardado: () => void
  descripcion?: Partial<Record<Role, string>>
}) {
  if (empresas.length === 0) {
    return (
      <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {MENSAJE_SIN_TABLA}
      </p>
    )
  }
  return (
    <div className="space-y-4">
      {empresas.map(empresa => (
        // La clave cambia cuando cambian sus papeles guardados: el bloque vuelve a leerlos del servidor
        <BloqueGuardable
          key={`${empresa.id}:${firmaDe(usuario.papeles.filter(p => p.empresa_id === empresa.id))}`}
          usuario={usuario}
          empresa={empresa}
          lineas={lineas}
          zonas={zonas}
          descripcion={descripcion}
          onGuardado={onGuardado}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Papeles de un usuario nuevo (todas las empresas a la vez; la página los manda con POST /api/users)
// ---------------------------------------------------------------------------------------------

export function PapelesNuevoUsuario({
  empresas,
  lineas,
  zonas,
  descripcion,
  onChange,
}: {
  empresas: EmpresaMovil[]
  lineas: LineaOpcion[]
  zonas: ZonaOpcion[]
  descripcion?: Partial<Record<Role, string>>
  /** Cada cambio: la lista { empresa_id, papel, line_id?, kam_ids? } o el motivo por el que aún no sirve. */
  onChange: (resultado: { ok: true; papeles: (PapelEntradaEditor & { empresa_id: string })[] } | { ok: false; error: string }) => void
}) {
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({})

  if (empresas.length === 0) {
    return (
      <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {MENSAJE_SIN_TABLA}
      </p>
    )
  }

  const cambiar = (empresaId: string, borrador: Borrador) => {
    const siguientes = { ...borradores, [empresaId]: borrador }
    setBorradores(siguientes)
    const papeles: (PapelEntradaEditor & { empresa_id: string })[] = []
    for (const empresa of empresas) {
      const b = siguientes[empresa.id]
      if (!b) continue
      const r = entradasDe(b)
      if (!r.ok) return onChange({ ok: false, error: `${empresa.nombre_corto}: ${r.error}` })
      papeles.push(...r.entradas.map(e => ({ empresa_id: empresa.id, ...e })))
    }
    onChange(papeles.length > 0 ? { ok: true, papeles } : { ok: false, error: 'Elige al menos un papel en alguna empresa' })
  }

  return (
    <div className="space-y-4">
      {empresas.map(empresa => (
        <section key={empresa.id} className="rounded-xl border border-gray-200 p-4" aria-label={`Papeles en ${empresa.nombre_corto}`}>
          <h4 className="text-sm font-bold text-gray-900 mb-3">{empresa.nombre_corto}</h4>
          <BloqueDeEmpresa
            empresa={empresa}
            borrador={borradores[empresa.id] ?? { simples: [], lideres: [] }}
            onChange={b => cambiar(empresa.id, b)}
            lineas={lineas}
            zonas={zonas}
            descripcion={descripcion}
            idBase={`papel-nuevo-${empresa.id}`}
          />
        </section>
      ))}
    </div>
  )
}
