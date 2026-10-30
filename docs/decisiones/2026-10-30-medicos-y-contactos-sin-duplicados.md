# 2026-10-30 – Médicos solo con CC o CE, contactos con teléfono o correo y la visita institucional siempre con contacto

**Contexto**: el dueño, el 2026-10-30:
- "Habilita que puedan crear los médicos pero que se tengan que crear con cédula o con cédula de extranjería para
  evitar duplicidad";
- "cuando vayan a crear una visita institucional deben indicar el contacto … deberán indicar teléfono y/o correo
  electrónico, con esto evitamos duplicidad";
- "En la web también, recuerda que son 1 sola tabla para web+app";
- al probar Agendar: "debería dejarme crearlo si no lo encuentra".

**Decisión**:
- **Médicos:**
  - se crean y se corrigen solo con cédula de ciudadanía (CC) o de extranjería (CE). Los guardados con otro tipo se
    ven igual; al corregir su documento hay que elegir CC o CE;
  - se crean desde la web (`/medicos`), desde Reportar y desde Agendar. Si el documento ya existe, se ofrece el
    médico que ya está.
- **El médico que crea una líder queda de sus líneas de líder** desde ese día (`medico_lineas`), para que pueda
  agendarlo y reportarlo enseguida (C9). La dirección le asigna el Ejecutivo Comercial visitante cuando quiera
  (decisión de Claude por encargo del dueño).
- **Contactos:**
  - nombre, y teléfono o correo (al menos uno), en la web y en la app;
  - si en la misma cuenta ya hay uno con ese teléfono (se comparan los dígitos) o ese correo, no se crea otro: se
    ofrece el que ya está;
  - el mismo teléfono en otra cuenta sí se permite (decisión de Claude).
- **Visita institucional:**
  - el contacto es obligatorio al reportar;
  - si no está, se crea ahí mismo ("Nuevo contacto");
  - la cita de Agendar no guarda contacto.
- Se borran, con respaldo, los 10 médicos de prueba (documento "otro") y lo que los usaba, todo de las pruebas del 13
  al 15 de octubre: vínculos médico-sede, visitantes, citas y 4 visitas anuladas.

**Consecuencias**:
- **Migración 0940** (rollback 9959), que se aplica solo con autorización del dueño:
  - tabla `medico_lineas`;
  - `medico_de_lineas`, con la misma firma, también la mira;
  - `contactos.telefono_digitos` e índices únicos por cuenta del teléfono y del correo;
  - CHECK "teléfono o correo" `NOT VALID`: no toca los 2 contactos viejos sin ninguno de los dos;
  - la limpieza de lo de prueba, con tablas `*_respaldo_20261030`.
- **Sin la 0940:**
  - todo funciona como antes;
  - el médico que crea una líder no queda de sus líneas, y Agendar lo dice;
  - los contactos repetidos los frena la API, pero no la base.
- Costo Google Maps: 0. Estética del mapa: no cambia. Permisos: los de hoy (`terceros:create` para crear).
- **Descartado por ahora:** aceptar pasaporte, PEP o PPT (es cambiar una línea si el dueño lo pide), y fusionar
  médicos o contactos ya repetidos (hoy no hay).

**Dónde vive en el código**:
- **Web:**
  - `web/lib/terceros.ts` (`TIPOS_DOC_MEDICO_NUEVO`, `digitosTelefono`, `mismoContacto`) y `terceros-schemas.ts`;
  - `POST/PATCH /api/terceros/contactos` (409 con `existente`) y `POST /api/terceros/medicos` (`medico_lineas`);
  - `lib/persona-campo.ts` (`medicoDeLineas` con las líneas propias), `visitaCreateSchema` (contacto obligatorio);
  - `/medicos`.
- **App:** `agenda/nueva.tsx` ("Crear médico"), `contacto/nuevo.tsx`, `validarBorrador` (contacto obligatorio).
- **Pruebas:**
  - web: `terceros-check`, `terceros-api-check`, `persona-campo-check`, `reporte-check`, `reporte-api-check` y
    `menu-check`;
  - app: `mobile/scripts/checks` 16, 17 y 19.
- **Spec:** `docs/specs/2026-10-30-medicos-y-contactos-sin-duplicados.md`.
