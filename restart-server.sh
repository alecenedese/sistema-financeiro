#!/bin/bash

echo "🛑 Parando todos os processos Next.js..."

# Mata todos os processos next-server
pkill -9 -f "next-server"
pkill -9 -f "next dev"

# Aguarda processos finalizarem
sleep 2

# Verifica se a porta 3000 está livre
if ss -tlnp | grep -q :3000; then
    echo "⚠️  Porta 3000 ainda em uso, forçando liberação..."
    PID=$(ss -tlnp | grep :3000 | grep -oP 'pid=\K[0-9]+' | head -1)
    if [ ! -z "$PID" ]; then
        kill -9 $PID
        echo "✅ Processo $PID finalizado"
    fi
fi

sleep 1

echo "🧹 Limpando cache..."
rm -rf .next node_modules/.cache

echo "🚀 Iniciando servidor..."
npm run dev
