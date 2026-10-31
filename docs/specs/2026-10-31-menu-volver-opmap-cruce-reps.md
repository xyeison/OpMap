# Spec: menú con las opciones sueltas primero, volver a OpMap desde Agendamiento y Cruce REPS solo de administración  (2026-10-31)

**Estado**: aprobada por el dueño ("Sí, ok, arranca", 2026-10-31, sobre la propuesta de tres puntos)

## Problema

El dueño, al probar el diseño nuevo (2026-10-31):

- **Agendamiento:** "cuando yo le doy a agendamiento ya pierdo ese menú para poder regresarme a las opciones en donde
  están los terceros, donde están los empleados". Agendamiento abre la app de campo (`/campo/agenda`), una página
  aparte, sin el menú de OpMap ni un camino de vuelta.
- **Orden del menú:** "primero irían [...] los que están sueltos, y después los menús tipo acordeón [...] porque
  pareciera que debajo de empleado está calendario". Hoy Calendario, Zonas y Líneas salen entre el grupo Empleados y el
  grupo Inteligencia de Mercado.
- **IPS:** "hay gestión que hace solamente la parte administrativa y le aparece a un líder. Por ejemplo, cruce de reps".
  "Importar del REPS" ya es solo del administrador y del gestor de datos; "Cruce REPS" lo ve cualquiera que vea las IPS.

## Resultado esperado

1. **Menú:** primero las opciones sueltas que tenga el rol (Agendamiento, Mapa, Calendario, Zonas, Líneas) y después los
   grupos, en este orden: Terceros, Empleados, Inteligencia de Mercado, Configuración. Cada opción sigue saliendo solo
   con su permiso: ningún rol gana ni pierde opciones, solo cambia el orden. La página de inicio no cambia (el Mapa; sin
   mapa, Calendario).
2. **Volver a OpMap:** la app de campo abierta en una pestaña del navegador lleva arriba, en la franja "En línea / Sin
   conexión" que se ve en todas las pantallas, un botón "OpMap". Lleva al inicio de OpMap (el Mapa de la líder) en la
   misma pestaña, con su menú. En la app del teléfono (Expo) y en la app instalada desde el ícono de inicio no aparece:
   ahí es la app. Salir no pierde nada: lo pendiente sigue en el teléfono y se sube como siempre.
3. **Cruce REPS:** el botón, la página `/hospitals/reps` y sus datos (`GET /api/hospitals/reps/summary`) son solo del
   administrador y del gestor de datos, como "Importar del REPS". Los demás no ven el botón; si escriben la dirección, la
   página dice que es de administración, y la API responde 403.

## Criterios de aceptación (se convierten en pruebas)

- [ ] Para todo rol, ninguna opción suelta sale después de un grupo, y los grupos salen en el orden Terceros, Empleados,
      Inteligencia de Mercado, Configuración. Admin: Mapa, Calendario, Zonas, Líneas, Terceros, Empleados, Inteligencia
      de Mercado, Configuración. Líder: Agendamiento primero.
- [ ] Las opciones de cada rol son las mismas de antes (solo cambia el orden) y el inicio sigue siendo el Mapa (recursos
      humanos: Calendario).
- [ ] App de campo: el botón "OpMap" sale solo en una pestaña del navegador (`correInstalada() === false`); en el
      teléfono (`null`) y en la app instalada (`true`), no. Va al inicio de OpMap (`/`) en la misma pestaña.
- [ ] El botón está en la franja de arriba (`components/EstadoCola.tsx`), con el texto "OpMap", la etiqueta accesible
      "Volver a OpMap", los colores del tema y un toque de al menos 44 px de alto por sí mismo (el botón solo sale en
      la web y ahí react-native-web no aplica `hitSlop`), sin que la franja crezca.
- [ ] Permiso nuevo `reps:manage` (REPS: importar y cruce): solo admin y data_manager.
- [ ] En `/hospitals`, "Cruce REPS" e "Importar del REPS" salen solo con `reps:manage`; `/hospitals/reps` y
      `/hospitals/import` lo piden; `GET /api/hospitals/reps/summary` responde 403 sin él (viewer y líder) y deja pasar al
      administrador y al gestor de datos.

## Fuera de alcance

- El rediseño de la página de IPS (celular, filtros por departamento y municipio, formularios): es la etapa siguiente
  del diseño.
- La sección "Sede REPS" de la ficha de una IPS y `GET /api/hospitals/reps/sedes`: la ficha la sigue usando (vincular a
  mano ya pide `hospitals:edit`).
- Las rutas de importación (`/api/hospitals/import/*`) siguen con su control (`requireRepsImportUser`): ya dejan entrar
  solo al administrador y al gestor de datos.
- El aviso de festivo en el reporte por voz (idea del dueño del 2026-10-31): va en su propio PR, después de este.

## Impacto

- Datos / migración: no.
- Costo Google Maps: 0.
- Estética del mapa: no cambia (el menú es el armazón; en el Mapa solo cambia el orden de su cajón).
- Permisos / roles: `reps:manage` nuevo para admin y data_manager. Dejan de ver "Cruce REPS": la dirección comercial,
  las líderes, los Ejecutivos Comerciales, el de contratos y los de consulta. Nadie pierde "Importar del REPS" (ya era
  solo de admin y data_manager).

## Plan (archivos e interfaces)

- `web/lib/permissions.ts`: `getNavigationMenu` con las sueltas primero; permiso `reps:manage` en admin y data_manager.
- `web/app/hospitals/page.tsx`, `web/app/hospitals/reps/page.tsx`, `web/app/hospitals/import/page.tsx`: `can('reps:manage')`
  y `PermissionGuard`, como el resto de las páginas.
- `web/app/api/hospitals/reps/summary/route.ts`: `requirePermission(request, 'reps:manage')`.
- Pruebas: `web/scripts/menu-check.ts` (orden, permiso y que cada página lo pida) y `web/scripts/ips-routes-check.ts`
  (la ruta real contra el Supabase falso: 403 sin el permiso, pasa con él).
- `mobile/lib/navegacion.ts`: `RUTA_OPMAP` y `mostrarIrAOpMap(instalada: boolean | null): boolean` (puro);
  `mobile/lib/pwa.ts`: `irAOpMap()` (`location.assign`); `mobile/components/EstadoCola.tsx`: el botón. Pruebas en
  `mobile/scripts/checks/15-navegacion.ts`.
- `web/docs/ROLES_AND_PERMISSIONS.md` y `CLAUDE.md` (una línea del menú y otra del REPS).

## Verificación final

- `npm run check` en `web/` y en `mobile/`.
- Capturas con datos de prueba (servidor local con Supabase falso): el menú de la líder y del administrador en
  escritorio y celular; `/hospitals` de la líder sin "Cruce REPS" y del administrador con él; `/hospitals/reps` de la
  líder; la app de campo en el navegador con el botón "OpMap" y, al tocarlo, OpMap con su menú.
