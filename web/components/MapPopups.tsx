'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Popup } from 'react-leaflet'
import type L from 'leaflet'
import type { LatLngTuple, PointTuple } from 'leaflet'
import { formatCopCompact } from '@/lib/giros-format'
import { fechaEs, numeroEs } from '@/lib/zona-estadisticas'
import { lineaLabel } from '@/lib/compras-publicas'
import { MAPA_DETALLE_TEXTOS, notaEstadoCompras, notaParteSede } from '@/lib/mapa-detalle'
import type { ComprasDetalle, GirosDetalle, IpsDetalle, TerritorioDetalle } from '@/lib/types/mapa-detalle'

// Tarjetas (popups) del mapa: IPS, IPS sin zona, zona, racimo de zonas y territorio. Contenido React (sin HTML crudo,
// así que no hace falta escapar) con los estilos .opmap-popup de globals.css.
//
// Desde el 2026-10-24 (spec docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md) las tarjetas de IPS y de territorio
// muestran los giros ADRES y las compras públicas SECOP de 12 meses (GirosComprasSection) en lugar de los contratos
// cargados a mano, que ya no viajan en /api/map/data. Los datos se piden al abrir la tarjeta (MapComponent) y llegan ya
// contados por el servidor (lib/mapa-detalle.ts): aquí solo se pintan. Nunca nombres de personas naturales ni médicos.

// Ancho máximo: hasta el 92 % de la pantalla en móvil, 340 px en escritorio
export function popupMaxWidth(): number {
  if (typeof window === 'undefined') return 320
  return Math.max(220, Math.min(340, Math.floor(window.innerWidth * 0.92) - 2))
}

interface MapPopupProps {
  // Identifica esta apertura: al cerrarse solo limpia el estado si sigue siendo la tarjeta vigente
  nonce: number
  position: LatLngTuple
  offset?: PointTuple
  // Espacio libre abajo al centrar la tarjeta (en móvil, la hoja inferior)
  bottomPadding: number
  onClose: (nonce: number) => void
  children: ReactNode
}

export function MapPopup({ nonce, position, offset, bottomPadding, onClose, children }: MapPopupProps) {
  const eventHandlers = useMemo(() => ({
    // Leaflet etiqueta la X en inglés ("Close popup")
    add: (e: { target: L.Popup }) => {
      e.target.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Cerrar tarjeta')
    },
    remove: () => onClose(nonce)
  }), [nonce, onClose])
  return (
    <Popup
      position={position}
      offset={offset ?? [0, 7]}
      maxWidth={popupMaxWidth()}
      minWidth={200}
      className="opmap-popup"
      autoPanPaddingTopLeft={[12, 12]}
      autoPanPaddingBottomRight={[12, bottomPadding]}
      eventHandlers={eventHandlers}
    >
      {children}
    </Popup>
  )
}

// ---------- Piezas comunes ----------

export interface PopupAction {
  label: string
  href: string
  variant?: 'primary' | 'secondary'
}

function PopupActions({ actions }: { actions: PopupAction[] }) {
  if (actions.length === 0) return null
  return (
    <div className="opmap-popup__actions">
      {actions.map(action => (
        <Link
          key={action.href + action.label}
          href={action.href}
          prefetch={false}
          className={`opmap-popup__btn${action.variant === 'secondary' ? ' opmap-popup__btn--secondary' : ''}`}
        >
          {action.label}
        </Link>
      ))}
    </div>
  )
}

function PopupRow({ label, children, stacked = false }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={`opmap-popup__row${stacked ? ' opmap-popup__row--stacked' : ''}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function ColorDot({ color, hollow = false }: { color: string; hollow?: boolean }) {
  return (
    <span
      className="opmap-popup__dot"
      style={hollow ? { backgroundColor: '#ffffff', borderColor: color } : { backgroundColor: color, borderColor: '#ffffff' }}
      aria-hidden="true"
    />
  )
}

const formatInt = (value: number) => Number(value || 0).toLocaleString('es-CO')

// ---------- Giros ADRES y compras públicas SECOP de 12 meses ----------

/** Estado de la carga perezosa: sin `intelligence:view` no hay llamada ni sección (sin_acceso). */
export type DetalleEstado = 'cargando' | 'error' | 'listo' | 'sin_acceso'

export interface GirosComprasProps {
  estado: DetalleEstado
  // TerritorioDetalle (municipio o localidad) o IpsDetalle (una sede), según `modo`
  data: TerritorioDetalle | IpsDetalle | null
  error: string | null
  onRetry: () => void
  modo: 'territorio' | 'ips'
}

// Proveedores visibles antes de "Ver los N proveedores" (el resto se despliega dentro de la tarjeta)
const PROVEEDORES_VISIBLES = 5

// Botón que parece texto (sin estilo nuevo en globals.css): "Reintentar", "Ver los N proveedores"
function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="underline font-medium" onClick={onClick}>
      {children}
    </button>
  )
}

const contratosText = (n: number) => `${numeroEs(n)} ${n === 1 ? 'contrato' : 'contratos'}`

function GirosRows({ giros, modo }: { giros: GirosDetalle; modo: 'territorio' | 'ips' }) {
  if (giros.total <= 0) {
    return <div className="opmap-popup__note">Sin giros ADRES registrados en {giros.ventana.texto}</div>
  }
  return (
    <dl className="opmap-popup__rows opmap-popup__rows--tight">
      <PopupRow label="Total">{formatCopCompact(giros.total)}</PopupRow>
      <PopupRow label="Contributivo">{formatCopCompact(giros.contributivo)}</PopupRow>
      <PopupRow label="Subsidiado">{formatCopCompact(giros.subsidiado)}</PopupRow>
      <PopupRow label="Otro (recobros, SOAT…)">{formatCopCompact(giros.otro)}</PopupRow>
      {/* El tipo cuenta NIT (la ADRES gira al NIT), no IPS; en una sede sería siempre "1 de 1" */}
      {modo === 'territorio' && (
        <PopupRow label="NIT con giro">{numeroEs(giros.nitsConGiro)} de {numeroEs(giros.nits)}</PopupRow>
      )}
      {giros.ultimaFecha && <PopupRow label="Último giro">{fechaEs(giros.ultimaFecha)}</PopupRow>}
    </dl>
  )
}

function ProveedoresList({ compras }: { compras: ComprasDetalle }) {
  const [todos, setTodos] = useState(false)
  const total = compras.proveedores.length
  const visibles = todos ? compras.proveedores : compras.proveedores.slice(0, PROVEEDORES_VISIBLES)
  return (
    <>
      <dl className="opmap-popup__rows opmap-popup__rows--tight">
        {visibles.map(prov => (
          <PopupRow key={`${prov.nit}|${prov.nombre}`} label={prov.vigilado ? `${prov.nombre} · Vigilado` : prov.nombre} stacked>
            {formatCopCompact(prov.valor)} · {contratosText(prov.contratos)}
            {prov.ultimaFecha ? ` · último ${fechaEs(prov.ultimaFecha)}` : ''}
            {(prov.nit || prov.lineas.length > 0) && (
              <span className="opmap-popup__secondary">
                <br />
                {/* NIT vacío: SECOP no trajo el documento de la empresa */}
                {[prov.nit ? `NIT ${prov.nit}` : null, prov.lineas.map(lineaLabel).join(', ') || null].filter(Boolean).join(' · ')}
              </span>
            )}
          </PopupRow>
        ))}
      </dl>
      {total > PROVEEDORES_VISIBLES && (
        <div className="opmap-popup__note">
          <TextButton onClick={() => setTodos(value => !value)}>
            {todos ? 'Ver menos' : `Ver los ${numeroEs(total)} proveedores`}
          </TextButton>
        </div>
      )}
    </>
  )
}

function ComprasRows({ compras, modo }: { compras: ComprasDetalle; modo: 'territorio' | 'ips' }) {
  // Aparte y en una línea: lo que no suma al valor (y los estimados, que sí suman pero se avisan)
  const aparte: string[] = []
  if (compras.sinClasificar.contratos > 0) {
    aparte.push(`${MAPA_DETALLE_TEXTOS.sinClasificar}: ${contratosText(compras.sinClasificar.contratos)} · ${formatCopCompact(compras.sinClasificar.valor)}`)
  }
  if (compras.especialistas.contratos > 0) {
    aparte.push(`${MAPA_DETALLE_TEXTOS.especialistas}: ${contratosText(compras.especialistas.contratos)}`)
  }
  if (compras.personasNaturales.contratos > 0) {
    aparte.push(`${MAPA_DETALLE_TEXTOS.personasNaturales}: ${contratosText(compras.personasNaturales.contratos)}`)
  }
  if (compras.estimados.contratos > 0) {
    aparte.push(`${MAPA_DETALLE_TEXTOS.estimados}: ${contratosText(compras.estimados.contratos)} · ${formatCopCompact(compras.estimados.valor)}`)
  }
  return (
    <>
      {compras.contratos > 0 ? (
        <dl className="opmap-popup__rows opmap-popup__rows--tight">
          <PopupRow label="Valor adjudicado">{formatCopCompact(compras.valor)}</PopupRow>
          <PopupRow label="Contratos">{numeroEs(compras.contratos)}</PopupRow>
          {/* En una sede la entidad es siempre una */}
          {modo === 'territorio' && <PopupRow label="Entidades">{numeroEs(compras.entidades)}</PopupRow>}
        </dl>
      ) : (
        <div className="opmap-popup__note">{MAPA_DETALLE_TEXTOS.sinContratos12m}</div>
      )}
      {compras.proveedores.length > 0 && <ProveedoresList compras={compras} />}
      {aparte.map(linea => (
        <div key={linea} className="opmap-popup__note">{linea}</div>
      ))}
    </>
  )
}

/**
 * Sección "Giros ADRES" + "Compras públicas de material ortopédico y neurocirugía (SECOP)" de las tarjetas de IPS y
 * territorio (spec E1/E2). Las notas que esta sección ya pinta en su sitio (estado de compras, parte por camas, parte
 * de la sede, pie de fuentes) se quitan de `data.notas` para no repetirlas; las demás van al final.
 */
export function GirosComprasSection({ estado, data, error, onRetry, modo }: GirosComprasProps) {
  if (estado === 'sin_acceso') return null
  if (estado === 'cargando') {
    return (
      <div className="opmap-popup__section">
        <div className="opmap-popup__note" role="status">Cargando giros y compras…</div>
      </div>
    )
  }
  if (estado === 'error' || !data) {
    return (
      <div className="opmap-popup__section">
        <div className="opmap-popup__note opmap-popup__note--warn" role="alert" title={error ?? undefined}>
          No se pudieron cargar · <TextButton onClick={onRetry}>Reintentar</TextButton>
        </div>
      </div>
    )
  }

  const { giros, compras, comprasEstado } = data
  const hospital = modo === 'ips' && 'hospital' in data ? data.hospital : null
  const notaSede = hospital ? notaParteSede(hospital.nit, hospital.sedesNit) : null
  const notaCamas = giros?.estimadoPorCamas ? MAPA_DETALLE_TEXTOS.estimadoPorCamas : null
  const notaCompras = notaEstadoCompras(comprasEstado)
  const propias = new Set<string>([notaSede, notaCamas, notaCompras, MAPA_DETALLE_TEXTOS.fuentes].filter((n): n is string => !!n))
  const otrasNotas = (data.notas || []).filter(nota => !propias.has(nota))

  // Nada que pintar en cifras: territorio sin IPS activas (el servidor manda giros = null, compras = null y solo la nota
  // sinIps) o, sin giros cargados aún, una IPS privada o un municipio sin entidad pública (nota de estado + fuentes).
  // Van las notas del servidor tal cual (aquí nada las repite); sinIps solo si no llegó ninguna.
  if (!giros && !compras) {
    const notasServidor = data.notas || []
    return (
      <div className="opmap-popup__section">
        {(notasServidor.length > 0 ? notasServidor : [MAPA_DETALLE_TEXTOS.sinIps]).map(nota => (
          <div key={nota} className="opmap-popup__note">{nota}</div>
        ))}
      </div>
    )
  }

  const rangos = [giros ? `giros ${giros.ventana.texto}` : null, compras ? `SECOP ${compras.ventana.texto}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      {giros && (
        <div className="opmap-popup__section">
          <div className="opmap-popup__section-title">{MAPA_DETALLE_TEXTOS.tituloGiros} · {giros.ventana.texto}</div>
          <GirosRows giros={giros} modo={modo} />
          {notaCamas && <div className="opmap-popup__note">{notaCamas}</div>}
          {notaSede && <div className="opmap-popup__note">{notaSede}</div>}
        </div>
      )}

      <div className="opmap-popup__section">
        <div className="opmap-popup__section-title">
          {MAPA_DETALLE_TEXTOS.tituloCompras}{compras ? ` · ${compras.ventana.texto}` : ''}
        </div>
        {comprasEstado === 'con_datos' && compras ? (
          <ComprasRows compras={compras} modo={modo} />
        ) : (
          <div className="opmap-popup__note">{notaCompras ?? MAPA_DETALLE_TEXTOS.sinContratos12m}</div>
        )}
        {compras?.actualizado && (
          <div className="opmap-popup__note">SECOP actualizado el {fechaEs(compras.actualizado)}</div>
        )}
      </div>

      {otrasNotas.map(nota => (
        <div key={nota} className="opmap-popup__note">{nota}</div>
      ))}
      <div className="opmap-popup__note">
        {MAPA_DETALLE_TEXTOS.fuentes}{rangos ? `. Rango: ${rangos}.` : '.'}
      </div>
    </>
  )
}

// ---------- IPS asignada ----------

export interface IpsPopupData {
  name: string
  location: string
  // "120 camas · Nivel 3 · Pública"
  meta: string
  zone: string
  executiveLabel: string
  executiveText: string
  noEquipment: boolean
  travelTime: string | null
  actions: PopupAction[]
}

// `detalle`: giros ADRES y compras SECOP de la sede (debajo de "Tiempo de llegada"); null = sin sección
export function IpsPopupCard({ data, detalle }: { data: IpsPopupData; detalle: GirosComprasProps | null }) {
  return (
    <div className="opmap-popup__card">
      <div className="opmap-popup__title">{data.name}</div>
      <div className="opmap-popup__subtitle">{data.location}</div>
      <div className="opmap-popup__meta">{data.meta}</div>
      <dl className="opmap-popup__rows">
        <PopupRow label="Zona" stacked>{data.zone}</PopupRow>
        <PopupRow label={data.executiveLabel} stacked>{data.executiveText}</PopupRow>
        {data.travelTime && <PopupRow label="Tiempo de llegada">{data.travelTime}</PopupRow>}
      </dl>
      {detalle && <GirosComprasSection {...detalle} />}
      {data.noEquipment && <div className="opmap-popup__note opmap-popup__note--warn">Sin equipo de la línea en esta zona</div>}
      <PopupActions actions={data.actions} />
    </div>
  )
}

// ---------- IPS sin zona asignada ----------

export interface UnassignedPopupData {
  name: string
  location: string
  meta: string
  // Tiempos reales por carretera desde las zonas más cercanas (ya formateados)
  nearest: { zone: string; time: string; tone: 'ok' | 'near' | 'over' | 'none' }[]
  moreCount: number
  suggestion: string | null
  actions: PopupAction[]
}

// `detalle`: giros ADRES y compras SECOP de la sede (debajo de los tiempos); null = sin sección
export function UnassignedPopupCard({ data, detalle }: { data: UnassignedPopupData; detalle: GirosComprasProps | null }) {
  return (
    <div className="opmap-popup__card">
      <div className="opmap-popup__title">{data.name}</div>
      <div className="opmap-popup__subtitle">{data.location}</div>
      <div className="opmap-popup__meta">{data.meta}</div>
      <div className="opmap-popup__status opmap-popup__status--vacant">Sin zona asignada</div>
      <div className="opmap-popup__section">
        <div className="opmap-popup__section-title">Tiempo desde cada zona</div>
        {data.nearest.length > 0 ? (
          <>
            <dl className="opmap-popup__rows opmap-popup__rows--tight">
              {data.nearest.map((item, index) => (
                <PopupRow key={`${item.zone}-${index}`} label={item.zone}>
                  <span className={`opmap-popup__time opmap-popup__time--${item.tone}`}>{item.time}</span>
                </PopupRow>
              ))}
            </dl>
            <div className="opmap-popup__note">
              {data.moreCount > 0 ? `y ${data.moreCount} zonas más · ` : ''}Tiempos reales de Google Maps
            </div>
          </>
        ) : (
          <div className="opmap-popup__note">
            No hay tiempos de viaje calculados para esta IPS. Ejecute un recálculo completo para incluirla en el análisis.
          </div>
        )}
        {data.suggestion && <div className="opmap-popup__note opmap-popup__note--warn">{data.suggestion}</div>}
      </div>
      {detalle && <GirosComprasSection {...detalle} />}
      <PopupActions actions={data.actions} />
    </div>
  )
}

// ---------- Zona (pin de la ciudad base) ----------

export interface ZonePopupData {
  name: string
  baseCity: string | null
  color: string
  hollow: boolean
  executiveLabel: string
  executiveText: string
  // Ejecutivo Comercial con varias zonas en la línea: su nombre (tal como empieza executiveText) y
  // "zona 2 de 4", que se muestra junto al nombre en texto secundario
  executivePerson?: string | null
  executiveOrdinal?: string | null
  noEquipment: boolean
  ipsCount: number
  beds: number
  municipalitiesWithIps: number
  municipalitiesReach: number
  population: number
  actions: PopupAction[]
}

// "La atiende Nombre (zona 2 de 4), que vive en la Zona": el ordinal va justo después del nombre, donde aparezca en el texto
function ExecutiveWithOrdinal({ text, person, ordinal }: { text: string; person?: string | null; ordinal?: string | null }) {
  if (!ordinal) return <>{text}</>
  const ordinalText = <span className="opmap-popup__secondary"> ({ordinal})</span>
  const at = person ? text.indexOf(person) : -1
  if (person && at >= 0) {
    const fin = at + person.length
    return <>{text.slice(0, fin)}{ordinalText}{text.slice(fin)}</>
  }
  return <>{text}{ordinalText}</>
}

export function ZonePopupCard({ data }: { data: ZonePopupData }) {
  return (
    <div className="opmap-popup__card">
      <div className="opmap-popup__title opmap-popup__title--with-dot">
        <ColorDot color={data.color} hollow={data.hollow} />
        <span>Zona {data.name}</span>
      </div>
      {data.baseCity && <div className="opmap-popup__subtitle">Ciudad base: {data.baseCity}</div>}
      <dl className="opmap-popup__rows">
        <PopupRow label={data.executiveLabel} stacked>
          <ExecutiveWithOrdinal text={data.executiveText} person={data.executivePerson} ordinal={data.executiveOrdinal} />
        </PopupRow>
        <PopupRow label="IPS">{formatInt(data.ipsCount)}</PopupRow>
        <PopupRow label="Camas">{formatInt(data.beds)}</PopupRow>
        <PopupRow label="Municipios">
          {formatInt(data.municipalitiesWithIps)} con IPS · {formatInt(data.municipalitiesReach)} de alcance
        </PopupRow>
        {data.population > 0 && <PopupRow label="Población">{formatInt(data.population)}</PopupRow>}
      </dl>
      {data.noEquipment && <div className="opmap-popup__note opmap-popup__note--warn">Sin equipo: la línea no opera en esta zona</div>}
      <PopupActions actions={data.actions} />
    </div>
  )
}

// ---------- Racimo que no se separa al acercar (misma ubicación o zoom máximo) ----------

export interface ClusterPopupData {
  items: {
    id: string
    name: string
    meta: string | null
    color: string
    hollow: boolean
    onSelect: () => void
  }[]
}

export function ClusterPopupCard({ data }: { data: ClusterPopupData }) {
  return (
    <div className="opmap-popup__card">
      <div className="opmap-popup__title">{data.items.length} zonas en este punto</div>
      <div className="opmap-popup__subtitle">Elige una zona para ver su tarjeta</div>
      <ul className="opmap-popup__zone-list">
        {data.items.map(item => (
          <li key={item.id}>
            <button type="button" className="opmap-popup__zone-btn" onClick={item.onSelect}>
              <ColorDot color={item.color} hollow={item.hollow} />
              <span className="opmap-popup__zone-text">
                <span className="opmap-popup__zone-name">Zona {item.name}</span>
                {item.meta && <span className="opmap-popup__zone-meta">{item.meta}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Territorio (municipio o localidad) ----------

export interface TerritoryStatus {
  tone: 'zone' | 'vacant' | 'conflict'
  title: string
  lines: string[]
}

export type TerritoryInfo =
  | {
      kind: 'ips'
      name: string
      deptName: string | null
      stats: { hospitals: number; beds: number; ambulances: number; surgeries: number }
      population: number
      bedsPer1000: number | null
      status: TerritoryStatus
    }
  | {
      kind: 'other'
      name: string
      deptName: string | null
      title: string
      detail: string | null
      coverage: { label: string; text: string } | null
      population: number
      // Municipio de alcance sin IPS: giros y compras se cuentan donde está la IPS, así que no se pide nada; una sola
      // línea para quien tiene intelligence:view (null para quien no la vería)
      sinIpsNota: string | null
    }

const bedsTone = (value: number) => (value < 1.5 ? 'low' : value < 2.5 ? 'mid' : 'ok')

// `detalle`: giros ADRES y compras SECOP del territorio (entre "Estadísticas hospitalarias" y "Población"); null = sin sección
export function TerritoryPopupCard({ info, detalle }: { info: TerritoryInfo; detalle: GirosComprasProps | null }) {
  if (info.kind === 'other') {
    return (
      <div className="opmap-popup__card">
        <div className="opmap-popup__title">{info.name}</div>
        {info.deptName && <div className="opmap-popup__subtitle">{info.deptName}</div>}
        <div className="opmap-popup__status">{info.title}</div>
        {info.detail && <div className="opmap-popup__note">{info.detail}</div>}
        {info.coverage && (
          <dl className="opmap-popup__rows">
            <PopupRow label={info.coverage.label} stacked>{info.coverage.text}</PopupRow>
          </dl>
        )}
        {info.sinIpsNota && <div className="opmap-popup__note">{info.sinIpsNota}</div>}
        {info.population > 0 && (
          <dl className="opmap-popup__rows">
            <PopupRow label="Población 2025">{formatInt(info.population)}</PopupRow>
          </dl>
        )}
      </div>
    )
  }

  return (
    <div className="opmap-popup__card">
      <div className="opmap-popup__title">{info.name}</div>
      {info.deptName && <div className="opmap-popup__subtitle">{info.deptName}</div>}

      <div className="opmap-popup__section">
        <div className="opmap-popup__section-title">Estadísticas hospitalarias</div>
        <dl className="opmap-popup__stats">
          <PopupRow label="Hospitales">{formatInt(info.stats.hospitals)}</PopupRow>
          <PopupRow label="Camas">{formatInt(info.stats.beds)}</PopupRow>
          <PopupRow label="Ambulancias">{formatInt(info.stats.ambulances)}</PopupRow>
          <PopupRow label="Cirugías">{formatInt(info.stats.surgeries)}</PopupRow>
        </dl>
      </div>

      {detalle && <GirosComprasSection {...detalle} />}

      {info.population > 0 && (
        <dl className="opmap-popup__rows">
          <PopupRow label="Población 2025">{formatInt(info.population)}</PopupRow>
          {info.bedsPer1000 !== null && (
            <PopupRow label="Camas por 1.000 hab.">
              <span className={`opmap-popup__beds opmap-popup__beds--${bedsTone(info.bedsPer1000)}`}>
                {info.bedsPer1000.toFixed(2)}
              </span>
            </PopupRow>
          )}
        </dl>
      )}

      <div className={`opmap-popup__status opmap-popup__status--${info.status.tone}`}>
        <div className="opmap-popup__status-title">{info.status.title}</div>
        {info.status.lines.map(line => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  )
}
