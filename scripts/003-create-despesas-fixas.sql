-- Cria tabela de despesas fixas com controle de parcelas
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
  tenant_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Adiciona colunas de parcela em contas_pagar
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS parcela_atual INT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS total_parcelas INT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS despesa_fixa_id INT REFERENCES despesas_fixas(id) ON DELETE SET NULL;
