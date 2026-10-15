/**
 * Ícono de la app: Ionicons de @expo/vector-icons (incluido en Expo Go SDK 57), relleno si `activo`, contorno si no.
 * El mapa nombre → glifo está en lib/iconos-nombres.ts (puro, lo revisan las pruebas). Color por defecto: el texto.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps, JSX } from 'react'
import { glifoDe, type NombreIcono } from './iconos-nombres'
import { useColores } from './ui'

export type { NombreIcono } from './iconos-nombres'

type GlifoIonicons = ComponentProps<typeof Ionicons>['name']

export function Icono({ nombre, activo = false, tamano = 24, color }: { nombre: NombreIcono; activo?: boolean; tamano?: number; color?: string }): JSX.Element {
  const c = useColores()
  return <Ionicons name={glifoDe(nombre, activo) as GlifoIonicons} size={tamano} color={color ?? c.texto} />
}
