// Colores y tema de OpMap web (etapa 1 del diseño, dueño 2026-10-30; spec docs/specs/2026-10-30-diseno-web-etapa-1.md).
// Los papeles de color son los de la app de campo (mobile/lib/paleta.ts, "dirección A, estilo Uber", elegida el
// 2026-10-15): negro y blanco, rellenos #EEEEEE y estados sobre fondos suaves, en claro y en oscuro. Una prueba
// (scripts/tema-check.ts) exige que sean los mismos letra por letra. La preferencia de cada persona (Claro, Oscuro o
// Automático) se guarda en el navegador con la misma clave que usa la app en ese navegador (/campo): elegirla en uno vale
// para los dos. Nunca va a la base. Puro: lo usan el layout (servidor), el cliente y las pruebas.

export type PreferenciaTema = 'claro' | 'oscuro' | 'auto'
export type Tema = 'claro' | 'oscuro'

/** La clave en el navegador (la misma de mobile/lib/tema-preferencia.ts). */
export const CLAVE_TEMA = 'opmap.tema.v1'

/** Los papeles de color de la app (los nombres de `Colores` de mobile/lib/paleta.ts). */
export type PapelColor =
  | 'fondo'
  | 'superficie'
  | 'superficieSuave'
  | 'relleno'
  | 'texto'
  | 'textoSuave'
  | 'textoInactivo'
  | 'borde'
  | 'bordeFuerte'
  | 'acento'
  | 'sobreAcento'
  | 'peligro'
  | 'fondoPeligro'
  | 'exito'
  | 'fondoExito'
  | 'alerta'
  | 'fondoAlerta'
  | 'info'
  | 'fondoInfo'
  | 'encabezado'
  | 'sobreEncabezado'
  | 'bordeControl'
  | 'agarradera'

export type Papeles = Record<PapelColor, string>

export const PAPELES_CLAROS: Papeles = {
  fondo: '#FFFFFF',
  superficie: '#FFFFFF',
  superficieSuave: '#F6F6F6',
  relleno: '#EEEEEE',
  texto: '#000000',
  textoSuave: '#5C5B5B',
  textoInactivo: '#A3A3A3',
  borde: '#EEEEEE',
  bordeFuerte: '#E6E6E6',
  acento: '#000000',
  sobreAcento: '#FFFFFF',
  peligro: '#B91C1C',
  fondoPeligro: '#FDF0F0',
  exito: '#047857',
  fondoExito: '#E7F4EE',
  alerta: '#92400E',
  fondoAlerta: '#FFF6E5',
  info: '#1E40AF',
  fondoInfo: '#EEF3FE',
  encabezado: '#000000',
  sobreEncabezado: '#FFFFFF',
  bordeControl: '#8A8A8A',
  agarradera: '#D4D4D4',
}

export const PAPELES_OSCUROS: Papeles = {
  fondo: '#000000',
  superficie: '#161616',
  superficieSuave: '#1F1F1F',
  relleno: '#2C2C2C',
  texto: '#FFFFFF',
  textoSuave: '#A6A6A6',
  textoInactivo: '#666666',
  borde: '#2A2A2A',
  bordeFuerte: '#333333',
  acento: '#FFFFFF',
  sobreAcento: '#000000',
  peligro: '#FCA5A5',
  fondoPeligro: '#3A1414',
  exito: '#6EE7B7',
  fondoExito: '#0F2A22',
  alerta: '#FCD34D',
  fondoAlerta: '#33270B',
  info: '#93C5FD',
  fondoInfo: '#14223A',
  encabezado: '#000000',
  sobreEncabezado: '#FFFFFF',
  bordeControl: '#6B6B6B',
  agarradera: '#4A4A4A',
}

/** Lo guardado en el navegador, o 'auto' si no se reconoce (nada, otro texto, otro tipo). */
export function leerPreferencia(valor: unknown): PreferenciaTema {
  return valor === 'claro' || valor === 'oscuro' || valor === 'auto' ? valor : 'auto'
}

/** El tema que se ve: el elegido, o con 'auto' el del sistema (teléfono o computador). */
export function temaEfectivo(preferencia: PreferenciaTema, prefiereOscuro: boolean): Tema {
  if (preferencia === 'auto') return prefiereOscuro ? 'oscuro' : 'claro'
  return preferencia
}

/** La variable CSS de un papel: 'superficieSuave' → '--color-superficie-suave'. */
export function variableCss(papel: PapelColor): string {
  return `--color-${papel.replace(/[A-Z]/g, letra => `-${letra.toLowerCase()}`)}`
}

function bloqueCss(selector: string, papeles: Papeles, extra?: string): string {
  const lineas = (Object.keys(papeles) as PapelColor[]).map(papel => `  ${variableCss(papel)}: ${papeles[papel]};`)
  if (extra) lineas.push(`  ${extra}`)
  return `${selector} {\n${lineas.join('\n')}\n}`
}

/**
 * Las variables de los dos temas: el claro también en :root (sin data-tema, como antes de que corra el script). <main>
 * va en claro (las páginas que no se han rehecho siguen así hasta su etapa); una página rehecha lleva data-sigue-tema y
 * toma el tema de <html>, con los controles del navegador (campos, autocompletar) también en oscuro.
 */
export function cssDeTemas(): string {
  return [
    bloqueCss(':root, [data-tema="claro"]', PAPELES_CLAROS),
    bloqueCss('[data-tema="oscuro"]', PAPELES_OSCUROS),
    bloqueCss('[data-tema="oscuro"] [data-sigue-tema]', PAPELES_OSCUROS, 'color-scheme: dark;'),
  ].join('\n')
}

/**
 * Corre en <head> antes de pintar (sin destello blanco en oscuro): lee la preferencia, mira el sistema si es automática
 * y pone `data-tema` en <html>. Nunca lanza: con el almacenamiento bloqueado (modo privado) queda en automático y sin
 * matchMedia, en claro.
 */
export const SCRIPT_TEMA_INICIAL = `(function(){var t='claro';try{var p=null;try{p=window.localStorage.getItem('${CLAVE_TEMA}')}catch(e){}if(p!=='claro'&&p!=='oscuro'){p='auto'}var o=false;try{o=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}t=p==='auto'?(o?'oscuro':'claro'):p}catch(e){}document.documentElement.dataset.tema=t})()`

/** Luminancia relativa de un color #RRGGBB (WCAG 2.x). */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

/** Contraste WCAG 2.x entre dos colores #RRGGBB (de 1 a 21), como contraste() de la app. */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}
