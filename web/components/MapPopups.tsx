'use client'

import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { Popup } from 'react-leaflet'
import type L from 'leaflet'
import type { LatLngTuple, PointTuple } from 'leaflet'

// Tarjetas (popups) del mapa: IPS, IPS sin zona, zona, racimo de zonas y territorio. Contenido React (sin HTML crudo,
// así que no hace falta escapar) con los estilos .opmap-popup de globals.css.

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
const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('es-CO')}`

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
  contractValue: number | null
  actions: PopupAction[]
}

export function IpsPopupCard({ data }: { data: IpsPopupData }) {
  return (
    <div className="opmap-popup__card">
      <div className="opmap-popup__title">{data.name}</div>
      <div className="opmap-popup__subtitle">{data.location}</div>
      <div className="opmap-popup__meta">{data.meta}</div>
      <dl className="opmap-popup__rows">
        <PopupRow label="Zona" stacked>{data.zone}</PopupRow>
        <PopupRow label={data.executiveLabel} stacked>{data.executiveText}</PopupRow>
        {data.travelTime && <PopupRow label="Tiempo de llegada">{data.travelTime}</PopupRow>}
        {data.contractValue ? <PopupRow label="Contratos">{formatMoney(data.contractValue)}</PopupRow> : null}
      </dl>
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
  contractValue: number | null
  // Tiempos reales por carretera desde las zonas más cercanas (ya formateados)
  nearest: { zone: string; time: string; tone: 'ok' | 'near' | 'over' | 'none' }[]
  moreCount: number
  suggestion: string | null
  actions: PopupAction[]
}

export function UnassignedPopupCard({ data }: { data: UnassignedPopupData }) {
  return (
    <div className="opmap-popup__card">
      <div className="opmap-popup__title">{data.name}</div>
      <div className="opmap-popup__subtitle">{data.location}</div>
      <div className="opmap-popup__meta">{data.meta}</div>
      <div className="opmap-popup__status opmap-popup__status--vacant">Sin zona asignada</div>
      {data.contractValue ? (
        <dl className="opmap-popup__rows">
          <PopupRow label="Contratos">{formatMoney(data.contractValue)}</PopupRow>
        </dl>
      ) : null}
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

// "Nombre (zona 2 de 4) — local": el ordinal va justo después del nombre si el texto empieza por él
function ExecutiveWithOrdinal({ text, person, ordinal }: { text: string; person?: string | null; ordinal?: string | null }) {
  if (!ordinal) return <>{text}</>
  const ordinalText = <span className="opmap-popup__secondary"> ({ordinal})</span>
  if (person && text.startsWith(person)) {
    return <>{person}{ordinalText}{text.slice(person.length)}</>
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
      contracts: { count: number; value: number; providers: string[]; moreProviders: number } | null
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
    }

const bedsTone = (value: number) => (value < 1.5 ? 'low' : value < 2.5 ? 'mid' : 'ok')

export function TerritoryPopupCard({ info }: { info: TerritoryInfo }) {
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

      {info.contracts && (
        <div className="opmap-popup__section">
          <div className="opmap-popup__section-title">Contratos activos</div>
          <dl className="opmap-popup__rows opmap-popup__rows--tight">
            <PopupRow label="Contratos">{formatInt(info.contracts.count)}</PopupRow>
            <PopupRow label="Valor total">${(info.contracts.value / 1000000).toFixed(1)}M</PopupRow>
          </dl>
          {info.contracts.providers.length > 0 && (
            <div className="opmap-popup__note">
              Proveedores: {info.contracts.providers.join(', ')}
              {info.contracts.moreProviders > 0 ? ` (+${info.contracts.moreProviders} más)` : ''}
            </div>
          )}
        </div>
      )}

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
