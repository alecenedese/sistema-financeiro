#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🔧 Criando cliente Lóck-Mak Lucas...\n')
  
  const { data, error } = await supabase
    .from('tenant_clientes')
    .insert({
      nome: 'Lóck-Mak Lucas',
      cnpj: '52.216.724/0001-70',
      email: 'contato@lockmak.com.br'
    })
    .select()
    .single()
  
  if (error) {
    console.error('❌ Erro ao criar cliente:', error)
    return
  }
  
  console.log('✅ Cliente criado com sucesso!')
  console.log('   ID:', data.id)
  console.log('   Nome:', data.nome)
  console.log('   CNPJ:', data.cnpj)
  console.log('')
  console.log('🎯 Agora você pode:')
  console.log('   1. Selecionar este cliente no sistema')
  console.log('   2. Cadastrar contas bancárias normalmente')
}

main()
