#!/bin/bash

echo "🧹 Limpiando procesos anteriores..."
killall -9 node 2>/dev/null || true

echo "🗑️ Limpiando caché de Next.js..."
rm -rf .next

echo "🚀 Iniciando servidor en puerto 3001..."
PORT=3001 npm run dev