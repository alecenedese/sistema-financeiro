#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = 'sb_publishable_hBgxHWZ_eAC-PwSSDas3-A_En1cxvWa' // Anon key (público)

const supabase = createClient(supabaseUrl, supabaseKey)

async function fetchAll(queryBuilder) {
  const PAGE_SIZE = 1000
  let allRows = []
  let offset = 0

  while (true) {
    const query = queryBuilder()
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)
    
    if (error) {
      console.error('Erro:', error)
      break
    }
    
    if (!data || data.length === 0) break
    
    allRows = allRows.concat(data)
    console.log(`[fetchAll] Iteração ${Math.floor(offset / PAGE_SIZE) + 1}: buscando offset ${offset}, recebidos ${data.length}`)
    
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  
  return allRows
}

async function main() {
  const tid = 6 // Space Burguer tenant ID
  
  // Simular exatamente o que o front-end faz
  const dateFrom = '2026-04-01T00:00:00'
  const dateTo = '2026-04-30T23:59:59'
  
  console.log('🔍 Testando filtro do front-end...')
  console.log(`   tid: ${tid}`)
  console.log(`   dateFrom: ${dateFrom}`)
  console.log(`   dateTo: ${dateTo}`)
  console.log('')
  
  const allRows = await fetchAll(() => {
    let q = supabase
      .from("vendas")
      .select(`*, clientes(nome)`)
      .order("data_venda", { ascending: false })
    
    if (tid) q = q.eq("tenant_id", tid)
    if (dateFrom) q = q.gte("data_venda", dateFrom)
    if (dateTo) {
      q = q.lte("data_venda", dateTo)
      console.log('[fetchVendas] Usando lte:', dateTo)
    }
    
    return q
  })
  
  console.log('')
  console.log('📊 Total de registros:', allRows.length)
  
  const total = allRows.reduce((sum, v) => sum + Number(v.valor_total), 0)
  const recebido = allRows.reduce((sum, v) => sum + Number(v.valor_recebido), 0)
  const taxas = allRows.reduce((sum, v) => sum + Number(v.taxas_marketplace), 0)
  const desconto = allRows.reduce((sum, v) => sum + Number(v.desconto), 0)
  
  console.log('💰 Total Vendas:', total.toFixed(2))
  console.log('💵 Total Recebido:', recebido.toFixed(2))
  console.log('📉 Total Taxas:', taxas.toFixed(2))
  console.log('🎁 Total Desconto:', desconto.toFixed(2))
  console.log('')
  
  // Verificar se há vendas fora de abril
  const foraAbril = allRows.filter(v => {
    const data = new Date(v.data_venda)
    return data.getMonth() !== 3 // 3 = abril (0-indexed)
  })
  
  if (foraAbril.length > 0) {
    console.log(`⚠️  ${foraAbril.length} vendas FORA de abril:`)
    foraAbril.slice(0, 10).forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    
    const totalFora = foraAbril.reduce((sum, v) => sum + Number(v.valor_total), 0)
    console.log(`  Total fora de abril: R$ ${totalFora.toFixed(2)}`)
  } else {
    console.log('✅ Todas as vendas são de abril')
  }
}

main()
