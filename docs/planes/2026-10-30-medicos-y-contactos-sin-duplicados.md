# Plan: médicos y contactos sin duplicados  (2026-10-30)

Spec: `docs/specs/2026-10-30-medicos-y-contactos-sin-duplicados.md`. En cada paso va primero la prueba que falla.

1. **Documento CC o CE** (`web/lib/terceros.ts` y `web/lib/terceros-schemas.ts`)
   - Prueba en `terceros-check.ts`: crear, corregir y verificar con PA, PEP, PPT u "otro" → error; con CC y CE, bien.
   - Código:
     - `TIPOS_DOC_MEDICO_NUEVO` (CC y CE) para crear, corregir y verificar;
     - `TIPOS_DOC_MEDICO` sigue para las etiquetas de lo guardado.
2. **Contactos con teléfono o correo y sin repetir por cuenta**
   - Pruebas:
     - `terceros-check.ts`: `contactoCreateSchema` sin teléfono ni correo → error; `digitosTelefono`;
     - `terceros-api-check.ts`: POST repetido en la misma cuenta → 409 con `existente`; en otra cuenta → 201;
       corregir y quitar los dos → 400.
   - Código: el esquema, `POST /api/terceros/contactos` (buscar el repetido antes) y PATCH.
3. **Migración 0940** (rollback 9959)
   - `medico_lineas` (medico_id, line_id, user_id, desde), con su llave y sus FK.
   - `medico_de_lineas`, con la misma firma, también mira `medico_lineas` desde su `desde`.
   - `contactos.telefono_digitos`, generada, y los índices únicos parciales por cuenta (dígitos y `lower(email)`).
   - La limpieza de lo de prueba, con respaldo.
   - Bloque DO de pruebas que se deshace.
4. **El médico que crea una líder es de sus líneas**
   - Pruebas en `persona-campo-check.ts` (`medicoDeLineas` y `lineasDelMedico` con `medico_lineas`) y en
     `reporte-api-check.ts`:
     - la líder crea el médico → queda en sus líneas;
     - agendarlo → 201;
     - "mis médicos" lo trae.
   - Código: el espejo en `lib/persona-campo.ts`; `POST /api/terceros/medicos` inserta `medico_lineas` con las líneas de
     líder de quien crea; `medicosDeLineas` del contexto.
5. **Visita institucional con contacto**
   - Prueba en `reporte-api-check.ts`: sin `contacto_id` → 400 en `contacto_id`.
   - Código: `visitaCreateSchema` y `validarVisita`.
6. **App (`mobile/`)**
   - Agendar: "Crear médico" en el selector, a `/medico/nuevo`, y vuelve con el médico elegido (como Reportar).
   - Nuevo médico: solo CC y CE.
   - Reportar, la institucional:
     - el contacto es obligatorio (`erroresVisita`);
     - "Nuevo contacto", una pantalla nueva `/contacto/nuevo` con nombre, cargo, teléfono y/o correo, y el 409 ofrece
       el que ya está.
   - Pruebas en `mobile/scripts/checks/` y `api.crearContacto`.
7. **Web `/medicos`**
   - Recuperar de c759203^ `MedicosTab`, `MedicoForm`, `MedicoDetalleModal` y `SedeBuscador`, con CC y CE.
   - Página `/medicos` con la lista.
   - `menu-check`: Médicos ya no es "Próximamente".
   - `ContactoForm` de la web: teléfono o correo y el 409.
8. **Docs y cierre**
   - La decisión, `CLAUDE.md` (una línea), fase6 (contrato de terceros) y fase8 (institucional con contacto).
   - `npm run check` en las dos, capturas, `revisor` y PR. La 0940 se aplica solo con la autorización del dueño.
