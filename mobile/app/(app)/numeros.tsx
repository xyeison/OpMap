/**
 * Mis números del mes: cuota y cumplimiento (KPI 1: visitas efectivas × peso ÷ cuota) de médica, institucional y
 * los subtipos con meta propia, y días hábiles sin visitas. Datos: GET /api/me/numeros?mes=; si el servidor
 * todavía no lo tiene (404/503), se muestra la cuota de GET /api/me/cuota?mes= (F2) con un aviso.
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import * as api from '../../lib/api'
import { aApiError, esNoDisponible, type ApiError } from '../../lib/errores'
import { hoyBogota, mesDe, nombreMes, sumarMeses } from '../../lib/fechas'
import { fraccionBarra, muestraCuota, numeroTexto, porcentaje, textoOrigenMeta } from '../../lib/reglas'
import type { CuotaResponse, CuotaTipo, NumerosResponse } from '../../lib/tipos'
import { Aviso, Barra, Boton, Cargando, Fila, Pantalla, Separador, Subtitulo, Tarjeta, Texto } from '../../lib/ui'

interface Datos {
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

  const cargar = useCallback(async (mesPedido: string) => {
    setError(null)
    try {
      try {
        const numeros = await api.numeros(mesPedido)
        setDatos({ numeros, cuota: numeros.cuota, soloCuota: false })
      } catch (e) {
        if (!esNoDisponible(e)) throw e
        const cuota = await api.cuota(mesPedido)
        setDatos({ numeros: null, cuota, soloCuota: true })
      }
    } catch (e) {
      setError(aApiError(e))
      setDatos(null)
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void cargar(mes)
    }, [cargar, mes])
  )

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

      {datos ? <Contenido datos={datos} /> : null}
    </Pantalla>
  )
}

function Contenido({ datos }: { datos: Datos }) {
  const { cuota, numeros, soloCuota } = datos
  return (
    <>
      {soloCuota ? (
        <Aviso tono="info">El cumplimiento aparece cuando el servidor tenga activo el reporte de visitas. Por ahora ves tu cuota del mes.</Aviso>
      ) : null}

      {muestraCuota(cuota.medica) ? (
        <TarjetaTipo titulo="Visitas médicas" tipo={cuota.medica} hechas={numeros?.hechas.medica ?? null} cumplimiento={numeros?.cumplimiento.medica ?? null} />
      ) : null}
      {muestraCuota(cuota.institucional) ? (
        <TarjetaTipo
          titulo="Visitas institucionales"
          tipo={cuota.institucional}
          hechas={numeros?.hechas.institucional ?? null}
          cumplimiento={numeros?.cumplimiento.institucional ?? null}
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

function TarjetaTipo({ titulo, tipo, hechas, cumplimiento }: { titulo: string; tipo: CuotaTipo; hechas: number | null; cumplimiento: number | null }) {
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
        </>
      ) : (
        <Fila etiqueta="Cuota del mes" valor={numeroTexto(tipo.cuota)} fuerte />
      )}
      <Texto suave peque>
        Hoy: {numeroTexto(tipo.meta_dia_hoy)} por día hábil · {textoOrigenMeta(tipo.origen)}
        {tipo.aplica === false ? ' · no está en tu perfil este mes' : ''}
      </Texto>
    </Tarjeta>
  )
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
