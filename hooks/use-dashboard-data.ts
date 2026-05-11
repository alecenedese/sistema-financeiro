"use client"

import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/hooks/use-tenant"
import { fetchAll } from "@/lib/supabase/fetch-all"
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

function isTransferCat(nome: string): boolean {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("transferencia entre")
}

function mesRange(offset = 0) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const year = d.getFullYear()
  const month = d.getMonth() // 0-11
  const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
  // Usa horário local do browser para definir limites do mês
  const fromISO = new Date(year, month, 1, 0, 0, 0, 0).toISOString()
  const toISO = new Date(year, month + 1, 1, 0, 0, 0, 0).toISOString()
  return {
    from: fromISO,
    to: toISO,
    label: label.charAt(0).toUpperCase() + label.slice(1),
  }
}

// Helper: converte mês/ano para range ISO respeitando timezone local do browser
function monthToISO(month: number, year: number) {
  const fromISO = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString()
  const toISO = new Date(year, month, 1, 0, 0, 0, 0).toISOString()
  return { fromISO, toISO }
}

type TidKey = [string, number | null]

// ─── fetchers ─────────────────────────────────────────────────────────────────

async function fetchSummary([, tid]: TidKey): Promise<SummaryData> {
  const supabase = createClient()
  const { from, to } = mesRange(0)

  // Contas a pagar (despesas)
  let qPagar = supabase
    .from("contas_pagar")
    .select("valor, status")
    .gte("vencimento", from)
    .lt("vencimento", to)
  if (tid) qPagar = qPagar.eq("tenant_id", tid)

  // Contas a receber (receitas)
  let qReceber = supabase
    .from("contas_receber")
    .select("valor, status, categorias(nome)")
    .gte("vencimento", from)
    .lt("vencimento", to)
  if (tid) qReceber = qReceber.eq("tenant_id", tid)

  // Lancamentos manuais
  let qLanc = supabase
    .from("lancamentos")
    .select("valor, tipo, status")
    .gte("data", from)
    .lt("data", to)
  if (tid) qLanc = qLanc.eq("tenant_id", tid)

  // Contas bancarias
  let qContas = supabase.from("contas_bancarias").select("saldo")
  if (tid) qContas = qContas.eq("tenant_id", tid)

  const [{ data: pagar }, { data: receber }, { data: lanc }, { data: contas }] = await Promise.all([
    qPagar, qReceber, qLanc, qContas,
  ])

  let despesas = 0, receitas = 0, pendente = 0

  for (const r of (pagar || [])) {
    const v = Number(r.valor)
    if (r.status === "pago" || r.status === "confirmado") despesas += v
    else pendente += v
  }

  for (const r of (receber || [])) {
    const v = Number(r.valor)
    const catNome = ((r.categorias as { nome?: string } | null)?.nome || "")
    if (isTransferCat(catNome)) continue
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

// Versão com filtro de mês/ano para a dashboard
async function fetchRecentTxMonth([, tid, month, year]: [string, number | null, number, number]): Promise<RecentTx[]> {
  const supabase = createClient()
  const { fromISO, toISO } = monthToISO(month, year)

  let qP = supabase
    .from("contas_pagar")
    .select("id, descricao, valor, vencimento, status, categoria_id, categorias(nome)")
    .gte("vencimento", fromISO)
    .lt("vencimento", toISO)
    .order("vencimento", { ascending: false })
    .limit(10)
  if (tid) qP = qP.eq("tenant_id", tid)

  let qR = supabase
    .from("contas_receber")
    .select("id, descricao, valor, vencimento, status, categoria_id, categorias(nome)")
    .gte("vencimento", fromISO)
    .lt("vencimento", toISO)
    .order("vencimento", { ascending: false })
    .limit(10)
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
  let q = supabase.from("contas_bancarias").select("id, nome, tipo, saldo").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
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

    let qP = supabase.from("contas_pagar").select("valor").eq("status", "pago").gte("vencimento", from).lt("vencimento", to)
    let qR = supabase.from("contas_receber").select("valor, categorias(nome)").eq("status", "recebido").gte("vencimento", from).lt("vencimento", to)
    let qL = supabase.from("lancamentos").select("valor, tipo").gte("data", from).lt("data", to)

    if (tid) { qP = qP.eq("tenant_id", tid); qR = qR.eq("tenant_id", tid); qL = qL.eq("tenant_id", tid) }

    const [{ data: pagar }, { data: receber }, { data: lanc }] = await Promise.all([qP, qR, qL])

    let despesas = (pagar || []).reduce((s, r) => s + Number(r.valor), 0)
    let receitas = (receber || []).filter(r => !isTransferCat(((r.categorias as { nome?: string } | null)?.nome || ""))).reduce((s, r) => s + Number(r.valor), 0)
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
    .gte("vencimento", from)
    .lt("vencimento", to)
  let qR = supabase
    .from("contas_receber")
    .select("valor, categoria_id, categorias(nome), subcategorias(nome)")
    .gte("vencimento", from)
    .lt("vencimento", to)

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

export function useRecentTxMonth(month: number, year: number) {
  const { tenant, mounted } = useTenant()
  const key = mounted ? ["dashboard-recent-tx-month", tenant?.id ?? null, month, year] as [string, number | null, number, number] : null
  return useSWR(key, fetchRecentTxMonth, { revalidateOnFocus: false })
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

// Versão com mês/ano específico para o novo dashboard
async function fetchCategoryChartsMonth([, tid, month, year]: [string, number | null, number, number]): Promise<{ expenses: CategoryPoint[]; incomes: CategoryPoint[] }> {
  const supabase = createClient()
  const { fromISO, toISO } = monthToISO(month, year)

  let qP = supabase
    .from("contas_pagar")
    .select("valor, categoria_id, categorias!inner(nome, grupo_dre), subcategorias(nome)")
    .gte("vencimento", fromISO).lt("vencimento", toISO)
    .not("categorias.grupo_dre", "is", null)
  let qR = supabase
    .from("contas_receber")
    .select("valor, categoria_id, categorias!inner(nome, grupo_dre), subcategorias(nome)")
    .gte("vencimento", fromISO).lt("vencimento", toISO)
    .not("categorias.grupo_dre", "is", null)

  if (tid) { qP = qP.eq("tenant_id", tid); qR = qR.eq("tenant_id", tid) }

  const [{ data: pagar }, { data: receber }] = await Promise.all([qP, qR])

  type Map = Record<string, { value: number; subs: Record<string, number> }>

  function buildMap(rows: typeof pagar): Map {
    const map: Map = {}
    for (const r of (rows || [])) {
      const cat = (r.categorias as { nome: string; grupo_dre: string } | null)?.nome || "Sem categoria"
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

export function useCategoryChartsMonth(month: number, year: number) {
  const { tenant, mounted } = useTenant()
  // Aguarda montagem antes de buscar - evita hydration mismatch
  const key = mounted ? ["dashboard-category-charts-month", tenant?.id ?? null, month, year] as [string, number | null, number, number] : null
  return useSWR(key, fetchCategoryChartsMonth, { 
    revalidateOnFocus: false,
    revalidateOnMount: true,
    dedupingInterval: 0 // Desabilita cache para forçar nova busca
  })
}

// ─── Dashboard Mensal ─────────────────────────────────────────────────────────

export interface DashboardMensalData {
  faturamento: number
  pagamentos: number
  lucroBruto: number
  percLucroBruto: number
  recebimentos: number
  lucroLiquido: number
  percLucroLiquido: number
  saldoConta: number
}

async function fetchDashboardMensal([, tid, month, year]: [string, number | null, number, number]): Promise<DashboardMensalData> {
  const supabase = createClient()
  const { fromISO, toISO } = monthToISO(month, year)

  // Faturamento (vendas - contas a receber com status confirmado/recebido)
  let qFat = supabase
    .from("contas_receber")
    .select("valor, status, categorias(nome)")
    .gte("vencimento", fromISO)
    .lt("vencimento", toISO)
  if (tid) qFat = qFat.eq("tenant_id", tid)

  // Pagamentos (contas a pagar com status pago/confirmado)
  let qPag = supabase
    .from("contas_pagar")
    .select("valor, status")
    .gte("vencimento", fromISO)
    .lt("vencimento", toISO)
  if (tid) qPag = qPag.eq("tenant_id", tid)

  // Saldo em conta
  let qContas = supabase.from("contas_bancarias").select("saldo")
  if (tid) qContas = qContas.eq("tenant_id", tid)

  const [{ data: receberData }, { data: pagarData }, { data: contasData }] = await Promise.all([
    qFat, qPag, qContas,
  ])

  const semTransferencia = (receberData || []).filter(
    r => !isTransferCat(((r.categorias as { nome?: string } | null)?.nome || ""))
  )

  // Faturamento = total de contas a receber (independente do status, é o faturamento do período)
  const faturamento = semTransferencia.reduce((acc, r) => acc + Number(r.valor), 0)

  // Recebimentos = contas a receber que foram efetivamente recebidas
  const recebimentos = semTransferencia
    .filter(r => r.status === "recebido" || r.status === "confirmado")
    .reduce((acc, r) => acc + Number(r.valor), 0)

  // Pagamentos = contas a pagar que foram efetivamente pagas
  const pagamentos = (pagarData || [])
    .filter(r => r.status === "pago" || r.status === "confirmado")
    .reduce((acc, r) => acc + Number(r.valor), 0)

  // Lucro Bruto = Faturamento - Pagamentos (saídas)
  const lucroBruto = faturamento - pagamentos
  const percLucroBruto = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0

  // Lucro Líquido = Recebimentos - Pagamentos (fluxo de caixa real)
  const lucroLiquido = recebimentos - pagamentos
  const percLucroLiquido = recebimentos > 0 ? (lucroLiquido / recebimentos) * 100 : 0

  // Saldo em conta
  const saldoConta = (contasData || []).reduce((acc, c) => acc + Number(c.saldo ?? 0), 0)

  return {
    faturamento,
    pagamentos,
    lucroBruto,
    percLucroBruto,
    recebimentos,
    lucroLiquido,
    percLucroLiquido,
    saldoConta,
  }
}

export function useDashboardMensal(month: number, year: number) {
  const { tenant, mounted } = useTenant()
  const key = mounted ? ["dashboard-mensal", tenant?.id ?? null, month, year] as [string, number | null, number, number] : null
  return useSWR(key, fetchDashboardMensal, { revalidateOnFocus: false })
}

// ─── Fluxo de Caixa Diário ────────────────────────────────────────────────────

export interface FluxoCaixaDiarioPoint {
  dia: number
  entradas: number   // recebimentos (positivo)
  saidas: number     // pagamentos (negativo, para barras abaixo do zero)
  saldo: number      // entradas + saidas (entradas - |pagamentos|)
}

async function fetchFluxoCaixaDiario([, tid, month, year]: [string, number | null, number, number]): Promise<FluxoCaixaDiarioPoint[]> {
  const supabase = createClient()
  const { fromISO, toISO } = monthToISO(month, year)

  // Recebimentos por dia - busca todos os status para ter dados
  let qRec = supabase
    .from("contas_receber")
    .select("valor, vencimento, status")
    .gte("vencimento", fromISO)
    .lt("vencimento", toISO)
  if (tid) qRec = qRec.eq("tenant_id", tid)

  // Pagamentos por dia - busca todos os status para ter dados
  let qPag = supabase
    .from("contas_pagar")
    .select("valor, vencimento, status")
    .gte("vencimento", fromISO)
    .lt("vencimento", toISO)
  if (tid) qPag = qPag.eq("tenant_id", tid)

  const [{ data: recData }, { data: pagData }] = await Promise.all([qRec, qPag])

  // Mapeia por dia
  const daysInMonth = new Date(year, month, 0).getDate()
  const entradasMap: Record<number, number> = {}
  const saidasMap: Record<number, number> = {}

  for (let d = 1; d <= daysInMonth; d++) {
    entradasMap[d] = 0
    saidasMap[d] = 0
  }

  for (const r of (recData || [])) {
    const day = new Date(r.vencimento + "T00:00:00").getDate()
    entradasMap[day] = (entradasMap[day] || 0) + Number(r.valor)
  }

  for (const p of (pagData || [])) {
    const day = new Date(p.vencimento + "T00:00:00").getDate()
    saidasMap[day] = (saidasMap[day] || 0) + Number(p.valor)
  }

  const result: FluxoCaixaDiarioPoint[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const entradas = entradasMap[d] || 0
    const saidasAbs = saidasMap[d] || 0
    result.push({
      dia: d,
      entradas,
      saidas: -saidasAbs, // negativo para exibir barra para baixo
      saldo: entradas - saidasAbs,
    })
  }
  return result
}

export function useFluxoCaixaDiario(month: number, year: number) {
  const { tenant, mounted } = useTenant()
  const key = mounted ? ["fluxo-caixa-diario", tenant?.id ?? null, month, year] as [string, number | null, number, number] : null
  return useSWR(key, fetchFluxoCaixaDiario, { revalidateOnFocus: false })
}

// ─── Fluxo de Vendas Diário ────────────────────────��──────────────────────────

export interface FluxoVendasDiarioPoint {
  dia: number
  valor: number
}

export interface FluxoVendasDiarioResult {
  points: FluxoVendasDiarioPoint[]
  qtdVendas: number
}

async function fetchFluxoVendasDiario([, tid, month, year]: [string, number | null, number, number]): Promise<FluxoVendasDiarioResult> {
  const supabase = createClient()
  const { fromISO, toISO } = monthToISO(month, year)

  // Usa fetchAll para bypassar o limite de 1000 do Supabase
  const vendasData = await fetchAll<Record<string, unknown>>(
    tid
      ? supabase.from("vendas").select("valor_total, data_venda").gte("data_venda", fromISO).lt("data_venda", toISO).eq("tenant_id", tid)
      : supabase.from("vendas").select("valor_total, data_venda").gte("data_venda", fromISO).lt("data_venda", toISO)
  )

  const daysInMonth = new Date(year, month, 0).getDate()
  const dayMap: Record<number, number> = {}

  for (let d = 1; d <= daysInMonth; d++) {
    dayMap[d] = 0
  }

  const tzOffset = new Date().getTimezoneOffset()
  for (const r of (vendasData || [])) {
    const dt = new Date(r.data_venda as string)
    dt.setUTCMinutes(dt.getUTCMinutes() - tzOffset)
    const day = dt.getUTCDate()
    dayMap[day] = (dayMap[day] || 0) + Number(r.valor_total)
  }

  const points = Object.entries(dayMap).map(([dia, valor]) => ({
    dia: Number(dia),
    valor,
  }))

  return { points, qtdVendas: (vendasData || []).length }
}

export function useFluxoVendasDiario(month: number, year: number) {
  const { tenant, mounted } = useTenant()
  const key = mounted ? ["fluxo-vendas-diario", tenant?.id ?? null, month, year] as [string, number | null, number, number] : null
  return useSWR(key, fetchFluxoVendasDiario, { revalidateOnFocus: false })
}

// ─── DRE (estrutura de 11 grupos, conforme Modelo DRE.xlsx) ──────────────────

import { ESTRUTURA_DRE, calcularDRE, normalizarGrupoDRE } from "@/lib/dre-structure"

export interface DRECategoriaDetalhe {
  categoria_id: number
  categoria_nome: string
  codigo: string    // código DRE da folha (ex "1.1", "7.2")
  total: number
}

export interface DREData {
  valores: Record<string, number>          // código → valor calculado
  detalhePorCodigo: Record<string, DRECategoriaDetalhe[]>  // folhas por código para drill-down
}

async function fetchDRE([, tid, month, year]: [string, number | null, number, number]): Promise<DREData> {
  const supabase = createClient()

  // Usa horário local do browser para definir limites do mês
  // Converte para ISO UTC para que o Postgres filtre corretamente pelo fuso do usuário
  const fromISO = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString()
  const toISO = new Date(year, month, 1, 0, 0, 0, 0).toISOString()

  // vendas do período (entram em 1.1 Receita de Vendas por padrão)
  // Usa fetchAll para bypassar o limite de 1000 do Supabase
  const [recData, pagData, vendasData] = await Promise.all([
    fetchAll<Record<string, unknown>>(
      tid
        ? supabase.from("contas_receber").select("valor, status, categorias(id, nome, grupo_dre)").gte("vencimento", fromISO).lt("vencimento", toISO).eq("status", "recebido").eq("tenant_id", tid)
        : supabase.from("contas_receber").select("valor, status, categorias(id, nome, grupo_dre)").gte("vencimento", fromISO).lt("vencimento", toISO).eq("status", "recebido")
    ),
    fetchAll<Record<string, unknown>>(
      tid
        ? supabase.from("contas_pagar").select("valor, status, categorias(id, nome, grupo_dre)").gte("vencimento", fromISO).lt("vencimento", toISO).eq("status", "pago").eq("tenant_id", tid)
        : supabase.from("contas_pagar").select("valor, status, categorias(id, nome, grupo_dre)").gte("vencimento", fromISO).lt("vencimento", toISO).eq("status", "pago")
    ),
    fetchAll<Record<string, unknown>>(
      tid
        ? supabase.from("vendas").select("valor_total, data_venda").gte("data_venda", fromISO).lt("data_venda", toISO).eq("tenant_id", tid)
        : supabase.from("vendas").select("valor_total, data_venda").gte("data_venda", fromISO).lt("data_venda", toISO)
    ),
  ])

  // Agrega por código folha
  const folhas: Record<string, number> = {}
  const detalheMap: Record<string, Map<number, DRECategoriaDetalhe>> = {}

  function addRow(valor: number, cat: { id?: number; nome?: string; grupo_dre?: string } | null, fonteEsperada: "cr" | "cp") {
    const codigo = normalizarGrupoDRE(cat?.grupo_dre)
    if (!codigo) return
    const node = ESTRUTURA_DRE.find(n => n.codigo === codigo)
    if (!node || node.fonte !== fonteEsperada) return
    folhas[codigo] = (folhas[codigo] || 0) + valor
    if (!detalheMap[codigo]) detalheMap[codigo] = new Map()
    const key = cat?.id ?? 0
    const existing = detalheMap[codigo].get(key)
    if (existing) existing.total += valor
    else detalheMap[codigo].set(key, {
      categoria_id: cat?.id ?? 0,
      categoria_nome: cat?.nome || "(sem categoria)",
      codigo,
      total: valor,
    })
  }

  // 6.0 Recebimentos do Mês = soma de todos os contas_receber status=recebido (independente de categoria)
  let recebimentosMes = 0

  for (const r of (recData || [])) {
    const valor = Number(r.valor) || 0
    const catNome = ((r.categorias as { nome?: string } | null)?.nome || "")
    if (isTransferCat(catNome)) continue
    recebimentosMes += valor
    addRow(valor, r.categorias as { id?: number; nome?: string; grupo_dre?: string } | null, "cr")
  }
  folhas["6.0"] = recebimentosMes

  for (const p of (pagData || [])) {
    const valor = Number(p.valor) || 0
    addRow(valor, p.categorias as { id?: number; nome?: string; grupo_dre?: string } | null, "cp")
  }

  // vendas → 1.1 Receita de Vendas
  const totalVendas = (vendasData || []).reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0)
  if (totalVendas > 0) {
    folhas["1.1"] = (folhas["1.1"] || 0) + totalVendas
    if (!detalheMap["1.1"]) detalheMap["1.1"] = new Map()
    const existing = detalheMap["1.1"].get(-1)
    if (existing) existing.total += totalVendas
    else detalheMap["1.1"].set(-1, { categoria_id: -1, categoria_nome: "Vendas", codigo: "1.1", total: totalVendas })
  }

  const valores = calcularDRE(folhas)
  const detalhePorCodigo: Record<string, DRECategoriaDetalhe[]> = {}
  for (const k of Object.keys(detalheMap)) {
    detalhePorCodigo[k] = Array.from(detalheMap[k].values()).sort((a, b) => b.total - a.total)
  }

  return { valores, detalhePorCodigo }
}

export function useDRE(month: number, year: number) {
  const { tenant, mounted } = useTenant()
  const key = mounted ? ["dre", tenant?.id ?? null, month, year] as [string, number | null, number, number] : null
  return useSWR(key, fetchDRE, { revalidateOnFocus: false })
}

// ─── Lucro Bruto/Líquido para gráficos de rosca ───────────────────────────────

export interface LucroChartData {
  vendas: number
  saidas: number
  resultado: number
  percentual: number
}

export function useLucroBrutoChart(month: number, year: number) {
  const { data, isLoading } = useDRE(month, year)
  const v = data?.valores || {}

  const receitaBruta = v["1.0"] || 0
  const receitaLiquida = v["3.0"] || 0
  const custoDireto = v["4.0"] || 0
  const resultado = v["5.0"] || 0
  const percentual = receitaBruta !== 0 ? (resultado / receitaBruta) * 100 : 0

  const chartData: LucroChartData = {
    vendas: receitaLiquida,
    saidas: custoDireto,
    resultado,
    percentual,
  }

  return { data: chartData, isLoading }
}

export function useLucroLiquidoChart(month: number, year: number) {
  const { data, isLoading } = useDRE(month, year)
  const v = data?.valores || {}

  const receitaBruta = v["1.0"] || 0
  const recebimentos = v["6.0"] || 0
  const resultado = v["9.0"] || 0
  const totalSaidas = recebimentos - resultado
  const percentual = receitaBruta !== 0 ? (resultado / receitaBruta) * 100 : 0

  const chartData: LucroChartData = {
    vendas: recebimentos,
    saidas: totalSaidas > 0 ? totalSaidas : 0,
    resultado,
    percentual,
  }

  return { data: chartData, isLoading }
}
