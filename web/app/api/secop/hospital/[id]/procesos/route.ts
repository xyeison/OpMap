import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { isUuid, serverError } from '@/app/api/_lib/api-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { nitFromHospitalCode } from '@/lib/adres-parse.mjs'
import { SECOP_VENTANA_MESES, resolverCompraPublica, ventanaMeses } from '@/lib/compras-publicas'
import { PROCESOS_FICHA_MAX, resumirProcesos, textoVentana } from '@/lib/mapa-detalle'
import type { ProcesosDetalle, Ventana } from '@/lib/types/mapa-detalle'
import { isMissingRelationError, loadProcesosRadar, loadVigiladosActivos, naturalezaDeNit } from '../../../_lib/secop-server'
import { hoyBogota } from '../../../_lib/hoy'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

function dbError(label: string, error: unknown): Error {
  const message = (error as { message?: string } | null)?.message ?? String(error)
  return Object.assign(new Error(`Error leyendo ${label}: ${message}`), { dbError: error })
}

/**
 * Criterio 3 de resolverCompraPublica ("el NIT ya tiene contratos cargados en SECOP"), el mismo que usa la ficha
 * (/api/secop/hospital/[id], que cuenta los contratos de loadContratosEntidad), pero sin traer el histórico: una consulta
 * de existencia (select id, limit 1) en la vista secop_contratos_unicos, como la tarjeta del mapa. Sin la vista → 0.
 */
async function contratosCargados(nit: string): Promise<number> {
  const { data, error } = await supabaseAdmin.from('secop_contratos_unicos').select('id').eq('nit_entidad', nit).limit(1)
  if (error) {
    if (isMissingRelationError(error)) return 0
    throw dbError('secop_contratos_unicos', error)
  }
  return data?.length ?? 0
}

/**
 * ¿Es la IPS entidad de compra pública? La regla de la ficha (resolverCompraPublica): marca manual de la sede →
 * naturaleza del REPS del NIT → contratos del NIT cargados en SECOP. Solo se lee lo que hace falta para decidir.
 */
async function esCompraPublica(nit: string, compraPublica: boolean | null): Promise<boolean> {
  if (compraPublica === true || compraPublica === false) return resolverCompraPublica(compraPublica, null, 0).publica
  const naturaleza = await naturalezaDeNit(nit)
  const porReps = resolverCompraPublica(null, naturaleza, 0)
  if (porReps.origen !== 'ninguno') return porReps.publica
  return resolverCompraPublica(null, naturaleza, await contratosCargados(nit)).publica
}

// GET /api/secop/hospital/[id]/procesos
// Tarjeta "Procesos publicados sin contrato (SECOP II)" de la ficha de la IPS (radar comercial, spec
// docs/specs/2026-10-25-secop-procesos-radar.md): los procesos de SECOP II del NIT de la IPS publicados en los últimos
// 24 meses (la ventana de la ficha) que no tienen contrato cargado de la misma entidad (vista secop_procesos_radar).
// Respuesta ProcesosDetalle { ventana, total, procesos }: más recientes primero, como máximo PROCESOS_FICHA_MAX (50);
// total cuenta todos. El precio base es de la convocatoria y NUNCA se suma (no hay ningún total de valor).
// - Permiso secop:procesos (los roles con intelligence:view y los Ejecutivos Comerciales): solo esta lista, nunca las
//   compras ni nada de /inteligencia.
// - IPS activa (404 si no existe o está inactiva). Solo si es entidad de compra pública (misma regla que la ficha);
//   si no lo es, o sin NIT válido, total 0 sin leer los procesos.
// - Sin la vista o la tabla (migración 0890 sin aplicar): 200 con total 0 (el código se puede desplegar antes).
// - Nunca el título del proceso, la descripción, documentos, hashes ni nombres de personas naturales (lo garantizan
//   las columnas de loadProcesosRadar y resumirProcesos).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'secop:procesos')
  if (!auth.ok) return auth.response

  const id = String(params?.id || '')
  if (!isUuid(id)) return NextResponse.json({ error: 'ID de IPS no válido' }, { status: 400 })

  try {
    const { data, error } = await supabaseAdmin.from('hospitals').select('id, code, compra_publica').eq('id', id).eq('active', true).limit(1)
    if (error) throw dbError('hospitals', error)
    const hospital = data?.[0] as { id: string; code: string | null; compra_publica?: boolean | null } | undefined
    if (!hospital) return NextResponse.json({ error: 'IPS no encontrada' }, { status: 404 })
    const compraPublica = hospital.compra_publica === true || hospital.compra_publica === false ? hospital.compra_publica : null

    // Ventana de la ficha: 24 meses calendario hasta hoy en Bogotá (desde = día 1 de hace 23 meses), por fecha de publicación
    const { desde, hasta } = ventanaMeses(hoyBogota(), SECOP_VENTANA_MESES)
    const ventana: Ventana = { desde, hasta, texto: textoVentana(desde, 'hoy') }
    const vacio: ProcesosDetalle = { ventana, total: 0, procesos: [], empresas: [], sinEmpresa: 0 }

    const nit = nitFromHospitalCode(hospital.code)
    if (!nit || !(await esCompraPublica(nit, compraPublica))) return NextResponse.json(vacio, { headers: NO_STORE })

    // Se lee toda la ventana del NIT (pocas filas de columnas cortas) para que `total` sea exacto; se corta en resumirProcesos.
    const filas = await loadProcesosRadar({ nits: [nit], desde, hasta })
    if (filas.length === 0) return NextResponse.json(vacio, { headers: NO_STORE })
    // Marca "Vigilado" con la lista activa de hoy; sin la tabla, la marca que guardó la carga.
    const vigilados = await loadVigiladosActivos().catch(err => {
      if (isMissingRelationError(err)) return null
      throw err
    })
    const body: ProcesosDetalle = resumirProcesos(filas, { limite: PROCESOS_FICHA_MAX, ventana, vigilados }) ?? vacio
    return NextResponse.json(body, { headers: NO_STORE })
  } catch (error) {
    return serverError('secop/hospital/procesos GET', error, 'Error al cargar los procesos de SECOP')
  }
}
