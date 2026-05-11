#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = 'sb_publishable_hBgxHWZ_eAC-PwSSDas3-A_En1cxvWa' // Anon key

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
  
  // NOVO FILTRO: usando lt com primeiro dia do próximo mês
  const dateFrom = '2026-04-01T00:00:00'
  const dateTo = '2026-05-01T00:00:00' // Primeiro dia de maio
  
  console.log('🔍 Testando NOVO filtro (lt)...')
  console.log(`   tid: ${tid}`)
  console.log(`   dateFrom: ${dateFrom}`)
  console.log(`   dateTo: ${dateTo} (usando lt)`)
  console.log('')
  
  const allRows = await fetchAll(() => {
    let q = supabase
      .from("vendas")
      .select(`*, clientes(nome)`)
      .order("data_venda", { ascending: false })
    
    if (tid) q = q.eq("tenant_id", tid)
    if (dateFrom) q = q.gte("data_venda", dateFrom)
    if (dateTo) {
      q = q.lt("data_venda", dateTo) // USANDO LT
      console.log('[fetchVendas] Usando lt:', dateTo)
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
  
  console.log('✅ Valores esperados:')
  console.log('   Total Vendas: 332658.80')
  console.log('   Total Recebido: 326740.50')
  console.log('   Total Taxas: 4150.94')
  console.log('   Total Desconto: 5918.30')
  console.log('')
  
  const diferencaTotal = Math.abs(total - 332658.80)
  if (diferencaTotal < 0.01) {
    console.log('✅ SUCESSO! Valores corretos!')
  } else {
    console.log(`❌ ERRO! Diferença de R$ ${diferencaTotal.toFixed(2)}`)
  }
}

main()
