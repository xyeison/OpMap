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
   con su permiso: ningún rol gana ni pierde opciones, solo cambia el orden. La página de inicio no la toca este cambio
   (desde #72 es `/inicio`, la cuadrícula de módulos, que sigue el mismo orden).
2. **Volver a OpMap:** la app de campo abierta en el navegador lleva arriba, en la franja "En línea / Sin conexión" que
   se ve en todas las pantallas, el botón "OpMap" de #72 (`mobile/lib/opmap-enlace.ts`): va al inicio de módulos de
   OpMap, con su menú; en una pestaña, en la misma; en la app instalada, en otra pestaña; sin señal solo avisa; en la
   app del teléfono (Expo) no sale. Es la única salida: Ajustes ya no lleva "Ir a OpMap". Lo pendiente por subir no se
   pierde al salir (sigue en el teléfono y se sube como siempre); lo escrito y aún sin guardar en Reportar o en un
   formulario sí, así que, si va a salir en la misma pestaña desde esas pantallas, pregunta antes ("¿Volver a OpMap?").
3. **Cruce REPS:** el botón, la página `/hospitals/reps` y sus datos (`GET /api/hospitals/reps/summary`) son solo del
   administrador y del gestor de datos, como "Importar del REPS". Los demás no ven el botón; si escriben la dirección, la
   página dice que es de administración, y la API responde 403.

## Criterios de aceptación (se convierten en pruebas)

- [ ] Para todo rol, ninguna opción suelta sale después de un grupo, y los grupos salen en el orden Terceros, Empleados,
      Inteligencia de Mercado, Configuración. Admin: Mapa, Calendario, Zonas, Líneas, Terceros, Empleados, Inteligencia
      de Mercado, Configuración. Líder: Agendamiento primero.
- [ ] Las opciones de cada rol son las mismas de antes (solo cambia el orden).
- [ ] App de campo: el botón "OpMap" de la franja (`components/EstadoCola.tsx`) es el de #72 (sus pruebas en
      `mobile/scripts/checks/25-inicio-opmap.ts`) y Ajustes ya no lleva "Ir a OpMap": la salida va una sola vez.
- [ ] Desde Reportar y desde las pantallas con "Volver" (formularios; no "Agregar a inicio") pregunta "¿Volver a OpMap?"
      antes de salir en la misma pestaña; desde Hoy, Agenda, Números y Ajustes sale sin preguntar. Sin señal solo avisa,
      sin preguntar. En la app instalada la otra pestaña se abre antes de preguntar (después de esperar una respuesta el
      navegador la bloquearía) y, si abrió, no pregunta: la app sigue abierta con lo escrito.
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
- `mobile/lib/navegacion.ts` (puros): `preguntaAntesDeIrAOpMap(ruta: string): boolean` y
  `rutaDeSegmentos(segmentos): string`; `mobile/components/EstadoCola.tsx`: la pregunta dentro del `irAOpMap` de #72
  (con `useSegments`); `mobile/app/(app)/ajustes.tsx`: sin "Ir a OpMap". Pruebas en
  `mobile/scripts/checks/15-navegacion.ts` (y la de #72 en `25-inicio-opmap.ts`, ajustada a la pregunta).
- `web/docs/ROLES_AND_PERMISSIONS.md` y `CLAUDE.md` (una línea del menú y otra del REPS).

## Revisión (2026-10-31)

El revisor encontró tres cosas en el botón de la app de campo, ya corregidas: salía sin preguntar desde Reportar y los
formularios (lo escrito ahí vive en memoria); salía sin señal y llevaba a la página de error del navegador; y en una
pestaña se veía dos veces, porque Ajustes ya tenía "Ir a OpMap" con otra regla. Queda pendiente, aparte: la pantalla
"sin acceso a la app" no tiene el botón (en una pestaña se vuelve con Atrás del navegador).

## Encuentro con #72 (2026-10-31)

Mientras este PR esperaba, otra sesión publicó #72 (inicio de módulos tipo iPhone), que trajo su propio botón "OpMap" en
la misma franja, y el dueño lo dejó como decisión en CLAUDE.md. Para no tener dos botones, este PR se queda con el de
#72 y le suma solo lo que le faltaba: la pregunta antes de perder lo escrito en Reportar o en un formulario, y quitar el
"Ir a OpMap" de Ajustes (con #72 se veía dos veces también en la app instalada). Se quitaron `RUTA_OPMAP`,
`dondeIrAOpMap` y `irAOpMap()` de `pwa.ts`, que ya nadie usaba. El botón de #72 mide 32 px de alto, como "Subir ahora" y
"Actualizar" a su lado (este PR había hecho el suyo de 44): los tres juntos quedan para la etapa de diseño de la app.

## Verificación final

- `npm run check` en `web/` y en `mobile/`.
- Capturas con datos de prueba (servidor local con Supabase falso): el menú de la líder y del administrador en
  escritorio y celular; `/hospitals` de la líder sin "Cruce REPS" y del administrador con él; `/hospitals/reps` de la
  líder; la app de campo en el navegador con el botón "OpMap" y, al tocarlo, OpMap con su menú.
