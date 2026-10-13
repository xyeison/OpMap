# 2026-10-12 – Cuando alguien se va o pierde una línea, ya no está; lo suyo pasa a otra persona en un paso

**Contexto**: en la Fase 1 de la app de visita quedó abierta la pregunta de qué hacer con los visitantes de un
médico cuando a la ejecutiva le quitan la línea o se da de baja (terminarlos solos o solo avisar con "Revisar").
Además, hoy no hay forma de pasar lo de una persona a otra: hay que hacerlo a mano en Ejecutivos Comerciales,
en la cobertura de cada línea y en cada médico, y la cobertura y el anexo de territorio no se actualizan solos.

**Decisión del dueño (2026-10-12)**: "si alguien se va o se le quita, pues ya no está; lo que toca más bien es
una solución para que todo eso pase fácilmente a uno nuevo".
1. **Si alguien se va o le quitan una línea, deja de tener lo de esa línea**: sus asignaciones de visitante se
   terminan y la cobertura deja de dársela. No se pregunta.
2. **Traspaso en un paso**: todo lo que tenía esa persona (sus líneas, su zona, sus médicos, sus ajustes
   manuales de cobertura y el nombre de su territorio) pasa a otra persona, a una persona nueva o a una vacante,
   con una sola acción y una vista previa antes de confirmar.

**Consecuencias**: dar de baja o quitar una línea pasa por el traspaso; una vacante guarda lo de quien se fue
hasta que se contrata a alguien; se guarda el historial de cada traspaso. Detalle de implementación y decisiones
menores en `docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md`.

**Dónde vive en el código**: migración `database/migrations/2026-10-12_0820_traspaso_ejecutivas.sql` (función
`ejecutivas_traspasar`, tabla `ejecutivas_traspasos`, disparadores que terminan visitantes), rutas
`/api/executives/[id]/traspaso` y `/api/executives/[id]/contratar`, asistente en `/executives`.
