// Importación de visitas de VMO (POST /api/visits/import): puente temporal para el mapa de calor (dueño, 2026-10-29,
// docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md). Llega lo mínimo que arma la página /visits con
// lib/vmo-visitas.ts (visitas efectivas con coordenadas, por Ejecutivo Comercial). Cada Ejecutivo Comercial de VMO se
// busca en executives por su llave (vmo_nombre) o por su nombre y, si no existe, se crea (activo si visitó en los
// últimos 60 días). Las visitas se guardan por su ID de VMO (visits.vmo_id, único): importar dos veces el mismo período
// no duplica, actualiza. Las visitas de la app (source = 'app') no se tocan. Pruebas: scripts/vmo-visitas-check.ts.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { claveComercial, emparejarComercial, estadoComercialNuevo, validarLoteVmo, type PersonaVmo } from '@/lib/vmo-visitas'
import { serverError } from '../../_lib/api-error'

type Persona = PersonaVmo & { base_kam_id: string | null }

const COLUMNAS_PERSONA = 'id, full_name, status, base_kam_id, vmo_nombre'
const FILAS_POR_UPSERT = 500

export interface ResultadoImportacionVmo {
  visitas: number
  /** Ejecutivos Comerciales de VMO que se reconocieron por su nombre en OpMap (desde ahora, por su llave). */
  enlazados: { vmo: string; opmap: string }[]
  /** Ejecutivos Comerciales que OpMap no tenía y se crearon. */
  creados: { nombre: string; estado: 'active' | 'inactive' }[]
}

/** Importa un lote de visitas de VMO a nombre de `userId`. `hoy` (AAAA-MM-DD, Bogotá) decide si una persona nueva queda activa. */
export async function importarVisitasVmo(body: unknown, userId: string, hoy: string): Promise<NextResponse> {
  const lote = validarLoteVmo(body)
  if (!lote.ok) return NextResponse.json({ error: lote.error }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('executives').select(COLUMNAS_PERSONA)
  if (error) return serverError('visits/import (personas)', error, 'No se pudieron leer los Ejecutivos Comerciales')
  const personas = (data ?? []) as Persona[]

  const resultado: ResultadoImportacionVmo = { visitas: 0, enlazados: [], creados: [] }
  const porClave = new Map<string, Persona>()
  for (const comercial of lote.comerciales) {
    const clave = claveComercial(comercial.nombre)
    const par = emparejarComercial(clave, personas)
    if (par) {
      const persona = personas.find(p => p.id === par.id)!
      if (par.como !== 'llave') {
        const { error: errorLlave } = await supabaseAdmin.from('executives').update({ vmo_nombre: clave }).eq('id', persona.id)
        if (errorLlave) return serverError('visits/import (llave)', errorLlave, `No se pudo enlazar a ${comercial.nombre} con OpMap`)
        persona.vmo_nombre = clave
        resultado.enlazados.push({ vmo: comercial.nombre, opmap: persona.full_name })
      }
      porClave.set(clave, persona)
      continue
    }
    const estado = estadoComercialNuevo(comercial.ultima, hoy)
    const { data: nueva, error: errorNueva } = await supabaseAdmin
      .from('executives')
      .insert({ full_name: comercial.nombre, status: estado, vmo_nombre: clave, notes: `Creada al importar visitas de VMO el ${hoy}.` })
      .select(COLUMNAS_PERSONA)
      .single()
    if (errorNueva || !nueva) return serverError('visits/import (persona nueva)', errorNueva, `No se pudo crear a ${comercial.nombre}`)
    personas.push(nueva as Persona)
    porClave.set(clave, nueva as Persona)
    resultado.creados.push({ nombre: comercial.nombre, estado })
  }

  const ahora = new Date().toISOString()
  const filas = lote.visitas.map(visita => {
    const persona = porClave.get(claveComercial(visita.comercial))!
    return {
      vmo_id: visita.vmo_id,
      source: 'vmo_import',
      executive_id: persona.id,
      kam_id: persona.base_kam_id,
      kam_name: persona.full_name,
      visit_type: 'Visita efectiva',
      contact_type: visita.presencial ? 'Visita presencial' : 'Visita virtual',
      efectiva: true,
      lat: visita.lat,
      lng: visita.lng,
      visit_date: visita.fecha,
      imported_by: userId,
      imported_at: ahora,
    }
  })
  for (let i = 0; i < filas.length; i += FILAS_POR_UPSERT) {
    const { error: errorVisitas } = await supabaseAdmin.from('visits').upsert(filas.slice(i, i + FILAS_POR_UPSERT), { onConflict: 'vmo_id' })
    if (errorVisitas) return serverError('visits/import (visitas)', errorVisitas, 'No se pudieron guardar las visitas')
    resultado.visitas += Math.min(FILAS_POR_UPSERT, filas.length - i)
  }

  console.info('visits/import VMO', { visitas: resultado.visitas, enlazados: resultado.enlazados.length, creados: resultado.creados.length, usuario: userId })
  return NextResponse.json(resultado)
}
