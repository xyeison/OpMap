'use client'

// Fase 7 · F2 Calendario (/calendario): pestañas según permiso.
//   - Calendario (cualquiera que entre): festivos nacionales, días de empresa y de ciudad; con calendar:manage,
//     añadir, anular y cargar festivos.
//   - Días libres (daysoff:approve o daysoff:view): lista filtrable; quien aprueba lo hace en bloque y registra
//     por otra persona; el líder de línea solo ve los de sus líneas.
//   - Mis días libres (visits:report con usuario enlazado a un Ejecutivo Comercial): registrar, anular y "Mi
//     cuota del mes". Si reporta pero su usuario no está enlazado, la pestaña no sale y una nota dice por qué y
//     qué hacer (pestanasCalendario en lib/visits-rules.ts).
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (secciones "Permisos", "API" e "Interfaz").
import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISOS_CALENDARIO } from '@/lib/permissions'
import { MENSAJE_SIN_EJECUTIVA, hoyBogota, pestanasCalendario, type EnlaceEjecutiva, type PestanaCalendario } from '@/lib/visits-rules'
import { Cargando, pedirJson } from '@/components/terceros/comun'
import { AccesoDenegado, Encabezado, Pestanas, conMayuscula, fechaLarga } from '@/components/visitas/comun'
import CalendarioMesTab from '@/components/visitas/calendario/CalendarioMesTab'
import DiasLibresTab from '@/components/visitas/calendario/DiasLibresTab'
import MisDiasLibresTab from '@/components/visitas/calendario/MisDiasLibresTab'

type Pestana = PestanaCalendario

const ETIQUETAS: Record<Pestana, string> = { mis: 'Mis días libres', 'dias-libres': 'Días libres', calendario: 'Calendario' }

export default function CalendarioPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permissions={[...PERMISOS_CALENDARIO]}
        fallback={<AccesoDenegado>No tienes permisos para ver el calendario ni los días libres.</AccesoDenegado>}
      >
        <CalendarioContenido />
      </PermissionGuard>
    </ProtectedRoute>
  )
}

/** Estado del enlace del usuario con un Ejecutivo Comercial: null mientras no se sabe. */
type Enlace = EnlaceEjecutiva

function CalendarioContenido() {
  const { can } = usePermissions()
  const gestionaCalendario = can('calendar:manage')
  const apruebaDias = can('daysoff:approve')
  const veDias = apruebaDias || can('daysoff:view')
  const reporta = can('visits:report')

  const [hoy] = useState(() => hoyBogota(new Date()))
  const [enlace, setEnlace] = useState<Enlace>(reporta ? null : 'sin_ejecutiva')
  const [pestana, setPestana] = useState<Pestana>(() => (apruebaDias ? 'dias-libres' : reporta ? 'mis' : veDias ? 'dias-libres' : 'calendario'))

  // ¿El usuario está enlazado con un Ejecutivo Comercial? (sin enlace, /api/me/* responde 403)
  useEffect(() => {
    if (!reporta) return
    let vigente = true
    pedirJson(`/api/me/dias-libres?desde=${hoy}&hasta=${hoy}`)
      .then(respuesta => {
        if (!vigente) return
        setEnlace(respuesta.ok ? 'enlazado' : respuesta.status === 403 ? 'sin_ejecutiva' : 'desconocido')
      })
      .catch(() => {
        if (vigente) setEnlace('desconocido')
      })
    return () => {
      vigente = false
    }
  }, [reporta, hoy])

  const { pestanas: claves, avisoSinEjecutiva } = pestanasCalendario({ reporta, veDias, enlace })
  const muestraMis = claves.includes('mis')
  const clavesTexto = claves.join(',')
  const pestanas = useMemo(
    () => clavesTexto.split(',').map(clave => ({ clave: clave as Pestana, etiqueta: ETIQUETAS[clave as Pestana] })),
    [clavesTexto]
  )

  // Si la pestaña elegida deja de existir (usuario sin ejecutiva enlazada), pasa a la primera disponible.
  useEffect(() => {
    if (!pestanas.some(p => p.clave === pestana)) setPestana(pestanas[0].clave)
  }, [pestanas, pestana])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
      <Encabezado
        titulo="Calendario"
        descripcion={`Festivos, días de empresa y de ciudad, y días libres. Hoy es ${fechaLarga(hoy)}.`}
      />

      {avisoSinEjecutiva && (
        <p className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 break-words">
          {MENSAJE_SIN_EJECUTIVA}, así que aquí no aparece «Mis días libres». Si debes registrar tus propios días libres,
          pide a un administrador que enlace tu usuario con tu ficha en Ejecutivos Comerciales.
        </p>
      )}

      {pestanas.length > 1 && <Pestanas pestanas={pestanas} activa={pestana} onCambiar={setPestana} etiqueta="Calendario" />}

      {pestana === 'mis' && muestraMis && (enlace === null ? <Cargando /> : <MisDiasLibresTab hoy={hoy} />)}
      {pestana === 'dias-libres' && veDias && <DiasLibresTab hoy={hoy} puedeRegistrar={apruebaDias} />}
      {pestana === 'calendario' && <CalendarioMesTab hoy={hoy} puedeGestionar={gestionaCalendario} />}

      <p className="mt-6 text-xs text-gray-500">{conMayuscula(fechaLarga(hoy))} (hora de Colombia).</p>
    </div>
  )
}
