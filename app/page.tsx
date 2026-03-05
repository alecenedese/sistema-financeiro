"use client"

import { type ReactNode, useState, useEffect } from "react"
import { ChevronUp, ChevronDown, RotateCcw, Lock, Unlock, GripVertical, Building2, Search, LogIn, Shield } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { SummaryCards } from "@/components/dashboard/summary-cards"
import { CategoryCharts } from "@/components/dashboard/category-charts"
import { MonthlyChart } from "@/components/dashboard/monthly-chart"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { BudgetCard } from "@/components/dashboard/budget-card"
import { AccountsCard } from "@/components/dashboard/accounts-card"
import { useDashboardLayout } from "@/hooks/use-dashboard-layout"
import { useTenant } from "@/hooks/use-tenant"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import useSWR from "swr"

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

interface ClienteAdmin {
  id: number
  nome: string
  cnpj: string
  ativo: boolean
}

async function fetchClientesAdmin(): Promise<ClienteAdmin[]> {
  const supabase = createClient()
  const { data } = await supabase.from("clientes_admin").select("id, nome, cnpj, ativo").eq("ativo", true).order("nome")
  return data || []
}

function ClienteSelectorModal({ onSelect, onContinueAsAdmin }: { onSelect: (c: ClienteAdmin) => void; onContinueAsAdmin: () => void }) {
  const { data: clientes = [], isLoading } = useSWR("clientes_admin_selector", fetchClientesAdmin)
  const [search, setSearch] = useState("")

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search)
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(216,60%,22%)]">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Selecionar Cliente</h2>
            <p className="text-xs text-muted-foreground">Escolha um cliente para visualizar o dashboard</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(216,60%,22%)]/10">
                    <Building2 className="h-4 w-4 text-[hsl(216,60%,40%)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-card-foreground">{c.nome}</p>
                    {c.cnpj && <p className="text-xs text-muted-foreground">{c.cnpj}</p>}
                  </div>
                  <LogIn className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onContinueAsAdmin}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Continuar como Admin (sem cliente selecionado)
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const { widgets, moveUp, moveDown, resetLayout } = useDashboardLayout()
  const [editMode, setEditMode] = useState(false)
  const { tenant, setTenant } = useTenant()
  const [adminBypass, setAdminBypass] = useState(false)
  const [modalChecked, setModalChecked] = useState(false)

  // Exibe o modal ao admin que ainda nao selecionou cliente
  // modalChecked evita flash antes da hidratacao do tenant
  useEffect(() => {
    setModalChecked(true)
  }, [])

  const showSelectorModal = modalChecked && !tenant && !adminBypass

  function handleSelectCliente(c: ClienteAdmin) {
    setTenant({ id: c.id, nome: c.nome, cnpj: c.cnpj })
  }

  function handleContinueAsAdmin() {
    setAdminBypass(true)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      {showSelectorModal && (
        <ClienteSelectorModal onSelect={handleSelectCliente} onContinueAsAdmin={handleContinueAsAdmin} />
      )}

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
