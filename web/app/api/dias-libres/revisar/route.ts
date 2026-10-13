// POST /api/dias-libres/revisar (daysoff:approve y rol en aprobacion_dias_libres.aprueban, o admin) — revisión EN
// BLOQUE: { ids (1 a 200), accion: 'aprobar' | 'rechazar' | 'anular', motivo? (obligatorio para rechazar y anular) }.
// Aprobar y rechazar solo desde 'por_aprobar'; anular desde registrado, por aprobar o aprobado (revisarDiaLibre,
// lógica pura). Lo que no se puede cambiar no frena al resto: sale en `omitidos` con su razón. Los días de la
// ejecutiva enlazada con quien revisa también salen en `omitidos` (nadie aprueba, rechaza ni anula lo suyo por aquí;
// decisión 13 del contrato). 200 { actualizados, omitidos: [{ id, razon }] }.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { revisarDiasLibresSchema } from '@/lib/visits-config-schemas'
import {
  RAZON_DIA_PROPIO,
  puedeAprobarseASiMismo,
  revisarDiaLibre,
  type EstadoDiaLibre,
  type RevisarDiasLibresResponse,
} from '@/lib/visits-rules'
import { leerPorIds } from '@/app/api/terceros/_lib/terceros-server'
import {
  MENSAJE_ROL_NO_APRUEBA,
  ahora,
  ejecutivasDelUsuario,
  errorVisitas,
  hoyActual,
  leerGeneral,
  puedeAprobarHoy,
  respuestaErrorBase,
  trozosDeIds,
} from '../../config-visitas/_lib/visitas-server'

const CAMBIO_MIENTRAS_TANTO = 'Cambió mientras tanto: vuelve a cargar la lista'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'daysoff:approve')
  if (!auth.ok) return auth.response

  try {
    const general = await leerGeneral()
    if (!puedeAprobarHoy(auth.user, general, hoyActual())) return jsonError(MENSAJE_ROL_NO_APRUEBA, 403)

    const parsed = revisarDiasLibresSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const { ids, accion, motivo } = parsed.data

    const [filas, propias] = await Promise.all([
      leerPorIds<{ id: string; estado: EstadoDiaLibre; executive_id: string }>(ids, (trozo, from, to) =>
        supabaseAdmin.from('dias_libres').select('id, estado, executive_id').in('id', trozo).order('id').range(from, to)
      ),
      ejecutivasDelUsuario(auth.user.id),
    ])
    const porId = new Map(filas.map(fila => [fila.id, fila]))

    const omitidos: RevisarDiasLibresResponse['omitidos'] = []
    // Los que sí cambian, agrupados por su estado actual (la escritura exige que siga igual: nada pisa a otro).
    const porEstado = new Map<EstadoDiaLibre, { nuevo: EstadoDiaLibre; ids: string[] }>()
    for (const id of ids) {
      const fila = porId.get(id)
      if (!fila) {
        omitidos.push({ id, razon: 'No existe ese día libre' })
        continue
      }
      // Sus propios días los revisa otra persona que apruebe, salvo el administrador (decisión del dueño 2026-10-13).
      if (propias.has(fila.executive_id) && !puedeAprobarseASiMismo(auth.user.role)) {
        omitidos.push({ id, razon: RAZON_DIA_PROPIO })
        continue
      }
      const transicion = revisarDiaLibre(fila.estado, accion)
      if (!transicion.ok) {
        omitidos.push({ id, razon: transicion.razon })
        continue
      }
      const grupo = porEstado.get(fila.estado) ?? { nuevo: transicion.estado, ids: [] }
      grupo.ids.push(id)
      porEstado.set(fila.estado, grupo)
    }

    const momento = ahora().toISOString()
    let actualizados = 0
    for (const [estadoActual, grupo] of Array.from(porEstado.entries())) {
      for (const trozo of trozosDeIds(grupo.ids)) {
        const { data, error } = await supabaseAdmin
          .from('dias_libres')
          .update({ estado: grupo.nuevo, revisado_por: auth.user.id, revisado_at: momento, motivo_revision: motivo })
          .in('id', trozo)
          .eq('estado', estadoActual)
          .select('id')
        if (error) {
          const traducido = respuestaErrorBase(error, 'No se pudieron revisar los días libres')
          if (traducido) return traducido
          throw error
        }
        const hechos = new Set(((data || []) as { id: string }[]).map(fila => fila.id))
        actualizados += hechos.size
        for (const id of trozo) if (!hechos.has(id)) omitidos.push({ id, razon: CAMBIO_MIENTRAS_TANTO })
      }
    }

    const respuesta: RevisarDiasLibresResponse = { actualizados, omitidos }
    return NextResponse.json(respuesta)
  } catch (error) {
    return errorVisitas('POST /api/dias-libres/revisar', error, 'Error al revisar los días libres')
  }
}
