// Puente entre "Actualizar ahora" (POST /api/fuentes/[fuente]/actualizar) y el ejecutor único de las cargas
// (lib/fuentes-runner.ts → ejecutarFuente), el MISMO que llama el cron (GET /api/cron/<fuente>), con el
// mismo presupuesto de tiempo. Así el botón y la carga automática nunca se separan: bloqueo en
// fuentes_estado, cursor incremental y cierre con ok | corriendo | error.
import { esFuenteAutomatica } from '@/lib/fuentes-estado'
import { PRESUPUESTO_CRON_MS, ejecutarFuente } from '@/lib/fuentes-runner'

export interface FuenteRunResult {
  ok: boolean
  terminado: boolean
  estado: string | null
  filas: number | null
  mensaje: string | null
}

/** Presupuesto por invocación (el del cron: Vercel corta a los 60 s; queda margen para cerrar). */
export const PRESUPUESTO_MS = PRESUPUESTO_CRON_MS

/**
 * Corre una ronda de la carga de `fuente`. null = esa fuente no es automática (la ADRES va por GitHub
 * Actions). Si otra invocación la tiene tomada, ok=false con estado 'ocupada' y el mensaje del ejecutor.
 */
export async function runFuenteManual(fuente: string, presupuestoMs: number = PRESUPUESTO_MS): Promise<FuenteRunResult | null> {
  if (!esFuenteAutomatica(fuente)) return null
  const r = await ejecutarFuente(fuente, { presupuestoMs, origen: 'manual' })
  return { ok: r.ok, terminado: r.terminado, estado: r.estado, filas: r.filas, mensaje: r.mensaje }
}
