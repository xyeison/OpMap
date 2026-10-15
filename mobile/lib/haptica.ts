/**
 * Vibración corta (expo-haptics, incluido en Expo Go SDK 57): al empezar y terminar de grabar y con el 201 de una
 * visita. En el navegador no hace nada, y nunca lanza: si el teléfono no vibra, lo tiene apagado o el módulo nativo
 * falta, la app sigue igual.
 *
 * Sin react-native ni expo-haptics arriba del archivo (las pruebas lo cargan en Node): la plataforma sale de
 * process.env.EXPO_OS, que babel-preset-expo deja escrita en el paquete ('ios', 'android' o 'web'), y expo-haptics se
 * carga recién al primer toque, dentro del try. Así un módulo nativo que falte no tumba la pantalla que lo importa.
 */

export type ToqueHaptico = 'suave' | 'exito' | 'aviso'

/** Lo que hace vibrar. El de verdad es expo-haptics; las pruebas ponen uno falso con usarMotorHaptico. */
export type MotorHaptico = (toque: ToqueHaptico) => unknown

let motorFijado: MotorHaptico | null = null

/** Solo para las pruebas: cambia el motor (null vuelve a expo-haptics). */
export function usarMotorHaptico(motor: MotorHaptico | null): void {
  motorFijado = motor
}

function motorExpo(): MotorHaptico {
  const Haptics = require('expo-haptics') as typeof import('expo-haptics')
  return toque =>
    toque === 'suave'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(toque === 'exito' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning)
}

/** Vibra una vez. No hace nada en web; nunca lanza ni deja una promesa rechazada sin atender. */
export function vibrar(toque: ToqueHaptico): void {
  if (process.env.EXPO_OS === 'web') return
  try {
    const resultado = (motorFijado ?? motorExpo())(toque)
    if (resultado && typeof (resultado as Promise<unknown>).then === 'function') {
      ;(resultado as Promise<unknown>).then(undefined, () => undefined)
    }
  } catch {
    // sin vibración: la app sigue igual
  }
}

/** Toque suave (empezar o terminar de grabar). */
export function vibrarSuave(): void {
  vibrar('suave')
}

/** Éxito (la visita quedó guardada). */
export function vibrarExito(): void {
  vibrar('exito')
}

/** Aviso (algo no salió: revisa). */
export function vibrarAviso(): void {
  vibrar('aviso')
}
