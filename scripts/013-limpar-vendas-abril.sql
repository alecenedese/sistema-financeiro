-- Script para limpar vendas de abril/2026
-- ATENÇÃO: Este script irá deletar registros permanentemente!

-- Primeiro, vamos ver quantos registros existem por cliente em abril/2026
SELECT 
    t.nome as cliente,
    t.cnpj,
    COUNT(v.id) as total_vendas,
    SUM(v.valor_total) as valor_total
FROM vendas v
JOIN tenants t ON v.tenant_id = t.id
WHERE v.data_venda >= '2026-04-01'
  AND v.data_venda < '2026-05-01'
GROUP BY t.id, t.nome, t.cnpj
ORDER BY t.nome;

-- Para deletar vendas de um cliente específico em abril/2026, descomente e ajuste:
-- DELETE FROM vendas 
-- WHERE tenant_id = (SELECT id FROM tenants WHERE cnpj = 'CNPJ_DO_CLIENTE')
--   AND data_venda >= '2026-04-01'
--   AND data_venda < '2026-05-01';

-- Para deletar TODAS as vendas de abril/2026 de TODOS os clientes:
-- CUIDADO: Isso irá deletar todos os registros!
-- DELETE FROM vendas 
-- WHERE data_venda >= '2026-04-01'
--   AND data_venda < '2026-05-01';
