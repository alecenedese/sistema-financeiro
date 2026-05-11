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

  if (!tenant) return

  // Buscar todas as vendas de abril com paginação
  let allVendas = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const { data: vendas } = await supabase
      .from('vendas')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('data_venda', '2026-04-01')
      .lt('data_venda', '2026-05-01')
      .order('valor_total', { ascending: false })
      .range(offset, offset + PAGE - 1)

    if (!vendas || vendas.length === 0) break
    
    allVendas = allVendas.concat(vendas)
    
    if (vendas.length < PAGE) break
    offset += PAGE
  }

  console.log('📊 Total de vendas:', allVendas.length)
  console.log('')

  // Calcular totais
  const totalVendas = allVendas.reduce((sum, v) => sum + Number(v.valor_total), 0)
  const totalRecebido = allVendas.reduce((sum, v) => sum + Number(v.valor_recebido), 0)
  const totalTaxas = allVendas.reduce((sum, v) => sum + Number(v.taxas_marketplace), 0)
  const totalDesconto = allVendas.reduce((sum, v) => sum + Number(v.desconto), 0)

  console.log('💰 Total Vendas:', totalVendas.toFixed(2))
  console.log('💵 Total Recebido:', totalRecebido.toFixed(2))
  console.log('📉 Total Taxas:', totalTaxas.toFixed(2))
  console.log('🎁 Total Desconto:', totalDesconto.toFixed(2))
  console.log('')

  // Mostrar as 10 maiores vendas
  console.log('🔝 Top 10 maiores vendas:')
  allVendas.slice(0, 10).forEach((v, i) => {
    console.log(`${i + 1}. ${v.codigo || '(sem código)'} - R$ ${Number(v.valor_total).toFixed(2)} - ${v.cliente_nome}`)
  })
  console.log('')

  // Verificar vendas com valores zerados ou negativos
  const problemáticas = allVendas.filter(v => 
    Number(v.valor_total) <= 0 || 
    Number(v.valor_recebido) < 0 ||
    isNaN(Number(v.valor_total))
  )

  if (problemáticas.length > 0) {
    console.log('⚠️  Vendas com valores problemáticos:')
    problemáticas.forEach(v => {
      console.log(`  ${v.codigo || '(sem código)'} - Total: ${v.valor_total} - Recebido: ${v.valor_recebido}`)
    })
  } else {
    console.log('✅ Nenhuma venda com valor problemático')
  }
}

main()
