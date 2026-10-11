---
name: verificar
description: Corre la verificación completa de OpMap (typecheck, lint, pruebas sin red) y, si hay cambios de UI, abre el preview para capturar evidencia. Úsalo antes de dar por terminado cualquier cambio de código.
---
# Verificar un cambio en OpMap

1. Desde `web/` ejecuta `GOOGLE_ROUTES_DISABLED=true npm run check` y pega las últimas líneas tal cual.
   Si falla, arregla la causa raíz (no silencies reglas ni pruebas) y vuelve a correrlo.
2. Si el cambio toca el motor de asignación, cobertura o municipios: comprueba que exista una prueba en
   `web/scripts/*-check.ts` que cubra la regla nueva; si no, añádela y vuelve a correr `npm run test`.
3. Si el cambio es visible (mapa, páginas, formularios): levanta el preview `opmap-web`, navega a la
   página afectada, revisa la consola y adjunta captura de escritorio y de celular (`resize_window`
   preset mobile). El mapa tiene reglas propias en móvil (`docs/mapa-estetica.md`).
4. Si hay migración SQL nueva: confirma que tiene rollback y que NO se aplicó; dilo en el resumen.
5. Resume: qué se verificó, con qué comando, y qué quedó sin verificar y por qué.
