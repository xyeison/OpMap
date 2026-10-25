'use client'

// Página "Zonas" (/kams): la entrada de las líderes (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md, E1 y
// E2; decisión del dueño en docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md). Una fila por Zona
// activa con lo que hay en ella (IPS, camas, municipios, población, afiliados, giros), quién vive en ella (Ejecutivos
// Comerciales y vacantes con sus líneas) y su estado en la línea elegida (Ocupada, Reservada, Por alcance, Sin
// cobertura, Conflicto). Bogotá va agrupada con su total y sus cuatro celdas plegables. Acciones, solo para quien puede
// asignar en la línea: junto a cada persona de "Vive aquí", "Darle <línea>" o "Quitarle <línea>" con vista previa
// simulada (AsignarLineaDialog; una sola acción por persona, nunca dos botones a nivel de Zona);
// "Forzar a alguien de otra ciudad" y "Quitar ajuste" siguen en /lines (AdjustModal no se exporta de CoveragePanel).
// Los datos salen de GET /api/kams/zonas?line=<code> (ZonasResponse, web/lib/types/zonas.ts; la ruta la hace otro
// agente): nada de esta pantalla calcula rutas ni consulta Google. La administración de Zonas (agregar, colores,
// editar, desactivar, Bogotá, valor de contratos) queda plegada al final y solo con kams:edit / kams:bogota-config /
// contracts:view: antes se mostraba a quien recibía 403 al usarla.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import BogotaConfigCard from '@/components/BogotaConfigCard'
import KamDeactivateButton from '@/components/KamDeactivateButton'
import KamActivateButton from '@/components/KamActivateButton'
import EditKamModal from '@/components/EditKamModal'
import AddKamModal from '@/components/AddKamModal'
import { AvisoAtencion, AvisoError, AvisoOk, claseBotonChico } from '@/components/terceros/comun'
import { usePermissions } from '@/hooks/usePermissions'
import { readError } from '@/app/lines/coverage-shared'
import { ESTADOS_PLAZA, type ZonaCifras, type ZonaEnLinea, type ZonaFila, type ZonaResidente, type ZonasResponse } from '@/lib/types/zonas'
import { fechaEs } from '@/lib/zona-estadisticas'
import AsignarLineaDialog, { type ModoAsignar, type ResidenteElegible } from './AsignarLineaDialog'
import ZonaDatosModal from './ZonaDatosModal'
import {
  agruparBogota,
  CLASE_SIN_EQUIPO,
  ESTADO_BADGE,
  ESTADO_PLAZA_PLURAL,
  filaDeZona,
  filtrarFilas,
  motivoNoPuedeDar,
  nombreLinea,
  nombreZona,
  puedeQuitar,
  resumenCifras,
  resumenEstados,
  sugerenciaCobertura,
  textoEstado,
  textoPuedeTener,
  zonasDeFila,
  type FilaZonas,
} from './zonas-ui'

// ---------------------------------------------------------------------------
// ?line=<code> en la URL (como CoveragePanel): se lee al entrar y se escribe sin recargar ni añadir historial
// ---------------------------------------------------------------------------

function readLineFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('line')
  } catch {
    return null
  }
}

function writeLineToUrl(code: string) {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('line') === code) return
    url.searchParams.set('line', code)
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    // Sin URL persistida: no es crítico
  }
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function KamsPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="kams:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div>
                  <strong className="font-semibold">Acceso denegado</strong>
                  <p className="text-sm mt-1">No tienes permisos para ver las zonas.</p>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <ZonasContent />
      </PermissionGuard>
    </ProtectedRoute>
  )
}

interface DialogoAsignar {
  modo: ModoAsignar
  zonaNombre: string
  esBogota: boolean
  residentes: ResidenteElegible[]
  residenteInicial: string | null
}

/** Lo que las filas necesitan de la página. */
interface ContextoFila {
  linea: ZonasResponse['linea']
  lineas: ZonasResponse['lineas']
  acceso: ZonasResponse['acceso']
  onVerDatos: (zona: ZonaFila) => void
  /** La acción va junto a cada persona de "Vive aquí": darle o quitarle la línea a ESA persona o vacante. */
  onDar: (fila: FilaZonas, residenteId: string) => void
  onQuitar: (fila: FilaZonas, residenteId: string) => void
}

const SIN_ACCESO: ZonasResponse['acceso'] = { asignar: false, ajustar: false, comprasPublicas: false, administrar: false }

function ZonasContent() {
  const { can } = usePermissions()
  const puedeEditarZonas = can('kams:edit')
  const puedeBogota = can('kams:bogota-config')
  const veContratos = can('contracts:view')

  const [requestedCode, setRequestedCode] = useState<string | null>(() => readLineFromUrl())
  const [data, setData] = useState<ZonasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [bogotaAbierta, setBogotaAbierta] = useState(false)
  const [adminAbierta, setAdminAbierta] = useState(false)
  const [datosDe, setDatosDe] = useState<ZonaFila | null>(null)
  const [dialogo, setDialogo] = useState<DialogoAsignar | null>(null)
  // Líneas que la API rechazó con 403 (por ejemplo una ?line= ajena en la URL): no se vuelven a pedir
  const rechazadas = useRef(new Set<string>())

  const load = useCallback(async (code: string | null, silencioso = false) => {
    if (!silencioso) setLoading(true)
    setError('')
    try {
      const url = code ? `/api/kams/zonas?line=${encodeURIComponent(code)}` : '/api/kams/zonas'
      const response = await fetch(url, { cache: 'no-store' })
      if (response.status === 403 && code && !rechazadas.current.has(code)) {
        // La línea pedida no es del usuario: se pide sin línea y la página elige la primera suya
        rechazadas.current.add(code)
        setRequestedCode(null)
        return
      }
      if (!response.ok) throw new Error(await readError(response, 'Error al cargar las zonas'))
      const body = (await response.json().catch(() => null)) as ZonasResponse | null
      if (!body || !Array.isArray(body.zonas) || !Array.isArray(body.lineas)) throw new Error('Respuesta inesperada del servidor')
      setData(body)
    } catch (err: unknown) {
      console.error('Error cargando las zonas:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar las zonas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(requestedCode)
  }, [requestedCode, load])

  // La API fija la línea (la pedida o, sin ?line=, la primera del usuario): se refleja en la URL. Si no fijó ninguna
  // y el usuario sí tiene líneas, se pide la primera que no haya sido rechazada.
  useEffect(() => {
    if (!data) return
    if (data.linea) {
      writeLineToUrl(data.linea.code)
      return
    }
    if (requestedCode === null) {
      const primera = data.lineas.find(line => !rechazadas.current.has(line.code))
      if (primera) setRequestedCode(primera.code)
    }
  }, [data, requestedCode])

  const linea = data?.linea ?? null
  const selectedCode = linea?.code ?? requestedCode
  const acceso = data?.acceso ?? SIN_ACCESO
  const recargar = useCallback(() => load(selectedCode, true), [load, selectedCode])

  const filas = useMemo(() => (data ? agruparBogota(data) : []), [data])
  const filasVisibles = useMemo(() => filtrarFilas(filas, busqueda), [filas, busqueda])
  const resumen = useMemo(() => (data ? resumenEstados(data.zonas) : null), [data])

  const puedeAdministrar = puedeEditarZonas || acceso.administrar
  const hayAdministracion = puedeAdministrar || puedeBogota || veContratos

  // El diálogo se abre para UNA persona o vacante concreta (el interruptor está junto a su nombre en "Vive aquí"), pero
  // recibe a todos los que viven en la Zona (o en las celdas de Bogotá) para avisar si otra ya lleva la línea.
  const abrirDialogo = useCallback(
    (modo: ModoAsignar, fila: FilaZonas, residenteId: string) => {
      if (!linea) return
      const residentes: ResidenteElegible[] = zonasDeFila(fila).flatMap(zona =>
        zona.residentes.map(residente => ({ ...residente, kam_id: zona.kam_id, zonaNombre: nombreZona(zona.nombre) }))
      )
      if (!residentes.some(residente => residente.id === residenteId)) return
      setNotice('')
      setDialogo({ modo, zonaNombre: fila.nombre, esBogota: fila.tipo === 'bogota', residentes, residenteInicial: residenteId })
    },
    [linea]
  )

  const contexto: ContextoFila = {
    linea,
    lineas: data?.lineas ?? [],
    acceso,
    onVerDatos: zona => setDatosDe(zona),
    onDar: (fila, residenteId) => abrirDialogo('dar', fila, residenteId),
    onQuitar: (fila, residenteId) => abrirDialogo('quitar', fila, residenteId),
  }

  const handleGuardado = async (mensaje: string) => {
    setDialogo(null)
    setNotice(mensaje)
    await recargar()
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center" role="status">
          <svg className="animate-spin h-12 w-12 text-gray-700 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Cargando zonas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white">Zonas</h1>
            <p className="text-gray-300 mt-2">Ciudades base, qué cubre cada una y quién la atiende en tu línea</p>
          </div>
          {selectedCode && (
            <Link
              href={`/map?line=${encodeURIComponent(selectedCode)}`}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all duration-200 shadow-md font-medium flex items-center gap-2 text-sm sm:text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Ver en el mapa
            </Link>
          )}
        </div>
      </div>

      {/* Selector de línea */}
      {data && data.lineas.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Línea de negocio">
          {data.lineas.map(line => (
            <button
              key={line.id}
              type="button"
              role="tab"
              aria-selected={line.code === selectedCode}
              onClick={() => {
                setNotice('')
                setRequestedCode(line.code)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                line.code === selectedCode ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {line.name}
            </button>
          ))}
        </div>
      ) : (
        data && (
          <p className="mb-4 text-sm text-gray-600">
            Tu usuario no tiene líneas: se muestran las Zonas y quién vive en cada una, sin estado por línea.
          </p>
        )
      )}

      <div className="space-y-3 mb-4">
        {error && <AvisoError onReintentar={() => load(requestedCode)}>{error}</AvisoError>}
        {notice && <AvisoOk>{notice}</AvisoOk>}
        {data?.cobertura.recalculada && (
          <AvisoOk>
            Cobertura actualizada ahora: la cobertura guardada no coincidía con la calculada y se volvió a guardar (sin Google). El mapa ya la refleja.
          </AvisoOk>
        )}
        {data && data.cobertura.desactualizada && !data.cobertura.recalculada && (
          <AvisoAtencion>La cobertura guardada no coincide con la calculada: lo que ves aquí es lo calculado ahora; el mapa puede ir atrasado.</AvisoAtencion>
        )}
      </div>

      {/* Chips de la línea */}
      {linea && resumen && (
        <div className="flex flex-wrap gap-2 mb-4 text-xs" aria-label={`Resumen de ${linea.name}`}>
          {ESTADOS_PLAZA.map(estado => (
            <span key={estado} className={`inline-flex items-center px-2.5 py-1 rounded-lg font-semibold border ${ESTADO_BADGE[estado]}`}>
              {ESTADO_PLAZA_PLURAL[estado]}: {resumen.porEstado[estado]}
            </span>
          ))}
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-semibold border bg-white text-gray-700 border-gray-300 border-dashed">
            Sin equipo: {resumen.sinEquipo}
          </span>
        </div>
      )}

      {/* Búsqueda */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
        <label className="relative block">
          <span className="sr-only">Buscar Zona</span>
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input
            type="search"
            placeholder="Buscar por Zona, ciudad base, departamento o quien vive en ella..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </label>
      </div>

      {data && filasVisibles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100">
          <h3 className="text-sm font-medium text-gray-900">No se encontraron Zonas</h3>
          <p className="mt-1 text-sm text-gray-500">{busqueda ? 'Intenta con otros términos de búsqueda' : 'No hay Zonas activas'}</p>
        </div>
      ) : (
        <>
          {/* Tabla en escritorio */}
          <div className={`hidden lg:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden ${loading ? 'opacity-60' : ''}`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  {/* Anchos: "Vive aquí" holgada (nombres, qué puede tener y el interruptor) y "En la línea" más angosta (dueño, 2026-10-23) */}
                  <Th ancho="w-[14%]">Zona</Th>
                  <Th ancho="w-[23%]">Qué hay</Th>
                  <Th ancho={linea ? 'w-[28%]' : 'w-[40%]'}>Vive aquí</Th>
                  {linea && <Th ancho="w-[23%]">En {linea.name}</Th>}
                  <Th ancho="w-[12%]">Acciones</Th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filasVisibles.map(fila =>
                  fila.tipo === 'zona' ? (
                    <FilaZona key={fila.clave} zona={fila.zona} ctx={contexto} />
                  ) : (
                    <FilaBogota key={fila.clave} fila={fila} abierta={bogotaAbierta} onToggle={() => setBogotaAbierta(value => !value)} ctx={contexto} />
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en el celular */}
          <div className={`lg:hidden space-y-4 ${loading ? 'opacity-60' : ''}`}>
            {filasVisibles.map(fila =>
              fila.tipo === 'zona' ? (
                <TarjetaZona key={fila.clave} zona={fila.zona} ctx={contexto} />
              ) : (
                <TarjetaBogota key={fila.clave} fila={fila} abierta={bogotaAbierta} onToggle={() => setBogotaAbierta(value => !value)} ctx={contexto} />
              )
            )}
          </div>
        </>
      )}

      {/* Pie: fuentes, cortes y notas */}
      {data && (
        <div className="mt-6 text-xs text-gray-500 space-y-2">
          <p>
            Cobertura calculada el {fechaEs(data.cobertura.calculadaEn)}
            {data.cobertura.recalculada ? ' (actualizada ahora)' : ''}
            {linea ? ` · ${linea.name}: alcance hasta ${linea.max_reach_minutes} minutos de ciudad base a ciudad base` : ''}.
          </p>
          {data.notas.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {data.notas.map(nota => (
                <li key={nota}>{nota}</li>
              ))}
            </ul>
          )}
          <p className="font-medium text-gray-600">Nada de esta pantalla calcula rutas ni consulta Google.</p>
        </div>
      )}

      {/* Administración de Zonas: plegada y solo con permiso */}
      {hayAdministracion && (
        <details
          className="mt-8 bg-white rounded-2xl shadow-md border border-gray-100"
          onToggle={event => setAdminAbierta((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-bold text-gray-800 select-none">
            Administración de Zonas
            <span className="ml-2 text-xs font-normal text-gray-500">
              {[puedeAdministrar && 'agregar, colores, editar y desactivar', puedeBogota && 'Bogotá hacia afuera', veContratos && 'valor de contratos']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </summary>
          {adminAbierta && (
            <div className="px-6 pb-6">
              <AdministracionZonas editar={puedeAdministrar} bogota={puedeBogota} contratos={veContratos} onCambio={recargar} />
            </div>
          )}
        </details>
      )}

      {datosDe && (
        <ZonaDatosModal zona={{ kam_id: datosDe.kam_id, nombre: nombreZona(datosDe.nombre), ciudad_base: datosDe.ciudad_base }} onCerrar={() => setDatosDe(null)} />
      )}

      {dialogo && linea && (
        <AsignarLineaDialog
          modo={dialogo.modo}
          linea={linea}
          lineas={data?.lineas ?? []}
          zonaNombre={dialogo.zonaNombre}
          esBogota={dialogo.esBogota}
          residentes={dialogo.residentes}
          residenteInicial={dialogo.residenteInicial}
          onCerrar={() => setDialogo(null)}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Celdas comunes (tabla y tarjetas)
// ---------------------------------------------------------------------------

function Th({ children, ancho }: { children: React.ReactNode; ancho?: string }) {
  return (
    <th className={`px-4 py-4 text-left ${ancho ?? ''}`}>
      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{children}</span>
    </th>
  )
}

function NombreZona({ zona }: { zona: ZonaFila }) {
  const nombre = nombreZona(zona.nombre)
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="mt-1 w-3 h-3 rounded-full shrink-0 border border-gray-300" style={{ backgroundColor: zona.color ?? '#9ca3af' }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 break-words">{nombre}</p>
        <p className="text-xs text-gray-500 break-words">
          {zona.ciudad_base && zona.ciudad_base !== nombre ? `Ciudad base: ${zona.ciudad_base}` : null}
          {zona.ciudad_base && zona.ciudad_base !== nombre && zona.departamento ? ' · ' : null}
          {zona.departamento ?? (!zona.ciudad_base || zona.ciudad_base === nombre ? 'Ciudad base' : null)}
        </p>
      </div>
    </div>
  )
}

function QueHay({ cifras }: { cifras: ZonaCifras }) {
  const r = resumenCifras(cifras)
  return (
    <div className="space-y-1 text-sm text-gray-700 min-w-0">
      <p className="font-medium text-gray-900">{r.ips}</p>
      <p>
        {r.municipios} <span className="text-gray-500">· {r.municipiosDetalle}</span>
      </p>
      <p>
        {r.poblacion ? (
          <>
            {r.poblacion} <span className="text-gray-500">({r.poblacionFuente})</span>
          </>
        ) : (
          <span className="text-gray-400">Población: sin datos</span>
        )}
      </p>
      <p>
        {r.afiliados ? (
          <>
            {r.afiliados} <span className="text-gray-500">({r.afiliadosFuente})</span>
          </>
        ) : (
          <span className="text-gray-400">Afiliados: sin datos</span>
        )}
      </p>
      <p>
        {r.giros ? (
          <>
            Giros 12 m: <strong className="text-gray-900 tabular-nums">{r.giros}</strong> <span className="text-gray-500">({r.girosFuente})</span>
          </>
        ) : (
          <span className="text-gray-400">Giros ADRES: sin datos</span>
        )}
      </p>
      {r.departamentos.length > 0 && <p className="text-xs text-gray-500 break-words">{r.departamentos.join(', ')}</p>}
    </div>
  )
}

/**
 * Quién vive en la Zona, con sus líneas (solo las que el usuario ve) y, si puede asignar en la línea elegida, la acción
 * junto a cada nombre: "Quitarle" a quien la lleva, "Darle <línea>" a quien no (deshabilitado con el motivo si la
 * dirección lo limitó a otras líneas). Una sola acción por persona: no hay dos botones a nivel de Zona.
 */
function ViveAqui({ residentes, fila, ctx }: { residentes: Array<ZonaResidente & { zonaNombre?: string }>; fila: FilaZonas; ctx: ContextoFila }) {
  const { linea, lineas, acceso } = ctx
  const lineaCode = linea?.code ?? null
  if (residentes.length === 0) return <span className="text-sm text-gray-400">Nadie vive aquí</span>
  return (
    <ul className="space-y-2.5">
      {residentes.map(residente => {
        const puedeTener = textoPuedeTener(residente, lineas)
        const limitada = residente.lineasPermitidas !== null
        const llevaLaLinea = linea ? puedeQuitar(residente, linea.code) : false
        const motivoDar = linea && !llevaLaLinea ? motivoNoPuedeDar(residente, linea, lineas) : null
        // Con una sola línea visible, el interruptor ya dice si la lleva: los chips solo aportan cuando se ven varias.
        const mostrarChips = !linea || lineas.length > 1
        return (
          <li key={residente.id} className="text-sm min-w-0">
            <p className="font-medium text-gray-900 break-words">
              {residente.nombre}
              {residente.status === 'placeholder' && <span className="ml-1 text-xs font-normal text-amber-700">(por contratar)</span>}
              {residente.zonaNombre && <span className="ml-1 text-xs font-normal text-gray-500">· vive en {residente.zonaNombre}</span>}
            </p>
            {limitada && <p className="mt-0.5 text-xs text-amber-700 break-words">{puedeTener}</p>}
            {mostrarChips && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {residente.lineas.length === 0 ? (
                  <span className="text-xs text-gray-400">{lineaCode ? `No lleva ${nombreLinea(lineaCode, lineas)}` : 'Sin líneas'}</span>
                ) : (
                  <>
                    <span className="text-xs text-gray-500">Lleva:</span>
                    {residente.lineas.map(code => (
                      <span
                        key={code}
                        className={`px-2 py-0.5 rounded-full text-xs border ${
                          code === lineaCode ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {nombreLinea(code, lineas)}
                      </span>
                    ))}
                  </>
                )}
              </div>
            )}
            {linea && acceso.asignar && (
              <div className="mt-1.5">
                {!llevaLaLinea && motivoDar ? (
                  // La dirección la limitó a otras líneas: a esta líder no le sale el interruptor (dueño, 2026-10-23:
                  // "Paola no debería salirle a Estefanía como de Medicina deportiva")
                  <p className="text-xs text-gray-500 break-words">No puede tener {linea.name}.</p>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={llevaLaLinea}
                    aria-label={`${residente.nombre}: ${linea.name}`}
                    title={llevaLaLinea ? `Quitarle ${linea.name}` : `Darle ${linea.name}`}
                    onClick={() => (llevaLaLinea ? ctx.onQuitar(fila, residente.id) : ctx.onDar(fila, residente.id))}
                    className={`inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition-colors ${
                      llevaLaLinea ? 'bg-gray-900 border-gray-900 text-white hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span aria-hidden="true" className={`relative inline-block h-4 w-7 shrink-0 rounded-full transition-colors ${llevaLaLinea ? 'bg-green-400' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${llevaLaLinea ? 'left-3.5' : 'left-0.5'}`} />
                    </span>
                    {linea.name}: {llevaLaLinea ? 'Sí' : 'No'}
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** El estado de la Zona en la línea elegida, en lenguaje llano, y qué puede hacer la líder si nadie de aquí la atiende. */
function EnLinea({ zona, ctx }: { zona: ZonaFila; ctx: ContextoFila }) {
  const enLinea = zona.enLinea
  if (!enLinea) return <span className="text-sm text-gray-400">—</span>
  const { titulo, detalle } = textoEstado(enLinea, ctx.linea)
  const sugerencia = ctx.linea && ctx.acceso.asignar ? sugerenciaCobertura(zona, ctx.linea, ctx.lineas) : null
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${ESTADO_BADGE[enLinea.estado]}`}>{titulo}</span>
        {enLinea.sinEquipo && <span className={CLASE_SIN_EQUIPO}>Sin equipo</span>}
      </div>
      {detalle && <p className="text-sm text-gray-700 break-words">{detalle}</p>}
      {enLinea.ajuste && <p className="text-xs text-purple-700 break-words">Ajuste manual: {enLinea.ajuste.motivo}</p>}
      {enLinea.nota && enLinea.estado !== 'conflicto' && <p className="text-xs text-gray-500 break-words">{enLinea.nota}</p>}
      {sugerencia && <p className="text-xs text-gray-600 break-words">{sugerencia}</p>}
    </div>
  )
}

/** Estados de las celdas de Bogotá en una línea, como chips pequeños. */
function EstadosBogota({ celdas }: { celdas: ZonaFila[] }) {
  const resumen = resumenEstados(celdas)
  if (resumen.conLinea === 0) return <span className="text-sm text-gray-400">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {ESTADOS_PLAZA.filter(estado => resumen.porEstado[estado] > 0).map(estado => (
        <span key={estado} className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${ESTADO_BADGE[estado]}`}>
          {ESTADO_PLAZA_PLURAL[estado]}: {resumen.porEstado[estado]}
        </span>
      ))}
      {resumen.sinEquipo > 0 && <span className={CLASE_SIN_EQUIPO}>Sin equipo: {resumen.sinEquipo}</span>}
    </div>
  )
}

/** Acciones de la Zona: "Ver datos" y el enlace al ajuste manual. Dar o quitar la línea va junto a cada persona (ViveAqui). */
function Acciones({ fila, ctx }: { fila: FilaZonas; ctx: ContextoFila }) {
  const { linea, acceso } = ctx
  const ajusteActivo = fila.tipo === 'zona' ? fila.zona.enLinea?.ajuste ?? null : null
  return (
    <div className="flex flex-wrap lg:flex-col items-stretch gap-1.5">
      {fila.tipo === 'zona' && (
        <button type="button" onClick={() => ctx.onVerDatos(fila.zona)} className={claseBotonChico}>
          Ver datos
        </button>
      )}
      {linea && acceso.ajustar && fila.tipo === 'zona' && (
        <Link
          href={`/lines?line=${encodeURIComponent(linea.code)}`}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 text-center"
          title="El ajuste manual (forzar a alguien de otra ciudad o quitar el ajuste) se hace en Líneas, en la cobertura de esta línea"
        >
          {ajusteActivo ? 'Quitar ajuste (en Líneas)' : 'Forzar a alguien de otra ciudad… (en Líneas)'}
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filas de la tabla (escritorio)
// ---------------------------------------------------------------------------

function FilaZona({ zona, ctx, celda = false }: { zona: ZonaFila; ctx: ContextoFila; celda?: boolean }) {
  return (
    <tr className={`align-top transition-colors ${celda ? 'bg-gray-50/70 hover:bg-gray-100/70' : 'hover:bg-gray-50'}`}>
      <td className={`px-4 py-4 ${celda ? 'pl-12' : ''}`}>
        <NombreZona zona={zona} />
      </td>
      <td className="px-4 py-4">
        <QueHay cifras={zona.cifras} />
      </td>
      <td className="px-4 py-4">
        <ViveAqui residentes={zona.residentes} fila={filaDeZona(zona)} ctx={ctx} />
      </td>
      {ctx.linea && (
        <td className="px-4 py-4">
          <EnLinea zona={zona} ctx={ctx} />
        </td>
      )}
      <td className="px-4 py-4">
        <Acciones fila={filaDeZona(zona)} ctx={ctx} />
      </td>
    </tr>
  )
}

function FilaBogota({
  fila,
  abierta,
  onToggle,
  ctx,
}: {
  fila: Extract<FilaZonas, { tipo: 'bogota' }>
  abierta: boolean
  onToggle: () => void
  ctx: ContextoFila
}) {
  const residentes = fila.celdas.flatMap(celda => celda.residentes.map(residente => ({ ...residente, zonaNombre: nombreZona(celda.nombre) })))
  return (
    <>
      <tr className="align-top bg-gray-50">
        <td className="px-4 py-4">
          <button type="button" onClick={onToggle} aria-expanded={abierta} className="flex items-start gap-2 text-left min-w-0">
            <svg className={`mt-1 w-4 h-4 shrink-0 text-gray-500 transition-transform ${abierta ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900">{fila.nombre}</span>
              <span className="block text-xs text-gray-500">Hacia afuera compite como una ciudad; dentro, {fila.celdas.length} celdas</span>
            </span>
          </button>
        </td>
        <td className="px-4 py-4">
          <QueHay cifras={fila.cifras} />
        </td>
        <td className="px-4 py-4">
          <ViveAqui residentes={residentes} fila={fila} ctx={ctx} />
        </td>
        {ctx.linea && (
          <td className="px-4 py-4">
            <EstadosBogota celdas={fila.celdas} />
          </td>
        )}
        <td className="px-4 py-4">
          <div className="flex flex-col items-stretch gap-1.5">
            <button type="button" onClick={onToggle} aria-expanded={abierta} className={claseBotonChico}>
              {abierta ? 'Ocultar las celdas' : `Ver las ${fila.celdas.length} zonas`}
            </button>
            <Acciones fila={fila} ctx={ctx} />
          </div>
        </td>
      </tr>
      {abierta && fila.celdas.map(celda => <FilaZona key={celda.kam_id} zona={celda} ctx={ctx} celda />)}
    </>
  )
}

// ---------------------------------------------------------------------------
// Tarjetas (celular, 390 px)
// ---------------------------------------------------------------------------

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{titulo}</p>
      {children}
    </div>
  )
}

function TarjetaZona({ zona, ctx, celda = false }: { zona: ZonaFila; ctx: ContextoFila; celda?: boolean }) {
  return (
    <div className={`bg-white rounded-xl shadow-md border border-gray-100 p-4 min-w-0 ${celda ? 'ml-4 border-l-4 border-l-gray-300' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <NombreZona zona={zona} />
        {ctx.linea && zona.enLinea && (
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${ESTADO_BADGE[zona.enLinea.estado]}`}>
            {textoEstado(zona.enLinea).titulo}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-3">
        <Seccion titulo="Qué hay">
          <QueHay cifras={zona.cifras} />
        </Seccion>
        <Seccion titulo="Vive aquí">
          <ViveAqui residentes={zona.residentes} fila={filaDeZona(zona)} ctx={ctx} />
        </Seccion>
        {ctx.linea && (
          <Seccion titulo={`En ${ctx.linea.name}`}>
            <EnLinea zona={zona} ctx={ctx} />
          </Seccion>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <Acciones fila={filaDeZona(zona)} ctx={ctx} />
      </div>
    </div>
  )
}

function TarjetaBogota({
  fila,
  abierta,
  onToggle,
  ctx,
}: {
  fila: Extract<FilaZonas, { tipo: 'bogota' }>
  abierta: boolean
  onToggle: () => void
  ctx: ContextoFila
}) {
  const residentes = fila.celdas.flatMap(celda => celda.residentes.map(residente => ({ ...residente, zonaNombre: nombreZona(celda.nombre) })))
  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-xl shadow-md border border-gray-200 p-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{fila.nombre}</p>
            <p className="text-xs text-gray-500">Hacia afuera compite como una ciudad; dentro, {fila.celdas.length} celdas</p>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <Seccion titulo="Qué hay">
            <QueHay cifras={fila.cifras} />
          </Seccion>
          <Seccion titulo="Vive aquí">
            <ViveAqui residentes={residentes} fila={fila} ctx={ctx} />
          </Seccion>
          {ctx.linea && (
            <Seccion titulo={`En ${ctx.linea.name}`}>
              <EstadosBogota celdas={fila.celdas} />
            </Seccion>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-1.5">
          <button type="button" onClick={onToggle} aria-expanded={abierta} className={claseBotonChico}>
            {abierta ? 'Ocultar las celdas' : `Ver las ${fila.celdas.length} zonas`}
          </button>
          <Acciones fila={fila} ctx={ctx} />
        </div>
      </div>
      {abierta && fila.celdas.map(celda => <TarjetaZona key={celda.kam_id} zona={celda} ctx={ctx} celda />)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Administración de Zonas (lo que antes era toda la página): agregar, colores, editar, desactivar, Bogotá, contratos.
// Solo se monta cuando se abre el plegable y el rol tiene permiso; así nadie recibe un 403 por algo que no puede usar.
// ---------------------------------------------------------------------------

interface KamAdmin {
  id: string
  name: string
  area_id: string
  base_city?: string | null
  lat: number
  lng: number
  color: string
  active: boolean
  max_travel_time: number
  enable_level2: boolean
  priority: number
  participates_in_assignment?: boolean
}

interface KamStat {
  kam_id: string
  hospital_count: number
  municipality_count: number
  contract_value_total: number
  avg_travel_time: number | null
  area_name: string | null
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

function AdministracionZonas({ editar, bogota, contratos, onCambio }: { editar: boolean; bogota: boolean; contratos: boolean; onCambio: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [kams, setKams] = useState<KamAdmin[]>([])
  const [stats, setStats] = useState<Map<string, KamStat>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingKam, setEditingKam] = useState<KamAdmin | null>(null)
  const listar = editar || contratos

  const cargar = useCallback(async () => {
    if (!listar) {
      setCargando(false)
      return
    }
    setCargando(true)
    setError('')
    setAviso('')
    try {
      const [kamsResponse, statsResponse] = await Promise.all([
        fetch('/api/kams', { cache: 'no-store' }),
        contratos ? fetch('/api/kams/stats', { cache: 'no-store' }) : Promise.resolve(null),
      ])
      if (!kamsResponse.ok) throw new Error(await readError(kamsResponse, 'Error al cargar las zonas'))
      const lista = (await kamsResponse.json().catch(() => null)) as KamAdmin[] | null
      setKams(
        (Array.isArray(lista) ? lista : []).sort(
          (a, b) => Number(b.active) - Number(a.active) || nombreZona(a.name).localeCompare(nombreZona(b.name), 'es')
        )
      )
      if (statsResponse) {
        if (statsResponse.ok) {
          const datos = (await statsResponse.json().catch(() => null)) as KamStat[] | null
          setStats(new Map((Array.isArray(datos) ? datos : []).map(stat => [stat.kam_id, stat])))
        } else {
          setAviso(`${await readError(statsResponse, 'No se pudo cargar el valor de contratos')}. El valor de contratos puede no estar actualizado.`)
        }
      }
    } catch (err: unknown) {
      console.error('Error cargando la administración de zonas:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar las zonas')
    } finally {
      setCargando(false)
    }
  }, [listar, contratos])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['kams'] })
    router.refresh()
    void cargar()
    onCambio()
  }

  const totalContratos = kams.reduce((sum, kam) => sum + (stats.get(kam.id)?.contract_value_total || 0), 0)

  return (
    <div className="space-y-6">
      {editar && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => router.push('/kams/colors')} className={claseBotonChico}>
            Configurar colores
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-sm">
            Agregar Zona
          </button>
        </div>
      )}

      {bogota && <BogotaConfigCard />}

      {listar && (
        <>
          {error && <AvisoError onReintentar={cargar}>{error}</AvisoError>}
          {aviso && <AvisoAtencion>{aviso}</AvisoAtencion>}
          {contratos && !cargando && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 inline-block">
              <p className="text-sm font-medium text-gray-600">Valor de contratos</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(totalContratos)}</p>
            </div>
          )}
          {cargando ? (
            <p className="text-sm text-gray-500">Cargando zonas…</p>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <Th>Zona</Th>
                    <Th>Código</Th>
                    <Th>Configuración</Th>
                    <Th>Tipo</Th>
                    <Th>Estado</Th>
                    {contratos && <Th>Contratos</Th>}
                    {editar && <Th>Acciones</Th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kams.map(kam => {
                    const stat = stats.get(kam.id)
                    return (
                      <tr key={kam.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full shrink-0 border border-gray-300 ${!kam.active ? 'opacity-50' : ''}`} style={{ backgroundColor: kam.color }} aria-hidden="true" />
                            <div>
                              <p className={`font-medium ${kam.active ? 'text-gray-900' : 'text-gray-400'}`}>{nombreZona(kam.name)}</p>
                              <p className="text-xs text-gray-500">Ciudad base: {kam.base_city || stat?.area_name || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{kam.area_id}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          Máx: {kam.max_travel_time} min · {kam.enable_level2 ? 'Nivel 2 activo' : 'Solo nivel 1'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{kam.participates_in_assignment !== false ? 'Territorial' : 'Administrativo'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${kam.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {kam.active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        {contratos && <td className="px-4 py-3 text-gray-700 whitespace-nowrap tabular-nums">{formatCurrency(stat?.contract_value_total || 0)}</td>}
                        {editar && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingKam(kam)}
                                className="px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium"
                                title="Editar zona"
                              >
                                Editar
                              </button>
                              {kam.active ? (
                                <KamDeactivateButton kam={kam} onUpdate={handleUpdate} className="px-3 py-1.5 text-xs text-orange-700 hover:bg-orange-50 rounded-lg font-medium" />
                              ) : (
                                <KamActivateButton kam={kam} onUpdate={handleUpdate} className="px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 rounded-lg font-medium" />
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editar && editingKam && <EditKamModal kam={editingKam} isOpen onClose={() => setEditingKam(null)} onUpdate={handleUpdate} />}
      {editar && (
        <AddKamModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            handleUpdate()
          }}
        />
      )}
    </div>
  )
}
