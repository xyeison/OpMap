/**
 * Nuevo médico, completo o no se crea (regla del dueño): tipo y número de documento (se DIGITA, nunca se dicta ni lo
 * propone la IA), nombre, ciudad, especialidad y al menos una sede donde atiende. Primero se verifica el documento
 * (POST /api/terceros/medicos/verificar): si ya existe se muestra el existente y se usa ese; si hay nombres
 * parecidos se ofrecen. Las sedes salen de las cercanas, del buscador de sedes o de "Crear consultorio" (una cuenta
 * consultorio con el GPS del sitio). Al crear, vuelve a la pantalla que lo pidió: Reportar, con el médico puesto en la
 * tarjeta, o Agendar (CLAVE_RETORNO_AGENDAR, 2026-10-30), que lo elige al volver (medicoParaAgendar: Agendar se monta de
 * cero y toma su vuelta). Desde Agendar no se está en el sitio: el
 * consultorio queda sin ubicación. El documento solo viaja en el cuerpo de las peticiones y nunca se muestra en listas.
 *
 * Spec 2026-10-15: cada error va junto a su campo (erroresNuevoMedico) y "Verificar" / "Crear médico" quedan fijos al
 * pie (Pantalla.pie), con el error del servidor encima: a la vista aunque el formulario sea largo o el teclado esté.
 */
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Buscador } from '../../../components/reporte/Buscador'
import { SelectorMunicipio } from '../../../components/reporte/SelectorMunicipio'
import * as api from '../../../lib/api'
import { ApiError, mensajeDeError } from '../../../lib/errores'
import { textoDistancia } from '../../../lib/geo'
import { erroresNuevoMedico } from '../../../lib/pantallas'
import { medicoParaReportar, sedeConsultorio } from '../../../lib/propuesta'
import { sinCortes } from '../../../lib/reglas'
import { SoloEnFoco } from '../../../lib/montaje'
import { CLAVE_RETORNO_AGENDAR, avisarRetorno, leerPedido, medicoParaAgendar } from '../../../lib/retorno'
import {
  ESPECIALIDADES,
  ROLES_MEDICO_SEDE,
  TIPOS_DOC_MEDICO_NUEVO,
  limpiarNombre,
  tipoIdCuentaDeMedico,
  validarDocumentoMedico,
} from '../../../lib/terceros'
import type { EspecialidadMedico, MedicoPublico, MedicoVerificarRespuesta, RolMedicoSede, SedeBusquedaItem, TipoDocMedicoNuevo } from '../../../lib/tipos'
import { Aviso, Boton, Campo, Chip, Grupo, Pantalla, Subtitulo, Tarjeta, Texto, useColores } from '../../../lib/ui'

interface SedeElegida {
  sede_id: string
  nombre: string
  cuenta_nombre: string | null
  rol: RolMedicoSede
  distancia_m: number | null
}

/** Pestaña oculta: se monta de cero cada vez que se abre (pedido, formulario y sedes nuevos). */
export default function PantallaNuevoMedico() {
  return (
    <SoloEnFoco>
      <NuevoMedico />
    </SoloEnFoco>
  )
}

function NuevoMedico() {
  const router = useRouter()
  const [pedido] = useState(() => leerPedido())
  const clave = pedido?.clave ?? null
  const cercanas = (pedido?.sedes ?? []).filter(s => s.distancia_m !== null).slice(0, 6)
  const distancias = new Map((pedido?.sedes ?? []).map(s => [s.id, s.distancia_m]))

  const [tipo, setTipo] = useState<TipoDocMedicoNuevo>('CC')
  const [numero, setNumero] = useState('')
  const [nombre, setNombre] = useState(pedido?.nombre ?? '')
  const [municipio, setMunicipio] = useState<string | null>(pedido?.municipio ? pedido.municipio.slice(0, 5) : null)
  const [verificacion, setVerificacion] = useState<MedicoVerificarRespuesta | null>(null)
  const [paso, setPaso] = useState<'documento' | 'datos'>('documento')
  const [especialidades, setEspecialidades] = useState<EspecialidadMedico[]>([])
  const [sedes, setSedes] = useState<SedeElegida[]>([])
  const [direccionConsultorio, setDireccionConsultorio] = useState('')
  const [avisoConsultorio, setAvisoConsultorio] = useState<string | null>(null)
  /** Error del servidor (o de una acción) que no es de un campo: va al pie, junto al botón. */
  const [error, setError] = useState<string | null>(null)
  /** Se tocó "Verificar" o "Crear médico": desde ahí cada campo dice lo que le falta. */
  const [intento, setIntento] = useState<'verificar' | 'crear' | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const documento = validarDocumentoMedico(tipo, numero)
  const nombreLimpio = limpiarNombre(nombre)
  const datosFormulario = (paso: 'verificar' | 'crear') =>
    erroresNuevoMedico(
      { errorDocumento: documento.ok ? null : documento.error, nombre: nombreLimpio, municipio, especialidades: especialidades.length, sedes: sedes.length },
      paso
    )
  const errores = intento ? datosFormulario(intento) : {}
  const hayErrores = Object.keys(errores).length > 0

  const terminar = (medico: MedicoPublico) => {
    // Lo que se sabe de cada sede: las cercanas del pedido y las elegidas aquí (el consultorio recién creado con el
    // GPS de aquí está a 0 m). Las demás quedan "desconocidas" y decide el servidor.
    const conocidas = new Map(distancias)
    for (const sede of sedes) if (sede.distancia_m !== null) conocidas.set(sede.sede_id, sede.distancia_m)
    // Agendar no está montado (SoloEnFoco): el médico va a su vuelta; Reportar sí oye el aviso
    if (clave === CLAVE_RETORNO_AGENDAR) medicoParaAgendar(medico.id)
    else avisarRetorno({ tipo: 'medico', clave, medico: medicoParaReportar(medico, conocidas) })
    setNumero('')
    if (router.canGoBack()) router.back()
    else router.replace(clave === CLAVE_RETORNO_AGENDAR ? '/agenda/nueva' : '/reportar')
  }

  const usarExistente = async (id: string) => {
    setOcupado(true)
    setError(null)
    try {
      terminar((await api.medico(id)).medico)
    } catch (lanzado) {
      setError(mensajeDeError(lanzado))
    } finally {
      setOcupado(false)
    }
  }

  const verificar = async () => {
    setIntento('verificar')
    setError(null)
    if (Object.keys(datosFormulario('verificar')).length > 0 || !documento.ok || !municipio) return
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await api.verificarMedico({ tipo_documento: tipo, numero_documento: documento.valor, nombre: nombreLimpio, municipality_id: municipio })
      setVerificacion(respuesta)
      if (!respuesta.existente && respuesta.parecidos.length === 0) setPaso('datos')
    } catch (lanzado) {
      setError(mensajeDeError(lanzado))
    } finally {
      setOcupado(false)
    }
  }

  const agregarSede = (sede: Omit<SedeElegida, 'rol'>, rol: RolMedicoSede = 'atiende') =>
    setSedes(prev => (prev.some(s => s.sede_id === sede.sede_id) ? prev : [...prev, { ...sede, rol }]))

  /**
   * "Crear consultorio" (dueño, 2026-10-31: "debería pedir la dirección y determinar esa georeferenciación"): la
   * dirección es obligatoria (la exige el servidor tras el 409); sin el GPS del sitio, el servidor la ubica con Google
   * solo con certeza y responde qué pasó (geocodificacion.texto), que se muestra. Con GPS, el GPS manda.
   */
  const crearConsultorio = async () => {
    if (!documento.ok || !municipio) return setError('Primero el documento y la ciudad del médico')
    // La dirección la exige el servidor DESPUÉS de revisar si la cuenta ya existe (409): así un consultorio que ya está se
    // reutiliza sin escribirla; si es nuevo y falta, el servidor responde "Escribe la dirección del consultorio".
    const direccion = limpiarNombre(direccionConsultorio) || null
    setOcupado(true)
    setError(null)
    setAvisoConsultorio(null)
    const nombreConsultorio = `Consultorio ${nombreLimpio}`.slice(0, 200)
    try {
      // El consultorio queda con el punto que vale (la final de Reportar, que se espera si aún no llega), nunca con la
      // primera ubicación que se mostró.
      const punto = pedido?.puntoFinal ? await pedido.puntoFinal : (pedido?.punto ?? null)
      const respuesta = await api.crearCuenta({
        nombre: nombreConsultorio,
        clase: 'consultorio',
        tipo_identificacion: tipoIdCuentaDeMedico(tipo),
        numero_identificacion: documento.valor,
        sede: { nombre: nombreConsultorio, municipality_id: municipio, lat: punto?.lat ?? null, lng: punto?.lng ?? null, direccion },
      })
      agregarSede({ sede_id: respuesta.sede.id, nombre: respuesta.sede.nombre, cuenta_nombre: respuesta.cuenta.nombre, distancia_m: punto ? 0 : null }, 'consultorio')
      if (respuesta.geocodificacion) setAvisoConsultorio(respuesta.geocodificacion.texto)
    } catch (lanzado) {
      // Ya hay una cuenta con esa identificación: se usa su sede principal como consultorio.
      const existente = lanzado instanceof ApiError && lanzado.status === 409 ? (lanzado.cuerpo as { existente?: { id?: string } } | null)?.existente : undefined
      if (existente?.id) {
        try {
          const detalle = await api.cuenta(existente.id)
          // Solo una sede ACTIVA sirve de consultorio (la inactiva la rechazaría el servidor al crear el médico).
          const principal = detalle.cuenta.activo === false ? null : sedeConsultorio(detalle.sedes)
          if (principal) agregarSede({ sede_id: principal.id, nombre: principal.nombre, cuenta_nombre: detalle.cuenta.nombre, distancia_m: null }, 'consultorio')
          else setError('Ya hay una cuenta con ese documento, pero no tiene sedes activas: búscala o pide al equipo de datos que la revise.')
        } catch (otro) {
          setError(mensajeDeError(otro))
        }
      } else {
        setError(mensajeDeError(lanzado))
      }
    } finally {
      setOcupado(false)
    }
  }

  const crear = async () => {
    setIntento('crear')
    setError(null)
    if (Object.keys(datosFormulario('crear')).length > 0 || !documento.ok || !municipio) return
    setOcupado(true)
    setError(null)
    try {
      const respuesta = await api.crearMedico({
        tipo_documento: tipo,
        numero_documento: documento.valor,
        nombre: nombreLimpio,
        especialidades,
        municipality_id: municipio,
        sedes: sedes.map((sede, indice) => ({ sede_id: sede.sede_id, rol: sede.rol, principal: indice === 0 })),
      })
      terminar(
        respuesta.medico ?? {
          id: respuesta.id,
          nombre: nombreLimpio,
          especialidades,
          municipality_id: municipio,
          sedes: sedes.map(s => ({ id: s.sede_id, nombre: s.nombre, rol: s.rol, cuenta_nombre: s.cuenta_nombre ?? undefined })),
        }
      )
    } catch (lanzado) {
      const existente = lanzado instanceof ApiError && lanzado.status === 409 ? (lanzado.cuerpo as { existente?: { id: string; nombre: string } } | null)?.existente : undefined
      if (existente) setVerificacion({ existente: { id: existente.id, nombre: existente.nombre }, parecidos: [] })
      setError(mensajeDeError(lanzado))
    } finally {
      setOcupado(false)
    }
  }

  // El botón del paso en que se está, fijo al pie; encima, el error del servidor o que se revise lo marcado.
  const accion =
    paso === 'datos' ? (
      <Boton titulo="Crear médico" grande cargando={ocupado} alPresionar={() => void crear()} />
    ) : paso === 'documento' && !verificacion ? (
      <Boton titulo="Verificar" grande cargando={ocupado} alPresionar={() => void verificar()} />
    ) : null
  const avisoPie = error ?? (hayErrores ? 'Revisa lo que está marcado arriba.' : null)

  return (
    <Pantalla
      pie={
        accion || avisoPie ? (
          <>
            {avisoPie ? <Aviso tono="peligro">{avisoPie}</Aviso> : null}
            {accion}
          </>
        ) : undefined
      }
    >
      <Texto suave>Un médico se crea completo: documento, nombre, ciudad, especialidad y dónde atiende.</Texto>

      <Tarjeta estilo={{ gap: 12 }}>
        <Subtitulo>1. Documento y nombre</Subtitulo>
        <Grupo>
          {TIPOS_DOC_MEDICO_NUEVO.map(opcion => (
            <Chip
              key={opcion.valor}
              texto={opcion.valor}
              activo={tipo === opcion.valor}
              alPresionar={() => {
                setTipo(opcion.valor)
                setVerificacion(null)
                setPaso('documento')
              }}
            />
          ))}
        </Grupo>
        <Campo
          etiqueta="Número de documento (se digita)"
          valor={numero}
          alCambiar={texto => {
            setNumero(texto)
            setVerificacion(null)
            setPaso('documento')
          }}
          keyboardType={tipo === 'CC' ? 'number-pad' : 'default'}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          importantForAutofill="no"
          maxLength={24}
          error={(numero ? (documento.ok ? null : documento.error) : null) ?? errores.documento ?? null}
          ayuda="No se muestra en listas ni se dicta."
        />
        <Campo
          etiqueta="Nombre completo"
          valor={nombre}
          alCambiar={setNombre}
          autoCapitalize="words"
          placeholder="Dra. Ana María Gómez"
          maxLength={200}
          error={errores.nombre ?? null}
        />
        <SelectorMunicipio etiqueta="Ciudad del médico" valor={municipio} alCambiar={id => setMunicipio(id)} />
        {errores.ciudad ? <ErrorCampo texto={errores.ciudad} /> : null}

        {verificacion?.existente ? (
          <Aviso tono="info" titulo="Ese documento ya está en OpMap">
            <View style={{ gap: 8 }}>
              <Texto>{verificacion.existente.nombre}</Texto>
              <Boton titulo="Usar este médico" cargando={ocupado} alPresionar={() => void usarExistente(verificacion.existente!.id)} />
            </View>
          </Aviso>
        ) : null}
        {verificacion && !verificacion.existente && verificacion.parecidos.length > 0 && paso === 'documento' ? (
          <Aviso tono="alerta" titulo="¿Es alguno de estos?">
            <View style={{ gap: 8 }}>
              {verificacion.parecidos.map(p => (
                <Boton key={p.id} titulo={p.nombre} detalle={p.ciudad ?? undefined} variante="secundario" alPresionar={() => void usarExistente(p.id)} />
              ))}
              <Boton titulo="No, es otro médico: seguir" alPresionar={() => setPaso('datos')} />
            </View>
          </Aviso>
        ) : null}
      </Tarjeta>

      {paso === 'datos' ? (
        <Tarjeta estilo={{ gap: 12 }}>
          <Subtitulo>2. Especialidad y dónde atiende</Subtitulo>
          <Grupo>
            {ESPECIALIDADES.map(opcion => (
              <Chip
                key={opcion.valor}
                texto={opcion.etiqueta}
                activo={especialidades.includes(opcion.valor)}
                alPresionar={() =>
                  setEspecialidades(prev => (prev.includes(opcion.valor) ? prev.filter(e => e !== opcion.valor) : [...prev, opcion.valor]))
                }
              />
            ))}
          </Grupo>
          {errores.especialidad ? <ErrorCampo texto={errores.especialidad} /> : null}

          {errores.sedes ? <ErrorCampo texto={errores.sedes} /> : null}
          {sedes.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Texto negrita>Sedes elegidas</Texto>
              {sedes.map(sede => (
                <Tarjeta key={sede.sede_id} estilo={{ padding: 12, gap: 8 }}>
                  <Texto negrita>{sede.nombre}</Texto>
                  {sede.cuenta_nombre && sede.cuenta_nombre !== sede.nombre ? (
                    <Texto peque suave>
                      {sede.cuenta_nombre}
                    </Texto>
                  ) : null}
                  <Grupo>
                    {ROLES_MEDICO_SEDE.map(rol => (
                      <Chip
                        key={rol.valor}
                        texto={rol.etiqueta}
                        activo={sede.rol === rol.valor}
                        alPresionar={() => setSedes(prev => prev.map(s => (s.sede_id === sede.sede_id ? { ...s, rol: rol.valor } : s)))}
                      />
                    ))}
                    <Chip texto="Quitar" activo={false} alPresionar={() => setSedes(prev => prev.filter(s => s.sede_id !== sede.sede_id))} />
                  </Grupo>
                </Tarjeta>
              ))}
            </View>
          ) : null}

          {cercanas.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Texto negrita>Sedes cerca de ti</Texto>
              {cercanas
                .filter(s => !sedes.some(e => e.sede_id === s.id))
                .map(s => (
                  <Boton
                    key={s.id}
                    titulo={s.nombre}
                    detalle={[s.cuenta_nombre !== s.nombre ? s.cuenta_nombre : null, s.distancia_m !== null ? sinCortes(textoDistancia(s.distancia_m)) : null].filter(Boolean).join(' · ') || undefined}
                    variante="secundario"
                    alPresionar={() => agregarSede({ sede_id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre, distancia_m: s.distancia_m })}
                  />
                ))}
            </View>
          ) : null}

          <Buscador<SedeBusquedaItem>
            etiqueta="Buscar otra sede"
            placeholder="Nombre de la sede o de la clínica"
            buscar={async q => (await api.buscarSedes(q)).items}
            clave={item => item.id}
            titulo={item => item.nombre}
            detalle={item => [item.cuenta_nombre !== item.nombre ? item.cuenta_nombre : null, item.ciudad].filter(Boolean).join(' · ') || null}
            textoElegir="Atiende aquí"
            alElegir={item => agregarSede({ sede_id: item.id, nombre: item.nombre, cuenta_nombre: item.cuenta_nombre, distancia_m: null })}
          />
          <Campo
            etiqueta="Dirección del consultorio"
            valor={direccionConsultorio}
            alCambiar={setDireccionConsultorio}
            placeholder="Calle 45 # 27-12, consultorio 304"
            maxLength={300}
            ayuda={pedido?.punto || pedido?.puntoFinal ? 'Se guarda con el GPS de aquí.' : 'Con ella se ubica el consultorio (si la dirección se encuentra con certeza).'}
          />
          {avisoConsultorio ? <Aviso tono="info">{avisoConsultorio}</Aviso> : null}
          <Boton
            titulo="Crear consultorio"
            detalle={pedido?.punto || pedido?.puntoFinal ? 'Cuenta consultorio del médico con el GPS de aquí' : 'Cuenta consultorio del médico, ubicado por su dirección'}
            variante="secundario"
            cargando={ocupado}
            alPresionar={() => void crearConsultorio()}
          />
        </Tarjeta>
      ) : null}

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
