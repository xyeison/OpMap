'use client'

// Fase 7 · F2 Configuración y calendario: piezas comunes de /configuracion y /calendario (fechas en español,
// pestañas, selector de mes, botones segmentados, confirmaciones y chips de estado).
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "Interfaz"). Reutiliza los estilos, el
// Modal y las capas (CAPA_MODAL) de components/terceros/comun.tsx para que las ventanas queden por encima de la
// barra fija de navegación.
import { useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { esFechaIso, esMesIso, etiquetaEstadoDiaLibre, type EstadoDiaLibre } from '@/lib/visits-rules'
import {
  AvisoError,
  CAPA_MODAL,
  Chip,
  Modal as ModalBase,
  claseBotonChico,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  claseLabel,
  mensajeExcepcion,
} from '@/components/terceros/comun'

// ---------------------------------------------------------------------------------------------
// Fechas y números en español
// ---------------------------------------------------------------------------------------------

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
/** Nombres cortos de lunes (índice 0) a domingo (índice 6), para la cuadrícula del mes. */
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
/** Nombres de lunes ("1") a domingo ("7"), como las claves de dias_habiles_semana. */
export const NOMBRES_DIA_ISO: Record<string, string> = {
  '1': 'lunes',
  '2': 'martes',
  '3': 'miércoles',
  '4': 'jueves',
  '5': 'viernes',
  '6': 'sábado',
  '7': 'domingo',
}

export function conMayuscula(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto
}

/**
 * '2026-10-12' → 'lunes 12 de octubre de 2026' (sin corrimiento de zona horaria). Con `anio: false` no lleva el
 * año; con `diaSemana: false`, no lleva el día de la semana.
 */
export function fechaLarga(
  fecha: string | null | undefined,
  opciones: { anio?: boolean; diaSemana?: boolean } = {}
): string {
  if (!fecha) return ''
  const solo = fecha.slice(0, 10)
  if (!esFechaIso(solo)) return fecha
  const anio = Number(solo.slice(0, 4))
  const mes = Number(solo.slice(5, 7))
  const dia = Number(solo.slice(8, 10))
  let texto = `${dia} de ${MESES[mes - 1]}`
  if (opciones.diaSemana !== false) texto = `${DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()]} ${texto}`
  if (opciones.anio !== false) texto += ` de ${anio}`
  return texto
}

/** '2026-10' → 'octubre de 2026'. */
export function nombreMes(mes: string | null | undefined): string {
  if (!mes || !esMesIso(mes)) return mes ?? ''
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`
}

/** 'a', 'a y b', 'a, b y c' (o con 'o': 'a, b o c'). */
export function unirLista(items: readonly string[], conjuncion: 'y' | 'o' = 'y'): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${conjuncion} ${items[items.length - 1]}`
}

/** Mes AAAA-MM movido n meses (n negativo: hacia atrás). */
export function sumarMeses(mes: string, n: number): string {
  const anio = Number(mes.slice(0, 4))
  const numero = Number(mes.slice(5, 7)) - 1 + n
  const nuevoAnio = anio + Math.floor(numero / 12)
  const nuevoMes = ((numero % 12) + 12) % 12
  return `${nuevoAnio}-${String(nuevoMes + 1).padStart(2, '0')}`
}

const formatoFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Instante (timestamptz) → '12 oct 2026, 3:45 p. m.' en hora de Colombia. */
export function fechaHora(instante: string | null | undefined): string {
  if (!instante) return ''
  const fecha = new Date(instante)
  if (Number.isNaN(fecha.getTime())) return instante
  return formatoFechaHora.format(fecha)
}

/** Número con coma decimal y hasta 2 decimales ('0,5', '72', '1.250'). */
export function numeroTexto(valor: number | string | null | undefined): string {
  const numero = Number(valor)
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) return '—'
  return numero.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

/** Número escrito por la persona ('0,5', '12') → número, o null si está vacío o no es un número. */
export function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!limpio || !/^-?\d+(\.\d+)?$/.test(limpio)) return null
  return Number(limpio)
}

/** Aviso tras guardar un cambio de configuración, con los meses que se recalculan. */
export function mensajeCambioGuardado(meses: readonly string[]): string {
  return meses.length > 0
    ? `Cambio guardado. Se recalculan: ${unirLista(meses.map(nombreMes))}.`
    : 'Cambio guardado. No se recalcula ningún mes ya transcurrido.'
}

/** Porcentaje entero ('50 %'). */
export function porcentaje(fraccion: number | null | undefined): string {
  if (fraccion === null || fraccion === undefined || !Number.isFinite(fraccion)) return '—'
  return `${Math.round(fraccion * 100)} %`
}

// ---------------------------------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------------------------------

/** Pestañas (se acomodan en dos líneas en el celular; nunca desbordan la pantalla). */
export function Pestanas<T extends string>({
  pestanas,
  activa,
  onCambiar,
  etiqueta,
}: {
  pestanas: readonly { clave: T; etiqueta: string; contador?: number }[]
  activa: T
  onCambiar: (clave: T) => void
  etiqueta: string
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label={etiqueta}>
      {pestanas.map(p => (
        <button
          key={p.clave}
          type="button"
          role="tab"
          aria-selected={activa === p.clave}
          onClick={() => onCambiar(p.clave)}
          className={`grow sm:grow-0 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold border transition-colors whitespace-nowrap ${
            activa === p.clave
              ? 'bg-gray-900 border-gray-900 text-white shadow-md'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {p.etiqueta}
          {p.contador !== undefined && p.contador > 0 && (
            <span
              className={`ml-2 inline-flex items-center justify-center min-w-[1.25rem] px-1.5 rounded-full text-xs ${
                activa === p.clave ? 'bg-white text-gray-900' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {p.contador}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** ‹ octubre de 2026 › con botón "Este mes". */
export function SelectorMes({
  mes,
  onCambiar,
  mesActual,
}: {
  mes: string
  onCambiar: (mes: string) => void
  /** Mes de hoy (AAAA-MM): muestra el botón para volver a él. */
  mesActual?: string
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={() => onCambiar(sumarMeses(mes, -1))}
        className={claseBotonChico}
        aria-label="Mes anterior"
      >
        ‹
      </button>
      <span className="text-sm font-semibold text-gray-900 min-w-0 truncate text-center flex-1 sm:flex-none sm:w-44">
        {conMayuscula(nombreMes(mes))}
      </span>
      <button
        type="button"
        onClick={() => onCambiar(sumarMeses(mes, 1))}
        className={claseBotonChico}
        aria-label="Mes siguiente"
      >
        ›
      </button>
      {mesActual && mesActual !== mes && (
        <button type="button" onClick={() => onCambiar(mesActual)} className={claseBotonChico}>
          Este mes
        </button>
      )}
    </div>
  )
}

/** Grupo de botones de los que se elige uno (día completo / medio día, 0 / ½ / 1...). */
export function Segmentado<T extends string | number>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
  disabled = false,
  compacto = false,
}: {
  opciones: readonly { valor: T; etiqueta: string }[]
  valor: T
  onCambiar: (valor: T) => void
  etiqueta: string
  disabled?: boolean
  compacto?: boolean
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden max-w-full" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((opcion, i) => (
        <button
          key={String(opcion.valor)}
          type="button"
          role="radio"
          aria-checked={valor === opcion.valor}
          disabled={disabled}
          onClick={() => onCambiar(opcion.valor)}
          className={`${compacto ? 'px-3 py-1.5 min-w-[2.75rem]' : 'px-4 py-2'} text-sm font-medium transition-colors disabled:opacity-50 ${
            i > 0 ? 'border-l border-gray-300' : ''
          } ${valor === opcion.valor ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  )
}

/** Casilla con su texto (sí / no). */
export function Casilla({
  marcada,
  onCambiar,
  children,
  disabled = false,
  ayuda,
}: {
  marcada: boolean
  onCambiar: (marcada: boolean) => void
  children: ReactNode
  disabled?: boolean
  ayuda?: ReactNode
}) {
  return (
    <label className={`flex items-start gap-3 min-w-0 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={marcada}
        disabled={disabled}
        onChange={e => onCambiar(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
      />
      <span className="min-w-0">
        <span className="block text-sm text-gray-900">{children}</span>
        {ayuda && <span className="block text-xs text-gray-500 mt-0.5">{ayuda}</span>}
      </span>
    </label>
  )
}

const TONO_ESTADO: Record<EstadoDiaLibre, 'gris' | 'verde' | 'azul' | 'ambar' | 'rojo'> = {
  registrado: 'azul',
  por_aprobar: 'ambar',
  aprobado: 'verde',
  rechazado: 'rojo',
  anulado: 'gris',
}

/** Chip del estado de un día libre (por aprobar en ámbar, nunca en rojo: no es una alarma). */
export function ChipEstadoDiaLibre({ estado }: { estado: EstadoDiaLibre }) {
  return <Chip tono={TONO_ESTADO[estado] ?? 'gris'}>{etiquetaEstadoDiaLibre(estado)}</Chip>
}

/** Caja vacía con título y explicación. */
export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <h3 className="text-sm font-medium text-gray-900">{titulo}</h3>
      {children && <p className="mt-1 text-sm text-gray-500">{children}</p>}
    </div>
  )
}

/** Tarjeta blanca de sección. */
export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-md border border-gray-100 min-w-0 ${className}`}>{children}</div>
}

/** Campo de motivo (texto largo) con su contador y si es obligatorio. */
export function CampoMotivo({
  valor,
  onCambiar,
  obligatorio,
  etiqueta = 'Motivo',
  ayuda,
  placeholder = 'Por qué se hace este cambio',
  maximo = 300,
  id = 'motivo',
}: {
  valor: string
  onCambiar: (valor: string) => void
  obligatorio: boolean
  etiqueta?: string
  ayuda?: ReactNode
  placeholder?: string
  maximo?: number
  id?: string
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={claseLabel}>
        {etiqueta} {obligatorio ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(opcional)</span>}
      </label>
      <textarea
        id={id}
        value={valor}
        maxLength={maximo}
        onChange={e => onCambiar(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className={claseInput}
      />
      {ayuda && <p className="mt-1 text-xs text-gray-500">{ayuda}</p>}
    </div>
  )
}

/**
 * El Modal de components/terceros/comun.tsx dentro de una caja `display: contents`. Las pestañas de F2 abren sus
 * ventanas dentro de contenedores `space-y-*`, y esa regla le daba al fondo fijo (`fixed inset-0`) un margin-top
 * de 1 a 1,5 rem: la ventana quedaba bajada y dejaba ver la barra de navegación encima (visto en las capturas del
 * 2026-10-12). La caja `contents` no genera caja propia, así que el margen no aplica y la ventana no es hija
 * directa del contenedor. Las ventanas de F2 se importan de aquí, no de terceros.
 */
export function Modal(props: ComponentProps<typeof ModalBase>) {
  return (
    <div className="contents">
      <ModalBase {...props} />
    </div>
  )
}

/**
 * Ventana de confirmación (acciones en bloque, anular, apagar...). `onConfirmar` lanza un Error con el mensaje
 * del servidor si algo falla: se muestra aquí y la ventana sigue abierta. Si pide motivo, exige `minimo` letras.
 */
export function Confirmar({
  titulo,
  children,
  textoConfirmar,
  peligro = false,
  motivo,
  onConfirmar,
  onCerrar,
  capa = CAPA_MODAL,
}: {
  titulo: string
  children: ReactNode
  textoConfirmar: string
  peligro?: boolean
  motivo?: { etiqueta?: string; obligatorio: boolean; minimo?: number; placeholder?: string; ayuda?: ReactNode }
  onConfirmar: (motivo: string) => Promise<void>
  onCerrar: () => void
  capa?: string
}) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const minimo = motivo?.minimo ?? 5
  const faltaMotivo = Boolean(motivo?.obligatorio) && texto.trim().length < minimo

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (faltaMotivo) {
      setError(`Escribe el motivo (al menos ${minimo} caracteres)`)
      return
    }
    setEnviando(true)
    setError('')
    try {
      await onConfirmar(texto.trim())
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo completar la acción'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={titulo} onCerrar={enviando ? () => undefined : onCerrar} ancho="sm:max-w-lg" capa={capa}>
      <form onSubmit={enviar} className="flex flex-col min-h-full">
        <div className="p-4 sm:p-6 space-y-4 flex-1 min-w-0">
          <div className="text-sm text-gray-700 space-y-2 break-words">{children}</div>
          {motivo && (
            <CampoMotivo
              valor={texto}
              onCambiar={setTexto}
              obligatorio={motivo.obligatorio}
              etiqueta={motivo.etiqueta}
              placeholder={motivo.placeholder}
              ayuda={motivo.ayuda}
              id="confirmar-motivo"
            />
          )}
          {error && <AvisoError>{error}</AvisoError>}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-3 flex justify-end gap-3">
          <button type="button" onClick={onCerrar} disabled={enviando} className={claseBotonSecundario}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || faltaMotivo}
            className={
              peligro
                ? 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                : claseBotonPrimario
            }
          >
            {enviando ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Encabezado oscuro de página (mismo estilo de /terceros). */
export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion: string; acciones?: ReactNode }) {
  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-5 sm:p-6 mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{titulo}</h1>
          <p className="text-gray-300 mt-2 text-sm sm:text-base">{descripcion}</p>
        </div>
        {acciones && <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">{acciones}</div>}
      </div>
    </div>
  )
}

/** Pantalla de acceso denegado (mismo estilo de /terceros). */
export function AccesoDenegado({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto p-6">
      <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
        <strong className="font-semibold">Acceso denegado</strong>
        <p className="text-sm mt-1">{children}</p>
      </div>
    </div>
  )
}
