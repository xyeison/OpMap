'use client'

// Fase 6 · F1 Terceros: piezas comunes de la interfaz /terceros (llamadas a la API, avisos, modal, paginación).
// Contrato: docs/fases/fase6-visitas-f1-terceros.md (sección "Interfaz").
import { useEffect, useState, type ReactNode } from 'react'
import type { ZodError } from 'zod'

/** Valor que solo cambia cuando deja de cambiar durante `ms` (para buscar mientras se escribe). */
export function useDemorado<T>(valor: T, ms = 300): T {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const temporizador = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(temporizador)
  }, [valor, ms])
  return demorado
}

// ---------------------------------------------------------------------------------------------
// Estilos (los mismos de /executives)
// ---------------------------------------------------------------------------------------------

export const claseInput =
  'w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500'
export const claseLabel = 'block text-sm font-medium text-gray-700 mb-1'
export const claseBotonPrimario =
  'px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
export const claseBotonSecundario =
  'px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed'
export const claseBotonChico =
  'px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed'

// ---------------------------------------------------------------------------------------------
// Llamadas a la API
// ---------------------------------------------------------------------------------------------

export interface Respuesta {
  ok: boolean
  status: number
  data: unknown
}

/** fetch + JSON sin lanzar por el estado HTTP (sí lanza si no hay red). `json` va como cuerpo. */
export async function pedirJson(url: string, opciones: { method?: string; json?: unknown } = {}): Promise<Respuesta> {
  const response = await fetch(url, {
    method: opciones.method ?? 'GET',
    headers: opciones.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opciones.json !== undefined ? JSON.stringify(opciones.json) : undefined,
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, data }
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null
}

/** Mensaje de error del servidor ({ error }) o uno genérico con el estado HTTP. */
export function mensajeError(respuesta: Respuesta, porDefecto: string): string {
  const error = comoObjeto(respuesta.data)?.error
  if (typeof error === 'string' && error) return error
  if (respuesta.status === 401) return 'Tu sesión terminó: vuelve a iniciar sesión'
  if (respuesta.status === 403) return 'No tienes permiso para esta acción'
  return `${porDefecto} (${respuesta.status})`
}

/** Mensaje para un error de red o inesperado. */
export function mensajeExcepcion(error: unknown, porDefecto: string): string {
  if (error instanceof TypeError) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
  return error instanceof Error && error.message ? error.message : porDefecto
}

/** { existente: { id, nombre } } de una respuesta 409 (cuenta o médico repetido), o null. */
export function existenteDe(data: unknown): { id: string; nombre: string } | null {
  const existente = comoObjeto(comoObjeto(data)?.existente)
  if (!existente || typeof existente.id !== 'string') return null
  return { id: existente.id, nombre: typeof existente.nombre === 'string' ? existente.nombre : 'Sin nombre' }
}

/**
 * Id de lo creado en la respuesta de un POST, buscando en las formas razonables: { id }, { <clave>: { id } }
 * o { <clave>_id }. La API puede responder con el objeto creado o solo con su id.
 */
export function idCreado(data: unknown, clave: string): string | null {
  const objeto = comoObjeto(data)
  if (!objeto) return null
  const anidado = comoObjeto(objeto[clave])
  if (anidado && typeof anidado.id === 'string') return anidado.id
  if (typeof objeto[`${clave}_id`] === 'string') return objeto[`${clave}_id`] as string
  if (typeof objeto.id === 'string') return objeto.id
  return null
}

/** Lista `items` de una respuesta paginada (vacía si no viene). */
export function itemsDe<T>(data: unknown): T[] {
  const items = comoObjeto(data)?.items
  return Array.isArray(items) ? (items as T[]) : []
}

export function totalDe(data: unknown, porDefecto: number): number {
  const total = comoObjeto(data)?.total
  return typeof total === 'number' && Number.isFinite(total) ? total : porDefecto
}

/** Primer mensaje de un error de zod (los esquemas de lib/terceros-schemas.ts ya hablan español). */
export function primerErrorZod(error: ZodError): string {
  return error.issues[0]?.message || 'Datos no válidos'
}

// ---------------------------------------------------------------------------------------------
// Fechas y textos
// ---------------------------------------------------------------------------------------------

/** Fecha de hoy en Bogotá, AAAA-MM-DD. */
export function hoyEnBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** '2026-10-12' → '12 oct 2026' (sin corrimiento de zona horaria). */
export function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha)
  if (!partes) return fecha
  const dia = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])))
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(dia)
}

/** Texto vacío → undefined (campo no enviado); con contenido → recortado. */
export function textoONada(valor: string): string | undefined {
  const limpio = valor.trim()
  return limpio ? limpio : undefined
}

/** Coordenada escrita → número, null si está vacía, NaN si no es un número. */
export function leerCoordenada(valor: string): number | null {
  const limpio = valor.trim().replace(',', '.')
  if (!limpio) return null
  return Number(limpio)
}

// ---------------------------------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------------------------------

export function AvisoError({ children, onReintentar }: { children: ReactNode; onReintentar?: () => void }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
      <div className="min-w-0 break-words">{children}</div>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="shrink-0 px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

export function AvisoOk({ children }: { children: ReactNode }) {
  return <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm break-words">{children}</div>
}

export function AvisoAtencion({ children }: { children: ReactNode }) {
  return <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm break-words">{children}</div>
}

export function Cargando({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-gray-600">
      <svg className="animate-spin h-6 w-6 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span className="text-sm">{texto}</span>
    </div>
  )
}

type TonoChip = 'gris' | 'verde' | 'azul' | 'ambar' | 'rojo' | 'negro'

const TONOS: Record<TonoChip, string> = {
  gris: 'bg-gray-100 border-gray-200 text-gray-700',
  verde: 'bg-green-50 border-green-200 text-green-700',
  azul: 'bg-blue-50 border-blue-200 text-blue-700',
  ambar: 'bg-amber-50 border-amber-200 text-amber-800',
  rojo: 'bg-red-50 border-red-200 text-red-700',
  negro: 'bg-gray-900 border-gray-900 text-white',
}

export function Chip({ children, tono = 'gris', titulo }: { children: ReactNode; tono?: TonoChip; titulo?: string }) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center max-w-full px-2 py-0.5 border rounded-full text-xs font-medium ${TONOS[tono]}`}
    >
      <span className="truncate">{children}</span>
    </span>
  )
}

/**
 * Capas de las ventanas: por encima de la barra de navegación fija (NavigationWithPermissions usa z-[9999]); si
 * no, en el celular la barra tapa el título y el botón de cerrar de la ventana a pantalla completa.
 */
export const CAPA_MODAL = 'z-[10000]'
/** Ventana abierta desde otra ventana (formulario dentro de un detalle). */
export const CAPA_MODAL_ENCIMA = 'z-[10010]'

/** Ventana modal: pantalla completa en el celular, centrada en escritorio. */
export function Modal({
  titulo,
  subtitulo,
  onCerrar,
  children,
  ancho = 'sm:max-w-2xl',
  capa = CAPA_MODAL,
}: {
  titulo: string
  subtitulo?: string
  onCerrar: () => void
  children: ReactNode
  ancho?: string
  capa?: string
}) {
  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 ${capa} flex items-stretch sm:items-center justify-center sm:p-4`}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className={`bg-white w-full ${ancho} h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col min-w-0`}>
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 sm:px-6 py-4 sm:rounded-t-2xl flex justify-between items-start gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">{titulo}</h2>
            {subtitulo && <p className="text-sm text-gray-300 truncate">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onCerrar} className="shrink-0 text-gray-300 hover:text-white" aria-label="Cerrar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-w-0">{children}</div>
      </div>
    </div>
  )
}

/** Pie de formulario dentro de un Modal: siempre visible abajo. */
export function PieFormulario({
  onCancelar,
  guardando,
  textoGuardar,
  deshabilitado = false,
}: {
  onCancelar: () => void
  guardando: boolean
  textoGuardar: string
  deshabilitado?: boolean
}) {
  return (
    <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-3 flex justify-end gap-3">
      <button type="button" onClick={onCancelar} disabled={guardando} className={claseBotonSecundario}>
        Cancelar
      </button>
      <button type="submit" disabled={guardando || deshabilitado} className={claseBotonPrimario}>
        {guardando ? 'Guardando...' : textoGuardar}
      </button>
    </div>
  )
}

export function Paginacion({
  pagina,
  total,
  porPagina,
  onCambiar,
}: {
  pagina: number
  total: number
  porPagina: number
  onCambiar: (pagina: number) => void
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (total <= porPagina && pagina === 1) return null
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
      <span>
        Página {pagina} de {paginas} · {total.toLocaleString('es-CO')} en total
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1} className={claseBotonChico}>
          Anterior
        </button>
        <button type="button" onClick={() => onCambiar(pagina + 1)} disabled={pagina >= paginas} className={claseBotonChico}>
          Siguiente
        </button>
      </div>
    </div>
  )
}

/** Título de sección dentro de un detalle. */
export function TituloSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider min-w-0 truncate">{children}</h3>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  )
}

/** Valor con su etiqueta, para fichas de detalle. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-gray-500">{etiqueta}</dt>
      <dd className="text-sm text-gray-900 break-words">{children}</dd>
    </div>
  )
}
