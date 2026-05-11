-- Tabela para salvar análises automáticas do DRE
CREATE TABLE IF NOT EXISTS public.dre_analises (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES public.tenants(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,

  -- Valores do DRE
  receita_bruta DECIMAL(15,2) DEFAULT 0,
  deducoes_receita DECIMAL(15,2) DEFAULT 0,
  receita_liquida DECIMAL(15,2) DEFAULT 0,
  custo_direto DECIMAL(15,2) DEFAULT 0,
  lucro_bruto DECIMAL(15,2) DEFAULT 0,
  perc_lucro_bruto DECIMAL(5,2) DEFAULT 0,
  recebimentos_mes DECIMAL(15,2) DEFAULT 0,
  despesas_operacionais DECIMAL(15,2) DEFAULT 0,
  receitas_despesas_financeiras DECIMAL(15,2) DEFAULT 0,
  lucro_liquido DECIMAL(15,2) DEFAULT 0,
  perc_lucro_liquido DECIMAL(5,2) DEFAULT 0,
  retiradas_caixa DECIMAL(15,2) DEFAULT 0,
  resultado_financeiro DECIMAL(15,2) DEFAULT 0,
  perc_resultado_financeiro DECIMAL(5,2) DEFAULT 0,

  -- Análise estratégica (JSON para flexibilidade)
  analise_estrategica JSONB DEFAULT '{}',

  -- Status e alertas
  status_margem VARCHAR(20) DEFAULT 'neutro', -- 'saudavel', 'atencao', 'critico', 'neutro'
  status_caixa VARCHAR(20) DEFAULT 'neutro',  -- 'positivo', 'negativo', 'neutro'
  alertas JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tenant_id, ano, mes)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dre_analises_tenant ON public.dre_analises(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dre_analises_periodo ON public.dre_analises(ano, mes);
CREATE INDEX IF NOT EXISTS idx_dre_analises_status ON public.dre_analises(status_margem, status_caixa);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_dre_analises_updated_at ON public.dre_analises;
CREATE TRIGGER update_dre_analises_updated_at
  BEFORE UPDATE ON public.dre_analises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS
ALTER TABLE public.dre_analises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dre_analises_tenant_isolation ON public.dre_analises;
CREATE POLICY dre_analises_tenant_isolation ON public.dre_analises
  USING (tenant_id = current_setting('app.current_tenant')::INTEGER);

-- Comentários
COMMENT ON TABLE public.dre_analises IS 'Análises automáticas e insights do DRE Financeiro por período';
COMMENT ON COLUMN public.dre_analises.analise_estrategica IS 'JSON com análise estratégica: margens, saúde financeira, recomendações';
COMMENT ON COLUMN public.dre_analises.alertas IS 'Array de alertas gerados automaticamente';
COMMENT ON COLUMN public.dre_analises.status_margem IS 'Classificação da margem: saudavel (>20%), atencao (10-20%), critico (<10%)';
COMMENT ON COLUMN public.dre_analises.status_caixa IS 'Status do resultado financeiro: positivo, negativo';
