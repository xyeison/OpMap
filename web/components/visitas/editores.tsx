'use client'

// Fase 7 · F2: editores legibles del valor nuevo de cada configuración (van dentro de FormularioCambio).
// Nada de JSON a mano: metas con cantidad y periodo, qué cuenta con modo y peso, personas con perfil,
// telefónica, tope y radio, y cada parámetro general con su control (días de la semana con 7 botones 0 / ½ / 1,
// motivos como lista editable, aprobación con casilla y roles, telefónicas con tope, peso y medios).
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "Interfaz").
import {
  MEDIOS_TELEFONICA,
  MODOS_CONTEO,
  PERIODOS_META,
  ROLES_APROBADORES,
  TIPOS_VISITA,
  type DiaSemanaClave,
  type DiasHabilesSemana,
  type MedioTelefonica,
  type ModoConteo,
  type MotivoDiaLibre,
  type PeriodoMeta,
  type RolAprobador,
  type Subtipo,
  type TipoVisita,
} from '@/lib/visits-rules'
import { claseBotonChico, claseInput, claseLabel } from '@/components/terceros/comun'
import { Casilla, NOMBRES_DIA_ISO, Segmentado, conMayuscula, leerNumero, numeroTexto } from './comun'

// ---------------------------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------------------------

export interface ValorMeta {
  periodo: PeriodoMeta
  cantidad: string
}

export function EditorMeta({ valor, onCambiar }: { valor: ValorMeta; onCambiar: (valor: ValorMeta) => void }) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-3 sm:items-end">
        <div className="min-w-0">
          <label htmlFor="meta-cantidad" className={claseLabel}>
            Cantidad <span className="text-red-500">*</span>
          </label>
          <input
            id="meta-cantidad"
            inputMode="decimal"
            value={valor.cantidad}
            onChange={e => onCambiar({ ...valor, cantidad: e.target.value })}
            className={claseInput}
            placeholder="6"
            autoComplete="off"
          />
        </div>
        <div className="min-w-0">
          <span className={claseLabel}>Periodo</span>
          <Segmentado
            opciones={PERIODOS_META}
            valor={valor.periodo}
            onCambiar={periodo => onCambiar({ ...valor, periodo })}
            etiqueta="Periodo de la meta"
          />
        </div>
      </div>
      {valor.periodo === 'semana' && (
        <p className="text-xs text-gray-500">
          La meta semanal se reparte entre los días hábiles de la semana (con lunes a viernes, 10 a la semana son 2 por día
          hábil).
        </p>
      )}
    </div>
  )
}

/** Valores de config_metas a partir del editor (sin el alcance). */
export function valoresMeta(valor: ValorMeta): { periodo: PeriodoMeta; cantidad: number } | string {
  const cantidad = leerNumero(valor.cantidad)
  if (cantidad === null) return 'Escribe la cantidad de la meta'
  return { periodo: valor.periodo, cantidad }
}

export interface ValorMetaNueva extends ValorMeta {
  /** kam_id o executive_id según el alcance ('' si falta). */
  destino: string
  tipo: TipoVisita
  /** '' = meta del tipo (sin subtipo). */
  subtipo_id: string
}

/** Meta nueva: a quién (zona o Ejecutivo Comercial), de qué tipo y subtipo, y su cantidad. */
export function EditorMetaNueva({
  valor,
  onCambiar,
  destinos,
  etiquetaDestino,
  subtipos,
  fijarTipo = false,
}: {
  valor: ValorMetaNueva
  onCambiar: (valor: ValorMetaNueva) => void
  /** null: meta de toda la empresa (sin destino). */
  destinos: readonly { id: string; nombre: string; detalle?: string | null }[] | null
  etiquetaDestino?: string
  subtipos: readonly Subtipo[]
  /** Solo se elige el subtipo (metas propias de toda la empresa). */
  fijarTipo?: boolean
}) {
  return (
    <div className="space-y-3 min-w-0">
      {destinos && (
        <div className="min-w-0">
          <label htmlFor="meta-destino" className={claseLabel}>
            {etiquetaDestino ?? 'Para'} <span className="text-red-500">*</span>
          </label>
          <select
            id="meta-destino"
            value={valor.destino}
            onChange={e => onCambiar({ ...valor, destino: e.target.value })}
            className={claseInput}
          >
            <option value="">Elige...</option>
            {destinos.map(destino => (
              <option key={destino.id} value={destino.id}>
                {destino.detalle ? `${destino.nombre} · ${destino.detalle}` : destino.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      {!fijarTipo && (
        <div className="min-w-0">
          <span className={claseLabel}>Tipo de visita</span>
          <Segmentado
            opciones={TIPOS_VISITA}
            valor={valor.tipo}
            onCambiar={tipo => onCambiar({ ...valor, tipo, subtipo_id: tipo === 'medica' ? '' : valor.subtipo_id })}
            etiqueta="Tipo de visita"
          />
        </div>
      )}
      {valor.tipo === 'institucional' && (
        <div className="min-w-0">
          <label htmlFor="meta-subtipo" className={claseLabel}>
            {fijarTipo ? (
              <>
                Subtipo <span className="text-red-500">*</span>
              </>
            ) : (
              'Subtipo'
            )}
          </label>
          <select
            id="meta-subtipo"
            value={valor.subtipo_id}
            onChange={e => onCambiar({ ...valor, subtipo_id: e.target.value })}
            className={claseInput}
          >
            <option value="">{fijarTipo ? 'Elige el subtipo...' : 'Meta institucional (todas las que suman)'}</option>
            {subtipos.map(subtipo => (
              <option key={subtipo.id} value={subtipo.id}>
                Meta propia: {subtipo.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            La meta de un subtipo solo cuenta los días en que ese subtipo tiene «meta propia» en Qué cuenta.
          </p>
        </div>
      )}
      <EditorMeta valor={valor} onCambiar={nuevo => onCambiar({ ...valor, ...nuevo })} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Qué cuenta
// ---------------------------------------------------------------------------------------------

export interface ValorConteo {
  modo: ModoConteo
  peso: string
}

const AYUDA_MODO: Record<ModoConteo, string> = {
  suma_institucional: 'Cada visita de este subtipo suma a la meta institucional, multiplicada por su peso.',
  meta_propia: 'Este subtipo tiene su propia meta (se define en Metas) y no suma a la institucional.',
  seguimiento: 'Se registra y se ve en la mezcla, pero no suma a ninguna meta.',
}

export function EditorConteo({ valor, onCambiar }: { valor: ValorConteo; onCambiar: (valor: ValorConteo) => void }) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="space-y-2" role="radiogroup" aria-label="Qué hace una visita de este subtipo">
        {MODOS_CONTEO.map(modo => (
          <label
            key={modo.valor}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer min-w-0 ${
              valor.modo === modo.valor ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="conteo-modo"
              value={modo.valor}
              checked={valor.modo === modo.valor}
              onChange={() => onCambiar({ ...valor, modo: modo.valor })}
              className="mt-0.5 h-4 w-4 shrink-0 text-gray-900 focus:ring-gray-700"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900">{modo.etiqueta}</span>
              <span className="block text-xs text-gray-500">{AYUDA_MODO[modo.valor]}</span>
            </span>
          </label>
        ))}
      </div>
      {valor.modo !== 'seguimiento' && (
        <div className="sm:w-48 min-w-0">
          <label htmlFor="conteo-peso" className={claseLabel}>
            Peso <span className="text-red-500">*</span>
          </label>
          <input
            id="conteo-peso"
            inputMode="decimal"
            value={valor.peso}
            onChange={e => onCambiar({ ...valor, peso: e.target.value })}
            className={claseInput}
            placeholder="1"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">Mayor que 0 y hasta 10. Con 0,5, dos visitas suman 1.</p>
        </div>
      )}
    </div>
  )
}

export function valoresConteo(subtipoId: string, valor: ValorConteo): Record<string, unknown> | string {
  // En "solo seguimiento" el peso no se usa; se guarda 1 si no hay uno válido.
  const peso = leerNumero(valor.peso)
  if (valor.modo !== 'seguimiento' && peso === null) return 'Escribe el peso'
  return { subtipo_id: subtipoId, modo: valor.modo, peso: peso ?? 1 }
}

// ---------------------------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------------------------

export interface ValorPersona {
  perfil: TipoVisita[]
  telefonica_habilitada: boolean
  /** '' = el tope general. */
  tope: string
  /** '' = el radio general. */
  radio: string
}

export function EditorPersona({
  valor,
  onCambiar,
  topeGeneral,
  radioGeneral,
}: {
  valor: ValorPersona
  onCambiar: (valor: ValorPersona) => void
  topeGeneral: number
  radioGeneral: number
}) {
  const alternar = (tipo: TipoVisita, marcada: boolean) => {
    const perfil = marcada ? Array.from(new Set([...valor.perfil, tipo])) : valor.perfil.filter(t => t !== tipo)
    onCambiar({ ...valor, perfil })
  }
  return (
    <div className="space-y-4 min-w-0">
      <fieldset className="space-y-2 min-w-0">
        <legend className={claseLabel}>
          Perfil: qué metas tiene <span className="text-red-500">*</span>
        </legend>
        <Casilla marcada={valor.perfil.includes('medica')} onCambiar={m => alternar('medica', m)}>
          Visitas médicas
        </Casilla>
        <Casilla
          marcada={valor.perfil.includes('institucional')}
          onCambiar={m => alternar('institucional', m)}
          ayuda="Solo institucional: por ejemplo, un gerente de cuentas clave."
        >
          Visitas institucionales
        </Casilla>
        {valor.perfil.length === 0 && <p className="text-xs text-red-600">Elige al menos un perfil.</p>}
      </fieldset>
      <Casilla
        marcada={valor.telefonica_habilitada}
        onCambiar={m => onCambiar({ ...valor, telefonica_habilitada: m })}
        ayuda="Puede reportar visitas por llamada o videollamada (con el tope del día)."
      >
        Telefónica habilitada
      </Casilla>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="persona-tope" className={claseLabel}>
            Tope de telefónicas al día
          </label>
          <input
            id="persona-tope"
            inputMode="numeric"
            value={valor.tope}
            onChange={e => onCambiar({ ...valor, tope: e.target.value })}
            className={claseInput}
            placeholder={`General: ${topeGeneral}`}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">Vacío: el general ({topeGeneral} al día).</p>
        </div>
        <div className="min-w-0">
          <label htmlFor="persona-radio" className={claseLabel}>
            Radio de presencial propio (metros)
          </label>
          <input
            id="persona-radio"
            inputMode="numeric"
            value={valor.radio}
            onChange={e => onCambiar({ ...valor, radio: e.target.value })}
            className={claseInput}
            placeholder={`General: ${radioGeneral}`}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">Vacío: el general ({numeroTexto(radioGeneral)} m).</p>
        </div>
      </div>
    </div>
  )
}

export function valoresPersona(executiveId: string, valor: ValorPersona): Record<string, unknown> | string {
  if (valor.perfil.length === 0) return 'Elige al menos un perfil: médica o institucional'
  const tope = valor.tope.trim() ? leerNumero(valor.tope) : null
  if (valor.tope.trim() && tope === null) return 'El tope de telefónicas es un número entero'
  const radio = valor.radio.trim() ? leerNumero(valor.radio) : null
  if (valor.radio.trim() && radio === null) return 'El radio es un número entero de metros'
  return {
    executive_id: executiveId,
    perfil: valor.perfil,
    telefonica_habilitada: valor.telefonica_habilitada,
    tope_telefonicas_dia: tope,
    radio_m: radio,
  }
}

// ---------------------------------------------------------------------------------------------
// Parámetros generales
// ---------------------------------------------------------------------------------------------

/** Un número con su unidad (radio, plazo de gracia, tope por médico, factor en %). */
export function EditorNumero({
  valor,
  onCambiar,
  etiqueta,
  unidad,
  ayuda,
}: {
  valor: string
  onCambiar: (valor: string) => void
  etiqueta: string
  unidad: string
  ayuda?: string
}) {
  return (
    <div className="min-w-0 sm:w-72">
      <label htmlFor="general-numero" className={claseLabel}>
        {etiqueta} <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-2 min-w-0">
        <input
          id="general-numero"
          inputMode="decimal"
          value={valor}
          onChange={e => onCambiar(e.target.value)}
          className={claseInput}
          autoComplete="off"
        />
        <span className="text-sm text-gray-600 shrink-0">{unidad}</span>
      </div>
      {ayuda && <p className="mt-1 text-xs text-gray-500">{ayuda}</p>}
    </div>
  )
}

const OPCIONES_FRACCION_DIA = [
  { valor: 0, etiqueta: '0' },
  { valor: 0.5, etiqueta: '½' },
  { valor: 1, etiqueta: '1' },
] as const

const CLAVES_SEMANA: readonly DiaSemanaClave[] = ['1', '2', '3', '4', '5', '6', '7']

/** Lunes a domingo, cada uno con 0, ½ o 1. */
export function EditorDiasSemana({ valor, onCambiar }: { valor: DiasHabilesSemana; onCambiar: (valor: DiasHabilesSemana) => void }) {
  const suma = CLAVES_SEMANA.reduce((total, clave) => total + Number(valor[clave] ?? 0), 0)
  return (
    <div className="space-y-2 min-w-0">
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
        {CLAVES_SEMANA.map(clave => (
          <li key={clave} className="flex items-center justify-between gap-3 px-3 py-2 min-w-0">
            <span className="text-sm text-gray-900 min-w-0 truncate">{conMayuscula(NOMBRES_DIA_ISO[clave])}</span>
            <Segmentado
              opciones={OPCIONES_FRACCION_DIA}
              valor={Number(valor[clave] ?? 0) as 0 | 0.5 | 1}
              onCambiar={fraccion => onCambiar({ ...valor, [clave]: fraccion })}
              etiqueta={`Fracción hábil del ${NOMBRES_DIA_ISO[clave]}`}
              compacto
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        1 = día completo, ½ = medio día, 0 = no genera cuota. La semana suma {numeroTexto(suma)} días hábiles.
      </p>
    </div>
  )
}

export interface ValorTelefonicas {
  tope_dia: string
  peso: string
  medios: MedioTelefonica[]
}

export function EditorTelefonicas({ valor, onCambiar }: { valor: ValorTelefonicas; onCambiar: (valor: ValorTelefonicas) => void }) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="tel-tope" className={claseLabel}>
            Tope al día <span className="text-red-500">*</span>
          </label>
          <input
            id="tel-tope"
            inputMode="numeric"
            value={valor.tope_dia}
            onChange={e => onCambiar({ ...valor, tope_dia: e.target.value })}
            className={claseInput}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">Entre 0 y 20. Cada persona puede tener el suyo.</p>
        </div>
        <div className="min-w-0">
          <label htmlFor="tel-peso" className={claseLabel}>
            Peso <span className="text-red-500">*</span>
          </label>
          <input
            id="tel-peso"
            inputMode="decimal"
            value={valor.peso}
            onChange={e => onCambiar({ ...valor, peso: e.target.value })}
            className={claseInput}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">1 = suma igual que una presencial; 0,5 = la mitad.</p>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className={claseLabel}>
          Medios permitidos <span className="text-red-500">*</span>
        </legend>
        {MEDIOS_TELEFONICA.map(medio => (
          <Casilla
            key={medio.valor}
            marcada={valor.medios.includes(medio.valor)}
            onCambiar={m =>
              onCambiar({
                ...valor,
                medios: m ? Array.from(new Set([...valor.medios, medio.valor])) : valor.medios.filter(x => x !== medio.valor),
              })
            }
          >
            {medio.etiqueta}
          </Casilla>
        ))}
      </fieldset>
    </div>
  )
}

export function valorTelefonicas(valor: ValorTelefonicas): Record<string, unknown> | string {
  const tope = leerNumero(valor.tope_dia)
  if (tope === null) return 'Escribe el tope de telefónicas al día'
  const peso = leerNumero(valor.peso)
  if (peso === null) return 'Escribe el peso de una telefónica'
  if (valor.medios.length === 0) return 'Elige al menos un medio: llamada o videollamada'
  return { tope_dia: tope, peso, medios: valor.medios }
}

export interface ValorAprobacion {
  requiere: boolean
  aprueban: RolAprobador[]
}

export function EditorAprobacion({ valor, onCambiar }: { valor: ValorAprobacion; onCambiar: (valor: ValorAprobacion) => void }) {
  return (
    <div className="space-y-4 min-w-0">
      <Casilla
        marcada={valor.requiere}
        onCambiar={m => onCambiar({ ...valor, requiere: m })}
        ayuda={
          valor.requiere
            ? 'Quedan «por aprobar» (sin alarma) y no restan de la cuota hasta que alguien los apruebe en bloque.'
            : 'Cuentan como libres desde que se registran.'
        }
      >
        Los días libres requieren aprobación
      </Casilla>
      <fieldset className="space-y-2">
        <legend className={claseLabel}>Quién aprueba</legend>
        {ROLES_APROBADORES.map(rol => (
          <Casilla
            key={rol.valor}
            marcada={valor.aprueban.includes(rol.valor)}
            onCambiar={m =>
              onCambiar({
                ...valor,
                aprueban: m ? Array.from(new Set([...valor.aprueban, rol.valor])) : valor.aprueban.filter(x => x !== rol.valor),
              })
            }
          >
            {rol.etiqueta}
          </Casilla>
        ))}
        <p className="text-xs text-gray-500">Un administrador siempre puede aprobar.</p>
      </fieldset>
    </div>
  )
}

/** Fila editable de un motivo de día libre. */
export interface FilaMotivo {
  /** Clave de React (no se guarda). */
  llave: string
  codigo: string
  nombre: string
  /** Ya existía: su código no cambia (los días libres registrados lo usan). */
  existente: boolean
  /** La persona escribió el código a mano (deja de seguir al nombre). */
  codigoManual: boolean
}

/** 'Acompañamiento de cirugía' → 'acompanamiento_de_cirugia' (lo que acepta ^[a-z_]{2,40}$). */
export function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

let siguienteLlave = 0
export function filasMotivos(motivos: readonly MotivoDiaLibre[]): FilaMotivo[] {
  return motivos.map(motivo => ({
    llave: `m${++siguienteLlave}`,
    codigo: motivo.codigo,
    nombre: motivo.nombre,
    existente: true,
    codigoManual: true,
  }))
}

export function EditorMotivos({ valor, onCambiar }: { valor: FilaMotivo[]; onCambiar: (valor: FilaMotivo[]) => void }) {
  const cambiarFila = (llave: string, cambios: Partial<FilaMotivo>) =>
    onCambiar(valor.map(fila => (fila.llave === llave ? { ...fila, ...cambios } : fila)))
  const mover = (indice: number, paso: number) => {
    const destino = indice + paso
    if (destino < 0 || destino >= valor.length) return
    const copia = [...valor]
    const [fila] = copia.splice(indice, 1)
    copia.splice(destino, 0, fila)
    onCambiar(copia)
  }
  return (
    <div className="space-y-3 min-w-0">
      <ul className="space-y-2">
        {valor.map((fila, indice) => (
          <li key={fila.llave} className="border border-gray-200 rounded-lg p-3 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)] gap-2 min-w-0">
              <div className="min-w-0">
                <label htmlFor={`motivo-nombre-${fila.llave}`} className="sr-only">
                  Nombre del motivo
                </label>
                <input
                  id={`motivo-nombre-${fila.llave}`}
                  value={fila.nombre}
                  maxLength={60}
                  onChange={e => {
                    const nombre = e.target.value
                    cambiarFila(fila.llave, fila.codigoManual ? { nombre } : { nombre, codigo: codigoDesdeNombre(nombre) })
                  }}
                  className={claseInput}
                  placeholder="Nombre (por ejemplo, Licencia)"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor={`motivo-codigo-${fila.llave}`} className="sr-only">
                  Código del motivo
                </label>
                <input
                  id={`motivo-codigo-${fila.llave}`}
                  value={fila.codigo}
                  maxLength={40}
                  disabled={fila.existente}
                  title={fila.existente ? 'El código no cambia: los días libres ya registrados lo usan' : undefined}
                  onChange={e => cambiarFila(fila.llave, { codigo: e.target.value.toLowerCase(), codigoManual: true })}
                  className={`${claseInput} font-mono text-xs`}
                  placeholder="codigo"
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => mover(indice, -1)} disabled={indice === 0} className={claseBotonChico} aria-label="Subir">
                ↑ Subir
              </button>
              <button
                type="button"
                onClick={() => mover(indice, 1)}
                disabled={indice === valor.length - 1}
                className={claseBotonChico}
                aria-label="Bajar"
              >
                ↓ Bajar
              </button>
              <button
                type="button"
                onClick={() => onCambiar(valor.filter(f => f.llave !== fila.llave))}
                disabled={valor.length <= 1}
                className={`${claseBotonChico} text-red-700`}
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          onCambiar([...valor, { llave: `m${++siguienteLlave}`, codigo: '', nombre: '', existente: false, codigoManual: false }])
        }
        disabled={valor.length >= 30}
        className={claseBotonChico}
      >
        + Añadir motivo
      </button>
      <p className="text-xs text-gray-500">
        Quitar un motivo no cambia los días libres ya registrados con él; solo deja de ofrecerse. El código lleva letras
        minúsculas sin tildes y guiones bajos.
      </p>
    </div>
  )
}

export function valorMotivos(filas: readonly FilaMotivo[]): MotivoDiaLibre[] | string {
  if (filas.length === 0) return 'Deja al menos un motivo de día libre'
  const vacio = filas.find(fila => !fila.nombre.trim() || !fila.codigo.trim())
  if (vacio) return 'Cada motivo necesita nombre y código'
  return filas.map(fila => ({ codigo: fila.codigo.trim(), nombre: fila.nombre.trim() }))
}
