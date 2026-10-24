# 2026-10-23 – Las líderes asignan su línea por Zona; se borran las líneas actuales para redistribuir; la dirección limita qué líneas puede tener cada persona

**Contexto**: tras una reunión interna cuya acta va a las líderes, el dueño pidió que ellas "definan las zonas" viendo
datos ciertos de cada una (IPS, municipios, población, giros de la ADRES) y que le "pongan la zona a la comercial o a la
que esté vacante". Con sus palabras (2026-10-23): "yo quiero trabajar en Pereira: a la comercial de Pereira le pongo mi
línea para que vaya construyendo su mapa"; "yo diría que borrarla [la asignación de líneas] y que ellas tengan una opción
de ver todas las zonas; las zonas se van a ver grises, pero vas a tener que manejar distintos tonos de grises"; "Bogotá se
parte en cuatro, pero también que ellas puedan decir: aquí voy a tener una y va a tener asignadas las cuatro zonas"; "yo
como gerente autoricé vacante para Bogotá y para Barranquilla: es como si ya tuviéramos contratado a una persona; ellas
dicen 'este próximo empleado lo cojo para mí'"; "los ejecutivos comerciales tienen que tener [un campo]: esta persona
nada más puede tener estas unidades de negocio, de forma restrictiva, para que no puedan asignarle por error… en algún
momento de madurez"; "la vacante sigue tomando zonas vecinas, sí: si no hay en Cartagena, yo puedo llegar hasta
Cartagena para esta unidad de negocio"; "si cosas cambian, se debe estar recalculando para que el mapa se distribuya según
lo último que se haga".

**Decisión**:
1. **Las líderes asignan su línea por Zona.** En la página "Zonas", cada líder ve las 16 Zonas con sus cifras, quién vive
   en cada una y el estado en su línea, y da o quita **su** línea a un Ejecutivo Comercial o a una vacante que viva en la
   Zona. Solo su línea; con vista previa del efecto antes de guardar. Admin y dirección siguen editando desde
   Ejecutivos Comerciales.
2. **Se borran las líneas asignadas hoy y se redistribuye desde cero.** Hasta que cada líder asigne, las Zonas de su
   línea se ven sin cobertura. En el mapa por línea, las Zonas sin cobertura se pintan en **gris, con un tono distinto
   por Zona** para poder distinguirlas (cambio de estética del mapa autorizado por el dueño este día).
3. **Las vacantes son plazas autorizadas por la gerencia y cuentan como una persona.** Las crea la dirección (hoy por
   Traspasar); las líderes no crean vacantes: le dan su línea a la vacante que ya existe en la Zona ("este próximo
   empleado lo cojo para mí"). La vacante sigue tomando Zonas vecinas por alcance, como una persona (confirma la
   decisión 10 del 2026-10-12). Una vacante puede llevar unas líneas y no otras.
4. **La dirección puede limitar qué líneas puede tener cada persona o vacante** ("líneas permitidas"). Es una
   restricción para que las líderes no asignen por error; sin restricción, cualquier líder puede dar su línea. Las
   fijadas el mismo día (segunda ronda de respuestas: "Paola es PerOssal; la vacante de Bogotá tiene que tener los
   otros"): la persona de Barranquilla → Sustitutos óseos y Reemplazo articular; Vacante Barranquilla → Medicina
   deportiva, Columna y Trauma; Paola (Chapinero) → Sustitutos óseos; Vacante Bogotá → Reemplazo articular, Medicina
   deportiva, Columna y Trauma. Las demás quedan sin restricción mientras se redistribuye. A quien no puede tener la
   línea, la líder no lo ve como asignable ("No puede tener <línea>").
   Además, dentro de Bogotá quien vive en una celda atiende las cuatro ("la vacante de Bogotá sí o sí tiene que tener
   las cuatro zonas; Paola tiene que tener las cuatro"): se leen como Ocupadas o Reservadas, no por alcance.
   **Cambio del 2026-10-24:** "mejor que todas tengan la posibilidad de tener todas las líneas, y si en una misma
   ciudad hay dos que tienen la misma, que advierta que debe quitarle a una para ponérsela a la otra". Se quitaron
   todas las restricciones (la tabla queda vacía y la herramienta disponible para cuando se quiera), y al dar una línea
   a alguien cuando otra persona de la misma Zona ya la lleva, la pantalla avisa y ofrece pasarla de una a la otra en un
   solo paso (quitar y dar, con vista previa y la cuenta de médicos que pierden visitante).
   También ese día: la "Vacante Cúcuta" era Linda Ossa; se renombró, pasó a Bucaramanga con Sustitutos óseos y atiende
   Cúcuta por alcance.
7. **El alcance de todas las líneas pasa de 4 h a 5 h** (`business_lines.max_reach_minutes` = 300; dueño, 2026-10-24:
   "Subamos a 5 horas a todas"). Bucaramanga–Cúcuta son 4 h 52 por carretera y con 4 h Cúcuta quedaba sin cobertura.
   Una simulación de solo lectura mostró que el cambio solo movía tres celdas más (Reemplazo articular: Montería a
   Cartagena 4 h 39 y Pereira a Medellín 4 h 30; Columna: Cúcuta a Bucaramanga 4 h 52), todas de Zonas que estaban sin
   cobertura. La cobertura se recalculó ese día; el valor por defecto del esquema (240) no se tocó.
5. **Bogotá sigue en cuatro Zonas** y una líder puede darle las cuatro a una misma persona: al dar la línea a quien vive
   en una celda, las otras tres le llegan por alcance (26 a 30 minutos) si nadie local las lleva. La pantalla las muestra
   agrupadas con su total.
6. **La cobertura se recalcula sola** después de cada cambio (sin Google), y la pantalla recalcula y guarda si encuentra
   la tabla desactualizada. La celda sin nadie se llama "Sin cobertura", para no confundirla con la vacante por contratar.

**Consecuencias**:
- Permiso nuevo `executives:lines` (admin, dirección comercial y líder de línea, esta última solo en su línea). La API
  rechaza con 409 dar una línea que la dirección no permitió para esa persona.
- Tabla nueva `executive_allowed_lines` (migración 0860, con rollback 9946), **aplicada el 2026-10-23 con autorización
  del dueño**; las cuatro restricciones iniciales se cargaron a mano ese día (sin nombres en el SQL: por zona base,
  estado y línea). Sin filas = sin restricción.
- Migración de datos 0870 (con respaldo y rollback): copia `executive_lines` a una tabla de respaldo, borra todas las
  filas y deja las dos restricciones de Barranquilla. Se aplica solo con autorización del dueño, en la ventana del
  despliegue, y después se recalcula la cobertura. Al borrar, el disparador de la 0820 termina los visitantes de los
  médicos de esas líneas (hoy solo hay 10 médicos de prueba). Mientras las líderes asignan, los Ejecutivos Comerciales
  no ven líneas en el mapa ni en la app de visita.
- El motor de cobertura no cambia: manual → local/conflicto → alcance → sin cobertura; la vacante es elegible como una
  persona. Queda descartado por ahora que una reserva "no salga de su Zona" (sería un cambio del motor con migración).
- El mapa cambia solo en la vista por línea: Zonas sin cobertura en tonos de gris por Zona y el texto "Sin cobertura" en
  la leyenda. Nada más de la estética autorizada el 2026-10-11 se toca.
- Costo de Google: 0. Ninguna ruta nueva lo llama; la simulación usa las distancias ya pagadas.
- Queda por confirmar con el dueño: si las vacantes de Cúcuta y Neiva (creadas el 2026-10-14) también son plazas
  autorizadas, y si la persona de Barranquilla conserva sus dos líneas tras el borrado o las líderes se las vuelven a dar.

**Dónde vive en el código**: spec `docs/specs/2026-10-23-zonas-por-linea-para-lideres.md`; módulo puro
`web/lib/cobertura-simulacion.ts` (estados, simulación, desactualización) con `web/scripts/cobertura-simulacion-check.ts`;
rutas `web/app/api/kams/zonas`, `web/app/api/kams/[id]/estadisticas`, `web/app/api/executives/[id]/lineas/[lineId]`,
`web/app/api/coverage/simular`; página `web/app/kams/page.tsx`; permisos en `web/lib/permissions.ts`; grises por Zona en
`web/components/mapStyles.ts` (`grisDeZona`) y `docs/mapa-estetica.md`; migraciones `database/migrations/2026-10-23_0860_*`
y `2026-10-23_0870_*` con sus rollbacks 9946 y 9947.
