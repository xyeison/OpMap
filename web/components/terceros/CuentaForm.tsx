'use client'

// Nueva cuenta con su sede principal (POST /api/terceros/cuentas, terceros:create) y edición de la cuenta
// (PATCH /api/terceros/cuentas/[id], terceros:manage). Una cuenta por identificación: si ya existe, la API
// responde 409 con { existente } y aquí se ofrece abrirla. Marcar cliente y modalidad (solo EPS) es de
// terceros:manage.
import { useState } from 'react'
import {
  CLASES_CUENTA,
  MODALIDADES_FACTURACION,
  TIPOS_ID_CUENTA,
  type ClaseCuenta,
  type CuentaDetalle,
  type ModalidadFacturacion,
  type TipoIdCuenta,
} from '@/lib/terceros'
import { cuentaCreateSchema, cuentaUpdateSchema } from '@/lib/terceros-schemas'
import { CamposSede, SEDE_VACIA, cuerpoSede, type ValoresSede } from './SedeForm'
import {
  AvisoAtencion,
  AvisoError,
  CAPA_MODAL_ENCIMA,
  Modal,
  PieFormulario,
  claseBotonChico,
  claseInput,
  claseLabel,
  existenteDe,
  idCreado,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  primerErrorZod,
  textoONada,
} from './comun'

/** Sede principal de la cuenta recién creada (para vincularla a un médico). */
export interface SedeCreada {
  id: string
  nombre: string
  cuenta_id: string
  cuenta_nombre: string
  ciudad: string | null
  reps_code: string | null
}

interface CuentaFormProps {
  puedeAdministrar: boolean
  onCerrar: () => void
  /** Cuenta creada; `sede` es su sede principal (null si no se pudo leer). */
  onCreada: (cuenta: { id: string; nombre: string }, sede: SedeCreada | null) => void
  /** Abrir la cuenta que ya existe con esa identificación (si no se da, solo se avisa). */
  onAbrirExistente?: (id: string) => void
  /**
   * Usar lo que ya existe en vez de crear (p. ej. para vincularlo a un médico): la cuenta con esa
   * identificación (`sede` null: se usa su sede principal) o la sede con ese código de habilitación.
   */
  onUsarExistente?: (cuenta: { id: string; nombre: string }, sede: SedeCreada | null) => void
  clasePreset?: ClaseCuenta
  nombrePreset?: string
  municipioPreset?: string | null
  ciudadPreset?: string | null
  /** Texto de ayuda arriba del formulario. */
  ayuda?: string
  capa?: string
}

/** Lo que ya existe cuando la API responde 409: la cuenta con esa identificación o la sede con ese código. */
interface Conflicto {
  mensaje: string
  cuenta: { id: string; nombre: string }
  sede: SedeCreada | null
}

function conflictoDe(data: unknown, mensajeServidor: string): Conflicto | null {
  const existente = existenteDe(data)
  if (!existente) return null
  const crudo = (data as { existente?: { cuenta_id?: unknown; cuenta_nombre?: unknown } }).existente ?? {}
  if (typeof crudo.cuenta_id === 'string') {
    // 409 por el código de habilitación de la sede principal: la sede ya está en otra cuenta.
    const cuentaNombre = typeof crudo.cuenta_nombre === 'string' ? crudo.cuenta_nombre : 'la cuenta de esa sede'
    return {
      mensaje: `${mensajeServidor}. Esa sede ya está registrada: úsala en lugar de crear otra.`,
      cuenta: { id: crudo.cuenta_id, nombre: cuentaNombre },
      sede: { id: existente.id, nombre: existente.nombre, cuenta_id: crudo.cuenta_id, cuenta_nombre: cuentaNombre, ciudad: null, reps_code: null },
    }
  }
  return {
    mensaje: `Ya hay una cuenta con ese número de identificación: ${existente.nombre}. No se repite la cuenta (tampoco cambiando el tipo): usa la que existe.`,
    cuenta: existente,
    sede: null,
  }
}

/** Sede principal de una cuenta leyendo su detalle (si el POST no la devolvió, o para usar una que ya existe). */
export async function leerSedePrincipal(cuentaId: string, cuentaNombre: string): Promise<SedeCreada | null> {
  try {
    const respuesta = await pedirJson(`/api/terceros/cuentas/${cuentaId}`)
    if (!respuesta.ok || !respuesta.data) return null
    const detalle = respuesta.data as CuentaDetalle
    const sedes = Array.isArray(detalle.sedes) ? detalle.sedes : []
    const sede = sedes.find(s => s.es_principal) ?? sedes[0]
    if (!sede) return null
    return {
      id: sede.id,
      nombre: sede.nombre,
      cuenta_id: cuentaId,
      cuenta_nombre: detalle.cuenta?.nombre ?? cuentaNombre,
      ciudad: sede.ciudad,
      reps_code: sede.reps_code,
    }
  } catch {
    return null
  }
}

export default function CuentaForm({
  puedeAdministrar,
  onCerrar,
  onCreada,
  onAbrirExistente,
  onUsarExistente,
  clasePreset,
  nombrePreset,
  municipioPreset,
  ciudadPreset,
  ayuda,
  capa = CAPA_MODAL_ENCIMA,
}: CuentaFormProps) {
  const [nombre, setNombre] = useState(nombrePreset ?? '')
  const [clase, setClase] = useState<ClaseCuenta>(clasePreset ?? 'clinica')
  const [tipoId, setTipoId] = useState<TipoIdCuenta>('NIT')
  const [numeroId, setNumeroId] = useState('')
  const [codigoPrestador, setCodigoPrestador] = useState('')
  const [esCliente, setEsCliente] = useState(false)
  const [modalidad, setModalidad] = useState<ModalidadFacturacion | ''>('')
  const [notas, setNotas] = useState('')
  const [sede, setSede] = useState<ValoresSede>({
    ...SEDE_VACIA,
    municipio: municipioPreset ?? null,
    ciudad: ciudadPreset ?? null,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [conflicto, setConflicto] = useState<Conflicto | null>(null)

  const esIps = clase === 'clinica' || clase === 'consultorio'

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setConflicto(null)
    const cuerpo = {
      nombre,
      clase,
      tipo_identificacion: tipoId,
      numero_identificacion: numeroId,
      codigo_prestador: esIps ? textoONada(codigoPrestador) : undefined,
      notas: textoONada(notas),
      ...(puedeAdministrar ? { es_cliente: esCliente } : {}),
      ...(puedeAdministrar && clase === 'eps' && modalidad ? { modalidad_facturacion: modalidad } : {}),
      sede: cuerpoSede(sede),
    }
    const validado = cuentaCreateSchema.safeParse(cuerpo)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson('/api/terceros/cuentas', { method: 'POST', json: cuerpo })
      if (respuesta.status === 409) {
        const yaExiste = conflictoDe(respuesta.data, mensajeError(respuesta, 'Ya existe'))
        if (yaExiste) {
          setConflicto(yaExiste)
          setGuardando(false)
          return
        }
      }
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo crear la cuenta'))
      const cuentaId = idCreado(respuesta.data, 'cuenta')
      if (!cuentaId) throw new Error('La cuenta se creó, pero el servidor no devolvió su id: búscala en la lista')
      const nombreCuenta = validado.data.nombre
      const sedeId = idCreado((respuesta.data as Record<string, unknown> | null)?.sede ?? null, 'sede')
      const sedeCreada: SedeCreada | null = sedeId
        ? {
            id: sedeId,
            nombre: validado.data.sede.nombre,
            cuenta_id: cuentaId,
            cuenta_nombre: nombreCuenta,
            ciudad: sede.ciudad,
            reps_code: validado.data.sede.reps_code ?? null,
          }
        : await leerSedePrincipal(cuentaId, nombreCuenta)
      onCreada({ id: cuentaId, nombre: nombreCuenta }, sedeCreada)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo crear la cuenta'))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nueva cuenta" subtitulo="Con su sede principal" onCerrar={onCerrar} capa={capa}>
      <form onSubmit={guardar}>
        <div className="p-4 sm:p-6 space-y-5">
          {ayuda && <p className="text-sm text-gray-600">{ayuda}</p>}
          {error && <AvisoError>{error}</AvisoError>}
          {conflicto && (
            <AvisoAtencion>
              <p>{conflicto.mensaje}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {onUsarExistente && (
                  <button type="button" onClick={() => onUsarExistente(conflicto.cuenta, conflicto.sede)} className={claseBotonChico}>
                    {conflicto.sede ? 'Usar esa sede' : 'Usar esa cuenta'}
                  </button>
                )}
                {onAbrirExistente && (
                  <button type="button" onClick={() => onAbrirExistente(conflicto.cuenta.id)} className={claseBotonChico}>
                    Abrir esa cuenta
                  </button>
                )}
              </div>
            </AvisoAtencion>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={claseLabel}>
                Nombre de la cuenta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className={claseInput}
                maxLength={200}
                disabled={guardando}
                autoFocus
              />
            </div>
            <div>
              <label className={claseLabel}>
                Clase <span className="text-red-500">*</span>
              </label>
              <select value={clase} onChange={e => setClase(e.target.value as ClaseCuenta)} className={claseInput} disabled={guardando}>
                {CLASES_CUENTA.map(opcion => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={claseLabel}>
                Tipo de identificación <span className="text-red-500">*</span>
              </label>
              <select value={tipoId} onChange={e => setTipoId(e.target.value as TipoIdCuenta)} className={claseInput} disabled={guardando}>
                {TIPOS_ID_CUENTA.map(opcion => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={claseLabel}>
                Número de identificación <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={numeroId}
                onChange={e => setNumeroId(e.target.value)}
                placeholder={tipoId === 'NIT' ? '9 dígitos; el dígito de verificación es opcional' : 'Sin puntos ni espacios'}
                className={claseInput}
                maxLength={30}
                disabled={guardando}
              />
              {clase === 'consultorio' && (
                <p className="mt-1 text-xs text-gray-500">
                  Si es el consultorio de un profesional independiente sin NIT, usa su cédula.
                </p>
              )}
            </div>
            {esIps && (
              <div className="sm:col-span-2">
                <label className={claseLabel}>Código de prestador del REPS</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={codigoPrestador}
                  onChange={e => setCodigoPrestador(e.target.value)}
                  placeholder="10 dígitos (opcional)"
                  className={claseInput}
                  maxLength={20}
                  disabled={guardando}
                />
              </div>
            )}
            {puedeAdministrar && (
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={esCliente} onChange={e => setEsCliente(e.target.checked)} disabled={guardando} />
                Es cliente (VG le factura)
              </label>
            )}
            {puedeAdministrar && clase === 'eps' && (
              <div className="sm:col-span-2">
                <label className={claseLabel}>Modalidad de facturación</label>
                <select
                  value={modalidad}
                  onChange={e => setModalidad(e.target.value as ModalidadFacturacion | '')}
                  className={claseInput}
                  disabled={guardando}
                >
                  <option value="">Sin definir</option>
                  {MODALIDADES_FACTURACION.map(opcion => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={claseLabel}>Notas</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                className={claseInput}
                maxLength={2000}
                disabled={guardando}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Sede principal</h3>
            <CamposSede
              valores={sede}
              onCambiar={setSede}
              nombreOpcional
              placeholderNombre={nombre.trim() || 'Nombre de la sede'}
              disabled={guardando}
            />
          </div>
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar="Crear cuenta" />
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------------------------
// Editar cuenta (terceros:manage)
// ---------------------------------------------------------------------------------------------

export function CuentaEditForm({
  cuenta,
  onCerrar,
  onGuardada,
}: {
  cuenta: CuentaDetalle['cuenta']
  onCerrar: () => void
  onGuardada: (mensaje: string) => void
}) {
  const [nombre, setNombre] = useState(cuenta.nombre)
  const [clase, setClase] = useState<ClaseCuenta>(cuenta.clase)
  const [esCliente, setEsCliente] = useState(cuenta.es_cliente)
  const [modalidad, setModalidad] = useState<ModalidadFacturacion | ''>(cuenta.modalidad_facturacion ?? '')
  const [codigoPrestador, setCodigoPrestador] = useState(cuenta.codigo_prestador ?? '')
  const [notas, setNotas] = useState(cuenta.notas ?? '')
  const [activo, setActivo] = useState(cuenta.activo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cambios: Record<string, unknown> = {}
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ')
    if (nombreLimpio !== cuenta.nombre) cambios.nombre = nombreLimpio
    if (clase !== cuenta.clase) cambios.clase = clase
    if (esCliente !== cuenta.es_cliente) cambios.es_cliente = esCliente
    const modalidadNueva = clase === 'eps' ? modalidad || null : null
    if (modalidadNueva !== (cuenta.modalidad_facturacion ?? null)) {
      cambios.modalidad_facturacion = modalidadNueva
      // La modalidad solo cabe en una EPS: se envía la clase para que la regla se compruebe completa.
      if (modalidadNueva !== null) cambios.clase = clase
    }
    const codigo = codigoPrestador.trim()
    if (codigo !== (cuenta.codigo_prestador ?? '')) cambios.codigo_prestador = codigo || null
    const notasLimpias = notas.trim()
    if (notasLimpias !== (cuenta.notas ?? '')) cambios.notas = notasLimpias || null
    if (activo !== cuenta.activo) cambios.activo = activo
    if (Object.keys(cambios).length === 0) {
      setError('No hay cambios para guardar')
      return
    }
    const validado = cuentaUpdateSchema.safeParse(cambios)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson(`/api/terceros/cuentas/${cuenta.id}`, { method: 'PATCH', json: cambios })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo guardar la cuenta'))
      onGuardada(`Se guardaron los cambios de ${nombreLimpio || cuenta.nombre}.`)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo guardar la cuenta'))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Editar cuenta" subtitulo={cuenta.nombre} onCerrar={onCerrar} capa={CAPA_MODAL_ENCIMA}>
      <form onSubmit={guardar}>
        <div className="p-4 sm:p-6 space-y-4">
          {error && <AvisoError>{error}</AvisoError>}
          <p className="text-xs text-gray-500">La identificación de la cuenta no se edita.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={claseLabel}>
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className={claseInput}
                maxLength={200}
                disabled={guardando}
              />
            </div>
            <div>
              <label className={claseLabel}>Clase</label>
              <select value={clase} onChange={e => setClase(e.target.value as ClaseCuenta)} className={claseInput} disabled={guardando}>
                {CLASES_CUENTA.map(opcion => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={claseLabel}>Modalidad de facturación</label>
              <select
                value={clase === 'eps' ? modalidad : ''}
                onChange={e => setModalidad(e.target.value as ModalidadFacturacion | '')}
                className={claseInput}
                disabled={guardando || clase !== 'eps'}
                title={clase !== 'eps' ? 'Solo aplica a una EPS' : undefined}
              >
                <option value="">{clase === 'eps' ? 'Sin definir' : 'Solo aplica a una EPS'}</option>
                {MODALIDADES_FACTURACION.map(opcion => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={claseLabel}>Código de prestador del REPS</label>
              <input
                type="text"
                inputMode="numeric"
                value={codigoPrestador}
                onChange={e => setCodigoPrestador(e.target.value)}
                placeholder="10 dígitos (opcional)"
                className={claseInput}
                maxLength={20}
                disabled={guardando}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={claseLabel}>Notas</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={3}
                className={claseInput}
                maxLength={2000}
                disabled={guardando}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={esCliente} onChange={e => setEsCliente(e.target.checked)} disabled={guardando} />
              Es cliente (VG le factura)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} disabled={guardando} />
              Cuenta activa
            </label>
          </div>
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar="Guardar" />
      </form>
    </Modal>
  )
}
