# 2026-10-29 – El Excel "Tracker Líderes" entra a OpMap: su histórico y, mientras llega la app, cada nueva versión

**Contexto**: la directora comercial lleva en el Excel "Tracker Líderes" lo que hacen sus 5 líderes: dónde van a estar,
qué tipo de actividad, si se hizo, con qué médicos o contactos y observaciones. El 2026-10-29 el dueño eligió que el
seguimiento viva en la app de OpMap (las líderes planean y cierran sus actividades allí, ver
`docs/specs/2026-10-15-actividades-de-campo.md`) y añadió: "Sí, podemos dejar también la data que está en el Excel en
la solución que propongas en la app".

**Decisión**:
1. **Reemplaza la A15 del 2026-10-15** ("no se importa el histórico del Excel"): el histórico SÍ se importa.
2. Va en "Líderes de negocio" (`/lideres`, menú Empleados). Lo ven el administrador y la dirección comercial
   (permiso `lideres:seguimiento`). Las líderes no se ven entre ellas (A2).
3. La directora sube el Excel tal como lo lleva hoy, y puede volver a subirlo hasta que las líderes reporten en la app.
   Cada carga reemplaza el histórico completo: el Excel manda, y si ella corrige una fila, OpMap la corrige.
4. **Qué se guarda de cada fila**:
   - fecha;
   - líder (su usuario de OpMap);
   - ciudad (código DANE si se reconoce; si no, el texto);
   - tipo de actividad;
   - estado: realizada, cancelada, sin cerrar o planificada;
   - cuántos médicos o contactos se anotaron;
   - si tenía observación.
5. **Qué no se guarda**: los nombres de médicos o contactos y el texto de las observaciones. Se leen en el navegador y
   no se envían, como con las visitas de VMO: pueden traer datos de médicos y de pacientes.

**Consecuencias**:
- La directora ve en OpMap, desde ya, lo que hoy ve en el Excel:
  - dónde está cada líder;
  - cumplimiento;
  - actividades por mes, tipo y ciudad;
  - calidad del registro.

  Y sin las fórmulas rotas del Excel.
- **Cuando las líderes reporten en la app**, la directora deja de subir el Excel. El histórico queda y la vista suma
  lo de la app.
- **Datos**: migración `0920_lideres_historico` con su rollback `9957`, solo con autorización del dueño. Crea la tabla
  `lideres_historico`, la bitácora de cargas y una función que reemplaza todo en una transacción.
- **Costo**: Google Maps 0. La ciudad sale de la lista de municipios del DANE, nunca de una búsqueda.
- **Descartado por ahora**: guardar los nombres de los médicos o enlazarlos a las fichas de Médicos (pediría cruzar
  nombres escritos a mano), y el texto de las observaciones.

**Dónde vive en el código**:
- `web/lib/lideres-historico.ts` lee y normaliza la hoja REGISTRO. Lo prueba `web/scripts/lideres-historico-check.ts`.
- `web/app/api/lideres/historico/route.ts` resuelve líderes y ciudades, muestra la vista previa y guarda.
- `web/app/lideres/page.tsx` tiene la vista de la directora.
- `database/migrations/2026-10-29_0920_lideres_historico.sql`.
