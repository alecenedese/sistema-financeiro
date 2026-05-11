-- ============================================
-- CORREÇÃO DE DUPLICATAS DA CATEGORIA "Transferência entre Contas"
-- ============================================
-- Consolida todas as duplicatas em uma única categoria por tenant
-- e remaneja lançamentos vinculados, depois remove as redundantes.

-- 1. Visualizar duplicatas (antes)
SELECT tenant_id, nome, COUNT(*) AS total
FROM categorias
WHERE LOWER(unaccent(nome)) = 'transferencia entre contas'
GROUP BY tenant_id, nome
HAVING COUNT(*) > 1;

-- 2. Para cada tenant: eleger a primeira (menor id) como "oficial"
--    e migrar contas_pagar / contas_receber para ela; depois remover as demais.

WITH oficiais AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, id AS oficial_id
  FROM categorias
  WHERE LOWER(unaccent(nome)) = 'transferencia entre contas'
  ORDER BY tenant_id, id
),
duplicadas AS (
  SELECT c.id, c.tenant_id, o.oficial_id
  FROM categorias c
  JOIN oficiais o ON o.tenant_id = c.tenant_id
  WHERE LOWER(unaccent(c.nome)) = 'transferencia entre contas'
    AND c.id <> o.oficial_id
)
-- Atualiza contas_pagar para apontar para a oficial
UPDATE contas_pagar cp
SET categoria_id = d.oficial_id
FROM duplicadas d
WHERE cp.categoria_id = d.id;

WITH oficiais AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, id AS oficial_id
  FROM categorias
  WHERE LOWER(unaccent(nome)) = 'transferencia entre contas'
  ORDER BY tenant_id, id
),
duplicadas AS (
  SELECT c.id, c.tenant_id, o.oficial_id
  FROM categorias c
  JOIN oficiais o ON o.tenant_id = c.tenant_id
  WHERE LOWER(unaccent(c.nome)) = 'transferencia entre contas'
    AND c.id <> o.oficial_id
)
UPDATE contas_receber cr
SET categoria_id = d.oficial_id
FROM duplicadas d
WHERE cr.categoria_id = d.id;

-- (Opcional) Atualiza lancamentos se existirem referências
WITH oficiais AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, id AS oficial_id
  FROM categorias
  WHERE LOWER(unaccent(nome)) = 'transferencia entre contas'
  ORDER BY tenant_id, id
),
duplicadas AS (
  SELECT c.id, c.tenant_id, o.oficial_id
  FROM categorias c
  JOIN oficiais o ON o.tenant_id = c.tenant_id
  WHERE LOWER(unaccent(c.nome)) = 'transferencia entre contas'
    AND c.id <> o.oficial_id
)
UPDATE lancamentos l
SET categoria_id = d.oficial_id
FROM duplicadas d
WHERE l.categoria_id = d.id;

-- 3. Agora deleta as categorias duplicadas
WITH oficiais AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, id AS oficial_id
  FROM categorias
  WHERE LOWER(unaccent(nome)) = 'transferencia entre contas'
  ORDER BY tenant_id, id
)
DELETE FROM categorias c
USING oficiais o
WHERE LOWER(unaccent(c.nome)) = 'transferencia entre contas'
  AND c.tenant_id = o.tenant_id
  AND c.id <> o.oficial_id;

-- 4. Verificação final (deve retornar 0 linhas)
SELECT tenant_id, nome, COUNT(*) AS total
FROM categorias
WHERE LOWER(unaccent(nome)) = 'transferencia entre contas'
GROUP BY tenant_id, nome
HAVING COUNT(*) > 1;

-- 5. (Opcional) Criar constraint única para prevenir duplicatas futuras
-- Requer que não existam duplicatas atualmente em (tenant_id, nome) em TODA a tabela
-- ALTER TABLE categorias ADD CONSTRAINT categorias_nome_tenant_unique UNIQUE (tenant_id, nome);
