-- Primeiro adiciona a coluna grupo_dre se não existir
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS grupo_dre text;

-- Criar categoria para transferências entre contas (sem grupo_dre para não afetar DRE)
INSERT INTO categorias (nome, tipo, cor, tenant_id)
SELECT 'Transferência entre Contas', 'transferencia', '#6B7280', id
FROM tenant_clientes
WHERE NOT EXISTS (
  SELECT 1 FROM categorias WHERE nome = 'Transferência entre Contas' AND tenant_id = tenant_clientes.id
);
