-- Reajusta sequences após a migração preservando IDs originais.
-- Rodar UMA VEZ no SQL Editor do novo Supabase APÓS a migração.

SELECT setval(pg_get_serial_sequence('tenant_clientes','id'),      COALESCE((SELECT MAX(id) FROM tenant_clientes), 1));
SELECT setval(pg_get_serial_sequence('clientes_admin','id'),       COALESCE((SELECT MAX(id) FROM clientes_admin), 1));
SELECT setval(pg_get_serial_sequence('categorias','id'),           COALESCE((SELECT MAX(id) FROM categorias), 1));
SELECT setval(pg_get_serial_sequence('subcategorias','id'),        COALESCE((SELECT MAX(id) FROM subcategorias), 1));
SELECT setval(pg_get_serial_sequence('subcategorias_filhos','id'), COALESCE((SELECT MAX(id) FROM subcategorias_filhos), 1));
SELECT setval(pg_get_serial_sequence('clientes','id'),             COALESCE((SELECT MAX(id) FROM clientes), 1));
SELECT setval(pg_get_serial_sequence('fornecedores','id'),         COALESCE((SELECT MAX(id) FROM fornecedores), 1));
SELECT setval(pg_get_serial_sequence('contas_bancarias','id'),     COALESCE((SELECT MAX(id) FROM contas_bancarias), 1));
SELECT setval(pg_get_serial_sequence('despesas_fixas','id'),       COALESCE((SELECT MAX(id) FROM despesas_fixas), 1));
SELECT setval(pg_get_serial_sequence('contas_pagar','id'),         COALESCE((SELECT MAX(id) FROM contas_pagar), 1));
SELECT setval(pg_get_serial_sequence('contas_receber','id'),       COALESCE((SELECT MAX(id) FROM contas_receber), 1));
SELECT setval(pg_get_serial_sequence('lancamentos','id'),          COALESCE((SELECT MAX(id) FROM lancamentos), 1));
SELECT setval(pg_get_serial_sequence('vendas','id'),               COALESCE((SELECT MAX(id) FROM vendas), 1));
SELECT setval(pg_get_serial_sequence('contas_a_pagar','id'),       COALESCE((SELECT MAX(id) FROM contas_a_pagar), 1));
SELECT setval(pg_get_serial_sequence('mapping_rules','id'),        COALESCE((SELECT MAX(id) FROM mapping_rules), 1));
