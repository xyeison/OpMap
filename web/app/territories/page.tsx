'use client'

// Municipios como página propia (mismo permiso de siempre: la API /api/territories exige territories:view).
// En el menú ya no sale: se entra desde Configuración → Municipios (components/territories/MunicipiosLista.tsx).
import MunicipiosLista from '@/components/territories/MunicipiosLista'

export default function TerritoriesPage() {
  return <MunicipiosLista />
}
