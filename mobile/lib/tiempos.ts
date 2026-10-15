/**
 * Marcas de tiempo del reporte en el teléfono (spec 2026-10-15, "Medición"): en desarrollo (`__DEV__`) se escriben en la
 * terminal de Metro como `[tiempos-app]`, para decidir la tanda 2 con cifras. Solo nombres de marca y números: nunca lo
 * que se dijo, ids ni coordenadas. En producción no escriben nada.
 *
 *   [tiempos-app] propuesta +3120 ms (desde lista_pintada 9870 ms) bytes=120000
 *
 * Cada marca lleva lo que pasó desde la marca anterior y desde el inicio del reporte: `lista_pintada` y `toque_hablar`
 * empiezan una cuenta nueva si no hay una en curso o si la anterior tiene más de MAX_RECORRIDO_MS; `visita_guardada`
 * la cierra. Puro (sin react-native): lo prueba scripts/checks/18-tiempos.ts con un reloj falso.
 */

export type MarcaReporte =
  | 'lista_pintada'
  | 'toque_hablar'
  | 'grabando'
  | 'fin_grabacion'
  | 'transcripcion'
  | 'propuesta'
  | 'primer_toque_tarjeta'
  | 'toque_confirmar'
  | 'visita_guardada'

/** Las 9 marcas, en el orden de un reporte por voz. */
export const MARCAS_REPORTE: readonly MarcaReporte[] = [
  'lista_pintada',
  'toque_hablar',
  'grabando',
  'fin_grabacion',
  'transcripcion',
  'propuesta',
  'primer_toque_tarjeta',
  'toque_confirmar',
  'visita_guardada',
]

/** Un recorrido más viejo que esto ya no es el mismo reporte: la siguiente marca de inicio empieza otro. */
export const MAX_RECORRIDO_MS = 15 * 60_000

const INICIOS: ReadonlySet<MarcaReporte> = new Set<MarcaReporte>(['lista_pintada', 'toque_hablar'])
const NOMBRE_DATO = /^[a-z][a-z0-9_]{0,23}$/

export interface RegistroMarcas {
  /** Deja la marca y devuelve la línea escrita (o null si está apagado o la marca no es válida). */
  marcar(marca: MarcaReporte, datos?: Record<string, number>): string | null
  /** Olvida el recorrido en curso. */
  reiniciar(): void
}

/** El registro con reloj y salida inyectados (la app usa el de abajo; las pruebas, uno con reloj falso). */
export function crearRegistroMarcas(o: { reloj: () => number; escribir: (linea: string) => void; activo: () => boolean }): RegistroMarcas {
  let inicio: { marca: MarcaReporte; en: number } | null = null
  let anterior: number | null = null
  return {
    marcar(marca, datos) {
      if (!o.activo() || !MARCAS_REPORTE.includes(marca)) return null
      const ahora = o.reloj()
      if (!Number.isFinite(ahora)) return null
      const viejo = inicio !== null && ahora - inicio.en > MAX_RECORRIDO_MS
      if (viejo) {
        inicio = null
        anterior = null
      }
      if (!inicio && INICIOS.has(marca)) {
        inicio = { marca, en: ahora }
        anterior = ahora
      }
      const partes = [`[tiempos-app] ${marca}`]
      if (anterior !== null && inicio && inicio.en !== ahora) {
        partes.push(`+${Math.max(0, Math.round(ahora - anterior))} ms (desde ${inicio.marca} ${Math.max(0, Math.round(ahora - inicio.en))} ms)`)
      }
      for (const [nombre, valor] of Object.entries(datos ?? {})) {
        if (NOMBRE_DATO.test(nombre) && typeof valor === 'number' && Number.isFinite(valor)) partes.push(`${nombre}=${Math.round(valor)}`)
      }
      if (inicio) anterior = ahora
      if (marca === 'visita_guardada') {
        inicio = null
        anterior = null
      }
      const linea = partes.join(' ')
      try {
        o.escribir(linea)
      } catch {
        // medir nunca rompe la app
      }
      return linea
    },
    reiniciar() {
      inicio = null
      anterior = null
    },
  }
}

/** ¿Es una compilación de desarrollo? (`__DEV__` lo define React Native; en Node no existe → no). */
function enDesarrollo(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true
}

function relojApp(): number {
  const rendimiento = (globalThis as { performance?: { now?: () => number } }).performance
  return typeof rendimiento?.now === 'function' ? rendimiento.now() : Date.now()
}

const registro = crearRegistroMarcas({ reloj: relojApp, escribir: linea => console.log(linea), activo: enDesarrollo })

/** Deja una marca (con números opcionales, p. ej. { bytes: 120000 }). Solo escribe en desarrollo; nunca lanza. */
export function marcar(marca: MarcaReporte, datos?: Record<string, number>): void {
  try {
    registro.marcar(marca, datos)
  } catch {
    // medir nunca rompe la app
  }
}
