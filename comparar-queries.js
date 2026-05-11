#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function fetchAll(queryFn) {
  const PAGE_SIZE = 1000
  let allRows = []
  let offset = 0

  while (true) {
    const { data, error } = await queryFn(offset, PAGE_SIZE)
    
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
  const tid = 6
  
  console.log('🔍 Comparando queries lte vs lt...\n')
  
  // Query 1: lte (como front-end)
  const vendasLte = await fetchAll(async (offset, pageSize) => {
    return await supabase
      .from("vendas")
      .select('*')
      .eq("tenant_id", tid)
      .gte("data_venda", '2026-04-01T00:00:00')
      .lte("data_venda", '2026-04-30T23:59:59')
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)
  })
  
  // Query 2: lt (como script correto)
  const vendasLt = await fetchAll(async (offset, pageSize) => {
    return await supabase
      .from("vendas")
      .select('*')
      .eq("tenant_id", tid)
      .gte("data_venda", '2026-04-01')
      .lt("data_venda", '2026-05-01')
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)
  })
  
  console.log('📊 Vendas com lte:', vendasLte.length)
  console.log('📊 Vendas com lt:', vendasLt.length)
  console.log('')
  
  const totalLte = vendasLte.reduce((sum, v) => sum + Number(v.valor_total), 0)
  const totalLt = vendasLt.reduce((sum, v) => sum + Number(v.valor_total), 0)
  
  console.log('💰 Total lte:', totalLte.toFixed(2))
  console.log('💰 Total lt:', totalLt.toFixed(2))
  console.log('📊 Diferença:', (totalLte - totalLt).toFixed(2))
  console.log('')
  
  // Criar mapas por ID
  const mapLte = new Map(vendasLte.map(v => [v.id, v]))
  const mapLt = new Map(vendasLt.map(v => [v.id, v]))
  
  // Encontrar IDs diferentes
  const idsLte = new Set(vendasLte.map(v => v.id))
  const idsLt = new Set(vendasLt.map(v => v.id))
  
  const apenasLte = vendasLte.filter(v => !idsLt.has(v.id))
  const apenasLt = vendasLt.filter(v => !idsLte.has(v.id))
  
  if (apenasLte.length > 0) {
    console.log(`⚠️  ${apenasLte.length} vendas APENAS em lte:`)
    apenasLte.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    const totalApenasLte = apenasLte.reduce((sum, v) => sum + Number(v.valor_total), 0)
    console.log(`  Total: R$ ${totalApenasLte.toFixed(2)}`)
    console.log('')
  }
  
  if (apenasLt.length > 0) {
    console.log(`⚠️  ${apenasLt.length} vendas APENAS em lt:`)
    apenasLt.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    const totalApenasLt = apenasLt.reduce((sum, v) => sum + Number(v.valor_total), 0)
    console.log(`  Total: R$ ${totalApenasLt.toFixed(2)}`)
    console.log('')
  }
  
  // Verificar se há vendas com valores diferentes
  const comValoresDiferentes = []
  for (const [id, vendaLte] of mapLte) {
    const vendaLt = mapLt.get(id)
    if (vendaLt && Number(vendaLte.valor_total) !== Number(vendaLt.valor_total)) {
      comValoresDiferentes.push({
        id,
        valorLte: Number(vendaLte.valor_total),
        valorLt: Number(vendaLt.valor_total),
        diferenca: Number(vendaLte.valor_total) - Number(vendaLt.valor_total)
      })
    }
  }
  
  if (comValoresDiferentes.length > 0) {
    console.log(`⚠️  ${comValoresDiferentes.length} vendas com valores diferentes:`)
    comValoresDiferentes.forEach(v => {
      console.log(`  ID: ${v.id}, Valor lte: R$ ${v.valorLte.toFixed(2)}, Valor lt: R$ ${v.valorLt.toFixed(2)}, Diferença: R$ ${v.diferenca.toFixed(2)}`)
    })
  }
  
  if (apenasLte.length === 0 && apenasLt.length === 0 && comValoresDiferentes.length === 0) {
    console.log('🤔 Mesmos IDs, mesmos valores, mas totais diferentes!')
    console.log('   Isso pode indicar um problema de precisão numérica ou cache.')
    console.log('')
    console.log('💡 Solução: Usar lt ao invés de lte para garantir consistência')
  }
}

main()
