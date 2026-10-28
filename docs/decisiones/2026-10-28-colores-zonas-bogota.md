# 2026-10-28 – Colores nuevos para las 4 zonas de Bogotá en la vista de Zonas

**Contexto**: mientras se arreglaba el reparto por corredores, el dueño pidió: "Cambia los tonos de los colores de
4 zonas de bogotá para que se diferencie". En la vista de Zonas (`kams.color`), los colores de Bogotá se
confundían con las zonas vecinas, sobre todo con el relleno suave (0.22) de los municipios sin IPS. Diferencia
de color medida (ΔE 2000, mezclada con el fondo del mapa): Engativá frente a Cúcuta 1,7 (casi iguales); Chapinero
frente a Medellín 4,2 y frente a Pereira 4,4; Kennedy frente a Bucaramanga 4,6; Chapinero frente a San Cristóbal
11,5.

**Decisión** (autorización explícita del dueño para este cambio de colores; los colores los eligió Claude):

| Zona (corredor) | Antes | Ahora |
|---|---|---|
| Chapinero (norte) | `#FD79A8` rosado | `#2563EB` azul |
| Engativá (occidente) | `#FDCB6E` amarillo | `#16A34A` verde |
| Kennedy (sur) | `#00D2D3` turquesa | `#DC2626` rojo |
| San Cristóbal (oriente) | `#6C5CE7` morado azulado | `#9333EA` morado |

Con estos colores, la diferencia mínima entre las 4 zonas de Bogotá es 13,1 y frente a las zonas que limitan
con cada cuadrante es 11,3 (antes 11,5 y 1,7). San Cristóbal sigue morado, como el dueño ya lo reconoce.

**Consecuencias**:
- Cambio de datos (`kams.color` de 4 filas, aplicado el 2026-10-28), igual que si se editara en
  `/kams/colors`. Para volver atrás basta con poner los colores de la columna "Antes".
- En este paso solo cambió la vista de Zonas; la vista por línea pintaba con el color del Ejecutivo Comercial
  (`executives.color`) y sus tonos por zona. *Superado el mismo día* por
  `docs/decisiones/2026-10-28-mapa-un-color-por-zona.md`: las dos vistas usan `kams.color`. El gris por Zona de "Sin
  cobertura" toma el matiz de `kams.color`, así que en Bogotá ese gris cambia levemente (saturación 8 %).
- Nada más de la estética autorizada (opacidades, bordes, capas, marcadores) cambia.

**Dónde vive**: datos en `kams.color`; reglas de color en `docs/mapa-estetica.md`.
