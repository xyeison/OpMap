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
 * - F4.1 (agenda, spec 2026-10-14): Reportar empieza por el sitio (la cita de hoy o la sede); la cita elegida arma el
 *   borrador (tipo, médico o cuenta y subtipo, sede y agenda_id); el dictado de un campo se AÑADE a lo escrito.
 */
import { esFechaIso, fechaBogota, hoyBogota } from './fechas'
import { esPunto, haversineM, textoDistancia, type Punto } from './geo'
import type {
  CamposDictadoResponse,
  CitaCreateBase,
  CitaCreateTipo,
  CitaItem,
  ComoPersona,
  ConfigContexto,
  ContactoContexto,
  ContextoResponse,
  ErrorVisita,
  LineaEjecutiva,
  MarcaVisita,
  MedicoNoListado,
  MedioTelefonica,
  Modalidad,
  MedicoPublico,
  ModoEntrada,
  MotivoNoEfectiva,
  PropuestaResponse,
  SedeCreada,
  SedeDeMedico,
  SubtipoContexto,
  TipoVisita,
  VisitaCreate,
  VisitaItem,
  VisitaPropuesta,
  VisitaUpdate,
} from './tipos'
import { DIAS_MAX_ATRAS, ETIQUETA_TIPO_VISITA, MAX_NOTA_CITA, PRECISION_BAJA_M } from './tipos'

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
/** El mismo texto del servidor (web/lib/reporte-visitas.ts): la visita institucional lleva contacto (2026-10-30). */
export const MENSAJE_CONTACTO_OBLIGATORIO = 'Elige el contacto de la visita institucional'
export const MENSAJE_LINEAS_AJENAS = 'Alguna de las líneas no es tuya'
export const MENSAJE_SIN_UBICACION_PRESENCIAL = 'La ubicación del teléfono es obligatoria en una visita presencial'
export const MENSAJE_FAILURE = `Indica el motivo de la visita no efectiva (hasta ${MAX_FAILURE_REASON} caracteres)`
/** 0940: con la lista cerrada, el motivo se elige de ella (o "Otro" con texto). */
export const MENSAJE_MOTIVO_LISTA = 'Elige el motivo de la visita no efectiva'
export const MENSAJE_MEDICO_NO_LISTADO_SIN_NOMBRE = 'Escribe el nombre del médico no listado'
/** Código del motivo "Otro" en motivos_no_efectiva (0940): admite texto libre. */
export const MOTIVO_OTRO = 'otro'
/** Aviso de habeas data que ve la persona al reportar (la ubicación se toma solo al confirmar, nunca en segundo plano). */
export const AVISO_HABEAS_DATA = 'Cada reporte guarda tu ubicación, la hora y la precisión del GPS solo en el momento de confirmar. Nunca en segundo plano.'
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
export const AVISO_EN_COLA = 'Sin señal: quedó guardada en el teléfono y se sube sola al volver la señal (también al abrir la app).'

/**
 * Aviso de la tarjeta cuando ella NO es visitante del médico (contrato, reglas del dueño): la visita suma igual a su
 * meta, queda marcada out_of_territory y la app le ofrece "pedir ser su visitante". En F3 queda la marca y la
 * asignación la hace quien tiene visitantes:manage (el administrador o la dirección comercial, dueño 2026-10-29), así
 * que el aviso le dice a quién pedirlo; dejar la solicitud registrada en OpMap (botón y lista) es de F5.
 */
export const AVISO_NO_VISITANTE =
  'No eres su visitante: la visita suma igual y queda marcada "fuera de tu territorio". Pide a la dirección comercial que te asigne como su visitante.'

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
  /**
   * Sede que entró al catálogo solo por una cita de hoy (no está entre las cercanas): sirve para la tarjeta de esa
   * cita, pero no se lista en "Visita no agendada" (esa lista es la de las sedes a menos de 1 km).
   */
  de_agenda?: boolean
}

export interface SedeDeMedicoOpcion {
  id: string
  nombre: string
  cuenta_nombre: string | null
  distancia_m: number | null
  /** 0940: la cuenta y las coordenadas si el servidor las mandó (para medir aquí y elegir la sede sin señal). */
  cuenta_id?: string | null
  lat?: number | null
  lng?: number | null
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
  /** 0940: motivos de la no efectiva (lista cerrada). Vacío con un servidor o un contexto guardado anteriores: texto libre. */
  motivos: MotivoNoEfectiva[]
}

export interface ExtrasCatalogo {
  sedes?: readonly SedeOpcion[]
  medicos?: readonly MedicoOpcion[]
  /** Los creados en Nuevo contacto (o el que ya estaba, del 409) en este reporte. */
  contactos?: readonly ContactoContexto[]
}

/**
 * Une el contexto con lo creado o buscado en este reporte (sin repetir ids; lo del contexto manda). Con `punto`,
 * las distancias de las sedes con coordenadas se recalculan desde ahí (el contexto pudo cargarse en otro punto).
 * `sinSenal`: el contexto es el guardado (otro punto, otra hora): las distancias de las sedes de los médicos ya no
 * valen y quedan "desconocidas" (decide el servidor al enviar la cola), salvo las de sedes con coordenadas.
 * `distanciasDeOtroPunto`: lo mismo para las sedes de los médicos cuando el contexto se pidió con un punto lejos de
 * `punto` (Reportar: la final se alejó de la primera y aún no llega el contexto pedido con ella, o no llegó): esas
 * distancias las midió el servidor desde el otro punto y no se pueden volver a medir aquí.
 *
 * F4.1: las citas de hoy (contexto.agenda_hoy) también entran: su sede (con sus coordenadas, aunque esté a más de 1 km)
 * y su médico (si no es de "mis médicos", como uno traído del buscador: fuera de su territorio). Así la tarjeta de la
 * cita y lo que proponga la IA con esa cita (decisión 51) se pueden elegir y validar aquí.
 */
export function catalogoDesdeContexto(
  contexto: ContextoResponse,
  extras: ExtrasCatalogo = {},
  punto: Punto | null = null,
  opciones: { sinSenal?: boolean; distanciasDeOtroPunto?: boolean } = {}
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
  // El contexto guardado antes de la 0840 no trae agenda_hoy: sin citas.
  const citas = Array.isArray(contexto.agenda_hoy) ? contexto.agenda_hoy : []
  for (const cita of citas) {
    if (cita.estado === 'cancelada' || sedes.some(sede => sede.id === cita.sede.id)) continue
    sedes.push({
      id: cita.sede.id,
      nombre: cita.sede.nombre,
      cuenta_id: cita.sede.cuenta_id,
      cuenta_nombre: cita.sede.cuenta_nombre,
      cuenta_clase: null,
      lat: cita.sede.lat,
      lng: cita.sede.lng,
      distancia_m: opciones.sinSenal ? null : cita.distancia_m,
      ubicacion_confirmada: cita.sede.ubicacion_confirmada,
      de_agenda: true,
    })
  }
  for (const extra of extras.sedes ?? []) if (!sedes.some(sede => sede.id === extra.id)) sedes.push({ ...extra })
  if (punto && esPunto(punto.lat, punto.lng)) {
    for (const sede of sedes) {
      if (esPunto(sede.lat, sede.lng)) sede.distancia_m = haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number })
    }
  }
  // 0940: las sedes de los médicos traen coordenadas: con el punto, la distancia se mide AQUÍ (también sin señal, con el
  // contexto guardado); sin coordenadas (servidor anterior) queda la regla de antes (desconocida: decide el servidor).
  const medirDesdeAqui = (sede: SedeDeMedico): SedeDeMedicoOpcion | null => {
    if (!punto || !esPunto(punto.lat, punto.lng) || !esPunto(sede.lat, sede.lng)) return null
    return { ...sede, distancia_m: haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number }), coordenadas_desconocidas: false }
  }
  const medicos: MedicoOpcion[] = contexto.mis_medicos.map(medico => ({
    id: medico.id,
    nombre: medico.nombre,
    especialidades: medico.especialidades,
    lineas: medico.lineas,
    sedes: medico.sedes.map(sede =>
      medirDesdeAqui(sede) ?? (opciones.sinSenal || opciones.distanciasDeOtroPunto ? { ...sede, distancia_m: null, coordenadas_desconocidas: true } : { ...sede })
    ),
    propio: true,
  }))
  // 0940: las sedes de mis médicos también se pueden ELEGIR sin señal (institucional o "no agendada"), con sus coordenadas.
  for (const medico of contexto.mis_medicos) {
    for (const sede of medico.sedes) {
      if (sedes.some(s => s.id === sede.id) || !esPunto(sede.lat, sede.lng)) continue
      sedes.push({
        id: sede.id,
        nombre: sede.nombre,
        cuenta_id: sede.cuenta_id ?? null,
        cuenta_nombre: sede.cuenta_nombre,
        cuenta_clase: null,
        lat: sede.lat,
        lng: sede.lng,
        distancia_m: punto && esPunto(punto.lat, punto.lng) ? haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number }) : null,
        ubicacion_confirmada: null,
        de_agenda: true,
      })
    }
  }
  for (const cita of citas) {
    if (cita.estado === 'cancelada' || cita.tipo !== 'medica' || !cita.medico) continue
    // La sede de la cita ya está en `sedes` con sus coordenadas: distanciaASede la mide desde ahí.
    const deLaCita: SedeDeMedicoOpcion = {
      id: cita.sede.id,
      nombre: cita.sede.nombre,
      cuenta_nombre: cita.sede.cuenta_nombre,
      distancia_m: sedes.find(s => s.id === cita.sede.id)?.distancia_m ?? null,
    }
    const existente = medicos.find(m => m.id === cita.medico?.id)
    if (existente) {
      if (!existente.sedes.some(s => s.id === deLaCita.id)) existente.sedes.push(deLaCita)
    } else {
      medicos.push({ id: cita.medico.id, nombre: cita.medico.nombre, especialidades: [], lineas: [], sedes: [deLaCita], propio: false })
    }
  }
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
    contactos: [...contexto.contactos, ...(extras.contactos ?? []).filter(extra => !contexto.contactos.some(c => c.id === extra.id))],
    subtipos: contexto.subtipos,
    motivos: Array.isArray(contexto.motivos_no_efectiva) ? contexto.motivos_no_efectiva : [],
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
  /**
   * Cita de la agenda que cumple esta visita (F4.1): la elegida en el paso 1. null = no se eligió; el servidor vincula
   * sola la cita pendiente de hoy con el mismo médico o cuenta. Se suelta al cambiar el tipo, el médico o la cuenta.
   */
  agenda_id: string | null
  /**
   * 0940 (app sin señal): médico que no está en OpMap, escrito aquí (nombre y especialidad); va en vez de medico_id y la
   * visita queda 'medico_por_validar'. Sin el dato (borradores guardados antes): null.
   */
  medico_no_listado?: MedicoNoListado | null
  /** 0940: motivo de la lista cerrada de la no efectiva (código); null = texto libre en failure_reason. */
  motivo_codigo?: string | null
  /** 0940: la foto comprimida (1600 px, JPEG 70 %), lista para la cola de fotos; null sin foto. */
  foto?: FotoBorrador | null
}

/** La foto de la tarjeta (lib/foto.ts la produce; aquí solo se describe para no depender de Expo). */
export interface FotoBorrador {
  /** URI local para la vista previa (archivo en el teléfono o blob: en el navegador). */
  uri: string
  ancho: number
  alto: number
  bytes: number
  /** Solo en el navegador: el JPEG para IndexedDB. */
  blob: Blob | null
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
    agenda_id: null,
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
    agenda_id: null,
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
      // 0940: con un médico de OpMap elegido, el "médico no listado" sobra.
      siguiente = { ...siguiente, medico_nombre_dicho: null, sugerir_crear_medico: false, medico_no_listado: null }
      if (siguiente.lineas.length === 0) siguiente = { ...siguiente, lineas: lineasPorDefecto(catalogo, medico) }
    }
  }
  // 0940: escribir el médico no listado quita el de OpMap (son excluyentes); la sede se conserva (es la IPS).
  if (cambios.medico_no_listado !== undefined && cambios.medico_no_listado) {
    siguiente = { ...siguiente, medico_id: null, medico_nombre_dicho: null, sugerir_crear_medico: false }
  }
  if (cambios.efectiva === true) siguiente = { ...siguiente, motivo_codigo: null }
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
  // La cita es con ese médico o esa cuenta: si cambia con quién fue (o el tipo), ya no es esa cita (el servidor la
  // rechazaría con "Esa cita es con otro médico"). La sede y el subtipo sí pueden cambiar (decisión 42).
  if (siguiente.agenda_id && cambios.agenda_id === undefined) {
    const otroTipo = cambios.tipo !== undefined && cambios.tipo !== borrador.tipo
    const otroMedico = cambios.medico_id !== undefined && cambios.medico_id !== borrador.medico_id
    const otraCuenta = cambios.cuenta_id !== undefined && cambios.cuenta_id !== borrador.cuenta_id
    if (otroTipo || otroMedico || otraCuenta) siguiente = { ...siguiente, agenda_id: null }
  }
  return normalizar(siguiente, catalogo)
}

/** Quita lo que no cuadra y completa lo que se deduce (cuenta de la sede, sede única del médico…). */
function normalizar(borrador: Borrador, catalogo: Catalogo, opciones: { sedePreferida?: string | null } = {}): Borrador {
  let b = { ...borrador }
  if (b.tipo === 'medica') {
    const medico = b.medico_id ? catalogo.medicos.find(m => m.id === b.medico_id) : undefined
    if (b.medico_id && !medico) b = { ...b, medico_id: null }
    b = { ...b, cuenta_id: null, subtipo_id: null, contacto_id: null, contacto_nombre_dicho: null }
    // 0940: el médico no listado solo vale sin médico de OpMap y con nombre.
    if (b.medico_no_listado && (medico || !b.medico_no_listado.nombre.trim())) b = { ...b, medico_no_listado: null }
    if (!medico && b.medico_no_listado) {
      // Con el médico no listado la sede es cualquier IPS conocida (no hay "sedes del médico").
      if (b.sede_id && !sedeConocida(b.sede_id, catalogo)) b = { ...b, sede_id: null }
      if (!b.sede_id && opciones.sedePreferida && sedeConocida(opciones.sedePreferida, catalogo)) b = { ...b, sede_id: opciones.sedePreferida }
    } else if (medico) {
      const sedesMedico = medico.sedes.map(s => s.id)
      if (b.sede_id && !sedesMedico.includes(b.sede_id)) b = { ...b, sede_id: null }
      if (!b.sede_id) {
        const preferida = opciones.sedePreferida && sedesMedico.includes(opciones.sedePreferida) ? opciones.sedePreferida : null
        const cercana = ordenarPorDistanciaNula(sedesDelMedico(medico, catalogo).map(s => ({ ...s })))[0]
        const dentro = cercana && cercana.distancia_m !== null && cercana.distancia_m <= catalogo.config.radio_m ? cercana.id : null
        b = { ...b, sede_id: preferida ?? dentro ?? (sedesMedico.length === 1 ? sedesMedico[0] : null) }
      }
    } else {
      if (b.sede_id && !catalogo.sedes.some(s => s.id === b.sede_id)) b = { ...b, sede_id: null }
      // 0940: empezó por el sitio y todavía no hay médico: la IPS elegida se conserva (le sirve al médico no listado; al
      // elegir un médico de OpMap se revisa contra sus sedes, como siempre).
      if (!b.sede_id && opciones.sedePreferida && catalogo.sedes.some(s => s.id === opciones.sedePreferida)) b = { ...b, sede_id: opciones.sedePreferida }
    }
  } else if (b.tipo === 'institucional') {
    b = { ...b, medico_id: null, medico_nombre_dicho: null, sugerir_crear_medico: false, medico_no_listado: null }
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
  // 0940: un motivo que ya no está en la lista se descarta (queda el texto, si lo hay); efectiva no lleva motivo.
  if (b.motivo_codigo && (b.efectiva || (catalogo.motivos.length > 0 && !catalogo.motivos.some(m => m.codigo === b.motivo_codigo)))) b = { ...b, motivo_codigo: null }
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
  /** Ubicación del teléfono (null si no la dio), con su precisión si se sabe (0940: para las marcas). */
  punto: (Punto & { precision?: number | null }) | null
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
  /** 0940: las marcas que el servidor dejará con lo que se sabe aquí (marcasPrevistas). Nunca bloquean. */
  marcas: MarcaVisita[]
  /** 0940: (distancia − precisión) ≤ radio; null sin distancia conocida. */
  en_sitio: boolean | null
}

/**
 * ESPEJO de marcasDeVisita de web/lib/reporte-visitas.ts con lo que la app sabe antes de confirmar: la distancia a la
 * sede según el teléfono (si se conoce), la precisión del GPS, si hay GPS, si la sede tiene coordenadas, la fecha de la
 * visita frente a hoy (más de DIAS_MAX_ATRAS días → hora inconsistente) y si va con médico no listado. La hora del
 * teléfono frente al reloj del servidor la decide el servidor. Puro.
 */
export function marcasPrevistas(borrador: Borrador, catalogo: Catalogo, entrada: EntradaValidacion): { marcas: MarcaVisita[]; distancia_m: number | null; en_sitio: boolean | null } {
  const marcas: MarcaVisita[] = []
  try {
    const fecha = fechaBogota(entrada.checked_in_at)
    const limite = restarDias(hoyBogota(entrada.ahora), DIAS_MAX_ATRAS)
    if (fecha < limite) marcas.push('hora_inconsistente')
  } catch {
    // hora ilegible: la revisa el servidor
  }
  if (borrador.tipo === 'medica' && !borrador.medico_id && borrador.medico_no_listado?.nombre.trim()) marcas.push('medico_por_validar')
  let distancia_m: number | null = null
  let en_sitio: boolean | null = null
  if (borrador.modalidad === 'presencial') {
    const conGps = !!entrada.punto && esPunto(entrada.punto.lat, entrada.punto.lng)
    // La base redondea la precisión a metros enteros: aquí igual.
    const precisionCruda = entrada.punto?.precision ?? null
    const precision = precisionCruda === null || !Number.isFinite(precisionCruda) ? null : Math.round(precisionCruda)
    if (!conGps) marcas.push('sin_ubicacion')
    else if (precision !== null && precision !== undefined && precision > PRECISION_BAJA_M) marcas.push('precision_baja')
    if (borrador.sede_id) {
      if (sedeSinCoordenadas(borrador.sede_id, catalogo)) marcas.push('ips_sin_coordenadas')
      else if (conGps) {
        // Sin GPS no hay distancia (la del catálogo se midió desde otro punto): el servidor tampoco la calcula.
        const distancia = distanciaASede(borrador, catalogo, entrada.punto)
        if (distancia.distancia_m !== null) {
          distancia_m = distancia.distancia_m
          en_sitio = Math.max(distancia_m - (precision ?? 0), 0) <= catalogo.config.radio_m
          if (!en_sitio) marcas.push('lejos_de_ips')
        }
      }
    }
  }
  return { marcas, distancia_m, en_sitio }
}

/** AAAA-MM-DD menos n días (fechas de calendario). */
function restarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10)
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

/** 0940: ¿se SABE que la sede no tiene coordenadas? (distinto de "no se sabe": traída sin señal, la decide el servidor). */
export function sedeSinCoordenadas(sedeId: string, catalogo: Catalogo): boolean {
  const sede = catalogo.sedes.find(s => s.id === sedeId)
  if (sede) return !esPunto(sede.lat, sede.lng) && !sede.coordenadas_desconocidas
  for (const medico of catalogo.medicos) {
    const deMedico = medico.sedes.find(s => s.id === sedeId)
    if (deMedico) return deMedico.distancia_m === null && !deMedico.coordenadas_desconocidas && !esPunto(deMedico.lat ?? null, deMedico.lng ?? null)
  }
  return false
}

/** ¿La sede existe en el catálogo (cercanas, de la agenda o de algún médico)? Para el médico no listado: cualquier IPS conocida. */
function sedeConocida(sedeId: string, catalogo: Catalogo): boolean {
  return catalogo.sedes.some(s => s.id === sedeId) || catalogo.medicos.some(m => m.sedes.some(s => s.id === sedeId))
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

/**
 * Revisa la tarjeta como lo hará el servidor (todos los errores a la vez, con el campo que falla). 0940 (dueño,
 * 2026-10-30): la fecha, el radio, la falta de GPS y la sede sin coordenadas YA NO bloquean: son marcas
 * (marcasPrevistas); la médica vale con el médico de OpMap o con el médico no listado (nombre); el motivo de la no
 * efectiva vale de la lista (motivo_codigo) o escrito.
 */
export function validarBorrador(borrador: Borrador, catalogo: Catalogo, entrada: EntradaValidacion): ResultadoBorrador {
  const errores: ErrorVisita[] = []
  const falla = (campo: string, mensaje: string) => errores.push({ campo, mensaje })
  const config = catalogo.config
  const visitasHoy = (entrada.visitasHoy ?? []).filter(v => !v.client_id || v.client_id !== borrador.client_id)
  let fuera_de_territorio = false

  // Hora de llegada legible (la fecha ya no se rechaza: otro día se marca)
  try {
    fechaBogota(entrada.checked_in_at)
  } catch {
    falla('checked_in_at', 'La hora de llegada no es válida')
  }

  // Tipo y perfil
  if (!borrador.tipo) falla('tipo', 'Elige el tipo de visita')
  else if (!config.perfil.includes(borrador.tipo)) falla('tipo', mensajePerfil(borrador.tipo))

  // Médica o institucional
  if (borrador.tipo === 'medica') {
    const medico = borrador.medico_id ? catalogo.medicos.find(m => m.id === borrador.medico_id) : undefined
    const noListado = !medico && !!borrador.medico_no_listado
    if (noListado) {
      if (!borrador.medico_no_listado?.nombre.trim()) falla('medico_no_listado', MENSAJE_MEDICO_NO_LISTADO_SIN_NOMBRE)
      if (!borrador.sede_id) falla('sede_id', 'Elige la IPS donde lo viste')
    } else if (!medico) {
      falla('medico_id', borrador.medico_nombre_dicho ? `"${borrador.medico_nombre_dicho}" no está en OpMap: elígelo, créalo completo o escríbelo como médico no listado` : 'Elige el médico')
    } else {
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
    // Dueño, 2026-10-30: siempre con quién fue (el servidor también lo exige)
    if (!borrador.contacto_id) {
      falla('contacto_id', borrador.contacto_nombre_dicho ? `"${borrador.contacto_nombre_dicho}" no está en la cuenta: elígelo o créalo con su teléfono o correo` : MENSAJE_CONTACTO_OBLIGATORIO)
    } else {
      const contacto = catalogo.contactos.find(c => c.id === borrador.contacto_id)
      if (!contacto || contacto.cuenta_id !== borrador.cuenta_id) falla('contacto_id', MENSAJE_CONTACTO_OTRA_CUENTA)
    }
  }

  // Modalidad. Presencial (0940): sin GPS, lejos o con la sede sin coordenadas se guarda igual (marcas).
  if (borrador.modalidad === 'telefonica') {
    if (!config.telefonica.habilitada) falla('modalidad', MENSAJE_TELEFONICA_NO_HABILITADA)
    else {
      if (!borrador.medio) falla('medio', 'Indica el medio: llamada o videollamada')
      else if (!config.telefonica.medios.includes(borrador.medio)) falla('medio', `Medio no válido: ${config.telefonica.medios.join(' o ')}`)
      const telefonicas = telefonicasDeHoy(catalogo, entrada.visitasHoy, borrador.client_id)
      if (telefonicas >= config.telefonica.tope_dia) falla('modalidad', mensajeTopeTelefonicas(config.telefonica.tope_dia))
    }
  }
  const previstas = marcasPrevistas(borrador, catalogo, entrada)

  // Tope por médico (solo efectivas, con médico de OpMap)
  if (borrador.tipo === 'medica' && borrador.efectiva && borrador.medico_id) {
    const alMedico = visitasHoy.filter(v => v.efectiva && v.medico_id === borrador.medico_id).length
    if (alMedico >= config.tope_visitas_medico_dia) falla('medico_id', MENSAJE_TOPE_MEDICO)
  }

  // Efectiva o no. 0940: con la lista cerrada se elige el motivo (y "Otro" lleva texto); sin lista, texto libre.
  const motivo = borrador.failure_reason.trim()
  if (!borrador.efectiva) {
    const conLista = catalogo.motivos.length > 0
    const codigo = borrador.motivo_codigo ?? null
    if (conLista) {
      if (!codigo || !catalogo.motivos.some(m => m.codigo === codigo)) falla('failure_reason', MENSAJE_MOTIVO_LISTA)
      else if (codigo === MOTIVO_OTRO && !motivo) falla('failure_reason', MENSAJE_FAILURE)
    } else if (!motivo) falla('failure_reason', MENSAJE_FAILURE)
    if (motivo.length > MAX_FAILURE_REASON) falla('failure_reason', MENSAJE_FAILURE)
  }

  // Textos y fecha
  if (borrador.conclusion.trim().length > MAX_CONCLUSION) falla('conclusion', `La conclusión no puede superar ${MAX_CONCLUSION} caracteres`)
  if (borrador.compromisos.trim().length > MAX_COMPROMISOS) falla('compromisos', `Los compromisos no pueden superar ${MAX_COMPROMISOS} caracteres`)
  const proxima = borrador.next_step_date.trim()
  if (proxima && !esFechaIso(proxima)) falla('next_step_date', 'Fecha no válida: usa AAAA-MM-DD')
  else if (proxima && proximaAntesDeLaVisita(proxima, entrada.checked_in_at)) falla('next_step_date', MENSAJE_PROXIMA_ANTES_DE_VISITA)

  // Líneas
  if (borrador.lineas.length === 0 || borrador.lineas.length > MAX_LINEAS_VISITA) falla('lineas', MENSAJE_LINEAS)
  else if (borrador.lineas.some(id => !catalogo.lineas.some(l => l.id === id))) falla('lineas', MENSAJE_LINEAS_AJENAS)

  return { ok: errores.length === 0, errores, distancia_m: previstas.distancia_m, fuera_de_territorio, marcas: previstas.marcas, en_sitio: previstas.en_sitio }
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
  /** 0940: hora de la lectura del GPS (ISO con zona); por defecto, la de llegada si hay punto. */
  gps_at?: string | null
  /** 0940: zona horaria del teléfono; por defecto, la del sistema (zonaHorariaDelTelefono). */
  tz?: string | null
}

const textoONulo = (texto: string, max: number) => {
  const limpio = texto.trim()
  return limpio ? limpio.slice(0, max) : null
}

/** Zona horaria IANA del teléfono ("America/Bogota"); si el sistema no la da, Bogotá (la app es de Colombia). */
export function zonaHorariaDelTelefono(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz && tz.length <= 64 ? tz : 'America/Bogota'
  } catch {
    return 'America/Bogota'
  }
}

/**
 * Arma el cuerpo de la visita. Lanza si la tarjeta está incompleta (validarla antes con validarBorrador). 0940: la
 * presencial puede ir sin ubicación (el servidor la marca 'sin_ubicacion'); lleva tz, gps_at, motivo_codigo y el médico
 * no listado.
 */
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
    agenda_id: borrador.agenda_id ?? null,
    tz: datos.tz ?? zonaHorariaDelTelefono(),
    gps_at: ubicacion ? (datos.gps_at ?? datos.checked_in_at) : null,
    motivo_codigo: borrador.efectiva ? null : (borrador.motivo_codigo ?? null),
  }
  let tipo:
    | { tipo: 'medica'; medico_id: string | null; medico_no_listado: MedicoNoListado | null; cuenta_id: null; subtipo_id: null; contacto_id: null }
    | { tipo: 'institucional'; medico_id: null; medico_no_listado: null; cuenta_id: string; subtipo_id: string; contacto_id: string | null }
  if (borrador.tipo === 'medica') {
    const noListado = borrador.medico_no_listado?.nombre.trim() ? { nombre: borrador.medico_no_listado.nombre.trim().slice(0, 200), especialidad: borrador.medico_no_listado.especialidad?.trim() || null } : null
    if (!borrador.medico_id && !noListado) throw new Error('Elige el médico')
    tipo = { tipo: 'medica', medico_id: borrador.medico_id, medico_no_listado: borrador.medico_id ? null : noListado, cuenta_id: null, subtipo_id: null, contacto_id: null }
  } else {
    if (!borrador.cuenta_id || !borrador.subtipo_id) throw new Error('Elige la cuenta y el subtipo')
    tipo = { tipo: 'institucional', medico_id: null, medico_no_listado: null, cuenta_id: borrador.cuenta_id, subtipo_id: borrador.subtipo_id, contacto_id: borrador.contacto_id }
  }
  if (borrador.modalidad === 'presencial') {
    return { ...base, ...tipo, modalidad: 'presencial', lat: punto ? punto.lat : null, lng: punto ? punto.lng : null, medio: null }
  }
  if (!borrador.medio) throw new Error('Indica el medio: llamada o videollamada')
  return { ...base, ...tipo, modalidad: 'telefonica', medio: borrador.medio }
}

/** Texto corto para la cola y el resultado ("Médica · Dra. Ana Gómez · Clínica Norte"). Nunca documentos. */
export function resumenBorrador(borrador: Borrador, catalogo: Catalogo): string {
  const partes: string[] = [borrador.tipo ? ETIQUETA_TIPO_VISITA[borrador.tipo] : 'Visita']
  if (borrador.tipo === 'medica') {
    const medico = borrador.medico_id ? catalogo.medicos.find(m => m.id === borrador.medico_id) : undefined
    partes.push(medico?.nombre ?? (borrador.medico_no_listado?.nombre ? `${borrador.medico_no_listado.nombre} (no listado)` : null) ?? borrador.medico_nombre_dicho ?? 'Médico')
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

export type ClaseRechazo = 'radio' | 'sede_sin_ubicacion' | 'telefonica' | 'tope_medico' | 'perfil' | 'solo_hoy' | 'lineas' | 'cita' | 'otro'

/** Mensajes de visitas_registrar cuando el agenda_id no sirve (0840, decisión 43): los mismos de web/lib/reporte-visitas.ts. */
export const MENSAJES_RECHAZO_CITA = [
  'Esa cita no existe o no es tuya',
  'Esa cita está cancelada',
  'Esa cita ya tiene su visita',
  'Esa cita es de otro día',
  'Esa cita es de otro tipo de visita',
  'Esa cita es con otro médico',
  'Esa cita es con otra cuenta',
] as const

/** ¿El servidor rechazó la visita por la cita elegida? (entonces se vuelve a confirmar sin cita). */
export function esRechazoDeCita(mensaje: string | null | undefined): boolean {
  return !!mensaje && MENSAJES_RECHAZO_CITA.some(m => mensaje.includes(m))
}

/** Lo que ve la persona cuando la cita no sirvió: la visita sigue y se confirma como no agendada. */
export function textoRechazoCita(mensaje: string): string {
  return `${mensaje}. Quité la cita de esta visita: confírmala de nuevo y queda como visita no agendada.`
}

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
  const cita = mensajes.find(m => esRechazoDeCita(m))
  if (cita) return { clase: 'cita', mensaje: cita, distancia_m: null, radio_m: null }
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
 * médico que no es suyo) se limpia y se vuelve a elegir. La cita se conserva salvo que el rechazo fuera por ella
 * (`motivo` con uno de los mensajes del vínculo: "Esa cita ya tiene su visita"…): entonces va sin cita.
 */
export function borradorDesdeCuerpo(cuerpo: VisitaCreate, catalogo: Catalogo, opciones: OpcionesBorrador & { motivo?: string | null }): Borrador {
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
    // Un cuerpo guardado en la cola antes de la agenda no trae agenda_id.
    agenda_id: opciones.motivo && esRechazoDeCita(opciones.motivo) ? null : (cuerpo.agenda_id ?? null),
    // 0940 (un cuerpo guardado antes no los trae)
    medico_no_listado: cuerpo.tipo === 'medica' ? (cuerpo.medico_no_listado ?? null) : null,
    motivo_codigo: cuerpo.motivo_codigo ?? null,
    foto: null,
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

// ---------------------------------------------------------------------------------------------
// F4.1 Agenda: Reportar empieza por el sitio (spec 2026-10-14, decisiones 6 y 7; contrato fase 8, sección "F4.1")
// ---------------------------------------------------------------------------------------------

/** Compara dos horas HH:MM (las sin hora al final), como compararHora del servidor. */
function compararHora(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

function conQuienDeCita(cita: Pick<CitaItem, 'medico' | 'cuenta'>): string {
  return cita.medico?.nombre ?? cita.cuenta?.nombre ?? ''
}

/**
 * Citas de Reportar: la más cercana primero (las sin distancia al final); luego por hora (las sin hora al final), por
 * con quién y por id. Igual que ordenarCitas del servidor con porDistancia, dentro de un mismo día.
 */
export function ordenarCitasPorDistancia<T extends Pick<CitaItem, 'id' | 'hora' | 'distancia_m' | 'medico' | 'cuenta'>>(citas: readonly T[]): T[] {
  const distancia = (cita: T) => (cita.distancia_m === null ? Number.POSITIVE_INFINITY : cita.distancia_m)
  return [...citas].sort(
    (a, b) =>
      distancia(a) - distancia(b) ||
      compararHora(a.hora, b.hora) ||
      conQuienDeCita(a).localeCompare(conQuienDeCita(b), 'es', { sensitivity: 'base' }) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/**
 * Reportar (F4.1): ¿ya eligió dónde está? Una cita, o una sede que está en el catálogo. Sin eso no se graba ni se abre
 * una tarjeta por toques (spec 2026-10-14, criterio de la app): ni desde los botones, ni desde el aviso de la voz que
 * falló, ni desde "Agregar otra visita".
 */
export function hayEleccion(entrada: { cita: { id: string } | null | undefined; sedeId: string | null | undefined; catalogo: Pick<Catalogo, 'sedes'> | null | undefined }): boolean {
  if (entrada.cita) return true
  return !!entrada.sedeId && !!entrada.catalogo?.sedes.some(s => s.id === entrada.sedeId)
}

/**
 * Las citas que Reportar ofrece en "¿Dónde estás?": las PENDIENTES de hoy (sin las ya usadas en este reporte), con la
 * distancia medida desde el punto de AHORA cuando su sede tiene coordenadas (el contexto pudo cargarse en otro punto, o
 * ser el guardado sin señal) y si queda dentro del radio presencial; ordenadas por distancia.
 */
export function citasParaReportar(
  agenda: readonly CitaItem[] | null | undefined,
  punto: Punto | null,
  radioM: number,
  opciones: { usadas?: readonly string[]; sinSenal?: boolean; hoy?: string } = {}
): CitaItem[] {
  const usadas = new Set(opciones.usadas ?? [])
  const hoy = opciones.hoy ?? hoyBogota()
  const pendientes = (agenda ?? []).filter(cita => cita.estado === 'pendiente' && cita.fecha === hoy && !usadas.has(cita.id))
  const conPunto = !!punto && esPunto(punto.lat, punto.lng)
  return ordenarCitasPorDistancia(
    pendientes.map(cita => {
      if (conPunto && esPunto(cita.sede.lat, cita.sede.lng)) {
        const distancia_m = haversineM(punto as Punto, { lat: cita.sede.lat as number, lng: cita.sede.lng as number })
        return { ...cita, distancia_m, dentro_del_radio: distancia_m <= radioM }
      }
      // Sin punto, o sin señal (la distancia guardada es de otro sitio): no se sabe.
      if (!conPunto || opciones.sinSenal) return { ...cita, distancia_m: null, dentro_del_radio: null }
      return { ...cita }
    })
  )
}

/** Cuenta de una cita institucional (la de la cita o, si no viene, la de su sede). */
export function cuentaDeCita(cita: CitaItem): string | null {
  return cita.cuenta?.id ?? cita.sede.cuenta_id ?? null
}

/** ¿La tarjeta es la visita de esa cita? (mismo tipo y mismo médico o misma cuenta; la sede y el subtipo pueden cambiar). */
export function esVisitaDeLaCita(borrador: Pick<Borrador, 'tipo' | 'medico_id' | 'cuenta_id'>, cita: CitaItem): boolean {
  if (borrador.tipo !== cita.tipo) return false
  if (cita.tipo === 'medica') return !!borrador.medico_id && borrador.medico_id === (cita.medico?.id ?? null)
  return !!borrador.cuenta_id && borrador.cuenta_id === cuentaDeCita(cita)
}

/**
 * La tarjeta ya armada de una cita (la persona solo dicta o toca lo que pasó): tipo, médico (con sus líneas) o cuenta y
 * subtipo, la sede de la cita y su agenda_id. En la institucional, si la cuenta tiene un solo contacto que sugiere ese
 * subtipo, queda elegido (se puede quitar). Presencial y efectiva, como la visita por toques.
 */
export function borradorDesdeCita(cita: CitaItem, catalogo: Catalogo, opciones: OpcionesBorrador & { origen?: ModoEntrada }): Borrador {
  const medico = cita.tipo === 'medica' && cita.medico ? (catalogo.medicos.find(m => m.id === cita.medico?.id) ?? null) : null
  const subtipo = cita.tipo === 'institucional' && cita.subtipo ? (catalogo.subtipos.find(s => s.id === cita.subtipo?.id) ?? null) : null
  const cuentaId = cita.tipo === 'institucional' ? cuentaDeCita(cita) : null
  const sugeridos = subtipo && cuentaId ? catalogo.contactos.filter(c => c.cuenta_id === cuentaId && subtipo.roles_sugeridos.includes(c.rol)) : []
  const contacto = sugeridos.filter(c => !c.sede_id || c.sede_id === cita.sede.id)
  const borrador: Borrador = {
    clave: opciones.nuevoId(),
    client_id: opciones.nuevoId(),
    origen: opciones.origen ?? 'toques',
    tipo: cita.tipo,
    subtipo_id: subtipo?.id ?? null,
    medico_id: medico?.id ?? null,
    medico_nombre_dicho: null,
    sugerir_crear_medico: false,
    cuenta_id: cuentaId,
    sede_id: cita.sede.id,
    contacto_id: contacto.length === 1 ? contacto[0].id : null,
    contacto_nombre_dicho: null,
    lineas: lineasPorDefecto(catalogo, medico),
    efectiva: true,
    failure_reason: '',
    conclusion: '',
    compromisos: '',
    next_step_date: '',
    modalidad: 'presencial',
    medio: null,
    preguntas: [],
    confianza: null,
    agenda_id: cita.id,
  }
  return normalizar(borrador, catalogo, { sedePreferida: cita.sede.id })
}

/**
 * Después de dictar con una cita elegida (proponer recibió cita_id): la tarjeta que es la visita de esa cita lleva su
 * agenda_id (la primera, si la IA repitió). Si ninguna cruzó pero hay UNA sola tarjeta, del tipo de la cita y sin
 * médico ni nombre dicho (o sin cuenta), es la de la cita: se completa con ella. Las demás tarjetas no se tocan (la base
 * vincula sola otra cita pendiente de hoy con el mismo médico o cuenta).
 */
export function aplicarCitaAPropuestas(borradores: readonly Borrador[], cita: CitaItem, catalogo: Catalogo): Borrador[] {
  const indice = borradores.findIndex(b => esVisitaDeLaCita(b, cita))
  if (indice >= 0) {
    return borradores.map((b, i) => (i === indice ? normalizar({ ...b, agenda_id: cita.id }, catalogo, { sedePreferida: cita.sede.id }) : b))
  }
  if (borradores.length !== 1) return [...borradores]
  const unica = borradores[0]
  if (unica.tipo !== cita.tipo) return [...borradores]
  if (cita.tipo === 'medica') {
    if (unica.medico_id || unica.medico_nombre_dicho || !cita.medico) return [...borradores]
    const medico = catalogo.medicos.find(m => m.id === cita.medico?.id) ?? null
    if (!medico) return [...borradores]
    const lineas = unica.lineas.length > 0 ? unica.lineas : lineasPorDefecto(catalogo, medico)
    return [normalizar({ ...unica, medico_id: medico.id, sugerir_crear_medico: false, sede_id: cita.sede.id, lineas, agenda_id: cita.id }, catalogo)]
  }
  if (unica.cuenta_id) return [...borradores]
  const subtipo = unica.subtipo_id ?? (cita.subtipo && catalogo.subtipos.some(s => s.id === cita.subtipo?.id) ? cita.subtipo.id : null)
  return [normalizar({ ...unica, cuenta_id: cuentaDeCita(cita), subtipo_id: subtipo, sede_id: cita.sede.id, agenda_id: cita.id }, catalogo)]
}

// ---------------------------------------------------------------------------------------------
// F4.1 Dictar un campo (POST /api/me/voz/campos): lo dictado se AÑADE, nunca borra lo escrito
// ---------------------------------------------------------------------------------------------

export interface CamposEditables {
  conclusion: string
  compromisos: string
  /** AAAA-MM-DD o ''. */
  next_step_date: string
}

export interface ResultadoDictado extends CamposEditables {
  /** Qué campos cambiaron (para decirle a la persona dónde quedó lo que dijo). */
  agregados: (keyof CamposEditables)[]
  /** Al añadir se pasó del máximo del campo y se recortó el final. */
  recortado: boolean
}

const normalizarTexto = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Une el reparto del dictado con lo que ya hay en la tarjeta: la conclusión y los compromisos dictados se AÑADEN en una
 * línea nueva (lo escrito no se borra; lo que ya estaba igual no se repite) y la próxima reunión solo se pone si estaba
 * vacía (y es de hoy en adelante). Todo queda editable antes de confirmar.
 */
export function unirCamposDictados(actual: CamposEditables, dictado: CamposDictadoResponse, hoy: string = hoyBogota()): ResultadoDictado {
  const agregados: (keyof CamposEditables)[] = []
  let recortado = false
  const anadir = (campo: 'conclusion' | 'compromisos', max: number): string => {
    const previo = actual[campo]
    const nuevo = (dictado[campo] ?? '').trim()
    if (!nuevo) return previo
    if (previo.trim() && normalizarTexto(previo).includes(normalizarTexto(nuevo))) return previo
    const base = previo.replace(/\s+$/, '')
    const junto = base ? `${base}\n${nuevo}` : nuevo
    agregados.push(campo)
    if (junto.length > max) {
      recortado = true
      return junto.slice(0, max)
    }
    return junto
  }
  const conclusion = anadir('conclusion', MAX_CONCLUSION)
  const compromisos = anadir('compromisos', MAX_COMPROMISOS)
  let next_step_date = actual.next_step_date
  const fecha = dictado.next_step_date
  if (!actual.next_step_date.trim() && esFechaIso(fecha) && fecha >= hoy) {
    next_step_date = fecha
    agregados.push('next_step_date')
  }
  return { conclusion, compromisos, next_step_date, agregados, recortado }
}

/** Sin la llave de la IA (503) o con un servidor que aún no tiene la ruta (404): se escribe a mano. */
export const MENSAJE_DICTADO_NO_DISPONIBLE = 'El dictado no está disponible; escribe la conclusión'

/** Mensaje de un fallo al transcribir o repartir el dictado del campo (status 0 = sin respuesta del servidor). */
export function mensajeErrorDictado(status: number, mensaje: string): string {
  if (status === 503 || status === 404) return MENSAJE_DICTADO_NO_DISPONIBLE
  return mensaje
}

/** Lo que se le dice a la persona al terminar el dictado del campo. */
export function textoResultadoDictado(resultado: Pick<ResultadoDictado, 'agregados' | 'recortado'>): string {
  const nombres: Record<keyof CamposEditables, string> = { conclusion: 'conclusión', compromisos: 'compromisos', next_step_date: 'próxima reunión' }
  if (resultado.agregados.length === 0) return 'No encontré nada nuevo para agregar. Revisa los campos o vuelve a dictar.'
  const lista = resultado.agregados.map(campo => nombres[campo])
  const texto = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`
  return `Agregué lo que dijiste en ${texto}. Revísalo antes de confirmar.${resultado.recortado ? ' Se recortó el final porque superaba el máximo del campo.' : ''}`
}

// ---------------------------------------------------------------------------------------------
// F4.1 Agendar (POST /api/me/agenda): formulario, revisión antes de enviar y cuerpo
// ---------------------------------------------------------------------------------------------

/**
 * Mensajes de la fecha y la hora: los mismos de web/lib/reporte-visitas.ts (mensajeFechaCita) y del esquema de la hora.
 * Desde la 0850 no hay tope hacia adelante (A4): ya no está "Solo se agenda hasta 30 días adelante".
 */
export const MENSAJE_CITA_PASADA = 'No se agenda en el pasado: elige hoy o una fecha posterior'
export const MENSAJE_HORA_CITA = 'Hora no válida: usa HH:MM (de 00:00 a 23:59)'

export interface FormularioCita {
  /** AAAA-MM-DD. */
  fecha: string
  /** Lo que escribió ('' = sin hora; "9:30" vale como 09:30). */
  hora: string
  tipo: TipoVisita | null
  medico_id: string | null
  cuenta_id: string | null
  subtipo_id: string | null
  sede_id: string | null
  nota: string
  /**
   * 0850 (C12): "como qué" agenda quien tiene los dos papeles ('ejecutivo' o 'lider'); null para los demás (el servidor
   * decide: como Ejecutivo Comercial si lo tiene; si no, como líder).
   */
  como: ComoPersona | null
}

/** Lo que arma cuerpoCita: el cuerpo de POST /api/me/agenda con la hora aún opcional (cuerpoCitaConHora la exige). */
export type CuerpoCita = Omit<CitaCreateBase, 'hora'> & { hora: string | null } & CitaCreateTipo

/** Formulario nuevo: hoy, sin hora, el primer tipo del perfil (médica primero), sin "como qué". */
export function formularioCitaVacio(hoy: string, perfil: readonly TipoVisita[]): FormularioCita {
  const tipo: TipoVisita | null = perfil.includes('medica') ? 'medica' : perfil.includes('institucional') ? 'institucional' : null
  return { fecha: hoy, hora: '', tipo, medico_id: null, cuenta_id: null, subtipo_id: null, sede_id: null, nota: '', como: null }
}

/** Hora del formulario → 'HH:MM'; '' → null (sin hora); undefined si no es una hora válida. */
export function horaDeCita(texto: string): string | null | undefined {
  const limpio = texto.trim()
  if (!limpio) return null
  const partes = /^(\d{1,2})[:.h](\d{2})$/.exec(limpio)
  if (!partes) return undefined
  const horas = Number(partes[1])
  const minutos = Number(partes[2])
  if (horas > 23 || minutos > 59) return undefined
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

/**
 * Revisa la cita como lo hará el servidor (forma y fecha: no en el pasado, sin tope hacia adelante desde la 0850; el día
 * libre, el perfil en esa fecha, el médico en la sede, la cuenta, el subtipo vigente y los repetidos los decide la
 * base): todos los errores a la vez, con su campo.
 */
export function validarCita(formulario: FormularioCita, hoy: string, perfil?: readonly TipoVisita[]): ErrorVisita[] {
  const errores: ErrorVisita[] = []
  const falla = (campo: string, mensaje: string) => errores.push({ campo, mensaje })
  if (!esFechaIso(formulario.fecha)) falla('fecha', 'Fecha no válida: usa AAAA-MM-DD')
  else if (formulario.fecha < hoy) falla('fecha', MENSAJE_CITA_PASADA)
  if (horaDeCita(formulario.hora) === undefined) falla('hora', MENSAJE_HORA_CITA)
  if (!formulario.tipo) falla('tipo', 'Elige el tipo de visita')
  else if (perfil && !perfil.includes(formulario.tipo)) falla('tipo', mensajePerfil(formulario.tipo))
  if (formulario.tipo === 'medica' && !formulario.medico_id) falla('medico_id', 'Elige el médico')
  if (formulario.tipo === 'institucional') {
    if (!formulario.cuenta_id) falla('cuenta_id', 'Elige la cuenta')
    if (!formulario.subtipo_id) falla('subtipo_id', 'Elige el subtipo de la visita institucional')
  }
  if (!formulario.sede_id) falla('sede_id', 'Elige la sede')
  if (formulario.nota.trim().length > MAX_NOTA_CITA) falla('nota', `La nota no puede superar ${MAX_NOTA_CITA} caracteres`)
  return errores
}

/**
 * Cuerpo de POST /api/me/agenda (lo que no aplica al tipo va en null; `como`, null salvo para quien tiene los dos
 * papeles). Lanza si está incompleto: validarlo antes. Puede ir "sin hora" (las pruebas de antes): la app agenda con
 * cuerpoCitaConHora de lib/agenda.ts, que la exige.
 */
export function cuerpoCita(formulario: FormularioCita): CuerpoCita {
  const hora = horaDeCita(formulario.hora)
  if (!formulario.tipo || !formulario.sede_id || hora === undefined || !esFechaIso(formulario.fecha)) throw new Error('La cita está incompleta')
  const nota = formulario.nota.trim() ? formulario.nota.trim().slice(0, MAX_NOTA_CITA) : null
  const base = { fecha: formulario.fecha, hora, sede_id: formulario.sede_id, nota, como: formulario.como ?? null }
  if (formulario.tipo === 'medica') {
    if (!formulario.medico_id) throw new Error('Elige el médico')
    return { ...base, tipo: 'medica', medico_id: formulario.medico_id, cuenta_id: null, subtipo_id: null }
  }
  if (!formulario.cuenta_id || !formulario.subtipo_id) throw new Error('Elige la cuenta y el subtipo')
  return { ...base, tipo: 'institucional', medico_id: null, cuenta_id: formulario.cuenta_id, subtipo_id: formulario.subtipo_id }
}

/** Cambia el formulario y limpia lo que deja de cuadrar (otro tipo: otro "con quién"; otro médico o cuenta: otra sede). */
export function cambiarFormularioCita(formulario: FormularioCita, cambios: Partial<FormularioCita>): FormularioCita {
  let siguiente = { ...formulario, ...cambios }
  if (cambios.tipo !== undefined && cambios.tipo !== formulario.tipo) {
    siguiente = { ...siguiente, medico_id: null, cuenta_id: null, subtipo_id: null, sede_id: cambios.sede_id ?? null }
  }
  const otroMedico = cambios.medico_id !== undefined && cambios.medico_id !== formulario.medico_id
  const otraCuenta = cambios.cuenta_id !== undefined && cambios.cuenta_id !== formulario.cuenta_id
  if ((otroMedico || otraCuenta) && cambios.sede_id === undefined) siguiente = { ...siguiente, sede_id: null }
  return siguiente
}
