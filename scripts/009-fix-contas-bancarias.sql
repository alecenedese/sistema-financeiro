-- ============================================
-- PASSO 1: Verificar duplicatas existentes
-- ============================================
SELECT 
    id,
    nome,
    tenant_id,
    saldo,
    created_at
FROM contas_bancarias
WHERE nome = 'Nubank' AND tenant_id IS NULL
ORDER BY created_at;

-- ============================================
-- PASSO 2: Corrigir duplicatas
-- ============================================
-- Opção A: Manter a conta mais antiga e renomear as outras
WITH ranked_contas AS (
    SELECT 
        id,
        nome,
        tenant_id,
        ROW_NUMBER() OVER (PARTITION BY nome, tenant_id ORDER BY created_at) as rn
    FROM contas_bancarias
    WHERE nome = 'Nubank' AND tenant_id IS NULL
)
UPDATE contas_bancarias
SET nome = 'Nubank (' || ranked_contas.rn || ')'
FROM ranked_contas
WHERE contas_bancarias.id = ranked_contas.id
  AND ranked_contas.rn > 1;

-- Opção B (alternativa): Deletar duplicatas mantendo apenas a mais antiga
-- CUIDADO: Isso vai deletar as contas duplicadas!
-- Descomente apenas se tiver certeza:
/*
WITH ranked_contas AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY nome, tenant_id ORDER BY created_at) as rn
    FROM contas_bancarias
    WHERE nome = 'Nubank' AND tenant_id IS NULL
)
DELETE FROM contas_bancarias
WHERE id IN (
    SELECT id FROM ranked_contas WHERE rn > 1
);
*/

-- ============================================
-- PASSO 3: Garantir colunas necessárias
-- ============================================
ALTER TABLE contas_bancarias 
  ADD COLUMN IF NOT EXISTS cor TEXT DEFAULT '#1B3A5C',
  ADD COLUMN IF NOT EXISTS entradas NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saidas NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banco TEXT;

-- Atualizar valores NULL para valores padrão
UPDATE contas_bancarias SET cor = '#1B3A5C' WHERE cor IS NULL;
UPDATE contas_bancarias SET entradas = 0 WHERE entradas IS NULL;
UPDATE contas_bancarias SET saidas = 0 WHERE saidas IS NULL;

-- ============================================
-- PASSO 4: Remover constraint única se existir
-- ============================================
DO $$ 
BEGIN
    ALTER TABLE contas_bancarias DROP CONSTRAINT IF EXISTS contas_bancarias_nome_tenant_id_key;
EXCEPTION 
    WHEN undefined_object THEN 
        NULL;
END $$;

-- ============================================
-- PASSO 5: Verificar se ainda há duplicatas
-- ============================================
SELECT 
    nome,
    tenant_id,
    COUNT(*) as count
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1;
