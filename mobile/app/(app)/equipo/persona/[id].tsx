/**
 * Equipo › el día de una persona (Entrega 2, 2026-10-31): dónde está, el rastro por hora (cada cita con su visita, cada
 * visita suelta) y "Siguiente" (lo de ese día que falta y los dos días que vienen). GET /api/equipo/persona/[id]?fecha=.
 * Nunca la transcripción, la foto, el documento del médico ni el GPS: solo sede y municipio.
 */
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import * as api from '../../../../lib/api'
import { ETIQUETA_MARCA, ETIQUETA_PAPEL, MARCAS_VISIBLES, fechaCortita, textoPaso, textoUbicacion, tonoEstado } from '../../../../lib/equipo'
import { aApiError, type ApiError } from '../../../../lib/errores'
import { fechaLarga, hoyBogota } from '../../../../lib/fechas'
import type { EquipoPersonaDiaResponse, PasoRastroItem } from '../../../../lib/tipos'
import { Aviso, Boton, Cargando, Insignia, Pantalla, Seccion, Tarjeta, Texto, Titulo, Vacio } from '../../../../lib/ui'

function Paso({ paso, conFecha }: { paso: PasoRastroItem; conFecha?: boolean }) {
  const t = textoPaso(paso)
  const marcas = paso.marcas.filter(m => MARCAS_VISIBLES.includes(m))
  return (
    <Tarjeta>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Texto negrita estilo={{ flex: 1 }}>{conFecha ? `${fechaCortita(paso.fecha)} · ${t.titulo}` : t.titulo}</Texto>
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

export default function DiaDePersona() {
  const { id, fecha: fechaParam } = useLocalSearchParams<{ id: string; fecha?: string }>()
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoyBogota()
  const [datos, setDatos] = useState<EquipoPersonaDiaResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [refrescando, setRefrescando] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setDatos(await api.equipoPersonaDia(id, fecha))
    } catch (e) {
      setError(aApiError(e))
    } finally {
      setRefrescando(false)
    }
  }, [id, fecha])

  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  return (
    <Pantalla
      alRefrescar={() => {
        setRefrescando(true)
        void cargar()
      }}
      refrescando={refrescando}
    >
      {!datos && !error ? <Cargando texto="Buscando su día…" /> : null}
      {error ? (
        <Aviso tono={error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'} accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void cargar()} />}>
          {error.message}
        </Aviso>
      ) : null}
      {datos ? (
        <View style={{ gap: 14 }}>
          <View>
            <Titulo>{datos.persona.nombre}</Titulo>
            <Texto suave>{`${ETIQUETA_PAPEL[datos.persona.papel]}${datos.persona.zona ? ` · ${datos.persona.zona}` : ''}`}</Texto>
            <Texto suave peque>{fecha === hoyBogota() ? 'Hoy' : fechaLarga(fecha)}</Texto>
          </View>
          <Tarjeta>
            <Texto negrita>{textoUbicacion(datos.donde)}</Texto>
            {datos.donde.fuente ? <Texto suave peque>{datos.donde.fuente === 'reportado' ? 'Reportado' : 'Planeado'}</Texto> : null}
            {datos.donde.marcas.filter(m => MARCAS_VISIBLES.includes(m)).length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {datos.donde.marcas.filter(m => MARCAS_VISIBLES.includes(m)).map(m => (
                  <Insignia key={m} texto={ETIQUETA_MARCA[m]} tono="alerta" />
                ))}
              </View>
            ) : null}
          </Tarjeta>
          <Seccion titulo="Rastro" />
          {datos.rastro.length === 0 ? <Vacio texto="Sin reportes ni citas ese día." /> : datos.rastro.map(p => <Paso key={`${p.cita_id ?? ''}-${p.visita_id ?? ''}`} paso={p} />)}
          <Seccion titulo="Siguiente" />
          {datos.siguiente.length === 0 ? <Vacio texto="Nada planeado para los próximos días." /> : datos.siguiente.map(p => <Paso key={`s-${p.cita_id ?? ''}`} paso={p} conFecha />)}
        </View>
      ) : null}
    </Pantalla>
  )
}
