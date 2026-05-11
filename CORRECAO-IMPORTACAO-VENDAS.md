# 🔧 Correção: Importação de Vendas

## ✅ Problemas Corrigidos

### 1. Campo "Codigo" não estava sendo importado
**Causa:** Mapeamento insuficiente de aliases para o campo código
**Solução:** Adicionados mais aliases de busca:
- `"numero"`, `"num pedido"` nos aliases exatos
- Melhorado o contains para capturar variações

### 2. Caracteres especiais no nome do cliente
**Causa:** Encoding incorreto ao ler arquivos (UTF-8 vs ISO-8859-1)
**Solução:** 
- Detecção automática de encoding com caracteres problemáticos (`�`, `Ã`, `Â`)
- Se detectar caracteres estranhos, recarrega com ISO-8859-1
- Para Excel: forçado codepage 65001 (UTF-8)

### 3. Caracteres especiais na forma de pagamento
**Causa:** Mesmo problema de encoding
**Solução:** Mesma correção de encoding aplicada

## 🔄 Melhorias Implementadas

### Mapeamento de Campos Aprimorado

#### Codigo
```typescript
Aliases exatos: ["codigo", "cod", "codigo venda", "codigo pedido", 
                 "numero pedido", "pedido", "id pedido", "numero", "num pedido"]
Contains: ["codigo", " cod", "cod ", "pedido", "numero"]
```

#### Cliente
```typescript
Aliases exatos: ["cliente", "nome cliente", "cliente nome", "nome"]
Contains: ["cliente", "nome"]
```

#### Forma de Pagamento
```typescript
Aliases exatos: ["forma pagamento", "forma de pagamento", "pagamento", "forma"]
Contains: ["pagamento", "forma"]
```

#### Canal
```typescript
Aliases exatos: ["canal", "origem", "marketplace", "plataforma"]
Contains: ["canal", "origem"]
```

### Função parseNumber Melhorada

Agora lida corretamente com:
- `1.234,56` → `1234.56` (formato BR)
- `1,234.56` → `1234.56` (formato US)
- `1234,56` → `1234.56`
- `1234.56` → `1234.56`
- `R$ 1.234,56` → `1234.56`

### Encoding Automático

**CSV:**
1. Tenta UTF-8 primeiro
2. Se detectar caracteres problemáticos (`�`, `Ã`, `Â`), recarrega com ISO-8859-1

**Excel:**
- Forçado codepage 65001 (UTF-8)
- `raw: false` para converter valores corretamente

## 📋 Formato de Importação

### Colunas Aceitas

| Campo | Aliases Aceitos |
|-------|----------------|
| **Codigo** | codigo, cod, numero pedido, pedido, id pedido, numero |
| **Cliente** | cliente, nome cliente, nome |
| **Valor Total** | valor total, total, valor venda, valor |
| **Acrescimo** | acrescimo, taxa entrega, entrega |
| **Taxas Marketplace** | taxas marketplace, taxa marketplace, taxas, taxa ifood |
| **Desconto** | desconto, descontos |
| **Valor Recebido** | valor recebido, recebido, liquido, valor liquido |
| **Forma Pagamento** | forma pagamento, pagamento, forma |
| **Canal** | canal, origem, marketplace, plataforma |
| **Data** | data venda, data, data pedido, data hora |

### Formatos de Data Aceitos

- `DD/MM/YYYY HH:MM:SS` → `25/04/2026 14:30:00`
- `DD/MM/YYYY HH:MM` → `25/04/2026 14:30`
- `DD/MM/YYYY` → `25/04/2026`
- `YYYY-MM-DD` → `2026-04-25`
- Número Excel → Convertido automaticamente

### Formatos de Número Aceitos

- `1234.56` (formato US)
- `1234,56` (formato BR)
- `1.234,56` (formato BR com milhar)
- `1,234.56` (formato US com milhar)
- `R$ 1.234,56` (com símbolo de moeda)

## 🧪 Teste de Importação

### Exemplo de CSV Válido

```csv
Codigo,Cliente,Valor Total,Acrescimo,Taxas Marketplace,Desconto,Valor Recebido,Forma de Pagamento,Canal,Data
12345,João Silva,100.50,5.00,10.00,0.00,95.50,PIX,IFOOD,25/04/2026 14:30
12346,Maria Santos,250.00,0.00,25.00,10.00,215.00,Credito,DELIVERY,25/04/2026 15:45
```

### Exemplo de Excel Válido

| Codigo | Cliente | Valor Total | Acrescimo | Taxas Marketplace | Desconto | Valor Recebido | Forma de Pagamento | Canal | Data |
|--------|---------|-------------|-----------|-------------------|----------|----------------|-------------------|-------|------|
| 12345 | João Silva | 100,50 | 5,00 | 10,00 | 0,00 | 95,50 | PIX | IFOOD | 25/04/2026 14:30 |
| 12346 | Maria Santos | 250,00 | 0,00 | 25,00 | 10,00 | 215,00 | Crédito | DELIVERY | 25/04/2026 15:45 |

## 🐛 Debug

Adicionado log no console para debug:
```javascript
console.log('[Import] Mapped rows:', mapped.slice(0, 5))
```

Para ver os dados mapeados:
1. Abra DevTools (F12)
2. Vá para Console
3. Importe o arquivo
4. Veja as primeiras 5 linhas mapeadas

## 📝 Validações

### Antes de Importar
- ✅ Arquivo deve ser CSV, XLS ou XLSX
- ✅ Deve ter pelo menos a coluna "Valor Total"
- ✅ Valor Total deve ser maior que 0

### Durante Importação
- ✅ Códigos duplicados são ignorados (skipped)
- ✅ Vendas sem valor são filtradas
- ✅ Campos vazios recebem valores padrão

### Após Importação
- ✅ Mostra quantas vendas foram criadas
- ✅ Mostra quantas foram ignoradas (duplicadas)
- ✅ Lista é atualizada automaticamente

## 🚀 Deploy

Para aplicar as correções:

```bash
# Parar PM2
pm2 stop sistema-financeiro

# Build
npm run build

# Reiniciar PM2
pm2 restart sistema-financeiro
```

OU usar o script automático:

```bash
./deploy-production.sh
```

## ✅ Checklist de Teste

Após deploy, teste:

- [ ] Importar CSV com encoding UTF-8
- [ ] Importar CSV com encoding ISO-8859-1 (acentos)
- [ ] Importar Excel (.xlsx)
- [ ] Verificar se campo "Codigo" está preenchido
- [ ] Verificar se nome do cliente está sem caracteres especiais
- [ ] Verificar se forma de pagamento está correta
- [ ] Verificar se números estão corretos (formato BR)
- [ ] Verificar se datas estão corretas

## 📊 Resultado Esperado

Após importação de 4257 vendas:
- ✅ Todos os códigos preenchidos
- ✅ Nomes de clientes legíveis (sem `�`, `Ã`, etc)
- ✅ Formas de pagamento legíveis
- ✅ Valores numéricos corretos
- ✅ Datas no formato correto

## 🔗 Arquivos Modificados

- ✅ `app/vendas/page.tsx` - Correção de encoding e mapeamento
