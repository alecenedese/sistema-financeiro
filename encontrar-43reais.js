#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const tid = 6
  
  console.log('🔍 Buscando vendas de abril com diferentes queries...\n')
  
  // Query 1: Todas as vendas de abril (com paginação)
  let todasVendas = []
  let offset = 0
  const PAGE_SIZE = 1000
  
  while (true) {
    const { data } = await supabase
      .from('vendas')
      .select('id, codigo, valor_total, data_venda, created_at, updated_at')
      .eq('tenant_id', tid)
      .gte('data_venda', '2026-04-01')
      .lt('data_venda', '2026-05-01')
      .order('valor_total', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    
    if (!data || data.length === 0) break
    todasVendas = todasVendas.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  
  console.log(`📊 Total de vendas: ${todasVendas.length}`)
  
  const total = todasVendas.reduce((sum, v) => sum + Number(v.valor_total), 0)
  console.log(`💰 Total: R$ ${total.toFixed(2)}`)
  console.log(`📊 Diferença do esperado: R$ ${(total - 332658.80).toFixed(2)}`)
  console.log('')
  
  // Agrupar por código para encontrar duplicatas
  const porCodigo = {}
  todasVendas.forEach(v => {
    const codigo = v.codigo || '(sem código)'
    if (!porCodigo[codigo]) {
      porCodigo[codigo] = []
    }
    porCodigo[codigo].push(v)
  })
  
  const duplicados = Object.entries(porCodigo).filter(([_, vendas]) => vendas.length > 1)
  
  console.log(`🔄 Códigos duplicados: ${duplicados.length}`)
  
  if (duplicados.length > 0) {
    console.log('\n📋 Primeiras 20 duplicatas:')
    duplicados.slice(0, 20).forEach(([codigo, vendas]) => {
      const totalCodigo = vendas.reduce((sum, v) => sum + Number(v.valor_total), 0)
      console.log(`\n  Código: ${codigo} (${vendas.length}x) - Total: R$ ${totalCodigo.toFixed(2)}`)
      vendas.forEach(v => {
        console.log(`    ID: ${v.id}, Valor: R$ ${Number(v.valor_total).toFixed(2)}, Data: ${v.data_venda}`)
      })
    })
    
    // Calcular total de valores duplicados
    const totalDuplicado = duplicados.reduce((sum, [_, vendas]) => {
      // Soma apenas as duplicatas (n-1 vendas)
      const valorUnitario = Number(vendas[0].valor_total)
      return sum + (valorUnitario * (vendas.length - 1))
    }, 0)
    
    console.log(`\n💰 Total de valores duplicados: R$ ${totalDuplicado.toFixed(2)}`)
    
    if (Math.abs(totalDuplicado - 43.54) < 1) {
      console.log('\n✅ ENCONTRADO! As duplicatas somam aproximadamente R$ 43,54')
      console.log('   Essas vendas precisam ser removidas.')
    }
  }
  
  // Procurar vendas criadas/atualizadas recentemente
  console.log('\n📅 Vendas criadas/atualizadas recentemente:')
  const recentes = todasVendas
    .filter(v => {
      const created = new Date(v.created_at)
      const updated = new Date(v.updated_at)
      const agora = new Date()
      const diff = Math.min(
        (agora - created) / (1000 * 60 * 60), // horas desde criação
        (agora - updated) / (1000 * 60 * 60)  // horas desde atualização
      )
      return diff < 24 // últimas 24 horas
    })
    .slice(0, 10)
  
  if (recentes.length > 0) {
    recentes.forEach(v => {
      console.log(`  ID: ${v.id}, Código: ${v.codigo}, Valor: R$ ${Number(v.valor_total).toFixed(2)}`)
    })
  } else {
    console.log('  Nenhuma venda recente')
  }
}

main()
