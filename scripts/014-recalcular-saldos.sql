-- Recalcula o saldo de todas as contas bancárias
-- saldo = saldo_inicial + SUM(receitas recebidas) - SUM(despesas pagas) + SUM(lancamentos receita) - SUM(lancamentos despesa)
-- Resolve saldos incorretos causados pelo bug de limite de 1000 linhas do Supabase

UPDATE contas_bancarias c
SET saldo = COALESCE(c.saldo_inicial, 0)
  + COALESCE(r.total_rec, 0)
  - COALESCE(p.total_pag, 0)
  + COALESCE(l.total_rec_lanc, 0)
  - COALESCE(l.total_pag_lanc, 0)
FROM (
  SELECT conta_bancaria_id, SUM(valor) AS total_rec
  FROM contas_receber
  WHERE status = 'recebido'
  GROUP BY conta_bancaria_id
) r,
(
  SELECT conta_bancaria_id, SUM(valor) AS total_pag
  FROM contas_pagar
  WHERE status = 'pago'
  GROUP BY conta_bancaria_id
) p,
(
  SELECT conta_bancaria_id,
    SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS total_rec_lanc,
    SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS total_pag_lanc
  FROM lancamentos
  GROUP BY conta_bancaria_id
) l
WHERE c.id = r.conta_bancaria_id
  AND c.id = p.conta_bancaria_id
  AND c.id = l.conta_bancaria_id;

-- Contas que só têm receitas (sem pagamentos nem lançamentos)
UPDATE contas_bancarias c
SET saldo = COALESCE(c.saldo_inicial, 0) + COALESCE(r.total_rec, 0)
FROM (
  SELECT conta_bancaria_id, SUM(valor) AS total_rec
  FROM contas_receber
  WHERE status = 'recebido'
  GROUP BY conta_bancaria_id
) r
WHERE c.id = r.conta_bancaria_id
  AND NOT EXISTS (SELECT 1 FROM contas_pagar p WHERE p.conta_bancaria_id = c.id AND p.status = 'pago')
  AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.conta_bancaria_id = c.id);

-- Contas que só têm pagamentos (sem receitas nem lançamentos)
UPDATE contas_bancarias c
SET saldo = COALESCE(c.saldo_inicial, 0) - COALESCE(p.total_pag, 0)
FROM (
  SELECT conta_bancaria_id, SUM(valor) AS total_pag
  FROM contas_pagar
  WHERE status = 'pago'
  GROUP BY conta_bancaria_id
) p
WHERE c.id = p.conta_bancaria_id
  AND NOT EXISTS (SELECT 1 FROM contas_receber r WHERE r.conta_bancaria_id = c.id AND r.status = 'recebido')
  AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.conta_bancaria_id = c.id);

-- Contas sem nenhuma transação
UPDATE contas_bancarias c
SET saldo = COALESCE(c.saldo_inicial, 0)
WHERE NOT EXISTS (SELECT 1 FROM contas_receber r WHERE r.conta_bancaria_id = c.id AND r.status = 'recebido')
  AND NOT EXISTS (SELECT 1 FROM contas_pagar p WHERE p.conta_bancaria_id = c.id AND p.status = 'pago')
  AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.conta_bancaria_id = c.id);
