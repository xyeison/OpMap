import { Redirect } from 'expo-router'
import { estadoPersona } from '../lib/persona'
import { useSesion } from '../lib/sesion'
import { Cargando } from '../lib/ui'

/** Entrada: con sesión, Hoy; quien supervisa sin persona de campo (la dirección, el administrador), Equipo (2026-10-31). */
export default function Inicio() {
  const { estado, perfil, sinConfirmar } = useSesion()
  if (estado === 'cargando') return <Cargando texto="Abriendo VG Visitas…" />
  if (estado !== 'con_sesion') return <Redirect href="/login" />
  const quien = estadoPersona({ role: perfil?.usuario.role, persona: perfil?.persona, sinPersona: perfil?.sinPersona, sinConfirmar, supervisa: perfil?.supervisa })
  return <Redirect href={quien === 'supervisa' ? '/equipo' : '/hoy'} />
}
