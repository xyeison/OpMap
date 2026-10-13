// Utilidades de servidor del traspaso de un Ejecutivo Comercial (carpeta "_lib": Next.js no la expone como ruta).
// Las usan POST /api/executives/[id]/traspaso, su vista previa y GET /api/executives/traspasos.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. Decisión del dueño:
// docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md ("si alguien se va o se le quita, pues ya no está").
//
// Aquí NO hay reglas de negocio: la vista previa la calcula planearTraspaso (lib/traspaso.ts) con las filas que
// carga cargarDatosTraspaso, y el traspaso lo hace la función atómica ejecutivas_traspasar (migración 0820).
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/app/api/kams/_lib/kam-shared'
import type {
  AjusteTraspaso,
  CoberturaTraspaso,
  DatosTraspaso,
  EjecutivaTraspaso,
  EstadoEjecutiva,
  ExcepcionTraspaso,
  LineaTraspaso,
  NombreTerritorioTraspaso,
  TraspasoError,
  TraspasoInput,
  UsuarioTraspaso,
  VisitanteTraspaso,
  ZonaTraspaso,
} from '@/lib/traspaso'

/** Error de PostgREST / PostgreSQL tal como lo devuelve supabase-js. */
export type ErrorBase = { code?: string; message?: string; details?: string | null; hint?: string | null }

/** Mensaje del 503 mientras la migración 0820 no esté aplicada (la vista previa no la necesita). */
export const MENSAJE_FALTA_MIGRACION_TRASPASO =
  'El traspaso aún no está disponible: falta aplicar la migración 0820 (traspaso de Ejecutivos Comerciales) en la base de datos'

/**
 * Mensaje cuando la llamada a ejecutivas_traspasar falló sin un error de la base que la API sepa explicar (corte de
 * red, respuesta perdida, pasarela caída): la transacción pudo confirmarse igual, así que NO se afirma que el
 * traspaso no se hizo; se remite al historial (si aparece ahí, quedó hecho y falta recalcular la cobertura).
 */
export const MENSAJE_RESULTADO_INCIERTO =
  'No se pudo confirmar si el traspaso se hizo (falló la comunicación con la base de datos). Antes de repetirlo, revisa el historial de traspasos: si aparece ahí, ya quedó hecho y falta pulsar «Recalcular» en la cobertura de la línea.'

/** true si el error dice que falta una tabla, una columna o una función (migración sin aplicar). */
export function faltaMigracion(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as ErrorBase
  if (code && ['42P01', '42883', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) return true
  return (
    typeof message === 'string' &&
    /Could not find the (table|function|column)|relation .* does not exist|function .* does not exist|column .* does not exist/i.test(
      message
    )
  )
}

// ---------------------------------------------------------------------------------------------
// Filas para la vista previa
// ---------------------------------------------------------------------------------------------

type FilaEjecutiva = Omit<EjecutivaTraspaso, 'lines'> & { color: string | null; started_at: string | null }
type FilaVisitante = Omit<VisitanteTraspaso, 'medico_nombre' | 'medico_activo'>
type FilaExcepcion = Omit<ExcepcionTraspaso, 'tabla'>

const TROZO_IDS = 100

function enTrozos<T>(valores: readonly T[], tamano = TROZO_IDS): T[][] {
  const trozos: T[][] = []
  for (let inicio = 0; inicio < valores.length; inicio += tamano) trozos.push(valores.slice(inicio, inicio + tamano))
  return trozos
}

async function medicosPorId(ids: string[]): Promise<Map<string, { nombre: string | null; activo: boolean }>> {
  const medicos = new Map<string, { nombre: string | null; activo: boolean }>()
  for (const trozo of enTrozos(Array.from(new Set(ids)))) {
    const filas = await fetchAllRows<{ id: string; nombre: string | null; activo: boolean }>((from, to) =>
      supabaseAdmin.from('medicos').select('id, nombre, activo').in('id', trozo).order('id').range(from, to)
    )
    for (const fila of filas) medicos.set(fila.id, { nombre: fila.nombre, activo: fila.activo === true })
  }
  return medicos
}

/**
 * Lee todo lo que necesita planearTraspaso (solo SELECT): todas las ejecutivas con sus líneas (para residentes,
 * conflictos y el email de la persona nueva), las líneas en su orden, las zonas, la cobertura guardada y los ajustes
 * manuales activos de quien entrega, y los nombres de territorio, visitantes abiertos y excepciones personales de
 * quien entrega y de quien recibe (si ya existe), y el usuario de OpMap de quien entrega (rol y si está activo: decide
 * si el traspaso lo desactiva). solicitanteId = quien hace el traspaso (su propio usuario nunca se desactiva). No
 * necesita la migración 0820.
 */
export async function cargarDatosTraspaso(
  origenId: string,
  input: TraspasoInput,
  hoy: string,
  solicitanteId: string | null = null
): Promise<DatosTraspaso> {
  const destinoId = input.destino.tipo === 'existente' ? input.destino.id : null
  const personas = destinoId && destinoId !== origenId ? [origenId, destinoId] : [origenId]

  const [ejecutivas, vinculos, lineas, zonas, cobertura, ajustes, nombres, visitantes, perfiles, metas] =
    await Promise.all([
      fetchAllRows<FilaEjecutiva>((from, to) =>
        supabaseAdmin
          .from('executives')
          .select('id, full_name, email, status, base_kam_id, user_id, color, started_at')
          .order('id')
          .range(from, to)
      ),
      fetchAllRows<{ executive_id: string; line_id: string }>((from, to) =>
        supabaseAdmin
          .from('executive_lines')
          .select('executive_id, line_id')
          .order('executive_id')
          .order('line_id')
          .range(from, to)
      ),
      fetchAllRows<LineaTraspaso & { sort_order: number | null }>((from, to) =>
        supabaseAdmin
          .from('business_lines')
          .select('id, code, name, sort_order')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      ),
      fetchAllRows<ZonaTraspaso>((from, to) => supabaseAdmin.from('kams').select('id, name').order('id').range(from, to)),
      fetchAllRows<CoberturaTraspaso>((from, to) =>
        supabaseAdmin
          .from('coverage')
          .select('line_id, kam_id, executive_id, kind')
          .eq('executive_id', origenId)
          .order('line_id')
          .order('kam_id')
          .range(from, to)
      ),
      fetchAllRows<AjusteTraspaso>((from, to) =>
        supabaseAdmin
          .from('coverage_overrides')
          .select('id, line_id, kam_id, executive_id, reason, active')
          .eq('executive_id', origenId)
          .eq('active', true)
          .order('id')
          .range(from, to)
      ),
      fetchAllRows<NombreTerritorioTraspaso>((from, to) =>
        supabaseAdmin
          .from('line_territory_names')
          .select('line_id, executive_id, name')
          .in('executive_id', personas)
          .order('line_id')
          .order('executive_id')
          .range(from, to)
      ),
      fetchAllRows<FilaVisitante>((from, to) =>
        supabaseAdmin
          .from('medico_visitantes')
          .select('id, medico_id, executive_id, line_id, municipality_id, desde, hasta')
          .in('executive_id', personas)
          .is('hasta', null)
          .order('id')
          .range(from, to)
      ),
      fetchAllRows<FilaExcepcion>((from, to) =>
        supabaseAdmin
          .from('config_personas')
          .select('id, executive_id, vigente_desde, vigente_hasta, anulado_at')
          .in('executive_id', personas)
          .is('anulado_at', null)
          .order('id')
          .range(from, to)
      ),
      fetchAllRows<FilaExcepcion>((from, to) =>
        supabaseAdmin
          .from('config_metas')
          .select('id, executive_id, tipo, subtipo_id, vigente_desde, vigente_hasta, anulado_at')
          .eq('scope', 'ejecutiva')
          .in('executive_id', personas)
          .is('anulado_at', null)
          .order('id')
          .range(from, to)
      ),
    ])

  const lineasPorEjecutiva = new Map<string, string[]>()
  for (const vinculo of vinculos) {
    const lista = lineasPorEjecutiva.get(vinculo.executive_id) ?? []
    lista.push(vinculo.line_id)
    lineasPorEjecutiva.set(vinculo.executive_id, lista)
  }

  const medicos = await medicosPorId(visitantes.map(visitante => visitante.medico_id))

  // Usuario de OpMap de quien entrega: su rol y si está activo deciden si el traspaso lo desactiva (regla 9).
  const usuarioOrigenId = ejecutivas.find(ejecutiva => ejecutiva.id === origenId)?.user_id ?? null
  let usuarios: UsuarioTraspaso[] = []
  if (usuarioOrigenId) {
    const { data, error } = await supabaseAdmin.from('users').select('id, role, active').eq('id', usuarioOrigenId).limit(1)
    if (error) throw error
    usuarios = ((data || []) as Array<{ id: string; role: string | null; active: boolean | null }>).map(fila => ({
      id: fila.id,
      role: fila.role ?? '',
      active: fila.active === true,
    }))
  }

  return {
    hoy,
    origen_id: origenId,
    input,
    ejecutivas: ejecutivas.map(ejecutiva => ({
      id: ejecutiva.id,
      full_name: ejecutiva.full_name,
      email: ejecutiva.email,
      status: ejecutiva.status as EstadoEjecutiva,
      base_kam_id: ejecutiva.base_kam_id,
      user_id: ejecutiva.user_id,
      lines: lineasPorEjecutiva.get(ejecutiva.id) ?? [],
      color: ejecutiva.color ?? null,
      started_at: ejecutiva.started_at ?? null,
    })),
    lineas: lineas.map(linea => ({ id: linea.id, name: linea.name, code: linea.code ?? null })),
    zonas,
    cobertura,
    ajustes,
    nombres,
    visitantes: visitantes.map(visitante => ({
      ...visitante,
      medico_nombre: medicos.get(visitante.medico_id)?.nombre ?? null,
      // Un médico que no aparece se trata como inactivo: la función SQL tampoco lo crearía para quien recibe.
      medico_activo: medicos.get(visitante.medico_id)?.activo ?? false,
    })),
    excepciones: [
      ...perfiles.map(fila => ({ ...fila, tabla: 'config_personas' as const })),
      ...metas.map(fila => ({ ...fila, tabla: 'config_metas' as const })),
    ],
    usuarios,
    solicitante_id: solicitanteId,
  }
}

/**
 * Estado HTTP de un pedido que la vista previa rechaza, según el PRIMER error (el que se muestra; es el que
 * ejecutivas_traspasar encontraría primero): quien entrega o quien recibe no existe → 404; email de la persona nueva
 * en uso → 409; cualquier otra regla → 400.
 */
export function estadoDeErrores(errores: readonly TraspasoError[]): number {
  const primero = errores[0]?.codigo
  if (primero === 'origen_no_existe' || primero === 'destino_no_existe') return 404
  if (primero === 'email_en_uso') return 409
  return 400
}

// ---------------------------------------------------------------------------------------------
// Errores de ejecutivas_traspasar
// ---------------------------------------------------------------------------------------------

const MENSAJE_CHOQUE = 'Otro cambio se guardó al mismo tiempo; vuelve a ver la vista previa e inténtalo de nuevo'

/**
 * Traduce el error de ejecutivas_traspasar a { estado, mensaje } (null si no es uno que la API sepa explicar: la
 * ruta responde 500). 22023 (dato no válido) y 23514 (regla) → 400 con el mensaje de la función; P0002 (no existe)
 * → 404; 23505 (email de la persona nueva repetido) → 409; falta la migración 0820 → 503. Cualquier error deshace
 * todo el traspaso (una sola transacción).
 */
export function respuestaErrorTraspaso(error: ErrorBase | null | undefined): { estado: number; mensaje: string } | null {
  if (!error) return null
  if (faltaMigracion(error)) return { estado: 503, mensaje: MENSAJE_FALTA_MIGRACION_TRASPASO }
  const texto = (error.message ?? '').trim()
  const textoTecnico = /violates|constraint|duplicate key|syntax|invalid input/i.test(texto)
  switch (error.code) {
    case '22023':
    case '22P02':
    case '22007':
    case '22008':
      return { estado: 400, mensaje: texto && !textoTecnico ? texto : 'Los datos del traspaso no son válidos' }
    case '23514':
      return { estado: 400, mensaje: texto && !textoTecnico ? texto : 'El traspaso no cumple las reglas: revisa la vista previa' }
    case 'P0002':
      return { estado: 404, mensaje: texto || 'Ejecutivo Comercial no encontrado' }
    case '23505': {
      const deEmail = /email/i.test(`${texto} ${error.details ?? ''}`)
      if (deEmail) return { estado: 409, mensaje: textoTecnico || !texto ? 'Ya hay un Ejecutivo Comercial con ese email' : texto }
      return { estado: 409, mensaje: MENSAJE_CHOQUE }
    }
    case '40001':
    case '40P01':
      return { estado: 409, mensaje: MENSAJE_CHOQUE }
    case '23503':
      return { estado: 400, mensaje: 'Un dato relacionado no existe (Ejecutivo Comercial, línea o usuario)' }
    default:
      return null
  }
}
