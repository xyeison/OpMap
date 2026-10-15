/**
 * Una visita de la app: verla y, el MISMO día, corregir lo que la ejecutiva escribe (efectiva y motivo, conclusión,
 * compromisos, próxima reunión, líneas) o anularla con motivo (decisión 10 del contrato fase 8). No se cambian tipo,
 * médico, cuenta ni sede: para eso se anula y se vuelve a reportar. Datos: GET /api/me/visitas?fecha= (la de hoy o
 * la que se pase en ?fecha=, p. ej. desde un compromiso vencido), PATCH /api/me/visitas/[id] y
 * POST /api/me/visitas/[id]/anular. Las líneas se nombran con GET /api/me/contexto. Nunca documentos.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { CamposVisita, type ValoresCampos } from '../../../components/reporte/CamposVisita'
import * as api from '../../../lib/api'
import { aApiError, mensajeDeError, type ApiError } from '../../../lib/errores'
import { SoloEnFoco } from '../../../lib/montaje'
import { esFechaIso, fechaCorta, horaBogota, hoyBogota } from '../../../lib/fechas'
import { textoDistancia } from '../../../lib/geo'
import { MAX_FAILURE_REASON, MENSAJE_PROXIMA_ANTES_DE_VISITA, cambiosDeVisita, proximaAntesDeLaVisita, valoresDeVisita } from '../../../lib/propuesta'
import { conQuien, detalleModalidad, numeroTexto } from '../../../lib/reglas'
import { ETIQUETA_TIPO_VISITA, type LineaEjecutiva, type VisitaItem } from '../../../lib/tipos'
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
  const [visita, setVisita] = useState<VisitaItem | null>(null)
  const [lineas, setLineas] = useState<LineaEjecutiva[]>([])
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
      const [respuesta, contexto] = await Promise.all([api.visitas(fecha), api.contexto(null).catch(() => null)])
      const encontrada = respuesta.items.find(v => v.id === id) ?? null
      setVisita(encontrada)
      setValores(encontrada ? valoresDeVisita(encontrada) : null)
      if (contexto) setLineas(contexto.ejecutiva.lineas)
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
        <Fila
          etiqueta="Cuenta para"
          valor={
            visita.sede_por_confirmar
              ? 'Suma cuando data manager confirme la sede'
              : visita.cuenta_para
                ? `${ETIQUETA_CUENTA_PARA[visita.cuenta_para]}${visita.peso !== 1 ? ` (×${numeroTexto(visita.peso)})` : ''}`
                : 'No suma'
          }
        />
        <Grupo>
          {visita.out_of_territory ? <Insignia texto="Fuera de tu territorio" tono="info" /> : null}
          {visita.sede_por_confirmar ? <Insignia texto="Sede por confirmar" tono="alerta" /> : null}
          <Insignia texto={visita.input_mode === 'voz' ? 'Por voz' : 'Por toques'} />
          {visita.lineas.map(l => (
            <Insignia key={l} texto={nombreLinea(l)} />
          ))}
        </Grupo>
      </Tarjeta>

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
          {visita.conclusion ? <Fila etiqueta="Conclusión" valor={visita.conclusion} /> : null}
          {visita.compromisos ? <Fila etiqueta="Compromisos" valor={visita.compromisos} /> : null}
          {visita.next_step_date ? <Fila etiqueta="Próxima reunión" valor={fechaCorta(visita.next_step_date)} /> : null}
          {!visita.efectiva && visita.failure_reason ? <Fila etiqueta="Motivo" valor={visita.failure_reason} /> : null}
          <Aviso tono="info">Solo se corrigen o anulan las visitas del mismo día. Si hay un error, avísale a tu líder.</Aviso>
        </>
      )}
    </Pantalla>
  )
}
