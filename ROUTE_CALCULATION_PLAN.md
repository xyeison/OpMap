# Plan de Cálculo de Rutas OpMap con Google Maps

## 📊 Estado Actual
- **Total de rutas necesarias**: ~5,040
- **Rutas ya calculadas**: ~1,168 (incluyendo Tolima)
- **Rutas faltantes**: ~3,872
- **Costo estimado total**: ~$19.36 USD
- **Tiempo estimado total**: ~108 minutos a 0.6 rutas/seg

## 🎯 Estrategia
Calcular por departamentos en orden de prioridad, basado en:
1. Cantidad de rutas necesarias
2. Importancia comercial
3. Proximidad a KAMs

## 📋 Orden de Ejecución

### Fase 1: Departamentos Críticos (Alta densidad de hospitales)
1. **Cundinamarca (25)** - ~150 rutas
   - Importante por proximidad a Bogotá
   - Muchos hospitales en municipios cercanos
   - Tiempo estimado: 4.2 minutos
   - Costo: $0.75

2. **Bogotá (11)** - 444 rutas ✅
   - Centro neurálgico con 4 KAMs
   - Ya parcialmente calculado
   - Tiempo estimado: 12.3 minutos
   - Costo: $2.22

3. **Antioquia (05)** - 664 rutas
   - Mayor número de rutas necesarias
   - KAM Medellín
   - Tiempo estimado: 18.4 minutos
   - Costo: $3.32

4. **Valle del Cauca (76)** - 480 rutas
   - KAM Cali
   - Alto volumen de hospitales
   - Tiempo estimado: 13.3 minutos
   - Costo: $2.40

### Fase 2: Costa Caribe (Alta densidad)
5. **Bolívar (13)** - 418 rutas
   - KAM Cartagena
   - Importante región costera
   - Tiempo estimado: 11.6 minutos
   - Costo: $2.09

6. **Atlántico (08)** - 384 rutas
   - KAM Barranquilla
   - Centro logístico importante
   - Tiempo estimado: 10.7 minutos
   - Costo: $1.92

7. **Magdalena (47)** - 231 rutas
   - Conecta costa con interior
   - Tiempo estimado: 6.4 minutos
   - Costo: $1.16

### Fase 3: Eje Cafetero y Centro
8. **Risaralda (66)** - ~120 rutas
   - KAM Pereira
   - Ya parcialmente calculado (Líbano)
   - Tiempo estimado: 3.3 minutos
   - Costo: $0.60

9. **Caldas (17)** - ~100 rutas
   - Sin KAM propio pero importante
   - Tiempo estimado: 2.8 minutos
   - Costo: $0.50

10. **Quindío (63)** - ~90 rutas
    - Eje cafetero
    - Tiempo estimado: 2.5 minutos
    - Costo: $0.45

### Fase 4: Santanderes
11. **Santander (68)** - 351 rutas
    - KAM Bucaramanga
    - Tiempo estimado: 9.8 minutos
    - Costo: $1.76

12. **Norte de Santander (54)** - ~150 rutas
    - KAM Cúcuta
    - Frontera importante
    - Tiempo estimado: 4.2 minutos
    - Costo: $0.75

### Fase 5: Costa Caribe Norte
13. **Cesar (20)** - 192 rutas
    - KAM Valledupar
    - Tiempo estimado: 5.3 minutos
    - Costo: $0.96

14. **La Guajira (44)** - ~100 rutas
    - Extremo norte
    - Tiempo estimado: 2.8 minutos
    - Costo: $0.50

15. **Córdoba (23)** - 256 rutas
    - KAM Montería
    - Tiempo estimado: 7.1 minutos
    - Costo: $1.28

16. **Sucre (70)** - ~120 rutas
    - KAM Sincelejo
    - Tiempo estimado: 3.3 minutos
    - Costo: $0.60

### Fase 6: Sur del País
17. **Huila (41)** - ~120 rutas
    - KAM Neiva
    - Tiempo estimado: 3.3 minutos
    - Costo: $0.60

18. **Nariño (52)** - ~100 rutas
    - KAM Pasto
    - Frontera sur
    - Tiempo estimado: 2.8 minutos
    - Costo: $0.50

19. **Cauca (19)** - ~80 rutas
    - Entre Cali y Pasto
    - Tiempo estimado: 2.2 minutos
    - Costo: $0.40

### Fase 7: Llanos y Otros
20. **Meta (50)** - ~80 rutas
    - Villavicencio
    - Tiempo estimado: 2.2 minutos
    - Costo: $0.40

21. **Casanare (85)** - ~60 rutas
    - Yopal
    - Tiempo estimado: 1.7 minutos
    - Costo: $0.30

22. **Otros departamentos** - ~200 rutas
    - Boyacá, Arauca, Putumayo, etc.
    - Tiempo estimado: 5.6 minutos
    - Costo: $1.00

## 🚀 Comando de Ejecución

```bash
# Ejecutar uno por uno en orden
echo "25" | python3 calculate_routes_batch.py  # Cundinamarca
echo "11" | python3 calculate_routes_batch.py  # Bogotá
echo "05" | python3 calculate_routes_batch.py  # Antioquia
echo "76" | python3 calculate_routes_batch.py  # Valle del Cauca
echo "13" | python3 calculate_routes_batch.py  # Bolívar
echo "08" | python3 calculate_routes_batch.py  # Atlántico
echo "47" | python3 calculate_routes_batch.py  # Magdalena
echo "66" | python3 calculate_routes_batch.py  # Risaralda
echo "17" | python3 calculate_routes_batch.py  # Caldas
echo "63" | python3 calculate_routes_batch.py  # Quindío
echo "68" | python3 calculate_routes_batch.py  # Santander
echo "54" | python3 calculate_routes_batch.py  # Norte de Santander
echo "20" | python3 calculate_routes_batch.py  # Cesar
echo "44" | python3 calculate_routes_batch.py  # La Guajira
echo "23" | python3 calculate_routes_batch.py  # Córdoba
echo "70" | python3 calculate_routes_batch.py  # Sucre
echo "41" | python3 calculate_routes_batch.py  # Huila
echo "52" | python3 calculate_routes_batch.py  # Nariño
echo "19" | python3 calculate_routes_batch.py  # Cauca
echo "50" | python3 calculate_routes_batch.py  # Meta
echo "85" | python3 calculate_routes_batch.py  # Casanare
```

## 📈 Progreso
- [ ] Fase 1: Departamentos Críticos
- [ ] Fase 2: Costa Caribe
- [ ] Fase 3: Eje Cafetero
- [ ] Fase 4: Santanderes
- [ ] Fase 5: Costa Caribe Norte
- [ ] Fase 6: Sur del País
- [ ] Fase 7: Llanos y Otros

## 💡 Notas
- Cada departamento se calcula individualmente para evitar timeouts
- El script muestra progreso en tiempo real
- Se pueden pausar y continuar en cualquier momento
- Los cálculos ya hechos se omiten automáticamente