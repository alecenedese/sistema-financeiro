"use client"

import { Landmark, CreditCard, Wallet, PiggyBank } from "lucide-react"
import Link from "next/link"
import { useAccounts, fmt } from "@/hooks/use-dashboard-data"

function iconForTipo(tipo: string) {
  const t = (tipo || "").toLowerCase()
  if (t.includes("corrente")) return Landmark
  if (t.includes("credito")) return CreditCard
  if (t.includes("poupan")) return PiggyBank
  return Wallet
}

const COLORS = ["#1B3A5C", "#2C5F8A", "#7A8FA6", "#A8B8C8", "#3D7AB5"]

export function AccountsCard() {
  const { data: accounts = [], isLoading } = useAccounts()
  const totalBalance = accounts.reduce((acc, a) => acc + a.saldo_atual, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-card-foreground">Minhas Contas</h3>
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
                  <p className="text-xs text-muted-foreground">{account.tipo}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    account.saldo_atual >= 0 ? "text-card-foreground" : "text-[hsl(0,72%,51%)]"
                  }`}
                >
                  {fmt(account.saldo_atual)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && accounts.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Saldo Total</span>
          <span className="text-base font-bold text-card-foreground">{fmt(totalBalance)}</span>
        </div>
      )}
    </div>
  )
}
