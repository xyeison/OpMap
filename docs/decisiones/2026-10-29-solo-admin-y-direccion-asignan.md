# 2026-10-29 – Solo el administrador y la dirección comercial asignan; líderes y Ejecutivos Comerciales consultan

**Contexto**: el 2026-10-29 el dueño pidió cuatro perfiles: administrador, director comercial, líder de negocio y
ejecutivo comercial. Dijo: "revisar que los perfiles más bajos no pueden estar editando ni modificando cosas. O sea,
son de consulta nada más… porque después pueden estar dañando las cosas… si cuando queremos asignar a un ejecutivo
comercial a una línea, eso tiene que pasar por el administrador o por el director comercial, que en este caso el
director comercial es Laura Beltrán".

**Decisión**:
1. Asignar Ejecutivos Comerciales a líneas y Zonas (dar o quitar una línea, ajustes de cobertura), editar líneas,
   guardar anexos de territorio y asignar visitantes a médicos lo hacen solo el administrador y la dirección comercial.
2. La líder de negocio (`line_leader`) queda de consulta. Ve su línea en Zonas, el mapa, Líneas y Ejecutivos, pero no
   asigna ni edita.
   - Conserva `terceros:create` y `visits:report`, porque si también es Ejecutiva Comercial (como Yineth) reporta
     visitas en la app y ahí registra el médico, la cuenta o la sede que falte.
3. El Ejecutivo Comercial (`sales_manager`) sigue de consulta, como antes. Conserva lo que usa la app de visita.
4. Los perfiles se llaman "Administrador", "Director comercial", "Líder de negocio" y "Ejecutivo comercial". Contratos,
   Datos, Visualizador y Recursos humanos no cambian.
5. En Ejecutivos Comerciales las acciones son íconos (Editar, Contratar, Traspasar, Dar de baja). Quien no puede editar
   ve un ícono "Ver" que abre la ficha con los campos bloqueados.

**Consecuencias**:
- Reemplaza el punto de `2026-10-23-zonas-por-linea-las-lideres-asignan.md` según el cual cada líder da o quita SU
  línea en Zonas. La pantalla de Zonas sigue igual para la dirección y el administrador. A la líder le muestra lo mismo,
  sin los botones de asignar ni las sugerencias de "dale tu línea a…".
- Las 5 líderes de hoy pierden esas acciones. No cambia ningún dato: cambian los permisos del rol, en el código.
- Hay una consecuencia de la sección Médicos en "Próximamente" que sigue pendiente: asignar visitantes a médicos queda
  sin pantalla hasta que vuelva Médicos.

**Dónde vive en el código**:
- `web/lib/permissions.ts`: `line_leader` sin `lines:edit`, `executives:lines`, `coverage:edit`, `territory:snapshot` ni
  `visitantes:manage`; además, los títulos de los roles.
- Las rutas ya exigían esos permisos: `/api/executives/[id]/lineas/[lineId]`, `/api/coverage/**`,
  `/api/business-lines/**` y `/api/terceros/medicos/[id]/visitantes/**`.
- `web/app/executives/page.tsx` (íconos y "Ver") y `ExecutiveModal.tsx` (`soloLectura`).
- Pruebas:
  - `scripts/lineas-api-check.ts`: la líder recibe 403 también en su línea; asigna la dirección.
  - `scripts/zonas-api-check.ts`: acceso de la líder sin asignar.
  - `scripts/terceros-api-check.ts` y `scripts/terceros-check.ts`: visitantes.
  - `scripts/traspaso-*-check.ts`: títulos.
