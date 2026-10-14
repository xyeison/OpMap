// /api/me/contexto (visits:report + Ejecutivo Comercial enlazado) — todo lo que la app necesita para reportar: la
// ejecutiva y sus líneas, la meta del día frente a lo hecho, la configuración vigente (radio, telefónica, tope por
// médico, perfil), las sedes a menos de 1 km con su cuenta, los médicos que ella visita con sus sedes (y la
// distancia), los contactos de esas cuentas, los subtipos vigentes, los compromisos vencidos y si la voz está
// configurada. Nunca documentos ni teléfonos. Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md
// (sección "API").
//   POST { lat, lng, precision } — CON el punto del teléfono. La app usa esta: la ubicación va en el cuerpo y no en la
//        URL, que queda en los logs de peticiones del proveedor (Vercel) con la hora y la persona.
//   GET  — SIN punto (sedes_cerca y contactos vacíos, mis_medicos sin distancias). Por compatibilidad acepta todavía
//        ?lat=&lng=&precision=, pero la app ya no manda la ubicación por la URL.
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { contextoQuerySchema } from '@/lib/reporte-visitas-schemas'
import { hoyActual, requireEjecutiva, type PersonaVisitas } from '../../config-visitas/_lib/visitas-server'
import { cargarContexto, errorReporte, puntoDe } from '../_lib/reporte-server'

export const dynamic = 'force-dynamic'

async function responder(persona: PersonaVisitas, datos: unknown, ruta: string): Promise<NextResponse> {
  const consulta = contextoQuerySchema.safeParse(datos)
  if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)
  try {
    const contexto = await cargarContexto(persona, puntoDe(consulta.data), hoyActual())
    return NextResponse.json(contexto, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorReporte(ruta, error, 'Error al cargar el contexto del reporte')
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireEjecutiva(request, 'GET /api/me/contexto')
  if (!auth.ok) return auth.response
  const params = request.nextUrl.searchParams
  return responder(auth.persona, { lat: params.get('lat'), lng: params.get('lng'), precision: params.get('precision') }, 'GET /api/me/contexto')
}

export async function POST(request: NextRequest) {
  const auth = await requireEjecutiva(request, 'POST /api/me/contexto')
  if (!auth.ok) return auth.response
  const cuerpo = await readJson(request)
  // Cuerpo vacío o sin punto = contexto sin punto (como el GET).
  return responder(auth.persona, cuerpo ?? {}, 'POST /api/me/contexto')
}
