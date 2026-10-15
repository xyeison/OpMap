// GET /api/me/numeros?mes=AAAA-MM (visits:report + persona de campo, F1a; sin mes: el de hoy) — "Mis números"
// de F3 (decisión 16): KPI 1 = visitas efectivas × peso (valorVisita con el conteo vigente en la fecha de cada visita)
// ÷ cuota del periodo, para médica, institucional y los subtipos con meta propia; días hábiles ya cerrados sin
// visitas; telefónicas, no efectivas y fuera de territorio. La cuota es la MISMA de GET /api/me/cuota
// (calcularCuotaDetallada de F2: un solo cálculo). La telefónica suma con su peso vigente (config_general.telefonicas)
// y una visita en una sede que data manager aún no confirma no suma hasta que la confirme (decisión 9 del dueño):
// sale en sede_por_confirmar. El resto de KPIs llega en F5.
// F4.1 (0840): bloque `agenda` del mes (decisión 8): efectivas agendadas ÷ efectivas y citas hechas ÷ citas de días ya
// pasados o de hoy (sin canceladas); 0850: sin las eliminadas y con las que no se hicieron aparte.
// 0850 (F1a): sin Ejecutivo Comercial (una líder) no hay cuota: `cuota: null` y el cumplimiento en null (las hechas y el
// bloque agenda sí). Con Ejecutivo Comercial, la cuota solo cuenta sus visitas como Ejecutivo Comercial (lo de líder de
// Paola no suma, C4); el bloque agenda es de toda su agenda.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "API" y "F4.1").
// Tiempos (spec 2026-10-15): Server-Timing (auth, cuota, sedes, total) y la línea [tiempos] sin contenido (_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { numerosQuerySchema } from '@/lib/reporte-visitas-schemas'
import { cumplimientoMes, numerosDesdeCumplimiento } from '@/lib/reporte-visitas'
import { hoyBogota, limitesMes, mesDe, sumarDias } from '@/lib/visits-rules'
import { ahora, calcularCuotaDetallada, leerGeneral, requirePersonaDeCampo } from '../../config-visitas/_lib/visitas-server'
import { confirmacionDeSedes, errorReporte, leerConteo, leerVisitas, numerosDeAgenda } from '../_lib/reporte-server'
import { medirRuta } from '../_lib/tiempos'

export const dynamic = 'force-dynamic'

/** Sin Ejecutivo Comercial: una cuota en 0 (el cumplimiento sale en null). */
const SIN_CUOTA = { medica: { cuota: 0 }, institucional: { cuota: 0 }, subtipos: [] }

export async function GET(request: NextRequest) {
  return medirRuta('GET /api/me/numeros', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'GET /api/me/numeros'))
    if (!auth.ok) return auth.response
    const { persona } = auth

    const consulta = numerosQuerySchema.safeParse({ mes: request.nextUrl.searchParams.get('mes') })
    if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)

    try {
      const hoy = hoyBogota(ahora())
      const mes = consulta.data.mes ?? mesDe(hoy)
      const { desde, hasta } = limitesMes(mes)
      const [detalle, visitas, conteoSinCuota, generalSinCuota] = await t.fase('cuota', () =>
        Promise.all([
          persona.ejecutiva ? calcularCuotaDetallada(persona.ejecutiva, mes, hoy) : Promise.resolve(null),
          leerVisitas(persona.userId, desde, hasta),
          persona.ejecutiva ? Promise.resolve(null) : leerConteo(),
          persona.ejecutiva ? Promise.resolve(null) : leerGeneral(),
        ])
      )
      const deLaCuota = persona.ejecutiva ? visitas.filter(visita => visita.executive_id === persona.executiveId) : visitas
      const [confirmadas, agenda] = await t.fase('sedes', () =>
        Promise.all([confirmacionDeSedes(deLaCuota.map(visita => visita.sede_id)), numerosDeAgenda(persona.userId, { desde, hasta }, visitas, hoy)])
      )
      const resultado = cumplimientoMes({
        visitas: deLaCuota.map(visita => ({
          fecha: visita.visit_date,
          tipo: visita.tipo,
          subtipo_id: visita.subtipo_id,
          efectiva: Boolean(visita.efectiva),
          modalidad: visita.modalidad,
          out_of_territory: Boolean(visita.out_of_territory),
          sede_confirmada: visita.sede_id ? confirmadas.get(visita.sede_id) : undefined,
        })),
        conteo: detalle ? detalle.conteo : (conteoSinCuota ?? []),
        general: detalle ? detalle.general : (generalSinCuota ?? []),
        cuota: detalle ? detalle.cuota : SIN_CUOTA,
        dias: detalle ? detalle.porDia.medica.map(dia => ({ fecha: dia.fecha, habil: dia.habil, libre: dia.libre })) : [],
        // Días hábiles YA CERRADOS sin visitas: hoy aún no termina, así que cuenta hasta ayer.
        hoy: sumarDias(hoy, -1),
      })
      return NextResponse.json(numerosDesdeCumplimiento(mes, detalle ? detalle.cuota : null, resultado, agenda), { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return errorReporte('GET /api/me/numeros', error, 'Error al calcular tus números')
    }
  })
}
