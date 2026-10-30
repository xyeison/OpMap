/**
 * El tema de cada persona (etapa 1 del diseño, dueño 2026-10-30; spec docs/specs/2026-10-30-diseno-web-etapa-1.md):
 * Claro, Oscuro o Automático (el del teléfono), elegido en Ajustes. ESPEJO de web/lib/tema.ts: la misma clave y las
 * mismas reglas, para que en el navegador elegirlo en OpMap o en la app valga para los dos (scripts/checks/22-tema.ts
 * corre los dos). Puro: lo usan lib/tema-preferencia.tsx (guardado y proveedor) y las pruebas.
 */

export type PreferenciaTema = 'claro' | 'oscuro' | 'auto'
export type Tema = 'claro' | 'oscuro'

/** La clave en el teléfono (AsyncStorage) y en el navegador (localStorage, la misma de OpMap). */
export const CLAVE_TEMA = 'opmap.tema.v1'

/** Lo guardado, o 'auto' si no se reconoce (nada, otro texto, otro tipo). */
export function leerPreferencia(valor: unknown): PreferenciaTema {
  return valor === 'claro' || valor === 'oscuro' || valor === 'auto' ? valor : 'auto'
}

/** El tema que se ve: el elegido, o con 'auto' el del sistema (teléfono o computador). */
export function temaEfectivo(preferencia: PreferenciaTema, prefiereOscuro: boolean): Tema {
  if (preferencia === 'auto') return prefiereOscuro ? 'oscuro' : 'claro'
  return preferencia
}
