// Presentación: los nombres de zona se muestran sin el prefijo "KAM ".
export const zoneDisplayName = (name?: string | null) => (name ?? '').replace(/^\s*KAM\s+/i, '').trim()

// Zonas de Bogotá por sector (2026-10-28: "Bogotá Norte", "Bogotá Occidente", "Bogotá Sur", "Bogotá Oriente"): su
// insignia lleva el sector y no la localidad de su punto base (la del Norte vive en Chapinero, del sector Oriente)
const SECTOR_INITIALS: Record<string, string> = { norte: 'N', occidente: 'Oc', sur: 'S', oriente: 'Or' }

/** Iniciales del sector si la zona se llama "Bogotá <sector>"; null si no. */
export function bogotaSectorInitials(zoneName?: string | null): string | null {
  const match = /^\s*bogot[aá]\s+(norte|occidente|sur|oriente)\s*$/i.exec(zoneName ?? '')
  return match ? SECTOR_INITIALS[match[1].toLowerCase()] : null
}
