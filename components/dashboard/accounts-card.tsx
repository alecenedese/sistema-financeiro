"use client"

import useSWR from "swr"
import { Landmark, CreditCard, Wallet, PiggyBank, TrendingUp, TrendingDown } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/hooks/use-tenant"
import { fetchAll } from "@/lib/supabase/fetch-all"

function iconForTipo(tipo: string) {
  const t = (tipo || "").toLowerCase()
  if (t.includes("corrente")) return Landmark
  if (t.includes("credito")) return CreditCard
  if (t.includes("poupan")) return PiggyBank
  return Wallet
}

const COLORS = ["#1B3A5C", "#2C5F8A", "#7A8FA6", "#A8B8C8", "#3D7AB5"]

interface AccountView {
  id: number
  nome: string
  tipo: string
  saldo_mes: number           // saldo acumulado até fim do mês selecionado
  saldo_mes_anterior: number  // saldo acumulado até fim do mês anterior
  mov_entradas: number        // receitas + lanc.receita do mês selecionado
  mov_saidas: number          // despesas + lanc.despesa do mês selecionado
}

function endOfMonth(year: number, month: number): string {
  const last = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`
}

async function fetchAccountsView([, tid, month, year]: [string, number | null, number, number]): Promise<AccountView[]> {
  const supabase = createClient()

  // 1. Contas com saldo_inicial
  let qC = supabase.from("contas_bancarias").select("id, nome, tipo, saldo_inicial").order("nome")
  if (tid) qC = qC.eq("tenant_id", tid)
  const { data: contas } = await qC

  const list = (contas || []).map(r => ({
    id: r.id as number,
    nome: r.nome as string,
    tipo: (r.tipo as string) || "",
    saldo_inicial: Number(r.saldo_inicial ?? 0),
  }))
  if (list.length === 0) return []

  const contaIds = list.map(c => c.id)

  // 2. Datas limite
  const fimMes = endOfMonth(year, month)
  const prevM = month === 1 ? 12 : month - 1
  const prevY = month === 1 ? year - 1 : year
  const fimMesAnterior = endOfMonth(prevY, prevM)
  const currFrom = `${year}-${String(month).padStart(2, "0")}-01`

  // 3. Queries acumuladas até fim do mês selecionado (usando fetchAll para paginação)
  const [recAte, pagAte, lancAte, recAnt, pagAnt, lancAnt, recCurr, pagCurr, lancCurr] = await Promise.all([
    fetchAll(tid
      ? supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).lte("vencimento", fimMes).eq("tenant_id", tid)
      : supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).lte("vencimento", fimMes)),
    fetchAll(tid
      ? supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).lte("vencimento", fimMes).eq("tenant_id", tid)
      : supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).lte("vencimento", fimMes)),
    fetchAll(tid
      ? supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).lte("data", fimMes).eq("tenant_id", tid)
      : supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).lte("data", fimMes)),
    fetchAll(tid
      ? supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).lte("vencimento", fimMesAnterior).eq("tenant_id", tid)
      : supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).lte("vencimento", fimMesAnterior)),
    fetchAll(tid
      ? supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).lte("vencimento", fimMesAnterior).eq("tenant_id", tid)
      : supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).lte("vencimento", fimMesAnterior)),
    fetchAll(tid
      ? supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).lte("data", fimMesAnterior).eq("tenant_id", tid)
      : supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).lte("data", fimMesAnterior)),
    fetchAll(tid
      ? supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).gte("vencimento", currFrom).lte("vencimento", fimMes).eq("tenant_id", tid)
      : supabase.from("contas_receber").select("valor, conta_bancaria_id").eq("status", "recebido").in("conta_bancaria_id", contaIds).gte("vencimento", currFrom).lte("vencimento", fimMes)),
    fetchAll(tid
      ? supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).gte("vencimento", currFrom).lte("vencimento", fimMes).eq("tenant_id", tid)
      : supabase.from("contas_pagar").select("valor, conta_bancaria_id").eq("status", "pago").in("conta_bancaria_id", contaIds).gte("vencimento", currFrom).lte("vencimento", fimMes)),
    fetchAll(tid
      ? supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).gte("data", currFrom).lte("data", fimMes).eq("tenant_id", tid)
      : supabase.from("lancamentos").select("valor, tipo, conta_bancaria_id").in("conta_bancaria_id", contaIds).gte("data", currFrom).lte("data", fimMes)),
  ])

  function sumByConta(rows: { valor: number | string; conta_bancaria_id: number }[]): Record<number, number> {
    const map: Record<number, number> = {}
    for (const r of rows) {
      map[r.conta_bancaria_id] = (map[r.conta_bancaria_id] || 0) + Number(r.valor)
    }
    return map
  }

  function sumLancByConta(rows: { valor: number | string; tipo: string; conta_bancaria_id: number }[]): { entradas: Record<number, number>, saidas: Record<number, number> } {
    const entradas: Record<number, number> = {}
    const saidas: Record<number, number> = {}
    for (const r of rows) {
      if (r.tipo === "receita") {
        entradas[r.conta_bancaria_id] = (entradas[r.conta_bancaria_id] || 0) + Number(r.valor)
      } else {
        saidas[r.conta_bancaria_id] = (saidas[r.conta_bancaria_id] || 0) + Number(r.valor)
      }
    }
    return { entradas, saidas }
  }

  const recAteMap = sumByConta(recAte as any)
  const pagAteMap = sumByConta(pagAte as any)
  const lancAteMap = sumLancByConta(lancAte as any)
  const recAntMap = sumByConta(recAnt as any)
  const pagAntMap = sumByConta(pagAnt as any)
  const lancAntMap = sumLancByConta(lancAnt as any)
  const recCurrMap = sumByConta(recCurr as any)
  const pagCurrMap = sumByConta(pagCurr as any)
  const lancCurrMap = sumLancByConta(lancCurr as any)

  return list.map(c => {
    const saldoMes = c.saldo_inicial
      + (recAteMap[c.id] || 0) - (pagAteMap[c.id] || 0)
      + (lancAteMap.entradas[c.id] || 0) - (lancAteMap.saidas[c.id] || 0)
    const saldoAnt = c.saldo_inicial
      + (recAntMap[c.id] || 0) - (pagAntMap[c.id] || 0)
      + (lancAntMap.entradas[c.id] || 0) - (lancAntMap.saidas[c.id] || 0)
    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      saldo_mes: saldoMes,
      saldo_mes_anterior: saldoAnt,
      mov_entradas: (recCurrMap[c.id] || 0) + (lancCurrMap.entradas[c.id] || 0),
      mov_saidas: (pagCurrMap[c.id] || 0) + (lancCurrMap.saidas[c.id] || 0),
    }
  })
}

function fmtBRL(v: number) {
  return `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
}

interface Props {
  month?: number
  year?: number
}

export function AccountsCard({ month, year }: Props = {}) {
  const { tenant, mounted } = useTenant()
  const tid = tenant?.id ?? null
  const now = new Date()
  const refMonth = month ?? now.getMonth() + 1
  const refYear = year ?? now.getFullYear()
  const key = mounted ? ["accounts-view", tid, refMonth, refYear] as [string, number | null, number, number] : null
  const { data: accounts = [], isLoading } = useSWR(key, fetchAccountsView, { revalidateOnFocus: false })

  const totalSaldoMes = accounts.reduce((a, c) => a + c.saldo_mes, 0)
  const totalSaldoAnt = accounts.reduce((a, c) => a + c.saldo_mes_anterior, 0)
  const totalMovEnt = accounts.reduce((a, c) => a + c.mov_entradas, 0)
  const totalMovSai = accounts.reduce((a, c) => a + c.mov_saidas, 0)
  const totalLiqMes = totalMovEnt - totalMovSai
  const variacao = totalSaldoMes - totalSaldoAnt

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-card-foreground">Contas Bancarias</h3>
        <Link href="/contas-bancarias" className="text-sm font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          Nenhuma conta cadastrada
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account, i) => {
            const Icon = iconForTipo(account.tipo)
            const color = COLORS[i % COLORS.length]
            const liqMes = account.mov_entradas - account.mov_saidas
            return (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{account.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    liq. mês: {fmtBRL(liqMes)} | ant: {fmtBRL(account.saldo_mes_anterior)}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${account.saldo_mes >= 0 ? "text-[#22C55E]" : "text-[#E53E3E]"}`}
                >
                  {fmtBRL(account.saldo_mes)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && accounts.length > 0 && (
        <div className="mt-4 space-y-2 rounded-lg bg-muted px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Saldo no mês</span>
            <span className={`text-base font-bold ${totalSaldoMes >= 0 ? "text-card-foreground" : "text-[#E53E3E]"}`}>
              {fmtBRL(totalSaldoMes)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Mês anterior</span>
            <span className="text-muted-foreground">{fmtBRL(totalSaldoAnt)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Movimentação (ent − sai)</span>
            <span className={totalLiqMes >= 0 ? "text-[#22C55E]" : "text-[#E53E3E]"}>{fmtBRL(totalLiqMes)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Variação</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${variacao >= 0 ? "text-[#22C55E]" : "text-[#E53E3E]"}`}>
              {variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {fmtBRL(variacao)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
