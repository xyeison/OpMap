/**
 * Una visita por confirmar (propuesta por la voz o por toques), editable con una mano: tipo, médico y su sede, o
 * cuenta, sede, subtipo y contacto; presencial o telefónica (con la distancia a la sede y el radio vigente); si fue
 * efectiva, conclusión, compromisos, próxima reunión y líneas. "Confirmar" la manda (o la guarda sin señal); nada se
 * guarda sin ese toque. Reglas visibles del contrato fase 8: presencial bloqueada fuera del radio con las salidas
 * (telefónica si está habilitada y con cupo, o crear la sede aquí), telefónica solo si está habilitada, médico que no
 * está en OpMap → "Crear médico completo" (documento digitado). Nunca muestra documentos.
 *
 * Spec 2026-10-15 (paquete 2, decisión 8; lib/tarjeta-resumen.ts):
 *   - La tarjeta de voz que ya está bien sale en RESUMEN (con quién, sede y radio, resultado, líneas, conclusión en 3
 *     líneas, compromisos y próxima reunión); cada fila se toca para corregir solo ese campo, y "Editar todo" la abre
 *     completa. Lo dudoso (preguntas de la IA, confianza < 0,6, errores, fuera del radio, médico no encontrado) abre
 *     completa con "Revisa antes de confirmar" arriba. La de toques abre completa. Si algo se vuelve dudoso (p. ej. la
 *     ubicación final la deja fuera del radio, o el servidor la rechaza), se abre completa y así queda.
 *   - El "Confirmar" de la primera tarjeta va en el pie fijo de Reportar (PieConfirmar en Pantalla.pie: "Confirmar
 *     visita 1 de N", visible sin desplazar); las demás llevan el suyo. Cada tarjeta se confirma con su propio toque y
 *     con las mismas validaciones (validarBorrador).
 *   - Encima del botón del pie va qué se confirma ("Efectiva · PerOssal y Reemplazo articular · sin conclusión") o lo
 *     que falta / el rechazo (revisión 2026-10-15): la de toques nace válida y no se confirma a ciegas.
 *   - "Descartar" va aparte, en rojo, y Reportar pregunta antes de borrar la tarjeta.
 *   - Con una cita (agenda_id) no se muestra "Tipo de visita": el tipo es el de la cita.
 *   - Los médicos van ordenados por la sede elegida y por cercanía (lib/orden-medicos.ts), con un solo buscador: el
 *     filtro de la lista ofrece "Buscar en OpMap" con el mismo texto.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import * as api from '../../lib/api'
import { mensajeDeError } from '../../lib/errores'
import { textoDistancia, type Punto } from '../../lib/geo'
import { ordenarMedicos } from '../../lib/orden-medicos'
import {
  MENSAJE_SEDE_SIN_UBICACION,
  avisoVisitante,
  contactosParaBorrador,
  cuentasDelCatalogo,
  distanciaASede,
  errorDe,
  medicoDesdeBusqueda,
  nombreSede,
  puedeOfrecerTelefonica,
  sedesCercanasSinVincular,
  sedesDeCuentaBuscada,
  sedesParaBorrador,
  subtipoParaContacto,
  textoRechazoCita,
  textoRechazoRadio,
  validarBorrador,
  type Borrador,
  type Catalogo,
  type MedicoOpcion,
  type Rechazo,
  type SedeOpcion,
  type VisitaHoyTope,
} from '../../lib/propuesta'
import { sinCortes, textoHoraCita } from '../../lib/reglas'
import { filasResumen, modoTarjeta, textoPieConfirmar, type CampoResumen, type FilaResumen } from '../../lib/tarjeta-resumen'
import { etiquetaClaseCuenta, etiquetaEspecialidad } from '../../lib/terceros'
import { ETIQUETA_MEDIO, ETIQUETA_TIPO_VISITA, type CitaItem, type CuentaListItem, type MedicoPublico, type TipoVisita } from '../../lib/tipos'
import { ALTO_TOQUE_MIN, Aviso, Boton, Chip, Grupo, Insignia, Separador, Texto, useColores, useFuente } from '../../lib/ui'
import { Buscador } from './Buscador'
import { CamposVisita, type CampoVisita } from './CamposVisita'
import { Selector } from './Selector'

export interface EstadoTarjeta {
  /** Ya se intentó confirmar: se muestran los errores junto a cada campo. */
  intentado: boolean
  enviando: boolean
  /** Lo que respondió el servidor al rechazarla (con las salidas que corresponden). */
  rechazo: Rechazo | null
}

export const ESTADO_TARJETA_INICIAL: EstadoTarjeta = { intentado: false, enviando: false, rechazo: null }

interface Props {
  numero: number
  total: number
  borrador: Borrador
  catalogo: Catalogo
  punto: Punto | null
  checkedInAt: string
  visitasHoy: readonly VisitaHoyTope[]
  estado: EstadoTarjeta
  alCambiar: (cambios: Partial<Borrador>) => void
  alConfirmar: () => void
  alDescartar: () => void
  alCrearMedico: () => void
  alCrearSede: () => void
  /** Médico traído del buscador (no está entre los suyos). */
  alAgregarMedico: (medico: MedicoOpcion) => void
  /** Sedes de una cuenta traída del buscador. */
  alAgregarSedes: (sedes: SedeOpcion[]) => void
  /** El médico también atiende en esta sede cercana: se vincula en OpMap. */
  alVincularSede: (sedeId: string) => Promise<void>
  /** La cita de la agenda que cumple (borrador.agenda_id), para mostrarla. */
  cita?: CitaItem | null
  /** Micrófono junto a Conclusión (F4.1): la voz está configurada y hay señal. */
  dictadoDisponible?: boolean
  /** Su "Confirmar" va en el pie fijo de Reportar (PieConfirmar en Pantalla.pie): la tarjeta no lo repite. */
  confirmarEnPie?: boolean
  /** Sede para ordenar los médicos ("Atienden en …") si la tarjeta aún no tiene: la elegida en el paso 1. */
  sedeElegida?: string | null
  /** Cualquier toque en la tarjeta (abrir una fila, "Editar todo"): Reportar deja su marca de tiempo. */
  alTocar?: () => void
}

/**
 * El botón del pie fijo de Reportar (Pantalla.pie): "Confirmar visita 1 de N" de la primera tarjeta abierta. Encima, en
 * una línea, qué se confirma (`resumen`: resumenParaPie) o, si no pasó, lo que falta o el rechazo (`aviso`: avisoDelPie).
 */
export function PieConfirmar({
  numero,
  total,
  enviando,
  alConfirmar,
  resumen = null,
  aviso = null,
}: {
  numero: number
  total: number
  enviando: boolean
  alConfirmar: () => void
  resumen?: string | null
  aviso?: string | null
}) {
  const c = useColores()
  return (
    <View style={{ gap: 6 }}>
      {aviso ? (
        <Texto peque color={c.peligro} lineas={3}>
          {aviso}
        </Texto>
      ) : resumen ? (
        <Texto peque suave lineas={2}>
          {resumen}
        </Texto>
      ) : null}
      <Boton titulo={textoPieConfirmar(numero, total)} cargando={enviando} alPresionar={alConfirmar} />
    </View>
  )
}

export function TarjetaBorrador(props: Props) {
  const { borrador, catalogo, punto, estado } = props
  const c = useColores()
  const config = catalogo.config
  const entrada = { punto, checked_in_at: props.checkedInAt, ahora: new Date(), visitasHoy: props.visitasHoy }
  const resultado = validarBorrador(borrador, catalogo, entrada)
  const decision = modoTarjeta(borrador, catalogo, entrada)
  // Lo dudoso abre completa, y también lo que el servidor rechazó o no pasó la validación al confirmar.
  const debeAbrir = decision.modo === 'completa' || !!estado.rechazo || (estado.intentado && !resultado.ok)
  const [completa, setCompleta] = useState(debeAbrir)
  useEffect(() => {
    if (debeAbrir && !completa) setCompleta(true)
  }, [debeAbrir, completa])
  const enResumen = !completa && !debeAbrir
  /** La fila del resumen que se está corrigiendo. */
  const [editando, setEditando] = useState<CampoResumen | null>(null)
  const error = (...campos: string[]) => (estado.intentado ? errorDe(resultado.errores, ...campos) : null)
  const medico = borrador.medico_id ? catalogo.medicos.find(m => m.id === borrador.medico_id) : undefined
  const tiposPerfil = (['medica', 'institucional'] as TipoVisita[]).filter(tipo => config.perfil.includes(tipo))
  const distancia = borrador.modalidad === 'presencial' && punto ? distanciaASede(borrador, catalogo, punto) : null
  const fueraDelRadio = distancia?.distancia_m !== null && distancia?.distancia_m !== undefined && distancia.distancia_m > config.radio_m
  const sedeSinUbicacion = !!distancia && distancia.conocida && distancia.distancia_m === null
  const ofreceTelefonica = puedeOfrecerTelefonica(catalogo, props.visitasHoy, borrador.client_id)
  const rechazo = estado.rechazo
  const sedeTexto = nombreSede(borrador.sede_id, catalogo)
  const [errorCuenta, setErrorCuenta] = useState<string | null>(null)

  const agregarCuenta = async (item: CuentaListItem): Promise<boolean> => {
    setErrorCuenta(null)
    try {
      const detalle = await api.cuenta(item.id)
      const activas = sedesDeCuentaBuscada(item, detalle.sedes)
      if (activas.length === 0) {
        setErrorCuenta('Esa cuenta no tiene sedes activas: crea la sede aquí o elige otra cuenta.')
        return false
      }
      props.alAgregarSedes(activas)
      props.alCambiar({ cuenta_id: item.id, sede_id: null })
      return true
    } catch (lanzado) {
      setErrorCuenta(mensajeDeError(lanzado))
      return false
    }
  }

  const salidas = (
    <Grupo>
      {ofreceTelefonica ? <Boton titulo="Cambiar a telefónica" variante="secundario" alPresionar={() => props.alCambiar({ modalidad: 'telefonica' })} /> : null}
      <Boton titulo="Crear sede aquí" variante="secundario" alPresionar={props.alCrearSede} />
    </Grupo>
  )

  // ---------------------------------------------------------------------------------------------
  // Piezas (la tarjeta completa las pinta todas; el resumen, la de la fila que se toca)
  // ---------------------------------------------------------------------------------------------

  const bloqueTipo = (
    <View style={{ gap: 6 }}>
      <Texto negrita>Tipo de visita</Texto>
      {tiposPerfil.length === 0 ? (
        <Aviso tono="alerta">Tu perfil no incluye visitas médicas ni institucionales. Pide a tu líder que lo revise.</Aviso>
      ) : (
        <Grupo>
          {tiposPerfil.map(tipo => (
            <Chip key={tipo} texto={ETIQUETA_TIPO_VISITA[tipo]} activo={borrador.tipo === tipo} alPresionar={() => props.alCambiar({ tipo })} />
          ))}
        </Grupo>
      )}
      {error('tipo') ? (
        <Texto peque color={c.peligro}>
          {error('tipo')}
        </Texto>
      ) : null}
    </View>
  )

  // Médicos: los de la sede elegida primero, luego los cercanos y el resto por nombre; un solo buscador.
  const opcionesMedico = ordenarMedicos(catalogo.medicos, borrador.sede_id ?? props.sedeElegida ?? null, punto).flatMap(grupo =>
    grupo.medicos.map(m => ({
      id: m.id,
      titulo: m.nombre,
      detalle: m.especialidades.map(etiquetaEspecialidad).join(', ') || null,
      lateral: m.propio ? cercaniaMedico(m) : 'Fuera de tu territorio',
      grupo: grupo.titulo,
    }))
  )
  const selectorMedico = (abrir: boolean) => (
    <View style={{ gap: 12 }}>
      {borrador.medico_nombre_dicho && !borrador.medico_id ? (
        <Aviso tono="alerta" titulo={`"${borrador.medico_nombre_dicho}" no está entre tus médicos`}>
          <View style={{ gap: 8 }}>
            <Texto peque>Búscalo en OpMap escribiendo su nombre en la lista, o créalo completo (con su documento, que se digita).</Texto>
            <Boton titulo="Crear médico completo" variante="secundario" alPresionar={props.alCrearMedico} />
          </View>
        </Aviso>
      ) : null}
      <Selector
        etiqueta="Médico"
        valor={borrador.medico_id}
        placeholder="Elige el médico"
        opciones={opcionesMedico}
        alElegir={id => props.alCambiar({ medico_id: id })}
        error={error('medico_id')}
        vacio="Aún no tienes médicos asignados: escribe su nombre arriba para buscarlo en OpMap, o créalo."
        abiertoInicial={abrir}
        tituloElegido={medico?.nombre ?? null}
        buscarFuera={{
          donde: 'OpMap',
          resultados: (consulta, cerrar) => (
            <Buscador<MedicoPublico>
              etiqueta="Médicos en OpMap"
              consulta={consulta}
              buscar={async q => (await api.buscarMedicos(q)).items}
              clave={item => item.id}
              titulo={item => item.nombre}
              detalle={item => [item.especialidades.map(etiquetaEspecialidad).join(', '), item.ciudad].filter(Boolean).join(' · ') || null}
              sinResultados="No encontré a nadie con ese nombre en OpMap."
              alElegir={item => {
                props.alAgregarMedico(medicoDesdeBusqueda(item, catalogo))
                cerrar()
              }}
            />
          ),
        }}
        extra={<Boton titulo="¿No está en OpMap? Crear médico completo" variante="texto" alPresionar={props.alCrearMedico} />}
      />
      {avisoVisitante(medico) ? (
        <Texto peque suave>
          {avisoVisitante(medico)}
        </Texto>
      ) : null}
    </View>
  )

  const selectorSedeMedico = medico ? (
    <Selector
      etiqueta="Sede donde lo viste"
      valor={borrador.sede_id}
      placeholder="Elige la sede"
      opciones={sedesParaBorrador(borrador, catalogo).map(s => ({
        id: s.id,
        titulo: s.nombre,
        detalle: s.cuenta_nombre && s.cuenta_nombre !== s.nombre ? s.cuenta_nombre : null,
        lateral: s.distancia_m !== null ? sinCortes(textoDistancia(s.distancia_m)) : null,
      }))}
      alElegir={id => props.alCambiar({ sede_id: id })}
      error={error('sede_id')}
      vacio="Este médico no tiene sedes en OpMap."
      extra={<SedesSinVincular borrador={borrador} catalogo={catalogo} alVincular={props.alVincularSede} />}
    />
  ) : (
    <Texto peque suave>
      Elige primero el médico.
    </Texto>
  )

  const selectorCuenta = (abrir: boolean) => (
    <Selector
      etiqueta="Cuenta"
      valor={borrador.cuenta_id}
      placeholder="Elige la cuenta"
      opciones={cuentasDelCatalogo(catalogo).map(cuenta => ({
        id: cuenta.id,
        titulo: cuenta.nombre,
        detalle: cuenta.clase ? etiquetaClaseCuenta(cuenta.clase) : null,
        lateral: cuenta.distancia_m !== null ? sinCortes(textoDistancia(cuenta.distancia_m)) : null,
      }))}
      alElegir={id => props.alCambiar({ cuenta_id: id })}
      error={error('cuenta_id')}
      vacio="No hay cuentas cerca: escribe su nombre arriba para buscarla en OpMap."
      abiertoInicial={abrir}
      buscarFuera={{
        donde: 'OpMap',
        resultados: (consulta, cerrar) => (
          <Buscador<CuentaListItem>
            etiqueta="Cuentas en OpMap"
            consulta={consulta}
            buscar={async q => (await api.buscarCuentas(q)).items}
            clave={item => item.id}
            titulo={item => item.nombre}
            detalle={item => `${etiquetaClaseCuenta(item.clase)} · ${item.sedes} ${item.sedes === 1 ? 'sede' : 'sedes'}`}
            sinResultados="No encontré cuentas con ese nombre en OpMap."
            alElegir={item =>
              void agregarCuenta(item).then(ok => {
                if (ok) cerrar()
              })
            }
            pie={errorCuenta ? <Aviso tono="peligro">{errorCuenta}</Aviso> : undefined}
          />
        ),
      }}
    />
  )

  const selectorSedeCuenta = borrador.cuenta_id ? (
    <Selector
      etiqueta="Sede"
      valor={borrador.sede_id}
      placeholder="Elige la sede"
      opciones={sedesParaBorrador(borrador, catalogo).map(s => ({
        id: s.id,
        titulo: s.nombre,
        lateral: s.distancia_m !== null ? sinCortes(textoDistancia(s.distancia_m)) : null,
      }))}
      alElegir={id => props.alCambiar({ sede_id: id })}
      error={error('sede_id')}
      extra={<Boton titulo="Crear sede aquí" variante="texto" alPresionar={props.alCrearSede} />}
    />
  ) : (
    <Texto peque suave>
      Elige primero la cuenta.
    </Texto>
  )

  const selectorSubtipo = (
    <Selector
      etiqueta="Subtipo"
      valor={borrador.subtipo_id}
      placeholder="Elige el subtipo"
      opciones={catalogo.subtipos.map(s => ({ id: s.id, titulo: s.nombre }))}
      alElegir={id => props.alCambiar({ subtipo_id: id })}
      error={error('subtipo_id')}
      ayuda={ayudaSubtipo(borrador, catalogo)}
    />
  )

  const selectorContacto = borrador.cuenta_id ? (
    <Selector
      etiqueta="Contacto (opcional)"
      valor={borrador.contacto_id}
      placeholder={borrador.contacto_nombre_dicho ? `Dijiste "${borrador.contacto_nombre_dicho}"` : 'Sin contacto'}
      textoNinguno="Sin contacto"
      opciones={contactosParaBorrador(borrador, catalogo).map(contacto => ({
        id: contacto.id,
        titulo: contacto.nombre,
        detalle: contacto.cargo_texto,
      }))}
      alElegir={id => props.alCambiar({ contacto_id: id })}
      error={error('contacto_id')}
      vacio="Esta cuenta no tiene contactos en OpMap."
    />
  ) : null

  const bloqueModalidad = (
    <View style={{ gap: 8 }}>
      <Texto negrita>¿Cómo fue?</Texto>
      <Grupo>
        <Chip texto="Presencial" activo={borrador.modalidad === 'presencial'} alPresionar={() => props.alCambiar({ modalidad: 'presencial' })} />
        {config.telefonica.habilitada ? (
          <Chip texto="Telefónica" activo={borrador.modalidad === 'telefonica'} alPresionar={() => props.alCambiar({ modalidad: 'telefonica' })} />
        ) : null}
      </Grupo>
      {!config.telefonica.habilitada ? (
        <Texto peque suave>
          La visita telefónica no está habilitada para ti.
        </Texto>
      ) : null}
      {borrador.modalidad === 'telefonica' ? (
        <Grupo>
          {config.telefonica.medios.map(medio => (
            <Chip key={medio} texto={ETIQUETA_MEDIO[medio]} activo={borrador.medio === medio} alPresionar={() => props.alCambiar({ medio })} />
          ))}
        </Grupo>
      ) : null}
      {error('modalidad', 'medio') ? (
        <Texto peque color={c.peligro}>
          {error('modalidad', 'medio')}
        </Texto>
      ) : null}

      {borrador.modalidad === 'presencial' && !punto ? (
        <Aviso tono="alerta">La visita presencial necesita la ubicación del teléfono. Actualízala arriba o repórtala como telefónica.</Aviso>
      ) : null}
      {borrador.modalidad === 'presencial' && sedeSinUbicacion ? (
        <Aviso tono="alerta" titulo={MENSAJE_SEDE_SIN_UBICACION}>
          {salidas}
        </Aviso>
      ) : null}
      {borrador.modalidad === 'presencial' && fueraDelRadio && distancia?.distancia_m !== null && distancia?.distancia_m !== undefined && !rechazo ? (
        <Aviso tono="alerta" titulo="Estás lejos de la sede">
          <View style={{ gap: 8 }}>
            <Texto>
              Estás a {sinCortes(textoDistancia(distancia.distancia_m))} de {sedeTexto} (el radio es {sinCortes(textoDistancia(config.radio_m))}). La
              presencial solo se reporta en el sitio.
            </Texto>
            {salidas}
          </View>
        </Aviso>
      ) : null}
      {borrador.modalidad === 'presencial' && !fueraDelRadio && distancia?.distancia_m !== null && distancia?.distancia_m !== undefined ? (
        <Insignia texto={`A ${sinCortes(textoDistancia(distancia.distancia_m))}: dentro del radio`} tono="exito" />
      ) : null}
      {borrador.modalidad === 'presencial' && distancia && !distancia.conocida && borrador.sede_id ? (
        <Texto peque suave>
          La distancia a esta sede la calcula el servidor al confirmar.
        </Texto>
      ) : null}
    </View>
  )

  const campos = (solo?: readonly CampoVisita[]) => (
    <CamposVisita
      valores={{
        efectiva: borrador.efectiva,
        failure_reason: borrador.failure_reason,
        conclusion: borrador.conclusion,
        compromisos: borrador.compromisos,
        next_step_date: borrador.next_step_date,
        lineas: borrador.lineas,
      }}
      lineas={catalogo.lineas}
      alCambiar={props.alCambiar}
      errorDe={campo => error(campo)}
      dictado={{ tipo: borrador.tipo, disponible: !!props.dictadoDisponible }}
      solo={solo}
    />
  )

  /** Lo que se abre al tocar una fila del resumen: solo ese campo. */
  const editorDe = (campo: CampoResumen): ReactNode => {
    switch (campo) {
      case 'con_quien':
        return borrador.tipo === 'medica' ? (
          selectorMedico(true)
        ) : (
          <View style={{ gap: 12 }}>
            {selectorCuenta(true)}
            {selectorSubtipo}
            {selectorContacto}
          </View>
        )
      case 'sede':
        return (
          <View style={{ gap: 12 }}>
            {borrador.tipo === 'medica' ? selectorSedeMedico : selectorSedeCuenta}
            {bloqueModalidad}
          </View>
        )
      case 'resultado':
        return campos(['resultado'])
      case 'lineas':
        return campos(['lineas'])
      case 'conclusion':
        return campos(['conclusion'])
      case 'compromisos':
        return campos(['compromisos'])
      case 'proxima':
        return campos(['proxima'])
    }
  }

  const tocar = () => props.alTocar?.()
  /** Arriba, lo que hay que revisar: lo que falta al confirmar o, antes, lo dudoso de la voz (sin las preguntas, que van aparte). */
  const revisar = estado.intentado && !resultado.ok ? [] : borrador.origen === 'voz' ? decision.atencion.filter(a => a.campo !== 'preguntas') : []

  return (
    // Mientras se confirma (también mientras espera la ubicación final) la tarjeta no se toca: lo que se manda es lo
    // que hay en ella.
    <View style={[{ paddingTop: props.numero > 1 ? 16 : 0, borderTopWidth: props.numero > 1 ? 6 : 0, borderTopColor: c.superficieSuave }, estado.enviando ? { gap: 14, pointerEvents: 'none', opacity: 0.7 } : { gap: 14 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Texto peque media suave>
            Visita {props.numero} de {props.total}
          </Texto>
          {props.total > 1 ? (
            <View accessible={false} style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: props.total }, (_, i) => (
                <View key={i} style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: i < props.numero ? c.acento : c.agarradera }} />
              ))}
            </View>
          ) : null}
        </View>
        <Grupo>
          {borrador.agenda_id ? <Insignia texto="De tu agenda" tono="info" /> : null}
          <Insignia texto={borrador.origen === 'voz' ? 'Por voz' : 'Por toques'} tono="neutro" />
          {borrador.confianza !== null && borrador.confianza < 0.6 ? <Insignia texto="Revisa" tono="alerta" /> : null}
        </Grupo>
      </View>
      {borrador.agenda_id && props.cita && props.cita.id === borrador.agenda_id ? (
        <Texto peque suave>
          {`Cita ${props.cita.hora ? `de las ${textoHoraCita(props.cita.hora)}` : 'de hoy'} en ${props.cita.sede.nombre}${props.cita.anticipada ? '' : ' (agendada hoy: contará como no agendada)'}`}
        </Texto>
      ) : null}

      {rechazo ? (
        <Aviso tono="peligro" titulo="No se guardó">
          <View style={{ gap: 8 }}>
            <Texto>
              {rechazo.clase === 'radio' ? textoRechazoRadio(rechazo, sedeTexto) : rechazo.clase === 'cita' ? textoRechazoCita(rechazo.mensaje) : rechazo.mensaje}
            </Texto>
            {rechazo.clase === 'radio' || rechazo.clase === 'sede_sin_ubicacion' ? salidas : null}
          </View>
        </Aviso>
      ) : null}

      {estado.intentado && !resultado.ok ? (
        <Aviso tono="peligro" titulo="Falta algo">
          {resultado.errores.map(e => `• ${e.mensaje}`).join('\n')}
        </Aviso>
      ) : null}

      {!enResumen && revisar.length > 0 ? (
        <Aviso tono="alerta" titulo="Revisa antes de confirmar">
          {revisar.map(a => `• ${a.motivo}`).join('\n')}
        </Aviso>
      ) : null}

      {borrador.preguntas.length > 0 ? (
        <Aviso tono="info" titulo="La IA pregunta">
          {borrador.preguntas.map(pregunta => `• ${pregunta}`).join('\n')}
        </Aviso>
      ) : null}

      {enResumen ? (
        <View style={{ gap: 2 }}>
          {filasResumen(borrador, catalogo, { punto }).map(fila => (
            <FilaDelResumen
              key={fila.campo}
              fila={fila}
              abierta={editando === fila.campo}
              alPresionar={() => {
                tocar()
                setEditando(editando === fila.campo ? null : fila.campo)
              }}
            >
              {editando === fila.campo ? (
                <View style={{ gap: 10, paddingBottom: 8 }}>
                  {editorDe(fila.campo)}
                  <Boton titulo="Listo" variante="secundario" alPresionar={() => setEditando(null)} estilo={{ minHeight: ALTO_TOQUE_MIN }} />
                </View>
              ) : null}
            </FilaDelResumen>
          ))}
          <Boton
            titulo="Editar todo"
            variante="texto"
            alPresionar={() => {
              tocar()
              setEditando(null)
              setCompleta(true)
            }}
          />
        </View>
      ) : (
        <>
          {/* Tipo (con una cita no se muestra: el tipo es el de la cita) */}
          {!borrador.agenda_id ? bloqueTipo : null}

          {borrador.tipo === 'medica' ? (
            <View style={{ gap: 12 }}>
              {selectorMedico(!borrador.medico_id && !borrador.medico_nombre_dicho)}
              {medico ? selectorSedeMedico : null}
            </View>
          ) : null}

          {borrador.tipo === 'institucional' ? (
            <View style={{ gap: 12 }}>
              {selectorCuenta(!borrador.cuenta_id)}
              {borrador.cuenta_id ? selectorSedeCuenta : null}
              {selectorSubtipo}
              {selectorContacto}
            </View>
          ) : null}

          <Separador />

          {/* Modalidad */}
          {bloqueModalidad}

          <Separador />

          {campos()}
        </>
      )}

      {props.confirmarEnPie ? null : (
        <Boton titulo={textoPieConfirmar(props.numero, props.total)} variante="secundario" cargando={estado.enviando} alPresionar={props.alConfirmar} />
      )}
      {/* Aparte y en rojo (no junto a "Editar todo" con el mismo estilo); Reportar pregunta antes de borrar. */}
      <Boton titulo="Descartar esta visita" variante="peligro" deshabilitado={estado.enviando} alPresionar={props.alDescartar} estilo={{ marginTop: 6 }} />
    </View>
  )
}

/** Una fila del resumen: la etiqueta, el valor y "Cambiar"; tocarla abre debajo el campo para corregirlo. */
function FilaDelResumen({ fila, abierta, alPresionar, children }: { fila: FilaResumen; abierta: boolean; alPresionar: () => void; children?: ReactNode }) {
  const c = useColores()
  const fuente = useFuente()
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.borde }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${fila.etiqueta}: ${fila.valor}. ${abierta ? 'Toca para cerrar' : 'Toca para corregir'}`}
        accessibilityState={{ expanded: abierta }}
        onPress={alPresionar}
        style={({ pressed }) => ({ minHeight: ALTO_TOQUE_MIN, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[{ color: c.textoSuave, fontSize: 13, lineHeight: 16 }, fuente('media')]}>{fila.etiqueta}</Text>
          {/* Abierta, el valor está en el campo de abajo: no se repite. */}
          {abierta ? null : (
            <Texto media lineas={fila.lineas}>
              {fila.valor}
            </Texto>
          )}
        </View>
        <Text style={[{ color: c.texto, fontSize: 14, lineHeight: 20 }, fuente('negrita')]}>{abierta ? 'Cerrar' : 'Cambiar'}</Text>
      </Pressable>
      {children}
    </View>
  )
}

function cercaniaMedico(medico: MedicoOpcion): string | null {
  const distancias = medico.sedes.map(s => s.distancia_m).filter((d): d is number => d !== null)
  if (distancias.length === 0) return null
  return sinCortes(textoDistancia(Math.min(...distancias)))
}

function ayudaSubtipo(borrador: Borrador, catalogo: Catalogo): string | null {
  if (!borrador.contacto_id) return null
  const contacto = catalogo.contactos.find(x => x.id === borrador.contacto_id)
  const sugerido = contacto ? subtipoParaContacto(contacto, catalogo.subtipos) : null
  return sugerido ? `Sugerido por el cargo del contacto: ${sugerido.nombre}` : null
}

/** Sedes cercanas donde el médico aún no está: "Atiende aquí" lo vincula en OpMap y la deja elegida. */
function SedesSinVincular({ borrador, catalogo, alVincular }: { borrador: Borrador; catalogo: Catalogo; alVincular: (sedeId: string) => Promise<void> }) {
  const sedes = sedesCercanasSinVincular(borrador, catalogo)
    .filter(s => s.distancia_m !== null)
    .sort((a, b) => (a.distancia_m ?? 0) - (b.distancia_m ?? 0))
    .slice(0, 3)
  if (sedes.length === 0) return null
  return (
    <View style={{ gap: 8 }}>
      <Texto peque suave>
        ¿Lo viste en una sede cercana donde aún no aparece?
      </Texto>
      {sedes.map(sede => (
        <Boton
          key={sede.id}
          titulo={`Atiende en ${sede.nombre}`}
          detalle={sede.distancia_m !== null ? `A ${textoDistancia(sede.distancia_m)}: se agrega a sus sedes` : undefined}
          variante="secundario"
          alPresionar={() => void alVincular(sede.id)}
        />
      ))}
    </View>
  )
}
