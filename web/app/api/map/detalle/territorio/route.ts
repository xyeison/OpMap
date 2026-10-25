// GET /api/map/detalle/territorio?tipo=municipio|localidad&code=<DANE de 5 dígitos | localidad de Bogotá de 7>
// Tarjeta de municipio o localidad del mapa: giros ADRES y compras públicas SECOP de los últimos 12 meses y procesos
// de SECOP II publicados sin contrato (TerritorioDetalle, lib/types/mapa-detalle.ts). Se pide al abrir la tarjeta, no
// viaja en /api/map/data. Permiso intelligence:view (todo: alcance 'completo') o secop:procesos (solo los procesos:
// alcance 'procesos', p. ej. un Ejecutivo Comercial); sin ninguno 403 sin leer tablas. 400 si tipo o code no valen;
// 200 con ips.total = 0 y una nota si el territorio no tiene IPS en OpMap. Specs:
// docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md y docs/specs/2026-10-25-secop-procesos-radar.md.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { serverError, validationError } from '@/app/api/_lib/api-error'
import { isMissingRelationError } from '@/app/api/intelligence/_lib/giros-server'
import { PERMISOS_DETALLE, alcanceDelRol, cargarDetalleTerritorio } from '@/app/api/map/_lib/detalle-server'
import { requireAnyPermission } from '@/lib/require-role'
import type { TerritorioDetalle } from '@/lib/types/mapa-detalle'

// Nunca el Data Cache de Next (CLAUDE.md): los datos cambian a diario y la respuesta depende del usuario.
export const dynamic = 'force-dynamic'

const querySchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('municipio'), code: z.string().regex(/^\d{5}$/, 'code debe ser un código DANE de 5 dígitos') }),
  z.object({ tipo: z.literal('localidad'), code: z.string().regex(/^11001\d{2}$/, 'code debe ser una localidad de Bogotá (7 dígitos)') }),
])

export async function GET(request: NextRequest) {
  const auth = await requireAnyPermission(request, PERMISOS_DETALLE)
  if (!auth.ok) return auth.response
  const alcance = alcanceDelRol(auth.user.role) ?? 'procesos'

  const parsed = querySchema.safeParse({
    tipo: request.nextUrl.searchParams.get('tipo') ?? '',
    code: (request.nextUrl.searchParams.get('code') ?? '').trim(),
  })
  if (!parsed.success) return validationError(parsed.error, 'tipo o code no válidos')

  try {
    const body: TerritorioDetalle = await cargarDetalleTerritorio(parsed.data.tipo, parsed.data.code, alcance)
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) {
      return serverError('map/detalle/territorio GET', error, 'Faltan tablas de giros ADRES o SECOP: aplicar las migraciones de las fases 3 y 5', 503)
    }
    const que = alcance === 'procesos' ? 'los procesos de SECOP' : 'los giros y compras'
    return serverError('map/detalle/territorio GET', error, `No se pudieron cargar ${que} del territorio`)
  }
}
