'use client'

// Asistente "Traspasar" de /executives: pasa en un paso lo de un Ejecutivo Comercial (líneas, zona, ajustes manuales,
// nombre del territorio y médicos) a otra persona, a una persona nueva o a una vacante; al quitar líneas, también a
// "nadie". 4 pasos (qué pasa · líneas · quién recibe · fecha y opciones), vista previa legible y confirmación única.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. Decisión del dueño:
// docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md. Contrato de la API: lib/traspaso.ts
// (POST /api/executives/[id]/traspaso/vista-previa → VistaPreviaTraspaso; POST /api/executives/[id]/traspaso →
// TraspasoResponse).
import Link from 'next/link'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  AvisoAtencion,
  AvisoError,
  AvisoOk,
  CAPA_MODAL_ENCIMA,
  Cargando,
  Chip,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  claseLabel,
  hoyEnBogota,
  mensajeError,
  mensajeExcepcion,
  Modal,
  pedirJson,
  primerErrorZod,
} from '@/components/terceros/comun'
import {
  DIAS_ATRAS_MAX,
  errorFechaTraspaso,
  etiquetaAnexoFinal,
  etiquetaRazon,
  fechaMinimaTraspaso,
  finDeOrigen,
  MOTIVO_MAX,
  nombreVacante,
  NOMBRE_MAX,
  NOMBRE_MIN,
  type PlanLinea,
  type PlanMedico,
  type TipoDestino,
  type TraspasoAviso,
  type TraspasoResponse,
  type VistaPreviaTraspaso,
} from '@/lib/traspaso'
import { traspasoSchema } from '@/lib/traspaso-schemas'
import type { BusinessLine, Executive } from '@/lib/types/lines'
import { STATUS_BADGE, STATUS_LABELS, zoneLabel, type ZoneOption } from './shared'
import {
  fechaLarga,
  fraseConfirmacion,
  frasesResumen,
  leerRespuestaTraspaso,
  leerVistaPrevia,
  plural,
  unirNombres,
} from './traspaso-ui'

export type ModoTraspaso = 'baja' | 'quitar'

type Paso = 'que' | 'lineas' | 'quien' | 'fecha' | 'vista' | 'hecho'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ETIQUETA_TIPO_ZONA: Record<string, string> = {
  local: 'Local',
  reach: 'Por alcance',
  manual: 'Ajuste manual',
}

interface TraspasoWizardProps {
  /** Quien entrega (activo o vacante, con al menos una línea). */
  origen: Executive
  /** Todo el equipo (para elegir quién recibe y revisar emails repetidos). */
  executives: Executive[]
  lines: BusinessLine[]
  zones: ZoneOption[]
  /** "Dar de baja" abre con 'baja'; desde Editar (líneas desmarcadas), con 'quitar'; "Traspasar", sin modo. */
  modoInicial?: ModoTraspaso | null
  /** Líneas ya elegidas (las que se desmarcaron en Editar). */
  lineasIniciales?: string[]
  onCerrar: () => void
  /** El traspaso quedó hecho: la página recarga el equipo y el historial (el asistente sigue abierto con el resumen). */
  onHecho: (respuesta: TraspasoResponse | null) => void
}

export default function TraspasoWizard({
  origen,
  executives,
  lines,
  zones,
  modoInicial = null,
  lineasIniciales,
  onCerrar,
  onHecho,
}: TraspasoWizardProps) {
  const hoy = useMemo(() => hoyEnBogota(), [])
  const fechaMinima = useMemo(() => fechaMinimaTraspaso(hoy), [hoy])

  const lineById = useMemo(() => new Map(lines.map(line => [line.id, line])), [lines])
  const zoneById = useMemo(() => new Map(zones.map(zone => [zone.id, zone])), [zones])
  const nombreLinea = (id: string) => lineById.get(id)?.name ?? 'Línea desconocida'
  const nombreZona = useCallback(
    (executive: Pick<Executive, 'base_kam_id' | 'base_kam_name'>): string | null => {
      const zona = executive.base_kam_id ? zoneById.get(executive.base_kam_id) : undefined
      if (zona) return zoneLabel(zona.name)
      if (executive.base_kam_name) return zoneLabel(executive.base_kam_name)
      return null
    },
    [zoneById]
  )

  // Líneas de quien entrega, en el orden de las líneas de negocio
  const lineasOrigen = useMemo(() => {
    const orden = new Map(lines.map((line, index) => [line.id, index]))
    return [...origen.lines].sort((a, b) => (orden.get(a) ?? 9999) - (orden.get(b) ?? 9999))
  }, [origen.lines, lines])

  const lineasDeEntrada = (lineasIniciales ?? []).filter(id => origen.lines.includes(id))
  const [modo, setModo] = useState<ModoTraspaso | null>(modoInicial)
  const [lineasSel, setLineasSel] = useState<string[]>(
    lineasDeEntrada.length > 0 ? lineasDeEntrada : lineasOrigen.length === 1 ? [...lineasOrigen] : []
  )
  const [paso, setPaso] = useState<Paso>(
    modoInicial === 'baja' || (modoInicial === 'quitar' && lineasDeEntrada.length > 0) ? 'quien' : modoInicial === 'quitar' ? 'lineas' : 'que'
  )
  const [tipo, setTipo] = useState<TipoDestino | null>(modoInicial === 'baja' ? 'vacante' : null)
  const [destinoId, setDestinoId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevaEmail, setNuevaEmail] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [guardarAnexo, setGuardarAnexo] = useState(true)
  const [desactivarUsuario, setDesactivarUsuario] = useState(true)
  const [copiarExcepciones, setCopiarExcepciones] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [errorPaso, setErrorPaso] = useState('')

  const [vista, setVista] = useState<VistaPreviaTraspaso | null>(null)
  const [cargandoVista, setCargandoVista] = useState(false)
  const [errorVista, setErrorVista] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [resultado, setResultado] = useState<TraspasoResponse | null>(null)

  const esBaja = modo === 'baja'
  const tieneUsuario = Boolean(origen.user_id)
  const lineasTraspaso = esBaja ? lineasOrigen : lineasOrigen.filter(id => lineasSel.includes(id))
  const zonaOrigen = nombreZona(origen)

  // Quién puede recibir: activos y vacantes distintos de quien entrega
  const candidatos = useMemo(
    () =>
      executives
        .filter(executive => executive.id !== origen.id && executive.status !== 'inactive')
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
    [executives, origen.id]
  )
  const candidatosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return candidatos
    return candidatos.filter(executive => {
      const zona = nombreZona(executive) ?? ''
      return (
        executive.full_name.toLowerCase().includes(termino) ||
        zona.toLowerCase().includes(termino) ||
        (executive.email ?? '').toLowerCase().includes(termino)
      )
    })
  }, [candidatos, busqueda, nombreZona])
  const destinoElegido = candidatos.find(executive => executive.id === destinoId) ?? null

  // Pasos visibles (el de líneas solo al quitar líneas)
  const pasosVisibles: { paso: Paso; titulo: string }[] = [
    { paso: 'que', titulo: 'Qué pasa' },
    ...(esBaja ? [] : [{ paso: 'lineas' as Paso, titulo: 'Líneas' }]),
    { paso: 'quien', titulo: 'Quién recibe' },
    { paso: 'fecha', titulo: 'Fecha y opciones' },
    { paso: 'vista', titulo: 'Vista previa' },
  ]
  const indicePaso = pasosVisibles.findIndex(item => item.paso === paso)

  // ------------------------------------------------------------------------------------------
  // Validación de cada paso y cuerpo de la petición
  // ------------------------------------------------------------------------------------------

  const errorDelPaso = (p: Paso): string => {
    if (p === 'que') return modo ? '' : 'Elige qué pasa con esta persona'
    if (p === 'lineas') return esBaja || lineasSel.length > 0 ? '' : 'Elige al menos una línea'
    if (p === 'quien') {
      if (!tipo) return 'Elige quién recibe'
      if (tipo === 'nadie' && esBaja) return 'Al dar de baja hay que elegir quién recibe: otra persona, una persona nueva o una vacante'
      if (tipo === 'existente' && !destinoElegido) return 'Elige la persona que recibe'
      if (tipo === 'nueva') {
        const nombre = nuevaNombre.trim().replace(/\s+/g, ' ')
        if (nombre.length < NOMBRE_MIN) return 'Escribe el nombre de la persona nueva'
        if (nombre.length > NOMBRE_MAX) return `El nombre no puede superar ${NOMBRE_MAX} caracteres`
        const email = nuevaEmail.trim().toLowerCase()
        if (email && !EMAIL_RE.test(email)) return 'El email no es válido'
        if (email) {
          const enUso = executives.find(executive => (executive.email ?? '').trim().toLowerCase() === email)
          if (enUso) return `El email ${email} ya es de ${enUso.full_name}`
        }
      }
      return ''
    }
    if (p === 'fecha') {
      const errorFecha = errorFechaTraspaso(fecha, hoy)
      if (errorFecha) return errorFecha
      if (motivo.trim().length > MOTIVO_MAX) return `El motivo no puede superar ${MOTIVO_MAX} caracteres`
      return ''
    }
    return ''
  }

  const cuerpo = () => ({
    destino:
      tipo === 'existente'
        ? { tipo: 'existente' as const, id: destinoId }
        : tipo === 'nueva'
          ? { tipo: 'nueva' as const, full_name: nuevaNombre.trim().replace(/\s+/g, ' '), email: nuevaEmail.trim() || null }
          : { tipo: (tipo ?? 'vacante') as 'vacante' | 'nadie' },
    lineas: esBaja ? null : lineasTraspaso,
    fecha,
    dar_de_baja: esBaja,
    // Solo si tiene usuario (la casilla deshabilitada no lo pide); la API además decide por su rol (regla 9)
    desactivar_usuario: esBaja && tieneUsuario && desactivarUsuario,
    copiar_excepciones: tipo === 'nadie' ? false : copiarExcepciones,
    guardar_anexo_final: guardarAnexo,
    motivo: motivo.trim() || null,
  })

  // ------------------------------------------------------------------------------------------
  // Navegación
  // ------------------------------------------------------------------------------------------

  const irA = (destino: Paso) => {
    setErrorPaso('')
    setErrorVista('')
    setErrorEnvio('')
    setConfirmando(false)
    if (destino !== 'vista') setVista(null)
    setPaso(destino)
  }

  const siguiente = () => {
    const error = errorDelPaso(paso)
    if (error) {
      setErrorPaso(error)
      return
    }
    if (paso === 'que') irA(esBaja ? 'quien' : 'lineas')
    else if (paso === 'lineas') irA('quien')
    else if (paso === 'quien') irA('fecha')
    else if (paso === 'fecha') void pedirVistaPrevia()
  }

  const atras = () => {
    if (paso === 'lineas') irA('que')
    else if (paso === 'quien') irA(esBaja ? 'que' : 'lineas')
    else if (paso === 'fecha') irA('quien')
    else if (paso === 'vista') irA('fecha')
    else onCerrar()
  }

  const elegirModo = (nuevo: ModoTraspaso) => {
    setModo(nuevo)
    setErrorPaso('')
    // Con baja, "nadie" no existe y por defecto recibe una vacante en su zona (decisión 2 de la spec)
    if (nuevo === 'baja' && (tipo === 'nadie' || tipo === null)) setTipo('vacante')
  }

  // ------------------------------------------------------------------------------------------
  // Vista previa y confirmación
  // ------------------------------------------------------------------------------------------

  const pedirVistaPrevia = async () => {
    const datos = cuerpo()
    const validado = traspasoSchema.safeParse(datos)
    if (!validado.success) {
      setErrorPaso(primerErrorZod(validado.error))
      return
    }
    setErrorPaso('')
    setErrorVista('')
    setErrorEnvio('')
    setVista(null)
    setConfirmando(false)
    setPaso('vista')
    setCargandoVista(true)
    try {
      const respuesta = await pedirJson(`/api/executives/${origen.id}/traspaso/vista-previa`, { method: 'POST', json: datos })
      const leida = leerVistaPrevia(respuesta.data)
      if (leida) setVista(leida)
      else if (!respuesta.ok) setErrorVista(mensajeError(respuesta, 'No se pudo preparar la vista previa'))
      else setErrorVista('Respuesta inesperada del servidor al preparar la vista previa')
    } catch (error: unknown) {
      setErrorVista(mensajeExcepcion(error, 'No se pudo preparar la vista previa'))
    } finally {
      setCargandoVista(false)
    }
  }

  const confirmar = async () => {
    setEnviando(true)
    setErrorEnvio('')
    try {
      const respuesta = await pedirJson(`/api/executives/${origen.id}/traspaso`, { method: 'POST', json: cuerpo() })
      if (!respuesta.ok) {
        setErrorEnvio(mensajeError(respuesta, 'No se pudo hacer el traspaso'))
        setConfirmando(false)
        return
      }
      const leida = leerRespuestaTraspaso(respuesta.data)
      setResultado(leida)
      setConfirmando(false)
      setPaso('hecho')
      onHecho(leida)
    } catch (error: unknown) {
      setErrorEnvio(mensajeExcepcion(error, 'No se pudo hacer el traspaso'))
      setConfirmando(false)
    } finally {
      setEnviando(false)
    }
  }

  const cerrar = () => {
    if (enviando) return
    onCerrar()
  }

  // ------------------------------------------------------------------------------------------
  // Pasos
  // ------------------------------------------------------------------------------------------

  const resumenOrigen = (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm min-w-0">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="font-semibold text-gray-900 break-words">{origen.full_name}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${STATUS_BADGE[origen.status]}`}>
          {STATUS_LABELS[origen.status]}
        </span>
      </div>
      <div className="mt-1 text-gray-600">Zona: {zonaOrigen ?? 'sin zona base'}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {lineasOrigen.map(id => (
          <Chip key={id}>{nombreLinea(id)}</Chip>
        ))}
      </div>
    </div>
  )

  const pasoQue = (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        ¿Qué pasa con <strong>{origen.full_name}</strong>?
      </p>
      {resumenOrigen}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <OpcionTarjeta
          nombre="modo"
          elegida={modo === 'baja'}
          onElegir={() => elegirModo('baja')}
          titulo="Se va de la empresa"
          texto="Se da de baja y todas sus líneas pasan a otra persona, a una persona nueva o a una vacante."
        />
        <OpcionTarjeta
          nombre="modo"
          elegida={modo === 'quitar'}
          onElegir={() => elegirModo('quitar')}
          titulo="Le quito una o más líneas"
          texto="Sigue en el equipo con sus otras líneas; lo de las líneas que se le quitan pasa a otra persona (o a nadie)."
        />
      </div>
    </div>
  )

  const pasoLineas = (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        ¿Qué líneas le quitas a <strong>{origen.full_name}</strong>? Lo de esas líneas (zonas, ajustes manuales, nombre
        del territorio y médicos) pasa a quien elijas en el siguiente paso.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {lineasOrigen.map(id => {
          const marcada = lineasSel.includes(id)
          return (
            <label
              key={id}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors min-w-0 ${
                marcada ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={marcada}
                onChange={() => {
                  setErrorPaso('')
                  setLineasSel(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
                }}
                className="h-4 w-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
              />
              <span className="text-sm text-gray-900 break-words">{nombreLinea(id)}</span>
            </label>
          )
        })}
      </div>
      {lineasSel.length > 0 && lineasSel.length === lineasOrigen.length && (
        <AvisoAtencion>
          Le quitas todas sus líneas: sigue en el equipo, pero sin líneas. Si se va de la empresa, vuelve al paso
          anterior y elige «Se va de la empresa».
        </AvisoAtencion>
      )}
    </div>
  )

  const textoLineas = unirNombres(lineasTraspaso.map(nombreLinea)) || 'sus líneas'
  /** "la línea X" / "las líneas X y Y". */
  const conLasLineas =
    lineasTraspaso.length === 0 ? 'sus líneas' : `${lineasTraspaso.length === 1 ? 'la línea' : 'las líneas'} ${textoLineas}`
  const nombreVacanteNueva = nombreVacante(zonaOrigen)

  const pasoQuien = (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        ¿Quién recibe {esBaja ? 'todo lo de' : `${textoLineas} de`} <strong>{origen.full_name}</strong>?
        {esBaja && <span className="text-gray-500"> ({textoLineas})</span>}
      </p>
      <div className="space-y-3">
        <OpcionTarjeta
          nombre="tipo-destino"
          elegida={tipo === 'existente'}
          onElegir={() => {
            setTipo('existente')
            setErrorPaso('')
          }}
          titulo="Otra persona del equipo"
          texto="Conserva su zona y suma las líneas. La cobertura recalculada decide sus zonas."
        >
          {tipo === 'existente' && (
            <div className="mt-3 space-y-2">
              {candidatos.length > 6 && (
                <input
                  type="search"
                  value={busqueda}
                  onChange={event => setBusqueda(event.target.value)}
                  placeholder="Buscar por nombre o zona..."
                  className={claseInput}
                  aria-label="Buscar a quien recibe"
                />
              )}
              {candidatos.length === 0 ? (
                <p className="text-sm text-gray-500">No hay otras personas activas ni vacantes en el equipo.</p>
              ) : candidatosFiltrados.length === 0 ? (
                <p className="text-sm text-gray-500">Nadie coincide con la búsqueda.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1" role="radiogroup" aria-label="Persona que recibe">
                  {candidatosFiltrados.map(executive => {
                    const elegida = destinoId === executive.id
                    const yaLleva = lineasTraspaso.filter(id => executive.lines.includes(id))
                    return (
                      <label
                        key={executive.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer min-w-0 ${
                          elegida ? 'border-gray-900 bg-white ring-1 ring-gray-900' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="destino-existente"
                          checked={elegida}
                          onChange={() => {
                            setDestinoId(executive.id)
                            setErrorPaso('')
                          }}
                          className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-gray-900 focus:ring-gray-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 break-words">{executive.full_name}</span>
                            {executive.status === 'placeholder' && <Chip tono="ambar">Vacante</Chip>}
                          </span>
                          <span className="block text-xs text-gray-600 mt-0.5">
                            Zona: {nombreZona(executive) ?? 'sin zona base'}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {executive.lines.length === 0 ? (
                              <span className="text-xs text-gray-400">Sin líneas</span>
                            ) : (
                              executive.lines.map(id => (
                                <Chip key={id} tono={lineasTraspaso.includes(id) ? 'azul' : 'gris'}>
                                  {nombreLinea(id)}
                                </Chip>
                              ))
                            )}
                          </span>
                          {yaLleva.length > 0 && (
                            <span className="block text-xs text-blue-700 mt-1">
                              Ya lleva {unirNombres(yaLleva.map(nombreLinea))}: recibe los médicos y ajustes sin duplicar.
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </OpcionTarjeta>

        <OpcionTarjeta
          nombre="tipo-destino"
          elegida={tipo === 'nueva'}
          onElegir={() => {
            setTipo('nueva')
            setErrorPaso('')
          }}
          titulo="Una persona nueva"
          texto={`Se crea como Ejecutivo Comercial activo en la zona ${zonaOrigen ?? 'de quien entrega'}, con ${conLasLineas}.`}
        >
          {tipo === 'nueva' && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className={claseLabel} htmlFor="traspaso-nueva-nombre">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="traspaso-nueva-nombre"
                  type="text"
                  value={nuevaNombre}
                  onChange={event => {
                    setNuevaNombre(event.target.value)
                    setErrorPaso('')
                  }}
                  maxLength={NOMBRE_MAX}
                  className={claseInput}
                  autoComplete="off"
                />
              </div>
              <div className="min-w-0">
                <label className={claseLabel} htmlFor="traspaso-nueva-email">
                  Email (opcional)
                </label>
                <input
                  id="traspaso-nueva-email"
                  type="email"
                  value={nuevaEmail}
                  onChange={event => {
                    setNuevaEmail(event.target.value)
                    setErrorPaso('')
                  }}
                  maxLength={320}
                  placeholder="nombre@vgmedical.com.co"
                  className={claseInput}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </OpcionTarjeta>

        <OpcionTarjeta
          nombre="tipo-destino"
          elegida={tipo === 'vacante'}
          onElegir={() => {
            setTipo('vacante')
            setErrorPaso('')
          }}
          titulo="Una vacante"
          texto={`Se crea «${nombreVacanteNueva}» con su zona y ${conLasLineas}; guarda todo hasta que contrates a alguien (botón «Contratar»).`}
        />

        {!esBaja && (
          <OpcionTarjeta
            nombre="tipo-destino"
            elegida={tipo === 'nadie'}
            onElegir={() => {
              setTipo('nadie')
              setErrorPaso('')
            }}
            titulo="Nadie"
            texto={`Nadie recibe ${textoLineas}: sus médicos de ${
              lineasTraspaso.length === 1 ? 'esa línea' : 'esas líneas'
            } quedan sin visitante, sus ajustes manuales se desactivan y la cobertura recalculada decide quién cubre sus zonas (otra persona por alcance o quedan vacantes).`}
          />
        )}
      </div>
    </div>
  )

  const pasoFecha = (
    <div className="space-y-5">
      <div className="min-w-0">
        <label className={claseLabel} htmlFor="traspaso-fecha">
          Fecha del traspaso
        </label>
        <input
          id="traspaso-fecha"
          type="date"
          value={fecha}
          min={fechaMinima}
          max={hoy}
          onChange={event => {
            setFecha(event.target.value)
            setErrorPaso('')
          }}
          className={`${claseInput} sm:max-w-xs`}
        />
        <p className="text-xs text-gray-500 mt-1">
          Hoy por defecto; puede ser hasta {DIAS_ATRAS_MAX} días atrás para registrar algo que ya pasó (no se programan
          traspasos futuros). {origen.full_name} lo tiene hasta el{' '}
          {errorFechaTraspaso(fecha, hoy) ? 'día anterior' : fechaLarga(finDeOrigen(fecha))} y quien recibe, desde esa
          fecha.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700 mb-1">Opciones</legend>
        <Casilla
          marcada={guardarAnexo}
          onCambiar={setGuardarAnexo}
          titulo="Guardar la versión final de su anexo"
          texto={`En cada línea donde tiene territorio, con la etiqueta «${etiquetaAnexoFinal(fecha || hoy)}».`}
        />
        {esBaja && (
          <Casilla
            marcada={tieneUsuario && desactivarUsuario}
            onCambiar={setDesactivarUsuario}
            deshabilitada={!tieneUsuario}
            titulo="Desactivar su usuario de OpMap"
            texto={
              tieneUsuario
                ? 'Deja de entrar a OpMap. El usuario no se borra. Solo se desactiva un usuario de Ejecutivo Comercial (la vista previa lo confirma).'
                : 'No tiene usuario de OpMap enlazado.'
            }
          />
        )}
        <Casilla
          marcada={tipo !== 'nadie' && copiarExcepciones}
          onCambiar={setCopiarExcepciones}
          deshabilitada={tipo === 'nadie'}
          titulo="Copiar sus excepciones"
          texto={
            tipo === 'nadie'
              ? 'Nadie recibe: no hay a quién copiarlas.'
              : 'Metas propias, perfil, telefónica o radio: se registran para quien recibe desde la fecha del traspaso.'
          }
        />
      </fieldset>

      <div className="min-w-0">
        <label className={claseLabel} htmlFor="traspaso-motivo">
          Motivo (opcional)
        </label>
        <textarea
          id="traspaso-motivo"
          value={motivo}
          onChange={event => setMotivo(event.target.value)}
          maxLength={MOTIVO_MAX}
          rows={2}
          placeholder="Ej: renuncia, cambio de línea, reorganización..."
          className={claseInput}
        />
        <div className="mt-1 flex justify-between gap-3 text-xs">
          <span className="text-gray-500">Solo lo ven quienes administran el equipo.</span>
          <span className="text-gray-400 shrink-0">
            {motivo.length}/{MOTIVO_MAX}
          </span>
        </div>
      </div>
    </div>
  )

  const contenidoVista = (
    <div className="space-y-4">
      {cargandoVista && <Cargando texto="Preparando la vista previa (no se guarda nada)..." />}
      {!cargandoVista && errorVista && <AvisoError onReintentar={() => void pedirVistaPrevia()}>{errorVista}</AvisoError>}
      {!cargandoVista && vista && <VistaPrevia vista={vista} lines={lines} />}
      {errorEnvio && <AvisoError>{errorEnvio}</AvisoError>}
    </div>
  )

  const contenidoHecho = <ResultadoTraspaso resultado={resultado} vista={vista} lines={lines} />

  // ------------------------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------------------------

  const titulo = paso === 'hecho' ? 'Traspaso hecho' : esBaja ? `Dar de baja · ${origen.full_name}` : `Traspasar · ${origen.full_name}`
  const puedeConfirmar = paso === 'vista' && !cargandoVista && vista !== null && vista.ok && !enviando

  return (
    <Modal titulo={titulo} subtitulo={paso === 'hecho' ? origen.full_name : 'Nada se guarda hasta confirmar'} onCerrar={cerrar} ancho="sm:max-w-3xl">
      <div className="flex flex-col min-h-full">
        {paso !== 'hecho' && (
          <div className="px-4 sm:px-6 pt-4">
            {/* Celular: "Paso 2 de 4"; escritorio: los pasos con nombre */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-semibold text-gray-900">{pasosVisibles[indicePaso]?.titulo}</span>
                <span>
                  Paso {indicePaso + 1} de {pasosVisibles.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-gray-900 transition-all"
                  style={{ width: `${((indicePaso + 1) / pasosVisibles.length) * 100}%` }}
                />
              </div>
            </div>
            <ol className="hidden sm:flex items-center gap-2 text-xs">
              {pasosVisibles.map((item, index) => (
                <li key={item.paso} className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold shrink-0 ${
                      index < indicePaso
                        ? 'bg-gray-700 text-white'
                        : index === indicePaso
                          ? 'bg-gray-900 text-white ring-2 ring-gray-300'
                          : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`truncate ${index === indicePaso ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                    {item.titulo}
                  </span>
                  {index < pasosVisibles.length - 1 && <span className="w-4 h-px bg-gray-300 shrink-0" />}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex-1 px-4 sm:px-6 py-4 min-w-0 sm:min-h-[22rem]">
          {errorPaso && (
            <div className="mb-4">
              <AvisoError>{errorPaso}</AvisoError>
            </div>
          )}
          {paso === 'que' && pasoQue}
          {paso === 'lineas' && pasoLineas}
          {paso === 'quien' && pasoQuien}
          {paso === 'fecha' && pasoFecha}
          {paso === 'vista' && contenidoVista}
          {paso === 'hecho' && contenidoHecho}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-3 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {paso === 'hecho' ? (
            <>
              <span className="hidden sm:block" />
              <button type="button" onClick={onCerrar} className={claseBotonPrimario}>
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={atras} disabled={enviando || cargandoVista} className={claseBotonSecundario}>
                {indicePaso <= 0 ? 'Cancelar' : 'Atrás'}
              </button>
              {paso === 'vista' ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorEnvio('')
                    setConfirmando(true)
                  }}
                  disabled={!puedeConfirmar}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title={vista && !vista.ok ? 'Corrige lo que se indica arriba antes de confirmar' : undefined}
                >
                  Confirmar traspaso
                </button>
              ) : (
                <button type="button" onClick={siguiente} className={claseBotonPrimario}>
                  {paso === 'fecha' ? 'Ver vista previa' : 'Siguiente'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {confirmando && vista && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 ${CAPA_MODAL_ENCIMA} flex items-end sm:items-center justify-center p-0 sm:p-4`}
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmar traspaso"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">¿Confirmar el traspaso?</h3>
            <p className="mt-3 text-sm text-gray-700 break-words">{fraseConfirmacion(vista)}</p>
            <p className="mt-3 text-xs text-gray-500">
              Se hace todo de una vez y queda en el historial de traspasos. La cobertura se recalcula sola (sin Google
              Maps).
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={() => setConfirmando(false)} disabled={enviando} className={claseBotonSecundario}>
                Volver
              </button>
              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={enviando}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {enviando ? 'Traspasando...' : 'Sí, confirmar traspaso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------------------------

function OpcionTarjeta({
  nombre,
  elegida,
  onElegir,
  titulo,
  texto,
  children,
}: {
  nombre: string
  elegida: boolean
  onElegir: () => void
  titulo: string
  texto: string
  children?: ReactNode
}) {
  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition-colors min-w-0 ${
        elegida ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <label className="flex items-start gap-3 cursor-pointer min-w-0">
        <input
          type="radio"
          name={nombre}
          checked={elegida}
          onChange={onElegir}
          className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-gray-900 focus:ring-gray-700"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-900">{titulo}</span>
          <span className="block text-sm text-gray-600 mt-0.5 break-words">{texto}</span>
        </span>
      </label>
      {children}
    </div>
  )
}

function Casilla({
  marcada,
  onCambiar,
  titulo,
  texto,
  deshabilitada = false,
}: {
  marcada: boolean
  onCambiar: (valor: boolean) => void
  titulo: string
  texto: string
  deshabilitada?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 border rounded-lg min-w-0 ${
        deshabilitada ? 'border-gray-100 bg-gray-50 cursor-not-allowed' : 'border-gray-200 cursor-pointer hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        checked={marcada}
        disabled={deshabilitada}
        onChange={event => onCambiar(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
      />
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${deshabilitada ? 'text-gray-400' : 'text-gray-900'}`}>{titulo}</span>
        <span className="block text-xs text-gray-500 mt-0.5 break-words">{texto}</span>
      </span>
    </label>
  )
}

function ListaAvisos({ avisos }: { avisos: TraspasoAviso[] }) {
  if (avisos.length === 0) return null
  return (
    <ul className="space-y-2">
      {avisos.map((aviso, index) => (
        <li
          key={`${aviso.codigo}-${aviso.line_id ?? ''}-${aviso.kam_id ?? ''}-${index}`}
          className={`flex gap-2 rounded-lg border px-3 py-2 text-sm break-words ${
            aviso.nivel === 'atencion' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-100 text-blue-900'
          }`}
        >
          <span aria-hidden="true" className="shrink-0 font-bold">
            {aviso.nivel === 'atencion' ? '!' : 'i'}
          </span>
          <span className="min-w-0">{aviso.mensaje}</span>
        </li>
      ))}
    </ul>
  )
}

function Bloque({ titulo, cantidad, children }: { titulo: string; cantidad?: number; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h5 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
        {titulo}
        {cantidad !== undefined && <span className="ml-1 font-semibold text-gray-400">({cantidad})</span>}
      </h5>
      {children}
    </div>
  )
}

/** Lista de médicos: muestra los primeros y un botón para ver todos. */
function ListaMedicos({ medicos, razon }: { medicos: (PlanMedico & { razon?: string })[]; razon?: boolean }) {
  const [todos, setTodos] = useState(false)
  const LIMITE = 8
  const visibles = todos ? medicos : medicos.slice(0, LIMITE)
  return (
    <div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
        {visibles.map(medico => (
          <li key={medico.visitante_id} className="px-3 py-1.5 text-sm min-w-0">
            <span className="text-gray-900 break-words">{medico.medico_nombre || 'Médico sin nombre'}</span>
            {razon && medico.razon && <span className="block text-xs text-gray-500 break-words">{etiquetaRazon(medico.razon)}</span>}
          </li>
        ))}
      </ul>
      {medicos.length > LIMITE && (
        <button type="button" onClick={() => setTodos(valor => !valor)} className="mt-1 text-xs font-medium text-gray-700 underline">
          {todos ? 'Ver menos' : `Ver los ${medicos.length}`}
        </button>
      )}
    </div>
  )
}

function TarjetaLinea({ linea, vista }: { linea: PlanLinea; vista: VistaPreviaTraspaso }) {
  const hayDestino = vista.destino.tipo !== 'nadie'
  const nombreDestino = vista.destino.full_name ?? 'quien recibe'
  // El aviso del anexo final ya lo dice el bloque "Anexo de quien entrega"
  const avisosLinea = vista.avisos.filter(aviso => aviso.line_id === linea.line_id && aviso.codigo !== 'anexo_final')
  const nombre = linea.nombre_territorio
  return (
    <section className="rounded-xl border border-gray-200 bg-white min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <h4 className="text-sm font-bold text-gray-900 break-words">{linea.line_name}</h4>
        {hayDestino && linea.destino_ya_la_lleva && <Chip tono="azul">{nombreDestino} ya la lleva</Chip>}
      </header>
      <div className="p-4 space-y-4">
        <Bloque titulo="Zonas que tenía" cantidad={linea.zonas.length}>
          {linea.zonas.length === 0 ? (
            <p className="text-sm text-gray-500">No tiene zonas en la cobertura guardada de esta línea.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {linea.zonas.map(zona => (
                <Chip key={zona.kam_id} tono={zona.kind === 'manual' ? 'ambar' : zona.kind === 'reach' ? 'azul' : 'gris'} titulo={ETIQUETA_TIPO_ZONA[zona.kind]}>
                  {zona.kam_name || 'Zona sin nombre'} · {ETIQUETA_TIPO_ZONA[zona.kind] ?? zona.kind}
                </Chip>
              ))}
            </div>
          )}
        </Bloque>

        {(linea.ajustes_mover.length > 0 || linea.ajustes_desactivar.length > 0) && (
          <Bloque
            titulo={hayDestino ? `Ajustes manuales que pasan a ${nombreDestino}` : 'Ajustes manuales que se desactivan'}
            cantidad={hayDestino ? linea.ajustes_mover.length : linea.ajustes_desactivar.length}
          >
            <ul className="space-y-1">
              {(hayDestino ? linea.ajustes_mover : linea.ajustes_desactivar).map(ajuste => (
                <li key={ajuste.override_id} className="text-sm text-gray-800 break-words">
                  <span className="font-medium">{ajuste.kam_name || 'Zona sin nombre'}</span>
                  {ajuste.reason && <span className="text-gray-500"> · {ajuste.reason}</span>}
                  {ajuste.queda_sin_efecto && (
                    <span className="ml-1">
                      <Chip tono="ambar">quedará sin efecto</Chip>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        <Bloque titulo="Nombre del territorio">
          <p className="text-sm text-gray-800 break-words">
            {!nombre.origen
              ? 'No tiene un nombre propio en esta línea.'
              : nombre.se_copia
                ? `«${nombre.origen}» se copia a ${nombreDestino}.`
                : !hayDestino
                  ? `«${nombre.origen}» no se copia: nadie recibe la línea.`
                  : nombre.destino_actual
                    ? `${nombreDestino} ya tiene «${nombre.destino_actual}»: se conserva el suyo.`
                    : `«${nombre.origen}» no se copia.`}
          </p>
        </Bloque>

        <Bloque titulo={hayDestino ? `Médicos que pasan a ${nombreDestino}` : 'Médicos que pasan'} cantidad={linea.medicos_mover.length}>
          {linea.medicos_mover.length === 0 ? (
            <p className="text-sm text-gray-500">{hayDestino ? 'Ningún médico pasa en esta línea.' : 'Nadie recibe: ningún médico pasa.'}</p>
          ) : (
            <ListaMedicos medicos={linea.medicos_mover} />
          )}
        </Bloque>

        {linea.medicos_terminar.length > 0 && (
          <Bloque titulo="Médicos que solo se terminan" cantidad={linea.medicos_terminar.length}>
            <ListaMedicos medicos={linea.medicos_terminar} razon />
          </Bloque>
        )}

        {linea.medicos_omitidos.length > 0 && (
          <Bloque titulo="Omitidos (no se duplican)" cantidad={linea.medicos_omitidos.length}>
            <ListaMedicos medicos={linea.medicos_omitidos} razon />
          </Bloque>
        )}

        {linea.anexo_final.tiene_territorio && (
          <Bloque titulo="Anexo de quien entrega">
            <p className="text-sm text-gray-800 break-words">
              {linea.anexo_final.se_guarda
                ? `Se guarda su versión final: «${linea.anexo_final.etiqueta ?? etiquetaAnexoFinal(vista.fecha)}».`
                : 'No se guarda versión final (la casilla está desmarcada).'}
            </p>
          </Bloque>
        )}

        <ListaAvisos avisos={avisosLinea} />
      </div>
    </section>
  )
}

function VistaPrevia({ vista, lines }: { vista: VistaPreviaTraspaso; lines: BusinessLine[] }) {
  const origen = vista.origen
  const destino = vista.destino
  const hayDestino = destino.tipo !== 'nadie'
  const frases = frasesResumen(vista.resumen, 'presente')
  const avisosGenerales = vista.avisos.filter(aviso => !aviso.line_id)
  // Nombres de todas las líneas (las que se quedan con quien entrega no vienen en vista.lineas)
  const nombresLineas = new Map(lines.map(line => [line.id, line.name]))
  for (const linea of vista.lineas) nombresLineas.set(linea.line_id, linea.line_name)

  return (
    <div className="space-y-4">
      {!vista.ok && (
        <AvisoError>
          <p className="font-semibold">Así no se puede confirmar:</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {vista.errores.map((error, index) => (
              <li key={`${error.codigo}-${index}`}>{error.mensaje}</li>
            ))}
          </ul>
          <p className="mt-2">Vuelve atrás y corrígelo.</p>
        </AvisoError>
      )}

      {/* Quién entrega y quién recibe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 p-3 min-w-0">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Entrega</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 break-words">{origen?.full_name ?? '—'}</p>
          <p className="text-xs text-gray-600">Zona: {origen?.base_kam_name ?? 'sin zona base'}</p>
          <p className="mt-2 text-sm text-gray-700 break-words">
            {vista.dar_de_baja
              ? `Se da de baja: su último día es el ${fechaLarga(origen?.left_at_despues ?? vista.fin_origen)} y queda sin líneas.`
              : origen && origen.lineas_despues.length > 0
                ? `Sigue en el equipo con ${unirNombres(origen.lineas_despues.map(id => nombresLineas.get(id) ?? 'otra línea'))}.`
                : 'Sigue en el equipo, sin líneas.'}
          </p>
          {vista.dar_de_baja && origen?.user_id && (
            <p className="text-xs text-gray-500 mt-1">
              {vista.desactivar_usuario ? 'Su usuario de OpMap se desactiva.' : 'Su usuario de OpMap sigue activo.'}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 p-3 min-w-0">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recibe</p>
          {hayDestino ? (
            <>
              <p className="mt-1 text-sm font-semibold text-gray-900 break-words">
                {destino.full_name ?? '—'}
                {destino.tipo === 'nueva' && <span className="ml-1 font-normal text-gray-500">(persona nueva)</span>}
                {destino.tipo === 'vacante' && <span className="ml-1 font-normal text-gray-500">(vacante nueva)</span>}
              </p>
              <p className="text-xs text-gray-600">Zona: {destino.base_kam_name ?? 'sin zona base'}</p>
              {destino.email && <p className="text-xs text-gray-600 break-all">{destino.email}</p>}
              <p className="mt-2 text-sm text-gray-700 break-words">
                {destino.lineas_sumadas.length > 0
                  ? `Suma ${unirNombres(destino.lineas_sumadas.map(id => nombresLineas.get(id) ?? 'una línea'))}.`
                  : 'Ya llevaba estas líneas.'}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-gray-900">Nadie</p>
              <p className="mt-2 text-sm text-gray-700">
                Los médicos de estas líneas quedan sin visitante y sus ajustes manuales se desactivan.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 min-w-0">
        <p>
          <strong>Desde el {fechaLarga(vista.fecha)}</strong> · {plural(vista.lineas.length, 'línea', 'líneas')}:{' '}
          {unirNombres(vista.lineas.map(linea => linea.line_name))}
        </p>
        {frases.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 space-y-0.5">
            {frases.map(frase => (
              <li key={frase}>{frase}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-gray-600">
            {hayDestino
              ? 'Solo pasan las líneas: no hay médicos, ajustes manuales ni nombre de territorio que mover.'
              : `Solo se le ${vista.lineas.length === 1 ? 'quita la línea' : 'quitan las líneas'}: no hay médicos ni ajustes manuales que terminar.`}
          </p>
        )}
        {vista.motivo && <p className="mt-2 text-gray-600 break-words">Motivo: {vista.motivo}</p>}
        <p className="mt-2 text-xs text-gray-500">Después se recalcula la cobertura de todas las líneas (sin Google Maps).</p>
      </div>

      <ListaAvisos avisos={avisosGenerales} />

      <div className="space-y-3">
        {vista.lineas.map(linea => (
          <TarjetaLinea key={linea.line_id} linea={linea} vista={vista} />
        ))}
      </div>
    </div>
  )
}

function ResultadoTraspaso({
  resultado,
  vista,
  lines,
}: {
  resultado: TraspasoResponse | null
  vista: VistaPreviaTraspaso | null
  lines: BusinessLine[]
}) {
  const lineById = new Map(lines.map(line => [line.id, line]))
  const ids = resultado?.resumen.lineas.length ? resultado.resumen.lineas : vista?.lineas.map(linea => linea.line_id) ?? []
  const nombreMedico = new Map<string, string>()
  for (const linea of vista?.lineas ?? []) {
    for (const medico of [...linea.medicos_omitidos, ...linea.medicos_mover, ...linea.medicos_terminar]) {
      if (medico.medico_nombre) nombreMedico.set(medico.medico_id, medico.medico_nombre)
    }
  }
  const destino = vista?.destino
  const frases = resultado ? frasesResumen(resultado.resumen, 'pasado') : []

  return (
    <div className="space-y-4">
      <AvisoOk>
        <p className="font-semibold">Listo: el traspaso quedó hecho y guardado en el historial.</p>
        {destino && destino.tipo !== 'nadie' && (
          <p className="mt-1">
            Recibe: <strong>{destino.full_name}</strong>
            {destino.tipo === 'vacante' && ' (vacante: cuando contrates a alguien, usa «Contratar» en esa vacante)'}
            {destino.tipo === 'nueva' && ' (persona nueva)'}
          </p>
        )}
        {destino?.tipo === 'nadie' && <p className="mt-1">Nadie recibió estas líneas.</p>}
        {destino?.tipo === 'nueva' && resultado?.usuario_enlazado !== undefined && (
          <p className="mt-1">
            {resultado.usuario_enlazado
              ? 'Quedó enlazada con su usuario de OpMap (mismo email).'
              : 'No quedó enlazada con un usuario de OpMap: no hay uno con ese email o ya está enlazado con otra persona.'}
          </p>
        )}
      </AvisoOk>

      {!resultado ? (
        <AvisoAtencion>El servidor no devolvió el detalle de lo movido. Revísalo en el historial de traspasos.</AvisoAtencion>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 p-3 text-sm text-gray-800">
            <p className="font-semibold">Lo que se movió</p>
            {frases.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {frases.map(frase => (
                  <li key={frase}>{frase}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-gray-600">
                {destino?.tipo === 'nadie'
                  ? 'Se le quitaron las líneas; no había médicos ni ajustes manuales que terminar.'
                  : 'Pasaron las líneas; no había médicos, ajustes manuales ni nombre de territorio que mover.'}
              </p>
            )}
          </div>

          {resultado.resumen.omitidos.length > 0 && (
            <div className="rounded-xl border border-gray-200 p-3 text-sm">
              <p className="font-semibold text-gray-800">No pasaron a quien recibe</p>
              <ul className="mt-1 space-y-1">
                {resultado.resumen.omitidos.map((omitido, index) => (
                  <li key={`${omitido.medico_id}-${index}`} className="break-words">
                    <span className="text-gray-900">{nombreMedico.get(omitido.medico_id) ?? 'Médico'}</span>
                    <span className="block text-xs text-gray-500">{etiquetaRazon(omitido.razon)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultado.anexos_finales.length > 0 && (
            <div className="rounded-xl border border-gray-200 p-3 text-sm">
              <p className="font-semibold text-gray-800">Versión final del anexo de quien entregó</p>
              <ul className="mt-1 space-y-1">
                {resultado.anexos_finales.map(anexo => (
                  <li key={anexo.line_id} className="break-words">
                    <span className="font-medium">{lineById.get(anexo.line_id)?.name ?? 'Línea'}:</span>{' '}
                    {anexo.ya_existia ? (
                      <span className="text-gray-700">ya estaba guardada «{anexo.etiqueta}» (de un intento anterior de hoy)</span>
                    ) : anexo.error ? (
                      <span className="text-red-700">no se pudo guardar ({anexo.error})</span>
                    ) : (
                      <span className="text-gray-700">guardada «{anexo.etiqueta}»</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!resultado.cobertura_recalculada && (
            <AvisoAtencion>
              La cobertura no se pudo recalcular sola. Entra a Líneas de negocio y pulsa «Recalcular» en la cobertura de
              la línea.
            </AvisoAtencion>
          )}
        </>
      )}

      {ids.length > 0 && (
        <div className="rounded-xl border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-800 mb-2">Revisa cómo quedó</p>
          <ul className="space-y-2">
            {ids.map(id => {
              const linea = lineById.get(id)
              const codigo = linea?.code ?? vista?.lineas.find(item => item.line_id === id)?.line_code ?? null
              const nombre = linea?.name ?? vista?.lineas.find(item => item.line_id === id)?.line_name ?? 'Línea'
              const href = codigo ? `/lines?line=${encodeURIComponent(codigo)}` : '/lines'
              return (
                <li key={id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm min-w-0">
                  <span className="font-medium text-gray-900 sm:w-40 truncate">{nombre}</span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <Link href={href} className="text-gray-700 underline hover:text-gray-900">
                      Ver cobertura de la línea
                    </Link>
                    <Link href={`${href}#anexo`} className="text-gray-700 underline hover:text-gray-900">
                      Ver anexo
                    </Link>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
