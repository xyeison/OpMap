'use client'

// Sede de una cuenta: campos compartidos (también los usa la sede principal de "Nueva cuenta") y formulario
// para crear (POST /api/terceros/sedes, terceros:create) o editar (PATCH /api/terceros/sedes/[id], terceros:manage).
// Las sedes nuevas quedan con origen 'manual' y ubicación sin confirmar (lo pone la API). No entran a hospitals.
import { useState } from 'react'
import type { SedeRow } from '@/lib/terceros'
import { sedeCreateSchema, sedeUpdateSchema } from '@/lib/terceros-schemas'
import MunicipioSelector from './MunicipioSelector'
import {
  AvisoError,
  CAPA_MODAL_ENCIMA,
  Modal,
  PieFormulario,
  claseBotonChico,
  claseInput,
  claseLabel,
  leerCoordenada,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  primerErrorZod,
  textoONada,
} from './comun'

export interface ValoresSede {
  nombre: string
  municipio: string | null
  ciudad: string | null
  direccion: string
  repsCode: string
  lat: string
  lng: string
}

export const SEDE_VACIA: ValoresSede = {
  nombre: '',
  municipio: null,
  ciudad: null,
  direccion: '',
  repsCode: '',
  lat: '',
  lng: '',
}

/** Cuerpo JSON de la sede (sin cuenta_id). Vacíos → no se envían; coordenadas como número. */
export function cuerpoSede(valores: ValoresSede) {
  const lat = leerCoordenada(valores.lat)
  const lng = leerCoordenada(valores.lng)
  return {
    nombre: textoONada(valores.nombre),
    municipality_id: valores.municipio ?? undefined,
    ciudad: valores.ciudad ?? undefined,
    direccion: textoONada(valores.direccion),
    reps_code: textoONada(valores.repsCode),
    lat: lat === null ? undefined : lat,
    lng: lng === null ? undefined : lng,
  }
}

interface CamposSedeProps {
  valores: ValoresSede
  onCambiar: (valores: ValoresSede) => void
  /** En la sede principal el nombre es opcional (sin nombre → el de la cuenta). */
  nombreOpcional?: boolean
  placeholderNombre?: string
  disabled?: boolean
}

export function CamposSede({ valores, onCambiar, nombreOpcional = false, placeholderNombre, disabled = false }: CamposSedeProps) {
  const [gpsEstado, setGpsEstado] = useState('')
  const cambiar = (parcial: Partial<ValoresSede>) => onCambiar({ ...valores, ...parcial })

  const usarGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsEstado('Este navegador no permite usar la ubicación')
      return
    }
    setGpsEstado('Buscando tu ubicación...')
    navigator.geolocation.getCurrentPosition(
      posicion => {
        cambiar({
          lat: posicion.coords.latitude.toFixed(6),
          lng: posicion.coords.longitude.toFixed(6),
        })
        setGpsEstado(`Ubicación tomada (precisión de unos ${Math.round(posicion.coords.accuracy)} m)`)
      },
      error => {
        setGpsEstado(
          error.code === error.PERMISSION_DENIED
            ? 'No diste permiso para usar la ubicación'
            : 'No se pudo obtener la ubicación; escríbela a mano o inténtalo de nuevo'
        )
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className={claseLabel}>
          Nombre de la sede {!nombreOpcional && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={valores.nombre}
          disabled={disabled}
          onChange={e => cambiar({ nombre: e.target.value })}
          placeholder={placeholderNombre}
          className={claseInput}
          maxLength={200}
        />
        {nombreOpcional && <p className="mt-1 text-xs text-gray-500">Si lo dejas vacío, la sede toma el nombre de la cuenta.</p>}
      </div>
      <div className="sm:col-span-2">
        <MunicipioSelector
          valor={valores.municipio}
          onCambiar={(codigo, nombre) => cambiar({ municipio: codigo, ciudad: nombre })}
          etiqueta="Municipio de la sede"
          requerido
          disabled={disabled}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={claseLabel}>Dirección</label>
        <input
          type="text"
          value={valores.direccion}
          disabled={disabled}
          onChange={e => cambiar({ direccion: e.target.value })}
          className={claseInput}
          maxLength={300}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={claseLabel}>Código de habilitación del REPS</label>
        <input
          type="text"
          inputMode="numeric"
          value={valores.repsCode}
          disabled={disabled}
          onChange={e => cambiar({ repsCode: e.target.value })}
          placeholder="12 dígitos, si la sede es IPS"
          className={claseInput}
          maxLength={20}
        />
      </div>
      <div className="sm:col-span-2 rounded-xl border border-gray-200 p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">Ubicación (opcional)</span>
          <button type="button" onClick={usarGps} disabled={disabled} className={claseBotonChico}>
            Usar mi ubicación actual
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={valores.lat}
            disabled={disabled}
            onChange={e => cambiar({ lat: e.target.value })}
            placeholder="Latitud (ej. 4.711000)"
            className={claseInput}
            aria-label="Latitud"
          />
          <input
            type="text"
            inputMode="decimal"
            value={valores.lng}
            disabled={disabled}
            onChange={e => cambiar({ lng: e.target.value })}
            placeholder="Longitud (ej. -74.072000)"
            className={claseInput}
            aria-label="Longitud"
          />
        </div>
        <p className="text-xs text-gray-500">
          {gpsEstado ||
            'Úsala solo si estás en la sede o tienes las coordenadas exactas. Quien administra terceros la confirma después.'}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Formulario de sede (crear o editar)
// ---------------------------------------------------------------------------------------------

type SedeFormProps =
  | {
      modo: 'crear'
      cuentaId: string
      cuentaNombre: string
      onCerrar: () => void
      onGuardada: (mensaje: string) => void
    }
  | {
      modo: 'editar'
      sede: SedeRow
      cuentaNombre: string
      onCerrar: () => void
      onGuardada: (mensaje: string) => void
    }

function valoresDeSede(sede: SedeRow): ValoresSede {
  return {
    nombre: sede.nombre,
    municipio: sede.municipality_id,
    ciudad: sede.ciudad,
    direccion: sede.direccion ?? '',
    repsCode: sede.reps_code ?? '',
    lat: sede.lat === null || sede.lat === undefined ? '' : String(sede.lat),
    lng: sede.lng === null || sede.lng === undefined ? '' : String(sede.lng),
  }
}

export default function SedeForm(props: SedeFormProps) {
  const inicial = props.modo === 'editar' ? valoresDeSede(props.sede) : SEDE_VACIA
  const [valores, setValores] = useState<ValoresSede>(inicial)
  const [activo, setActivo] = useState(props.modo === 'editar' ? props.sede.activo : true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const base = cuerpoSede(valores)

    if (props.modo === 'crear') {
      const cuerpo = { cuenta_id: props.cuentaId, ...base }
      const validado = sedeCreateSchema.safeParse(cuerpo)
      if (!validado.success) {
        setError(primerErrorZod(validado.error))
        return
      }
      setGuardando(true)
      try {
        const respuesta = await pedirJson('/api/terceros/sedes', { method: 'POST', json: cuerpo })
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo crear la sede'))
        props.onGuardada(`Se creó la sede ${validado.data.nombre}.`)
      } catch (err) {
        setError(mensajeExcepcion(err, 'No se pudo crear la sede'))
        setGuardando(false)
      }
      return
    }

    // Editar: solo lo que cambió (vaciar un campo opcional lo borra: null).
    const sede = props.sede
    const cambios: Record<string, unknown> = {}
    const nombre = valores.nombre.trim().replace(/\s+/g, ' ')
    if (nombre !== sede.nombre) cambios.nombre = nombre
    if (!valores.municipio) {
      setError('Elige el municipio de la sede')
      return
    }
    if (valores.municipio !== sede.municipality_id) {
      cambios.municipality_id = valores.municipio
      cambios.ciudad = valores.ciudad
    }
    const direccion = valores.direccion.trim()
    if (direccion !== (sede.direccion ?? '')) cambios.direccion = direccion || null
    const reps = valores.repsCode.trim()
    if (reps !== (sede.reps_code ?? '')) cambios.reps_code = reps || null
    const lat = leerCoordenada(valores.lat)
    const lng = leerCoordenada(valores.lng)
    const latAntes = sede.lat === null || sede.lat === undefined ? null : Number(sede.lat)
    const lngAntes = sede.lng === null || sede.lng === undefined ? null : Number(sede.lng)
    if (lat !== latAntes || lng !== lngAntes) {
      cambios.lat = lat
      cambios.lng = lng
    }
    if (activo !== sede.activo) cambios.activo = activo
    if (Object.keys(cambios).length === 0) {
      setError('No hay cambios para guardar')
      return
    }
    const validado = sedeUpdateSchema.safeParse(cambios)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson(`/api/terceros/sedes/${sede.id}`, { method: 'PATCH', json: cambios })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo guardar la sede'))
      props.onGuardada(`Se guardaron los cambios de la sede ${nombre || sede.nombre}.`)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo guardar la sede'))
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={props.modo === 'crear' ? 'Nueva sede' : 'Editar sede'}
      subtitulo={props.cuentaNombre}
      onCerrar={props.onCerrar}
      capa={CAPA_MODAL_ENCIMA}
    >
      <form onSubmit={guardar}>
        <div className="p-4 sm:p-6 space-y-4">
          {error && <AvisoError>{error}</AvisoError>}
          <CamposSede valores={valores} onCambiar={setValores} disabled={guardando} />
          {props.modo === 'editar' && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} disabled={guardando} />
              Sede activa
            </label>
          )}
        </div>
        <PieFormulario
          onCancelar={props.onCerrar}
          guardando={guardando}
          textoGuardar={props.modo === 'crear' ? 'Crear sede' : 'Guardar'}
        />
      </form>
    </Modal>
  )
}
