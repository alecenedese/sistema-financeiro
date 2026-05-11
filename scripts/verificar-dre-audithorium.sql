-- Script para verificar dados do DRE do cliente Audithorium para março/2026
-- CNPJ: 43.605.970/0001-23

-- 1. Buscar tenant_id do cliente Audithorium
SELECT id, nome, cnpj FROM public.tenants WHERE cnpj = '43.605.970/0001-23' OR nome ILIKE '%Audithorium%';

-- 2. Com o tenant_id encontrado, verificar contas_receber (status=recebido) para março/2026
-- Substitua {tenant_id} pelo ID real
/*
SELECT 
    c.grupo_dre,
    cat.nome as categoria_nome,
    COUNT(*) as quantidade,
    SUM(cr.valor) as total
FROM public.contas_receber cr
JOIN public.categorias cat ON cr.categoria_id = cat.id
JOIN public.categorias c ON cr.categoria_id = c.id
WHERE cr.tenant_id = {tenant_id}
  AND cr.status = 'recebido'
  AND cr.vencimento BETWEEN '2026-03-01' AND '2026-03-31'
GROUP BY c.grupo_dre, cat.nome
ORDER BY c.grupo_dre, total DESC;
*/

-- 3. Verificar contas_pagar (status=pago) para março/2026
/*
SELECT 
    c.grupo_dre,
    cat.nome as categoria_nome,
    COUNT(*) as quantidade,
    SUM(cp.valor) as total
FROM public.contas_pagar cp
JOIN public.categorias cat ON cp.categoria_id = cat.id
JOIN public.categorias c ON cp.categoria_id = c.id
WHERE cp.tenant_id = {tenant_id}
  AND cp.status = 'pago'
  AND cp.vencimento BETWEEN '2026-03-01' AND '2026-03-31'
GROUP BY c.grupo_dre, cat.nome
ORDER BY c.grupo_dre, total DESC;
*/

-- 4. Verificar vendas para março/2026
/*
SELECT 
    COUNT(*) as quantidade,
    SUM(valor_total) as total_vendas
FROM public.vendas
WHERE tenant_id = {tenant_id}
  AND data_venda BETWEEN '2026-03-01' AND '2026-03-31';
*/

-- 5. Resumo geral por grupo DRE (combinação de receitas e despesas)
/*
WITH receitas AS (
    SELECT 
        COALESCE(c.grupo_dre, '1.2') as grupo_dre,
        SUM(cr.valor) as total
    FROM public.contas_receber cr
    LEFT JOIN public.categorias c ON cr.categoria_id = c.id
    WHERE cr.tenant_id = {tenant_id}
      AND cr.status = 'recebido'
      AND cr.vencimento BETWEEN '2026-03-01' AND '2026-03-31'
    GROUP BY COALESCE(c.grupo_dre, '1.2')
),
despesas AS (
    SELECT 
        COALESCE(c.grupo_dre, '7.2') as grupo_dre,
        SUM(cp.valor) as total
    FROM public.contas_pagar cp
    LEFT JOIN public.categorias c ON cp.categoria_id = c.id
    WHERE cp.tenant_id = {tenant_id}
      AND cp.status = 'pago'
      AND cp.vencimento BETWEEN '2026-03-01' AND '2026-03-31'
    GROUP BY COALESCE(c.grupo_dre, '7.2')
),
vendas AS (
    SELECT '1.1' as grupo_dre, SUM(valor_total) as total
    FROM public.vendas
    WHERE tenant_id = {tenant_id}
      AND data_venda BETWEEN '2026-03-01' AND '2026-03-31'
)
SELECT 
    grupo_dre,
    CASE grupo_dre
        WHEN '1.1' THEN 'Receita de Vendas'
        WHEN '1.2' THEN 'Receita de Serviços'
        WHEN '2.1' THEN 'Impostos sobre vendas'
        WHEN '2.2' THEN 'Devoluções'
        WHEN '4.1' THEN 'Custo com Produto'
        WHEN '7.1' THEN 'Despesas Administrativas'
        WHEN '7.2' THEN 'Despesas Operacionais'
        WHEN '7.3' THEN 'Despesas com Pessoal'
        WHEN '8.1' THEN 'Receitas Financeiras'
        WHEN '8.2' THEN 'Despesas Financeiras'
        WHEN '10.1' THEN 'Retiradas do Caixa'
        WHEN '10.2' THEN 'Distribuição de Lucro'
        ELSE 'Outros'
    END as descricao,
    total
FROM (
    SELECT grupo_dre, total FROM receitas
    UNION ALL
    SELECT grupo_dre, total FROM despesas
    UNION ALL
    SELECT grupo_dre, COALESCE(total, 0) FROM vendas
) combined
ORDER BY grupo_dre;
*/

-- 6. Verificar categorias sem grupo_dre (podem estar gerando inconsistências)
/*
-- Categorias usadas em contas_receber sem grupo_dre
SELECT DISTINCT cat.id, cat.nome, cat.grupo_dre
FROM public.contas_receber cr
JOIN public.categorias cat ON cr.categoria_id = cat.id
WHERE cr.tenant_id = {tenant_id}
  AND cr.status = 'recebido'
  AND cr.vencimento BETWEEN '2026-03-01' AND '2026-03-31'
  AND (cat.grupo_dre IS NULL OR cat.grupo_dre = '');

-- Categorias usadas em contas_pagar sem grupo_dre
SELECT DISTINCT cat.id, cat.nome, cat.grupo_dre
FROM public.contas_pagar cp
JOIN public.categorias cat ON cp.categoria_id = cat.id
WHERE cp.tenant_id = {tenant_id}
  AND cp.status = 'pago'
  AND cp.vencimento BETWEEN '2026-03-01' AND '2026-03-31'
  AND (cat.grupo_dre IS NULL OR cat.grupo_dre = '');
*/
