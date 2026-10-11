import { NextRequest, NextResponse } from 'next/server'
import { RepsImportError } from '@/lib/reps-import'
import { REPS_MAX_FILE_BYTES, type RepsImportKind, type RepsImportMode } from '@/lib/reps-import-fields'
import { serverError } from '../../../_lib/api-error'
import { requireRepsImportUser, runPreview } from '../../../_lib/reps-import-server'

// POST /api/hospitals/import/preview (multipart/form-data)
//   file     archivo del REPS: Excel (.xlsx/.xls), CSV/TXT (; o ,) o PDF con texto (máx. 4 MB)
//   kind     'auto' | 'servicios' | 'capacidad'   (por defecto 'auto')
//   mode     'replace' | 'merge'                   (por defecto 'replace')
//   mapping  JSON opcional { campo: índiceDeColumna | null } (mapeo manual de columnas)
// Responde la simulación (RepsPreviewResponse) y un token para /apply. No escribe en hospitals.
// Permiso: hospitals:edit y rol admin o data_manager.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const KINDS = ['auto', 'servicios', 'capacidad'] as const
const MODES = ['replace', 'merge'] as const

function fileNameOf(value: unknown): string {
  const raw = typeof value === 'string' ? value : 'archivo'
  const base = raw.split(/[\\/]/).pop() || 'archivo'
  return base.replace(/[\u0000-\u001f]/g, '').slice(0, 255) || 'archivo'
}

export async function POST(request: NextRequest) {
  const auth = await requireRepsImportUser(request)
  if (!auth.ok) return auth.response

  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > REPS_MAX_FILE_BYTES + 256 * 1024) {
    return NextResponse.json({ error: 'El archivo supera 4 MB: divide la consulta del REPS (por departamento o municipio) o expórtala a Excel' }, { status: 413 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Envía el archivo como multipart/form-data (campo "file")' }, { status: 400 })
  }

  const file = form.get('file')
  if (!file || typeof file === 'string' || typeof (file as Blob).arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Falta el archivo (campo "file")' }, { status: 400 })
  }
  const blob = file as Blob & { name?: string }
  if (blob.size === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  if (blob.size > REPS_MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera 4 MB: divide la consulta del REPS (por departamento o municipio) o expórtala a Excel' }, { status: 413 })
  }

  const kindValue = String(form.get('kind') || 'auto')
  const modeValue = String(form.get('mode') || 'replace')
  const requestedKind = ((KINDS as readonly string[]).includes(kindValue) ? kindValue : 'auto') as RepsImportKind | 'auto'
  const mode = ((MODES as readonly string[]).includes(modeValue) ? modeValue : 'replace') as RepsImportMode

  let manualMapping: unknown = null
  const mappingValue = form.get('mapping')
  if (typeof mappingValue === 'string' && mappingValue.trim() !== '') {
    try {
      manualMapping = JSON.parse(mappingValue)
    } catch {
      return NextResponse.json({ error: 'El mapeo de columnas no es JSON válido' }, { status: 400 })
    }
  }

  try {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const result = await runPreview({
      user: auth.user,
      fileName: fileNameOf(blob.name),
      bytes,
      requestedKind,
      mode,
      manualMapping,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RepsImportError) return NextResponse.json({ error: error.message }, { status: 422 })
    return serverError('hospitals/import/preview', error, 'Error al analizar el archivo')
  }
}
