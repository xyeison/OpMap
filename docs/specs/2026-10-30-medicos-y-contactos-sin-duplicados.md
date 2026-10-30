# Spec: médicos y contactos sin duplicados  (2026-10-30)

**Estado**: pedido del dueño del 2026-10-30; a la forma propuesta dijo "Sí, hazlo todo". Implementado en la rama
`feat/medicos-contactos`; la migración 0950 está escrita y sin aplicar (necesita la autorización del dueño). Las
decisiones marcadas "(Claude)" las tomó Claude por encargo del dueño, y él las puede cambiar.

## Problema
El dueño, el 2026-10-30:
- "Habilita que puedan crear los médicos pero que se tengan que crear con cédula o con cédula de extranjería para evitar
  duplicidad";
- "cuando vayan a crear una visita institucional deben indicar el contacto … deberán indicar teléfono y/o correo
  electrónico";
- sobre dónde: "En la web también, recuerda que son 1 sola tabla para web+app";
- al probar Agendar en la app: "debería dejarme crearlo si no lo encuentra".

Lo que había hoy:
- **Médicos:**
  - la app crea médicos solo desde Reportar y ya exige documento, pero acepta pasaporte, PEP, PPT y "otro";
  - la web los tiene en "Próximamente" desde el 2026-10-29;
  - en Agendar no se puede crear un médico.
- **Contactos:**
  - un contacto solo pide el nombre;
  - la visita institucional no exige contacto;
  - la app no puede crear contactos.

## Resultado esperado
1. **Médicos, una sola tabla para la web y la app:**
   - `/medicos` vuelve a la web con lista, buscador, crear y detalle;
   - la app crea médicos desde Reportar y desde Agendar ("Crear médico" cuando no está en la lista ni en OpMap);
   - crea quien tiene `terceros:create`, como hoy.
2. **Documento del médico:** obligatorio, y solo cédula de ciudadanía (CC) o cédula de extranjería (CE), al crear y al
   corregir.
   - Si ese tipo y número ya existe, se ofrece el médico que ya está, como hoy.
   - Los médicos guardados con otro tipo se siguen mostrando con su tipo.
3. **El médico que crea una líder queda de sus líneas de líder** desde ese momento, así puede agendarlo y reportarlo
   enseguida (C9). La dirección le asigna el Ejecutivo Comercial visitante cuando quiera (Claude).
4. **Contactos:**
   - teléfono o correo obligatorio (al menos uno), en la web y en la app;
   - si en la misma cuenta ya hay un contacto con ese teléfono (se comparan los dígitos) o ese correo, se ofrece el que ya
     está y no se crea otro (409 con `existente`, como los médicos);
   - el mismo teléfono en otra cuenta sí se permite (Claude).
5. **Visita institucional:**
   - el contacto es obligatorio al reportar, en la API y en la app;
   - en la app, la tarjeta institucional ofrece "Nuevo contacto" (nombre, cargo, teléfono y/o correo) cuando no está en
     la lista;
   - al agendar no se pide: la cita no guarda contacto.
6. **Limpieza de los datos de prueba** (el dueño, 2026-10-29: "el tema de médicos, bórralos"). Se borran con respaldo los
   10 médicos de prueba (documento "otro") y lo que los usa, todo de las pruebas del 13 al 15 de octubre:
   - 11 vínculos médico-sede;
   - 20 visitantes;
   - 23 citas;
   - 4 visitas anuladas de la app.

## Criterios de aceptación (pruebas)
- [ ] Crear o corregir un médico con PA, PEP, PPT u "otro" → 400 con un mensaje claro; con CC o CE → como hoy
      (`web/scripts/terceros-check.ts` y `terceros-api-check.ts`).
- [ ] Un médico creado por una líder (con líneas de líder) queda con esas líneas (`medico_lineas`):
  - `medicoDeLineas` lo cuenta;
  - "mis médicos" de la líder lo trae;
  - agendarlo como líder → 201;
  - el de otra persona sin visitante, no (`persona-campo-check` y `reporte-api-check`).
- [ ] Un contacto sin teléfono ni correo → 400. Repetido en la misma cuenta (los mismos dígitos o el mismo correo sin
      importar mayúsculas) → 409 con `existente`. En otra cuenta → 201.
- [ ] Una visita institucional sin `contacto_id` → 400 en `contacto_id`; con el contacto de su cuenta → 201
      (`reporte-api-check`).
- [ ] App:
  - Agendar ofrece "Crear médico" y vuelve con el médico elegido;
  - Nuevo médico solo ofrece CC y CE;
  - la tarjeta institucional exige el contacto y ofrece "Nuevo contacto" (`mobile/scripts/checks`).
- [ ] Web: `/medicos` muestra la lista y crea con CC o CE (`menu-check` sin "Próximamente" en Médicos).
- [ ] La migración trae su bloque de pruebas que se deshace.

## Fuera de alcance
- Asignar o cambiar visitantes: sigue siendo de la dirección.
- Aceptar PPT o pasaporte: es cambiar una línea si el dueño lo pide.
- Fusionar contactos o médicos que ya estén repetidos: hoy no hay.

## Impacto
- **Migración `0950_medicos_contactos`** (rollback `9960`), solo con la autorización del dueño:
  - tabla `medico_lineas`;
  - `medico_de_lineas` también mira esa tabla;
  - `contactos.telefono_digitos`, generada;
  - índices únicos por cuenta del teléfono y del correo;
  - la limpieza de lo de prueba, con tablas de respaldo.
- Costo Google Maps: 0. Estética del mapa: no cambia. Permisos: los de hoy.
- Decisión: `docs/decisiones/2026-10-30-medicos-y-contactos-sin-duplicados.md`.

## Plan
`docs/planes/2026-10-30-medicos-y-contactos-sin-duplicados.md`.

## Verificación final
- `npm run check` en `web/` y en `mobile/`.
- Capturas de `/medicos` (local, datos falsos) y de Agendar → "Crear médico" y de "Nuevo contacto" en la app, contra el
  servidor falso.
