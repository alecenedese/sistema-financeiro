-- Adiciona forma_pagamento em contas_pagar e contas_receber
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
