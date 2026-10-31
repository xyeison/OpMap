/**
 * Nueva sede con el GPS del sitio (decisión 14 del contrato fase 8): nombre, cuenta (de las sedes cercanas o del
 * buscador), municipio, código de habilitación del REPS (opcional) y la ubicación del teléfono. POST
 * /api/terceros/sedes con origen 'gps_app': nace "por confirmar" salvo que el código del REPS cruce con el municipio
 * (entonces suma al instante); si no, suma cuando el equipo de datos la confirma. Al crearla vuelve a Reportar con la
 * sede puesta (en la tarjeta que la pidió o como sede elegida del paso 1).
 *
 * Spec 2026-10-15: la ubicación se muestra como "Ubicación tomada · ±12 m" (sin coordenadas), cada error va junto a su
 * campo y "Crear sede" queda fijo al pie (Pantalla.pie), a la vista aunque el formulario sea largo.
 *
 * Pedida desde Agendar (CLAVE_RETORNO_AGENDAR con el médico; spec 2026-10-30-agendar-sede-del-medico): no se está en
 * el sitio, así que la ubicación es opcional (se toma solo con el botón); sin ella la sede va sin coordenadas y nace
 * "por confirmar" (lib/sede-del-medico.ts, cuerpoSedeNueva). Agendar no está montado para oír el aviso: la sede queda
 * en su vuelta (sedeParaAgendar) y Agendar la vincula al médico y la elige al montarse.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Buscador } from '../../../components/reporte/Buscador'
import { Selector } from '../../../components/reporte/Selector'
import { SelectorMunicipio } from '../../../components/reporte/SelectorMunicipio'
import * as api from '../../../lib/api'
import { ApiError, mensajeDeError } from '../../../lib/errores'
import { SoloEnFoco } from '../../../lib/montaje'
import { textoUbicacionTomada } from '../../../lib/pantallas'
import { CLAVE_RETORNO_AGENDAR, avisarRetorno, leerPedido, sedeParaAgendar } from '../../../lib/retorno'
import { MENSAJE_SEDE_CREADA_SIN_VUELTA, MENSAJE_SEDE_SIN_UBICACION, cuerpoSedeNueva } from '../../../lib/sede-del-medico'
import { etiquetaClaseCuenta, limpiarNombre, validarRepsCode } from '../../../lib/terceros'
import type { CuentaListItem } from '../../../lib/tipos'
import { pedirUbicacion, type Ubicacion } from '../../../lib/ubicacion'
import { Aviso, Boton, Campo, Pantalla, Tarjeta, Texto, useColores } from '../../../lib/ui'

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

  /** Pedida desde Agendar: la sede de un médico, lejos del sitio (ubicación opcional; vuelve por la vuelta de Agendar). */
  const desdeAgendar = pedido?.clave === CLAVE_RETORNO_AGENDAR
  const medico = desdeAgendar ? (pedido?.medico ?? null) : null

  const [nombre, setNombre] = useState(desdeAgendar ? limpiarNombre(pedido?.nombre ?? '') : '')
  const [cuentas, setCuentas] = useState<CuentaOpcion[]>(cuentasCercanas)
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [municipio, setMunicipio] = useState<string | null>(pedido?.municipio ? pedido.municipio.slice(0, 5) : null)
  const [reps, setReps] = useState('')
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [ubicando, setUbicando] = useState(!desdeAgendar)
  const [error, setError] = useState<string | null>(null)
  /** Se tocó "Crear sede": desde ahí cada campo dice lo que le falta. */
  const [intentado, setIntentado] = useState(false)
  const [creando, setCreando] = useState(false)

  const ubicar = async () => {
    setUbicando(true)
    const resultado = await pedirUbicacion({ timeoutMs: 12_000 })
    setUbicacion(resultado.ubicacion)
    setErrorUbicacion(resultado.error)
    setUbicando(false)
  }

  // Desde Reportar la ubicación se toma sola (se está en el sitio); desde Agendar solo con el botón.
  useEffect(() => {
    if (!desdeAgendar) void ubicar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const codigo = validarRepsCode(reps)
  const cuenta = cuentas.find(c => c.id === cuentaId) ?? null
  const nombreLimpio = limpiarNombre(nombre)
  // Lo que le falta a cada campo (se muestra junto al campo después del primer "Crear sede").
  const faltas = {
    nombre: nombreLimpio.length < 2 ? 'Escribe el nombre de la sede' : null,
    cuenta: !cuentaId || !cuenta ? 'Elige la cuenta de la sede' : null,
    municipio: !municipio ? 'Elige el municipio de la sede' : null,
    ubicacion: !ubicacion && !desdeAgendar ? 'Hace falta la ubicación del teléfono: la sede se crea con el GPS de aquí' : null,
  }
  const hayFaltas = Boolean(faltas.nombre || faltas.cuenta || faltas.municipio || faltas.ubicacion) || !codigo.ok
  // Al pie, junto al botón: el error del servidor o, si falta algo, que se revise lo marcado.
  const avisoPie = error ?? (intentado && hayFaltas ? 'Revisa lo que está marcado arriba.' : null)

  const crear = async () => {
    setIntentado(true)
    setError(null)
    if (hayFaltas || !codigo.ok || !cuentaId || !cuenta || !municipio || (!ubicacion && !desdeAgendar)) return
    setCreando(true)
    try {
      const respuesta = await api.crearSede(
        cuerpoSedeNueva({
          cuenta_id: cuentaId,
          nombre: nombreLimpio,
          municipality_id: municipio,
          reps_code: codigo.valor,
          ubicacion: ubicacion ? { lat: ubicacion.lat, lng: ubicacion.lng, precision: ubicacion.precision } : null,
        })
      )
      const sede = respuesta.sede
      if (desdeAgendar) {
        // Agendar no está montado (SoloEnFoco): la sede va a su vuelta, y Reportar no debe enterarse. Si la vuelta ya
        // venció (más de 30 minutos aquí), la sede existe pero nadie la va a vincular: se dice y no se sale.
        if (!sedeParaAgendar({ id: sede.id, nombre: sede.nombre, cuenta_nombre: cuenta.nombre })) {
          setError(MENSAJE_SEDE_CREADA_SIN_VUELTA)
          return
        }
      } else {
        avisarRetorno({
          tipo: 'sede',
          clave: pedido?.clave ?? null,
          sede: {
            id: sede.id,
            nombre: sede.nombre,
            cuenta_id: sede.cuenta_id,
            cuenta_nombre: cuenta.nombre,
            cuenta_clase: cuenta.clase,
            lat: sede.lat === null ? (ubicacion?.lat ?? null) : Number(sede.lat),
            lng: sede.lng === null ? (ubicacion?.lng ?? null) : Number(sede.lng),
            distancia_m: ubicacion ? 0 : null,
            ubicacion_confirmada: sede.ubicacion_confirmada,
          },
        })
      }
      if (router.canGoBack()) router.back()
      else router.replace(desdeAgendar ? '/agenda/nueva' : '/reportar')
    } catch (lanzado) {
      const existente = lanzado instanceof ApiError && lanzado.status === 409 ? (lanzado.cuerpo as { existente?: { nombre?: string } } | null)?.existente : undefined
      setError(existente?.nombre ? `Ese código de habilitación ya es de la sede "${existente.nombre}": búscala en vez de crearla.` : mensajeDeError(lanzado))
    } finally {
      setCreando(false)
    }
  }

  return (
    <Pantalla
      pie={
        <>
          {avisoPie ? <Aviso tono="peligro">{avisoPie}</Aviso> : null}
          <Boton titulo="Crear sede" grande cargando={creando} deshabilitado={ubicando} alPresionar={() => void crear()} />
        </>
      }
    >
      {desdeAgendar ? (
        <Texto suave>{medico ? `Queda como sede donde atiende ${medico.nombre}.` : 'Queda como sede del médico de la cita.'}</Texto>
      ) : (
        <Texto suave>La sede se crea con la ubicación de este teléfono: hazlo estando en el sitio.</Texto>
      )}

      <Tarjeta estilo={{ gap: 6 }}>
        <Texto negrita>{desdeAgendar ? 'Ubicación (opcional)' : 'Ubicación del sitio'}</Texto>
        {ubicando ? (
          <Texto suave>Tomando la ubicación…</Texto>
        ) : ubicacion ? (
          <Texto>{textoUbicacionTomada(ubicacion.precision, ubicacion.aproximada)}</Texto>
        ) : desdeAgendar && !errorUbicacion ? (
          <Texto suave>{MENSAJE_SEDE_SIN_UBICACION}</Texto>
        ) : (
          <Aviso tono="alerta">{errorUbicacion ?? 'Sin ubicación'}</Aviso>
        )}
        {intentado && faltas.ubicacion && !ubicando ? <ErrorCampo texto={faltas.ubicacion} /> : null}
        {!ubicando ? (
          <Boton titulo={ubicacion ? 'Volver a tomar la ubicación' : desdeAgendar ? 'Estoy en la sede: tomar la ubicación' : 'Volver a tomar la ubicación'} variante="texto" alPresionar={() => void ubicar()} />
        ) : null}
      </Tarjeta>

      <Campo
        etiqueta="Nombre de la sede"
        valor={nombre}
        alCambiar={setNombre}
        placeholder="Clínica Norte · Torre 2"
        maxLength={200}
        error={intentado ? faltas.nombre : null}
      />

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
      {intentado && faltas.cuenta ? <ErrorCampo texto={faltas.cuenta} /> : null}

      <SelectorMunicipio etiqueta="Municipio de la sede" valor={municipio} alCambiar={id => setMunicipio(id)} />
      {intentado && faltas.municipio ? <ErrorCampo texto={faltas.municipio} /> : null}

      <Campo
        etiqueta="Código de habilitación del REPS (opcional)"
        valor={reps}
        alCambiar={setReps}
        keyboardType="number-pad"
        maxLength={16}
        placeholder="12 dígitos"
        error={reps && !codigo.ok ? codigo.error : null}
        ayuda="Si cruza con el municipio en el REPS, la sede suma al instante; si no, cuando el equipo de datos la confirme."
      />
    </Pantalla>
  )
}

/** Lo que le falta a un campo, en rojo y justo debajo de él. */
function ErrorCampo({ texto }: { texto: string }) {
  const c = useColores()
  return (
    <Texto peque color={c.peligro}>
      {texto}
    </Texto>
  )
}
