import pg from "pg"

const { Client } = pg

const sql = `
-- 001: CNPJ em clientes e fornecedores
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 002: Forma de pagamento em contas
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- 003: Tabela de despesas fixas e colunas de parcela
CREATE TABLE IF NOT EXISTS despesas_fixas (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  keyword TEXT NOT NULL,
  valor NUMERIC(10,2),
  total_parcelas INT NOT NULL DEFAULT 1,
  parcela_atual INT NOT NULL DEFAULT 1,
  categoria_id INT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id INT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id INT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  fornecedor_id INT REFERENCES fornecedores(id) ON DELETE SET NULL,
  conta_bancaria_id INT REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS parcela_atual INT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS total_parcelas INT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS despesa_fixa_id INT REFERENCES despesas_fixas(id) ON DELETE SET NULL;

-- 004: Multi-tenant
CREATE TABLE IF NOT EXISTS tenant_clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

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
`

const client = new Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING })

try {
  await client.connect()
  console.log("[v0] Conectado ao banco. Executando migrations...")
  await client.query(sql)
  console.log("[v0] Todas as migrations executadas com sucesso!")
} catch (err) {
  console.error("[v0] Erro na migration:", err.message)
  process.exit(1)
} finally {
  await client.end()
}
