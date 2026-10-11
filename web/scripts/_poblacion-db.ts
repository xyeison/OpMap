/**
 * Fase 4 · Población: utilidades de base de datos de los 3 scripts de carga. Desde el PR 7 viven en
 * lib/poblacion-db.ts (las usan también las cargas automáticas del cron); aquí solo se re-exportan para
 * que los scripts sigan igual. No es un script ejecutable.
 */
export * from '../lib/poblacion-db'
