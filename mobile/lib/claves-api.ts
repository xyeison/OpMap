/**
 * Las claves de cada forma JSON de la API que usa la app (contrato docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md,
 * sección "API"), en un solo lugar y verificadas por tres lados:
 *   - aquí, al compilar: cada lista tiene EXACTAMENTE las claves del tipo de lib/tipos.ts (ni una de más ni de menos);
 *   - scripts/movil-check.ts: las listas son las del contrato;
 *   - web/scripts/reporte-api-check.ts: las respuestas reales de las rutas traen exactamente estas claves, y los tipos
 *     de web/lib/reporte-visitas.ts y de esta app se asignan entre sí (al compilar la web).
 * PURO: sin React Native (lo importa también la prueba de la web).
 */
import type {
  AgendaResponse,
  EquipoHoyResponse,
  EquipoPersonaDiaResponse,
  EquipoPersonaRendimientoResponse,
  EquipoPersonasResponse,
  EquipoRendimientoResponse,
  CamposDictadoResponse,
  CitaCancelar,
  CitaCerrar,
  CitaEliminadaResponse,
  CitaItem,
  CitaOtraFecha,
  CitaResponse,
  CompromisoVencido,
  ConfigContexto,
  ContactoContexto,
  ContextoResponse,
  EjecutivaContexto,
  EjecutivaMovil,
  HechasHoy,
  HoyContexto,
  LineaEjecutiva,
  LineaPersona,
  LoginMovilResponse,
  MedicoContexto,
  MeResponse,
  NumerosAgenda,
  NumerosResponse,
  PersonaContexto,
  PersonaMovil,
  PropuestaResponse,
  SedeCerca,
  SedeCita,
  SedeDeMedico,
  SubtipoContexto,
  TelefonicaEfectiva,
  TranscripcionResponse,
  UsuarioMovil,
  CitaCreateBase,
  VisitaCreateBase,
  VisitaCreateResponse,
  VisitaItem,
  VisitaPropuesta,
  VisitasResponse,
  VozDisponible,
} from './tipos'

/** Error de compilación si a la lista le falta o le sobra una clave del tipo T. */
type Exactas<T, L extends readonly PropertyKey[]> = [Exclude<keyof T, L[number]>] extends [never]
  ? [Exclude<L[number], keyof T>] extends [never]
    ? L
    : { error: 'sobran claves'; claves: Exclude<L[number], keyof T> }
  : { error: 'faltan claves'; claves: Exclude<keyof T, L[number]> }

const exactas =
  <T>() =>
  <const L extends readonly PropertyKey[]>(lista: L & Exactas<T, L>): readonly string[] =>
    lista as readonly string[]

/** Cuerpo de POST /api/me/visitas: todas las claves, en las dos variantes de tipo y de modalidad. */
type ClavesVisitaCreate = keyof VisitaCreateBase | 'tipo' | 'medico_id' | 'medico_no_listado' | 'cuenta_id' | 'subtipo_id' | 'contacto_id' | 'modalidad' | 'medio'
type ObjetoVisitaCreate = Record<ClavesVisitaCreate, unknown>
/** Cuerpo de POST /api/me/agenda: todas las claves de las dos variantes (médica e institucional). */
type ObjetoCitaCreate = Record<keyof CitaCreateBase | 'tipo' | 'medico_id' | 'cuenta_id' | 'subtipo_id', unknown>

export const CLAVES_API = {
  login: exactas<LoginMovilResponse>()(['token', 'expira_at', 'usuario', 'ejecutiva']),
  usuario: exactas<UsuarioMovil>()(['id', 'full_name', 'role']),
  ejecutivaMovil: exactas<EjecutivaMovil>()(['id', 'full_name', 'zona']),
  me: exactas<MeResponse>()(['user', 'ejecutiva', 'persona', 'sin_persona', 'supervisa']),
  // Persona de campo (0850; la app la usa desde F1b)
  persona: exactas<PersonaMovil>()(['rol', 'lineas']),
  lineaPersona: exactas<LineaPersona>()(['id', 'nombre', 'como']),
  personaContexto: exactas<PersonaContexto>()(['user_id', 'nombre', 'executive_id', 'rol', 'lineas']),
  contexto: exactas<ContextoResponse>()([
    'ejecutiva', 'hoy', 'config', 'sedes_cerca', 'mis_medicos', 'contactos', 'subtipos', 'compromisos_vencidos', 'voz', 'agenda_hoy', 'persona',
    'motivos_no_efectiva',
  ]),
  contextoEjecutiva: exactas<EjecutivaContexto>()(['id', 'nombre', 'zona', 'municipio', 'lineas']),
  linea: exactas<LineaEjecutiva>()(['id', 'code', 'name']),
  hoy: exactas<HoyContexto>()(['fecha', 'meta', 'hechas', 'cuota_dia_ok']),
  hechas: exactas<HechasHoy>()(['medicas', 'institucionales', 'telefonicas', 'no_efectivas']),
  config: exactas<ConfigContexto>()(['radio_m', 'telefonica', 'tope_visitas_medico_dia', 'perfil']),
  telefonica: exactas<TelefonicaEfectiva>()(['habilitada', 'tope_dia', 'medios']),
  sedeCerca: exactas<SedeCerca>()(['id', 'nombre', 'cuenta_id', 'cuenta_nombre', 'cuenta_clase', 'ciudad', 'lat', 'lng', 'distancia_m', 'hospital_id', 'ubicacion_confirmada']),
  medico: exactas<MedicoContexto>()(['id', 'nombre', 'especialidades', 'municipality_id', 'lineas', 'sedes']),
  sedeDeMedico: exactas<SedeDeMedico>()(['id', 'nombre', 'cuenta_nombre', 'distancia_m', 'cuenta_id', 'lat', 'lng']),
  contacto: exactas<ContactoContexto>()(['id', 'cuenta_id', 'sede_id', 'nombre', 'cargo_texto', 'rol']),
  subtipo: exactas<SubtipoContexto>()(['id', 'codigo', 'nombre', 'roles_sugeridos']),
  compromiso: exactas<CompromisoVencido>()(['visita_id', 'fecha', 'con', 'next_step_date']),
  voz: exactas<VozDisponible>()(['transcribir', 'proponer']),
  visitas: exactas<VisitasResponse>()(['fecha', 'items']),
  visitaItem: exactas<VisitaItem>()([
    'id', 'client_id', 'tipo', 'subtipo', 'medico', 'cuenta', 'sede', 'contacto', 'modalidad', 'medio', 'efectiva', 'failure_reason',
    'checked_in_at', 'distance_m', 'conclusion', 'compromisos', 'next_step_date', 'lineas', 'input_mode', 'out_of_territory', 'cuenta_para',
    'peso', 'sede_por_confirmar', 'editable', 'agenda_id', 'agendada',
    'marcas', 'en_sitio', 'gps_accuracy_m', 'medico_no_listado', 'motivo_codigo', 'foto',
  ]),
  visitaCreate: exactas<ObjetoVisitaCreate>()([
    'client_id', 'tipo', 'subtipo_id', 'medico_id', 'cuenta_id', 'sede_id', 'contacto_id', 'modalidad', 'medio', 'efectiva', 'failure_reason',
    'retry_date', 'checked_in_at', 'reported_at', 'lat', 'lng', 'gps_accuracy_m', 'conclusion', 'compromisos', 'next_step_date', 'transcript',
    'input_mode', 'lineas', 'agenda_id',
    'tz', 'gps_at', 'motivo_codigo', 'medico_no_listado',
  ]),
  visitaCreateResponse: exactas<VisitaCreateResponse>()(['visita', 'repetida']),
  transcripcion: exactas<TranscripcionResponse>()(['transcript', 'duracion_s', 'modelo']),
  propuesta: exactas<PropuestaResponse>()(['visitas', 'aviso']),
  visitaPropuesta: exactas<VisitaPropuesta>()([
    'tipo', 'subtipo_codigo', 'subtipo_id', 'medico_id', 'medico_nombre_dicho', 'sugerir_crear_medico', 'cuenta_id', 'sede_id', 'contacto_id',
    'contacto_nombre_dicho', 'lineas', 'efectiva', 'failure_reason', 'conclusion', 'compromisos', 'next_step_date', 'modalidad_sugerida',
    'confianza', 'preguntas',
  ]),
  numeros: exactas<NumerosResponse>()([
    'mes', 'cuota', 'hechas', 'cumplimiento', 'dias_habiles_sin_visitas', 'telefonicas', 'no_efectivas', 'fuera_de_territorio', 'sede_por_confirmar',
    'agenda',
  ]),
  // Agenda (F4.1, migración 0840; ciclo de vida desde la 0850)
  numerosAgenda: exactas<NumerosAgenda>()([
    'efectivas', 'efectivas_agendadas', 'porcentaje_agendadas', 'citas_hasta_hoy', 'citas_hechas', 'citas_no_realizadas', 'cumplimiento',
  ]),
  cita: exactas<CitaItem>()([
    'id', 'fecha', 'hora', 'tipo', 'medico', 'cuenta', 'subtipo', 'sede', 'nota', 'estado', 'visita_id', 'distancia_m', 'dentro_del_radio',
    'anticipada', 'cancelable', 'motivo_codigo', 'no_realizada_at', 'no_realizada_motivo', 'viene_de', 'viene_de_fecha', 'viene_de_estado',
    'sucesora_id', 'como', 'estado_visible',
  ]),
  sedeCita: exactas<SedeCita>()(['id', 'nombre', 'cuenta_id', 'cuenta_nombre', 'lat', 'lng', 'ubicacion_confirmada']),
  agenda: exactas<AgendaResponse>()(['desde', 'hasta', 'hoy', 'max_fecha', 'items']),
  citaResponse: exactas<CitaResponse>()(['cita']),
  citaCreate: exactas<ObjetoCitaCreate>()(['fecha', 'hora', 'tipo', 'medico_id', 'cuenta_id', 'subtipo_id', 'sede_id', 'nota', 'como']),
  citaCancelar: exactas<CitaCancelar>()(['motivo', 'motivo_codigo']),
  citaCerrar: exactas<CitaCerrar>()(['motivo_codigo', 'motivo']),
  citaOtraFecha: exactas<CitaOtraFecha>()(['fecha', 'hora', 'sede_id', 'nota', 'como']),
  citaEliminada: exactas<CitaEliminadaResponse>()(['cita_id']),
  campos: exactas<CamposDictadoResponse>()(['conclusion', 'compromisos', 'next_step_date']),
  // Equipo (2026-10-31): GET /api/equipo/{personas,hoy,persona/[id]}
  equipoPersonas: exactas<EquipoPersonasResponse>()(['personas', 'lineas']),
  equipoHoy: exactas<EquipoHoyResponse>()(['fecha', 'texto_fijo', 'resumen', 'personas']),
  equipoPersonaDia: exactas<EquipoPersonaDiaResponse>()(['fecha', 'persona', 'donde', 'rastro', 'siguiente']),
  equipoRendimiento: exactas<EquipoRendimientoResponse>()(['desde', 'hasta', 'mes_completo', 'equipo', 'por_persona']),
  equipoPersonaRendimiento: exactas<EquipoPersonaRendimientoResponse>()(['desde', 'hasta', 'mes_completo', 'fila', 'visitas', 'citas']),
} as const

export type FormaApi = keyof typeof CLAVES_API

/** Claves de un objeto, ordenadas (para comparar con una lista de CLAVES_API). */
export function clavesDe(objeto: unknown): string[] {
  return objeto && typeof objeto === 'object' && !Array.isArray(objeto) ? Object.keys(objeto).sort() : []
}

/** ¿El objeto trae exactamente las claves de esa forma? */
export function tieneClaves(objeto: unknown, forma: FormaApi): boolean {
  const esperadas = [...CLAVES_API[forma]].sort()
  const reales = clavesDe(objeto)
  return reales.length === esperadas.length && reales.every((clave, i) => clave === esperadas[i])
}
