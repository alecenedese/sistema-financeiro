-- Ajustes no schema do NOVO Supabase para acomodar dados do antigo.
-- Rodar no SQL Editor do novo projeto ANTES de re-rodar a migração.

-- Limpar dados parciais da primeira tentativa (respeita FKs com CASCADE)
TRUNCATE TABLE
  mapping_rules,
  vendas,
  contas_a_pagar,
  lancamentos,
  contas_receber,
  contas_pagar,
  despesas_fixas,
  contas_bancarias,
  fornecedores,
  clientes,
  subcategorias_filhos,
  subcategorias,
  categorias,
  clientes_admin,
  tenant_clientes
RESTART IDENTITY CASCADE;

-- clientes_admin: colunas extras usadas no app
ALTER TABLE clientes_admin ADD COLUMN IF NOT EXISTS responsavel TEXT;
ALTER TABLE clientes_admin ADD COLUMN IF NOT EXISTS plano TEXT;
ALTER TABLE clientes_admin ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE clientes_admin ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- clientes / fornecedores
ALTER TABLE clientes    ADD COLUMN IF NOT EXISTS documento TEXT;
ALTER TABLE clientes    ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS documento TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT;

-- contas_bancarias
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS cor TEXT;
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS entradas NUMERIC(12,2) DEFAULT 0;
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS saidas   NUMERIC(12,2) DEFAULT 0;

-- despesas_fixas
ALTER TABLE despesas_fixas ADD COLUMN IF NOT EXISTS tipo_recorrencia TEXT;
ALTER TABLE despesas_fixas ADD COLUMN IF NOT EXISTS dia_vencimento INT;
ALTER TABLE despesas_fixas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- vendas: schema do antigo é completamente diferente; recriar
DROP TABLE IF EXISTS vendas CASCADE;
CREATE TABLE vendas (
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenant_clientes(id) ON DELETE CASCADE,
  codigo TEXT,
  cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  acrescimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxas_marketplace NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_recebido NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  canal TEXT,
  data_venda TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "allow_all_vendas" ON vendas FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
