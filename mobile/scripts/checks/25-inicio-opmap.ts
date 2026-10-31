/**
 * El botón "OpMap" de la franja de estado (dueño, 2026-10-31; spec docs/specs/2026-10-31-diseno-unificado-vista-de-modulos.md,
 * etapa 2a): lib/opmap-enlace.ts (puro) y lo que EstadoCola.tsx tiene que hacer (se lee su archivo). Corren en Node, sin
 * React Native ni red. Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 25-inicio-opmap
 */
import { GLIFOS_ICONOS } from '../../lib/iconos-nombres'
import { MENSAJE_OPMAP_SIN_SENAL, RUTA_INICIO_OPMAP, destinoOpMap } from '../../lib/opmap-enlace'
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
  t.seccion('25. El botón "OpMap" de la franja (lib/opmap-enlace.ts)')
  t.check('en el teléfono compilado o Expo Go (no navegador) el botón no sale', destinoOpMap({ navegador: false, instalada: null, enLinea: true }).modo === 'oculto')
  const web = destinoOpMap({ navegador: true, instalada: false, enLinea: true })
  t.check('en el navegador con señal: va a /inicio en la misma pestaña', web.modo === 'ir' && web.url === RUTA_INICIO_OPMAP && web.url === '/inicio' && !web.nuevaPestana, web)
  const instalada = destinoOpMap({ navegador: true, instalada: true, enLinea: true })
  t.check('instalada (standalone) con señal: abre OpMap en otra pestaña del navegador (la app no se cierra)', instalada.modo === 'ir' && instalada.nuevaPestana, instalada)
  t.check('sin saber si está instalada (null): misma pestaña', (() => { const d = destinoOpMap({ navegador: true, instalada: null, enLinea: true }); return d.modo === 'ir' && !d.nuevaPestana })())
  t.check('sin señal (instalada o no): no sale, solo avisa', destinoOpMap({ navegador: true, instalada: true, enLinea: false }).modo === 'sin_senal' && destinoOpMap({ navegador: true, instalada: false, enLinea: false }).modo === 'sin_senal')
  t.check('el aviso dice que OpMap necesita señal y que los pendientes siguen aquí', /necesita señal/.test(MENSAJE_OPMAP_SIN_SENAL) && /pendientes siguen aquí/.test(MENSAJE_OPMAP_SIN_SENAL))
  t.check('ícono "inicio" (casa) de Ionicons, relleno y contorno', GLIFOS_ICONOS.inicio.relleno === 'home' && GLIFOS_ICONOS.inicio.contorno === 'home-outline')

  t.seccion('25b. EstadoCola.tsx (se lee el archivo)')
  const franja = leer('components/EstadoCola.tsx')
  t.check('la franja decide el destino con destinoOpMap (navegador, instalada, en línea)', /destinoOpMap\(\{ navegador: esNavegador\(\), instalada: correInstalada\(\), enLinea \}\)/.test(franja))
  t.check('el botón "OpMap" va a la izquierda con el ícono "inicio", y no sale cuando el destino es "oculto"', /\{destino\.modo !== 'oculto' \? \(\s*(\/\/[^\n]*\n\s*)?<Pressable/.test(franja) && /<Icono nombre="inicio"/.test(franja) && /OpMap<\/Text>/.test(franja))
  t.check('instalada abre otra pestaña (window.open) y, si el navegador la bloquea o no está instalada, la misma (location.assign); sin señal solo pone el aviso', /const abierta = destino\.nuevaPestana && w\.open \? w\.open\(destino\.url, '_blank'\) : null/.test(franja) && /if \(abierta\) return\b/.test(franja) && /w\.location\?\.assign\(destino\.url\)/.test(franja) && /setAvisoOpMap\(MENSAJE_OPMAP_SIN_SENAL\)/.test(franja))
  t.check('con "Subir ahora" o "Actualizar" al lado, el botón queda solo con el ícono (y conserva su etiqueta accesible)', /const soloIcono = hayPendientes \|\| \(versionNueva && esNavegador\(\)\)/.test(franja) && /\{soloIcono \? null : <Text/.test(franja) && /accessibilityLabel="OpMap: volver al inicio de módulos"/.test(franja))
  t.check('el aviso se quita solo a los 4 s y no toca la cola', /setTimeout\(\(\) => setAvisoOpMap\(null\), 4000\)/.test(franja) && !/quitar\(|encolar/.test(franja))
}
