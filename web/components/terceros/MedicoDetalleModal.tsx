'use client'

// Detalle de un médico (GET /api/terceros/medicos/[id]): datos, sedes donde atiende y visitantes.
// - Sedes: vincular otra (POST /medicos/[id]/sedes, terceros:create); quitar (DELETE ?sede_id=,
//   terceros:manage), nunca la última: un médico sin sede no puede quedar guardado.
// - Visitantes (visitantes:manage): añadir Ejecutivo Comercial + línea + ciudad opcional
//   (POST /medicos/[id]/visitantes) y terminar (PATCH /medicos/[id]/visitantes/[visitanteId] { hasta }).
//   Nunca se borran. La API limita al líder de línea a sus líneas.
// - El documento solo llega (y solo se muestra) con terceros:manage.
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import type { BusinessLine, Executive } from '@/lib/types/lines'
import {
  ROLES_MEDICO_SEDE,
  TIPOS_DOC_MEDICO,
  etiquetaEspecialidad,
  etiquetaRolMedicoSede,
  etiquetaTipoDocMedico,
  type EspecialidadMedico,
  type MedicoDetalle,
  type RolMedicoSede,
  type SedeBusquedaItem,
  type TipoDocMedico,
  type VisitanteResumen,
} from '@/lib/terceros'
import { medicoUpdateSchema, visitanteCreateSchema } from '@/lib/terceros-schemas'
import { CamposEspecialidades } from './MedicoForm'
import MunicipioSelector, { nombreMunicipio } from './MunicipioSelector'
import SedeBuscador from './SedeBuscador'
import {
  AvisoError,
  AvisoOk,
  CAPA_MODAL_ENCIMA,
  Cargando,
  Chip,
  Dato,
  Modal,
  PieFormulario,
  TituloSeccion,
  claseBotonChico,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  claseLabel,
  fechaCorta,
  hoyEnBogota,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  primerErrorZod,
} from './comun'

interface Props {
  medicoId: string
  puedeCrear: boolean
  puedeAdministrar: boolean
  puedeAsignarVisitantes: boolean
  onCerrar: () => void
  onCambio: () => void
  onAbrirCuenta: (cuentaId: string) => void
}

export default function MedicoDetalleModal({
  medicoId,
  puedeCrear,
  puedeAdministrar,
  puedeAsignarVisitantes,
  onCerrar,
  onCambio,
  onAbrirCuenta,
}: Props) {
  const [medico, setMedico] = useState<MedicoDetalle | null>(null)
  const [ciudad, setCiudad] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [editando, setEditando] = useState(false)

  // Vincular sede
  const [vinculando, setVinculando] = useState(false)
  const [sedeNueva, setSedeNueva] = useState<SedeBusquedaItem | null>(null)
  const [rolNuevo, setRolNuevo] = useState<RolMedicoSede>('atiende')
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await pedirJson(`/api/terceros/medicos/${medicoId}`)
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo cargar el médico'))
      const data = respuesta.data as (MedicoDetalle & { medico?: MedicoDetalle }) | null
      // La API puede responder el médico directo o envuelto en { medico }.
      const detalle = data?.medico ?? data
      if (!detalle || typeof detalle.id !== 'string') throw new Error('Respuesta inesperada del servidor')
      setMedico({
        ...detalle,
        especialidades: Array.isArray(detalle.especialidades) ? detalle.especialidades : [],
        sedes: Array.isArray(detalle.sedes) ? detalle.sedes : [],
        visitantes: Array.isArray(detalle.visitantes) ? detalle.visitantes : [],
      })
      setCiudad(detalle.ciudad ?? (await nombreMunicipio(detalle.municipality_id)))
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo cargar el médico'))
    } finally {
      setCargando(false)
    }
  }, [medicoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const despuesDeCambiar = async (mensaje: string) => {
    setAviso(mensaje)
    setErrorAccion('')
    onCambio()
    await cargar()
  }

  const vincularSede = async () => {
    if (!sedeNueva || !medico) return
    setTrabajando('vincular')
    setErrorAccion('')
    setAviso('')
    try {
      const respuesta = await pedirJson(`/api/terceros/medicos/${medico.id}/sedes`, {
        method: 'POST',
        json: { sede_id: sedeNueva.id, rol: rolNuevo },
      })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo vincular la sede'))
      setVinculando(false)
      setSedeNueva(null)
      setRolNuevo('atiende')
      await despuesDeCambiar(`Se vinculó ${sedeNueva.nombre}.`)
    } catch (err) {
      setErrorAccion(mensajeExcepcion(err, 'No se pudo vincular la sede'))
    } finally {
      setTrabajando(null)
    }
  }

  const quitarSede = async (sedeId: string, sedeNombre: string) => {
    if (!medico) return
    setTrabajando(sedeId)
    setErrorAccion('')
    setAviso('')
    try {
      const respuesta = await pedirJson(
        `/api/terceros/medicos/${medico.id}/sedes?sede_id=${encodeURIComponent(sedeId)}`,
        { method: 'DELETE' }
      )
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo quitar la sede'))
      setQuitando(null)
      await despuesDeCambiar(`Se quitó ${sedeNombre} de las sedes del médico.`)
    } catch (err) {
      setErrorAccion(mensajeExcepcion(err, 'No se pudo quitar la sede'))
    } finally {
      setTrabajando(null)
    }
  }

  const sedes = medico
    ? [...medico.sedes].sort((a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)) || a.nombre.localeCompare(b.nombre, 'es'))
    : []

  return (
    <Modal titulo={medico?.nombre ?? 'Médico'} subtitulo={ciudad ?? undefined} onCerrar={onCerrar} ancho="sm:max-w-3xl">
      {cargando && !medico ? (
        <Cargando texto="Cargando el médico..." />
      ) : error && !medico ? (
        <div className="p-4 sm:p-6">
          <AvisoError onReintentar={cargar}>{error}</AvisoError>
        </div>
      ) : medico ? (
        <div className="p-4 sm:p-6 space-y-6">
          {aviso && <AvisoOk>{aviso}</AvisoOk>}
          {errorAccion && <AvisoError>{errorAccion}</AvisoError>}

          {/* Datos */}
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {medico.especialidades.map(especialidad => (
                <Chip key={especialidad} tono="negro">
                  {etiquetaEspecialidad(especialidad)}
                </Chip>
              ))}
              {!medico.activo && <Chip tono="rojo">Inactivo</Chip>}
              {puedeAdministrar && (
                <button type="button" onClick={() => setEditando(true)} className={`${claseBotonChico} ml-auto`}>
                  Editar médico
                </button>
              )}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Dato etiqueta="Ciudad">{ciudad ?? medico.municipality_id}</Dato>
              {medico.numero_documento && (
                <Dato etiqueta="Documento (protegido)">
                  {etiquetaTipoDocMedico(medico.tipo_documento)} {medico.numero_documento}
                </Dato>
              )}
              <Dato etiqueta="Teléfono">
                {medico.telefono ? (
                  <a href={`tel:${medico.telefono.replace(/[^\d+]/g, '')}`} className="underline underline-offset-2">
                    {medico.telefono}
                  </a>
                ) : (
                  <span className="text-gray-400">Sin teléfono</span>
                )}
              </Dato>
              <Dato etiqueta="Correo">
                {medico.email ? (
                  <a href={`mailto:${medico.email}`} className="underline underline-offset-2 break-all">
                    {medico.email}
                  </a>
                ) : (
                  <span className="text-gray-400">Sin correo</span>
                )}
              </Dato>
              {medico.notas && (
                <div className="sm:col-span-2">
                  <Dato etiqueta="Notas">
                    <span className="whitespace-pre-line">{medico.notas}</span>
                  </Dato>
                </div>
              )}
            </dl>
          </section>

          {/* Sedes donde atiende */}
          <section>
            <TituloSeccion
              accion={
                puedeCrear && !vinculando ? (
                  <button type="button" onClick={() => setVinculando(true)} className={claseBotonChico}>
                    Vincular sede
                  </button>
                ) : undefined
              }
            >
              Sedes donde atiende ({sedes.length})
            </TituloSeccion>
            <ul className="space-y-3">
              {sedes.map(sede => (
                <li key={sede.id} className="rounded-xl border border-gray-200 p-3 sm:p-4 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={sede.nombre}>
                        {sede.nombre}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {sede.cuenta_id && sede.cuenta_nombre ? (
                          <button
                            type="button"
                            onClick={() => onAbrirCuenta(sede.cuenta_id as string)}
                            className="underline underline-offset-2 hover:text-gray-900"
                          >
                            {sede.cuenta_nombre}
                          </button>
                        ) : (
                          sede.cuenta_nombre
                        )}
                        {sede.ciudad ? ` · ${sede.ciudad}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Chip>{etiquetaRolMedicoSede(sede.rol)}</Chip>
                      {sede.principal && <Chip tono="negro">Principal</Chip>}
                      {puedeAdministrar && sedes.length > 1 && quitando !== sede.id && (
                        <button
                          type="button"
                          onClick={() => setQuitando(sede.id)}
                          disabled={trabajando !== null}
                          className="px-2 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                  {quitando === sede.id && (
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                      <span className="text-gray-700">¿Quitar esta sede del médico?</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => quitarSede(sede.id, sede.nombre)}
                          disabled={trabajando !== null}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                        >
                          {trabajando === sede.id ? 'Quitando...' : 'Sí, quitar'}
                        </button>
                        <button type="button" onClick={() => setQuitando(null)} disabled={trabajando !== null} className={claseBotonChico}>
                          No
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {puedeAdministrar && sedes.length === 1 && (
              <p className="mt-2 text-xs text-gray-400">La única sede no se puede quitar: un médico siempre tiene al menos una.</p>
            )}
            {vinculando && (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 space-y-3">
                {sedeNueva ? (
                  <>
                    <p className="text-sm text-gray-700 min-w-0">
                      Vincular <strong className="break-words">{sedeNueva.nombre}</strong>
                      {sedeNueva.cuenta_nombre ? ` (${sedeNueva.cuenta_nombre})` : ''} como:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={rolNuevo}
                        onChange={e => setRolNuevo(e.target.value as RolMedicoSede)}
                        className={`${claseInput} sm:w-48`}
                        aria-label="Rol en la sede"
                      >
                        {ROLES_MEDICO_SEDE.map(opcion => (
                          <option key={opcion.valor} value={opcion.valor}>
                            {opcion.etiqueta}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={vincularSede} disabled={trabajando !== null} className={claseBotonPrimario}>
                        {trabajando === 'vincular' ? 'Vinculando...' : 'Vincular'}
                      </button>
                      <button type="button" onClick={() => setSedeNueva(null)} disabled={trabajando !== null} className={claseBotonSecundario}>
                        Elegir otra
                      </button>
                    </div>
                  </>
                ) : (
                  <SedeBuscador
                    onElegir={setSedeNueva}
                    excluir={sedes.map(sede => sede.id)}
                    municipio={medico.municipality_id}
                    ciudad={ciudad}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setVinculando(false)
                    setSedeNueva(null)
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
                >
                  Cancelar
                </button>
              </div>
            )}
          </section>

          {/* Visitantes */}
          <VisitantesSeccion
            medicoId={medico.id}
            visitantes={medico.visitantes}
            puedeAsignar={puedeAsignarVisitantes}
            onCambio={despuesDeCambiar}
            onError={mensaje => {
              setAviso('')
              setErrorAccion(mensaje)
            }}
          />
        </div>
      ) : null}

      {medico && editando && (
        <MedicoEditForm
          medico={medico}
          onCerrar={() => setEditando(false)}
          onGuardado={async mensaje => {
            setEditando(false)
            await despuesDeCambiar(mensaje)
          }}
        />
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------------------------
// Visitantes del médico
// ---------------------------------------------------------------------------------------------

function VisitantesSeccion({
  medicoId,
  visitantes,
  puedeAsignar,
  onCambio,
  onError,
}: {
  medicoId: string
  visitantes: VisitanteResumen[]
  puedeAsignar: boolean
  onCambio: (mensaje: string) => Promise<void>
  onError: (mensaje: string) => void
}) {
  const { user } = useUser()
  const [agregando, setAgregando] = useState(false)
  const [terminando, setTerminando] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const vigentes = visitantes.filter(v => !v.hasta)
  const anteriores = visitantes.filter(v => v.hasta).sort((a, b) => (b.hasta ?? '').localeCompare(a.hasta ?? ''))

  const terminar = async (visitante: VisitanteResumen) => {
    if (!visitante.id) return
    setTrabajando(true)
    try {
      const hasta = hoyEnBogota()
      const respuesta = await pedirJson(`/api/terceros/medicos/${medicoId}/visitantes/${visitante.id}`, {
        method: 'PATCH',
        json: { hasta },
      })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo terminar la asignación'))
      setTerminando(null)
      await onCambio(`${visitante.executive} deja de visitar a este médico por ${visitante.line} desde hoy.`)
    } catch (err) {
      onError(mensajeExcepcion(err, 'No se pudo terminar la asignación'))
    } finally {
      setTrabajando(false)
    }
  }

  const fila = (visitante: VisitanteResumen, vigente: boolean) => (
    <li key={visitante.id ?? `${visitante.executive}-${visitante.line}-${visitante.desde}`} className="rounded-xl border border-gray-200 p-3 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${vigente ? 'text-gray-900' : 'text-gray-500'}`}>{visitante.executive}</p>
          <p className="text-xs text-gray-500 truncate">
            {visitante.line} · {visitante.ciudad || (visitante.municipality_id ? visitante.municipality_id : 'Todas las ciudades')}
          </p>
          {(visitante.desde || visitante.hasta) && (
            <p className="text-xs text-gray-400">
              {visitante.desde ? `Desde ${fechaCorta(visitante.desde)}` : ''}
              {visitante.hasta ? ` · hasta ${fechaCorta(visitante.hasta)}` : ''}
            </p>
          )}
          {vigente && visitante.aviso && (
            <p className="mt-1 text-xs text-amber-700">
              Revisar: {visitante.aviso}.{puedeAsignar ? ' Si ya no lo visita por esta línea, termina la asignación.' : ''}
            </p>
          )}
        </div>
        {vigente && puedeAsignar && visitante.id && terminando !== visitante.id && (
          <button
            type="button"
            onClick={() => setTerminando(visitante.id ?? null)}
            disabled={trabajando}
            className="shrink-0 px-2 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium disabled:opacity-50"
          >
            Terminar
          </button>
        )}
      </div>
      {terminando === visitante.id && visitante.id && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
          <span className="text-gray-700">¿Terminar esta asignación hoy? Queda en el historial.</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => terminar(visitante)}
              disabled={trabajando}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
            >
              {trabajando ? 'Guardando...' : 'Sí, terminar'}
            </button>
            <button type="button" onClick={() => setTerminando(null)} disabled={trabajando} className={claseBotonChico}>
              No
            </button>
          </div>
        </div>
      )}
    </li>
  )

  return (
    <section>
      <TituloSeccion
        accion={
          puedeAsignar && !agregando ? (
            <button type="button" onClick={() => setAgregando(true)} className={claseBotonChico}>
              Añadir visitante
            </button>
          ) : undefined
        }
      >
        Visitantes ({vigentes.length})
      </TituloSeccion>
      <p className="text-xs text-gray-500 mb-3">
        Los Ejecutivos Comerciales que visitan a este médico, cada uno por una línea (puede haber dos de la misma línea en
        ciudades distintas).
      </p>
      {vigentes.length === 0 ? (
        <p className="text-sm text-gray-500">Nadie visita a este médico todavía.</p>
      ) : (
        <ul className="space-y-2">{vigentes.map(v => fila(v, true))}</ul>
      )}
      {agregando && (
        <NuevoVisitante
          medicoId={medicoId}
          usuarioId={user?.id ?? null}
          esLiderDeLinea={user?.role === 'line_leader'}
          onCancelar={() => setAgregando(false)}
          onCreado={async mensaje => {
            setAgregando(false)
            await onCambio(mensaje)
          }}
        />
      )}
      {anteriores.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-600 cursor-pointer">Asignaciones terminadas ({anteriores.length})</summary>
          <ul className="space-y-2 mt-2">{anteriores.map(v => fila(v, false))}</ul>
        </details>
      )}
    </section>
  )
}

function NuevoVisitante({
  medicoId,
  usuarioId,
  esLiderDeLinea,
  onCancelar,
  onCreado,
}: {
  medicoId: string
  usuarioId: string | null
  esLiderDeLinea: boolean
  onCancelar: () => void
  onCreado: (mensaje: string) => Promise<void>
}) {
  const [ejecutivos, setEjecutivos] = useState<Executive[]>([])
  const [lineas, setLineas] = useState<BusinessLine[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [lineaId, setLineaId] = useState('')
  const [ejecutivoId, setEjecutivoId] = useState('')
  const [municipio, setMunicipio] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      const [respuestaEjecutivos, respuestaLineas] = await Promise.all([
        pedirJson('/api/executives'),
        pedirJson('/api/business-lines'),
      ])
      if (!respuestaEjecutivos.ok) throw new Error(mensajeError(respuestaEjecutivos, 'No se pudieron cargar los Ejecutivos Comerciales'))
      if (!respuestaLineas.ok) throw new Error(mensajeError(respuestaLineas, 'No se pudieron cargar las líneas'))
      const dataEjecutivos = respuestaEjecutivos.data as { executives?: Executive[] } | null
      const dataLineas = respuestaLineas.data as { lines?: BusinessLine[] } | null
      setEjecutivos(Array.isArray(dataEjecutivos?.executives) ? dataEjecutivos.executives : [])
      setLineas(Array.isArray(dataLineas?.lines) ? dataLineas.lines : [])
    } catch (err) {
      setErrorCarga(mensajeExcepcion(err, 'No se pudieron cargar los Ejecutivos Comerciales'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // El líder de línea solo asigna en sus líneas (la API lo exige igual).
  const lineasElegibles = lineas
    .filter(linea => linea.active)
    .filter(linea => !esLiderDeLinea || linea.leader_user_id === usuarioId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'))
  const ejecutivosElegibles = ejecutivos
    .filter(ejecutivo => ejecutivo.status !== 'inactive' && (!lineaId || ejecutivo.lines.includes(lineaId)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))

  const guardar = async () => {
    setError('')
    const cuerpo = { executive_id: ejecutivoId, line_id: lineaId, municipality_id: municipio ?? undefined }
    const validado = visitanteCreateSchema.safeParse(cuerpo)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', json: cuerpo })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo añadir el visitante'))
      const ejecutivo = ejecutivos.find(e => e.id === ejecutivoId)
      const linea = lineas.find(l => l.id === lineaId)
      await onCreado(`${ejecutivo?.full_name ?? 'El Ejecutivo Comercial'} visita a este médico por ${linea?.name ?? 'la línea elegida'}.`)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo añadir el visitante'))
      setGuardando(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 space-y-3">
      {cargando ? (
        <Cargando texto="Cargando Ejecutivos Comerciales y líneas..." />
      ) : errorCarga ? (
        <AvisoError onReintentar={cargar}>{errorCarga}</AvisoError>
      ) : (
        <>
          {error && <AvisoError>{error}</AvisoError>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className={claseLabel}>
                Línea <span className="text-red-500">*</span>
              </label>
              <select
                value={lineaId}
                onChange={e => {
                  setLineaId(e.target.value)
                  setEjecutivoId('')
                }}
                className={claseInput}
                disabled={guardando}
              >
                <option value="">Elige la línea</option>
                {lineasElegibles.map(linea => (
                  <option key={linea.id} value={linea.id}>
                    {linea.name}
                  </option>
                ))}
              </select>
              {esLiderDeLinea && lineasElegibles.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">No lideras ninguna línea activa: no puedes asignar visitantes.</p>
              )}
            </div>
            <div className="min-w-0">
              <label className={claseLabel}>
                Ejecutivo Comercial <span className="text-red-500">*</span>
              </label>
              <select
                value={ejecutivoId}
                onChange={e => setEjecutivoId(e.target.value)}
                className={claseInput}
                disabled={guardando || !lineaId}
              >
                <option value="">{lineaId ? 'Elige quién lo visita' : 'Primero elige la línea'}</option>
                {ejecutivosElegibles.map(ejecutivo => (
                  <option key={ejecutivo.id} value={ejecutivo.id}>
                    {ejecutivo.full_name}
                    {ejecutivo.status === 'placeholder' ? ' (por contratar)' : ''}
                  </option>
                ))}
              </select>
              {lineaId && ejecutivosElegibles.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">Ningún Ejecutivo Comercial activo lleva esa línea.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <MunicipioSelector
                valor={municipio}
                onCambiar={codigo => setMunicipio(codigo)}
                etiqueta="Ciudad (opcional)"
                textoVacio="Todas las ciudades"
                disabled={guardando}
              />
              <p className="mt-1 text-xs text-gray-500">
                Úsala si el médico atiende en varias ciudades y cada una tiene su visitante de la misma línea.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={onCancelar} disabled={guardando} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando || !lineaId || !ejecutivoId} className={claseBotonPrimario}>
              {guardando ? 'Guardando...' : 'Añadir visitante'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Editar médico (terceros:manage)
// ---------------------------------------------------------------------------------------------

function MedicoEditForm({
  medico,
  onCerrar,
  onGuardado,
}: {
  medico: MedicoDetalle
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [tipoDoc, setTipoDoc] = useState<TipoDocMedico | ''>(medico.tipo_documento ?? '')
  const [numeroDoc, setNumeroDoc] = useState(medico.numero_documento ?? '')
  const [nombre, setNombre] = useState(medico.nombre)
  const [especialidades, setEspecialidades] = useState<EspecialidadMedico[]>(medico.especialidades)
  const [municipio, setMunicipio] = useState<string | null>(medico.municipality_id)
  const [telefono, setTelefono] = useState(medico.telefono ?? '')
  const [email, setEmail] = useState(medico.email ?? '')
  const [notas, setNotas] = useState(medico.notas ?? '')
  const [activo, setActivo] = useState(medico.activo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const tieneDocumento = Boolean(medico.numero_documento)

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cambios: Record<string, unknown> = {}
    if (tieneDocumento && (tipoDoc !== medico.tipo_documento || numeroDoc.trim() !== medico.numero_documento)) {
      cambios.tipo_documento = tipoDoc
      cambios.numero_documento = numeroDoc
    }
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ')
    if (nombreLimpio !== medico.nombre) cambios.nombre = nombreLimpio
    const mismasEspecialidades =
      especialidades.length === medico.especialidades.length && especialidades.every(e => medico.especialidades.includes(e))
    if (!mismasEspecialidades) cambios.especialidades = especialidades
    if (!municipio) {
      setError('Elige el municipio del médico')
      return
    }
    if (municipio !== medico.municipality_id) cambios.municipality_id = municipio
    if (telefono.trim() !== (medico.telefono ?? '')) cambios.telefono = telefono.trim() || null
    if (email.trim().toLowerCase() !== (medico.email ?? '').toLowerCase()) cambios.email = email.trim() || null
    if (notas.trim() !== (medico.notas ?? '')) cambios.notas = notas.trim() || null
    if (activo !== medico.activo) cambios.activo = activo
    if (Object.keys(cambios).length === 0) {
      setError('No hay cambios para guardar')
      return
    }
    const validado = medicoUpdateSchema.safeParse(cambios)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson(`/api/terceros/medicos/${medico.id}`, { method: 'PATCH', json: cambios })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo guardar el médico'))
      onGuardado(`Se guardaron los cambios de ${nombreLimpio || medico.nombre}.`)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo guardar el médico'))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Editar médico" subtitulo={medico.nombre} onCerrar={onCerrar} capa={CAPA_MODAL_ENCIMA}>
      <form onSubmit={guardar}>
        <div className="p-4 sm:p-6 space-y-4">
          {error && <AvisoError>{error}</AvisoError>}
          {tieneDocumento && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={claseLabel}>Tipo de documento</label>
                <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value as TipoDocMedico)} className={claseInput} disabled={guardando}>
                  {TIPOS_DOC_MEDICO.map(opcion => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={claseLabel}>Número de documento</label>
                <input
                  type="text"
                  value={numeroDoc}
                  onChange={e => setNumeroDoc(e.target.value)}
                  className={claseInput}
                  maxLength={30}
                  disabled={guardando}
                />
              </div>
              <p className="sm:col-span-2 text-xs text-gray-500">Solo para corregir un error de digitación; no se puede quitar.</p>
            </div>
          )}
          <div>
            <label className={claseLabel}>
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className={claseInput}
              maxLength={200}
              disabled={guardando}
            />
          </div>
          <div>
            <span className={claseLabel}>
              Especialidades <span className="text-red-500">*</span>
            </span>
            <CamposEspecialidades valor={especialidades} onCambiar={setEspecialidades} disabled={guardando} />
          </div>
          <MunicipioSelector
            valor={municipio}
            onCambiar={codigo => setMunicipio(codigo)}
            etiqueta="Municipio donde ejerce"
            requerido
            disabled={guardando}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={claseLabel}>Teléfono</label>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={claseInput} maxLength={60} disabled={guardando} />
            </div>
            <div>
              <label className={claseLabel}>Correo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={claseInput} maxLength={320} disabled={guardando} />
            </div>
          </div>
          <div>
            <label className={claseLabel}>Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className={claseInput} maxLength={2000} disabled={guardando} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} disabled={guardando} />
            Médico activo
          </label>
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar="Guardar" />
      </form>
    </Modal>
  )
}
