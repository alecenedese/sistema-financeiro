"use client"

import { Landmark, TrendingUp, TrendingDown, CreditCard } from "lucide-react"

const summaryData = [
  {
    label: "Saldo Atual",
    value: "R$ 7.091,60",
    icon: Landmark,
    iconBg: "bg-[hsl(216,60%,22%)]",
    iconColor: "text-white",
  },
  {
    label: "Receitas",
    value: "R$ 5.505,50",
    icon: TrendingUp,
    iconBg: "bg-[hsl(142,71%,40%)]",
    iconColor: "text-white",
  },
  {
    label: "Despesas",
    value: "R$ 4.024,00",
    icon: TrendingDown,
    iconBg: "bg-[hsl(0,72%,51%)]",
    iconColor: "text-white",
  },
  {
    label: "Cartao de Credito",
    value: "R$ 480,00",
    icon: CreditCard,
    iconBg: "bg-[hsl(216,20%,60%)]",
    iconColor: "text-white",
  },
]

export function SummaryCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {summaryData.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm border border-border"
        >
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-xl font-bold text-card-foreground">
              {item.value}
            </p>
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.iconBg}`}
          >
            <item.icon className={`h-6 w-6 ${item.iconColor}`} />
          </div>
        </div>
      ))}
    </div>
  )
}
