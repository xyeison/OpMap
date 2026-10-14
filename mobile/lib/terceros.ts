/**
 * Listas y reglas de terceros (F1) que usa la app para crear un médico completo o una sede, copiadas de
 * web/lib/terceros.ts (mismo orden y mismas etiquetas). PURO: lo prueba scripts/movil-check.ts. Si la web cambia
 * una lista (CHECK de la base), se cambia aquí a mano.
 *
 * El documento del médico se DIGITA (nunca se dicta ni lo propone la IA), se valida aquí con la misma regla que el
 * servidor y viaja solo en el cuerpo de POST /api/terceros/medicos[/verificar]; nunca se muestra en listas.
 */
import type { ClaseCuenta, EspecialidadMedico, RolMedicoSede, TipoDocMedico, TipoIdCuenta } from './tipos'

export interface Opcion<T extends string = string> {
  valor: T
  etiqueta: string
}

export const TIPOS_DOC_MEDICO: readonly Opcion<TipoDocMedico>[] = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'PA', etiqueta: 'Pasaporte' },
  { valor: 'PEP', etiqueta: 'Permiso especial de permanencia' },
  { valor: 'PPT', etiqueta: 'Permiso por protección temporal' },
  { valor: 'otro', etiqueta: 'Otro' },
]

/** Etiqueta corta del tipo de documento para los chips ("CC", "CE"…). */
export const SIGLA_DOC_MEDICO: Record<TipoDocMedico, string> = { CC: 'CC', CE: 'CE', PA: 'Pasaporte', PEP: 'PEP', PPT: 'PPT', otro: 'Otro' }

/** Misma lista que el CHECK de medicos.especialidades (orden de la interfaz). */
export const ESPECIALIDADES: readonly Opcion<EspecialidadMedico>[] = [
  { valor: 'ortopedia', etiqueta: 'Ortopedia y traumatología' },
  { valor: 'neurocirugia', etiqueta: 'Neurocirugía' },
  { valor: 'columna', etiqueta: 'Cirugía de columna' },
  { valor: 'deportiva', etiqueta: 'Medicina deportiva / artroscopia' },
  { valor: 'maxilofacial', etiqueta: 'Cirugía maxilofacial' },
  { valor: 'fisiatria', etiqueta: 'Fisiatría' },
  { valor: 'cirugia_general', etiqueta: 'Cirugía general' },
  { valor: 'otra', etiqueta: 'Otra' },
]

export const ROLES_MEDICO_SEDE: readonly Opcion<RolMedicoSede>[] = [
  { valor: 'consultorio', etiqueta: 'Consultorio' },
  { valor: 'atiende', etiqueta: 'Atiende' },
]

export const CLASES_CUENTA: readonly Opcion<ClaseCuenta>[] = [
  { valor: 'clinica', etiqueta: 'Clínica' },
  { valor: 'consultorio', etiqueta: 'Consultorio' },
  { valor: 'eps', etiqueta: 'EPS' },
  { valor: 'operador_logistico', etiqueta: 'Operador logístico' },
  { valor: 'otra', etiqueta: 'Otra' },
]

export function etiquetaDe<T extends string>(opciones: readonly Opcion<T>[], valor: string | null | undefined): string {
  if (!valor) return ''
  return opciones.find(opcion => opcion.valor === valor)?.etiqueta ?? valor
}

export const etiquetaEspecialidad = (valor: string | null | undefined) => etiquetaDe(ESPECIALIDADES, valor)
export const etiquetaClaseCuenta = (valor: string | null | undefined) => etiquetaDe(CLASES_CUENTA, valor)

export type ResultadoDocumento = { ok: true; valor: string } | { ok: false; error: string }

/**
 * Valida y normaliza el documento de un médico como validarIdentificacion de la web (sin NIT: un médico es una
 * persona). CC: solo dígitos (3 a 10). CE, PA, PEP, PPT, otro: letras y números en mayúsculas (3 a 20). Se quitan
 * espacios, puntos y guiones.
 */
export function validarDocumentoMedico(tipo: TipoDocMedico | null | undefined, numero: unknown): ResultadoDocumento {
  const texto = numero === null || numero === undefined ? '' : String(numero).trim().toUpperCase()
  if (!tipo) return { ok: false, error: 'Elige el tipo de documento del médico' }
  if (!texto) return { ok: false, error: 'Escribe el número de documento del médico' }
  const limpio = texto.replace(/[\s.\-]+/g, '')
  if (tipo === 'CC') {
    if (!/^\d{3,10}$/.test(limpio)) return { ok: false, error: 'La cédula solo lleva números (entre 3 y 10 dígitos)' }
    return { ok: true, valor: limpio }
  }
  if (!/^[0-9A-Z]{3,20}$/.test(limpio)) {
    return { ok: false, error: 'El número solo puede tener letras y números (entre 3 y 20, sin tildes ni Ñ)' }
  }
  return { ok: true, valor: limpio }
}

/** Tipo de identificación de la cuenta del consultorio de un médico (PEP y PPT no existen en cuentas: "otro"). */
export function tipoIdCuentaDeMedico(tipo: TipoDocMedico): TipoIdCuenta {
  return tipo === 'CC' || tipo === 'CE' || tipo === 'PA' ? tipo : 'otro'
}

/** Nombre de un tercero sin espacios de más. */
export function limpiarNombre(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

/** Código de habilitación del REPS: '' → null; 12 dígitos (se quitan espacios y guiones); si no, error. */
export function validarRepsCode(texto: string): { ok: true; valor: string | null } | { ok: false; error: string } {
  const limpio = texto.replace(/[\s-]+/g, '')
  if (!limpio) return { ok: true, valor: null }
  if (!/^\d{12}$/.test(limpio)) return { ok: false, error: 'El código de habilitación del REPS tiene 12 dígitos' }
  return { ok: true, valor: limpio }
}

/** Departamento (2 dígitos) de un municipio DANE (5 dígitos; las celdas de Bogotá de 7 dígitos → sus 5 primeros). */
export function departamentoDe(municipio: string | null | undefined): string | null {
  const codigo = (municipio ?? '').trim().slice(0, 5)
  return /^\d{5}$/.test(codigo) ? codigo.slice(0, 2) : null
}

/** Municipio DANE de 5 dígitos (las celdas de Bogotá de 7 → los 5 primeros); null si no es un código. */
export function municipioDe(codigo: string | null | undefined): string | null {
  const limpio = (codigo ?? '').trim().slice(0, 5)
  return /^\d{5}$/.test(limpio) ? limpio : null
}
