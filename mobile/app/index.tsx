/** Entrada: con sesión a Hoy, sin sesión al ingreso. */
import { Redirect } from 'expo-router'
import { useSesion } from '../lib/sesion'
import { Cargando } from '../lib/ui'

export default function Inicio() {
  const { estado } = useSesion()
  if (estado === 'cargando') return <Cargando texto="Abriendo VG Visitas…" />
  return <Redirect href={estado === 'con_sesion' ? '/hoy' : '/login'} />
}
