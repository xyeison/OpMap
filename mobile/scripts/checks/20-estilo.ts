/**
 * Sección 20: estilo visual tipo Uber (dirección A, elegida por el dueño el 2026-10-15). Pruebas puras de los tokens
 * de lib/paleta.ts (contrastes WCAG en los dos modos, alturas, radios y escala de letra), del croquis de Hoy y Reportar
 * (lib/croquis.ts: escala, centro, foco, etiquetas) y del encabezado blanco y la barra (leen su archivo). Sin red.
 * Corre sola con `npx tsx scripts/checks/correr.ts 20-estilo`.
 */
import {
  ALTO_CROQUIS,
  ALTO_CROQUIS_BAJO,
  ALTO_ETIQUETA_CROQUIS,
  BORDE_ETIQUETA,
  altoCroquis,
  cajaNombreSede,
  descripcionCroquis,
  etiquetaSedeArriba,
  etiquetaYoALaIzquierda,
  metrosDesde,
  planCroquis,
  posicionEtiquetaYo,
  MINIMO_CROQUIS_M,
  type CajaCroquis,
  type SedeCroquis,
} from '../../lib/croquis'
import { SEPARACION_DIAS, anchoDia } from '../../lib/calendario'
import { haversineM, textoDistancia } from '../../lib/geo'
import { SIN_ENCABEZADO, PESTANAS } from '../../lib/navegacion'
import { ALTO_TOQUE_MIN, COLORES_CLAROS, COLORES_OSCUROS, LETRA, MAPA_CLARO, MAPA_OSCURO, MAX_ESCALA_TEXTO, TAMANO, contraste, type Colores, type ColoresMapa } from '../../lib/paleta'
import type { Probador } from './probador'

declare const require: (modulo: string) => unknown
declare const __dirname: string

interface FsMinimo {
  existsSync(ruta: string): boolean
  readFileSync(ruta: string, codificacion: 'utf8'): string
  readdirSync(ruta: string): string[]
  statSync(ruta: string): { isDirectory(): boolean }
}
interface PathMinimo {
  join(...partes: string[]): string
  resolve(...partes: string[]): string
}
const { existsSync, readFileSync, readdirSync, statSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo
const RAIZ = path.resolve(__dirname, '../..')
const leer = (relativa: string) => readFileSync(path.join(RAIZ, relativa), 'utf8')

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
  t.seccion('20. Estilo visual tipo Uber (dirección A): tokens, croquis, encabezado y barra')

  // -------------------------------------------------------------------------
  // Colores: los de los artboards y sus contrastes (WCAG 2.x) en los dos modos
  // -------------------------------------------------------------------------
  const c = COLORES_CLAROS
  t.check(
    'claro: blanco y negro de los artboards (fondo #FFFFFF, texto #000000, secundario #5C5B5B, relleno #EEEEEE, bloque #F6F6F6)',
    c.fondo === '#FFFFFF' && c.texto === '#000000' && c.textoSuave === '#5C5B5B' && c.relleno === '#EEEEEE' && c.superficieSuave === '#F6F6F6' && c.acento === '#000000'
  )
  t.check('claro: "dentro del radio" verde #047857 sobre #E7F4EE; separadores #EEEEEE y raya de la barra #E6E6E6', c.exito === '#047857' && c.fondoExito === '#E7F4EE' && c.borde === '#EEEEEE' && c.bordeFuerte === '#E6E6E6')
  t.check('oscuro: fondo negro, texto blanco y acento blanco (se invierte)', COLORES_OSCUROS.fondo === '#000000' && COLORES_OSCUROS.texto === '#FFFFFF' && COLORES_OSCUROS.acento === '#FFFFFF' && COLORES_OSCUROS.sobreAcento === '#000000')

  const modos: [string, Colores][] = [
    ['claro', COLORES_CLAROS],
    ['oscuro', COLORES_OSCUROS],
  ]
  for (const [modo, k] of modos) {
    const fondos = { fondo: k.fondo, superficie: k.superficie, superficieSuave: k.superficieSuave, relleno: k.relleno }
    const bajos: string[] = []
    for (const [nombreFondo, fondo] of Object.entries(fondos)) {
      for (const [nombreTexto, texto] of Object.entries({ texto: k.texto, textoSuave: k.textoSuave })) {
        const r = contraste(texto, fondo)
        if (r < 4.5) bajos.push(`${nombreTexto}/${nombreFondo} ${r.toFixed(2)}`)
      }
    }
    t.check(`${modo}: texto y texto secundario ≥ 4,5:1 sobre fondo, superficie, bloque (#F6F6F6) y relleno (#EEEEEE)`, bajos.length === 0, bajos)
    t.check(`${modo}: la letra del botón principal ≥ 4,5:1 sobre el acento (${contraste(k.sobreAcento, k.acento).toFixed(1)}:1)`, contraste(k.sobreAcento, k.acento) >= 4.5)
    const estados = (['exito', 'alerta', 'peligro', 'info'] as const).map(e => {
      const fondoEstado = k[`fondo${e[0].toUpperCase()}${e.slice(1)}` as 'fondoExito']
      return { e, sobreSuFondo: contraste(k[e], fondoEstado), sobreFondo: contraste(k[e], k.fondo), sobreSuperficie: contraste(k[e], k.superficie) }
    })
    const estadosBajos = estados.filter(x => Math.min(x.sobreSuFondo, x.sobreFondo, x.sobreSuperficie) < 4.5)
    t.check(`${modo}: los estados (éxito, alerta, peligro, info) ≥ 4,5:1 sobre su fondo suave, el fondo y la superficie`, estadosBajos.length === 0, estadosBajos)
    // Lo que antes cuidaba el borde del chip y del botón secundario: lo elegido se distingue de lo no elegido.
    t.check(`${modo}: lo elegido (acento) contra lo no elegido (relleno) ≥ 3:1 (${contraste(k.acento, k.relleno).toFixed(1)}:1)`, contraste(k.acento, k.relleno) >= 3)
    t.check(`${modo}: el botón principal se ve sobre el fondo (acento/fondo ≥ 3:1)`, contraste(k.acento, k.fondo) >= 3 && contraste(k.acento, k.superficie) >= 3)
    t.check(`${modo}: bordeControl ≥ 3:1 sobre la superficie del campo y del selector`, contraste(k.bordeControl, k.superficie) >= 3 && contraste(k.bordeControl, k.fondo) >= 3)
    t.check(`${modo}: la raya de la pestaña elegida (acento) ≥ 3:1 sobre la barra`, contraste(k.acento, k.superficie) >= 3)
    t.check(`${modo}: la portada sigue negra con el logotipo blanco (encabezado/sobreEncabezado ≥ 4,5:1)`, k.encabezado === '#000000' && contraste(k.sobreEncabezado, k.encabezado) >= 4.5)
  }
  const mapas: [string, ColoresMapa, Colores][] = [
    ['claro', MAPA_CLARO, COLORES_CLAROS],
    ['oscuro', MAPA_OSCURO, COLORES_OSCUROS],
  ]
  for (const [modo, m, k] of mapas) {
    t.check(
      `croquis ${modo}: tu punto y la sede (acento) ≥ 3:1 sobre el suelo y las manzanas; el radio (éxito) ≥ 3:1 sobre el suelo`,
      contraste(k.acento, m.suelo) >= 3 && contraste(k.acento, m.manzana) >= 3 && contraste(k.exito, m.suelo) >= 3,
      { punto: contraste(k.acento, m.manzana).toFixed(2), radio: contraste(k.exito, m.suelo).toFixed(2) }
    )
    t.check(`croquis ${modo}: las manzanas son decorativas y suaves (< 1,5:1 contra el suelo, no compiten con las marcas)`, contraste(m.manzana, m.suelo) < 1.5)
  }

  // -------------------------------------------------------------------------
  // Alturas, radios y letra
  // -------------------------------------------------------------------------
  t.check('botón principal de 52 pt (≥ 44) y el grande de 64; todo lo que se toca ≥ 44', TAMANO.boton === 52 && TAMANO.boton >= ALTO_TOQUE_MIN && TAMANO.botonGrande === 64 && TAMANO.botonGrande >= TAMANO.boton && ALTO_TOQUE_MIN === 44)
  t.check('radios 10 (botón, chip, campo), 12 (tarjeta, bloque) y 20 (hoja); márgenes de 20', TAMANO.radio === 10 && TAMANO.radioTarjeta === 12 && TAMANO.radioHoja === 20 && TAMANO.espacio === 20)
  t.check('título 30/36, negrita, −0,02 em (−0,6 pt); paso 28/34; sección 17/22; cuerpo 16/22; pequeño 14/20', LETRA.titulo.fontSize === 30 && LETRA.titulo.lineHeight === 36 && Math.abs(LETRA.titulo.letterSpacing - -0.02 * 30) < 1e-9 && LETRA.tituloPaso.fontSize === 28 && LETRA.tituloPaso.lineHeight === 34 && LETRA.seccion.fontSize === 17 && LETRA.seccion.lineHeight === 22 && LETRA.cuerpo.fontSize === 16 && LETRA.cuerpo.lineHeight === 22 && LETRA.peque.fontSize === 14 && LETRA.peque.lineHeight === 20)
  const apretadas = Object.entries(LETRA).filter(([, l]) => l.lineHeight < l.fontSize * 1.1).map(([n]) => n)
  t.check('cada estilo de letra tiene alto de línea ≥ 1,1 × su tamaño (no corta tildes ni la "ñ")', apretadas.length === 0, apretadas)
  t.check('TAMANO.texto y textoPeque coinciden con la escala (16 y 14)', TAMANO.texto === LETRA.cuerpo.fontSize && TAMANO.textoPeque === LETRA.peque.fontSize && TAMANO.titulo === LETRA.titulo.fontSize && TAMANO.subtitulo === LETRA.subtitulo.fontSize && TAMANO.seccion === LETRA.seccion.fontSize)
  t.check('tope del texto grande donde el espacio es fijo: 1,3', MAX_ESCALA_TEXTO === 1.3)

  const ui = leer('lib/ui.tsx')
  t.check('ui.tsx: la insignia sigue con maxFontSizeMultiplier={1.3} y el punto verde solo en la de éxito', /maxFontSizeMultiplier=\{1\.3\}/.test(ui) && /tono === 'exito' \? <View/.test(ui))
  t.check(
    'ui.tsx: Pantalla sin encabezado deja el área segura arriba (useSafeAreaInsets) y el croquis la recupera (useMargenArribaPantalla)',
    /alturaEncabezado > 0 \? 0 : insets\.top/.test(ui) && /export function useMargenArribaPantalla\(\)/.test(ui)
  )
  t.check('ui.tsx: la hoja (BordeHoja) con radio 20, sombra y agarradera', /export function BordeHoja\(\)/.test(ui) && /borderTopLeftRadius: TAMANO\.radioHoja/.test(ui) && /boxShadow: SOMBRA\.hoja/.test(ui) && /backgroundColor: c\.agarradera/.test(ui))
  t.check('ui.tsx: FilaLista con separador fino arriba (salvo la primera) y de 44 pt o más', /borderTopWidth: primera \? 0 : 1/.test(ui) && /minHeight: 60/.test(ui))

  // Revisión 2026-10-15: el calendario sin caja, con los márgenes de 20 y 4 pt entre días, dejaba cada día de 42,3 pt
  // de ancho en un Android de 360 dp (la prueba de 44 solo miraba el alto). Con 2 pt entre días, 44 justos.
  const calendarioTsx = leer('components/agenda/CalendarioMes.tsx')
  t.check(
    `calendario: cada día ≥ 44 pt de ancho en 360 dp con los márgenes de 20 (${anchoDia(360 - 2 * TAMANO.espacio).toFixed(1)}; en 375, ${anchoDia(375 - 2 * TAMANO.espacio).toFixed(1)})`,
    anchoDia(360 - 2 * TAMANO.espacio) >= ALTO_TOQUE_MIN && anchoDia(375 - 2 * TAMANO.espacio) >= ALTO_TOQUE_MIN && SEPARACION_DIAS === 2
  )
  t.check(
    'calendario: las letras y las semanas van a SEPARACION_DIAS (no a 4) y Agendar lo deja al margen de 20 (sin marginHorizontal -8)',
    (calendarioTsx.match(/flexDirection: 'row', gap: SEPARACION_DIAS \}/g) ?? []).length === 2 && !/gap: 4 \}/.test(calendarioTsx) && !/marginHorizontal: -8/.test(leer('app/(app)/agenda/nueva.tsx'))
  )

  // -------------------------------------------------------------------------
  // Encabezado blanco y barra
  // -------------------------------------------------------------------------
  const layout = leer('app/(app)/_layout.tsx')
  t.check('encabezado blanco (c.fondo) con el título grande (LETRA.titulo; junto a "Volver", LETRA.tituloPaso), no la barra negra', /backgroundColor: c\.fondo, paddingTop: insets\.top/.test(layout) && /izquierda \? LETRA\.tituloPaso : LETRA\.titulo/.test(layout) && !/headerStyle:\s*\{\s*backgroundColor: c\.encabezado/.test(layout))
  t.check('hora y batería del color que contrasta con el encabezado (BarraDeEstado: el tema elegido, sección 22)', /<BarraDeEstado \/>/.test(layout) && !/<StatusBar style="auto"/.test(layout))
  t.check(
    'Hoy y Reportar sin encabezado (arriba va el croquis); el resto con él',
    SIN_ENCABEZADO.length === 2 && SIN_ENCABEZADO.includes('hoy') && SIN_ENCABEZADO.includes('reportar') && /headerShown: !SIN_ENCABEZADO\.includes\(p\.ruta\)/.test(layout) && PESTANAS.filter(p => !SIN_ENCABEZADO.includes(p.ruta)).length === 3
  )
  t.check('barra: la pestaña elegida lleva una raya negra (acento) de 28 × 3 arriba, solo si focused', /const RAYA_PESTANA = \{ ancho: 28, alto: 3,/.test(layout) && /\{focused \? \(\s*<View/.test(layout) && /backgroundColor: c\.acento,\s*\}\}/.test(layout))
  // Revisión 2026-10-15: la raya iba 6 pt arriba de la caja del glifo (su alto depende de la letra del ícono) y quedaba a
  // caballo sobre el borde de la barra. Ahora sube justo el relleno de la pestaña desde una caja de alto fijo.
  const itemPestana = path.join(RAIZ, 'node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabItem.js')
  const rellenoLibreria = existsSync(itemPestana) ? (/tabVerticalUiKit:\s*\{[^}]*?\bpadding:\s*(\d+)/.exec(readFileSync(itemPestana, 'utf8'))?.[1] ?? null) : null
  t.check(
    'barra: la raya va por dentro, pegada al borde de arriba (sube el relleno de la pestaña, 5 pt en expo-router, desde una caja del alto del ícono)',
    /const RELLENO_PESTANA = 5\b/.test(layout) &&
      /const RAYA_PESTANA = \{ ancho: 28, alto: 3, arriba: -RELLENO_PESTANA \}/.test(layout) &&
      /<View style=\{\{ height: ALTO_ICONO_PESTANA, alignItems: 'center', justifyContent: 'center' \}\}>\s*\{focused \? \(/.test(layout) &&
      rellenoLibreria === '5',
    { rellenoLibreria }
  )
  t.check('"Volver" relleno de #EEEEEE (c.relleno), radio 10, con la palabra', /backgroundColor: c\.relleno/.test(layout.slice(layout.indexOf('function BotonVolver'), layout.indexOf('function LogoEncabezado'))) && />Volver</.test(layout))

  // -------------------------------------------------------------------------
  // Croquis (lib/croquis.ts)
  // -------------------------------------------------------------------------
  const YO = { lat: 11.0121, lng: -74.8669, precision: 12 }
  const PORTO = { id: 'porto', nombre: 'Clínica Portoazul', lat: 11.0116, lng: -74.8669 }
  const TORRE: SedeCroquis = { id: 'torre', nombre: 'Portoazul Torre Médica', lat: 11.0131, lng: -74.8662 }
  const LEJOS: SedeCroquis = { id: 'reina', nombre: 'Clínica Reina Catalina', lat: 11.004, lng: -74.807 }
  const SIN: SedeCroquis = { id: 'sin', nombre: 'Sin coordenadas', lat: null, lng: null }
  const caja = { ancho: 390, alto: 170 }
  const croquisTsx = leer('components/Croquis.tsx')

  t.check('croquis: sin tu punto ni sedes con coordenadas no hay croquis (null)', planCroquis({ yo: null, sedes: [SIN], foco: null, radioM: 100, ...caja }) === null)
  t.check('croquis: tamaño 0 → null', planCroquis({ yo: YO, sedes: [], foco: null, radioM: 100, ancho: 0, alto: 170 }) === null)

  const m = metrosDesde(YO, PORTO)
  t.check('metrosDesde: Portoazul queda ~55 m al sur de tu punto (x ≈ 0, y ≈ −55)', Math.abs(m.x) < 1 && Math.abs(m.y + 55.6) < 2, m)

  const plan = planCroquis({ yo: YO, sedes: [PORTO, TORRE, PORTO, SIN], foco: 'porto', radioM: 100, ...caja })
  t.check('croquis: el foco es la sede pedida, a ~55 m y dentro del radio de 100 m', plan?.foco?.id === 'porto' && plan.foco.distanciaM === haversineM(YO, PORTO) && plan.foco.dentro === true, plan?.foco)
  t.check('croquis: el norte va arriba (tu punto más arriba que la sede que está al sur)', !!plan?.yo && !!plan.radio && plan.yo.y < plan.radio.y)
  const separacion = plan?.yo && plan.radio ? Math.hypot(plan.yo.x - plan.radio.x, plan.yo.y - plan.radio.y) * plan.metrosPorPunto : NaN
  t.check(`croquis: a escala (la separación dibujada vale ${separacion.toFixed(1)} m ≈ 55 m)`, Math.abs(separacion - haversineM(YO, PORTO)) < 2)
  t.check('croquis: el círculo del radio mide radio ÷ escala', !!plan?.radio && Math.abs(plan.radio.r * plan.metrosPorPunto - 100) < 1e-6)
  const fuera = plan ? [...plan.sedes.map(s => ({ x: s.x, y: s.y })), ...(plan.yo ? [plan.yo] : [])].filter(p => p.x < 0 || p.x > caja.ancho || p.y < 0 || p.y > caja.alto) : ['sin plan']
  t.check('croquis: tu punto y las sedes caen dentro del dibujo', fuera.length === 0, fuera)
  t.check('croquis: cada sede una sola vez (la de una cita puede venir también entre las cercanas) y sin las que no tienen coordenadas', plan?.sedes.filter(s => s.id === 'porto').length === 1 && !plan.sedes.some(s => s.id === 'sin'))
  t.check('croquis: la sede del foco va primero (para el nombre encima)', plan?.sedes[0]?.id === 'porto' && plan.sedes[0].foco)
  t.check('croquis: el halo de tu punto es tu precisión a escala, nunca menos de 14 pt', !!plan?.yo && plan.yo.halo >= 14)

  const lejos = planCroquis({ yo: YO, sedes: [LEJOS, PORTO], foco: 'reina', radioM: 100, ...caja })
  t.check('croquis: la sede pedida muy lejos (6,6 km, otra ciudad) no se dibuja; el foco pasa a la más cercana', lejos?.foco?.id === 'porto' && !lejos.sedes.some(s => s.id === 'reina'), lejos?.foco)
  const sinYo = planCroquis({ yo: null, sedes: [PORTO], foco: 'porto', radioM: 100, ...caja })
  t.check('croquis: sin tu punto se centra en la sede del foco (sin distancia ni "dentro")', !!sinYo?.radio && Math.abs(sinYo.radio.x - caja.ancho / 2) < 1 && Math.abs(sinYo.radio.y - caja.alto / 2) < 1 && sinYo.yo === null && sinYo.foco?.distanciaM === null && sinYo.foco?.dentro === null)
  const solo = planCroquis({ yo: { ...YO, precision: 3 }, sedes: [], foco: null, radioM: 100, ...caja })
  t.check(`croquis: solo tu punto → se ven al menos ${MINIMO_CROQUIS_M} m en el lado corto (no un acercamiento absurdo)`, !!solo && solo.metrosPorPunto * Math.min(caja.ancho, caja.alto) >= MINIMO_CROQUIS_M - 1e-6 && solo.foco === null)
  const fueraRadio = planCroquis({ yo: YO, sedes: [TORRE], foco: 'torre', radioM: 50, ...caja })
  t.check('croquis: a 1xx m con radio de 50 → "fuera del radio"', fueraRadio?.foco?.dentro === false)

  t.check('etiquetas: tu punto justo encima de la sede → el nombre de la sede va DEBAJO de su marca (no tapa tu punto)', !!plan && etiquetaSedeArriba(plan) === false)
  const yoAbajo = planCroquis({ yo: { lat: 11.0101, lng: -74.8669, precision: 12 }, sedes: [PORTO], foco: 'porto', radioM: 100, ...caja })
  t.check('etiquetas: tu punto debajo de la sede → el nombre va encima', !!yoAbajo && etiquetaSedeArriba(yoAbajo) === true)
  const alEste = planCroquis({ yo: YO, sedes: [{ id: 'este', nombre: 'Al este', lat: 11.0121, lng: -74.8655 }], foco: 'este', radioM: 60, ...caja })
  t.check('etiquetas: la sede a tu derecha → "Estás aquí" va a tu izquierda', !!alEste && etiquetaYoALaIzquierda(alEste, caja.ancho) === true)
  // "Estás aquí · ±12 m" (revisión 2026-10-15): antes iba siempre a un lado de tu punto y, llegando de lejos (tu punto
  // cerca del borde), se salía del croquis o tapaba el logotipo de Hoy.
  const ANCHO_YO = 140
  const LOGO_HOY = { x: 16, y: 8, ancho: 106, alto: 40 }
  const cosLat = Math.cos((PORTO.lat * Math.PI) / 180)
  const aMetros = (este: number, norte: number) => ({ lat: PORTO.lat + norte / 111_320, lng: PORTO.lng + este / (111_320 * cosLat), precision: 12 })
  const cajaYo = (p: { x: number; y: number }, w = ANCHO_YO) => ({ x: p.x, y: p.y, ancho: w, alto: ALTO_ETIQUETA_CROQUIS })
  const tapan = (a: CajaCroquis, b: CajaCroquis | null) => !!b && Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y) > 2
  for (const [donde, este, norte] of [
    ['400 m al este', 400, 0],
    ['400 m al oeste', -400, 0],
    ['150 m al este', 150, 0],
  ] as const) {
    const lejosPlan = planCroquis({ yo: aMetros(este, norte), sedes: [PORTO], foco: 'porto', radioM: 100, ...caja })
    const p = lejosPlan ? posicionEtiquetaYo(lejosPlan, { ...caja, anchoEtiqueta: ANCHO_YO }) : null
    const marcaSede = lejosPlan?.sedes[0] ? { x: lejosPlan.sedes[0].x - 7, y: lejosPlan.sedes[0].y - 7, ancho: 14, alto: 14 } : null
    const punto = lejosPlan?.yo ? { x: lejosPlan.yo.x - 8, y: lejosPlan.yo.y - 8, ancho: 16, alto: 16 } : null
    t.check(
      `"Estás aquí" a ${donde} de la sede (fuera del radio): entera dentro del croquis y sin tapar tu punto ni la sede`,
      !!p && p.x >= BORDE_ETIQUETA && p.x + ANCHO_YO <= caja.ancho - BORDE_ETIQUETA && p.y >= 0 && p.y + ALTO_ETIQUETA_CROQUIS <= caja.alto && !tapan(cajaYo(p), marcaSede) && !tapan(cajaYo(p), punto),
      { p, yo: lejosPlan?.yo }
    )
  }
  const normal = planCroquis({ yo: aMetros(0, 55), sedes: [PORTO], foco: 'porto', radioM: 100, ...caja })
  const pNormal = normal?.yo ? posicionEtiquetaYo(normal, { ...caja, anchoEtiqueta: ANCHO_YO, evitar: [LOGO_HOY, cajaNombreSede(normal, caja.ancho, ANCHO_YO)] }) : null
  t.check('"Estás aquí" donde cabe, como siempre: a la derecha de tu punto (16 pt) y a su altura', !!pNormal && !!normal?.yo && pNormal.x === normal.yo.x + 16 && pNormal.y === normal.yo.y - ALTO_ETIQUETA_CROQUIS / 2, { pNormal, yo: normal?.yo })
  const noroeste = planCroquis({ yo: aMetros(-50, 87), sedes: [PORTO], foco: 'porto', radioM: 100, ...caja })
  const pNoroeste = noroeste ? posicionEtiquetaYo(noroeste, { ...caja, anchoEtiqueta: ANCHO_YO, evitar: [LOGO_HOY, cajaNombreSede(noroeste, caja.ancho, ANCHO_YO)] }) : null
  t.check('"Estás aquí" a 100 m al noroeste de la sede (en Hoy, junto al logotipo): no tapa el logotipo', !!pNoroeste && !tapan(cajaYo(pNoroeste), LOGO_HOY), { pNoroeste, yo: noroeste?.yo })
  // Barrido: tu punto en 24 direcciones y a 0–2.900 m de la sede, en teléfonos de 360, 390 y 430 de ancho y con el
  // croquis de 170 y el bajo (120): la etiqueta siempre entera dentro; con el de 170, y si tu punto no está debajo del
  // logotipo ni encima de la sede, tampoco tapa el logotipo ni el nombre de la sede.
  const salidas: unknown[] = []
  const tapados: unknown[] = []
  for (const anchoTel of [360, 390, 430])
    for (const altoCroq of [ALTO_CROQUIS_BAJO, ALTO_CROQUIS])
      for (const w of [120, ANCHO_YO])
        for (const metros of [0, 20, 55, 100, 150, 250, 400, 700, 1200, 2000, 2900])
          for (let grados = 0; grados < 360; grados += 15) {
            const medida = { ancho: anchoTel, alto: altoCroq }
            const barrido = planCroquis({ yo: aMetros(metros * Math.cos((grados * Math.PI) / 180), metros * Math.sin((grados * Math.PI) / 180)), sedes: [PORTO], foco: 'porto', radioM: 100, ...medida })
            if (!barrido?.yo) continue
            const nombreSede = cajaNombreSede(barrido, anchoTel, ANCHO_YO)
            const p = posicionEtiquetaYo(barrido, { ...medida, anchoEtiqueta: w, evitar: [LOGO_HOY, nombreSede] })
            const caso = { anchoTel, altoCroq, w, metros, grados, p }
            if (!p || p.x < BORDE_ETIQUETA || p.x + w > anchoTel - BORDE_ETIQUETA || p.y < 0 || p.y + ALTO_ETIQUETA_CROQUIS > altoCroq) salidas.push(caso)
            const { x, y } = barrido.yo
            const sede = barrido.sedes[0]
            const libre = !(x > LOGO_HOY.x - 8 && x < LOGO_HOY.x + LOGO_HOY.ancho + 8 && y < LOGO_HOY.y + LOGO_HOY.alto + 8) && Math.hypot(x - sede.x, y - sede.y) >= 24
            if (p && altoCroq === ALTO_CROQUIS && libre && (tapan(cajaYo(p, w), LOGO_HOY) || tapan(cajaYo(p, w), nombreSede))) tapados.push(caso)
          }
  t.check('"Estás aquí" (barrido de 3.168 posiciones): siempre entera dentro del croquis', salidas.length === 0, salidas.slice(0, 5))
  t.check('"Estás aquí" (barrido, croquis de 170): no tapa el logotipo ni el nombre de la sede si tu punto no está debajo de ellos', tapados.length === 0, tapados.slice(0, 5))
  t.check(
    'Croquis.tsx usa posicionEtiquetaYo (con el logotipo y el nombre de la sede medidos) y mueve la etiqueta con translateX, no con left/right según el lado',
    /posicionEtiquetaYo\(plan, \{ ancho, alto, anchoEtiqueta: anchoYo \?\? anchoEstimado\(etiquetaYo\), evitar: \[cajaLogo, cajaNombreSede\(/.test(croquisTsx) && /transform: \[\{ translateX: posicionYo\.x \}\]/.test(croquisTsx) && !/ancho - plan\.yo\.x \+ 16/.test(croquisTsx)
  )
  t.check('croquis: 170 pt de alto; 120 en pantallas de menos de 700 pt (iPhone SE u 8: 667)', altoCroquis(844) === 170 && altoCroquis(700) === 170 && altoCroquis(667) === 120 && altoCroquis(0) === 170)
  t.check('Reportar no agranda el croquis al elegir (el alto lo da altoCroquis): "Hablar" y "Por toques" a la vista', !/alto=\{eligio/.test(leer('app/(app)/reportar.tsx')) && /const alto = altoPedido \?\? altoCroquis\(altoVentana\)/.test(croquisTsx))
  t.check(
    'lector de pantalla: "Croquis: estás a 56 m de Clínica Portoazul, dentro del radio"; sin nada, "sin ubicación"',
    descripcionCroquis(plan, textoDistancia) === `Croquis: estás a ${textoDistancia(haversineM(YO, PORTO))} de Clínica Portoazul, dentro del radio` && descripcionCroquis(null, textoDistancia) === 'Croquis: sin ubicación',
    descripcionCroquis(plan, textoDistancia)
  )

  // Sin Google: el croquis no usa mapas de pago ni llaves (Distance Matrix y Maps cuestan; CLAUDE.md).
  const conGoogle = fuentes().filter(ruta => /react-native-maps|PROVIDER_GOOGLE|maps\.googleapis|googleMapsApiKey/.test(readFileSync(ruta, 'utf8')))
  const paquete = JSON.parse(leer('package.json')) as { dependencies: Record<string, string> }
  t.check('sin Google ni react-native-maps en la app (el croquis se dibuja con vistas)', conGoogle.length === 0 && !('react-native-maps' in paquete.dependencies), conGoogle)
  t.check('Hoy y Reportar pintan el croquis y la hoja', /<Croquis\b/.test(leer('app/(app)/hoy.tsx')) && /<BordeHoja \/>/.test(leer('app/(app)/hoy.tsx')) && /<Croquis\b/.test(leer('app/(app)/reportar.tsx')) && /<BordeHoja \/>/.test(leer('app/(app)/reportar.tsx')))
}
