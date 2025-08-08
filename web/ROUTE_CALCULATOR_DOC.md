# 🗺️ Calculador de Rutas con Google Distance Matrix

## 📋 Resumen de Implementación

Se ha implementado un sistema completo para detectar y calcular rutas faltantes entre hospitales y KAMs usando Google Distance Matrix API.

## 🔑 Características Principales

### 1. **Acceso Restringido**
- Solo visible para usuarios con rol **admin**
- Ubicado en el Dashboard principal bajo "Administración del Sistema"
- Validación de permisos en frontend y backend

### 2. **Doble Validación**
- **Primera confirmación**: Muestra resumen de operación
  - Número de rutas a calcular
  - Hospitales afectados
  - Costo estimado
  - Tiempo estimado
  
- **Segunda confirmación**: Advertencia final
  - Confirmación explícita del costo
  - Advertencia sobre consumo de créditos API

### 3. **Información Detallada por Hospital**
Antes de ejecutar, muestra para cada hospital:
- Nombre y ubicación completa
- Coordenadas exactas (lat, lng)
- KAMs competidores que necesitan ruta
- Zonas de búsqueda para cada KAM

### 4. **Lógica de Detección Inteligente**

#### Para Hospitales en Bogotá:
1. Primero todos los KAMs de Bogotá
2. Luego KAMs de Cundinamarca
3. Finalmente KAMs de departamentos vecinos

#### Para Hospitales fuera de Bogotá:
1. KAMs del mismo departamento
2. KAMs de departamentos vecinos (Nivel 1)
3. KAMs de departamentos vecinos de vecinos (Nivel 2)

## 📁 Archivos Creados

### Frontend
- `/web/components/RouteCalculator.tsx` - Componente principal con UI

### Backend
- `/web/app/api/routes/analyze-missing/route.ts` - Detecta rutas faltantes
- `/web/app/api/routes/calculate-batch/route.ts` - Calcula rutas con Google Maps

### Integración
- `/web/app/page.tsx` - Modificado para incluir el componente en Dashboard

## 🎯 Hospitales de Prueba

El sistema está configurado para analizar estos 18 hospitales específicos:

```
0a014185-801f-40f0-9cee-8cd7706068df
18bb319b-00f7-4e4b-99a8-edacecbb8b41
1f720e20-d731-437e-897b-134de313519b
38b7b8b8-bb6d-45e5-963a-328d710c61dc
3aa8f43e-a3ed-467f-8d22-e2f721f6e598
4be1cf19-30ad-4592-bd96-ad7ec6193988
6e7ea424-3994-48a7-82b8-db873e5847e9
6faa1bb8-017c-4c8b-a422-ffe09c0109bf
73c43c4d-328b-4714-a028-b333cc957f8c
8018788c-6a13-4710-97aa-fb03e9a7c0a4
998c9305-61cb-4a43-b642-01dab3d7b42d
9ecb17a9-944b-40f0-8e83-971ca215a5a7
ad06741c-6bc2-46aa-9863-dc65e3022763
b0e473d6-93d7-458e-a2ea-74bb4058a84b
d1eb637b-2414-43c5-a796-d80e3da4f77e
d749b48d-0c77-4182-8a9e-c78afbe0237a
ea4675de-180f-4fc1-b8e3-ee2dcfa1ba55
fb53e3f3-73b7-4066-b46e-1661d02b6c65
```

## 🚀 Cómo Usar

### 1. Acceder al Dashboard
- Iniciar sesión como administrador
- Ir al Dashboard principal

### 2. Buscar el Calculador de Rutas
- Desplazarse hasta "Administración del Sistema"
- El componente "Calculador de Rutas con Google Maps" estará visible

### 3. Analizar Rutas Faltantes
- Click en "🔍 Analizar Rutas Faltantes"
- El sistema analizará los 18 hospitales de prueba
- Mostrará todas las rutas que faltan por calcular

### 4. Revisar y Seleccionar
- Revisar la lista de hospitales y rutas faltantes
- Por defecto todas las rutas están seleccionadas
- Desmarcar las que no desee calcular

### 5. Confirmar Cálculo
- Click en "🚀 Calcular X Rutas"
- **Primera confirmación**: Revisar resumen
- **Segunda confirmación**: Confirmar costo final
- Click en "✅ Sí, calcular rutas"

### 6. Esperar Resultados
- El sistema mostrará progreso en tiempo real
- Al finalizar, mostrará:
  - Rutas calculadas exitosamente
  - Rutas guardadas en base de datos
  - Errores (si hubiera)
  - Tiempo total de ejecución

## 💾 Base de Datos

Las rutas calculadas se guardan en la tabla `hospital_kam_distances`:
- `hospital_id`: ID del hospital
- `kam_id`: ID del KAM
- `distance_km`: Distancia en kilómetros
- `travel_time_seconds`: Tiempo de viaje en segundos
- `source`: 'google_maps'
- `calculated_at`: Fecha y hora del cálculo

## ⚙️ Configuración

### Variables de Entorno Requeridas
```env
GOOGLE_MAPS_API_KEY=tu_api_key_aquí
```

### Límites y Rate Limiting
- Procesamiento en lotes de 10 rutas
- Delay de 1 segundo entre lotes
- Timeout máximo de 5 minutos por request
- Costo aproximado: $0.005 USD por ruta

## 🔒 Seguridad

- Validación de rol admin en frontend y backend
- Autenticación con token Bearer
- Doble confirmación antes de ejecutar
- Logs detallados de todas las operaciones

## 📊 Métricas

El sistema proporciona:
- Contador de rutas faltantes
- Hospitales afectados
- Costo estimado antes de ejecutar
- Tiempo estimado de procesamiento
- Resultados detallados post-ejecución

## ⚠️ Consideraciones

1. **Costo**: Cada consulta a Google Maps cuesta ~$0.005 USD
2. **Tiempo**: El cálculo puede tomar varios minutos para muchas rutas
3. **Límites API**: Google Maps tiene límites de rate que se respetan
4. **Conectividad**: Requiere conexión estable durante todo el proceso

## 🐛 Troubleshooting

### Error: "No autorizado"
- Verificar que el usuario tenga rol admin
- Verificar que la sesión esté activa

### Error: "Google Maps API key not configured"
- Agregar GOOGLE_MAPS_API_KEY en variables de entorno
- Reiniciar el servidor

### Rutas no se calculan
- Verificar conectividad a internet
- Verificar créditos disponibles en Google Cloud
- Revisar logs del servidor para errores específicos

## ✅ Estado Actual

- **Implementado**: Sistema completo funcional
- **Probado**: Con los 18 hospitales especificados
- **Listo para**: Uso en producción por administradores