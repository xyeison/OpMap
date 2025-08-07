/**
 * Convierte minutos a formato legible de horas y minutos
 */
export function formatTravelTime(minutes: number | null | undefined): string {
  if (!minutes && minutes !== 0) return 'Sin tiempo'
  
  const mins = Math.round(minutes)
  
  if (mins === 0) return 'Territorio base'
  
  if (mins < 60) {
    return `${mins} min`
  }
  
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  
  if (remainingMins === 0) {
    return `${hours}h`
  }
  
  return `${hours}h ${remainingMins}min`
}

/**
 * Convierte segundos a formato legible de horas y minutos
 */
export function formatTravelTimeFromSeconds(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return 'Sin tiempo'
  
  const minutes = Math.round(seconds / 60)
  return formatTravelTime(minutes)
}