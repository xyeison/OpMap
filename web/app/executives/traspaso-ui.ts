// Utilidades de la interfaz del traspaso en /executives (no es una ruta: Next.js solo publica page.tsx).
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. Tipos y reglas: lib/traspaso.ts.
import {
  leerResumenTraspaso,
  type AnexoFinalGuardado,
  type TraspasoHistorialItem,
  type TraspasoResponse,
  type TraspasoResumenPrevisto,
  type VistaPreviaTraspaso,
} from '@/lib/traspaso'

/** "1 médico", "3 médicos". */
export function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`
}

/** "A", "A y B", "A, B y C". */
export function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Frases cortas de lo que se mueve (vista previa, en presente) o se movió (resultado e historial, en pasado).
 * Sin frases si solo pasan las líneas.
 */
export function frasesResumen(resumen: TraspasoResumenPrevisto, tiempo: 'presente' | 'pasado'): string[] {
  const pasado = tiempo === 'pasado'
  /** Verbo según número y tiempo: [presente singular, presente plural, pasado singular, pasado plural]. */
  const v = (n: number, formas: [string, string, string, string]) => formas[(pasado ? 2 : 0) + (n === 1 ? 0 : 1)]
  const frases: string[] = []
  const n = resumen.visitantes_movidos
  if (n > 0) frases.push(`${plural(n, 'médico', 'médicos')} ${v(n, ['pasa', 'pasan', 'pasó', 'pasaron'])} a quien recibe`)
  const t = resumen.visitantes_terminados
  if (t > 0) {
    frases.push(
      `${plural(t, 'médico', 'médicos')} solo ${v(t, ['se termina', 'se terminan', 'se terminó', 'se terminaron'])} (${v(t, [
        'queda',
        'quedan',
        'quedó',
        'quedaron',
      ])} sin visitante)`
    )
  }
  // Los omitidos 'medico_inactivo' ya van en "solo se terminan" (la función los cuenta en los dos): aquí solo los que
  // quien recibe ya visitaba.
  const o = resumen.omitidos.filter(omitido => omitido.razon === 'ya_lo_visita').length
  if (o > 0) {
    frases.push(
      `${plural(o, 'médico', 'médicos')} no ${v(o, ['se duplica', 'se duplican', 'se duplicó', 'se duplicaron'])}: quien recibe ya ${o === 1 ? 'lo' : 'los'} visitaba`
    )
  }
  const am = resumen.ajustes_movidos
  if (am > 0) frases.push(`${plural(am, 'ajuste manual', 'ajustes manuales')} de cobertura ${v(am, ['pasa', 'pasan', 'pasó', 'pasaron'])}`)
  const ad = resumen.ajustes_desactivados
  if (ad > 0) {
    frases.push(`${plural(ad, 'ajuste manual', 'ajustes manuales')} ${v(ad, ['se desactiva', 'se desactivan', 'se desactivó', 'se desactivaron'])}`)
  }
  const nc = resumen.nombres_copiados
  if (nc > 0) {
    frases.push(`${plural(nc, 'nombre de territorio', 'nombres de territorio')} ${v(nc, ['se copia', 'se copian', 'se copió', 'se copiaron'])}`)
  }
  const ex = resumen.excepciones_copiadas
  if (ex > 0) {
    frases.push(`${plural(ex, 'excepción personal', 'excepciones personales')} ${v(ex, ['se copia', 'se copian', 'se copió', 'se copiaron'])}`)
  }
  return frases
}

/** '2026-10-12' → '12 oct 2026' (sin corrimiento de zona horaria). */
export function fechaLarga(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha)
  if (!partes) return fecha
  const dia = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])))
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(dia)
}

/** Fecha y hora de un timestamp, en Bogotá. */
export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return ''
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
}

/** La frase única de la confirmación final ("¿Seguro?"). */
export function fraseConfirmacion(vista: VistaPreviaTraspaso): string {
  const origen = vista.origen?.full_name ?? 'Quien entrega'
  const lineas = unirNombres(vista.lineas.map(linea => linea.line_name))
  const desde = fechaLarga(vista.fecha)
  const r = vista.resumen
  const cosas: string[] = []
  if (r.visitantes_movidos > 0) cosas.push(plural(r.visitantes_movidos, 'médico', 'médicos'))
  if (r.ajustes_movidos > 0) cosas.push(plural(r.ajustes_movidos, 'ajuste manual', 'ajustes manuales'))
  if (r.nombres_copiados > 0) cosas.push(plural(r.nombres_copiados, 'nombre de territorio', 'nombres de territorio'))
  const conCosas = cosas.length > 0 ? ` con ${unirNombres(cosas)}` : ''

  if (vista.destino.tipo === 'nadie') {
    const terminados = r.visitantes_terminados > 0 ? `; ${plural(r.visitantes_terminados, 'médico queda', 'médicos quedan')} sin visitante` : ''
    const desactivados = r.ajustes_desactivados > 0 ? `; ${plural(r.ajustes_desactivados, 'ajuste manual se desactiva', 'ajustes manuales se desactivan')}` : ''
    return `${origen} deja ${lineas} desde el ${desde} y nadie ${vista.lineas.length === 1 ? 'la' : 'las'} recibe${terminados}${desactivados}.`
  }
  const destino = vista.destino.full_name ?? 'quien recibe'
  const quien = vista.destino.tipo === 'nueva' ? `${destino} (persona nueva)` : vista.destino.tipo === 'vacante' ? `la vacante «${destino}»` : destino
  if (vista.dar_de_baja) {
    return `${origen} se da de baja (su último día es el ${fechaLarga(vista.fin_origen)}) y desde el ${desde} ${lineas}${conCosas} ${vista.lineas.length === 1 ? 'pasa' : 'pasan'} a ${quien}.`
  }
  return `Desde el ${desde}, ${lineas}${conCosas} ${vista.lineas.length === 1 ? 'pasa' : 'pasan'} de ${origen} a ${quien}.`
}

// ---------------------------------------------------------------------------------------------
// Lectura tolerante de las respuestas de la API (las rutas pueden envolver el objeto o no)
// ---------------------------------------------------------------------------------------------

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null
}

/** VistaPreviaTraspaso de POST .../traspaso/vista-previa ({...} o { vista_previa: {...} }); null si no tiene forma. */
export function leerVistaPrevia(data: unknown): VistaPreviaTraspaso | null {
  const objeto = comoObjeto(data)
  if (!objeto) return null
  const candidato = comoObjeto(objeto.vista_previa) ?? comoObjeto(objeto.vista) ?? objeto
  if (!Array.isArray(candidato.lineas) || !comoObjeto(candidato.resumen) || !comoObjeto(candidato.destino)) return null
  const vista = candidato as unknown as VistaPreviaTraspaso
  return {
    ...vista,
    errores: Array.isArray(vista.errores) ? vista.errores : [],
    avisos: Array.isArray(vista.avisos) ? vista.avisos : [],
    excepciones_a_copiar: Array.isArray(vista.excepciones_a_copiar) ? vista.excepciones_a_copiar : [],
    resumen: { ...vista.resumen, omitidos: Array.isArray(vista.resumen.omitidos) ? vista.resumen.omitidos : [] },
  }
}

function leerAnexos(valor: unknown): AnexoFinalGuardado[] {
  if (!Array.isArray(valor)) return []
  return valor
    .map(item => comoObjeto(item))
    .filter((item): item is Record<string, unknown> => item !== null && typeof item.line_id === 'string')
    .map(item => ({
      line_id: item.line_id as string,
      etiqueta: typeof item.etiqueta === 'string' ? item.etiqueta : '',
      snapshot_id: typeof item.snapshot_id === 'string' ? item.snapshot_id : null,
      error: typeof item.error === 'string' && item.error ? item.error : null,
      ya_existia: item.ya_existia === true,
    }))
}

/** TraspasoResponse de POST .../traspaso; null si no trae un resumen legible. */
export function leerRespuestaTraspaso(data: unknown): TraspasoResponse | null {
  const objeto = comoObjeto(data)
  if (!objeto) return null
  const resumen = leerResumenTraspaso(objeto.resumen) ?? leerResumenTraspaso(objeto)
  if (!resumen) return null
  const respuesta: TraspasoResponse = {
    resumen,
    anexos_finales: leerAnexos(objeto.anexos_finales),
    cobertura_recalculada: objeto.cobertura_recalculada !== false,
  }
  if (typeof objeto.usuario_enlazado === 'boolean') respuesta.usuario_enlazado = objeto.usuario_enlazado
  return respuesta
}

/** Lista del historial de GET /api/executives/traspasos ({ traspasos } o la lista sola). */
export function leerHistorial(data: unknown): TraspasoHistorialItem[] {
  const lista = Array.isArray(data) ? data : comoObjeto(data)?.traspasos
  if (!Array.isArray(lista)) return []
  return lista
    .map(item => comoObjeto(item))
    .filter((item): item is Record<string, unknown> => item !== null && typeof item.id === 'string')
    .map(item => {
      const fila = item as unknown as TraspasoHistorialItem
      return {
        ...fila,
        lineas: Array.isArray(fila.lineas) ? fila.lineas : [],
        lineas_nombres: Array.isArray(fila.lineas_nombres) ? fila.lineas_nombres : [],
        resumen: leerResumenTraspaso(item.resumen),
      }
    })
}

/**
 * Aviso de PATCH y DELETE /api/executives/[id] cuando el cambio quedó guardado pero el recálculo de la cobertura
 * falló ({ cobertura_recalculada: false, aviso }): la cobertura guardada sigue dándole zonas a quien se fue o perdió
 * la línea hasta que alguien pulse «Recalcular». null si se recalculó o si el cambio no la tocaba.
 */
export function avisoCoberturaDe(data: unknown): string | null {
  const objeto = comoObjeto(data)
  if (!objeto || objeto.cobertura_recalculada !== false) return null
  return typeof objeto.aviso === 'string' && objeto.aviso.trim()
    ? objeto.aviso
    : 'Se guardó, pero no se pudo recalcular la cobertura. Usa "Recalcular cobertura" en la cobertura de la línea.'
}

/** Ejecutivo Comercial que se devuelve en { executive } (contratar), o null. */
export function executiveDe<T extends { id: string }>(data: unknown): T | null {
  const executive = comoObjeto(comoObjeto(data)?.executive)
  return executive && typeof executive.id === 'string' ? (executive as unknown as T) : null
}
