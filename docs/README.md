# Documentación de OpMap

| Archivo | Qué contiene | Cuándo leerlo |
| --- | --- | --- |
| `FLUJO_DE_TRABAJO_IA.md` | Cómo trabajamos con Claude Code: verificación, specs, PR, hooks, CI | Al empezar o al cambiar el flujo |
| `algoritmo-asignacion.md` | Principios, 8 fases, regla de mayoría, departamentos excluidos | Al tocar `lib/opmap-algorithm-*`, `territory-rules.ts` |
| `mapa-estetica.md` | Estilo autorizado del mapa (colores, insignias, filtros, móvil) | Al tocar `MapComponent.tsx`, `mapStyles.ts`, `MapPopups.tsx` |
| `base-de-datos.md` | Tablas, vistas, RLS, índices | Al escribir migraciones o consultas |
| `fases/fase1-…`, `fase2-…`, `fase2b-…` | Modelo zonas/líneas/ejecutivas, cobertura por línea, municipios y anexos | Al tocar `coverage.ts`, `municipality-coverage.ts`, `territory.ts` |
| `fases/fase3-reps-adres.md` | Fase 3 de un vistazo: reglas, migraciones, scripts, procedimiento del REPS, cifras reales, límites, pendiente D4 | Antes de tocar cualquier cosa del REPS o de la ADRES |
| `fases/fase3-reps.md` | Sedes del REPS: modelo, reglas del cruce IPS ↔ sede, scripts de carga y cruce | Al tocar `reps-match.ts`, `reps-link`, `/hospitals/reps` |
| `fases/fase3-servicios-capacidad-reps.md` | Importador del REPS (servicios, capacidad, PDF), filtros de IPS | Al tocar `reps-import*.ts`, `/hospitals/import`, filtros IPS |
| `fases/fase3-adres.md` | Giros ADRES: Reporte 29 e "Identifica tu Giro" (contributivo y subsidiado por giro), scripts de carga, API `/api/intelligence/giros` | Al tocar `adres-*.ts/.mjs`, `/inteligencia` |
| `fases/fase4-poblacion.md` | Población: BDUA, cifras de MinSalud, proyecciones DANE, alias de municipio, API `/api/intelligence/poblacion` e índice potencial | Al tocar `bdua-*`, `minsalud-*`, `poblacion-*`, "Población y cobertura" |
| `ips-pendientes.md` | Cola de IPS pendientes y acción masiva | Al tocar `api/hospitals/*`, `pending-assignment.ts` |
| `arquitectura-y-scripts.md` | Scripts Python, estructura de carpetas, archivos clave | Al usar los scripts Python o buscar un archivo |
| `historico-resultados.md` | Cifras de 2025 y colores originales | Solo como referencia histórica |
| `specs/` | Una spec por cambio mediano/grande (plantilla `TEMPLATE.md`) | Antes de implementar |
| `decisiones/` | Decisiones del dueño que cambian reglas | Al dudar de una regla |
| `archive/` | Notas antiguas de `web/` (2025), sin vigencia | Casi nunca |
