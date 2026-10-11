// Fecha de hoy en Colombia ('YYYY-MM-DD'): las ventanas de 24 meses terminan en el mes actual de Bogotá,
// no en el de UTC (a las 7 p. m. del último día del mes ya sería el mes siguiente).
export function hoyBogota(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}
