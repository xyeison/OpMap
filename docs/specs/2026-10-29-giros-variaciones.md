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
- Arriba, una frase con el contexto: "El giro de las 600 IPS cargadas en OpMap subió 9,7 % (abr–sep 2026 frente a
  oct 2025 – mar 2026). En este filtro, con confianza alta: N por encima de ese ritmo y M por debajo." Los indicios
  (confianza media) se cuentan aparte.
- Una fila por prestador (NIT), con:
  - la IPS principal y el número de sedes, municipio y Zona (y el Ejecutivo Comercial si hay línea);
  - el giro antes y después, el cambio en pesos y en %, y el cambio frente al mercado;
  - la señal y la confianza;
  - las entidades que explican el cambio;
  - una minigráfica de los meses.
- Se puede ver las que suben, las que bajan o todas; con confianza o todas; y fijar el giro mínimo.
- Se ordena por cambio en pesos, en % o por confianza. Se exporta a CSV.

## Método (la recomendación; ajustado tras la revisión del 2026-10-29)
1. **Unidad: el NIT**, porque la ADRES gira al NIT. Si se filtra por municipio, la parte de cada NIT se reparte por
   camas, como en el resto de la página. El % no cambia con ese reparto. El tamaño mínimo se mide con el giro de todo el
   NIT.
2. **Ventana por defecto: los últimos 6 meses contra los 6 anteriores.**
   - 3 meses avisa antes, pero con más ruido.
   - Contra el año anterior se quita la estacionalidad (julio y diciembre traen pagos grandes). Con 18 meses cargados
     solo cabe para 3 y 6 meses.
3. **Mercado = todas las IPS cargadas en OpMap**, con la misma fuente y el mismo régimen. No es todo el país: la ADRES se
   consulta NIT por NIT para las IPS de OpMap. Una IPS solo es noticia si se separa de ese ritmo al menos un 10 %. Se
   reporta "frente al mercado": (1 + cambio) / (1 + cambio del mercado) − 1.
4. **Solo se comparan meses consultados.** Con la bitácora `adres_fetch_log` (consultas ok o sin registros) se dejan
   fuera, contados aparte, los NIT sin consulta en todos los meses comparados. Un mes sin consultar no es un mes sin
   giro; si no, una IPS creada después de la carga inicial o una consulta fallida darían "giros nuevos" o "baja".
5. **¿Cambio o vaivén?** Dos pruebas contra "creció como el mercado":
   - t de Welch sobre el giro mensual;
   - el mes reciente que más se aparta, frente a los meses de la comparación (t de predicción), corregido por haber
     elegido el más extremo de N meses (Šidák: 1 − (1 − p)^N).

   El valor p de la fila es mín(1, 2 × el menor de los dos): Bonferroni por usar dos pruebas.
6. **Muchas IPS a la vez.** Benjamini–Hochberg con TODAS las IPS cargadas que pasan el mínimo, aunque se filtre un
   municipio. Filtrar no le quita la corrección a nadie.
   - Confianza **alta**: q < 0,05.
   - **Media** (un "indicio", puede ser azar): p < 0,05.
   - **Baja**: el resto.

   Por defecto solo se listan las de confianza alta.
7. **Calibración.** Simulación en las pruebas, sin ningún cambio real, con 1.200 IPS que varían ±25 % al mes:
   - p < 0,05 en el 2,6 %;
   - ninguna con confianza alta.

   El primer diseño, que elegía la prueba según los datos, marcaba entre el 8 y el 16 %.
8. **Señal**:
   - Sube:
     - **sostenido**: 2 de cada 3 meses recientes, o más, por encima de lo esperado;
     - **pago grande en un mes**: un solo mes explica el 60 % o más del cambio frente al mercado. Es solo una etiqueta:
       la confianza sale del punto 5;
     - **sube**: el resto.
   - Baja, con las mismas tres.
   - "Crece menos que el mercado" o "cae menos que el mercado": cuando el mercado y la IPS van en direcciones distintas.
   - **Cambio pequeño**: significativo, pero a menos de 10 % del mercado.
   - **Giros nuevos** y **dejó de recibir**.
   - La tendencia de 12 meses (Mann–Kendall y pendiente de Sen) va en el CSV, como dato.
9. **Quién lo explica.** Se compara cada entidad ordenadora entre las dos ventanas y se muestran las 3 que más aportan
   en la dirección del cambio en pesos, marcando "nueva" (no giraba antes) y "dejó de girar". En el subsidiado la ADRES
   a veces registra el municipio o el departamento en vez de la EPS: se avisa en la nota.
10. **Tamaño mínimo.** Por defecto, al menos 100 M al mes en promedio en alguna de las dos ventanas, con el giro de todo
    el NIT. Opciones: todas, ≥ 100 M y ≥ 1.000 M al mes.

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
