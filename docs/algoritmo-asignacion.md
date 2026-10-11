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
- Las localidades compartidas se asignan por mayoría de IPS ganadas
- Esto evita que KAMs externos "invadan" la capital

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
