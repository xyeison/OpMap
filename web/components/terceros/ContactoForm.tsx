'use client'

// Contacto de una cuenta: crear (POST /api/terceros/contactos, terceros:create) o editar
// (PATCH /api/terceros/contactos/[id], terceros:manage). El rol se sugiere por el cargo (rolDesdeCargo) y se
// puede cambiar; si quien escribe elige otro rol, el cargo ya no lo cambia. Sin duplicados (dueño, 2026-10-30): teléfono
// y/o correo, y si en la cuenta ya hay uno con ese teléfono o correo, el servidor responde 409 con él y se nombra.
import { useState } from 'react'
import { ROLES_CONTACTO, rolDesdeCargo, type ContactoRow, type RolContacto, type SedeRow } from '@/lib/terceros'
import { contactoCreateSchema, contactoUpdateSchema } from '@/lib/terceros-schemas'
import {
  AvisoError,
  CAPA_MODAL_ENCIMA,
  Modal,
  PieFormulario,
  claseInput,
  claseLabel,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  existenteDe,
  primerErrorZod,
  textoONada,
  type Respuesta,
} from './comun'

type ContactoFormProps = {
  cuentaId: string
  cuentaNombre: string
  sedes: SedeRow[]
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
  /** Contacto a editar (terceros:manage); sin él, se crea uno nuevo. */
  contacto?: ContactoRow
}

/** El 409 de un contacto repetido nombra el que ya está en la cuenta; lo demás, como siempre. */
function mensajeContacto(respuesta: Respuesta, porDefecto: string): string {
  const existente = respuesta.status === 409 ? existenteDe(respuesta.data) : null
  return existente ? `${mensajeError(respuesta, porDefecto)}: ${existente.nombre}` : mensajeError(respuesta, porDefecto)
}

export default function ContactoForm({ cuentaId, cuentaNombre, sedes, onCerrar, onGuardado, contacto }: ContactoFormProps) {
  const editando = contacto !== undefined
  const [nombre, setNombre] = useState(contacto?.nombre ?? '')
  const [cargo, setCargo] = useState(contacto?.cargo_texto ?? '')
  const [rol, setRol] = useState<RolContacto>(contacto?.rol ?? 'otro')
  // Al editar, el rol guardado manda: cambiar el cargo no lo mueve.
  const [rolElegido, setRolElegido] = useState(editando)
  const [sedeId, setSedeId] = useState(contacto?.sede_id ?? '')
  const [telefono, setTelefono] = useState(contacto?.telefono ?? '')
  const [email, setEmail] = useState(contacto?.email ?? '')
  const [activo, setActivo] = useState(contacto?.activo ?? true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const sugerido = rolDesdeCargo(cargo)
  const sedesElegibles = sedes.filter(sede => sede.activo || sede.id === contacto?.sede_id)

  const cambiarCargo = (valor: string) => {
    setCargo(valor)
    if (!rolElegido) setRol(rolDesdeCargo(valor))
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!contacto) {
      const cuerpo = {
        cuenta_id: cuentaId,
        sede_id: sedeId || undefined,
        nombre,
        cargo_texto: textoONada(cargo),
        rol,
        telefono: textoONada(telefono),
        email: textoONada(email),
      }
      const validado = contactoCreateSchema.safeParse(cuerpo)
      if (!validado.success) {
        setError(primerErrorZod(validado.error))
        return
      }
      setGuardando(true)
      try {
        const respuesta = await pedirJson('/api/terceros/contactos', { method: 'POST', json: cuerpo })
        if (!respuesta.ok) throw new Error(mensajeContacto(respuesta, 'No se pudo crear el contacto'))
        onGuardado(`Se creó el contacto ${validado.data.nombre}.`)
      } catch (err) {
        setError(mensajeExcepcion(err, 'No se pudo crear el contacto'))
        setGuardando(false)
      }
      return
    }

    const cambios: Record<string, unknown> = {}
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ')
    if (nombreLimpio !== contacto.nombre) cambios.nombre = nombreLimpio
    if (cargo.trim() !== (contacto.cargo_texto ?? '')) cambios.cargo_texto = cargo.trim() || null
    if (rol !== contacto.rol) cambios.rol = rol
    if (sedeId !== (contacto.sede_id ?? '')) cambios.sede_id = sedeId || null
    if (telefono.trim() !== (contacto.telefono ?? '')) cambios.telefono = telefono.trim() || null
    if (email.trim().toLowerCase() !== (contacto.email ?? '').toLowerCase()) cambios.email = email.trim() || null
    if (activo !== contacto.activo) cambios.activo = activo
    if (Object.keys(cambios).length === 0) {
      setError('No hay cambios para guardar')
      return
    }
    const validado = contactoUpdateSchema.safeParse(cambios)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson(`/api/terceros/contactos/${contacto.id}`, { method: 'PATCH', json: cambios })
      if (!respuesta.ok) throw new Error(mensajeContacto(respuesta, 'No se pudo guardar el contacto'))
      onGuardado(`Se guardaron los cambios de ${nombreLimpio || contacto.nombre}.`)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo guardar el contacto'))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={editando ? 'Editar contacto' : 'Nuevo contacto'} subtitulo={cuentaNombre} onCerrar={onCerrar} capa={CAPA_MODAL_ENCIMA}>
      <form onSubmit={guardar}>
        <div className="p-4 sm:p-6 space-y-4">
          {error && <AvisoError>{error}</AvisoError>}
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
                autoFocus
              />
            </div>
            <div className="sm:col-span-2">
              <label className={claseLabel}>Cargo</label>
              <input
                type="text"
                value={cargo}
                onChange={e => cambiarCargo(e.target.value)}
                placeholder="Como lo dice la persona: Jefe de compras, Químico farmacéutico..."
                className={claseInput}
                maxLength={200}
                disabled={guardando}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={claseLabel}>Rol</label>
              <select
                value={rol}
                onChange={e => {
                  setRol(e.target.value as RolContacto)
                  setRolElegido(true)
                }}
                className={claseInput}
                disabled={guardando}
              >
                {ROLES_CONTACTO.map(opcion => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                    {opcion.valor === sugerido && cargo.trim() ? ' (sugerido por el cargo)' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {rolElegido && cargo.trim() && rol !== sugerido
                  ? 'Elegiste el rol a mano.'
                  : 'Se sugiere por el cargo; puedes cambiarlo.'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className={claseLabel}>Sede</label>
              <select value={sedeId} onChange={e => setSedeId(e.target.value)} className={claseInput} disabled={guardando}>
                <option value="">Toda la cuenta (sin sede)</option>
                {sedesElegibles.map(sede => (
                  <option key={sede.id} value={sede.id}>
                    {sede.nombre}
                    {sede.ciudad ? ` · ${sede.ciudad}` : ''}
                    {sede.es_principal ? ' (principal)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={claseLabel}>Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                className={claseInput}
                maxLength={60}
                disabled={guardando}
              />
            </div>
            <div>
              <label className={claseLabel}>Correo</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={claseInput}
                maxLength={320}
                disabled={guardando}
              />
            </div>
            <p className="sm:col-span-2 -mt-2 text-xs text-gray-500">Teléfono o correo: al menos uno de los dos.</p>
            {editando && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} disabled={guardando} />
                Contacto activo
              </label>
            )}
          </div>
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar={editando ? 'Guardar' : 'Crear contacto'} />
      </form>
    </Modal>
  )
}
