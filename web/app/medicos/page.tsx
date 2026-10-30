import Proximamente from '@/components/Proximamente'

// Médicos (menú Terceros): "Próximamente" mientras se rehace la sección (dueño, 2026-10-29). La tabla medicos, su API
// (/api/terceros/medicos) y la app de visita no cambian.
export default function MedicosPage() {
  return <Proximamente titulo="Médicos" permiso="terceros:view" descripcion="Estamos rehaciendo esta sección." />
}
