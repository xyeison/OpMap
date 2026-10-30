# OpMap con el diseño de la app · etapa 1 · Plan de implementación

> **Para quien lo ejecute:** con `executing-plans` (por defecto en este repo; `subagent-driven-development` solo si el
> dueño lo pide). Los pasos usan casillas (`- [ ]`).

**Meta:** que el armazón de OpMap web (letra, colores, barra, menú, ingreso) sea el de la app de campo, con el tema
Claro / Oscuro / Automático que elige cada persona, y que la app use la misma preferencia.

**Arquitectura:**
- **Colores:** los papeles de color de `mobile/lib/paleta.ts` pasan a la web como variables CSS, en claro y en oscuro.
  Salen de un solo módulo puro, `web/lib/tema.ts`, y Tailwind los usa por nombre.
- **Tema:** un script en `<head>` pone `data-tema` en `<html>` antes de pintar.
- **Menú:** el de hoy (`getNavigationMenu` / `agruparMenu`) se dibuja en acordeón. Es un cajón en el celular y en el
  Mapa, y va fijo en escritorio.
- **Páginas por dentro:** no cambian en esta etapa (siguen en claro).

**Tecnología:** Next.js 14 (app router), Tailwind 3, `next/font/google` (DM Sans), Expo / React Native Web.

**Spec:** `docs/specs/2026-10-30-diseno-web-etapa-1.md` (aprobada con comentarios el 2026-10-30).

## Reglas de todo el plan
- **Colores:** los de `mobile/lib/paleta.ts` (`COLORES_CLAROS` / `COLORES_OSCUROS`), letra por letra; no hay otra paleta.
- **Preferencia:**
  - la clave es `opmap.tema.v1`; los valores, `'claro' | 'oscuro' | 'auto'`;
  - lo que no se reconoce vale `'auto'`, y por defecto es `'auto'`;
  - vive en el navegador o el teléfono, nunca en la base.
- **Letra:** DM Sans, 400, 500 y 700.
- **Tamaños:** todo lo que se toca mide ≥ 44 px; los botones principales, 52 px.
- **El mapa no cambia:**
  - en `/map`, la barra conserva su alto de hoy (`h-12 md:h-16`) y el menú es cajón;
  - `mapa-estilo-check` sigue igual.
- **Terminología:** "Ejecutivo Comercial", "Zona", "IPS". Nunca "KAM", "Vacante" ni "panel".
- **Sin cambios de permisos:** el menú sale de `getNavigationMenu` tal cual. Agendamiento, primero para quien tiene
  `campo:app`.

## Lo que más puede fallar (cada uno con su prueba en la tarea que lo tiene)
1. `localStorage` bloqueado (modo privado): el script del tema no lanza y queda en automático (Tarea 1).
2. Destello blanco al abrir en oscuro: el script va en `<head>`, antes de pintar (Tarea 2).
3. Menú largo en pantalla baja: la lista se desplaza. Va en un `div role="navigation"`, nunca `<nav>`, que
   `globals.css` fija (Tarea 3).
4. El Mapa no cambia de alto ni de ancho (Tarea 3).
5. Cambiar el tema en una pestaña (OpMap o la app) cambia las otras (evento `storage`, Tareas 2 y 5).

---

### Tarea 1: los papeles de color y la preferencia (puro)

**Archivos:**
- Crear: `web/lib/tema.ts`, `web/scripts/tema-check.ts`.
- Modificar: `web/package.json` (sumar `tsx scripts/tema-check.ts` a `test`).

**Interfaces que produce:**
- `type PreferenciaTema = 'claro' | 'oscuro' | 'auto'`, `type Tema = 'claro' | 'oscuro'`.
- `CLAVE_TEMA = 'opmap.tema.v1'`.
- `PAPELES_CLAROS` y `PAPELES_OSCUROS`: `Record<PapelColor, string>`. Las claves son las de `Colores` de la app:
  `fondo`, `superficie`, `superficieSuave`, `relleno`, `texto`, `textoSuave`, `textoInactivo`, `borde`, `bordeFuerte`,
  `acento`, `sobreAcento`, `peligro`, `fondoPeligro`, `exito`, `fondoExito`, `alerta`, `fondoAlerta`, `info`,
  `fondoInfo`, `encabezado`, `sobreEncabezado`, `bordeControl`, `agarradera`.
- `leerPreferencia(valor: unknown): PreferenciaTema`.
- `temaEfectivo(preferencia: PreferenciaTema, prefiereOscuro: boolean): Tema`.
- `variableCss(papel: PapelColor): string`, en kebab-case: `--color-superficie-suave`.
- `cssDeTemas(): string`, con `:root, [data-tema="claro"] { … }` y `[data-tema="oscuro"] { … }`.
- `SCRIPT_TEMA_INICIAL: string`: lee la clave en try/catch, mira `matchMedia('(prefers-color-scheme: dark)')` si es
  'auto' y pone `document.documentElement.dataset.tema`. Nunca lanza.
- `contraste(a: string, b: string): number` (WCAG 2.x, como en la app).

- [ ] Paso 1: pruebas en `tema-check.ts`, que fallan:
  - cada papel de `PAPELES_CLAROS` y `PAPELES_OSCUROS` es igual al de `COLORES_CLAROS` y `COLORES_OSCUROS`, leídos con
    expresiones regulares de `../../mobile/lib/paleta.ts`;
  - `leerPreferencia('claro') === 'claro'`, `leerPreferencia('xyz') === 'auto'` y `leerPreferencia(null) === 'auto'`;
  - `temaEfectivo('auto', true) === 'oscuro'` y `temaEfectivo('claro', true) === 'claro'`;
  - contraste en los dos temas:
    - `texto` sobre `fondo` y `superficie` ≥ 4,5;
    - `textoSuave` sobre `fondo` ≥ 4,5;
    - `sobreAcento` sobre `acento` ≥ 4,5;
    - `bordeControl` sobre `superficie` ≥ 3;
  - `cssDeTemas()` trae `--color-fondo: #FFFFFF` en el bloque claro y `--color-fondo: #000000` en el oscuro;
  - `SCRIPT_TEMA_INICIAL` corre con `localStorage` que lanza y queda `dataset.tema` en 'claro' u 'oscuro' según el
    `matchMedia` falso. Se evalúa con `new Function` y un `document`/`window` falsos.
- [ ] Paso 2: `npx tsx scripts/tema-check.ts` falla (no existe `lib/tema.ts`).
- [ ] Paso 3: escribir `web/lib/tema.ts`.
- [ ] Paso 4: la prueba pasa.
- [ ] Paso 5: commit `feat(diseno): papeles de color de la app y preferencia de tema (puro)`.

### Tarea 2: el tema y la letra en toda la web

**Archivos:**
- Modificar: `web/app/layout.tsx`, `web/tailwind.config.js`, `web/app/globals.css`.
- Crear: `web/hooks/useTema.ts`.

**Interfaces:**
- **Usa:** `CLAVE_TEMA`, `leerPreferencia`, `temaEfectivo`, `cssDeTemas`, `SCRIPT_TEMA_INICIAL` (Tarea 1).
- **Produce** `useTema(): { preferencia: PreferenciaTema; tema: Tema; elegir: (p: PreferenciaTema) => void }`:
  - `elegir` guarda en `localStorage` (try/catch) y pone `data-tema`;
  - con 'auto', sigue el cambio del sistema;
  - escucha `storage` de `CLAVE_TEMA` (otra pestaña).
- **Produce** colores Tailwind por nombre (`bg-fondo`, `text-texto`, `bg-acento`, `text-sobre-acento`, `border-borde`,
  `bg-relleno`, `text-texto-suave`…), con `var(--color-…)`.

- [ ] Paso 1: pruebas en `tema-check.ts`, que fallan:
  - `app/layout.tsx` usa `DM_Sans` de `next/font/google`, con pesos 400, 500 y 700;
  - mete `SCRIPT_TEMA_INICIAL` en `<head>` (`dangerouslySetInnerHTML`) y `cssDeTemas()` en un `<style>`;
  - `<html>` lleva `suppressHydrationWarning`;
  - `tailwind.config.js` tiene los nombres de color que leen `var(--color-…)`;
  - `useTema` escucha `storage` y `prefers-color-scheme`.
- [ ] Paso 2: falla.
- [ ] Paso 3: hacerlo. `body` con `bg-fondo text-texto`. `<main>` NO cambia de fondo: las páginas siguen en claro, como
  dice la spec.
- [ ] Paso 4: pasa; `npm run typecheck`.
- [ ] Paso 5: commit `feat(diseno): DM Sans y el tema claro, oscuro o automático en la web`.

### Tarea 3: el armazón (barra y menú en acordeón)

**Archivos:**
- Crear: `web/lib/menu-acordeon.ts`.
- Modificar: `web/components/NavigationWithPermissions.tsx`, `web/scripts/menu-check.ts`.

**Interfaces:**
- **Usa:** `agruparMenu`, `opcionActiva`, `getNavigationMenu` (sin cambios); `useTema` (Tarea 2).
- **Produce** `gruposAbiertosAlEntrar(secciones, activa: string | null): string[]` (puro): el grupo que contiene la
  opción activa, o ninguno.
- **Produce** `alternarGrupo(abiertos: readonly string[], grupo: string): string[]` (puro).

- [ ] Paso 1: pruebas en `menu-check.ts`, que fallan:
  - para cada rol, las opciones del menú son exactamente las de `getNavigationMenu`; Agendamiento, primero con
    `campo:app`;
  - `gruposAbiertosAlEntrar` con la activa en Médicos → `['Terceros']`; con la activa en Mapa → `[]`;
  - `alternarGrupo` abre y cierra;
  - el componente:
    - cada título de grupo es un `<button aria-expanded>` con `aria-controls`;
    - las opciones sueltas no van dentro de un grupo;
    - la lista vive en un `div role="navigation"` (nunca `<nav>` adentro);
    - en `/map` conserva `h-12 md:h-16` y el cajón;
    - fuera del Mapa, en escritorio (`lg:`), el menú va fijo y el contenido se corre (`lg:pl-…`);
    - el selector de tema tiene las tres opciones "Claro", "Oscuro" y "Automático" y usa `elegir`;
    - las filas miden `min-h-[44px]`.
- [ ] Paso 2: falla.
- [ ] Paso 3: hacerlo con los colores por nombre (Tarea 2) y los íconos de hoy.
  - En la barra: OpMap y el usuario.
  - En el menú: el acordeón; al pie, el tema, el usuario y "Cerrar sesión".
- [ ] Paso 4: pasa; `npm run check` completo (`mapa-estilo-check` igual).
- [ ] Paso 5: commit `feat(diseno): barra y menú en acordeón con el diseño de la app, y el tema en el menú`.

### Tarea 4: el ingreso

**Archivos:** modificar `web/app/login/page.tsx`; la prueba, en `tema-check.ts`.

- [ ] Paso 1: la prueba falla:
  - el ingreso usa los colores por nombre (`bg-fondo`, botón `bg-acento text-sobre-acento` de 52 px, campos con
    `border-borde-control`);
  - no usa azul de Tailwind (`blue-`).
- [ ] Paso 2: hacerlo sin cambiar la lógica (`useUser().login`, mensajes).
- [ ] Paso 3: pasa; commit `feat(diseno): el ingreso con el diseño de la app`.

### Tarea 5: la app usa la misma preferencia

**Archivos:**
- Crear: `mobile/lib/tema-preferencia.ts` (puro, más guardado) y `mobile/scripts/checks/22-tema.ts` (sumarla a
  `correr.ts`).
- Modificar: `mobile/lib/ui.tsx` (`useColores` y un `useEsquema`), `mobile/components/Logo.tsx`,
  `mobile/components/Croquis.tsx`, `mobile/app/_layout.tsx` (proveedor) y `mobile/app/(app)/ajustes.tsx` (selector).

**Interfaces:**
- **Produce** `CLAVE_TEMA = 'opmap.tema.v1'` (la misma de la web), `leerPreferencia` y `temaEfectivo` (espejo de la
  web).
- **Produce** `ProveedorTema` y `useTemaApp(): { preferencia; elegir }`:
  - en el teléfono guarda en AsyncStorage;
  - en el navegador, la misma clave de `localStorage`, que lee también la web;
  - en el navegador escucha `storage`.
- **Produce** `useEsquema(): 'light' | 'dark'`, que reemplaza `useColorScheme()` en `ui.tsx`, `Logo` y `Croquis`.

- [ ] Paso 1: pruebas en `22-tema.ts`, que fallan:
  - `CLAVE_TEMA` igual a la de `web/lib/tema.ts`, leída como texto;
  - `leerPreferencia` y `temaEfectivo` dan lo mismo que la web en 6 casos;
  - ya no queda `useColorScheme(` fuera de `tema-preferencia.ts`;
  - Ajustes tiene "Tema" con "Claro", "Oscuro" y "Automático".
- [ ] Paso 2: falla.
- [ ] Paso 3: hacerlo.
- [ ] Paso 4: `npm run check` en `mobile/`.
- [ ] Paso 5: commit `feat(app): el tema claro, oscuro o automático, el mismo de OpMap`.

### Tarea 6: verificación, capturas y entrega

- [ ] `npm run check` en `web/` y en `mobile/`.
- [ ] Capturas con datos falsos (servidor local con Supabase falso), en escritorio y en celular, en claro y en oscuro:
  - el menú en acordeón con un grupo abierto;
  - una página aún no rehecha;
  - el ingreso;
  - Ajustes de la app con el tema.
- [ ] `CLAUDE.md`: una línea en "Reglas" con el tema por persona (`opmap.tema.v1`) y "la paleta es la de la app".
- [ ] Subagente `revisor` con la spec y el diff; corregir lo que afecte corrección o reglas.
- [ ] PR con la plantilla, CI en verde y publicar con el visto bueno del dueño.
