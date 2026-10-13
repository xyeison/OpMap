// GET /api/executives/traspasos (executives:view) — historial de traspasos (ejecutivas_traspasos, inmutable): quién
// entregó, quién recibió, qué líneas, la fecha, las opciones, el motivo, quién lo hizo y el resumen de lo que se
// movió, del más reciente al más antiguo. ?executive_id=<uuid> deja solo los de esa persona (entregó o recibió).
// El motivo (texto libre que se escribe al dar de baja a alguien: "renuncia", "despido"...) solo lo reciben quienes
// administran el equipo (executives:edit o executives:transfer); para los demás roles va en null.
// 200 TraspasosHistorialResponse; 400 executive_id no válido; 503 si falta la migración 0820.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { hasPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows, jsonError } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE } from '@/lib/fase1-schemas'
import {
  leerResumenTraspaso,
  type TipoDestino,
  type TraspasoHistorialItem,
  type TraspasosHistorialResponse,
} from '@/lib/traspaso'
import { MENSAJE_FALTA_MIGRACION_TRASPASO, faltaMigracion } from '../_lib/traspaso-server'

export const dynamic = 'force-dynamic'

interface FilaTraspaso {
  id: string
  origen_id: string
  destino_id: string | null
  destino_tipo: TipoDestino
  lineas: string[] | null
  fecha: string
  dar_de_baja: boolean
  desactivar_usuario: boolean
  copiar_excepciones: boolean
  motivo: string | null
  resumen: unknown
  created_by: string | null
  created_at: string
}

const COLUMNAS =
  'id, origen_id, destino_id, destino_tipo, lineas, fecha, dar_de_baja, desactivar_usuario, copiar_excepciones, motivo, resumen, created_by, created_at'

async function nombresPorId(tabla: 'executives' | 'users', ids: Iterable<string | null>): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(Array.from(ids).filter((id): id is string => Boolean(id))))
  const nombres = new Map<string, string>()
  for (let inicio = 0; inicio < unicos.length; inicio += 100) {
    const trozo = unicos.slice(inicio, inicio + 100)
    const columnas = tabla === 'users' ? 'id, full_name, email' : 'id, full_name'
    const { data, error } = await supabaseAdmin.from(tabla).select(columnas).in('id', trozo)
    if (error) throw error
    for (const fila of (data || []) as unknown as Array<{ id: string; full_name: string | null; email?: string | null }>) {
      const nombre = fila.full_name || fila.email || ''
      if (nombre) nombres.set(fila.id, nombre)
    }
  }
  return nombres
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'executives:view')
  if (!auth.ok) return auth.response

  const filtro = request.nextUrl.searchParams.get('executive_id')
  if (filtro !== null && !UUID_RE.test(filtro)) return jsonError('executive_id no válido', 400)
  const persona = filtro ? filtro.toLowerCase() : null
  const veMotivo = hasPermission(auth.user.role, 'executives:edit') || hasPermission(auth.user.role, 'executives:transfer')

  try {
    let filas: FilaTraspaso[]
    try {
      filas = await fetchAllRows<FilaTraspaso>((from, to) =>
        supabaseAdmin
          .from('ejecutivas_traspasos')
          .select(COLUMNAS)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      )
    } catch (error) {
      if (faltaMigracion(error)) return jsonError(MENSAJE_FALTA_MIGRACION_TRASPASO, 503)
      throw error
    }
    if (persona) filas = filas.filter(fila => fila.origen_id === persona || fila.destino_id === persona)

    const [ejecutivas, usuarios, lineasData] = await Promise.all([
      nombresPorId('executives', filas.flatMap(fila => [fila.origen_id, fila.destino_id])),
      nombresPorId('users', filas.map(fila => fila.created_by)),
      supabaseAdmin.from('business_lines').select('id, name').range(0, 9999),
    ])
    if (lineasData.error) throw lineasData.error
    const lineas = new Map<string, string>()
    for (const linea of (lineasData.data || []) as Array<{ id: string; name: string }>) lineas.set(linea.id, linea.name)

    const traspasos: TraspasoHistorialItem[] = filas.map(fila => {
      const ids = Array.isArray(fila.lineas) ? fila.lineas : []
      return {
        id: fila.id,
        origen_id: fila.origen_id,
        origen_nombre: ejecutivas.get(fila.origen_id) ?? null,
        destino_id: fila.destino_id,
        destino_nombre: fila.destino_id ? ejecutivas.get(fila.destino_id) ?? null : null,
        destino_tipo: fila.destino_tipo,
        lineas: ids,
        lineas_nombres: ids.map(id => lineas.get(id) ?? 'Línea desconocida'),
        fecha: fila.fecha,
        dar_de_baja: fila.dar_de_baja,
        desactivar_usuario: fila.desactivar_usuario,
        copiar_excepciones: fila.copiar_excepciones,
        motivo: veMotivo ? fila.motivo : null,
        resumen: leerResumenTraspaso(fila.resumen),
        created_by: fila.created_by,
        created_by_nombre: fila.created_by ? usuarios.get(fila.created_by) ?? null : null,
        created_at: fila.created_at,
      }
    })

    const body: TraspasosHistorialResponse = { traspasos }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en GET /api/executives/traspasos:', error)
    return jsonError('Error al cargar el historial de traspasos', 500)
  }
}
