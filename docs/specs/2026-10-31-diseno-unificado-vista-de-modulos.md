# Spec: un solo ecosistema con sensación Uber · vista principal de módulos  (2026-10-31)

**Estado**: aprobada por el dueño el 2026-10-31 (tipo iPhone, "/" abre el inicio de módulos:
`docs/decisiones/2026-10-31-inicio-de-modulos-tipo-iphone.md`) | etapa 2a implementada (PR pendiente). Sigue a la
etapa 1 del diseño (`2026-10-30-diseno-web-etapa-1.md`) y al menú por grupos (`2026-10-29-menu-por-grupos.md`).

## Problema
El dueño, 2026-10-31: "necesito que todo tenga el feeling de Uber y deberás unificar los dos; no sé si simulamos
mejor como hace Odoo o iPhone una vista principal de módulos, porque siento que cuando estamos en Agendamiento se
pierde la noción de lo otro que tenemos, que hace parte del mismo ecosistema".

En concreto: OpMap web y la app de campo (`/campo`) comparten paleta, letra y tema (etapa 1), pero son dos
navegaciones distintas, y "Agendamiento" abre la app como página completa sin ningún camino de vuelta a OpMap. La app
tiene que seguir funcionando instalada y sin señal (service worker en `/campo/`, cola en IndexedDB): nada de meterla
"dentro" de las páginas de Next.

## Lo que significa "feeling de Uber" aquí
Una pantalla de inicio con pocas cosas grandes, cada una lleva a su flujo, y desde cualquier flujo un gesto te
devuelve al inicio. Un solo ingreso y un solo tema (ya está). Nada de dos "aplicaciones": Agendamiento es un módulo más.

## Decisión del dueño (2026-10-31)
**Tipo iPhone**: "se abre el inicio de módulos, así como el iPhone: los cuadritos de los módulos con unos íconos, así
tal cual". "/" abre ese inicio (no el Mapa). Odoo queda descartado (pensado para escritorio).

## Resultado esperado, por etapas (una por PR)

**Etapa 2a – Inicio de módulos y camino de vuelta** (esta spec; resuelve la queja):
- `/inicio` en OpMap: la cuadrícula de módulos del rol (los mismos permisos, opciones y orden que `getNavigationMenu`,
  agrupados por `bloquesDeInicio`: las sueltas primero sin título, cada grupo con el suyo), cada módulo un cuadro con su
  ícono y su nombre, 3 por fila en el celular y 4 a 6 en escritorio. "/" y el logotipo llevan a `/inicio`
  (`getHomeRoute`); el Mapa pasa a ser el primer cuadro. Página rehecha (`data-sigue-tema`).
- La app de campo recibe el botón **"OpMap"** en su franja de estado (siempre a la vista): vuelve a `/inicio` en la
  misma pestaña; instalada, en otra pestaña del navegador; sin señal, avisa y no sale; en el teléfono compilado no sale
  (`lib/opmap-enlace.ts`).
- Dentro de OpMap, Agendamiento se abre igual que hoy (página completa) pero ya con vuelta.

**Etapa 2b – Un solo armazón en el celular**: barra de abajo por módulo en las páginas rehechas, encabezado común;
escritorio con secciones como pestañas; el acordeón queda como cajón.

**Etapa 2c en adelante** – rehacer cada página por dentro (orden de la etapa 1).

## Criterios de aceptación de la etapa 2a (pruebas)
- [x] `getHomeRoute` da `/inicio` para todo rol con alguna opción (también recursos humanos) y null sin opciones;
      `/inicio` es ruta permitida de todos (`menu-check`, sección 4).
- [x] `bloquesDeInicio` trae las mismas opciones y el mismo orden que el menú; las sueltas seguidas en un solo bloque
      sin título y cada grupo una vez; admin: sueltas (Mapa primero) y luego Terceros; líder: Agendamiento primero.
- [x] `app/inicio/page.tsx` sigue el tema, usa `bloquesDeInicio`, abre Agendamiento como página completa (`<a>`), sin
      "KAM", "Vacante" ni "panel".
- [x] App: `destinoOpMap` → oculto fuera del navegador; `/inicio` misma pestaña; instalada → otra pestaña; sin señal →
      solo aviso. `EstadoCola.tsx` pinta el botón con el ícono "inicio" y no toca la cola (`25-inicio-opmap`).
- [ ] Capturas en claro y oscuro, celular y escritorio: `/inicio`, Agendamiento con el botón (prueba del dueño).

## Fuera de alcance
- Líneas de estado por módulo ("3 citas hoy"): etapa siguiente.
- Fusionar Next y Expo; rehacer el Mapa por dentro (`docs/mapa-estetica.md`); tema por persona en la base.

## Impacto
- Datos / migración: no. Google: no. Estética del mapa: no cambia (solo deja de ser la página de inicio).
- Permisos: ninguno nuevo; `/inicio` usa los del menú.
- Regla de negocio: `docs/decisiones/2026-10-31-inicio-de-modulos-tipo-iphone.md`.

## Plan (archivos)
- `web/lib/permissions.ts`: `RUTA_INICIO`, `getHomeRoute` → `/inicio`, `bloquesDeInicio`, `/inicio` en las rutas permitidas.
- `web/app/inicio/page.tsx` (nuevo); `getIconForRoute` exportado de `NavigationWithPermissions.tsx`.
- `web/scripts/menu-check.ts` (sección 4).
- `mobile/lib/opmap-enlace.ts` (nuevo), `mobile/components/EstadoCola.tsx`, ícono `inicio` en `iconos-nombres.ts`,
  `mobile/scripts/checks/25-inicio-opmap.ts`.

## Verificación final
`npm run check` en `web/` y en `mobile/`; capturas de `/inicio` (celular y escritorio, claro y oscuro) y de la app con
el botón "OpMap".
