import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { serverError } from '@/app/api/_lib/api-error'
import { esFuenteAutomatica } from '@/lib/fuentes-estado'
import { PRESUPUESTO_CRON_MS, continuarPendientes, ejecutarFuente } from '@/lib/fuentes-runner'

// GET /api/cron/<fuente> — cargas automáticas de datos públicos (PR 7). La llama Vercel Cron según
// web/vercel.json (secop_ii diario, secop_integrado los lunes, secop_i los martes, reps_sedes / bdua /
// minsalud_cifras una vez al mes, y "continuar" a diario para seguir las pasadas que no cupieron en una
// invocación).
//
// Seguridad: el middleware deja pasar /api/cron/* sin sesión; ESTA ruta exige la cabecera
// "Authorization: Bearer <CRON_SECRET>" (Vercel la envía sola si la variable CRON_SECRET existe en el
// proyecto). Sin CRON_SECRET configurado responde 503 y no hace nada.
//
// Cada invocación trabaja como máximo PRESUPUESTO_CRON_MS (50 s) y deja el avance en fuentes_estado.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorizado(request: NextRequest, secret: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  const esperado = Buffer.from(`Bearer ${secret}`)
  const recibido = Buffer.from(header)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}

export async function GET(request: NextRequest, { params }: { params: { fuente: string } }) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET no está configurado en Vercel: las cargas automáticas están apagadas (ver docs/fases/fase5-fuentes-automaticas.md)' },
      { status: 503 }
    )
  }
  if (!autorizado(request, secret)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const fuente = String(params?.fuente ?? '')
  try {
    if (fuente === 'continuar') {
      const resultados = await continuarPendientes({ presupuestoMs: PRESUPUESTO_CRON_MS })
      return NextResponse.json({ fuente, resultados }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!esFuenteAutomatica(fuente)) return NextResponse.json({ error: 'Fuente desconocida' }, { status: 404 })
    const resultado = await ejecutarFuente(fuente, { presupuestoMs: PRESUPUESTO_CRON_MS, origen: 'cron' })
    // 200 aunque la carga falle: el error queda en fuentes_estado (panel "Fuentes de datos") y Vercel no reintenta
    return NextResponse.json(resultado, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return serverError(`cron/${fuente}`, error, 'Error en la carga automática')
  }
}
