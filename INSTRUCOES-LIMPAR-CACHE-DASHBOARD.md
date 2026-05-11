# 🧹 Instruções para Limpar Cache do Dashboard

## Problema Resolvido
- ✅ Corrigido caracteres especiais: "lan��amentos" → "lançamentos"
- ✅ Implementado filtro DRE: apenas categorias com `grupo_dre` aparecem no gráfico
- ✅ Desabilitado cache SWR para forçar dados atualizados

## Como Limpar Cache Completamente

### Opção 1: Script Automático (Recomendado)
```bash
npm run clear-cache
```

### Opção 2: Manual
```bash
# Parar o servidor (Ctrl+C)
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

### Opção 3: Cache do Navegador
1. Abrir DevTools (F12)
2. Clicar com botão direito no botão de refresh
3. Selecionar "Empty Cache and Hard Reload"

## Verificação
Após limpar o cache, verifique:
1. ✅ Texto "Clique em uma categoria para ver os lançamentos" (sem caracteres especiais)
2. ✅ Apenas categorias com vínculo DRE aparecem no gráfico
3. ✅ Dados atualizados sem cache antigo

## Mudanças Técnicas Implementadas

### 1. Correção de Encoding
**Arquivo:** `components/dashboard/despesas-categoria.tsx`
```typescript
// ANTES
"Clique em uma categoria para ver os lan��amentos"

// DEPOIS  
"Clique em uma categoria para ver os lançamentos"
```

### 2. Filtro DRE
**Arquivo:** `hooks/use-dashboard-data.ts`
```typescript
// ANTES
.select("valor, categoria_id, categorias(nome), subcategorias(nome)")

// DEPOIS
.select("valor, categoria_id, categorias!inner(nome, grupo_dre), subcategorias(nome)")
.not("categorias.grupo_dre", "is", null)
```

### 3. Desabilitação de Cache
```typescript
return useSWR(key, fetchCategoryChartsMonth, { 
  revalidateOnFocus: false,
  revalidateOnMount: true,
  dedupingInterval: 0 // Força nova busca sempre
})
```

## Próximos Passos
1. Execute `npm run clear-cache`
2. Reinicie o servidor com `npm run dev`
3. Acesse `/dashboard` e verifique as correções
4. Se ainda houver problemas, limpe também o cache do navegador

## Arquivos Modificados
- ✅ `components/dashboard/despesas-categoria.tsx` - Correção de encoding
- ✅ `hooks/use-dashboard-data.ts` - Filtro DRE + desabilitação cache
- ✅ `clear-cache.js` - Script de limpeza automática
- ✅ `package.json` - Adicionado comando `clear-cache`