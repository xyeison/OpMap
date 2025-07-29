# OpMap - Sistema de Asignación Territorial Optimizada

## ESTADO ACTUAL DEL PROYECTO

### Aplicación Web (Next.js/TypeScript) - EN PRODUCCIÓN

La aplicación web está desplegada en Vercel y permite visualizar las asignaciones en tiempo real:

1. **Arquitectura**:
   - Frontend: Next.js 14 con TypeScript
   - Base de datos: Supabase (PostgreSQL)
   - Mapas: Leaflet con react-leaflet
   - Estado: React Query para caché y sincronización
   - Despliegue: Vercel

2. **Funcionalidades principales**:
   - Visualización de territorios asignados por KAM con colores distintivos
   - Marcadores de hospitales coloreados según KAM asignado
   - Hospitales sin asignar (zonas vacantes) con tiempos de viaje reales a cada KAM
   - Tooltips detallados con información de hospitales, contratos y territorios
   - API para recálculo de asignaciones (`/api/recalculate-assignments`)
   - Vista de hospitales sin asignar con tiempos reales de Google Maps desde Supabase

3. **Integración con Supabase**:
   - Tabla `travel_time_cache`: 10,330+ rutas calculadas con Google Maps
   - Tabla `assignments`: Asignaciones actuales KAM-Hospital
   - Tabla `hospitals`: Base de datos de IPS activas
   - Tabla `kams`: Configuración de vendedores
   - Precisión de coordenadas: 6 decimales para matching exacto

### Scripts Python (Procesamiento Backend)

1. **`opmap_bogota_complete.py`** - Sistema completo con algoritmo y visualización
   - Algoritmo de asignación con lógica especial para Bogotá
   - Visualización de mapas con regla de mayoría corregida
   - Soporte para tiempos reales de Google Maps

2. **`opmap_google_matrix.py`** - Versión con Google Distance Matrix API
   - Calcula y cachea tiempos reales de viaje
   - Utiliza el mismo algoritmo de asignación

3. **`resume_google_calculations.py`** - Script para usar caché existente
   - Ejecuta el algoritmo sin hacer nuevas consultas a Google Maps
   - Genera mapas con los tiempos ya calculados

4. **`calculate_routes_batch.py`** - Calculador masivo de rutas
   - Procesa rutas por departamento para evitar timeouts
   - Integración directa con Supabase
   - Muestra progreso y estimación de costos en tiempo real

### Algoritmo Implementado

1. **Clase `BogotaOpMapAlgorithm`**: Extiende la lógica base con reglas especiales para Bogotá
   - Solo KAMs de Bogotá compiten por localidades dentro de Bogotá
   - Asignación por mayoría en localidades compartidas
   - KAMs de Bogotá pueden competir en Cundinamarca y departamentos vecinos

2. **Expansión de Nivel 2**: 
   - Todos los KAMs tienen `enableLevel2: true` en `sellers.json`
   - Permite buscar en departamentos limítrofes de limítrofes
   - Resuelve casos como Plato (Magdalena) que ahora se asigna correctamente a Sincelejo

3. **Visualización con `CleanMapVisualizer`**:
   - Solo muestra territorios con IPS asignadas
   - Departamentos excluidos en gris oscuro (#4A4A4A)
   - Marcadores de KAM con icono de usuario del color del territorio
   - Tooltips en IPS con información de camas, municipio y KAM asignado
   - **Regla de mayoría corregida**: Los territorios se colorean según el KAM con más IPS
   - Colores distintivos para cada KAM (evita confusiones)
   - Leyenda mejorada con convenciones profesionales

### Ejecución

```bash
# Para uso en desarrollo/testing local
python3 opmap_bogota_complete.py        # Con distancia Haversine (rápido, sin costo)
python3 opmap_google_matrix.py          # Con tiempos reales de Google Maps (requiere API key)
python3 resume_google_calculations.py   # Usando caché existente de Google Maps

# PRODUCCIÓN: Usando Supabase como backend
python3 opmap_supabase.py              # Lee de Supabase, calcula faltantes con Google
python3 resume_supabase_calculations.py # Solo lee de Supabase (no hace llamadas API)
python3 calculate_routes_batch.py       # Calcula rutas masivamente por departamento

# Aplicación Web (Next.js)
cd web
npm install
npm run dev                             # Desarrollo local
vercel                                  # Desplegar a producción
```

## VISUALIZACIÓN DEL MAPA - IMPORTANTE

### Estética del Mapa (MANTENER SIEMPRE)
**NUNCA cambiar estos elementos visuales**:
- Territorios coloreados por KAM asignado
- Puntos de IPS con colores correspondientes al KAM
- Marcadores de KAMs con icono de perfil del color del territorio
- Departamentos excluidos en gris oscuro (#4A4A4A)
- **NO agregar marcadores de población (👥)**
- **NO cambiar el estilo visual base**
- **NO agregar capas o elementos visuales nuevos sin autorización explícita**

### Lógica de Coloreado de Territorios Compartidos
Para cualquier territorio (municipio o localidad) donde múltiples KAMs tienen IPS:

1. **Cada IPS se asigna individualmente** al KAM más cercano por tiempo de viaje
2. **El territorio se colorea** según el KAM que "ganó" más IPS individuales (regla de mayoría)
3. **NO es por cantidad total**: No importa cuántas IPS tenga un KAM en total
4. **ES por competencia directa**: Cuántas IPS de ESE territorio específico están más cerca de cada KAM

**Ejemplos correctos**:
- Localidad Teusaquillo tiene 15 IPS totales
  - KAM Chapinero es el más cercano a 14 de esas IPS → 14 puntos
  - KAM San Cristóbal es el más cercano a 1 de esas IPS → 1 punto
  - Teusaquillo se colorea con el color de Chapinero porque ganó 14 vs 1

- Municipio Ibagué tiene 15 IPS totales
  - KAM Pereira es el más cercano a 14 de esas IPS → 14 puntos
  - KAM Neiva es el más cercano a 1 de esas IPS → 1 punto
  - Ibagué se colorea con el color de Pereira porque ganó 14 vs 1

- Municipio Soacha tiene 4 IPS totales
  - KAM Kennedy es el más cercano a las 4 IPS → 4 puntos
  - Soacha se colorea con el color de Kennedy (cian)

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

Los siguientes departamentos están excluidos del análisis y se muestran en gris oscuro en el mapa:
- 27: Chocó
- 97: Vaupés 
- 99: Vichada
- 88: San Andrés y Providencia
- 95: Guaviare
- 94: Guainía
- 91: Amazonas

Estos departamentos no tienen IPS asignables o están demasiado remotos (más de 4 horas de viaje).

## RESULTADOS ACTUALES CON GOOGLE MAPS

### Estadísticas del Caché (Actualizado)
- **Rutas calculadas**: 10,330+ tiempos de viaje reales en Supabase
- **Tiempo mínimo**: 4.2 minutos
- **Tiempo máximo**: 789.5 minutos (13.1 horas)
- **Tiempo promedio**: 290.1 minutos (4.8 horas)
- **Costo estimado**: ~$50.00 USD en consultas a Google Maps
- **Cobertura**: 22 departamentos procesados sistemáticamente

### Asignaciones Finales (con tiempos reales)
- **Total IPS asignadas**: 728 de 768 (94.8%)
- **IPS no asignadas**: 40 (muy remotas o sin ruta por carretera)

### Distribución por KAM
1. KAM Engativá: 96 IPS
2. KAM Barranquilla: 89 IPS
3. KAM Cali: 84 IPS
4. KAM Medellín: 76 IPS
5. KAM Pereira: 65 IPS
6. KAM Chapinero: 42 IPS
7. KAM Bucaramanga: 42 IPS
8. KAM Valledupar: 36 IPS
9. KAM Cartagena: 33 IPS
10. KAM Montería: 33 IPS
11. KAM Sincelejo: 29 IPS
12. KAM San Cristóbal: 24 IPS
13. KAM Pasto: 20 IPS
14. KAM Kennedy: 20 IPS
15. KAM Cúcuta: 20 IPS
16. KAM Neiva: 19 IPS

### Mejoras Logradas con Tiempos Reales
- **Soacha**: Correctamente asignada a Kennedy (24.3 min) en lugar de Chapinero (49.6 min)
- **Ibagué**: Correctamente coloreada como territorio de Pereira (93.3% de IPS)
- **Plato**: Asignado a Sincelejo gracias a expansión nivel 2
- **Villavicencio**: Asignado a San Cristóbal (Bogotá)
- Territorios más coherentes basados en tiempos reales de conducción

## ARCHIVOS CLAVE DEL PROYECTO

### Código Principal

#### Aplicación Web (web/)
- **`web/app/`**: Aplicación Next.js con App Router
- **`web/lib/opmap-algorithm-bogota-fixed.ts`**: Algoritmo OpMap portado a TypeScript
- **`web/components/MapComponent.tsx`**: Componente principal del mapa interactivo
- **`web/app/api/recalculate-assignments/`**: API para recálculo de asignaciones
- **`web/app/api/travel-times/unassigned/`**: API para hospitales sin asignar

#### Scripts Python
- **`opmap_bogota_complete.py`**: Sistema completo con algoritmo y visualización mejorada
- **`opmap_google_matrix.py`**: Versión que calcula tiempos reales con Google Maps
- **`resume_google_calculations.py`**: Script para usar caché existente sin nuevas consultas
- **`calculate_routes_batch.py`**: Calculador masivo de rutas por departamento
- **`opmap_supabase.py`**: Versión que usa Supabase como backend (recomendado)
- **`resume_supabase_calculations.py`**: Lee solo de Supabase sin hacer nuevas llamadas API
- **`migrate_cache_to_supabase.py`**: Migra caché JSON existente a Supabase

### Datos de Entrada
- **`data/json/sellers.json`**: Configuración de los 16 KAMs con expansión nivel 2 habilitada
- **`data/json/excluded_departments.json`**: Lista de departamentos excluidos [27, 97, 99, 88, 95, 94, 91]
- **`data/psv/hospitals.psv`**: Base de datos de 768 IPS (excluyendo departamentos remotos)
- **`data/json/adjacency_matrix.json`**: Matriz de departamentos limítrofes

### Caché y Resultados
- **Supabase `travel_time_cache`**: 10,330+ tiempos de viaje calculados (producción)
- **`data/cache/google_distance_matrix_cache.json`**: Caché local (desarrollo)
- **`output/`**: Carpeta con resultados JSON y mapas HTML generados
- **`.env`**: Variables de entorno:
  - `GOOGLE_MAPS_API_KEY`: API key de Google Maps
  - `SUPABASE_URL`: URL de la instancia de Supabase
  - `SUPABASE_KEY`: API key de Supabase

## COLORES DE KAMS

El sistema usa colores distintivos para cada KAM:
- barranquilla: #FF6B6B (Rojo coral)
- bucaramanga: #4ECDC4 (Turquesa)
- cali: #45B7D1 (Azul cielo)
- cartagena: #96CEB4 (Verde menta)
- cucuta: #FECA57 (Amarillo dorado)
- medellin: #FF9FF3 (Rosa)
- monteria: #54A0FF (Azul brillante)
- neiva: #8B4513 (Marrón)
- pasto: #1DD1A1 (Verde esmeralda)
- pereira: #FF7675 (Rojo claro)
- sincelejo: #A29BFE (Lavanda)
- chapinero: #FD79A8 (Rosa chicle)
- engativa: #FDCB6E (Amarillo)
- sancristobal: #6C5CE7 (Púrpura)
- kennedy: #00D2D3 (Cian)
- valledupar: #2ECC71 (Verde)

## ESTRUCTURA DE BASE DE DATOS (SUPABASE)

### Tablas Principales

#### 1. `hospitals`
Tabla central que contiene todas las instituciones prestadoras de salud (IPS).
```sql
- id: uuid (PK)
- code: varchar (código único de la IPS)
- name: varchar (nombre oficial)
- department_id: varchar (código del departamento)
- municipality_id: varchar (código del municipio) 
- locality_id: varchar (código de localidad, solo para Bogotá)
- lat, lng: numeric (coordenadas geográficas)
- beds: integer (número de camas)
- address: text
- phone: varchar
- email: varchar
- active: boolean (estado activo/inactivo)
- service_level: integer (nivel de servicio)
- services: text (servicios que ofrece)
- surgeries: integer (cirugías realizadas)
- ambulances: integer (número de ambulancias)
- municipality_name: varchar
- department_name: varchar
- locality_name: varchar
- created_at, updated_at: timestamp
```

#### 2. `kams`
Key Account Managers (vendedores) del sistema.
```sql
- id: uuid (PK)
- name: varchar (nombre del KAM)
- area_id: varchar (código del municipio/localidad base)
- lat, lng: numeric (ubicación del KAM)
- enable_level2: boolean (expansión a nivel 2)
- max_travel_time: integer (tiempo máximo de viaje en minutos)
- priority: integer (prioridad en caso de empate)
- color: varchar (color para visualización)
- active: boolean
- created_at, updated_at: timestamp
```

#### 3. `assignments`
Asignaciones de hospitales a KAMs.
```sql
- id: uuid (PK)
- kam_id: uuid (FK → kams)
- hospital_id: uuid (FK → hospitals)
- travel_time: integer (tiempo de viaje en minutos)
- assignment_type: varchar (tipo de asignación)
- assigned_at: timestamp
- is_base_territory: boolean (si es territorio base del KAM)
```

#### 4. `travel_time_cache`
Caché de tiempos de viaje calculados.
```sql
- id: uuid (PK)
- origin_lat, origin_lng: numeric (coordenadas origen)
- dest_lat, dest_lng: numeric (coordenadas destino)
- travel_time: integer (tiempo en minutos)
- distance: numeric (distancia en km, opcional)
- source: varchar (fuente del cálculo)
- calculated_at: timestamp
```

#### 5. `hospital_contracts`
Contratos asociados a hospitales.
```sql
- id: uuid (PK)
- hospital_id: uuid (FK → hospitals)
- contract_value: numeric (valor anual)
- start_date: date
- end_date: date
- duration_months: integer
- current_provider: text (proveedor actual)
- contract_number: varchar
- contract_type: varchar
- description: text
- active: boolean
- created_by: uuid (FK → users)
- created_at, updated_at: timestamp
```

#### 6. `hospital_history`
Historial de cambios en hospitales.
```sql
- id: uuid (PK)
- hospital_id: uuid (FK → hospitals)
- user_id: uuid (FK → users)
- action: text (acción realizada)
- reason: text (razón del cambio)
- previous_state: boolean
- new_state: boolean
- changes: jsonb (cambios detallados)
- created_at: timestamp
- created_by: uuid
```

#### 7. `users`
Usuarios del sistema.
```sql
- id: uuid (PK)
- email: text (único)
- password: text (hash)
- full_name: text
- role: text ('admin', 'sales', 'viewer')
- active: boolean
- created_at: timestamp
```

#### 8. `departments`
Departamentos de Colombia.
```sql
- code: varchar (PK) (código DANE)
- name: varchar
- excluded: boolean (si está excluido del análisis)
```

#### 9. `municipalities`
Municipios de Colombia.
```sql
- code: varchar (PK) (código DANE)
- name: varchar
- department_code: varchar (FK → departments)
- lat, lng: numeric
- population_2025: integer
```

#### 10. `department_adjacency`
Matriz de adyacencia entre departamentos.
```sql
- department_code: varchar (FK → departments)
- adjacent_department_code: varchar (FK → departments)
```

#### 11. `opportunities`
Oportunidades comerciales (obsoleta, reemplazada por hospital_contracts).
```sql
- id: uuid (PK)
- hospital_id: uuid (FK → hospitals)
- annual_contract_value: numeric
- current_provider: varchar
- notes: text
- contract_end_date: date
- created_by: uuid
- created_at, updated_at: timestamp
```

### Vistas

#### 1. `kam_statistics`
Vista que calcula estadísticas por KAM.
```sql
- id: uuid (KAM ID)
- name: varchar
- total_hospitals: bigint
- total_municipalities: bigint
- total_opportunity_value: numeric
- avg_travel_time: numeric
```

#### 2. `territory_assignments`
Vista que muestra asignaciones por territorio.
```sql
- municipality_id: varchar
- locality_id: varchar
- department_id: varchar
- kam_id: uuid
- kam_name: varchar
- kam_color: varchar
- hospital_count: bigint
```

### Tablas del Sistema (PostGIS)

- `spatial_ref_sys`: Sistemas de referencia espacial
- `geography_columns`: Columnas geográficas
- `geometry_columns`: Columnas geométricas

### Índices y Restricciones Importantes

1. **Unicidad**:
   - `hospitals.code` debe ser único
   - `users.email` debe ser único
   - `(origin_lat, origin_lng, dest_lat, dest_lng)` en `travel_time_cache`

2. **Claves Foráneas**:
   - Todas las referencias a `users`, `hospitals`, `kams` están protegidas
   - Cascada de eliminación configurada donde corresponde

3. **Índices de Rendimiento**:
   - Índices en coordenadas para búsquedas geoespaciales
   - Índices en claves foráneas para joins eficientes
   - Índices en campos de búsqueda frecuente (active, department_id, etc.)

### Políticas RLS (Row Level Security)

Las tablas tienen políticas RLS habilitadas para controlar el acceso:
- `admin`: Acceso completo a todas las tablas
- `sales`: Acceso de lectura/escritura limitado a sus territorios
- `viewer`: Solo lectura en tablas permitidas

## ESTRUCTURA DE ARCHIVOS DEL PROYECTO

### Código Principal
```
/
├── opmap_bogota_complete.py      # Sistema completo con algoritmo y visualización
├── opmap_google_matrix.py        # Versión con Google Distance Matrix API
├── resume_google_calculations.py # Script para usar caché existente
├── opmap_supabase.py            # Versión con Supabase (recomendado)
├── resume_supabase_calculations.py # Solo lectura desde Supabase
├── migrate_cache_to_supabase.py # Migración de caché JSON a Supabase
├── clean_google_cache.py         # Limpieza de cálculos Haversine del caché
├── SUPABASE_SETUP.md            # Guía de configuración de Supabase
└── .env                          # Variables de entorno
```

### Base de Datos
```
database/
├── README.md                     # Guía de uso de scripts SQL
├── 01_setup/                     # Scripts iniciales de configuración
│   ├── schema.sql               # Estructura principal
│   ├── create_rls_policies.sql  # Políticas RLS
│   ├── create-simple-auth-tables-safe.sql
│   ├── create-users-contracts-tables.sql
│   ├── create-hospital-history.sql
│   ├── create-storage-bucket.sql
│   └── storage-policies.sql
│
├── 02_migration/                 # Scripts de migración de datos
│   ├── fix_departments.sql
│   ├── migration_complete_no_departments.sql
│   ├── add_hospital_fields.sql
│   ├── add-contract-fields.sql
│   ├── travel_time_cache.sql
│   ├── assignments_from_json.sql
│   └── seed.sql
│
├── 03_maintenance/               # Scripts de mantenimiento
│   ├── update_all_assignments_final.sql
│   ├── update_assignment_travel_times.sql
│   ├── update_travel_times_from_cache.sql
│   ├── clean_haversine_from_cache.sql
│   ├── fix_excessive_assignments_now.sql
│   └── [otros scripts de actualización]
│
├── 04_utilities/                 # Scripts de utilidad
│   ├── show_all_tables_structure.sql
│   ├── show_tables_simple.sql
│   ├── check_data_status.sql
│   ├── verify_territory_base_rule.sql
│   ├── check-users.sql
│   └── verify-hospital-setup.sql
│
└── archive/                      # Scripts obsoletos (NO USAR)
    ├── debug/
    ├── old_versions/
    └── temporary_fixes/
```

### Datos
```
data/
├── cache/
│   └── google_distance_matrix_cache.json  # 3,399 tiempos calculados
├── json/
│   ├── sellers.json              # Configuración de KAMs
│   ├── adjacency_matrix.json     # Matriz de departamentos limítrofes
│   └── excluded_departments.json # Departamentos excluidos
├── psv/
│   └── hospitals.psv             # Base de datos de 768 IPS
└── geojson/                      # Archivos GeoJSON de territorios
    ├── departments/
    └── municipalities/
```

### Salida
```
output/
├── [archivos recientes].json     # Resultados de asignaciones
├── [archivos recientes].html     # Mapas generados
└── archive_2024/                 # Archivos antiguos archivados
```

### Código Fuente
```
src/
├── algorithms/
│   ├── opmap_algorithm.py
│   └── opmap_algorithm_bogota.py
├── visualizers/
│   └── clean_map_visualizer.py
└── utils/
    ├── distance_calculator.py
    └── google_maps_client.py
```