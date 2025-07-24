#!/bin/bash

# Script para subir archivos GeoJSON a Cloudflare R2

echo "==================================="
echo "Upload GeoJSON files to Cloudflare R2"
echo "==================================="

# Verificar si rclone está instalado
if ! command -v rclone &> /dev/null; then
    echo "❌ rclone no está instalado. Instalando..."
    brew install rclone
fi

# Configuración de R2
echo ""
echo "📋 Necesitarás estos datos de tu dashboard de Cloudflare R2:"
echo "1. Account ID"
echo "2. Access Key ID" 
echo "3. Secret Access Key"
echo "4. Bucket name (sugerido: opmap-geojson)"
echo ""

# Crear configuración de rclone para R2
echo "⚙️  Configurando rclone para R2..."
cat > ~/.config/rclone/rclone.conf << EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
acl = private
EOF

echo "✅ Configuración creada"
echo ""

# Subir archivos
echo "📤 Subiendo archivos GeoJSON a R2..."
echo ""

# Subir cada tipo de archivo
echo "1️⃣ Subiendo departamentos..."
rclone copy /Users/yeison/Documents/GitHub/OpMap/data/geojson/departments r2:opmap-geojson/departments --progress

echo ""
echo "2️⃣ Subiendo localidades..."
rclone copy /Users/yeison/Documents/GitHub/OpMap/data/geojson/localities r2:opmap-geojson/localities --progress

echo ""
echo "3️⃣ Subiendo municipios..."
rclone copy /Users/yeison/Documents/GitHub/OpMap/data/geojson/municipalities r2:opmap-geojson/municipalities --progress

echo ""
echo "✅ ¡Subida completa!"
echo ""

# Verificar archivos subidos
echo "📊 Verificando archivos subidos..."
echo "Departamentos: $(rclone ls r2:opmap-geojson/departments | wc -l) archivos"
echo "Localidades: $(rclone ls r2:opmap-geojson/localities | wc -l) archivos"
echo "Municipios: $(rclone ls r2:opmap-geojson/municipalities | wc -l) archivos"

echo ""
echo "🎉 ¡Proceso completado!"
echo ""
echo "📝 Ahora debes:"
echo "1. Hacer el bucket público o configurar CORS"
echo "2. Actualizar la URL en tu código Next.js"
echo "3. La URL base será: https://pub-XXXXX.r2.dev/ o tu dominio personalizado"