/**
 * Nuevo contacto de una cuenta (dueño, 2026-10-30): la visita institucional siempre dice con quién fue, y el contacto
 * lleva teléfono y/o correo para no repetirlo. Lo pide la tarjeta institucional de Reportar (la cuenta, y su sede si ya
 * se eligió, van en el pedido). Si en la cuenta ya hay uno con ese teléfono o correo, el servidor responde 409 con él y
 * se ofrece usarlo. Al crear (o usar el que estaba) vuelve a Reportar con el contacto puesto en la tarjeta. El teléfono y
 * el correo solo viajan en el cuerpo de la petición: la app no los guarda ni los muestra después.
 */
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import * as api from '../../../lib/api'
import { ApiError, mensajeDeError } from '../../../lib/errores'
import { SoloEnFoco } from '../../../lib/montaje'
import { avisarRetorno, leerPedido } from '../../../lib/retorno'
import { cuerpoNuevoContacto, erroresNuevoContacto } from '../../../lib/terceros'
import type { ContactoContexto } from '../../../lib/tipos'
import { Aviso, Boton, Campo, Pantalla, Tarjeta, Texto } from '../../../lib/ui'

/** Pestaña oculta: se monta de cero cada vez que se abre (pedido y formulario nuevos). */
export default function PantallaNuevoContacto() {
  return (
    <SoloEnFoco>
      <NuevoContacto />
    </SoloEnFoco>
  )
}

function NuevoContacto() {
  const router = useRouter()
  const [pedido] = useState(() => leerPedido())
  const cuenta = pedido?.cuenta ?? null
  const [nombre, setNombre] = useState(pedido?.nombre ?? '')
  const [cargo, setCargo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  /** Se tocó "Crear contacto": desde ahí cada campo dice lo que le falta. */
  const [intento, setIntento] = useState(false)
  /** Error del servidor que no es de un campo: va al pie, junto al botón. */
  const [error, setError] = useState<string | null>(null)
  /** 409: el que ya está en la cuenta con ese teléfono o correo. */
  const [existente, setExistente] = useState<{ id: string; nombre: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const datos = { nombre, telefono, email }
  const errores = intento ? erroresNuevoContacto(datos) : {}
  const hayErrores = Object.keys(errores).length > 0

  const volver = (contacto: ContactoContexto) => {
    avisarRetorno({ tipo: 'contacto', clave: pedido?.clave ?? null, contacto })
    if (router.canGoBack()) router.back()
    else router.replace('/reportar')
  }

  const crear = async () => {
    setIntento(true)
    setError(null)
    if (!cuenta) return setError('Abre "Nuevo contacto" desde la tarjeta de la visita institucional, con la cuenta elegida.')
    if (Object.keys(erroresNuevoContacto(datos)).length > 0) return
    setOcupado(true)
    try {
      const { contacto } = await api.crearContacto(cuerpoNuevoContacto({ ...datos, cargo, cuenta_id: cuenta.id, sede_id: pedido?.sede_id ?? null }))
      volver({ id: contacto.id, cuenta_id: contacto.cuenta_id, sede_id: contacto.sede_id, nombre: contacto.nombre, cargo_texto: contacto.cargo_texto, rol: contacto.rol })
    } catch (lanzado) {
      const ya = lanzado instanceof ApiError && lanzado.status === 409 ? (lanzado.cuerpo as { existente?: { id: string; nombre: string } } | null)?.existente : undefined
      if (ya) setExistente(ya)
      setError(mensajeDeError(lanzado))
    } finally {
      setOcupado(false)
    }
  }

  const avisoPie = error ?? (hayErrores ? 'Revisa lo que está marcado arriba.' : null)

  return (
    <Pantalla
      pie={
        <>
          {avisoPie ? <Aviso tono="peligro">{avisoPie}</Aviso> : null}
          <Boton titulo="Crear contacto" grande cargando={ocupado} alPresionar={() => void crear()} />
        </>
      }
    >
      <Texto suave>Con quién fue la visita: su nombre, y su teléfono o su correo (uno de los dos, o ambos).</Texto>
      {cuenta ? (
        <Texto negrita>{cuenta.nombre}</Texto>
      ) : (
        <Aviso tono="alerta">Abre "Nuevo contacto" desde la tarjeta de la visita institucional, con la cuenta elegida.</Aviso>
      )}

      {existente ? (
        <Aviso tono="info" titulo="Ese contacto ya está en la cuenta">
          <View style={{ gap: 8 }}>
            <Texto>{existente.nombre}</Texto>
            <Boton
              titulo="Usar este contacto"
              alPresionar={() =>
                cuenta && volver({ id: existente.id, cuenta_id: cuenta.id, sede_id: null, nombre: existente.nombre, cargo_texto: null, rol: 'otro' })
              }
            />
          </View>
        </Aviso>
      ) : null}

      <Tarjeta estilo={{ gap: 12 }}>
        <Campo etiqueta="Nombre" valor={nombre} alCambiar={setNombre} autoCapitalize="words" placeholder="Luis Pérez" maxLength={200} error={errores.nombre ?? null} />
        <Campo etiqueta="Cargo (opcional)" valor={cargo} alCambiar={setCargo} autoCapitalize="sentences" placeholder="Jefe de compras" maxLength={200} />
        <Campo
          etiqueta="Teléfono"
          valor={telefono}
          alCambiar={texto => {
            setTelefono(texto)
            setExistente(null)
          }}
          keyboardType="phone-pad"
          autoComplete="off"
          placeholder="300 123 4567"
          maxLength={60}
          error={errores.telefono ?? null}
        />
        <Campo
          etiqueta="Correo"
          valor={email}
          alCambiar={texto => {
            setEmail(texto)
            setExistente(null)
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          placeholder="luis@clinica.com"
          maxLength={320}
          error={errores.email ?? null}
        />
      </Tarjeta>
    </Pantalla>
  )
}
