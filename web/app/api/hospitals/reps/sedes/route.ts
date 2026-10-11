import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { nameSimilarity, normalizeName } from '@/lib/reps-match'
import { serverError } from '../../../_lib/api-error'
import { isPrincipalSede, loadLinkedHospitals, type RepsSedePublic } from '../../../_lib/reps'

// Fase 3 · GET /api/hospitals/reps/sedes?q=<texto>&municipio=<DANE 5>&limit=<n> (hospitals:view)
// Buscador de sedes del REPS para vincular a mano una IPS "sin cruce" o ambigua.
//   q de 12 dígitos → código de habilitación; 10 dígitos → código de prestador; 9 dígitos → NIT;
//   texto (palabras de 3+ letras) → todas deben estar en el nombre de la sede o del prestador
//   (reps_sedes.nombre_busqueda, sin tildes), ordenado por parecido con el nombre de la sede.
//   municipio (opcional) limita a las sedes de ese municipio.

const SELECT =
  'codigo_habilitacion, codigo_prestador, nombre_prestador, nombre_sede, nit, naturaleza, ese, ' +
  'municipio_sede, municipio_sede_nombre, departamento_sede, direccion_sede, clase_prestador, fecha_corte'
const MAX_DB_ROWS = 300

// Depende de la sesión (cookie): siempre dinámica, sin intento de render estático en el build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'hospitals:view')
  if (!auth.ok) return auth.response

  try {
    const params = request.nextUrl.searchParams
    const q = (params.get('q') ?? '').trim()
    const municipio = (params.get('municipio') ?? '').trim()
    const limit = Math.min(Math.max(Number(params.get('limit')) || 25, 1), 50)
    if (municipio && !/^\d{5}$/.test(municipio)) {
      return NextResponse.json({ error: 'municipio debe ser un código DANE de 5 dígitos' }, { status: 400 })
    }

    const digits = q.replace(/[\s.-]/g, '')
    let query = supabaseAdmin.from('reps_sedes').select(SELECT)
    let byText = false
    if (/^\d{12}$/.test(digits)) query = query.eq('codigo_habilitacion', digits)
    else if (/^\d{10}$/.test(digits)) query = query.or(`codigo_prestador.eq.${digits},nit.eq.${digits}`)
    else if (/^\d{5,9}$/.test(digits)) query = query.eq('nit', digits)
    else {
      const words = normalizeName(q)
        .split(' ')
        .filter(word => word.length >= 3)
        .slice(0, 5)
      if (words.length === 0) {
        return NextResponse.json({ error: 'Escribe al menos 3 letras, un NIT o un código de habilitación' }, { status: 400 })
      }
      // Cada palabra debe aparecer en nombre_busqueda (sede + prestador, normalizado sin tildes por el
      // script de carga). normalizeName deja solo A-Z, 0-9 y espacios: no hay comodines del usuario.
      for (const word of words) query = query.like('nombre_busqueda', `%${word}%`)
      byText = true
    }
    if (municipio) query = query.eq('municipio_sede', municipio)

    const { data, error } = await query.order('codigo_habilitacion').limit(MAX_DB_ROWS)
    if (error) return serverError('hospitals/reps/sedes GET', error)
    let rows = (data ?? []) as unknown as RepsSedePublic[]

    if (byText) {
      const target = normalizeName(q)
      rows = rows
        .map(row => ({ row, score: nameSimilarity(target, row.nombre_sede) }))
        .sort((a, b) => b.score - a.score || a.row.codigo_habilitacion.localeCompare(b.row.codigo_habilitacion))
        .map(entry => entry.row)
    }
    rows = rows.slice(0, limit)

    const linked = await loadLinkedHospitals(rows.map(row => row.codigo_habilitacion))
    return NextResponse.json({
      sedes: rows.map(row => ({
        ...row,
        principal: isPrincipalSede(row),
        linked_hospital: linked.get(row.codigo_habilitacion) ?? null,
      })),
      truncated: (data ?? []).length >= MAX_DB_ROWS,
    })
  } catch (error) {
    return serverError('hospitals/reps/sedes GET', error)
  }
}
