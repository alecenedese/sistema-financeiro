-- ============================================
-- Correção Rápida: Duplicatas Nubank
-- ============================================

-- 1. Ver as contas duplicadas
SELECT 
    id,
    nome,
    tipo,
    saldo,
    saldo_inicial,
    tenant_id,
    created_at
FROM contas_bancarias
WHERE nome = 'Nubank' AND tenant_id IS NULL
ORDER BY created_at;

-- 2. ESCOLHA UMA OPÇÃO:

-- OPÇÃO A: Renomear a conta mais recente
-- (Mantém ambas as contas, mas com nomes diferentes)
UPDATE contas_bancarias
SET nome = 'Nubank (2)'
WHERE id = (
    SELECT id 
    FROM contas_bancarias 
    WHERE nome = 'Nubank' AND tenant_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1
);

-- OPÇÃO B: Deletar a conta mais recente
-- ATENÇÃO: Isso vai DELETAR permanentemente a conta duplicada!
-- Descomente apenas se tiver certeza:
/*
DELETE FROM contas_bancarias
WHERE id = (
    SELECT id 
    FROM contas_bancarias 
    WHERE nome = 'Nubank' AND tenant_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1
);
*/

-- 3. Verificar se foi corrigido
SELECT 
    nome,
    tenant_id,
    COUNT(*) as count
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1;

-- 4. (OPCIONAL) Adicionar constraint única para evitar duplicatas futuras
-- ATENÇÃO: Só faça isso se quiser impedir contas com o mesmo nome
/*
ALTER TABLE contas_bancarias
ADD CONSTRAINT contas_bancarias_nome_tenant_unique 
UNIQUE (nome, tenant_id);
*/
