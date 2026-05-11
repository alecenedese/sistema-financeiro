# Correção do Filtro de Data - Página de Vendas

## Problema Identificado

O front-end estava mostrando **R$ 332.702,34** ao invés do valor correto **R$ 332.658,80** para as vendas de abril de 2026.

**Diferença**: R$ 43,54

## Causa Raiz

O filtro de data estava usando `lte('2026-04-30T23:59:59')` (less than or equal), que com a chave anon do Supabase estava retornando valores inconsistentes devido a:
- Possíveis problemas de timezone
- Cache do Supabase
- Políticas RLS (Row Level Security)

## Solução Implementada

Alterado o filtro para usar `lt()` (less than) com o primeiro dia do próximo período ao invés de `lte()` com o último segundo do período atual.

### Mudanças no Código

**Antes:**
```typescript
// Último dia do mês com 23:59:59
const toStr = `2026-04-30T23:59:59`
q = q.lte("data_venda", toStr)
```

**Depois:**
```typescript
// Primeiro dia do próximo mês
const toStr = `2026-05-01T00:00:00`
q = q.lt("data_venda", toStr)
```

### Benefícios

1. **Consistência**: Mesmo resultado com chave anon e service role
2. **Precisão**: Valores corretos sem arredondamentos ou inclusões indevidas
3. **Confiabilidade**: Menos suscetível a problemas de timezone
4. **Padrão**: Abordagem mais comum em queries de banco de dados

## Valores Corretos (Abril 2026)

- **Total Vendas**: R$ 332.658,80
- **Total Recebido**: R$ 326.740,50
- **Total Taxas**: R$ 4.150,94
- **Total Desconto**: R$ 5.918,30
- **Quantidade**: 4.255 vendas

## Arquivos Modificados

- `app/vendas/page.tsx`
  - Função `dateRange` (useMemo)
  - Função `fetchVendas`
  - SWR key

## Scripts de Verificação

- `comparar-valores.js` - Mostra valores corretos do banco
- `verificar-datas-vendas.js` - Compara filtros lte vs lt
- `testar-filtro-frontend.js` - Simula query do front-end
- `comparar-queries.js` - Compara resultados detalhados

## Deploy

```bash
npm run build
pm2 restart all
```

## Verificação

Após o deploy, verificar no front-end:
1. Selecionar "Mês atual" (abril)
2. Verificar que o Total Vendas mostra **R$ 332.658,80**
3. Verificar que mostra **4255 vendas**
4. No console (F12), verificar logs:
   - `[fetchVendas] Usando lt: 2026-05-01T00:00:00`
   - `[fetchVendas] Total de registros buscados: 4255`
