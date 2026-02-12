"use client"

import { Landmark, CreditCard, Wallet } from "lucide-react"

const accounts = [
  {
    name: "Nubank",
    type: "Conta Corrente",
    balance: 3241.6,
    icon: Landmark,
    color: "#1B3A5C",
  },
  {
    name: "Bradesco",
    type: "Conta Corrente",
    balance: 2150.0,
    icon: Landmark,
    color: "#2C5F8A",
  },
  {
    name: "Caixa",
    type: "Poupanca",
    balance: 1700.0,
    icon: Wallet,
    color: "#7A8FA6",
  },
  {
    name: "Nubank",
    type: "Cartao de Credito",
    balance: -480.0,
    icon: CreditCard,
    color: "#A8B8C8",
  },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function AccountsCard() {
  const totalBalance = accounts.reduce((acc, item) => acc + item.balance, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-card-foreground">Minhas Contas</h3>
        <a
          href="#"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todas
        </a>
      </div>

      <div className="space-y-3">
        {accounts.map((account, i) => (
          <div
            key={`${account.name}-${account.type}-${i}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${account.color}18` }}
            >
              <account.icon
                className="h-5 w-5"
                style={{ color: account.color }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground">{account.name}</p>
              <p className="text-xs text-muted-foreground">{account.type}</p>
            </div>
            <span
              className={`text-sm font-semibold ${
                account.balance >= 0
                  ? "text-card-foreground"
                  : "text-[hsl(0,72%,51%)]"
              }`}
            >
              {formatCurrency(account.balance)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Saldo Total</span>
        <span className="text-base font-bold text-card-foreground">
          {formatCurrency(totalBalance)}
        </span>
      </div>
    </div>
  )
}
