/**
 * Ingreso con el mismo correo y contraseña de la web de OpMap. La contraseña no se guarda: solo el token que
 * devuelve el servidor (en el almacén seguro del teléfono).
 */
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { URL_API } from '../../lib/api'
import { mensajeDeError } from '../../lib/errores'
import { esServidorDesarrollo, nombreServidor } from '../../lib/http'
import { pareceCorreo } from '../../lib/reglas'
import { useSesion } from '../../lib/sesion'
import { Aviso, Boton, Campo, TAMANO, Texto, Titulo, useColores } from '../../lib/ui'

export default function Login() {
  const { entrar, aviso } = useSesion()
  const c = useColores()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const puedeEnviar = pareceCorreo(email) && password.length > 0 && !enviando

  async function alEntrar() {
    if (!puedeEnviar) return
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fondo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: TAMANO.espacio, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Titulo>OpMap Visitas</Titulo>
            <Texto suave>Entra con el correo y la contraseña de OpMap.</Texto>
          </View>

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
          />
          <Campo
            etiqueta="Contraseña"
            valor={password}
            alCambiar={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={alEntrar}
          />

          {error ? <Aviso tono="peligro">{error}</Aviso> : null}

          <Boton titulo="Entrar" alPresionar={alEntrar} cargando={enviando} deshabilitado={!puedeEnviar} />

          <Texto suave peque centro>
            Servidor: {nombreServidor(URL_API)}
            {esServidorDesarrollo(URL_API) ? ' (desarrollo)' : ''}
          </Texto>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
