/**
 * La tarjeta de la visita en RESUMEN (spec 2026-10-15, decisión 8; paquete 2). Puro: sin react-native (lo prueba
 * scripts/checks/16-reportar.ts).
 *
 * - modoTarjeta: la tarjeta de voz que ya está bien (pasa validarBorrador, confianza ≥ 0,6, sin preguntas de la IA y
 *   presencial dentro del radio o telefónica válida) abre en resumen; lo dudoso abre completa con `atencion` (qué
 *   campo y por qué) arriba. La de toques abre siempre completa.
 * - filasResumen: lo que muestra el resumen, en orden: con quién, sede y si está dentro del radio, resultado, líneas,
 *   conclusión (en 3 líneas), compromisos y próxima reunión en palabras. Cada fila se toca para corregir solo ese
 *   campo. Una fila vacía no aparece, salvo la conclusión.
 * - textoPieConfirmar: el botón del pie fijo ("Confirmar visita 1 de 2"). Cada tarjeta se sigue confirmando con su
 *   propio toque y con las mismas validaciones (validarBorrador).
 * - resumenParaPie y avisoDelPie (revisión 2026-10-15): encima del botón, qué se confirma ("Efectiva · PerOssal y
 *   Reemplazo articular · sin conclusión") o, si falta algo o el servidor la rechazó, eso. La tarjeta por toques nace
 *   válida (efectiva, con las líneas del médico): sin esto se confirmaba de un toque sin ver resultado ni conclusión.
 */
import { esFechaIso, fechaLarga } from './fechas'
import { textoDistancia, type Punto } from './geo'
import type { PedidoAgendar } from './agenda'
import { cuentasDelCatalogo, distanciaASede, nombreSede, validarBorrador, type Borrador, type Catalogo, type EntradaValidacion, type Rechazo } from './propuesta'
import { ETIQUETA_MEDIO, type ErrorVisita } from './tipos'

/** Por debajo de esto la IA no está segura: la tarjeta abre completa. */
export const CONFIANZA_MINIMA_RESUMEN = 0.6

export type ModoTarjeta = 'resumen' | 'completa'

/** Algo que hay que revisar: el campo (el de validarBorrador, o 'preguntas' / 'confianza') y por qué. */
export interface Atencion {
  campo: string
  motivo: string
}

export interface DecisionTarjeta {
  modo: ModoTarjeta
  atencion: Atencion[]
}

export const MOTIVO_CONFIANZA_BAJA = 'La IA no está segura de esta visita: revisa con quién, la sede y el resultado.'
export const MOTIVO_DISTANCIA_DESCONOCIDA = 'No se sabe a qué distancia estás de la sede: la calcula el servidor al confirmar.'

/** ¿Resumen o completa? (y qué revisar). Usa la MISMA validación que Confirmar (validarBorrador). */
export function modoTarjeta(borrador: Borrador, catalogo: Catalogo, entrada: EntradaValidacion): DecisionTarjeta {
  if (borrador.origen !== 'voz') return { modo: 'completa', atencion: [] }
  const atencion: Atencion[] = []
  for (const pregunta of borrador.preguntas) atencion.push({ campo: 'preguntas', motivo: pregunta })
  if (borrador.confianza === null || !Number.isFinite(borrador.confianza) || borrador.confianza < CONFIANZA_MINIMA_RESUMEN) {
    atencion.push({ campo: 'confianza', motivo: MOTIVO_CONFIANZA_BAJA })
  }
  const revision = validarBorrador(borrador, catalogo, entrada)
  for (const error of revision.errores) atencion.push({ campo: error.campo, motivo: error.mensaje })
  // Presencial: solo "dentro del radio" si la distancia se sabe (la que no se sabe la decide el servidor).
  if (revision.ok && borrador.modalidad === 'presencial') {
    const distancia = distanciaASede(borrador, catalogo, entrada.punto)
    if (distancia.distancia_m === null) atencion.push({ campo: 'sede_id', motivo: MOTIVO_DISTANCIA_DESCONOCIDA })
  }
  return { modo: atencion.length === 0 ? 'resumen' : 'completa', atencion }
}

export type CampoResumen = 'con_quien' | 'sede' | 'resultado' | 'lineas' | 'conclusion' | 'compromisos' | 'proxima'

export interface FilaResumen {
  campo: CampoResumen
  etiqueta: string
  valor: string
  /** Líneas que se muestran como mucho (la conclusión, 3). */
  lineas?: number
}

/** Con quién: el médico (o el nombre que se dijo), o la cuenta, el subtipo y el contacto. */
export function textoConQuien(borrador: Borrador, catalogo: Catalogo): string {
  if (borrador.tipo === 'medica') {
    const medico = borrador.medico_id ? catalogo.medicos.find(m => m.id === borrador.medico_id) : undefined
    return medico?.nombre ?? borrador.medico_nombre_dicho ?? 'Sin médico'
  }
  if (borrador.tipo === 'institucional') {
    const cuenta = cuentasDelCatalogo(catalogo).find(c => c.id === borrador.cuenta_id)
    const subtipo = catalogo.subtipos.find(s => s.id === borrador.subtipo_id)
    const contacto = borrador.contacto_id ? catalogo.contactos.find(c => c.id === borrador.contacto_id) : undefined
    return [cuenta?.nombre ?? 'Sin cuenta', subtipo?.nombre, contacto?.nombre].filter(Boolean).join(' · ')
  }
  return 'Sin tipo de visita'
}

/** "Clínica Norte · Presencial a 35 m (dentro del radio)", "… · Telefónica (llamada)". */
export function textoSedeYModalidad(borrador: Borrador, catalogo: Catalogo, punto: Punto | null): string {
  const sede = borrador.sede_id ? nombreSede(borrador.sede_id, catalogo) : 'Sin sede'
  if (borrador.modalidad === 'telefonica') return `${sede} · Telefónica${borrador.medio ? ` (${ETIQUETA_MEDIO[borrador.medio].toLowerCase()})` : ''}`
  const distancia = borrador.sede_id ? distanciaASede(borrador, catalogo, punto) : { conocida: false, distancia_m: null }
  if (distancia.distancia_m === null) return `${sede} · Presencial (la distancia la calcula el servidor)`
  const dentro = distancia.distancia_m <= catalogo.config.radio_m
  return `${sede} · Presencial a ${textoDistancia(distancia.distancia_m)} (${dentro ? 'dentro del radio' : 'fuera del radio'})`
}

/** Las filas del resumen, en orden. Las vacías no salen, salvo la conclusión. */
export function filasResumen(borrador: Borrador, catalogo: Catalogo, opciones: { punto: Punto | null; ahora?: Date }): FilaResumen[] {
  const filas: FilaResumen[] = [
    { campo: 'con_quien', etiqueta: 'Con quién', valor: textoConQuien(borrador, catalogo) },
    { campo: 'sede', etiqueta: 'Sede', valor: textoSedeYModalidad(borrador, catalogo, opciones.punto) },
  ]
  const motivo = borrador.failure_reason.trim()
  filas.push({ campo: 'resultado', etiqueta: 'Resultado', valor: borrador.efectiva ? 'Efectiva' : motivo ? `No efectiva: ${motivo}` : 'No efectiva' })
  const lineas = borrador.lineas.map(id => catalogo.lineas.find(l => l.id === id)?.name).filter((nombre): nombre is string => !!nombre)
  if (lineas.length > 0) filas.push({ campo: 'lineas', etiqueta: lineas.length === 1 ? 'Línea' : 'Líneas', valor: lineas.join(', ') })
  const conclusion = borrador.conclusion.trim()
  filas.push({ campo: 'conclusion', etiqueta: 'Conclusión', valor: conclusion || 'Sin conclusión', lineas: 3 })
  const compromisos = borrador.compromisos.trim()
  if (compromisos) filas.push({ campo: 'compromisos', etiqueta: 'Compromisos', valor: compromisos, lineas: 3 })
  const proxima = borrador.next_step_date.trim()
  if (proxima && esFechaIso(proxima)) filas.push({ campo: 'proxima', etiqueta: 'Próxima reunión', valor: fechaLarga(proxima, opciones.ahora) })
  return filas
}

/** El botón del pie fijo: "Confirmar visita 1 de 2"; con una sola, "Confirmar esta visita". */
export function textoPieConfirmar(numero: number, total: number): string {
  return total <= 1 ? 'Confirmar esta visita' : `Confirmar visita ${numero} de ${total}`
}

/** "A y B", "A, B y C". */
function juntarNombres(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Lo que dice el pie encima de "Confirmar" (una línea): "Efectiva · PerOssal y Reemplazo articular · sin conclusión",
 * "Efectiva · 3 líneas · con conclusión", "Efectiva · sin líneas · sin conclusión" o "No efectiva: No estaba".
 */
export function resumenParaPie(borrador: Pick<Borrador, 'efectiva' | 'failure_reason' | 'lineas' | 'conclusion'>, catalogo: Pick<Catalogo, 'lineas'>): string {
  if (!borrador.efectiva) {
    const motivo = borrador.failure_reason.trim()
    return motivo ? `No efectiva: ${motivo}` : 'No efectiva'
  }
  const lineas = borrador.lineas.map(id => catalogo.lineas.find(l => l.id === id)?.name).filter((nombre): nombre is string => !!nombre)
  const textoLineas = lineas.length === 0 ? 'sin líneas' : lineas.length <= 2 ? juntarNombres(lineas) : `${lineas.length} líneas`
  return ['Efectiva', textoLineas, borrador.conclusion.trim() ? 'con conclusión' : 'sin conclusión'].join(' · ')
}

/**
 * El aviso del pie cuando la tarjeta que confirma no pasó: lo que falta ("Falta algo: Elige el médico · Elige la sede";
 * con varias visitas, "Falta algo en la visita 1: …"; como mucho 2 y "…") o el rechazo del servidor ("No se guardó: …").
 * null si no hay nada que decir.
 */
export function avisoDelPie(o: { numero: number; total: number; errores: readonly ErrorVisita[]; rechazo: Pick<Rechazo, 'mensaje'> | null }): string | null {
  const cual = o.total > 1 ? ` la visita ${o.numero}` : ''
  if (o.rechazo) return `No se guardó${cual}: ${o.rechazo.mensaje}`
  if (o.errores.length === 0) return null
  const mensajes = Array.from(new Set(o.errores.map(e => e.mensaje)))
  return `Falta algo${o.total > 1 ? ` en la visita ${o.numero}` : ''}: ${mensajes.slice(0, 2).join(' · ')}${mensajes.length > 2 ? ' …' : ''}`
}

/**
 * Con quién es la próxima reunión de una visita confirmada, para "Agendar esa reunión" (lib/agenda.ts
 * fijarPedidoAgendar: en memoria, nunca en la URL). null si la tarjeta no tiene tipo.
 */
export function pedidoAgendarDe(borrador: Pick<Borrador, 'tipo' | 'medico_id' | 'cuenta_id' | 'subtipo_id' | 'sede_id'>): PedidoAgendar | null {
  if (!borrador.tipo) return null
  if (borrador.tipo === 'medica') return { tipo: 'medica', medico_id: borrador.medico_id, sede_id: borrador.sede_id }
  return { tipo: 'institucional', cuenta_id: borrador.cuenta_id, subtipo_id: borrador.subtipo_id, sede_id: borrador.sede_id }
}
