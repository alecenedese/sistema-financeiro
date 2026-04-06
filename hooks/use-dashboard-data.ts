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

// ─── fetchers ─────────────────────────────────────────────────────────────────

async function fetchSummary([, tid]: TidKey): Promise<SummaryData> {
  const supabase = createClient()
  const { from, to } = mesRange(0)

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
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to = `${year}-${String(month).padStart(2, "0")}-31`

  // Faturamento (vendas - contas a receber com status confirmado/recebido)
  let qFat = supabase
    .from("contas_receber")
    .select("valor, status")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qFat = qFat.eq("tenant_id", tid)

  // Pagamentos (contas a pagar com status pago/confirmado)
  let qPag = supabase
    .from("contas_pagar")
    .select("valor, status")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qPag = qPag.eq("tenant_id", tid)

  // Saldo em conta
  let qContas = supabase.from("contas_bancarias").select("saldo")
  if (tid) qContas = qContas.eq("tenant_id", tid)

  const [{ data: receberData }, { data: pagarData }, { data: contasData }] = await Promise.all([
    qFat, qPag, qContas,
  ])

  // Faturamento = total de contas a receber (independente do status, é o faturamento do período)
  const faturamento = (receberData || []).reduce((acc, r) => acc + Number(r.valor), 0)

  // Recebimentos = contas a receber que foram efetivamente recebidas
  const recebimentos = (receberData || [])
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
  const { tenant } = useTenant()
  const key = ["dashboard-mensal", tenant?.id ?? null, month, year] as [string, number | null, number, number]
  return useSWR(key, fetchDashboardMensal, { revalidateOnFocus: false })
}

// ─── Fluxo de Caixa Diário ────────────────────────────────────────────────────

export interface FluxoCaixaDiarioPoint {
  dia: number
  valor: number
}

async function fetchFluxoCaixaDiario([, tid, month, year]: [string, number | null, number, number]): Promise<FluxoCaixaDiarioPoint[]> {
  const supabase = createClient()
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to = `${year}-${String(month).padStart(2, "0")}-31`

  console.log("[v0] fetchFluxoCaixaDiario - tid:", tid, "month:", month, "year:", year, "from:", from, "to:", to)

  // Recebimentos por dia - busca todos os status para ter dados
  let qRec = supabase
    .from("contas_receber")
    .select("valor, vencimento, status")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qRec = qRec.eq("tenant_id", tid)

  // Pagamentos por dia - busca todos os status para ter dados
  let qPag = supabase
    .from("contas_pagar")
    .select("valor, vencimento, status")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qPag = qPag.eq("tenant_id", tid)

  const [{ data: recData, error: recError }, { data: pagData, error: pagError }] = await Promise.all([qRec, qPag])
  
  console.log("[v0] fetchFluxoCaixaDiario - recData:", recData?.length, "pagData:", pagData?.length, "recError:", recError, "pagError:", pagError)

  // Mapeia por dia
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayMap: Record<number, number> = {}

  for (let d = 1; d <= daysInMonth; d++) {
    dayMap[d] = 0
  }

  for (const r of (recData || [])) {
    const day = new Date(r.vencimento + "T00:00:00").getDate()
    dayMap[day] = (dayMap[day] || 0) + Number(r.valor)
  }

  for (const p of (pagData || [])) {
    const day = new Date(p.vencimento + "T00:00:00").getDate()
    dayMap[day] = (dayMap[day] || 0) - Number(p.valor)
  }

  return Object.entries(dayMap).map(([dia, valor]) => ({
    dia: Number(dia),
    valor,
  }))
}

export function useFluxoCaixaDiario(month: number, year: number) {
  const { tenant } = useTenant()
  const key = ["fluxo-caixa-diario", tenant?.id ?? null, month, year] as [string, number | null, number, number]
  return useSWR(key, fetchFluxoCaixaDiario, { revalidateOnFocus: false })
}

// ─── Fluxo de Vendas Diário ────────────────────────��──────────────────────────

export interface FluxoVendasDiarioPoint {
  dia: number
  valor: number
}

async function fetchFluxoVendasDiario([, tid, month, year]: [string, number | null, number, number]): Promise<FluxoVendasDiarioPoint[]> {
  const supabase = createClient()
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to = `${year}-${String(month).padStart(2, "0")}-31`

  let qRec = supabase
    .from("contas_receber")
    .select("valor, vencimento")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qRec = qRec.eq("tenant_id", tid)

  const { data: recData } = await qRec

  const daysInMonth = new Date(year, month, 0).getDate()
  const dayMap: Record<number, number> = {}

  for (let d = 1; d <= daysInMonth; d++) {
    dayMap[d] = 0
  }

  for (const r of (recData || [])) {
    const day = new Date(r.vencimento + "T00:00:00").getDate()
    dayMap[day] = (dayMap[day] || 0) + Number(r.valor)
  }

  return Object.entries(dayMap).map(([dia, valor]) => ({
    dia: Number(dia),
    valor,
  }))
}

export function useFluxoVendasDiario(month: number, year: number) {
  const { tenant } = useTenant()
  const key = ["fluxo-vendas-diario", tenant?.id ?? null, month, year] as [string, number | null, number, number]
  return useSWR(key, fetchFluxoVendasDiario, { revalidateOnFocus: false })
}

// ─── DRE ──────────────────────────────────────────────────────────────────────

export interface DREData {
  receitaOperacionalBruta: number
  deducoesReceitaBruta: number
  receitaLiquida: number
  custoDiretoVendas: number
  lucroBruto: number
  despesasOperacionais: number
  ebitda: number
  outrasReceitasNaoOperacionais: number
  outrasDespesasNaoOperacionais: number
  irCsll: number
  lucroLiquidoPeriodo: number
}

async function fetchDRE([, tid, month, year]: [string, number | null, number, number]): Promise<DREData> {
  const supabase = createClient()
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to = `${year}-${String(month).padStart(2, "0")}-31`

  // Busca contas a receber com categoria e grupo DRE
  let qRec = supabase
    .from("contas_receber")
    .select("valor, status, categorias(nome, grupo_dre)")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qRec = qRec.eq("tenant_id", tid)

  // Busca contas a pagar com categoria e grupo DRE
  let qPag = supabase
    .from("contas_pagar")
    .select("valor, status, categorias(nome, grupo_dre)")
    .gte("vencimento", from)
    .lte("vencimento", to)
  if (tid) qPag = qPag.eq("tenant_id", tid)

  const [{ data: recData }, { data: pagData }] = await Promise.all([qRec, qPag])

  // Inicializa valores
  let receitaOperacionalBruta = 0
  let deducoesReceitaBruta = 0
  let custoDiretoVendas = 0
  let despesasOperacionais = 0
  let outrasReceitasNaoOperacionais = 0
  let outrasDespesasNaoOperacionais = 0
  let irCsll = 0

  // Processa receitas
  for (const r of (recData || [])) {
    if (r.status !== "recebido" && r.status !== "confirmado") continue
    const valor = Number(r.valor)
    const grupoDre = (r.categorias as { grupo_dre?: string } | null)?.grupo_dre || ""

    switch (grupoDre) {
      case "receita_operacional_bruta":
        receitaOperacionalBruta += valor
        break
      case "deducoes_receita_bruta":
        deducoesReceitaBruta += valor
        break
      case "outras_receitas_nao_operacionais":
        outrasReceitasNaoOperacionais += valor
        break
      default:
        receitaOperacionalBruta += valor
    }
  }

  // Processa despesas
  for (const p of (pagData || [])) {
    if (p.status !== "pago" && p.status !== "confirmado") continue
    const valor = Number(p.valor)
    const grupoDre = (p.categorias as { grupo_dre?: string } | null)?.grupo_dre || ""

    switch (grupoDre) {
      case "custo_direto_vendas":
        custoDiretoVendas += valor
        break
      case "despesas_operacionais":
        despesasOperacionais += valor
        break
      case "outras_despesas_nao_operacionais":
        outrasDespesasNaoOperacionais += valor
        break
      case "ir_csll":
        irCsll += valor
        break
      default:
        despesasOperacionais += valor
    }
  }

  const receitaLiquida = receitaOperacionalBruta - deducoesReceitaBruta
  const lucroBruto = receitaLiquida - custoDiretoVendas
  const ebitda = lucroBruto - despesasOperacionais
  const lucroLiquidoPeriodo = ebitda + outrasReceitasNaoOperacionais - outrasDespesasNaoOperacionais - irCsll

  return {
    receitaOperacionalBruta,
    deducoesReceitaBruta,
    receitaLiquida,
    custoDiretoVendas,
    lucroBruto,
    despesasOperacionais,
    ebitda,
    outrasReceitasNaoOperacionais,
    outrasDespesasNaoOperacionais,
    irCsll,
    lucroLiquidoPeriodo,
  }
}

export function useDRE(month: number, year: number) {
  const { tenant } = useTenant()
  const key = ["dre", tenant?.id ?? null, month, year] as [string, number | null, number, number]
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
  const { data, isLoading } = useDashboardMensal(month, year)
  
  const chartData: LucroChartData = {
    vendas: data?.faturamento ?? 0,
    saidas: data?.pagamentos ?? 0,
    resultado: data?.lucroBruto ?? 0,
    percentual: data?.percLucroBruto ?? 0,
  }

  return { data: chartData, isLoading }
}

export function useLucroLiquidoChart(month: number, year: number) {
  const { data, isLoading } = useDashboardMensal(month, year)
  
  const chartData: LucroChartData = {
    vendas: data?.recebimentos ?? 0,
    saidas: data?.pagamentos ?? 0,
    resultado: data?.lucroLiquido ?? 0,
    percentual: data?.percLucroLiquido ?? 0,
  }

  return { data: chartData, isLoading }
}
