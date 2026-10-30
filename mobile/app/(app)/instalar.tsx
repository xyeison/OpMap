/**
 * "Agregar a la pantalla de inicio" (app sin señal en /campo, dueño 2026-10-30): los pasos para Android (Chrome) y para
 * iPhone (Safari), y por qué conviene: abre sin señal desde el ícono, no se pierde la cola y en Android sube sola al
 * volver la señal. Se abre desde Hoy (aviso si no corre instalada) y desde Ajustes. En el teléfono con Expo no aplica
 * (lo dice). Textos en lib/instalacion.ts (puros, probados).
 */
import { View } from 'react-native'
import { PASOS_ANDROID, PASOS_IPHONE, PORQUE_INSTALAR, pasosParaEsteTelefono } from '../../lib/instalacion'
import { correInstalada, esIphone, esNavegador, haySync } from '../../lib/pwa'
import { Aviso, Pantalla, Subtitulo, Tarjeta, Texto } from '../../lib/ui'

function Pasos({ titulo, pasos }: { titulo: string; pasos: readonly string[] }) {
  return (
    <Tarjeta estilo={{ gap: 8 }}>
      <Subtitulo>{titulo}</Subtitulo>
      {pasos.map((paso, i) => (
        <View key={paso} style={{ flexDirection: 'row', gap: 10 }}>
          <Texto negrita>{`${i + 1}.`}</Texto>
          <Texto estilo={{ flex: 1 }}>{paso}</Texto>
        </View>
      ))}
    </Tarjeta>
  )
}

export default function Instalar() {
  const instalada = correInstalada()
  const recomendado = pasosParaEsteTelefono(esIphone())
  return (
    <Pantalla>
      {!esNavegador() ? (
        <Aviso tono="info">Esta app ya está instalada en el teléfono (Expo). Estos pasos son para la versión del navegador en /campo.</Aviso>
      ) : instalada ? (
        <Aviso tono="exito" titulo="Ya está en tu pantalla de inicio">
          Abres VG Visitas desde su ícono. Funciona sin señal y lo que reportes se sube solo al volver la conexión{haySync() ? ', aunque la cierres' : ' cuando la abras'}.
        </Aviso>
      ) : (
        <Aviso tono="info" titulo="Agrégala a tu pantalla de inicio">
          {PORQUE_INSTALAR}
        </Aviso>
      )}
      <Pasos titulo={recomendado === 'iphone' ? 'En iPhone (Safari)' : 'En Android (Chrome)'} pasos={recomendado === 'iphone' ? PASOS_IPHONE : PASOS_ANDROID} />
      <Pasos titulo={recomendado === 'iphone' ? 'En Android (Chrome)' : 'En iPhone (Safari)'} pasos={recomendado === 'iphone' ? PASOS_ANDROID : PASOS_IPHONE} />
      <Texto suave peque>
        No uses el modo incógnito ni la navegación privada: el navegador borra lo guardado al cerrar y perderías los reportes pendientes.
      </Texto>
    </Pantalla>
  )
}
