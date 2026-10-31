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
  /** Lo que va encima del croquis (el logotipo de Hoy, la pastilla de rango): tu punto al borde no se mete debajo. */
  evitar?: readonly (CajaCroquis | null)[]
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
  /**
   * Tu punto. `enBorde`: la sede pedida queda más lejos de lo que cabe, así que el croquis se centró en ella y tu
   * punto va pegado al borde, en la dirección en que estás (dueño, 2026-10-31: la sede de la cita manda, no la más
   * cercana a tu casa).
   */
  yo: { x: number; y: number; halo: number; enBorde: boolean } | null
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
/** A cuánto del borde se pega tu punto cuando la sede pedida queda lejos (pt; el punto mide 16 y su halo 14 de radio). */
export const BORDE_YO_LEJOS = 22
/** Alto del croquis (pt, debajo de la hora y la batería) y el que lleva en pantallas de menos de 700 pt de alto. */
export const ALTO_CROQUIS = 170
export const ALTO_CROQUIS_BAJO = 120
export const PANTALLA_BAJA = 700

/**
 * Alto del croquis según el alto de la ventana. Revisión 2026-10-15: en un teléfono bajo (iPhone SE u 8, 667 pt) el
 * croquis de 170 empujaba fuera de la vista lo que sigue (en Reportar, "Por toques" después de elegir la cita).
 */
export function altoCroquis(altoVentana: number): number {
  return Number.isFinite(altoVentana) && altoVentana > 0 && altoVentana < PANTALLA_BAJA ? ALTO_CROQUIS_BAJO : ALTO_CROQUIS
}

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

/** Márgenes de cada lado (pt). */
export interface Margenes {
  arriba: number
  abajo: number
  izquierda: number
  derecha: number
}

/**
 * Donde la recta del centro `desde` hacia `hacia` corta el rectángulo que dejan los márgenes (un número: el mismo en
 * los cuatro lados). Si `hacia` ya está dentro, devuelve `hacia`.
 */
export function puntoAlBorde(desde: { x: number; y: number }, hacia: { x: number; y: number }, medidas: { ancho: number; alto: number; margen: number | Margenes }): { x: number; y: number } {
  const { ancho, alto } = medidas
  const m: Margenes = typeof medidas.margen === 'number' ? { arriba: medidas.margen, abajo: medidas.margen, izquierda: medidas.margen, derecha: medidas.margen } : medidas.margen
  const dx = hacia.x - desde.x
  const dy = hacia.y - desde.y
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return { x: desde.x, y: Math.max(m.arriba, Math.min(alto - m.abajo, desde.y)) }
  const tx = dx > 0 ? (ancho - m.derecha - desde.x) / dx : dx < 0 ? (m.izquierda - desde.x) / dx : Infinity
  const ty = dy > 0 ? (alto - m.abajo - desde.y) / dy : dy < 0 ? (m.arriba - desde.y) / dy : Infinity
  const t = Math.max(0, Math.min(1, tx, ty))
  return { x: desde.x + dx * t, y: desde.y + dy * t }
}


/**
 * Dónde va cada cosa. Centro y escala: lo que entra es tu punto (con su precisión) y el círculo del radio de la sede
 * del foco; el lado corto ve entre `minimoM` y `maximoM`. Sin tu punto, se centra en la sede del foco; sin nada con
 * coordenadas, null (no hay croquis que dibujar).
 *
 * La sede PEDIDA manda (dueño, 2026-10-31: "me voy a reportar OINSAMED y sale Portoazul porque vivo cerca de
 * Portoazul"): si está entre las ubicadas es el foco aunque quede lejos; si a la escala máxima tu punto no cabe en el
 * dibujo (revisor 2026-10-31: por si cabe, no por los metros; en vertical caben menos), el croquis se centra en ella con
 * su radio y tu punto se pega al borde (`yo.enBorde`), sin meterse debajo de lo que va encima (`evitar`). Si se pidió
 * una sede que no tiene coordenadas, no hay foco (nada de dibujar el radio de otra). Solo sin sede pedida el foco es la
 * más cercana a ti, si se ve.
 */
export function planCroquis(entrada: EntradaCroquis): PlanCroquis | null {
  const { ancho, alto } = entrada
  if (!(ancho > 0) || !(alto > 0)) return null
  const normal = armarCroquis(entrada, false)
  if (!normal) return null
  // Con la sede pedida y tu punto fuera del dibujo (o casi), se vuelve a armar centrado en la sede, contigo al borde.
  const cabe = (p: { x: number; y: number }) => p.x >= BORDE_YO_LEJOS && p.x <= ancho - BORDE_YO_LEJOS && p.y >= BORDE_YO_LEJOS && p.y <= alto - BORDE_YO_LEJOS
  if (entrada.foco && normal.foco && normal.yo && !cabe(normal.yo)) return armarCroquis(entrada, true)
  return normal
}

function armarCroquis(entrada: EntradaCroquis, lejos: boolean): PlanCroquis | null {
  const { ancho, alto } = entrada
  const margen = entrada.margen ?? MARGEN_CROQUIS
  const minimoM = entrada.minimoM ?? MINIMO_CROQUIS_M
  const maximoM = entrada.maximoM ?? MAXIMO_CROQUIS_M
  const radioM = typeof entrada.radioM === 'number' && Number.isFinite(entrada.radioM) && entrada.radioM > 0 ? entrada.radioM : null
  const yo = entrada.yo && esPunto(entrada.yo.lat, entrada.yo.lng) ? entrada.yo : null
  // Una sola vez cada sede (la de una cita puede venir también entre las cercanas).
  const ubicadas = entrada.sedes.filter(conCoordenadas).filter((sede, i, todas) => todas.findIndex(otra => otra.id === sede.id) === i)
  const pedida = entrada.foco ? (ubicadas.find(s => s.id === entrada.foco) ?? null) : null
  const cercana = yo && ubicadas.length > 0 ? [...ubicadas].sort((a, b) => haversineM(yo, a) - haversineM(yo, b))[0] : null
  const seVe = (sede: Punto) => !yo || haversineM(yo, sede) <= maximoM
  // La pedida siempre; sin pedida, la más cercana a ti si queda dentro de lo que se ve (sin tu punto, siempre).
  const foco = entrada.foco ? pedida : cercana && seVe(cercana) ? cercana : null
  if (lejos && (!yo || !foco)) return null
  const origen: Punto | null = lejos ? foco : (yo ?? foco ?? null)
  if (!origen) return null
  const yoM = yo ? metrosDesde(origen, yo) : null

  // Caja (en metros desde el origen) de lo que tiene que entrar (tu punto no, cuando va al borde).
  const cajas: { x0: number; x1: number; y0: number; y1: number }[] = []
  if (yoM && !lejos) {
    const p = Math.max(10, Number.isFinite(yo?.precision ?? NaN) ? (yo?.precision as number) : 10)
    cajas.push({ x0: yoM.x - p, x1: yoM.x + p, y0: yoM.y - p, y1: yoM.y + p })
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

  const planFoco = foco ? aPantalla(metrosDesde(origen, foco)) : null
  const planYo =
    yo && yoM
      ? (() => {
          const p = aPantalla(yoM)
          const precision = Number.isFinite(yo.precision ?? NaN) ? (yo.precision as number) : 0
          const halo = Math.max(HALO_MINIMO, precision / metrosPorPunto)
          if (lejos && planFoco) {
            const cajas = (entrada.evitar ?? []).filter((c): c is CajaCroquis => c !== null)
            let borde = puntoAlBorde(planFoco, p, { ancho, alto, margen: BORDE_YO_LEJOS })
            // Debajo del logotipo o de la pastilla no: se baja el margen de arriba hasta debajo de lo que tape.
            if (puntoTapado(borde, cajas)) {
              const arriba = Math.max(...cajas.map(c => c.y + c.alto)) + 8 + BORDE_YO_LEJOS
              borde = puntoAlBorde(planFoco, p, { ancho, alto, margen: { arriba: Math.min(arriba, alto - BORDE_YO_LEJOS), abajo: BORDE_YO_LEJOS, izquierda: BORDE_YO_LEJOS, derecha: BORDE_YO_LEJOS } })
            }
            return { x: borde.x, y: borde.y, halo: HALO_MINIMO, enBorde: true }
          }
          return { x: p.x, y: p.y, halo, enBorde: false }
        })()
      : null
  const distanciaM = foco && yo ? haversineM(yo, foco) : null

  return {
    metrosPorPunto,
    yo: planYo,
    sedes: recortadas,
    radio: planFoco && radioM ? { x: planFoco.x, y: planFoco.y, r: radioM / metrosPorPunto } : null,
    foco: foco ? { id: foco.id, nombre: foco.nombre, distanciaM, dentro: distanciaM !== null && radioM !== null ? distanciaM <= radioM : null } : null,
  }
}

/**
 * Lo que dice la etiqueta de tu punto: la que pasó la pantalla ("Estás aquí · ±12 m") o, con tu punto pegado al borde
 * porque la sede pedida queda lejos, "Estás a 4,8 km" (la distancia real a esa sede).
 */
export function etiquetaYoDelPlan(plan: PlanCroquis | null, etiqueta: string | null, textoDistancia: (m: number) => string): string | null {
  if (plan?.yo?.enBorde && plan.foco && plan.foco.distanciaM !== null) return `Estás a ${textoDistancia(plan.foco.distanciaM)}`
  return etiqueta
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
/** Lo que deja libre una etiqueta en los bordes del croquis (pt). */
export const BORDE_ETIQUETA = 8
/** Ancho de la caja donde va centrado el nombre de la sede del foco (la pastilla mide como mucho eso). */
export const ANCHO_NOMBRE_SEDE = 180
/** De tu punto al borde de "Estás aquí" cuando va a un lado (el punto mide 16 pt). */
const LADO_ETIQUETA_YO = 16

/** Un rectángulo en pt del croquis (sin el área segura de arriba). */
export interface CajaCroquis {
  x: number
  y: number
  ancho: number
  alto: number
}

const entre = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), Math.max(minimo, maximo))
/** Lo que se tapan dos cajas (pt²). Rozarse hasta TOLERANCIA_ROCE pt (la sombra de una contra el borde de la otra) no cuenta. */
const TOLERANCIA_ROCE = 2
const solape = (a: CajaCroquis, b: CajaCroquis) =>
  Math.max(0, Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x) - TOLERANCIA_ROCE) *
  Math.max(0, Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y) - TOLERANCIA_ROCE)

/** ¿Tu punto (16 pt más `aire`) en `p` se mete en alguna de las cajas? */
function puntoTapado(p: { x: number; y: number }, cajas: readonly CajaCroquis[], aire = 4): boolean {
  const mio: CajaCroquis = { x: p.x - 8 - aire, y: p.y - 8 - aire, ancho: 16 + 2 * aire, alto: 16 + 2 * aire }
  return cajas.some(caja => solape(mio, caja) > 0)
}

/** Borde izquierdo de la caja (de ANCHO_NOMBRE_SEDE) donde va centrado el nombre de una sede en `x`: no se sale. */
export function izquierdaNombreSede(x: number, ancho: number): number {
  return entre(x - ANCHO_NOMBRE_SEDE / 2, BORDE_ETIQUETA, ancho - ANCHO_NOMBRE_SEDE - BORDE_ETIQUETA)
}

/**
 * Dónde queda la pastilla con el nombre de la sede del foco (de `anchoPastilla`, centrada en su caja); null sin foco.
 * `evitar`: lo que va encima del croquis (logotipo, pastilla de rango), para mandar el nombre debajo si arriba choca.
 */
export function cajaNombreSede(plan: PlanCroquis, ancho: number, anchoPastilla = ANCHO_NOMBRE_SEDE, evitar: readonly (CajaCroquis | null)[] = []): CajaCroquis | null {
  const foco = plan.sedes.find(s => s.foco)
  if (!foco) return null
  const w = Math.min(anchoPastilla, ANCHO_NOMBRE_SEDE)
  const centro = izquierdaNombreSede(foco.x, ancho) + ANCHO_NOMBRE_SEDE / 2
  const y = etiquetaSedeArriba(plan, w, evitar, ancho) ? foco.y - SEPARACION_ETIQUETA - ALTO_ETIQUETA_CROQUIS : foco.y + SEPARACION_ETIQUETA
  return { x: centro - w / 2, y, ancho: w, alto: ALTO_ETIQUETA_CROQUIS }
}

/**
 * Dónde va "Estás aquí · ±12 m" (esquina de arriba a la izquierda, en pt del croquis). Revisión 2026-10-15: antes iba
 * siempre a un lado de tu punto y, como el encuadre te deja cerca del borde cuando la sede está lejos, se salía del
 * croquis. Ahora prueba, en orden, al lado que no tapa la sede (etiquetaYoALaIzquierda), al otro lado, encima, debajo
 * y en diagonal, cada una metida en el croquis (a BORDE_ETIQUETA de los lados); se queda con la primera que no tapa tu
 * punto, la marca de la sede (con 4 pt de aire) ni lo de `evitar` (el logotipo de Hoy, el nombre de la sede) y, si
 * todas tapan algo (tu punto debajo del logotipo), con la que menos tapa.
 */
export function posicionEtiquetaYo(
  plan: PlanCroquis,
  medidas: { ancho: number; alto: number; anchoEtiqueta: number; evitar?: readonly (CajaCroquis | null)[] }
): { x: number; y: number } | null {
  const yo = plan.yo
  if (!yo) return null
  const { ancho, alto } = medidas
  const w = Math.min(medidas.anchoEtiqueta, ancho - 2 * BORDE_ETIQUETA)
  const h = ALTO_ETIQUETA_CROQUIS
  const foco = plan.sedes.find(s => s.foco)
  // Tu punto (16 pt) y la marca de la sede (14 pt); con `aire`, 4 pt más alrededor para que la etiqueta no se les pegue.
  const evitar = (aire: number): CajaCroquis[] => [
    ...(medidas.evitar ?? []).filter((c): c is CajaCroquis => c !== null),
    { x: yo.x - 8 - aire, y: yo.y - 8 - aire, ancho: 16 + 2 * aire, alto: 16 + 2 * aire },
    ...(foco ? [{ x: foco.x - 7 - aire, y: foco.y - 7 - aire, ancho: 14 + 2 * aire, alto: 14 + 2 * aire }] : []),
  ]
  const conAire = evitar(4)
  const justo = evitar(0)
  const izquierda = { x: yo.x - LADO_ETIQUETA_YO - w, y: yo.y - h / 2 }
  const derecha = { x: yo.x + LADO_ETIQUETA_YO, y: yo.y - h / 2 }
  const opciones = [
    ...(etiquetaYoALaIzquierda(plan, ancho) ? [izquierda, derecha] : [derecha, izquierda]),
    { x: yo.x - w / 2, y: yo.y - SEPARACION_ETIQUETA - h },
    { x: yo.x - w / 2, y: yo.y + SEPARACION_ETIQUETA },
    // En diagonal (en un croquis bajo, con el logotipo y el nombre de la sede cerca, a veces es lo único libre).
    { x: derecha.x - 6, y: yo.y - 8 - h },
    { x: izquierda.x + 6, y: yo.y - 8 - h },
    { x: derecha.x - 6, y: yo.y + 8 },
    { x: izquierda.x + 6, y: yo.y + 8 },
  ].map(p => ({ x: entre(p.x, BORDE_ETIQUETA, ancho - BORDE_ETIQUETA - w), y: entre(p.y, 0, alto - h) }))
  const tapa = (p: { x: number; y: number }, cajas: CajaCroquis[]) => cajas.reduce((total, caja) => total + solape({ x: p.x, y: p.y, ancho: w, alto: h }, caja), 0)
  // La primera que no tapa nada (con aire; si no hay, sin él); si todas tapan algo, la que menos (en un empate, la que
  // va antes).
  return opciones.find(p => tapa(p, conAire) === 0) ?? opciones.reduce((mejor, p) => (tapa(p, justo) < tapa(mejor, justo) ? p : mejor))
}

/**
 * ¿El nombre de la sede del foco va encima de su marca o debajo? Encima, salvo que ahí tape tu punto, se salga por
 * arriba o choque con lo que va encima del croquis (`evitar`: el logotipo de Hoy, la pastilla de rango; revisor
 * 2026-10-31: en el croquis de 120 pt la pastilla tapaba el nombre de la sede centrada); entonces debajo.
 */
export function etiquetaSedeArriba(plan: PlanCroquis, anchoEtiqueta = 180, evitar: readonly (CajaCroquis | null)[] = [], ancho?: number): boolean {
  const foco = plan.sedes.find(s => s.foco)
  if (!foco) return true
  const arriba = { y0: foco.y - SEPARACION_ETIQUETA - ALTO_ETIQUETA_CROQUIS - 6, y1: foco.y - 6 }
  if (arriba.y0 < 0) return false
  if (ancho !== undefined) {
    const w = Math.min(anchoEtiqueta, ANCHO_NOMBRE_SEDE)
    const centro = izquierdaNombreSede(foco.x, ancho) + ANCHO_NOMBRE_SEDE / 2
    const caja: CajaCroquis = { x: centro - w / 2, y: foco.y - SEPARACION_ETIQUETA - ALTO_ETIQUETA_CROQUIS, ancho: w, alto: ALTO_ETIQUETA_CROQUIS }
    if (evitar.some(c => c !== null && solape(caja, c) > 0)) return false
  }
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
