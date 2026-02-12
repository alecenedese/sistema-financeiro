"use client"

const budgetItems = [
  {
    category: "Moradia",
    spent: 1290,
    budget: 1500,
    color: "#1B3A5C",
  },
  {
    category: "Transporte",
    spent: 1110,
    budget: 1200,
    color: "#2C5F8A",
  },
  {
    category: "Alimentacao",
    spent: 920,
    budget: 1000,
    color: "#7A8FA6",
  },
  {
    category: "Saude",
    spent: 350,
    budget: 500,
    color: "#A8B8C8",
  },
  {
    category: "Lazer",
    spent: 220,
    budget: 400,
    color: "#C4CFD9",
  },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value)
}

export function BudgetCard() {
  const totalSpent = budgetItems.reduce((acc, item) => acc + item.spent, 0)
  const totalBudget = budgetItems.reduce((acc, item) => acc + item.budget, 0)
  const totalPercent = Math.round((totalSpent / totalBudget) * 100)

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-card-foreground">Orcamento</h3>
        <span className="text-xs text-muted-foreground">
          {formatCurrency(totalSpent)} de {formatCurrency(totalBudget)}
        </span>
      </div>

      {/* Total progress */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-card-foreground">Total</span>
          <span className="text-sm font-semibold text-card-foreground">{totalPercent}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${totalPercent}%` }}
          />
        </div>
      </div>

      {/* Category budgets */}
      <div className="space-y-4">
        {budgetItems.map((item) => {
          const percent = Math.round((item.spent / item.budget) * 100)
          return (
            <div key={item.category}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {item.category}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(item.spent)} / {formatCurrency(item.budget)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
