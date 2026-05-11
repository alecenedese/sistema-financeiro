-- ============================================
-- IDENTIFICAR E VINCULAR CONTAS AO TENANT CORRETO
-- ============================================

-- 1. Ver todos os tenants (clientes) disponíveis
SELECT 
    id,
    nome,
    cnpj,
    created_at
FROM tenant_clientes
ORDER BY created_at;

-- 2. Ver as contas Nubank sem tenant
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
WHERE nome = 'Nubank' AND tenant_id IS NULL
ORDER BY created_at;

-- 3. Ver se há lançamentos que podem indicar qual tenant é dono de cada conta
SELECT 
    cb.id as conta_id,
    cb.nome as conta_nome,
    cb.created_at as conta_criada_em,
    COUNT(l.id) as total_lancamentos,
    l.tenant_id as tenant_dos_lancamentos
FROM contas_bancarias cb
LEFT JOIN lancamentos l ON l.conta_bancaria_id = cb.id
WHERE cb.nome = 'Nubank' AND cb.tenant_id IS NULL
GROUP BY cb.id, cb.nome, cb.created_at, l.tenant_id
ORDER BY cb.created_at;

-- ============================================
-- CORREÇÃO: Vincular cada conta ao tenant correto
-- ============================================

-- OPÇÃO 1: Se você souber qual conta pertence a qual tenant
-- Substitua <ID_DA_CONTA> e <ID_DO_TENANT> pelos valores corretos

-- Exemplo: Vincular a primeira conta Nubank ao tenant Alessandro
/*
UPDATE contas_bancarias
SET tenant_id = <ID_DO_TENANT_ALESSANDRO>
WHERE id = <ID_DA_PRIMEIRA_CONTA_NUBANK>;
*/

-- Exemplo: Vincular a segunda conta Nubank a outro tenant
/*
UPDATE contas_bancarias
SET tenant_id = <ID_DO_OUTRO_TENANT>
WHERE id = <ID_DA_SEGUNDA_CONTA_NUBANK>;
*/

-- OPÇÃO 2: Se uma das contas for de teste/admin, você pode deletá-la
-- CUIDADO: Só delete se tiver certeza que é uma conta de teste!
/*
DELETE FROM contas_bancarias
WHERE id = <ID_DA_CONTA_DE_TESTE>;
*/

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Ver se ainda há contas sem tenant
SELECT 
    id,
    nome,
    tenant_id,
    created_at
FROM contas_bancarias
WHERE tenant_id IS NULL
ORDER BY created_at;

-- Ver se ainda há duplicatas
SELECT 
    nome,
    tenant_id,
    COUNT(*) as count
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1;
