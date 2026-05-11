"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { DespesasPorCategoria } from "@/components/dashboard/despesas-categoria"
import { FluxoCaixaDiario } from "@/components/dashboard/fluxo-caixa-diario"
import { AccountsCard } from "@/components/dashboard/accounts-card"
import { DRECard } from "@/components/dashboard/dre-card"
import { LucroCharts } from "@/components/dashboard/lucro-charts"
import { FluxoVendasDiario } from "@/components/dashboard/fluxo-vendas-diario"
import { ChevronDown, Loader2 } from "lucide-react"
import { useDRE, useCategoryChartsMonth } from "@/hooks/use-dashboard-data"
import { useTenant } from "@/hooks/use-tenant"

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

function decodeToken(token: string): number | null {
  try {
    let decodedToken = token
    try { decodedToken = decodeURIComponent(token) } catch { /* ignore */ }
    const base64 = decodedToken.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64)
    if (decoded.startsWith("tenant:")) {
      return parseInt(decoded.replace("tenant:", ""), 10)
    }
    return null
  } catch {
    return null
  }
}

export default function PublicDashboardPage() {
  const params = useParams()
  const token = params.token as string
  const tenantId = decodeToken(token)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [tenantName, setTenantName] = useState<string>("")
  const { tenant, setTenant } = useTenant()
  const tenantReady = tenant?.id === tenantId

  useEffect(() => {
    if (!tenantId) return
    async function fetchTenantName() {
      try {
        const res = await fetch(`/api/tenant-info?tenantId=${tenantId}`)
        const data = await res.json()
        if (data.success && data.nome) {
          setTenantName(data.nome)
          setTenant({ id: tenantId!, nome: data.nome, cnpj: data.cnpj || "" })
        }
      } catch { /* ignore */ }
    }
    fetchTenantName()
  }, [tenantId, setTenant])

  if (!tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0F4F8]">
        <div className="rounded-xl bg-white p-8 shadow-lg text-center">
          <h1 className="text-xl font-bold text-[#1B3A5C] mb-2">Link inválido</h1>
          <p className="text-muted-foreground">O link de dashboard que você acessou não é válido.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1B3A5C]">Dashboard Financeiro</h1>
            {tenantName && <p className="text-sm text-muted-foreground">{tenantName}</p>}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowMonthDropdown(!showMonthDropdown); setShowYearDropdown(false) }}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted"
              >
                {MONTHS[selectedMonth]}
                <ChevronDown className="h-4 w-4" />
              </button>
              {showMonthDropdown && (
                <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                  {MONTHS.map((m, idx) => (
                    <button key={m} type="button"
                      onClick={() => { setSelectedMonth(idx); setShowMonthDropdown(false) }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${idx === selectedMonth ? "bg-muted font-medium" : ""}`}
                    >{m}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowYearDropdown(!showYearDropdown); setShowMonthDropdown(false) }}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted"
              >
                {selectedYear}
                <ChevronDown className="h-4 w-4" />
              </button>
              {showYearDropdown && (
                <div className="absolute right-0 top-full z-10 mt-1 w-24 rounded-lg border border-border bg-card py-1 shadow-lg">
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                    <button key={y} type="button"
                      onClick={() => { setSelectedYear(y); setShowYearDropdown(false) }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${y === selectedYear ? "bg-muted font-medium" : ""}`}
                    >{y}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content — só renderiza após tenant estar pronto */}
      <div className="rounded-xl bg-[#E8EDF2] p-4 md:p-6 shadow-sm border border-border">
        {!tenantReady ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PublicDashboardContent
            tenantId={tenantId}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}
      </div>

      <div className="mt-4 text-center text-xs text-muted-foreground">
        Powered by Sistema Financeiro
      </div>
    </div>
  )
}

// Componente separado: só monta quando tenantReady=true, garantindo que todos
// os hooks (useDRE, useCategoryChartsMonth, etc.) já usam o tenant correto.
function PublicDashboardContent({
  tenantId,
  selectedMonth,
  selectedYear,
}: {
  tenantId: number
  selectedMonth: number
  selectedYear: number
}) {
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

  const { data, isLoading } = useSWR(
    ["public-dashboard", tenantId, selectedMonth + 1, selectedYear],
    async ([, tid, month, year]) => {
      const p = new URLSearchParams({
        month: String(month),
        year: String(year),
        tenantId: String(tid),
        tzOffset: String(new Date().getTimezoneOffset()),
      })
      const res = await fetch(`/api/dashboard-data?${p}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data.metricas
    },
    { revalidateOnFocus: false }
  )

  const { data: dreData } = useDRE(selectedMonth + 1, selectedYear)
  const dreV = dreData?.valores || {}
  const vendas = data?.totalVendas ?? dreV["1.1"] ?? 0
  const receitaBrutaDre = dreV["1.0"] ?? 0
  const lucroBruto = dreV["5.0"] ?? 0
  const lucroLiquido = dreV["9.0"] ?? 0
  const resultadoFinanceiro = dreV["11.0"] ?? 0
  const pctLucroBruto = receitaBrutaDre ? (lucroBruto / receitaBrutaDre) * 100 : 0
  const pctLucroLiquido = receitaBrutaDre ? (lucroLiquido / receitaBrutaDre) * 100 : 0
  const pctResultado = receitaBrutaDre ? (resultadoFinanceiro / receitaBrutaDre) * 100 : 0

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
    { label: "Resultado Financeiro", value: resultadoFinanceiro, pct: pctResultado, valueColor: resultadoFinanceiro < 0 ? "text-[#E53E3E]" : undefined },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-card p-4 shadow-sm border border-border">
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.valueColor || "text-card-foreground"}`}>
              {card.isPercent ? `${card.value.toFixed(2)}%` : fmt(card.value)}
            </p>
            {card.pct !== undefined && (
              <p className={`mt-0.5 text-xs font-semibold ${card.pct < 0 ? "text-[#E53E3E]" : "text-[hsl(142,71%,35%)]"}`}>
                {card.pct.toFixed(2).replace(".", ",")} %
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <DespesasPorCategoria month={selectedMonth + 1} year={selectedYear} />
        <FluxoCaixaDiario month={selectedMonth + 1} year={selectedYear} />
        <AccountsCard />
        <DRECard month={selectedMonth + 1} year={selectedYear} />
        <LucroCharts month={selectedMonth + 1} year={selectedYear} />
        <FluxoVendasDiario month={selectedMonth + 1} year={selectedYear} />
      </div>
    </>
  )
}
