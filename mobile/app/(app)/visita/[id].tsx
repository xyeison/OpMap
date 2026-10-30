/**
 * Una visita de la app: verla y, el MISMO día, corregir lo que la ejecutiva escribe (efectiva y motivo, conclusión,
 * compromisos, próxima reunión, líneas) o anularla con motivo (decisión 10 del contrato fase 8). No se cambian tipo,
 * médico, cuenta ni sede: para eso se anula y se vuelve a reportar. Datos: GET /api/me/visitas?fecha= (la de hoy o
 * la que se pase en ?fecha=, p. ej. desde un compromiso vencido), PATCH /api/me/visitas/[id] y
 * POST /api/me/visitas/[id]/anular. Las líneas se nombran con GET /api/me/contexto. Nunca documentos.
 *
 * Spec 2026-10-15: las líneas y la voz salen del contexto en memoria si tiene menos de 10 min (contextoReciente) y solo
 * si no hay, de GET /api/me/contexto. Los textos largos (conclusión, compromisos, motivo) van con la etiqueta arriba y a
 * todo el ancho. Con la próxima reunión de hoy en adelante (sin tope desde la 0850), "Agendar la próxima reunión" abre
 * Agendar con la fecha y con quién (en memoria: fijarPedidoAgendar).
 *
 * F1b: "Cuenta para" (a qué meta suma) solo con cuota (tieneCuota de lib/persona.ts): una líder sin Ejecutivo Comercial
 * no tiene metas (C4), aunque el servidor diga a qué tipo sumaría.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { CamposVisita, type ValoresCampos } from '../../../components/reporte/CamposVisita'
import { fijarPedidoAgendar, puedeAgendarProxima, rutaAgendar } from '../../../lib/agenda'
import * as api from '../../../lib/api'
import { FRESCURA_DATOS_FIJOS_MS, contextoReciente } from '../../../lib/contexto-memoria'
import { aApiError, mensajeDeError, type ApiError } from '../../../lib/errores'
import { SoloEnFoco } from '../../../lib/montaje'
import { esFechaIso, fechaCorta, fechaLarga, horaBogota, hoyBogota } from '../../../lib/fechas'
import { textoDistancia } from '../../../lib/geo'
import { tieneCuota } from '../../../lib/persona'
import { MAX_FAILURE_REASON, MENSAJE_PROXIMA_ANTES_DE_VISITA, cambiosDeVisita, proximaAntesDeLaVisita, valoresDeVisita } from '../../../lib/propuesta'
import { conQuien, detalleModalidad, numeroTexto } from '../../../lib/reglas'
import { useSesion } from '../../../lib/sesion'
import { ETIQUETA_TIPO_VISITA, type LineaEjecutiva, type PersonaMovil, type VisitaItem } from '../../../lib/tipos'
import { Aviso, Boton, Campo, Cargando, Fila, Grupo, Insignia, Pantalla, Separador, Subtitulo, Tarjeta, Texto, Titulo, confirmar } from '../../../lib/ui'

const ETIQUETA_CUENTA_PARA: Record<NonNullable<VisitaItem['cuenta_para']>, string> = {
  medica: 'Suma a la meta médica',
  institucional: 'Suma a la meta institucional',
  subtipo: 'Suma a la meta de su subtipo',
}

/**
 * Pestaña oculta: se monta de cero cada vez que se abre y cada vez que cambia la visita (si no, tras anular una, la
 * siguiente que se abriera diría "Visita anulada" y arrastraría el mensaje y el motivo).
 */
export default function PantallaVisita() {
  const params = useLocalSearchParams<{ id: string; fecha?: string }>()
  const id = typeof params.id === 'string' ? params.id : ''
  const fecha = typeof params.fecha === 'string' && esFechaIso(params.fecha) ? params.fecha : hoyBogota()
  return (
    <SoloEnFoco clave={`${id}|${fecha}`}>
      <Visita id={id} fecha={fecha} />
    </SoloEnFoco>
  )
}

function Visita({ id, fecha }: { id: string; fecha: string }) {
  const router = useRouter()
  const { perfil } = useSesion()
  const [visita, setVisita] = useState<VisitaItem | null>(null)
  const [lineas, setLineas] = useState<LineaEjecutiva[]>([])
  /** La persona del contexto (un servidor sin la 0850 no la manda: undefined); si no, la de la sesión. */
  const [personaContexto, setPersonaContexto] = useState<PersonaMovil | null | undefined>(undefined)
  // Micrófono junto a Conclusión (F4.1): solo si el servidor tiene la voz configurada (contexto.voz).
  const [vozDisponible, setVozDisponible] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const [valores, setValores] = useState<ValoresCampos | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null)
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [anulada, setAnulada] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      // Líneas y voz no dependen del punto: sirve el contexto en memoria de menos de 10 min; si no hay, se pide sin punto.
      const enMemoria = contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS })
      const [respuesta, contexto] = await Promise.all([api.visitas(fecha), enMemoria ? Promise.resolve(enMemoria.contexto) : api.contexto(null).catch(() => null)])
      const encontrada = respuesta.items.find(v => v.id === id) ?? null
      setVisita(encontrada)
      setValores(encontrada ? valoresDeVisita(encontrada) : null)
      if (contexto) setLineas(contexto.ejecutiva.lineas)
      if (contexto) setPersonaContexto(contexto.persona)
      setVozDisponible(Boolean(contexto && contexto.voz.transcribir && contexto.voz.proponer))
      setError(null)
    } catch (lanzado) {
      setError(aApiError(lanzado))
    } finally {
      setCargando(false)
    }
  }, [fecha, id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /** ¿Tiene cuota? (C4: solo con Ejecutivo Comercial.) Sin la persona, según su Ejecutivo Comercial enlazado. */
  const conCuota = tieneCuota({ persona: personaContexto ?? perfil?.persona, ejecutiva: perfil?.ejecutiva })

  if (cargando && !visita) return <Cargando texto="Cargando la visita…" />
  if (error && !visita) {
    return (
      <Pantalla>
        <Aviso tono="peligro" accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void cargar()} />}>
          {error.message}
        </Aviso>
      </Pantalla>
    )
  }
  if (anulada) {
    return (
      <Pantalla>
        <Titulo>Visita anulada</Titulo>
        <Aviso tono="exito">La visita quedó anulada con tu motivo: ya no cuenta para tus números ni para los topes de hoy.</Aviso>
        <Boton titulo="Volver a Hoy" grande alPresionar={() => router.replace('/hoy')} />
      </Pantalla>
    )
  }
  if (!visita || !valores) {
    return (
      <Pantalla>
        <Aviso tono="info" titulo="No encontré esa visita">
          {`No está entre tus visitas del ${fechaCorta(fecha)}. Si la anulaste, ya no aparece.`}
        </Aviso>
        <Boton titulo="Volver a Hoy" variante="secundario" alPresionar={() => router.replace('/hoy')} />
      </Pantalla>
    )
  }

  const cambios = cambiosDeVisita(visita, valores)
  const hayCambios = Object.keys(cambios).length > 0
  const nombreLinea = (lineaId: string) => lineas.find(l => l.id === lineaId)?.name ?? 'Línea'
  const proxima = visita.next_step_date
  const agendarProxima =
    proxima && puedeAgendarProxima(proxima, hoyBogota())
      ? () => {
          // Con quién va en memoria (nunca ids en la URL); la fecha, en la ruta. La hora la elige Agendar.
          fijarPedidoAgendar({ tipo: visita.tipo, medico_id: visita.medico?.id ?? null, cuenta_id: visita.cuenta?.id ?? null, subtipo_id: visita.subtipo?.id ?? null, sede_id: visita.sede.id })
          router.push(rutaAgendar({ fecha: proxima }))
        }
      : null

  const guardar = async () => {
    if (!valores.efectiva && !valores.failure_reason.trim()) {
      setMensaje({ tono: 'peligro', texto: `Indica el motivo de la visita no efectiva (hasta ${MAX_FAILURE_REASON} caracteres)` })
      return
    }
    if (proximaAntesDeLaVisita(valores.next_step_date.trim(), visita.checked_in_at)) {
      setMensaje({ tono: 'peligro', texto: MENSAJE_PROXIMA_ANTES_DE_VISITA })
      return
    }
    setGuardando(true)
    setMensaje(null)
    try {
      const { visita: nueva } = await api.editarVisita(visita.id, cambios)
      setVisita(nueva)
      setValores(valoresDeVisita(nueva))
      setMensaje({ tono: 'exito', texto: 'Corrección guardada.' })
    } catch (lanzado) {
      setMensaje({ tono: 'peligro', texto: mensajeDeError(lanzado) })
    } finally {
      setGuardando(false)
    }
  }

  const anular = async () => {
    const texto = motivo.trim()
    if (texto.length < 5) {
      setMensaje({ tono: 'peligro', texto: 'Escribe el motivo (al menos 5 caracteres)' })
      return
    }
    const si = await confirmar('¿Anular la visita?', 'Queda anulada con tu motivo y ya no cuenta. No se puede deshacer.', 'Anular', true)
    if (!si) return
    setGuardando(true)
    try {
      await api.anularVisita(visita.id, texto)
      setAnulada(true)
    } catch (lanzado) {
      setMensaje({ tono: 'peligro', texto: mensajeDeError(lanzado) })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Pantalla alRefrescar={() => void cargar()} refrescando={cargando}>
      <View style={{ gap: 4 }}>
        <Texto suave>
          {ETIQUETA_TIPO_VISITA[visita.tipo]} · {fechaCorta(fecha)} {horaBogota(visita.checked_in_at)}
        </Texto>
        <Titulo>{conQuien(visita)}</Titulo>
        <Texto suave>{visita.sede.nombre}</Texto>
      </View>

      <Tarjeta>
        <Fila etiqueta="Modalidad" valor={detalleModalidad(visita, textoDistancia)} />
        {visita.contacto ? <Fila etiqueta="Contacto" valor={visita.contacto.nombre} /> : null}
        <Fila etiqueta="Resultado" valor={visita.efectiva ? 'Efectiva' : 'No efectiva'} fuerte />
        {/* Sin cuota (una líder sin Ejecutivo Comercial, C4) no hay meta a la que sumar. */}
        {conCuota ? (
          <Apilado etiqueta="Cuenta para">
            {visita.sede_por_confirmar
              ? 'Suma cuando el equipo de datos confirme la sede'
              : visita.cuenta_para
                ? `${ETIQUETA_CUENTA_PARA[visita.cuenta_para]}${visita.peso !== 1 ? ` (×${numeroTexto(visita.peso)})` : ''}`
                : 'No suma'}
          </Apilado>
        ) : null}
        <Grupo>
          {visita.out_of_territory ? <Insignia texto="Fuera de tu territorio" tono="info" /> : null}
          {visita.sede_por_confirmar ? <Insignia texto="Sede por confirmar" tono="alerta" /> : null}
          <Insignia texto={visita.input_mode === 'voz' ? 'Por voz' : 'Por toques'} />
          {visita.lineas.map(l => (
            <Insignia key={l} texto={nombreLinea(l)} />
          ))}
        </Grupo>
      </Tarjeta>

      {agendarProxima && proxima ? (
        <Boton titulo="Agendar la próxima reunión" detalle={capitalizar(fechaLarga(proxima))} variante="secundario" alPresionar={agendarProxima} />
      ) : null}

      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

      {visita.editable ? (
        <>
          <Tarjeta estilo={{ gap: 14 }}>
            <Subtitulo>Corregir (solo hoy)</Subtitulo>
            <CamposVisita
              valores={valores}
              lineas={lineas}
              alCambiar={c => setValores(prev => (prev ? { ...prev, ...c } : prev))}
              dictado={{ tipo: visita.tipo, disponible: vozDisponible }}
            />
            <Boton titulo="Guardar corrección" grande cargando={guardando} deshabilitado={!hayCambios} alPresionar={() => void guardar()} />
            <Texto peque suave>
              Para cambiar el médico, la cuenta o la sede, anúlala y vuelve a reportarla.
            </Texto>
          </Tarjeta>

          <Tarjeta estilo={{ gap: 10 }}>
            <Subtitulo>Anular</Subtitulo>
            {anulando ? (
              <>
                <Campo etiqueta="Motivo (obligatorio)" valor={motivo} alCambiar={setMotivo} maxLength={300} placeholder="Me equivoqué de médico, la reporté dos veces…" />
                <Boton titulo="Anular la visita" variante="peligro" cargando={guardando} alPresionar={() => void anular()} />
                <Boton titulo="Cancelar" variante="texto" alPresionar={() => setAnulando(false)} />
              </>
            ) : (
              <Boton titulo="Anular esta visita" variante="secundario" alPresionar={() => setAnulando(true)} />
            )}
          </Tarjeta>
        </>
      ) : (
        <>
          <Separador />
          {visita.conclusion ? <Apilado etiqueta="Conclusión">{visita.conclusion}</Apilado> : null}
          {visita.compromisos ? <Apilado etiqueta="Compromisos">{visita.compromisos}</Apilado> : null}
          {visita.next_step_date ? <Fila etiqueta="Próxima reunión" valor={fechaCorta(visita.next_step_date)} /> : null}
          {!visita.efectiva && visita.failure_reason ? <Apilado etiqueta="Motivo">{visita.failure_reason}</Apilado> : null}
          <Aviso tono="info">Solo se corrigen o anulan las visitas del mismo día. Si hay un error, avísale a tu líder.</Aviso>
        </>
      )}
    </Pantalla>
  )
}

/** Texto largo con la etiqueta arriba y el texto a todo el ancho (Fila los deja en una columna angosta). */
function Apilado({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <Texto suave peque>
        {etiqueta}
      </Texto>
      <Texto>{children}</Texto>
    </View>
  )
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
