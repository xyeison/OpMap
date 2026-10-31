# 2026-10-31 – Los Ejecutivos Comerciales vuelven a reportar en la app; VMO queda transitorio para el mapa de calor

**Contexto**: Laura (directora comercial) abrió la app en su celular y vio "La dirección comercial sigue a su equipo en
la web". Al conversarlo, el dueño dijo (2026-10-31): "Debemos hacer que las ejecutivas comerciales también reporten,
vamos a hacer la solución completa. Lo del excel eso es algo transitorio para ver el mapa de calor de donde los ahora
visitan con VMO mientras logramos que esta app funcione. Los supervisores quieren saber dónde están sus supervisados y
su rendimiento." Y sobre OpMap y la app de campo: "es lo mismo… hablemos ya de una app y punto".

**Decisión**:
1. **Los Ejecutivos Comerciales usan la app de campo**: agendan, reportan, ven su cuota, sus números y sus días libres,
   como antes del 2026-10-30. Quien tiene los dos papeles (Paola) vuelve a elegir "Como líder" o "Como Ejecutivo
   Comercial" al agendar y reportar.
2. **La regla "app solo para las líderes" del 2026-10-30 queda reemplazada**, y con ella la llave
   `APP_CAMPO_EJECUTIVOS`: la regla ya no existe, no se apaga ni se prende.
3. **El importador de VMO (`/visits`) sigue, transitorio**, solo para el mapa de calor, hasta que el equipo esté
   reportando en la app y el dueño decida apagarlo. Eso no va en esta decisión.
4. **Una sola app, un solo ingreso**: quien ya entró en OpMap abre "Agendamiento" (y, con la Entrega 2, "Equipo") sin
   escribir la contraseña, cualquiera que sea su rol. En esta entrega lo reciben las líderes y los Ejecutivos
   Comerciales (`campo:app`); la dirección y el administrador, con "Equipo"
   (`docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md`).

**Consecuencias**:
- El servidor vuelve a lo que ya hacía: `persona_de_campo` y `agenda_crear` de la base deciden quién reporta y "como
  qué". `/api/auth/me` da `persona` con rol `ejecutivo` o `lider_y_ejecutivo`; `/api/me/cuota` y `/api/me/dias-libres*`
  responden igual desde la app (token) y desde la web (cookie); `POST /api/me/agenda` y `…/otra-fecha` pasan `como` tal
  cual (o `null`: la base decide, C12).
- `campo:app` también para `sales_manager`: "Agendamiento" primero en su menú de OpMap y `sesion-app` le da token.
- Lo que sigue cerrado: la dirección comercial no agenda ni reporta (A1, 2026-10-15); un administrador sin líneas ve
  "Tu usuario no tiene líneas para reportar" hasta que exista "Equipo".
- Las visitas de la app con Ejecutivo Comercial ya salían en el mapa de calor (`source <> 'app' OR executive_id IS NOT
  NULL`); nada cambia en el mapa.
- Descartado: seguir con VMO como fuente definitiva; una llave para volver a cerrar la app a los Ejecutivos.

**Dónde vive en el código**:
- Servidor: `web/lib/persona-campo.ts` (sin `appSoloLideres`, `lineasDeLaApp`, `comoDeLaApp` ni
  `MENSAJE_EJECUTIVO_EN_VMO`), `web/app/api/config-visitas/_lib/visitas-server.ts` (`requireEjecutiva`,
  `personaDeCampo`), `web/app/api/me/agenda/route.ts` y `…/[id]/otra-fecha/route.ts`, `web/lib/permissions.ts`
  (`campo:app` en `sales_manager`).
- App: `mobile/lib/persona.ts` (`TEXTO_PARA_QUIEN_ES_LA_APP`, `AYUDA_SIN_LINEAS`).
- Pruebas: `web/scripts/persona-campo-check.ts` (sección 7), `web/scripts/reporte-api-check.ts` (sección 16),
  `web/scripts/menu-check.ts`, `web/scripts/reporte-check.ts` (sesion-app), `mobile/scripts/checks/21-persona.ts`.
