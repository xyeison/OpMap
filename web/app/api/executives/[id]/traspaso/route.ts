// POST /api/executives/[id]/traspaso (executives:transfer) — pasa en un paso lo de este Ejecutivo Comercial (quien
// entrega = [id]) a otra persona, a una persona nueva, a una vacante o, al quitar líneas a quien se queda, a nadie:
// líneas, zona (persona nueva o vacante), ajustes manuales de cobertura, nombre del territorio y médicos; y, si se
// pide, lo da de baja y desactiva su usuario. Cuerpo: traspasoSchema (lib/traspaso-schemas.ts). Pasos:
//   1. Revisa el pedido con la vista previa (planearTraspaso, sin escribir): lo que la base rechazaría se rechaza
//      antes de guardar nada (las versiones del anexo son inmutables y no se pueden deshacer). Comprueba también,
//      con una lectura, que la migración 0820 esté aplicada (si no, 503 sin guardar ninguna versión del anexo).
//   2. Si guardar_anexo_final (por defecto sí): guarda la versión final del anexo de quien entrega en cada línea
//      traspasada donde tiene territorio, con la etiqueta "Final AAAA-MM-DD (traspaso)" (createSnapshot, con la
//      cobertura de antes del traspaso). Si ya existía una versión con esa etiqueta, queda esa y se sigue
//      (ya_existia = true en anexos_finales).
//   3. Llama a ejecutivas_traspasar (migración 0820): todo o nada, en una transacción.
//   4. Recalcula la cobertura (global, sin Google Maps: solo distancias guardadas).
//   5. Persona nueva con email: la enlaza con el usuario de OpMap de ese email si existe y no está enlazado con otro
//      (igual que al crear un Ejecutivo Comercial o al contratar). Nunca desenlaza a nadie.
// 201 TraspasoResponse { resumen, anexos_finales, cobertura_recalculada, usuario_enlazado? (solo persona nueva con
// email) }. 400 datos o reglas (22023/23514), 404 no
// existe (P0002), 409 email de la persona nueva repetido (23505), 503 falta la migración 0820. Si la función falla
// después de guardar versiones del anexo, el error lo dice (esas versiones quedan guardadas). Solo con un error de la
// base que la API sabe explicar se afirma que el traspaso no se hizo; si la llamada falló de otro modo (corte de red,
// respuesta perdida), puede haberse hecho: 500 con resultado_incierto = true y se remite al historial.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE } from '@/lib/fase1-schemas'
import { createSnapshot } from '@/lib/territory'
import { traspasoSchema } from '@/lib/traspaso-schemas'
import {
  leerResumenTraspaso,
  parametroTraspaso,
  planearTraspaso,
  type AnexoFinalGuardado,
  type PlanLinea,
  type TraspasoResponse,
  type VistaPreviaTraspaso,
} from '@/lib/traspaso'
import {
  linkExecutiveToUserByEmail,
  recalcularCobertura,
  resolveUserIdByEmail,
  todayInBogota,
} from '../../_lib/executive-shared'
import {
  MENSAJE_FALTA_MIGRACION_TRASPASO,
  MENSAJE_RESULTADO_INCIERTO,
  cargarDatosTraspaso,
  estadoDeErrores,
  faltaMigracion,
  respuestaErrorTraspaso,
} from '../../_lib/traspaso-server'

type Params = { params: { id: string } }

// Versiones del anexo (una por línea), la función y el recálculo global de la cobertura en la misma petición.
export const maxDuration = 60

const CONTEXTO = 'POST /api/executives/[id]/traspaso'

/** Nota de la versión final del anexo (territory_snapshots.note, hasta 1000 caracteres). */
function notaAnexoFinal(plan: VistaPreviaTraspaso): string {
  const partes = [
    plan.destino.tipo === 'nadie'
      ? 'Versión final antes de quitarle la línea (nadie la recibe)'
      : `Versión final antes del traspaso a ${plan.destino.full_name ?? 'otra persona'}`,
  ]
  if (plan.dar_de_baja) partes.push(`baja con último día ${plan.fin_origen}`)
  if (plan.motivo) partes.push(`motivo: ${plan.motivo}`)
  return partes.join(' · ').slice(0, 1000)
}

/** "Línea A", "Línea A y Línea B", "A, B y C". */
function unirLineas(lineas: readonly string[]): string {
  if (lineas.length <= 1) return lineas[0] ?? ''
  return `${lineas.slice(0, -1).join(', ')} y ${lineas[lineas.length - 1]}`
}

/**
 * Enlaza a la persona nueva con el usuario de OpMap de su email (si existe y no está enlazado con otro Ejecutivo
 * Comercial). true si quedó enlazada. Si falla, solo se registra: el traspaso ya está hecho y el enlace se puede
 * hacer después guardando el usuario o el Ejecutivo Comercial.
 */
async function enlazarUsuarioNuevo(destinoId: string, email: string): Promise<boolean> {
  try {
    const userId = await resolveUserIdByEmail(email, destinoId)
    if (!userId) return false
    return (await linkExecutiveToUserByEmail(userId, email)) !== null
  } catch (error) {
    console.error(`${CONTEXTO}: el traspaso se hizo, pero no se pudo enlazar el usuario de la persona nueva:`, error)
    return false
  }
}

/** Termina la frase con punto si no lo trae. */
function conPunto(texto: string): string {
  const limpio = texto.trim()
  return /[.!?]$/.test(limpio) ? limpio : `${limpio}.`
}

/** Líneas donde este intento ya guardó la versión final del anexo ("Línea A y Línea B"), o null. */
function lineasConAnexoGuardado(anexos: readonly AnexoFinalGuardado[], plan: VistaPreviaTraspaso): string | null {
  const nombres = anexos
    .filter(anexo => anexo.snapshot_id)
    .map(anexo => plan.lineas.find(linea => linea.line_id === anexo.line_id)?.line_name ?? 'una línea')
  return nombres.length > 0 ? unirLineas(nombres) : null
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'executives:transfer')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de Ejecutivo Comercial no válido', 400)
  const origenId = params.id.toLowerCase()

  try {
    const parsed = traspasoSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data
    const hoy = todayInBogota()

    // 1. Revisión con la vista previa: sin escribir nada
    const plan = planearTraspaso(await cargarDatosTraspaso(origenId, input, hoy, auth.user.id))
    if (!plan.ok) {
      return jsonError(plan.errores[0]?.mensaje ?? 'El traspaso no cumple las reglas', estadoDeErrores(plan.errores), {
        errores: plan.errores,
      })
    }
    // Sin la migración 0820 no se guarda ninguna versión del anexo (son inmutables) de un traspaso que no se haría.
    // La tabla y la función nacen juntas en la 0820 (y PostgREST las ve en la misma recarga del esquema).
    const { error: errorMigracion } = await supabaseAdmin.from('ejecutivas_traspasos').select('id').limit(1)
    if (errorMigracion) {
      if (faltaMigracion(errorMigracion)) return jsonError(MENSAJE_FALTA_MIGRACION_TRASPASO, 503)
      throw errorMigracion
    }

    // 2. Versión final del anexo de quien entrega, ANTES del traspaso (con la cobertura de antes)
    const anexos: AnexoFinalGuardado[] = []
    if (input.guardar_anexo_final) {
      const nota = notaAnexoFinal(plan)
      const conTerritorio = plan.lineas.filter(
        (linea): linea is PlanLinea & { anexo_final: { etiqueta: string } } =>
          linea.anexo_final.se_guarda && Boolean(linea.anexo_final.etiqueta)
      )
      for (const linea of conTerritorio) {
        const etiqueta = linea.anexo_final.etiqueta
        let resultado: Awaited<ReturnType<typeof createSnapshot>>
        try {
          resultado = await createSnapshot({
            lineId: linea.line_id,
            executiveId: origenId,
            versionLabel: etiqueta,
            note: nota,
            userId: auth.user.id,
          })
        } catch (error) {
          console.error(`${CONTEXTO}: error guardando la versión final del anexo (${linea.line_name}):`, error)
          resultado = { ok: false, status: 500, error: 'error al guardar la versión' }
        }
        if (resultado.ok) {
          anexos.push({ line_id: linea.line_id, etiqueta, snapshot_id: resultado.value.id, error: null, ya_existia: false })
        } else if (resultado.status === 409) {
          // Ya hay una versión con esa etiqueta (p. ej. un intento anterior de hoy): queda esa y se sigue. No es un
          // error: la versión final está guardada.
          anexos.push({ line_id: linea.line_id, etiqueta, snapshot_id: null, error: null, ya_existia: true })
        } else {
          // Sin la versión final no se traspasa: después ya no se podría guardar (la cobertura cambia).
          const guardadas = lineasConAnexoGuardado(anexos, plan)
          return jsonError(
            `No se pudo guardar la versión final del anexo en ${linea.line_name} (${resultado.error}); no se hizo el traspaso.${
              guardadas ? ` Ya quedó guardada en ${guardadas}.` : ''
            }`,
            resultado.status === 503 ? 503 : 500,
            { anexos_finales: anexos }
          )
        }
      }
    }

    // 3. El traspaso, atómico
    const { data, error } = await supabaseAdmin.rpc('ejecutivas_traspasar', {
      p: parametroTraspaso(origenId, input, hoy),
      p_user: auth.user.id,
    })
    if (error) {
      const traducido = respuestaErrorTraspaso(error)
      const guardadas = lineasConAnexoGuardado(anexos, plan)
      const etiquetaGuardada = anexos.find(anexo => anexo.snapshot_id)?.etiqueta
      if (traducido) {
        // Error de la base que la API sabe explicar: la transacción se deshizo, el traspaso no se hizo.
        return jsonError(
          `${conPunto(traducido.mensaje)}${
            guardadas
              ? ` El traspaso no se hizo, pero ya quedó guardada la versión final del anexo («${etiquetaGuardada}») en ${guardadas}: las versiones no se borran y, si repites el traspaso hoy, se conserva esa.`
              : ''
          }`,
          traducido.estado,
          { anexos_finales: anexos }
        )
      }
      // Cualquier otro (corte de red, respuesta perdida, pasarela caída): pudo confirmarse igual. No se afirma nada.
      console.error(`${CONTEXTO}: error de ejecutivas_traspasar (resultado incierto):`, error)
      return jsonError(
        `${MENSAJE_RESULTADO_INCIERTO}${
          guardadas ? ` Ya quedó guardada la versión final del anexo («${etiquetaGuardada}») en ${guardadas}: las versiones no se borran.` : ''
        }`,
        500,
        { anexos_finales: anexos, resultado_incierto: true }
      )
    }

    // 4. Cobertura recalculada (global, sin Google Maps)
    const coberturaRecalculada = await recalcularCobertura(CONTEXTO)

    const resumen = leerResumenTraspaso(data)
    if (!resumen) {
      console.error(`${CONTEXTO}: ejecutivas_traspasar devolvió un resumen sin forma:`, data)
      return jsonError(
        'El traspaso se hizo, pero no se entendió el resumen que devolvió la base: revisa el historial de traspasos',
        500,
        { anexos_finales: anexos, cobertura_recalculada: coberturaRecalculada }
      )
    }

    // 5. Persona nueva con email: enlace con su usuario de OpMap
    const body: TraspasoResponse = { resumen, anexos_finales: anexos, cobertura_recalculada: coberturaRecalculada }
    if (input.destino.tipo === 'nueva' && input.destino.email && resumen.destino_id) {
      body.usuario_enlazado = await enlazarUsuarioNuevo(resumen.destino_id, input.destino.email)
    }
    return NextResponse.json(body, { status: 201 })
  } catch (error) {
    console.error(`Error en ${CONTEXTO}:`, error)
    return jsonError('Error interno del servidor', 500)
  }
}
