-- Cria tabela de clientes do sistema (multi-tenant)
CREATE TABLE IF NOT EXISTS tenant_clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Adiciona tenant_id em todas as tabelas de dados
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE subcategorias ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE subcategorias_filhos ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE mapping_rules ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
ALTER TABLE despesas_fixas ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE;
