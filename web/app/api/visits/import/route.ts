import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { isUuid, readJsonBody, serverError } from '../../_lib/api-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { importarMesVmo } from '../_lib/importar-vmo'

export const runtime = 'nodejs'
export const maxDuration = 60

// Importación mensual de visitas (app/visits). Servidor con service_role (R2-M-04: antes usaba
// el cliente de rutas de @supabase/auth-helpers, que sin sesión de Supabase Auth actúa como anon
// y fallaría con RLS).
// Permiso: visits:manage (admin, data_manager).

// Importador de VMO DESHABILITADO (decisión del dueño 2026-10-12, docs/decisiones/2026-10-12-app-de-visita.md):
// VMO se apaga y las visitas nuevas se reportan desde la app de visita. La importación vive en
// ../_lib/importar-vmo.ts (probada en scripts/reporte-api-check.ts): el borrado del mes se limita a
// source = 'vmo_import' (columna de la migración 0830; las visitas de la app no se tocan) y, si el borrado falla, no
// se inserta nada. Reactivarlo (poner esto en true) es decisión del dueño.
const VMO_IMPORT_ENABLED = false

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:manage')
  if (!auth.ok) return auth.response
  if (!VMO_IMPORT_ENABLED) {
    return NextResponse.json(
      { error: 'La importación de visitas de VMO está deshabilitada: las visitas nuevas se reportan desde la app de visita.' },
      { status: 410 },
    )
  }

  try {
    return await importarMesVmo(await readJsonBody(request), auth.user.id)
  } catch (error) {
    return serverError('visits/import POST', error, 'Error al procesar la importación')
  }
}

// Con el importador deshabilitado, borrar una importación destruiría para siempre parte del histórico de VMO (ya no se
// puede volver a importar). El mismo interruptor que DELETE /api/visits/imports.
const VMO_IMPORT_DELETE_ENABLED = false

// DELETE: eliminar una importación concreta y sus visitas
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:manage')
  if (!auth.ok) return auth.response
  if (!VMO_IMPORT_DELETE_ENABLED) {
    return NextResponse.json(
      { error: 'Borrar importaciones de VMO está deshabilitado: el histórico ya no se puede volver a importar.' },
      { status: 410 },
    )
  }

  try {
    const importId = new URL(request.url).searchParams.get('importId')
    if (!isUuid(importId)) {
      return NextResponse.json({ error: 'ID de importación requerido' }, { status: 400 })
    }

    const { error: deleteVisitsError } = await supabaseAdmin.from('visits').delete().eq('import_id', importId)
    if (deleteVisitsError) return serverError('visits/import DELETE (visitas)', deleteVisitsError, 'Error al eliminar las visitas')

    const { data: deletedImports, error: deleteImportError } = await supabaseAdmin
      .from('visit_imports')
      .delete()
      .eq('id', importId)
      .select('id')

    if (deleteImportError) {
      return serverError('visits/import DELETE (registro)', deleteImportError, 'Error al eliminar las visitas')
    }
    if (!deletedImports || deletedImports.length === 0) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError('visits/import DELETE', error, 'Error al eliminar las visitas')
  }
}
