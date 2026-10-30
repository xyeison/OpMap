# Spec: IPS con variaciones fuera de lo normal en sus giros ADRES, y elegir el año en el filtro  (2026-10-29)

**Estado**: pedido del dueño del 2026-10-29. Él pide la recomendación del método; queda escrita abajo.

## Problema
Dos pedidos del dueño:
- "En la inteligencia de giros… nada más puedo escoger el mes y no puedo cambiar el año."
  - Los filtros "Desde (mes)" y "Hasta (mes)" son `<input type="month">`. Cada navegador los pinta distinto (Safari en
    Mac ni siquiera los tiene).
  - Para cambiar el año hay que acertarle a la cifra del año o a unas flechas pequeñas.
  - El rango está limitado a lo cargado (Identifica tu Giro: abr-2025 a sep-2026).
- "Un reporte que me detecte bajo modelos estadísticos IPS que tienen porcentajes de variación interesantes dependiendo
  del rango de fechas: los últimos seis meses, los últimos tres meses… dame tú la recomendación."
  - Hoy solo se ve el giro acumulado de un rango; no hay comparación ni alertas.
  - Una prueba a mano del 2026-10-29 encontró IPS con +80 % a +98 % en un semestre. El mercado entero creció cerca de
    +10 % en el mismo semestre y +16 % contra el año anterior.

## Resultado esperado
**1. Período del filtro.** Un selector "Período" con:
- últimos 3, 6 y 12 meses;
- todo lo cargado;
- cada año con datos (con los meses que tiene);
- "Personalizado", que abre Desde y Hasta con dos listas cada uno, mes y año.

Solo se pueden elegir meses con datos de la fuente. Funciona igual en todos los navegadores y en el celular.

**2. Sección "IPS con cambios fuera de lo normal"** en Inteligencia › Giros, con los mismos filtros de arriba: línea,
departamento, municipio, régimen, fuente y el mes "hasta".
- Compara los últimos 3, 6 o 12 meses contra los N meses anteriores, o contra los mismos meses del año anterior.
  - Si no hay datos suficientes, la opción queda apagada con el porqué. Ejemplo: 12 meses contra 12 pide 24 meses de
    giros y hoy hay 18.
- Arriba, una frase con el contexto: "El giro de todas las IPS del país subió 9,7 % (abr–sep 2026 frente a oct
  2025–mar 2026). 23 IPS subieron bastante más que eso y 8 bajaron."
- Una fila por prestador (NIT), con:
  - la IPS principal y el número de sedes, municipio y Zona (y el Ejecutivo Comercial si hay línea);
  - el giro antes y después, el cambio en pesos y en %, y el cambio frente al mercado;
  - la señal y la confianza;
  - las entidades que explican el cambio;
  - una minigráfica de los meses.
- Se puede ver las que suben, las que bajan o todas; con confianza o todas; y fijar el giro mínimo.
- Se ordena por cambio en pesos, en % o por confianza. Se exporta a CSV.

## Método (la recomendación)
1. **Unidad: el NIT**, porque la ADRES gira al NIT. Si se filtra por municipio, la parte de cada NIT se reparte por
   camas, como en el resto de la página. El % no cambia con ese reparto.
2. **Ventana por defecto: los últimos 6 meses contra los 6 anteriores.**
   - 3 meses avisa antes, pero con más ruido.
   - Contra el año anterior se quita la estacionalidad (diciembre y julio traen pagos grandes). Con 18 meses cargados
     solo sirve para 3 y 6 meses.
3. **Ajuste por mercado.** El total del país, con la misma fuente y el mismo régimen, crece por la UPC y por los pagos
   de la ADRES. Una IPS solo es noticia si se separa de eso. Se reporta el % propio y el "frente al mercado":
   (1 + cambio) / (1 + cambio del mercado) − 1.
4. **¿Es cambio o vaivén?** Prueba t de Welch sobre los giros mensuales.
   - La hipótesis nula es que la IPS creció igual que el mercado.
   - Da un valor p de dos colas.
5. **Muchas IPS a la vez.** Con unas 560 pruebas, el 5 % de falsos positivos son unas 28 IPS. Se corrige con
   Benjamini–Hochberg (valor q).
   - Confianza **alta**: q < 0,05.
   - **Media**: p < 0,05 pero q ≥ 0,05.
   - **Baja**: el resto.
6. **Tendencia.** Mann–Kendall sobre los últimos 12 meses (o los que haya), con la pendiente de Sen como % del giro
   mensual típico. "Sostenido" = tendencia con p < 0,05 en la misma dirección.
7. **Señal**:
   - Sube:
     - **sostenido**: con tendencia;
     - **en un mes**: un solo mes explica el 60 % o más del aumento, como un pago extraordinario;
     - **escalón**: el resto.
   - Baja, con las mismas tres.
   - **Giros nuevos**: no tenía giros antes.
   - **Dejó de recibir**: no tiene giros ahora.
   - **Sin cambio claro**.
8. **Quién lo explica.** Se compara cada entidad ordenadora entre las dos ventanas y se muestran las 3 que más aportan
   en la dirección del cambio, marcando "nueva" (no giraba antes) y "dejó de girar". En el subsidiado la ADRES a
   veces registra el municipio o el departamento en vez de la EPS: se avisa en la nota.
9. **Tamaño mínimo.** Por defecto, al menos 100 M al mes en promedio en alguna de las dos ventanas. Así no aparecen
   prestadores diminutos con +900 %. Opciones: todas, ≥ 100 M y ≥ 1.000 M al mes.

## Criterios de aceptación (pruebas puras, `web/scripts/giros-variacion-check.ts`)
- [ ] Ventanas:
  - 6 contra 6 anteriores y contra el año anterior;
  - 3 contra 3;
  - error claro si no hay meses suficientes;
  - la tendencia toma hasta 12 meses.
- [ ] Estadística contra valores de referencia:
  - CDF de t de Student y beta incompleta;
  - Welch (con varianza cero);
  - Mann–Kendall con empates;
  - pendiente de Sen;
  - Benjamini–Hochberg.
- [ ] Clasificación:
  - una IPS que sube parejo da "sube sostenido" con confianza;
  - un pago único da "en un mes";
  - una IPS que crece como el mercado da "sin cambio";
  - giros nuevos y dejó de recibir;
  - el mínimo deja por fuera las pequeñas y las cuenta.
- [ ] Entidades:
  - las 3 que más aportan, en la dirección del cambio;
  - marcas "nueva" y "dejó de girar";
  - reparto por camas al filtrar por municipio.
- [ ] Período del filtro: los presets y los años salen del rango disponible, y "Personalizado" no deja elegir meses
  sin datos.

## Fuera de alcance
- Alertas por correo o notificación.
- Guardar el historial de alertas.
- Contratos nuevos del SECOP: es otro pedido de la lista.
- Mezclar Reporte 29 e Identifica en una misma comparación: miden cosas distintas.

## Impacto
- Datos / migración: no. Usa la RPC `adres_giros_intel` existente: 2 o 3 llamadas por consulta, una por ventana de
  meses.
- Costo Google Maps: 0. Estética del mapa: no cambia.
- Permiso: `intelligence:view`, como el resto de la página.

## Plan (archivos)
- `web/lib/giros-variacion.ts`: ventanas, estadística, análisis por NIT y presets del período. Es puro.
- `web/app/api/intelligence/giros/variacion/route.ts`: GET. Elige la fuente con la misma regla que `/giros`; el helper
  compartido va en `_lib/giros-server.ts`.
- `web/components/GirosVariaciones.tsx`: la sección, con la tabla, la minigráfica y el CSV.
- `web/components/PeriodoGiros.tsx`: el selector de período; reemplaza los `type="month"` de `app/inteligencia/page.tsx`.
- Pruebas: `web/scripts/giros-variacion-check.ts`, dentro de `npm run test`.

## Verificación final
- `npm run check`.
- Preview de `/inteligencia` en escritorio y en celular: elegir el año, presets y la sección con datos reales.
