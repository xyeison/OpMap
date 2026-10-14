/** Ajustes: quién soy, servidor, versión de la app y cerrar sesión (olvidar el token del teléfono). */
import Constants from 'expo-constants'
import { useState } from 'react'
import { Platform } from 'react-native'
import { URL_API } from '../../lib/api'
import { useCola } from '../../lib/cola-contexto'
import { esServidorDesarrollo, nombreServidor } from '../../lib/http'
import { plural, tituloRol } from '../../lib/reglas'
import { useSesion } from '../../lib/sesion'
import { Aviso, Boton, Fila, Pantalla, Subtitulo, Tarjeta, Texto, confirmar } from '../../lib/ui'

export default function Ajustes() {
  const { perfil, salir, sinConfirmar } = useSesion()
  const { resumen } = useCola()
  const [saliendo, setSaliendo] = useState(false)
  const version = Constants.expoConfig?.version ?? '—'

  async function cerrarSesion() {
    const advertencia =
      resumen.pendientes > 0
        ? `Tienes ${plural(resumen.pendientes, 'visita', 'visitas')} sin enviar en este teléfono. Se envían cuando vuelvas a entrar hoy con tu usuario.`
        : 'Tendrás que volver a escribir tu correo y contraseña.'
    if (!(await confirmar('Cerrar sesión', advertencia, 'Cerrar sesión', true))) return
    setSaliendo(true)
    try {
      await salir()
    } finally {
      setSaliendo(false)
    }
  }

  return (
    <Pantalla>
      <Tarjeta>
        <Subtitulo>Quién soy</Subtitulo>
        <Fila etiqueta="Nombre" valor={perfil?.usuario.full_name || '—'} />
        {perfil?.usuario.email ? <Fila etiqueta="Correo" valor={perfil.usuario.email} /> : null}
        <Fila etiqueta="Rol" valor={tituloRol(perfil?.usuario.role)} />
        <Fila etiqueta="Ejecutivo Comercial" valor={perfil?.ejecutiva?.full_name ?? 'Sin enlazar'} />
        {perfil?.ejecutiva?.zona ? <Fila etiqueta="Zona" valor={perfil.ejecutiva.zona} /> : null}
        {sinConfirmar ? <Texto suave peque>Sin conexión: estos datos son los guardados en el teléfono.</Texto> : null}
      </Tarjeta>

      <Tarjeta>
        <Subtitulo>App</Subtitulo>
        <Fila etiqueta="Servidor" valor={nombreServidor(URL_API)} />
        <Fila etiqueta="Versión" valor={`${version}${Platform.OS === 'web' ? ' (navegador)' : ''}`} />
        <Fila etiqueta="Sin enviar" valor={String(resumen.pendientes)} />
        {esServidorDesarrollo(URL_API) ? <Aviso tono="alerta">Conectada a un servidor de desarrollo.</Aviso> : null}
        <Texto suave peque>
          El audio de los dictados no se guarda: se transcribe en el servidor y se borra del teléfono al recibir el texto.
        </Texto>
      </Tarjeta>

      <Boton titulo="Cerrar sesión" variante="peligro" cargando={saliendo} alPresionar={() => void cerrarSesion()} />
    </Pantalla>
  )
}
