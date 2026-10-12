# VMO 2026 · Documentación funcional y de usabilidad

Oct 11, 2026 · @Yeison

## Resumen

VMO 2026 es la plataforma de visita médica de VG Medical. Con ella los representantes planean su agenda, reportan cada visita con GPS o por canal virtual y entregan material; supervisores y administradores aprueban los cambios al panel, siguen los KPIs del ciclo y configuran el sistema. Este documento recorre cada vista, qué hace, para qué sirve, cómo está configurada y qué lógica aplica, desde los dos puntos de vista.

| VMO hoy | Cifra |
| --- | --- |
| Usuarios activos | 19: 13 representantes, 3 supervisores y 3 administradores |
| Médicos activos | 2.178 |
| Clientes activos | 785 |
| Prospectos en panel potencial | 84 |
| Visitas en la última semana | 167 |
| Solicitudes de panel pendientes | 153 (134 altas y 19 bajas) |
| Solicitudes de días autorizados sin resolver | Unas 800, desde agosto de 2025 |
| Reportes disponibles | 28 |
| Módulos de configuración | 25 |

La interfaz es coherente y cubre bien el trabajo de campo. Lo que más le resta valor es la configuración y las aprobaciones pendientes, y seis puntos merecen atención inmediata. Las solicitudes de días autorizados no se resuelven desde agosto de 2025 (solo 2 de las 800 más recientes tienen respuesta), así que la cuota de los visitadores nunca se ajusta por ausencias. El calendario de festivos no tiene el 2 de noviembre, de modo que el ciclo de noviembre se medirá con un día hábil de más si no se corrige antes del 1 de noviembre. La frecuencia por defecto de 10 visitas por médico al mes deja el cumplimiento de frecuencia por debajo del 3,5 %, y el indicador no sirve. Las seis plantillas de Hábeas Data están vacías. Hay 153 solicitudes de alta y baja sin resolver; la más antigua es de hace casi un año. Y no hay reglas de duplicidad: los reportes marcan 166 médicos y 249 clientes duplicados. A eso se suman controles desiguales entre representantes: dos no tienen validación de distancia al reportar, uno puede crear e inactivar médicos sin aprobación y dos tienen cuota 0.

El detalle de cada punto y su recomendación está en *Hallazgos y recomendaciones*.

## Roles y accesos

VMO trabaja con tres tipos de usuario. VG Medical tiene 19 usuarios activos, todos en el grupo «General»: 13 Representantes (los visitadores médicos), 3 Supervisores y 3 Administradores del sistema. A cada representante lo supervisan entre 2 y 5 usuarios. El tipo de usuario decide qué opciones aparecen en el menú web y en la app, qué puede aprobar y cuál es el horario laboral con el que se calculan los días hábiles. Además, cada usuario tiene su propia configuración de cuotas, restricciones, preferencias, permisos por tipo de panel y alertas (ver *Configuraciones*).

### Menú web por rol

| Opción | Representante | Supervisor | Administrador |
| --- | --- | --- | --- |
| KPIs, Médicos, Clientes, Agenda, Panel potencial, Actividades diferentes a visita, Visita rápida, Ruteros, Días autorizados, Material promocional, Visitas | Sí | Sí | Sí |
| Reportes | 23 de 28 | 26 de 28 | 28 de 28 |
| Parrilla promocional | No | Sí | Sí |
| Operaciones (altas, reasignaciones, bajas, reactivaciones) | No | Sí | Sí |
| Configuración (engranaje de la barra superior) | No | No | Sí |

Dashboard, Farmacias, Pacientes y Farmacovigilancia existen en el producto, pero están deshabilitados en el menú web de los tres tipos. Los reportes «Efectividad de la agenda», «General · Agenda» y «Ubicaciones de representantes» son solo para supervisor y administrador; «Consulta general de la gestión» y «Dispositivos del usuario» son solo para administrador.

### Menú de la app móvil por rol

| Opción | Representante | Supervisor | Administrador |
| --- | --- | --- | --- |
| Agenda, Ruteros, Reportes, Actividades diferentes a visita, Panel potencial, Visitas, Soporte, Preferencias | Sí | Sí | Sí |
| Solicitar días | Sí | No | No |
| Entrega de material | Sí | No | No |
| Pacientes | No | No | No |

En el tablero de la app están encendidos los bloques de Médicos, Clientes, Indicadores, Dashboard, Cumpleaños y Parrilla promocional; Farmacias, Pacientes, Potenciales y Actividades están apagados. La búsqueda general está activa. Los reportes disponibles en la app son Agenda (solo supervisor y administrador), Ubicaciones y Visitas, estos dos para los tres tipos.

### Permisos por tipo de usuario

| Permiso | Representante | Supervisor | Administrador |
| --- | --- | --- | --- |
| Supervisar usuarios | No | Sí | Sí |
| Asistencia en visita | No | Sí | Sí |
| Acompañamiento en visita | No | Sí | No |
| Ver distancia al punto visitado | Sí | Sí | Sí |
| Ubicación requerida al reportar | Sí | Sí | No |
| Ver todas las visitas del panel | Sí | Sí | No |
| Autorizar altas, bajas, transferencias y reactivaciones | No | Sí | Sí |
| Remover paneles en lote | No | Sí | Sí |
| Historial de movimientos | No | Sí | No |
| Cierre de inventario | No | Sí | No |
| Trasladar contactos | Sí | Sí | Sí |
| Material: devoluciones, solicitudes y despachos | No | Sí | Sí |
| Resolver días libres | No | Sí | Sí |
| Exportar | Sí | Sí | Sí |
| Anular pedido | No | No | Sí |

Cuatro permisos no están configurados en ningún tipo: eliminar visitas, promover potenciales, unidades de trabajo y modificar días libres. Llama la atención que el supervisor tenga historial de movimientos, cierre de inventario y acompañamiento, y el administrador no, y que el administrador tenga en No «ver todas las visitas del panel»; conviene confirmar si es intencional.

El tipo de usuario también fija los límites de frecuencia (de 1 a 100 visitas) y el horario laboral: lunes a viernes de 8:00 a 17:00 cuenta al 100 %, sábado de 8:00 a 12:00 al 50 % y domingo al 0 %.

### Qué pasa cuando el visitador crea o retira un médico

En 12 de los 13 representantes, el panel Médicos tiene permisos de leer, crear, editar e inactivar, pero «altas sin autorización» y «bajas sin autorización» están en No. En la práctica, cuando el visitador crea o inactiva un médico, el cambio no se aplica de inmediato: VMO genera una solicitud que un supervisor o administrador aprueba o rechaza en *Operaciones*.

Un representante tiene esas dos opciones en Sí y puede crear e inactivar médicos sin aprobación. Además, todos pueden editar el número de visitas de cada médico (su frecuencia) y crear, editar o inactivar sus direcciones sin pasar por aprobación.

## Estructura y navegación

VMO es una aplicación web de una sola página con tres zonas fijas: barra superior, menú lateral de 14 opciones (12 para el representante) y área de trabajo. Visitadores y administradores usan la misma estructura; cambian las opciones y los datos que ve cada uno.

### Barra superior

| Elemento | Qué hace |
| --- | --- |
| Búsqueda general de paneles | Busca en todos los médicos, clientes y contactos, estén o no asignados al usuario. Exige un mínimo de tres caracteres. |
| Buscar | Filtra la vista actual. El embudo define si busca en la tabla o en todo, y si exige todas las palabras o cualquiera. |
| Indicador de ciclo | Muestra el número del ciclo activo (10 = octubre de 2026). Al abrirlo detalla laboratorio, avance del ciclo en porcentaje y fechas. |
| Configuración (engranaje) | Entra a los 25 módulos de configuración del sistema. |
| Agenda | Atajo a la agenda. |
| Reportar ubicación | Registra la ubicación actual del usuario. No se probó para no generar un registro. |
| Campana | Abre un panel con cuatro pestañas: solicitudes por aprobar, notificaciones, cumpleaños de la semana y e-learning. |
| Perfil | Cuenta, cambiar contraseña, cambiar tema, soporte y cerrar sesión. |

### Menú lateral

Se muestra como una columna de íconos y se expande con el nombre de cada opción al pasar el cursor. El orden es fijo: KPIs, Médicos, Clientes, Agenda, Panel potencial, Actividades diferentes a visita, Visita rápida, Ruteros, Días autorizados, Material promocional, Parrilla promocional, Operaciones, Visitas y Reportes.

### Patrones que se repiten en todas las listas

- **Tabla**: cada columna se ordena con un clic y varias tienen filtro propio (embudo en el encabezado).
- **Columnas**: el botón de columnas abre un panel lateral con un ojo por columna para mostrarla u ocultarla.
- **Exportar**: tres botones, CSV (azul), Excel (verde) y PDF (amarillo). Cada uno ofrece «Todo» o «Filas seleccionadas».
- **Acciones en lote**: el botón de cuadro punteado actúa sobre las filas marcadas, por ejemplo, aceptar o rechazar varias solicitudes.
- **Menú de fila**: el botón de tres líneas al final de cada fila reúne las acciones sobre ese registro.
- **Detalle**: un clic en el nombre abre un panel lateral con pestañas verticales, sin salir de la lista.
- **Formularios**: se organizan por pestañas, con «Guardar» arriba a la derecha y un botón para reordenar las pestañas.
- **Mapa**: el botón rojo de mapa en las listas de paneles está bloqueado; el sistema indica que solo está disponible en el plan PRO o por demanda.

## Vistas del visitador médico

El visitador trabaja con doce vistas web y diez opciones en la app. La sesión de este recorrido fue de administrador, así que lo que sigue combina lo visto en pantalla con la configuración de menús y permisos del tipo Representante: el visitador ve estas mismas vistas, centradas en sus paneles (aunque la búsqueda general alcanza también los no asignados) y sin las acciones de aprobación. Supervisor y administrador las ven con filtros por usuario y acciones adicionales, descritas en la sección siguiente.

&#91;embedded content: flujo del visitador · 6 pasos, 1 decisión\]

Si la visita no se logra, se registra como fallida con su razón y, si se quiere, una nueva fecha. Las ausencias aprobadas (días autorizados) reducen la cuota ajustada con la que se mide al visitador.

### KPIs

Es el tablero de cumplimiento del ciclo y la primera pantalla al entrar. La pestaña Principal tiene dos tablas con una fila por representante: «Cumplimiento y promedio diario» (días hábiles del ciclo y transcurridos, cuota del periodo, visitas, cumplimiento, días autorizados, cuota ajustada, cumplimiento ajustado y promedio diario) y «Cobertura y frecuencia» (miembros del panel, visitas únicas, cobertura, cuota de frecuencia, visitas totales y cumplimiento de frecuencia). La pestaña Complementario desglosa la cobertura por especialidad, segunda especialidad, categoría y tipo de contacto. Se filtra por supervisor, ciclo y tipo de panel, con la opción «Incluir visitas extra». Las fórmulas están en *Lógica de negocio*.

### Médicos

Es el panel de médicos asignados con su ficha completa; hoy hay 2.178 activos. La lista busca en la tabla o en todo, con todas o cualquiera de las palabras; se puede ordenar, filtrar, ocultar columnas y exportar, y muestra, entre otras, la marca de Hábeas Data y el contador de visitas contra la frecuencia de cada representante. Cada fila tiene Reportar visita, Editar cuotas de visita (la frecuencia), Editar e Inactivar; el engranaje de la lista ofrece mostrar u ocultar columnas, importar paneles desde un archivo .txt con plantilla y cargar todo.

La ficha se abre en un panel lateral con las pestañas Básico, Adicional, Próximas visitas agendadas, Horarios de visita, Control de contacto (presencial, telefónica, videoconferencia, correo, chat y envío de material y muestras), Transferencia de valor, Visitas (historial por ciclo), Actividades y Cartera de crédito (cupo y estado); el orden de las pestañas es personalizable. El formulario de creación y edición tiene Básico, Adicional, Horas de visita (mañana y tarde por día) y Ubicaciones sobre mapa. Crear o inactivar un médico genera una solicitud de alta o de baja que aprueba el supervisor o el administrador.

### Clientes

Funciona igual que Médicos sobre 785 clientes activos, con una acción adicional por fila: Contactos, que abre las personas de contacto del cliente con su propio formulario. El formulario del cliente tiene Básico, Horas de visita y Ubicaciones, y su ficha, seis pestañas.

### Agenda

Sirve para planear el ciclo. Tiene vista de mes y de día y un selector de usuario (supervisor y administrador ven la agenda de su equipo). «Agendar actividad» pide usuarios, fecha, hora de inicio y de fin, y descripción. El botón «+» abre el modo planeación, en el que se arrastran paneles al calendario. Cada día tiene un menú para guardarlo como rutero o para mover, eliminar o transferir todas sus citas. Las tarjetas muestran el usuario y el punto de contacto, se pintan de verde cuando la visita ya se hizo y al abrirlas muestran mapa, fecha y hora. El engranaje ajusta la vista (de 6:00 a 22:00, en intervalos de 30 minutos).

Se puede agendar hasta 30 días adelante, y solo se agendan Médicos, Clientes, Ruteros y Farmacias. Agendar no es obligatorio: el visitador puede reportar cualquier visita, esté o no en la agenda.

### Ruteros

Son grupos fijos de paneles (rutas) para reutilizar al planear. Se ven como tarjetas por usuario con su número de miembros; cada rutero se puede renombrar, ampliar con nuevos miembros y ver sobre el mapa. Un día de agenda se puede guardar como rutero, y un rutero se puede agendar completo.

### Visita rápida

Permite reportar sin pasar por la agenda. Muestra la lista de paneles con botones por tipo (incluido Contactos) y, en cada fila, Reportar visita o Reportar visita no efectuada. Abre el mismo formulario de visita en un panel lateral, con accesos directos a Zoom, WhatsApp, Teams y Meet para las visitas virtuales.

### Reporte de visita

Es el registro central: de él salen los KPIs, el historial y casi todos los reportes. El encabezado muestra los datos del contacto, su última visita y un cronómetro. Los campos son ciclo, fecha, tipo de actividad, tipo de contacto (chat, e-mail, llamada, presencial o videollamada), comentario (obligatorio), objetivo de la próxima visita, Hábeas Data con imagen de soporte y acompañante. La pestaña Material registra la entrega de material y muestras (hoy vacía, porque no hay inventario cargado) y la de Productos promocionados lista los productos agrupados por marca («VEG MEDICAL» y «MEDIX»). «Visita fallida» abre un diálogo con 15 razones, comentario y la opción de agendar la siguiente visita. También hay un botón «Solicitar asistencia», que no se probó.

Reglas de la configuración actual: la ubicación es obligatoria y la distancia al punto del panel se valida con un radio que se define por usuario. En Médicos y Clientes, 10 de los 13 representantes tienen 500 m, uno tiene 200 m y dos tienen 0, es decir, ninguna validación; falta confirmar si el radio bloquea el reporte o solo advierte. En Farmacias, Pacientes y Contactos el radio está en 0 salvo en un representante. Las visitas no presenciales (llamada, chat, e-mail y videollamada) omiten la validación de ubicación, y la duración es editable. Todos los representantes reportan solo el mismo día: el plazo hacia atrás es de 0 días y no se extiende por fines de semana. Las visitas extra solo se permiten después de completar las del ciclo para ese panel. Médicos y Clientes no tienen tope de una visita diaria ni de visitas por ciclo; los topes existen solo en Farmacias y Pacientes, que hoy están deshabilitados. Si una visita queda abierta, el sistema avisa a los 10 minutos y luego cada 10 minutos. Al guardar, la opción de salida es volver al Inicio.

En la prueba, el tipo de actividad solo ofreció «Visita Comercial», aunque la configuración define también «Visita Médica» para todos los paneles; conviene revisarlo, porque las visitas a médicos pueden quedar clasificadas como comerciales.

### Panel potencial

Lista de 84 prospectos (médicos o clientes que todavía no están en el panel), con la misma mecánica de búsqueda y ficha. La flecha verde de cada fila promueve el prospecto al panel, pero el permiso «promover potenciales» no está configurado en ningún tipo de usuario. En 8 de los 13 representantes, las visitas a potenciales también se validan con un radio de 500 m; en los demás, la distancia no se valida.

### Actividades diferentes a visita

Registra el tiempo de trabajo que no es visita, para que quede trazado en la gestión del día. La vista filtra por rango de fechas y representante y muestra tarjetas y mapa. El formulario pide ciclo, rango de fechas, rango de horas, descripción y tipo de actividad, y permite asociar paneles y material. Se puede registrar hasta 5 días hacia atrás.

### Días autorizados

Aquí se piden las ausencias justificadas, que, una vez aprobadas, se descuentan de la cuota ajustada. El visitador las solicita desde la app («Solicitar días») o desde la web, por días completos o por franjas de horas, y un supervisor o administrador las aprueba. El formulario pide usuario, razón (14 motivos configurados, como capacitación, congreso o reunión administrativa), observaciones y los días en un calendario; quien tiene permiso puede marcar «Aprobar solicitud al guardar». Hay 2.042 solicitudes registradas, pero desde el 22 de agosto de 2025 casi ninguna se resuelve: de las 800 más recientes solo 2 tienen respuesta, cuando antes se resolvían casi todas. Por eso los KPIs muestran 0 días autorizados en todos los ciclos revisados.

### Material promocional

Para el visitador, es recibir material y muestras y entregarlos durante la visita (en la app, «Entrega de material»). La vista reúne el tablero, las solicitudes, los envíos y los ajustes de inventario; despachar y ajustar inventario corresponde a supervisor y administrador. Hoy no hay movimientos en los últimos 30 días ni inventario cargado.

### Visitas

Es el historial de visitas registradas, con filtros por fecha, tipo de visita (realizada, extra o no realizada) y tipo de contacto (presencial o virtual). El detalle muestra el ID, el punto reportado en el mapa, el estado, la distancia a la dirección del panel y las pestañas General, Notas, Ayudas visuales, Material y Productos. En la última semana se registraron 167 visitas.

### Reportes

El visitador tiene 23 de los 28 reportes; el catálogo completo está en la sección del administrador.

### App móvil

La app está pensada para el trabajo de campo: Agenda, Ruteros, Visitas, Panel potencial, Actividades diferentes a visita, Reportes, Solicitar días, Entrega de material, Soporte y Preferencias. Su tablero muestra Médicos, Clientes, Indicadores, Dashboard, Cumpleaños y Parrilla promocional. El reporte de dispositivos muestra 11 equipos (5 Android, 1 iOS y 5 web), es decir, solo 6 móviles para 13 representantes; conviene confirmar cuántos visitadores usan la app. La app no se recorrió en esta revisión; lo anterior sale de su configuración.

## Vistas del administrador y del supervisor

Supervisor y administrador trabajan sobre las mismas vistas del visitador, con dos diferencias: ven a todo su equipo (selector de usuario en Agenda, filtro de supervisor en KPIs, todas las visitas en Visitas) y tienen las acciones de control que el visitador no tiene, como aprobar solicitudes de panel y de días, despachar material, ajustar inventario y remover paneles en lote. Además tienen dos vistas propias, Operaciones y Parrilla promocional, tres reportes de supervisión (cinco en el caso del administrador) y, solo el administrador, el área de Configuración con la gestión de usuarios.

### Operaciones

Es la bandeja donde se aprueban los cambios al panel que piden los representantes.

| Bandeja | Qué la origina | Estado hoy |
| --- | --- | --- |
| Altas | Un representante crea un médico o un cliente | 134 pendientes y 29 resueltas |
| Bajas | Un representante inactiva un panel | 19 pendientes, la más antigua de noviembre de 2025 |
| Reasignación | Se pide pasar un panel a otro representante | 0 pendientes y 64 resueltas |
| Reactivaciones | Se pide reactivar un panel inactivo | 0 pendientes |

Cada solicitud se resuelve en un diálogo con comentario opcional, con quién se comparte, la opción «Realizar transferencia» y los botones Rechazar y Aceptar. También se pueden aceptar o rechazar varias a la vez, y un interruptor muestra las ya resueltas. Al abrir una bandeja, la lista dice «No se encontraron resultados» durante 7 a 10 segundos antes de cargar, lo que puede hacer creer que no hay pendientes.

### Parrilla promocional

Define qué se promociona en cada ciclo: vigencia (ciclo inicial y final), país, líneas, especialidades, contenido y las ayudas visuales, materiales y productos que lo acompañan. Hoy no hay parrillas creadas ni ayudas visuales cargadas, así que el visitador no tiene en VMO una guía de mensajes por especialidad y la pestaña Ayudas visuales de las visitas queda vacía.

### Seguimiento del equipo

En KPIs, la tabla de cumplimiento tiene una fila por usuario con su ciudad, cuota y cumplimiento. Hoy muestra a 10 de los 13 representantes y a 2 supervisores, que también tienen cuota; los otros 3 representantes solo aparecen en la tabla de cobertura, sin visitas en octubre. Dos representantes tienen cuota 0, de modo que su cumplimiento sale en 0 % aunque ya registran visitas, y la tabla de cobertura y frecuencia da cumplimientos de frecuencia por debajo del 3,5 % por la forma en que está configurada la frecuencia (ver *Lógica de negocio*).

En Agenda, el selector de usuario permite ver, mover o transferir citas de cualquier representante de su equipo. En Visitas aparecen las de todo el equipo, con la distancia entre el punto reportado y la dirección del panel. En Días autorizados se aprueban o eliminan las solicitudes y se pueden crear ya aprobadas.

En Material promocional, además del tablero y las solicitudes, están Envío (país, representante, fecha y materiales), Envío en lote (carga de archivo) y Ajuste de inventario. El catálogo de solicitud muestra 18 materiales, con «Galletas» repetido, mientras la configuración tiene 10 activos; y el tablero, sin movimientos en 30 días, aparece vacío sin ningún mensaje que lo explique.

### Reportes

Hay 28 reportes en seis grupos; la parte superior de la vista tiene accesos directos a cuatro de ellos.

| Grupo | Reportes | Quién los ve |
| --- | --- | --- |
| Paneles (8) | Contactos · General; Duplicados · Clientes; Duplicados · Médicos; General · Clientes; General · Médicos; Panel · conteo por usuario; Paneles inactivos; Paneles sin asignar | Todos |
| Agenda (2) | Efectividad de la agenda; General · Agenda | Supervisor y administrador |
| Material promocional (4) | Envíos de material y muestras a representantes; Inventario de material y muestras por representantes; Material · Muestras · Ajustes; Material · Muestras · Entregas | Todos |
| Visita (10) | Actividad diaria; Consulta general de la gestión; Efectividad de la visita; Frecuencia de la visita; General · Visitas; Pendientes por visitar; Porcentaje de cobertura (Estadística); Totalizados de frecuencia entre ciclos; Visita · Ubicaciones; Visitas por tipo de contacto | Todos, salvo Consulta general de la gestión (solo administrador) |
| Otros (2) | Días autorizados; Actividades diferentes a visita | Todos |
| Usuarios (2) | Dispositivos del usuario; Ubicaciones de representantes | Dispositivos: solo administrador. Ubicaciones: supervisor y administrador |

Lo que muestran hoy algunos de ellos: General · Médicos tiene 2.255 registros (los 2.178 activos más 77 inactivos) y General · Clientes, 824; los de duplicados marcan 166 médicos y 249 clientes; Paneles sin asignar, 99 médicos sin representante; Dispositivos del usuario, 11 equipos (5 Android, 1 iOS y 5 web). Los cuatro reportes de material están vacíos y el encabezado de General · Agenda muestra «NaN».

### Configuración y usuarios (solo administrador)

El engranaje de la barra superior abre 25 módulos de configuración (detallados en la sección siguiente), con accesos directos a tres de ellos: Usuarios, Agenda y Ciclos. La gestión de usuarios lista los 19 usuarios activos con documento, tipo, correo, supervisores, dirección, zona, ciudad, país y grupo, con un interruptor para ver los inactivos y opciones de exportación. Tiene pestañas para Tipos de usuario, Grupos de usuario y Documentos, y el menú de cada usuario ofrece Credenciales, Recuperar contraseña, Editar, Cuotas, Restricciones, Preferencias, Permisos, Sincronización remota, Alertas e Inactivar.

## Configuraciones

La configuración está en el engranaje de la barra superior, solo para el administrador, y se reparte en 25 módulos. Casi todos los parámetros admiten un valor distinto por país; en los revisados, el valor aplica a «Todos los países». Las tablas resumen qué controla cada módulo y cómo está hoy.

### Operación comercial

| Módulo | Qué controla | Cómo está hoy |
| --- | --- | --- |
| Ciclos | Periodos de medición | 30 ciclos mensuales; el vigente es octubre de 2026 (del 1 al 31). Cada ciclo tiene días no laborales con porcentaje y grupos, y se puede editar, eliminar o activar |
| Días no hábiles | Festivos que se descuentan de los días hábiles | 18 fechas en 2026; falta el 2 de noviembre (Todos los Santos) y está el 13 de julio, que no es festivo nacional |
| General | Unidad base de las cuotas de visita | Ciclo (la alternativa es diaria) |
| Agenda | Campos del formulario de agenda y reglas para agendar | Hasta 30 días adelante; se agendan Médicos, Clientes, Ruteros y Farmacias |
| Visita | Razones de visita fallida, visita virtual, restricciones, reporte, número de visitas, tipos de actividad y parámetros | 15 razones de visita fallida. Zoom, WhatsApp, Teams y Meet permitidos. Tope de una visita diaria solo en Farmacias y Pacientes, y tope por ciclo solo en Pacientes, dos paneles hoy deshabilitados. El plazo de reporte no se extiende por fin de semana; visita extra permitida solo con las del ciclo completas; aviso de visita abierta a los 10 minutos y cada 10 minutos. Número de visitas por ciclo: 10 en Médicos, Farmacias y Clientes; 1 en Pacientes, Panel potencial y Contactos. Tipos de actividad Visita Médica y Visita Comercial (peso 1). Productos agrupados por marca, salida «Guardar e ir a Inicio» y ubicación requerida |
| Categorías | Clasificación de los paneles | A, B y C, del tipo «Categoría» para Médicos y Clientes; no tienen frecuencia propia |
| Motivo de día autorizado | Razones para pedir ausencias | 14 motivos con su disponibilidad |
| Comentarios predefinidos | Textos listos para elegir en los formularios | Ninguno |

### Paneles y formularios

| Módulo | Qué controla | Cómo está hoy |
| --- | --- | --- |
| Formulario: Paneles | Campos de médicos, clientes y demás paneles; campos informativos; duplicidad; búsqueda | Campos dinámicos con llave, tipo de dato, etiqueta, control, dependencias, obligatoriedad condicional y permisos por tipo de usuario para crear, editar, ver y exigir. Duplicidad sin campos definidos; campos informativos y validaciones extra vacíos. Autocompletar y mayúsculas apagados; búsqueda general activa, incluida la información sensible; la inactivación pide una razón predefinida |
| Formulario: Visita | Campos, pestañas y tipos del reporte de visita | Pestañas visibles: Entrega de material y Productos; ocultas: Shopping, Pedidos, Inventario y Verificación. Tipos de visita Normal y Extra. Tipos de contacto con duración editable; todos salvo Presencial omiten la validación de ubicación |
| Formulario: Actividad diferente a visita | Campos y plazo de registro | Ciclo, rango de fechas, rango de horas, descripción y tipo de actividad; se registra hasta 5 días hacia atrás |
| Formulario: Contacto | Campos de los contactos de clientes | Formulario básico |
| Paneles | Especialidades, motivos de eliminación, documentos e IPS | 33 especialidades, una escrita «Otorrinoloaringología»; los motivos de eliminación tienen texto de relleno «Lorem ipsum»; sin documentos ni IPS |
| Médicos | Universidades y estilos del médico | Sin universidades; estilos Amable, Analítico, Emprendedor y Expresivo |
| Demarcaciones administrativas | Bricks, zonas, ciudades, regiones y países | Sin bricks; zonas 001 a 011, algunas inactivas; unas 1.100 ciudades; tres regiones con sufijos ajenos a VG Medical («Suroccidente - Lfb», «Centro - Lfb - Swisskol», «Norte - Natura»), que parecen venir de otra implementación; país Colombia |

### Material y producto

| Módulo | Qué controla | Cómo está hoy |
| --- | --- | --- |
| Material promocional | Catálogo, proveedores, categorías y reglas de entrega | 10 materiales activos (categoría POP, línea Vg Medical) y ningún proveedor. No exige aceptación del visitador ni agrupa por categorías, y no hay autoenvío. Solo se entrega con existencias del lote, con restricción de muestras próximas a vencer (30 días) y solo material en estado «Despachado» |
| Productos | Productos, líneas y marcas | 2 productos: «4dryfield» (marca Medix) y «Perossal» (marca «Veg Medical»); líneas Vg Medical y Medix Colombia; sin segmentos |
| Ayudas visuales | Piezas para mostrar durante la visita | Ninguna |

### Cuenta, acceso y seguridad

| Módulo | Qué controla | Cómo está hoy |
| --- | --- | --- |
| Laboratorio | Datos de la empresa | Nombre VGMEDICAL; NIT, dirección y teléfono vacíos |
| Legal | Textos legales que acompañan los registros | 6 plantillas de Hábeas Data, todas vacías |
| Autenticación | Sesiones simultáneas y bloqueo | Máximo 3 dispositivos móviles y 2 web activos a la vez; intentos antes de bloqueo y horas de bloqueo en 0, es decir, sin bloqueo por intentos fallidos; el usuario puede cambiar su contraseña |
| Almacenamiento | Espacio para archivos | Muestra 0 GB y ofrece planes de 15, 50 y 100 GB; el tamaño máximo de archivo aparece como 10.000, sin unidad y con la etiqueta sin traducir |
| Menú web y Menú móvil (dos módulos) | Opciones, reportes y tablero por tipo de usuario | Ver *Roles y accesos* |
| Usuarios | Usuarios, tipos, grupos y documentos | 19 usuarios activos en tres tipos y un grupo; ver *Roles y accesos* |

### Configuración de cada usuario

Cada usuario tiene además cinco pantallas propias. Restricciones y permisos se revisaron en los 13 representantes, las cuotas a través de los KPIs, y preferencias y alertas en uno.

| Pantalla | Qué controla | Valor |
| --- | --- | --- |
| Cuotas | Visitas esperadas por ciclo y tipo de panel | En la tabla de cumplimiento de octubre, 7 representantes tienen 140, uno 56 (48 a médicos y 8 a clientes) y dos 0; los otros 3 no aparecen |
| Restricciones | Plazo, distancia y agenda | Todos: 0 días hacia atrás para reportar, sin máximo de direcciones ni restricciones de agenda, rutas inteligentes apagadas y permiso para reportar cualquier visita, agendada o no. Radio en Médicos y Clientes: 500 m en 10 representantes, 200 m en uno y 0 (sin validación) en dos; en Panel potencial, 500 m en 8 y 0 en el resto; en Farmacias y Pacientes, 0 salvo un representante con 600 m; en Contactos, 0 |
| Preferencias | Ubicación y ajustes de uso | En el representante revisado, ubicación en tiempo real, envío automático cada 5 minutos y estado del dispositivo desactivados; incluye ajustes de radio a pie y espacios libres |
| Permisos | Acciones por tipo de panel | Médicos: leer, crear, editar e inactivar en todos; altas y bajas sin autorización en No en 12 representantes y en Sí en uno. Todos pueden editar el número de visitas de cada médico y crear, editar o inactivar direcciones sin aprobación |
| Alertas | Avisos por indicador | En el representante revisado: días sin visitar, y valor y cantidad de transferencias de valor |

## Lógica de negocio

### Cómo se calculan los indicadores

Todo se mide por ciclo (mensual) y por representante. Los ejemplos son de un mismo representante en el ciclo de octubre de 2026.

| Indicador | Cálculo | Ejemplo |
| --- | --- | --- |
| Días hábiles | Suma de los días del ciclo según el horario laboral (lunes a viernes 1, sábado 0,5, domingo 0), menos los días no hábiles | 22 + 5 × 0,5 − 1 festivo = 23,5 |
| Días hábiles hasta el momento | Lo mismo, contado hasta hoy | 8, con corte al 11 de octubre |
| Cuota del periodo | Suma de las cuotas del usuario por tipo de panel (unidad base: ciclo) | 140 (en otro representante, 48 a médicos + 8 a clientes = 56) |
| Cumplimiento | Visitas ÷ cuota del periodo | 47 ÷ 140 = 33,57 % |
| Promedio diario | Visitas ÷ días hábiles hasta el momento | 47 ÷ 8 = 5,88 |
| Cuota y cumplimiento ajustados | Cuota corregida por los días autorizados del ciclo | En todos los ciclos revisados los días autorizados están en 0, así que cuota ajustada = cuota |
| Cobertura | Miembros visitados al menos una vez ÷ miembros del panel | 43 ÷ 184 = 23,37 % |
| Cuota de frecuencia | Suma del número de visitas esperado de cada miembro del panel | 1.441 para un panel de 184 miembros |
| Cumplimiento de frecuencia | Visitas totales ÷ cuota de frecuencia | 47 ÷ 1.441 = 3,26 % |

Como referencia de ritmo: al 11 de octubre han pasado 8 de 23,5 días hábiles, el 34 % del ciclo, así que un representante va al día si su cumplimiento ronda ese porcentaje. El del ejemplo es el de mejor avance del equipo; la mayoría va por debajo. El filtro «Incluir visitas extra» decide si las visitas extra suman.

### Lo que hoy distorsiona los indicadores

La frecuencia por defecto es de 10 visitas por ciclo para cada médico, cliente y farmacia, y las categorías A, B y C no la cambian. Por eso la cuota de frecuencia de un panel de 184 miembros llega a 1.441 visitas al mes (7,8 por miembro en promedio, porque algunos tienen una frecuencia menor), frente a una cuota del periodo de 140, y el cumplimiento de frecuencia de todo el equipo queda por debajo del 3,5 %. Los dos indicadores miden metas incompatibles, y hoy el cumplimiento de frecuencia no sirve para gestionar.

Dos representantes tienen cuota 0, así que su cumplimiento aparece en 0 % aunque registran visitas, y otros tres no aparecen en la tabla de cumplimiento.

Los días autorizados tampoco descuentan nada: como las solicitudes no se aprueban desde agosto de 2025, los KPIs muestran 0 días autorizados en todos los ciclos revisados (diciembre de 2025 y julio a octubre de 2026), y la cuota ajustada siempre es igual a la cuota.

El calendario de festivos de 2026 no tiene el 2 de noviembre (Todos los Santos) y sí tiene el 13 de julio, que no es festivo nacional. Julio se midió con 23 días hábiles en lugar de 24, como muestran los KPIs de ese ciclo, y noviembre se medirá con 22 en lugar de 21: el 2 de noviembre los visitadores aparecerán con un día hábil sin visitas y el promedio diario saldrá más bajo de lo real.

### Reglas al reportar una visita

| Regla | Valor actual | Qué implica |
| --- | --- | --- |
| Ubicación | Obligatoria | La visita se registra con el punto GPS del dispositivo |
| Radio | Por usuario: en Médicos y Clientes, 500 m en 10 representantes, 200 m en uno y 0 en dos | Con 0 no se valida la distancia; falta confirmar si un radio mayor bloquea el reporte o solo advierte |
| Visitas no presenciales | Omiten la validación de ubicación | Llamada, chat, e-mail y videollamada se reportan desde cualquier lugar |
| Plazo | 0 días hacia atrás, sin extensión por fin de semana | La visita se reporta el mismo día |
| Agenda | Se puede reportar cualquier visita | Agendar no es requisito |
| Topes | Diario solo en Farmacias y Pacientes, y por ciclo solo en Pacientes, dos paneles hoy deshabilitados | Un médico puede recibir varias visitas el mismo día y más de las de su frecuencia |
| Visitas extra | Solo con las del ciclo completas | Con frecuencia 10, en la práctica casi nunca aplica |
| Visita abierta | Aviso a los 10 minutos y luego cada 10 | Evita visitas iniciadas que nunca se cierran |

Como las visitas no presenciales no pasan por la validación de ubicación, conviene revisar en el reporte «Visitas por tipo de contacto» qué parte de las visitas de cada representante es virtual.

### Solicitudes y aprobaciones

Salvo un representante con permiso para hacerlo, los representantes no dan altas ni bajas directas: crear un médico o cliente, inactivarlo, pedir que se reasigne o que se reactive genera una solicitud en *Operaciones*, que supervisor o administrador aceptan o rechazan, con comentario y la opción de transferir. Hoy hay 134 altas y 19 bajas esperando respuesta; la baja más antigua es de noviembre de 2025. Las ausencias siguen el mismo camino: el representante pide los días con uno de los 14 motivos y, una vez aprobados, deberían contar como días autorizados en los KPIs. Pero desde el 22 de agosto de 2025 casi ninguna solicitud se resuelve (2 de las 800 más recientes), cuando antes se resolvían casi todas, así que ese ajuste no está ocurriendo. Las direcciones y la frecuencia de cada médico, en cambio, el representante las cambia sin aprobación.

### Material y muestras

El administrador o supervisor envía material a cada representante, uno a uno o en lote desde un archivo. El representante lo entrega en la visita, desde la pestaña Material o desde «Entrega de material» en la app, y solo puede entregar lo que está en estado «Despachado», con existencias del lote y respetando la restricción de muestras próximas a vencer (30 días). No tiene que confirmar la recepción. Como hoy no hay inventario cargado, este circuito no se está usando.

### Calidad del panel

El formulario de paneles no tiene campos de duplicidad, así que VMO no advierte cuando se crea un médico o cliente que ya existe; los reportes de duplicados marcan 166 médicos y 249 clientes. Además hay 99 médicos sin representante asignado y 77 inactivos. Al inactivar, la razón se elige de una lista predefinida; si es la de motivos de eliminación del panel, hoy tiene textos de relleno y el motivo de las bajas no queda registrado de forma útil. Y como los representantes pueden crear y editar direcciones sin aprobación, también pueden cambiar el punto contra el que se mide la distancia de sus visitas.

## Hallazgos y recomendaciones

La herramienta es completa y coherente: todas las listas comparten el mismo patrón de búsqueda, filtros, columnas y exportación; las fichas se abren en paneles laterales sin perder la lista; los formularios se configuran campo por campo; los menús se ajustan por rol; y el reporte de visita combina GPS, visita virtual y entrega de material en un solo flujo. Lo que más le resta valor hoy no es la interfaz sino la configuración, los datos maestros y las aprobaciones pendientes. Los hallazgos van ordenados por impacto.

### Prioridad alta

| Hallazgo | Por qué importa | Recomendación |
| --- | --- | --- |
| Las solicitudes de días autorizados no se resuelven desde agosto de 2025: solo 2 de las 800 más recientes tienen respuesta | La cuota nunca se ajusta por ausencias, y los KPIs miden al visitador como si hubiera trabajado los días que pidió | Resolver lo represado, definir quién aprueba y en qué plazo, y confirmar que los supervisores reciben el aviso |
| Festivos mal cargados: falta el 2 de noviembre y sobra el 13 de julio | Noviembre se medirá con 22 días hábiles en lugar de 21 | Agregar el 2 de noviembre y retirar el 13 de julio antes del 1 de noviembre; cargar ya los festivos de 2027 |
| Frecuencia por defecto de 10 visitas por ciclo y categorías sin frecuencia propia | El cumplimiento de frecuencia queda por debajo del 3,5 % y no sirve para gestionar | Bajar el valor por defecto a la frecuencia real y ajustarla por médico según su categoría con «Editar cuotas de visita» o con la importación de paneles |
| Las 6 plantillas de Hábeas Data están vacías | El consentimiento que se marca en la visita no queda asociado a ningún texto de autorización de tratamiento de datos (Ley 1581 de 2012) | Cargar el texto aprobado por el área legal |
| 134 altas y 19 bajas sin resolver; la baja más antigua es de noviembre de 2025 | Hay médicos nuevos sin gestionar y un panel desactualizado | Depurar la bandeja y fijar un plazo de respuesta para supervisores |
| Controles distintos entre representantes: dos sin validación de distancia, uno con 200 m y uno que crea e inactiva médicos sin aprobación | Algunos visitadores pueden reportar visitas presenciales desde cualquier lugar o cambiar el panel sin control | Unificar radio y permisos por usuario, o dejar justificada cada excepción |
| Sin reglas de duplicidad; 166 médicos y 249 clientes duplicados | Visitas y cobertura repartidas entre registros repetidos | Definir campos de duplicidad (documento o registro médico; nombre y ciudad) y depurar con el reporte de duplicados |
| Dos representantes con cuota 0 | Su cumplimiento sale en 0 % aunque visitan | Asignarles cuota |

### Prioridad media

| Hallazgo | Recomendación |
| --- | --- |
| Los motivos de eliminación de paneles son textos «Lorem ipsum» | Reemplazarlos por motivos reales, como traslado, retiro de la práctica, fuera de objetivo o duplicado |
| Al reportar una visita a un médico solo aparece el tipo de actividad «Visita Comercial» | Revisar los tipos de actividad para que la visita médica quede bien clasificada |
| Parrilla promocional, ayudas visuales e inventario de material vacíos; catálogo de solicitud con 18 materiales, uno repetido, frente a 10 activos | Cargar la parrilla del ciclo con sus piezas y el inventario inicial, o esconder esas pestañas mientras no se usen |
| 99 médicos sin representante asignado | Asignarlos o inactivarlos |
| Médicos y clientes sin tope de una visita diaria | Activar el tope diario para evitar dobles registros el mismo día |
| Sin bloqueo por intentos fallidos de inicio de sesión | Configurar un número de intentos y un tiempo de bloqueo |
| Matriz de permisos con huecos: el supervisor tiene historial de movimientos, cierre de inventario y acompañamiento, y el administrador no; este además tiene en No «ver todas las visitas del panel», y nadie puede promover potenciales | Revisar la matriz y decidir quién promueve potenciales |
| Visitas no presenciales sin validación de ubicación | Seguir mes a mes la proporción de visitas virtuales por representante |
| Datos maestros sucios: laboratorio sin NIT, dirección ni teléfono; marca «Veg Medical»; especialidad «Otorrinoloaringología»; regiones con nombres ajenos; zonas inactivas | Limpiarlos en una sola jornada de depuración |
| La búsqueda general deja ver médicos, clientes y contactos no asignados, y el parámetro de información sensible en la búsqueda está activo | Revisar si los representantes deben tenerla y apagar la información sensible en la búsqueda |
| Los representantes cambian direcciones y frecuencias de sus médicos sin aprobación | Pasar los cambios de dirección por aprobación, porque de ellas depende la validación de distancia |
| Solo 6 dispositivos móviles registrados para 13 representantes | Confirmar quiénes usan la app y quiénes reportan desde la web |

### Usabilidad de la interfaz

| Hallazgo | Dónde | Efecto |
| --- | --- | --- |
| Mezcla de inglés y español | Calendarios de Agenda y Días autorizados; nombres de los bloques del tablero en la configuración del menú móvil | Se ve poco cuidado y confunde fechas |
| Etiquetas sin traducir (FLAG.MAX-FILE-SIZE, FORM.ACCEPT-OTHER-VALUE, RP.PHARMACY-CHAIN-PRODUCT, undefined.undefined) | Almacenamiento y pantallas de configuración | El administrador no sabe qué está cambiando |
| «NaN» en el encabezado | Reporte General · Agenda | Resta confianza en el reporte |
| Estado vacío falso durante la carga | Bandejas de Operaciones (7 a 10 segundos) | Se puede concluir que no hay pendientes |
| Pantallas vacías sin explicación | Tablero de material promocional | No se distingue «sin datos» de «no cargó» |
| Mapas que abren con zoom mundial | Ruteros | Hay que buscar el punto a mano |
| Botón de mapa bloqueado por plan («PRO o por demanda») visible | Barras de herramientas de las listas | Ofrece algo que no se puede usar |
| Íconos sin texto ni ayuda emergente | Acciones de fila y barras de herramientas | Hay que probar para saber qué hace cada uno |
| Listas de más de 36 columnas con textos truncados | Médicos | Obliga al desplazamiento horizontal; se mitiga ocultando columnas |
| Menú lateral que se despliega al pasar el cursor | Toda la aplicación | Provoca clics accidentales |
| No se observó aviso de cambios sin guardar | Formularios y paneles laterales | Se puede perder lo digitado al cerrar |

## Alcance y método

El recorrido se hizo el 11 de octubre de 2026 en vmo.com.co con un usuario Administrador del sistema de VG Medical, en modo de solo lectura: no se guardó, aprobó, rechazó, eliminó ni envió nada, no se descargaron archivos y no se probaron acciones con efectos como Solicitar asistencia, Reportar ubicación, Sincronización remota, Credenciales o Recuperar contraseña. La experiencia del visitador se reconstruyó a partir de la configuración de menús y permisos del tipo Representante, sin iniciar sesión como representante, y la app móvil no se recorrió: se documenta su configuración. Las cifras son las de ese día. Los nombres y datos de médicos, clientes y usuarios se omitieron a propósito.

Queda por validar con un usuario Representante lo que ve y puede hacer en la web y en la app, si el radio de 500 m bloquea el reporte o solo advierte, y por qué el tipo de actividad solo ofrece «Visita Comercial». La fórmula exacta de la cuota ajustada no se pudo comprobar, porque ningún ciclo revisado tiene días autorizados aprobados. Restricciones y permisos de panel se revisaron en los 13 representantes; preferencias y alertas, en uno.

Fuente de los festivos de 2026: [El Tiempo, «El 2026 tendrá 18 días festivos y 15 puentes»](https://www.eltiempo.com/cultura/gente/el-2026-tendra-18-dias-festivos-y-15-puentes-para-descansar-cuales-son-las-mejores-fechas-para-pedir-vacaciones-3520528).
