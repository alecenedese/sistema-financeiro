-- Tabela de Vendas
-- Campos conforme planilha: Codigo, Cliente, Valor Total, Acrescimo, Taxas Marketplace, Desconto, Valor Recebido, Forma Pagamento, Canal, Data

CREATE TABLE IF NOT EXISTS vendas (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
  codigo VARCHAR(50),
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome VARCHAR(255),
  valor_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  acrescimo DECIMAL(15,2) DEFAULT 0,
  taxas_marketplace DECIMAL(15,2) DEFAULT 0,
  desconto DECIMAL(15,2) DEFAULT 0,
  valor_recebido DECIMAL(15,2) DEFAULT 0,
  forma_pagamento VARCHAR(100),
  canal VARCHAR(100),
  data_venda TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_vendas_tenant ON vendas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_canal ON vendas(canal);

-- RLS
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

-- Policy para usuarios autenticados
CREATE POLICY "vendas_tenant_isolation" ON vendas
  FOR ALL USING (true);
