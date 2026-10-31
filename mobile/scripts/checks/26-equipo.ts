/**
 * Equipo (Entrega 2, 2026-10-31; spec docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md): quién supervisa
 * arma sus pestañas, la API de Equipo en lib/api.ts, la sesión guarda `supervisa`, index.tsx manda a /equipo y las
 * pantallas de Equipo. Corren en Node, sin React Native ni red. Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 26-equipo
 */
import type { Probador } from './probador'

interface FsMinimo {
  readFileSync(ruta: string, codificacion: 'utf8'): string
}
interface PathMinimo {
  resolve(...partes: string[]): string
}
declare const __dirname: string
const { readFileSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo
const leer = (relativa: string) => readFileSync(path.resolve(__dirname, '..', '..', relativa), 'utf8')

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('26. Equipo: quién supervisa, sus pestañas y la API (se leen los archivos)')
  const api = leer('lib/api.ts')
  t.check(
    'lib/api.ts: equipoPersonas, equipoHoy(fecha), equipoPersonaDia(id, fecha), equipoRendimiento(desde, hasta, linea, papel) y equipoPersonaRendimiento(id, desde, hasta) contra /api/equipo/*',
    /export function equipoPersonas\(\)/.test(api) &&
      /'\/api\/equipo\/personas'/.test(api) &&
      /export function equipoHoy\(fecha\?: string\)/.test(api) &&
      /'\/api\/equipo\/hoy'/.test(api) &&
      /export function equipoPersonaDia\(id: string, fecha\?: string\)/.test(api) &&
      /`\/api\/equipo\/persona\/\$\{encodeURIComponent\(id\)\}`/.test(api) &&
      /export function equipoRendimiento\(desde: string, hasta: string, linea\?: string \| null, papel\?: 'lider' \| 'ejecutivo' \| null\)/.test(api) &&
      /'\/api\/equipo\/rendimiento'/.test(api) &&
      /export function equipoPersonaRendimiento\(id: string, desde: string, hasta: string\)/.test(api) &&
      /`\/api\/equipo\/persona\/\$\{encodeURIComponent\(id\)\}\/rendimiento`/.test(api)
  )
  const sesion = leer('lib/sesion.ts')
  t.check('lib/sesion.ts: el perfil guarda supervisa de /api/auth/me (null si el servidor no lo manda), al confirmar y al completar la persona', (sesion.match(/supervisa: respuesta\.supervisa \?\? null/g) ?? []).length === 2 && /supervisa\?: boolean \| null/.test(sesion))
  const layout = leer('app/(app)/_layout.tsx')
  t.check('_layout.tsx: estadoPersona recibe supervisa del perfil y las pestañas visibles salen de pestanasDe(quien)', /supervisa: perfil\?\.supervisa/.test(layout) && /const visibles = pestanasDe\(quien\)/.test(layout))
  const index = leer('app/index.tsx')
  t.check('index.tsx: quien supervisa (sin persona) entra por /equipo; los demás por /hoy', /estadoPersona\(/.test(index) && /quien === 'supervisa' \? '\/equipo' : '\/hoy'/.test(index))
  for (const ruta of ['app/(app)/equipo.tsx', 'app/(app)/equipo/persona/[id].tsx', 'app/(app)/equipo/rendimiento.tsx']) {
    t.check(`${ruta} existe y exporta una pantalla`, /export default function/.test(leer(ruta)))
  }
}
