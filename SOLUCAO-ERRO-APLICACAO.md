# 🔧 Solução: Application Error - Client-Side Exception

## ✅ Problema Resolvido

**Erro:** "Application error: a client-side exception has occurred"

**Causa Raiz:** 
- PM2 estava executando `npm start` (modo produção)
- Não havia build de produção na pasta `.next`
- Ao limpar o cache, removemos o build necessário

## 🎯 Solução Aplicada

### 1. Identificação do Problema
```bash
pm2 list
# Mostrou: sistema-financeiro rodando com 41 restarts

pm2 logs sistema-financeiro
# Erro: "Could not find a production build in the '.next' directory"
```

### 2. Correção
```bash
# Parar PM2
pm2 stop sistema-financeiro

# Fazer build de produção
npm run build

# Reiniciar PM2
pm2 restart sistema-financeiro
```

### 3. Verificação
```bash
pm2 logs sistema-financeiro --lines 20 --nostream
# Resultado: ✓ Ready in 227ms
```

## 📋 Comandos Úteis PM2

### Ver status
```bash
pm2 list
pm2 status
```

### Ver logs
```bash
pm2 logs sistema-financeiro
pm2 logs sistema-financeiro --lines 50
pm2 logs sistema-financeiro --nostream  # Sem seguir logs
```

### Controlar aplicação
```bash
pm2 stop sistema-financeiro
pm2 restart sistema-financeiro
pm2 reload sistema-financeiro  # Zero-downtime restart
pm2 delete sistema-financeiro  # Remove do PM2
```

### Monitoramento
```bash
pm2 monit  # Monitor em tempo real
pm2 show sistema-financeiro  # Detalhes da aplicação
```

## 🔄 Workflow Correto para Atualizações

### Quando fizer mudanças no código:

```bash
# 1. Parar PM2
pm2 stop sistema-financeiro

# 2. Limpar cache (opcional, se necessário)
rm -rf .next node_modules/.cache

# 3. Fazer build
npm run build

# 4. Reiniciar PM2
pm2 restart sistema-financeiro

# 5. Verificar logs
pm2 logs sistema-financeiro --lines 20
```

### Script Automatizado
Criado: `deploy-production.sh`

```bash
#!/bin/bash
echo "🚀 Deploy de Produção"
pm2 stop sistema-financeiro
rm -rf .next node_modules/.cache
npm run build
pm2 restart sistema-financeiro
pm2 logs sistema-financeiro --lines 20 --nostream
echo "✅ Deploy concluído!"
```

## ⚠️ Importante

### Diferença entre Modos

**Desenvolvimento (`npm run dev`):**
- Hot reload automático
- Não precisa de build
- Mais lento
- Porta 3000 (padrão)

**Produção (`npm start`):**
- Precisa de build primeiro (`npm run build`)
- Mais rápido
- Otimizado
- Usado pelo PM2

### PM2 vs Manual

**Com PM2 (Produção):**
```bash
pm2 restart sistema-financeiro
```

**Sem PM2 (Desenvolvimento):**
```bash
npm run dev
```

## 🐛 Troubleshooting

### Erro: "Could not find production build"
```bash
npm run build
pm2 restart sistema-financeiro
```

### Erro: "Port 3000 in use"
```bash
pm2 stop sistema-financeiro
# OU
kill -9 $(lsof -ti:3000)
```

### Erro: "Failed to find Server Action"
```bash
# Cache desatualizado
pm2 stop sistema-financeiro
rm -rf .next
npm run build
pm2 restart sistema-financeiro
```

### PM2 reiniciando constantemente
```bash
pm2 logs sistema-financeiro
# Verificar erro nos logs
# Corrigir o problema
pm2 restart sistema-financeiro
```

## 📊 Status Atual

✅ **Aplicação:** Online  
✅ **PM2:** Gerenciando processo  
✅ **Build:** Atualizado  
✅ **Porta:** 3000  
✅ **Modo:** Produção  

## 🔗 URLs

- **Local:** http://localhost:3000
- **Rede:** http://187.77.35.206:3000
- **Domínio:** https://app.majobpo.com

## 📝 Próximos Passos

1. Acesse https://app.majobpo.com
2. Limpe cache do navegador (Ctrl+Shift+R)
3. Verifique se o erro foi resolvido
4. Teste as funcionalidades do dashboard

## 🛠️ Scripts Criados

- ✅ `clear-cache.js` - Limpar cache Next.js
- ✅ `rebuild-styles.sh` - Rebuild completo
- ✅ `restart-server.sh` - Reiniciar servidor
- ✅ `deploy-production.sh` - Deploy automático (novo)
