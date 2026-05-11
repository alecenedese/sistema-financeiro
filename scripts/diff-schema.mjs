import { createClient } from "@supabase/supabase-js"

const OLD_URL = "https://vrdusxfvnycmkvtbsfcf.supabase.co"
const OLD_KEY = process.env.OLD_SUPABASE_ANON_KEY
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const src = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } })
const dst = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } })

const tables = ["tenant_clientes","clientes_admin","categorias","subcategorias","subcategorias_filhos","clientes","fornecedores","contas_bancarias","despesas_fixas","contas_pagar","contas_receber","lancamentos","vendas","mapping_rules"]

for (const t of tables) {
  const [{ data: oldRows }, { data: newRows }] = await Promise.all([
    src.from(t).select("*").limit(1),
    dst.from(t).select("*").limit(1),
  ])
  const oldCols = oldRows && oldRows[0] ? Object.keys(oldRows[0]) : []
  const newCols = newRows && newRows[0] ? Object.keys(newRows[0]) : []
  // Se novo está vazio, faz uma busca no HEAD para extrair schema via erro? Melhor: pega só do antigo
  const missing = oldCols.filter(c => !newCols.includes(c))
  const extra = newCols.filter(c => !oldCols.includes(c))
  console.log(`\n[${t}]`)
  console.log("  OLD:", oldCols.join(", ") || "(vazio)")
  console.log("  NEW:", newCols.join(", ") || "(vazio)")
  if (missing.length) console.log("  !! FALTA NO NOVO:", missing.join(", "))
  if (extra.length) console.log("  (apenas no novo):", extra.join(", "))
}
