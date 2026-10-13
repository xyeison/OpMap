// GET /api/config-visitas (visits:config) — toda la configuración de visitas para /configuracion: metas, qué cuenta
// (conteo), parámetros generales y personas con TODAS sus filas (vigentes, cerradas y anuladas, con quién las puso o
// anuló), los subtipos institucionales (también los apagados), las zonas y los Ejecutivos Comerciales.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { zoneDisplayName } from '@/lib/zone-names'
import { fetchAllRows } from '@/app/api/kams/_lib/kam-shared'
import {
  municipioDeZona,
  type ConfigBase,
  type ConfigVisitasResponse,
  type EjecutivaOpcion,
  type EstadoEjecutiva,
  type Subtipo,
  type ZonaOpcion,
} from '@/lib/visits-rules'
import { errorVisitas, hoyActual, leerConfig, nombresUsuarios } from './_lib/visitas-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:config')
  if (!auth.ok) return auth.response

  try {
    const [metas, conteo, general, personas, subtipos, kams, ejecutivas] = await Promise.all([
      leerConfig('config_metas'),
      leerConfig('config_conteo'),
      leerConfig('config_general'),
      leerConfig('config_personas'),
      fetchAllRows<Subtipo>((from, to) =>
        supabaseAdmin
          .from('subtipos_institucionales')
          .select('id, codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde, vigente_hasta, created_by, created_at, updated_at')
          .order('orden')
          .order('codigo')
          .range(from, to)
      ),
      fetchAllRows<{ id: string; name: string | null; area_id: string | null; active: boolean | null }>((from, to) =>
        supabaseAdmin.from('kams').select('id, name, area_id, active').order('name').order('id').range(from, to)
      ),
      fetchAllRows<{ id: string; full_name: string; base_kam_id: string | null; status: EstadoEjecutiva }>((from, to) =>
        supabaseAdmin.from('executives').select('id, full_name, base_kam_id, status').order('full_name').order('id').range(from, to)
      ),
    ])

    const filas: ConfigBase[] = [...metas, ...conteo, ...general, ...personas]
    const usuarios = await nombresUsuarios(filas.flatMap(fila => [fila.set_by, fila.anulado_por]))
    const conNombres = <T extends ConfigBase>(lista: T[]): T[] =>
      lista.map(fila => ({
        ...fila,
        set_by_nombre: fila.set_by ? usuarios.get(fila.set_by) ?? null : null,
        anulado_por_nombre: fila.anulado_por ? usuarios.get(fila.anulado_por) ?? null : null,
      }))

    // Zonas: las activas y las que alguna meta o alguna persona todavía usa.
    const usadas = new Set<string>([
      ...metas.map(meta => meta.kam_id).filter((id): id is string => Boolean(id)),
      ...ejecutivas.map(ejecutiva => ejecutiva.base_kam_id).filter((id): id is string => Boolean(id)),
    ])
    const nombreZona = new Map(kams.map(kam => [kam.id, zoneDisplayName(kam.name) || 'Zona']))
    const zonas: ZonaOpcion[] = kams
      .filter(kam => kam.active !== false || usadas.has(kam.id))
      .map(kam => ({ id: kam.id, nombre: nombreZona.get(kam.id) ?? 'Zona', municipio: municipioDeZona(kam.area_id) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    const opcionesEjecutivas: EjecutivaOpcion[] = ejecutivas.map(ejecutiva => ({
      id: ejecutiva.id,
      nombre: ejecutiva.full_name,
      kam_id: ejecutiva.base_kam_id,
      zona: ejecutiva.base_kam_id ? nombreZona.get(ejecutiva.base_kam_id) ?? null : null,
      status: ejecutiva.status,
    }))

    const respuesta: ConfigVisitasResponse = {
      hoy: hoyActual(),
      metas: conNombres(metas),
      conteo: conNombres(conteo),
      general: conNombres(general),
      personas: conNombres(personas),
      subtipos,
      zonas,
      ejecutivas: opcionesEjecutivas,
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorVisitas('GET /api/config-visitas', error, 'Error al cargar la configuración de visitas')
  }
}
