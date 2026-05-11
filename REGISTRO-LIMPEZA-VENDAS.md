# 🗑️ Registro de Limpeza de Vendas - Abril/2026

## ✅ Operação Concluída

**Data:** 27/04/2026  
**Operação:** Limpeza de vendas do mês de abril/2026  
**Cliente:** Space Burguer LTDA  
**CNPJ:** 41.801.204/0001-09  
**Tenant ID:** 6

## 📊 Resumo da Operação

### Antes da Limpeza
- **Total de vendas em abril/2026:** 3.278 registros
- **Período:** 01/04/2026 a 30/04/2026

### Depois da Limpeza
- **Total de vendas em abril/2026:** 0 registros
- **Registros deletados:** 3.278

## 🔧 Scripts Criados

### 1. `limpar-vendas-abril.js`
Script genérico para verificar e limpar vendas de abril por cliente.

**Uso:**
```bash
# Ver vendas de abril
node limpar-vendas-abril.js

# Deletar vendas de um cliente específico
node limpar-vendas-abril.js CNPJ_DO_CLIENTE

# Deletar todas as vendas de abril
node limpar-vendas-abril.js --all
```

### 2. `verificar-vendas.js`
Script para verificar vendas do Space Burguer.

**Uso:**
```bash
node verificar-vendas.js
```

### 3. `deletar-vendas-space-burguer.js`
Script específico para deletar vendas de abril do Space Burguer.

**Uso:**
```bash
node deletar-vendas-space-burguer.js
```

### 4. `scripts/013-limpar-vendas-abril.sql`
Script SQL com queries para verificar e deletar vendas.

## 📋 Outros Clientes com Vendas em Abril

### Audithorium Comercio de Roupas Ltda
- **CNPJ:** 43.605.970/0001-23
- **Vendas em abril:** 23 registros
- **Valor total:** R$ 80.624,66
- **Status:** NÃO DELETADO (mantido)

## ⚠️ Importante

- ✅ Apenas as vendas do **Space Burguer LTDA** foram deletadas
- ✅ Vendas de outros clientes foram mantidas
- ✅ Apenas o mês de **abril/2026** foi afetado
- ✅ Outros meses do Space Burguer não foram afetados

## 🔍 Verificação

Para verificar se as vendas foram realmente deletadas:

```bash
node verificar-vendas.js
```

Resultado esperado:
```
Cliente: Space Burguer LTDA
ID: 6
CNPJ: 41.801.204/0001-09

Vendas de abril/2026: 0
```

## 📝 Logs da Operação

```
🔍 Buscando cliente Space Burguer...

Cliente: Space Burguer LTDA
ID: 6
CNPJ: 41.801.204/0001-09

📊 Vendas de abril/2026 ANTES: 3278

⚠️  Deletando 3278 vendas...
✅ Vendas deletadas com sucesso!
📊 Vendas de abril/2026 DEPOIS: 0
🗑️  Total deletado: 3278
```

## 🔄 Para Restaurar (se necessário)

Se precisar restaurar as vendas, será necessário:
1. Ter um backup do banco de dados
2. Restaurar apenas a tabela `vendas` do backup
3. Filtrar apenas os registros do período e cliente específico

**Recomendação:** Sempre fazer backup antes de operações de deleção em massa.

## 📊 Impacto no Sistema

### Tabelas Afetadas
- ✅ `vendas` - 3.278 registros deletados

### Tabelas NÃO Afetadas
- ✅ `contas_receber` - mantidas
- ✅ `contas_pagar` - mantidas
- ✅ `transacoes` - mantidas
- ✅ `tenant_clientes` - mantido
- ✅ Outras tabelas - mantidas

## 🎯 Próximos Passos

1. Verificar dashboard do cliente para confirmar que vendas de abril não aparecem mais
2. Importar novos dados de vendas de abril (se necessário)
3. Verificar relatórios e DRE para garantir consistência

## 📞 Contato

Se houver necessidade de restaurar os dados ou realizar operações similares, utilize os scripts criados como referência.
