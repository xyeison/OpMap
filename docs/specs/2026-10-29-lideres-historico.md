# Spec: seguimiento de las líderes con el histórico del Excel "Tracker Líderes"  (2026-10-29)

**Estado**: pedido del dueño del 2026-10-29. Decisión: `docs/decisiones/2026-10-29-historico-tracker-lideres.md`
(reemplaza la A15 del 2026-10-15).

## Problema
La directora comercial lleva en un Excel lo que hacen sus 5 líderes. El dueño quiere que el seguimiento viva en OpMap:
- las líderes reportarán en la app (fases de `docs/specs/2026-10-15-actividades-de-campo.md`, que empiezan con F1a en el
  PR #48);
- "dejar también la data que está en el Excel".

Mientras la app no esté lista, la directora sigue con el Excel y no tiene en OpMap dónde verlo.

## Resultado esperado
- En "Líderes de negocio" (`/lideres`, menú Empleados), con el permiso `lideres:seguimiento` (administrador y dirección
  comercial), el seguimiento de las líderes. Para los demás sigue "Próximamente".
- **"Subir el Excel"**: el navegador lee la hoja REGISTRO.
  - Se queda con fecha, líder, ciudad, tipo, estado, cuántos contactos y si había observación. Los nombres de médicos y
    las observaciones no salen del navegador.
  - Vista previa: cada líder del Excel con su usuario de OpMap, las ciudades que no son un municipio de Colombia, los
    estados y las fechas ilegibles.
  - "Guardar en OpMap" reemplaza el histórico completo: el Excel manda.
  - Sin la migración 0920, la vista previa funciona y guardar no (se explica en pantalla).
- **Vistas**, las del tablero de prueba, por período (este mes, 3 meses o todo) y por líder:
  - una frase con lo principal;
  - 6 cifras;
  - dónde está cada una (una semana atrás y dos adelante);
  - cumplimiento por líder;
  - realizadas por mes;
  - tipos;
  - ciudades;
  - lo que el Excel deja escribir mal.

## Reglas
- **Líder** = usuario activo cuyo nombre contiene todas las palabras del nombre del Excel. Primero se busca entre las
  líderes de negocio; si hay dos o ninguna, no se adivina, y guardar se rechaza nombrándola.
- **Ciudad** = código DANE por alias verificado o nombre exacto (si hay varias con ese nombre, la capital). Nunca por
  parecido. Lo que no se reconoce queda con su texto.
- **Estado**:
  - "Exitosa" = realizada;
  - "Cancelada" = cancelada;
  - vacío con fecha posterior al día de la carga = planificada;
  - vacío con fecha pasada o ilegible = sin cerrar.
- **Fecha**: número de serie de Excel, fecha, dd/mm/aaaa o aaaa-mm-dd. Si no se lee, se guarda el texto.

## Criterios de aceptación (pruebas: `web/scripts/lideres-historico-check.ts`)
- [x] Lectura de la hoja: fechas, tipos (de la lista y a mano), estados, contactos contados sin nombres y ningún texto
  de médicos ni observaciones en lo que se manda.
- [x] Reconocer líder y ciudad; validación de la carga, que rechaza campos de más.
- [x] Cifras del seguimiento: resumen por período y líder, mes, tipo, ciudad, agenda y calidad.
- [x] Servidor:
  - la vista previa no escribe;
  - una líder desconocida da 400;
  - sin la 0920 da 503;
  - al guardar, cada fila lleva su usuario y su código;
  - la lectura trae los nombres de OpMap.
- [x] Menú: `/lideres` con `lideres:seguimiento` solo para admin y dirección comercial.

## Impacto
- Datos: migración `0920_lideres_historico` con rollback `9957`, sin aplicar (autorización del dueño). La tabla
  `lideres_historico` es una copia derivada del Excel, y cada carga queda en `lideres_historico_cargas`.
- Costo Google Maps: 0. Estética del mapa: no cambia.

## Verificación final
- `npm run check`.
- Preview de `/lideres` con un Excel de prueba de 263 filas, de la misma forma que el real y sin nombres. La vista
  previa reconoce a las 5 líderes y da las mismas cifras que el tablero de prueba. En el celular no hay desplazamiento
  horizontal de la página.
