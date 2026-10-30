/**
 * Sección 22: el tema de la app es el de OpMap (etapa 1 del diseño, dueño 2026-10-30; spec
 * docs/specs/2026-10-30-diseno-web-etapa-1.md, punto 4). Cada persona elige Claro, Oscuro o Automático en Ajustes; se
 * guarda en el teléfono (AsyncStorage) o, en el navegador, en la misma clave de localStorage que OpMap (opmap.tema.v1),
 * y elegirlo en uno vale para los dos. lib/tema.ts es el ESPEJO de web/lib/tema.ts: la prueba corre los dos. Ninguna
 * pantalla mira el modo del teléfono directamente (useColorScheme): todas pasan por useEsquema. Sin red.
 * Corre sola con `npx tsx scripts/checks/correr.ts 22-tema`.
 */
import { CLAVE_TEMA, leerPreferencia, temaEfectivo, type PreferenciaTema } from '../../lib/tema'
import type { Probador } from './probador'

declare const require: (modulo: string) => unknown
declare const __dirname: string

interface FsMinimo {
  readFileSync(ruta: string, codificacion: 'utf8'): string
  readdirSync(ruta: string): string[]
  statSync(ruta: string): { isDirectory(): boolean }
}
interface PathMinimo {
  join(...partes: string[]): string
  resolve(...partes: string[]): string
  relative(desde: string, hasta: string): string
}
const { readFileSync, readdirSync, statSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo
const RAIZ = path.resolve(__dirname, '../..')
const leer = (relativa: string) => readFileSync(path.join(RAIZ, relativa), 'utf8')

/** web/lib/tema.ts es puro y corre aquí tal cual: el espejo se prueba con los dos. */
interface TemaWeb {
  leerPreferencia(valor: unknown): string
  temaEfectivo(preferencia: PreferenciaTema, prefiereOscuro: boolean): string
}
const RUTA_WEB = path.join(RAIZ, '..', 'web', 'lib', 'tema.ts')
const web = require(RUTA_WEB) as TemaWeb

/** Archivos .ts/.tsx de app/, components/ y lib/ (sin las copias " 2"). */
function fuentes(): string[] {
  const salida: string[] = []
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = path.join(dir, nombre)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (/\.tsx?$/.test(nombre) && !/ 2\.tsx?$/.test(nombre)) salida.push(ruta)
    }
  }
  for (const carpeta of ['app', 'components', 'lib']) recorrer(path.join(RAIZ, carpeta))
  return salida
}

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('22. El tema de la app es el de OpMap: Claro, Oscuro o Automático (etapa 1 del diseño)')

  t.check(
    "CLAVE_TEMA = 'opmap.tema.v1', la misma de web/lib/tema.ts (leída como texto)",
    CLAVE_TEMA === 'opmap.tema.v1' && readFileSync(RUTA_WEB, 'utf8').includes(`export const CLAVE_TEMA = '${CLAVE_TEMA}'`)
  )
  const guardados: unknown[] = ['claro', 'oscuro', 'auto', 'xyz', null, 42]
  t.check(
    'leerPreferencia da lo mismo que la web (claro, oscuro, auto, otro texto, null, un número → auto)',
    guardados.every(valor => leerPreferencia(valor) === web.leerPreferencia(valor)) && leerPreferencia('xyz') === 'auto' && leerPreferencia('oscuro') === 'oscuro',
    guardados.map(valor => [valor, leerPreferencia(valor), web.leerPreferencia(valor)])
  )
  const casos: Array<[PreferenciaTema, boolean]> = [['auto', true], ['auto', false], ['claro', true], ['claro', false], ['oscuro', true], ['oscuro', false]]
  t.check(
    'temaEfectivo da lo mismo que la web en los 6 casos (automático sigue al teléfono; claro y oscuro mandan)',
    casos.every(([preferencia, oscuro]) => temaEfectivo(preferencia, oscuro) === web.temaEfectivo(preferencia, oscuro)) &&
      temaEfectivo('auto', true) === 'oscuro' && temaEfectivo('auto', false) === 'claro' && temaEfectivo('claro', true) === 'claro' && temaEfectivo('oscuro', false) === 'oscuro',
    casos.map(([preferencia, oscuro]) => [preferencia, oscuro, temaEfectivo(preferencia, oscuro), web.temaEfectivo(preferencia, oscuro)])
  )

  const proveedor = leer('lib/tema-preferencia.tsx')
  const directos = fuentes()
    .filter(ruta => !ruta.endsWith('tema-preferencia.tsx') && /useColorScheme\(/.test(readFileSync(ruta, 'utf8')))
    .map(ruta => path.relative(RAIZ, ruta))
  t.check(
    'ninguna pantalla mira el modo del teléfono directamente: useColorScheme( solo en lib/tema-preferencia.tsx (las demás, useEsquema o useColores)',
    directos.length === 0 && /useColorScheme\(\)/.test(proveedor),
    directos
  )
  t.check('useColores sigue la preferencia (useEsquema)', /export function useColores\(\): Colores \{\s*return useEsquema\(\) === 'dark' \? COLORES_OSCUROS : COLORES_CLAROS/.test(leer('lib/ui.tsx')))
  t.check(
    'el logotipo y el croquis también (useEsquema)',
    /const esquema = useEsquema\(\)/.test(leer('components/Logo.tsx')) && /const oscuro = useEsquema\(\) === 'dark'/.test(leer('components/Croquis.tsx'))
  )
  t.check(
    'se guarda en el teléfono (AsyncStorage) y en el navegador en localStorage, con la misma clave y sin lanzar (modo privado)',
    /AsyncStorage\.setItem\(CLAVE_TEMA, /.test(proveedor) && /AsyncStorage\.getItem\(CLAVE_TEMA\)/.test(proveedor) && /localStorage/.test(proveedor) && /\.setItem\(CLAVE_TEMA, /.test(proveedor) && /catch/.test(proveedor)
  )
  t.check(
    'en el navegador sigue a otras pestañas (OpMap o la app): escucha storage, con su clave o con todo vaciado',
    /addEventListener\('storage', /.test(proveedor) && /removeEventListener\('storage', /.test(proveedor) && /key === null \|\| [\w.]*key === CLAVE_TEMA/.test(proveedor)
  )
  const raiz = leer('app/_layout.tsx')
  t.check(
    'la raíz monta ProveedorTema por encima de todo y, en el teléfono, deja la portada hasta leer la preferencia (sin destello del otro tema)',
    /<ProveedorTema>\s*<Raiz \/>\s*<\/ProveedorTema>/.test(raiz) && /const \{ listo: temaListo \} = useTemaApp\(\)/.test(raiz) && /!temaListo/.test(raiz)
  )
  const conBarraAuto = fuentes().filter(ruta => /<StatusBar style="auto"/.test(readFileSync(ruta, 'utf8'))).map(ruta => path.relative(RAIZ, ruta))
  t.check(
    'la hora y la batería contrastan con el tema elegido (BarraDeEstado), no con el del teléfono: ningún StatusBar "auto"',
    conBarraAuto.length === 0 && /<BarraDeEstado \/>/.test(raiz) && /<StatusBar style=\{esquema === 'dark' \? 'light' : 'dark'\} \/>/.test(proveedor),
    conBarraAuto
  )
  const ajustes = leer('app/(app)/ajustes.tsx')
  t.check(
    'Ajustes tiene "Tema" con "Claro", "Oscuro" y "Automático" (como el menú de OpMap), lo elegido marcado',
    /<Subtitulo>Tema<\/Subtitulo>/.test(ajustes) &&
      /\['claro', 'Claro'\]/.test(ajustes) && /\['oscuro', 'Oscuro'\]/.test(ajustes) && /\['auto', 'Automático'\]/.test(ajustes) &&
      /useTemaApp\(\)/.test(ajustes) && /activo=\{preferencia === valor\}/.test(ajustes) && /alPresionar=\{\(\) => elegir\(valor\)\}/.test(ajustes)
  )
}
