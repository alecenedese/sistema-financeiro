"use client"

import { Landmark, TrendingUp, TrendingDown, CreditCard } from "lucide-react"
import { useSummary, fmt } from "@/hooks/use-dashboard-data"

function Skeleton() {
  return <div className="h-7 w-28 animate-pulse rounded bg-muted" />
}

export function SummaryCards() {
  const { data, isLoading } = useSummary()

  const cards = [
    {
      label: "Saldo Atual",
      value: data ? fmt(data.saldo) : null,
      icon: Landmark,
      iconBg: "bg-[hsl(216,60%,22%)]",
    },
    {
      label: "Receitas do Mes",
      value: data ? fmt(data.receitas) : null,
      icon: TrendingUp,
      iconBg: "bg-[hsl(142,71%,40%)]",
    },
    {
      label: "Despesas do Mes",
      value: data ? fmt(data.despesas) : null,
      icon: TrendingDown,
      iconBg: "bg-[hsl(0,72%,51%)]",
    },
    {
      label: "Cartao de Credito",
      value: data ? fmt(data.cartao) : null,
      icon: CreditCard,
      iconBg: "bg-[hsl(216,20%,60%)]",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm border border-border"
        >
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <div className="mt-1 text-xl font-bold text-card-foreground">
              {isLoading || item.value === null ? <Skeleton /> : item.value}
            </div>
          </div>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.iconBg}`}>
            <item.icon className="h-6 w-6 text-white" />
          </div>
        </div>
      ))}
    </div>
  )
}
