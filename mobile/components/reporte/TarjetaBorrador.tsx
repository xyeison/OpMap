/**
 * Una visita por confirmar (propuesta por la voz o por toques), editable con una mano: tipo, médico y su sede, o
 * cuenta, sede, subtipo y contacto; presencial o telefónica (con la distancia a la sede y el radio vigente); si fue
 * efectiva, conclusión, compromisos, próxima reunión y líneas. "Confirmar" la manda (o la guarda sin señal); nada se
 * guarda sin ese toque. Reglas visibles del contrato fase 8: presencial bloqueada fuera del radio con las salidas
 * (telefónica si está habilitada y con cupo, o crear la sede aquí), telefónica solo si está habilitada, médico que no
 * está en OpMap → "Crear médico completo" (documento digitado). Nunca muestra documentos.
 */
import { useState } from 'react'
import { View } from 'react-native'
import * as api from '../../lib/api'
import { mensajeDeError } from '../../lib/errores'
import { textoDistancia, type Punto } from '../../lib/geo'
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
import { etiquetaClaseCuenta, etiquetaEspecialidad } from '../../lib/terceros'
import { ETIQUETA_MEDIO, ETIQUETA_TIPO_VISITA, type CitaItem, type CuentaListItem, type MedicoPublico, type TipoVisita } from '../../lib/tipos'
import { Aviso, Boton, Chip, Grupo, Insignia, Separador, Tarjeta, Texto, useColores } from '../../lib/ui'
import { Buscador } from './Buscador'
import { CamposVisita } from './CamposVisita'
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
}

export function TarjetaBorrador(props: Props) {
  const { borrador, catalogo, punto, estado } = props
  const c = useColores()
  const config = catalogo.config
  const resultado = validarBorrador(borrador, catalogo, {
    punto,
    checked_in_at: props.checkedInAt,
    ahora: new Date(),
    visitasHoy: props.visitasHoy,
  })
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

  const agregarCuenta = async (item: CuentaListItem) => {
    setErrorCuenta(null)
    try {
      const detalle = await api.cuenta(item.id)
      const activas = sedesDeCuentaBuscada(item, detalle.sedes)
      if (activas.length === 0) {
        setErrorCuenta('Esa cuenta no tiene sedes activas: crea la sede aquí o elige otra cuenta.')
        return
      }
      props.alAgregarSedes(activas)
      props.alCambiar({ cuenta_id: item.id, sede_id: null })
    } catch (lanzado) {
      setErrorCuenta(mensajeDeError(lanzado))
    }
  }

  const salidas = (
    <Grupo>
      {ofreceTelefonica ? <Boton titulo="Cambiar a telefónica" variante="secundario" alPresionar={() => props.alCambiar({ modalidad: 'telefonica' })} /> : null}
      <Boton titulo="Crear sede aquí" variante="secundario" alPresionar={props.alCrearSede} />
    </Grupo>
  )

  return (
    <Tarjeta estilo={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Texto negrita>
          Visita {props.numero} de {props.total}
        </Texto>
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

      {borrador.preguntas.length > 0 ? (
        <Aviso tono="info" titulo="Revisa">
          {borrador.preguntas.map(pregunta => `• ${pregunta}`).join('\n')}
        </Aviso>
      ) : null}

      {/* Tipo */}
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

      {borrador.tipo === 'medica' ? (
        <View style={{ gap: 12 }}>
          {borrador.medico_nombre_dicho && !borrador.medico_id ? (
            <Aviso tono="alerta" titulo={`"${borrador.medico_nombre_dicho}" no está entre tus médicos`}>
              <View style={{ gap: 8 }}>
                <Texto peque>Búscalo en OpMap o créalo completo (con su documento, que se digita).</Texto>
                <Boton titulo="Crear médico completo" variante="secundario" alPresionar={props.alCrearMedico} />
              </View>
            </Aviso>
          ) : null}
          <Selector
            etiqueta="Médico"
            valor={borrador.medico_id}
            placeholder="Elige el médico"
            opciones={catalogo.medicos.map(m => ({
              id: m.id,
              titulo: m.nombre,
              detalle: m.especialidades.map(etiquetaEspecialidad).join(', ') || null,
              lateral: m.propio ? cercaniaMedico(m) : 'Fuera de tu territorio',
            }))}
            alElegir={id => props.alCambiar({ medico_id: id })}
            error={error('medico_id')}
            vacio="Aún no tienes médicos asignados: búscalo abajo o créalo."
            abiertoInicial={!borrador.medico_id && !borrador.medico_nombre_dicho}
            tituloElegido={medico?.nombre ?? null}
            extra={
              <Buscador<MedicoPublico>
                etiqueta="Buscar otro médico en OpMap"
                placeholder="Nombre del médico"
                buscar={async q => (await api.buscarMedicos(q)).items}
                clave={item => item.id}
                titulo={item => item.nombre}
                detalle={item => [item.especialidades.map(etiquetaEspecialidad).join(', '), item.ciudad].filter(Boolean).join(' · ') || null}
                alElegir={item => props.alAgregarMedico(medicoDesdeBusqueda(item, catalogo))}
                pie={<Boton titulo="Crear médico completo" variante="texto" alPresionar={props.alCrearMedico} />}
              />
            }
          />
          {avisoVisitante(medico) ? (
            <Texto peque suave>
              {avisoVisitante(medico)}
            </Texto>
          ) : null}
          {medico ? (
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
          ) : null}
        </View>
      ) : null}

      {borrador.tipo === 'institucional' ? (
        <View style={{ gap: 12 }}>
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
            vacio="No hay cuentas cerca: búscala abajo."
            abiertoInicial={!borrador.cuenta_id}
            extra={
              <Buscador<CuentaListItem>
                etiqueta="Buscar otra cuenta"
                placeholder="Nombre de la clínica, EPS…"
                buscar={async q => (await api.buscarCuentas(q)).items}
                clave={item => item.id}
                titulo={item => item.nombre}
                detalle={item => `${etiquetaClaseCuenta(item.clase)} · ${item.sedes} ${item.sedes === 1 ? 'sede' : 'sedes'}`}
                alElegir={item => void agregarCuenta(item)}
                pie={errorCuenta ? <Aviso tono="peligro">{errorCuenta}</Aviso> : undefined}
              />
            }
          />
          {borrador.cuenta_id ? (
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
          ) : null}
          <Selector
            etiqueta="Subtipo"
            valor={borrador.subtipo_id}
            placeholder="Elige el subtipo"
            opciones={catalogo.subtipos.map(s => ({ id: s.id, titulo: s.nombre }))}
            alElegir={id => props.alCambiar({ subtipo_id: id })}
            error={error('subtipo_id')}
            ayuda={ayudaSubtipo(borrador, catalogo)}
          />
          {borrador.cuenta_id ? (
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
          ) : null}
        </View>
      ) : null}

      <Separador />

      {/* Modalidad */}
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

      <Separador />

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
      />

      {estado.intentado && !resultado.ok ? (
        <Aviso tono="peligro" titulo="Falta algo">
          {resultado.errores.map(e => `• ${e.mensaje}`).join('\n')}
        </Aviso>
      ) : null}

      <Boton titulo="Confirmar esta visita" grande cargando={estado.enviando} alPresionar={props.alConfirmar} />
      <Boton titulo="Descartar" variante="texto" deshabilitado={estado.enviando} alPresionar={props.alDescartar} />
    </Tarjeta>
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
