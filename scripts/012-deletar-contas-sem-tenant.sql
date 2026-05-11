-- ============================================
-- DELETAR CONTAS SEM VÍNCULO DE CLIENTE
-- ============================================

-- 1. Ver quais contas serão deletadas
SELECT 
    id,
    nome,
    tipo,
    saldo,
    agencia,
    conta,
    tenant_id,
    created_at
FROM contas_bancarias
WHERE tenant_id IS NULL
ORDER BY created_at;

-- 2. Ver se há lançamentos vinculados a essas contas
SELECT 
    cb.id as conta_id,
    cb.nome as conta_nome,
    COUNT(l.id) as total_lancamentos
FROM contas_bancarias cb
LEFT JOIN lancamentos l ON l.conta_bancaria_id = cb.id
WHERE cb.tenant_id IS NULL
GROUP BY cb.id, cb.nome;

-- 3. DELETAR todas as contas sem tenant_id
-- ⚠️ ATENÇÃO: Isso vai deletar permanentemente!
DELETE FROM contas_bancarias
WHERE tenant_id IS NULL;

-- 4. Verificar se foi deletado
SELECT COUNT(*) as contas_sem_tenant
FROM contas_bancarias
WHERE tenant_id IS NULL;

-- 5. Verificar se ainda há duplicatas
SELECT 
    nome,
    tenant_id,
    COUNT(*) as count
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1;

-- Resultado esperado: 0 linhas (sem duplicatas)
