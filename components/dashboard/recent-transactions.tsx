"use client"

import { ArrowUpRight, ArrowDownLeft } from "lucide-react"
import Link from "next/link"
import { useRecentTx, fmt } from "@/hooks/use-dashboard-data"

export function RecentTransactions() {
  const { data: transactions = [], isLoading } = useRecentTx()

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-card-foreground">Transacoes Recentes</h3>
        <Link href="/transacoes" className="text-sm font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Nenhum lancamento encontrado
        </div>
      ) : (
        <div className="space-y-1">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  tx.tipo === "receber" ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(0,72%,51%)]/10"
                }`}
              >
                {tx.tipo === "receber" ? (
                  <ArrowUpRight className="h-5 w-5 text-[hsl(142,71%,40%)]" />
                ) : (
                  <ArrowDownLeft className="h-5 w-5 text-[hsl(0,72%,51%)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-card-foreground">{tx.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {tx.categoria} &middot; {tx.data}
                </p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  tx.tipo === "receber" ? "text-[#22C55E]" : "text-[#E53E3E]"
                }`}
              >
                {tx.tipo === "receber" ? "+ " : "- "}R$ {tx.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
