"use client"

import {
  Home,
  Car,
  ShoppingCart,
  Briefcase,
  Laptop,
  Utensils,
  Heart,
  Zap,
} from "lucide-react"

const transactions = [
  {
    id: 1,
    description: "Aluguel",
    category: "Moradia",
    date: "05/02/2026",
    value: -1290.0,
    icon: Home,
    color: "#1B3A5C",
  },
  {
    id: 2,
    description: "Salario",
    category: "Salario",
    date: "01/02/2026",
    value: 4200.0,
    icon: Briefcase,
    color: "#2C5F8A",
  },
  {
    id: 3,
    description: "Combustivel",
    category: "Transporte",
    date: "03/02/2026",
    value: -250.0,
    icon: Car,
    color: "#3D7AB5",
  },
  {
    id: 4,
    description: "Supermercado",
    category: "Alimentacao",
    date: "02/02/2026",
    value: -485.5,
    icon: ShoppingCart,
    color: "#7A8FA6",
  },
  {
    id: 5,
    description: "Freelancer - Projeto Web",
    category: "Freelancer",
    date: "04/02/2026",
    value: 800.0,
    icon: Laptop,
    color: "#2C5F8A",
  },
  {
    id: 6,
    description: "Restaurante",
    category: "Alimentacao",
    date: "06/02/2026",
    value: -89.9,
    icon: Utensils,
    color: "#A8B8C8",
  },
  {
    id: 7,
    description: "Plano de Saude",
    category: "Saude",
    date: "05/02/2026",
    value: -350.0,
    icon: Heart,
    color: "#1B3A5C",
  },
  {
    id: 8,
    description: "Conta de Energia",
    category: "Moradia",
    date: "07/02/2026",
    value: -185.0,
    icon: Zap,
    color: "#3D7AB5",
  },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(value))
}

export function RecentTransactions() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-card-foreground">
          Transacoes Recentes
        </h3>
        <a
          href="#"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todas
        </a>
      </div>
      <div className="space-y-1">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${tx.color}18` }}
            >
              <tx.icon className="h-5 w-5" style={{ color: tx.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">
                {tx.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {tx.category} &middot; {tx.date}
              </p>
            </div>
            <span
              className={`text-sm font-semibold ${
                tx.value >= 0 ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"
              }`}
            >
              {tx.value >= 0 ? "+" : "-"} {formatCurrency(tx.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
