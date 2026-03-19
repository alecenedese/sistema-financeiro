"use client"

import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/hooks/use-tenant"
import useSWR from "swr"

// ─── tipos ───────────────────────────────────────────────────────────────────

export interface SummaryData {
  saldo: number
  receitas: number
  despesas: number
  pendente: number
}

export interface RecentTx {
  id: string
  descricao: string
  categoria: string
  data: string
  valor: number
  tipo: "pagar" | "receber"
}

export interface AccountRow {
  id: number
  nome: string
  tipo: string
  saldo_atual: number
}

export interface MonthlyPoint {
  month: string
  receitas: number
  despesas: number
}

export interface CategoryPoint {
  name: string
  value: number
  color: string
  subcategorias: { name: string; value: number; color: string }[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

export function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

const PALETTE = [
  "#1B3A5C","#2C5F8A","#3D7AB5","#7A8FA6","#A8B8C8","#5C8A5C","#8AB57A",
  "#5C4A8A","#C4823C","#8A5C5C",
]

function colorForIndex(i: number) {
  return PALETTE[i % PALETTE.length]
}

function mesRange(offset = 0) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-31`,
    label: label.charAt(0).toUpperCase() + label.slice(1),
  }
}

type TidKey = [string, number | null]

type TidKey = [string, number | null]

// ─── fetchers ─────────────────────────────────────────────────────────────────

async function fetchSummary([, tid]: TidKey): Promise<SummaryData> {
  const supabase = createClient()
  const { from, to } = mesRange(0)

  console.log("[v0] fetchSummary - tenant_id:", tid, "from:", from, "to:", to)

  // Contas a pagar (despesas)
  let qPagar = supabase
    .from("contas_pagar")
    .select("valor, status")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qPagar = qPagar.eq("tenant_id", tid)

  // Contas a receber (receitas)
  let qReceber = supabase
    .from("contas_receber")
    .select("valor, status")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qReceber = qReceber.eq("tenant_id", tid)

  // Lancamentos manuais
  let qLanc = supabase
    .from("lancamentos")
    .select("valor, tipo, status")
    .gte("data", from)
    .lte("data", to)
  if (tid) qLanc = qLanc.eq("tenant_id", tid)

  // Contas bancarias
  let qContas = supabase.from("contas_bancarias").select("saldo")
  if (tid) qContas = qContas.eq("tenant_id", tid)

  const [resPagar, resReceber, resLanc, resContas] = await Promise.all([
    qPagar, qReceber, qLanc, qContas,
  ])

  console.log("[v0] contas_pagar response:", resPagar)
  console.log("[v0] contas_receber response:", resReceber)
  console.log("[v0] lancamentos response:", resLanc)
  console.log("[v0] contas_bancarias response:", resContas)

  const { data: pagar, error: errPagar } = resPagar
  const { data: receber, error: errReceber } = resReceber
  const { data: lanc, error: errLanc } = resLanc
  const { data: contas, error: errContas } = resContas

  if (errPagar) console.log("[v0] Erro contas_pagar:", errPagar)
  if (errReceber) console.log("[v0] Erro contas_receber:", errReceber)
  if (errLanc) console.log("[v0] Erro lancamentos:", errLanc)
  if (errContas) console.log("[v0] Erro contas_bancarias:", errContas)

  let despesas = 0, receitas = 0, pendente = 0

  for (const r of (pagar || [])) {
    const v = Number(r.valor)
    if (r.status === "pago" || r.status === "confirmado") despesas += v
    else pendente += v
  }

  for (const r of (receber || [])) {
    const v = Number(r.valor)
    if (r.status === "recebido" || r.status === "confirmado") receitas += v
  }

  for (const r of (lanc || [])) {
    if (r.tipo === "receita") receitas += Number(r.valor)
    else despesas += Number(r.valor)
  }

  const saldo = (contas || []).reduce((acc, c) => acc + Number(c.saldo ?? 0), 0)

  return { saldo, receitas, despesas, pendente }
}

async function fetchRecentTx([, tid]: TidKey): Promise<RecentTx[]> {
  const supabase = createClient()

  let qP = supabase
    .from("contas_pagar")
    .select("id, descricao, valor, vencimento, status, categoria_id, categorias(nome)")
    .order("vencimento", { ascending: false })
    .limit(5)
  if (tid) qP = qP.eq("tenant_id", tid)

  let qR = supabase
    .from("contas_receber")
    .select("id, descricao, valor, vencimento, status, categoria_id, categorias(nome)")
    .order("vencimento", { ascending: false })
    .limit(5)
  if (tid) qR = qR.eq("tenant_id", tid)

  const [{ data: pagar }, { data: receber }] = await Promise.all([qP, qR])

  const toPagar = (pagar || []).map((r) => ({
    id: `p-${r.id}`,
    descricao: r.descricao as string,
    categoria: (r.categorias as { nome: string } | null)?.nome || "—",
    data: new Date((r.vencimento as string) + "T00:00:00").toLocaleDateString("pt-BR"),
    valor: Number(r.valor),
    tipo: "pagar" as const,
  }))

  const toReceber = (receber || []).map((r) => ({
    id: `r-${r.id}`,
    descricao: r.descricao as string,
    categoria: (r.categorias as { nome: string } | null)?.nome || "—",
    data: new Date((r.vencimento as string) + "T00:00:00").toLocaleDateString("pt-BR"),
    valor: Number(r.valor),
    tipo: "receber" as const,
  }))

  return [...toPagar, ...toReceber]
    .sort((a, b) => {
      const da = new Date(a.data.split("/").reverse().join("-"))
      const db = new Date(b.data.split("/").reverse().join("-"))
      return db.getTime() - da.getTime()
    })
    .slice(0, 8)
}

async function fetchAccounts([, tid]: TidKey): Promise<AccountRow[]> {
  const supabase = createClient()
  console.log("[v0] fetchAccounts - tenant_id:", tid)
  let q = supabase.from("contas_bancarias").select("id, nome, tipo, saldo").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data, error } = await q
  console.log("[v0] fetchAccounts response - data:", data, "error:", error)
  return (data || []).map((r) => ({
    id: r.id as number,
    nome: r.nome as string,
    tipo: r.tipo as string,
    saldo_atual: Number(r.saldo ?? 0),
  }))
}

async function fetchMonthly([, tid]: TidKey): Promise<MonthlyPoint[]> {
  const supabase = createClient()
  const points: MonthlyPoint[] = []

  for (let i = 5; i >= 0; i--) {
    const { from, to, label } = mesRange(i)

    let qP = supabase.from("contas_pagar").select("valor").eq("status", "pago").gte("vencimento", from).lte("vencimento", to)
    let qR = supabase.from("contas_receber").select("valor").eq("status", "recebido").gte("vencimento", from).lte("vencimento", to)
    let qL = supabase.from("lancamentos").select("valor, tipo").gte("data", from).lte("data", to)

    if (tid) { qP = qP.eq("tenant_id", tid); qR = qR.eq("tenant_id", tid); qL = qL.eq("tenant_id", tid) }

    const [{ data: pagar }, { data: receber }, { data: lanc }] = await Promise.all([qP, qR, qL])

    let despesas = (pagar || []).reduce((s, r) => s + Number(r.valor), 0)
    let receitas = (receber || []).reduce((s, r) => s + Number(r.valor), 0)
    for (const r of (lanc || [])) {
      if (r.tipo === "receita") receitas += Number(r.valor)
      else despesas += Number(r.valor)
    }

    points.push({ month: label, receitas, despesas })
  }

  return points
}

async function fetchCategoryCharts([, tid]: TidKey): Promise<{ expenses: CategoryPoint[]; incomes: CategoryPoint[] }> {
  const supabase = createClient()
  const { from, to } = mesRange(0)

  let qP = supabase
    .from("contas_pagar")
    .select("valor, categoria_id, categorias(nome), subcategorias(nome)")
    .gte("vencimento", from).lte("vencimento", to)
  let qR = supabase
    .from("contas_receber")
    .select("valor, categoria_id, categorias(nome), subcategorias(nome)")
    .gte("vencimento", from).lte("vencimento", to)

  if (tid) { qP = qP.eq("tenant_id", tid); qR = qR.eq("tenant_id", tid) }

  const [{ data: pagar }, { data: receber }] = await Promise.all([qP, qR])

  type Map = Record<string, { value: number; subs: Record<string, number> }>

  function buildMap(rows: typeof pagar): Map {
    const map: Map = {}
    for (const r of (rows || [])) {
      const cat = (r.categorias as { nome: string } | null)?.nome || "Sem categoria"
      const sub = (r.subcategorias as { nome: string } | null)?.nome || "Geral"
      const v = Number(r.valor)
      if (!map[cat]) map[cat] = { value: 0, subs: {} }
      map[cat].value += v
      map[cat].subs[sub] = (map[cat].subs[sub] || 0) + v
    }
    return map
  }

  function toPoints(map: Map): CategoryPoint[] {
    return Object.entries(map)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, { value, subs }], i) => ({
        name, value,
        color: colorForIndex(i),
        subcategorias: Object.entries(subs)
          .sort((a, b) => b[1] - a[1])
          .map(([sName, sVal], j) => ({
            name: sName, value: sVal, color: colorForIndex(i + j + 1),
          })),
      }))
  }

  return {
    expenses: toPoints(buildMap(pagar)),
    incomes: toPoints(buildMap(receber)),
  }
}

// ─── hooks públicos ───────────────────────────────────────────────────────────
// key sempre é array: ["nome", tid | null]
// tid=null → admin sem filtro (vê tudo)
// tid=número → cliente, filtra por tenant_id

export function useSummary() {
  const { tenant } = useTenant()
  // undefined = aguardando hidratação (não dispara fetch ainda)
  // null = admin sem tenant selecionado (dispara sem filtro)
  // number = cliente ou admin com tenant ativo (filtra)
  const key: TidKey = ["dashboard-summary", tenant?.id ?? null]
  return useSWR(key, fetchSummary, { revalidateOnFocus: false })
}

export function useRecentTx() {
  const { tenant } = useTenant()
  const key: TidKey = ["dashboard-recent-tx", tenant?.id ?? null]
  return useSWR(key, fetchRecentTx, { revalidateOnFocus: false })
}

export function useAccounts() {
  const { tenant } = useTenant()
  const key: TidKey = ["dashboard-accounts", tenant?.id ?? null]
  return useSWR(key, fetchAccounts, { revalidateOnFocus: false })
}

export function useMonthly() {
  const { tenant } = useTenant()
  const key: TidKey = ["dashboard-monthly", tenant?.id ?? null]
  return useSWR(key, fetchMonthly, { revalidateOnFocus: false })
}

export function useCategoryCharts() {
  const { tenant } = useTenant()
  const key: TidKey = ["dashboard-category-charts", tenant?.id ?? null]
  return useSWR(key, fetchCategoryCharts, { revalidateOnFocus: false })
}
