/**
 * Ajustes: quién soy, "Mis días libres" (spec 2026-10-15: Días libres dejó la barra de abajo y se abre desde aquí y
 * desde Mi agenda), servidor, versión de la app y cerrar sesión (olvidar el token del teléfono).
 *
 * F1b (actividades de campo): "Quién soy" dice su papel según el caso —"Líder · Trauma" y "Ejecutivo Comercial ·
 * Sustitutos óseos · Bucaramanga" (papelesDePersona de lib/persona.ts; Paola, los dos)—. Sin la persona (aún no se
 * sabe), lo de antes: su Ejecutivo Comercial y su zona. "Mis días libres" solo con Ejecutivo Comercial (hasta F3).
 *
 * Tema (etapa 1 del diseño, dueño 2026-10-30): Claro, Oscuro o Automático (el del teléfono), como al final del menú de
 * OpMap; en el navegador es el mismo de OpMap (lib/tema-preferencia.tsx).
 */
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform, View } from 'react-native'
import { URL_API } from '../../lib/api'
import { useCola } from '../../lib/cola-contexto'
import { esServidorDesarrollo, nombreServidor } from '../../lib/http'
import { Icono } from '../../lib/iconos'
import { muestraDiasLibres, papelesDePersona } from '../../lib/persona'
import { plural, tituloRol } from '../../lib/reglas'
import { useSesion } from '../../lib/sesion'
import type { PreferenciaTema } from '../../lib/tema'
import { useTemaApp } from '../../lib/tema-preferencia'
import { ALTO_TOQUE_MIN, Aviso, Boton, Chip, Fila, Pantalla, Subtitulo, Tarjeta, Texto, confirmar, useColores } from '../../lib/ui'

const TEMAS: ReadonlyArray<readonly [PreferenciaTema, string]> = [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']]

export default function Ajustes() {
  const router = useRouter()
  const c = useColores()
  const { perfil, salir, sinConfirmar } = useSesion()
  const { resumen, resumenFotos, enLinea } = useCola()
  const { preferencia, elegir } = useTemaApp()
  const [saliendo, setSaliendo] = useState(false)
  const version = Constants.expoConfig?.version ?? '—'
  // El commit con que se armó la app en la web (scripts/construir-campo.mjs): para saber qué versión corre el teléfono
  // (el service worker guarda la anterior hasta "Actualizar").
  const build = process.env.EXPO_PUBLIC_BUILD ?? null
  const papeles = papelesDePersona(perfil?.persona, perfil?.ejecutiva?.zona)
  const conDiasLibres = muestraDiasLibres({ persona: perfil?.persona, ejecutiva: perfil?.ejecutiva })

  async function cerrarSesion() {
    // App sin señal (2026-10-30): cerrar sesión NUNCA borra los pendientes; se avisa y se suben al volver a entrar.
    const pendientes = resumen.pendientes + resumenFotos.pendientes
    const advertencia =
      pendientes > 0
        ? `Tienes ${plural(resumen.pendientes, 'visita', 'visitas')}${resumenFotos.pendientes > 0 ? ` y ${plural(resumenFotos.pendientes, 'foto', 'fotos')}` : ''} sin subir en este teléfono. No se borran: se suben cuando vuelvas a entrar con tu usuario.`
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
        {papeles.length > 0 ? (
          // Su papel en el campo (lo que agenda y reporta, y con qué líneas).
          <View style={{ gap: 4 }}>
            <Texto suave>Reportas como</Texto>
            {papeles.map(papel => (
              <Texto key={papel} media>
                {papel}
              </Texto>
            ))}
          </View>
        ) : (
          <>
            <Fila etiqueta="Ejecutivo Comercial" valor={perfil?.ejecutiva?.full_name ?? 'Sin enlazar'} />
            {perfil?.ejecutiva?.zona ? <Fila etiqueta="Zona" valor={perfil.ejecutiva.zona} /> : null}
          </>
        )}
        {sinConfirmar ? <Texto suave peque>Sin conexión: estos datos son los guardados en el teléfono.</Texto> : null}
      </Tarjeta>

      {conDiasLibres ? (
        <Tarjeta alPresionar={() => router.push('/dias-libres')} etiquetaAccesible="Mis días libres: registrar uno o ver los que tienes">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: ALTO_TOQUE_MIN }}>
            <Icono nombre="calendario" tamano={26} />
            <View style={{ flex: 1, gap: 2 }}>
              <Subtitulo>Mis días libres</Subtitulo>
              <Texto suave peque>
                Registra un día libre o revisa los que tienes.
              </Texto>
            </View>
            <Icono nombre="adelante" tamano={22} color={c.textoSuave} />
          </View>
        </Tarjeta>
      ) : null}

      {Platform.OS === 'web' ? (
        <Tarjeta alPresionar={() => router.push('/instalar')} etiquetaAccesible="Agregar a la pantalla de inicio: pasos para Android e iPhone">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: ALTO_TOQUE_MIN }}>
            <Icono nombre="agregar" tamano={26} />
            <View style={{ flex: 1, gap: 2 }}>
              <Subtitulo>Agregar a la pantalla de inicio</Subtitulo>
              <Texto suave peque>
                Para abrirla sin señal desde su ícono. Pasos para Android y para iPhone.
              </Texto>
            </View>
            <Icono nombre="adelante" tamano={22} color={c.textoSuave} />
          </View>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Subtitulo>Tema</Subtitulo>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TEMAS.map(([valor, texto]) => (
            <Chip key={valor} texto={texto} activo={preferencia === valor} alPresionar={() => elegir(valor)} />
          ))}
        </View>
      </Tarjeta>

      <Tarjeta>
        <Subtitulo>App</Subtitulo>
        <Fila etiqueta="Servidor" valor={nombreServidor(URL_API)} />
        <Fila etiqueta="Versión" valor={`${version}${Platform.OS === 'web' ? ' (navegador)' : ''}${build ? ` · ${build}` : ''}`} />
        <Fila etiqueta="Conexión" valor={enLinea ? 'En línea' : 'Sin conexión'} />
        <Fila etiqueta="Visitas por subir" valor={String(resumen.pendientes)} />
        <Fila etiqueta="Fotos por subir" valor={String(resumenFotos.pendientes)} />
        {esServidorDesarrollo(URL_API) ? <Aviso tono="alerta">Conectada a un servidor de desarrollo.</Aviso> : null}
        <Texto suave peque>
          El audio de los dictados no se guarda: se transcribe en el servidor y se borra del teléfono al recibir el texto.
        </Texto>
      </Tarjeta>

      <Boton titulo="Cerrar sesión" variante="peligro" cargando={saliendo} alPresionar={() => void cerrarSesion()} />
    </Pantalla>
  )
}
