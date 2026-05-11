-- ============================================
-- SCRIPT SOMENTE LEITURA - NÃO ALTERA NADA
-- ============================================
-- Execute este script para ver o que precisa ser corrigido
-- SEM fazer nenhuma alteração no banco

-- 1. Ver todas as duplicatas
SELECT 
    nome,
    tenant_id,
    COUNT(*) as total_duplicatas
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2. Ver detalhes das contas Nubank duplicadas
SELECT 
    id,
    nome,
    tipo,
    saldo,
    saldo_inicial,
    tenant_id,
    agencia,
    conta,
    created_at,
    -- Marcar qual seria mantida e qual seria renomeada
    CASE 
        WHEN ROW_NUMBER() OVER (PARTITION BY nome, tenant_id ORDER BY created_at) = 1 
        THEN '✅ MANTER'
        ELSE '⚠️ RENOMEAR para: ' || nome || ' (' || ROW_NUMBER() OVER (PARTITION BY nome, tenant_id ORDER BY created_at) || ')'
    END as acao_sugerida
FROM contas_bancarias
WHERE nome = 'Nubank' AND tenant_id IS NULL
ORDER BY created_at;

-- 3. Ver se há lançamentos vinculados a cada conta
SELECT 
    cb.id as conta_id,
    cb.nome,
    cb.created_at,
    COUNT(DISTINCT l.id) as total_lancamentos,
    COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor ELSE 0 END), 0) as total_receitas,
    COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor ELSE 0 END), 0) as total_despesas
FROM contas_bancarias cb
LEFT JOIN lancamentos l ON l.conta_bancaria_id = cb.id
WHERE cb.nome = 'Nubank' AND cb.tenant_id IS NULL
GROUP BY cb.id, cb.nome, cb.created_at
ORDER BY cb.created_at;

-- 4. Ver estrutura da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'contas_bancarias'
ORDER BY ordinal_position;

-- 5. Ver constraints existentes
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'contas_bancarias'::regclass;
