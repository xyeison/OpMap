# Histórico de resultados y colores originales

_Extraído de CLAUDE.md el 2026-10-11. Cifras históricas de 2025; la fuente viva es Supabase._

## RESULTADOS ACTUALES CON GOOGLE MAPS

### Estadísticas del Caché (Actualizado)
- **Rutas calculadas**: 10,330+ tiempos de viaje reales en Supabase (cifra histórica; hoy viven en `hospital_kam_distances`, 9,859 filas a 2026-10-10)
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
