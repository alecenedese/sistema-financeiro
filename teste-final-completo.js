#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseAnonKey = 'sb_publishable_hBgxHWZ_eAC-PwSSDas3-A_En1cxvWa'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function fetchAll(queryBuilder) {
  const PAGE_SIZE = 1000
  let allRows = []
  let offset = 0

  while (true) {
    const query = queryBuilder()
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)
    
    if (error) {
      console.error('❌ Erro:', error)
      break
    }
    
    if (!data || data.length === 0) break
    
    allRows = allRows.concat(data)
    
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  
  return allRows
}

async function testFiltro(nome, tid, dateFrom, dateTo, useLt) {
  console.log(`\n🔍 Teste: ${nome}`)
  console.log(`   Filtro: gte('${dateFrom}') + ${useLt ? 'lt' : 'lte'}('${dateTo}')`)
  
  const allRows = await fetchAll(() => {
    let q = supabase
      .from("vendas")
      .select(`*, clientes(nome)`)
      .order("data_venda", { ascending: false })
    
    if (tid) q = q.eq("tenant_id", tid)
    if (dateFrom) q = q.gte("data_venda", dateFrom)
    if (dateTo) {
      if (useLt) {
        q = q.lt("data_venda", dateTo)
      } else {
        q = q.lte("data_venda", dateTo)
      }
    }
    
    return q
  })
  
  const total = allRows.reduce((sum, v) => sum + Number(v.valor_total), 0)
  const recebido = allRows.reduce((sum, v) => sum + Number(v.valor_recebido), 0)
  
  console.log(`   📊 Registros: ${allRows.length}`)
  console.log(`   💰 Total: R$ ${total.toFixed(2)}`)
  console.log(`   💵 Recebido: R$ ${recebido.toFixed(2)}`)
  
  const correto = Math.abs(total - 332658.80) < 0.01
  console.log(`   ${correto ? '✅ CORRETO!' : '❌ ERRADO!'}`)
  
  return { total, recebido, count: allRows.length, correto }
}

async function main() {
  const tid = 6
  
  console.log('═══════════════════════════════════════════════════════')
  console.log('  TESTE COMPLETO - FILTROS DE DATA')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n📅 Período: Abril 2026')
  console.log('🎯 Valor esperado: R$ 332.658,80 (4255 vendas)')
  console.log('')
  
  // Teste 1: lte com 23:59:59 (ANTIGO - ERRADO)
  await testFiltro(
    'ANTIGO (lte com 23:59:59)',
    tid,
    '2026-04-01T00:00:00',
    '2026-04-30T23:59:59',
    false
  )
  
  // Teste 2: lt com próximo dia (NOVO - CORRETO)
  await testFiltro(
    'NOVO (lt com próximo dia)',
    tid,
    '2026-04-01T00:00:00',
    '2026-05-01T00:00:00',
    true
  )
  
  // Teste 3: lt sem hora (alternativa)
  await testFiltro(
    'ALTERNATIVA (lt sem hora)',
    tid,
    '2026-04-01',
    '2026-05-01',
    true
  )
  
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  CONCLUSÃO')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n✅ O filtro CORRETO é: lt com próximo dia')
  console.log('   gte("2026-04-01T00:00:00") + lt("2026-05-01T00:00:00")')
  console.log('\n❌ O filtro ERRADO é: lte com 23:59:59')
  console.log('   gte("2026-04-01T00:00:00") + lte("2026-04-30T23:59:59")')
  console.log('\n📝 Se o navegador ainda mostra valor errado:')
  console.log('   1. Limpe o cache: Ctrl+Shift+Delete')
  console.log('   2. Ou acesse: https://app.majobpo.com/vendas?v=4')
  console.log('   3. Ou use modo anônimo')
  console.log('')
}

main()
