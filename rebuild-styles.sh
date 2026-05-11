#!/bin/bash

echo "🧹 Limpando cache e reconstruindo estilos..."

# Remove cache do Next.js
rm -rf .next
echo "✅ Cache .next removido"

# Remove cache do node_modules
rm -rf node_modules/.cache
echo "✅ Cache node_modules removido"

# Remove cache do Tailwind
rm -rf .next/cache
echo "✅ Cache Tailwind removido"

# Rebuild
echo "🔨 Reconstruindo aplicação..."
npm run build

echo ""
echo "🎉 Rebuild completo!"
echo "💡 Execute: npm run dev para iniciar o servidor"
