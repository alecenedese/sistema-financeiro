"use client"

import { type ReactNode, useState } from "react"
import { ChevronUp, ChevronDown, RotateCcw, Lock, Unlock, GripVertical } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { SummaryCards } from "@/components/dashboard/summary-cards"
import { CategoryCharts } from "@/components/dashboard/category-charts"
import { MonthlyChart } from "@/components/dashboard/monthly-chart"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { BudgetCard } from "@/components/dashboard/budget-card"
import { AccountsCard } from "@/components/dashboard/accounts-card"
import { useDashboardLayout } from "@/hooks/use-dashboard-layout"
import { cn } from "@/lib/utils"

const WIDGET_MAP: Record<string, ReactNode> = {
  summary: <SummaryCards />,
  "category-charts": <CategoryCharts />,
  "monthly-chart": <MonthlyChart />,
  budget: <BudgetCard />,
  "recent-transactions": <RecentTransactions />,
  accounts: <AccountsCard />,
}

const WIDGET_LABELS: Record<string, string> = {
  summary: "Resumo",
  "category-charts": "Categorias",
  "monthly-chart": "Receitas x Despesas",
  budget: "Orcamento",
  "recent-transactions": "Transacoes Recentes",
  accounts: "Minhas Contas",
}

export default function Page() {
  const { widgets, moveUp, moveDown, resetLayout } = useDashboardLayout()
  const [editMode, setEditMode] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <div className="ml-[72px] flex flex-1 flex-col">
        <DashboardHeader />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <a
                href="#"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Meu Desempenho &rarr;
              </a>
              <div className="flex items-center gap-2">
                {editMode && (
                  <button
                    type="button"
                    onClick={resetLayout}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Resetar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditMode(!editMode)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    editMode
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {editMode ? (
                    <>
                      <Unlock className="h-3.5 w-3.5" />
                      Salvar Layout
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Editar Layout
                    </>
                  )}
                </button>
              </div>
            </div>

            {editMode && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 text-xs text-primary">
                Use as setas para mover os widgets para cima ou para baixo. Clique em "Salvar Layout" quando terminar.
              </div>
            )}

            {/* Widgets */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {widgets.map((widget, index) => (
                <div
                  key={widget.id}
                  className={cn(
                    "relative rounded-xl transition-all duration-300",
                    widget.span === "full" && "xl:col-span-2",
                    editMode && "ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                  )}
                >
                  {/* Edit mode controls */}
                  {editMode && (
                    <div className="absolute -top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        title="Mover para cima"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-1 px-1">
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {WIDGET_LABELS[widget.id]}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === widgets.length - 1}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {WIDGET_MAP[widget.id]}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
