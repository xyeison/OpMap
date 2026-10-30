/**
 * Fase 6 · F1 Terceros (app de visita): lógica PURA (sin red, sin base de datos, sin node:*), compartida por
 * la API (/api/terceros/**), la interfaz (/terceros) y las pruebas (scripts/terceros-check.ts).
 * Contrato: docs/fases/fase6-visitas-f1-terceros.md. Spec: docs/specs/2026-10-12-app-de-visita-opmap.md.
 *
 * Qué hay aquí:
 *   1. Constantes con su etiqueta en español (clases de cuenta, tipos de identificación, especialidades,
 *      roles de contacto, roles del médico en una sede, modalidad de facturación) y la semilla de subtipos.
 *   2. Identificaciones: validarIdentificacion / normalizarIdentificacion (NIT a 9 dígitos sin DV con
 *      normalizeNit de lib/secop.ts y el DV comprobado si viene; cédula solo dígitos) y, para cuentas,
 *      validarIdentificacionCuenta / nitsEquivalentes (el NIT de una empresa no entra como CC u "otro").
 *   3. Nombres: normalizarNombre y nombresParecidos (para avisar de médicos repetidos).
 *   4. Contactos: rolDesdeCargo (el cargo escrito sugiere el rol) y subtipoSugerido (el rol sugiere el
 *      subtipo de visita institucional).
 *   5. Privacidad: el documento del médico y la identificación de una persona solo con terceros:manage.
 *      Aviso de visitantes vigentes que ya no cumplen la regla con la que se asignaron (avisoVisitante).
 *   6. Tipos de filas y respuestas de la API, para que API e interfaz hablen igual.
 */
import { dvNit, normalizeNit } from './secop'

// ---------------------------------------------------------------------------------------------
// 1. Constantes
// ---------------------------------------------------------------------------------------------

/** Opción de una lista cerrada: el valor que se guarda y la etiqueta que se muestra. */
export interface Opcion<T extends string = string> {
  valor: T
  etiqueta: string
}

/** Valores de una lista de opciones como tupla no vacía (lo que pide z.enum). */
export function valoresDe<T extends string>(opciones: readonly Opcion<T>[]): [T, ...T[]] {
  return opciones.map(opcion => opcion.valor) as [T, ...T[]]
}

/** Etiqueta de un valor; si no está en la lista, el valor tal cual (nunca vacío para la UI). */
export function etiquetaDe<T extends string>(opciones: readonly Opcion<T>[], valor: string | null | undefined): string {
  if (!valor) return ''
  return opciones.find(opcion => opcion.valor === valor)?.etiqueta ?? valor
}

export const CLASES_CUENTA = [
  { valor: 'clinica', etiqueta: 'Clínica' },
  { valor: 'consultorio', etiqueta: 'Consultorio' },
  { valor: 'eps', etiqueta: 'EPS' },
  { valor: 'operador_logistico', etiqueta: 'Operador logístico' },
  { valor: 'otra', etiqueta: 'Otra' },
] as const satisfies readonly Opcion[]
export type ClaseCuenta = (typeof CLASES_CUENTA)[number]['valor']
export const VALORES_CLASE_CUENTA = valoresDe<ClaseCuenta>(CLASES_CUENTA)

export const TIPOS_ID_CUENTA = [
  { valor: 'NIT', etiqueta: 'NIT' },
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'PA', etiqueta: 'Pasaporte' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const satisfies readonly Opcion[]
export type TipoIdCuenta = (typeof TIPOS_ID_CUENTA)[number]['valor']
export const VALORES_TIPO_ID_CUENTA = valoresDe<TipoIdCuenta>(TIPOS_ID_CUENTA)

export const TIPOS_DOC_MEDICO = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'PA', etiqueta: 'Pasaporte' },
  { valor: 'PEP', etiqueta: 'Permiso especial de permanencia' },
  { valor: 'PPT', etiqueta: 'Permiso por protección temporal' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const satisfies readonly Opcion[]
export type TipoDocMedico = (typeof TIPOS_DOC_MEDICO)[number]['valor']
export const VALORES_TIPO_DOC_MEDICO = valoresDe<TipoDocMedico>(TIPOS_DOC_MEDICO)

/**
 * Para crear, corregir o verificar un médico: solo la cédula de ciudadanía o la de extranjería, para no repetirlos
 * (dueño, 2026-10-30, docs/decisiones/2026-10-30-medicos-y-contactos-sin-duplicados.md). TIPOS_DOC_MEDICO sigue con
 * todos para mostrar los que ya estaban guardados.
 */
export const TIPOS_DOC_MEDICO_NUEVO = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
] as const satisfies readonly Opcion[]
export type TipoDocMedicoNuevo = (typeof TIPOS_DOC_MEDICO_NUEVO)[number]['valor']
export const VALORES_TIPO_DOC_MEDICO_NUEVO = valoresDe<TipoDocMedicoNuevo>(TIPOS_DOC_MEDICO_NUEVO)
// ---------------------------------------------------------------------------------------------
// Contactos sin duplicados (dueño, 2026-10-30): teléfono y/o correo; en una cuenta no se repiten
// ---------------------------------------------------------------------------------------------

/** Un contacto sin teléfono ni correo no se puede crear ni dejar así al corregirlo. */
export const MENSAJE_CONTACTO_SIN_TELEFONO_NI_CORREO = 'Escribe el teléfono o el correo del contacto'
/** El 409 de un contacto que ya está en la cuenta (el mismo teléfono o el mismo correo); va con `existente`. */
export const MENSAJE_CONTACTO_REPETIDO = 'Ese contacto ya está en la cuenta (el mismo teléfono o el mismo correo)'

/**
 * Los dígitos de un teléfono para compararlo (se guarda como se escribió): sin espacios, guiones ni paréntesis, y sin
 * el +57 de Colombia ("+57 300 123 4567" y "300-123-4567" son el mismo). null si no tiene dígitos. Espejo de la columna
 * generada contactos.telefono_digitos (migración 0950).
 */
export function digitosTelefono(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (!digitos) return null
  return digitos.length === 12 && digitos.startsWith('57') ? digitos.slice(2) : digitos
}

/** ¿Es el mismo contacto? El mismo teléfono (por dígitos) o el mismo correo (sin importar mayúsculas). */
export function mismoContacto(
  a: { telefono?: string | null; email?: string | null },
  b: { telefono?: string | null; email?: string | null }
): boolean {
  const telefonoA = digitosTelefono(a.telefono)
  const correoA = a.email?.trim().toLowerCase() || null
  return (telefonoA !== null && telefonoA === digitosTelefono(b.telefono)) || (correoA !== null && correoA === (b.email?.trim().toLowerCase() || null))
}

/** El mensaje de un documento de médico que no es CC ni CE. */
export const MENSAJE_DOC_MEDICO_CC_CE = 'El documento del médico es la cédula de ciudadanía (CC) o la cédula de extranjería (CE)'

/** Misma lista que el CHECK de medicos.especialidades (el orden es el de la interfaz). */
export const ESPECIALIDADES = [
  { valor: 'ortopedia', etiqueta: 'Ortopedia y traumatología' },
  { valor: 'neurocirugia', etiqueta: 'Neurocirugía' },
  { valor: 'columna', etiqueta: 'Cirugía de columna' },
  { valor: 'deportiva', etiqueta: 'Medicina deportiva / artroscopia' },
  { valor: 'maxilofacial', etiqueta: 'Cirugía maxilofacial' },
  { valor: 'fisiatria', etiqueta: 'Fisiatría' },
  { valor: 'cirugia_general', etiqueta: 'Cirugía general' },
  { valor: 'otra', etiqueta: 'Otra' },
] as const satisfies readonly Opcion[]
export type EspecialidadMedico = (typeof ESPECIALIDADES)[number]['valor']
export const VALORES_ESPECIALIDAD = valoresDe<EspecialidadMedico>(ESPECIALIDADES)

/** Misma lista que el CHECK de contactos.rol. */
export const ROLES_CONTACTO = [
  { valor: 'compras', etiqueta: 'Compras' },
  { valor: 'gerencia', etiqueta: 'Gerencia' },
  { valor: 'direccion_medica', etiqueta: 'Dirección médica' },
  { valor: 'quimico_farmaceutico', etiqueta: 'Químico farmacéutico' },
  { valor: 'almacen_farmacia', etiqueta: 'Almacén o farmacia' },
  { valor: 'autorizaciones', etiqueta: 'Autorizaciones' },
  { valor: 'auditoria_medica', etiqueta: 'Auditoría médica' },
  { valor: 'programacion_cirugia', etiqueta: 'Programación de cirugía' },
  { valor: 'quirofano', etiqueta: 'Quirófano' },
  { valor: 'esterilizacion', etiqueta: 'Esterilización' },
  { valor: 'instrumentacion', etiqueta: 'Instrumentación' },
  { valor: 'cartera_facturacion', etiqueta: 'Cartera y facturación' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const satisfies readonly Opcion[]
export type RolContacto = (typeof ROLES_CONTACTO)[number]['valor']
export const VALORES_ROL_CONTACTO = valoresDe<RolContacto>(ROLES_CONTACTO)

/** Rol del médico en una sede (medico_sedes.rol). */
export const ROLES_MEDICO_SEDE = [
  { valor: 'consultorio', etiqueta: 'Consultorio' },
  { valor: 'atiende', etiqueta: 'Atiende' },
] as const satisfies readonly Opcion[]
export type RolMedicoSede = (typeof ROLES_MEDICO_SEDE)[number]['valor']
export const VALORES_ROL_MEDICO_SEDE = valoresDe<RolMedicoSede>(ROLES_MEDICO_SEDE)

/** Modalidad de facturación de una EPS (solo clase 'eps'). */
export const MODALIDADES_FACTURACION = [
  { valor: 'directa', etiqueta: 'Directa' },
  { valor: 'via_clinica', etiqueta: 'A través de la clínica' },
] as const satisfies readonly Opcion[]
export type ModalidadFacturacion = (typeof MODALIDADES_FACTURACION)[number]['valor']
export const VALORES_MODALIDAD_FACTURACION = valoresDe<ModalidadFacturacion>(MODALIDADES_FACTURACION)

export type OrigenCuenta = 'hospitals' | 'manual'
export type OrigenSede = 'hospitals' | 'manual' | 'gps_app'

export const etiquetaClaseCuenta = (valor: string | null | undefined) => etiquetaDe(CLASES_CUENTA, valor)
export const etiquetaTipoIdCuenta = (valor: string | null | undefined) => etiquetaDe(TIPOS_ID_CUENTA, valor)
export const etiquetaTipoDocMedico = (valor: string | null | undefined) => etiquetaDe(TIPOS_DOC_MEDICO, valor)
export const etiquetaEspecialidad = (valor: string | null | undefined) => etiquetaDe(ESPECIALIDADES, valor)
export const etiquetaRolContacto = (valor: string | null | undefined) => etiquetaDe(ROLES_CONTACTO, valor)
export const etiquetaRolMedicoSede = (valor: string | null | undefined) => etiquetaDe(ROLES_MEDICO_SEDE, valor)
export const etiquetaModalidad = (valor: string | null | undefined) => etiquetaDe(MODALIDADES_FACTURACION, valor)

/** Fecha desde la que rige la semilla de subtipos (la misma de la migración 0800). */
export const SUBTIPOS_VIGENTES_DESDE = '2026-10-12'

export interface SubtipoSemilla {
  codigo: string
  nombre: string
  para_que: string
  roles_sugeridos: readonly RolContacto[]
  orden: number
}

/** Semilla de subtipos de visita institucional (spec, sección 5). La migración 0800 inserta lo mismo. */
export const SUBTIPOS_SEMILLA: readonly SubtipoSemilla[] = [
  {
    codigo: 'compras',
    nombre: 'Compras',
    para_que: 'Que nos compren: precio, condiciones, contrato',
    roles_sugeridos: ['compras', 'gerencia', 'direccion_medica'],
    orden: 1,
  },
  {
    codigo: 'quimico_farmaceutico',
    nombre: 'Químico farmacéutico',
    para_que: 'Que acepten y codifiquen el producto',
    roles_sugeridos: ['quimico_farmaceutico', 'almacen_farmacia'],
    orden: 2,
  },
  {
    codigo: 'autorizaciones',
    nombre: 'Autorizaciones',
    para_que: 'Que la EPS acepte y autorice el producto o el procedimiento',
    roles_sugeridos: ['autorizaciones', 'auditoria_medica'],
    orden: 3,
  },
  {
    codigo: 'programacion',
    nombre: 'Programación',
    para_que: 'Que programen al paciente',
    roles_sugeridos: ['programacion_cirugia', 'quirofano', 'esterilizacion', 'instrumentacion'],
    orden: 4,
  },
  {
    codigo: 'otro',
    nombre: 'Otro',
    para_que: 'Lo que aparezca',
    roles_sugeridos: ['otro'],
    orden: 5,
  },
]

/** Tamaño de página de las listas de cuentas y médicos. */
export const TERCEROS_POR_PAGINA = 50

/** Página pedida en ?page= (1 si falta o no es un entero positivo; tope 10.000). */
export function leerPagina(valor: string | null | undefined): number {
  const pagina = Number(valor)
  if (!Number.isInteger(pagina) || pagina < 1) return 1
  return Math.min(pagina, 10_000)
}

// ---------------------------------------------------------------------------------------------
// 2. Identificaciones
// ---------------------------------------------------------------------------------------------

export type TipoIdentificacion = TipoIdCuenta | TipoDocMedico

export type ResultadoIdentificacion = { ok: true; valor: string } | { ok: false; error: string }

/**
 * Valida y normaliza una identificación, con un mensaje en español si no sirve.
 * - NIT: se quitan espacios y puntos; normalizeNit (lib/secop.ts) deja los 9 dígitos sin DV. Si viene el
 *   DV (tras un guion o como décimo dígito), debe ser el de la DIAN: un DV que no cuadra casi siempre es un
 *   NIT mal digitado, y un NIT mal digitado es una cuenta repetida. El NIT de una persona natural (su cédula
 *   + DV) no es de 9 dígitos: esa cuenta va con tipo CC.
 * - CC: solo dígitos (3 a 10), sin puntos, espacios ni guiones.
 * - CE, PA, PEP, PPT, otro: letras y números en mayúsculas (3 a 20), sin espacios, puntos ni guiones.
 * El resultado siempre cumple el CHECK de la base: ^[0-9A-Z]{3,20}$.
 */
export function validarIdentificacion(tipo: string | null | undefined, numero: unknown): ResultadoIdentificacion {
  const texto = numero === null || numero === undefined ? '' : String(numero).trim().toUpperCase()
  if (!texto) return { ok: false, error: 'Escribe el número de identificación' }

  if (tipo === 'NIT') {
    const limpio = texto.replace(/\s+/g, '')
    if (!/^\d[\d.]*(-\d+)?$/.test(limpio)) {
      return { ok: false, error: 'El NIT solo puede tener números, puntos y un guion antes del dígito de verificación' }
    }
    const nit = normalizeNit(limpio)
    if (!nit || !/^\d{9}$/.test(nit)) {
      return {
        ok: false,
        error: 'El NIT de una empresa tiene 9 dígitos (sin el dígito de verificación); si es una persona, usa su cédula',
      }
    }
    const digitos = limpio.replace(/\D/g, '')
    if (digitos.length > 10) return { ok: false, error: 'El dígito de verificación del NIT es un solo número' }
    if (digitos.length === 10) {
      const dv = dvNit(nit)
      if (dv !== Number(digitos[9])) {
        return { ok: false, error: `El dígito de verificación no corresponde al NIT (para ${nit} es ${dv})` }
      }
    }
    return { ok: true, valor: nit }
  }

  const limpio = texto.replace(/[\s.\-]+/g, '')
  if (tipo === 'CC') {
    if (!/^\d{3,10}$/.test(limpio)) return { ok: false, error: 'La cédula solo lleva números (entre 3 y 10 dígitos)' }
    return { ok: true, valor: limpio }
  }
  if (tipo === 'CE' || tipo === 'PA' || tipo === 'PEP' || tipo === 'PPT' || tipo === 'otro') {
    if (!/^[0-9A-Z]{3,20}$/.test(limpio)) {
      return { ok: false, error: 'El número solo puede tener letras y números (entre 3 y 20, sin tildes ni Ñ)' }
    }
    return { ok: true, valor: limpio }
  }
  return { ok: false, error: 'Tipo de identificación no válido' }
}

/** Identificación normalizada (la que se guarda y se compara), o null si no es válida. */
export function normalizarIdentificacion(tipo: string | null | undefined, numero: unknown): string | null {
  const resultado = validarIdentificacion(tipo, numero)
  return resultado.ok ? resultado.valor : null
}

/**
 * NIT de empresa (9 dígitos, sin DV) que esconde un número escrito, o null. Puntos y espacios no cuentan. Tiene
 * forma de NIT: 9 dígitos ("900123456"); 9 dígitos, guion y un dígito ("900.123.456-7": el guion dice que es un
 * DV, cuadre o no); o 10 dígitos seguidos que empiezan por 8 o 9 y cuyo último es el DV de los 9 primeros
 * ("9001234567"; la misma regla de normalizeNit: una cédula de 10 dígitos empieza por 1).
 */
export function formaDeNit(numero: unknown): string | null {
  if (numero === null || numero === undefined) return null
  const limpio = String(numero).replace(/[\s.]+/g, '')
  if (/^\d{9}$/.test(limpio)) return limpio
  const conGuion = /^(\d{9})-\d$/.exec(limpio)
  if (conGuion) return conGuion[1]
  if (/^[89]\d{9}$/.test(limpio) && dvNit(limpio.slice(0, 9)) === Number(limpio[9])) return limpio.slice(0, 9)
  return null
}

/** ¿El número trae un dígito de verificación tras un guion, como un NIT ("79.123.456-1", "900123456-7")? */
export function traeDigitoVerificacion(numero: unknown): boolean {
  if (numero === null || numero === undefined) return false
  return /^[\d.\s]*\d[\d.\s]*-\s*\d$/.test(String(numero).trim())
}

/**
 * Identificación de una CUENTA: validarIdentificacion y, para los tipos que no son NIT (CC, CE, PA, otro), dos
 * reglas más para que el NIT de una empresa no entre por otro tipo (regla del dueño: una cuenta por
 * identificación, no se repite el NIT): no se admite un dígito de verificación tras un guion ("900.123.456-7" o
 * el NIT de una persona "79.123.456-1" como CC: una cédula no lleva DV) y "otro" no admite un número con forma
 * de NIT. Que el número choque con una cuenta NIT que ya existe lo comprueba la API (nitsEquivalentes).
 */
export function validarIdentificacionCuenta(tipo: string | null | undefined, numero: unknown): ResultadoIdentificacion {
  const resultado = validarIdentificacion(tipo, numero)
  if (!resultado.ok || tipo === 'NIT') return resultado
  if (traeDigitoVerificacion(numero)) {
    return {
      ok: false,
      error:
        'Ese número trae dígito de verificación, como un NIT: si es una empresa, elige el tipo NIT; si es una persona, escribe su documento sin el dígito de verificación',
    }
  }
  if (tipo === 'otro' && formaDeNit(resultado.valor)) {
    return { ok: false, error: 'Ese número tiene forma de NIT: elige el tipo NIT (una cuenta por identificación)' }
  }
  return resultado
}

/**
 * NIT con los que choca el número YA NORMALIZADO de una cuenta que no es NIT (CC, CE, PA, otro): 9 dígitos → ese
 * NIT; 10 dígitos que empiezan por 8 o 9 con el DV del NIT al final → los 9 primeros. La API busca una cuenta NIT
 * con ese número y responde 409 con ella. Para el tipo NIT, [] (su llave es la UNIQUE de la base).
 */
export function nitsEquivalentes(tipo: string | null | undefined, numero: string | null | undefined): string[] {
  if (tipo === 'NIT' || !numero) return []
  const nit = formaDeNit(numero)
  return nit ? [nit] : []
}

/**
 * Números con los que una cuenta de otro tipo (CC, CE, PA, otro) repetiría este NIT de 9 dígitos: el NIT solo y
 * con su DV pegado. La API los busca al crear una cuenta NIT (el camino inverso de nitsEquivalentes).
 */
export function numerosEquivalentesANit(nit: string | null | undefined): string[] {
  if (!nit || !/^\d{9}$/.test(nit)) return []
  const dv = dvNit(nit)
  return dv === null ? [nit] : [nit, `${nit}${dv}`]
}

// ---------------------------------------------------------------------------------------------
// 3. Nombres
// ---------------------------------------------------------------------------------------------

/** Tratamientos que no cuentan para comparar nombres de personas. */
const TRATAMIENTOS = new Set(['dr', 'dra', 'doctor', 'doctora', 'dres', 'dras'])
/** Conectores que no cuentan como palabra del nombre ("María de los Ángeles"). */
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'san', 'van', 'von'])

/**
 * Nombre para buscar parecidos: minúsculas, sin tildes (ñ → n), sin "Dr.", "Dra.", "Doctor(a)", sin
 * signos y con los espacios colapsados. "  Dra. María José  PÉREZ-Gómez " → "maria jose perez gomez".
 */
export function normalizarNombre(nombre: unknown): string {
  if (nombre === null || nombre === undefined) return ''
  return String(nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(palabra => palabra && !TRATAMIENTOS.has(palabra))
    .join(' ')
}

/** Palabras con peso de un nombre (sin conectores ni tratamientos), sin repetir. */
export function palabrasNombre(nombre: unknown): string[] {
  const palabras = normalizarNombre(nombre)
    .split(' ')
    .filter(palabra => palabra && !CONECTORES.has(palabra))
  return Array.from(new Set(palabras))
}

/** ¿Distancia de edición <= 1 (una letra cambiada, de más o de menos)? */
function difierenEnUnaLetra(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let diferencias = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    diferencias++
    if (diferencias > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return diferencias + (a.length - i) + (b.length - j) <= 1
}

/** Dos palabras de nombre coinciden si son iguales o, si ambas tienen 5+ letras, difieren en una letra. */
function mismaPalabra(a: string, b: string): boolean {
  if (a === b) return true
  return a.length >= 5 && b.length >= 5 && difierenEnUnaLetra(a, b)
}

/**
 * ¿Pueden ser la misma persona? Sí si los nombres normalizados son iguales o si TODAS las palabras del
 * nombre más corto (al menos dos) aparecen en el otro, en cualquier orden y tolerando una letra de
 * diferencia en palabras largas: "Juan Pérez" ≈ "Dr. Juan Carlos Pérez Gómez", "Andrés Gómez" ≈ "Andres
 * Gomes". Un solo nombre en común no basta: "Juan Pérez" no se parece a "Juan Gómez".
 */
export function nombresParecidos(a: unknown, b: unknown): boolean {
  const normA = normalizarNombre(a)
  const normB = normalizarNombre(b)
  if (!normA || !normB) return false
  if (normA === normB) return true
  const palabrasA = palabrasNombre(a)
  const palabrasB = palabrasNombre(b)
  const [corto, largo] = palabrasA.length <= palabrasB.length ? [palabrasA, palabrasB] : [palabrasB, palabrasA]
  if (corto.length < 2) return false
  const usadas = new Set<number>()
  for (const palabra of corto) {
    const indice = largo.findIndex((otra, posicion) => !usadas.has(posicion) && mismaPalabra(palabra, otra))
    if (indice === -1) return false
    usadas.add(indice)
  }
  return true
}

// ---------------------------------------------------------------------------------------------
// 4. Rol del contacto por su cargo y subtipo sugerido
// ---------------------------------------------------------------------------------------------

/**
 * Reglas en orden de prioridad sobre el cargo normalizado (minúsculas, sin tildes, sin signos). La primera
 * que aplica gana: lo específico (dirección médica, programación, esterilización...) va antes que lo general
 * (quirófano, gerencia), para que "Director científico" no quede como gerencia, "Programador de cirugía"
 * no quede como quirófano ni "Director de compras" como gerencia.
 */
const REGLAS_CARGO: ReadonlyArray<{ rol: RolContacto; patron: RegExp }> = [
  { rol: 'direccion_medica', patron: /\b(sub)?direct(or|ora|ores)\s+(cientific|medic)|\b(sub)?direccion\s+(cientific|medic)/ },
  { rol: 'cartera_facturacion', patron: /\bcartera\b|\bfactura|\bglosas?\b|\bcuentas medicas\b/ },
  { rol: 'auditoria_medica', patron: /\baudit(or|ora|ores|oras|oria)\b(\s+\w+)?\s+medic/ },
  { rol: 'autorizaciones', patron: /\bautoriza/ },
  { rol: 'programacion_cirugia', patron: /\bprogramac|\bprogramador/ },
  { rol: 'esterilizacion', patron: /\besteriliza/ },
  { rol: 'instrumentacion', patron: /\binstrumenta/ },
  { rol: 'quirofano', patron: /\bquirofano|\bcirugia|\bquirurgic/ },
  { rol: 'quimico_farmaceutico', patron: /\bquimic[oa]s?\b/ },
  { rol: 'compras', patron: /\bcompra|\badquisicion|\babastecimiento/ },
  { rol: 'almacen_farmacia', patron: /\balmacen|\bfarmacia|\bbodega|\bregente/ },
  {
    rol: 'gerencia',
    patron: /\b(sub)?gerente\b|\b(sub)?gerencia\b|\b(sub)?direct(or|ora|ores)\b|\bdireccion\b|\badministrador(a)?\b|\brepresentante legal\b|\bpresidente\b/,
  },
]

function textoCargo(cargo: unknown): string {
  if (cargo === null || cargo === undefined) return ''
  return String(cargo)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Rol de contacto sugerido por el cargo escrito: "Jefe de Compras" → compras; "Químico Farmacéutico" →
 * quimico_farmaceutico; "Programador de cirugía" → programacion_cirugia; "Coordinadora Sala de Cirugía" →
 * quirofano; "Central de Esterilización" → esterilizacion; "Jefe de Almacén" → almacen_farmacia; "Director
 * Científico" → direccion_medica; "Auditora Médica" → auditoria_medica; "Gerente" → gerencia. Sin cargo o
 * sin regla → 'otro'. La persona que crea el contacto puede cambiarlo.
 */
export function rolDesdeCargo(cargoTexto: unknown): RolContacto {
  const texto = textoCargo(cargoTexto)
  if (!texto) return 'otro'
  for (const regla of REGLAS_CARGO) {
    if (regla.patron.test(texto)) return regla.rol
  }
  return 'otro'
}

export interface SubtipoParaSugerir {
  codigo: string
  roles_sugeridos: readonly string[]
  orden?: number | null
}

/**
 * Código del subtipo de visita institucional que sugiere el rol del contacto: el primero (por `orden`)
 * cuyos roles_sugeridos incluyen el rol; si ninguno, 'otro'. Se le pasan los subtipos VIGENTES (por
 * defecto, la semilla).
 */
export function subtipoSugerido(
  rol: string | null | undefined,
  subtipos: readonly SubtipoParaSugerir[] = SUBTIPOS_SEMILLA
): string {
  if (!rol) return 'otro'
  const ordenados = subtipos
    .map((subtipo, posicion) => ({ subtipo, posicion }))
    .sort((a, b) => (a.subtipo.orden ?? a.posicion) - (b.subtipo.orden ?? b.posicion) || a.posicion - b.posicion)
  const encontrado = ordenados.find(({ subtipo }) => subtipo.roles_sugeridos.includes(rol))
  return encontrado ? encontrado.subtipo.codigo : 'otro'
}

// ---------------------------------------------------------------------------------------------
// 5. Privacidad y reglas de cuenta
// ---------------------------------------------------------------------------------------------

/**
 * ¿La identificación de la cuenta es de una persona (no se muestra sin terceros:manage)? Todo lo que no es
 * NIT: el contrato lo exige para los consultorios con CC/CE/PA; aquí se protege cualquier documento de
 * persona, sea cual sea la clase (más estricto que el contrato, nunca menos). El NIT siempre se muestra.
 */
export function identificacionCuentaProtegida(cuenta: { tipo_identificacion: string | null | undefined }): boolean {
  return cuenta.tipo_identificacion !== 'NIT'
}

/** La cuenta con numero_identificacion = null si es de una persona y quien pide no tiene terceros:manage. */
export function ocultarIdentificacionCuenta<T extends { tipo_identificacion: string; numero_identificacion: string | null }>(
  cuenta: T,
  puedeAdministrar: boolean
): T {
  if (puedeAdministrar || !identificacionCuentaProtegida(cuenta)) return cuenta
  return { ...cuenta, numero_identificacion: null }
}

/** El médico sin tipo ni número de documento (para listas y para quien no tiene terceros:manage). */
export function sinDocumento<T extends object>(medico: T): Omit<T, 'tipo_documento' | 'numero_documento'> {
  const copia = { ...medico } as Record<string, unknown>
  delete copia.tipo_documento
  delete copia.numero_documento
  return copia as Omit<T, 'tipo_documento' | 'numero_documento'>
}

/**
 * Aviso de una asignación de visitante VIGENTE que ya no cumple las reglas con las que se creó (POST
 * /medicos/[id]/visitantes): el Ejecutivo Comercial quedó inactivo, ya no lleva esa línea (executive_lines) o la
 * línea se desactivó. F1 no cierra nada por su cuenta (cerrar esas asignaciones solas es decisión del dueño):
 * solo avisa en listas y detalle para que quien gestiona visitantes la termine. null si está bien, si ya terminó
 * o si no hay con qué comparar.
 */
export function avisoVisitante(
  visitante: { hasta?: string | null },
  ejecutivo: { status?: string | null } | null | undefined,
  linea: { active?: boolean | null } | null | undefined,
  llevaLinea: boolean
): string | null {
  if (visitante.hasta) return null
  if (ejecutivo?.status === 'inactive') return 'El Ejecutivo Comercial está inactivo'
  if (ejecutivo && !llevaLinea) return 'El Ejecutivo Comercial ya no lleva esta línea'
  if (linea && linea.active === false) return 'La línea está inactiva'
  return null
}

/**
 * Error si la modalidad de facturación no cabe en la clase (solo una EPS tiene modalidad), o null si está
 * bien. Para el PATCH que trae modalidad sin clase: la API lo comprueba contra la clase guardada.
 */
export function errorModalidad(clase: string | null | undefined, modalidad: string | null | undefined): string | null {
  if (modalidad === null || modalidad === undefined) return null
  if (clase !== 'eps') return 'La modalidad de facturación solo aplica a una EPS'
  return null
}

// ---------------------------------------------------------------------------------------------
// 6. Tipos de filas (schema public, migración 2026-10-12_0800) y de respuestas de /api/terceros/**
// ---------------------------------------------------------------------------------------------

export interface CuentaRow {
  id: string
  nombre: string
  clase: ClaseCuenta
  es_cliente: boolean
  tipo_identificacion: TipoIdCuenta
  numero_identificacion: string
  codigo_prestador: string | null
  modalidad_facturacion: ModalidadFacturacion | null
  notas: string | null
  activo: boolean
  origen: OrigenCuenta
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface SedeRow {
  id: string
  cuenta_id: string
  nombre: string
  es_principal: boolean
  reps_code: string | null
  hospital_id: string | null
  direccion: string | null
  municipality_id: string | null
  ciudad: string | null
  lat: number | null
  lng: number | null
  ubicacion_confirmada: boolean
  activo: boolean
  origen: OrigenSede
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface MedicoRow {
  id: string
  tipo_documento: TipoDocMedico
  numero_documento: string
  nombre: string
  especialidades: EspecialidadMedico[]
  municipality_id: string
  telefono: string | null
  email: string | null
  notas: string | null
  activo: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

/** Médico sin documento: lo único que ve quien no tiene terceros:manage. */
export type MedicoPublico = Omit<MedicoRow, 'tipo_documento' | 'numero_documento'>

export interface MedicoSedeRow {
  medico_id: string
  sede_id: string
  rol: RolMedicoSede
  principal: boolean
  created_at?: string
}

export interface VisitanteRow {
  id: string
  medico_id: string
  executive_id: string
  line_id: string
  municipality_id: string | null
  desde: string
  hasta: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface ContactoRow {
  id: string
  cuenta_id: string
  sede_id: string | null
  nombre: string
  cargo_texto: string | null
  rol: RolContacto
  telefono: string | null
  email: string | null
  activo: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface SubtipoRow {
  id: string
  codigo: string
  nombre: string
  para_que: string
  roles_sugeridos: string[]
  orden: number
  vigente_desde: string
  vigente_hasta: string | null
  created_at?: string
  updated_at?: string
}

/** Respuesta paginada de las listas. */
export interface Pagina<T> {
  items: T[]
  total: number
  page: number
}

/** GET /api/terceros/cuentas → items. numero_identificacion es null si está protegido (ver arriba). */
export interface CuentaListItem {
  id: string
  nombre: string
  clase: ClaseCuenta
  es_cliente: boolean
  tipo_identificacion: TipoIdCuenta
  numero_identificacion: string | null
  modalidad_facturacion: ModalidadFacturacion | null
  sedes: number
  activo: boolean
}

/** GET /api/terceros/cuentas/[id] */
export interface CuentaDetalle {
  cuenta: Omit<CuentaRow, 'numero_identificacion'> & { numero_identificacion: string | null }
  sedes: SedeRow[]
  contactos: ContactoRow[]
}

/** GET /api/terceros/sedes → items (buscador de sedes para vincular médicos). */
export interface SedeBusquedaItem {
  id: string
  nombre: string
  cuenta_id: string
  cuenta_nombre: string
  ciudad: string | null
  reps_code: string | null
}

/** Sede de un médico en listas y detalle. */
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

/** Visitante de un médico: nombre del Ejecutivo Comercial y de la línea (con sus ids si la API los da). */
export interface VisitanteResumen {
  id?: string
  executive_id?: string
  executive: string
  line_id?: string
  line: string
  municipality_id?: string | null
  ciudad?: string | null
  desde?: string
  hasta?: string | null
  /** Solo en las vigentes: por qué hay que revisarla (avisoVisitante); null o ausente si está bien. */
  aviso?: string | null
}

/** GET /api/terceros/medicos → items (nunca lleva documento). */
export interface MedicoListItem {
  id: string
  nombre: string
  especialidades: EspecialidadMedico[]
  municipality_id: string
  ciudad: string | null
  sedes: MedicoSedeResumen[]
  visitantes: VisitanteResumen[]
  activo: boolean
}

/**
 * GET /api/terceros/medicos/[id]: tipo_documento y numero_documento solo con terceros:manage. visitantes trae
 * los vigentes (hasta null) y los terminados (historia); en las listas solo vienen los vigentes.
 */
export type MedicoDetalle = MedicoPublico & {
  tipo_documento?: TipoDocMedico
  numero_documento?: string
  ciudad: string | null
  sedes: MedicoSedeResumen[]
  visitantes: VisitanteResumen[]
}

/** POST /api/terceros/medicos/verificar */
export interface MedicoVerificarRespuesta {
  existente: { id: string; nombre: string } | null
  parecidos: { id: string; nombre: string; ciudad: string | null }[]
}
