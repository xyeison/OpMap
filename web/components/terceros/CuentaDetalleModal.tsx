'use client'

// Detalle de una cuenta (GET /api/terceros/cuentas/[id]): datos, sedes (principal marcada, IPS de OpMap con
// enlace a su ficha, consultorios) y contactos (cargo y rol). Con terceros:create: nueva sede y nuevo
// contacto. Con terceros:manage: editar la cuenta, sedes y contactos, cambiar la sede principal y confirmar
// la ubicación de sedes nuevas (PATCH /api/terceros/sedes/[id]).
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  etiquetaClaseCuenta,
  etiquetaModalidad,
  etiquetaRolContacto,
  etiquetaTipoIdCuenta,
  type ContactoRow,
  type CuentaDetalle,
  type SedeRow,
} from '@/lib/terceros'
import ContactoForm from './ContactoForm'
import { CuentaEditForm } from './CuentaForm'
import SedeForm from './SedeForm'
import {
  AvisoError,
  AvisoOk,
  Cargando,
  Chip,
  Dato,
  Modal,
  TituloSeccion,
  claseBotonChico,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
} from './comun'

interface Props {
  cuentaId: string
  puedeCrear: boolean
  puedeAdministrar: boolean
  onCerrar: () => void
  /** Algo cambió (para refrescar la lista de atrás). */
  onCambio: () => void
}

/** ¿La sede tiene latitud y longitud? (la API puede omitirlas o enviarlas null). */
function tieneCoordenadas(sede: SedeRow): boolean {
  return sede.lat !== null && sede.lat !== undefined && sede.lng !== null && sede.lng !== undefined
}

type Formulario =
  | { tipo: 'editar-cuenta' }
  | { tipo: 'nueva-sede' }
  | { tipo: 'editar-sede'; sede: SedeRow }
  | { tipo: 'nuevo-contacto' }
  | { tipo: 'editar-contacto'; contacto: ContactoRow }

export default function CuentaDetalleModal({ cuentaId, puedeCrear, puedeAdministrar, onCerrar, onCambio }: Props) {
  const [detalle, setDetalle] = useState<CuentaDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await pedirJson(`/api/terceros/cuentas/${cuentaId}`)
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo cargar la cuenta'))
      const data = respuesta.data as CuentaDetalle | null
      if (!data || !data.cuenta) throw new Error('Respuesta inesperada del servidor')
      setDetalle({
        cuenta: data.cuenta,
        sedes: Array.isArray(data.sedes) ? data.sedes : [],
        contactos: Array.isArray(data.contactos) ? data.contactos : [],
      })
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo cargar la cuenta'))
    } finally {
      setCargando(false)
    }
  }, [cuentaId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const alGuardar = (mensaje: string) => {
    setFormulario(null)
    setAviso(mensaje)
    setErrorAccion('')
    onCambio()
    cargar()
  }

  const cambiarSede = async (sede: SedeRow, cambios: Record<string, unknown>, mensaje: string, porDefecto: string) => {
    setTrabajando(sede.id)
    setErrorAccion('')
    setAviso('')
    try {
      const respuesta = await pedirJson(`/api/terceros/sedes/${sede.id}`, { method: 'PATCH', json: cambios })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, porDefecto))
      setAviso(mensaje)
      onCambio()
      await cargar()
    } catch (err) {
      setErrorAccion(mensajeExcepcion(err, porDefecto))
    } finally {
      setTrabajando(null)
    }
  }

  const cuenta = detalle?.cuenta
  const sedes = detalle
    ? [...detalle.sedes].sort(
        (a, b) =>
          Number(b.es_principal) - Number(a.es_principal) ||
          Number(b.activo) - Number(a.activo) ||
          a.nombre.localeCompare(b.nombre, 'es')
      )
    : []
  const sedePorId = new Map(sedes.map(sede => [sede.id, sede]))
  const contactos = detalle
    ? [...detalle.contactos].sort(
        (a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es')
      )
    : []

  return (
    <Modal
      titulo={cuenta?.nombre ?? 'Cuenta'}
      subtitulo={cuenta ? etiquetaClaseCuenta(cuenta.clase) : undefined}
      onCerrar={onCerrar}
      ancho="sm:max-w-3xl"
    >
      {cargando && !detalle ? (
        <Cargando texto="Cargando la cuenta..." />
      ) : error && !detalle ? (
        <div className="p-4 sm:p-6">
          <AvisoError onReintentar={cargar}>{error}</AvisoError>
        </div>
      ) : cuenta ? (
        <div className="p-4 sm:p-6 space-y-6">
          {aviso && <AvisoOk>{aviso}</AvisoOk>}
          {errorAccion && <AvisoError>{errorAccion}</AvisoError>}

          {/* Datos de la cuenta */}
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Chip tono="negro">{etiquetaClaseCuenta(cuenta.clase)}</Chip>
              {cuenta.es_cliente && <Chip tono="verde">Cliente</Chip>}
              {!cuenta.activo && <Chip tono="rojo">Inactiva</Chip>}
              {cuenta.origen === 'hospitals' && (
                <Chip tono="azul" titulo="Cargada de las IPS activas de OpMap, agrupadas por NIT">
                  IPS de OpMap
                </Chip>
              )}
              {puedeAdministrar && (
                <button
                  type="button"
                  onClick={() => setFormulario({ tipo: 'editar-cuenta' })}
                  className={`${claseBotonChico} ml-auto`}
                >
                  Editar cuenta
                </button>
              )}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Dato etiqueta="Identificación">
                {etiquetaTipoIdCuenta(cuenta.tipo_identificacion)}{' '}
                {cuenta.numero_identificacion ?? <span className="text-gray-400">(protegida)</span>}
              </Dato>
              {cuenta.codigo_prestador && <Dato etiqueta="Código de prestador (REPS)">{cuenta.codigo_prestador}</Dato>}
              {cuenta.clase === 'eps' && (
                <Dato etiqueta="Modalidad de facturación">
                  {cuenta.modalidad_facturacion ? (
                    etiquetaModalidad(cuenta.modalidad_facturacion)
                  ) : (
                    <span className="text-gray-400">Sin definir</span>
                  )}
                </Dato>
              )}
              {cuenta.notas && (
                <div className="sm:col-span-2">
                  <Dato etiqueta="Notas">
                    <span className="whitespace-pre-line">{cuenta.notas}</span>
                  </Dato>
                </div>
              )}
            </dl>
          </section>

          {/* Sedes */}
          <section>
            <TituloSeccion
              accion={
                puedeCrear && cuenta.activo ? (
                  <button type="button" onClick={() => setFormulario({ tipo: 'nueva-sede' })} className={claseBotonChico}>
                    Nueva sede
                  </button>
                ) : undefined
              }
            >
              Sedes ({sedes.length})
            </TituloSeccion>
            {sedes.length === 0 ? (
              <p className="text-sm text-gray-500">Esta cuenta no tiene sedes.</p>
            ) : (
              <ul className="space-y-3">
                {sedes.map(sede => (
                  <li key={sede.id} className={`rounded-xl border p-3 sm:p-4 min-w-0 ${sede.activo ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${sede.activo ? 'text-gray-900' : 'text-gray-400'}`} title={sede.nombre}>
                          {sede.nombre}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {[sede.ciudad, sede.direccion].filter(Boolean).join(' · ') || 'Sin ciudad ni dirección'}
                        </p>
                        {sede.reps_code && <p className="text-xs text-gray-500">Código de habilitación: {sede.reps_code}</p>}
                        {tieneCoordenadas(sede) && (
                          <p className="text-xs text-gray-400">
                            Coordenadas: {Number(sede.lat).toFixed(6)}, {Number(sede.lng).toFixed(6)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:justify-end shrink-0">
                        {sede.es_principal && <Chip tono="negro">Principal</Chip>}
                        {sede.hospital_id && <Chip tono="azul">IPS de OpMap</Chip>}
                        {!sede.activo && <Chip tono="rojo">Inactiva</Chip>}
                        {sede.origen !== 'hospitals' &&
                          (sede.ubicacion_confirmada ? (
                            <Chip tono="verde">Ubicación confirmada</Chip>
                          ) : (
                            <Chip tono="ambar">{tieneCoordenadas(sede) ? 'Ubicación sin confirmar' : 'Sin ubicación'}</Chip>
                          ))}
                      </div>
                    </div>
                    {(sede.hospital_id || puedeAdministrar) && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {sede.hospital_id && (
                          <Link href={`/hospitals/${sede.hospital_id}`} className={claseBotonChico}>
                            Ver ficha de la IPS
                          </Link>
                        )}
                        {puedeAdministrar && !sede.es_principal && sede.activo && (
                          <button
                            type="button"
                            disabled={trabajando !== null}
                            onClick={() =>
                              cambiarSede(
                                sede,
                                { es_principal: true },
                                `${sede.nombre} es ahora la sede principal.`,
                                'No se pudo cambiar la sede principal'
                              )
                            }
                            className={claseBotonChico}
                          >
                            {trabajando === sede.id ? 'Guardando...' : 'Marcar como principal'}
                          </button>
                        )}
                        {puedeAdministrar && !sede.hospital_id && !sede.ubicacion_confirmada && tieneCoordenadas(sede) && (
                          <button
                            type="button"
                            disabled={trabajando !== null}
                            onClick={() =>
                              cambiarSede(
                                sede,
                                { ubicacion_confirmada: true },
                                `Se confirmó la ubicación de ${sede.nombre}.`,
                                'No se pudo confirmar la ubicación'
                              )
                            }
                            className={claseBotonChico}
                          >
                            {trabajando === sede.id ? 'Guardando...' : 'Confirmar ubicación'}
                          </button>
                        )}
                        {puedeAdministrar && sede.origen !== 'hospitals' && (
                          <button
                            type="button"
                            disabled={trabajando !== null}
                            onClick={() => setFormulario({ tipo: 'editar-sede', sede })}
                            className={claseBotonChico}
                          >
                            Editar sede
                          </button>
                        )}
                      </div>
                    )}
                    {puedeAdministrar && sede.origen === 'hospitals' && (
                      <p className="mt-2 text-xs text-gray-400">
                        Los datos de esta sede vienen de la IPS en OpMap: se cambian en su ficha.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Contactos */}
          <section>
            <TituloSeccion
              accion={
                puedeCrear && cuenta.activo ? (
                  <button type="button" onClick={() => setFormulario({ tipo: 'nuevo-contacto' })} className={claseBotonChico}>
                    Nuevo contacto
                  </button>
                ) : undefined
              }
            >
              Contactos ({contactos.length})
            </TituloSeccion>
            {contactos.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay contactos en esta cuenta.</p>
            ) : (
              <ul className="space-y-3">
                {contactos.map(contacto => {
                  const sede = contacto.sede_id ? sedePorId.get(contacto.sede_id) : undefined
                  return (
                    <li key={contacto.id} className={`rounded-xl border p-3 sm:p-4 min-w-0 ${contacto.activo ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${contacto.activo ? 'text-gray-900' : 'text-gray-400'}`}>
                            {contacto.nombre}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {contacto.cargo_texto || 'Sin cargo'}
                            {sede ? ` · ${sede.nombre}` : ' · Toda la cuenta'}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs">
                            {contacto.telefono && (
                              <a href={`tel:${contacto.telefono.replace(/[^\d+]/g, '')}`} className="text-gray-700 underline underline-offset-2">
                                {contacto.telefono}
                              </a>
                            )}
                            {contacto.email && (
                              <a href={`mailto:${contacto.email}`} className="text-gray-700 underline underline-offset-2 truncate">
                                {contacto.email}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <Chip>{etiquetaRolContacto(contacto.rol)}</Chip>
                          {!contacto.activo && <Chip tono="rojo">Inactivo</Chip>}
                          {puedeAdministrar && (
                            <button
                              type="button"
                              onClick={() => setFormulario({ tipo: 'editar-contacto', contacto })}
                              className={claseBotonChico}
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {cuenta && formulario?.tipo === 'editar-cuenta' && (
        <CuentaEditForm cuenta={cuenta} onCerrar={() => setFormulario(null)} onGuardada={alGuardar} />
      )}
      {cuenta && formulario?.tipo === 'nueva-sede' && (
        <SedeForm
          modo="crear"
          cuentaId={cuenta.id}
          cuentaNombre={cuenta.nombre}
          onCerrar={() => setFormulario(null)}
          onGuardada={alGuardar}
        />
      )}
      {cuenta && formulario?.tipo === 'editar-sede' && (
        <SedeForm
          modo="editar"
          sede={formulario.sede}
          cuentaNombre={cuenta.nombre}
          onCerrar={() => setFormulario(null)}
          onGuardada={alGuardar}
        />
      )}
      {cuenta && formulario?.tipo === 'nuevo-contacto' && (
        <ContactoForm
          cuentaId={cuenta.id}
          cuentaNombre={cuenta.nombre}
          sedes={sedes}
          onCerrar={() => setFormulario(null)}
          onGuardado={alGuardar}
        />
      )}
      {cuenta && formulario?.tipo === 'editar-contacto' && (
        <ContactoForm
          cuentaId={cuenta.id}
          cuentaNombre={cuenta.nombre}
          sedes={sedes}
          contacto={formulario.contacto}
          onCerrar={() => setFormulario(null)}
          onGuardado={alGuardar}
        />
      )}
    </Modal>
  )
}
