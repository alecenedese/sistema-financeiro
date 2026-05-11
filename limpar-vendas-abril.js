#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🔍 Verificando vendas de abril/2026...\n')

  // Buscar vendas de abril agrupadas por cliente
  const { data: vendas, error } = await supabase
    .from('vendas')
    .select(`
      id,
      data_venda,
      valor_total,
      tenant_id,
      tenant_clientes (
        nome,
        cnpj
      )
    `)
    .gte('data_venda', '2026-04-01')
    .lt('data_venda', '2026-05-01')

  if (error) {
    console.error('❌ Erro ao buscar vendas:', error)
    return
  }

  if (!vendas || vendas.length === 0) {
    console.log('ℹ️  Nenhuma venda encontrada em abril/2026')
    return
  }

  // Agrupar por cliente
  const porCliente = {}
  vendas.forEach(v => {
    const tenantId = v.tenant_id
    const tenantNome = v.tenant_clientes?.nome || 'Sem cliente'
    const tenantCnpj = v.tenant_clientes?.cnpj || 'Sem CNPJ'
    
    if (!porCliente[tenantId]) {
      porCliente[tenantId] = {
        nome: tenantNome,
        cnpj: tenantCnpj,
        total: 0,
        valor: 0,
        ids: []
      }
    }
    
    porCliente[tenantId].total++
    porCliente[tenantId].valor += Number(v.valor_total || 0)
    porCliente[tenantId].ids.push(v.id)
  })

  console.log('📊 Vendas de abril/2026 por cliente:\n')
  Object.entries(porCliente).forEach(([tenantId, info]) => {
    console.log(`Cliente: ${info.nome}`)
    console.log(`CNPJ: ${info.cnpj}`)
    console.log(`Total de vendas: ${info.total}`)
    console.log(`Valor total: R$ ${info.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    console.log('─'.repeat(60))
  })

  console.log(`\n📈 TOTAL GERAL: ${vendas.length} vendas\n`)

  // Perguntar qual cliente deletar
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('💡 Para deletar vendas de um cliente específico:')
    console.log('   node limpar-vendas-abril.js CNPJ_DO_CLIENTE')
    console.log('\n💡 Para deletar TODAS as vendas de abril:')
    console.log('   node limpar-vendas-abril.js --all')
    return
  }

  if (args[0] === '--all') {
    console.log('⚠️  ATENÇÃO: Deletando TODAS as vendas de abril/2026...')
    
    const { error: deleteError } = await supabase
      .from('vendas')
      .delete()
      .gte('data_venda', '2026-04-01')
      .lt('data_venda', '2026-05-01')

    if (deleteError) {
      console.error('❌ Erro ao deletar:', deleteError)
      return
    }

    console.log(`✅ ${vendas.length} vendas deletadas com sucesso!`)
    return
  }

  // Deletar por CNPJ
  const cnpj = args[0]
  const clienteInfo = Object.values(porCliente).find(c => c.cnpj === cnpj)

  if (!clienteInfo) {
    console.log(`❌ Cliente com CNPJ ${cnpj} não encontrado`)
    return
  }

  console.log(`⚠️  Deletando ${clienteInfo.total} vendas do cliente ${clienteInfo.nome}...`)

  const { error: deleteError } = await supabase
    .from('vendas')
    .delete()
    .in('id', clienteInfo.ids)

  if (deleteError) {
    console.error('❌ Erro ao deletar:', deleteError)
    return
  }

  console.log(`✅ ${clienteInfo.total} vendas deletadas com sucesso!`)
}

main().catch(console.error)
