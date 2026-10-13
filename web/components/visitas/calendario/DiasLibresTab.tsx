'use client'

// Calendario > Días libres (daysoff:approve o daysoff:view): lista filtrable por mes, estado y persona.
// GET /api/dias-libres?desde=&hasta=&estado=&executive_id= → { items, puede_aprobar, plazo_horas, motivos } (el líder solo recibe las
// ejecutivas de sus líneas y nunca puede aprobar). Quien aprueba marca casillas y aprueba, rechaza o anula en
// bloque (POST /api/dias-libres/revisar { ids, accion, motivo? } → { actualizados, omitidos }; la API acepta
// hasta MAX_IDS_REVISION por petición, así que una selección mayor va en lotes, uno tras otro), con confirmación
// antes, y registra por otra persona (POST /api/dias-libres). Contrato:
// docs/fases/fase7-visitas-f2-config-calendario.md (secciones "API" e "Interfaz").
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ESTADOS_DIA_LIBRE,
  ESTADOS_DIA_LIBRE_VIGENTES,
  GENERAL_POR_DEFECTO,
  MAX_IDS_REVISION,
  enLotes,
  limitesMes,
  mesDe,
  revisarDiaLibre,
  type AccionRevision,
  type DiaLibreItem,
  type DiasLibresResponse,
  type EstadoDiaLibre,
  type MotivoDiaLibre,
  type RevisarDiasLibresResponse,
} from '@/lib/visits-rules'
import type { Executive, ExecutivesResponse } from '@/lib/types/lines'
import {
  AvisoAtencion,
  AvisoError,
  AvisoOk,
  Cargando,
  claseBotonChico,
  claseBotonPrimario,
  claseInput,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
} from '@/components/terceros/comun'
import { Confirmar, Tarjeta, Vacio, conMayuscula, fechaLarga, nombreMes, sumarMeses, unirLista } from '../comun'
import DiaLibreTarjeta from './DiaLibreTarjeta'
import RegistrarPorOtraForm, { type PersonaOpcion } from './RegistrarPorOtraForm'

type Abierto = { tipo: 'revisar'; accion: AccionRevision } | { tipo: 'registrar' }

const TEXTO_ACCION: Record<AccionRevision, { titulo: string; boton: string; hecho: (n: number) => string }> = {
  aprobar: { titulo: 'Aprobar días libres', boton: 'Aprobar', hecho: n => `Se ${n === 1 ? 'aprobó 1 día libre' : `aprobaron ${n} días libres`}.` },
  rechazar: {
    titulo: 'Rechazar días libres',
    boton: 'Rechazar',
    hecho: n => `Se ${n === 1 ? 'rechazó 1 día libre' : `rechazaron ${n} días libres`}: esos días cuentan como hábiles.`,
  },
  anular: {
    titulo: 'Anular días libres',
    boton: 'Anular',
    hecho: n => `Se ${n === 1 ? 'anuló 1 día libre' : `anularon ${n} días libres`}: esos días cuentan como hábiles.`,
  },
}

/**
 * Motivos y plazo de gracia vigentes HOY para "Registrar por otra persona": los trae GET /api/dias-libres
 * (recursos humanos no puede leer /api/config-visitas). Si faltaran, los de la semilla (GENERAL_POR_DEFECTO).
 * La API valida igual el motivo y el plazo al guardar.
 */
function extrasDe(data: Partial<DiasLibresResponse> | null): { motivos: MotivoDiaLibre[] | null; plazoHoras: number | null } {
  const motivos = Array.isArray(data?.motivos) ? data.motivos : null
  const plazo = typeof data?.plazo_horas === 'number' ? data.plazo_horas : null
  return { motivos, plazoHoras: plazo }
}

export default function DiasLibresTab({ hoy, puedeRegistrar }: { hoy: string; puedeRegistrar: boolean }) {
  const mesActual = mesDe(hoy)
  // Quien aprueba arranca en "por aprobar" de cualquier mes; el líder, en todo el mes actual.
  const [mes, setMes] = useState(puedeRegistrar ? '' : mesActual)
  const [estado, setEstado] = useState<EstadoDiaLibre | ''>(puedeRegistrar ? 'por_aprobar' : '')
  const [persona, setPersona] = useState('')
  const [items, setItems] = useState<DiaLibreItem[]>([])
  const [puedeAprobar, setPuedeAprobar] = useState(false)
  const [extras, setExtras] = useState<{ motivos: MotivoDiaLibre[] | null; plazoHoras: number | null }>({ motivos: null, plazoHoras: null })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [version, setVersion] = useState(0)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const [ejecutivas, setEjecutivas] = useState<Executive[] | null>(null)
  const [conocidas, setConocidas] = useState<Map<string, PersonaOpcion>>(new Map())
  const turno = useRef(0)

  useEffect(() => {
    const miTurno = ++turno.current
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const parametros = new URLSearchParams()
        if (mes) {
          const { desde, hasta } = limitesMes(mes)
          parametros.set('desde', desde)
          parametros.set('hasta', hasta)
        }
        if (estado) parametros.set('estado', estado)
        if (persona) parametros.set('executive_id', persona)
        const consulta = parametros.toString()
        const respuesta = await pedirJson(`/api/dias-libres${consulta ? `?${consulta}` : ''}`)
        if (miTurno !== turno.current) return
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudieron cargar los días libres'))
        const data = respuesta.data as DiasLibresResponse | null
        const lista = Array.isArray(data?.items) ? data.items : []
        setItems(lista.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.ejecutiva.localeCompare(b.ejecutiva, 'es'))))
        setPuedeAprobar(Boolean(data?.puede_aprobar))
        setExtras(extrasDe(data))
        setSeleccion(new Set())
        setConocidas(previas => {
          const mapa = new Map(previas)
          for (const item of lista) mapa.set(item.executive_id, { id: item.executive_id, nombre: item.ejecutiva, zona: item.zona })
          return mapa
        })
      } catch (err) {
        if (miTurno !== turno.current) return
        setError(mensajeExcepcion(err, 'No se pudieron cargar los días libres'))
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    }
    cargar()
  }, [mes, estado, persona, version])

  // Quien puede registrar por otra persona necesita la lista completa de Ejecutivos Comerciales.
  useEffect(() => {
    if (!puedeRegistrar) return
    let vigente = true
    pedirJson('/api/executives')
      .then(respuesta => {
        if (!vigente || !respuesta.ok) return
        const data = respuesta.data as ExecutivesResponse | null
        setEjecutivas(Array.isArray(data?.executives) ? data.executives : [])
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [puedeRegistrar])

  const opcionesPersona: PersonaOpcion[] = useMemo(() => {
    const mapa = new Map(conocidas)
    for (const e of ejecutivas ?? []) mapa.set(e.id, { id: e.id, nombre: e.full_name, zona: e.base_kam_name })
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [conocidas, ejecutivas])

  const personasRegistro: PersonaOpcion[] = useMemo(
    () =>
      (ejecutivas ?? [])
        .filter(e => e.status === 'active')
        .map(e => ({ id: e.id, nombre: e.full_name, zona: e.base_kam_name }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [ejecutivas]
  )

  const opcionesMes = useMemo(() => {
    const meses: string[] = []
    for (let n = 6; n >= -12; n--) meses.push(sumarMeses(mesActual, n))
    return meses
  }, [mesActual])

  const seleccionables = puedeAprobar ? items.filter(item => ESTADOS_DIA_LIBRE_VIGENTES.includes(item.estado)) : []
  const porAprobar = items.filter(item => item.estado === 'por_aprobar')
  const elegidos = items.filter(item => seleccion.has(item.id))
  const cuenta = (accion: AccionRevision) => elegidos.filter(item => revisarDiaLibre(item.estado, accion).ok).length

  const alternar = (id: string, marcado: boolean) =>
    setSeleccion(previa => {
      const nueva = new Set(previa)
      if (marcado) nueva.add(id)
      else nueva.delete(id)
      return nueva
    })

  const todosPorAprobarMarcados = porAprobar.length > 0 && porAprobar.every(item => seleccion.has(item.id))

  return (
    <div className="space-y-4 min-w-0">
      {/* Filtros */}
      <Tarjeta className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={mes} onChange={e => setMes(e.target.value)} className={claseInput} aria-label="Filtrar por mes">
            <option value="">Todos los meses</option>
            {opcionesMes.map(m => (
              <option key={m} value={m}>
                {conMayuscula(nombreMes(m))}
                {m === mesActual ? ' (este mes)' : ''}
              </option>
            ))}
          </select>
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoDiaLibre | '')} className={claseInput} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {ESTADOS_DIA_LIBRE.map(opcion => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          <select value={persona} onChange={e => setPersona(e.target.value)} className={claseInput} aria-label="Filtrar por persona">
            <option value="">Todas las personas</option>
            {opcionesPersona.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        {puedeRegistrar && puedeAprobar && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-gray-500">
              Lo que registras por otra persona queda aprobado. Fuera del plazo de gracia hace falta una justificación.
            </p>
            <button
              type="button"
              onClick={() => {
                setAviso('')
                setAbierto({ tipo: 'registrar' })
              }}
              className={`${claseBotonChico} shrink-0`}
            >
              + Registrar por otra persona
            </button>
          </div>
        )}
      </Tarjeta>

      {!puedeAprobar && !cargando && !error && (
        <AvisoAtencion>
          {puedeRegistrar
            ? 'Tu rol no está entre quienes aprueban días libres en la configuración vigente: puedes verlos, pero no aprobarlos ni registrarlos por otra persona.'
            : 'Solo lectura: ves los días libres de los Ejecutivos Comerciales de tus líneas. Los aprueban la dirección comercial o recursos humanos.'}
        </AvisoAtencion>
      )}

      {aviso && <AvisoOk>{aviso}</AvisoOk>}
      {error && <AvisoError onReintentar={() => setVersion(v => v + 1)}>{error}</AvisoError>}

      {/* Acciones en bloque */}
      {puedeAprobar && seleccionables.length > 0 && (
        <div className="sticky top-16 z-10 bg-white rounded-xl shadow-md border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
          <label className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
            <input
              type="checkbox"
              checked={todosPorAprobarMarcados}
              disabled={porAprobar.length === 0}
              onChange={e => setSeleccion(e.target.checked ? new Set(porAprobar.map(item => item.id)) : new Set())}
              className="h-5 w-5 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
            />
            <span className="truncate">
              {seleccion.size > 0
                ? `${seleccion.size} ${seleccion.size === 1 ? 'seleccionado' : 'seleccionados'}`
                : `Seleccionar los ${porAprobar.length} por aprobar`}
            </span>
          </label>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button
              type="button"
              disabled={cuenta('aprobar') === 0}
              onClick={() => setAbierto({ tipo: 'revisar', accion: 'aprobar' })}
              className={`${claseBotonPrimario} text-sm py-1.5`}
            >
              Aprobar seleccionados{cuenta('aprobar') ? ` (${cuenta('aprobar')})` : ''}
            </button>
            <button
              type="button"
              disabled={cuenta('rechazar') === 0}
              onClick={() => setAbierto({ tipo: 'revisar', accion: 'rechazar' })}
              className={claseBotonChico}
            >
              Rechazar seleccionados{cuenta('rechazar') ? ` (${cuenta('rechazar')})` : ''}
            </button>
            <button
              type="button"
              disabled={cuenta('anular') === 0}
              onClick={() => setAbierto({ tipo: 'revisar', accion: 'anular' })}
              className={`${claseBotonChico} text-red-700`}
            >
              Anular{cuenta('anular') ? ` (${cuenta('anular')})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <Tarjeta className="overflow-hidden">
        {cargando && items.length === 0 ? (
          <Cargando texto="Cargando días libres..." />
        ) : items.length === 0 ? (
          <Vacio titulo={estado === 'por_aprobar' ? 'No hay días libres por aprobar' : 'No hay días libres'}>
            {mes || estado || persona ? 'Prueba con otros filtros.' : 'Todavía nadie ha registrado días libres.'}
          </Vacio>
        ) : (
          <ul className={`divide-y divide-gray-100 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
            {items.map(item => (
              <li key={item.id}>
                <DiaLibreTarjeta
                  dia={item}
                  mostrarPersona
                  seleccion={
                    puedeAprobar
                      ? {
                          marcado: seleccion.has(item.id),
                          onCambiar: marcado => alternar(item.id, marcado),
                          deshabilitado: !ESTADOS_DIA_LIBRE_VIGENTES.includes(item.estado),
                        }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {abierto?.tipo === 'revisar' && (
        <ConfirmarRevision
          accion={abierto.accion}
          elegidos={elegidos}
          onCerrar={() => setAbierto(null)}
          onHecho={mensaje => {
            setAbierto(null)
            setAviso(mensaje)
            setVersion(v => v + 1)
          }}
        />
      )}

      {abierto?.tipo === 'registrar' && (
        <RegistrarPorOtraForm
          personas={personasRegistro.length > 0 ? personasRegistro : opcionesPersona}
          motivos={extras.motivos && extras.motivos.length > 0 ? extras.motivos : GENERAL_POR_DEFECTO.motivos_dia_libre}
          plazoHoras={extras.plazoHoras ?? GENERAL_POR_DEFECTO.plazo_gracia_horas}
          hoy={hoy}
          onCerrar={() => setAbierto(null)}
          onHecho={mensaje => {
            setAbierto(null)
            setAviso(mensaje)
            setVersion(v => v + 1)
          }}
        />
      )}
    </div>
  )
}

/** Confirmación de la acción en bloque: cuántos se tocan, de cuántas personas, y cuáles se omitirán. */
function ConfirmarRevision({
  accion,
  elegidos,
  onCerrar,
  onHecho,
}: {
  accion: AccionRevision
  elegidos: readonly DiaLibreItem[]
  onCerrar: () => void
  onHecho: (mensaje: string) => void
}) {
  const texto = TEXTO_ACCION[accion]
  const validos = elegidos.filter(item => revisarDiaLibre(item.estado, accion).ok)
  const omitidosLocal = elegidos.length - validos.length
  const personas = Array.from(new Set(validos.map(item => item.ejecutiva)))
  const dias = validos.reduce((total, item) => total + Number(item.fraccion), 0)
  const lotes = enLotes(validos, MAX_IDS_REVISION)

  return (
    <Confirmar
      titulo={texto.titulo}
      textoConfirmar={`${texto.boton} ${validos.length}`}
      peligro={accion !== 'aprobar'}
      motivo={accion === 'aprobar' ? undefined : { obligatorio: true, placeholder: accion === 'rechazar' ? 'Por qué se rechazan' : 'Por qué se anulan' }}
      onCerrar={onCerrar}
      onConfirmar={async motivo => {
        // En lotes de MAX_IDS_REVISION (el tope de la API), uno tras otro; se suman actualizados y omitidos.
        let actualizados = 0
        const omitidos: RevisarDiasLibresResponse['omitidos'] = []
        let fallo = ''
        for (const lote of lotes) {
          const respuesta = await pedirJson('/api/dias-libres/revisar', {
            method: 'POST',
            json: { ids: lote.map(item => item.id), accion, ...(accion === 'aprobar' ? {} : { motivo }) },
          })
          if (!respuesta.ok) {
            const mensaje = mensajeError(respuesta, 'No se pudo completar la revisión')
            // Si falla el primer lote no cambió nada; si falla uno posterior, los anteriores sí quedaron.
            if (actualizados === 0 && omitidos.length === 0) throw new Error(mensaje)
            fallo = mensaje
            break
          }
          const data = (respuesta.data ?? {}) as Partial<RevisarDiasLibresResponse>
          actualizados += Number(data.actualizados ?? 0)
          if (Array.isArray(data.omitidos)) omitidos.push(...data.omitidos)
        }
        const detalleOmitidos = omitidos
          .slice(0, 5)
          .map(omitido => {
            const item = elegidos.find(e => e.id === omitido.id)
            return item ? `${item.ejecutiva} (${fechaLarga(item.fecha, { anio: false })}): ${omitido.razon}` : omitido.razon
          })
          .join('; ')
        onHecho(
          `${texto.hecho(actualizados)}${
            omitidos.length > 0 ? ` ${omitidos.length} sin cambiar: ${detalleOmitidos}${omitidos.length > 5 ? '…' : ''}.` : ''
          }${fallo ? ` Se detuvo antes de terminar (${fallo}): vuelve a seleccionar los que faltan.` : ''}`
        )
      }}
    >
      <p>
        Vas a <strong>{texto.boton.toLowerCase()}</strong> {validos.length} {validos.length === 1 ? 'día libre' : 'días libres'} (
        {dias.toLocaleString('es-CO')} {dias === 1 ? 'día' : 'días'}) de {unirLista(personas.slice(0, 4))}
        {personas.length > 4 ? ` y ${personas.length - 4} personas más` : ''}.
      </p>
      {lotes.length > 1 && (
        <p>
          Se envían en {lotes.length} partes de hasta {MAX_IDS_REVISION}, una tras otra.
        </p>
      )}
      {omitidosLocal > 0 && (
        <p className="text-amber-800">
          {omitidosLocal} de los seleccionados no se pueden {texto.boton.toLowerCase()} por su estado y se dejan como están.
        </p>
      )}
      {accion === 'aprobar' ? (
        <p>Desde que se aprueban, restan de la cuota de cada persona.</p>
      ) : (
        <p>Esos días cuentan como hábiles. El motivo queda en el registro.</p>
      )}
    </Confirmar>
  )
}
