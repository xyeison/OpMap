'use client'

// Nuevo médico (POST /api/terceros/medicos, terceros:create). Médicos completos o no se crean: tipo y número
// de documento, solo CC o CE (dueño, 2026-10-30, para no repetir médicos) → "Verificar" (POST /api/terceros/medicos/verificar): si ya existe se muestra el existente y no
// se deja crear; luego nombre, especialidades, municipio y al menos una sede donde atiende (buscador de sedes
// + rol consultorio/atiende). Si su consultorio no existe, se crea aquí la cuenta consultorio con su sede.
import { useState } from 'react'
import {
  ESPECIALIDADES,
  ROLES_MEDICO_SEDE,
  TIPOS_DOC_MEDICO_NUEVO,
  normalizarIdentificacion,
  type EspecialidadMedico,
  type MedicoVerificarRespuesta,
  type RolMedicoSede,
  type SedeBusquedaItem,
  type TipoDocMedicoNuevo,
} from '@/lib/terceros'
import { medicoCreateSchema, medicoVerificarSchema } from '@/lib/terceros-schemas'
import CuentaForm, { leerSedePrincipal, type SedeCreada } from './CuentaForm'
import MunicipioSelector from './MunicipioSelector'
import SedeBuscador from './SedeBuscador'
import {
  AvisoAtencion,
  AvisoError,
  Modal,
  PieFormulario,
  claseBotonChico,
  claseBotonPrimario,
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

/** Casillas de especialidades (varias). */
export function CamposEspecialidades({
  valor,
  onCambiar,
  disabled = false,
}: {
  valor: EspecialidadMedico[]
  onCambiar: (valor: EspecialidadMedico[]) => void
  disabled?: boolean
}) {
  const alternar = (especialidad: EspecialidadMedico) =>
    onCambiar(valor.includes(especialidad) ? valor.filter(e => e !== especialidad) : [...valor, especialidad])
  return (
    <div className="flex flex-wrap gap-2">
      {ESPECIALIDADES.map(opcion => {
        const elegida = valor.includes(opcion.valor)
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={elegida}
            disabled={disabled}
            onClick={() => alternar(opcion.valor)}
            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors disabled:opacity-50 ${
              elegida ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opcion.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

interface SedeElegida {
  sede: SedeBusquedaItem
  rol: RolMedicoSede
}

interface Props {
  onCerrar: () => void
  onCreado: (medico: { id: string; nombre: string }) => void
  /** Abrir un médico que ya existe (documento repetido o nombre parecido). */
  onAbrirMedico: (id: string) => void
  puedeAdministrar: boolean
}

export default function MedicoForm({ onCerrar, onCreado, onAbrirMedico, puedeAdministrar }: Props) {
  // Documento y verificación
  const [tipoDoc, setTipoDoc] = useState<TipoDocMedicoNuevo>('CC')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [verificado, setVerificado] = useState<string | null>(null) // clave "tipo:número" verificada sin repetidos
  const [verificando, setVerificando] = useState(false)
  const [errorDoc, setErrorDoc] = useState('')
  const [existente, setExistente] = useState<{ id: string; nombre: string } | null>(null)
  const [parecidos, setParecidos] = useState<MedicoVerificarRespuesta['parecidos']>([])

  // Datos
  const [nombre, setNombre] = useState('')
  const [especialidades, setEspecialidades] = useState<EspecialidadMedico[]>([])
  const [municipio, setMunicipio] = useState<string | null>(null)
  const [ciudad, setCiudad] = useState<string | null>(null)
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')

  // Sedes donde atiende
  const [sedes, setSedes] = useState<SedeElegida[]>([])
  const [principal, setPrincipal] = useState<string | null>(null)
  const [creandoConsultorio, setCreandoConsultorio] = useState(false)
  const [avisoSedes, setAvisoSedes] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const numeroNormalizado = normalizarIdentificacion(tipoDoc, numeroDoc)
  const claveActual = numeroNormalizado ? `${tipoDoc}:${numeroNormalizado}` : null
  const documentoListo = claveActual !== null && verificado === claveActual
  const bloqueado = !documentoListo || guardando

  const pedirVerificacion = async (conNombre: boolean): Promise<MedicoVerificarRespuesta | null> => {
    const cuerpo = {
      tipo_documento: tipoDoc,
      numero_documento: numeroDoc,
      ...(conNombre ? { nombre: textoONada(nombre), municipality_id: municipio ?? undefined } : {}),
    }
    const validado = medicoVerificarSchema.safeParse(cuerpo)
    if (!validado.success) {
      setErrorDoc(primerErrorZod(validado.error))
      return null
    }
    const respuesta = await pedirJson('/api/terceros/medicos/verificar', { method: 'POST', json: cuerpo })
    if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo verificar el documento'))
    const data = respuesta.data as Partial<MedicoVerificarRespuesta> | null
    return {
      existente: existenteDe(data),
      parecidos: Array.isArray(data?.parecidos) ? data.parecidos : [],
    }
  }

  const verificar = async () => {
    setErrorDoc('')
    setExistente(null)
    setParecidos([])
    setVerificado(null)
    setVerificando(true)
    try {
      const resultado = await pedirVerificacion(Boolean(nombre.trim()))
      if (!resultado) return
      if (resultado.existente) {
        setExistente(resultado.existente)
        return
      }
      setVerificado(claveActual)
      setParecidos(resultado.parecidos)
    } catch (err) {
      setErrorDoc(mensajeExcepcion(err, 'No se pudo verificar el documento'))
    } finally {
      setVerificando(false)
    }
  }

  // Al terminar de escribir el nombre, se buscan médicos con nombre parecido (aviso, no bloquea).
  const revisarParecidos = async () => {
    if (!documentoListo || nombre.trim().length < 3) return
    try {
      const resultado = await pedirVerificacion(true)
      if (!resultado) return
      if (resultado.existente) {
        setExistente(resultado.existente)
        setVerificado(null)
        return
      }
      setParecidos(resultado.parecidos)
    } catch {
      // El aviso de parecidos es una ayuda: si falla, no se bloquea el formulario.
    }
  }

  const agregarSede = (sede: SedeBusquedaItem, rol: RolMedicoSede = 'atiende') => {
    setAvisoSedes('')
    setSedes(prev => (prev.some(s => s.sede.id === sede.id) ? prev : [...prev, { sede, rol }]))
    setPrincipal(prev => prev ?? sede.id)
  }

  const quitarSede = (sedeId: string) => {
    const quedan = sedes.filter(s => s.sede.id !== sedeId)
    setSedes(quedan)
    if (principal === sedeId) setPrincipal(quedan[0]?.sede.id ?? null)
  }

  const agregarConsultorio = (sede: SedeCreada | null, cuentaNombre: string) => {
    setCreandoConsultorio(false)
    if (!sede) {
      setAvisoSedes(`La cuenta ${cuentaNombre} existe, pero no se pudo leer su sede: búscala en el buscador.`)
      return
    }
    agregarSede(
      { id: sede.id, nombre: sede.nombre, cuenta_id: sede.cuenta_id, cuenta_nombre: sede.cuenta_nombre, ciudad: sede.ciudad, reps_code: sede.reps_code },
      'consultorio'
    )
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!documentoListo) {
      setError('Primero verifica el documento del médico')
      return
    }
    const principalId = sedes.some(s => s.sede.id === principal) ? principal : sedes[0]?.sede.id ?? null
    const cuerpo = {
      tipo_documento: tipoDoc,
      numero_documento: numeroDoc,
      nombre,
      especialidades,
      municipality_id: municipio ?? undefined,
      telefono: textoONada(telefono),
      email: textoONada(email),
      notas: textoONada(notas),
      sedes: sedes.map(s => ({ sede_id: s.sede.id, rol: s.rol, principal: s.sede.id === principalId })),
    }
    const validado = medicoCreateSchema.safeParse(cuerpo)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson('/api/terceros/medicos', { method: 'POST', json: cuerpo })
      if (respuesta.status === 409) {
        const yaExiste = existenteDe(respuesta.data)
        if (yaExiste) {
          setExistente(yaExiste)
          setVerificado(null)
          setGuardando(false)
          return
        }
      }
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo crear el médico'))
      const id = idCreado(respuesta.data, 'medico')
      if (!id) throw new Error('El médico se creó, pero el servidor no devolvió su id: búscalo en la lista')
      onCreado({ id, nombre: validado.data.nombre })
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo crear el médico'))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nuevo médico" subtitulo="Completo o no se crea" onCerrar={onCerrar} ancho="sm:max-w-3xl">
      <form onSubmit={guardar}>
        <div className="p-4 sm:p-6 space-y-6">
          {error && <AvisoError>{error}</AvisoError>}

          {/* 1. Documento */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">1. Documento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 sm:items-end">
              <div className="min-w-0">
                <label className={claseLabel}>
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  value={tipoDoc}
                  onChange={e => {
                    setTipoDoc(e.target.value as TipoDocMedicoNuevo)
                    setExistente(null)
                    setErrorDoc('')
                  }}
                  className={claseInput}
                  disabled={verificando || guardando}
                >
                  {TIPOS_DOC_MEDICO_NUEVO.map(opcion => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className={claseLabel}>
                  Número <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode={tipoDoc === 'CC' ? 'numeric' : 'text'}
                  value={numeroDoc}
                  onChange={e => {
                    setNumeroDoc(e.target.value)
                    setExistente(null)
                    setErrorDoc('')
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      verificar()
                    }
                  }}
                  className={claseInput}
                  maxLength={30}
                  disabled={verificando || guardando}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={verificar}
                disabled={verificando || guardando || !numeroDoc.trim()}
                className={claseBotonPrimario}
              >
                {verificando ? 'Verificando...' : 'Verificar'}
              </button>
            </div>
            {errorDoc && <p className="text-sm text-red-600">{errorDoc}</p>}
            {existente && (
              <AvisoAtencion>
                <p>
                  Ya existe un médico con ese documento: <strong>{existente.nombre}</strong>. No se puede crear otro.
                </p>
                <button type="button" onClick={() => onAbrirMedico(existente.id)} className={`${claseBotonChico} mt-2`}>
                  Ver el médico
                </button>
              </AvisoAtencion>
            )}
            {documentoListo && (
              <p className="text-sm text-green-700">Documento verificado: no hay otro médico con ese documento.</p>
            )}
            {!documentoListo && !existente && verificado !== null && (
              <p className="text-sm text-amber-700">Cambiaste el documento: verifícalo otra vez.</p>
            )}
            <p className="text-xs text-gray-500">
              El documento es un dato protegido: solo lo ve quien administra terceros
              {puedeAdministrar ? ' (tú puedes verlo)' : ''}.
            </p>
          </section>

          {/* 2. Datos */}
          <fieldset disabled={bloqueado} className={`space-y-4 ${documentoListo ? '' : 'opacity-50'}`}>
            <legend className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">2. Datos del médico</legend>
            <div>
              <label className={claseLabel}>
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onBlur={revisarParecidos}
                className={claseInput}
                maxLength={200}
              />
            </div>
            {parecidos.length > 0 && (
              <AvisoAtencion>
                <p className="font-medium">Hay médicos con un nombre parecido. ¿Es alguno de ellos?</p>
                <ul className="mt-2 space-y-1">
                  {parecidos.map(medico => (
                    <li key={medico.id} className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="min-w-0 truncate">
                        {medico.nombre}
                        {medico.ciudad ? ` · ${medico.ciudad}` : ''}
                      </span>
                      <button type="button" onClick={() => onAbrirMedico(medico.id)} className={claseBotonChico}>
                        Ver
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">Si es otra persona, sigue: el documento es distinto.</p>
              </AvisoAtencion>
            )}
            <div>
              <span className={claseLabel}>
                Especialidades <span className="text-red-500">*</span>
              </span>
              <CamposEspecialidades valor={especialidades} onCambiar={setEspecialidades} disabled={bloqueado} />
            </div>
            <MunicipioSelector
              valor={municipio}
              onCambiar={(codigo, nombreMunicipio) => {
                setMunicipio(codigo)
                setCiudad(nombreMunicipio)
              }}
              etiqueta="Municipio donde ejerce"
              requerido
              disabled={bloqueado}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={claseLabel}>Teléfono</label>
                <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={claseInput} maxLength={60} />
              </div>
              <div>
                <label className={claseLabel}>Correo</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={claseInput} maxLength={320} />
              </div>
            </div>
            <div>
              <label className={claseLabel}>Notas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className={claseInput} maxLength={2000} />
            </div>
          </fieldset>

          {/* 3. Sedes donde atiende */}
          <fieldset disabled={bloqueado} className={`space-y-3 ${documentoListo ? '' : 'opacity-50'}`}>
            <legend className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
              3. Sedes donde atiende <span className="text-red-500">*</span>
            </legend>
            <p className="text-xs text-gray-500">
              Al menos una: su consultorio y las clínicas donde opera. Un médico sin sede no se puede guardar.
            </p>
            {avisoSedes && <AvisoAtencion>{avisoSedes}</AvisoAtencion>}
            {sedes.length > 0 && (
              <ul className="space-y-2">
                {sedes.map(({ sede, rol }) => (
                  <li key={sede.id} className="rounded-xl border border-gray-200 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{sede.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[sede.cuenta_nombre, sede.ciudad].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarSede(sede.id)}
                        className="shrink-0 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                      <select
                        value={rol}
                        onChange={e =>
                          setSedes(prev =>
                            prev.map(s => (s.sede.id === sede.id ? { ...s, rol: e.target.value as RolMedicoSede } : s))
                          )
                        }
                        className={`${claseInput} sm:w-48`}
                        aria-label={`Rol en ${sede.nombre}`}
                      >
                        {ROLES_MEDICO_SEDE.map(opcion => (
                          <option key={opcion.valor} value={opcion.valor}>
                            {opcion.etiqueta}
                          </option>
                        ))}
                      </select>
                      {sedes.length > 1 && (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="radio"
                            name="sede-principal"
                            checked={principal === sede.id}
                            onChange={() => setPrincipal(sede.id)}
                          />
                          Sede principal del médico
                        </label>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <SedeBuscador
              onElegir={sede => agregarSede(sede)}
              excluir={sedes.map(s => s.sede.id)}
              municipio={municipio}
              ciudad={ciudad}
              disabled={bloqueado}
            />
            <button type="button" onClick={() => setCreandoConsultorio(true)} className={claseBotonChico}>
              Su consultorio no está: crear la cuenta consultorio
            </button>
          </fieldset>
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar="Crear médico" deshabilitado={!documentoListo} />
      </form>

      {creandoConsultorio && (
        <CuentaForm
          puedeAdministrar={puedeAdministrar}
          clasePreset="consultorio"
          nombrePreset={nombre.trim() ? `Consultorio ${nombre.trim()}` : ''}
          municipioPreset={municipio}
          ciudadPreset={ciudad}
          ayuda="Crea la cuenta del consultorio con su sede. Al guardarla, la sede queda en la lista del médico como su consultorio."
          onCerrar={() => setCreandoConsultorio(false)}
          onCreada={(cuenta, sede) => agregarConsultorio(sede, cuenta.nombre)}
          onUsarExistente={async (cuenta, sede) =>
            agregarConsultorio(sede ?? (await leerSedePrincipal(cuenta.id, cuenta.nombre)), cuenta.nombre)
          }
        />
      )}
    </Modal>
  )
}
