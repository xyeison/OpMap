/**
 * PR 7 · Reclasifica los contratos ya cargados en secop_contratos con las reglas actuales de lib/secop.ts
 * (línea, líneas, especialidad, proveedor vigilado) sin volver a descargar nada de datos.gov.co. Sirve
 * cuando cambian las reglas (CLASIFICACION_VERSION) o la lista vigilada.
 *
 * Los contratos que con las reglas nuevas quedan fuera del alcance (ni línea, ni especialidad, ni proveedor
 * vigilado) se borran: la tabla guarda solo el alcance (ver decidirAlcance). Lo que antes quedó fuera y
 * ahora entraría NO aparece hasta la próxima pasada que lo lea (o `secop-load.ts --inicial`).
 *
 * Uso (desde web/):
 *   npx tsx scripts/secop-reclasificar.ts            → solo cuenta lo que cambiaría (no escribe)
 *   npx tsx scripts/secop-reclasificar.ts --apply    → actualiza, borra lo que queda fuera y recalcula atípicos
 */
import path from 'path'
import dotenv from 'dotenv'
import { CLASIFICACION_VERSION, clasificarContrato, decidirAlcance, detectEspecialidad, type SecopLinea } from '../lib/secop'
import { cargarContextoSecop } from '../lib/secop-sync'
import { fetchAll } from '../lib/poblacion-db'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

interface Fila {
  id: string
  objeto: string | null
  descripcion: string | null
  categoria_unspsc: string | null
  nit_entidad: string
  documento_proveedor: string | null
  proveedor_vigilado_id: string | null
  linea: SecopLinea
  lineas: string[]
  especialidad_medico: string | null
  clasificacion_version: string | null
}

const fmt = (n: number) => n.toLocaleString('es-CO')

async function main() {
  const apply = process.argv.includes('--apply')
  const otros = process.argv.slice(2).filter(a => a !== '--apply')
  if (otros.length > 0) throw new Error(`Argumento desconocido: ${otros[0]}`)
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const ctx = await cargarContextoSecop(db)
  const filas = await fetchAll<Fila>((from, to) =>
    db
      .from('secop_contratos')
      .select('id, objeto, descripcion, categoria_unspsc, nit_entidad, documento_proveedor, proveedor_vigilado_id, linea, lineas, especialidad_medico, clasificacion_version')
      .order('id')
      .range(from, to)
  )
  const grupos = new Map<string, { patch: Record<string, unknown>; ids: string[] }>()
  const borrar: string[] = []
  const cambiosLinea = new Map<string, number>()
  const ejemplos = new Map<string, string[]>()
  let iguales = 0
  for (const f of filas) {
    const c = clasificarContrato(f.objeto, f.descripcion, f.categoria_unspsc)
    const especialidad = detectEspecialidad(f.objeto, f.descripcion)
    const vigilado = f.documento_proveedor && ctx.vigilados.has(f.documento_proveedor) ? f.documento_proveedor : null
    const alcance = decidirAlcance({ proveedor_vigilado_id: vigilado, nit_entidad: f.nit_entidad, linea: c.linea, especialidad_medico: especialidad }, ctx.entidades)
    if (!alcance) {
      borrar.push(f.id)
      continue
    }
    const igual =
      c.linea === f.linea &&
      JSON.stringify(c.lineas) === JSON.stringify(f.lineas ?? []) &&
      especialidad === f.especialidad_medico &&
      vigilado === f.proveedor_vigilado_id &&
      f.clasificacion_version === CLASIFICACION_VERSION
    if (igual) {
      iguales++
      continue
    }
    if (c.linea !== f.linea) {
      const k = `${f.linea} → ${c.linea}`
      cambiosLinea.set(k, (cambiosLinea.get(k) ?? 0) + 1)
      const lista = ejemplos.get(k) ?? []
      if (lista.length < 3) lista.push((f.objeto ?? '').slice(0, 110))
      ejemplos.set(k, lista)
    }
    const patch = { linea: c.linea, lineas: c.lineas, especialidad_medico: especialidad, proveedor_vigilado_id: vigilado, clasificacion_version: CLASIFICACION_VERSION }
    const key = JSON.stringify(patch)
    const grupo = grupos.get(key) ?? { patch, ids: [] as string[] }
    grupo.ids.push(f.id)
    grupos.set(key, grupo)
  }
  const actualizar = Array.from(grupos.values()).reduce((a, g) => a + g.ids.length, 0)
  console.log(`secop_contratos: ${fmt(filas.length)} filas · sin cambios ${fmt(iguales)} · a actualizar ${fmt(actualizar)} · fuera de alcance (se borran) ${fmt(borrar.length)}`)
  Array.from(cambiosLinea.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => {
      console.log(`  ${k}: ${fmt(v)}`)
      for (const e of ejemplos.get(k) ?? []) console.log(`      · ${e}`)
    })
  if (!apply) {
    console.log('Sin --apply: no se escribió nada.')
    return
  }
  for (const grupo of Array.from(grupos.values())) {
    for (let i = 0; i < grupo.ids.length; i += 200) {
      const { error } = await db.from('secop_contratos').update(grupo.patch).in('id', grupo.ids.slice(i, i + 200))
      if (error) throw new Error(`secop_contratos (update): ${error.message}`)
    }
  }
  for (let i = 0; i < borrar.length; i += 200) {
    const { error } = await db.from('secop_contratos').delete().in('id', borrar.slice(i, i + 200))
    if (error) throw new Error(`secop_contratos (delete): ${error.message}`)
  }
  const { data, error } = await db.rpc('secop_marcar_atipicos')
  if (error) throw new Error(`secop_marcar_atipicos: ${error.message}`)
  console.log(`Aplicado: ${fmt(actualizar)} actualizadas, ${fmt(borrar.length)} borradas, atípicos recalculados (${data ?? 0} cambios).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
