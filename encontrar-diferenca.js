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

  console.log('🔍 Buscando todas as vendas de abril...\n')

  // Buscar TODAS as vendas (sem filtro de data) para ver se há duplicatas
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
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (!vendas || vendas.length === 0) break
    
    allVendas = allVendas.concat(vendas)
    
    if (vendas.length < PAGE) break
    offset += PAGE
  }

  console.log('📊 Total de vendas encontradas:', allVendas.length)
  
  // Agrupar por código para encontrar duplicatas
  const porCodigo = {}
  allVendas.forEach(v => {
    const codigo = v.codigo || '(sem código)'
    if (!porCodigo[codigo]) {
      porCodigo[codigo] = []
    }
    porCodigo[codigo].push(v)
  })

  // Encontrar códigos com múltiplas vendas
  const duplicados = Object.entries(porCodigo).filter(([_, vendas]) => vendas.length > 1)
  
  console.log(`\n🔄 Códigos duplicados: ${duplicados.length}`)
  
  // Calcular total
  const total = allVendas.reduce((sum, v) => sum + Number(v.valor_total), 0)
  console.log(`💰 Total calculado: R$ ${total.toFixed(2)}`)
  console.log(`💰 Total esperado: R$ 332658.80`)
  console.log(`📊 Diferença: R$ ${(total - 332658.80).toFixed(2)}`)
  
  // Procurar vendas que somam aproximadamente R$ 43.54
  console.log('\n🔍 Procurando vendas que somam ~R$ 43.54...')
  
  const diferenca = total - 332658.80
  const margem = 0.10 // R$ 0.10 de margem
  
  // Procurar vendas individuais próximas da diferença
  const proximasDiferenca = allVendas.filter(v => {
    const valor = Number(v.valor_total)
    return Math.abs(valor - diferenca) < margem
  })
  
  if (proximasDiferenca.length > 0) {
    console.log('\n⚠️  Vendas com valor próximo da diferença:')
    proximasDiferenca.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
  }
  
  // Procurar pares de vendas duplicadas que somam a diferença
  console.log('\n🔍 Verificando duplicatas que podem causar a diferença...')
  
  for (const [codigo, vendas] of duplicados.slice(0, 20)) {
    if (vendas.length === 2) {
      const valor1 = Number(vendas[0].valor_total)
      const valor2 = Number(vendas[1].valor_total)
      
      if (Math.abs(valor1 - diferenca) < margem || Math.abs(valor2 - diferenca) < margem) {
        console.log(`\n  Código: ${codigo}`)
        vendas.forEach(v => {
          console.log(`    ID: ${v.id}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
        })
      }
    }
  }
  
  // Mostrar algumas duplicatas para análise
  console.log('\n📋 Primeiras 10 duplicatas:')
  duplicados.slice(0, 10).forEach(([codigo, vendas]) => {
    const total = vendas.reduce((sum, v) => sum + Number(v.valor_total), 0)
    console.log(`  Código: ${codigo} (${vendas.length}x) - Total: R$ ${total.toFixed(2)}`)
    vendas.forEach(v => {
      console.log(`    ID: ${v.id}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
  })
}

main()
