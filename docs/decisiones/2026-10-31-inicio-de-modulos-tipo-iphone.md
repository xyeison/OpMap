# 2026-10-31 – OpMap abre en un inicio de módulos tipo iPhone, y la app de campo vuelve a él con "OpMap"

**Contexto**: el dueño (2026-10-31): "necesito que todo tenga el feeling de Uber y deberás unificar los dos (…) cuando
estamos en Agendamiento se pierde la noción de lo otro que tenemos, que hace parte del mismo ecosistema". Propuesta en
`docs/specs/2026-10-31-diseno-unificado-vista-de-modulos.md` con dos formas (tipo iPhone/Uber o tipo Odoo).

**Decisión del dueño (2026-10-31)**: "debe entrar, se abre el inicio de módulos, que se abra así como el tipo iPhone,
o tipo Odoo, que están los cuadritos de los módulos con unos íconos, así tal cual".
- "/" (y el logotipo "OpMap" de la barra) abren **`/inicio`**: la cuadrícula de módulos del rol, cada uno un cuadro con
  su ícono y su nombre (3 por fila en el celular, 4 a 6 en escritorio). Las opciones sueltas (Agendamiento, Mapa,
  Calendario, Zonas, Líneas) van primero, sin título; cada grupo (Terceros, Empleados, Inteligencia de Mercado,
  Configuración) con el suyo. Las mismas opciones, el mismo orden y los mismos permisos que el menú
  (`bloquesDeInicio` sobre `getNavigationMenu`). El Mapa ya no es la página de inicio: es el primer cuadro.
- El menú en acordeón (etapa 1) se queda como cajón "☰" para saltar sin pasar por el inicio.
- La app de campo lleva en su franja de estado el botón **"OpMap"** que vuelve a `/inicio`: en el navegador, en la misma
  pestaña (mismo ingreso); instalada en el teléfono, en otra pestaña del navegador (la app no se cierra ni pierde su
  cola); sin señal, solo avisa ("OpMap necesita señal. Tus pendientes siguen aquí…"). En el teléfono compilado o en Expo
  Go no se muestra.

**Consecuencias**:
- Sin migración, sin Google, sin cambios en el mapa por dentro (solo deja de ser la página de inicio).
- Las líneas de estado por módulo ("3 citas hoy") y el armazón común en el celular (barra de abajo por módulo, etapa
  2b) quedan para etapas siguientes.

**Dónde vive en el código**: `web/lib/permissions.ts` (`RUTA_INICIO`, `getHomeRoute`, `bloquesDeInicio`),
`web/app/inicio/page.tsx`, `mobile/lib/opmap-enlace.ts`, `mobile/components/EstadoCola.tsx`. Pruebas:
`web/scripts/menu-check.ts` (sección 4), `mobile/scripts/checks/25-inicio-opmap.ts`.
