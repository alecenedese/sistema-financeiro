"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { DespesasPorCategoria } from "@/components/dashboard/despesas-categoria"
import { FluxoCaixaDiario } from "@/components/dashboard/fluxo-caixa-diario"
import { AccountsCard } from "@/components/dashboard/accounts-card"
import { DRECard } from "@/components/dashboard/dre-card"
import { LucroBrutoDonut } from "@/components/dashboard/lucro-bruto-donut"
import { LucroLiquidoDonut } from "@/components/dashboard/lucro-liquido-donut"
import { FluxoVendasDiario } from "@/components/dashboard/fluxo-vendas-diario"
import { ChevronDown, Loader2 } from "lucide-react"

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

// Decodifica o token para obter o tenantId
function decodeToken(token: string): number | null {
  try {
    // Token é base64 do formato "tenant:{id}"
    const decoded = atob(token)
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
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()) // 0-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [tenantName, setTenantName] = useState<string>("")

  // Busca nome do tenant
  useEffect(() => {
    if (!tenantId) return
    async function fetchTenantName() {
      try {
        const res = await fetch(`/api/tenant-info?tenantId=${tenantId}`)
        const data = await res.json()
        if (data.success && data.nome) {
          setTenantName(data.nome)
        }
      } catch {
        // Ignora erro
      }
    }
    fetchTenantName()
  }, [tenantId])

  const { data, isLoading } = useSWR(
    tenantId ? ["public-dashboard", tenantId, selectedMonth + 1, selectedYear] : null,
    async ([, tid, month, year]) => {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
        tenantId: String(tid),
      })
      const res = await fetch(`/api/dashboard-data?${params}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data.metricas
    },
    { revalidateOnFocus: false }
  )

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

  const cards = [
    { label: "Vendas", value: data?.totalVendas ?? 0 },
    { label: "Pagamentos", value: data?.pagamentos ?? 0 },
    { label: "Lucro Bruto", value: data?.lucroBruto ?? 0 },
    { label: "% Lucro Bruto", value: data?.percLucroBruto ?? 0, isPercent: true },
    { label: "Recebimentos", value: data?.recebimentos ?? 0 },
    { label: "Lucro Liquido", value: data?.lucroLiquido ?? 0, valueColor: (data?.lucroLiquido ?? 0) < 0 ? "text-[#E53E3E]" : undefined },
    { label: "% Lucro Liquido", value: data?.percLucroLiquido ?? 0, isPercent: true, valueColor: (data?.percLucroLiquido ?? 0) < 0 ? "text-[#E53E3E]" : undefined },
    { label: "Saldo em conta", value: data?.saldoConta ?? 0 },
  ]

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
            {/* Month Selector */}
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
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setSelectedMonth(idx); setShowMonthDropdown(false) }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        idx === selectedMonth ? "bg-muted font-medium" : ""
                      }`}
                    >
                      {m}
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
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted"
              >
                {selectedYear}
                <ChevronDown className="h-4 w-4" />
              </button>
              {showYearDropdown && (
                <div className="absolute right-0 top-full z-10 mt-1 w-24 rounded-lg border border-border bg-card py-1 shadow-lg">
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => { setSelectedYear(y); setShowYearDropdown(false) }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        y === selectedYear ? "bg-muted font-medium" : ""
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="rounded-xl bg-[#E8EDF2] p-4 md:p-6 shadow-sm border border-border">
        {/* Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {cards.map((card) => (
                <div key={card.label} className="rounded-xl bg-card p-4 shadow-sm border border-border">
                  <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                  <p className={`mt-1 text-lg font-bold ${card.valueColor || "text-card-foreground"}`}>
                    {card.isPercent ? `${card.value.toFixed(2)}%` : fmt(card.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="space-y-6">
              {/* Row 1: Despesas + Fluxo de Caixa */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <DespesasPorCategoriaPublic month={selectedMonth + 1} year={selectedYear} tenantId={tenantId} />
                <FluxoCaixaDiarioPublic month={selectedMonth + 1} year={selectedYear} tenantId={tenantId} />
              </div>

              {/* Row 2: Contas Bancárias */}
              <AccountsCardPublic tenantId={tenantId} />

              {/* Row 3: DRE */}
              <DRECardPublic month={selectedMonth + 1} year={selectedYear} tenantId={tenantId} />

              {/* Row 4: Lucro Bruto + Lucro Líquido */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <LucroBrutoDonutPublic month={selectedMonth + 1} year={selectedYear} tenantId={tenantId} />
                <LucroLiquidoDonutPublic month={selectedMonth + 1} year={selectedYear} tenantId={tenantId} />
              </div>

              {/* Row 5: Fluxo de Vendas */}
              <FluxoVendasDiarioPublic month={selectedMonth + 1} year={selectedYear} tenantId={tenantId} />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Powered by Sistema Financeiro
      </div>
    </div>
  )
}

// Componentes wrapper para passar tenantId fixo
function DespesasPorCategoriaPublic({ month, year, tenantId }: { month: number; year: number; tenantId: number }) {
  return <DespesasPorCategoria month={month} year={year} />
}

function FluxoCaixaDiarioPublic({ month, year, tenantId }: { month: number; year: number; tenantId: number }) {
  return <FluxoCaixaDiario month={month} year={year} />
}

function AccountsCardPublic({ tenantId }: { tenantId: number }) {
  return <AccountsCard />
}

function DRECardPublic({ month, year, tenantId }: { month: number; year: number; tenantId: number }) {
  return <DRECard month={month} year={year} />
}

function LucroBrutoDonutPublic({ month, year, tenantId }: { month: number; year: number; tenantId: number }) {
  return <LucroBrutoDonut month={month} year={year} />
}

function LucroLiquidoDonutPublic({ month, year, tenantId }: { month: number; year: number; tenantId: number }) {
  return <LucroLiquidoDonut month={month} year={year} />
}

function FluxoVendasDiarioPublic({ month, year, tenantId }: { month: number; year: number; tenantId: number }) {
  return <FluxoVendasDiario month={month} year={year} />
}
