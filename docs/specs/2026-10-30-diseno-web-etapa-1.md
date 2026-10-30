# Spec: OpMap con el diseño de la app (tipo Uber) · etapa 1: el armazón y el tema  (2026-10-30)

**Estado**: aprobada por el dueño el 2026-10-30 con comentarios ("apruebo entonces la etapa uno de diseño con los
comentarios que te hice"). Maqueta con datos inventados: `docs/specs/2026-10-30-diseno-web-etapa-1-maqueta.jpg`.

**Comentarios del dueño (2026-10-30), que mandan sobre la maqueta:**
- "no veo todas las opciones que tenemos ya en la aplicación web": el menú lleva TODAS las opciones que cada rol tiene
  hoy, las mismas de `getNavigationMenu` (la maqueta mostraba solo unas);
- "deberíamos tener como un acordeón vertical de los títulos de los menús. Si le doy click, me salen los submenús":
  - cada grupo (Terceros, Empleados, Inteligencia de Mercado, Configuración) es un título que se abre y se cierra;
  - las opciones sueltas (Agendamiento, Mapa, Calendario, Zonas, Líneas) van siempre a la vista;
  - el grupo de la página abierta empieza abierto;
- "tenemos que tener la opción de agendamiento": Agendamiento sigue de primera para quien usa la app (las líderes).

## Problema
El dueño, el 2026-10-30:
- "todo debe estar pensado para el celular y debe tener un mismo diseño";
- "no debes sentir que está usando dos cosas distintas … vamos a inclinarnos por el diseño que ya habíamos logrado, tipo
  Uber";
- "Considera modo dark y día, opciones para que elijan cada usuario".

Hoy:
- la app de campo usa la dirección A, tipo Uber (`mobile/lib/paleta.ts`, elegida el 2026-10-15): negro y blanco, DM
  Sans, botones negros de 52 px, rellenos #EEEEEE y modo oscuro según el teléfono;
- OpMap web usa otra cosa: letra Inter, encabezados con degradado gris, azul de Tailwind y ningún modo oscuro;
- nadie puede elegir el tema: la app sigue al teléfono.

## Resultado esperado
Por etapas, una por PR, para no cambiar todo de golpe. Esta es la etapa 1.

1. **Los mismos papeles de color en la web**:
   - `fondo`, `superficie`, `texto`, `acento`, `relleno`, `borde`, `exito`, etc., con los valores de
     `mobile/lib/paleta.ts`, en claro y oscuro;
   - en la web son variables CSS y Tailwind las usa por nombre (`bg-fondo`, `text-texto`, `bg-acento`…);
   - un solo origen: una prueba exige que la web y la app tengan los mismos valores.
2. **La letra DM Sans** en toda la web (hoy Inter).
3. **El armazón nuevo**, como en la maqueta y con los comentarios:
   - barra de arriba blanca (negra en oscuro) con "OpMap";
   - en el celular, el menú en un cajón; en escritorio, fijo a la izquierda, salvo en el Mapa: allí sigue el cajón y la
     barra conserva su alto, para que el mapa no cambie;
   - el menú en acordeón: los títulos de grupo se abren y se cierran;
   - lo elegido va en negro (blanco en oscuro) y las filas tienen al menos 44 px de alto.
   - El inicio de sesión, con el mismo estilo.
4. **El tema lo elige cada persona**:
   - "Claro", "Oscuro" o "Automático" (el del teléfono o el computador), al final del menú en la web y en Ajustes
     de la app;
   - se guarda en ese navegador o teléfono y vale para OpMap y la app en el mismo navegador (la misma clave
     `opmap.tema.v1`);
   - por defecto, Automático, como hoy la app.
   - No se guarda en la base: no hace falta migración. Si el dueño quiere que siga a la persona de un aparato a otro,
     es una etapa aparte.
5. **Las páginas que esta etapa no rehace** se ven en claro, aunque el tema sea oscuro, hasta su etapa. Así ninguna
   queda a medias: texto negro sobre fondo negro, por ejemplo.

## Criterios de aceptación (pruebas)
- [ ] `web/lib/tema.ts` (puro):
  - los valores de los papeles en claro y oscuro son, letra por letra, los de `mobile/lib/paleta.ts`;
  - `temaEfectivo('auto', prefiereOscuro)` da 'oscuro' o 'claro';
  - lo guardado ilegible vale 'auto'.
- [ ] Contraste WCAG en la web, igual que en la app (`20-estilo`):
  - texto ≥ 4,5:1 sobre fondo y superficie;
  - borde de los campos ≥ 3:1;
  - lo elegido frente a lo no elegido ≥ 3:1, en los dos temas.
- [ ] El tema se aplica antes de pintar: un script en `<head>` pone `data-tema` en `<html>`, para que no haya destello
      blanco en oscuro. Cambiarlo en el menú cambia la página sin recargar. La app lee y escribe la misma clave.
- [ ] Menú (`menu-check`):
  - los mismos grupos y opciones de hoy, para cada rol;
  - "Agendamiento" sigue abriendo la app;
  - el selector de tema está en el menú para todos los roles.
- [ ] Sin "KAM", "Vacante" ni "panel" en lo visible (las pruebas de siempre).
- [ ] El mapa no cambia: `mapa-estilo-check` sigue igual y `/map` no lleva clases de tema.
- [ ] Capturas de escritorio y celular, en claro y en oscuro: el menú, una página rehecha y una que todavía no.

## Fuera de alcance (etapas siguientes, cada una con su PR)
- Rehacer cada página por dentro, en este orden propuesto:
  - Zonas y Ejecutivos Comerciales;
  - Médicos, Cuentas clave e IPS;
  - Líderes y Visitas;
  - Inteligencia;
  - Configuración y el resto.
- **El mapa**: su estética está autorizada (2026-10-11). Su leyenda, filtros y tarjetas solo cambian si el dueño lo
  autoriza aparte.
- Guardar el tema por persona en la base.

## Enfoques considerados
1. **Variables CSS con los papeles de la app + Tailwind por nombre** (recomendado). Se cambia el armazón ahora y cada
   página después, sin reescribir la lógica, y el modo oscuro sale de los mismos papeles.
2. **Una librería de componentes** (shadcn/ui o similar). Trae su propio estilo, que habría que deshacer para que se
   parezca a la app, y es una dependencia grande.
3. **Hacer la web dentro de la app** (Expo en el navegador). Sería un solo código, pero la web tiene tablas, el mapa y
   páginas de escritorio que la app no tiene: reescribir todo. Descartado.

## Impacto
- Datos o migración: no. Costo Google Maps: 0. Estética del mapa: no cambia. Permisos: no cambian.

## Plan
`docs/planes/2026-10-30-diseno-web-etapa-1.md`, cuando el dueño apruebe esta spec.

## Verificación final
`npm run check` en `web/` y `mobile/`, y las capturas de los criterios.
