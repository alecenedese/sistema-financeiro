"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { getActiveTenantId, useTenant } from "@/hooks/use-tenant"

interface BudgetItem {
  category: string
  spent: number
  color: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value)
}

async function fetchBudgetData(): Promise<BudgetItem[]> {
  const supabase = createClient()
  const tid = getActiveTenantId()

  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`

  let q = supabase
    .from("lancamentos")
    .select("valor, tipo, categorias(id, nome, cor)")
    .eq("tipo", "despesa")
    .eq("status", "confirmado")
    .gte("data", from)
    .lte("data", to)

  if (tid) q = q.eq("tenant_id", tid)

  const { data } = await q

  if (!data || data.length === 0) return []

  // Agrupa gastos por categoria
  const map: Record<string, { nome: string; cor: string; spent: number }> = {}
  for (const row of data) {
    const cat = row.categorias as { id: number; nome: string; cor: string } | null
    if (!cat) continue
    const key = String(cat.id)
    if (!map[key]) map[key] = { nome: cat.nome, cor: cat.cor || "#7A8FA6", spent: 0 }
    map[key].spent += Number(row.valor)
  }

  return Object.values(map)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6)
    .map((item) => ({
      category: item.nome,
      spent: item.spent,
      color: item.cor,
    }))
}

export function BudgetCard() {
  const { tenant } = useTenant()
  const swrKey = tenant ? `budget-card-t${tenant.id}` : null

  const { data: items, isLoading } = useSWR(swrKey, fetchBudgetData, {
    revalidateOnFocus: false,
  })

  const budgetItems = items ?? []
  const totalSpent = budgetItems.reduce((acc, i) => acc + i.spent, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-card-foreground">Orcamento</h3>
        <span className="text-xs text-muted-foreground">
          {isLoading ? "..." : `${formatCurrency(totalSpent)} este mes`}
        </span>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && budgetItems.length === 0 && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Nenhum gasto registrado este mes.
        </div>
      )}

      {!isLoading && budgetItems.length > 0 && (
        <>
          {/* Barra total */}
          <div className="mb-6">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-card-foreground">Total em despesas</span>
              <span className="text-sm font-semibold text-card-foreground">{formatCurrency(totalSpent)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-primary" />
            </div>
          </div>

          {/* Por categoria */}
          <div className="space-y-4">
            {budgetItems.map((item) => {
              const pct = totalSpent > 0 ? Math.round((item.spent / totalSpent) * 100) : 0
              return (
                <div key={item.category}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-muted-foreground">{item.category}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(item.spent)} &middot; {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
