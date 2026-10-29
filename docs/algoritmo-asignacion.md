# Algoritmo de asignación territorial

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado)._

## Lógica de Asignación Territorial

### Principios Fundamentales del Algoritmo

Antes de explicar el proceso de asignación, es crucial entender los principios que gobiernan todo el sistema OpMap. Estos principios actúan como las reglas de negocio inmutables que el algoritmo debe respetar en cada decisión que toma.

**Principio 1: Asignación por Proximidad Temporal**
El sistema asigna cada IPS al KAM que pueda llegar en el menor tiempo posible, calculado mediante la API de Google Maps Distance Matrix en modo automóvil. Este cálculo tiene un límite máximo configurable de 4 horas (240 minutos). La razón de usar tiempo en lugar de distancia es simple: en el mundo real, un KAM puede estar a 50 km de una IPS por autopista y llegar en 40 minutos, mientras que otro KAM a 30 km por caminos montañosos podría tardar 2 horas.

**Principio 2: Territorio Base Garantizado**
Cada KAM tiene derecho automático e irrevocable sobre todas las IPS ubicadas en su municipio o localidad de residencia. Este principio tiene una implicación algorítmica fundamental: estas IPS nunca entran en competencia y pueden excluirse completamente de los cálculos de la API de Google Maps, generando un ahorro significativo en consultas y tiempo de procesamiento.

**Principio 3: Expansión Territorial Inteligente de Dos Niveles**
La búsqueda de IPS adicionales para cada KAM sigue una lógica de expansión geográfica controlada:
- **Nivel 1**: Departamento del KAM y sus departamentos fronterizos directos
- **Nivel 2**: Departamentos fronterizos de los fronterizos (habilitado para todos los KAMs)

Esta expansión utiliza la matriz de adyacencia para garantizar que solo se consideren rutas geográficamente viables. Con `enableLevel2: true` para todos los KAMs, se logran asignaciones más óptimas como Plato a Sincelejo en lugar de Cartagena.

**Principio 4: Zonas Comerciales Dinámicas**
OpMap no asigna departamentos completos: cada territorio de KAM se construye como una zona personalizada que combina municipios y localidades contiguas. Parte del territorio base del KAM, incluye municipios/localidades del mismo departamento o de departamentos limítrofes (Nivel 1) y añade los de segundo grado (Nivel 2), siempre dentro del límite maxTravelTime de 240 minutos. Así se optimizan los tiempos de desplazamiento y se evitan territorios artificiales basados en divisiones político-administrativas.

**Principio 5: Reglas Especiales para Bogotá**
Los KAMs ubicados en localidades de Bogotá tienen reglas especiales:
- Solo ellos compiten por IPS dentro de las localidades de Bogotá
- Pueden expandirse a Cundinamarca y sus departamentos vecinos
- Desde el 2026-10-28 Bogotá se reparte en **4 sectores por localidad** (Norte, Occidente, Sur y Oriente): cada IPS
  de Bogotá va a la Zona del sector de su localidad, sin minutos (ver "Bogotá en 4 sectores" abajo). Antes las
  localidades compartidas se asignaban por mayoría de IPS ganadas
- Esto evita que KAMs externos "invadan" la capital
- Hacia afuera (IPS fuera de Bogotá) sus celdas compiten como UNA ciudad con tope único y reparto por
  corredor de salida: ver "Bogotá hacia afuera: una ciudad, cuatro corredores" (desde 2026-10-11)

### Algoritmo de Asignación: Flujo de Ejecución

El algoritmo OpMap sigue una secuencia lógica de ocho fases, donde cada fase prepara los datos necesarios para la siguiente, optimizando el uso de recursos y minimizando las consultas a la API externa.

#### Fase 1: Inicialización y Carga de Datos

El algoritmo comienza cargando en memoria todos los archivos necesarios para el procesamiento:

```python
# Pseudocódigo conceptual
sellers = cargar_json('sellers.json')          # Ubicación de cada KAM
hospitals = cargar_psv('hospitals.psv')        # Todas las IPS del país
adjacency = cargar_json('adjacency_matrix.json') # Departamentos fronterizos
excluded = cargar_json('excluded_departments.json') # Departamentos a ignorar
```

Esta fase establece el estado inicial del sistema con todos los datos necesarios en memoria, evitando lecturas repetidas de disco durante el procesamiento.

#### Fase 2: Asignación de Territorios Base y Construcción del Filtro de Exclusión

Esta es la fase más importante para la optimización del algoritmo. Aquí ocurren dos procesos fundamentales en paralelo:

**Proceso 2.1: Asignación Automática del Territorio Base**
```python
# Para cada KAM en el sistema
para cada kam en sellers:
    area_id = kam['areaId']  # Ejemplo: '08001' (Barranquilla)
    
    # Buscar todas las IPS en el mismo municipio/localidad
    ips_territorio_base = filtrar(hospitals, donde:
        hospital['municipalityid'] == area_id O
        hospital['localityid'] == area_id
    )
    
    # Asignar estas IPS definitivamente al KAM
    asignaciones[kam['id']] = ips_territorio_base
```

**Proceso 2.2: Construcción Simultánea de la Lista de Exclusión**
```python
# Mientras asignamos territorios base, construimos el filtro
municipios_excluidos = conjunto_vacio()

para cada kam en sellers:
    municipios_excluidos.agregar(kam['areaId'])
```

Al finalizar esta fase, hemos logrado dos objetivos críticos: asignar automáticamente un porcentaje significativo de IPS sin usar la API, y crear un filtro que optimizará todas las operaciones posteriores.

#### Fase 3: Identificación de IPS No Asignadas

El algoritmo ahora identifica qué IPS quedan disponibles para asignación competitiva:

```python
ips_disponibles = []

para cada ips en hospitals:
    # Si la IPS no fue asignada en la fase anterior
    si ips no está en ninguna asignación:
        # Y su municipio no tiene un KAM residente
        si ips['municipalityid'] no está en municipios_excluidos:
            ips_disponibles.agregar(ips)
```

Esta fase produce una lista depurada de IPS que realmente necesitan cálculos de tiempo de viaje.

#### Fase 4: Determinación de Zonas de Búsqueda por KAM

Para cada KAM, el algoritmo determina en qué zonas geográficas puede buscar IPS adicionales:

```python
para cada kam en sellers:
    # Extraer código de departamento (primeros 2 dígitos)
    dept_kam = kam['areaId'][0:2]  # Ejemplo: '08' de '08001'
    
    # Identificar departamentos donde buscar
    departamentos_busqueda = [dept_kam]  # Siempre incluye el propio
    
    # Agregar departamentos fronterizos de Nivel 1
    si dept_kam en adjacency:
        para cada dept_fronterizo en adjacency[dept_kam]['closeDepartments']:
            departamentos_busqueda.agregar(dept_fronterizo)
    
    # Agregar departamentos de Nivel 2 (habilitado para todos)
    si kam['expansionConfig']['enableLevel2']:  # Siempre true
        para cada dept_nivel1 en departamentos_busqueda:
            para cada dept_nivel2 en adjacency[dept_nivel1]['closeDepartments']:
                departamentos_busqueda.agregar(dept_nivel2)
    
    # Filtrar IPS disponibles que estén en estos departamentos
    ips_candidatas[kam['id']] = filtrar(ips_disponibles, donde:
        ips['departmentid'] en departamentos_busqueda
    )
```

#### Fase 5: Cálculo Optimizado de Tiempos de Viaje

Con las listas de candidatos preparadas, el algoritmo ejecuta las consultas mínimas necesarias a la API, respetando las configuraciones individuales de cada KAM:

```python
para cada kam en sellers:
    origen = (kam['lat'], kam['lng'])
    
    # Obtener configuración específica del KAM
    max_tiempo = kam['expansionConfig']['maxTravelTime']
    
    para cada ips en ips_candidatas[kam['id']]:
        destino = (ips['lat'], ips['lng'])
        
        # Consulta a Google Maps Distance Matrix API
        tiempo_viaje = google_maps_api.calcular_tiempo(
            origen=origen,
            destino=destino,
            modo='driving'  # Siempre en automóvil
        )
        
        # Guardar resultado si está dentro del límite individual del KAM
        si tiempo_viaje <= max_tiempo:
            tiempos_calculados[kam['id']][ips['id']] = tiempo_viaje
```

#### Fase 6: Asignación Competitiva Final con Resolución de Prioridades

Con todos los tiempos calculados, el algoritmo realiza la asignación óptima considerando las prioridades individuales de cada KAM:

```python
# Para cada IPS que tiene múltiples KAM candidatos
para cada ips en ips_con_multiples_candidatos:
    candidatos = []
    
    # Recopilar todos los KAM candidatos con sus tiempos
    para cada kam que puede atender esta ips:
        candidatos.agregar({
            'kam_id': kam['id'],
            'tiempo': tiempos_calculados[kam['id']][ips['id']],
            'prioridad': kam['expansionConfig']['priority']
        })
    
    # Ordenar candidatos por tiempo y luego por prioridad
    candidatos.ordenar_por(tiempo ascendente, prioridad descendente)
    
    # Asignar al mejor candidato
    mejor_candidato = candidatos[0]
    asignaciones[mejor_candidato['kam_id']].agregar(ips)
```

Nota: En caso de empate en tiempo de viaje, el KAM con mayor valor de prioridad obtiene la asignación.

#### Fase 7: Asignación por Mayoría en Localidades de Bogotá

Para las localidades de Bogotá donde múltiples KAMs tienen IPS asignadas, se aplica la regla de mayoría:

```python
# Contar IPS por localidad y KAM
para cada localidad en bogota:
    conteo_por_kam = {}
    
    para cada ips en localidad:
        kam_asignado = obtener_kam_de_ips(ips)
        conteo_por_kam[kam_asignado] += 1
    
    # El KAM con más IPS gana toda la localidad
    kam_ganador = max(conteo_por_kam, key=conteo_por_kam.get)
    
    # Reasignar todas las IPS de la localidad al ganador
    para cada ips en localidad:
        asignaciones[kam_ganador].agregar(ips)
```

#### Fase 8: Asignación de Población sin IPS

Finalmente, el algoritmo maneja municipios que tienen población pero carecen de IPS:

```python
municipios_sin_ips = identificar_municipios_sin_ips()

para cada municipio en municipios_sin_ips:
    origen = (municipio['lat'], municipio['lng'])
    mejor_ips = None
    menor_tiempo = infinito
    
    # Buscar la IPS más cercana ya asignada
    para cada ips en todas_ips_asignadas:
        tiempo = google_maps_api.calcular_tiempo(
            origen=origen,
            destino=(ips['lat'], ips['lng']),
            modo='driving'
        )
        
        si tiempo <= MAX_PATIENT_TRANSFER_TIME y tiempo < menor_tiempo:
            menor_tiempo = tiempo
            mejor_ips = ips
    
    # Sumar la población al territorio del KAM que atiende esa IPS
    si mejor_ips:
        kam_asignado = obtener_kam_de_ips(mejor_ips)
        poblacion_adicional[kam_asignado] += municipio['population2025']
```

### Optimizaciones Implementadas en el Algoritmo

El diseño del algoritmo incorpora varias optimizaciones clave que reducen drásticamente el número de consultas a la API:

**1. Exclusión Temprana de Municipios con KAM**
Al crear la lista de exclusión en la Fase 2, el algoritmo evita calcular rutas hacia cualquier municipio que ya tiene un KAM residente. Esto puede eliminar cientos o miles de consultas innecesarias.

**2. Filtrado Geográfico Inteligente**
El uso de la matriz de adyacencia garantiza que solo se calculen rutas entre ubicaciones que tienen sentido geográfico. No tiene sentido calcular el tiempo de viaje de un KAM en Barranquilla hacia una IPS en Nariño si no son departamentos fronterizos.

**3. Cálculo Único por Par KAM-IPS**
El algoritmo mantiene una caché de todos los cálculos realizados, evitando consultas duplicadas si el mismo par KAM-IPS aparece en diferentes contextos.

**4. Procesamiento por Lotes**
Cuando es posible, el algoritmo agrupa múltiples consultas a la API en una sola solicitud, aprovechando las capacidades de procesamiento por lotes de Google Maps Distance Matrix API.

### Variables de Control del Algoritmo

El comportamiento del algoritmo puede ajustarse tanto a nivel global como individual por KAM:

**Configuración Global (valores por defecto)**
```python
# Tiempos máximos globales (en minutos) - usados solo si no hay config individual
DEFAULT_MAX_KAM_TRAVEL_TIME = 240      # 4 horas por defecto
MAX_PATIENT_TRANSFER_TIME = 240        # 4 horas para traslado de pacientes

# Departamentos excluidos del análisis
EXCLUDED_DEPARTMENTS = [27, 97, 99, 88, 95, 94, 91]

# Configuración visual para mapas
EXCLUDED_COLOR = '#4A4A4A'             # Gris oscuro para departamentos excluidos
```

**Configuración Actual por KAM (en sellers.json)**
```python
"expansionConfig": {
    "enableLevel2": true,     # Habilitado para TODOS los KAMs
    "maxTravelTime": 240,     # 4 horas para todos
    "priority": 2             # Prioridad estándar
}
```

La configuración individual permite estrategias diferenciadas como:
- KAM experimentados con territorios más amplios (mayor maxTravelTime)
- KAM nuevos con territorios limitados para facilitar su gestión
- Zonas estratégicas con prioridad alta para ganar en casos de empate
- Control selectivo de expansión según potencial de mercado

## Bogotá en 4 sectores (desde el 2026-10-28)

_Spec: `docs/specs/2026-10-28-bogota-4-sectores.md`. Decisión del dueño:
`docs/decisiones/2026-10-28-bogota-4-sectores.md` ("Si, hazlo. Norte, Occidente, Sur y Oriente")._

- Cada localidad pertenece a un sector, que es el mismo corredor que usan los municipios de afuera
  (`CORREDOR_DE_LOCALIDAD` en `web/lib/bogota-corredores.ts`):
  - **Norte**: Usaquén.
  - **Occidente**: Suba, Engativá, Fontibón, Barrios Unidos, Teusaquillo.
  - **Sur**: Kennedy, Bosa, Ciudad Bolívar, Tunjuelito, Puente Aranda, Los Mártires, Antonio Nariño.
  - **Oriente**: Chapinero, Santa Fe, La Candelaria, San Cristóbal, Rafael Uribe Uribe, Usme, Sumapaz.
- Una IPS de Bogotá va a la celda que recibe el corredor de su localidad (`bogota_config.grupos`), sin minutos ni
  tope. Es la fase 0b del motor (`bogotaSectorCell`), después de las forzadas y antes del territorio base: la
  localidad de Chapinero es del Oriente aunque ahí viva la celda del Norte. Se guarda `assignment_type =
  'bogota_corredor'`, `detail = {"corredor":"norte","localidad":"1100101"}` y el tiempo real de esa celda (o null).
- Sin regla de Bogotá, IPS sin localidad de la tabla o con la celda del sector inactiva: la regla de siempre
  (territorio base, minutos y mayoría por camas).
- Hacia afuera nada cambia: Bogotá compite como una ciudad y el corredor del municipio decide la celda. Así cada
  Zona recibe su sector de la ciudad y lo que sale por su corredor: Usaquén y Chía quedan en la misma Zona.
- Las celdas se llaman **Bogotá Norte** (punto base en Chapinero), **Bogotá Occidente** (Engativá), **Bogotá Sur**
  (Kennedy) y **Bogotá Oriente** (San Cristóbal). El punto base del Norte sigue en Chapinero hasta que el dueño
  autorice recalcular sus tiempos desde Usaquén (Google, cerca de 7,40 USD).
- La asignación de una IPS nueva (`POST /api/hospitals/assign-to-kam`) aplica el mismo paso antes del territorio
  base.
- Mapa: una localidad sin IPS se pinta con la celda de su sector según el último recálculo, por encima de la zona
  residente (`zonaDeLocalidadSinIps`).

## Bogotá hacia afuera: una ciudad, cuatro corredores

_Desde el 2026-10-11. Spec: `docs/specs/2026-10-11-bogota-corredores.md`. Decisión del dueño:
`docs/decisiones/2026-10-11-bogota-corredores.md`._

### Por qué

Hasta el 2026-10-11 cada celda de Bogotá (zona con `area_id` de localidad: Chapinero 1100102, Engativá
1100110, Kennedy 1100108, San Cristóbal 1100104) competía sola por las IPS de fuera de Bogotá, cada una con
su `kams.max_travel_time` (Chapinero 360, las otras 240). Resultado que vio el dueño: Miraflores (Boyacá),
a 5 h 11 de Engativá y 5 h 13 de Chapinero, quedaba en Chapinero "porque alcanza" y Engativá "fuera de
rango". Pedido: que Bogotá (o cualquier ciudad grande partida en celdas) tenga una subconfiguración.

### La regla

1. **Dentro de Bogotá** (hasta el 2026-10-28): por las IPS con `locality_id` 11001xx solo competían celdas de
   Bogotá, territorio base y regla de mayoría por camas en cada localidad. Desde el 2026-10-28 decide el sector de
   la localidad (ver "Bogotá en 4 sectores").
2. **Territorio base y asignaciones forzadas**: sin cambios (las forzadas mandan sobre todo).
3. **IPS fuera de Bogotá** (`department_id` distinto de '11'): si alguna celda es elegible para la IPS
   (`canKamCompeteForHospital`: Cundinamarca, sus limítrofes y nivel 2), las celdas **no compiten por
   separado**. Compite un candidato virtual **"Bogotá"** con:
   - tiempo = el **mejor tiempo real** (`hospital_kam_distances`, SEGUNDOS) entre las celdas elegibles que
     tienen distancia;
   - tope = **`bogota_config.max_travel_minutes`** (240 por defecto; **360 desde el 2026-10-28**, decisión del
     dueño `docs/decisiones/2026-10-28-municipios-por-corredor-de-bogota.md`), el mismo para toda Bogotá. Se ignora el
     `kams.max_travel_time` de cada celda; las demás zonas conservan el suyo;
   - empate exacto con otra zona: gana la de mayor prioridad (la de la celda con el mejor tiempo), como siempre.
4. **Si gana "Bogotá", la celda la decide el corredor de salida del municipio, no los minutos**:
   `bogota_corredores` (primero la fila del municipio de la IPS; si no, la del departamento) da el corredor
   (norte, occidente, sur u oriente) y `bogota_config.grupos[corredor]` da la celda. Si el municipio no tiene
   corredor, o la celda configurada no está activa, va a la celda con menor tiempo (y la simulación lo lista).
5. Se guarda `assignment_type = 'bogota_corredor'`, `travel_time` = tiempo real de la celda elegida (si no
   tiene distancia, el mínimo de Bogotá) y `assignments.detail` =
   `{"corredor":"norte","bogota_min_segundos":9581,"celda_min":"<kam_id>"}`.
6. Si `bogota_config` o `bogota_corredores` no existen o están vacías, el motor se comporta como antes
   (cada celda sola con su tope). Código: `competeForHospital`, `bogotaVirtualCandidate` y
   `chooseBogotaCell` en `web/lib/opmap-algorithm-simplified.ts`; reglas puras de corredores en
   `web/lib/bogota-corredores.ts`.
7. La misma función (`competeForHospital` + `loadBogotaRule`) la usa la asignación individual de una IPS
   sin zona (`POST /api/hospitals/assign-to-kam`), para que no se aparte del recálculo completo.
8. **Municipios sin IPS** (desde el 2026-10-28; spec `docs/specs/2026-10-28-municipios-regla-bogota.md`): el
   motor de municipios (`decideByTravelTime` en `web/lib/municipality-coverage.ts`) aplica la misma regla con
   los tiempos de `municipality_travel_times`: "Bogotá" compite con el mejor tiempo de sus celdas y el tope
   único, y si gana, la celda la da el corredor (`chooseBogotaCell`); `travel_minutes` es el tiempo de esa
   celda. Fuera de alcance, la "más cercana" es la celda del corredor. Hasta esa fecha cada celda competía
   sola con su tope y Puerto Gaitán (Meta, oriente) quedaba en Chapinero por su tope de 360.

### k: en cuántas celdas se reparte el cupo de Bogotá

| k | Grupos de corredores (una celda por grupo) | Celdas por defecto |
| --- | --- | --- |
| 4 | Norte · Occidente · Sur · Oriente | Chapinero · Engativá · Kennedy · San Cristóbal |
| 3 | Norte · Occidente · Sur + Oriente | Chapinero · Engativá · Kennedy |
| 2 | Norte + Oriente · Occidente + Sur | Chapinero · Engativá |
| 1 | Los cuatro corredores | Chapinero (o la que se elija) |

Los grupos son fijos (`AGRUPACIONES_POR_K`); el administrador elige qué celda recibe cada grupo y cada grupo
va a una celda distinta. `bogota_config.grupos` guarda siempre los cuatro corredores (con k = 2, Norte y
Oriente apuntan a la misma celda). Desde los sectores (2026-10-28), una celda que no recibe ningún corredor no recibe
tampoco ningún sector: solo sus forzadas.

### Corredores sembrados (`bogota_corredores`, 145 filas: 29 departamentos + 116 municipios)

Por departamento:

- **Norte**: 15 Boyacá, 68 Santander, 54 Norte de Santander, 20 Cesar, 44 La Guajira, 47 Magdalena,
  08 Atlántico, 13 Bolívar, 70 Sucre, 23 Córdoba.
- **Occidente**: 73 Tolima, 17 Caldas, 66 Risaralda, 63 Quindío, 05 Antioquia, 76 Valle del Cauca, 19 Cauca,
  52 Nariño.
- **Sur**: 41 Huila, 18 Caquetá, 86 Putumayo.
- **Oriente**: 50 Meta, 85 Casanare (el dueño puede pasarlo a Norte; Yopal hoy es asignación forzada),
  81 Arauca, 95 Guaviare, 99 Vichada, 97 Vaupés, 94 Guainía, 91 Amazonas (los cinco últimos están excluidos
  del análisis; la fila queda por si se incluyen).
- Sin fila: 11 Bogotá (dentro manda la mayoría por localidad), 27 Chocó y 88 San Andrés (excluidos y fuera
  del alcance de las celdas).

Cundinamarca (25) por municipio, según su provincia:

- **Norte (31)**: Sabana Centro (Cajicá, Chía, Cogua, Cota, Gachancipá, Nemocón, Sopó, Tabio, Tenjo,
  Tocancipá, Zipaquirá); Ubaté (Carmen de Carupa, Cucunubá, Fúquene, Guachetá, Lenguazaque, Simijaca, Susa,
  Sutatausa, Tausa, Ubaté); Almeidas (Chocontá, Machetá, Manta, Sesquilé, Suesca, Tibirita, Villapinzón);
  Guavio norte (Guasca, Guatavita) y **La Calera**.
- **Occidente (38)**: Sabana Occidente (Bojacá, El Rosal, Facatativá, Funza, Madrid, Mosquera, Subachoque,
  Zipacón); Gualivá (Albán, La Peña, La Vega, Nimaima, Nocaima, Quebradanegra, San Francisco, Sasaima,
  Supatá, Útica, Vergara, Villeta); Rionegro (El Peñón, La Palma, Pacho, Paime, San Cayetano, Topaipí,
  Villagómez, Yacopí); Magdalena Centro (Beltrán, Bituima, Chaguaní, Guayabal de Síquima, Pulí, San Juan de
  Rioseco, Vianí); Bajo Magdalena (Caparrapí, Guaduas, Puerto Salgar).
- **Sur (30)**: Soacha (Sibaté, Soacha); Sumapaz (Arbeláez, Cabrera, Fusagasugá, Granada, Pandi, Pasca,
  San Bernardo, Silvania, Tibacuy, Venecia); Alto Magdalena (Agua de Dios, Girardot, Guataquí, Jerusalén,
  Nariño, Nilo, Ricaurte, Tocaima); Tequendama (Anapoima, Anolaima, Apulo, Cachipay, El Colegio, La Mesa,
  Quipile, San Antonio del Tequendama, Tena, Viotá).
- **Oriente (17)**: Oriente (Cáqueza, Chipaque, Choachí, Fómeque, Fosca, Guayabetal, Gutiérrez, Quetame,
  Ubaque, Une); Medina (Medina, Paratebueno); Guavio sur (Gachalá, Gachetá, Gama, Junín, Ubalá).

**La Calera → Norte** por criterio documentado: aunque es de la provincia del Guavio, se sale por la vía a
La Calera desde Chapinero (la celda del corredor Norte) y es la puerta de Guasca y Guatavita, que también
son Norte. Cada fila lleva su provincia en `bogota_corredores.nota`. Las excepciones por municipio se editan
hoy con SQL (no hay pantalla); la fila del municipio gana sobre la del departamento.

### Dónde se configura y cómo se simula

- `/kams` → tarjeta **"Bogotá: sectores y corredores"** (solo admin, permiso `kams:bogota-config`):
  k (1–4), celda de cada grupo de corredores y tope único (60–600 min).
- **Simular** → `GET /api/kams/bogota-config/simulate?k&max&norte&occidente&sur&oriente` (permiso
  `recalculate:complete`): corre el algoritmo completo **en memoria** con la configuración propuesta (sin
  guardar, sin Google) y la compara con las asignaciones guardadas: por celda antes/después, IPS que
  cambian, IPS que quedan fuera de alcance, IPS sin corredor y asignaciones forzadas a celdas de Bogotá
  frente a lo que daría su corredor. Por consola: `cd web && npm run bogota:simulate`.
- **Guardar** → `PUT /api/kams/bogota-config` (valida k, tope y que cada corredor apunte a una celda activa
  de Bogotá con la agrupación de k). **No recalcula**: los cambios aplican al próximo "Recalcular
  asignaciones" de Configuración → Asignación (`/configuracion?seccion=asignacion`; antes en la página principal).
- `kams.max_travel_time` de las celdas no se toca: hacia afuera deja de usarse y lo decide el dueño.

### Ficha de la IPS

- "Ejecutivo Comercial Asignado": con `bogota_corredor` muestra **"Asignación: Bogotá (corredor Norte) →
  Chapinero"** y el tiempo real por carretera de esa celda.
- "Distancias desde cada zona" (IPS fuera de Bogotá y con configuración): fila agregada **"Bogotá"** con el
  mejor tiempo entre sus celdas y el tope único; las celdas aparecen debajo como "Zona de Bogotá" con el
  estado "Por corredor" (o "Asignado") y se comparan con el tope único, no con su 360/240. Si la asignación
  guardada es anterior a la regla, un aviso lo dice.

### Simulación del 2026-10-11 (k = 4, tope 240; solo lectura, nada recalculado)

- Celdas (asignaciones guardadas → con la regla): Chapinero 42 → 62, Engativá 85 → 59, Kennedy 24 → 24,
  San Cristóbal 31 → 32. Asignadas en total: 766 → 762.
- Cupo de Bogotá afuera: 43 IPS (Norte 26, Occidente 8, Sur 7, Oriente 2); ninguna sin corredor.
- 28 IPS cambian (27 entre celdas, sobre todo Boyacá y Sabana Centro de Engativá a Chapinero por el
  corredor Norte; 1 sale de Bogotá: Hospital Regional de Vélez, Santander, de Chapinero a 4 h 33 a
  Bucaramanga a 5 h 32, que tiene tope 360) y **4 quedan fuera de alcance**: Miraflores, Soatá y dos de
  Sogamoso (Boyacá), hoy en Chapinero gracias a su tope de 360 (mejor tiempo de Bogotá entre 4 h 23 y
  5 h 43).
- Forzadas (se conservan): Villavicencio 50001 (14 IPS) y Granada 50313 (1 IPS) → San Cristóbal coinciden
  con el corredor Oriente; Yopal 85001 (7 IPS) → Kennedy **no** coincide (Casanare → Oriente → San
  Cristóbal) hasta que el dueño decida.
- *2026-10-28*: el dueño quitó las tres forzadas ("quiero revisar el propio sistema que propone"; migración 0901). Antes
  se refrescaron con Google los tiempos de las 4 celdas a las 22 IPS de Meta y Casanare, que eran del 2025-08-07 con la
  vía al Llano cerrada (`scripts/tiempos-bogota-refrescar.ts`, 88 elementos, 0,44 USD): Villavicencio pasó de ~7 h 27
  a ~2 h 40 y Granada de ~9 h a ~4 h, y las dos quedan en San Cristóbal por el corredor Oriente sin forzarlas. Yopal
  queda a ~6 h 30 (más que el tope de 360): sus 7 IPS quedan sin zona.
- Con k = 2 (Norte + Oriente → Chapinero, Occidente + Sur → Engativá): Chapinero 64, Engativá 66, Kennedy 17,
  San Cristóbal 30; 35 IPS cambian y las mismas 4 quedan fuera de alcance.

## DEPARTAMENTOS EXCLUIDOS

Los siguientes departamentos están excluidos del análisis. El gris oscuro (#4A4A4A) solo lo usa el
visualizador Python; en la web sus municipios se pintan según `municipality_zone` (fuera de alcance,
sin acceso terrestre o pendiente) y sus IPS como puntos grises de "IPS sin zona":
- 27: Chocó
- 97: Vaupés 
- 99: Vichada
- 88: San Andrés y Providencia
- 95: Guaviare
- 94: Guainía
- 91: Amazonas

Estos departamentos no tienen IPS asignables o están demasiado remotos (más de 4 horas de viaje).
