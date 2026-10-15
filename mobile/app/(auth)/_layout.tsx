/** Grupo sin sesión: si ya hay sesión, a Hoy. */
import { Redirect, Stack } from 'expo-router'
import { useSesion } from '../../lib/sesion'
import { Cargando, useColores } from '../../lib/ui'

export default function AuthLayout() {
  const { estado } = useSesion()
  const c = useColores()
  if (estado === 'cargando') return <Cargando texto="Abriendo VG Visitas…" />
  if (estado === 'con_sesion') return <Redirect href="/hoy" />
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }} />
}
