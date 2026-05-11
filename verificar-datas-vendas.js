#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: tenant } = await supabase
    .from('tenant_clientes')
    .select('id')
    .eq('cnpj', '41.801.204/0001-09')
    .single()

  if (!tenant) {
    console.log('❌ Tenant não encontrado')
    return
  }

  console.log('🔍 Verificando vendas com filtro lte...\n')

  // Simula o filtro do front-end (lte)
  let allVendasLte = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const { data: vendas } = await supabase
      .from('vendas')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('data_venda', '2026-04-01T00:00:00')
      .lte('data_venda', '2026-04-30T23:59:59')
      .order('data_venda', { ascending: false })
      .range(offset, offset + PAGE - 1)

    if (!vendas || vendas.length === 0) break
    
    allVendasLte = allVendasLte.concat(vendas)
    
    if (vendas.length < PAGE) break
    offset += PAGE
  }

  console.log('📊 Total com lte (2026-04-30T23:59:59):', allVendasLte.length)
  
  const totalLte = allVendasLte.reduce((sum, v) => sum + Number(v.valor_total), 0)
  console.log('💰 Total Vendas (lte):', totalLte.toFixed(2))
  console.log('')

  // Agora com lt (como no script)
  let allVendasLt = []
  offset = 0

  while (true) {
    const { data: vendas } = await supabase
      .from('vendas')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('data_venda', '2026-04-01')
      .lt('data_venda', '2026-05-01')
      .order('data_venda', { ascending: false })
      .range(offset, offset + PAGE - 1)

    if (!vendas || vendas.length === 0) break
    
    allVendasLt = allVendasLt.concat(vendas)
    
    if (vendas.length < PAGE) break
    offset += PAGE
  }

  console.log('📊 Total com lt (2026-05-01):', allVendasLt.length)
  
  const totalLt = allVendasLt.reduce((sum, v) => sum + Number(v.valor_total), 0)
  console.log('💰 Total Vendas (lt):', totalLt.toFixed(2))
  console.log('')

  // Encontrar diferenças
  const idsLte = new Set(allVendasLte.map(v => v.id))
  const idsLt = new Set(allVendasLt.map(v => v.id))

  const apenasLte = allVendasLte.filter(v => !idsLt.has(v.id))
  const apenasLt = allVendasLt.filter(v => !idsLte.has(v.id))

  if (apenasLte.length > 0) {
    console.log('⚠️  Vendas que aparecem com lte mas NÃO com lt:')
    apenasLte.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    console.log('')
  }

  if (apenasLt.length > 0) {
    console.log('⚠️  Vendas que aparecem com lt mas NÃO com lte:')
    apenasLt.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    console.log('')
  }

  // Verificar vendas fora de abril
  const { data: vendasForaAbril } = await supabase
    .from('vendas')
    .select('*')
    .eq('tenant_id', tenant.id)
    .or('data_venda.lt.2026-04-01,data_venda.gte.2026-05-01')
    .order('data_venda', { ascending: false })

  if (vendasForaAbril && vendasForaAbril.length > 0) {
    console.log(`⚠️  ${vendasForaAbril.length} vendas FORA de abril encontradas:`)
    vendasForaAbril.slice(0, 10).forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    
    const totalFora = vendasForaAbril.reduce((sum, v) => sum + Number(v.valor_total), 0)
    console.log(`  Total fora de abril: R$ ${totalFora.toFixed(2)}`)
  } else {
    console.log('✅ Nenhuma venda fora de abril')
  }
}

main()
