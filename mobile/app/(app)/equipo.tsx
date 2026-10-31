/**
 * Equipo › Hoy, "¿Dónde está mi gente?" (Entrega 2, dueño 2026-10-31; spec
 * docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md). Para quien supervisa: la dirección y el
 * administrador ven a todas las personas de campo; cada líder a los Ejecutivos Comerciales de sus líneas. Todo sale de lo
 * reportado y agendado (GET /api/equipo/hoy): la app no sigue la ubicación (C5). Se relee cada 5 minutos mientras está
 * a la vista. Cada tarjeta abre el día de la persona; "Rendimiento" abre las cifras del periodo.
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import * as api from '../../lib/api'
import { ETIQUETA_MARCA, ETIQUETA_PAPEL, FILTROS_PAPEL, MARCAS_VISIBLES, RELEER_CADA_MS, TEXTO_FIJO_EQUIPO, filtrarPersonas, textoResumen, textoUbicacion, type FiltroPapel } from '../../lib/equipo'
import { aApiError, type ApiError } from '../../lib/errores'
import { fechaLarga, hoyBogota, sumarDias } from '../../lib/fechas'
import type { EquipoHoyResponse, EquipoPersonasResponse } from '../../lib/tipos'
import { Aviso, Boton, BotonIcono, Cargando, Chip, Insignia, Pantalla, Seccion, Tarjeta, Texto, Vacio } from '../../lib/ui'

export default function Equipo() {
  const router = useRouter()
  const hoy = hoyBogota()
  const [fecha, setFecha] = useState(hoy)
  const [papel, setPapel] = useState<FiltroPapel>('todas')
  const [linea, setLinea] = useState<string | null>(null)
  const [catalogo, setCatalogo] = useState<EquipoPersonasResponse | null>(null)
  const [datos, setDatos] = useState<EquipoHoyResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  /** Cada pedido lleva su número: solo el último cuenta (pasar rápido de día no deja lo de otro). */
  const ultimoPedido = useRef(0)

  const cargar = useCallback(async (fechaPedida: string, silencioso = false) => {
    const pedido = ++ultimoPedido.current
    const vigente = () => pedido === ultimoPedido.current
    if (!silencioso) setError(null)
    try {
      const nuevos = await api.equipoHoy(fechaPedida)
      if (vigente()) {
        setDatos(nuevos)
        setError(null)
      }
    } catch (e) {
      if (!vigente()) return
      setError(aApiError(e))
    } finally {
      if (vigente()) {
        setCargando(false)
        setRefrescando(false)
      }
    }
  }, [])

  useEffect(() => {
    if (catalogo) return
    api.equipoPersonas().then(setCatalogo).catch(() => undefined)
  }, [catalogo])

  useFocusEffect(
    useCallback(() => {
      void cargar(fecha)
      const temporizador = setInterval(() => void cargar(fecha, true), RELEER_CADA_MS)
      return () => clearInterval(temporizador)
    }, [cargar, fecha])
  )

  const cambiarDia = (n: number) => {
    const nueva = sumarDias(fecha, n)
    if (nueva > hoy) return
    setCargando(true)
    setFecha(nueva)
  }

  const otroDia = datos !== null && datos.fecha !== fecha
  const filas = datos ? filtrarPersonas(datos.personas, papel, linea) : []

  return (
    <Pantalla
      alRefrescar={() => {
        setRefrescando(true)
        void cargar(fecha)
      }}
      refrescando={refrescando}
    >
      <Texto suave peque>{TEXTO_FIJO_EQUIPO}</Texto>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BotonIcono icono="atras" etiqueta="Día anterior" alPresionar={() => cambiarDia(-1)} />
        <View style={{ flex: 1 }}>
          <Texto negrita centro estilo={{ fontSize: 17 }}>
            {fecha === hoy ? 'Hoy' : fechaLarga(fecha)}
          </Texto>
        </View>
        <BotonIcono icono="adelante" etiqueta="Día siguiente" alPresionar={() => cambiarDia(1)} deshabilitado={fecha >= hoy} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTROS_PAPEL.map(f => (
          <Chip key={f.valor} texto={f.texto} activo={papel === f.valor} alPresionar={() => setPapel(f.valor)} />
        ))}
      </ScrollView>
      {catalogo && catalogo.lineas.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip texto="Todas las líneas" activo={linea === null} alPresionar={() => setLinea(null)} />
          {catalogo.lineas.map(l => (
            <Chip key={l.id} texto={l.nombre} activo={linea === l.id} alPresionar={() => setLinea(linea === l.id ? null : l.id)} />
          ))}
        </ScrollView>
      ) : null}

      {cargando && !datos ? <Cargando texto="Buscando a tu gente…" /> : null}
      {error && !datos ? (
        <Aviso tono={error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'} accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void cargar(fecha)} />}>
          {error.message}
        </Aviso>
      ) : null}

      {datos ? (
        <View style={{ gap: 12, opacity: otroDia ? 0.35 : 1 }} pointerEvents={otroDia ? 'none' : 'auto'}>
          <Seccion titulo={textoResumen(datos.resumen)} derecha={<Boton titulo="Rendimiento" variante="secundario" compacto alPresionar={() => router.push('/equipo/rendimiento')} />} />
          {filas.length === 0 ? <Vacio texto="Nadie con ese filtro." /> : null}
          {filas.map(({ persona, donde }) => (
            <Tarjeta
              key={persona.user_id}
              alPresionar={() => router.push({ pathname: '/equipo/persona/[id]', params: { id: persona.user_id, fecha } })}
              etiquetaAccesible={`${persona.nombre}: ${textoUbicacion(donde)}. Ver su día`}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Texto negrita>{persona.nombre}</Texto>
                <Texto suave peque>{ETIQUETA_PAPEL[persona.papel]}</Texto>
              </View>
              <Texto>{textoUbicacion(donde)}</Texto>
              {donde.fuente ? <Texto suave peque>{donde.fuente === 'reportado' ? 'Reportado' : 'Planeado'}</Texto> : null}
              {donde.marcas.filter(m => MARCAS_VISIBLES.includes(m)).length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {donde.marcas.filter(m => MARCAS_VISIBLES.includes(m)).map(m => (
                    <Insignia key={m} texto={ETIQUETA_MARCA[m]} tono="alerta" />
                  ))}
                </View>
              ) : null}
            </Tarjeta>
          ))}
        </View>
      ) : null}
    </Pantalla>
  )
}
