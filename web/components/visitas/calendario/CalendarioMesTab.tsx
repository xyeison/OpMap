'use client'

// Calendario > Calendario: el mes con festivos nacionales, días de empresa y días por ciudad (filtro de ciudad).
// GET /api/calendario?desde=&hasta=&municipio= → { dias } (los anulados solo llegan con calendar:manage).
// Con calendar:manage: añadir día de empresa o de ciudad (POST /api/calendario), anular con motivo
// (POST /api/calendario/[id]/anular) y "Cargar festivos de AAAA" (POST /api/calendario/festivos → { insertados }).
// Los demás solo ven. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (secciones "API" e "Interfaz").
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  diaSemanaIso,
  etiquetaAlcanceCalendario,
  etiquetaTipoDiaCalendario,
  limitesMes,
  mesDe,
  rangoFechas,
  type CalendarioDiaItem,
  type CalendarioResponse,
  type CargarFestivosResponse,
} from '@/lib/visits-rules'
import {
  AvisoError,
  AvisoOk,
  Cargando,
  Chip,
  claseBotonChico,
  claseBotonPrimario,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
} from '@/components/terceros/comun'
import MunicipioSelector from '@/components/terceros/MunicipioSelector'
import { Casilla, Confirmar, DIAS_CORTOS, SelectorMes, Tarjeta, Vacio, conMayuscula, fechaHora, fechaLarga, nombreMes } from '../comun'
import DiaCalendarioForm from './DiaCalendarioForm'

type Abierto = { tipo: 'nuevo'; fecha: string } | { tipo: 'anular'; dia: CalendarioDiaItem } | { tipo: 'festivos'; anio: number }

/** Color de cada clase de día (marca en la cuadrícula y en la lista). */
function claseMarca(dia: CalendarioDiaItem): string {
  if (dia.anulado_at) return 'bg-gray-300'
  if (dia.alcance === 'nacional') return 'bg-red-500'
  if (dia.alcance === 'empresa') return dia.tipo === 'habil' ? 'bg-green-500' : 'bg-amber-500'
  return dia.tipo === 'habil' ? 'bg-teal-500' : 'bg-violet-500'
}

const LEYENDA = [
  { clase: 'bg-red-500', texto: 'Festivo nacional' },
  { clase: 'bg-amber-500', texto: 'Empresa: no hábil' },
  { clase: 'bg-green-500', texto: 'Empresa: hábil' },
  { clase: 'bg-violet-500', texto: 'Ciudad: no hábil' },
  { clase: 'bg-teal-500', texto: 'Ciudad: hábil' },
]

export default function CalendarioMesTab({ hoy, puedeGestionar }: { hoy: string; puedeGestionar: boolean }) {
  const [mes, setMes] = useState(mesDe(hoy))
  const [municipio, setMunicipio] = useState<string | null>(null)
  const [nombreCiudad, setNombreCiudad] = useState<string | null>(null)
  const [mostrarAnulados, setMostrarAnulados] = useState(false)
  const [dias, setDias] = useState<CalendarioDiaItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [version, setVersion] = useState(0)
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const turno = useRef(0)

  const { desde, hasta } = limitesMes(mes)

  useEffect(() => {
    const miTurno = ++turno.current
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const parametros = new URLSearchParams({ desde, hasta })
        if (municipio) parametros.set('municipio', municipio)
        const respuesta = await pedirJson(`/api/calendario?${parametros.toString()}`)
        if (miTurno !== turno.current) return
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo cargar el calendario'))
        const data = respuesta.data as CalendarioResponse | null
        setDias(Array.isArray(data?.dias) ? data.dias : [])
      } catch (err) {
        if (miTurno !== turno.current) return
        setError(mensajeExcepcion(err, 'No se pudo cargar el calendario'))
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    }
    cargar()
  }, [desde, hasta, municipio, version])

  // Con ciudad elegida, solo los días de esa ciudad (además de los nacionales y de empresa).
  const visibles = useMemo(
    () =>
      dias
        .filter(dia => mostrarAnulados || !dia.anulado_at)
        .filter(dia => dia.alcance !== 'ciudad' || !municipio || dia.municipality_id === municipio)
        .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.alcance.localeCompare(b.alcance))),
    [dias, mostrarAnulados, municipio]
  )
  const hayAnulados = dias.some(dia => dia.anulado_at)
  const porFecha = useMemo(() => {
    const mapa = new Map<string, CalendarioDiaItem[]>()
    for (const dia of visibles) mapa.set(dia.fecha, [...(mapa.get(dia.fecha) ?? []), dia])
    return mapa
  }, [visibles])

  const fechas = rangoFechas(desde, hasta)
  const huecos = diaSemanaIso(desde) - 1
  const celdas: (string | null)[] = [...Array<null>(huecos).fill(null), ...fechas]
  while (celdas.length % 7 !== 0) celdas.push(null)
  const anio = Number(mes.slice(0, 4))

  const textoAlcance = (dia: CalendarioDiaItem) =>
    dia.alcance === 'ciudad' ? `Día de ciudad: ${dia.ciudad ?? dia.municipality_id ?? 'sin ciudad'}` : etiquetaAlcanceCalendario(dia.alcance)

  return (
    <div className="space-y-4 min-w-0">
      {/* Filtros y acciones */}
      <Tarjeta className="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 min-w-0">
          <SelectorMes mes={mes} onCambiar={setMes} mesActual={mesDe(hoy)} />
          {puedeGestionar && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setAviso('')
                  setAbierto({ tipo: 'nuevo', fecha: mesDe(hoy) === mes ? hoy : desde })
                }}
                className={claseBotonPrimario}
              >
                + Añadir día
              </button>
              <button
                type="button"
                onClick={() => {
                  setAviso('')
                  setAbierto({ tipo: 'festivos', anio })
                }}
                className={claseBotonChico}
              >
                Cargar festivos de {anio}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 lg:items-end">
          <MunicipioSelector
            valor={municipio}
            onCambiar={(codigo, nombre) => {
              setMunicipio(codigo)
              setNombreCiudad(nombre)
            }}
            etiqueta="Ciudad"
            textoVacio="Todas las ciudades"
          />
          {puedeGestionar && hayAnulados && (
            <Casilla marcada={mostrarAnulados} onCambiar={setMostrarAnulados}>
              Mostrar días anulados
            </Casilla>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {municipio
            ? `Días que aplican a quien trabaja en ${nombreCiudad ?? 'esa ciudad'}: festivos nacionales, días de empresa y días de esa ciudad.`
            : 'Todos los días especiales. Un día de ciudad solo afecta a quienes trabajan en esa ciudad.'}
        </p>
      </Tarjeta>

      {aviso && <AvisoOk>{aviso}</AvisoOk>}
      {error && <AvisoError onReintentar={() => setVersion(v => v + 1)}>{error}</AvisoError>}

      {/* Cuadrícula del mes */}
      <Tarjeta className="p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] sm:text-xs font-semibold text-gray-500 mb-1">
          {DIAS_CORTOS.map(dia => (
            <div key={dia}>{dia}</div>
          ))}
        </div>
        <div className={`grid grid-cols-7 gap-1 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
          {celdas.map((fecha, i) => {
            if (!fecha) return <div key={`vacio-${i}`} className="min-h-[2.75rem] sm:min-h-[5.5rem]" aria-hidden="true"></div>
            const delDia = porFecha.get(fecha) ?? []
            const finDeSemana = diaSemanaIso(fecha) >= 6
            const esHoy = fecha === hoy
            const contenido = (
              <>
                <span className={`text-xs sm:text-sm font-semibold ${esHoy ? 'text-white bg-gray-900 rounded-full px-1.5' : 'text-gray-800'}`}>
                  {Number(fecha.slice(8, 10))}
                </span>
                {/* Celular: puntos */}
                <span className="flex sm:hidden flex-wrap justify-center gap-0.5 mt-1">
                  {delDia.map(dia => (
                    <span key={dia.id} className={`h-1.5 w-1.5 rounded-full ${claseMarca(dia)}`}></span>
                  ))}
                </span>
                {/* Escritorio: nombres */}
                <span className="hidden sm:flex flex-col gap-0.5 mt-1 w-full min-w-0">
                  {delDia.slice(0, 2).map(dia => (
                    <span
                      key={dia.id}
                      className={`flex items-center gap-1 text-[11px] leading-tight text-left min-w-0 ${dia.anulado_at ? 'line-through text-gray-400' : 'text-gray-700'}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${claseMarca(dia)}`}></span>
                      <span className="truncate">{dia.nombre}</span>
                    </span>
                  ))}
                  {delDia.length > 2 && <span className="text-[11px] text-gray-500 text-left">+{delDia.length - 2} más</span>}
                </span>
              </>
            )
            const clases = `min-h-[2.75rem] sm:min-h-[5.5rem] rounded-lg border p-1 flex flex-col items-center sm:items-start min-w-0 ${
              finDeSemana ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100'
            } ${esHoy ? 'ring-2 ring-gray-900' : ''}`
            const titulo = `${conMayuscula(fechaLarga(fecha))}${delDia.length ? `: ${delDia.map(d => d.nombre).join(', ')}` : ''}`
            return puedeGestionar ? (
              <button
                key={fecha}
                type="button"
                title={titulo}
                aria-label={`${titulo}. Añadir un día de empresa o de ciudad`}
                onClick={() => {
                  setAviso('')
                  setAbierto({ tipo: 'nuevo', fecha })
                }}
                className={`${clases} hover:border-gray-400`}
              >
                {contenido}
              </button>
            ) : (
              <div key={fecha} title={titulo} className={clases}>
                {contenido}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {LEYENDA.map(item => (
            <span key={item.texto} className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${item.clase}`}></span>
              {item.texto}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded bg-gray-100 border border-gray-200"></span>
            Fin de semana
          </span>
        </div>
      </Tarjeta>

      {/* Lista del mes */}
      <Tarjeta>
        <div className="px-4 pt-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Días especiales de {nombreMes(mes)}</h3>
        </div>
        {cargando && dias.length === 0 ? (
          <Cargando texto="Cargando el calendario..." />
        ) : visibles.length === 0 ? (
          <Vacio titulo="No hay días especiales este mes">
            {puedeGestionar ? 'Añade un día de empresa o de ciudad, o carga los festivos del año.' : 'Este mes solo cuentan los días de la semana.'}
          </Vacio>
        ) : (
          <ul className="divide-y divide-gray-100 mt-2">
            {visibles.map(dia => (
              <li key={dia.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${claseMarca(dia)}`}></span>
                    <p className={`text-sm font-semibold min-w-0 truncate ${dia.anulado_at ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {dia.nombre}
                    </p>
                  </div>
                  <p className={`text-xs mt-0.5 ${dia.anulado_at ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                    {conMayuscula(fechaLarga(dia.fecha))}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Chip tono={dia.alcance === 'nacional' ? 'rojo' : dia.alcance === 'empresa' ? 'ambar' : 'azul'}>{textoAlcance(dia)}</Chip>
                    <Chip tono={dia.tipo === 'habil' ? 'verde' : 'gris'}>{etiquetaTipoDiaCalendario(dia.tipo)}</Chip>
                    {dia.origen === 'calculado' && <Chip>Calculado (Ley 51 de 1983)</Chip>}
                    {dia.anulado_at && <Chip tono="rojo">Anulado el {fechaHora(dia.anulado_at)}</Chip>}
                  </div>
                </div>
                {puedeGestionar && !dia.anulado_at && (
                  <button
                    type="button"
                    onClick={() => {
                      setAviso('')
                      setAbierto({ tipo: 'anular', dia })
                    }}
                    className={`${claseBotonChico} self-start sm:self-center text-red-700`}
                  >
                    Anular
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {abierto?.tipo === 'nuevo' && (
        <DiaCalendarioForm
          fechaInicial={abierto.fecha}
          municipioInicial={municipio}
          onCerrar={() => setAbierto(null)}
          onCreado={mensaje => {
            setAbierto(null)
            setAviso(mensaje)
            setVersion(v => v + 1)
          }}
        />
      )}

      {abierto?.tipo === 'anular' && (
        <Confirmar
          titulo="Anular día del calendario"
          textoConfirmar="Anular día"
          peligro
          motivo={{ obligatorio: true, placeholder: 'Por qué se anula (por ejemplo, el decreto lo cambió)' }}
          onCerrar={() => setAbierto(null)}
          onConfirmar={async motivo => {
            const dia = abierto.dia
            const respuesta = await pedirJson(`/api/calendario/${dia.id}/anular`, { method: 'POST', json: { motivo } })
            if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo anular el día'))
            setAbierto(null)
            setAviso(`Se anuló «${dia.nombre}» del ${fechaLarga(dia.fecha)}. Ese día vuelve a contar según el día de la semana.`)
            setVersion(v => v + 1)
          }}
        >
          <p>
            <strong>{abierto.dia.nombre}</strong> · {fechaLarga(abierto.dia.fecha)} · {textoAlcance(abierto.dia)} ·{' '}
            {etiquetaTipoDiaCalendario(abierto.dia.tipo).toLowerCase()}
          </p>
          <p>
            No se borra: queda tachado con tu nombre y el motivo.
            {abierto.dia.origen === 'calculado' && ' Un festivo anulado no vuelve aunque se carguen de nuevo los festivos del año.'}
          </p>
        </Confirmar>
      )}

      {abierto?.tipo === 'festivos' && (
        <Confirmar
          titulo={`Cargar festivos de ${abierto.anio}`}
          textoConfirmar="Cargar festivos"
          onCerrar={() => setAbierto(null)}
          onConfirmar={async () => {
            const anioFestivos = abierto.anio
            const respuesta = await pedirJson('/api/calendario/festivos', { method: 'POST', json: { anio: anioFestivos } })
            if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudieron cargar los festivos'))
            const insertados = Number((respuesta.data as CargarFestivosResponse | null)?.insertados ?? 0)
            setAbierto(null)
            setAviso(
              insertados > 0
                ? `Se cargaron ${insertados} ${insertados === 1 ? 'festivo' : 'festivos'} de ${anioFestivos}.`
                : `Los festivos de ${anioFestivos} ya estaban cargados. No se agregó ninguno.`
            )
            setVersion(v => v + 1)
          }}
        >
          <p>
            Se calculan los 18 festivos nacionales de {abierto.anio} (Ley 51 de 1983: fijos, trasladados al lunes y los de
            Pascua) y se guardan en el calendario.
          </p>
          <p>Las fechas que ya tienen un festivo, activo o anulado, no se tocan: una corrección no se revive.</p>
        </Confirmar>
      )}
    </div>
  )
}
