// Estimador de distancias para hospitales sin datos en caché

interface Location {
  lat: number
  lng: number
}

export function estimateDistance(origin: Location, dest: Location): number {
  // Calcular distancia usando fórmula de Haversine
  const R = 6371 // Radio de la Tierra en km
  const dLat = (dest.lat - origin.lat) * Math.PI / 180
  const dLon = (dest.lng - origin.lng) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c // Distancia en km
}

export function estimateTravelTime(origin: Location, dest: Location): number {
  const distance = estimateDistance(origin, dest)
  
  // Factor de ajuste para carreteras colombianas
  const terrainFactor = 1.5
  const adjustedDistance = distance * terrainFactor
  
  // Velocidad promedio según distancia
  let avgSpeed: number
  if (adjustedDistance < 50) {
    avgSpeed = 60 // km/h en distancias cortas
  } else if (adjustedDistance < 200) {
    avgSpeed = 50 // km/h en distancias medias
  } else {
    avgSpeed = 40 // km/h en distancias largas
  }
  
  return Math.round((adjustedDistance / avgSpeed) * 60) // minutos
}

// Información adicional para zonas remotas conocidas
export const remoteZonesInfo: Record<string, string> = {
  'Leticia': 'Zona amazónica - Requiere transporte aéreo',
  'San Andrés': 'Territorio insular - Solo acceso aéreo/marítimo',
  'Mitú': 'Zona selvática - Acceso muy limitado',
  'Inírida': 'Zona fronteriza amazónica - Difícil acceso',
  'Puerto Carreño': 'Frontera con Venezuela - Acceso fluvial/aéreo',
  'Arauca': 'Zona fronteriza - Condiciones de seguridad especiales',
  'Tumaco': 'Costa Pacífica - Acceso por carretera limitado',
  'Quibdó': 'Zona selvática del Chocó - Carreteras en mal estado',
  'Mocoa': 'Piedemonte amazónico - Carreteras con derrumbes frecuentes',
  'Puerto Asís': 'Frontera amazónica - Acceso limitado'
}

export function getZoneInfo(municipalityName: string): string | null {
  for (const [zone, info] of Object.entries(remoteZonesInfo)) {
    if (municipalityName?.toLowerCase().includes(zone.toLowerCase())) {
      return info
    }
  }
  return null
}