#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function fetchAllVendas(supabase, tid, dateFrom, dateTo) {
  const PAGE_SIZE = 1000
  let allRows = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("vendas")
      .select('*')
      .eq("tenant_id", tid)
      .gte("data_venda", dateFrom)
      .lt("data_venda", dateTo)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    
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
  const dateFrom = '2026-04-01T00:00:00'
  const dateTo = '2026-05-01T00:00:00'
  
  console.log('🔍 Comparando vendas com service key vs anon key...\n')
  
  // Buscar com service key (admin)
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey)
  const vendasService = await fetchAllVendas(supabaseService, tid, dateFrom, dateTo)
  
  // Buscar com anon key (público)
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
  const vendasAnon = await fetchAllVendas(supabaseAnon, tid, dateFrom, dateTo)
  
  console.log('📊 Vendas com service key:', vendasService.length)
  console.log('📊 Vendas com anon key:', vendasAnon.length)
  console.log('')
  
  const totalService = vendasService.reduce((sum, v) => sum + Number(v.valor_total), 0)
  const totalAnon = vendasAnon.reduce((sum, v) => sum + Number(v.valor_total), 0)
  
  console.log('💰 Total service key:', totalService.toFixed(2))
  console.log('💰 Total anon key:', totalAnon.toFixed(2))
  console.log('📊 Diferença:', (totalAnon - totalService).toFixed(2))
  console.log('')
  
  // Criar mapas por ID
  const mapService = new Map(vendasService.map(v => [v.id, v]))
  const mapAnon = new Map(vendasAnon.map(v => [v.id, v]))
  
  // Encontrar vendas que aparecem apenas com anon key
  const apenasAnon = vendasAnon.filter(v => !mapService.has(v.id))
  
  if (apenasAnon.length > 0) {
    console.log(`⚠️  ${apenasAnon.length} vendas APENAS com anon key:`)
    apenasAnon.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    const totalApenasAnon = apenasAnon.reduce((sum, v) => sum + Number(v.valor_total), 0)
    console.log(`  Total: R$ ${totalApenasAnon.toFixed(2)}`)
    console.log('')
  }
  
  // Encontrar vendas que aparecem apenas com service key
  const apenasService = vendasService.filter(v => !mapAnon.has(v.id))
  
  if (apenasService.length > 0) {
    console.log(`⚠️  ${apenasService.length} vendas APENAS com service key:`)
    apenasService.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Data: ${v.data_venda}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
    const totalApenasService = apenasService.reduce((sum, v) => sum + Number(v.valor_total), 0)
    console.log(`  Total: R$ ${totalApenasService.toFixed(2)}`)
    console.log('')
  }
  
  // Verificar se há vendas com valores diferentes
  const comValoresDiferentes = []
  for (const [id, vendaService] of mapService) {
    const vendaAnon = mapAnon.get(id)
    if (vendaAnon && Number(vendaService.valor_total) !== Number(vendaAnon.valor_total)) {
      comValoresDiferentes.push({
        id,
        valorService: Number(vendaService.valor_total),
        valorAnon: Number(vendaAnon.valor_total),
        diferenca: Number(vendaAnon.valor_total) - Number(vendaService.valor_total)
      })
    }
  }
  
  if (comValoresDiferentes.length > 0) {
    console.log(`⚠️  ${comValoresDiferentes.length} vendas com valores diferentes:`)
    comValoresDiferentes.forEach(v => {
      console.log(`  ID: ${v.id}, Service: R$ ${v.valorService.toFixed(2)}, Anon: R$ ${v.valorAnon.toFixed(2)}, Diferença: R$ ${v.diferenca.toFixed(2)}`)
    })
    const totalDiferenca = comValoresDiferentes.reduce((sum, v) => sum + v.diferenca, 0)
    console.log(`  Total diferença: R$ ${totalDiferenca.toFixed(2)}`)
  }
  
  if (apenasAnon.length === 0 && apenasService.length === 0 && comValoresDiferentes.length === 0) {
    console.log('🤔 Mesmos IDs, mesmos valores, mas totais diferentes!')
    console.log('   Possível problema de precisão numérica no Supabase.')
  }
}

main()
