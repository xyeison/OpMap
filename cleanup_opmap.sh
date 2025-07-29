#!/bin/bash
# cleanup_opmap.sh - Script de limpieza para el proyecto OpMap

set -e  # Salir si hay algún error

echo "🧹 Iniciando limpieza del proyecto OpMap..."
echo "================================================"

# Confirmar antes de proceder
read -p "⚠️  Este script eliminará/moverá muchos archivos. ¿Continuar? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Limpieza cancelada."
    exit 1
fi

# Contador de archivos
deleted_count=0
moved_count=0

# 1. Eliminar SQL duplicados del raíz
echo -e "\n📋 Eliminando archivos SQL duplicados del directorio raíz..."
sql_files=$(ls *.sql 2>/dev/null | wc -l || echo "0")
if [ "$sql_files" -gt 0 ]; then
    rm *.sql
    deleted_count=$((deleted_count + sql_files))
    echo "   ✓ Eliminados $sql_files archivos SQL"
else
    echo "   ℹ️  No se encontraron archivos SQL en el raíz"
fi

# 2. Eliminar archivos de debug
echo -e "\n🐛 Eliminando archivos de debug..."
debug_files=0
for pattern in "debug_*.py" "diagnose_*.js" "test_*.js"; do
    count=$(ls $pattern 2>/dev/null | wc -l || echo "0")
    if [ "$count" -gt 0 ]; then
        rm $pattern
        debug_files=$((debug_files + count))
    fi
done
deleted_count=$((deleted_count + debug_files))
echo "   ✓ Eliminados $debug_files archivos de debug"

# 3. Eliminar carpetas obsoletas
echo -e "\n📁 Eliminando carpetas obsoletas..."
obsolete_removed=0
if [ -d "data/geojson_old2" ]; then
    rm -rf data/geojson_old2
    obsolete_removed=$((obsolete_removed + 1))
    echo "   ✓ Eliminada data/geojson_old2"
fi
if [ -d "data/geojson/localities_old" ]; then
    rm -rf data/geojson/localities_old
    obsolete_removed=$((obsolete_removed + 1))
    echo "   ✓ Eliminada data/geojson/localities_old"
fi
echo "   ✓ Total carpetas obsoletas eliminadas: $obsolete_removed"

# 4. Limpiar output (archivar archivos antiguos)
echo -e "\n📦 Limpiando carpeta output..."
if [ -d "output" ]; then
    mkdir -p output/archive_2024
    
    # Contar archivos a mover
    output_files=$(find output -maxdepth 1 \( -name "*.json" -o -name "*.html" -o -name "*.txt" \) | wc -l)
    
    if [ "$output_files" -gt 10 ]; then
        # Mantener solo los 10 más recientes de cada tipo
        for ext in "json" "html" "txt"; do
            files_to_move=$(ls -t output/*.$ext 2>/dev/null | tail -n +11)
            if [ ! -z "$files_to_move" ]; then
                echo "$files_to_move" | xargs -I {} mv {} output/archive_2024/
                moved_count=$((moved_count + $(echo "$files_to_move" | wc -l)))
            fi
        done
        echo "   ✓ Movidos $moved_count archivos a output/archive_2024"
    else
        echo "   ℹ️  La carpeta output tiene pocos archivos, no se requiere limpieza"
    fi
else
    echo "   ⚠️  No se encontró la carpeta output"
fi

# 5. Eliminar versiones antiguas en src
echo -e "\n🔧 Limpiando código fuente..."
src_deleted=0
if [ -d "src" ]; then
    # Eliminar versiones enhanced
    enhanced_files=$(ls src/enhanced_map_visualizer*.py 2>/dev/null | wc -l || echo "0")
    if [ "$enhanced_files" -gt 0 ]; then
        rm src/enhanced_map_visualizer*.py
        src_deleted=$((src_deleted + enhanced_files))
    fi
    
    # Eliminar versiones antiguas del algoritmo
    for file in "opmap_algorithm_enhanced.py" "opmap_algorithm_fixed.py" "map_visualizer.py"; do
        if [ -f "src/$file" ]; then
            rm "src/$file"
            src_deleted=$((src_deleted + 1))
        fi
    done
    echo "   ✓ Eliminados $src_deleted archivos antiguos de src/"
else
    echo "   ⚠️  No se encontró la carpeta src"
fi
deleted_count=$((deleted_count + src_deleted))

# 6. Crear estructura de directorios recomendada
echo -e "\n📂 Creando estructura de directorios..."
mkdir -p database/{01_setup,02_migration,03_maintenance,04_utilities,archive}
mkdir -p scripts/{cache,migration,utilities}
mkdir -p src/{algorithms,visualizers,utils}
echo "   ✓ Estructura de directorios creada"

# Resumen final
echo -e "\n================================================"
echo "✅ LIMPIEZA COMPLETADA"
echo "================================================"
echo "📊 Resumen:"
echo "   - Archivos eliminados: $deleted_count"
echo "   - Archivos movidos a archivo: $moved_count"
echo "   - Total de cambios: $((deleted_count + moved_count))"
echo ""
echo "💡 Próximos pasos recomendados:"
echo "   1. Revisar CLEANUP_PLAN.md para organizar los archivos restantes"
echo "   2. Mover archivos SQL de database/ a las subcarpetas apropiadas"
echo "   3. Actualizar CLAUDE.md con la nueva estructura"
echo ""
echo "🎉 ¡El proyecto está más limpio y organizado!"