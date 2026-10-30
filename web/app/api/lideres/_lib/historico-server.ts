// Histórico del Excel "Tracker Líderes" en el servidor (decisión 2026-10-29-historico-tracker-lideres): reconoce a
// cada líder (su usuario) y cada ciudad (código DANE), da la vista previa y, al confirmar, reemplaza el histórico con
// lideres_historico_reemplazar (0920). El navegador ya mandó solo los campos de FilaTracker: aquí no llega ningún
// nombre de médico ni observación (validarCarga rechaza campos de más). Pruebas: scripts/lideres-historico-check.ts.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '../../_lib/api-error'
import {
  crearResolutorCiudades,
  ESTADOS_HISTORICO,
  reconocerLider,
  validarCarga,
  type EstadoHistorico,
  type MunicipioRef,
  type TipoHistorico,
  type UsuarioRef,
} from '@/lib/lideres-historico'

export interface VistaPreviaTracker {
  filas: number
  /** Cada líder del Excel con su usuario de OpMap (null: no se reconoce y no se puede guardar). */
  lideres: Array<{ lider_texto: string; filas: number; user_id: string | null; nombre: string | null }>
  /** Ciudades sin código DANE (se guardan con su texto). */
  ciudadesSinCodigo: Array<{ ciudad_texto: string; filas: number }>
  /** Cada ciudad escrita que sí se reconoce, con su código y su nombre del DANE (la vista previa la muestra así). */
  ciudades: Array<{ ciudad_texto: string; municipio_id: string; nombre: string }>
  porEstado: Record<EstadoHistorico, number>
  fechasIlegibles: number
}

/** Una fila del histórico guardado, con los nombres de OpMap. */
export interface FilaHistorico {
  fila: number
  fecha: string | null
  fecha_texto: string | null
  user_id: string
  lider: string
  lider_texto: string
  municipio_id: string | null
  ciudad: string
  ciudad_texto: string
  tipo: TipoHistorico
  tipo_texto: string | null
  estado: EstadoHistorico
  contactos: number
  con_observacion: boolean
}

export interface HistoricoRespuesta {
  /** false: la migración 0920 aún no está aplicada (la vista previa sí funciona). */
  disponible: boolean
  carga: { archivo: string; corte: string; filas: number; importado_at: string; importado_por: string | null } | null
  filas: FilaHistorico[]
}

const esTablaInexistente = (error: unknown) => {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }
  return code === '42P01' || code === 'PGRST202' || code === 'PGRST205' || /does not exist|could not find the (table|function)/i.test(message ?? '')
}

async function leerUsuarios(): Promise<UsuarioRef[]> {
  const { data, error } = await fetchAllRows<UsuarioRef>((from, to) =>
    supabaseAdmin.from('users').select('id, full_name, role, active').order('id').range(from, to)
  )
  if (error) throw error
  return data.map(usuario => ({ ...usuario, active: usuario.active !== false }))
}

async function leerMunicipios(): Promise<MunicipioRef[]> {
  const { data, error } = await fetchAllRows<MunicipioRef>((from, to) => supabaseAdmin.from('municipalities').select('code, name').order('code').range(from, to))
  if (error) throw error
  return data
}

/** POST /api/lideres/historico: vista previa (confirmar = false) o reemplazo del histórico (confirmar = true). */
export async function procesarCargaTracker(cuerpo: unknown, userId: string): Promise<Response> {
  const validada = validarCarga(cuerpo)
  if (!validada.ok) return NextResponse.json({ error: validada.error }, { status: 400 })
  const { carga } = validada

  const [usuarios, municipios] = await Promise.all([leerUsuarios(), leerMunicipios()])
  const nombres = new Map(usuarios.map(usuario => [usuario.id, usuario.full_name]))
  const nombreMunicipio = new Map(municipios.map(municipio => [municipio.code, municipio.name]))
  const resolverCiudad = crearResolutorCiudades(municipios)
  const reconocidas = new Map<string, string>()

  const lideres = new Map<string, { filas: number; user_id: string | null }>()
  const ciudades = new Map<string, number>()
  const porEstado = Object.fromEntries(ESTADOS_HISTORICO.map(estado => [estado, 0])) as Record<EstadoHistorico, number>
  let fechasIlegibles = 0
  for (const fila of carga.filas) {
    const lider = lideres.get(fila.lider_texto) ?? { filas: 0, user_id: reconocerLider(fila.lider_texto, usuarios) }
    lider.filas++
    lideres.set(fila.lider_texto, lider)
    const codigo = resolverCiudad(fila.ciudad_texto)
    if (codigo) reconocidas.set(fila.ciudad_texto, codigo)
    else ciudades.set(fila.ciudad_texto, (ciudades.get(fila.ciudad_texto) ?? 0) + 1)
    porEstado[fila.estado]++
    if (!fila.fecha) fechasIlegibles++
  }
  const vistaPrevia: VistaPreviaTracker = {
    filas: carga.filas.length,
    lideres: Array.from(lideres, ([lider_texto, dato]) => ({
      lider_texto,
      filas: dato.filas,
      user_id: dato.user_id,
      nombre: dato.user_id ? nombres.get(dato.user_id) ?? null : null,
    })).sort((a, b) => b.filas - a.filas || a.lider_texto.localeCompare(b.lider_texto, 'es')),
    ciudadesSinCodigo: Array.from(ciudades, ([ciudad_texto, filas]) => ({ ciudad_texto, filas })).sort((a, b) => b.filas - a.filas),
    ciudades: Array.from(reconocidas, ([ciudad_texto, municipio_id]) => ({ ciudad_texto, municipio_id, nombre: nombreMunicipio.get(municipio_id) ?? ciudad_texto })),
    porEstado,
    fechasIlegibles,
  }
  if (!carga.confirmar) return NextResponse.json({ vistaPrevia })

  const sinUsuario = vistaPrevia.lideres.filter(lider => !lider.user_id)
  if (sinUsuario.length) {
    return NextResponse.json(
      {
        error: `No se reconoce en OpMap a: ${sinUsuario.map(lider => `"${lider.lider_texto}"`).join(', ')}. Revisa que su nombre en el Excel sea el de su usuario.`,
        vistaPrevia,
      },
      { status: 400 }
    )
  }
  const filas = carga.filas.map(fila => ({ ...fila, user_id: lideres.get(fila.lider_texto)!.user_id, municipio_id: resolverCiudad(fila.ciudad_texto) }))
  const { data, error } = await supabaseAdmin.rpc('lideres_historico_reemplazar', {
    p_carga: { archivo: carga.archivo, huella: carga.huella, corte: carga.corte },
    p_filas: filas,
    p_user: userId,
  })
  if (error) {
    if (esTablaInexistente(error)) {
      return NextResponse.json({ error: 'Falta aplicar la migración 0920 (histórico de las líderes): la vista previa funciona, guardar todavía no.', vistaPrevia }, { status: 503 })
    }
    console.error('[api] lideres/historico POST:', error)
    return NextResponse.json({ error: 'No se pudo guardar el histórico', vistaPrevia }, { status: 500 })
  }
  return NextResponse.json({ guardado: data, vistaPrevia })
}

/** GET /api/lideres/historico: la última carga y sus filas, con el nombre de cada líder y ciudad en OpMap. */
export async function leerHistoricoTracker(): Promise<Response> {
  const ultima = await supabaseAdmin
    .from('lideres_historico_cargas')
    .select('archivo, corte, filas, importado_at, importado_por')
    .order('importado_at', { ascending: false })
    .limit(1)
  if (ultima.error) {
    if (esTablaInexistente(ultima.error)) return NextResponse.json({ disponible: false, carga: null, filas: [] } satisfies HistoricoRespuesta)
    throw ultima.error
  }
  const carga = (ultima.data?.[0] as { archivo: string; corte: string; filas: number; importado_at: string; importado_por: string } | undefined) ?? null
  if (!carga) return NextResponse.json({ disponible: true, carga: null, filas: [] } satisfies HistoricoRespuesta)

  const [filas, usuarios, municipios] = await Promise.all([
    fetchAllRows<Omit<FilaHistorico, 'lider' | 'ciudad'>>((from, to) =>
      supabaseAdmin
        .from('lideres_historico')
        .select('fila, fecha, fecha_texto, user_id, lider_texto, municipio_id, ciudad_texto, tipo, tipo_texto, estado, contactos, con_observacion')
        .order('fila')
        .range(from, to)
    ),
    leerUsuarios(),
    leerMunicipios(),
  ])
  if (filas.error) throw filas.error
  const nombres = new Map(usuarios.map(usuario => [usuario.id, usuario.full_name]))
  const municipiosPorCodigo = new Map(municipios.map(municipio => [municipio.code, municipio.name]))
  const respuesta: HistoricoRespuesta = {
    disponible: true,
    carga: { ...carga, importado_por: nombres.get(carga.importado_por) ?? null },
    filas: filas.data.map(fila => ({
      ...fila,
      lider: nombres.get(fila.user_id) ?? fila.lider_texto,
      ciudad: (fila.municipio_id && municipiosPorCodigo.get(fila.municipio_id)) || fila.ciudad_texto || 'Sin ciudad',
    })),
  }
  return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
}
