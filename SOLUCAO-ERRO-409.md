# Solução para Erro 409 em Contas Bancárias

## 🔴 PROBLEMA IDENTIFICADO

Há **2 contas "Nubank"** com `tenant_id = null` no banco de dados, causando conflito ao tentar criar novas contas.

```
| nome   | tenant_id | count |
| ------ | --------- | ----- |
| Nubank | null      | 2     |
```

## ✅ SOLUÇÃO RÁPIDA

### Opção 1: Renomear a Duplicata (RECOMENDADO)

Execute no Supabase SQL Editor:

```sql
-- Renomear a conta mais recente para "Nubank (2)"
UPDATE contas_bancarias
SET nome = 'Nubank (2)'
WHERE id = (
    SELECT id 
    FROM contas_bancarias 
    WHERE nome = 'Nubank' AND tenant_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1
);
```

### Opção 2: Deletar a Duplicata

⚠️ **CUIDADO**: Isso vai deletar permanentemente a conta duplicada!

```sql
-- Ver qual conta será deletada
SELECT id, nome, saldo, created_at
FROM contas_bancarias
WHERE nome = 'Nubank' AND tenant_id IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- Se tiver certeza, delete:
DELETE FROM contas_bancarias
WHERE id = (
    SELECT id 
    FROM contas_bancarias 
    WHERE nome = 'Nubank' AND tenant_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1
);
```

### Verificar se Foi Corrigido

```sql
SELECT nome, tenant_id, COUNT(*) as count
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1;
```

Se não retornar nenhuma linha, o problema foi resolvido! ✅

---

## Alterações Realizadas no Código

### 1. Melhorias no Código (`app/contas-bancarias/page.tsx`)

#### a) Validação de Nome Duplicado
- Adicionada verificação para evitar criar contas com nomes duplicados
- Verifica antes de enviar ao banco se já existe uma conta com o mesmo nome

#### b) Tratamento de Erros Aprimorado
- Console.log detalhado com todos os campos do erro:
  - message, details, hint, code, payload
- Mensagens de erro mais claras para o usuário
- Try-catch para capturar erros inesperados

#### c) Payload Completo
- Adicionados campos `entradas: 0` e `saidas: 0`
- Garantido que `agencia` e `conta` não sejam undefined
- Aplicado `.trim()` nos campos de texto para evitar espaços extras

#### d) Correção na Função de Transferência
- Removidos console.logs desnecessários
- Melhorada a lógica de busca/criação da categoria "Transferência entre Contas"
- Adicionado tratamento de erro com retry em caso de falha

### 2. Scripts SQL Criados

#### `scripts/009-fix-contas-bancarias.sql`
Execute este script no Supabase para:
- Adicionar colunas faltantes (cor, entradas, saidas, banco)
- Atualizar valores NULL para valores padrão
- Remover constraint única se existir
- Verificar duplicatas existentes

#### `check-constraints.sql`
Script para verificar:
- Constraints e índices únicos na tabela
- Duplicatas de nomes por tenant

## Como Resolver o Erro

### Passo 1: Execute o Script de Correção
No Supabase SQL Editor, execute:
```sql
-- Garantir que todas as colunas necessárias existam
ALTER TABLE contas_bancarias 
  ADD COLUMN IF NOT EXISTS cor TEXT DEFAULT '#1B3A5C',
  ADD COLUMN IF NOT EXISTS entradas NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saidas NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banco TEXT;

-- Atualizar valores NULL
UPDATE contas_bancarias SET cor = '#1B3A5C' WHERE cor IS NULL;
UPDATE contas_bancarias SET entradas = 0 WHERE entradas IS NULL;
UPDATE contas_bancarias SET saidas = 0 WHERE saidas IS NULL;

-- Remover constraint única se existir
DO $$ 
BEGIN
    ALTER TABLE contas_bancarias DROP CONSTRAINT IF EXISTS contas_bancarias_nome_tenant_id_key;
EXCEPTION 
    WHEN undefined_object THEN NULL;
END $$;
```

### Passo 2: Verifique Duplicatas
```sql
SELECT nome, tenant_id, COUNT(*) as count
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1;
```

Se houver duplicatas, renomeie-as manualmente:
```sql
UPDATE contas_bancarias 
SET nome = nome || ' (2)' 
WHERE id = <id_da_conta_duplicada>;
```

### Passo 3: Teste a Aplicação
1. Abra o console do navegador (F12)
2. Tente criar uma nova conta bancária
3. Se houver erro, verifique os detalhes no console
4. O erro agora deve mostrar informações completas

## Possíveis Causas do Erro 409

1. **Constraint única em nome+tenant_id**: O banco pode ter uma constraint que impede contas com o mesmo nome para o mesmo tenant
2. **Campos obrigatórios faltando**: Algum campo NOT NULL pode estar faltando
3. **Trigger causando conflito**: Algum trigger pode estar tentando inserir dados duplicados
4. **Política RLS bloqueando**: Política de segurança pode estar impedindo a inserção

## Verificação Adicional

Se o erro persistir, execute no Supabase:
```sql
-- Ver todas as constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'contas_bancarias'::regclass;

-- Ver índices únicos
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'contas_bancarias'
  AND indexdef LIKE '%UNIQUE%';
```

## Contato
Se o erro persistir após estas correções, compartilhe:
1. A mensagem de erro completa do console
2. O resultado das queries de verificação acima
3. A estrutura da tabela: `\d contas_bancarias` no psql
