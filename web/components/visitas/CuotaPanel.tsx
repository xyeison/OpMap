'use client'

// Fase 7 · F2: cuota del mes de una persona (médica, institucional y subtipos con meta propia; días hábiles,
// transcurridos, libres, por aprobar y ritmo). La misma tarjeta para "Mi cuota del mes" (GET /api/me/cuota?mes=)
// y para la vista previa de Configuración > Personas (GET /api/config-visitas/cuota?executive_id=&mes=).
// La cuota de cada mes se calcula con el perfil y la meta que regían cada día: `aplica` dice si el tipo estuvo en
// su perfil algún día de ESE mes; la meta por día y el perfil del encabezado son los de hoy, así que solo se
// muestran como "hoy". Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (CuotaResponse en
// lib/visits-rules.ts).
import { useEffect, useRef, useState } from 'react'
import type { CuotaResponse, CuotaTipo } from '@/lib/visits-rules'
import { AvisoError, Cargando, mensajeError, mensajeExcepcion, pedirJson } from '@/components/terceros/comun'
import { SelectorMes, numeroTexto, porcentaje } from './comun'
import { textoOrigenMeta, textoPerfil } from './textos'

export default function CuotaPanel({
  url,
  mesInicial,
  mesActual,
  titulo,
}: {
  /** Ruta de la API para un mes AAAA-MM. */
  url: (mes: string) => string
  mesInicial: string
  /** Mes de hoy (para "Este mes" y para decir "hoy"). */
  mesActual: string
  titulo?: string
}) {
  const [mes, setMes] = useState(mesInicial)
  const [datos, setDatos] = useState<CuotaResponse | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const turno = useRef(0)
  const direccion = url(mes)

  useEffect(() => {
    const miTurno = ++turno.current
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const respuesta = await pedirJson(direccion)
        if (miTurno !== turno.current) return
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo calcular la cuota'))
        setDatos(respuesta.data as CuotaResponse)
      } catch (err) {
        if (miTurno !== turno.current) return
        setDatos(null)
        setError(mensajeExcepcion(err, 'No se pudo calcular la cuota'))
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    }
    cargar()
  }, [direccion, intento])

  const esEsteMes = mes === mesActual

  return (
    <div className="space-y-4 min-w-0">
      {/* Título encima del selector: la tarjeta va en una columna angosta en escritorio ("Mis días libres") y en
          fila el título quedaba cortado ("Mi cuota del ..."). */}
      <div className="flex flex-col gap-3 min-w-0">
        {titulo && <h3 className="text-base font-bold text-gray-900 min-w-0 break-words">{titulo}</h3>}
        <SelectorMes mes={mes} onCambiar={setMes} mesActual={mesActual} />
      </div>

      {error ? (
        <AvisoError onReintentar={() => setIntento(n => n + 1)}>{error}</AvisoError>
      ) : cargando && !datos ? (
        <Cargando texto="Calculando la cuota..." />
      ) : datos ? (
        <div className={`space-y-4 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
          <p className="text-xs text-gray-500 break-words">
            {datos.zona ? `Zona ${datos.zona.nombre}` : 'Sin zona base'}
            {datos.ciudad ? ` · ${datos.ciudad}` : datos.municipio ? ` · municipio ${datos.municipio}` : ''} · Perfil hoy:{' '}
            {textoPerfil(datos.perfil ?? [])}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TarjetaTipo titulo="Médica" tipo={datos.medica} esEsteMes={esEsteMes} />
            <TarjetaTipo titulo="Institucional" tipo={datos.institucional} esEsteMes={esEsteMes} />
          </div>

          {datos.subtipos && datos.subtipos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Subtipos con meta propia</h4>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {datos.subtipos.map(subtipo => (
                  <li key={subtipo.subtipo_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm min-w-0">
                    <span className="min-w-0 truncate text-gray-800">{subtipo.nombre}</span>
                    <span className="shrink-0 font-semibold text-gray-900">
                      {numeroTexto(subtipo.cuota)}
                      {esEsteMes && (
                        <span className="font-normal text-xs text-gray-500"> (hoy {numeroTexto(subtipo.meta_dia_hoy)} por día)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 2 × 2 siempre: con 4 columnas en la columna angosta las etiquetas se cortaban ("Transcu..."). */}
          <dl className="grid grid-cols-2 gap-3">
            <Cifra etiqueta="Días hábiles" valor={datos.dias_habiles} />
            <Cifra etiqueta={esEsteMes ? 'Transcurridos (con hoy)' : 'Transcurridos'} valor={datos.dias_habiles_transcurridos} />
            <Cifra etiqueta="Días libres" valor={datos.dias_libres} />
            <Cifra etiqueta="Por aprobar" valor={datos.dias_por_aprobar} tono={datos.dias_por_aprobar > 0 ? 'ambar' : undefined} />
          </dl>

          <div className="min-w-0">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Ritmo del mes</span>
              <span className="font-semibold text-gray-900">{porcentaje(datos.ritmo)}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round((datos.ritmo ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gray-900 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (datos.ritmo ?? 0) * 100))}%` }}></div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Van {numeroTexto(datos.dias_habiles_transcurridos)} de {numeroTexto(datos.dias_habiles)} días hábiles del mes. Los días
              por aprobar todavía no restan.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TarjetaTipo({ titulo, tipo, esEsteMes }: { titulo: string; tipo: CuotaTipo | null | undefined; esEsteMes: boolean }) {
  // `aplica` es del mes que se mira (el perfil de cada día), no de hoy; con cuota > 0 la tarjeta siempre se muestra.
  if (!tipo || (tipo.aplica === false && !(Number(tipo.cuota) > 0))) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 min-w-0">
        <p className="text-sm font-semibold text-gray-500">{titulo}</p>
        <p className="text-xs text-gray-500 mt-1">
          No tiene meta {titulo.toLowerCase()} {esEsteMes ? 'este mes' : 'ese mes'}: no estuvo en su perfil ningún día.
        </p>
      </div>
    )
  }
  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-white min-w-0">
      <p className="text-sm font-semibold text-gray-700">{titulo}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{numeroTexto(tipo.cuota)}</p>
      <p className="text-xs text-gray-500">visitas en el mes</p>
      <p className="text-xs text-gray-600 mt-2 break-words">
        {esEsteMes
          ? `Hoy: ${numeroTexto(tipo.meta_dia_hoy)} por día hábil · ${textoOrigenMeta(tipo.origen)}`
          : 'Calculada con la meta y el perfil que regían cada día de ese mes.'}
      </p>
    </div>
  )
}

function Cifra({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono?: 'ambar' }) {
  return (
    <div className={`p-3 rounded-lg border min-w-0 ${tono === 'ambar' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
      <dt className="text-xs text-gray-500 leading-snug break-words">{etiqueta}</dt>
      <dd className="text-lg font-bold text-gray-900">{numeroTexto(valor)}</dd>
    </div>
  )
}
