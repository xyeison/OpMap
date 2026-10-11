## Qué cambia y por qué

<!-- Una o dos frases. Enlaza la spec (docs/specs/…) o el issue si existe. -->

## Verificación (pegar evidencia, no afirmaciones)

- [ ] `npm run check` en verde (pegar las últimas líneas)
- [ ] Si toca el mapa o la UI: captura de escritorio y de celular desde el preview de la rama
- [ ] Si toca motor de asignación/cobertura: prueba nueva o ajustada en `web/scripts/*-check.ts`

## Impacto fuera del código

- [ ] Migración SQL nueva (`database/migrations/…` + rollback) — **no aplicada**; aplicar junto con el despliegue
- [ ] Gasto en Google Maps: dry-run = ___ elementos ≈ US$ ___ (autorizado por el dueño: sí / no)
- [ ] Cambia la estética del mapa (requiere autorización explícita del dueño)
- [ ] Cambia una regla de negocio (anotada en `docs/decisiones/`)
