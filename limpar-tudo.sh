#!/bin/bash

echo "🧹 Limpando todos os caches..."

# Limpar cache do Next.js
echo "📦 Removendo .next..."
rm -rf .next

# Limpar node_modules/.cache se existir
echo "📦 Limpando node_modules/.cache..."
rm -rf node_modules/.cache

# Rebuild
echo "🔨 Rebuilding..."
npm run build

# Restart PM2
echo "🔄 Reiniciando PM2..."
pm2 restart all

echo "✅ Pronto! Agora limpe o cache do navegador:"
echo "   Chrome/Edge: Ctrl+Shift+Delete"
echo "   Firefox: Ctrl+Shift+Delete"
echo "   Ou use: Ctrl+Shift+R para hard refresh"
