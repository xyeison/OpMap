'use client'

// Fase 7 · F2 Configuración de visitas (/configuracion, permiso visits:config): pestañas Metas, Qué cuenta,
// Personas, General y Subtipos. Todo valor es una línea de tiempo (vigente_desde / vigente_hasta): cambiar no
// edita el anterior, lo corta y abre uno nuevo, y la vista previa dice qué se corta, anula o continúa y qué
// meses se recalculan antes de guardar. Datos: GET /api/config-visitas (todas las filas, con cerradas y anuladas).
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (secciones "API" e "Interfaz").
import { useCallback, useEffect, useRef, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { AvisoError, AvisoOk, Cargando, mensajeError, mensajeExcepcion, pedirJson } from '@/components/terceros/comun'
import { AccesoDenegado, Encabezado, Pestanas, conMayuscula, fechaLarga } from '@/components/visitas/comun'
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

export default function ConfiguracionPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="visits:config"
        fallback={<AccesoDenegado>No tienes permisos para ver ni cambiar la configuración de visitas.</AccesoDenegado>}
      >
        <ConfiguracionContenido />
      </PermissionGuard>
    </ProtectedRoute>
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

function ConfiguracionContenido() {
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
      <Encabezado
        titulo="Configuración de visitas"
        descripcion={
          datos
            ? `Metas, qué cuenta, personas, parámetros y subtipos. Cada valor tiene vigencia: hoy es ${fechaLarga(datos.hoy)}.`
            : 'Metas, qué cuenta, personas, parámetros y subtipos, cada uno con su vigencia.'
        }
      />

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
            {conMayuscula(fechaLarga(datos.hoy))} (hora de Colombia). Nada de esta pantalla recalcula rutas ni llama a Google.
          </p>
        </div>
      )}
    </div>
  )
}
