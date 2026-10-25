// Catálogo del panel "Fuentes de datos" (/inteligencia, solo admin), derivado de las definiciones de la
// carga (lib/fuentes-estado.ts: FUENTES, programación cron y ejecutor). `manual` = la fuente la corre el
// cron de Vercel y por tanto también "Actualizar ahora" (mismo código, 50 s por ronda); la ADRES va por
// GitHub Actions.
import { FUENTES, esFuenteAutomatica, type FuenteDefinicion } from '@/lib/fuentes-estado'
import type { FuenteCatalogo } from '@/lib/compras-publicas'

function frecuencia(def: FuenteDefinicion): string {
  const [, , dom, , dow] = def.programacion.trim().split(/\s+/)
  if (dom === '*' && dow === '*') return 'Diaria'
  if (dom === '*') return 'Semanal'
  return 'Mensual'
}

const COMO: Record<string, string> = {
  secop_ii: 'Vercel Cron → /api/cron/secop_ii (incremental por última actualización, con cursor)',
  secop_i: 'Vercel Cron → /api/cron/secop_i (semanal, martes; incremental, con cursor)',
  secop_integrado: 'Vercel Cron → /api/cron/secop_integrado (incremental, con cursor)',
  secop_procesos:
    'Vercel Cron → /api/cron/secop_procesos (relee lo publicado en los últimos 120 días y actualiza, con cursor; la carga inicial de ' +
    '24 meses va con scripts/secop-procesos-load.ts). Procesos de ortopedia o neurocirugía de las IPS públicas: van aparte y nunca suman a las compras',
  reps_sedes: 'Vercel Cron → /api/cron/reps_sedes',
  bdua: 'Vercel Cron → /api/cron/bdua (SoQL agregado en datos.gov.co)',
  minsalud_cifras: 'Vercel Cron → /api/cron/minsalud_cifras (ZIP del mes si ya está publicado)',
  adres_identifica: 'GitHub Actions (.github/workflows/datos.yml) → scripts/adres-identifica-giro.mjs',
}

export const FUENTES_CATALOGO: readonly FuenteCatalogo[] = FUENTES.map(def => ({
  fuente: def.id,
  nombre: def.nombre,
  frecuencia: frecuencia(def),
  tipo: def.ejecutor === 'github_actions' ? 'pesada' : 'ligera',
  como: COMO[def.id] ?? (def.ejecutor === 'github_actions' ? 'GitHub Actions' : 'Vercel Cron'),
  manual: esFuenteAutomatica(def.id),
}))
