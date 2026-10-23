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
   restricción para que las líderes no asignen por error; sin restricción, cualquier líder puede dar su línea. Por
   ahora solo dos: la persona de Barranquilla puede tener Sustitutos óseos y Reemplazo articular; Vacante Barranquilla,
   las otras líneas (Medicina deportiva, Columna y Trauma). Las demás quedan sin restricción mientras se redistribuye.
5. **Bogotá sigue en cuatro Zonas** y una líder puede darle las cuatro a una misma persona: al dar la línea a quien vive
   en una celda, las otras tres le llegan por alcance (26 a 30 minutos) si nadie local las lleva. La pantalla las muestra
   agrupadas con su total.
6. **La cobertura se recalcula sola** después de cada cambio (sin Google), y la pantalla recalcula y guarda si encuentra
   la tabla desactualizada. La celda sin nadie se llama "Sin cobertura", para no confundirla con la vacante por contratar.

**Consecuencias**:
- Permiso nuevo `executives:lines` (admin, dirección comercial y líder de línea, esta última solo en su línea). La API
  rechaza con 409 dar una línea que la dirección no permitió para esa persona.
- Tabla nueva `executive_allowed_lines` (migración 0860, con rollback). Sin filas = sin restricción.
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
