#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  // Buscar tenant_id do Space Burguer
  const { data: tenant } = await supabase
    .from('tenant_clientes')
    .select('id, nome, cnpj')
    .eq('cnpj', '41.801.204/0001-09')
    .single()

  if (!tenant) {
    console.log('Cliente não encontrado')
    return
  }

  console.log('Cliente:', tenant.nome)
  console.log('ID:', tenant.id)
  console.log('CNPJ:', tenant.cnpj)
  console.log('')

  // Contar vendas de abril
  const { count, error } = await supabase
    .from('vendas')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .gte('data_venda', '2026-04-01')
    .lt('data_venda', '2026-05-01')

  if (error) {
    console.error('Erro:', error)
    return
  }

  console.log('Vendas de abril/2026:', count)
}

main()
