# Debug: Erro 409 em Contas Bancárias

## Problema
Erro 409 (Conflict) ao tentar criar/atualizar contas bancárias.

## Possíveis Causas

1. **Constraint única em nome+tenant_id**: Pode haver uma constraint única que impede contas com o mesmo nome para o mesmo tenant.

2. **Trigger que causa conflito**: Algum trigger pode estar tentando inserir dados duplicados.

3. **Campos obrigatórios faltando**: Algum campo NOT NULL pode estar faltando no payload.

## Soluções Implementadas

### 1. Melhor tratamento de erros
- Adicionado console.log detalhado com todos os detalhes do erro
- Adicionado alert com mensagem de erro completa

### 2. Campos adicionais no payload
- Adicionado `entradas: 0` e `saidas: 0`
- Garantido que `agencia` e `conta` não sejam undefined

### 3. Script de correção
Execute o script `scripts/009-fix-contas-bancarias.sql` no Supabase para:
- Adicionar colunas faltantes
- Remover constraint única se existir
- Verificar duplicatas

## Como Testar

1. Abra o console do navegador (F12)
2. Tente criar uma nova conta bancária
3. Verifique o erro detalhado no console
4. O erro deve mostrar:
   - message: mensagem do erro
   - details: detalhes técnicos
   - hint: dica de solução
   - code: código do erro
   - payload: dados que foram enviados

## Próximos Passos

Se o erro persistir:
1. Execute o script de verificação: `check-constraints.sql`
2. Execute o script de correção: `scripts/009-fix-contas-bancarias.sql`
3. Verifique se há triggers ou funções que possam estar causando o conflito
4. Verifique se há políticas RLS que estejam bloqueando a inserção
