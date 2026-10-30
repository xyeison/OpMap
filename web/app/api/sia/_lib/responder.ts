// SIA Observa · respuesta HTTP común de las rutas /api/sia/* (sin caché: son datos que cambian con cada carga).
import { NextResponse } from 'next/server'
import { serverError } from '@/app/api/_lib/api-error'
import { conMigracion, type Respuesta } from './sia-server'

export async function responder(contexto: string, fn: () => Promise<Respuesta>) {
  try {
    const r = await conMigracion(fn)
    return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return serverError(`sia/${contexto}`, error, 'Error al leer SIA Observa')
  }
}
