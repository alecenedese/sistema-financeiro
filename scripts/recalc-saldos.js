// Recalcula saldos de todas as contas bancárias usando paginação
const { createClient } = require("@supabase/supabase-js")
const fs = require("fs"), path = require("path")
const envContent = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8")
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function fetchAll(query) {
  const PAGE = 1000
  let all = [], offset = 0
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE - 1)
    if (error) { console.error(error); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

async function main() {
  const { data: contas } = await supabase.from("contas_bancarias").select("id, nome, saldo, saldo_inicial")
  for (const c of (contas || [])) {
    const si = Number(c.saldo_inicial) || 0
    const [despesas, receitas, lancamentos] = await Promise.all([
      fetchAll(supabase.from("contas_pagar").select("valor").eq("conta_bancaria_id", c.id).eq("status", "pago")),
      fetchAll(supabase.from("contas_receber").select("valor").eq("conta_bancaria_id", c.id).eq("status", "recebido")),
      fetchAll(supabase.from("lancamentos").select("valor, tipo").eq("conta_bancaria_id", c.id)),
    ])
    let ent = 0, sai = 0
    for (const r of receitas) ent += Number(r.valor)
    for (const d of despesas) sai += Number(d.valor)
    for (const l of lancamentos) { if (l.tipo === "receita") ent += Number(l.valor); else sai += Number(l.valor) }
    const novo = si + ent - sai
    const diff = novo - Number(c.saldo)
    if (Math.abs(diff) > 0.01) {
      console.log(`${c.nome}: saldo=${c.saldo} -> correto=${novo.toFixed(2)} (diff=${diff.toFixed(2)})`)
      await supabase.from("contas_bancarias").update({ saldo: novo }).eq("id", c.id)
    } else {
      console.log(`${c.nome}: OK (${novo.toFixed(2)})`)
    }
  }
}
main().catch(console.error)
