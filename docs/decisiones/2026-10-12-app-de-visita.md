# 2026-10-12 – App de visita propia en OpMap: médica e institucional, todo configurable con vigencias, voz y sin VMO

**Contexto**: el equipo comercial reporta hoy en VMO 2026, hecho para laboratorios. El dueño: "es muy complejo,
tiene demasiadas características"; la gente "lo ve como un problema; coger formularios, seleccionar, escribir,
les parece fastidioso". En varias rondas del 2026-10-12 el dueño corrigió y cerró el modelo de la spec
`docs/specs/2026-10-12-app-de-visita-opmap.md`.

**Decisión**:
1. **Alcance**: producto mínimo viable en OpMap, como piloto de desarrollo que luego sus desarrolladores
   pegarán a Odoo. Sin Odoo, sin VMO ("VMO morirá y punto"), sin pruebas piloto ni importación.
2. **App móvil nativa**, nada de navegador. Reporte **por voz** (Whisper o similar), confirmación muy breve;
   **el audio no se guarda**: se transcribe y se desecha.
3. **Dos tipos de visita**: **médica** (que el médico ordene; hoy 6 al día) e **institucional** (lo que hay que
   lograr en una cuenta), con subtipos compras, químico farmacéutico, autorizaciones, programación y otro.
   "Visitar a la jefe de quirófano no es una visita" de inducción: se ve por subtipo.
4. **Facturación**: con unas EPS VG factura directo a la EPS (Proteger); con otras factura a la clínica, que
   factura a la EPS (Nueva EPS). Es un dato de la EPS, no de la visita.
5. **Todo lo que mide es configurable, nada en código**, y **con rangos de fechas**: "hasta una fecha había una
   condición y cambió; todo debe manejarse así, lo que pueda afectar el pasado cuando se cambie". Qué cuenta
   y con qué peso, metas por tipo y subtipo, por zona y por persona, por día o semana, radio, telefónica,
   topes, plazo de gracia.
6. **Valores iniciales**: Compras y Autorizaciones suman a la meta institucional (peso 1); químico,
   programación y otro, solo seguimiento; radio 500 m; una visita por médico al día; telefónicas hasta 1 de las
   6 diarias, solo llamada o videollamada, habilitadas por persona.
7. **Calendario**: festivos de Colombia precargados, días de empresa y por ciudad; días libres que se
   registran antes o hasta 24 horas después ("como gabela", configurable); si no, afecta los indicadores.
   Los aprueban la directora o recursos humanos, en bloque.
8. **Terceros**: una sola tabla de cuentas (la empresa) con sede principal y sedes; una cuenta puede ser
   clínica, cliente o las dos; los consultorios son IPS. **Médicos completos desde el inicio o no se crean**,
   con tipo y número de identificación (la causa de los duplicados de hoy). Un médico tiene **visitantes** por
   línea, incluso dos de la misma línea en ciudades distintas. Nada se trae de VMO: el equipo crea todo a mano.
9. **Reporte**: presencial bloqueada lejos de la sede; mismo día y en tiempo real; sin señal, la app guarda
   con el punto y la hora del sitio y envía antes de medianoche; una sede nueva suma al instante si trae
   código de habilitación del REPS y, si no, cuando data manager la confirma.
10. **Legal** entrega el aviso de tratamiento de datos y revisa los términos de OpenAI y Anthropic.

**Consecuencias**: tablas nuevas de cuentas, sedes, médicos, visitantes, contactos, subtipos, configuración con
vigencias, calendario y días libres (migración 0800 con rollback); `hospitals` no cambia (los consultorios no
entran a zonas, mapa ni rutas de Google). Costo de Google: 0. Voz: unos 30 a 45 USD al mes para 20 personas.
Cuentas que crea el dueño: Apple Developer, Google Play, OpenAI y Anthropic, a nombre de VG. El importador de
VMO de `/visits` se deshabilita para que no borre visitas de la app.

**Dónde vive en el código**: por construir según el plan de fases de la spec (F0 a F5); las reglas puras irán en
`web/lib/visits-rules.ts` con pruebas en `web/scripts/visits-check.ts`.
