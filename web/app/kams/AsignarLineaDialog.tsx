'use client'

// Diálogo "Darle <línea> a…" / "Quitarle <línea>" de la página Zonas (spec 2026-10-23, E2: toda escritura muestra
// antes la vista previa simulada). Dos pasos:
//   1. Vista previa: elegir a quien vive en la Zona (persona o vacante) y pedir POST /api/coverage/simular con un solo
//      cambio { tipo: 'linea_agregar' | 'linea_quitar', executive_id, line_id }. La ruta nunca escribe; devuelve las
//      celdas (línea, Zona) que cambian, con nombres, y el resumen por estado. Para Bogotá, al elegir a quien vive en
//      una celda la vista previa muestra las cuatro (las otras tres le llegan por alcance si nadie local las lleva).
//   2. Guardar: PUT (dar) o DELETE (quitar) /api/executives/[id]/lineas/[lineId], que inserta o borra executive_lines y
//      recalcula la cobertura sin Google. Al quitar, la vista previa ya trae medicosQuePierdenVisitante (la cuenta de
//      médicos de esa persona en esa línea con visitante vigente, que el disparador 0820 termina sin vuelta atrás): se
//      muestra y, si hay alguno, hay que marcar "Entiendo…" antes de que "Quitarle" se habilite (spec E2). La respuesta
//      del DELETE trae medicosTerminados, la cifra real, que va en el mensaje final.
// La restricción de la dirección (lineasPermitidas) deshabilita la opción con el texto "La dirección limitó a <nombre>
// a: <líneas>"; la API vuelve a validarlo (409). Escape cierra y el foco entra al título.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AvisoAtencion, CAPA_MODAL, claseBotonPrimario, claseBotonSecundario, Modal } from '@/components/terceros/comun'
import { readError } from '@/app/lines/coverage-shared'
import { useVentanaAccesible } from '@/app/executives/zona-bloques'
import { ESTADO_PLAZA_LABELS, ESTADOS_PLAZA, type SimularDiffCelda, type SimularResponse, type ZonaResidente } from '@/lib/types/zonas'
import { ESTADO_BADGE, ESTADO_PLAZA_PLURAL, motivoNoPuedeDar, nombreLinea, nombreZona, numero } from './zonas-ui'

export type ModoAsignar = 'dar' | 'quitar'

/** Quien vive en la Zona (o en una celda de Bogotá), con la Zona en la que vive para mostrarla. */
export interface ResidenteElegible extends ZonaResidente {
  kam_id: string
  zonaNombre: string
}

interface Props {
  modo: ModoAsignar
  linea: { id: string; code: string; name: string }
  /** Líneas visibles (ZonasResponse.lineas), para dar nombre a los códigos. */
  lineas: ReadonlyArray<{ code: string; name: string }>
  /** "Barranquilla" o "Bogotá (4 zonas)". */
  zonaNombre: string
  esBogota: boolean
  residentes: ResidenteElegible[]
  residenteInicial?: string | null
  onCerrar: () => void
  /** Se guardó: mensaje para la página (que recarga la tabla). */
  onGuardado: (mensaje: string) => void
}

/** Respuesta de PUT/DELETE /api/executives/[id]/lineas/[lineId] (spec, tabla de rutas). */
interface RespuestaGuardar {
  ejecutivo?: { id: string; nombre: string; status: string; lineas: string[] }
  medicosTerminados?: number
  cobertura?: { recalculada: boolean }
}

export default function AsignarLineaDialog({
  modo,
  linea,
  lineas,
  zonaNombre,
  esBogota,
  residentes,
  residenteInicial = null,
  onCerrar,
  onGuardado,
}: Props) {
  useVentanaAccesible(onCerrar)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    tituloRef.current?.focus()
  }, [])

  // Quitar: solo quien lleva la línea hoy. Dar: todos los que viven en la Zona (los que no pueden salen deshabilitados).
  const elegibles = useMemo(
    () =>
      (modo === 'quitar' ? residentes.filter(residente => residente.lineas.includes(linea.code)) : residentes)
        .slice()
        .sort((a, b) => a.zonaNombre.localeCompare(b.zonaNombre, 'es') || a.nombre.localeCompare(b.nombre, 'es')),
    [modo, residentes, linea.code]
  )

  const [executiveId, setExecutiveId] = useState<string>(() => {
    if (residenteInicial && elegibles.some(residente => residente.id === residenteInicial)) return residenteInicial
    const posibles = modo === 'dar' ? elegibles.filter(residente => !motivoNoPuedeDar(residente, linea, lineas)) : elegibles
    return posibles.length === 1 ? posibles[0].id : ''
  })
  const [simulacion, setSimulacion] = useState<SimularResponse | null>(null)
  // Quitar: "Entiendo que N médicos quedan sin visitante" (se desmarca al cambiar de persona o volver a calcular)
  const [confirmaMedicos, setConfirmaMedicos] = useState(false)
  const [simulando, setSimulando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const elegido = elegibles.find(residente => residente.id === executiveId) ?? null
  const motivo = elegido && modo === 'dar' ? motivoNoPuedeDar(elegido, linea, lineas) : null

  const elegir = (id: string) => {
    setExecutiveId(id)
    setSimulacion(null)
    setConfirmaMedicos(false)
    setError('')
  }

  const previsualizar = async () => {
    if (!elegido || motivo) return
    setSimulando(true)
    setError('')
    try {
      const response = await fetch('/api/coverage/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cambios: [{ tipo: modo === 'dar' ? 'linea_agregar' : 'linea_quitar', executive_id: elegido.id, line_id: linea.id }],
        }),
      })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo calcular la vista previa'))
      const body = (await response.json().catch(() => null)) as SimularResponse | null
      if (!body || !Array.isArray(body.diff) || !body.resumen || typeof body.resumen !== 'object') {
        throw new Error('Respuesta inesperada del servidor')
      }
      setConfirmaMedicos(false)
      setSimulacion(body)
    } catch (err: unknown) {
      console.error('Error simulando el cambio de línea:', err)
      setError(err instanceof Error ? err.message : 'No se pudo calcular la vista previa')
    } finally {
      setSimulando(false)
    }
  }

  // Quitar: cuántos médicos de esta persona en esta línea perderían visitante (de la vista previa). null = la ruta no lo
  // trajo (versión vieja del servidor): se pide confirmar igual, porque el borrado no tiene vuelta atrás.
  const medicosQuePierden = useMemo<number | null>(() => {
    if (modo !== 'quitar' || !simulacion || !elegido) return null
    const lista = Array.isArray(simulacion.medicosQuePierdenVisitante) ? simulacion.medicosQuePierdenVisitante : null
    const fila = lista?.find(item => item.executive_id === elegido.id && item.line_id === linea.id)
    return fila && Number.isFinite(fila.medicos) ? fila.medicos : null
  }, [modo, simulacion, elegido, linea.id])
  const requiereConfirmacion = modo === 'quitar' && simulacion !== null && (medicosQuePierden === null || medicosQuePierden > 0)
  const faltaConfirmar = requiereConfirmacion && !confirmaMedicos

  const guardar = async () => {
    if (!elegido || motivo || !simulacion || faltaConfirmar) return
    setGuardando(true)
    setError('')
    try {
      const response = await fetch(`/api/executives/${encodeURIComponent(elegido.id)}/lineas/${encodeURIComponent(linea.id)}`, {
        method: modo === 'dar' ? 'PUT' : 'DELETE',
      })
      if (!response.ok) throw new Error(await readError(response, modo === 'dar' ? 'No se pudo dar la línea' : 'No se pudo quitar la línea'))
      const body = ((await response.json().catch(() => null)) ?? {}) as RespuestaGuardar
      const recalculada = body.cobertura?.recalculada !== false
      const nombre = body.ejecutivo?.nombre ?? elegido.nombre
      const coberturaTexto = recalculada ? ' La cobertura se recalculó.' : ' Se guardó, pero no se pudo recalcular la cobertura: usa "Recalcular cobertura" en Líneas.'
      if (modo === 'dar') {
        onGuardado(`${nombre} ahora lleva ${linea.name} en ${zonaNombre}.${coberturaTexto}`)
      } else {
        const medicos = typeof body.medicosTerminados === 'number' ? body.medicosTerminados : null
        const medicosTexto =
          medicos === null
            ? ''
            : medicos === 0
              ? ' Ningún médico de esa línea tenía visitante.'
              : ` ${numero(medicos)} ${medicos === 1 ? 'médico de esa línea quedó' : 'médicos de esa línea quedaron'} sin visitante.`
        onGuardado(`Se le quitó ${linea.name} a ${nombre}.${medicosTexto}${coberturaTexto}`)
      }
    } catch (err: unknown) {
      console.error('Error guardando el cambio de línea:', err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio')
      setGuardando(false)
    }
  }

  // Solo las celdas de esta línea (la ruta ya recorta a las líneas del usuario), por nombre de Zona
  const diff = useMemo<SimularDiffCelda[]>(
    () =>
      (simulacion?.diff ?? [])
        .filter(celda => celda.line_id === linea.id)
        .slice()
        .sort((a, b) => nombreZona(a.zona).localeCompare(nombreZona(b.zona), 'es')),
    [simulacion, linea.id]
  )
  const resumen = simulacion?.resumen[linea.code] ?? null

  const titulo = modo === 'dar' ? `Darle ${linea.name} a…` : `Quitarle ${linea.name}`

  return (
    <Modal titulo={titulo} subtitulo={zonaNombre} onCerrar={onCerrar} ancho="sm:max-w-2xl" capa={CAPA_MODAL}>
      <div className="min-h-full flex flex-col">
        <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
          <h3 ref={tituloRef} tabIndex={-1} className="text-base font-bold text-gray-900 focus:outline-none break-words">
            {modo === 'dar' ? `1. ¿A quién le das ${linea.name}?` : `1. ¿A quién le quitas ${linea.name}?`}
          </h3>
          <p className="-mt-3 text-sm text-gray-600">
            {modo === 'dar'
              ? `Solo a quien vive en ${zonaNombre}: un Ejecutivo Comercial o una vacante autorizada por la gerencia (cuenta como una persona y queda "Reservada"). Si otra persona de la Zona ya lleva la línea, la Zona queda en conflicto hasta que lo resuelvas con un ajuste manual.`
              : `Al quitarle la línea, la Zona vuelve a cubrirse por alcance desde la Zona más cercana que la lleve dentro del tope, o queda sin cobertura. Sus médicos de esta línea quedan sin visitante: la vista previa dice cuántos y hay que confirmarlo antes de guardar.`}
          </p>
          {esBogota && modo === 'dar' && (
            <AvisoAtencion>
              Bogotá se parte en cuatro Zonas. Al dar la línea a quien vive en una de ellas, las otras tres le llegan por alcance (26 a 30 minutos)
              si nadie local las lleva: la vista previa muestra las cuatro.
            </AvisoAtencion>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm break-words">{error}</div>}

          {elegibles.length === 0 ? (
            <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
              {modo === 'dar' ? `Nadie vive en ${zonaNombre}.` : `Nadie de ${zonaNombre} lleva ${linea.name}.`}
            </p>
          ) : (
            <ul className="space-y-2" role="radiogroup" aria-label="Ejecutivo Comercial o vacante">
              {elegibles.map(residente => {
                const bloqueo = modo === 'dar' ? motivoNoPuedeDar(residente, linea, lineas) : null
                const seleccionado = residente.id === executiveId
                return (
                  <li key={residente.id}>
                    <label
                      className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                        bloqueo ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : seleccionado ? 'border-gray-900 bg-gray-50 cursor-pointer' : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="residente"
                        value={residente.id}
                        checked={seleccionado}
                        disabled={!!bloqueo || guardando}
                        onChange={() => elegir(residente.id)}
                        className="mt-1 h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-700"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-medium break-words ${bloqueo ? 'text-gray-500' : 'text-gray-900'}`}>
                          {residente.nombre}
                          {residente.status === 'placeholder' && <span className="ml-1 text-xs font-normal text-amber-700">(por contratar)</span>}
                          {esBogota && <span className="ml-1 text-xs font-normal text-gray-500">· vive en {residente.zonaNombre}</span>}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {residente.lineas.length === 0 ? (
                            <span className="text-xs text-gray-400">No lleva líneas</span>
                          ) : (
                            residente.lineas.map(code => (
                              <span
                                key={code}
                                className={`px-2 py-0.5 rounded-full text-xs border ${
                                  code === linea.code ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-100 text-gray-700 border-gray-200'
                                }`}
                              >
                                {nombreLinea(code, lineas)}
                              </span>
                            ))
                          )}
                        </span>
                        {bloqueo && <span className="mt-1 block text-xs text-amber-700 break-words">{bloqueo}</span>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Paso 2: vista previa */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h3 className="text-base font-bold text-gray-900">2. Vista previa</h3>
              <button
                type="button"
                onClick={previsualizar}
                disabled={!elegido || !!motivo || simulando || guardando}
                className={claseBotonPrimario}
                title={!elegido ? 'Elige primero a quién' : motivo ?? undefined}
              >
                {simulando ? 'Calculando…' : simulacion ? 'Volver a calcular' : 'Ver qué cambia'}
              </button>
              <span className="text-xs text-gray-500">Simulación en memoria con las distancias ya conocidas: no escribe nada ni consulta Google.</span>
            </div>

            {simulacion && elegido && (
              <div className="space-y-3">
                {diff.length === 0 ? (
                  <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                    Nada cambia en {linea.name} con este cambio: la cobertura de las Zonas queda igual.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Zona</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Antes</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Después</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {diff.map(celda => (
                          <tr key={`${celda.line_id}:${celda.kam_id}`} className="align-top">
                            <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{nombreZona(celda.zona)}</td>
                            <td className="px-3 py-2">
                              <CeldaEstado estado={celda.antesEstado} nombre={celda.antesNombre} />
                            </td>
                            <td className="px-3 py-2">
                              <CeldaEstado estado={celda.despuesEstado} nombre={celda.despuesNombre} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {resumen && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-600">Después, en {linea.name}:</span>
                    {ESTADOS_PLAZA.map(estado => (
                      <span key={estado} className={`inline-flex items-center px-2.5 py-1 rounded-lg font-semibold border ${ESTADO_BADGE[estado]}`}>
                        {ESTADO_PLAZA_PLURAL[estado]}: {numero(resumen[estado] ?? 0)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Quitar: médicos que pierden visitante (disparador 0820, sin vuelta atrás) y confirmación */}
                {modo === 'quitar' && (
                  medicosQuePierden === 0 ? (
                    <p className="text-sm text-gray-600">Ningún médico de {linea.name} tiene a {elegido.nombre} como visitante: nadie queda sin visitante.</p>
                  ) : (
                    <AvisoAtencion>
                      <p className="font-semibold">
                        {medicosQuePierden === null
                          ? `No se pudo contar cuántos médicos de ${linea.name} tienen a ${elegido.nombre} como visitante.`
                          : `${numero(medicosQuePierden)} ${medicosQuePierden === 1 ? 'médico' : 'médicos'} de ${linea.name} ${medicosQuePierden === 1 ? 'tiene' : 'tienen'} a ${elegido.nombre} como visitante.`}
                      </p>
                      <p className="mt-1">
                        Al quitarle la línea {medicosQuePierden === 1 ? 'queda' : 'quedan'} sin visitante hoy mismo y nada lo deshace: habría que reasignarlos desde Terceros.
                      </p>
                      <label className="mt-3 flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmaMedicos}
                          onChange={event => setConfirmaMedicos(event.target.checked)}
                          disabled={guardando}
                          className="mt-0.5 h-4 w-4 rounded border-amber-400 text-gray-900 focus:ring-gray-700"
                        />
                        <span className="text-sm">
                          {medicosQuePierden === null
                            ? `Entiendo que los médicos de ${linea.name} que visita ${elegido.nombre} quedan sin visitante.`
                            : `Entiendo que ${numero(medicosQuePierden)} ${medicosQuePierden === 1 ? 'médico queda' : 'médicos quedan'} sin visitante.`}
                        </span>
                      </label>
                    </AvisoAtencion>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-xs text-gray-500">
            {!simulacion
              ? 'Guardar se habilita después de la vista previa.'
              : faltaConfirmar
                ? '3. Marca "Entiendo…" para habilitar Quitarle.'
                : '3. Si la vista previa es lo que quieres, guarda.'}
          </span>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!elegido || !!motivo || !simulacion || faltaConfirmar || guardando || simulando}
              title={faltaConfirmar ? 'Marca primero "Entiendo…"' : undefined}
              className={
                modo === 'quitar'
                  ? 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                  : claseBotonPrimario
              }
            >
              {guardando ? 'Guardando…' : modo === 'dar' ? `Darle ${linea.name}` : `Quitarle ${linea.name}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function CeldaEstado({ estado, nombre }: { estado: SimularDiffCelda['antesEstado']; nombre: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${ESTADO_BADGE[estado]}`}>
        {ESTADO_PLAZA_LABELS[estado]}
      </span>
      {nombre && <span className="text-sm text-gray-700 break-words">{nombre}</span>}
    </div>
  )
}
