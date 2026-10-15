// GET /api/me/numeros?mes=AAAA-MM (visits:report + Ejecutivo Comercial enlazado; sin mes: el de hoy) — "Mis números"
// de F3 (decisión 16): KPI 1 = visitas efectivas × peso (valorVisita con el conteo vigente en la fecha de cada visita)
// ÷ cuota del periodo, para médica, institucional y los subtipos con meta propia; días hábiles ya cerrados sin
// visitas; telefónicas, no efectivas y fuera de territorio. La cuota es la MISMA de GET /api/me/cuota
// (calcularCuotaDetallada de F2: un solo cálculo). La telefónica suma con su peso vigente (config_general.telefonicas)
// y una visita en una sede que data manager aún no confirma no suma hasta que la confirme (decisión 9 del dueño):
// sale en sede_por_confirmar. El resto de KPIs llega en F5.
// F4.1 (0840): bloque `agenda` del mes (decisión 8): efectivas agendadas ÷ efectivas y citas hechas ÷ citas de días ya
// pasados o de hoy (sin canceladas); null si la 0840 aún no está aplicada (el resto responde igual).
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "API" y "F4.1").
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { numerosQuerySchema } from '@/lib/reporte-visitas-schemas'
import { cumplimientoMes, numerosDesdeCumplimiento } from '@/lib/reporte-visitas'
import { hoyBogota, limitesMes, mesDe, sumarDias } from '@/lib/visits-rules'
import { ahora, calcularCuotaDetallada, requireEjecutiva } from '../../config-visitas/_lib/visitas-server'
import { confirmacionDeSedes, errorReporte, leerVisitas, numerosDeAgenda } from '../_lib/reporte-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEjecutiva(request, 'GET /api/me/numeros')
  if (!auth.ok) return auth.response

  const consulta = numerosQuerySchema.safeParse({ mes: request.nextUrl.searchParams.get('mes') })
  if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)

  try {
    const hoy = hoyBogota(ahora())
    const mes = consulta.data.mes ?? mesDe(hoy)
    const { desde, hasta } = limitesMes(mes)
    const [detalle, visitas] = await Promise.all([calcularCuotaDetallada(auth.persona, mes, hoy), leerVisitas(auth.persona.id, desde, hasta)])
    const [confirmadas, agenda] = await Promise.all([
      confirmacionDeSedes(visitas.map(visita => visita.sede_id)),
      numerosDeAgenda(auth.persona.id, { desde, hasta }, visitas, hoy),
    ])
    const resultado = cumplimientoMes({
      visitas: visitas.map(visita => ({
        fecha: visita.visit_date,
        tipo: visita.tipo,
        subtipo_id: visita.subtipo_id,
        efectiva: Boolean(visita.efectiva),
        modalidad: visita.modalidad,
        out_of_territory: Boolean(visita.out_of_territory),
        sede_confirmada: visita.sede_id ? confirmadas.get(visita.sede_id) : undefined,
      })),
      conteo: detalle.conteo,
      general: detalle.general,
      cuota: detalle.cuota,
      dias: detalle.porDia.medica.map(dia => ({ fecha: dia.fecha, habil: dia.habil, libre: dia.libre })),
      // Días hábiles YA CERRADOS sin visitas: hoy aún no termina, así que cuenta hasta ayer.
      hoy: sumarDias(hoy, -1),
    })
    return NextResponse.json(numerosDesdeCumplimiento(mes, detalle.cuota, resultado, agenda), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorReporte('GET /api/me/numeros', error, 'Error al calcular tus números')
  }
}
