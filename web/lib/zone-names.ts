// Presentación: los nombres de zona se muestran sin el prefijo "KAM ".
export const zoneDisplayName = (name?: string | null) => (name ?? '').replace(/^\s*KAM\s+/i, '').trim()
