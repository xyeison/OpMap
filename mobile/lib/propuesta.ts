/**
 * Del dictado (o de los toques) a la visita que se envía. PURO (sin React Native): lo prueba scripts/movil-check.ts.
 * Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (decisiones 5 a 9 y 12, sección "App móvil").
 *
 * - Un BORRADOR es una tarjeta editable: lo que propuso la IA (POST /api/me/voz/proponer) o una visita por toques
 *   desde cero. Nada se guarda sin que la persona toque "Confirmar".
 * - El CATÁLOGO es lo que la pantalla conoce para elegir: lo de GET /api/me/contexto (sedes a menos de 1 km, sus
 *   médicos, contactos, subtipos, líneas y su configuración) más lo que se creó o buscó en este reporte (un médico
 *   nuevo, una sede nueva). Solo se eligen ids del catálogo: la IA nunca inventa un tercero.
 * - validarBorrador es el espejo en el teléfono de validarVisita del servidor (mismos campos y mensajes), para
 *   avisar antes de enviar; el servidor sigue siendo la última palabra (la distancia que vale es la suya).
 * - cuerpoDesdeBorrador arma el cuerpo de POST /api/me/visitas (tipo y modalidad discriminados).
 */
import { esFechaIso, fechaBogota, hoyBogota } from './fechas'
import { esPunto, haversineM, textoDistancia, type Punto } from './geo'
import type {
  ConfigContexto,
  ContactoContexto,
  ContextoResponse,
  ErrorVisita,
  LineaEjecutiva,
  MedioTelefonica,
  Modalidad,
  MedicoPublico,
  ModoEntrada,
  PropuestaResponse,
  SedeCreada,
  SubtipoContexto,
  TipoVisita,
  VisitaCreate,
  VisitaItem,
  VisitaPropuesta,
  VisitaUpdate,
} from './tipos'
import { ETIQUETA_TIPO_VISITA } from './tipos'

// ---------------------------------------------------------------------------------------------
// Límites y mensajes (los mismos de web/lib/reporte-visitas.ts y de visitas_registrar)
// ---------------------------------------------------------------------------------------------

export const MAX_FAILURE_REASON = 300
export const MAX_CONCLUSION = 2000
export const MAX_COMPROMISOS = 2000
export const MAX_TRANSCRIPT = 8000
export const MAX_LINEAS_VISITA = 10

export const MENSAJE_SOLO_HOY = 'Solo se reportan visitas del mismo día'
export const MENSAJE_SEDE_SIN_UBICACION = 'Esta sede no tiene ubicación: confírmala o crea la sede'
export const MENSAJE_TELEFONICA_NO_HABILITADA = 'No tienes habilitada la visita telefónica'
export const MENSAJE_TOPE_MEDICO = 'Ya reportaste una visita a este médico hoy'
export const MENSAJE_SEDE_NO_DEL_MEDICO = 'El médico no atiende en esa sede'
export const MENSAJE_SEDE_NO_DE_LA_CUENTA = 'Esa sede no es de la cuenta elegida'
export const MENSAJE_CONTACTO_OTRA_CUENTA = 'Ese contacto no es de la cuenta elegida'
export const MENSAJE_LINEAS_AJENAS = 'Alguna de las líneas no es tuya'
export const MENSAJE_SIN_UBICACION_PRESENCIAL = 'La ubicación del teléfono es obligatoria en una visita presencial'
export const MENSAJE_FAILURE = `Indica el motivo de la visita no efectiva (hasta ${MAX_FAILURE_REASON} caracteres)`
export const MENSAJE_PROXIMA_ANTES_DE_VISITA = 'La próxima reunión no puede ser anterior a la fecha de la visita'
export const MENSAJE_LINEAS = `Elige al menos una línea (como máximo ${MAX_LINEAS_VISITA})`

export function mensajeFueraDeRadio(distanciaM: number, sede: string, radioM: number): string {
  return `Estás a ${distanciaM} m de ${sede}; el radio es ${radioM} m`
}

export function mensajePerfil(tipo: TipoVisita): string {
  return tipo === 'medica' ? 'Tu perfil no incluye visitas médicas' : 'Tu perfil no incluye visitas institucionales'
}

export function mensajeTopeTelefonicas(tope: number): string {
  return tope === 1 ? 'Ya reportaste tu visita telefónica de hoy' : `Ya reportaste las ${tope} visitas telefónicas de hoy`
}

/** Aviso que ve la persona cuando la visita queda en la cola sin señal. */
export const AVISO_EN_COLA = 'Sin señal: quedó guardada en el teléfono y se enviará al volver la señal, antes de medianoche.'

/**
 * Aviso de la tarjeta cuando ella NO es visitante del médico (contrato, reglas del dueño): la visita suma igual a su
 * meta, queda marcada out_of_territory y la app le ofrece "pedir ser su visitante". En F3 queda la marca y la
 * asignación la hace quien tiene visitantes:manage (su líder de línea o dirección), así que el aviso le dice a quién
 * pedirlo; dejar la solicitud registrada en OpMap (botón y lista para el líder) es de F5.
 */
export const AVISO_NO_VISITANTE =
  'No eres su visitante: la visita suma igual y queda marcada "fuera de tu territorio". Pide a tu líder que te asigne como su visitante.'

/** El aviso de arriba si ella no es visitante de ese médico; null si lo es o si aún no eligió médico. */
export function avisoVisitante(medico: Pick<MedicoOpcion, 'propio'> | null | undefined): string | null {
  return medico && !medico.propio ? AVISO_NO_VISITANTE : null
}

// ---------------------------------------------------------------------------------------------
// Catálogo: lo que se puede elegir
// ---------------------------------------------------------------------------------------------

export interface SedeOpcion {
  id: string
  nombre: string
  cuenta_id: string | null
  cuenta_nombre: string | null
  cuenta_clase: string | null
  lat: number | null
  lng: number | null
  /** Metros al punto del reporte (null si no se sabe). */
  distancia_m: number | null
  ubicacion_confirmada: boolean | null
  /** Sede traída del buscador: no se saben sus coordenadas (el servidor decide si está en el radio). */
  coordenadas_desconocidas?: boolean
}

export interface SedeDeMedicoOpcion {
  id: string
  nombre: string
  cuenta_nombre: string | null
  distancia_m: number | null
  /**
   * No se sabe a qué distancia está (médico traído del buscador, recién creado o vinculado, o contexto guardado sin
   * señal): la app no la bloquea por "sin ubicación" y la distancia la decide el servidor al confirmar.
   */
  coordenadas_desconocidas?: boolean
}

export interface MedicoOpcion {
  id: string
  nombre: string
  especialidades: string[]
  /** Líneas por las que ella es su visitante (vacío si no lo es). */
  lineas: string[]
  sedes: SedeDeMedicoOpcion[]
  /** Ella es su visitante (viene de mis_medicos). Si no, la visita queda fuera de su territorio. */
  propio: boolean
}

export interface Catalogo {
  lineas: LineaEjecutiva[]
  config: ConfigContexto
  /** Telefónicas efectivas ya hechas hoy (al cargar el contexto). */
  telefonicas_hoy: number
  sedes: SedeOpcion[]
  medicos: MedicoOpcion[]
  contactos: ContactoContexto[]
  subtipos: SubtipoContexto[]
}

export interface ExtrasCatalogo {
  sedes?: readonly SedeOpcion[]
  medicos?: readonly MedicoOpcion[]
}

/**
 * Une el contexto con lo creado o buscado en este reporte (sin repetir ids; lo del contexto manda). Con `punto`,
 * las distancias de las sedes con coordenadas se recalculan desde ahí (el contexto pudo cargarse en otro punto).
 * `sinSenal`: el contexto es el guardado (otro punto, otra hora): las distancias de las sedes de los médicos ya no
 * valen y quedan "desconocidas" (decide el servidor al enviar la cola), salvo las de sedes con coordenadas.
 */
export function catalogoDesdeContexto(
  contexto: ContextoResponse,
  extras: ExtrasCatalogo = {},
  punto: Punto | null = null,
  opciones: { sinSenal?: boolean } = {}
): Catalogo {
  const sedes: SedeOpcion[] = contexto.sedes_cerca.map(sede => ({
    id: sede.id,
    nombre: sede.nombre,
    cuenta_id: sede.cuenta_id,
    cuenta_nombre: sede.cuenta_nombre,
    cuenta_clase: sede.cuenta_clase,
    lat: sede.lat,
    lng: sede.lng,
    distancia_m: sede.distancia_m,
    ubicacion_confirmada: sede.ubicacion_confirmada,
  }))
  for (const extra of extras.sedes ?? []) if (!sedes.some(sede => sede.id === extra.id)) sedes.push({ ...extra })
  if (punto && esPunto(punto.lat, punto.lng)) {
    for (const sede of sedes) {
      if (esPunto(sede.lat, sede.lng)) sede.distancia_m = haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number })
    }
  }
  const medicos: MedicoOpcion[] = contexto.mis_medicos.map(medico => ({
    id: medico.id,
    nombre: medico.nombre,
    especialidades: medico.especialidades,
    lineas: medico.lineas,
    sedes: medico.sedes.map(sede => (opciones.sinSenal ? { ...sede, distancia_m: null, coordenadas_desconocidas: true } : { ...sede })),
    propio: true,
  }))
  for (const extra of extras.medicos ?? []) {
    const existente = medicos.find(medico => medico.id === extra.id)
    if (!existente) medicos.push(extra)
    else for (const sede of extra.sedes) if (!existente.sedes.some(s => s.id === sede.id)) existente.sedes.push(sede)
  }
  return {
    lineas: contexto.ejecutiva.lineas,
    config: contexto.config,
    telefonicas_hoy: contexto.hoy.hechas.telefonicas,
    sedes,
    medicos,
    contactos: contexto.contactos,
    subtipos: contexto.subtipos,
  }
}

/** Cuentas de las sedes del catálogo (sin repetir), la más cercana primero. */
export function cuentasDelCatalogo(catalogo: Catalogo): { id: string; nombre: string; clase: string | null; distancia_m: number | null }[] {
  const porId = new Map<string, { id: string; nombre: string; clase: string | null; distancia_m: number | null }>()
  for (const sede of catalogo.sedes) {
    if (!sede.cuenta_id) continue
    const previa = porId.get(sede.cuenta_id)
    const distancia = sede.distancia_m
    if (!previa) porId.set(sede.cuenta_id, { id: sede.cuenta_id, nombre: sede.cuenta_nombre ?? sede.nombre, clase: sede.cuenta_clase, distancia_m: distancia })
    else if (distancia !== null && (previa.distancia_m === null || distancia < previa.distancia_m)) previa.distancia_m = distancia
  }
  return ordenarPorDistanciaNula([...porId.values()])
}

function ordenarPorDistanciaNula<T extends { distancia_m: number | null; nombre: string }>(lista: T[]): T[] {
  return lista.sort((a, b) => {
    if (a.distancia_m === null) return b.distancia_m === null ? a.nombre.localeCompare(b.nombre, 'es') : 1
    if (b.distancia_m === null) return -1
    return a.distancia_m - b.distancia_m
  })
}

// ---------------------------------------------------------------------------------------------
// Borrador
// ---------------------------------------------------------------------------------------------

export interface Borrador {
  /** Clave local de la tarjeta (para la lista y para volver de "Crear médico"). */
  clave: string
  /** uuid de la app: el servidor no duplica la visita si llega dos veces (decisión 4). */
  client_id: string
  origen: ModoEntrada
  tipo: TipoVisita | null
  subtipo_id: string | null
  medico_id: string | null
  /** Nombre que dijo la persona y no cruzó con ningún médico (para "Crear médico completo"). */
  medico_nombre_dicho: string | null
  sugerir_crear_medico: boolean
  cuenta_id: string | null
  sede_id: string | null
  contacto_id: string | null
  contacto_nombre_dicho: string | null
  lineas: string[]
  efectiva: boolean
  failure_reason: string
  conclusion: string
  compromisos: string
  /** AAAA-MM-DD o '' (sin próxima reunión). */
  next_step_date: string
  modalidad: Modalidad
  medio: MedioTelefonica | null
  /** Lo que la IA no entendió y conviene revisar. */
  preguntas: string[]
  /** 0..1 según la IA (null por toques). */
  confianza: number | null
  /** El nombre que se dictó y no cruzó, aunque luego se haya creado o elegido el médico (para no proponerlo dos veces). */
  nombre_dicho_original?: string | null
  /** Transcripción propia de la tarjeta (una visita que se vuelve a reportar desde la cola); si no, la del dictado. */
  transcript?: string | null
}

export interface OpcionesBorrador {
  /** Genera ids (client_id y clave). En la app: expo-crypto randomUUID. */
  nuevoId: () => string
  /** Sede elegida en el paso 1 (la de la lista de cercanas). */
  sedeElegida?: string | null
  /** Hoy en Bogotá (AAAA-MM-DD); por defecto, el del reloj. Una próxima reunión anterior se descarta. */
  hoy?: string
}

/** Primer medio habilitado ("llamada" si está). */
function medioPorDefecto(config: ConfigContexto): MedioTelefonica | null {
  const medios = config.telefonica.medios
  return medios.includes('llamada') ? 'llamada' : (medios[0] ?? null)
}

/** Líneas por defecto: las del médico que son suyas; si ella tiene una sola línea, esa. */
function lineasPorDefecto(catalogo: Catalogo, medico: MedicoOpcion | null): string[] {
  const suyas = new Set(catalogo.lineas.map(linea => linea.id))
  const delMedico = (medico?.lineas ?? []).filter(id => suyas.has(id))
  if (delMedico.length > 0) return delMedico.slice(0, MAX_LINEAS_VISITA)
  return catalogo.lineas.length === 1 ? [catalogo.lineas[0].id] : []
}

/** Visita por toques desde cero: el tipo del perfil (médica primero), la sede elegida y sus líneas si hay una. */
export function borradorVacio(catalogo: Catalogo, opciones: OpcionesBorrador & { tipo?: TipoVisita }): Borrador {
  const perfil = catalogo.config.perfil
  const tipo: TipoVisita | null = opciones.tipo ?? (perfil.includes('medica') ? 'medica' : perfil.includes('institucional') ? 'institucional' : null)
  const base: Borrador = {
    clave: opciones.nuevoId(),
    client_id: opciones.nuevoId(),
    origen: 'toques',
    tipo,
    subtipo_id: null,
    medico_id: null,
    medico_nombre_dicho: null,
    sugerir_crear_medico: false,
    cuenta_id: null,
    sede_id: null,
    contacto_id: null,
    contacto_nombre_dicho: null,
    lineas: lineasPorDefecto(catalogo, null),
    efectiva: true,
    failure_reason: '',
    conclusion: '',
    compromisos: '',
    next_step_date: '',
    modalidad: 'presencial',
    medio: null,
    preguntas: [],
    confianza: null,
  }
  const sede = opciones.sedeElegida ? catalogo.sedes.find(s => s.id === opciones.sedeElegida) : undefined
  if (sede && tipo === 'institucional') return normalizar({ ...base, sede_id: sede.id, cuenta_id: sede.cuenta_id }, catalogo)
  return normalizar(base, catalogo, { sedePreferida: sede?.id ?? null })
}

/**
 * Una tarjeta por visita propuesta. Re-chequea contra el catálogo (el servidor ya lo hizo): un médico, sede,
 * contacto, subtipo o línea que no esté aquí se descarta; un médico que no cruza queda con su nombre dicho y la
 * opción de crearlo completo.
 */
export function borradoresDesdePropuesta(propuesta: PropuestaResponse, catalogo: Catalogo, opciones: OpcionesBorrador): Borrador[] {
  return propuesta.visitas.map(visita => borradorDesdePropuesta(visita, catalogo, opciones))
}

export function borradorDesdePropuesta(visita: VisitaPropuesta, catalogo: Catalogo, opciones: OpcionesBorrador): Borrador {
  const medico = visita.medico_id ? (catalogo.medicos.find(m => m.id === visita.medico_id) ?? null) : null
  const subtipo =
    (visita.subtipo_id ? catalogo.subtipos.find(s => s.id === visita.subtipo_id) : undefined) ??
    (visita.subtipo_codigo ? catalogo.subtipos.find(s => s.codigo === visita.subtipo_codigo) : undefined) ??
    null
  const suyas = new Set(catalogo.lineas.map(linea => linea.id))
  const lineas = Array.from(new Set(visita.lineas.filter(id => suyas.has(id)))).slice(0, MAX_LINEAS_VISITA)
  const telefonica = visita.modalidad_sugerida === 'telefonica' && catalogo.config.telefonica.habilitada
  const sinCruce = visita.tipo === 'medica' && !medico
  const borrador: Borrador = {
    clave: opciones.nuevoId(),
    client_id: opciones.nuevoId(),
    origen: 'voz',
    tipo: visita.tipo,
    subtipo_id: subtipo?.id ?? null,
    medico_id: medico?.id ?? null,
    medico_nombre_dicho: sinCruce ? (visita.medico_nombre_dicho ?? null) : null,
    nombre_dicho_original: sinCruce ? (visita.medico_nombre_dicho ?? null) : null,
    sugerir_crear_medico: sinCruce && (visita.sugerir_crear_medico || !!visita.medico_nombre_dicho),
    cuenta_id: visita.cuenta_id && catalogo.sedes.some(s => s.cuenta_id === visita.cuenta_id) ? visita.cuenta_id : null,
    sede_id: visita.sede_id,
    contacto_id: visita.contacto_id,
    contacto_nombre_dicho: visita.contacto_nombre_dicho,
    lineas: lineas.length > 0 ? lineas : lineasPorDefecto(catalogo, medico),
    efectiva: visita.efectiva,
    failure_reason: visita.efectiva ? '' : (visita.failure_reason ?? ''),
    conclusion: visita.conclusion ?? '',
    compromisos: visita.compromisos ?? '',
    next_step_date: visita.next_step_date && esFechaIso(visita.next_step_date) && visita.next_step_date >= (opciones.hoy ?? hoyBogota()) ? visita.next_step_date : '',
    modalidad: telefonica ? 'telefonica' : 'presencial',
    medio: telefonica ? medioPorDefecto(catalogo.config) : null,
    preguntas: visita.preguntas.slice(0, 3),
    confianza: Number.isFinite(visita.confianza) ? visita.confianza : null,
  }
  return normalizar(borrador, catalogo, { sedePreferida: opciones.sedeElegida ?? null })
}

/** Aplica cambios de la persona a una tarjeta y la deja coherente (lo que no cuadra con el cambio se limpia). */
export function cambiarBorrador(borrador: Borrador, cambios: Partial<Borrador>, catalogo: Catalogo): Borrador {
  let siguiente: Borrador = { ...borrador, ...cambios }
  if (cambios.tipo && cambios.tipo !== borrador.tipo) {
    siguiente =
      cambios.tipo === 'medica'
        ? { ...siguiente, cuenta_id: null, subtipo_id: null, contacto_id: null, contacto_nombre_dicho: null }
        : { ...siguiente, medico_id: null, medico_nombre_dicho: null, sugerir_crear_medico: false }
  }
  if (cambios.medico_id !== undefined && cambios.medico_id !== borrador.medico_id) {
    const medico = cambios.medico_id ? catalogo.medicos.find(m => m.id === cambios.medico_id) : undefined
    if (medico) {
      siguiente = { ...siguiente, medico_nombre_dicho: null, sugerir_crear_medico: false }
      if (siguiente.lineas.length === 0) siguiente = { ...siguiente, lineas: lineasPorDefecto(catalogo, medico) }
    }
  }
  if (cambios.cuenta_id !== undefined && cambios.cuenta_id !== borrador.cuenta_id && cambios.sede_id === undefined) {
    const sede = siguiente.sede_id ? catalogo.sedes.find(s => s.id === siguiente.sede_id) : undefined
    if (!sede || sede.cuenta_id !== cambios.cuenta_id) siguiente = { ...siguiente, sede_id: null }
  }
  if (cambios.contacto_id !== undefined && cambios.contacto_id && !siguiente.subtipo_id) {
    const contacto = catalogo.contactos.find(c => c.id === cambios.contacto_id)
    const sugerido = contacto ? subtipoParaContacto(contacto, catalogo.subtipos) : null
    if (sugerido) siguiente = { ...siguiente, subtipo_id: sugerido.id }
  }
  if (cambios.contacto_id) siguiente = { ...siguiente, contacto_nombre_dicho: null }
  if (cambios.modalidad === 'telefonica' && !siguiente.medio) siguiente = { ...siguiente, medio: medioPorDefecto(catalogo.config) }
  if (cambios.modalidad === 'presencial') siguiente = { ...siguiente, medio: null }
  if (cambios.efectiva === true) siguiente = { ...siguiente, failure_reason: '' }
  return normalizar(siguiente, catalogo)
}

/** Quita lo que no cuadra y completa lo que se deduce (cuenta de la sede, sede única del médico…). */
function normalizar(borrador: Borrador, catalogo: Catalogo, opciones: { sedePreferida?: string | null } = {}): Borrador {
  let b = { ...borrador }
  if (b.tipo === 'medica') {
    const medico = b.medico_id ? catalogo.medicos.find(m => m.id === b.medico_id) : undefined
    if (b.medico_id && !medico) b = { ...b, medico_id: null }
    b = { ...b, cuenta_id: null, subtipo_id: null, contacto_id: null, contacto_nombre_dicho: null }
    if (medico) {
      const sedesMedico = medico.sedes.map(s => s.id)
      if (b.sede_id && !sedesMedico.includes(b.sede_id)) b = { ...b, sede_id: null }
      if (!b.sede_id) {
        const preferida = opciones.sedePreferida && sedesMedico.includes(opciones.sedePreferida) ? opciones.sedePreferida : null
        const cercana = ordenarPorDistanciaNula(sedesDelMedico(medico, catalogo).map(s => ({ ...s })))[0]
        const dentro = cercana && cercana.distancia_m !== null && cercana.distancia_m <= catalogo.config.radio_m ? cercana.id : null
        b = { ...b, sede_id: preferida ?? dentro ?? (sedesMedico.length === 1 ? sedesMedico[0] : null) }
      }
    } else if (b.sede_id && !catalogo.sedes.some(s => s.id === b.sede_id)) {
      b = { ...b, sede_id: null }
    }
  } else if (b.tipo === 'institucional') {
    b = { ...b, medico_id: null, medico_nombre_dicho: null, sugerir_crear_medico: false }
    const sede = b.sede_id ? catalogo.sedes.find(s => s.id === b.sede_id) : undefined
    if (b.sede_id && !sede) b = { ...b, sede_id: null }
    if (sede && !b.cuenta_id) b = { ...b, cuenta_id: sede.cuenta_id }
    if (sede && b.cuenta_id && sede.cuenta_id !== b.cuenta_id) b = { ...b, sede_id: null }
    if (!b.sede_id && b.cuenta_id) {
      const deLaCuenta = catalogo.sedes.filter(s => s.cuenta_id === b.cuenta_id)
      const preferida = opciones.sedePreferida && deLaCuenta.some(s => s.id === opciones.sedePreferida) ? opciones.sedePreferida : null
      b = { ...b, sede_id: preferida ?? (deLaCuenta.length === 1 ? deLaCuenta[0].id : null) }
    }
    if (b.subtipo_id && !catalogo.subtipos.some(s => s.id === b.subtipo_id)) b = { ...b, subtipo_id: null }
    if (b.contacto_id) {
      const contacto = catalogo.contactos.find(c => c.id === b.contacto_id)
      if (!contacto || contacto.cuenta_id !== b.cuenta_id) b = { ...b, contacto_id: null }
    }
  }
  const suyas = new Set(catalogo.lineas.map(linea => linea.id))
  b = { ...b, lineas: Array.from(new Set(b.lineas.filter(id => suyas.has(id)))).slice(0, MAX_LINEAS_VISITA) }
  if (b.modalidad === 'telefonica' && b.medio && !catalogo.config.telefonica.medios.includes(b.medio)) b = { ...b, medio: medioPorDefecto(catalogo.config) }
  if (b.modalidad === 'presencial') b = { ...b, medio: null }
  return b
}

// ---------------------------------------------------------------------------------------------
// Opciones de cada selector
// ---------------------------------------------------------------------------------------------

/** Sedes del médico con la mejor distancia conocida (la del catálogo si la sede está cerca). */
export function sedesDelMedico(medico: MedicoOpcion, catalogo: Catalogo): SedeDeMedicoOpcion[] {
  return medico.sedes.map(sede => {
    const cercana = catalogo.sedes.find(s => s.id === sede.id)
    return { ...sede, distancia_m: cercana?.distancia_m ?? sede.distancia_m }
  })
}

/** Sedes que se pueden elegir en la tarjeta: las del médico (médica) o las de la cuenta (institucional). */
export function sedesParaBorrador(borrador: Borrador, catalogo: Catalogo): SedeDeMedicoOpcion[] {
  if (borrador.tipo === 'medica') {
    const medico = borrador.medico_id ? catalogo.medicos.find(m => m.id === borrador.medico_id) : undefined
    return medico ? ordenarPorDistanciaNula(sedesDelMedico(medico, catalogo)) : []
  }
  const sedes = catalogo.sedes.filter(s => !borrador.cuenta_id || s.cuenta_id === borrador.cuenta_id)
  return ordenarPorDistanciaNula(sedes.map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre, distancia_m: s.distancia_m })))
}

/** Sedes cercanas donde el médico elegido NO está vinculado (para "Agregar esta sede al médico"). */
export function sedesCercanasSinVincular(borrador: Borrador, catalogo: Catalogo): SedeOpcion[] {
  if (borrador.tipo !== 'medica' || !borrador.medico_id) return []
  const medico = catalogo.medicos.find(m => m.id === borrador.medico_id)
  if (!medico) return []
  return catalogo.sedes.filter(s => !medico.sedes.some(ms => ms.id === s.id))
}

/** Contactos de la cuenta elegida: los de su sede (o sin sede) primero. */
export function contactosParaBorrador(borrador: Borrador, catalogo: Catalogo): ContactoContexto[] {
  if (!borrador.cuenta_id) return []
  return catalogo.contactos
    .filter(c => c.cuenta_id === borrador.cuenta_id)
    .sort((a, b) => Number(b.sede_id === borrador.sede_id) - Number(a.sede_id === borrador.sede_id) || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Subtipo que sugiere el rol de un contacto (el primero cuyos roles sugeridos lo incluyen). */
export function subtipoParaContacto(contacto: { rol: string }, subtipos: readonly SubtipoContexto[]): SubtipoContexto | null {
  return subtipos.find(s => s.roles_sugeridos.includes(contacto.rol)) ?? null
}

// ---------------------------------------------------------------------------------------------
// Validación antes de enviar (espejo de validarVisita del servidor)
// ---------------------------------------------------------------------------------------------

/**
 * Telefónicas efectivas de hoy para el tope. Con `visitasHoy` (la lista completa de hoy: GET /api/me/visitas más las
 * confirmadas o en cola en este reporte) se cuentan ahí, sin la misma visita reintentada; sin ella, la cifra del
 * contexto (hoy.hechas.telefonicas). Nunca las dos sumadas: serían las mismas visitas contadas dos veces.
 */
export function telefonicasDeHoy(catalogo: Catalogo, visitasHoy?: readonly VisitaHoyTope[] | null, clientId?: string | null): number {
  if (!visitasHoy) return catalogo.telefonicas_hoy
  return visitasHoy.filter(v => v.modalidad === 'telefonica' && v.efectiva && (!clientId || v.client_id !== clientId)).length
}

/** Una visita de hoy (no anulada) para los topes: las de GET /api/me/visitas más las confirmadas en este reporte. */
export interface VisitaHoyTope {
  client_id?: string | null
  medico_id: string | null
  modalidad: Modalidad
  efectiva: boolean
}

export interface EntradaValidacion {
  /** Ubicación del teléfono (null si no la dio). */
  punto: Punto | null
  /** Instante del sitio (el de la ubicación). */
  checked_in_at: string
  ahora: Date
  /** Visitas de hoy de ella (para el tope por médico y el de telefónicas). */
  visitasHoy?: readonly VisitaHoyTope[]
}

export interface ResultadoBorrador {
  ok: boolean
  errores: ErrorVisita[]
  /** Metros a la sede elegida según el teléfono (referencia; la que vale la calcula el servidor). */
  distancia_m: number | null
  /** Médico del que no es visitante: suma igual y queda marcada. */
  fuera_de_territorio: boolean
}

/** Distancia del punto a la sede del borrador: con las coordenadas si están; si no, la que dio el contexto. */
export function distanciaASede(borrador: Borrador, catalogo: Catalogo, punto: Punto | null): { conocida: boolean; distancia_m: number | null } {
  if (!borrador.sede_id) return { conocida: false, distancia_m: null }
  const sede = catalogo.sedes.find(s => s.id === borrador.sede_id)
  if (sede && punto && esPunto(sede.lat, sede.lng)) {
    return { conocida: true, distancia_m: haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number }) }
  }
  if (sede && !esPunto(sede.lat, sede.lng)) return sede.coordenadas_desconocidas ? { conocida: false, distancia_m: null } : { conocida: true, distancia_m: null }
  for (const medico of catalogo.medicos) {
    const deMedico = medico.sedes.find(s => s.id === borrador.sede_id)
    if (!deMedico) continue
    // Del contexto con punto, distancia null = la sede no tiene coordenadas. De un médico traído o creado aquí, o del
    // contexto guardado sin señal, null = no se sabe: decide el servidor.
    if (deMedico.distancia_m === null && deMedico.coordenadas_desconocidas) return { conocida: false, distancia_m: null }
    return { conocida: true, distancia_m: deMedico.distancia_m }
  }
  return { conocida: false, distancia_m: null }
}

export function nombreSede(sedeId: string | null, catalogo: Catalogo): string {
  if (!sedeId) return 'la sede'
  const sede = catalogo.sedes.find(s => s.id === sedeId)
  if (sede) return sede.nombre
  for (const medico of catalogo.medicos) {
    const deMedico = medico.sedes.find(s => s.id === sedeId)
    if (deMedico) return deMedico.nombre
  }
  return 'la sede'
}

/** Revisa la tarjeta como lo hará el servidor (todos los errores a la vez, con el campo que falla). */
export function validarBorrador(borrador: Borrador, catalogo: Catalogo, entrada: EntradaValidacion): ResultadoBorrador {
  const errores: ErrorVisita[] = []
  const falla = (campo: string, mensaje: string) => errores.push({ campo, mensaje })
  const config = catalogo.config
  const visitasHoy = (entrada.visitasHoy ?? []).filter(v => !v.client_id || v.client_id !== borrador.client_id)
  let distancia_m: number | null = null
  let fuera_de_territorio = false

  // Mismo día
  try {
    if (fechaBogota(entrada.checked_in_at) !== hoyBogota(entrada.ahora)) falla('checked_in_at', MENSAJE_SOLO_HOY)
  } catch {
    falla('checked_in_at', 'La hora de llegada no es válida')
  }

  // Tipo y perfil
  if (!borrador.tipo) falla('tipo', 'Elige el tipo de visita')
  else if (!config.perfil.includes(borrador.tipo)) falla('tipo', mensajePerfil(borrador.tipo))

  // Médica o institucional
  if (borrador.tipo === 'medica') {
    const medico = borrador.medico_id ? catalogo.medicos.find(m => m.id === borrador.medico_id) : undefined
    if (!medico) falla('medico_id', borrador.medico_nombre_dicho ? `"${borrador.medico_nombre_dicho}" no está en OpMap: elígelo o créalo completo` : 'Elige el médico')
    else {
      fuera_de_territorio = !medico.propio
      if (!borrador.sede_id) falla('sede_id', 'Elige la sede donde lo viste')
      else if (!medico.sedes.some(s => s.id === borrador.sede_id)) falla('sede_id', MENSAJE_SEDE_NO_DEL_MEDICO)
    }
  } else if (borrador.tipo === 'institucional') {
    if (!borrador.cuenta_id) falla('cuenta_id', 'Elige la cuenta')
    if (!borrador.sede_id) falla('sede_id', 'Elige la sede')
    else {
      const sede = catalogo.sedes.find(s => s.id === borrador.sede_id)
      if (sede && borrador.cuenta_id && sede.cuenta_id !== borrador.cuenta_id) falla('cuenta_id', MENSAJE_SEDE_NO_DE_LA_CUENTA)
    }
    if (!borrador.subtipo_id) falla('subtipo_id', 'Elige el subtipo de la visita institucional')
    if (borrador.contacto_id) {
      const contacto = catalogo.contactos.find(c => c.id === borrador.contacto_id)
      if (!contacto || contacto.cuenta_id !== borrador.cuenta_id) falla('contacto_id', MENSAJE_CONTACTO_OTRA_CUENTA)
    }
  }

  // Modalidad
  if (borrador.modalidad === 'presencial') {
    if (!entrada.punto || !esPunto(entrada.punto.lat, entrada.punto.lng)) falla('lat', MENSAJE_SIN_UBICACION_PRESENCIAL)
    else if (borrador.sede_id) {
      const distancia = distanciaASede(borrador, catalogo, entrada.punto)
      if (distancia.conocida && distancia.distancia_m === null) falla('sede_id', MENSAJE_SEDE_SIN_UBICACION)
      else if (distancia.distancia_m !== null) {
        distancia_m = distancia.distancia_m
        if (distancia_m > config.radio_m) falla('lat', mensajeFueraDeRadio(distancia_m, nombreSede(borrador.sede_id, catalogo), config.radio_m))
      }
    }
  } else {
    if (!config.telefonica.habilitada) falla('modalidad', MENSAJE_TELEFONICA_NO_HABILITADA)
    else {
      if (!borrador.medio) falla('medio', 'Indica el medio: llamada o videollamada')
      else if (!config.telefonica.medios.includes(borrador.medio)) falla('medio', `Medio no válido: ${config.telefonica.medios.join(' o ')}`)
      const telefonicas = telefonicasDeHoy(catalogo, entrada.visitasHoy, borrador.client_id)
      if (telefonicas >= config.telefonica.tope_dia) falla('modalidad', mensajeTopeTelefonicas(config.telefonica.tope_dia))
    }
  }

  // Tope por médico (solo efectivas)
  if (borrador.tipo === 'medica' && borrador.efectiva && borrador.medico_id) {
    const alMedico = visitasHoy.filter(v => v.efectiva && v.medico_id === borrador.medico_id).length
    if (alMedico >= config.tope_visitas_medico_dia) falla('medico_id', MENSAJE_TOPE_MEDICO)
  }

  // Efectiva o no
  const motivo = borrador.failure_reason.trim()
  if (!borrador.efectiva && (!motivo || motivo.length > MAX_FAILURE_REASON)) falla('failure_reason', MENSAJE_FAILURE)

  // Textos y fecha
  if (borrador.conclusion.trim().length > MAX_CONCLUSION) falla('conclusion', `La conclusión no puede superar ${MAX_CONCLUSION} caracteres`)
  if (borrador.compromisos.trim().length > MAX_COMPROMISOS) falla('compromisos', `Los compromisos no pueden superar ${MAX_COMPROMISOS} caracteres`)
  const proxima = borrador.next_step_date.trim()
  if (proxima && !esFechaIso(proxima)) falla('next_step_date', 'Fecha no válida: usa AAAA-MM-DD')
  else if (proxima && proximaAntesDeLaVisita(proxima, entrada.checked_in_at)) falla('next_step_date', MENSAJE_PROXIMA_ANTES_DE_VISITA)

  // Líneas
  if (borrador.lineas.length === 0 || borrador.lineas.length > MAX_LINEAS_VISITA) falla('lineas', MENSAJE_LINEAS)
  else if (borrador.lineas.some(id => !catalogo.lineas.some(l => l.id === id))) falla('lineas', MENSAJE_LINEAS_AJENAS)

  return { ok: errores.length === 0, errores, distancia_m, fuera_de_territorio }
}

/** ¿La próxima reunión (AAAA-MM-DD) cae antes de la fecha de la visita en Bogotá? (el servidor la rechaza) */
export function proximaAntesDeLaVisita(proxima: string, checkedInAt: string): boolean {
  try {
    return esFechaIso(proxima) && proxima < fechaBogota(checkedInAt)
  } catch {
    return false
  }
}

/** Primer error de un campo (o de varios), para pintarlo junto al selector. */
export function errorDe(errores: readonly ErrorVisita[], ...campos: string[]): string | null {
  return errores.find(e => campos.includes(e.campo))?.mensaje ?? null
}

// ---------------------------------------------------------------------------------------------
// Cuerpo de POST /api/me/visitas
// ---------------------------------------------------------------------------------------------

export interface DatosEnvio {
  punto: (Punto & { precision?: number | null }) | null
  checked_in_at: string
  reported_at: string
  /** Solo por voz: la transcripción (hasta 8.000 caracteres). */
  transcript: string | null
}

const textoONulo = (texto: string, max: number) => {
  const limpio = texto.trim()
  return limpio ? limpio.slice(0, max) : null
}

/** Arma el cuerpo de la visita. Lanza si la tarjeta está incompleta (validarla antes con validarBorrador). */
export function cuerpoDesdeBorrador(borrador: Borrador, datos: DatosEnvio): VisitaCreate {
  if (!borrador.tipo || !borrador.sede_id) throw new Error('La visita está incompleta')
  const punto = datos.punto && esPunto(datos.punto.lat, datos.punto.lng) ? datos.punto : null
  // Telefónica: la ubicación del teléfono no viaja (la ejecutiva puede estar en su casa; el servidor no la usa).
  const ubicacion = borrador.modalidad === 'presencial' ? punto : null
  const precision = ubicacion?.precision
  const base = {
    client_id: borrador.client_id,
    sede_id: borrador.sede_id,
    efectiva: borrador.efectiva,
    failure_reason: borrador.efectiva ? null : textoONulo(borrador.failure_reason, MAX_FAILURE_REASON),
    retry_date: null,
    checked_in_at: datos.checked_in_at,
    reported_at: datos.reported_at,
    lat: ubicacion ? ubicacion.lat : null,
    lng: ubicacion ? ubicacion.lng : null,
    gps_accuracy_m: precision !== null && precision !== undefined && Number.isFinite(precision) ? Math.round(precision) : null,
    conclusion: textoONulo(borrador.conclusion, MAX_CONCLUSION),
    compromisos: textoONulo(borrador.compromisos, MAX_COMPROMISOS),
    next_step_date: esFechaIso(borrador.next_step_date.trim()) ? borrador.next_step_date.trim() : null,
    transcript: borrador.origen === 'voz' ? textoONulo(borrador.transcript ?? datos.transcript ?? '', MAX_TRANSCRIPT) : null,
    input_mode: borrador.origen,
    lineas: [...borrador.lineas],
  }
  let tipo: { tipo: 'medica'; medico_id: string; cuenta_id: null; subtipo_id: null; contacto_id: null } | { tipo: 'institucional'; medico_id: null; cuenta_id: string; subtipo_id: string; contacto_id: string | null }
  if (borrador.tipo === 'medica') {
    if (!borrador.medico_id) throw new Error('Elige el médico')
    tipo = { tipo: 'medica', medico_id: borrador.medico_id, cuenta_id: null, subtipo_id: null, contacto_id: null }
  } else {
    if (!borrador.cuenta_id || !borrador.subtipo_id) throw new Error('Elige la cuenta y el subtipo')
    tipo = { tipo: 'institucional', medico_id: null, cuenta_id: borrador.cuenta_id, subtipo_id: borrador.subtipo_id, contacto_id: borrador.contacto_id }
  }
  if (borrador.modalidad === 'presencial') {
    if (!punto) throw new Error(MENSAJE_SIN_UBICACION_PRESENCIAL)
    return { ...base, ...tipo, modalidad: 'presencial', lat: punto.lat, lng: punto.lng, medio: null }
  }
  if (!borrador.medio) throw new Error('Indica el medio: llamada o videollamada')
  return { ...base, ...tipo, modalidad: 'telefonica', medio: borrador.medio }
}

/** Texto corto para la cola y el resultado ("Médica · Dra. Ana Gómez · Clínica Norte"). Nunca documentos. */
export function resumenBorrador(borrador: Borrador, catalogo: Catalogo): string {
  const partes: string[] = [borrador.tipo ? ETIQUETA_TIPO_VISITA[borrador.tipo] : 'Visita']
  if (borrador.tipo === 'medica') {
    const medico = borrador.medico_id ? catalogo.medicos.find(m => m.id === borrador.medico_id) : undefined
    partes.push(medico?.nombre ?? borrador.medico_nombre_dicho ?? 'Médico')
  } else if (borrador.tipo === 'institucional') {
    const cuenta = cuentasDelCatalogo(catalogo).find(c => c.id === borrador.cuenta_id)
    const subtipo = catalogo.subtipos.find(s => s.id === borrador.subtipo_id)
    partes.push([cuenta?.nombre, subtipo?.nombre].filter(Boolean).join(' · ') || 'Cuenta')
  }
  if (borrador.sede_id) partes.push(nombreSede(borrador.sede_id, catalogo))
  if (borrador.modalidad === 'telefonica') partes.push('telefónica')
  if (!borrador.efectiva) partes.push('no efectiva')
  return partes.join(' · ')
}

// ---------------------------------------------------------------------------------------------
// Errores de la API al confirmar: qué se le ofrece a la persona
// ---------------------------------------------------------------------------------------------

export type ClaseRechazo = 'radio' | 'sede_sin_ubicacion' | 'telefonica' | 'tope_medico' | 'perfil' | 'solo_hoy' | 'lineas' | 'otro'

export interface Rechazo {
  clase: ClaseRechazo
  mensaje: string
  /** Fuera del radio: metros a la sede y radio vigente (leídos del mensaje del servidor). */
  distancia_m: number | null
  radio_m: number | null
}

const RADIO_RE = /Estás a (\d+) m de (.+); el radio es (\d+) m/

/** Clasifica un rechazo de POST /api/me/visitas (o de validarBorrador) para ofrecer la salida correcta. */
export function interpretarRechazo(error: { message: string; errores?: readonly ErrorVisita[] }): Rechazo {
  const mensajes = [...(error.errores ?? []).map(e => e.mensaje), error.message]
  const campos = (error.errores ?? []).map(e => e.campo)
  for (const mensaje of mensajes) {
    const radio = RADIO_RE.exec(mensaje)
    if (radio) return { clase: 'radio', mensaje, distancia_m: Number(radio[1]), radio_m: Number(radio[3]) }
  }
  const con = (texto: string) => mensajes.find(m => m.includes(texto))
  const primero = mensajes[0] ?? error.message
  const sinUbicacion = con('no tiene ubicación')
  if (sinUbicacion) return { clase: 'sede_sin_ubicacion', mensaje: sinUbicacion, distancia_m: null, radio_m: null }
  const perfil = con('Tu perfil no incluye')
  if (perfil) return { clase: 'perfil', mensaje: perfil, distancia_m: null, radio_m: null }
  const tope = con(MENSAJE_TOPE_MEDICO)
  if (tope) return { clase: 'tope_medico', mensaje: tope, distancia_m: null, radio_m: null }
  const telefonica = con('telefónica') ?? (campos.includes('modalidad') || campos.includes('medio') ? primero : undefined)
  if (telefonica) return { clase: 'telefonica', mensaje: telefonica, distancia_m: null, radio_m: null }
  const hoy = con(MENSAJE_SOLO_HOY)
  if (hoy) return { clase: 'solo_hoy', mensaje: hoy, distancia_m: null, radio_m: null }
  const lineas = con(MENSAJE_LINEAS_AJENAS) ?? (campos.includes('lineas') ? primero : undefined)
  if (lineas) return { clase: 'lineas', mensaje: lineas, distancia_m: null, radio_m: null }
  return { clase: 'otro', mensaje: primero, distancia_m: null, radio_m: null }
}

/** Fuera del radio, ¿se puede ofrecer la telefónica? (habilitada y con cupo hoy; misma cuenta que validarBorrador). */
export function puedeOfrecerTelefonica(catalogo: Catalogo, visitasHoy?: readonly VisitaHoyTope[] | null, clientId?: string | null): boolean {
  const { habilitada, tope_dia, medios } = catalogo.config.telefonica
  if (!habilitada || medios.length === 0) return false
  return telefonicasDeHoy(catalogo, visitasHoy, clientId) < tope_dia
}

/** "Estás a 820 m de Clínica Norte (el radio es 500 m)" con la distancia legible. */
export function textoRechazoRadio(rechazo: Rechazo, sede: string): string {
  if (rechazo.clase !== 'radio' || rechazo.distancia_m === null || rechazo.radio_m === null) return rechazo.mensaje
  return `Estás a ${textoDistancia(rechazo.distancia_m)} de ${sede} (el radio es ${textoDistancia(rechazo.radio_m)}).`
}

// ---------------------------------------------------------------------------------------------
// Corregir el mismo día (PATCH /api/me/visitas/[id])
// ---------------------------------------------------------------------------------------------

/** Lo que la ejecutiva puede corregir de su visita el mismo día (decisión 10). */
export interface ValoresVisita {
  efectiva: boolean
  failure_reason: string
  conclusion: string
  compromisos: string
  /** AAAA-MM-DD o ''. */
  next_step_date: string
  lineas: string[]
}

export function valoresDeVisita(visita: VisitaItem): ValoresVisita {
  return {
    efectiva: visita.efectiva,
    failure_reason: visita.failure_reason ?? '',
    conclusion: visita.conclusion ?? '',
    compromisos: visita.compromisos ?? '',
    next_step_date: visita.next_step_date ?? '',
    lineas: [...visita.lineas],
  }
}

/**
 * Solo lo que cambió, como lo espera PATCH (textos vacíos → null). Pasar a no efectiva manda siempre el motivo
 * (visitaUpdateSchema lo exige); pasar a efectiva no lo manda (la base lo borra).
 */
export function cambiosDeVisita(visita: VisitaItem, valores: ValoresVisita): VisitaUpdate {
  const texto = (valor: string) => (valor.trim() ? valor.trim() : null)
  const cambios: VisitaUpdate = {}
  if (valores.efectiva !== visita.efectiva) cambios.efectiva = valores.efectiva
  if (!valores.efectiva && (valores.efectiva !== visita.efectiva || texto(valores.failure_reason) !== visita.failure_reason)) {
    cambios.failure_reason = texto(valores.failure_reason)
  }
  if (texto(valores.conclusion) !== visita.conclusion) cambios.conclusion = texto(valores.conclusion)
  if (texto(valores.compromisos) !== visita.compromisos) cambios.compromisos = texto(valores.compromisos)
  if (texto(valores.next_step_date) !== visita.next_step_date) cambios.next_step_date = texto(valores.next_step_date)
  const lineas = [...valores.lineas].sort()
  if (lineas.join(',') !== [...visita.lineas].sort().join(',')) cambios.lineas = lineas
  return cambios
}

// ---------------------------------------------------------------------------------------------
// Corregir hablando: lo ya confirmado no se vuelve a proponer
// ---------------------------------------------------------------------------------------------

const normalizarNombre = (texto: string | null | undefined) =>
  (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * ¿Es la misma visita? Médica: el mismo médico (o el mismo nombre dicho, aunque una ya tenga el médico creado).
 * Institucional: la misma cuenta y el mismo subtipo.
 */
export function mismaVisita(a: Borrador, b: Borrador): boolean {
  if (!a.tipo || a.tipo !== b.tipo) return false
  if (a.tipo === 'medica') {
    if (a.medico_id && b.medico_id) return a.medico_id === b.medico_id
    const nombreA = normalizarNombre(a.medico_nombre_dicho ?? a.nombre_dicho_original)
    const nombreB = normalizarNombre(b.medico_nombre_dicho ?? b.nombre_dicho_original)
    return nombreA !== '' && nombreA === nombreB
  }
  return !!a.cuenta_id && a.cuenta_id === b.cuenta_id && !!a.subtipo_id && a.subtipo_id === b.subtipo_id
}

/**
 * Al corregir hablando, la propuesta nueva sale de TODO lo dictado (lo de antes + la corrección): las visitas que ya
 * se confirmaron en este reporte vuelven a aparecer. Se descartan aquí para no guardarlas dos veces (cada tarjeta
 * nueva tiene otro client_id: el servidor no las vería repetidas y la institucional sumaría doble).
 */
export function descartarYaConfirmadas(nuevos: readonly Borrador[], confirmadas: readonly Borrador[]): { quedan: Borrador[]; descartadas: number } {
  const quedan = nuevos.filter(nuevo => !confirmadas.some(confirmada => mismaVisita(nuevo, confirmada)))
  return { quedan, descartadas: nuevos.length - quedan.length }
}

// ---------------------------------------------------------------------------------------------
// Reportar de nuevo una visita que el servidor no aceptó (desde la cola)
// ---------------------------------------------------------------------------------------------

/**
 * La tarjeta de una visita que quedó "no enviada" por un rechazo del servidor (tope, perfil, lejos…), para corregirla
 * en Reportar sin perder lo escrito: mismo tipo, médico o cuenta, sede, contacto, resultado, conclusión, compromisos,
 * próxima reunión, líneas y transcripción, con un client_id nuevo. Lo que ya no está en el catálogo (otra sede, un
 * médico que no es suyo) se limpia y se vuelve a elegir.
 */
export function borradorDesdeCuerpo(cuerpo: VisitaCreate, catalogo: Catalogo, opciones: OpcionesBorrador): Borrador {
  const borrador: Borrador = {
    clave: opciones.nuevoId(),
    client_id: opciones.nuevoId(),
    origen: cuerpo.input_mode,
    tipo: cuerpo.tipo,
    subtipo_id: cuerpo.subtipo_id,
    medico_id: cuerpo.medico_id,
    medico_nombre_dicho: null,
    sugerir_crear_medico: false,
    cuenta_id: cuerpo.cuenta_id,
    sede_id: cuerpo.sede_id,
    contacto_id: cuerpo.contacto_id,
    contacto_nombre_dicho: null,
    lineas: [...cuerpo.lineas],
    efectiva: cuerpo.efectiva,
    failure_reason: cuerpo.failure_reason ?? '',
    conclusion: cuerpo.conclusion ?? '',
    compromisos: cuerpo.compromisos ?? '',
    next_step_date: cuerpo.next_step_date ?? '',
    modalidad: cuerpo.modalidad,
    medio: cuerpo.medio,
    preguntas: [],
    confianza: null,
    transcript: cuerpo.transcript,
  }
  return normalizar(borrador, catalogo)
}

// ---------------------------------------------------------------------------------------------
// Reportar al volver a la pestaña: ¿llegada nueva o el mismo reporte?
// ---------------------------------------------------------------------------------------------

/** Pasado este tiempo desde la llegada, volver a Reportar empieza una llegada nueva aunque haya tarjetas sin confirmar. */
export const REINICIO_REPORTE_MS = 10 * 60_000

/**
 * Reportar queda montado (es una pestaña): al volver a ella, la llegada, el punto y las sedes NO pueden ser los de la
 * primera vez. Se empieza de nuevo salvo que esté grabando o esperando a la IA, que vuelva de crear un médico o una
 * sede que pidió, o que haya tarjetas sin confirmar de una llegada de hace menos de REINICIO_REPORTE_MS.
 */
export function debeReiniciarReporte(estado: {
  /** Instante de la llegada actual (ISO). */
  llegada: string
  ahora: Date
  /** Tarjetas sin confirmar. */
  borradores: number
  /** Grabando, transcribiendo o armando la propuesta. */
  ocupada: boolean
  /** Reportar mandó a Nuevo médico o Nueva sede y esto es la vuelta. */
  esperandoCreacion: boolean
}): boolean {
  if (estado.ocupada || estado.esperandoCreacion) return false
  const llegadaMs = Date.parse(estado.llegada)
  if (Number.isNaN(llegadaMs)) return true
  let mismoDia = false
  try {
    mismoDia = fechaBogota(estado.llegada) === hoyBogota(estado.ahora)
  } catch {
    mismoDia = false
  }
  if (!mismoDia || estado.borradores === 0) return true
  return estado.ahora.getTime() - llegadaMs > REINICIO_REPORTE_MS
}

// ---------------------------------------------------------------------------------------------
// Contexto guardado para reportar sin señal
// ---------------------------------------------------------------------------------------------

export const VERSION_CONTEXTO_GUARDADO = 1

/** El último GET/POST /api/me/contexto que respondió, guardado en el teléfono (sin documentos ni teléfonos). */
export interface ContextoGuardado {
  version: typeof VERSION_CONTEXTO_GUARDADO
  usuario_id: string
  /** Día en Bogotá en que se guardó: solo sirve ese día (la configuración, la meta y los topes son del día). */
  fecha: string
  guardado_at: string
  contexto: ContextoResponse
}

export function contextoParaGuardar(usuarioId: string, contexto: ContextoResponse, ahora: Date = new Date()): ContextoGuardado {
  return { version: VERSION_CONTEXTO_GUARDADO, usuario_id: usuarioId, fecha: hoyBogota(ahora), guardado_at: ahora.toISOString(), contexto }
}

/** El contexto guardado si es de esta persona y de hoy (en Bogotá); si no, null. */
export function contextoUsable(guardado: unknown, usuarioId: string | null, ahora: Date = new Date()): ContextoGuardado | null {
  if (!usuarioId || !guardado || typeof guardado !== 'object') return null
  const g = guardado as Partial<ContextoGuardado>
  if (g.version !== VERSION_CONTEXTO_GUARDADO || g.usuario_id !== usuarioId || g.fecha !== hoyBogota(ahora)) return null
  const c = g.contexto as Partial<ContextoResponse> | undefined
  if (!c || !c.ejecutiva || !c.config || !Array.isArray(c.sedes_cerca) || !Array.isArray(c.mis_medicos) || !Array.isArray(c.subtipos) || !Array.isArray(c.contactos)) return null
  return g as ContextoGuardado
}

// ---------------------------------------------------------------------------------------------
// Terceros que entran al catálogo durante el reporte (buscador, médico creado, cuenta buscada)
// ---------------------------------------------------------------------------------------------

/**
 * Médico del buscador (sin documento) → opción del catálogo, con la distancia de sus sedes si están cerca. Las que no
 * están en el catálogo quedan con la distancia "desconocida" (no se sabe si tienen coordenadas): no se bloquean con un
 * "sin ubicación" falso y decide el servidor al confirmar.
 */
export function medicoDesdeBusqueda(medico: MedicoPublico, catalogo: Catalogo): MedicoOpcion {
  const propio = catalogo.medicos.find(m => m.id === medico.id)
  if (propio) return propio
  return {
    id: medico.id,
    nombre: medico.nombre,
    especialidades: [...medico.especialidades],
    lineas: [],
    sedes: medico.sedes.map(sede => {
      const cercana = catalogo.sedes.find(s => s.id === sede.id)
      return {
        id: sede.id,
        nombre: sede.nombre,
        cuenta_nombre: sede.cuenta_nombre ?? null,
        distancia_m: cercana?.distancia_m ?? null,
        coordenadas_desconocidas: !cercana,
      }
    }),
    propio: false,
  }
}

/**
 * El médico creado (o el existente que se eligió) como opción de Reportar, sin documento. `distancias`: lo que se sabe
 * de cada sede (las cercanas del pedido y las elegidas en Nuevo médico, p. ej. el consultorio recién creado con el GPS
 * de aquí: 0 m). Las demás quedan "desconocidas": el servidor decide si está en el radio (nunca el falso "esta sede no
 * tiene ubicación").
 */
export function medicoParaReportar(medico: MedicoPublico, distancias: ReadonlyMap<string, number | null> = new Map()): MedicoOpcion {
  return {
    id: medico.id,
    nombre: medico.nombre,
    especialidades: [...medico.especialidades],
    lineas: [],
    sedes: medico.sedes.map(sede => {
      const distancia = distancias.get(sede.id)
      return {
        id: sede.id,
        nombre: sede.nombre,
        cuenta_nombre: sede.cuenta_nombre ?? null,
        distancia_m: distancia ?? null,
        coordenadas_desconocidas: distancia === undefined || distancia === null,
      }
    }),
    propio: false,
  }
}

/** Sedes de una cuenta traída del buscador → opciones del catálogo: solo las activas (el servidor rechaza las demás). */
export function sedesDeCuentaBuscada(item: { id: string; nombre: string; clase: string | null }, sedes: readonly SedeCreada[]): SedeOpcion[] {
  return sedes
    .filter(sede => sede.activo !== false)
    .map(sede => ({
      id: sede.id,
      nombre: sede.nombre,
      cuenta_id: item.id,
      cuenta_nombre: item.nombre,
      cuenta_clase: item.clase,
      lat: sede.lat === null ? null : Number(sede.lat),
      lng: sede.lng === null ? null : Number(sede.lng),
      distancia_m: null,
      ubicacion_confirmada: sede.ubicacion_confirmada,
    }))
}

/** Del detalle de una cuenta, la sede que sirve de consultorio: la principal si está activa; si no, la primera activa. */
export function sedeConsultorio(sedes: readonly SedeCreada[]): SedeCreada | null {
  const activas = sedes.filter(sede => sede.activo !== false)
  return activas.find(sede => sede.es_principal) ?? activas[0] ?? null
}
