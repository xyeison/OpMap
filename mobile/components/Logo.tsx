/**
 * Logotipo "vgmedical" (marca VG Medical, spec 2026-10-14 decisión 10). React Native no pinta SVG sin módulos
 * nativos (y la app debe seguir en Expo Go), así que se usan PNG generados de los vectores de assets/marca/*.svg,
 * a @1x/@2x/@3x con 256 px de ancho base: Metro elige la densidad del teléfono.
 *
 * - variante "claro": logotipo blanco, para fondos oscuros (encabezado negro, modo oscuro).
 * - variante "oscuro": logotipo negro, para fondos claros.
 * Sin variante, se elige según el modo del teléfono (oscuro → "claro").
 */
import { Image, useColorScheme, type ImageStyle, type StyleProp } from 'react-native'

const LOGO_BLANCO = require('../assets/marca/vgmedical-logotipo-blanco.png')
const LOGO_NEGRO = require('../assets/marca/vgmedical-logotipo-negro.png')

/** Ancho ÷ alto del viewBox de vgmedical-logotipo-*.svg (757,83 × 168,68). */
export const PROPORCION_LOGO = 757.83 / 168.68

export type VarianteLogo = 'claro' | 'oscuro'

export interface PropsLogo {
  variante?: VarianteLogo
  /** Ancho en puntos; el alto sale de la proporción del logotipo. */
  ancho?: number
  estilo?: StyleProp<ImageStyle>
  accessibilityLabel?: string
}

export function Logo({ variante, ancho = 160, estilo, accessibilityLabel = 'VG Medical' }: PropsLogo) {
  const esquema = useColorScheme()
  const elegida: VarianteLogo = variante ?? (esquema === 'dark' ? 'claro' : 'oscuro')
  return (
    <Image
      source={elegida === 'claro' ? LOGO_BLANCO : LOGO_NEGRO}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ width: ancho, height: Math.round(ancho / PROPORCION_LOGO) }, estilo]}
    />
  )
}
