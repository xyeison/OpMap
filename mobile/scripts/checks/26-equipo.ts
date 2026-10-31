/**
 * Equipo (Entrega 2, 2026-10-31; spec docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md): quién supervisa
 * arma sus pestañas, la API de Equipo en lib/api.ts, la sesión guarda `supervisa`, index.tsx manda a /equipo y las
 * pantallas de Equipo. Corren en Node, sin React Native ni red. Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 26-equipo
 */
import {
  ETIQUETA_MARCA,
  ETIQUETA_PAPEL,
  RELEER_CADA_MS,
  TEXTO_FIJO_EQUIPO,
  filtrarPersonas,
  textoHace,
  textoPaso,
  textoResumen,
  textoUbicacion,
} from '../../lib/equipo'
import type { PasoRastroItem, PersonaEquipoItem, UbicacionItem } from '../../lib/tipos'
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

  t.seccion('26b. Equipo › Hoy: textos y filtros (lib/equipo.ts, puro)')
  const web = leer('../web/lib/reporte-visitas.ts')
  t.check('el texto fijo es el mismo del servidor (TEXTO_FIJO_EQUIPO de web/lib/reporte-visitas.ts)', web.includes(`export const TEXTO_FIJO_EQUIPO = '${TEXTO_FIJO_EQUIPO}'`) && TEXTO_FIJO_EQUIPO === 'Lo que cada persona reporta o agenda. La app no sigue la ubicación.')
  t.check('textoHace: 35 min, 4 h, 1 h 20 min, 0 min', textoHace(35) === 'hace 35 min' && textoHace(240) === 'hace 4 h' && textoHace(80) === 'hace 1 h 20 min' && textoHace(0) === 'hace 0 min')
  const u = (parcial: Partial<UbicacionItem>): UbicacionItem => ({ caso: 'sin_nada', fuente: null, hora: null, sede: null, municipio: null, hace_min: null, marcas: [], ...parcial })
  t.check(
    'textoUbicacion: cada caso con su frase',
    textoUbicacion(u({ caso: 'dia_libre' })) === 'Día libre' &&
      textoUbicacion(u({ caso: 'festivo' })) === 'Festivo' &&
      textoUbicacion(u({ caso: 'reportado', fuente: 'reportado', hora: '10:40', sede: 'Clínica Norte', municipio: 'Bogotá', hace_min: 35 })) === '10:40 · Clínica Norte, Bogotá (hace 35 min)' &&
      textoUbicacion(u({ caso: 'reportado', fuente: 'reportado', hora: '10:40', sede: 'Clínica Norte', municipio: 'Bogotá', hace_min: null })) === '10:40 · Clínica Norte, Bogotá' &&
      textoUbicacion(u({ caso: 'reportado_hace_rato', fuente: 'reportado', hora: '07:50', sede: 'Hospital Sur', municipio: 'Soacha', hace_min: 205 })) === 'Último reporte hace 3 h 25 min · Soacha' &&
      textoUbicacion(u({ caso: 'planeado', fuente: 'planeado', hora: '11:30', sede: 'Clínica Norte', municipio: 'Bogotá' })) === 'Planeado 11:30 · Clínica Norte, Bogotá' &&
      textoUbicacion(u({ caso: 'sin_nada' })) === 'Sin reportes ni plan hoy' &&
      textoUbicacion(u({ caso: 'reportado', fuente: 'reportado', hora: '10:40', sede: 'Clínica Norte', municipio: null, hace_min: 5 })) === '10:40 · Clínica Norte (hace 5 min)'
  )
  t.check('ETIQUETA_MARCA: palabras, nunca metros', ETIQUETA_MARCA.lejos_de_ips === 'Lejos de la sede' && ETIQUETA_MARCA.sin_ubicacion === 'Sin GPS' && ETIQUETA_MARCA.precision_baja === 'GPS impreciso' && ETIQUETA_MARCA.hora_inconsistente === 'Hora del teléfono rara' && ETIQUETA_MARCA.medico_por_validar === 'Médico por validar' && ETIQUETA_MARCA.en_sitio === 'En la sede' && ETIQUETA_MARCA.ips_sin_coordenadas === 'Sede sin ubicación')
  t.check('ETIQUETA_PAPEL: Líder, Ejecutivo Comercial, Líder y Ejecutivo Comercial (nunca "KAM")', ETIQUETA_PAPEL.lider === 'Líder' && ETIQUETA_PAPEL.ejecutivo === 'Ejecutivo Comercial' && ETIQUETA_PAPEL.lider_y_ejecutivo === 'Líder y Ejecutivo Comercial')
  t.check('textoResumen: "Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3"; sin nadie, "Nadie"', textoResumen({ ciudades: [{ nombre: 'Cartagena', personas: 2 }, { nombre: 'Bogotá', personas: 6 }], sin_nada: 3 }) === 'Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3' && textoResumen({ ciudades: [], sin_nada: 0 }) === 'Nadie' && textoResumen({ ciudades: [], sin_nada: 2 }) === 'Sin reporte ni plan 2')
  const p = (parcial: Partial<PersonaEquipoItem>): PersonaEquipoItem => ({ user_id: 'u', nombre: 'X', papel: 'ejecutivo', executive_id: null, zona: null, lineas: [], solo_como_ejecutivo: false, activa: true, ...parcial })
  const filas = [
    { persona: p({ user_id: 'a', papel: 'lider', lineas: [{ id: 'l1', nombre: 'Trauma', como: 'lider' }] }) },
    { persona: p({ user_id: 'b', papel: 'ejecutivo', lineas: [{ id: 'l1', nombre: 'Trauma', como: 'ejecutivo' }, { id: 'l2', nombre: 'Columna', como: 'ejecutivo' }] }) },
    { persona: p({ user_id: 'c', papel: 'lider_y_ejecutivo', lineas: [{ id: 'l2', nombre: 'Columna', como: 'ejecutivo' }] }) },
  ]
  const ids = (xs: typeof filas) => xs.map(f => f.persona.user_id).join()
  t.check('filtrarPersonas: todas; líderes (lider y lider_y_ejecutivo); ejecutivos (ejecutivo y lider_y_ejecutivo); por línea', ids(filtrarPersonas(filas, 'todas', null)) === 'a,b,c' && ids(filtrarPersonas(filas, 'lideres', null)) === 'a,c' && ids(filtrarPersonas(filas, 'ejecutivos', null)) === 'b,c' && ids(filtrarPersonas(filas, 'todas', 'l2')) === 'b,c' && ids(filtrarPersonas(filas, 'lideres', 'l2')) === 'c')
  const paso = (parcial: Partial<PasoRastroItem>): PasoRastroItem => ({ fecha: '2026-10-20', hora: '10:30', tipo: 'medica', modalidad: 'presencial', con_quien: 'Dr. Uno', sede: 'Clínica Norte', municipio: 'Bogotá', estado: 'hecha', motivo: null, anticipacion_dias: 7, viene_de_fecha: null, lineas: ['Osteosíntesis'], marcas: [], visita_id: 'v', cita_id: 'c', ...parcial })
  const hecha = textoPaso(paso({}))
  const noEf = textoPaso(paso({ estado: 'no_efectiva', motivo: 'sin_tiempo', anticipacion_dias: null, cita_id: null }))
  const noSeHizo = textoPaso(paso({ estado: 'no_realizada', motivo: 'cliente', visita_id: null, lineas: [] }))
  const otra = textoPaso(paso({ estado: 'programada', viene_de_fecha: '2026-10-19', anticipacion_dias: 1, visita_id: null, lineas: [] }))
  const tel = textoPaso(paso({ modalidad: 'telefonica', sede: null, municipio: null, anticipacion_dias: 0 }))
  t.check('textoPaso: título "10:30 · Dr. Uno", detalle con sede y municipio, líneas y "planeada hace 7 días"; estado "Hecha"', hecha.titulo === '10:30 · Dr. Uno' && hecha.detalle === 'Clínica Norte, Bogotá · Osteosíntesis · planeada hace 7 días' && hecha.estado === 'Hecha', hecha)
  t.check('textoPaso: no efectiva con motivo y no planeada; no se hizo con motivo; otra fecha "viene de"; telefónica y mismo día', noEf.estado === 'No efectiva · sin_tiempo' && /no planeada/.test(noEf.detalle) && noSeHizo.estado === 'No se hizo · cliente' && /viene de la cita del 19 oct/.test(otra.detalle) && /planeada hace 1 día/.test(otra.detalle) && /Telefónica/.test(tel.detalle) && /planeada el mismo día/.test(tel.detalle), { noEf, noSeHizo, otra, tel })
  t.check('RELEER_CADA_MS: 5 minutos', RELEER_CADA_MS === 5 * 60 * 1000)

  t.seccion('26c. Pantallas Equipo › Hoy y el día de una persona (se leen los archivos)')
  const hoyEquipo = leer('app/(app)/equipo.tsx')
  t.check('equipo.tsx: texto fijo, resumen, filtros por papel y línea, se relee cada 5 min mientras está a la vista y cada tarjeta abre el día de la persona', /TEXTO_FIJO_EQUIPO/.test(hoyEquipo) && /textoResumen\(/.test(hoyEquipo) && /filtrarPersonas\(/.test(hoyEquipo) && /RELEER_CADA_MS/.test(hoyEquipo) && /useFocusEffect/.test(hoyEquipo) && /setInterval\(/.test(hoyEquipo) && /router\.push\(\{ pathname: '\/equipo\/persona\/\[id\]'/.test(hoyEquipo) && /api\.equipoHoy\(/.test(hoyEquipo) && /api\.equipoPersonas\(/.test(hoyEquipo))
  t.check('equipo.tsx: selector de día sin futuro, botón "Rendimiento" y las marcas como insignias con palabras', /fecha >= hoy/.test(hoyEquipo) && /\/equipo\/rendimiento/.test(hoyEquipo) && /ETIQUETA_MARCA\[/.test(hoyEquipo))
  const dia = leer('app/(app)/equipo/persona/[id].tsx')
  t.check('[id].tsx: lee id y fecha de la ruta, pide api.equipoPersonaDia, muestra dónde está, el rastro (textoPaso) y "Siguiente"', /useLocalSearchParams/.test(dia) && /api\.equipoPersonaDia\(/.test(dia) && /textoUbicacion\(/.test(dia) && /textoPaso\(/.test(dia) && /Siguiente/.test(dia) && /Rastro/.test(dia))
}
