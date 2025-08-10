# 📊 Sistema de Proveedores - Estado Actual

## ✅ Qué está funcionando

### Interfaz de Usuario (100% Completa)
- **Listado de proveedores**: `/providers`
- **Perfil detallado**: `/providers/[id]` con 5 pestañas
- **Crear proveedor**: Modal con formulario
- **Menú**: "Proveedores" aparece en el menú lateral
- **Diseño**: Escala de grises consistente con OpMap

### Backend (APIs Listas)
- Todos los endpoints están programados y listos
- Las APIs responden pero requieren las tablas en Supabase

## ⚠️ Pendiente: Base de Datos

**El error "Las tablas de proveedores aún no están creadas" aparece porque falta ejecutar el script SQL en Supabase.**

### Para activar completamente el sistema:

1. **Ir a Supabase SQL Editor**
2. **Ejecutar el script**: `database/05_providers/01_create_providers_tables.sql`

Este script crea:
- Tabla `proveedores` - Información básica
- Tabla `proveedor_finanzas` - Estados financieros por año
- Tabla `proveedor_indicadores` - Cálculo automático
- Trigger automático para calcular indicadores
- Vistas para reportes

## 📈 Dónde se coloca la información financiera

### En el Perfil del Proveedor

1. **Crear o buscar un proveedor** en `/providers`
2. **Ir al perfil** del proveedor
3. **Click en pestaña "Financiero"**
4. **Click en "Agregar Información Financiera"**

### Información que se registra:

#### Balance General
- Activo Corriente
- Pasivo Corriente  
- Activo Total
- Pasivo Total
- Patrimonio

#### Estado de Resultados
- Ingresos Operacionales
- Utilidad Operacional
- Gastos de Intereses
- Utilidad Neta

### Indicadores Calculados Automáticamente

Al guardar la información financiera, el sistema calcula automáticamente:

#### Obligatorios para Licitaciones
- **Índice de Liquidez**: Activo Corriente / Pasivo Corriente (debe ser ≥ 1.2)
- **Índice de Endeudamiento**: Pasivo Total / Activo Total (debe ser ≤ 70%)
- **Cobertura de Intereses**: Utilidad Operacional / Gastos Intereses (debe ser ≥ 1.5)

#### Indicadores Adicionales
- ROE, ROA
- Márgenes (Operacional, Neto)
- Prueba Ácida
- Capital de Trabajo
- Y más de 20 indicadores

## 🎯 Flujo de Uso

1. **Crear Proveedor** (solo nombre y NIT requeridos)
2. **Ir al Perfil** → Pestaña "Financiero"
3. **Agregar Año Financiero** con los datos del balance
4. **Sistema calcula automáticamente** todos los indicadores
5. **Ver si cumple** requisitos para licitaciones (✓ o ✗)

## 🔴 Importante

**Sin ejecutar el script SQL en Supabase:**
- ❌ No se pueden crear proveedores
- ❌ No se puede guardar información financiera
- ❌ No funcionan los cálculos automáticos

**Con el script ejecutado:**
- ✅ Todo funciona automáticamente
- ✅ Cálculos instantáneos
- ✅ Validación de requisitos
- ✅ Reportes estratégicos