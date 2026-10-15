// Utilidades de las rutas viejas de /visits (mapa de calor, estadísticas y cobertura) para convivir con las visitas
// de la app (migración 0830): las anuladas (deleted_at) no cuentan en ninguna. Antes de la 0830 la columna deleted_at
// no existe: la consulta se hace sin ese filtro (no hay visitas de la app). La carpeta empieza por "_" para que
// Next.js no la exponga como ruta. Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md.
//
// F1a (0850): el mapa de asignación no cambia. Las visitas de la app SIN Ejecutivo Comercial (las de una líder, como
// líder: sin zona) no van al mapa de calor, a las estadísticas ni a la cobertura: FILTRO_MAPA_ASIGNACION (las de VMO no
// tienen executive_id y siguen saliendo). Dónde ha estado cada persona se verá en el mapa de calor de /equipo (F4, A3).
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Filtro de PostgREST (`.or(...)`) que deja fuera las visitas de la app sin Ejecutivo Comercial:
 * source <> 'app' OR executive_id IS NOT NULL. Usa columnas de la 0830 (source, executive_id): solo cuando existen.
 */
export const FILTRO_MAPA_ASIGNACION = 'source.neq.app,executive_id.not.is.null'

/** ¿El error dice que una columna no existe? (la migración 0830 aún no está aplicada) */
export function esColumnaInexistente(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }
  return code === '42703' || code === 'PGRST204' || /column [\w."]+ does not exist/i.test(message ?? '')
}

/**
 * Corre la consulta sin las anuladas y, si la base aún no tiene deleted_at (antes de la 0830), otra vez sin ese
 * filtro. `consultar(true)` debe añadir `.is('deleted_at', null)`. Sirve para consultas GET (el error trae su código);
 * para conteos con `head: true` (HEAD, sin cuerpo de error) usar visitsTieneAnulacion.
 */
export async function sinAnuladas<R extends { error: unknown }>(consultar: (filtrarAnuladas: boolean) => PromiseLike<R>): Promise<R> {
  const conFiltro = await consultar(true)
  if (conFiltro.error && esColumnaInexistente(conFiltro.error)) return consultar(false)
  return conFiltro
}

/**
 * ¿visits ya tiene deleted_at (la 0830 aplicada)? Una lectura mínima por GET: un HEAD que falla no trae el código del
 * error (PostgREST no manda cuerpo), así que los conteos preguntan antes. Otro error se lanza.
 */
export async function visitsTieneAnulacion(): Promise<boolean> {
  const { error } = await supabaseAdmin.from('visits').select('deleted_at').limit(1)
  if (!error) return true
  if (esColumnaInexistente(error)) return false
  throw error
}
