-- Adiciona coluna cnpj em clientes e fornecedores
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS cnpj TEXT;
