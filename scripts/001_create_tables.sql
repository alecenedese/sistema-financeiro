-- Categorias (nivel 1)
CREATE TABLE IF NOT EXISTS categorias (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
  cor TEXT NOT NULL DEFAULT '#1B3A5C',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subcategorias (nivel 2)
CREATE TABLE IF NOT EXISTS subcategorias (
  id BIGSERIAL PRIMARY KEY,
  categoria_id BIGINT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subcategorias Filhos (nivel 3)
CREATE TABLE IF NOT EXISTS subcategorias_filhos (
  id BIGSERIAL PRIMARY KEY,
  subcategoria_id BIGINT NOT NULL REFERENCES subcategorias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contas a Pagar
CREATE TABLE IF NOT EXISTS contas_pagar (
  id BIGSERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  vencimento DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'pago', 'vencido')) DEFAULT 'pendente',
  fornecedor TEXT NOT NULL DEFAULT '',
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contas a Receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id BIGSERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  vencimento DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'recebido', 'vencido')) DEFAULT 'pendente',
  cliente TEXT NOT NULL DEFAULT '',
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regras de mapeamento OFX
CREATE TABLE IF NOT EXISTS mapping_rules (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id BIGINT REFERENCES subcategorias(id) ON DELETE SET NULL,
  subcategoria_filho_id BIGINT REFERENCES subcategorias_filhos(id) ON DELETE SET NULL,
  cliente_fornecedor TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias_filhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_rules ENABLE ROW LEVEL SECURITY;

-- Open RLS policies (no auth required - public access)
CREATE POLICY "allow_all_categorias" ON categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_subcategorias" ON subcategorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_subcategorias_filhos" ON subcategorias_filhos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_contas_pagar" ON contas_pagar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_contas_receber" ON contas_receber FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_mapping_rules" ON mapping_rules FOR ALL USING (true) WITH CHECK (true);
