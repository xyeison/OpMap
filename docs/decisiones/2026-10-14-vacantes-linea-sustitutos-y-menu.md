# 2026-10-14 – Vacantes por zona, la línea se llama "Sustitutos óseos" y el menú empieza en el Mapa

**Contexto**: el dueño va a mostrar OpMap a las líderes. Con sus palabras: "Linda todavía no ha entrado, entonces la
podemos poner como vacante… que se llame Vacante Neiva, Vacante Bogotá, Vacante Cúcuta", "la parte de PerOssal no se
llama PerOssal, sino sustitutos óseos" y "deberíamos quitar ese dashboard… el mapa sí debería ser el principal menú".

**Decisión del dueño (2026-10-14)**:
1. **Las zonas sin persona se ven como vacantes**, con nombre "Vacante <ciudad>". Hoy existen Vacante Barranquilla,
   Vacante Bogotá, Vacante Cúcuta y Vacante Neiva.
   - Linda Barrera no alcanzó a empezar. Su fila pasó a Vacante Cúcuta, sin correo ni usuario, y su usuario quedó
     desactivado.
   - No hubo traspaso, porque no tenía médicos, visitas ni configuración.
   - Si entra: reactivar su usuario en Usuarios y luego "Contratar" en la vacante con su correo.
2. **La línea PerOssal se llama "Sustitutos óseos"**. PerOssal es un producto de la línea. El código interno
   `perossal` de `business_lines` no cambia.
3. **Menú:** sin Dashboard, con el inicio en el Mapa, Municipios dentro de Configuración y sin Regiones. Detalle en
   `docs/specs/2026-10-14-menu-web-y-datos-de-zona.md`.

**Consecuencias**:
- La cobertura no se recalculó. Vacante Neiva, con Sustitutos óseos, aparece en la cobertura cuando el dueño corra
  el cálculo de las líneas.
- Las referencias a "PerOssal" como línea en los documentos de fases anteriores son históricas.

**Dónde vive**:
- **Datos:** cambiados en producción el 2026-10-14, en las tablas `executives`, `executive_lines`, `users.active` y
  `business_lines.name`.
- **Menú:** `web/lib/permissions.ts`, con las funciones `getNavigationMenu` y `getHomeRoute`, protegido por
  `web/scripts/menu-check.ts`.
