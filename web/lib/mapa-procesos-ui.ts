// Textos de la sección "Empresas en procesos sin contrato (SECOP II)" de las tarjetas del mapa (ProcesosSection en
// components/MapPopups.tsx). Desde el 2026-10-25 la tarjeta solo nombra las empresas ("que sea súper conciso; la idea es
// que vea el nombre de las empresas"); el detalle de cada proceso (precio base, fecha, referencia, enlace) está en la
// ficha de la IPS (components/HospitalProcesosCard.tsx). Puro (sin React ni red) para que scripts/mapa-detalle-api-check.ts pruebe exactamente lo
// que se pinta a partir de la respuesta de GET /api/map/detalle/*. Spec: docs/specs/2026-10-25-secop-procesos-radar.md.
//
// Reglas de los textos (decisión del dueño 2026-10-25): el proveedor FIGURA en el proceso (nunca "adjudicado a" ni
// "ganó"); el precio base es de la convocatoria y nunca se suma; una persona natural nunca se nombra; el título del
// proceso no se muestra. Nada de "abierto", "en curso" ni "licitación": en régimen especial el proceso queda
// "publicado" para siempre. Imports relativos (no '@/') para usarlo tal cual en las pruebas con tsx.
import type { AlcanceDetalle, EmpresaEnProcesos } from './types/mapa-detalle'
import { numeroEs } from './zona-estadisticas'

/** Empresas que se ven sin desplegar en la tarjeta del mapa; el resto con "Ver las N empresas". */
export const EMPRESAS_MAPA_VISIBLES = 6

/** Una empresa en la tarjeta: su nombre y, si figura en más de un proceso, cuántos ("OSTEOEQUIPOS SAS (2)"). */
export function textoEmpresa(empresa: EmpresaEnProcesos): string {
  return empresa.procesos > 1 ? `${empresa.nombre} (${numeroEs(empresa.procesos)})` : empresa.nombre
}

/** Procesos sin empresa que figure: "3 procesos sin empresa publicada" o, debajo de una lista, "y 1 proceso sin …". */
export function textoSinEmpresa(cantidad: number, hayEmpresas: boolean): string | null {
  if (cantidad <= 0) return null
  const texto = `${numeroEs(cantidad)} ${cantidad === 1 ? 'proceso' : 'procesos'} sin empresa publicada`
  return hayEmpresas ? `y ${texto}` : texto
}

/** Botón para desplegar las empresas: "Ver las N empresas" / "Ver menos"; null si caben en las visibles. */
export function textoVerEmpresas(cantidad: number, todas: boolean): string | null {
  if (cantidad <= EMPRESAS_MAPA_VISIBLES) return null
  return todas ? 'Ver menos' : `Ver las ${numeroEs(cantidad)} empresas`
}

/** Mientras carga la tarjeta: con alcance 'procesos' nunca se anuncian giros ni compras. */
export function textoCargandoDetalle(alcance: AlcanceDetalle): string {
  return alcance === 'procesos' ? 'Cargando procesos…' : 'Cargando giros y compras…'
}
