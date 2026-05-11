#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🔍 Verificando importação de vendas...\n')

  // Buscar tenant_id do Space Burguer
  const { data: tenant } = await supabase
    .from('tenant_clientes')
    .select('id, nome, cnpj')
    .eq('cnpj', '41.801.204/0001-09')
    .single()

  if (!tenant) {
    console.log('❌ Cliente não encontrado')
    return
  }

  console.log('Cliente:', tenant.nome)
  console.log('ID:', tenant.id)
  console.log('CNPJ:', tenant.cnpj)
  console.log('')

  // Contar vendas totais
  const { count: totalCount } = await supabase
    .from('vendas')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)

  console.log('📊 Total de vendas:', totalCount)

  // Contar vendas de abril
  const { count: abrilCount } = await supabase
    .from('vendas')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .gte('data_venda', '2026-04-01')
    .lt('data_venda', '2026-05-01')

  console.log('📊 Vendas de abril/2026:', abrilCount)

  // Contar vendas sem código
  const { count: semCodigoCount } = await supabase
    .from('vendas')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .or('codigo.is.null,codigo.eq.')

  console.log('⚠️  Vendas sem código:', semCodigoCount)

  // Buscar códigos duplicados
  const { data: duplicados } = await supabase
    .from('vendas')
    .select('codigo')
    .eq('tenant_id', tenant.id)
    .not('codigo', 'is', null)
    .not('codigo', 'eq', '')

  if (duplicados) {
    const codigosMap = new Map()
    duplicados.forEach(v => {
      const codigo = v.codigo
      codigosMap.set(codigo, (codigosMap.get(codigo) || 0) + 1)
    })

    const duplicadosArray = Array.from(codigosMap.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])

    if (duplicadosArray.length > 0) {
      console.log('\n🔄 Códigos duplicados:')
      duplicadosArray.slice(0, 10).forEach(([codigo, count]) => {
        console.log(`  ${codigo}: ${count}x`)
      })
      if (duplicadosArray.length > 10) {
        console.log(`  ... e mais ${duplicadosArray.length - 10} códigos duplicados`)
      }
    } else {
      console.log('\n✅ Nenhum código duplicado encontrado')
    }
  }

  // Buscar últimas vendas importadas
  const { data: ultimas } = await supabase
    .from('vendas')
    .select('id, codigo, cliente_nome, valor_total, data_venda, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (ultimas && ultimas.length > 0) {
    console.log('\n📝 Últimas 5 vendas importadas:')
    ultimas.forEach(v => {
      console.log(`  ${v.codigo || '(sem código)'} - ${v.cliente_nome} - R$ ${v.valor_total} - ${new Date(v.created_at).toLocaleString('pt-BR')}`)
    })
  }

  // Estatísticas por data
  const { data: porData } = await supabase
    .from('vendas')
    .select('data_venda')
    .eq('tenant_id', tenant.id)

  if (porData) {
    const dataMap = new Map()
    porData.forEach(v => {
      const data = v.data_venda.split('T')[0]
      dataMap.set(data, (dataMap.get(data) || 0) + 1)
    })

    const datasArray = Array.from(dataMap.entries())
      .sort((a, b) => b[1] - a[1])

    console.log('\n📅 Top 5 datas com mais vendas:')
    datasArray.slice(0, 5).forEach(([data, count]) => {
      console.log(`  ${data}: ${count} vendas`)
    })
  }
}

main()
