# OpMap - Sistema de Asignación Territorial Optimizada

Sistema inteligente para la asignación óptima de territorios comerciales basado en tiempos de viaje reales.

## 🚀 Características

- **Asignación Inteligente**: Algoritmo que asigna Instituciones Prestadoras de Salud (IPS) a Key Account Managers (KAMs) basándose en proximidad temporal
- **Reglas Especiales para Bogotá**: Los KAMs de Bogotá tienen prioridad para competir por localidades dentro de la ciudad
- **Expansión Territorial de 2 Niveles**: Búsqueda en departamentos limítrofes y limítrofes de limítrofes
- **Tiempos Reales**: Integración con Google Maps Distance Matrix API para cálculos precisos
- **Visualización Interactiva**: Mapas HTML con territorios coloreados y estadísticas detalladas

## 📋 Requisitos

- Python 3.8+
- API Key de Google Maps (opcional, para tiempos reales)

## 🛠️ Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/OpMap.git
cd OpMap
```

2. Instala las dependencias:
```bash
pip install -r requirements.txt
```

3. Configura las variables de entorno (opcional):
```bash
cp .env.example .env
# Edita .env y agrega tu API key de Google Maps
```

## 📖 Uso

### Ejecución con Distancia Haversine (rápido, sin costo)
```bash
python3 opmap_bogota_complete.py
```

### Ejecución con Google Maps (tiempos reales)
```bash
python3 opmap_google_matrix.py
```

### Usar Caché Existente
```bash
python3 resume_google_calculations.py
```

## 📊 Estructura del Proyecto

```
OpMap/
├── opmap_bogota_complete.py    # Sistema principal con algoritmo completo
├── opmap_google_matrix.py      # Versión con integración Google Maps
├── resume_google_calculations.py # Script para usar caché existente
├── data/
│   ├── json/                   # Configuración de KAMs y departamentos
│   ├── psv/                    # Base de datos de hospitales
│   ├── geojson/                # Datos geográficos
│   └── cache/                  # Caché de tiempos calculados
├── output/                     # Mapas y resultados generados
└── CLAUDE.md                   # Documentación técnica detallada
```

## 🗺️ Algoritmo de Asignación

El algoritmo sigue estos pasos:

1. **Territorio Base**: Asigna automáticamente IPS en el mismo municipio del KAM
2. **Búsqueda Expandida**: Busca IPS en departamentos cercanos (hasta 2 niveles)
3. **Cálculo de Tiempos**: Calcula tiempos de viaje (Haversine o Google Maps)
4. **Asignación Competitiva**: Asigna cada IPS al KAM más cercano
5. **Regla de Mayoría**: En territorios compartidos, gana el KAM con más IPS

## 🎨 Visualización

El sistema genera mapas HTML interactivos con:
- Territorios coloreados por KAM asignado
- Puntos de IPS con tooltips informativos
- Marcadores de KAMs con estadísticas
- Leyenda con convenciones claras

## 📈 Resultados Actuales

- **IPS Asignadas**: 728 de 768 (94.8%)
- **KAMs Activos**: 16
- **Tiempo Promedio de Viaje**: 290 minutos
- **Departamentos Cubiertos**: 25 de 32

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea tu rama de features (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Autor

- Yeison - *Trabajo inicial* - [GitHub](https://github.com/yeison)

## 🙏 Agradecimientos

- Equipo de ventas por los requerimientos y feedback
- Google Maps Platform por la API de Distance Matrix