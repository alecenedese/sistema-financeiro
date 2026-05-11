-- Verificar constraints e índices únicos na tabela contas_bancarias
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'contas_bancarias'::regclass;

-- Verificar índices únicos
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'contas_bancarias'
  AND indexdef LIKE '%UNIQUE%';

-- Verificar se há duplicatas de nomes de contas por tenant
SELECT 
    nome,
    tenant_id,
    COUNT(*) as count
FROM contas_bancarias
GROUP BY nome, tenant_id
HAVING COUNT(*) > 1;
