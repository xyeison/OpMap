/**
 * Formas JSON de la API que consume la app, copiadas del contrato
 * docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "API") y de web/lib/reporte-visitas.ts y
 * web/lib/visits-rules.ts (F2). Si el servidor cambia una forma, se cambia aquí a mano: la app no comparte
 * código con web/ (son dos paquetes npm distintos).
 */

// ---------------------------------------------------------------------------------------------
// Constantes compartidas con el servidor
// ---------------------------------------------------------------------------------------------

export type Role =
  | 'admin'
  | 'commercial_director'
  | 'line_leader'
  | 'sales_manager'
  | 'data_manager'
  | 'hr'
  | 'viewer'
  | 'contract_manager'
  | 'user'
  | (string & {})

export type TipoVisita = 'medica' | 'institucional'
export type Modalidad = 'presencial' | 'telefonica'
export type MedioTelefonica = 'llamada' | 'videollamada'
export type ModoEntrada = 'voz' | 'toques'
export type EstadoDiaLibre = 'registrado' | 'por_aprobar' | 'aprobado' | 'rechazado' | 'anulado'
export type OrigenMeta = 'ejecutiva' | 'zona' | 'general' | null

/**
 * Marcas del servidor (0940, app sin señal; copia de web/lib/reporte-visitas.ts MARCAS_VISITA). Nunca bloquean: la
 * visita se guarda siempre y la dirección las ve en el tablero y el mapa de calor.
 */
export type MarcaVisita = 'en_sitio' | 'lejos_de_ips' | 'sin_ubicacion' | 'precision_baja' | 'ips_sin_coordenadas' | 'hora_inconsistente' | 'medico_por_validar'
export const ETIQUETA_MARCA: Record<MarcaVisita, string> = {
  en_sitio: 'En sitio',
  lejos_de_ips: 'Lejos de la IPS',
  sin_ubicacion: 'Sin ubicación',
  precision_baja: 'Precisión baja',
  ips_sin_coordenadas: 'IPS sin coordenadas',
  hora_inconsistente: 'Hora inconsistente',
  medico_por_validar: 'Médico por validar',
}
/** Precisión del GPS (metros) desde la que la visita queda 'precision_baja' (PRECISION_BAJA_M de la web). */
export const PRECISION_BAJA_M = 100
/** Una visita con más de estos días queda 'hora_inconsistente' (DIAS_MAX_ATRAS de la web). */
export const DIAS_MAX_ATRAS = 7

/** Médico que no está en OpMap, escrito en la visita (0940): nombre y especialidad; queda por validar. */
export interface MedicoNoListado {
  nombre: string
  especialidad: string | null
}

/** Un motivo de la lista cerrada de la visita no efectiva (0940). */
export interface MotivoNoEfectiva {
  codigo: string
  nombre: string
}

export const ETIQUETA_TIPO_VISITA: Record<TipoVisita, string> = { medica: 'Médica', institucional: 'Institucional' }
/**
 * La visita como actividad de campo (F1b, spec 2026-10-15-actividades-de-campo, tabla de tipos): las opciones de
 * "¿Qué hiciste?" (Reportar) y "¿Qué vas a hacer?" (Agendar). "Visita" queda solo para estos dos tipos.
 */
export const ETIQUETA_ACTIVIDAD: Record<TipoVisita, string> = { medica: 'Visita a médico', institucional: 'Visita institucional' }
export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = { presencial: 'Presencial', telefonica: 'Telefónica' }
export const ETIQUETA_MEDIO: Record<MedioTelefonica, string> = { llamada: 'Llamada', videollamada: 'Videollamada' }
export const ETIQUETA_ESTADO_DIA_LIBRE: Record<EstadoDiaLibre, string> = {
  registrado: 'Registrado',
  por_aprobar: 'Por aprobar',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
}

// ---------------------------------------------------------------------------------------------
// Sesión (POST /api/auth/login con cliente 'movil', GET /api/auth/me)
// ---------------------------------------------------------------------------------------------

export interface UsuarioMovil {
  id: string
  full_name: string
  role: Role
}

/** El Ejecutivo Comercial enlazado con el usuario (no inactivo), con el nombre de su zona. */
export interface EjecutivaMovil {
  id: string
  full_name: string
  zona: string | null
}

/** POST /api/auth/login con { email, password, cliente: 'movil' }: el token va en el cuerpo (sin cookie). */
export interface LoginMovilResponse {
  token: string
  /** Instante ISO en que expira el token (7 días). */
  expira_at: string
  usuario: UsuarioMovil
  ejecutiva: EjecutivaMovil | null
}

/** GET /api/auth/me (cookie o portador). `user` es lo que ya usaba la web; `ejecutiva` lo que la app necesita. */
export interface MeResponse {
  user: { id: string; email: string; full_name: string; role: Role; active: boolean }
  ejecutiva: EjecutivaMovil | null
  /** 0850: la persona de campo, o null (la dirección comercial, A1, o un usuario sin líneas). */
  persona: PersonaMovil | null
  /**
   * Sin persona, el porqué cuando el servidor lo sabe ("Las visitas de los Ejecutivos Comerciales se registran en VMO":
   * la app es solo para las líderes, dueño 2026-10-30; o sin líneas): la app no entra a las pestañas y lo muestra.
   * Opcional: un servidor anterior no lo manda.
   */
  sin_persona?: string | null
}

// ---------------------------------------------------------------------------------------------
// Persona de campo (F1a, migración 0850; la app la usa desde F1b): quien agenda y reporta es el USUARIO, con el
// Ejecutivo Comercial como algo opcional. Copia de web/lib/reporte-visitas.ts y web/lib/persona-campo.ts.
// ---------------------------------------------------------------------------------------------

/** Papel de la persona de campo: solo Ejecutivo Comercial, solo líder, o los dos (Paola: una sola agenda). */
export type RolPersona = 'ejecutivo' | 'lider' | 'lider_y_ejecutivo'
/** "Como qué" se agenda o se reporta (C12): como Ejecutivo Comercial (con su zona) o como líder (sin ella). */
export type ComoPersona = 'ejecutivo' | 'lider'

/** Una línea de la persona de campo y "como qué" la lleva. */
export interface LineaPersona {
  id: string
  nombre: string
  como: ComoPersona
}

/** La persona de campo en GET /api/auth/me; null para la dirección comercial o un usuario sin líneas. */
export interface PersonaMovil {
  rol: RolPersona
  lineas: LineaPersona[]
}

/** La persona de campo en el contexto. */
export interface PersonaContexto extends PersonaMovil {
  user_id: string
  /** users.full_name. */
  nombre: string
  /** Su Ejecutivo Comercial activo, o null (líder sin Ejecutivo Comercial). */
  executive_id: string | null
}

/** Respuesta de error de toda la API: { error } y, en la pre-validación de visitas, los errores por campo. */
export interface ErrorResponse {
  error: string
  errores?: ErrorVisita[]
}

export interface ErrorVisita {
  campo: string
  mensaje: string
}

// ---------------------------------------------------------------------------------------------
// GET /api/me/contexto
// ---------------------------------------------------------------------------------------------

export interface LineaEjecutiva {
  id: string
  code: string
  name: string
}

export interface EjecutivaContexto {
  id: string
  nombre: string
  zona: string | null
  /** Municipio de la zona base (código DANE de 5 dígitos). */
  municipio: string | null
  lineas: LineaEjecutiva[]
}

export interface HechasHoy {
  /** Efectivas médicas. */
  medicas: number
  /** Efectivas institucionales (cuenten o no para la meta). */
  institucionales: number
  /** Telefónicas efectivas (las que cuentan para el tope). */
  telefonicas: number
  no_efectivas: number
}

export interface HoyContexto {
  fecha: string
  meta: { medica: number; institucional: number }
  hechas: HechasHoy
  cuota_dia_ok: boolean
}

export interface TelefonicaEfectiva {
  habilitada: boolean
  tope_dia: number
  medios: MedioTelefonica[]
}

export interface ConfigContexto {
  radio_m: number
  telefonica: TelefonicaEfectiva
  tope_visitas_medico_dia: number
  perfil: TipoVisita[]
}

export interface SedeCerca {
  id: string
  nombre: string
  cuenta_id: string | null
  cuenta_nombre: string | null
  cuenta_clase: string | null
  ciudad: string | null
  lat: number
  lng: number
  distancia_m: number
  hospital_id: string | null
  ubicacion_confirmada: boolean
}

export interface SedeDeMedico {
  id: string
  nombre: string
  cuenta_nombre: string | null
  /** Metros desde el punto pedido; null si no se mandó lat/lng o la sede no tiene coordenadas. */
  distancia_m: number | null
  /** 0940: la cuenta y las coordenadas (un servidor anterior no las manda: la app las trata como null). */
  cuenta_id: string | null
  lat: number | null
  lng: number | null
}

export interface MedicoContexto {
  id: string
  nombre: string
  especialidades: string[]
  municipality_id: string | null
  /** Líneas por las que ella es su visitante. */
  lineas: string[]
  sedes: SedeDeMedico[]
}

export interface ContactoContexto {
  id: string
  cuenta_id: string
  sede_id: string | null
  nombre: string
  cargo_texto: string | null
  rol: string
}

export interface SubtipoContexto {
  id: string
  codigo: string
  nombre: string
  roles_sugeridos: string[]
}

export interface CompromisoVencido {
  visita_id: string
  fecha: string
  con: string
  next_step_date: string
}

export interface VozDisponible {
  transcribir: boolean
  proponer: boolean
}

/** GET /api/me/contexto?lat=&lng=&precision= (sin lat/lng: sedes_cerca vacío y mis_medicos sin distancias). */
export interface ContextoResponse {
  /**
   * Quien reporta, en la forma de la 0840. Desde la 0850, sin Ejecutivo Comercial (una líder): id = el del usuario, su
   * nombre, sin zona ni municipio y sus líneas de líder. Las líneas son siempre TODAS las suyas.
   */
  ejecutiva: EjecutivaContexto
  hoy: HoyContexto
  config: ConfigContexto
  sedes_cerca: SedeCerca[]
  mis_medicos: MedicoContexto[]
  contactos: ContactoContexto[]
  subtipos: SubtipoContexto[]
  compromisos_vencidos: CompromisoVencido[]
  voz: VozDisponible
  /**
   * Citas de hoy (pendientes y hechas; sin las canceladas), con la distancia a su sede si se mandó el punto: con punto,
   * la más cercana primero; sin punto, por hora. Sin la 0840 aplicada: [] (el resto del contexto sigue igual).
   */
  agenda_hoy: CitaItem[]
  /**
   * 0850: la persona de campo (papel y líneas con "como qué"). Un contexto guardado en el teléfono antes de F1b no la
   * trae: quien la lea no se fía del tipo (lib/persona.ts).
   */
  persona: PersonaContexto
  /**
   * 0940: la lista cerrada de motivos de la visita no efectiva. La app la guarda con el contexto para trabajar sin
   * señal. Un servidor anterior (o un contexto guardado antes) no la trae: la app sigue con el texto libre.
   */
  motivos_no_efectiva: MotivoNoEfectiva[]
}

// ---------------------------------------------------------------------------------------------
// Visitas (GET/POST /api/me/visitas, PATCH /api/me/visitas/[id], POST /api/me/visitas/[id]/anular)
// ---------------------------------------------------------------------------------------------

/** Una visita de la ejecutiva en GET /api/me/visitas (nunca el documento del médico). */
export interface VisitaItem {
  id: string
  client_id: string | null
  tipo: TipoVisita
  subtipo: { id: string; codigo: string; nombre: string } | null
  medico: { id: string; nombre: string } | null
  cuenta: { id: string; nombre: string } | null
  sede: { id: string; nombre: string }
  contacto: { id: string; nombre: string } | null
  modalidad: Modalidad
  medio: MedioTelefonica | null
  efectiva: boolean
  failure_reason: string | null
  checked_in_at: string
  distance_m: number | null
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
  lineas: string[]
  input_mode: ModoEntrada
  out_of_territory: boolean
  /** A qué meta suma según el conteo vigente en su fecha; null si no suma (o aún no). */
  cuenta_para: 'medica' | 'institucional' | 'subtipo' | null
  /** Peso con el que suma (con el de la telefónica si lo es); 0 si no suma. */
  peso: number
  /** Efectiva en una sede que data manager aún no confirma: sumará cuando la confirme. */
  sede_por_confirmar: boolean
  /** La ejecutiva puede corregirla o anularla (mismo día). */
  editable: boolean
  /** Cita de la agenda que cumplió (0840); null si fue una visita no agendada. */
  agenda_id: string | null
  /** Agendada: vinculada a una cita creada ANTES del día de la visita (Bogotá). */
  agendada: boolean
  /** 0940: marcas del servidor (nunca bloquean). Un servidor anterior no las manda: la app las trata como []. */
  marcas: MarcaVisita[]
  /** 0940: (distancia − precisión) ≤ radio; null sin distancia. */
  en_sitio: boolean | null
  /** 0940: precisión del GPS con que se reportó (metros); null sin GPS. */
  gps_accuracy_m: number | null
  /** 0940: médico no listado (médica sin medico_id); null si no. */
  medico_no_listado: MedicoNoListado | null
  /** 0940: motivo de lista de la no efectiva; null con texto libre o efectiva. */
  motivo_codigo: string | null
  /** 0940: la visita tiene foto en el servidor. */
  foto: boolean
}

/** GET /api/me/visitas?fecha= */
export interface VisitasResponse {
  fecha: string
  items: VisitaItem[]
}

export interface VisitaCreateBase {
  client_id: string
  sede_id: string
  efectiva: boolean
  failure_reason: string | null
  retry_date: string | null
  /** Instante del sitio (ISO con zona). visit_date = su fecha en Bogotá. */
  checked_in_at: string
  /** Instante en que confirmó (ISO con zona), nunca antes de checked_in_at. */
  reported_at: string
  lat: number | null
  lng: number | null
  gps_accuracy_m: number | null
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
  transcript: string | null
  input_mode: ModoEntrada
  lineas: string[]
  /**
   * Cita de la agenda que se cumple con esta visita (0840; null si no se eligió). Sin ella, el servidor vincula sola la
   * cita pendiente de ese día con el mismo médico o la misma cuenta. Una cita ajena, de otro día, de otro médico o
   * cuenta, cancelada o ya hecha → 400 con el mensaje.
   */
  agenda_id: string | null
  /** 0940: zona horaria del teléfono (IANA, p. ej. America/Bogota). */
  tz: string | null
  /** 0940: hora de la lectura del GPS con que va lat/lng (ISO con zona); null sin GPS. */
  gps_at: string | null
  /** 0940: motivo de la lista cerrada de la no efectiva (motivos_no_efectiva.codigo); null con texto libre o efectiva. */
  motivo_codigo: string | null
}

/** Médica: con el médico de OpMap o, desde la 0940, con el médico no listado (exactamente uno). */
export type VisitaCreateTipo =
  | { tipo: 'medica'; medico_id: string | null; medico_no_listado: MedicoNoListado | null; cuenta_id: null; subtipo_id: null; contacto_id: null }
  | { tipo: 'institucional'; medico_id: null; medico_no_listado: null; cuenta_id: string; subtipo_id: string; contacto_id: string | null }

/** Presencial: desde la 0940 puede ir SIN ubicación (lat y lng null → marca 'sin_ubicacion'). */
export type VisitaCreateModalidad =
  | { modalidad: 'presencial'; lat: number | null; lng: number | null; medio: null }
  | { modalidad: 'telefonica'; medio: MedioTelefonica }

/** Cuerpo de POST /api/me/visitas: tipo y modalidad discriminados. */
export type VisitaCreate = VisitaCreateBase & VisitaCreateTipo & VisitaCreateModalidad

/** POST /api/me/visitas → 201 (repetida: el mismo client_id ya estaba; nada se duplicó). */
export interface VisitaCreateResponse {
  visita: VisitaItem
  repetida: boolean
}

/** Cuerpo de PATCH /api/me/visitas/[id] (solo lo que la ejecutiva corrige el mismo día). */
export interface VisitaUpdate {
  conclusion?: string | null
  compromisos?: string | null
  next_step_date?: string | null
  efectiva?: boolean
  failure_reason?: string | null
  retry_date?: string | null
  lineas?: string[]
}

// ---------------------------------------------------------------------------------------------
// Voz (POST /api/me/voz/transcribir, POST /api/me/voz/proponer)
// ---------------------------------------------------------------------------------------------

/** POST /api/me/voz/transcribir */
export interface TranscripcionResponse {
  transcript: string
  duracion_s: number | null
  modelo: string
}

/** Una visita propuesta por la IA a partir del dictado (solo ids que estén en el contexto; nunca documentos). */
export interface VisitaPropuesta {
  tipo: TipoVisita
  subtipo_codigo: string | null
  subtipo_id: string | null
  medico_id: string | null
  medico_nombre_dicho: string | null
  sugerir_crear_medico: boolean
  cuenta_id: string | null
  sede_id: string | null
  contacto_id: string | null
  contacto_nombre_dicho: string | null
  lineas: string[]
  efectiva: boolean
  failure_reason: string | null
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
  modalidad_sugerida: Modalidad
  confianza: number
  preguntas: string[]
}

/** POST /api/me/voz/proponer */
export interface PropuestaResponse {
  visitas: VisitaPropuesta[]
  aviso: string | null
}

// ---------------------------------------------------------------------------------------------
// Mis números (GET /api/me/numeros, GET /api/me/cuota)
// ---------------------------------------------------------------------------------------------

/** Cuota de un tipo o subtipo en CuotaResponse. */
export interface CuotaTipo {
  cuota: number
  meta_dia_hoy: number
  origen: OrigenMeta
  /** El perfil incluye el tipo algún día del periodo (si es false, la cuota es 0). */
  aplica?: boolean
}

export interface CuotaSubtipo extends CuotaTipo {
  subtipo_id: string
  nombre: string
}

/** GET /api/me/cuota?mes= (F2). */
export interface CuotaResponse {
  mes: string
  ejecutiva: { id: string; nombre: string }
  zona: { id: string; nombre: string } | null
  municipio: string | null
  ciudad?: string | null
  perfil: TipoVisita[]
  medica: CuotaTipo
  institucional: CuotaTipo
  subtipos: CuotaSubtipo[]
  dias_habiles: number
  dias_habiles_transcurridos: number
  /**
   * Días hábiles después de hoy sin los días libres (aditivo, 2026-10-15). Un servidor anterior no lo manda: la app no se
   * fía del tipo y lo revisa al usarlo (lib/pantallas.ts diasPorDelante).
   */
  dias_habiles_por_delante: number
  dias_libres: number
  dias_por_aprobar: number
  ritmo: number
}

/** GET /api/me/numeros?mes=AAAA-MM (F3: solo KPI 1 y días hábiles sin visitas). */
export interface NumerosResponse {
  mes: string
  /** null sin Ejecutivo Comercial (0850: una líder no tiene cuota de visitas, C4). */
  cuota: CuotaResponse | null
  hechas: {
    medica: number
    institucional: number
    subtipos: { subtipo_id: string; nombre: string; hechas: number }[]
  }
  cumplimiento: {
    medica: number | null
    institucional: number | null
    subtipos: { subtipo_id: string; nombre: string; cumplimiento: number | null }[]
  }
  dias_habiles_sin_visitas: number
  telefonicas: number
  no_efectivas: number
  fuera_de_territorio: number
  /** Efectivas en sedes por confirmar (aún no suman). */
  sede_por_confirmar: number
  /** Indicador de la agenda del mes; null si la agenda aún no está disponible (falta la 0840). */
  agenda: NumerosAgenda | null
}

// ---------------------------------------------------------------------------------------------
// Agenda (F4.1, migración 0840; ciclo de vida desde la 0850): GET/POST /api/me/agenda, POST /api/me/agenda/[id]/
// {cancelar, cerrar, eliminar, otra-fecha}, contexto.agenda_hoy, el bloque `agenda` de Mis números y el dictado por
// campo (POST /api/me/voz/campos). Copia de web/lib/reporte-visitas.ts y web/lib/agenda-ciclo.ts (las listas y las
// reglas del ciclo de vida, en lib/agenda-ciclo.ts).
// ---------------------------------------------------------------------------------------------

/**
 * Estado de una cita (0850, A7): no se mueve de fecha ni se borra; se cierra con su resultado —hecha (reportando la
 * visita), no se hizo (con motivo), cancelada (con motivo)— o se elimina si se agendó por error (nunca sale en una
 * lectura).
 */
export type EstadoCita = 'pendiente' | 'hecha' | 'no_realizada' | 'cancelada' | 'eliminada'

/** Las etiquetas de ESTADOS_CITA de web/lib/agenda-ciclo.ts (scripts/checks/21-persona.ts compara los dos archivos). */
export const ETIQUETA_ESTADO_CITA: Record<EstadoCita, string> = {
  pendiente: 'Programada',
  hecha: 'Hecha',
  no_realizada: 'No se hizo',
  cancelada: 'Cancelada',
  eliminada: 'Eliminada',
}

/** Cómo se muestra (C6): lo pendiente pasado no se cierra solo: "Atrasada" hoy pasada su hora, "Sin cerrar" después. */
export type EstadoVisible = 'programada' | 'atrasada' | 'sin_cerrar' | 'hecha' | 'no_realizada' | 'cancelada' | 'eliminada'

export const ETIQUETA_ESTADO_VISIBLE: Record<EstadoVisible, string> = {
  programada: 'Programada',
  atrasada: 'Atrasada',
  sin_cerrar: 'Sin cerrar',
  hecha: 'Hecha',
  no_realizada: 'No se hizo',
  cancelada: 'Cancelada',
  eliminada: 'Eliminada',
}

/** Motivos de cierre (C10), los mismos para cancelar y para "no se hizo"; 'salida' solo lo pone el sistema (A16). */
export type MotivoCierre = 'cliente' | 'prioridad' | 'falta_tiempo' | 'fuerza_mayor' | 'otro' | 'salida'
/** Los que la persona puede elegir (sin 'salida'). */
export type MotivoElegible = Exclude<MotivoCierre, 'salida'>

/** Límites del servidor: nota de la cita y motivo (300) y consulta de 31 días. Sin tope para agendar hacia adelante (A4). */
export const MAX_NOTA_CITA = 300
export const MAX_MOTIVO_CANCELACION_CITA = 300
export const MAX_DIAS_CONSULTA_AGENDA = 31

/** Sede de una cita, con lo que Reportar necesita para medir la distancia y el radio. */
export interface SedeCita {
  id: string
  nombre: string
  cuenta_id: string | null
  cuenta_nombre: string | null
  lat: number | null
  lng: number | null
  /** false: sede nueva de la app que data manager aún no confirma (la visita se guarda pero no suma). */
  ubicacion_confirmada: boolean
}

/** Una cita de la agenda (GET /api/me/agenda, POST /api/me/agenda, cancelar y contexto.agenda_hoy). */
export interface CitaItem {
  id: string
  fecha: string
  /** HH:MM o null (sin hora). */
  hora: string | null
  tipo: TipoVisita
  /** Médica: el médico (sin documento). */
  medico: { id: string; nombre: string } | null
  /** Institucional: la cuenta. */
  cuenta: { id: string; nombre: string } | null
  /** Institucional: el subtipo. */
  subtipo: { id: string; codigo: string; nombre: string } | null
  sede: SedeCita
  nota: string | null
  estado: EstadoCita
  /** La visita que la cumplió (estado hecha). */
  visita_id: string | null
  /** Metros del punto del teléfono a la sede (solo en el contexto con punto); null sin punto o sede sin coordenadas. */
  distancia_m: number | null
  /** distancia_m ≤ radio presencial vigente; null si no hay distancia. */
  dentro_del_radio: boolean | null
  /** Creada antes de su día (Bogotá): la visita que la cumpla cuenta como agendada. */
  anticipada: boolean
  /** Ella la puede cancelar: pendiente y de hoy en adelante. */
  cancelable: boolean
  // --- 0850: ciclo de vida (A7) ---
  /** Motivo del cierre (no_realizada o cancelada), o null. */
  motivo_codigo: MotivoCierre | null
  /** Cuándo se marcó "no se hizo", o null. */
  no_realizada_at: string | null
  /** Texto del motivo de "no se hizo", o null. */
  no_realizada_motivo: string | null
  /** La cita de la que esta es "otra fecha", o null. */
  viene_de: string | null
  /** Fecha de esa cita (AAAA-MM-DD), para decir "Viene de la cita del 12 oct", o null. */
  viene_de_fecha: string | null
  /** Estado de esa cita (no_realizada, cancelada o hecha con visita no efectiva), o null. */
  viene_de_estado: EstadoCita | null
  /** Su "otra fecha" (la sucesora no eliminada), o null. */
  sucesora_id: string | null
  /** Como Ejecutivo Comercial (con executive_id) o como líder (sin él). */
  como: ComoPersona
  /** Programada, atrasada (hoy, pasada su hora), sin cerrar (de un día anterior) o su estado cerrado (C6). */
  estado_visible: EstadoVisible
}

/** GET /api/me/agenda?desde=&hasta=&canceladas= (sin fechas: hoy a hoy + 7; como mucho 31 días; sin canceladas). */
export interface AgendaResponse {
  desde: string
  hasta: string
  hoy: string
  /** Desde la 0850 no hay tope hacia adelante (A4): null. La app no la lee (lo vigila web/scripts/reporte-api-check.ts). */
  max_fecha: null
  items: CitaItem[]
}

/** POST /api/me/agenda → 201, POST /api/me/agenda/[id]/cancelar y /cerrar → 200, /otra-fecha → 201. */
export interface CitaResponse {
  cita: CitaItem
}

/** Cuerpo de POST /api/me/agenda: tipo discriminado como la visita. */
export interface CitaCreateBase {
  /** AAAA-MM-DD, de hoy en adelante, sin tope (A4, 0850; Bogotá); no en un día libre aprobado. */
  fecha: string
  /** HH:MM, obligatoria desde el 2026-10-15; de hoy, no una hora que ya pasó (C13). */
  hora: string
  sede_id: string
  /** Hasta 300 caracteres (opcional). */
  nota: string | null
  /**
   * 0850 (C12), solo para quien tiene los dos papeles: 'ejecutivo' (la cita lleva su Ejecutivo Comercial) o 'lider'
   * (sin él). Sin el dato: como Ejecutivo Comercial si lo tiene; si no, como líder.
   */
  como?: ComoPersona | null
}

export type CitaCreateTipo =
  | { tipo: 'medica'; medico_id: string; cuenta_id: null; subtipo_id: null }
  | { tipo: 'institucional'; medico_id: null; cuenta_id: string; subtipo_id: string }

export type CitaCreate = CitaCreateBase & CitaCreateTipo

/**
 * Cuerpo de POST /api/me/agenda/[id]/cancelar. Desde la 0850 el motivo es OBLIGATORIO (A8): un código de la lista
 * (sin 'salida') y, con 'otro', el texto (3 a 300). La app manda siempre el código.
 */
export interface CitaCancelar {
  motivo: string | null
  motivo_codigo?: MotivoElegible
}

/** Cuerpo de POST /api/me/agenda/[id]/cerrar ("no se hizo", 0850): código de la lista y, con 'otro', el texto. */
export interface CitaCerrar {
  motivo_codigo: MotivoElegible
  motivo: string | null
}

/** Cuerpo de POST /api/me/agenda/[id]/otra-fecha (0850): la fecha y la hora nuevas; la sede y la nota pueden cambiar. */
export interface CitaOtraFecha {
  fecha: string
  hora: string
  /** null: la misma sede de la anterior. */
  sede_id: string | null
  /** Ausente: la nota de la anterior; null: sin nota. */
  nota?: string | null
  como?: ComoPersona | null
}

/** POST /api/me/agenda/[id]/eliminar → 200 (0850): la cita ya no sale en ninguna lectura. */
export interface CitaEliminadaResponse {
  cita_id: string
}

/** Indicador de la agenda en Mis números, por mes. Las razones van de 0 a 1 con 2 decimales (× 100 para el %). */
export interface NumerosAgenda {
  /** Visitas efectivas del mes (no anuladas). */
  efectivas: number
  /** De ellas, las agendadas (vinculadas a una cita creada antes del día de la visita). */
  efectivas_agendadas: number
  /** efectivas_agendadas ÷ efectivas; null si no hay efectivas. */
  porcentaje_agendadas: number | null
  /** Citas del mes de días ya pasados o de hoy, sin las canceladas ni las eliminadas (las que no se hicieron, sí). */
  citas_hasta_hoy: number
  /** De ellas, las hechas (con su visita, efectiva o no). */
  citas_hechas: number
  /** De ellas, las que no se hicieron (0850). */
  citas_no_realizadas: number
  /** citas_hechas ÷ citas_hasta_hoy; null si no hay citas. */
  cumplimiento: number | null
}

/** Cuerpo de POST /api/me/voz/campos: lo dictado para UNA visita y su tipo. */
export interface CamposDictado {
  transcript: string
  tipo: TipoVisita
}

/** POST /api/me/voz/campos: el dictado repartido (todo editable antes de confirmar; la app añade, no borra). */
export interface CamposDictadoResponse {
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
}

// ---------------------------------------------------------------------------------------------
// Mis días libres (GET/POST /api/me/dias-libres, POST /api/me/dias-libres/[id]/anular) — F2
// ---------------------------------------------------------------------------------------------

export interface MotivoDiaLibre {
  codigo: string
  nombre: string
}

/** Un día libre en las listas (GET /api/me/dias-libres). */
export interface DiaLibreItem {
  id: string
  executive_id: string
  /** Nombre del Ejecutivo Comercial. */
  ejecutiva: string
  /** Nombre de su zona base. */
  zona: string | null
  fecha: string
  fraccion: number
  motivo: string
  motivo_nombre: string
  nota: string | null
  estado: EstadoDiaLibre
  fuera_de_plazo: boolean
  justificacion: string | null
  registrado_por_nombre: string | null
  registrado_at: string
  revisado_por_nombre: string | null
  revisado_at: string | null
  motivo_revision: string | null
}

/** GET /api/me/dias-libres?desde=&hasta= */
export interface MisDiasLibresResponse {
  ejecutiva: { id: string; nombre: string }
  items: DiaLibreItem[]
  plazo_horas: number
  requiere_aprobacion: boolean
  motivos: MotivoDiaLibre[]
}

/** POST /api/me/dias-libres */
export interface DiaLibreCreate {
  fecha: string
  fraccion: 1 | 0.5
  motivo: string
  nota: string | null
}

/** POST /api/me/dias-libres → 201 y POST /api/me/dias-libres/[id]/anular → 200 */
export interface DiaLibreResponse {
  dia: DiaLibreItem
}

// ---------------------------------------------------------------------------------------------
// Terceros de F1 que usa Reportar: médicos, sedes y cuentas (web/lib/terceros.ts y /api/terceros/**)
// ---------------------------------------------------------------------------------------------

export type TipoDocMedico = 'CC' | 'CE' | 'PA' | 'PEP' | 'PPT' | 'otro'
/** Para crear o verificar un médico: solo cédula de ciudadanía o de extranjería (dueño, 2026-10-30; web/lib/terceros.ts
 * TIPOS_DOC_MEDICO_NUEVO). TipoDocMedico sigue con todos para mostrar los ya guardados. */
export type TipoDocMedicoNuevo = 'CC' | 'CE'
export type EspecialidadMedico =
  | 'ortopedia'
  | 'neurocirugia'
  | 'columna'
  | 'deportiva'
  | 'maxilofacial'
  | 'fisiatria'
  | 'cirugia_general'
  | 'otra'
export type RolMedicoSede = 'consultorio' | 'atiende'
export type ClaseCuenta = 'clinica' | 'consultorio' | 'eps' | 'operador_logistico' | 'otra'
export type TipoIdCuenta = 'NIT' | 'CC' | 'CE' | 'PA' | 'otro'

/** POST /api/terceros/medicos/verificar → nunca devuelve documentos. */
export interface MedicoVerificarRespuesta {
  existente: { id: string; nombre: string } | null
  parecidos: { id: string; nombre: string; ciudad: string | null }[]
}

/** Cuerpo de POST /api/terceros/medicos/verificar (el documento va en el cuerpo, nunca en la URL). */
export interface MedicoVerificar {
  tipo_documento: TipoDocMedicoNuevo
  numero_documento: string
  nombre: string | null
  municipality_id: string | null
}

export interface MedicoSedeCreate {
  sede_id: string
  rol: RolMedicoSede
  principal?: boolean
}

/** Cuerpo de POST /api/terceros/medicos: médico completo (documento digitado, nombre, especialidad, ciudad y sedes). */
export interface MedicoCreate {
  tipo_documento: TipoDocMedicoNuevo
  numero_documento: string
  nombre: string
  especialidades: EspecialidadMedico[]
  municipality_id: string
  sedes: MedicoSedeCreate[]
}

/** Sede de un médico en las listas y el detalle de /api/terceros/medicos (sin documento). */
export interface MedicoSedeResumen {
  id: string
  nombre: string
  rol: RolMedicoSede
  principal?: boolean
  cuenta_id?: string
  cuenta_nombre?: string
  ciudad?: string | null
  reps_code?: string | null
}

/**
 * Quién visita al médico, en lo que la app usa (VisitanteResumen de web/lib/terceros.ts trae más; en las listas, solo
 * los vigentes): la línea, para que Agendar "como líder" ofrezca solo los médicos de sus líneas (C9).
 */
export interface VisitanteMedicoResumen {
  line_id?: string
  hasta?: string | null
}

/** Médico sin documento (detalle de POST /api/terceros/medicos e ítems de las búsquedas). */
export interface MedicoPublico {
  id: string
  nombre: string
  especialidades: EspecialidadMedico[]
  municipality_id: string
  ciudad?: string | null
  sedes: MedicoSedeResumen[]
  /** Sus visitantes (las búsquedas: los vigentes). Un servidor que no los mande: no se sabe de qué líneas es. */
  visitantes?: VisitanteMedicoResumen[]
  activo?: boolean
}

/** POST /api/terceros/medicos → 201 (409 con { error, existente: { id, nombre } } si el documento ya existe). */
export interface MedicoCreateResponse {
  id: string
  medico: MedicoPublico | null
}

/** Respuesta paginada de las listas de /api/terceros/**. */
export interface PaginaTerceros<T> {
  items: T[]
  total: number
  page: number
}

/** GET /api/terceros/sedes?q= → items (sedes activas de cuentas activas). */
export interface SedeBusquedaItem {
  id: string
  nombre: string
  cuenta_id: string
  cuenta_nombre: string
  ciudad: string | null
  reps_code: string | null
}

/** Ítem de POST /api/terceros/cuentas/buscar (la identificación de una persona sale null). */
export interface CuentaListItem {
  id: string
  nombre: string
  clase: ClaseCuenta
  es_cliente: boolean
  tipo_identificacion: TipoIdCuenta
  numero_identificacion: string | null
  sedes: number
  activo: boolean
}

/** Fila de sedes que devuelven POST /api/terceros/sedes y POST /api/terceros/cuentas. */
export interface SedeCreada {
  id: string
  cuenta_id: string
  nombre: string
  es_principal: boolean
  reps_code: string | null
  municipality_id: string | null
  ciudad: string | null
  lat: number | null
  lng: number | null
  ubicacion_confirmada: boolean
  origen: 'hospitals' | 'manual' | 'gps_app'
  /** La sede está activa (GET /api/terceros/cuentas/[id] devuelve también las inactivas). */
  activo?: boolean
}

/**
 * Cuerpo de POST /api/terceros/sedes desde la app (decisión 14): origen 'gps_app' con el GPS del sitio. Nace sin
 * ubicación confirmada salvo que el código de habilitación del REPS cruce con el municipio.
 */
export interface SedeCreateGps {
  cuenta_id: string
  nombre: string
  municipality_id: string
  reps_code: string | null
  origen: 'gps_app'
  lat: number
  lng: number
  gps_accuracy_m: number | null
}

/** POST /api/terceros/sedes → 201 (409 con { existente } si el código de habilitación ya es de otra sede). */
export interface SedeCreateResponse {
  id: string
  sede: SedeCreada
}

/** Cuerpo de POST /api/terceros/cuentas: la cuenta con su sede principal (el consultorio de un médico). */
export interface CuentaCreate {
  nombre: string
  clase: ClaseCuenta
  tipo_identificacion: TipoIdCuenta
  numero_identificacion: string
  sede: { nombre: string; municipality_id: string; lat: number | null; lng: number | null }
}

/** POST /api/terceros/cuentas → 201 (409 con { existente: { id, nombre } } si la identificación ya existe). */
export interface CuentaCreateResponse {
  id: string
  cuenta: { id: string; nombre: string; clase: ClaseCuenta }
  sede: SedeCreada
}

/** GET /api/terceros/cuentas/[id] (lo que usa la app: sus sedes). */
/** POST /api/terceros/contactos (terceros:create): nombre y teléfono y/o correo (dueño, 2026-10-30). */
export interface ContactoCreate {
  cuenta_id: string
  sede_id: string | null
  nombre: string
  cargo_texto: string | null
  telefono: string | null
  email: string | null
}

/** 201 de POST /api/terceros/contactos (la app solo usa lo que ya muestra). 409: { error, existente: { id, nombre } }. */
export interface ContactoCreateResponse {
  id: string
  contacto: { id: string; cuenta_id: string; sede_id: string | null; nombre: string; cargo_texto: string | null; rol: string }
}

export interface CuentaDetalleResponse {
  cuenta: { id: string; nombre: string; clase: ClaseCuenta; activo: boolean }
  sedes: SedeCreada[]
}

/** GET /api/locations/departments y GET /api/locations/municipalities?departmentId= */
export interface LugarItem {
  id: string
  name: string
}
