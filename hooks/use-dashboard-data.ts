"use client"

import { createClient } from "@/lib/supabase/client"
import { getActiveTenantId, useTenant } from "@/hooks/use-tenant"
import useSWR from "swr"
import { useMemo } from "react"

const supabase = createClient()

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

// ─── tipos ───────────────────────────────────────────────────────────────────

export interface SummaryData {
  saldo: number
  receitas: number
  despesas: number
  cartao: number
}

export interface RecentTx {
  id: number
  descricao: string
  categoria: string
  data: string
  valor: number
  tipo: string
  cor: string
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

// ─── paleta de cores ──────────────────────────────────────────────────────────
const PALETTE = [
  "#1B3A5C","#2C5F8A","#3D7AB5","#7A8FA6","#A8B8C8","#C4CFD9","#D9E1E8",
]

function colorForIndex(i: number) {
  return PALETTE[i % PALETTE.length]
}

// ─── fetchers ─────────────────────────────────────────────────────────────────

async function fetchSummary(): Promise<SummaryData> {
  const tid = getActiveTenantId()
  const now = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  let q = supabase
    .from("lancamentos")
    .select("valor, tipo, forma_pagamento, data")
    .gte("data", `${mesAtual}-01`)
    .lte("data", `${mesAtual}-31`)

  if (tid) q = q.eq("tenant_id", tid)

  const { data } = await q
  const rows = data || []

  let receitas = 0, despesas = 0, cartao = 0
  for (const r of rows) {
    if (r.tipo === "receita") receitas += Number(r.valor)
    else despesas += Number(r.valor)
    if (r.forma_pagamento === "Cartao de Credito") cartao += Number(r.valor)
  }

  // saldo = soma de todas as contas
  let cq = supabase.from("contas_bancarias").select("saldo_atual")
  if (tid) cq = cq.eq("tenant_id", tid)
  const { data: contas } = await cq
  const saldo = (contas || []).reduce((acc, c) => acc + Number(c.saldo_atual ?? 0), 0)

  return { saldo, receitas, despesas, cartao }
}

async function fetchRecentTx(): Promise<RecentTx[]> {
  const tid = getActiveTenantId()
  let q = supabase
    .from("lancamentos")
    .select("id, descricao, valor, tipo, data, categorias(nome), forma_pagamento")
    .order("data", { ascending: false })
    .limit(8)

  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q

  return (data || []).map((r: Record<string, unknown>, i: number) => ({
    id: r.id as number,
    descricao: r.descricao as string,
    categoria: (r.categorias as Record<string, string> | null)?.nome || "—",
    data: new Date((r.data as string) + "T00:00:00").toLocaleDateString("pt-BR"),
    valor: Number(r.valor),
    tipo: r.tipo as string,
    cor: colorForIndex(i),
  }))
}

async function fetchAccounts(): Promise<AccountRow[]> {
  const tid = getActiveTenantId()
  let q = supabase.from("contas_bancarias").select("id, nome, tipo, saldo_atual").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    nome: r.nome as string,
    tipo: r.tipo as string,
    saldo_atual: Number(r.saldo_atual ?? 0),
  }))
}

async function fetchMonthly(): Promise<MonthlyPoint[]> {
  const tid = getActiveTenantId()
  const now = new Date()
  const points: MonthlyPoint[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const from = `${year}-${month}-01`
    const to = `${year}-${month}-31`
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")

    let q = supabase.from("lancamentos").select("valor, tipo").gte("data", from).lte("data", to)
    if (tid) q = q.eq("tenant_id", tid)
    const { data } = await q
    const rows = data || []

    let receitas = 0, despesas = 0
    for (const r of rows) {
      if (r.tipo === "receita") receitas += Number(r.valor)
      else despesas += Number(r.valor)
    }
    points.push({ month: label.charAt(0).toUpperCase() + label.slice(1), receitas, despesas })
  }
  return points
}

async function fetchCategoryCharts(): Promise<{ expenses: CategoryPoint[]; incomes: CategoryPoint[] }> {
  const tid = getActiveTenantId()
  const now = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  let q = supabase
    .from("lancamentos")
    .select("valor, tipo, categoria_id, subcategoria_id, categorias(id, nome), subcategorias(id, nome)")
    .gte("data", `${mesAtual}-01`)
    .lte("data", `${mesAtual}-31`)

  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q

  const expMap: Record<string, { value: number; subs: Record<string, number> }> = {}
  const incMap: Record<string, { value: number; subs: Record<string, number> }> = {}

  for (const r of (data || [])) {
    const catNome = (r.categorias as Record<string, string> | null)?.nome || "Sem categoria"
    const subNome = (r.subcategorias as Record<string, string> | null)?.nome || "Geral"
    const val = Number(r.valor)
    const map = r.tipo === "receita" ? incMap : expMap
    if (!map[catNome]) map[catNome] = { value: 0, subs: {} }
    map[catNome].value += val
    map[catNome].subs[subNome] = (map[catNome].subs[subNome] || 0) + val
  }

  function toPoints(map: typeof expMap): CategoryPoint[] {
    return Object.entries(map)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, { value, subs }], i) => ({
        name,
        value,
        color: colorForIndex(i),
        subcategorias: Object.entries(subs)
          .sort((a, b) => b[1] - a[1])
          .map(([sName, sVal], j) => ({
            name: sName,
            value: sVal,
            color: colorForIndex(i + j + 1),
          })),
      }))
  }

  return { expenses: toPoints(expMap), incomes: toPoints(incMap) }
}

// ─── hooks públicos ───────────────────────────────────────────────────────────
// As keys são arrays para que o SWR reaja quando o tenant muda

export function useSummary() {
  const { tenant } = useTenant()
  return useSWR(["dashboard-summary", tenant?.id ?? null], fetchSummary, { revalidateOnFocus: false })
}

export function useRecentTx() {
  const { tenant } = useTenant()
  return useSWR(["dashboard-recent-tx", tenant?.id ?? null], fetchRecentTx, { revalidateOnFocus: false })
}

export function useAccounts() {
  const { tenant } = useTenant()
  return useSWR(["dashboard-accounts", tenant?.id ?? null], fetchAccounts, { revalidateOnFocus: false })
}

export function useMonthly() {
  const { tenant } = useTenant()
  return useSWR(["dashboard-monthly", tenant?.id ?? null], fetchMonthly, { revalidateOnFocus: false })
}

export function useCategoryCharts() {
  const { tenant } = useTenant()
  return useSWR(["dashboard-category-charts", tenant?.id ?? null], fetchCategoryCharts, { revalidateOnFocus: false })
}

export { fmt }
