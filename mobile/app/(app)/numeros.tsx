/**
 * Mis números del mes: cuota y cumplimiento (KPI 1: visitas efectivas × peso ÷ cuota) de médica, institucional y
 * los subtipos con meta propia, días hábiles sin visitas y (F4.1) el bloque Agenda: porcentaje de visitas efectivas
 * agendadas y cumplimiento de la agenda, con las cantidades (decisión 8 de la spec 2026-10-14). Datos: GET /api/me/numeros?mes=; si el servidor
 * todavía no lo tiene (404/503), se muestra la cuota de GET /api/me/cuota?mes= (F2) con un aviso.
 *
 * Spec 2026-10-15: al cambiar de mes, las cifras del mes anterior se atenúan con "Cargando <mes>…" (nunca se mezclan:
 * la respuesta de un mes que ya no se ve se descarta), y en el mes en curso cada tipo dice cuánto falta ("Te faltan 62
 * visitas médicas: 7 por día en los 10 días hábiles que quedan", sin contar los días libres que vienen: diasPorDelante).
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { View } from 'react-native'
import * as api from '../../lib/api'
import { aApiError, esNoDisponible, type ApiError } from '../../lib/errores'
import { hoyBogota, mesDe, nombreMes, sumarMeses } from '../../lib/fechas'
import { diasPorDelante, faltanVisitas } from '../../lib/pantallas'
import { fraccionBarra, muestraCuota, numeroTexto, porcentaje, textoOrigenMeta } from '../../lib/reglas'
import type { CuotaResponse, CuotaTipo, NumerosAgenda, NumerosResponse } from '../../lib/tipos'
import { Aviso, Barra, Boton, Cargando, Fila, Pantalla, Separador, Subtitulo, Tarjeta, Texto } from '../../lib/ui'

interface Datos {
  /** Mes de estas cifras (AAAA-MM). */
  mes: string
  numeros: NumerosResponse | null
  cuota: CuotaResponse
  /** /api/me/numeros no está disponible: solo la cuota. */
  soloCuota: boolean
}

export default function Numeros() {
  const mesActual = mesDe(hoyBogota())
  const [mes, setMes] = useState(mesActual)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  /** Cada pedido lleva su número: solo el último cuenta (pasar rápido de mes no deja las cifras de otro). */
  const ultimoPedido = useRef(0)

  const cargar = useCallback(async (mesPedido: string) => {
    const pedido = ++ultimoPedido.current
    const vigente = () => pedido === ultimoPedido.current
    setError(null)
    try {
      let nuevos: Datos
      try {
        const numeros = await api.numeros(mesPedido)
        nuevos = { mes: mesPedido, numeros, cuota: numeros.cuota, soloCuota: false }
      } catch (e) {
        if (!esNoDisponible(e)) throw e
        const cuota = await api.cuota(mesPedido)
        nuevos = { mes: mesPedido, numeros: null, cuota, soloCuota: true }
      }
      if (vigente()) setDatos(nuevos)
    } catch (e) {
      if (!vigente()) return
      setError(aApiError(e))
      setDatos(null)
    } finally {
      if (vigente()) {
        setCargando(false)
        setRefrescando(false)
      }
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void cargar(mes)
    }, [cargar, mes])
  )

  /** Se ven las cifras de otro mes mientras llega el elegido. */
  const otroMes = datos !== null && datos.mes !== mes

  const cambiarMes = (n: number) => {
    const nuevo = sumarMeses(mes, n)
    if (nuevo > mesActual) return
    setCargando(true)
    setMes(nuevo)
  }

  return (
    <Pantalla
      alRefrescar={() => {
        setRefrescando(true)
        void cargar(mes)
      }}
      refrescando={refrescando}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Boton titulo="‹" variante="secundario" alPresionar={() => cambiarMes(-1)} estilo={{ minWidth: 56 }} />
        <View style={{ flex: 1 }}>
          <Texto negrita centro>
            {capitalizar(nombreMes(mes))}
          </Texto>
        </View>
        <Boton titulo="›" variante="secundario" alPresionar={() => cambiarMes(1)} deshabilitado={mes >= mesActual} estilo={{ minWidth: 56 }} />
      </View>

      {cargando && !datos ? <Cargando texto="Calculando tus números…" /> : null}
      {otroMes ? (
        <Texto suave centro>
          {`Cargando ${nombreMes(mes)}…`}
        </Texto>
      ) : null}
      {error ? (
        <Aviso
          tono={error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'}
          accion={
            <Boton
              titulo="Reintentar"
              variante="secundario"
              alPresionar={() => {
                setRefrescando(true)
                void cargar(mes)
              }}
            />
          }
        >
          {error.message}
        </Aviso>
      ) : null}

      {datos ? (
        // Mientras llega el mes nuevo, las cifras del anterior se ven atenuadas (y no se tocan).
        <View
          style={{ gap: 14, opacity: otroMes ? 0.35 : 1, pointerEvents: otroMes ? 'none' : 'auto' }}
          accessibilityElementsHidden={otroMes}
          importantForAccessibility={otroMes ? 'no-hide-descendants' : 'auto'}
        >
          <Contenido datos={datos} enCurso={datos.mes === mesActual} />
        </View>
      ) : null}
    </Pantalla>
  )
}

function Contenido({ datos, enCurso }: { datos: Datos; enCurso: boolean }) {
  const { cuota, numeros, soloCuota } = datos
  // Cuánto falta, solo en el mes en curso y con lo hecho (sin /api/me/numeros no se sabe).
  const falta = (tipo: 'medica' | 'institucional') =>
    enCurso && numeros ? faltanVisitas(cuota[tipo].cuota, numeros.hechas[tipo], diasPorDelante(cuota), tipo) : null
  return (
    <>
      {soloCuota ? (
        <Aviso tono="info">El cumplimiento aparece cuando el servidor tenga activo el reporte de visitas. Por ahora ves tu cuota del mes.</Aviso>
      ) : null}

      {muestraCuota(cuota.medica) ? (
        <TarjetaTipo
          titulo="Visitas médicas"
          tipo={cuota.medica}
          hechas={numeros?.hechas.medica ?? null}
          cumplimiento={numeros?.cumplimiento.medica ?? null}
          falta={falta('medica')}
        />
      ) : null}
      {muestraCuota(cuota.institucional) ? (
        <TarjetaTipo
          titulo="Visitas institucionales"
          tipo={cuota.institucional}
          hechas={numeros?.hechas.institucional ?? null}
          cumplimiento={numeros?.cumplimiento.institucional ?? null}
          falta={falta('institucional')}
        />
      ) : null}
      {cuota.subtipos.filter(muestraCuota).map(subtipo => (
        <TarjetaTipo
          key={subtipo.subtipo_id}
          titulo={subtipo.nombre}
          tipo={subtipo}
          hechas={numeros?.hechas.subtipos.find(s => s.subtipo_id === subtipo.subtipo_id)?.hechas ?? null}
          cumplimiento={numeros?.cumplimiento.subtipos.find(s => s.subtipo_id === subtipo.subtipo_id)?.cumplimiento ?? null}
        />
      ))}

      {numeros?.agenda ? <TarjetaAgenda agenda={numeros.agenda} /> : null}

      <Tarjeta>
        <Subtitulo>Días del mes</Subtitulo>
        <Fila etiqueta="Días hábiles" valor={numeroTexto(cuota.dias_habiles)} />
        <Fila etiqueta="Transcurridos" valor={numeroTexto(cuota.dias_habiles_transcurridos)} />
        <Fila etiqueta="Días libres" valor={numeroTexto(cuota.dias_libres)} />
        {cuota.dias_por_aprobar > 0 ? <Fila etiqueta="Por aprobar" valor={numeroTexto(cuota.dias_por_aprobar)} /> : null}
        <View style={{ gap: 6 }}>
          <Fila etiqueta="Ritmo del mes" valor={porcentaje(cuota.ritmo)} fuerte />
          <Barra valor={fraccionBarra(cuota.ritmo)} />
        </View>
        {numeros ? (
          <>
            <Separador />
            <Fila etiqueta="Días hábiles sin visitas" valor={numeroTexto(numeros.dias_habiles_sin_visitas)} fuerte />
            <Fila etiqueta="Telefónicas efectivas" valor={numeroTexto(numeros.telefonicas)} />
            <Fila etiqueta="No efectivas" valor={numeroTexto(numeros.no_efectivas)} />
            <Fila etiqueta="Fuera de tu territorio" valor={numeroTexto(numeros.fuera_de_territorio)} />
            {numeros.sede_por_confirmar > 0 ? (
              <Fila etiqueta="En sedes por confirmar (aún no suman)" valor={numeroTexto(numeros.sede_por_confirmar)} />
            ) : null}
          </>
        ) : null}
      </Tarjeta>
    </>
  )
}

/** Bloque Agenda: cuántas efectivas fueron agendadas con anticipación y cuántas citas del mes se cumplieron. */
function TarjetaAgenda({ agenda }: { agenda: NumerosAgenda }) {
  return (
    <Tarjeta>
      <Subtitulo>Agenda</Subtitulo>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Texto negrita estilo={{ flexShrink: 1 }}>
            Visitas efectivas agendadas
          </Texto>
          <Texto negrita>{porcentaje(agenda.porcentaje_agendadas)}</Texto>
        </View>
        <Barra valor={fraccionBarra(agenda.porcentaje_agendadas)} />
        <Texto suave peque>
          {agenda.efectivas === 0
            ? 'Aún no tienes visitas efectivas este mes.'
            : `${numeroTexto(agenda.efectivas_agendadas)} de ${numeroTexto(agenda.efectivas)} efectivas estaban en tu agenda desde antes del día de la visita.`}
        </Texto>
      </View>
      <Separador />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Texto negrita estilo={{ flexShrink: 1 }}>
            Cumplimiento de la agenda
          </Texto>
          <Texto negrita>{porcentaje(agenda.cumplimiento)}</Texto>
        </View>
        <Barra valor={fraccionBarra(agenda.cumplimiento)} tono={agenda.cumplimiento !== null && agenda.cumplimiento >= 1 ? 'exito' : 'neutro'} />
        <Texto suave peque>
          {agenda.citas_hasta_hoy === 0
            ? 'No tienes citas de días pasados ni de hoy este mes.'
            : `${numeroTexto(agenda.citas_hechas)} de ${numeroTexto(agenda.citas_hasta_hoy)} citas hasta hoy tienen su visita (sin las canceladas).`}
        </Texto>
      </View>
    </Tarjeta>
  )
}

function TarjetaTipo({
  titulo,
  tipo,
  hechas,
  cumplimiento,
  falta = null,
}: {
  titulo: string
  tipo: CuotaTipo
  hechas: number | null
  cumplimiento: number | null
  /** "Te faltan 62 visitas médicas: 7 por día en los 10 días hábiles que quedan" (mes en curso). */
  falta?: string | null
}) {
  const llego = cumplimiento !== null && cumplimiento >= 1
  return (
    <Tarjeta>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Subtitulo estilo={{ flexShrink: 1 }}>{titulo}</Subtitulo>
        {hechas !== null ? <Texto negrita>{porcentaje(cumplimiento)}</Texto> : null}
      </View>
      {hechas !== null ? (
        <>
          <Fila etiqueta="Hechas" valor={`${numeroTexto(hechas)} de ${numeroTexto(tipo.cuota)}`} fuerte />
          <Barra valor={fraccionBarra(cumplimiento)} tono={llego ? 'exito' : 'neutro'} />
          {falta ? <Texto negrita>{falta}</Texto> : null}
        </>
      ) : (
        <Fila etiqueta="Cuota del mes" valor={numeroTexto(tipo.cuota)} fuerte />
      )}
      <Texto suave peque>
        Meta de hoy: {numeroTexto(tipo.meta_dia_hoy)} · {textoOrigenMeta(tipo.origen)}
        {tipo.aplica === false ? ' · no está en tu perfil este mes' : ''}
      </Texto>
    </Tarjeta>
  )
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
