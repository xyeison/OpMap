# Spec: cuatro perfiles, líderes de consulta e íconos en Ejecutivos Comerciales  (2026-10-29)

**Estado**: pedido del dueño del 2026-10-29. Decisión: `docs/decisiones/2026-10-29-solo-admin-y-direccion-asignan.md`.

## Problema
Hoy las líderes de negocio dan o quitan su línea en Zonas, editan su línea, la cobertura, los anexos y los visitantes.
El dueño quiere que eso pase solo por el administrador o la dirección comercial: "los perfiles más bajos… son de
consulta nada más". En Ejecutivos Comerciales las acciones son botones de texto, y quien solo consulta no tiene cómo
ver la ficha.

## Resultado esperado
- Perfiles visibles: Administrador, Director comercial, Líder de negocio y Ejecutivo comercial. Los demás (Contratos,
  Datos, Visualizador, Recursos humanos) siguen igual.
- **Líder de negocio, solo consulta**:
  - Ve su línea en Zonas, el mapa, Líneas, Ejecutivos e Inteligencia.
  - No asigna líneas ni ajusta cobertura.
  - No edita líneas, no guarda anexos y no asigna visitantes.
  - Sigue reportando visitas en la app y registrando lo que falte (médico, cuenta o sede) si también es Ejecutiva
    Comercial.
- **Administrador y Director comercial**: siguen haciendo todo lo de hoy, y son los únicos que asignan.
- **Ejecutivos Comerciales** (`/executives`):
  - Las acciones son íconos: Editar, Contratar (vacantes), Traspasar y Dar de baja.
  - En la tabla se ve solo el ícono, con su nombre al pasar el cursor y para lectores de pantalla. En las tarjetas del
    celular, ícono y nombre.
  - Quien no puede editar ve "Ver": la ficha con todos los campos bloqueados y solo "Cerrar".

## Criterios de aceptación (pruebas)
- [ ] `executives:lines` solo lo tienen admin y commercial_director; la líder recibe 403 al dar o quitar cualquier
      línea, también la suya (`scripts/lineas-api-check.ts`).
- [ ] En Zonas, la líder ve su línea con `acceso.asignar = false` y `ajustar = false` (`scripts/zonas-api-check.ts`).
- [ ] La líder no asigna ni termina visitantes; la dirección sí (`scripts/terceros-api-check.ts`).
- [ ] Los títulos de los roles son los nuevos (`scripts/traspaso-check.ts`, `traspaso-api-check.ts`).

## Fuera de alcance
- Varias Zonas por persona y líneas por Zona (Linda Ossa): va en otra spec.
- Multiempresa (Medix).
- Cambiar el rol de algún usuario: los roles de cada persona no se tocan.

## Impacto
- Datos / migración: no. Costo Google Maps: 0. Estética del mapa: no cambia.
- Permisos: `line_leader` pierde `lines:edit`, `executives:lines`, `coverage:edit`, `territory:snapshot` y
  `visitantes:manage`. Las 5 líderes de hoy quedan de consulta.

## Plan (archivos)
- `web/lib/permissions.ts` (rol `line_leader` y títulos).
- `web/app/executives/page.tsx` (íconos y "Ver") y `ExecutiveModal.tsx` (`soloLectura`).
- Comentarios de las rutas que mencionaban que la líder asigna.
- Pruebas: las cinco de los criterios.

## Verificación final
`npm run check`. Preview de `/executives` con los íconos. El modo "Ver" se prueba con un usuario sin `executives:edit`.
