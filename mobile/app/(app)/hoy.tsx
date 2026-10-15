/**
 * Hoy: meta del día frente a lo hecho, botón grande "Reportar", la agenda de hoy (F4.1: hora, con quién, sede y si ya
 * se hizo, con "Agendar" y "Ver agenda"), visitas guardadas sin señal, compromisos vencidos y las visitas de hoy. Datos: POST /api/me/contexto (con la ubicación en el cuerpo si el teléfono la da;
 * se guarda en el teléfono para reportar sin señal) y GET /api/me/visitas?fecha=hoy. Si el servidor todavía no tiene
 * el reporte de visitas (404/503), se muestra el aviso y la cola sigue funcionando. Una visita de la cola que el
 * servidor no aceptó hoy se puede "Reportar de nuevo" (vuelve a Reportar como tarjeta, sin perder lo escrito).
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { View } from 'react-native'
import { FilaCita } from '../../components/reporte/FilaCita'
import * as api from '../../lib/api'
import { useCola } from '../../lib/cola-contexto'
import { guardarContexto } from '../../lib/contexto-guardado'
import { aApiError, esNoDisponible, type ApiError } from '../../lib/errores'
import { fechaCorta, fechaLarga, horaBogota, hoyBogota } from '../../lib/fechas'
import { textoDistancia, textoPrecision } from '../../lib/geo'
import { avance, conQuien, conQuienCita, detalleModalidad, fraccionBarra, numeroTexto, plural } from '../../lib/reglas'
import { fijarReintento } from '../../lib/retorno'
import { useSesion } from '../../lib/sesion'
import type { CitaItem, ContextoResponse, VisitaItem, VisitasResponse } from '../../lib/tipos'
import { ETIQUETA_TIPO_VISITA } from '../../lib/tipos'
import { pedirUbicacionEnDosPasos, type ResultadoUbicacion } from '../../lib/ubicacion'
import { Aviso, Barra, Boton, Cargando, Fila, Grupo, Insignia, Pantalla, Subtitulo, Tarjeta, Texto, Titulo, Vacio } from '../../lib/ui'

export default function Hoy() {
  const router = useRouter()
  const { perfil, sinConfirmar, refrescar: refrescarSesion } = useSesion()
  // Para confirmar la sesión con el servidor cuando la app abrió sin señal (sin rehacer `cargar` en cada cambio).
  const sesion = useRef({ sinConfirmar, refrescarSesion, usuarioId: perfil?.usuario.id ?? null })
  sesion.current = { sinConfirmar, refrescarSesion, usuarioId: perfil?.usuario.id ?? null }
  const cola = useCola()
  const { reintentar } = cola
  const [contexto, setContexto] = useState<ContextoResponse | null>(null)
  const [errorContexto, setErrorContexto] = useState<ApiError | null>(null)
  const [visitas, setVisitas] = useState<VisitasResponse | null>(null)
  const [errorVisitas, setErrorVisitas] = useState<ApiError | null>(null)
  const [ubicacion, setUbicacion] = useState<ResultadoUbicacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [actualizado, setActualizado] = useState<string | null>(null)
  const enCurso = useRef(false)

  const cargar = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    const hoy = hoyBogota()
    try {
      if (sesion.current.sinConfirmar) void sesion.current.refrescarSesion()
      const pedidoVisitas = api.visitas(hoy).then(
        datos => {
          setVisitas(datos)
          setErrorVisitas(null)
        },
        error => setErrorVisitas(aApiError(error))
      )
      // Hoy solo muestra (meta, agenda y distancias): le basta la primera ubicación (la última conocida reciente o una
      // lectura rápida) y no espera la de alta precisión, que sigue mientras la app está abierta y deja fresca la
      // última conocida con que Reportar muestra su lista enseguida (lib/ubicacion-pasos.ts).
      const resultado = (await pedirUbicacionEnDosPasos({ timeoutMs: 8_000 }).primera).resultado
      setUbicacion(resultado)
      const punto = resultado.ubicacion
      const pedidoContexto = api.contexto(punto ? { lat: punto.lat, lng: punto.lng, precision: punto.precision } : null).then(
        datos => {
          setContexto(datos)
          setErrorContexto(null)
          void guardarContexto(sesion.current.usuarioId, datos) // para poder reportar sin señal más tarde, hoy
        },
        error => setErrorContexto(aApiError(error))
      )
      await Promise.all([pedidoVisitas, pedidoContexto, reintentar()])
      setActualizado(new Date().toISOString())
    } finally {
      enCurso.current = false
      setCargando(false)
      setRefrescando(false)
    }
  }, [reintentar])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const refrescar = () => {
    setRefrescando(true)
    void cargar()
  }

  if (cargando && !contexto && !visitas) return <Cargando texto="Cargando tu día…" />

  const hoy = hoyBogota()
  const nombre = contexto?.ejecutiva.nombre ?? perfil?.ejecutiva?.full_name ?? perfil?.usuario.full_name ?? ''
  const zona = contexto?.ejecutiva.zona ?? perfil?.ejecutiva?.zona ?? null
  const sinEjecutiva = perfil !== null && perfil.ejecutiva === null && !sinConfirmar
  const pendientes = cola.items.filter(e => e.estado === 'pendiente')
  const porConfirmar = cola.items.filter(e => e.estado === 'por_confirmar')
  const noEnviadas = cola.items.filter(e => e.estado === 'no_enviada')
  const reportarDeNuevo = (e: (typeof noEnviadas)[number]) => {
    fijarReintento({ client_id: e.client_id, cuerpo: e.cuerpo, error: e.error })
    router.push('/reportar')
  }
  const items = (visitas?.items ?? []).slice().sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={{ gap: 2 }}>
        <Texto suave>{capitalizar(fechaLarga(hoy))}</Texto>
        <Titulo>{nombre ? `Hola, ${primerNombre(nombre)}` : 'Hoy'}</Titulo>
        {zona ? <Texto suave>Zona {zona}</Texto> : null}
      </View>

      {sinEjecutiva ? (
        <Aviso tono="peligro" titulo="Tu usuario no está enlazado con un Ejecutivo Comercial">
          Pide a tu líder o a quien administra OpMap que enlace tu usuario para poder reportar visitas.
        </Aviso>
      ) : null}
      {sinConfirmar ? (
        <Aviso tono="alerta">
          Sin conexión con el servidor: Reportar usa las sedes y médicos guardados hoy; lo que confirmes se guarda en el teléfono y se envía solo al volver la señal.
        </Aviso>
      ) : null}

      <Boton titulo="Reportar visita" detalle="Dicta lo que pasó o repórtala por toques" grande alPresionar={() => router.push('/reportar')} />

      <MetaDelDia contexto={contexto} error={errorContexto} />

      {contexto ? (
        <AgendaDeHoy
          citas={contexto.agenda_hoy ?? []}
          alAgendar={() => router.push('/agenda/nueva')}
          alVerAgenda={() => router.push('/agenda')}
          alAbrirVisita={id => router.push(`/visita/${id}`)}
        />
      ) : null}

      {pendientes.length > 0 ? (
        <Aviso
          tono="alerta"
          titulo={`${plural(pendientes.length, 'visita guardada', 'visitas guardadas')} sin enviar`}
          accion={<Boton titulo="Enviar ahora" variante="secundario" cargando={cola.enviando} alPresionar={() => void cola.reintentar()} />}
        >
          <View style={{ gap: 4 }}>
            <Texto peque>Se envían solas al volver la señal, hasta las 23:59 de hoy.</Texto>
            {pendientes.map(e => (
              <Texto key={e.client_id} peque>
                {horaBogota(e.cuerpo.checked_in_at)} · {e.resumen}
              </Texto>
            ))}
          </View>
        </Aviso>
      ) : null}

      {porConfirmar.length > 0 ? (
        <Aviso
          tono="alerta"
          titulo={`${plural(porConfirmar.length, 'visita de un día anterior', 'visitas de días anteriores')} por confirmar`}
          accion={<Boton titulo="Revisar ahora" variante="secundario" cargando={cola.enviando} alPresionar={() => void cola.reintentar()} />}
        >
          <View style={{ gap: 4 }}>
            <Texto peque>Pasó la medianoche sin respuesta del servidor: al volver la señal se revisa si quedaron guardadas.</Texto>
            {porConfirmar.map(e => (
              <Texto key={e.client_id} peque>
                {fechaCorta(e.fecha)} {horaBogota(e.cuerpo.checked_in_at)} · {e.resumen}
              </Texto>
            ))}
          </View>
        </Aviso>
      ) : null}

      {noEnviadas.map(e => (
        <Aviso
          key={e.client_id}
          tono="peligro"
          titulo="Visita no enviada"
          accion={
            e.fecha === hoy ? (
              <View style={{ gap: 8 }}>
                <Boton titulo="Reportar de nuevo" detalle="Vuelve como tarjeta, con lo que escribiste" variante="secundario" alPresionar={() => reportarDeNuevo(e)} />
                <Boton titulo="Descartar" variante="texto" alPresionar={() => void cola.quitar(e.client_id)} />
              </View>
            ) : (
              <Boton titulo="Entendido" variante="secundario" alPresionar={() => void cola.quitar(e.client_id)} />
            )
          }
        >
          {`${fechaCorta(e.fecha)} ${horaBogota(e.cuerpo.checked_in_at)} · ${e.resumen}. ${e.error ?? ''}`}
        </Aviso>
      ))}

      {contexto && contexto.compromisos_vencidos.length > 0 ? (
        <Tarjeta>
          <Subtitulo>Compromisos vencidos</Subtitulo>
          {contexto.compromisos_vencidos.map(compromiso => (
            <Tarjeta key={compromiso.visita_id} alPresionar={() => router.push(`/visita/${compromiso.visita_id}?fecha=${compromiso.fecha}`)} estilo={{ padding: 12 }}>
              <Texto negrita>{compromiso.con}</Texto>
              <Texto suave peque>
                Próxima reunión era el {fechaCorta(compromiso.next_step_date)} · visita del {fechaCorta(compromiso.fecha)}
              </Texto>
            </Tarjeta>
          ))}
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Subtitulo>Visitas de hoy</Subtitulo>
        {errorVisitas ? (
          <Aviso tono={esNoDisponible(errorVisitas) ? 'info' : errorVisitas.tipo === 'red' || errorVisitas.tipo === 'tiempo' ? 'alerta' : 'peligro'}>
            {esNoDisponible(errorVisitas) ? 'El reporte de visitas todavía no está activo en el servidor.' : errorVisitas.message}
          </Aviso>
        ) : items.length === 0 ? (
          <Vacio texto="Todavía no has reportado visitas hoy." />
        ) : (
          items.map(visita => <FilaVisita key={visita.id} visita={visita} alPresionar={() => router.push(`/visita/${visita.id}`)} />)
        )}
      </Tarjeta>

      <Texto suave peque>
        {ubicacion?.ubicacion
          ? `Ubicación tomada${ubicacion.ubicacion.aproximada ? ' (aproximada)' : ''} ${textoPrecision(ubicacion.ubicacion.precision) ?? ''}`.trim()
          : (ubicacion?.error ?? '')}
        {actualizado ? ` · Actualizado a las ${horaBogota(actualizado)}` : ''}
      </Texto>
    </Pantalla>
  )
}

function MetaDelDia({ contexto, error }: { contexto: ContextoResponse | null; error: ApiError | null }) {
  if (error && !contexto) {
    return (
      <Aviso tono={esNoDisponible(error) ? 'info' : error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'} titulo="Meta de hoy">
        {esNoDisponible(error) ? 'El reporte de visitas todavía no está activo en el servidor. Tus días libres y tu cuota sí están disponibles.' : error.message}
      </Aviso>
    )
  }
  if (!contexto) return null
  const { meta, hechas, cuota_dia_ok } = contexto.hoy
  const perfil = contexto.config.perfil
  return (
    <Tarjeta>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Subtitulo>Meta de hoy</Subtitulo>
        {cuota_dia_ok ? <Insignia texto="Cumplida" tono="exito" /> : null}
      </View>
      {perfil.includes('medica') ? <Avance etiqueta="Médicas" hechas={hechas.medicas} meta={meta.medica} /> : null}
      {perfil.includes('institucional') ? <Avance etiqueta="Institucionales" hechas={hechas.institucionales} meta={meta.institucional} /> : null}
      <Grupo>
        {contexto.config.telefonica.habilitada ? (
          <Insignia texto={`Telefónicas ${hechas.telefonicas} de ${contexto.config.telefonica.tope_dia}`} tono="neutro" />
        ) : null}
        {hechas.no_efectivas > 0 ? <Insignia texto={plural(hechas.no_efectivas, 'no efectiva', 'no efectivas')} tono="alerta" /> : null}
      </Grupo>
    </Tarjeta>
  )
}

/** Las citas de hoy (pendientes y hechas): la hecha abre su visita. "Agendar" y "Ver agenda" llevan a la agenda. */
function AgendaDeHoy({
  citas,
  alAgendar,
  alVerAgenda,
  alAbrirVisita,
}: {
  citas: readonly CitaItem[]
  alAgendar: () => void
  alVerAgenda: () => void
  alAbrirVisita: (visitaId: string) => void
}) {
  // Por hora (sin hora al final); el contexto con punto las trae por distancia, pero aquí se lee el día en orden.
  const ordenadas = [...citas]
    .filter(c => c.estado !== 'cancelada')
    .sort((a, b) => (a.hora === b.hora ? conQuienCita(a).localeCompare(conQuienCita(b), 'es') : a.hora === null ? 1 : b.hora === null ? -1 : a.hora < b.hora ? -1 : 1))
  const hechas = ordenadas.filter(c => c.estado === 'hecha').length
  return (
    <Tarjeta>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Subtitulo>Tu agenda de hoy</Subtitulo>
        {ordenadas.length > 0 ? <Insignia texto={`${numeroTexto(hechas)} de ${numeroTexto(ordenadas.length)} hechas`} tono={hechas === ordenadas.length ? 'exito' : 'neutro'} /> : null}
      </View>
      {ordenadas.length === 0 ? (
        <Vacio texto="No tienes citas para hoy." />
      ) : (
        ordenadas.map(cita => <FilaCita key={cita.id} cita={cita} alPresionar={cita.visita_id ? () => alAbrirVisita(cita.visita_id as string) : undefined} />)
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton titulo="Agendar" variante="secundario" alPresionar={alAgendar} estilo={{ flex: 1 }} />
        <Boton titulo="Ver agenda" variante="secundario" alPresionar={alVerAgenda} estilo={{ flex: 1 }} />
      </View>
    </Tarjeta>
  )
}

function Avance({ etiqueta, hechas, meta }: { etiqueta: string; hechas: number; meta: number }) {
  const valor = avance(hechas, meta)
  return (
    <View style={{ gap: 6 }}>
      <Fila etiqueta={etiqueta} valor={`${numeroTexto(hechas)} de ${numeroTexto(meta)}`} fuerte />
      <Barra valor={fraccionBarra(valor)} tono={valor !== null && valor >= 1 ? 'exito' : 'neutro'} />
    </View>
  )
}

function FilaVisita({ visita, alPresionar }: { visita: VisitaItem; alPresionar: () => void }) {
  return (
    <Tarjeta alPresionar={alPresionar} estilo={{ padding: 12 }} etiquetaAccesible={`Visita a ${conQuien(visita)}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Texto negrita estilo={{ flexShrink: 1 }}>
          {conQuien(visita)}
        </Texto>
        <Texto suave>{horaBogota(visita.checked_in_at)}</Texto>
      </View>
      <Texto suave peque>
        {ETIQUETA_TIPO_VISITA[visita.tipo]} · {visita.sede.nombre} · {detalleModalidad(visita, textoDistancia)}
      </Texto>
      <Grupo>
        <Insignia texto={visita.efectiva ? 'Efectiva' : 'No efectiva'} tono={visita.efectiva ? 'exito' : 'alerta'} />
        {visita.out_of_territory ? <Insignia texto="Fuera de tu territorio" tono="info" /> : null}
        {visita.sede_por_confirmar ? <Insignia texto="Sede por confirmar: aún no suma" tono="alerta" /> : null}
        {visita.input_mode === 'voz' ? <Insignia texto="Por voz" /> : null}
      </Grupo>
    </Tarjeta>
  )
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
