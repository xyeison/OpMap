/**
 * Nueva sede con el GPS del sitio (decisión 14 del contrato fase 8): nombre, cuenta (de las sedes cercanas o del
 * buscador), municipio, código de habilitación del REPS (opcional) y la ubicación del teléfono. POST
 * /api/terceros/sedes con origen 'gps_app': nace "por confirmar" salvo que el código del REPS cruce con el municipio
 * (entonces suma al instante); si no, suma cuando data manager la confirma. Al crearla vuelve a Reportar con la sede
 * puesta (en la tarjeta que la pidió o como sede elegida del paso 1).
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Buscador } from '../../../components/reporte/Buscador'
import { Selector } from '../../../components/reporte/Selector'
import { SelectorMunicipio } from '../../../components/reporte/SelectorMunicipio'
import * as api from '../../../lib/api'
import { ApiError, mensajeDeError } from '../../../lib/errores'
import { textoPrecision } from '../../../lib/geo'
import { SoloEnFoco } from '../../../lib/montaje'
import { avisarRetorno, leerPedido } from '../../../lib/retorno'
import { etiquetaClaseCuenta, limpiarNombre, validarRepsCode } from '../../../lib/terceros'
import type { CuentaListItem } from '../../../lib/tipos'
import { pedirUbicacion, type Ubicacion } from '../../../lib/ubicacion'
import { Aviso, Boton, Campo, Pantalla, Tarjeta, Texto } from '../../../lib/ui'

interface CuentaOpcion {
  id: string
  nombre: string
  clase: string | null
}

/** Pestaña oculta: se monta de cero cada vez que se abre (pedido, GPS y formulario nuevos). */
export default function PantallaNuevaSede() {
  return (
    <SoloEnFoco>
      <NuevaSede />
    </SoloEnFoco>
  )
}

function NuevaSede() {
  const router = useRouter()
  const [pedido] = useState(() => leerPedido())
  const cuentasCercanas: CuentaOpcion[] = []
  for (const sede of pedido?.sedes ?? []) {
    if (sede.cuenta_id && !cuentasCercanas.some(c => c.id === sede.cuenta_id)) {
      cuentasCercanas.push({ id: sede.cuenta_id, nombre: sede.cuenta_nombre ?? sede.nombre, clase: sede.cuenta_clase })
    }
  }

  const [nombre, setNombre] = useState('')
  const [cuentas, setCuentas] = useState<CuentaOpcion[]>(cuentasCercanas)
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [municipio, setMunicipio] = useState<string | null>(pedido?.municipio ? pedido.municipio.slice(0, 5) : null)
  const [reps, setReps] = useState('')
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [ubicando, setUbicando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const ubicar = async () => {
    setUbicando(true)
    const resultado = await pedirUbicacion({ timeoutMs: 12_000 })
    setUbicacion(resultado.ubicacion)
    setErrorUbicacion(resultado.error)
    setUbicando(false)
  }

  useEffect(() => {
    void ubicar()
  }, [])

  const codigo = validarRepsCode(reps)
  const cuenta = cuentas.find(c => c.id === cuentaId) ?? null

  const crear = async () => {
    const nombreLimpio = limpiarNombre(nombre)
    if (nombreLimpio.length < 2) return setError('Escribe el nombre de la sede')
    if (!cuentaId || !cuenta) return setError('Elige la cuenta de la sede')
    if (!municipio) return setError('Elige el municipio de la sede')
    if (!codigo.ok) return setError(codigo.error)
    if (!ubicacion) return setError('Hace falta la ubicación del teléfono: la sede se crea con el GPS de aquí')
    setCreando(true)
    setError(null)
    try {
      const respuesta = await api.crearSede({
        cuenta_id: cuentaId,
        nombre: nombreLimpio,
        municipality_id: municipio,
        reps_code: codigo.valor,
        origen: 'gps_app',
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        gps_accuracy_m: ubicacion.precision,
      })
      const sede = respuesta.sede
      avisarRetorno({
        tipo: 'sede',
        clave: pedido?.clave ?? null,
        sede: {
          id: sede.id,
          nombre: sede.nombre,
          cuenta_id: sede.cuenta_id,
          cuenta_nombre: cuenta.nombre,
          cuenta_clase: cuenta.clase,
          lat: sede.lat === null ? ubicacion.lat : Number(sede.lat),
          lng: sede.lng === null ? ubicacion.lng : Number(sede.lng),
          distancia_m: 0,
          ubicacion_confirmada: sede.ubicacion_confirmada,
        },
      })
      if (router.canGoBack()) router.back()
      else router.replace('/reportar')
    } catch (lanzado) {
      const existente = lanzado instanceof ApiError && lanzado.status === 409 ? (lanzado.cuerpo as { existente?: { nombre?: string } } | null)?.existente : undefined
      setError(existente?.nombre ? `Ese código de habilitación ya es de la sede "${existente.nombre}": búscala en vez de crearla.` : mensajeDeError(lanzado))
    } finally {
      setCreando(false)
    }
  }

  return (
    <Pantalla>
      <Texto suave>La sede se crea con la ubicación de este teléfono: hazlo estando en el sitio.</Texto>

      <Tarjeta estilo={{ gap: 6 }}>
        <Texto negrita>Ubicación del sitio</Texto>
        {ubicando ? (
          <Texto suave>Tomando la ubicación…</Texto>
        ) : ubicacion ? (
          <Texto>
            {ubicacion.lat.toFixed(6)}, {ubicacion.lng.toFixed(6)}
            {ubicacion.precision !== null ? ` · ${textoPrecision(ubicacion.precision)}` : ''}
            {ubicacion.aproximada ? ' · aproximada' : ''}
          </Texto>
        ) : (
          <Aviso tono="alerta">{errorUbicacion ?? 'Sin ubicación'}</Aviso>
        )}
        {!ubicando ? <Boton titulo="Volver a tomar la ubicación" variante="texto" alPresionar={() => void ubicar()} /> : null}
      </Tarjeta>

      <Campo etiqueta="Nombre de la sede" valor={nombre} alCambiar={setNombre} placeholder="Clínica Norte · Torre 2" maxLength={200} />

      <Selector
        etiqueta="Cuenta"
        valor={cuentaId}
        placeholder="Elige la cuenta"
        opciones={cuentas.map(c => ({ id: c.id, titulo: c.nombre, detalle: c.clase ? etiquetaClaseCuenta(c.clase) : null }))}
        alElegir={setCuentaId}
        tituloElegido={cuenta?.nombre ?? null}
        vacio="No hay cuentas cerca: búscala abajo."
        abiertoInicial={!cuentaId}
        extra={
          <Buscador<CuentaListItem>
            etiqueta="Buscar la cuenta"
            placeholder="Nombre de la clínica, EPS…"
            buscar={async q => (await api.buscarCuentas(q)).items}
            clave={item => item.id}
            titulo={item => item.nombre}
            detalle={item => etiquetaClaseCuenta(item.clase)}
            alElegir={item => {
              setCuentas(prev => (prev.some(c => c.id === item.id) ? prev : [...prev, { id: item.id, nombre: item.nombre, clase: item.clase }]))
              setCuentaId(item.id)
            }}
          />
        }
      />

      <SelectorMunicipio etiqueta="Municipio de la sede" valor={municipio} alCambiar={id => setMunicipio(id)} />

      <Campo
        etiqueta="Código de habilitación del REPS (opcional)"
        valor={reps}
        alCambiar={setReps}
        keyboardType="number-pad"
        maxLength={16}
        placeholder="12 dígitos"
        error={reps && !codigo.ok ? codigo.error : null}
        ayuda="Si cruza con el municipio en el REPS, la sede suma al instante; si no, cuando data manager la confirme."
      />

      {error ? <Aviso tono="peligro">{error}</Aviso> : null}

      <View style={{ gap: 8 }}>
        <Boton titulo="Crear sede" grande cargando={creando} deshabilitado={ubicando} alPresionar={() => void crear()} />
      </View>
    </Pantalla>
  )
}
