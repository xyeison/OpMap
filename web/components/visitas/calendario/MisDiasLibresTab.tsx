'use client'

// Calendario > Mis días libres (visits:report con usuario enlazado a un Ejecutivo Comercial): registrar (fecha,
// día completo o medio día, motivo, nota) con la fecha límite del plazo de gracia visible, lista con estado,
// anular lo propio y la tarjeta "Mi cuota del mes".
//   GET  /api/me/dias-libres?desde=&hasta= → { ejecutiva, items, plazo_horas, requiere_aprobacion, motivos }
//   POST /api/me/dias-libres (diaLibreCreateSchema) → 201; 400 fuera de plazo o día no hábil; 409 si repite
//   POST /api/me/dias-libres/[id]/anular (por aprobar; o registrado/aprobado con fecha de hoy en adelante)
//   GET  /api/me/cuota?mes=AAAA-MM → CuotaResponse
// Sin ejecutiva enlazada, la API responde 403 "Tu usuario no está enlazado con un Ejecutivo Comercial".
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (secciones "API" e "Interfaz").
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { diaLibreCreateSchema } from '@/lib/visits-config-schemas'
import {
  FRACCIONES_DIA_LIBRE,
  DIAS_ATRAS_MIS_DIAS_LIBRES,
  MENSAJE_SIN_EJECUTIVA,
  consultaMisDiasLibres,
  ejecutivaPuedeAnular,
  esFechaIso,
  etiquetaFraccionDiaLibre,
  mesDe,
  puedeRegistrarDiaLibre,
  type DiaLibreItem,
  type FraccionDiaLibre,
  type MisDiasLibresResponse,
} from '@/lib/visits-rules'
import {
  AvisoAtencion,
  AvisoError,
  AvisoOk,
  Cargando,
  claseBotonChico,
  claseBotonPrimario,
  claseInput,
  claseLabel,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  primerErrorZod,
} from '@/components/terceros/comun'
import CuotaPanel from '../CuotaPanel'
import { Confirmar, Segmentado, Tarjeta, Vacio, conMayuscula, fechaLarga } from '../comun'
import DiaLibreTarjeta from './DiaLibreTarjeta'
import { textoVence } from './RegistrarPorOtraForm'

export default function MisDiasLibresTab({ hoy }: { hoy: string }) {
  const [datos, setDatos] = useState<MisDiasLibresResponse | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [sinEjecutiva, setSinEjecutiva] = useState(false)
  const [aviso, setAviso] = useState('')
  const [version, setVersion] = useState(0)
  const [anulando, setAnulando] = useState<DiaLibreItem | null>(null)
  const turno = useRef(0)

  useEffect(() => {
    const miTurno = ++turno.current
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        // Desde 90 días atrás y sin fin: sale todo lo que se puede registrar hacia adelante (hasta 366 días), para
        // que lo recién registrado aparezca y se pueda anular.
        const parametros = new URLSearchParams(consultaMisDiasLibres(hoy))
        const respuesta = await pedirJson(`/api/me/dias-libres?${parametros.toString()}`)
        if (miTurno !== turno.current) return
        if (respuesta.status === 403) {
          setSinEjecutiva(true)
          setError(mensajeError(respuesta, MENSAJE_SIN_EJECUTIVA))
          return
        }
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudieron cargar tus días libres'))
        setSinEjecutiva(false)
        setDatos(respuesta.data as MisDiasLibresResponse)
      } catch (err) {
        if (miTurno !== turno.current) return
        setError(mensajeExcepcion(err, 'No se pudieron cargar tus días libres'))
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    }
    cargar()
  }, [hoy, version])

  if (sinEjecutiva) {
    return (
      <AvisoAtencion>
        {error || MENSAJE_SIN_EJECUTIVA}. Pide a un administrador que enlace tu usuario con tu ficha en Ejecutivos Comerciales.
      </AvisoAtencion>
    )
  }
  if (!datos) {
    return error ? (
      <AvisoError onReintentar={() => setVersion(v => v + 1)}>{error}</AvisoError>
    ) : cargando ? (
      <Cargando texto="Cargando tus días libres..." />
    ) : null
  }

  const items = Array.isArray(datos.items) ? datos.items : []
  const proximos = items.filter(item => item.fecha >= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  const anteriores = items.filter(item => item.fecha < hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

  const tarjeta = (item: DiaLibreItem) => (
    <li key={item.id}>
      <DiaLibreTarjeta
        dia={item}
        mostrarPersona={false}
        acciones={
          ejecutivaPuedeAnular(item, hoy) ? (
            <button
              type="button"
              onClick={() => {
                setAviso('')
                setAnulando(item)
              }}
              className={`${claseBotonChico} text-red-700`}
            >
              Anular
            </button>
          ) : undefined
        }
      />
    </li>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] gap-4 min-w-0 items-start">
      <div className="space-y-4 min-w-0">
        {aviso && <AvisoOk>{aviso}</AvisoOk>}
        {error && <AvisoError onReintentar={() => setVersion(v => v + 1)}>{error}</AvisoError>}
        <RegistrarMiDiaLibre
          key={version}
          datos={datos}
          hoy={hoy}
          onRegistrado={mensaje => {
            setAviso(mensaje)
            setVersion(v => v + 1)
          }}
        />
      </div>

      <Tarjeta className="p-4 lg:row-span-2 lg:col-start-2 lg:row-start-1">
        <CuotaPanel
          key={version}
          titulo="Mi cuota del mes"
          url={mes => `/api/me/cuota?mes=${mes}`}
          mesInicial={mesDe(hoy)}
          mesActual={mesDe(hoy)}
        />
      </Tarjeta>

      <div className={`space-y-4 min-w-0 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
        <Tarjeta className="overflow-hidden">
          <div className="px-4 pt-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Próximos y de hoy</h3>
          </div>
          {proximos.length === 0 ? (
            <Vacio titulo="No tienes días libres próximos" />
          ) : (
            <ul className="divide-y divide-gray-100 mt-2">{proximos.map(tarjeta)}</ul>
          )}
        </Tarjeta>
        {anteriores.length > 0 && (
          <Tarjeta className="overflow-hidden">
            <div className="px-4 pt-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Anteriores (últimos {DIAS_ATRAS_MIS_DIAS_LIBRES} días)</h3>
            </div>
            <ul className="divide-y divide-gray-100 mt-2">{anteriores.map(tarjeta)}</ul>
          </Tarjeta>
        )}
      </div>

      {anulando && (
        <Confirmar
          titulo="Anular mi día libre"
          textoConfirmar="Anular día libre"
          peligro
          onCerrar={() => setAnulando(null)}
          onConfirmar={async () => {
            const dia = anulando
            const respuesta = await pedirJson(`/api/me/dias-libres/${dia.id}/anular`, { method: 'POST', json: {} })
            if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo anular el día libre'))
            setAnulando(null)
            setAviso(`Anulaste tu día libre del ${fechaLarga(dia.fecha)}: ese día vuelve a contar como hábil.`)
            setVersion(v => v + 1)
          }}
        >
          <p>
            {conMayuscula(fechaLarga(anulando.fecha))} · {etiquetaFraccionDiaLibre(anulando.fraccion).toLowerCase()} ·{' '}
            {anulando.motivo_nombre || anulando.motivo}
          </p>
          <p>Ese día vuelve a contar como hábil en tu cuota. Queda en el registro como anulado por ti.</p>
        </Confirmar>
      )}
    </div>
  )
}

function RegistrarMiDiaLibre({
  datos,
  hoy,
  onRegistrado,
}: {
  datos: MisDiasLibresResponse
  hoy: string
  onRegistrado: (mensaje: string) => void
}) {
  const motivos = Array.isArray(datos.motivos) ? datos.motivos : []
  const [fecha, setFecha] = useState(hoy)
  const [fraccion, setFraccion] = useState<FraccionDiaLibre>(1)
  const [motivo, setMotivo] = useState(motivos[0]?.codigo ?? '')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const plazo = Number(datos.plazo_horas)
  const revision = esFechaIso(fecha) ? puedeRegistrarDiaLibre({ fecha, ahora: new Date(), plazoHoras: plazo }) : null

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (revision && !revision.ok) {
      setError(revision.error ?? 'No se puede registrar ese día')
      return
    }
    const validacion = diaLibreCreateSchema.safeParse({ fecha, fraccion, motivo, nota: nota.trim() || null })
    if (!validacion.success) {
      setError(primerErrorZod(validacion.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson('/api/me/dias-libres', { method: 'POST', json: validacion.data })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo registrar el día libre'))
      const nombreMotivo = motivos.find(m => m.codigo === motivo)?.nombre ?? motivo
      onRegistrado(
        `Registraste ${etiquetaFraccionDiaLibre(fraccion).toLowerCase()} libre el ${fechaLarga(fecha)} (${nombreMotivo}). ${
          datos.requiere_aprobacion
            ? 'Queda por aprobar: no resta de tu cuota hasta que lo aprueben.'
            : 'Ya resta de tu cuota.'
        }`
      )
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo registrar el día libre'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta className="p-4">
      <form onSubmit={enviar} className="space-y-4 min-w-0">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900">Registrar un día libre</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {datos.ejecutiva?.nombre ? `${datos.ejecutiva.nombre} · ` : ''}Antes del día o hasta {plazo} horas después de que
            termine.
            {datos.requiere_aprobacion ? ' Queda por aprobar hasta que la dirección comercial o recursos humanos lo apruebe.' : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="mio-fecha" className={claseLabel}>
              Fecha <span className="text-red-500">*</span>
            </label>
            <input id="mio-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} required />
            {esFechaIso(fecha) && <p className="mt-1 text-xs text-gray-500">{conMayuscula(fechaLarga(fecha))}</p>}
          </div>
          <div className="min-w-0">
            <span className={claseLabel}>Duración</span>
            <Segmentado opciones={FRACCIONES_DIA_LIBRE} valor={fraccion} onCambiar={setFraccion} etiqueta="Duración del día libre" />
          </div>
        </div>

        {revision && revision.venceAt && (
          <p
            className={`text-sm rounded-lg px-3 py-2 border ${
              revision.ok ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {revision.ok
              ? `Puedes registrarlo hasta el ${textoVence(revision.venceAt)} (hora de Colombia).`
              : `${revision.error}. Si fue por una causa justificada (por ejemplo, una incapacidad), pídele a la dirección comercial o a recursos humanos que lo registre.`}
          </p>
        )}

        <div className="min-w-0">
          <label htmlFor="mio-motivo" className={claseLabel}>
            Motivo <span className="text-red-500">*</span>
          </label>
          <select id="mio-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className={claseInput}>
            {motivos.length === 0 && <option value="">No hay motivos configurados</option>}
            {motivos.map(m => (
              <option key={m.codigo} value={m.codigo}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="mio-nota" className={claseLabel}>
            Nota <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            id="mio-nota"
            value={nota}
            maxLength={500}
            rows={2}
            onChange={e => setNota(e.target.value)}
            className={claseInput}
            placeholder="Detalle que quieras dejar"
          />
        </div>

        {error && <AvisoError>{error}</AvisoError>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={guardando || !motivo || Boolean(revision && !revision.ok)}
            className={`${claseBotonPrimario} w-full sm:w-auto`}
          >
            {guardando ? 'Registrando...' : 'Registrar día libre'}
          </button>
        </div>
      </form>
    </Tarjeta>
  )
}
