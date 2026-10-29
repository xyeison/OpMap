// Visitas de VMO para el mapa de calor: puente temporal mientras la app de visita reemplaza a VMO (dueño, 2026-10-29,
// docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md). El navegador lee la exportación de VMO › Visitas ("General |
// Visitas", Excel) y se queda solo con lo que pinta el mapa: las visitas hechas ("Visita realizada" y "Visita extra", la
// que VMO deja registrar con el ciclo completo) con coordenadas, por Ejecutivo Comercial. Nada más del archivo (médicos,
// cédulas, teléfonos, comentarios, productos) llega al servidor. Llaves con VMO: el ID de la visita (visits.vmo_id:
// importar dos veces no duplica) y el nombre del Ejecutivo Comercial como lo escribe VMO, normalizado
// (executives.vmo_nombre). Puro (sin red): lo usan la página /visits y POST /api/visits/import.
// Pruebas: scripts/vmo-visitas-check.ts.
import { LIMITES_COLOMBIA } from './terceros-schemas'

/** Encabezados de la exportación de VMO › Visitas que se leen; el resto del archivo se ignora. */
export const COLUMNAS_VMO = {
  id: 'ID',
  comercial: 'Representante',
  fecha: 'Fecha de la visita',
  tipo: 'Tipo de visitas',
  contacto: 'Tipo de contacto',
  lat: 'Latitud',
  lng: 'Longitud',
} as const

/** Lo único que se guarda de cada visita. */
export interface VisitaVmo {
  vmo_id: number
  /** Nombre del Ejecutivo Comercial como lo escribe VMO, sin espacios de sobra. */
  comercial: string
  /** AAAA-MM-DD */
  fecha: string
  lat: number
  lng: number
  presencial: boolean
  /** "Visita extra" de VMO (hecha con el ciclo completo); si no, "Visita realizada". */
  extra: boolean
}

/** Un Ejecutivo Comercial del archivo, con la fecha de su última visita en TODO el archivo (decide si queda activo). */
export interface ComercialVmo {
  nombre: string
  ultima: string
}

export interface LecturaVmo {
  filas: number
  visitas: VisitaVmo[]
  descartadas: { noRealizadas: number; sinCoordenadas: number; sinFecha: number; sinComercial: number; sinId: number; repetidas: number }
  /** AAAA-MM → visitas que se importan */
  porMes: Record<string, number>
}

/** Visitas por petición a POST /api/visits/import (la página parte el archivo en lotes). */
export const MAX_VISITAS_POR_LOTE = 1000
/** Ejecutivos Comerciales por archivo (cada lote los lleva todos: el emparejamiento no depende del orden). */
export const MAX_COMERCIALES = 300
/** Un Ejecutivo Comercial que VMO trae y OpMap no tiene se crea activo si su última visita es de estos últimos días. */
export const DIAS_PARA_ACTIVO = 60

const MESES: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
}
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

export function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const normalizar = (texto: unknown) => sinTildes(String(texto ?? '')).replace(/\s+/g, ' ').trim().toLowerCase()

/** Columnas de COLUMNAS_VMO que no están entre los encabezados (sin distinguir mayúsculas ni tildes). */
export function columnasFaltantes(encabezados: string[]): string[] {
  const presentes = new Set(encabezados.map(normalizar))
  return Object.values(COLUMNAS_VMO).filter(columna => !presentes.has(normalizar(columna)))
}

/** Nombre como lo escribe VMO, sin espacios de sobra ("Lizeth Albarracín " → "Lizeth Albarracín"). */
export function nombreVmo(valor: unknown): string {
  return String(valor ?? '').replace(/\s+/g, ' ').trim()
}

/** Llave del Ejecutivo Comercial: minúsculas, sin tildes ni signos, espacios simples (executives.vmo_nombre). */
export function claveComercial(nombre: string): string {
  return sinTildes(nombre).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function fechaValida(anio: number, mes: number, dia: number): string | null {
  if (anio < 2000 || anio > 2100 || mes < 1 || mes > 12 || dia < 1) return null
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (fecha.getUTCMonth() !== mes - 1) return null
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** "22 Oct 2026 07:31:46" (como exporta VMO), "22 oct 2026", "2026-10-22", "22/10/2026" o una fecha de Excel → AAAA-MM-DD. */
export function fechaVmo(valor: unknown): string | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : fechaValida(valor.getFullYear(), valor.getMonth() + 1, valor.getDate())
  }
  const texto = String(valor ?? '').trim()
  let partes = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texto)
  if (partes) return fechaValida(+partes[1], +partes[2], +partes[3])
  partes = /^(\d{1,2})[\s/-]+([a-záéíóú]{3,})\.?[\s/-]+(\d{4})\b/i.exec(texto)
  if (partes) {
    const mes = MESES[sinTildes(partes[2]).slice(0, 3).toLowerCase()]
    return mes ? fechaValida(+partes[3], mes, +partes[1]) : null
  }
  partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(texto)
  if (partes) return fechaValida(+partes[3], +partes[2], +partes[1])
  return null
}

function numero(valor: unknown): number {
  if (typeof valor === 'number') return valor
  const texto = String(valor ?? '').trim().replace(',', '.')
  return texto === '' ? NaN : Number(texto)
}

/** ¿Un punto dentro de Colombia? (los mismos límites que las sedes de la app de visita) */
export function puntoEnColombia(lat: number, lng: number): boolean {
  const { latMin, latMax, lngMin, lngMax } = LIMITES_COLOMBIA
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax
}

/**
 * Lee las filas de la exportación de VMO › Visitas (objetos con los encabezados del Excel como claves) y deja solo las
 * visitas que se importan: "Visita realizada" o "Visita extra", con ID, Ejecutivo Comercial, fecha y un punto en
 * Colombia; una por ID.
 */
export function leerVisitasVmo(filas: Record<string, unknown>[]): LecturaVmo {
  // Encabezado real de cada columna (el Excel puede variar mayúsculas o tildes)
  const reales = new Map<string, string>()
  for (const fila of filas.slice(0, 50)) for (const clave of Object.keys(fila)) if (!reales.has(normalizar(clave))) reales.set(normalizar(clave), clave)
  const celda = (fila: Record<string, unknown>, columna: string) => fila[reales.get(normalizar(columna)) ?? columna]

  const lectura: LecturaVmo = {
    filas: filas.length,
    visitas: [],
    descartadas: { noRealizadas: 0, sinCoordenadas: 0, sinFecha: 0, sinComercial: 0, sinId: 0, repetidas: 0 },
    porMes: {},
  }
  const vistos = new Set<number>()
  for (const fila of filas) {
    const tipo = normalizar(celda(fila, COLUMNAS_VMO.tipo))
    if (tipo !== 'visita realizada' && tipo !== 'visita extra') { lectura.descartadas.noRealizadas++; continue }
    const id = numero(celda(fila, COLUMNAS_VMO.id))
    if (!Number.isInteger(id) || id <= 0) { lectura.descartadas.sinId++; continue }
    const comercial = nombreVmo(celda(fila, COLUMNAS_VMO.comercial))
    if (!claveComercial(comercial)) { lectura.descartadas.sinComercial++; continue }
    const fecha = fechaVmo(celda(fila, COLUMNAS_VMO.fecha))
    if (!fecha) { lectura.descartadas.sinFecha++; continue }
    const lat = numero(celda(fila, COLUMNAS_VMO.lat))
    const lng = numero(celda(fila, COLUMNAS_VMO.lng))
    if (!puntoEnColombia(lat, lng)) { lectura.descartadas.sinCoordenadas++; continue }
    if (vistos.has(id)) { lectura.descartadas.repetidas++; continue }
    vistos.add(id)
    lectura.visitas.push({
      vmo_id: id, comercial, fecha, lat, lng,
      presencial: normalizar(celda(fila, COLUMNAS_VMO.contacto)).includes('presencial'),
      extra: tipo === 'visita extra',
    })
    const mes = fecha.slice(0, 7)
    lectura.porMes[mes] = (lectura.porMes[mes] ?? 0) + 1
  }
  return lectura
}

/** Los Ejecutivos Comerciales de unas visitas (por llave), con su nombre y la fecha de su última visita. */
export function comercialesDe(visitas: VisitaVmo[]): ComercialVmo[] {
  const porClave = new Map<string, ComercialVmo>()
  for (const visita of visitas) {
    const clave = claveComercial(visita.comercial)
    const previo = porClave.get(clave)
    if (!previo) porClave.set(clave, { nombre: visita.comercial, ultima: visita.fecha })
    else if (visita.fecha > previo.ultima) previo.ultima = visita.fecha
  }
  return Array.from(porClave.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Lotes para POST /api/visits/import. Cada uno lleva sus visitas y TODOS los Ejecutivos Comerciales del archivo (con la
 * última visita del archivo): el servidor los empareja juntos, así el resultado no depende del orden de los lotes.
 */
export function lotesVmo(visitas: VisitaVmo[], tamano = MAX_VISITAS_POR_LOTE): { visitas: VisitaVmo[]; comerciales: ComercialVmo[] }[] {
  const comerciales = comercialesDe(visitas)
  const lotes: { visitas: VisitaVmo[]; comerciales: ComercialVmo[] }[] = []
  for (let i = 0; i < visitas.length; i += tamano) lotes.push({ visitas: visitas.slice(i, i + tamano), comerciales })
  return lotes
}

/** Persona de OpMap (executives) frente a VMO. */
export interface PersonaVmo {
  id: string
  full_name: string
  status: string
  vmo_nombre: string | null
}

export type ComoEmparejado = 'llave' | 'nombre' | 'parecido'

const palabras = (clave: string) => clave.split(' ').filter(palabra => palabra && !PARTICULAS.has(palabra))

/** Todas las palabras del nombre más corto (con al menos dos) están en el otro: VMO a veces omite el segundo nombre. */
function parecidos(a: string, b: string): boolean {
  const [x, y] = [palabras(a), palabras(b)]
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x]
  return corto.length >= 2 && corto.every(palabra => largo.includes(palabra))
}

/**
 * Empareja de una vez TODOS los Ejecutivos Comerciales de un archivo con las personas de OpMap (el resultado no depende
 * del orden): 1) por la llave guardada (vmo_nombre); 2) por el nombre completo sin tildes; 3) por un nombre parecido,
 * solo si la persona es la única candidata de ese nombre y ningún otro nombre del archivo puede ser ella. Nunca una
 * vacante ni a quien ya tiene otra llave; sin certeza, null (se crea la persona).
 */
export function emparejarComerciales(claves: string[], personas: PersonaVmo[]): Map<string, { id: string; como: ComoEmparejado } | null> {
  const resultado = new Map<string, { id: string; como: ComoEmparejado } | null>()
  const unicas = Array.from(new Set(claves))
  const tomadas = new Set<string>()
  const libres = () => personas.filter(persona => persona.status !== 'placeholder' && !persona.vmo_nombre && !tomadas.has(persona.id))
  for (const clave of unicas) {
    const persona = personas.find(p => p.vmo_nombre === clave)
    if (persona) {
      resultado.set(clave, { id: persona.id, como: 'llave' })
      tomadas.add(persona.id)
    }
  }
  for (const clave of unicas.filter(c => !resultado.has(c))) {
    const mismoNombre = libres().filter(persona => claveComercial(persona.full_name) === clave)
    if (mismoNombre.length === 1) {
      resultado.set(clave, { id: mismoNombre[0].id, como: 'nombre' })
      tomadas.add(mismoNombre[0].id)
    }
  }
  const pendientes = unicas.filter(c => !resultado.has(c))
  const candidatas = new Map(pendientes.map(clave => [clave, libres().filter(persona => parecidos(clave, claveComercial(persona.full_name)))]))
  for (const clave of pendientes) {
    const lista = candidatas.get(clave)!
    if (lista.length !== 1) continue
    const disputada = pendientes.some(otra => otra !== clave && candidatas.get(otra)!.some(persona => persona.id === lista[0].id))
    if (disputada) continue
    resultado.set(clave, { id: lista[0].id, como: 'parecido' })
    tomadas.add(lista[0].id)
  }
  for (const clave of unicas) if (!resultado.has(clave)) resultado.set(clave, null)
  return resultado
}

/** Estado de una persona que se crea desde VMO: activa si su última visita es de los últimos DIAS_PARA_ACTIVO días. */
export function estadoComercialNuevo(ultima: string, hoy: string): 'active' | 'inactive' {
  const dias = (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${ultima}T00:00:00Z`)) / 86_400_000
  return dias <= DIAS_PARA_ACTIVO ? 'active' : 'inactive'
}

export type LoteVmoValidado =
  | { ok: true; simular: boolean; visitas: VisitaVmo[]; comerciales: ComercialVmo[] }
  | { ok: false; error: string }

/**
 * Valida el cuerpo de POST /api/visits/import sin confiar en el navegador: { comerciales, visitas } para importar, o
 * { simular: true, comerciales } para ver antes a quién se reconoce y a quién se crea (sin escribir nada).
 */
export function validarLoteVmo(cuerpo: unknown): LoteVmoValidado {
  const { visitas, comerciales, simular } = (cuerpo ?? {}) as { visitas?: unknown; comerciales?: unknown; simular?: unknown }
  if (!Array.isArray(comerciales) || comerciales.length === 0) return { ok: false, error: 'Faltan los Ejecutivos Comerciales del archivo' }
  if (comerciales.length > MAX_COMERCIALES) return { ok: false, error: `Máximo ${MAX_COMERCIALES} Ejecutivos Comerciales por archivo` }
  const porClave = new Map<string, ComercialVmo>()
  for (const comercial of comerciales as Record<string, unknown>[]) {
    const nombre = nombreVmo(comercial?.nombre)
    const ultima = typeof comercial?.ultima === 'string' ? fechaVmo(comercial.ultima) : null
    if (!claveComercial(nombre) || !ultima || ultima !== comercial.ultima) return { ok: false, error: 'Ejecutivo Comercial del archivo no válido' }
    porClave.set(claveComercial(nombre), { nombre, ultima })
  }
  const lista = Array.from(porClave.values())

  if (simular === true) {
    if (Array.isArray(visitas) && visitas.length > 0) return { ok: false, error: 'La simulación no lleva visitas' }
    return { ok: true, simular: true, visitas: [], comerciales: lista }
  }
  if (!Array.isArray(visitas) || visitas.length === 0) return { ok: false, error: 'No llegaron visitas para importar' }
  if (visitas.length > MAX_VISITAS_POR_LOTE) return { ok: false, error: `Máximo ${MAX_VISITAS_POR_LOTE} visitas por envío` }

  const limpias: VisitaVmo[] = []
  const ids = new Set<number>()
  for (const visita of visitas as Record<string, unknown>[]) {
    const vmoId = Number(visita?.vmo_id)
    const comercial = nombreVmo(visita?.comercial)
    const fecha = typeof visita?.fecha === 'string' ? fechaVmo(visita.fecha) : null
    const lat = Number(visita?.lat)
    const lng = Number(visita?.lng)
    if (!Number.isInteger(vmoId) || vmoId <= 0 || ids.has(vmoId) || !claveComercial(comercial) || !fecha || fecha !== visita.fecha ||
      !puntoEnColombia(lat, lng) || typeof visita?.presencial !== 'boolean' || typeof visita?.extra !== 'boolean') {
      return { ok: false, error: `Visita de VMO no válida (ID ${String(visita?.vmo_id ?? '?')})` }
    }
    if (!porClave.has(claveComercial(comercial))) return { ok: false, error: 'Hay visitas de un Ejecutivo Comercial que no viene en el archivo' }
    ids.add(vmoId)
    limpias.push({ vmo_id: vmoId, comercial, fecha, lat, lng, presencial: visita.presencial, extra: visita.extra })
  }
  return { ok: true, simular: false, visitas: limpias, comerciales: lista }
}
