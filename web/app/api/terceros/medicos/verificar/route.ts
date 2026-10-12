// POST /api/terceros/medicos/verificar (terceros:create) — antes de crear un médico: ¿ya existe ese documento?
// y ¿hay médicos con un nombre parecido? Respuesta: { existente: { id, nombre } | null, parecidos: [{ id, nombre,
// ciudad }] }. Nunca devuelve documentos. Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows, jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { medicoVerificarSchema } from '@/lib/terceros-schemas'
import { nombresParecidos, palabrasNombre, type MedicoVerificarRespuesta } from '@/lib/terceros'
import { errorInterno, medicoPorDocumento, nombresMunicipios, patronPalabra } from '../../_lib/terceros-server'

/** Cuántos parecidos se devuelven (los de su mismo municipio primero). */
const MAX_PARECIDOS = 10

type Candidato = { id: string; nombre: string; municipality_id: string }

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:create')
  if (!auth.ok) return auth.response

  try {
    const parsed = medicoVerificarSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const existente = await medicoPorDocumento(input.tipo_documento, input.numero_documento)

    // Parecidos: se buscan candidatos por las palabras más largas del nombre (sin importar tildes) y se
    // comparan con nombresParecidos (todas las palabras del nombre más corto, tolerando una letra). Se leen TODOS
    // los candidatos de cada palabra, en páginas de 1.000 (límite de PostgREST): un tope cortaría en silencio,
    // por id y no por cercanía, justo al parecido de verdad cuando la palabra es común (una palabra corta como
    // "ana" deja pasar casi todos los nombres, y a veces es la única que se escribe igual).
    const candidatos = new Map<string, Candidato>()
    const palabras = input.nombre
      ? palabrasNombre(input.nombre)
          .filter(palabra => palabra.length >= 3)
          .sort((a, b) => b.length - a.length)
          .slice(0, 3)
      : []
    for (const palabra of palabras) {
      const patron = patronPalabra(palabra)
      if (!patron) continue
      const filas = await fetchAllRows<Candidato>((from, to) =>
        supabaseAdmin.from('medicos').select('id, nombre, municipality_id').ilike('nombre', patron).order('id').range(from, to)
      )
      for (const fila of filas) candidatos.set(fila.id, fila)
    }

    const parecidos = Array.from(candidatos.values())
      .filter(candidato => candidato.id !== existente?.id && nombresParecidos(input.nombre, candidato.nombre))
      .sort(
        (a, b) =>
          Number(b.municipality_id === input.municipality_id) - Number(a.municipality_id === input.municipality_id) ||
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      )
      .slice(0, MAX_PARECIDOS)
    const ciudades = await nombresMunicipios(parecidos.map(parecido => parecido.municipality_id))

    const body: MedicoVerificarRespuesta = {
      existente: existente ? { id: existente.id, nombre: existente.nombre } : null,
      parecidos: parecidos.map(parecido => ({
        id: parecido.id,
        nombre: parecido.nombre,
        ciudad: ciudades.get(parecido.municipality_id) ?? null,
      })),
    }
    return NextResponse.json(body)
  } catch (error) {
    return errorInterno('POST /api/terceros/medicos/verificar', error, 'Error al verificar el médico')
  }
}
