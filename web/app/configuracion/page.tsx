'use client'

// Configuración (/configuracion): secciones Visitas, Municipios y Asignación, cada una con su permiso
// (seccionesConfiguracion en lib/permissions.ts); quien tiene una sola la ve sin barra de secciones. La sección va
// en ?seccion= para poder volver a ella (la ficha de un municipio vuelve a ?seccion=municipios).
// - Visitas (visits:config, Fase 7 · F2): pestañas Metas, Qué cuenta, Personas, General y Subtipos. Todo valor es
//   una línea de tiempo (vigente_desde / vigente_hasta): cambiar no edita el anterior, lo corta y abre uno nuevo, y
//   la vista previa dice qué se corta, anula o continúa y qué meses se recalculan antes de guardar. Datos:
//   GET /api/config-visitas. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md ("API" e "Interfaz").
// - Municipios (territories:view): la lista de /territories (dueño, 2026-10-14: sale del menú principal).
// - Asignación (dashboard:view y recalculate:simple o recalculate:complete, como en el antiguo dashboard): "Recalcular asignaciones" y, con recalculate:complete,
//   "Calcular rutas" con Google Maps; vivían en el dashboard de "/", que se quitó. Nada se ejecuta al abrir la página.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import RecalculateUnified from '@/components/RecalculateUnified'
import RouteCalculator from '@/components/RouteCalculator'
import MunicipiosLista from '@/components/territories/MunicipiosLista'
import { AvisoError, AvisoOk, Cargando, mensajeError, mensajeExcepcion, pedirJson } from '@/components/terceros/comun'
import { AccesoDenegado, Encabezado, Pestanas, conMayuscula, fechaLarga } from '@/components/visitas/comun'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISOS_CONFIGURACION, seccionesConfiguracion, type SeccionConfiguracion } from '@/lib/permissions'
import ConteoTab from '@/components/visitas/configuracion/ConteoTab'
import GeneralTab from '@/components/visitas/configuracion/GeneralTab'
import MetasTab from '@/components/visitas/configuracion/MetasTab'
import PersonasTab from '@/components/visitas/configuracion/PersonasTab'
import SubtiposTab from '@/components/visitas/configuracion/SubtiposTab'
import type { ConfigVisitasResponse } from '@/lib/visits-rules'

type Pestana = 'metas' | 'conteo' | 'personas' | 'general' | 'subtipos'

const PESTANAS: { clave: Pestana; etiqueta: string }[] = [
  { clave: 'metas', etiqueta: 'Metas' },
  { clave: 'conteo', etiqueta: 'Qué cuenta' },
  { clave: 'personas', etiqueta: 'Personas' },
  { clave: 'general', etiqueta: 'General' },
  { clave: 'subtipos', etiqueta: 'Subtipos' },
]

const SECCIONES: Record<SeccionConfiguracion, { etiqueta: string; descripcion: string }> = {
  visitas: {
    etiqueta: 'Visitas',
    descripcion: 'Metas, qué cuenta, personas, parámetros y subtipos de las visitas, cada uno con su vigencia.',
  },
  municipios: {
    etiqueta: 'Municipios',
    descripcion: 'Municipios y localidades con sus IPS, la Zona asignada y las asignaciones forzadas.',
  },
  asignacion: {
    etiqueta: 'Asignación',
    descripcion: 'Recalcular la asignación de las IPS a las Zonas y calcular las rutas que faltan.',
  },
}

export default function ConfiguracionPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permissions={[...PERMISOS_CONFIGURACION]}
        fallback={<AccesoDenegado>No tienes permisos para ver la configuración.</AccesoDenegado>}
      >
        {/* useSearchParams exige un límite <Suspense> en las páginas que se prerenderizan */}
        <Suspense fallback={<Cargando texto="Cargando la configuración..." />}>
          <Configuracion />
        </Suspense>
      </PermissionGuard>
    </ProtectedRoute>
  )
}

function Configuracion() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, can } = usePermissions()
  const secciones = seccionesConfiguracion(role)
  const pedida = searchParams.get('seccion')
  const seccion = secciones.find(s => s === pedida) ?? secciones[0]

  if (!seccion) return null

  const cambiar = (nueva: SeccionConfiguracion) => {
    router.replace(nueva === secciones[0] ? '/configuracion' : `/configuracion?seccion=${nueva}`, { scroll: false })
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
      <Encabezado titulo="Configuración" descripcion={SECCIONES[seccion].descripcion} />

      {secciones.length > 1 && (
        <div className="mb-5 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-1 min-w-max border-b border-gray-200" role="tablist" aria-label="Secciones de la configuración">
            {secciones.map(s => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === seccion}
                onClick={() => cambiar(s)}
                className={`-mb-px px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  s === seccion
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {SECCIONES[s].etiqueta}
              </button>
            ))}
          </div>
        </div>
      )}

      {seccion === 'visitas' && <ConfiguracionVisitas />}
      {seccion === 'municipios' && <MunicipiosLista embebido />}
      {seccion === 'asignacion' && (
        <div id="recalcular" className="space-y-4 scroll-mt-24">
          <RecalculateUnified />
          {/* Cálculo de rutas con Google Maps: solo con recalculate:complete (como en el antiguo dashboard) */}
          {can('recalculate:complete') && <RouteCalculator />}
        </div>
      )}
    </div>
  )
}

/** Lista de los arreglos de la respuesta (vacíos si no vienen), para que una respuesta incompleta no rompa la página. */
function normalizar(data: unknown): ConfigVisitasResponse | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Partial<ConfigVisitasResponse>
  if (typeof d.hoy !== 'string') return null
  const lista = <T,>(valor: T[] | undefined): T[] => (Array.isArray(valor) ? valor : [])
  return {
    hoy: d.hoy,
    metas: lista(d.metas),
    conteo: lista(d.conteo),
    general: lista(d.general),
    personas: lista(d.personas),
    subtipos: lista(d.subtipos),
    zonas: lista(d.zonas),
    ejecutivas: lista(d.ejecutivas),
  }
}

function ConfiguracionVisitas() {
  const [pestana, setPestana] = useState<Pestana>('metas')
  const [datos, setDatos] = useState<ConfigVisitasResponse | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [version, setVersion] = useState(0)
  const turno = useRef(0)

  useEffect(() => {
    const miTurno = ++turno.current
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const respuesta = await pedirJson('/api/config-visitas')
        if (miTurno !== turno.current) return
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo cargar la configuración'))
        const normalizados = normalizar(respuesta.data)
        if (!normalizados) throw new Error('La configuración llegó incompleta. Recarga la página.')
        setDatos(normalizados)
      } catch (err) {
        if (miTurno !== turno.current) return
        setError(mensajeExcepcion(err, 'No se pudo cargar la configuración'))
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    }
    cargar()
  }, [version])

  const onCambio = useCallback((mensaje: string) => {
    setAviso(mensaje)
    setVersion(v => v + 1)
  }, [])

  return (
    <div className="min-w-0">
      <Pestanas
        pestanas={PESTANAS}
        activa={pestana}
        onCambiar={clave => {
          setPestana(clave)
          setAviso('')
        }}
        etiqueta="Configuración de visitas"
      />

      {aviso && (
        <div className="mb-4">
          <AvisoOk>{aviso}</AvisoOk>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <AvisoError onReintentar={() => setVersion(v => v + 1)}>{error}</AvisoError>
        </div>
      )}

      {!datos ? (
        cargando ? <Cargando texto="Cargando la configuración..." /> : null
      ) : (
        <div className={cargando ? 'opacity-60 transition-opacity' : ''}>
          {pestana === 'metas' && <MetasTab datos={datos} onCambio={onCambio} />}
          {pestana === 'conteo' && <ConteoTab datos={datos} onCambio={onCambio} />}
          {pestana === 'personas' && <PersonasTab datos={datos} onCambio={onCambio} />}
          {pestana === 'general' && <GeneralTab datos={datos} onCambio={onCambio} />}
          {pestana === 'subtipos' && <SubtiposTab datos={datos} onCambio={onCambio} />}
          <p className="mt-6 text-xs text-gray-500">
            {conMayuscula(fechaLarga(datos.hoy))} (hora de Colombia). Nada de esta sección recalcula rutas ni llama a Google.
          </p>
        </div>
      )}
    </div>
  )
}
