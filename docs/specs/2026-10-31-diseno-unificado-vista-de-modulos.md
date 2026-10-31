# Spec: un solo ecosistema con sensación Uber · vista principal de módulos  (2026-10-31)

**Estado**: PROPUESTA para decisión del dueño (sin código). Sigue a la etapa 1 del diseño
(`2026-10-30-diseno-web-etapa-1.md`, aprobada e implementada) y al menú por grupos (`2026-10-29-menu-por-grupos.md`).

## Problema
El dueño, 2026-10-31: "necesito que todo tenga el feeling de Uber y deberás unificar los dos; no sé si simulamos
mejor como hace Odoo o iPhone una vista principal de módulos, porque siento que cuando estamos en Agendamiento se
pierde la noción de lo otro que tenemos, que hace parte del mismo ecosistema".

Hoy, en concreto:
- OpMap web y la app de campo (`/campo`) ya comparten paleta, letra (DM Sans) y tema (etapa 1), pero son **dos
  navegaciones distintas**: la web tiene el menú en acordeón (cajón en el celular, fijo en escritorio) y la app tiene
  su barra de abajo (Hoy, Reportar, Agenda, Números, Ajustes).
- "Agendamiento" en el menú de OpMap abre la app como **página completa** (`<a href="/campo/agenda">`): al entrar, el
  menú de OpMap desaparece y **la app no tiene ningún camino de vuelta** a OpMap (ni enlace, ni barra, ni "Inicio").
  Esa es la pérdida de noción que describe el dueño.
- La app tiene que seguir funcionando **instalada y sin señal** (service worker en `/campo/`, cola en IndexedDB):
  cualquier unificación tiene que respetar eso, y por eso no se puede meter la app "dentro" de las páginas de Next.

## Lo que significa "feeling de Uber" aquí (para que no sea solo paleta)
Uber no tiene un menú de 20 opciones: tiene **una pantalla de inicio con pocas tarjetas grandes** (Viajes, Comida,
Reservar…), cada una lleva a su flujo, y en cualquier flujo un gesto te devuelve al inicio. Lo que se propone copiar:
1. una **pantalla de inicio común** con los módulos como tarjetas grandes (icono + nombre + una línea de estado);
2. dentro de cada módulo, el **mismo encabezado** (OpMap · nombre del módulo · botón de inicio) y la misma barra de
   abajo en el celular;
3. **un solo ingreso y un solo tema** (ya está desde la etapa 1 y el ingreso único de las líderes);
4. nada de dos "aplicaciones": Agendamiento es un módulo más, como Mapa o Terceros.

## Las dos formas que nombró el dueño (y una recomendación)

| | **Tipo iPhone / Uber** (cuadrícula de módulos) | **Tipo Odoo** (inicio de módulos + menú superior por módulo) |
|---|---|---|
| Inicio | Cuadrícula de tarjetas grandes (2 columnas en el celular, 3–4 en escritorio): Mapa, Agendamiento, IPS, Cuentas clave, Médicos, Ejecutivos Comerciales, Líderes, Zonas, Líneas, Inteligencia, Calendario, Configuración… solo las del rol. | Igual: una pantalla de módulos. |
| Dentro de un módulo | Encabezado con "⌂ Inicio" y el nombre del módulo; en el celular, barra de abajo con las secciones del módulo (como hoy la app: Hoy, Reportar, Agenda…); en escritorio, las secciones como pestañas arriba. | Barra superior con el nombre del módulo y un desplegable de sus secciones; el cambio de módulo por el logo. |
| Qué cambia del menú en acordeón (etapa 1) | Deja de ser el centro: se queda como cajón "☰" por si alguien quiere saltar sin pasar por el inicio. | Lo mismo. |
| Celular | Es su terreno natural: tarjetas grandes, pulgar, barra de abajo. | Odoo está pensado para escritorio; en celular sus menús desplegables se sienten pequeños. |
| Riesgo | Más toques para llegar a una opción profunda (inicio → módulo → sección). | Menos toques, pero vuelve a ser "un menú", que es lo que el dueño quiere dejar atrás. |

**Recomendación: tipo iPhone/Uber**, porque el dueño pidió que todo esté pensado para el celular y con el feeling de
Uber, y porque la app de campo ya tiene esa forma (barra de abajo por módulo): el cambio grande es solo darle un
**inicio común** y un **camino de vuelta**.

## Resultado esperado (por etapas, una por PR)

**Etapa 2a – Inicio de módulos y camino de vuelta** (la que resuelve la queja):
- Nueva página `/inicio` en OpMap: la cuadrícula de módulos del rol (los mismos permisos de `getNavigationMenu`), con
  una línea de estado por tarjeta donde ya hay dato barato (p. ej. Agendamiento: "3 citas hoy"; IPS pendientes: "2
  por calcular"). "/" lleva a `/inicio` (hoy lleva al Mapa; el Mapa pasa a ser la primera tarjeta).
- La app de campo recibe un **encabezado común**: "OpMap" a la izquierda que vuelve a `/inicio` (en el navegador) y el
  nombre del módulo ("Agendamiento"). Instalada en el teléfono y sin señal, el botón abre OpMap en el navegador (si
  no hay señal, avisa y no hace nada): la app sigue siendo la misma PWA, en `/campo/`, con su cola.
- Dentro de OpMap, Agendamiento se abre igual que hoy (página completa) pero ya con vuelta.

**Etapa 2b – Un solo armazón en el celular**: las páginas de OpMap ya rehechas adoptan la barra de abajo del módulo
(secciones del módulo) y el encabezado común; escritorio: encabezado + secciones como pestañas; el acordeón queda como
cajón.

**Etapa 2c en adelante** – rehacer cada página por dentro (el orden de la etapa 1: Zonas y Ejecutivos Comerciales;
Médicos, Cuentas clave e IPS; Líderes y Visitas; Inteligencia; Configuración).

## Criterios de aceptación de la etapa 2a (se convierten en pruebas)
- [ ] `/inicio` muestra una tarjeta por módulo permitido del rol, en el orden del menú, sin "KAM", "Vacante" ni
      "panel"; recursos humanos ve Calendario primero; nadie ve una tarjeta cuya ruta no tenga permiso (`menu-check`).
- [ ] "/" redirige a `/inicio` para todos los roles con sesión; el logo lleva a `/inicio`.
- [ ] La app de campo muestra "OpMap" en el encabezado y, en el navegador, vuelve a `/inicio` conservando la sesión
      (misma cookie: ingreso único) y sin tocar la cola; instalada y sin señal, avisa y no sale (`22-sin-senal`).
- [ ] El Mapa no cambia por dentro (`mapa-estilo-check`); solo el acceso.
- [ ] Capturas en claro y oscuro, celular y escritorio: `/inicio`, Agendamiento con el encabezado, una página de OpMap.

## Fuera de alcance
- Fusionar los dos códigos (Next y Expo) en uno: la app de campo sigue en `mobile/` y se publica en `/campo` (sin
  señal, Background Sync y la cola dependen de eso).
- Rehacer el Mapa (leyenda, filtros, buscador): sigue bajo autorización aparte (`docs/mapa-estetica.md`).
- Tema que siga a la persona entre aparatos (sigue guardado por navegador).

## Impacto
- Datos / migración: no. Google: no. Estética del mapa: no cambia.
- Permisos: ninguno nuevo; `/inicio` usa los del menú.
- Regla de negocio: la decisión "inicio de módulos tipo iPhone/Uber" se anota en `docs/decisiones/` cuando el dueño
  elija.

## Lo que el dueño decide antes de empezar
1. **Tipo iPhone/Uber (recomendado) o tipo Odoo.**
2. Si "/" debe abrir el inicio de módulos (recomendado) o seguir abriendo el Mapa con el inicio detrás del logo.
3. Si Agendamiento, al instalarse en el teléfono, debe llevar el botón "OpMap" (abre el navegador) o solo mostrarlo en
   la versión web.
