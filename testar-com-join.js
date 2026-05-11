#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseAnonKey = 'sb_publishable_hBgxHWZ_eAC-PwSSDas3-A_En1cxvWa'

async function fetchAllVendas(supabase, tid, dateFrom, dateTo, comJoin) {
  const PAGE_SIZE = 1000
  let allRows = []
  let offset = 0

  while (true) {
    let query = supabase
      .from("vendas")
    
    if (comJoin) {
      query = query.select('*, clientes(nome)')
    } else {
      query = query.select('*')
    }
    
    query = query
      .eq("tenant_id", tid)
      .gte("data_venda", dateFrom)
      .lt("data_venda", dateTo)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    
    const { data, error } = await query
    
    if (error) {
      console.error('Erro:', error)
      break
    }
    
    if (!data || data.length === 0) break
    
    allRows = allRows.concat(data)
    
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  
  return allRows
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const tid = 6
  const dateFrom = '2026-04-01T00:00:00'
  const dateTo = '2026-05-01T00:00:00'
  
  console.log('🔍 Testando com e sem JOIN...\n')
  
  // Sem JOIN
  console.log('📊 Buscando SEM join...')
  const vendasSemJoin = await fetchAllVendas(supabase, tid, dateFrom, dateTo, false)
  const totalSemJoin = vendasSemJoin.reduce((sum, v) => sum + Number(v.valor_total), 0)
  console.log(`   Total: ${vendasSemJoin.length} vendas`)
  console.log(`   Soma: R$ ${totalSemJoin.toFixed(2)}`)
  console.log('')
  
  // Com JOIN
  console.log('📊 Buscando COM join clientes...')
  const vendasComJoin = await fetchAllVendas(supabase, tid, dateFrom, dateTo, true)
  const totalComJoin = vendasComJoin.reduce((sum, v) => sum + Number(v.valor_total), 0)
  console.log(`   Total: ${vendasComJoin.length} vendas`)
  console.log(`   Soma: R$ ${totalComJoin.toFixed(2)}`)
  console.log('')
  
  console.log('📊 Diferença:', (totalComJoin - totalSemJoin).toFixed(2))
  console.log('')
  
  if (vendasComJoin.length !== vendasSemJoin.length) {
    console.log(`⚠️  JOIN está retornando ${vendasComJoin.length - vendasSemJoin.length} vendas a mais!`)
    console.log('   Isso indica que há vendas duplicadas devido ao JOIN.')
    console.log('')
    
    // Encontrar IDs duplicados
    const idsComJoin = vendasComJoin.map(v => v.id)
    const idsSemJoin = vendasSemJoin.map(v => v.id)
    
    const contadorIds = {}
    idsComJoin.forEach(id => {
      contadorIds[id] = (contadorIds[id] || 0) + 1
    })
    
    const duplicados = Object.entries(contadorIds).filter(([id, count]) => count > 1)
    
    if (duplicados.length > 0) {
      console.log(`⚠️  ${duplicados.length} IDs duplicados no resultado com JOIN:`)
      duplicados.slice(0, 10).forEach(([id, count]) => {
        const venda = vendasComJoin.find(v => v.id === Number(id))
        console.log(`  ID: ${id} (${count}x), Código: ${venda?.codigo}, Valor: R$ ${Number(venda?.valor_total).toFixed(2)}`)
      })
      
      const totalDuplicados = duplicados.reduce((sum, [id, count]) => {
        const venda = vendasComJoin.find(v => v.id === Number(id))
        return sum + (Number(venda?.valor_total) * (count - 1))
      }, 0)
      console.log(`  Total valor duplicado: R$ ${totalDuplicados.toFixed(2)}`)
    }
  } else {
    console.log('✅ Mesmo número de vendas, mas valores diferentes.')
    console.log('   Possível problema de precisão numérica.')
  }
}

main()
