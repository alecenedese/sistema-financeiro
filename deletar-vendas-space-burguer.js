#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🔍 Buscando cliente Space Burguer...\n')

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

  // Contar vendas de abril ANTES de deletar
  const { count: countBefore } = await supabase
    .from('vendas')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .gte('data_venda', '2026-04-01')
    .lt('data_venda', '2026-05-01')

  console.log(`📊 Vendas de abril/2026 ANTES: ${countBefore}`)
  console.log('')

  if (countBefore === 0) {
    console.log('ℹ️  Nenhuma venda para deletar')
    return
  }

  console.log(`⚠️  Deletando ${countBefore} vendas...`)

  // Deletar vendas de abril
  const { error: deleteError } = await supabase
    .from('vendas')
    .delete()
    .eq('tenant_id', tenant.id)
    .gte('data_venda', '2026-04-01')
    .lt('data_venda', '2026-05-01')

  if (deleteError) {
    console.error('❌ Erro ao deletar:', deleteError)
    return
  }

  // Contar vendas de abril DEPOIS de deletar
  const { count: countAfter } = await supabase
    .from('vendas')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .gte('data_venda', '2026-04-01')
    .lt('data_venda', '2026-05-01')

  console.log(`✅ Vendas deletadas com sucesso!`)
  console.log(`📊 Vendas de abril/2026 DEPOIS: ${countAfter}`)
  console.log(`🗑️  Total deletado: ${countBefore - countAfter}`)
}

main()
