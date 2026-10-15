# Spec: menú de la web y ventana "Datos de la zona"  (2026-10-14)

**Estado**: aprobada por el dueño (pedido del 2026-10-14)

## Problema

El dueño va a mostrar OpMap a las líderes y pidió, con sus palabras:

- "Deberíamos quitar ese dashboard: cobertura, oportunidades, hospitales, total son indicadores que no tienen
  sentido por ahora."
- "La parte de municipios debería ser una parte de configuración. El mapa debería ser el principal menú."
- "Las regiones quedaron de una versión anterior: toca borrarlo."
- "Cuando le dé clic en Alexa me aparezca una ventana emergente con datos estadísticos de esa zona: cuántos
  municipios, cuánta población, todos los datos estadísticos que tenemos." Las vacantes también se pueden abrir.

## Resultado esperado

- **Inicio:** "/" ya no tiene tablero. Lleva a la primera página del menú de cada rol: `/map`, o `/calendario` para
  RR. HH.
- **Herramientas del tablero:** "Recalcular asignaciones" y "Calcular rutas" no se pierden. Pasan a Configuración →
  Asignación, con los mismos permisos.
- **Orden del menú:** Mapa, Hospitales, Terceros, Calendario, Zonas, Líneas, Ejecutivos Comerciales, Inteligencia,
  Contratos, Mi Empresa, Cumplimiento, Proveedores, Usuarios, Visitas y Configuración al final.
- **Configuración:** tiene las secciones Visitas, Municipios y Asignación, cada una con su permiso. Quien solo tiene
  una ve solo esa. `/territories` sigue funcionando.
- **Regiones:** `/zones` sale del menú y su página se borra. La tabla `zones` y `/api/zones` siguen, porque Zonas y
  el mapa las usan.
- **Ventana "Datos de la zona":** en Ejecutivos Comerciales cada persona y cada vacante se abre en una ventana con dos
  niveles, su zona base y su territorio, que son las zonas que cubre por línea.
  - Cifras: municipios, población DANE, afiliados BDUA, IPS objetivo con camas y servicios, giros ADRES y compras
    públicas de 12 meses, visitas de VMO, médicos asignados y cobertura por línea.
  - Cada cifra muestra su fuente y su corte.
  - Las cuentas reutilizan las reglas de Inteligencia: no se suman dos veces los giros de un NIT con varias sedes, y
    SECOP va por valor adjudicado y sin duplicados.
- **Quién ve la ventana:** quien tiene `executives:view` y `hospitals:view`. Las compras públicas solo las ve quien
  tiene `intelligence:view`. La cobertura sale solo de las líneas que la persona ve, con la regla de
  `/api/coverage`.

## Criterios de aceptación

- [ ] Menú y página de inicio por rol, probados en `web/scripts/menu-check.ts`.
- [ ] Cuentas de la ventana y permisos por rol, probados en `web/scripts/zona-estadisticas-check.ts` y
      `zona-estadisticas-api-check.ts`. La ruta nunca escribe ni llama a Google.
- [ ] Nada de "KAM", "representante" ni "panel" visible. La estética del mapa no cambia.

## Fuera de alcance

El criterio común entre Contratos e Inteligencia, que el dueño lo decide. El botón "Por Regiones" de Zonas y el
modo Regiones del mapa, porque cambiar el mapa necesita su autorización. Quitar el permiso `dashboard:view`.

## Impacto

Sin migración. Costo de Google: 0. El mapa no cambia. Los permisos de los roles no cambian.

## Verificación final

`GOOGLE_ROUTES_DISABLED=true npm run check` en `web/`. Capturas de escritorio y a 390 px del menú, de Configuración y
de la ventana para Alexa y para las vacantes.
