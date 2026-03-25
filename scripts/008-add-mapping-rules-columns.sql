-- Adicionar colunas que faltam na tabela mapping_rules
ALTER TABLE mapping_rules ADD COLUMN IF NOT EXISTS descricao text DEFAULT '';
ALTER TABLE mapping_rules ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT '';
ALTER TABLE mapping_rules ADD COLUMN IF NOT EXISTS substituir_descricao boolean DEFAULT false;
