# Spec: menú por grupos, "IPS" en lugar de "Hospitales" y Médicos en "Próximamente"  (2026-10-29)

**Estado**: pedido del dueño del 2026-10-29 (mensaje dictado). La parte de contratos (CIAObserva), cumplimiento,
cuentas clave y terceros unificados va en otra spec, cuando el dueño explique "cuentas clave".

## Problema
El menú es una lista plana de 15 opciones. El dueño: "hay que cambiar el nombre de hospitales a IPS… los médicos,
creo que hay que borrar esa tabla. Hay que dejar la opción y ponerle algo así como que próximamente… Mapa debe ser un
menú. Después viene otro menú que dice terceros, pero tercero es como un título…".

## Resultado esperado
Menú (cada opción solo con su permiso; un título de grupo solo si el grupo tiene alguna opción):

- **Mapa** (`/map`)
- **Terceros** (título)
  - IPS (`/hospitals`)
  - Cuentas clave (`/terceros`: hoy las cuentas, que son las IPS; el dueño explicará el resto)
  - Médicos (`/medicos`: "Próximamente")
  - Aseguradoras (`/aseguradoras`: "Próximamente")
  - Proveedores (`/providers`: el dueño no lo nombró; queda aquí hasta que "Cuentas clave" junte clientes y
    competidores)
- **Empleados** (título)
  - Ejecutivos Comerciales (`/executives`)
  - Líderes de negocio (`/lideres`: "Próximamente")
- **Calendario** (`/calendario`)
- **Zonas** (`/kams`)
- **Líneas** (`/lines`)
- **Inteligencia de Mercado** (título)
  - ADRES (`/inteligencia`, pestaña de giros)
  - Compras públicas (`/inteligencia?tab=secop`)
  - Contratos (`/contracts`)
  - Cumplimiento (`/compliance`)
- **Configuración** (título)
  - Mi Empresa (`/mi-empresa`)
  - Usuarios (`/users`)
  - Visita VMO (`/visits`)
  - Parámetros (`/configuracion`: visitas, municipios y asignación, como hoy)

Además:
- "Hospitales" pasa a "IPS" en el menú y en los títulos y textos visibles de las páginas de IPS (la ruta `/hospitals`
  no cambia).
- `/terceros` se llama "Cuentas clave" y muestra solo las cuentas: la pestaña y el botón de Médicos salen de ahí.
- Médicos, Aseguradoras y Líderes de negocio abren una página "Próximamente" que dice qué vendrá.
- Elegir "Compras públicas" en el menú estando en ADRES cambia la pestaña (y al revés).
- "/" y el logo siguen llevando al Mapa; quien no tiene mapa (recursos humanos) sigue llegando a Calendario.

## Criterios de aceptación (se convierten en pruebas)
- [ ] El menú de cada rol sale en ese orden, con sus grupos, sin opciones repetidas y sin "KAM", "representante" ni
      "panel" (`scripts/menu-check.ts`).
- [ ] Cada opción del menú es una ruta permitida para el rol y tiene su página en disco.
- [ ] El menú no dice "Hospitales" ni "Terceros" como opción; dice "IPS" y "Cuentas clave".
- [ ] Inicio: el Mapa para quien lo tiene; si no, Calendario; si no, la primera opción.
- [ ] La página de Médicos no muestra la lista de médicos.

## Fuera de alcance
- Borrar datos de la base: la tabla `medicos` solo tiene los 10 médicos de prueba de la simulación de Carmen
  (`PRUEBA0840NN`); quitarlos (`scripts/simulacion-carmen.ts --borrar`) espera la confirmación del dueño. La tabla, su
  API y la app de visita no cambian.
- El contenido de Cuentas clave, Aseguradoras y Líderes de negocio, y lo de CIAObserva, contratos con adjuntos y
  vencimiento, precios y cumplimiento.
- Permisos de los roles: no cambian (las páginas nuevas usan `terceros:view` y `executives:view`).

## Impacto
- Datos / migración: no. Costo Google Maps: 0. Estética del mapa: no cambia.
- Permisos / roles: iguales; cambia el menú de todos los roles.

## Plan (archivos e interfaces)
- `web/lib/permissions.ts`: `NavigationItem.grupo` (título del grupo), nuevo orden, rutas de las páginas nuevas,
  inicio.
- `web/components/NavigationWithPermissions.tsx`: títulos de grupo, opción activa con `?tab=` e iconos.
- `web/components/Proximamente.tsx` y `web/app/{medicos,aseguradoras,lideres}/page.tsx`.
- `web/app/terceros/page.tsx` ("Cuentas clave", sin Médicos); se borran `MedicosTab`, `MedicoForm` y
  `MedicoDetalleModal`, que solo usaba esa página (quedan en git para cuando vuelva Médicos).
- `web/app/hospitals/**`: textos visibles "IPS".
- `web/app/inteligencia/page.tsx`: la pestaña sigue a `?tab=` también al navegar desde el menú.
- Pruebas: `scripts/menu-check.ts`, `scripts/terceros-check.ts`, `scripts/visits-check.ts`.

## Verificación final
`npm run check`; preview en escritorio y celular con el menú abierto, ADRES ↔ Compras públicas y las tres páginas
"Próximamente".
