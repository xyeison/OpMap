'use client'

// Configuración > Subtipos: subtipos de visita institucional (subtipos_institucionales, migración 0800): lista,
// crear (POST /api/config-visitas/subtipos; nace con conteo "solo seguimiento" peso 1 desde la misma fecha),
// renombrar, para qué, cargos sugeridos y orden (PATCH /api/config-visitas/subtipos/[id]) y apagar con
// vigente_hasta (nunca se borra). Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
import { useState, type FormEvent } from 'react'
import { subtipoCreateSchema, subtipoUpdateSchema } from '@/lib/visits-config-schemas'
import { ROLES_CONTACTO, etiquetaRolContacto } from '@/lib/terceros'
import { esFechaIso, sumarDias, valorVigente, type ConfigVisitasResponse, type Subtipo } from '@/lib/visits-rules'
import {
  AvisoError,
  Chip,
  PieFormulario,
  claseBotonChico,
  claseBotonPrimario,
  claseInput,
  claseLabel,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  primerErrorZod,
} from '@/components/terceros/comun'
import { codigoDesdeNombre } from '../editores'
import { Casilla, Confirmar, Modal, Vacio, conMayuscula, fechaLarga } from '../comun'
import { textoConteo } from '../textos'

type Abierto =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; subtipo: Subtipo }
  | { tipo: 'apagar'; subtipo: Subtipo }
  | { tipo: 'encender'; subtipo: Subtipo }

export default function SubtiposTab({ datos, onCambio }: { datos: ConfigVisitasResponse; onCambio: (mensaje: string) => void }) {
  const { hoy, subtipos, conteo } = datos
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const ordenados = [...subtipos].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
  const siguienteOrden = ordenados.length > 0 ? Math.min(1000, Math.max(...ordenados.map(s => s.orden)) + 10) : 10

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-600">
          Los subtipos de la visita institucional, en el orden en que se ofrecen. Un subtipo nunca se borra: se apaga.
        </p>
        <button type="button" onClick={() => setAbierto({ tipo: 'nuevo' })} className={`${claseBotonPrimario} shrink-0`}>
          + Nuevo subtipo
        </button>
      </div>

      {ordenados.length === 0 ? (
        <Vacio titulo="No hay subtipos">Crea el primero.</Vacio>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ordenados.map(subtipo => {
            const apagado = subtipo.vigente_hasta !== null && subtipo.vigente_hasta < hoy
            const futuro = subtipo.vigente_desde > hoy
            const conteoHoy = valorVigente(
              conteo.filter(c => c.subtipo_id === subtipo.id),
              hoy
            )
            return (
              <li key={subtipo.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-4 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <h3 className={`text-sm font-bold break-words ${apagado ? 'text-gray-400' : 'text-gray-900'}`}>{subtipo.nombre}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate">{subtipo.codigo}</p>
                  </div>
                  <div className="shrink-0 flex flex-wrap justify-end gap-1">
                    <Chip>Orden {subtipo.orden}</Chip>
                    {apagado && <Chip tono="gris">Apagado</Chip>}
                    {futuro && <Chip tono="azul">Desde el {fechaLarga(subtipo.vigente_desde, { anio: false, diaSemana: false })}</Chip>}
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700 break-words">{subtipo.para_que}</p>
                {subtipo.roles_sugeridos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {subtipo.roles_sugeridos.map(rol => (
                      <Chip key={rol} tono="azul">
                        {etiquetaRolContacto(rol)}
                      </Chip>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  {conteoHoy ? `Hoy: ${textoConteo(conteoHoy).toLowerCase()}` : 'Hoy no suma a ninguna meta'} ·{' '}
                  {subtipo.vigente_hasta === null
                    ? `se usa desde el ${fechaLarga(subtipo.vigente_desde)}`
                    : `se usa del ${fechaLarga(subtipo.vigente_desde)} al ${fechaLarga(subtipo.vigente_hasta)}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setAbierto({ tipo: 'editar', subtipo })} className={claseBotonChico}>
                    Editar
                  </button>
                  {subtipo.vigente_hasta === null ? (
                    <button type="button" onClick={() => setAbierto({ tipo: 'apagar', subtipo })} className={`${claseBotonChico} text-red-700`}>
                      Apagar
                    </button>
                  ) : (
                    <button type="button" onClick={() => setAbierto({ tipo: 'encender', subtipo })} className={claseBotonChico}>
                      Volver a usar
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {(abierto?.tipo === 'nuevo' || abierto?.tipo === 'editar') && (
        <SubtipoForm
          subtipo={abierto.tipo === 'editar' ? abierto.subtipo : null}
          hoy={hoy}
          ordenInicial={siguienteOrden}
          onCerrar={() => setAbierto(null)}
          onGuardado={mensaje => {
            setAbierto(null)
            onCambio(mensaje)
          }}
        />
      )}

      {abierto?.tipo === 'apagar' && (
        <ApagarSubtipo
          subtipo={abierto.subtipo}
          hoy={hoy}
          onCerrar={() => setAbierto(null)}
          onHecho={mensaje => {
            setAbierto(null)
            onCambio(mensaje)
          }}
        />
      )}

      {abierto?.tipo === 'encender' && (
        <Confirmar
          titulo="Volver a usar el subtipo"
          textoConfirmar="Volver a usar"
          onCerrar={() => setAbierto(null)}
          onConfirmar={async () => {
            const respuesta = await pedirJson(`/api/config-visitas/subtipos/${abierto.subtipo.id}`, {
              method: 'PATCH',
              json: { vigente_hasta: null },
            })
            if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo volver a usar el subtipo'))
            const nombre = abierto.subtipo.nombre
            setAbierto(null)
            onCambio(`El subtipo ${nombre} se vuelve a ofrecer, sin fecha de fin.`)
          }}
        >
          <p>
            <strong>{abierto.subtipo.nombre}</strong> se ofrecerá de nuevo, sin fecha de fin. Revisa en Qué cuenta si debe sumar a
            alguna meta.
          </p>
        </Confirmar>
      )}
    </div>
  )
}

function SubtipoForm({
  subtipo,
  hoy,
  ordenInicial,
  onCerrar,
  onGuardado,
}: {
  subtipo: Subtipo | null
  hoy: string
  ordenInicial: number
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const nuevo = subtipo === null
  const [nombre, setNombre] = useState(subtipo?.nombre ?? '')
  const [codigo, setCodigo] = useState(subtipo?.codigo ?? '')
  const [codigoManual, setCodigoManual] = useState(!nuevo)
  const [paraQue, setParaQue] = useState(subtipo?.para_que ?? '')
  const [roles, setRoles] = useState<string[]>(subtipo?.roles_sugeridos ?? [])
  const [orden, setOrden] = useState(String(subtipo?.orden ?? ordenInicial))
  const [desde, setDesde] = useState(hoy)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (nuevo) {
      const validacion = subtipoCreateSchema.safeParse({
        codigo,
        nombre,
        para_que: paraQue,
        roles_sugeridos: roles,
        orden,
        vigente_desde: desde,
      })
      if (!validacion.success) {
        setError(primerErrorZod(validacion.error))
        return
      }
      setGuardando(true)
      try {
        const respuesta = await pedirJson('/api/config-visitas/subtipos', { method: 'POST', json: validacion.data })
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo crear el subtipo'))
        onGuardado(
          `Se creó el subtipo ${validacion.data.nombre}. Empieza como «solo seguimiento» desde el ${fechaLarga(
            validacion.data.vigente_desde
          )}: cámbialo en Qué cuenta si debe sumar a una meta.`
        )
      } catch (err) {
        setError(mensajeExcepcion(err, 'No se pudo crear el subtipo'))
      } finally {
        setGuardando(false)
      }
      return
    }
    const validacion = subtipoUpdateSchema.safeParse({ nombre, para_que: paraQue, roles_sugeridos: roles, orden })
    if (!validacion.success) {
      setError(primerErrorZod(validacion.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson(`/api/config-visitas/subtipos/${subtipo.id}`, { method: 'PATCH', json: validacion.data })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo guardar el subtipo'))
      onGuardado(`Se guardó el subtipo ${validacion.data.nombre ?? subtipo.nombre}.`)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo guardar el subtipo'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={nuevo ? 'Nuevo subtipo' : `Editar ${subtipo.nombre}`} subtitulo="Visita institucional" onCerrar={guardando ? () => undefined : onCerrar}>
      <form onSubmit={enviar} className="flex flex-col min-h-full">
        <div className="p-4 sm:p-6 space-y-4 flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="subtipo-nombre" className={claseLabel}>
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                id="subtipo-nombre"
                value={nombre}
                maxLength={60}
                onChange={e => {
                  setNombre(e.target.value)
                  if (!codigoManual) setCodigo(codigoDesdeNombre(e.target.value))
                }}
                className={claseInput}
                placeholder="Por ejemplo, Auditoría médica"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="subtipo-codigo" className={claseLabel}>
                Código {nuevo && <span className="text-red-500">*</span>}
              </label>
              <input
                id="subtipo-codigo"
                value={codigo}
                maxLength={40}
                disabled={!nuevo}
                onChange={e => {
                  setCodigo(e.target.value.toLowerCase())
                  setCodigoManual(true)
                }}
                className={`${claseInput} font-mono text-sm`}
                placeholder="auditoria_medica"
              />
              <p className="mt-1 text-xs text-gray-500">
                {nuevo ? 'Letras minúsculas sin tildes y guiones bajos. No se puede cambiar después.' : 'El código no cambia.'}
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="subtipo-para-que" className={claseLabel}>
              Para qué sirve <span className="text-red-500">*</span>
            </label>
            <textarea
              id="subtipo-para-que"
              value={paraQue}
              maxLength={300}
              rows={2}
              onChange={e => setParaQue(e.target.value)}
              className={claseInput}
              placeholder="Qué se gestiona en esta visita"
            />
          </div>
          <fieldset className="min-w-0">
            <legend className={claseLabel}>Cargos sugeridos</legend>
            <p className="text-xs text-gray-500 mb-2">Si el contacto tiene uno de estos cargos, la app propone este subtipo.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLES_CONTACTO.map(rol => (
                <Casilla
                  key={rol.valor}
                  marcada={roles.includes(rol.valor)}
                  onCambiar={m => setRoles(actual => (m ? Array.from(new Set([...actual, rol.valor])) : actual.filter(r => r !== rol.valor)))}
                >
                  {rol.etiqueta}
                </Casilla>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="subtipo-orden" className={claseLabel}>
                Orden <span className="text-red-500">*</span>
              </label>
              <input
                id="subtipo-orden"
                inputMode="numeric"
                value={orden}
                onChange={e => setOrden(e.target.value)}
                className={claseInput}
              />
              <p className="mt-1 text-xs text-gray-500">Menor = aparece antes.</p>
            </div>
            {nuevo && (
              <div className="min-w-0">
                <label htmlFor="subtipo-desde" className={claseLabel}>
                  Se usa desde <span className="text-red-500">*</span>
                </label>
                <input id="subtipo-desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} className={claseInput} />
                {esFechaIso(desde) && <p className="mt-1 text-xs text-gray-500">{conMayuscula(fechaLarga(desde))}</p>}
              </div>
            )}
          </div>
          {error && <AvisoError>{error}</AvisoError>}
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar={nuevo ? 'Crear subtipo' : 'Guardar'} />
      </form>
    </Modal>
  )
}

function ApagarSubtipo({
  subtipo,
  hoy,
  onCerrar,
  onHecho,
}: {
  subtipo: Subtipo
  hoy: string
  onCerrar: () => void
  onHecho: (mensaje: string) => void
}) {
  const [hasta, setHasta] = useState(hoy)
  const valida = esFechaIso(hasta) && hasta >= subtipo.vigente_desde
  return (
    <Confirmar
      titulo={`Apagar ${subtipo.nombre}`}
      textoConfirmar="Apagar subtipo"
      peligro
      onCerrar={onCerrar}
      onConfirmar={async () => {
        if (!valida) throw new Error('El último día no puede ser anterior a la fecha desde la que se usa el subtipo')
        const respuesta = await pedirJson(`/api/config-visitas/subtipos/${subtipo.id}`, {
          method: 'PATCH',
          json: { vigente_hasta: hasta },
        })
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo apagar el subtipo'))
        onHecho(`El subtipo ${subtipo.nombre} deja de ofrecerse desde el ${fechaLarga(sumarDias(hasta, 1))}.`)
      }}
    >
      <p>
        El subtipo no se borra: deja de ofrecerse para visitas nuevas. Las visitas ya registradas con él y su historial no
        cambian.
      </p>
      <div className="min-w-0">
        <label htmlFor="apagar-hasta" className={claseLabel}>
          Último día en que se usa
        </label>
        <input id="apagar-hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={claseInput} />
        {esFechaIso(hasta) && (
          <p className="mt-1 text-xs text-gray-500">Desde el {fechaLarga(sumarDias(hasta, 1))} ya no se ofrece.</p>
        )}
      </div>
    </Confirmar>
  )
}
