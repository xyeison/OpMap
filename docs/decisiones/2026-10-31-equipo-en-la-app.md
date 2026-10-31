# 2026-10-31 – "Equipo" vive en la app: dónde está mi gente y cómo rinde; una sola app con un solo ingreso

**Contexto**: Laura (directora comercial) abrió la app y vio "La dirección comercial sigue a su equipo en la web"; la
página web `/equipo` (F4 de `docs/specs/2026-10-15-actividades-de-campo.md`) nunca se hizo. El dueño, el 2026-10-31:
- "la directora como Adm deben tener sus funciones en versión móvil también";
- qué hace Laura en el celular: "Vigilar sus líderes y los ejecutivos comerciales. Y los líderes vigilan sus
  ejecutivos comerciales";
- "Los supervisores quieren saber dónde están sus supervisados y su rendimiento";
- entre "Equipo dentro de la app" y "Equipo como página web" eligió la app ("VAMOS CON A");
- sobre un Ejecutivo que lleva líneas de dos líderes: cada líder "puede ver toda la info del Ejecutivo X", y además
  cuántas visitas fueron de cada línea ("Ejecutivo X visita 99 para A y 1 visita para línea B. Aquí el líder va a
  levantar la mano y pedir ajustes. Eso debe ser visto");
- sobre OpMap y la app de campo: "es lo mismo… hablemos ya de una app y punto".

**Decisión**:
1. **"Equipo" es una pestaña de la app de campo** (`/campo/equipo`), no una página web aparte. Permiso `team:view`:
   la dirección y el administrador ven a todas las personas de campo; cada líder se ve a sí misma y a los Ejecutivos
   Comerciales de sus líneas (las líderes no se ven entre ellas, A2). A quien lidera una línea y es Ejecutiva de otra
   (Paola), la líder de esa otra la ve solo como Ejecutiva.
2. **Cada líder ve TODO lo que hace un Ejecutivo de sus líneas** (también sus visitas de otras líneas) y, aparte,
   **cuántas visitas impulsaron cada línea**; una visita con dos líneas cuenta en las dos.
3. **Dónde está cada persona sale de lo reportado y agendado, nunca del GPS en vivo** (C5). El texto fijo de Equipo ›
   Hoy lo dice. Las marcas del servidor (lejos de la sede, sin GPS, hora rara, médico por validar) se muestran con
   palabras; nunca la distancia, la precisión ni las coordenadas.
4. **Rendimiento por periodo** (semana, 15 días, mes, mes anterior, 3 meses): hechas, efectivas y no efectivas por
   motivo, no se hizo y canceladas por motivo, sin cerrar, programadas, telefónicas, cumplimiento del plan (cada cadena
   de "otra fecha" una vez, por su última cita; una pendiente de hoy aún no cuenta), anticipación, médicos y ciudades
   distintos, por línea, días hábiles sin visitas; la cuota solo en un mes completo y con la misma cuenta de Mis
   números. Quien ya no está pero tuvo actividad sale marcado.
5. **Una sola app, un solo ingreso**: desde el menú de OpMap, "Equipo" y "Agendamiento" entran sin contraseña para
   todo rol con `campo:app` o `team:view`. La dirección sigue sin agendar ni reportar (A1): en la app ve solo Equipo y
   Ajustes.
6. **VMO no entra en Equipo**: el Excel sigue solo para el mapa de calor, transitorio.

**Consecuencias**:
- Permiso nuevo `team:view` (admin, commercial_director, line_leader); menú "Equipo" → `/campo/equipo` (primero en la
  dirección y el administrador; tras Agendamiento en la líder) y cuadro en `/inicio`; `/api/auth/me` trae `supervisa`.
- `POST /api/auth/sesion-app` acepta `campo:app` o `team:view`: deja sin efecto la revisión del 2026-10-30 que negaba
  el ingreso único al administrador y a la dirección.
- API nueva, solo lectura: `GET /api/equipo/personas`, `/hoy?fecha=`, `/persona/[id]?fecha=`,
  `/rendimiento?desde&hasta&linea&papel` (93 días como mucho) y `/persona/[id]/rendimiento`. Fuera del alcance → 404.
  Nunca devuelven transcripción, foto, GPS, distancia, documento ni teléfono.
- La app: la dirección y el administrador sin líneas entran a Equipo · Ajustes; la líder conserva sus pestañas y llega
  por "Mi equipo" (Hoy y Ajustes). Sin señal, Hoy y Rendimiento muestran lo último guardado con "Visto hace".
- Sin migración, sin Google, sin tocar el mapa de asignación.
- Descartado: `/equipo` como página web; la cuadrícula "Próximas semanas", el mapa de calor del equipo (A3) y el Excel
  (tercera entrega si el dueño la pide); seguir la ubicación en vivo.

**Dónde vive en el código**:
- Reglas puras: `web/lib/equipo.ts` (`personasVisibles`, `dondeEsta`, `rastroDelDia`, `cadenasDeCitas`,
  `cumplimientoDelPlan`, `rendimiento`, `esMesCompleto`); textos de la app en `mobile/lib/equipo.ts`.
- Servidor: `web/app/api/equipo/_lib/equipo-server.ts` y las rutas de `web/app/api/equipo/`; `web/lib/permissions.ts`
  (`team:view`, menú); `web/app/api/auth/me/route.ts` (`supervisa`); `web/app/api/auth/sesion-app/route.ts`.
- App: `mobile/lib/persona.ts` (`estadoPersona` con `supervisa`, `muestraMiEquipo`), `mobile/lib/navegacion.ts`
  (`PESTANA_EQUIPO`, `pestanasDe`), `mobile/app/(app)/equipo.tsx`, `equipo/persona/[id].tsx`, `equipo/rendimiento.tsx`,
  `mobile/lib/equipo-cache.ts`.
- Pruebas: `web/scripts/equipo-check.ts`, `web/scripts/equipo-api-check.ts`, `menu-check.ts`, `reporte-check.ts`,
  `reporte-api-check.ts`; `mobile/scripts/checks/26-equipo.ts`, `21-persona.ts`, `15-navegacion.ts`.
