"use client"

// Dashboard v2.1 - Layout atualizado
import { useState, useEffect } from "react"
import { Building2, Search, LogIn, Shield } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardMensal } from "@/components/dashboard/dashboard-mensal"
import { FluxoCaixaDiario } from "@/components/dashboard/fluxo-caixa-diario"
import { FluxoVendasDiario } from "@/components/dashboard/fluxo-vendas-diario"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { AccountsCard } from "@/components/dashboard/accounts-card"
import { DespesasPorCategoria } from "@/components/dashboard/despesas-categoria"
import { LucroCharts } from "@/components/dashboard/lucro-charts"
import { DRECard } from "@/components/dashboard/dre-card"
import { ConciliacaoContas } from "@/components/dashboard/conciliacao-contas"
import { useTenant } from "@/hooks/use-tenant"
import { createClient } from "@/lib/supabase/client"
import { useDRE, useCategoryChartsMonth } from "@/hooks/use-dashboard-data"
import useSWR from "swr"

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
  const { tenant, setTenant } = useTenant()
  const [adminBypass, setAdminBypass] = useState(false)
  const [modalChecked, setModalChecked] = useState(false)
  
  // Estado para mes/ano selecionado (compartilhado entre componentes)
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

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

  // Callback para quando o DashboardMensal muda mes/ano
  const handlePeriodChange = (month: number, year: number) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }



  return (
    <div className="flex min-h-screen bg-[#E8EDF2]">
      <AppSidebar />

      {showSelectorModal && (
        <ClienteSelectorModal onSelect={handleSelectCliente} onContinueAsAdmin={handleContinueAsAdmin} />
      )}

      <div className="ml-[72px] flex flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* 1. Dashboard Mensal - Cards de metricas */}
            <DashboardMensalWithCallback
              onPeriodChange={handlePeriodChange}
              initialMonth={selectedMonth}
              initialYear={selectedYear}
            />

            {/* 2. Despesas por Categoria */}
            <DespesasPorCategoria month={selectedMonth} year={selectedYear} />

            {/* 3. Lucro Bruto + Lucro Liquido */}
            <LucroCharts month={selectedMonth} year={selectedYear} />

            {/* 4. Fluxo de Caixa Diario */}
            <FluxoCaixaDiario month={selectedMonth} year={selectedYear} />

            {/* 5. Fluxo de Vendas Diario */}
            <FluxoVendasDiario month={selectedMonth} year={selectedYear} />

            {/* 6. DRE */}
            <DRECard month={selectedMonth} year={selectedYear} />

            {/* 7. Movimentação e Conciliação */}
            <ConciliacaoContas month={selectedMonth} year={selectedYear} />

            {/* 8. Transacoes Recentes + Contas Bancarias */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <RecentTransactions month={selectedMonth} year={selectedYear} />
              <AccountsCard month={selectedMonth} year={selectedYear} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// Wrapper para DashboardMensal que repassa mudancas de periodo
function DashboardMensalWithCallback({
  onPeriodChange,
  initialMonth,
  initialYear,
}: {
  onPeriodChange: (month: number, year: number) => void
  initialMonth: number
  initialYear: number
}) {
  const { tenant, mounted } = useTenant()
  const [selectedMonth, setSelectedMonth] = useState(initialMonth - 1) // 0-indexed
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [showYearDropdown, setShowYearDropdown] = useState(false)

  const { data, isLoading } = useSWR(
    mounted ? ["dashboard-api", tenant?.id ?? null, selectedMonth + 1, selectedYear] : null,
    async ([, tid, month, year]) => {
      // Usa API route para ter logs no terminal do servidor
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
        ...(tid ? { tenantId: String(tid) } : {}),
        tzOffset: String(new Date().getTimezoneOffset()),
      })
      const res = await fetch(`/api/dashboard-data?${params}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data.metricas
    },
    { revalidateOnFocus: false }
  )

  // Notifica parent quando periodo muda
  useEffect(() => {
    onPeriodChange(selectedMonth + 1, selectedYear)
  }, [selectedMonth, selectedYear, onPeriodChange])

  const months = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ]
  const years = [2024, 2025, 2026, 2027]

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

  // Valores derivados do DRE (fonte única)
  const { data: dreData } = useDRE(selectedMonth + 1, selectedYear)
  const dreV = dreData?.valores || {}
  // Vendas vem da API (mesma lógica de timezone da página /vendas)
  const vendas = data?.totalVendas ?? dreV["1.1"] ?? 0
  const receitaBruta = dreV["1.0"] ?? 0
  const receitaLiquida = dreV["3.0"] ?? 0
  const recebimentos = dreV["6.0"] ?? 0
  const lucroBruto = dreV["5.0"] ?? 0
  const lucroLiquido = dreV["9.0"] ?? 0
  const resultadoFinanceiro = dreV["11.0"] ?? 0
  const pctLucroBruto = receitaBruta ? (lucroBruto / receitaBruta) * 100 : 0
  const pctLucroLiquido = receitaBruta ? (lucroLiquido / receitaBruta) * 100 : 0
  const pctResultado = receitaBruta ? (resultadoFinanceiro / receitaBruta) * 100 : 0

  // Total de despesas = mesmo total do gráfico Despesas por Categoria (todas as contas_pagar do período, sem filtro de status)
  const { data: categoryData } = useCategoryChartsMonth(selectedMonth + 1, selectedYear)
  const totalDespesas = (categoryData?.expenses ?? []).reduce((acc, e) => acc + e.value, 0)

  const cards: Array<{ label: string; value: number; isPercent?: boolean; valueColor?: string; pct?: number }> = [
    { label: "Vendas", value: vendas },
    { label: "Pagamentos", value: totalDespesas },
    { label: "Lucro Bruto", value: lucroBruto, valueColor: lucroBruto < 0 ? "text-[#E53E3E]" : undefined },
    { label: "% Lucro Bruto", value: pctLucroBruto, isPercent: true, valueColor: pctLucroBruto < 0 ? "text-[#E53E3E]" : undefined },
    { label: "Recebimentos", value: data?.recebimentos ?? 0 },
    { label: "Lucro Liquido", value: lucroLiquido, valueColor: lucroLiquido < 0 ? "text-[#E53E3E]" : undefined },
    { label: "% Lucro Liquido", value: pctLucroLiquido, isPercent: true, valueColor: pctLucroLiquido < 0 ? "text-[#E53E3E]" : undefined },
    {
      label: "Resultado Financeiro",
      value: resultadoFinanceiro,
      pct: pctResultado,
      valueColor: resultadoFinanceiro < 0 ? "text-[#E53E3E]" : undefined,
    },
  ]

  return (
    <div className="rounded-xl bg-[#E8EDF2] p-6 shadow-sm border border-border">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1B3A5C]">Dashboard Mensal</h2>
        <div className="flex items-center gap-2">
          {/* Month Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowMonthDropdown(!showMonthDropdown); setShowYearDropdown(false) }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {months[selectedMonth].toUpperCase()}
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showMonthDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg max-h-64 overflow-y-auto">
                {months.map((month, index) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => { setSelectedMonth(index); setShowMonthDropdown(false) }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      index === selectedMonth ? "font-medium text-primary" : "text-foreground"
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Year Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowYearDropdown(!showYearDropdown); setShowMonthDropdown(false) }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {selectedYear}
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showYearDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 w-28 rounded-lg border border-border bg-card py-1 shadow-lg">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => { setSelectedYear(year); setShowYearDropdown(false) }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      year === selectedYear ? "font-medium text-primary" : "text-foreground"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center justify-between rounded-xl bg-card p-5 shadow-sm"
          >
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <div className={`mt-1 text-xl font-bold ${card.valueColor || "text-card-foreground"}`}>
                {isLoading ? (
                  <div className="h-7 w-28 animate-pulse rounded bg-muted" />
                ) : card.isPercent ? (
                  `${card.value.toFixed(2).replace(".", ",")} %`
                ) : (
                  fmt(card.value)
                )}
              </div>
              {card.pct !== undefined && !isLoading && (
                <div className={`mt-0.5 text-xs font-semibold ${card.pct < 0 ? "text-[#E53E3E]" : "text-[hsl(142,71%,35%)]"}`}>
                  {card.pct.toFixed(2).replace(".", ",")} %
                </div>
              )}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1B4B8A]">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
