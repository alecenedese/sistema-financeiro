#!/bin/bash

echo "🚀 Iniciando deploy de produção..."
echo ""

# Parar PM2
echo "🛑 Parando aplicação..."
pm2 stop sistema-financeiro

# Limpar cache
echo "🧹 Limpando cache..."
rm -rf .next node_modules/.cache

# Build
echo "🔨 Fazendo build de produção..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build concluído com sucesso!"
    echo ""
    
    # Reiniciar PM2
    echo "🚀 Reiniciando aplicação..."
    pm2 restart sistema-financeiro
    
    echo ""
    echo "📊 Status da aplicação:"
    pm2 list
    
    echo ""
    echo "📝 Últimos logs:"
    pm2 logs sistema-financeiro --lines 10 --nostream
    
    echo ""
    echo "🎉 Deploy concluído com sucesso!"
    echo "🌐 Acesse: https://app.majobpo.com"
else
    echo ""
    echo "❌ Erro no build!"
    echo "🔄 Reiniciando aplicação com build anterior..."
    pm2 restart sistema-financeiro
    exit 1
fi
