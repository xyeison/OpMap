// Textos de la sección "Procesos publicados sin contrato (SECOP II)" de las tarjetas del mapa (ProcesosSection en
// components/MapPopups.tsx). Puro (sin React ni red) para que scripts/mapa-detalle-api-check.ts pruebe exactamente lo
// que se pinta a partir de la respuesta de GET /api/map/detalle/*. Spec: docs/specs/2026-10-25-secop-procesos-radar.md.
//
// Reglas de los textos (decisión del dueño 2026-10-25): el proveedor FIGURA en el proceso (nunca "adjudicado a" ni
// "ganó"); el precio base es de la convocatoria y nunca se suma; una persona natural nunca se nombra; el título del
// proceso no se muestra. Nada de "abierto", "en curso" ni "licitación": en régimen especial el proceso queda
// "publicado" para siempre. Imports relativos (no '@/') para usarlo tal cual en las pruebas con tsx.
import { lineaLabel } from './compras-publicas'
import { formatCopCompact } from './giros-format'
import { MAPA_DETALLE_TEXTOS, PROCESOS_MAPA_VISIBLES } from './mapa-detalle'
import type { AlcanceDetalle, ProcesoDetalle } from './types/mapa-detalle'
import { fechaEs, numeroEs } from './zona-estadisticas'

/** Lo que pinta una fila: rótulo (proveedor), cifras, detalle en gris y el enlace al expediente (null: sin enlace). */
export interface FilaProceso {
  proveedor: string
  cifras: string
  detalle: string
  url: string | null
}

/**
 * Rótulo del proveedor que figura: la empresa (con "· según el título del proceso" si salió del título y "· Vigilado"
 * si está en la lista vigilada), "Proveedor persona natural" (sin nombre ni documento) o "Proveedor no publicado".
 */
export function proveedorDeProceso(proceso: ProcesoDetalle): string {
  if (proceso.proveedorPersona) return `Proveedor ${MAPA_DETALLE_TEXTOS.proveedorPersona}`
  if (!proceso.proveedor) return MAPA_DETALLE_TEXTOS.proveedorNoPublicado
  const partes = [proceso.proveedor.nombre]
  if (proceso.proveedor.origen === 'titulo') partes.push(MAPA_DETALLE_TEXTOS.proveedorTitulo)
  if (proceso.proveedor.vigilado) partes.push('Vigilado')
  return partes.join(' · ')
}

/**
 * Una fila de la sección: "Precio base $ 1,8 mil M · publicado 10 mar 2026" y, en gris, "[entidad · ]líneas · Ref. …"
 * (la entidad solo en la tarjeta de municipio o localidad, que reúne varias IPS). Sin precio base (null o 0) lo dice;
 * sin fecha la omite.
 */
export function filaProceso(proceso: ProcesoDetalle, modo: 'territorio' | 'ips'): FilaProceso {
  const precio =
    proceso.precioBase !== null && proceso.precioBase > 0 ? `Precio base ${formatCopCompact(proceso.precioBase)}` : 'Precio base no publicado'
  const cifras = [precio, proceso.fechaPublicacion ? `publicado ${fechaEs(proceso.fechaPublicacion)}` : null].filter(Boolean).join(' · ')
  const lineas = (proceso.lineas.length > 0 ? proceso.lineas : [proceso.linea]).map(lineaLabel).join(', ')
  const detalle = [modo === 'territorio' ? proceso.entidad : null, lineas || null, proceso.referencia ? `Ref. ${proceso.referencia}` : null]
    .filter(Boolean)
    .join(' · ')
  return { proveedor: proveedorDeProceso(proceso), cifras, detalle, url: proceso.url }
}

/** Botón para desplegar dentro de la tarjeta: "Ver los N procesos" / "Ver menos"; null si caben en las visibles. */
export function textoVerProcesos(cantidad: number, todos: boolean): string | null {
  if (cantidad <= PROCESOS_MAPA_VISIBLES) return null
  return todos ? 'Ver menos' : `Ver los ${numeroEs(cantidad)} procesos`
}

/** Si el servidor cortó la lista (máximo 20): "Se muestran los 20 más recientes de 57". null si llegaron todos. */
export function textoMasRecientes(enviados: number, total: number): string | null {
  if (total <= enviados) return null
  return `Se muestran los ${numeroEs(enviados)} más recientes de ${numeroEs(total)}`
}

/** Mientras carga la tarjeta: con alcance 'procesos' nunca se anuncian giros ni compras. */
export function textoCargandoDetalle(alcance: AlcanceDetalle): string {
  return alcance === 'procesos' ? 'Cargando procesos…' : 'Cargando giros y compras…'
}
