-- Adicionar coluna origem na tabela mapping_rules para separar regras OFX de planilha
ALTER TABLE mapping_rules ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'ofx';
-- Valores: 'ofx' para regras criadas ao importar OFX, 'planilha' para regras de planilha
