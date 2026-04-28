"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/hooks/use-tenant"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { Loader2, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Scale, CheckCircle2, AlertTriangle } from "lucide-react"

type Tab = "movimentacao" | "conciliacao"

interface ContaRow {
  id: number
  nome: string
  cor: string | null
  saldo: number
  saldo_inicial: number
}

interface MovimentoMes {
  recebimentos: number
  pagamentos: number
  lancReceita: number
  lancDespesa: number
}

interface PorConta {
  conta: ContaRow
  atual: MovimentoMes
  anterior: MovimentoMes
  // para conciliação:
  totalRecebidoHistorico: number
  totalPagoHistorico: number
  totalLancReceitaHistorico: number
  totalLancDespesaHistorico: number
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function monthRange(year: number, monthIdx0: number) {
  // monthIdx0: 0..11
  const d = new Date(year, monthIdx0, 1)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const from = `${y}-${String(m).padStart(2, "0")}-01`
  const last = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`
  return { from, to, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) }
}

async function fetchConciliacao([, tid, month, year]: [string, number | null, number, number]): Promise<PorConta[]> {
  const supabase = createClient()

  // Contas
  let qC = supabase.from("contas_bancarias").select("id, nome, cor, saldo, saldo_inicial").order("nome")
  if (tid) qC = qC.eq("tenant_id", tid)
  const { data: contas } = await qC
  const contasList: ContaRow[] = (contas || []).map((r) => ({
    id: r.id as number,
    nome: r.nome as string,
    cor: (r.cor as string) || "#2C5F8A",
    saldo: Number(r.saldo ?? 0),
    saldo_inicial: Number(r.saldo_inicial ?? 0),
  }))

  if (contasList.length === 0) return []

  const contaIds = contasList.map(c => c.id)
  const curr = monthRange(year, month - 1)
  const prev = monthRange(year, month - 2)

  // Usando fetchAll para paginação automática (Supabase hard limit = 1000)
  const [recAtual, recAnt, recTotal, pagAtual, pagAnt, pagTotal, lancTotal, lancAtual, lancAnt] = await Promise.all([
    fetchAll(tid
      ? supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).gte("vencimento", curr.from).lte("vencimento", curr.to).eq("tenant_id", tid)
      : supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).gte("vencimento", curr.from).lte("vencimento", curr.to)),
    fetchAll(tid
      ? supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).gte("vencimento", prev.from).lte("vencimento", prev.to).eq("tenant_id", tid)
      : supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).gte("vencimento", prev.from).lte("vencimento", prev.to)),
    fetchAll(tid
      ? supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).eq("tenant_id", tid)
      : supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds)),
    fetchAll(tid
      ? supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).gte("vencimento", curr.from).lte("vencimento", curr.to).eq("tenant_id", tid)
      : supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).gte("vencimento", curr.from).lte("vencimento", curr.to)),
    fetchAll(tid
      ? supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).gte("vencimento", prev.from).lte("vencimento", prev.to).eq("tenant_id", tid)
      : supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).gte("vencimento", prev.from).lte("vencimento", prev.to)),
    fetchAll(tid
      ? supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).eq("tenant_id", tid)
      : supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds)),
    fetchAll(tid
      ? supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).eq("tenant_id", tid)
      : supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds)),
    fetchAll(tid
      ? supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).gte("data", curr.from).lte("data", curr.to).eq("tenant_id", tid)
      : supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).gte("data", curr.from).lte("data", curr.to)),
    fetchAll(tid
      ? supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).gte("data", prev.from).lte("data", prev.to).eq("tenant_id", tid)
      : supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).gte("data", prev.from).lte("data", prev.to)),
  ])

  function sumByConta(rows: { valor: number | string; conta_bancaria_id: number }[]): Record<number, number> {
    const map: Record<number, number> = {}
    for (const r of rows) {
      const id = r.conta_bancaria_id
      map[id] = (map[id] || 0) + Number(r.valor)
    }
    return map
  }

  const recAtualMap = sumByConta(recAtual as any)
  const recAntMap = sumByConta(recAnt as any)
  const recTotalMap = sumByConta(recTotal as any)
  const pagAtualMap = sumByConta(pagAtual as any)
  const pagAntMap = sumByConta(pagAnt as any)
  const pagTotalMap = sumByConta(pagTotal as any)

  function sumLancByConta(rows: { valor: number | string; tipo: string; conta_bancaria_id: number }[]): { rec: Record<number, number>, desp: Record<number, number> } {
    const rec: Record<number, number> = {}
    const desp: Record<number, number> = {}
    for (const r of rows) {
      if (r.tipo === "receita") rec[r.conta_bancaria_id] = (rec[r.conta_bancaria_id] || 0) + Number(r.valor)
      else desp[r.conta_bancaria_id] = (desp[r.conta_bancaria_id] || 0) + Number(r.valor)
    }
    return { rec, desp }
  }
  const lancTotalMap = sumLancByConta(lancTotal as any)
  const lancAtualMap = sumLancByConta(lancAtual as any)
  const lancAntMap = sumLancByConta(lancAnt as any)

  return contasList.map(conta => ({
    conta,
    atual: {
      recebimentos: recAtualMap[conta.id] || 0,
      pagamentos: pagAtualMap[conta.id] || 0,
      lancReceita: lancAtualMap.rec[conta.id] || 0,
      lancDespesa: lancAtualMap.desp[conta.id] || 0,
    },
    anterior: {
      recebimentos: recAntMap[conta.id] || 0,
      pagamentos: pagAntMap[conta.id] || 0,
      lancReceita: lancAntMap.rec[conta.id] || 0,
      lancDespesa: lancAntMap.desp[conta.id] || 0,
    },
    totalRecebidoHistorico: recTotalMap[conta.id] || 0,
    totalPagoHistorico: pagTotalMap[conta.id] || 0,
    totalLancReceitaHistorico: lancTotalMap.rec[conta.id] || 0,
    totalLancDespesaHistorico: lancTotalMap.desp[conta.id] || 0,
  }))
}

interface Props {
  title?: string
  defaultTab?: Tab
  /** Mês de referência 1..12 (default: mês atual) */
  month?: number
  /** Ano de referência (default: ano atual) */
  year?: number
}

export function ConciliacaoContas({ title = "Movimentação e Conciliação", defaultTab = "movimentacao", month, year }: Props) {
  const { tenant, mounted } = useTenant()
  const tid = tenant?.id ?? null
  const now = new Date()
  const refMonth = month ?? now.getMonth() + 1 // 1..12
  const refYear = year ?? now.getFullYear()
  const key = mounted
    ? ["conciliacao-contas", tid, refMonth, refYear] as [string, number | null, number, number]
    : null
  const { data, isLoading } = useSWR(key, fetchConciliacao, { revalidateOnFocus: false })
  const [tab, setTab] = useState<Tab>(defaultTab)

  const rows = data || []
  const currLabel = monthRange(refYear, refMonth - 1).label
  const prevLabel = monthRange(refYear, refMonth - 2).label

  // Totais para o header das seções
  const totals = useMemo(() => {
    let recAtual = 0, pagAtual = 0, recAnt = 0, pagAnt = 0
    let lancRecAtual = 0, lancDespAtual = 0, lancRecAnt = 0, lancDespAnt = 0
    let saldoReal = 0, saldoEsperado = 0
    for (const r of rows) {
      recAtual += r.atual.recebimentos
      pagAtual += r.atual.pagamentos
      recAnt += r.anterior.recebimentos
      pagAnt += r.anterior.pagamentos
      lancRecAtual += r.atual.lancReceita
      lancDespAtual += r.atual.lancDespesa
      lancRecAnt += r.anterior.lancReceita
      lancDespAnt += r.anterior.lancDespesa
      saldoReal += r.conta.saldo
      saldoEsperado += r.conta.saldo_inicial + r.totalRecebidoHistorico - r.totalPagoHistorico + r.totalLancReceitaHistorico - r.totalLancDespesaHistorico
    }
    const totalEntAtual = recAtual + lancRecAtual
    const totalSaiAtual = pagAtual + lancDespAtual
    const totalEntAnt = recAnt + lancRecAnt
    const totalSaiAnt = pagAnt + lancDespAnt
    return {
      recAtual, pagAtual, lancRecAtual, lancDespAtual,
      totalEntAtual, totalSaiAtual, liqAtual: totalEntAtual - totalSaiAtual,
      recAnt, pagAnt, lancRecAnt, lancDespAnt,
      totalEntAnt, totalSaiAnt, liqAnt: totalEntAnt - totalSaiAnt,
      saldoReal, saldoEsperado, diferenca: saldoReal - saldoEsperado,
    }
  }, [rows])

  function pctVar(cur: number, prev: number): string {
    if (prev === 0) return cur === 0 ? "0%" : "—"
    const pct = ((cur - prev) / Math.abs(prev)) * 100
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-card-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">Acompanhe o fluxo do mês e verifique se o saldo está batendo com as contas a pagar/receber.</p>
        </div>
        <div className="flex rounded-lg border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab("movimentacao")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === "movimentacao" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Scale className="h-3.5 w-3.5" />
            Movimentação
          </button>
          <button
            type="button"
            onClick={() => setTab("conciliacao")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === "conciliacao" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Conciliação
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          Nenhuma conta cadastrada
        </div>
      ) : tab === "movimentacao" ? (
        <div>
          {/* Summary row */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entradas {currLabel}</p>
              <p className="mt-1 text-base font-bold text-[hsl(142,71%,40%)]">{formatCurrency(totals.totalEntAtual)}</p>
              <p className="text-[10px] text-muted-foreground">ant: {formatCurrency(totals.totalEntAnt)} <span className="ml-1 font-medium">{pctVar(totals.totalEntAtual, totals.totalEntAnt)}</span></p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saídas {currLabel}</p>
              <p className="mt-1 text-base font-bold text-[hsl(0,72%,51%)]">{formatCurrency(totals.totalSaiAtual)}</p>
              <p className="text-[10px] text-muted-foreground">ant: {formatCurrency(totals.totalSaiAnt)} <span className="ml-1 font-medium">{pctVar(totals.totalSaiAtual, totals.totalSaiAnt)}</span></p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo do mês</p>
              <p className={`mt-1 text-base font-bold ${totals.liqAtual >= 0 ? "text-[hsl(142,71%,40%)]" : "text-[hsl(0,72%,51%)]"}`}>{formatCurrency(totals.liqAtual)}</p>
              <p className="text-[10px] text-muted-foreground">ant: {formatCurrency(totals.liqAnt)} <span className="ml-1 font-medium">{pctVar(totals.liqAtual, totals.liqAnt)}</span></p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo Real</p>
              <p className={`mt-1 text-base font-bold ${totals.saldoReal >= 0 ? "text-card-foreground" : "text-[hsl(0,72%,51%)]"}`}>{formatCurrency(totals.saldoReal)}</p>
              <p className="text-[10px] text-muted-foreground">soma de todas as contas</p>
            </div>
          </div>

          {/* Per-account table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entradas</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saídas</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Líquido</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">vs {prevLabel}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const entAtual = r.atual.recebimentos + r.atual.lancReceita
                  const saiAtual = r.atual.pagamentos + r.atual.lancDespesa
                  const liqAtual = entAtual - saiAtual
                  const entAnt = r.anterior.recebimentos + r.anterior.lancReceita
                  const saiAnt = r.anterior.pagamentos + r.anterior.lancDespesa
                  const liqAnt = entAnt - saiAnt
                  const variacao = liqAtual - liqAnt
                  return (
                    <tr key={r.conta.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.conta.cor || "#2C5F8A" }} />
                          <span className="font-medium text-card-foreground">{r.conta.nome}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-[hsl(142,71%,40%)]">{formatCurrency(entAtual)}</td>
                      <td className="px-2 py-2 text-right text-[hsl(0,72%,51%)]">{formatCurrency(saiAtual)}</td>
                      <td className={`px-2 py-2 text-right font-semibold ${liqAtual >= 0 ? "text-card-foreground" : "text-[hsl(0,72%,51%)]"}`}>{formatCurrency(liqAtual)}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1 text-xs">
                          {variacao >= 0
                            ? <TrendingUp className="h-3.5 w-3.5 text-[hsl(142,71%,40%)]" />
                            : <TrendingDown className="h-3.5 w-3.5 text-[hsl(0,72%,51%)]" />}
                          <span className={variacao >= 0 ? "text-[hsl(142,71%,40%)]" : "text-[hsl(0,72%,51%)]"}>
                            {pctVar(liqAtual, liqAnt)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          {/* Conciliação summary */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo Real</p>
              <p className="mt-1 text-base font-bold text-card-foreground">{formatCurrency(totals.saldoReal)}</p>
              <p className="text-[10px] text-muted-foreground">cadastrado nas contas</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo Esperado</p>
              <p className="mt-1 text-base font-bold text-card-foreground">{formatCurrency(totals.saldoEsperado)}</p>
              <p className="text-[10px] text-muted-foreground">inicial + recebidos − pagos</p>
            </div>
            <div className={`rounded-lg border p-3 ${Math.abs(totals.diferenca) < 0.01 ? "border-[hsl(142,71%,40%)]/40 bg-[hsl(142,71%,40%)]/5" : "border-[hsl(38,92%,50%)]/40 bg-[hsl(38,92%,50%)]/5"}`}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Diferença</p>
              <div className="mt-1 flex items-center gap-1.5">
                {Math.abs(totals.diferenca) < 0.01
                  ? <CheckCircle2 className="h-4 w-4 text-[hsl(142,71%,40%)]" />
                  : <AlertTriangle className="h-4 w-4 text-[hsl(38,92%,50%)]" />}
                <p className={`text-base font-bold ${Math.abs(totals.diferenca) < 0.01 ? "text-[hsl(142,71%,40%)]" : "text-[hsl(38,92%,50%)]"}`}>
                  {formatCurrency(totals.diferenca)}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">real − esperado</p>
            </div>
          </div>

          {/* Per-account reconciliation table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saldo Inicial</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">+ Recebidos</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">− Pagos</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">+ Lanç. Rec</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">− Lanç. Desp</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Esperado</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Real</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const esperado = r.conta.saldo_inicial + r.totalRecebidoHistorico - r.totalPagoHistorico + r.totalLancReceitaHistorico - r.totalLancDespesaHistorico
                  const diff = r.conta.saldo - esperado
                  const ok = Math.abs(diff) < 0.01
                  return (
                    <tr key={r.conta.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.conta.cor || "#2C5F8A" }} />
                          <span className="font-medium text-card-foreground">{r.conta.nome}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{formatCurrency(r.conta.saldo_inicial)}</td>
                      <td className="px-2 py-2 text-right text-[hsl(142,71%,40%)]">{formatCurrency(r.totalRecebidoHistorico)}</td>
                      <td className="px-2 py-2 text-right text-[hsl(0,72%,51%)]">{formatCurrency(r.totalPagoHistorico)}</td>
                      <td className="px-2 py-2 text-right text-[hsl(142,71%,40%)]">{formatCurrency(r.totalLancReceitaHistorico)}</td>
                      <td className="px-2 py-2 text-right text-[hsl(0,72%,51%)]">{formatCurrency(r.totalLancDespesaHistorico)}</td>
                      <td className="px-2 py-2 text-right font-medium text-card-foreground">{formatCurrency(esperado)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-card-foreground">{formatCurrency(r.conta.saldo)}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {ok
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(142,71%,40%)]" />
                            : (diff > 0 ? <ArrowUp className="h-3.5 w-3.5 text-[hsl(38,92%,50%)]" /> : <ArrowDown className="h-3.5 w-3.5 text-[hsl(0,72%,51%)]" />)}
                          <span className={`text-xs font-semibold ${ok ? "text-[hsl(142,71%,40%)]" : "text-[hsl(38,92%,50%)]"}`}>
                            {ok ? "OK" : formatCurrency(diff)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Uma diferença ≠ 0 significa que as contas a pagar/receber não estão batendo com o saldo real da conta —
            pode ser que haja lançamentos não categorizados, status pendentes ou ajustes manuais no saldo.
          </p>
        </div>
      )}
    </div>
  )
}
