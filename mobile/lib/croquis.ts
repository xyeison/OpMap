/**
 * Croquis de Hoy y Reportar (estilo Uber, 2026-10-15; puro, sin react-native: lo prueba scripts/checks/20-estilo.ts).
 *
 * No es un mapa de calles: no usa Google ni ninguna llave, y funciona igual en Expo Go, en el teléfono compilado y en
 * el navegador. Pone A ESCALA lo que la app ya sabe: tu punto (con su precisión), las sedes cercanas que mandó el
 * servidor (con sus coordenadas) y el radio presencial alrededor de la sede que importa (la de la cita elegida o la
 * siguiente, o la más cercana). Las manzanas del fondo son decorativas (components/Croquis.tsx).
 *
 * Proyección local equirectangular alrededor del centro: a menos de unos km el error es despreciable para dibujar.
 */
import { RADIO_TIERRA_M, esPunto, haversineM, type Punto } from './geo'

export interface SedeCroquis {
  id: string
  nombre: string
  lat: number | null
  lng: number | null
}

export interface EntradaCroquis {
  /** Tu punto (null si el teléfono no dio la ubicación). */
  yo: (Punto & { precision?: number | null }) | null
  sedes: readonly SedeCroquis[]
  /** La sede que importa: se dibuja con su radio. Si no está o no tiene coordenadas, la más cercana a ti. */
  foco: string | null
  /** Radio presencial vigente (m). */
  radioM: number | null
  /** Tamaño del croquis en pt. */
  ancho: number
  alto: number
  /** Espacio libre en los bordes (pt). */
  margen?: number
  /** Lo menos que se ve en el lado corto (m): ni tan cerca que todo se amontone en tu punto. */
  minimoM?: number
  /** Lo más que se ve en el lado corto (m): una sede lejana no se dibuja (se queda la tuya y su radio). */
  maximoM?: number
}

export interface MarcaSede {
  id: string
  nombre: string
  x: number
  y: number
  foco: boolean
}

export interface PlanCroquis {
  /** Metros que vale un punto (pt) del croquis. */
  metrosPorPunto: number
  yo: { x: number; y: number; halo: number } | null
  /** Sedes dentro del croquis (la del foco siempre, si tiene coordenadas). */
  sedes: MarcaSede[]
  /** El radio presencial alrededor de la sede del foco. */
  radio: { x: number; y: number; r: number } | null
  /** La sede del foco (con coordenadas) y tu distancia a ella; null si falta alguna de las dos. */
  foco: { id: string; nombre: string; distanciaM: number | null; dentro: boolean | null } | null
}

export const MARGEN_CROQUIS = 28
export const MINIMO_CROQUIS_M = 180
export const MAXIMO_CROQUIS_M = 3000
/** Lo que mide como mínimo el halo de tu punto (pt), aunque la precisión sea muy buena. */
export const HALO_MINIMO = 14
/** Sedes que se dibujan como mucho (además de la del foco). */
export const MAX_SEDES_CROQUIS = 12

const rad = (grados: number) => (grados * Math.PI) / 180

/** Metros al este (x) y al norte (y) de `punto` desde `origen`. */
export function metrosDesde(origen: Punto, punto: Punto): { x: number; y: number } {
  return {
    x: rad(punto.lng - origen.lng) * Math.cos(rad(origen.lat)) * RADIO_TIERRA_M,
    y: rad(punto.lat - origen.lat) * RADIO_TIERRA_M,
  }
}

function conCoordenadas(sede: SedeCroquis): sede is SedeCroquis & Punto {
  return esPunto(sede.lat, sede.lng)
}

/**
 * Dónde va cada cosa. Centro y escala: lo que entra es tu punto (con su precisión) y el círculo del radio de la sede
 * del foco; el lado corto ve entre `minimoM` y `maximoM`. Sin tu punto, se centra en la sede del foco; sin nada con
 * coordenadas, null (no hay croquis que dibujar).
 */
export function planCroquis(entrada: EntradaCroquis): PlanCroquis | null {
  const { ancho, alto } = entrada
  if (!(ancho > 0) || !(alto > 0)) return null
  const margen = entrada.margen ?? MARGEN_CROQUIS
  const minimoM = entrada.minimoM ?? MINIMO_CROQUIS_M
  const maximoM = entrada.maximoM ?? MAXIMO_CROQUIS_M
  const radioM = typeof entrada.radioM === 'number' && Number.isFinite(entrada.radioM) && entrada.radioM > 0 ? entrada.radioM : null
  const yo = entrada.yo && esPunto(entrada.yo.lat, entrada.yo.lng) ? entrada.yo : null
  // Una sola vez cada sede (la de una cita puede venir también entre las cercanas).
  const ubicadas = entrada.sedes.filter(conCoordenadas).filter((sede, i, todas) => todas.findIndex(otra => otra.id === sede.id) === i)
  const pedida = entrada.foco ? (ubicadas.find(s => s.id === entrada.foco) ?? null) : null
  const cercana = yo && ubicadas.length > 0 ? [...ubicadas].sort((a, b) => haversineM(yo, a) - haversineM(yo, b))[0] : null
  // La pedida si queda dentro de lo que se ve (sin tu punto, siempre); si no, la más cercana a ti, con la misma condición.
  const seVe = (sede: Punto) => !yo || haversineM(yo, sede) <= maximoM
  const foco = pedida && seVe(pedida) ? pedida : cercana && seVe(cercana) ? cercana : null
  const origen: Punto | null = yo ?? foco ?? null
  if (!origen) return null

  // Caja (en metros desde el origen) de lo que tiene que entrar.
  const cajas: { x0: number; x1: number; y0: number; y1: number }[] = []
  if (yo) {
    const p = Math.max(10, Number.isFinite(yo.precision ?? NaN) ? (yo.precision as number) : 10)
    cajas.push({ x0: -p, x1: p, y0: -p, y1: p })
  }
  if (foco) {
    const f = metrosDesde(origen, foco)
    const r = radioM ?? 30
    cajas.push({ x0: f.x - r, x1: f.x + r, y0: f.y - r, y1: f.y + r })
  }
  const x0 = Math.min(...cajas.map(c => c.x0))
  const x1 = Math.max(...cajas.map(c => c.x1))
  const y0 = Math.min(...cajas.map(c => c.y0))
  const y1 = Math.max(...cajas.map(c => c.y1))
  const centro = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
  const utilAncho = Math.max(1, ancho - 2 * margen)
  const utilAlto = Math.max(1, alto - 2 * margen)
  const lado = Math.min(ancho, alto)
  let metrosPorPunto = Math.max((x1 - x0) / utilAncho, (y1 - y0) / utilAlto)
  metrosPorPunto = Math.max(metrosPorPunto, minimoM / lado)
  metrosPorPunto = Math.min(metrosPorPunto, maximoM / lado)

  const aPantalla = (m: { x: number; y: number }) => ({ x: ancho / 2 + (m.x - centro.x) / metrosPorPunto, y: alto / 2 - (m.y - centro.y) / metrosPorPunto })
  const dentroDelCuadro = (p: { x: number; y: number }) => p.x >= 8 && p.x <= ancho - 8 && p.y >= 8 && p.y <= alto - 8

  const sedes: MarcaSede[] = []
  for (const sede of ubicadas) {
    const p = aPantalla(metrosDesde(origen, sede))
    const esFoco = !!foco && sede.id === foco.id
    if (esFoco || dentroDelCuadro(p)) sedes.push({ id: sede.id, nombre: sede.nombre, x: p.x, y: p.y, foco: esFoco })
  }
  // La del foco primero; las demás por cercanía al centro, hasta MAX_SEDES_CROQUIS.
  sedes.sort((a, b) => Number(b.foco) - Number(a.foco) || Math.hypot(a.x - ancho / 2, a.y - alto / 2) - Math.hypot(b.x - ancho / 2, b.y - alto / 2))
  const recortadas = sedes.slice(0, MAX_SEDES_CROQUIS + (foco ? 1 : 0))

  const planYo = yo
    ? (() => {
        const p = aPantalla({ x: 0, y: 0 })
        const precision = Number.isFinite(yo.precision ?? NaN) ? (yo.precision as number) : 0
        return { x: p.x, y: p.y, halo: Math.max(HALO_MINIMO, precision / metrosPorPunto) }
      })()
    : null
  const planFoco = foco ? aPantalla(metrosDesde(origen, foco)) : null
  const distanciaM = foco && yo ? haversineM(yo, foco) : null

  return {
    metrosPorPunto,
    yo: planYo,
    sedes: recortadas,
    radio: planFoco && radioM ? { x: planFoco.x, y: planFoco.y, r: radioM / metrosPorPunto } : null,
    foco: foco ? { id: foco.id, nombre: foco.nombre, distanciaM, dentro: distanciaM !== null && radioM !== null ? distanciaM <= radioM : null } : null,
  }
}

/** ¿La etiqueta "Estás aquí" va a la izquierda de tu punto? Sí si la sede del foco queda a tu derecha (no se tapan). */
export function etiquetaYoALaIzquierda(plan: PlanCroquis, ancho: number): boolean {
  if (!plan.yo) return false
  const foco = plan.sedes.find(s => s.foco)
  if (foco && Math.abs(foco.x - plan.yo.x) > 4) return foco.x > plan.yo.x
  return plan.yo.x > ancho / 2
}

/** Alto de las etiquetas del croquis (pt) y lo que se separan de su marca. */
export const ALTO_ETIQUETA_CROQUIS = 28
export const SEPARACION_ETIQUETA = 12

/**
 * ¿El nombre de la sede del foco va encima de su marca o debajo? Encima, salvo que ahí tape tu punto (o se salga por
 * arriba); entonces debajo.
 */
export function etiquetaSedeArriba(plan: PlanCroquis, anchoEtiqueta = 180): boolean {
  const foco = plan.sedes.find(s => s.foco)
  if (!foco) return true
  const arriba = { y0: foco.y - SEPARACION_ETIQUETA - ALTO_ETIQUETA_CROQUIS - 6, y1: foco.y - 6 }
  if (arriba.y0 < 0) return false
  if (!plan.yo) return true
  const tapaTuPunto = Math.abs(plan.yo.x - foco.x) < anchoEtiqueta / 2 + 10 && plan.yo.y + 10 > arriba.y0 && plan.yo.y - 10 < arriba.y1
  return !tapaTuPunto
}

/** Lo que dice el croquis a quien no lo ve (lector de pantalla). */
export function descripcionCroquis(plan: PlanCroquis | null, textoDistancia: (m: number) => string): string {
  if (!plan) return 'Croquis: sin ubicación'
  if (plan.foco && plan.foco.distanciaM !== null) {
    const estado = plan.foco.dentro === true ? ', dentro del radio' : plan.foco.dentro === false ? ', fuera del radio' : ''
    return `Croquis: estás a ${textoDistancia(plan.foco.distanciaM)} de ${plan.foco.nombre}${estado}`
  }
  if (plan.foco) return `Croquis: ${plan.foco.nombre}`
  return plan.yo ? 'Croquis: tu ubicación' : 'Croquis: sin ubicación'
}
