#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://kisdypjtrdvcyblkqutw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🔍 Verificando cliente ID 14...\n')
  
  // Buscar cliente ID 14
  const { data: cliente14, error: error14 } = await supabase
    .from('tenant_clientes')
    .select('*')
    .eq('id', 14)
    .maybeSingle()
  
  console.log('Cliente ID 14:', cliente14)
  console.log('Erro:', error14)
  console.log('')
  
  // Buscar cliente com CNPJ 52.216.724/0001-70
  const { data: clienteCNPJ, error: errorCNPJ } = await supabase
    .from('tenant_clientes')
    .select('*')
    .eq('cnpj', '52.216.724/0001-70')
    .maybeSingle()
  
  console.log('Cliente com CNPJ 52.216.724/0001-70:', clienteCNPJ)
  console.log('Erro:', errorCNPJ)
  console.log('')
  
  // Buscar cliente com nome "Lóck-Mak Lucas"
  const { data: clienteNome, error: errorNome } = await supabase
    .from('tenant_clientes')
    .select('*')
    .ilike('nome', '%Lóck-Mak Lucas%')
  
  console.log('Clientes com nome "Lóck-Mak Lucas":', clienteNome)
  console.log('Erro:', errorNome)
  console.log('')
  
  // Listar todos os clientes
  const { data: todosClientes } = await supabase
    .from('tenant_clientes')
    .select('id, nome, cnpj')
    .order('id')
  
  console.log('📋 Todos os clientes:')
  todosClientes?.forEach(c => {
    console.log(`  ID: ${c.id}, Nome: ${c.nome}, CNPJ: ${c.cnpj}`)
  })
}

main()
