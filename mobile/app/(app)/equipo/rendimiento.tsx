/**
 * Equipo › Rendimiento (Entrega 2, dueño 2026-10-31): las cifras del periodo del equipo y una fila por persona
 * (cumplimiento del plan ascendente: primero quien va atrás), con el reparto por línea ("99 Trauma · 1 Sustitutos": la
 * líder levanta la mano), quien ya no está, y la cuota solo en un mes completo. Con ?persona= muestra el detalle de una.
 * GET /api/equipo/rendimiento y /api/equipo/persona/[id]/rendimiento. Sin señal: lo último guardado con "Visto hace".
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import * as api from '../../../lib/api'
import {
  ETIQUETA_MARCA,
  ETIQUETA_PAPEL,
  FILTROS_PAPEL,
  MARCAS_VISIBLES,
  PERIODOS,
  esSinSenal,
  fechaCortita,
  filtrarPersonas,
  ordenFilas,
  periodo,
  textoCumplimiento,
  textoMotivos,
  textoPaso,
  textoPorLinea,
  textoVisto,
  tonoEstado,
  type FiltroPapel,
  type TipoPeriodo,
} from '../../../lib/equipo'
import { CLAVE_EQUIPO_RENDIMIENTO, guardarUltimo, leerUltimo } from '../../../lib/equipo-cache'
import { aApiError, type ApiError } from '../../../lib/errores'
import { hoyBogota } from '../../../lib/fechas'
import { useSesion } from '../../../lib/sesion'
import type { CifrasItem, EquipoPersonaRendimientoResponse, EquipoPersonasResponse, EquipoRendimientoResponse, FilaRendimientoItem, PasoRastroItem } from '../../../lib/tipos'
import { Aviso, Barra, Boton, Cargando, Chip, Fila, Insignia, Pantalla, Seccion, Tarjeta, Texto, Titulo, Vacio } from '../../../lib/ui'

const pct = (v: number | null) => (v === null ? '—' : `${v} %`)
const num = (v: number | null) => (v === null ? '—' : String(v))

/** Las cifras de un conjunto (el equipo o una persona). */
function Cifras({ c, mesCompleto, cuota, diasSinVisitas }: { c: CifrasItem; mesCompleto: boolean; cuota?: FilaRendimientoItem['cuota']; diasSinVisitas?: number | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Fila etiqueta="Hechas" valor={`${c.hechas} (${c.efectivas} efectivas · ${c.no_efectivas} no efectivas)`} fuerte />
      {c.no_efectivas > 0 ? <Texto suave peque>{`No efectivas: ${textoMotivos(c.no_efectivas_por_motivo)}`}</Texto> : null}
      <Fila etiqueta="Por línea" valor={textoPorLinea(c.por_linea) || '—'} />
      {c.por_linea.suma_supera_hechas ? <Texto suave peque>Una visita que impulsó dos líneas cuenta en las dos.</Texto> : null}
      <Fila etiqueta="Cumplimiento del plan" valor={textoCumplimiento(c.cumplimiento_plan)} />
      {c.cumplimiento_plan.ratio !== null ? <Barra valor={c.cumplimiento_plan.ratio} tono={c.cumplimiento_plan.ratio >= 1 ? 'exito' : c.cumplimiento_plan.ratio < 0.5 ? 'alerta' : 'neutro'} /> : null}
      <Fila etiqueta="No se hizo" valor={c.no_se_hizo > 0 ? `${c.no_se_hizo} · ${textoMotivos(c.no_se_hizo_por_motivo)}` : '0'} />
      <Fila etiqueta="Canceladas" valor={c.canceladas > 0 ? `${c.canceladas} · ${textoMotivos(c.canceladas_por_motivo)}` : '0'} />
      <Fila etiqueta="Sin cerrar" valor={String(c.sin_cerrar)} />
      <Fila etiqueta="Programadas" valor={String(c.programadas)} />
      <Fila etiqueta="Telefónicas" valor={String(c.telefonicas)} />
      <Fila etiqueta="Anticipación" valor={`mediana ${num(c.anticipacion.mediana_dias)} d · con tiempo ${pct(c.anticipacion.pct_con_tiempo)} · mismo día ${pct(c.anticipacion.pct_mismo_dia)} · no planeadas ${c.anticipacion.no_planeadas}`} />
      <Fila etiqueta="Médicos distintos" valor={String(c.medicos_distintos)} />
      <Fila etiqueta="Ciudades distintas" valor={String(c.ciudades_distintas)} />
      {diasSinVisitas !== undefined && diasSinVisitas !== null ? <Fila etiqueta="Días hábiles sin visitas" valor={String(diasSinVisitas)} /> : null}
      {mesCompleto && cuota ? (
        <>
          <Fila etiqueta="Cuota médica" valor={`${cuota.medica.hechas} de ${cuota.medica.cuota} (${cuota.medica.cumplimiento === null ? '—' : `${Math.round(cuota.medica.cumplimiento * 100)} %`})`} />
          {cuota.institucional.cuota > 0 ? <Fila etiqueta="Cuota institucional" valor={`${cuota.institucional.hechas} de ${cuota.institucional.cuota} (${cuota.institucional.cumplimiento === null ? '—' : `${Math.round(cuota.institucional.cumplimiento * 100)} %`})`} /> : null}
        </>
      ) : null}
    </View>
  )
}

function Paso({ paso }: { paso: PasoRastroItem }) {
  const t = textoPaso(paso)
  const marcas = paso.marcas.filter(m => MARCAS_VISIBLES.includes(m))
  return (
    <Tarjeta>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Texto negrita estilo={{ flex: 1 }}>{`${fechaCortita(paso.fecha)} · ${t.titulo}`}</Texto>
        <Insignia texto={t.estado} tono={tonoEstado(paso.estado)} />
      </View>
      {t.detalle ? <Texto suave peque>{t.detalle}</Texto> : null}
      {marcas.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {marcas.map(m => (
            <Insignia key={m} texto={ETIQUETA_MARCA[m]} tono="alerta" />
          ))}
        </View>
      ) : null}
    </Tarjeta>
  )
}

/** El detalle de una persona en el periodo (?persona=). */
function Detalle({ id, desde, hasta }: { id: string; desde: string; hasta: string }) {
  const [datos, setDatos] = useState<EquipoPersonaRendimientoResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  useEffect(() => {
    let vigente = true
    setDatos(null)
    setError(null)
    api.equipoPersonaRendimiento(id, desde, hasta)
      .then(d => vigente && setDatos(d))
      .catch(e => vigente && setError(aApiError(e)))
    return () => {
      vigente = false
    }
  }, [id, desde, hasta])
  if (error) return <Aviso tono="peligro">{error.message}</Aviso>
  if (!datos) return <Cargando texto="Calculando…" />
  return (
    <View style={{ gap: 12 }}>
      <View>
        <Titulo>{datos.fila.persona.nombre}</Titulo>
        <Texto suave>{`${ETIQUETA_PAPEL[datos.fila.persona.papel]}${datos.fila.persona.zona ? ` · ${datos.fila.persona.zona}` : ''}`}</Texto>
        {datos.fila.ya_no_esta ? <Insignia texto="Ya no está" tono="neutro" /> : null}
      </View>
      <Tarjeta>
        <Cifras c={datos.fila} mesCompleto={datos.mes_completo} cuota={datos.fila.cuota} diasSinVisitas={datos.fila.dias_habiles_sin_visitas} />
      </Tarjeta>
      <Seccion titulo={`Visitas (${datos.visitas.length})`} />
      {datos.visitas.length === 0 ? <Vacio texto="Sin visitas en el periodo." /> : datos.visitas.map(p => <Paso key={`v-${p.visita_id}`} paso={p} />)}
      <Seccion titulo={`Citas (${datos.citas.length})`} />
      {datos.citas.length === 0 ? <Vacio texto="Sin citas en el periodo." /> : datos.citas.map(p => <Paso key={`c-${p.cita_id}`} paso={p} />)}
    </View>
  )
}

export default function Rendimiento() {
  const router = useRouter()
  const { perfil } = useSesion()
  const uid = perfil?.usuario.id ?? ''
  const { persona } = useLocalSearchParams<{ persona?: string }>()
  const hoy = hoyBogota()
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')
  const [papel, setPapel] = useState<FiltroPapel>('todas')
  const [linea, setLinea] = useState<string | null>(null)
  const [catalogo, setCatalogo] = useState<EquipoPersonasResponse | null>(null)
  const [datos, setDatos] = useState<EquipoRendimientoResponse | null>(null)
  const [vistoAt, setVistoAt] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const ultimoPedido = useRef(0)
  const { desde, hasta } = periodo(tipo, hoy)
  const sinSenal = error !== null && esSinSenal(error.tipo)

  const cargar = useCallback(async (d: string, h: string, l: string | null, p: FiltroPapel) => {
    const pedido = ++ultimoPedido.current
    const vigente = () => pedido === ultimoPedido.current
    setError(null)
    const clave = `${d}..${h}|${l ?? ''}|${p}`
    try {
      const nuevos = await api.equipoRendimiento(d, h, l, p === 'todas' ? null : p === 'lideres' ? 'lider' : 'ejecutivo')
      if (!vigente()) return
      setDatos(nuevos)
      setVistoAt(null)
      void guardarUltimo(CLAVE_EQUIPO_RENDIMIENTO, uid, clave, nuevos)
    } catch (e) {
      if (!vigente()) return
      const err = aApiError(e)
      setError(err)
      if (esSinSenal(err.tipo)) {
        const ultimo = await leerUltimo<EquipoRendimientoResponse>(CLAVE_EQUIPO_RENDIMIENTO, uid)
        if (vigente() && ultimo) {
          setDatos(ultimo.datos)
          setVistoAt(ultimo.visto_at)
        }
      }
    } finally {
      if (vigente()) {
        setCargando(false)
        setRefrescando(false)
      }
    }
  }, [uid])

  useEffect(() => {
    if (catalogo) return
    api.equipoPersonas().then(setCatalogo).catch(() => undefined)
  }, [catalogo])

  useFocusEffect(
    useCallback(() => {
      void cargar(desde, hasta, linea, papel)
    }, [cargar, desde, hasta, linea, papel])
  )

  if (persona) {
    return (
      <Pantalla>
        <Boton titulo="Todo el equipo" variante="secundario" compacto alPresionar={() => router.setParams({ persona: '' })} />
        <Texto suave peque>{`${fechaCortita(desde)} a ${fechaCortita(hasta)}`}</Texto>
        <Detalle id={persona} desde={desde} hasta={hasta} />
      </Pantalla>
    )
  }

  const filas = datos ? ordenFilas(filtrarPersonas(datos.por_persona, papel, linea)) : []
  // Sin señal, lo que se ve es lo guardado: su periodo, no el elegido
  const desdeVisto = vistoAt && datos ? datos.desde : desde
  const hastaVisto = vistoAt && datos ? datos.hasta : hasta
  return (
    <Pantalla
      alRefrescar={() => {
        setRefrescando(true)
        void cargar(desde, hasta, linea, papel)
      }}
      refrescando={refrescando}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PERIODOS.map(p => (
          <Chip key={p.valor} texto={p.texto} activo={tipo === p.valor} alPresionar={() => setTipo(p.valor)} deshabilitado={sinSenal} />
        ))}
      </ScrollView>
      <Texto suave peque>{`${fechaCortita(desdeVisto)} a ${fechaCortita(hastaVisto)}${datos?.mes_completo ? ' · mes completo: con cuota' : ''}`}</Texto>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTROS_PAPEL.map(f => (
          <Chip key={f.valor} texto={f.texto} activo={papel === f.valor} alPresionar={() => setPapel(f.valor)} deshabilitado={sinSenal} />
        ))}
      </ScrollView>
      {catalogo && catalogo.lineas.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip texto="Todas las líneas" activo={linea === null} alPresionar={() => setLinea(null)} deshabilitado={sinSenal} />
          {catalogo.lineas.map(l => (
            <Chip key={l.id} texto={l.nombre} activo={linea === l.id} alPresionar={() => setLinea(linea === l.id ? null : l.id)} deshabilitado={sinSenal} />
          ))}
        </ScrollView>
      ) : null}

      {cargando && !datos ? <Cargando texto="Calculando el rendimiento…" /> : null}
      {error && !datos ? (
        <Aviso tono={sinSenal ? 'alerta' : 'peligro'} accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void cargar(desde, hasta, linea, papel)} />}>
          {error.message}
        </Aviso>
      ) : null}
      {vistoAt ? <Aviso tono="alerta">{`Sin señal: lo último guardado (${fechaCortita(desdeVisto)} a ${fechaCortita(hastaVisto)}). ${textoVisto(vistoAt)}.`}</Aviso> : null}

      {datos ? (
        <View style={{ gap: 12 }}>
          <Seccion titulo="El equipo" />
          <Tarjeta>
            <Cifras c={datos.equipo} mesCompleto={datos.mes_completo} />
          </Tarjeta>
          <Seccion titulo="Por persona (primero quien va atrás)" />
          {filas.length === 0 ? <Vacio texto="Nadie con ese filtro." /> : null}
          {filas.map(f => (
            <Tarjeta key={f.persona.user_id} alPresionar={() => router.setParams({ persona: f.persona.user_id })} etiquetaAccesible={`${f.persona.nombre}: ver su detalle`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Texto negrita>{f.persona.nombre}</Texto>
                {f.ya_no_esta ? <Insignia texto="Ya no está" tono="neutro" /> : <Texto suave peque>{ETIQUETA_PAPEL[f.persona.papel]}</Texto>}
              </View>
              <Fila etiqueta="Hechas" valor={`${f.hechas} (${f.efectivas} efectivas)`} fuerte />
              <Fila etiqueta="Por línea" valor={textoPorLinea(f.por_linea) || '—'} />
              <Fila etiqueta="Cumplimiento del plan" valor={textoCumplimiento(f.cumplimiento_plan)} />
              {f.cumplimiento_plan.ratio !== null ? <Barra valor={f.cumplimiento_plan.ratio} tono={f.cumplimiento_plan.ratio >= 1 ? 'exito' : f.cumplimiento_plan.ratio < 0.5 ? 'alerta' : 'neutro'} /> : null}
              <Fila etiqueta="No se hizo · Canceladas · Sin cerrar" valor={`${f.no_se_hizo} · ${f.canceladas} · ${f.sin_cerrar}`} />
              {datos.mes_completo && f.cuota ? <Fila etiqueta="Cuota médica" valor={`${f.cuota.medica.hechas} de ${f.cuota.medica.cuota}`} /> : null}
            </Tarjeta>
          ))}
        </View>
      ) : null}
    </Pantalla>
  )
}
