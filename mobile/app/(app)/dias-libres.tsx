/**
 * Mis días libres (F2): registrar con la fecha límite del plazo a la vista, ver la lista y anular. Datos:
 * GET/POST /api/me/dias-libres y POST /api/me/dias-libres/[id]/anular. Las reglas (plazo de gracia, día hábil,
 * duplicados, motivos) las vuelve a revisar el servidor; aquí solo se muestran para no perder tiempo.
 *
 * Spec 2026-10-15: se abre desde Mi agenda y desde Ajustes (ya no es pestaña). La fecha se elige en el calendario del
 * mes (CalendarioMes), con los días libres marcados por estado y apagados los que ya pasaron del plazo. Registrar o
 * anular invalida el contexto en memoria (la meta de Hoy cambia).
 *
 * Revisión 2026-10-15: el calendario también marca las citas (de hoy a hoy + 30, GET /api/me/agenda) y, si el día que se
 * va a pedir libre tiene citas pendientes, lo dice con "Ver en Mi agenda" (no se bloquea: el servidor decide).
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { CalendarioMes } from '../../components/agenda/CalendarioMes'
import { rutaMiAgenda } from '../../lib/agenda'
import * as api from '../../lib/api'
import { invalidarContexto } from '../../lib/contexto-memoria'
import { aApiError, mensajeDeError, type ApiError } from '../../lib/errores'
import { fechaLarga, fechaRelativa, hoyBogota, puedeRegistrarDiaLibre, sumarDias, textoLimiteLargo, venceRegistroDiaLibre } from '../../lib/fechas'
import { avisoCitasEnDiaLibre, marcasConCitas, marcasDiasLibres, primerDiaRegistrable } from '../../lib/pantallas'
import { ejecutivaPuedeAnular, ordenarDiasLibres, textoFraccion } from '../../lib/reglas'
import type { CitaItem, DiaLibreItem, EstadoDiaLibre, MisDiasLibresResponse } from '../../lib/tipos'
import { ETIQUETA_ESTADO_DIA_LIBRE, MAX_DIAS_CONSULTA_AGENDA } from '../../lib/tipos'
import { Aviso, Boton, Campo, Cargando, Chip, Grupo, Insignia, Pantalla, Subtitulo, Texto, confirmar, useColores, type Tono } from '../../lib/ui'

const DIAS_ATRAS = 90

const TONO_ESTADO: Record<EstadoDiaLibre, Tono> = {
  registrado: 'exito',
  aprobado: 'exito',
  por_aprobar: 'alerta',
  rechazado: 'peligro',
  anulado: 'neutro',
}

export default function DiasLibres() {
  const c = useColores()
  const router = useRouter()
  const [datos, setDatos] = useState<MisDiasLibresResponse | null>(null)
  /** Citas de hoy a hoy + 30 (las que se pueden tener por delante): solo para marcar y avisar. */
  const [citas, setCitas] = useState<CitaItem[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const [fecha, setFecha] = useState(() => hoyBogota())
  const [fraccion, setFraccion] = useState<1 | 0.5>(1)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: Tono; texto: string } | null>(null)
  const [anulando, setAnulando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    // Las citas solo marcan el calendario y avisan: si fallan (o no está la agenda), la pantalla sigue igual. Una sola
    // consulta (la agenda ya no tiene tope hacia adelante: se marcan los próximos 31 días, el máximo por consulta).
    const hoyAhora = hoyBogota()
    void api.agenda(hoyAhora, sumarDias(hoyAhora, MAX_DIAS_CONSULTA_AGENDA - 1)).then(
      r => setCitas(r.items),
      () => undefined
    )
    try {
      const respuesta = await api.diasLibres(sumarDias(hoyBogota(), -DIAS_ATRAS))
      setDatos(respuesta)
      setError(null)
      setMotivo(actual => actual ?? respuesta.motivos[0]?.codigo ?? null)
    } catch (e) {
      setError(aApiError(e))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const hoy = hoyBogota()
  const plazoHoras = datos?.plazo_horas ?? 24
  const primerDia = primerDiaRegistrable(hoy, plazoHoras)
  const marcas = useMemo(() => marcasConCitas(marcasDiasLibres(datos?.items ?? []), citas), [datos, citas])
  const conCitas = avisoCitasEnDiaLibre(fecha, citas)
  const vence = useMemo(() => venceRegistroDiaLibre(fecha, plazoHoras), [fecha, plazoHoras])
  const dentroDePlazo = puedeRegistrarDiaLibre(fecha, plazoHoras)
  const yaRegistrado = (datos?.items ?? []).some(d => d.fecha === fecha && d.estado !== 'anulado' && d.estado !== 'rechazado')
  const puedeGuardar = !!datos && !!motivo && dentroDePlazo && !yaRegistrado && !guardando

  async function registrar() {
    if (!puedeGuardar || !motivo) return
    setGuardando(true)
    setMensaje(null)
    try {
      const { dia } = await api.crearDiaLibre({ fecha, fraccion, motivo, nota: nota.trim() ? nota.trim() : null })
      invalidarContexto('dia_libre')
      setNota('')
      setMensaje({
        tono: 'exito',
        texto:
          dia.estado === 'por_aprobar'
            ? `Registrado el ${fechaLarga(dia.fecha)}: queda por aprobar.`
            : `Registrado el ${fechaLarga(dia.fecha)}.`,
      })
      await cargar()
    } catch (e) {
      setMensaje({ tono: 'peligro', texto: mensajeDeError(e) })
    } finally {
      setGuardando(false)
    }
  }

  async function anular(dia: DiaLibreItem) {
    const si = await confirmar('Anular día libre', `¿Anular el día libre del ${fechaLarga(dia.fecha)}?`, 'Anular', true)
    if (!si) return
    setAnulando(dia.id)
    setMensaje(null)
    try {
      await api.anularDiaLibre(dia.id)
      invalidarContexto('dia_libre')
      setMensaje({ tono: 'info', texto: `Anulado el día libre del ${fechaLarga(dia.fecha)}.` })
      await cargar()
    } catch (e) {
      setMensaje({ tono: 'peligro', texto: mensajeDeError(e) })
    } finally {
      setAnulando(null)
    }
  }

  if (cargando && !datos) return <Cargando texto="Cargando tus días libres…" />

  const lista = ordenarDiasLibres(datos?.items ?? [], hoy)

  return (
    <Pantalla
      alRefrescar={() => {
        setRefrescando(true)
        void cargar()
      }}
      refrescando={refrescando}
    >
      {error && !datos ? (
        <Aviso
          tono={error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'}
          accion={
            <Boton
              titulo="Reintentar"
              variante="secundario"
              alPresionar={() => {
                setRefrescando(true)
                void cargar()
              }}
            />
          }
        >
          {error.message}
        </Aviso>
      ) : null}

      {datos ? (
        <View style={{ gap: 10 }}>
          <Subtitulo>Registrar un día libre</Subtitulo>

          <Etiqueta texto="Fecha" />
          <CalendarioMes valor={fecha} alCambiar={setFecha} hoy={hoy} desde={primerDia} marcas={marcas} vista="mes" />
          <Texto negrita>{`${capitalizar(fechaLarga(fecha))} (${fechaRelativa(fecha)})`}</Texto>

          {dentroDePlazo ? (
            <Texto suave peque>
              Puedes registrarlo hasta el {textoLimiteLargo(vence)} (hora de Colombia).
            </Texto>
          ) : (
            <Aviso tono="peligro">{`Ya pasó el plazo para registrar ese día: se podía hasta el ${textoLimiteLargo(vence)} (hora de Colombia).`}</Aviso>
          )}
          {yaRegistrado ? <Aviso tono="alerta">Ya tienes un día libre registrado en esa fecha.</Aviso> : null}
          {conCitas ? (
            <Aviso tono="alerta" accion={<Boton titulo="Ver en Mi agenda" variante="secundario" alPresionar={() => router.push(rutaMiAgenda(fecha))} />}>
              {conCitas}
            </Aviso>
          ) : null}

          <Etiqueta texto="Cuánto" />
          <Grupo>
            <Chip texto="Día completo" activo={fraccion === 1} alPresionar={() => setFraccion(1)} />
            <Chip texto="Medio día" activo={fraccion === 0.5} alPresionar={() => setFraccion(0.5)} />
          </Grupo>

          <Etiqueta texto="Motivo" />
          <Grupo>
            {datos.motivos.map(m => (
              <Chip key={m.codigo} texto={m.nombre} activo={motivo === m.codigo} alPresionar={() => setMotivo(m.codigo)} />
            ))}
          </Grupo>

          <Campo etiqueta="Nota (opcional)" valor={nota} alCambiar={setNota} varias maxLength={500} placeholder="Algo que tu líder deba saber" />

          {datos.requiere_aprobacion ? (
            <Texto suave peque>
              Tu día libre queda por aprobar hasta que lo apruebe tu líder o recursos humanos.
            </Texto>
          ) : null}

          {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

          <Boton titulo="Registrar día libre" alPresionar={registrar} cargando={guardando} deshabilitado={!puedeGuardar} />
        </View>
      ) : null}

      {datos ? <Subtitulo estilo={{ borderTopWidth: 1, borderTopColor: c.borde, paddingTop: 16 }}>Registrados</Subtitulo> : null}
      {!datos ? null : lista.length === 0 ? (
        <Texto suave>No tienes días libres en los últimos {DIAS_ATRAS} días ni por venir.</Texto>
      ) : (
        lista.map((dia, i) => (
          <View key={dia.id} style={{ gap: 6, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.borde }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flexShrink: 1, gap: 2 }}>
                <Texto negrita>{capitalizar(fechaLarga(dia.fecha))}</Texto>
                <Texto suave peque>
                  {textoFraccion(dia.fraccion)} · {dia.motivo_nombre}
                </Texto>
              </View>
              <Insignia texto={ETIQUETA_ESTADO_DIA_LIBRE[dia.estado]} tono={TONO_ESTADO[dia.estado]} />
            </View>
            {dia.nota ? <Texto peque>{dia.nota}</Texto> : null}
            {dia.motivo_revision && (dia.estado === 'rechazado' || dia.estado === 'anulado') ? (
              <Texto suave peque>
                {dia.motivo_revision}
              </Texto>
            ) : null}
            {ejecutivaPuedeAnular(dia, hoy) ? (
              <Boton titulo="Anular" variante="peligro" compacto cargando={anulando === dia.id} alPresionar={() => void anular(dia)} />
            ) : null}
          </View>
        ))
      )}
    </Pantalla>
  )
}

/** Rótulo de un campo del formulario ("Fecha", "Cuánto", "Motivo"): 13 en negrita, gris. */
function Etiqueta({ texto }: { texto: string }) {
  const c = useColores()
  return (
    <Texto peque negrita color={c.textoSuave} estilo={{ fontSize: 13, lineHeight: 16, marginTop: 6 }}>
      {texto}
    </Texto>
  )
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
