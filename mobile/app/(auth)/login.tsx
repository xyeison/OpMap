/**
 * Ingreso a VG Visitas con el mismo correo y contraseña de la web de OpMap. La contraseña no se guarda: solo el
 * token que devuelve el servidor (en el almacén seguro del teléfono). Arriba, el logotipo de VG Medical y "Visitas".
 *
 * Spec 2026-10-15: "Siguiente" en el teclado del correo pasa a la contraseña, y "Entrar" no se apaga: si falta algo, lo
 * dice junto al campo (faltaParaEntrar).
 */
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Logo } from '../../components/Logo'
import { URL_API } from '../../lib/api'
import { mensajeDeError } from '../../lib/errores'
import { esServidorDesarrollo, nombreServidor } from '../../lib/http'
import { faltaParaEntrar } from '../../lib/pantallas'
import { useSesion } from '../../lib/sesion'
import { Aviso, Boton, Campo, TAMANO, Texto, Titulo, useColores, useFuente } from '../../lib/ui'

export default function Login() {
  const { entrar, aviso } = useSesion()
  const c = useColores()
  const fuente = useFuente()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Se tocó "Entrar": desde ahí cada campo dice lo que le falta. */
  const [intentado, setIntentado] = useState(false)
  const contrasena = useRef<TextInput>(null)

  const falta = faltaParaEntrar(email, password)
  const listo = !falta.correo && !falta.contrasena

  async function alEntrar() {
    if (enviando) return
    setIntentado(true)
    if (!listo) return
    setEnviando(true)
    setError(null)
    try {
      await entrar(email, password)
      setPassword('')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  // Campo (lib/ui.tsx) le pasa a su TextInput lo que no usa; con React 19, `ref` llega como una prop más.
  const refContrasena = { ref: contrasena } as object

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: TAMANO.espacio, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Logo ancho={220} />
            <Titulo estilo={{ textAlign: 'center', fontSize: 24, letterSpacing: 0.5, color: c.textoSuave, ...fuente('media') }}>Visitas</Titulo>
          </View>
          <Texto suave centro>
            Entra con el correo y la contraseña de OpMap.
          </Texto>

          {aviso ? <Aviso tono="alerta">{aviso}</Aviso> : null}

          <Campo
            etiqueta="Correo"
            valor={email}
            alCambiar={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            placeholder="nombre@empresa.com"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => contrasena.current?.focus()}
            error={intentado ? falta.correo : null}
          />
          <Campo
            {...refContrasena}
            etiqueta="Contraseña"
            valor={password}
            alCambiar={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void alEntrar()}
            error={intentado ? falta.contrasena : null}
          />

          {error ? <Aviso tono="peligro">{error}</Aviso> : null}

          <Boton titulo="Entrar" alPresionar={() => void alEntrar()} cargando={enviando} />

          <Texto suave peque centro>
            Servidor: {nombreServidor(URL_API)}
            {esServidorDesarrollo(URL_API) ? ' (desarrollo)' : ''}
          </Texto>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
