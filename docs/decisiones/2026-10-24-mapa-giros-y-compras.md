# 2026-10-24 – El mapa muestra giros ADRES y compras públicas SECOP de 12 meses en lugar de los contratos cargados a mano

**Contexto**: las tarjetas del mapa mostraban los contratos cargados a mano (`hospital_contracts`: 93 filas, 92 "activas"
con fecha de fin vencida, última edición 2025-12-30) con el nombre de cada proveedor, y el interruptor "Solo con
Contratos". Los giros de la ADRES (Identifica tu Giro) y la contratación pública de SECOP ya estaban cargados y se veían en
la ficha de la IPS y en `/inteligencia`, pero no en el mapa. Con sus palabras (2026-10-24): "tenemos una información de
contratos y proveedores con nombre propio […] está súper desactualizado. Recientemente hicimos lo de los giros de la ADRES
y la contratación pública de SECOP. Yo quiero que ESA sea la información que sale en el mapa […] si le doy clic al
municipio, que me diga cuánto tiene en total en giros, cuánto en compras, cuáles son los proveedores. SECOP trae cosas
viejísimas; quiero los últimos 12 meses […] y si le doy clic a un hospital público que tiene contratos o giros, que me
salga esa información." A las diez recomendaciones de "Para decidir (dueño)" de la spec respondió "ok".

**Decisión** (spec `docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md`, aprobada el 2026-10-24):
1. **Qué sale en el mapa**: al hacer clic en un municipio o localidad de Bogotá con IPS, "Giros ADRES" (Total,
   Contributivo, Subsidiado, Otro, NIT con giro) y "Compras públicas de material ortopédico y neurocirugía (SECOP)"
   (Valor adjudicado, Contratos, Entidades y los proveedores ordenados por valor); al hacer clic en una IPS, lo mismo
   con la parte de esa sede. Los globos (tooltips) siguen sin cifras.
2. **Total de giros = todos los regímenes** (contributivo + subsidiado + otro, como `/inteligencia`), con las tres cifras
   visibles para que cualquier comparación se explique. Unificar "Datos de la zona" a `todos` queda como cambio aparte.
3. **Quién lo ve**: los roles con `intelligence:view` (admin, dirección comercial, líderes de línea, datos y viewer). Los
   Ejecutivos Comerciales (`sales_manager`) no, por ahora; darles el permiso abriría también todo `/inteligencia` y se
   decide aparte. Sin el permiso, la tarjeta de siempre, sin llamada ni error.
4. **Se quitan del mapa los contratos cargados a mano**: la fila "Contratos", la sección "Contratos activos" y el
   interruptor "Solo con Contratos", sin reemplazo; `/api/map/data` deja de leer `hospital_contracts`. `/contracts`,
   `/providers` y sus API siguen vivos hasta decidir su borrado.
5. **Ventana de 12 meses solo en el mapa**: giros, los 12 meses que terminan en el último mes con giros cargados; SECOP,
   12 meses calendario hasta hoy. La ficha y el ranking de `/inteligencia` siguen en 24 meses.
6. **Solo material ortopédico y neurocirugía** (las 6 líneas), rotulado así siempre; "Sin clasificar (proveedores
   vigilados)" aparte y con valor; sin conmutador "todas las compras" (la carga de SECOP no guarda todas las compras del
   hospital y el conmutador prometería algo falso).
7. **Personas naturales proveedoras**: no se nombran en el mapa; van agrupadas como "Personas naturales: N contratos". La
   ficha de la IPS sigue mostrándolas. Los servicios de especialistas tampoco se nombran: "Servicios de especialistas:
   N contratos".
8. **Migración 0880 (`adres_giros_nits`)**: opcional y aditiva; se aplica con el despliegue, con autorización del dueño.
   **Aplicada el 2026-10-25** en la ventana del despliegue (orden del dueño: "Deja en producción"); comprobada: el
   Hospital Universitario de Santander da $362.047.914.980 en 12 meses, igual que la tarjeta; anon sin EXECUTE.
   El código funciona antes y después (respaldo `loadGirosIntel`).
9. **NIT de HOCEN**: es dato, no código; se corrige el dato (OpMap 830041314, SECOP contrata con 830067597).
10. **Municipio de alcance sin IPS**: una línea que explica que no hay dato ("Giros y compras se cuentan donde está la
    IPS; este municipio no tiene IPS en OpMap"), para que las líderes no crean que falló.

**Consecuencias**:
- Giro de una IPS = giro de su NIT × su parte por camas entre las sedes activas del NIT; giro de un territorio = suma de
  sus IPS activas. Nada se cuenta dos veces; si algún NIT tiene sedes en varios municipios la tarjeta avisa "parte por
  camas (estimación)". Las compras siguen la misma parte.
- Se cierra el hueco anotado el 2026-10-14 (`viewer`, `data_manager` y `user` con línea recibían contratos sin
  `contracts:view`): el mapa ya no manda contratos a nadie y `contracts:view` deja de influir en él.
- Los datos nuevos no viajan en `/api/map/data`: se piden al abrir la tarjeta (dos rutas nuevas con
  `intelligence:view`), con 5 minutos de caché en el cliente. Costo de Google Maps: 0 elementos.
- La estética del mapa no cambia (polígonos, puntos, insignias, colores, opacidades, capas y globos); solo el contenido
  de las tarjetas, con los estilos que ya existían. Quitar el interruptor "Solo con Contratos" fue autorizado por el dueño.
- Descartado: colorear o rankear municipios por giros o compras, un filtro "Solo con compras públicas", números en los
  globos, giros por municipio del paciente, entidades públicas que no son IPS de OpMap, cambiar la ficha o el ranking a
  12 meses y borrar las páginas y tablas de contratos manuales (pendiente aparte).
- Texto visible sin "KAM", "panel" ni "representante"; nunca "sin compras" (es "Sin contratos de ortopedia o neurocirugía
  en SECOP en los últimos 12 meses").

**Dónde vive en el código**:
- Contratos y cuentas puras: `web/lib/types/mapa-detalle.ts` (`MAPA_VENTANA_MESES`, `TerritorioDetalle`, `IpsDetalle`) y
  `web/lib/mapa-detalle.ts` (`ventanaGiros`, `ventanaSecop`, `resumirGiros`, `resumirCompras`, `estadoCompras`,
  `MAPA_DETALLE_TEXTOS`); prueba `web/scripts/mapa-detalle-check.ts`.
- Rutas: `web/app/api/map/detalle/territorio/route.ts`, `web/app/api/map/detalle/ips/[id]/route.ts`,
  `web/app/api/map/_lib/detalle-server.ts`; `/api/map/data` sin contratos y con `inteligenciaIncluida`; pruebas
  `web/scripts/mapa-detalle-api-check.ts` y `web/scripts/mapa-zonas-api-check.ts`.
- Tarjetas: `GirosComprasSection` en `web/components/MapPopups.tsx`; carga perezosa `useQuery(['map-detalle', tipo, code])`
  en `web/components/MapComponent.tsx`; `web/components/MapControls.tsx` sin "Solo con Contratos".
- Documentación: `docs/mapa-estetica.md` ("2026-10-24"), `docs/fases/fase5-secop.md`, `web/docs/ROLES_AND_PERMISSIONS.md`,
  `CLAUDE.md`; la 0880 en `database/migrations/2026-10-24_0880_adres_giros_nits.sql` con su rollback.
