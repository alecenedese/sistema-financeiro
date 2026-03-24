-- Criar categoria para transferências entre contas (sem grupo_dre para não afetar DRE)
INSERT INTO categorias (nome, tipo, grupo_dre, tenant_id)
SELECT 'Transferência entre Contas', 'despesa', NULL, id
FROM tenant_clientes
WHERE NOT EXISTS (
  SELECT 1 FROM categorias WHERE nome = 'Transferência entre Contas' AND tenant_id = tenant_clientes.id
);

-- Criar também como receita para a conta destino
INSERT INTO categorias (nome, tipo, grupo_dre, tenant_id)
SELECT 'Transferência entre Contas', 'receita', NULL, id
FROM tenant_clientes
WHERE NOT EXISTS (
  SELECT 1 FROM categorias WHERE nome = 'Transferência entre Contas' AND tipo = 'receita' AND tenant_id = tenant_clientes.id
);
