-- Adicionar novas colunas na tabela mapping_rules
ALTER TABLE mapping_rules 
  ADD COLUMN IF NOT EXISTS fornecedor_id INTEGER REFERENCES fornecedores(id),
  ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id),
  ADD COLUMN IF NOT EXISTS conta_bancaria_id INTEGER REFERENCES contas_bancarias(id),
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS substituir_descricao BOOLEAN DEFAULT FALSE;
