# Spec: el croquis también en "Revisa la visita", la sede elegida manda y una bolita "En rango / Fuera de rango"  (2026-10-31)

**Estado**: aprobada por el dueño (2026-10-31, por voz desde el teléfono) | implementada (PR pendiente)

## Problema
Pedido del dueño (2026-10-31): "La ventana donde se reporta debería aparecer también el mapita arriba y el círculo
verde (…) y el punto del lugar donde vamos a reportar. Si está por fuera del rango, ahí se le informa; si está dentro
del verde, está ok. Una advertencia muy sencillita: una bolita roja con 'fuera de rango' o 'en rango', y que aparezca
el puntico del comercial."

Y al probar: "Me voy a reportar OINSAMED y sale Portoazul porque vivo cerca de Portoazul". Hoy `planCroquis` descarta
la sede pedida (la de la cita o la elegida) cuando queda a más de `MAXIMO_CROQUIS_M` (3 km) y pone el foco en la más
cercana a ti: con la cita en Clínica Misericordia (4,8 km) el croquis dibuja el radio de Portoazul, que no tiene nada
que ver con lo que se va a reportar.

Además, en la fase "Revisa la visita" (tarjetas) el croquis no se dibuja: solo sale mientras se elige.

## Resultado esperado
- El croquis sale también en "Revisa la visita", con la sede de la primera tarjeta abierta (la que se confirma desde
  el pie) como foco, su radio presencial y tu punto. Si cambias la sede en la tarjeta, el croquis la sigue.
- **La sede pedida manda siempre**: la de la cita, la elegida o la de la tarjeta. Si queda lejos (más de lo que cabe a
  la escala máxima), el croquis se centra en ESA sede con su radio y tu punto se dibuja pegado al borde, en la dirección
  en que estás, con la etiqueta "Estás a 4,8 km" en vez de "Estás aquí · ±13 m". Sin sede pedida, sigue la más cercana.
- Arriba a la derecha del croquis, una pastilla con una bolita y un texto corto:
  - verde "En rango" cuando, descontando la precisión del GPS como el servidor (0940), estás dentro del radio;
  - roja "Fuera de rango · 4,8 km" cuando no;
  - gris "Sin ubicación" si el teléfono no dio el punto, y gris "Sede sin ubicación" si la sede no tiene coordenadas;
  - nada si no hay sede elegida ni cita, ni si la distancia la va a calcular el servidor (sede traída sin coordenadas
    conocidas), ni en una visita telefónica.
- "Estás aquí" no tapa la pastilla (entra en lo que la etiqueta evita, como el logotipo de Hoy).

## Criterios de aceptación (se convierten en pruebas)
- [ ] `planCroquis` con `foco: 'reina'` (6,6 km) → el foco ES Reina Catalina, se dibuja con su radio, y tu punto queda
      dentro del cuadro pegado al borde (`yo.enBorde = true`); sin `foco`, sigue la más cercana (como antes).
- [ ] Con foco lejos, `etiquetaYoDelPlan` devuelve "Estás a 6,6 km"; con foco cerca, la etiqueta que pasó la pantalla.
- [ ] `estadoDeRango`: a 250 m con ±10 m y radio 300 → en rango; a 305 m con ±10 m → en rango (descuenta la precisión);
      a 4.800 m → fuera, texto "Fuera de rango · 4,8 km"; sin punto → "Sin ubicación"; sede sin coordenadas → "Sede sin
      ubicación"; distancia desconocida (el servidor la calcula) → null; telefónica → null.
- [ ] Reportar pinta `<Croquis` también con `fase === 'tarjetas'` (foco: la sede de `borradores[0]`) y le pasa la
      pastilla (`arribaDerecha`); en "lista" la pastilla sale solo con cita o sede elegida.
- [ ] Croquis.tsx mete la caja de la pastilla en `evitar` de `posicionEtiquetaYo`.

## Fuera de alcance
- Cambiar la regla del servidor (0940: `en_sitio` con radio 300 m descontando la precisión). La pastilla la imita.
- Un mapa de calles: el croquis sigue sin Google ni llaves.
- Hoy (hoy.tsx) no se toca, pero usa el mismo `planCroquis` y pide como foco la sede de la siguiente cita: si esa
  cita queda lejos, ahora se dibuja ella con tu punto al borde (antes, la más cercana), y si su sede no tiene
  coordenadas, no se dibuja ningún radio (antes, el de la más cercana). Es la misma regla: la sede pedida manda.
- "Lejos" se decide por si tu punto cabe en el dibujo a la escala máxima (en vertical caben menos metros), no por una
  distancia fija; tu punto al borde no se mete debajo del logotipo ni de la pastilla, y el nombre de la sede baja si
  arriba chocaría con la pastilla (revisor, 2026-10-31).

## Impacto
- Datos / migración: no.
- Costo Google Maps: ninguno.
- Estética del mapa (OpMap web): no cambia. Es el croquis de la app.
- Permisos / roles: ninguno.

## Plan (archivos e interfaces)
- `mobile/lib/croquis.ts`: la pedida manda (`seVe` solo para la más cercana); modo "lejos" (centro en la sede,
  tu punto proyectado al borde, `yo.enBorde`); `etiquetaYoDelPlan(plan, etiqueta)`.
- `mobile/lib/rango-sede.ts` (nuevo, puro): `estadoDeRango({ punto, distanciaM, conocida, sedeConCoordenadas,
  radioM, telefonica })` → `{ tono, texto } | null`.
- `mobile/components/Croquis.tsx`: prop `arribaDerecha`, `PastillaRango`, etiqueta de tu punto por `etiquetaYoDelPlan`.
- `mobile/app/(app)/reportar.tsx`: croquis en "tarjetas" (foco = sede de la primera tarjeta), pastilla en las dos fases.
- Pruebas: `mobile/scripts/checks/24-rango.ts` (nuevo, registrado en `correr.ts` y `movil-check.ts`) y el caso
  "lejos" de `20-estilo.ts` cambia de sentido.
- `mobile/README.md`: paso 8 de la lista de pruebas en el teléfono.

## Verificación final
`npm run check` en `mobile/`. Prueba del dueño: cita en Clínica Misericordia desde la casa (cerca de Portoazul): el
croquis muestra Misericordia con su círculo, tu punto al borde y "Fuera de rango · 4,8 km"; en "Revisa la visita" el
croquis sigue arriba.
