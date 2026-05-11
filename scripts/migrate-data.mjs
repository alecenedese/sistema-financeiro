// Migração de dados do Supabase antigo -> novo
// Uso: node scripts/migrate-data.mjs

import { createClient } from "@supabase/supabase-js"

const OLD_URL = "https://vrdusxfvnycmkvtbsfcf.supabase.co"
const OLD_KEY = process.env.OLD_SUPABASE_ANON_KEY

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!NEW_URL || !NEW_KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env")
  process.exit(1)
}

const src = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } })
const dst = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } })

// Colunas aceitas por cada tabela no banco NOVO (conforme setup-novo-supabase.sql)
const SCHEMA = {
  tenant_clientes: ["id","nome","email","cnpj","telefone","ativo","created_at"],
  clientes_admin: ["id","nome","cnpj","email","telefone","responsavel","plano","observacoes","ativo","created_at","updated_at"],
  categorias: ["id","nome","tipo","cor","grupo_dre","tenant_id","created_at"],
  subcategorias: ["id","categoria_id","nome","tenant_id","created_at"],
  subcategorias_filhos: ["id","subcategoria_id","nome","tenant_id","created_at"],
  clientes: ["id","nome","documento","tipo_pessoa","email","telefone","cnpj","tenant_id","created_at"],
  fornecedores: ["id","nome","documento","tipo_pessoa","email","telefone","cnpj","tenant_id","created_at"],
  contas_bancarias: ["id","nome","tipo","cor","agencia","conta","saldo","saldo_inicial","entradas","saidas","tenant_id","created_at"],
  despesas_fixas: ["id","descricao","keyword","valor","total_parcelas","parcela_atual","categoria_id","subcategoria_id","subcategoria_filho_id","fornecedor_id","conta_bancaria_id","forma_pagamento","tipo_recorrencia","dia_vencimento","ativa","tenant_id","created_at"],
  contas_pagar: ["id","descricao","valor","vencimento","status","fornecedor","fornecedor_id","categoria_id","subcategoria_id","subcategoria_filho_id","conta_bancaria_id","forma_pagamento","tenant_id","created_at"],
  contas_receber: ["id","descricao","valor","vencimento","status","cliente","cliente_id","categoria_id","subcategoria_id","subcategoria_filho_id","conta_bancaria_id","forma_pagamento","tenant_id","created_at"],
  vendas: ["id","tenant_id","codigo","cliente_id","cliente_nome","valor_total","acrescimo","taxas_marketplace","desconto","valor_recebido","forma_pagamento","canal","data_venda","observacoes","created_at","updated_at"],
  mapping_rules: ["id","keyword","categoria_id","subcategoria_id","subcategoria_filho_id","fornecedor_id","cliente_id","cliente_fornecedor","tenant_id","created_at"],
}

// Ordem de migração (dependências)
const ORDER = [
  "tenant_clientes",
  "clientes_admin",
  "categorias",
  "subcategorias",
  "subcategorias_filhos",
  "clientes",
  "fornecedores",
  "contas_bancarias",
  "despesas_fixas",
  "contas_pagar",
  "contas_receber",
  "vendas",
  "mapping_rules",
]

async function fetchAll(table) {
  const rows = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await src
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1)
    if (error) {
      console.error(`  [${table}] erro ao ler:`, error.message)
      return rows
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function project(row, cols) {
  const out = {}
  for (const c of cols) if (c in row) out[c] = row[c]
  return out
}

async function insertBatch(table, rows) {
  if (rows.length === 0) return { ok: 0, fail: 0 }
  const cols = SCHEMA[table]
  const projected = rows.map(r => project(r, cols))
  const batchSize = 500
  let ok = 0, fail = 0
  for (let i = 0; i < projected.length; i += batchSize) {
    const chunk = projected.slice(i, i + batchSize)
    const { error } = await dst.from(table).insert(chunk)
    if (error) {
      console.error(`  [${table}] batch ${i}: ${error.message}`)
      fail += chunk.length
    } else {
      ok += chunk.length
    }
  }
  return { ok, fail }
}

async function ensureTenantClientes(usedIds) {
  // Busca do clientes_admin os dados para popular tenant_clientes com mesmos IDs
  const { data: admin } = await src.from("clientes_admin").select("*")
  const byId = new Map((admin || []).map(a => [a.id, a]))
  const rows = []
  const usedEmails = new Set()
  for (const id of usedIds) {
    const a = byId.get(id) || { nome: `Tenant ${id}`, email: `` }
    let email = (a.email || "").trim() || `tenant${id}@placeholder.local`
    // evitar colisão de unique(email)
    while (usedEmails.has(email)) email = `tenant${id}.${Date.now()}@placeholder.local`
    usedEmails.add(email)
    rows.push({
      id,
      nome: a.nome || `Tenant ${id}`,
      email,
      cnpj: a.cnpj || null,
      telefone: a.telefone || null,
      ativo: a.ativo ?? true,
      created_at: a.created_at || new Date().toISOString(),
    })
  }
  return rows
}

async function main() {
  console.log("== MIGRAÇÃO INICIADA ==")
  console.log("src:", OLD_URL)
  console.log("dst:", NEW_URL)

  // 1) Descobrir tenant_ids em uso
  const tenantScanTables = ["categorias","clientes","fornecedores","contas_bancarias","contas_pagar","contas_receber","mapping_rules","despesas_fixas","vendas","subcategorias","subcategorias_filhos"]
  const usedTenantIds = new Set()
  for (const t of tenantScanTables) {
    const { data } = await src.from(t).select("tenant_id")
    for (const r of (data || [])) if (r.tenant_id != null) usedTenantIds.add(r.tenant_id)
  }
  console.log("tenant_ids em uso:", [...usedTenantIds].sort((a,b)=>a-b))

  // 2) Migrar cada tabela
  const summary = {}
  for (const table of ORDER) {
    console.log(`\n>> ${table}`)
    let rows
    if (table === "tenant_clientes") {
      rows = await ensureTenantClientes([...usedTenantIds])
      console.log(`  placeholders gerados: ${rows.length}`)
    } else {
      rows = await fetchAll(table)
      console.log(`  lidos: ${rows.length}`)
    }
    const res = await insertBatch(table, rows)
    console.log(`  inseridos: ${res.ok}  falhos: ${res.fail}`)
    summary[table] = res
  }

  console.log("\n== RESUMO ==")
  console.log(JSON.stringify(summary, null, 2))

  // 3) Gerar SQL para resetar sequences (rodar no SQL Editor depois)
  console.log("\nAo final rode no SQL Editor do NOVO projeto o arquivo scripts/fix-sequences.sql para ajustar as sequences.")
}

main().catch(e => { console.error(e); process.exit(1) })
