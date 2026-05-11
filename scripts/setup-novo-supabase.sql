-- =====================================================
-- SETUP COMPLETO DO BANCO - Sistema Financeiro
-- Rodar uma vez no SQL Editor do novo projeto Supabase
-- =====================================================

-- 1. tenant_clientes (multi-tenant)
CREATE TABLE IF NOT EXISTS tenant_clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. clientes_admin
CREATE TABLE IF NOT EXISTS clientes_admin (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Categorias
CREATE TABLE IF NOT EXISTS categorias (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Receita','Despesa','transferencia')),
  cor TEXT NOT NULL DEFAULT '#1B3A5C',
  grupo_dre TEXT,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Subcategorias
CREATE TABLE IF NOT EXISTS subcategorias (
  id BIGSERIAL PRIMARY KEY,
  categoria_id BIGINT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Subcategorias Filhos
CREATE TABLE IF NOT EXISTS subcategorias_filhos (
  id BIGSERIAL PRIMARY KEY,
  subcategoria_id BIGINT NOT NULL REFERENCES subcategorias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cnpj TEXT,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cnpj TEXT,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Contas Bancárias
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'corrente',
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Despesas Fixas
CREATE TABLE IF NOT EXISTS despesas_fixas (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  keyword TEXT NOT NULL,
  valor NUMERIC(10,2),
  total_parcelas INT NOT NULL DEFAULT 1,
  parcela_atual INT NOT NULL DEFAULT 1,
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  fornecedor_id INT REFERENCES fornecedores(id) ON DELETE SET NULL,
  conta_bancaria_id INT REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  ativa BOOLEAN DEFAULT true,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Contas a Pagar
CREATE TABLE IF NOT EXISTS contas_pagar (
  id BIGSERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  vencimento DATE NOT NULL,
  data_vencimento DATE,
  status TEXT NOT NULL CHECK (status IN ('pendente','pago','vencido')) DEFAULT 'pendente',
  fornecedor TEXT NOT NULL DEFAULT '',
  fornecedor_id INT REFERENCES fornecedores(id) ON DELETE SET NULL,
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  conta_bancaria_id INT REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  forma_pagamento TEXT,
  parcela_atual INT,
  total_parcelas INT,
  despesa_fixa_id INT REFERENCES despesas_fixas(id) ON DELETE SET NULL,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Contas a Receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id BIGSERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  vencimento DATE NOT NULL,
  data_vencimento DATE,
  status TEXT NOT NULL CHECK (status IN ('pendente','recebido','vencido')) DEFAULT 'pendente',
  cliente TEXT NOT NULL DEFAULT '',
  cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  conta_bancaria_id INT REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  forma_pagamento TEXT,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Lançamentos
CREATE TABLE IF NOT EXISTS lancamentos (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','transferencia')),
  status TEXT DEFAULT 'confirmado',
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  conta_bancaria_id INT REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
  fornecedor_id INT REFERENCES fornecedores(id) ON DELETE SET NULL,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. Vendas
CREATE TABLE IF NOT EXISTS vendas (
  id SERIAL PRIMARY KEY,
  codigo TEXT,
  data DATE NOT NULL,
  cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  observacao TEXT,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 14. contas_a_pagar (alias de compatibilidade)
CREATE TABLE IF NOT EXISTS contas_a_pagar (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  status TEXT DEFAULT 'pendente',
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. mapping_rules (já com todas as colunas extras da migration 006 e 008)
CREATE TABLE IF NOT EXISTS mapping_rules (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  fornecedor_id INT REFERENCES fornecedores(id) ON DELETE SET NULL,
  cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
  conta_bancaria_id INT REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  cliente_fornecedor TEXT NOT NULL DEFAULT '',
  descricao TEXT DEFAULT '',
  substituir_descricao BOOLEAN DEFAULT FALSE,
  forma_pagamento TEXT DEFAULT '',
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE tenant_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias_filhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_fixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_a_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_rules ENABLE ROW LEVEL SECURITY;

-- Policies abertas (público)
DO $$ BEGIN
  CREATE POLICY "allow_all_tenant_clientes" ON tenant_clientes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_clientes_admin" ON clientes_admin FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_categorias" ON categorias FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_subcategorias" ON subcategorias FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_subcategorias_filhos" ON subcategorias_filhos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_contas_bancarias" ON contas_bancarias FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_despesas_fixas" ON despesas_fixas FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_contas_pagar" ON contas_pagar FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_contas_receber" ON contas_receber FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_lancamentos" ON lancamentos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_vendas" ON vendas FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_contas_a_pagar" ON contas_a_pagar FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_mapping_rules" ON mapping_rules FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recarrega schema do PostgREST
NOTIFY pgrst, 'reload schema';
