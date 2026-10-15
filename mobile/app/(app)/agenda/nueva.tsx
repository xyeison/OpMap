/**
 * Agendar una cita (F4.1, spec 2026-10-14 decisiones 1 a 5): fecha (de hoy a hoy + 30), tipo según el perfil, médico
 * (de sus médicos o del buscador) y una de sus sedes, o cuenta (buscador) con una de sus sedes y el subtipo; hora
 * opcional y nota. La app revisa la forma y la ventana con los mismos mensajes del servidor (validarCita de
 * lib/propuesta.ts); el día libre, el perfil en esa fecha, el médico en la sede, el subtipo vigente y los repetidos los
 * decide la base y su mensaje se muestra tal cual. Datos: GET /api/me/contexto (perfil, médicos y subtipos) y
 * POST /api/me/agenda. Nunca documentos.
 */
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { Buscador } from '../../../components/reporte/Buscador'
import { Selector } from '../../../components/reporte/Selector'
import * as api from '../../../lib/api'
import { aApiError, mensajeDeError, type ApiError } from '../../../lib/errores'
import { fechaLarga, fechaRelativa, hoyBogota, sumarDias } from '../../../lib/fechas'
import { SoloEnFoco } from '../../../lib/montaje'
import {
  cambiarFormularioCita,
  cuerpoCita,
  errorDe,
  formularioCitaVacio,
  sedesDeCuentaBuscada,
  validarCita,
  ventanaCita,
  type FormularioCita,
} from '../../../lib/propuesta'
import { conQuienCita, textoHoraCita } from '../../../lib/reglas'
import { etiquetaClaseCuenta, etiquetaEspecialidad } from '../../../lib/terceros'
import {
  ETIQUETA_TIPO_VISITA,
  MAX_NOTA_CITA,
  type CitaItem,
  type ContextoResponse,
  type CuentaListItem,
  type ErrorVisita,
  type MedicoPublico,
  type TipoVisita,
} from '../../../lib/tipos'
import { Aviso, Boton, Campo, Cargando, Chip, Grupo, Pantalla, Separador, Subtitulo, Tarjeta, Texto, useColores } from '../../../lib/ui'

/** Médico que se puede agendar: de sus médicos o traído del buscador (sin documento). */
interface MedicoCita {
  id: string
  nombre: string
  detalle: string | null
  sedes: { id: string; nombre: string; cuenta_nombre: string | null }[]
  propio: boolean
}

interface CuentaCita {
  id: string
  nombre: string
  clase: string | null
  sedes: { id: string; nombre: string; cuenta_nombre: string | null }[]
}

/** Pestaña oculta: se monta de cero cada vez que se abre (formulario nuevo). */
export default function PantallaNuevaCita() {
  return (
    <SoloEnFoco>
      <NuevaCita />
    </SoloEnFoco>
  )
}

function NuevaCita() {
  const router = useRouter()
  const c = useColores()
  const hoy = hoyBogota()
  const ventana = ventanaCita(hoy)
  const [contexto, setContexto] = useState<ContextoResponse | null>(null)
  const [errorContexto, setErrorContexto] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const [formulario, setFormulario] = useState<FormularioCita>(() => formularioCitaVacio(hoy, []))
  const [buscados, setBuscados] = useState<MedicoCita[]>([])
  const [cuenta, setCuenta] = useState<CuentaCita | null>(null)
  const [errorCuenta, setErrorCuenta] = useState<string | null>(null)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorServidor, setErrorServidor] = useState<{ mensaje: string; errores: ErrorVisita[] } | null>(null)
  const [agendada, setAgendada] = useState<CitaItem | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const ctx = await api.contexto(null)
      setContexto(ctx)
      setErrorContexto(null)
      setFormulario(prev => (prev.tipo ? prev : { ...prev, tipo: formularioCitaVacio(hoy, ctx.config.perfil).tipo }))
    } catch (e) {
      setErrorContexto(aApiError(e))
    } finally {
      setCargando(false)
    }
  }, [hoy])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const perfil: TipoVisita[] = contexto?.config.perfil ?? []
  const medicos = useMemo<MedicoCita[]>(() => {
    const propios: MedicoCita[] = (contexto?.mis_medicos ?? []).map(m => ({
      id: m.id,
      nombre: m.nombre,
      detalle: m.especialidades.map(etiquetaEspecialidad).join(', ') || null,
      sedes: m.sedes.map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre })),
      propio: true,
    }))
    return [...propios, ...buscados.filter(b => !propios.some(p => p.id === b.id))]
  }, [contexto, buscados])
  const medico = formulario.medico_id ? (medicos.find(m => m.id === formulario.medico_id) ?? null) : null
  const sedesOpciones = formulario.tipo === 'medica' ? (medico?.sedes ?? []) : (cuenta?.sedes ?? [])

  const erroresLocales = validarCita(formulario, hoy, perfil)
  const error = (...campos: string[]) =>
    (intentado ? errorDe(erroresLocales, ...campos) : null) ?? (errorServidor ? errorDe(errorServidor.errores, ...campos) : null)

  const cambiar = (cambios: Partial<FormularioCita>) => {
    setFormulario(prev => cambiarFormularioCita(prev, cambios))
    setErrorServidor(null)
    setAgendada(null)
  }

  const elegirMedico = (id: string | null) => {
    const elegido = id ? medicos.find(m => m.id === id) : undefined
    // Una sola sede: queda elegida.
    cambiar({ medico_id: id, sede_id: elegido && elegido.sedes.length === 1 ? elegido.sedes[0].id : null })
  }

  const agregarMedico = (item: MedicoPublico) => {
    const nuevo: MedicoCita = {
      id: item.id,
      nombre: item.nombre,
      detalle: [item.especialidades.map(etiquetaEspecialidad).join(', '), item.ciudad].filter(Boolean).join(' · ') || null,
      sedes: item.sedes.map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre ?? null })),
      propio: false,
    }
    setBuscados(prev => [...prev.filter(b => b.id !== nuevo.id), nuevo])
    cambiar({ medico_id: nuevo.id, sede_id: nuevo.sedes.length === 1 ? nuevo.sedes[0].id : null })
  }

  const elegirCuenta = async (item: CuentaListItem) => {
    setErrorCuenta(null)
    try {
      const detalle = await api.cuenta(item.id)
      const activas = sedesDeCuentaBuscada(item, detalle.sedes).map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: null }))
      if (activas.length === 0) {
        setErrorCuenta('Esa cuenta no tiene sedes activas: elige otra cuenta.')
        return
      }
      setCuenta({ id: item.id, nombre: item.nombre, clase: item.clase, sedes: activas })
      cambiar({ cuenta_id: item.id, sede_id: activas.length === 1 ? activas[0].id : null })
    } catch (e) {
      setErrorCuenta(mensajeDeError(e))
    }
  }

  const guardar = async () => {
    setIntentado(true)
    setErrorServidor(null)
    if (erroresLocales.length > 0) return
    setGuardando(true)
    try {
      const { cita } = await api.agendar(cuerpoCita(formulario))
      setAgendada(cita)
      // Lista para agendar otra el mismo día y del mismo tipo.
      setFormulario(prev => ({ ...formularioCitaVacio(prev.fecha, perfil), fecha: prev.fecha, tipo: prev.tipo }))
      setCuenta(null)
      setIntentado(false)
    } catch (e) {
      const err = aApiError(e)
      setErrorServidor({ mensaje: err.message, errores: err.errores })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando && !contexto) return <Cargando texto="Cargando tus médicos…" />
  if (errorContexto && !contexto) {
    return (
      <Pantalla>
        <Aviso tono="peligro" titulo="No pude cargar tus médicos" accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void cargar()} />}>
          {errorContexto.message}
        </Aviso>
      </Pantalla>
    )
  }

  const moverFecha = (dias: number) => {
    const nueva = sumarDias(formulario.fecha, dias)
    if (nueva < ventana.desde || nueva > ventana.hasta) return
    cambiar({ fecha: nueva })
  }
  const atajos = [
    { texto: 'Hoy', fecha: hoy },
    { texto: 'Mañana', fecha: sumarDias(hoy, 1) },
    { texto: 'En 1 semana', fecha: sumarDias(hoy, 7) },
  ]

  return (
    <Pantalla>
      {/* Fecha */}
      <Tarjeta>
        <Subtitulo>¿Qué día?</Subtitulo>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Boton titulo="‹" variante="secundario" alPresionar={() => moverFecha(-1)} deshabilitado={formulario.fecha <= ventana.desde} estilo={{ minWidth: 56 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Texto negrita centro>
              {capitalizar(fechaLarga(formulario.fecha))}
            </Texto>
            <Texto suave peque centro>
              {fechaRelativa(formulario.fecha)}
            </Texto>
          </View>
          <Boton titulo="›" variante="secundario" alPresionar={() => moverFecha(1)} deshabilitado={formulario.fecha >= ventana.hasta} estilo={{ minWidth: 56 }} />
        </View>
        <Grupo>
          {atajos.map(atajo => (
            <Chip key={atajo.texto} texto={atajo.texto} activo={formulario.fecha === atajo.fecha} alPresionar={() => cambiar({ fecha: atajo.fecha })} />
          ))}
        </Grupo>
        <Texto suave peque>
          De hoy hasta el {fechaLarga(ventana.hasta)}. No se agenda en un día libre aprobado.
        </Texto>
        {error('fecha') ? (
          <Texto peque color={c.peligro}>
            {error('fecha')}
          </Texto>
        ) : null}
      </Tarjeta>

      {/* Con quién */}
      <Tarjeta estilo={{ gap: 12 }}>
        <Subtitulo>¿Con quién?</Subtitulo>
        {perfil.length === 0 ? (
          <Aviso tono="alerta">Tu perfil no incluye visitas médicas ni institucionales. Pide a tu líder que lo revise.</Aviso>
        ) : perfil.length > 1 ? (
          <Grupo>
            {(['medica', 'institucional'] as TipoVisita[])
              .filter(tipo => perfil.includes(tipo))
              .map(tipo => (
                <Chip
                  key={tipo}
                  texto={ETIQUETA_TIPO_VISITA[tipo]}
                  activo={formulario.tipo === tipo}
                  alPresionar={() => {
                    if (tipo !== formulario.tipo) setCuenta(null)
                    cambiar({ tipo })
                  }}
                />
              ))}
          </Grupo>
        ) : (
          <Texto suave>Visita {ETIQUETA_TIPO_VISITA[perfil[0]].toLowerCase()}</Texto>
        )}
        {error('tipo') ? (
          <Texto peque color={c.peligro}>
            {error('tipo')}
          </Texto>
        ) : null}

        {formulario.tipo === 'medica' ? (
          <Selector
            etiqueta="Médico"
            valor={formulario.medico_id}
            placeholder="Elige el médico"
            opciones={medicos.map(m => ({ id: m.id, titulo: m.nombre, detalle: m.detalle, lateral: m.propio ? null : 'Buscado' }))}
            alElegir={elegirMedico}
            error={error('medico_id')}
            vacio="Aún no tienes médicos asignados: búscalo abajo."
            abiertoInicial={!formulario.medico_id}
            tituloElegido={medico?.nombre ?? null}
            extra={
              <Buscador<MedicoPublico>
                etiqueta="Buscar otro médico en OpMap"
                placeholder="Nombre del médico"
                buscar={async q => (await api.buscarMedicos(q)).items}
                clave={item => item.id}
                titulo={item => item.nombre}
                detalle={item => [item.especialidades.map(etiquetaEspecialidad).join(', '), item.ciudad].filter(Boolean).join(' · ') || null}
                alElegir={agregarMedico}
              />
            }
          />
        ) : null}

        {formulario.tipo === 'institucional' ? (
          <View style={{ gap: 12 }}>
            {cuenta ? (
              <Tarjeta estilo={{ padding: 12, gap: 4 }}>
                <Texto suave peque>
                  Cuenta
                </Texto>
                <Texto negrita>{cuenta.nombre}</Texto>
                {cuenta.clase ? (
                  <Texto suave peque>
                    {etiquetaClaseCuenta(cuenta.clase)}
                  </Texto>
                ) : null}
                <Boton
                  titulo="Cambiar la cuenta"
                  variante="texto"
                  alPresionar={() => {
                    setCuenta(null)
                    cambiar({ cuenta_id: null })
                  }}
                />
              </Tarjeta>
            ) : (
              <Buscador<CuentaListItem>
                etiqueta="Cuenta"
                placeholder="Nombre de la clínica, EPS…"
                buscar={async q => (await api.buscarCuentas(q)).items}
                clave={item => item.id}
                titulo={item => item.nombre}
                detalle={item => `${etiquetaClaseCuenta(item.clase)} · ${item.sedes} ${item.sedes === 1 ? 'sede' : 'sedes'}`}
                alElegir={item => void elegirCuenta(item)}
                pie={errorCuenta ? <Aviso tono="peligro">{errorCuenta}</Aviso> : error('cuenta_id') ? <Texto peque color={c.peligro}>{error('cuenta_id')}</Texto> : undefined}
              />
            )}
            <Selector
              etiqueta="Subtipo"
              valor={formulario.subtipo_id}
              placeholder="Elige el subtipo"
              opciones={(contexto?.subtipos ?? []).map(s => ({ id: s.id, titulo: s.nombre }))}
              alElegir={id => cambiar({ subtipo_id: id })}
              error={error('subtipo_id')}
              vacio="No hay subtipos institucionales vigentes."
            />
          </View>
        ) : null}

        {(formulario.tipo === 'medica' && medico) || (formulario.tipo === 'institucional' && cuenta) ? (
          <Selector
            etiqueta="Sede"
            valor={formulario.sede_id}
            placeholder="Elige la sede"
            opciones={sedesOpciones.map(s => ({
              id: s.id,
              titulo: s.nombre,
              detalle: s.cuenta_nombre && s.cuenta_nombre !== s.nombre ? s.cuenta_nombre : null,
            }))}
            alElegir={id => cambiar({ sede_id: id })}
            error={error('sede_id')}
            vacio={formulario.tipo === 'medica' ? 'Este médico no tiene sedes en OpMap.' : 'Esta cuenta no tiene sedes activas.'}
            abiertoInicial={!formulario.sede_id && sedesOpciones.length > 1}
          />
        ) : error('sede_id') && formulario.tipo ? (
          <Texto peque color={c.peligro}>
            {formulario.tipo === 'medica' ? 'Elige el médico y la sede' : 'Elige la cuenta y la sede'}
          </Texto>
        ) : null}
      </Tarjeta>

      {/* Hora y nota */}
      <Tarjeta estilo={{ gap: 12 }}>
        <Subtitulo>Hora y nota</Subtitulo>
        <Grupo>
          <Chip texto="Sin hora" activo={!formulario.hora.trim()} alPresionar={() => cambiar({ hora: '' })} />
        </Grupo>
        <Campo
          etiqueta="Hora (opcional)"
          valor={formulario.hora}
          alCambiar={texto => cambiar({ hora: texto })}
          placeholder="10:30"
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          maxLength={5}
          error={error('hora')}
          ayuda="En formato de 24 horas: 07:30, 14:00…"
        />
        <Campo
          etiqueta="Nota (opcional)"
          valor={formulario.nota}
          alCambiar={texto => cambiar({ nota: texto })}
          varias
          maxLength={MAX_NOTA_CITA}
          placeholder="Qué llevar, a quién preguntar… (sin datos de pacientes)"
          error={error('nota')}
        />
      </Tarjeta>

      {errorServidor ? (
        <Aviso tono="peligro" titulo="No se agendó">
          {errorServidor.mensaje}
        </Aviso>
      ) : null}
      {intentado && erroresLocales.length > 0 ? (
        <Aviso tono="peligro" titulo="Falta algo">
          {erroresLocales.map(e => `• ${e.mensaje}`).join('\n')}
        </Aviso>
      ) : null}

      {agendada ? (
        <Aviso
          tono="exito"
          titulo="Cita agendada"
          accion={
            <View style={{ gap: 8 }}>
              <Boton titulo="Ver mi agenda" variante="secundario" alPresionar={() => router.push('/agenda')} />
              <Boton titulo="Agendar otra" variante="texto" alPresionar={() => setAgendada(null)} />
            </View>
          }
        >
          {`${capitalizar(fechaLarga(agendada.fecha))} · ${textoHoraCita(agendada.hora)} · ${conQuienCita(agendada)} · ${agendada.sede.nombre}`}
        </Aviso>
      ) : null}

      <Separador />
      <Boton titulo="Agendar la cita" grande cargando={guardando} alPresionar={() => void guardar()} />
      <Boton titulo="Volver a mi agenda" variante="texto" deshabilitado={guardando} alPresionar={() => (router.canGoBack() ? router.back() : router.replace('/agenda'))} />
    </Pantalla>
  )
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
