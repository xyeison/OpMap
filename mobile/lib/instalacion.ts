/**
 * Textos de "Agregar a la pantalla de inicio" (PWA en /campo, dueño 2026-10-30). Puros: los leen la pantalla
 * app/(app)/instalar.tsx y las pruebas (scripts/checks/22-sin-senal.ts).
 */

export const PORQUE_INSTALAR =
  'Así abre sin señal desde su ícono, como una app: lo que reportes se guarda en el teléfono y se sube solo al volver la conexión. En Android sube aunque la cierres; en iPhone, al abrirla.'

export const PASOS_ANDROID: readonly string[] = [
  'Abre /campo en Chrome y entra con tu usuario de OpMap.',
  'Toca el menú de los tres puntos (arriba a la derecha).',
  'Toca "Agregar a la pantalla principal" (o "Instalar app").',
  'Confirma con "Agregar". El ícono "VG Visitas" queda en tu pantalla de inicio.',
  'Abre la app desde ese ícono una vez con internet: desde ahí abre también sin señal.',
]

export const PASOS_IPHONE: readonly string[] = [
  'Abre /campo en Safari (no en Chrome) y entra con tu usuario de OpMap.',
  'Toca el botón "Compartir" (el cuadrado con la flecha hacia arriba, abajo en el centro).',
  'Desliza y toca "Agregar a la pantalla de inicio".',
  'Toca "Agregar" arriba a la derecha. El ícono "VG Visitas" queda en tu pantalla de inicio.',
  'Abre la app desde ese ícono una vez con internet. Lo pendiente se sube cuando la abres con señal (en iPhone no sube con la app cerrada).',
]

export const AVISO_INCOGNITO = 'No uses el modo incógnito: el navegador borra lo guardado al cerrar y perderías los reportes pendientes.'
export const AVISO_NO_INSTALADA = 'Agrega VG Visitas a tu pantalla de inicio para abrirla sin señal.'

/** Qué pasos van primero: los del teléfono en que está. */
export function pasosParaEsteTelefono(esIphone: boolean): 'iphone' | 'android' {
  return esIphone ? 'iphone' : 'android'
}
