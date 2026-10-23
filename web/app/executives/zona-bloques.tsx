'use client'

// Piezas compartidas de las ventanas "Datos de la zona" (spec 2026-10-23, Zonas por línea): la de /executives
// (ZonaEstadisticasModal: por persona o vacante, con sus niveles zona base / territorio) y la de /kams
// (ZonaDatosModal: por Zona, sin cabecera de persona, para que una Zona sin nadie también tenga dónde verlas).
// Se extrajeron de ZonaEstadisticasModal.tsx SIN cambiar su apariencia: las dos ventanas muestran las mismas
// tarjetas (Municipios, Población, Afiliados, IPS, Giros, Compras públicas, Visitas), la misma lista "Quién cubre
// <zona> en cada línea", el mismo "¿Cómo se calcula?" y los mismos estados de carga y error. Las cuentas vienen de
// lib/zona-estadisticas.ts (con pruebas en scripts/zona-estadisticas-check.ts); aquí solo hay presentación.
import { useEffect, useRef, type ReactNode } from 'react'
import { KIND_BADGE, KIND_LABELS, formatMinutes } from '@/app/lines/coverage-shared'
import { formatCopCompact } from '@/lib/giros-format'
import { fechaEs, numeroEs, pctEs, rangoMesesEs, type BloqueZona, type CoberturaZonaLinea } from '@/lib/zona-estadisticas'

// ---------------------------------------------------------------------------
// Accesibilidad de la ventana
// ---------------------------------------------------------------------------

/**
 * Escape cierra; el foco vuelve a donde estaba al cerrar. onCerrar va en una ref para que un render del padre (que
 * crea otra función) no vuelva a suscribir ni devuelva el foco antes de tiempo. El foco al título lo pone cada
 * ventana, porque depende de cuándo termina de cargar.
 */
export function useVentanaAccesible(onCerrar: () => void) {
  const onCerrarRef = useRef(onCerrar)
  onCerrarRef.current = onCerrar
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCerrarRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previo?.focus()
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Estados de carga y error (misma apariencia en las dos ventanas)
// ---------------------------------------------------------------------------

export function CargandoDatos({ texto = 'Cargando los datos de la zona…' }: { texto?: string }) {
  return (
    <div className="py-16 text-center" role="status">
      <svg className="animate-spin h-10 w-10 text-gray-700 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <p className="text-sm text-gray-600">{texto}</p>
    </div>
  )
}

export function ErrorDatos({ error, onReintentar }: { error: string; onReintentar: () => void }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="alert">
      <span className="break-words">{error}</span>
      <button type="button" onClick={onReintentar} className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100 shrink-0">
        Reintentar
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cifras de un bloque (zona base, territorio o una Zona sola)
// ---------------------------------------------------------------------------

export function Bloque({
  bloque,
  verSecop,
  municipiosCalculados,
}: {
  bloque: BloqueZona
  /** Compras públicas solo con el acceso a Inteligencia; sin esa tarjeta, Giros ocupa la fila entera. */
  verSecop: boolean
  /** municipality_zone.computed_at más reciente (fuente de la tarjeta de Municipios). */
  municipiosCalculados: string | null
}) {
  const { municipios, poblacion, afiliados, ips, giros, secop, visitas } = bloque
  const departamentosVisibles = municipios.departamentos.slice(0, 6)
  const departamentosOcultos = municipios.departamentos.length - departamentosVisibles.length

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
      <Tarjeta
        titulo="Municipios"
        valor={numeroEs(municipios.total)}
        fuente={`IPS asignadas hoy y alcance por tiempo real de carretera · calculado el ${fechaEs(municipiosCalculados)}`}
      >
        <Linea>
          {numeroEs(municipios.conIps)} con IPS · {numeroEs(municipios.alcance)} de alcance
        </Linea>
        {municipios.compartidosNombres.length > 0 && (
          <Linea tenue>Compartido con otras zonas (cuenta por su parte): {municipios.compartidosNombres.join(', ')}</Linea>
        )}
        {municipios.departamentos.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500">
              {numeroEs(municipios.departamentos.length)} {municipios.departamentos.length === 1 ? 'departamento' : 'departamentos'}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {departamentosVisibles.map(departamento => (
                <span key={departamento.code} className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-700">
                  {departamento.nombre} · {numeroEs(departamento.municipios)}
                </span>
              ))}
              {departamentosOcultos > 0 && <span className="px-2 py-0.5 text-xs text-gray-500">y {numeroEs(departamentosOcultos)} más</span>}
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Población"
        valor={poblacion ? numeroEs(poblacion.total) : null}
        fuente={poblacion ? `DANE · proyección ${poblacion.anio} (serie 2020-2035, actualización post COVID-19)` : 'DANE · proyecciones municipales'}
      >
        {poblacion && (
          <>
            <Linea>
              Cabecera {numeroEs(poblacion.cabecera)} ({pctEs(poblacion.cabecera, poblacion.total)})
            </Linea>
            <Linea>
              Rural {numeroEs(poblacion.rural)} ({pctEs(poblacion.rural, poblacion.total)})
            </Linea>
            {poblacion.municipiosSinDato > 0 && <Linea tenue>{numeroEs(poblacion.municipiosSinDato)} municipios sin proyección</Linea>}
          </>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Afiliados a salud"
        valor={afiliados ? numeroEs(afiliados.total) : null}
        fuente={afiliados ? `BDUA (ADRES) · afiliados activos · corte del ${fechaEs(afiliados.corte)}` : 'BDUA (ADRES)'}
      >
        {afiliados && (
          <>
            <Linea>
              Contributivo {numeroEs(afiliados.contributivo)} ({pctEs(afiliados.contributivo, afiliados.total)})
            </Linea>
            <Linea>
              Subsidiado {numeroEs(afiliados.subsidiado)} ({pctEs(afiliados.subsidiado, afiliados.total)})
            </Linea>
            {afiliados.eps.length > 0 && (
              <Linea tenue>EPS principales: {afiliados.eps.map(eps => `${eps.nombre} ${eps.pct.toLocaleString('es-CO')} %`).join(' · ')}</Linea>
            )}
            {afiliados.municipiosSinDato > 0 && <Linea tenue>{numeroEs(afiliados.municipiosSinDato)} municipios sin datos en la BDUA</Linea>}
          </>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="IPS objetivo"
        valor={numeroEs(ips.total)}
        fuente={`IPS activas asignadas a la zona · servicios del REPS importados el ${fechaEs(ips.repsActualizado)}`}
      >
        <Linea>
          {numeroEs(ips.camas)} camas{ips.quirofanos !== null ? ` · ${numeroEs(ips.quirofanos)} quirófanos` : ''}
        </Linea>
        {ips.total > 0 && ips.conServiciosReps === 0 ? (
          <Linea tenue>Servicios del REPS: sin datos</Linea>
        ) : (
          ips.total > 0 && (
            <>
              <Linea>Con cirugía ortopédica: {numeroEs(ips.cirugiaOrtopedica)}</Linea>
              <Linea>Con neurocirugía: {numeroEs(ips.neurocirugia)}</Linea>
              <Linea>Con alguna de las dos: {numeroEs(ips.ortopediaONeuro)}</Linea>
              {ips.conServiciosReps < ips.total && (
                <Linea tenue>
                  {numeroEs(ips.conServiciosReps)} de {numeroEs(ips.total)} IPS tienen servicios del REPS importados
                </Linea>
              )}
            </>
          )
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Giros ADRES · 12 meses"
        valor={giros ? formatCopCompact(giros.valor) : null}
        fuente={
          giros
            ? `ADRES · ${giros.fuente === 'identifica' ? 'Identifica tu Giro (contributivo y subsidiado)' : 'Reporte 29 (solo subsidiado)'} · ${rangoMesesEs(giros.desde, giros.hasta)}`
            : 'ADRES'
        }
        ancho={!verSecop}
      >
        {giros && (
          <Linea>
            {numeroEs(giros.ipsConGiro)} de {numeroEs(ips.total)} IPS con giro
          </Linea>
        )}
      </Tarjeta>

      {verSecop && (
        <Tarjeta
          titulo="Compras públicas · 12 meses"
          valor={secop ? formatCopCompact(secop.valor) : null}
          fuente={
            secop
              ? `SECOP I, SECOP II e Integrado · material ortopédico y de neurocirugía · ${rangoMesesEs(secop.desde, secop.hasta)}${
                  secop.actualizado ? ` · datos al ${fechaEs(secop.actualizado)}` : ''
                }`
              : 'SECOP (Colombia Compra Eficiente)'
          }
        >
          {secop && (
            <>
              <Linea>
                {numeroEs(secop.contratos)} {secop.contratos === 1 ? 'contrato' : 'contratos'} · {numeroEs(secop.entidades)}{' '}
                {secop.entidades === 1 ? 'entidad' : 'entidades'}
              </Linea>
              <Linea>
                VG Medical: <strong className="text-gray-900">{formatCopCompact(secop.vg.valor)}</strong>
                {secop.valor > 0 ? ` (${pctEs(secop.vg.valor, secop.valor)})` : ''} · {numeroEs(secop.vg.contratos)}{' '}
                {secop.vg.contratos === 1 ? 'contrato' : 'contratos'}
              </Linea>
              {secop.ultimaFecha ? (
                <Linea tenue>Última firma: {fechaEs(secop.ultimaFecha)}</Linea>
              ) : (
                <Linea tenue>Sin compras de material ortopédico ni de neurocirugía en el periodo</Linea>
              )}
            </>
          )}
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Visitas · últimos 3 meses con datos"
        valor={visitas ? numeroEs(visitas.total) : null}
        fuente={visitas ? `Histórico de VMO · ${rangoMesesEs(visitas.desde, visitas.hasta)}` : 'Histórico de VMO'}
        ancho
      >
        {visitas && (
          <>
            <Linea>
              Efectivas {numeroEs(visitas.efectivas)} · No efectivas {numeroEs(visitas.noEfectivas)}
              {visitas.otras > 0 ? ` · Otras ${numeroEs(visitas.otras)}` : ''}
            </Linea>
            <Linea>
              Presenciales {numeroEs(visitas.presenciales)} · Virtuales {numeroEs(visitas.virtuales)} · {numeroEs(visitas.ipsVisitadas)} IPS visitadas
            </Linea>
            <Linea tenue>
              {visitas.ultimaVisita ? `Última visita registrada en la zona: ${fechaEs(visitas.ultimaVisita)}` : 'Sin visitas registradas en VMO para esta zona'}
            </Linea>
          </>
        )}
      </Tarjeta>
    </div>
  )
}

export function Tarjeta({
  titulo,
  valor,
  fuente,
  children,
  ancho = false,
}: {
  titulo: string
  /** null = sin datos */
  valor: string | null
  fuente: string
  children?: ReactNode
  ancho?: boolean
}) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-4 min-w-0 flex flex-col ${ancho ? 'sm:col-span-2' : ''}`}>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{titulo}</h4>
      {valor === null ? (
        <p className="mt-1 text-lg font-semibold text-gray-400">Sin datos</p>
      ) : (
        <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums break-words">{valor}</p>
      )}
      <div className="mt-1 space-y-0.5 flex-1">{children}</div>
      <p className="mt-3 text-xs text-gray-400 break-words">Fuente: {fuente}</p>
    </section>
  )
}

export function Linea({ children, tenue = false }: { children: ReactNode; tenue?: boolean }) {
  return <p className={`text-sm break-words ${tenue ? 'text-gray-500' : 'text-gray-700'}`}>{children}</p>
}

// ---------------------------------------------------------------------------
// Quién cubre la zona en cada línea
// ---------------------------------------------------------------------------

export function CoberturaBase({ filas, zona }: { filas: CoberturaZonaLinea[]; zona: string }) {
  return (
    <section className="min-w-0">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quién cubre {zona} en cada línea</h4>
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
        {filas.map(fila => (
          <li key={fila.line.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 min-w-0">
            <span className="text-sm font-medium text-gray-900 min-w-0 break-words">{fila.line.name}</span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-gray-700 min-w-0">
              {fila.kind ? (
                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${KIND_BADGE[fila.kind]}`}>{KIND_LABELS[fila.kind]}</span>
              ) : (
                <span className="text-xs text-gray-400">Sin cálculo</span>
              )}
              {fila.executive ? (
                <span className="break-words">
                  {fila.executive.full_name}
                  {fila.kind === 'reach' && fila.travel_minutes !== null ? ` · ${formatMinutes(fila.travel_minutes)}` : ''}
                </span>
              ) : fila.kind === 'vacant' ? (
                <span className="text-gray-500 break-words">
                  Nadie la cubre{fila.nearest ? ` · más cercana: ${fila.nearest.full_name} a ${formatMinutes(fila.nearest.minutes)}` : ''}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Notas del cálculo
// ---------------------------------------------------------------------------

export function NotasCalculo({ notas }: { notas: string[] }) {
  return (
    <details className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
      <summary className="cursor-pointer font-medium text-gray-800">¿Cómo se calcula?</summary>
      <ul className="mt-3 space-y-2 list-disc pl-5">
        {notas.map(nota => (
          <li key={nota}>{nota}</li>
        ))}
      </ul>
    </details>
  )
}
