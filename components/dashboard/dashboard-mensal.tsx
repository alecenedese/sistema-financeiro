"use client"

import { useState } from "react"
import { ChevronDown, ShoppingCart, TrendingUp, DollarSign, Percent, ArrowDownToLine, BarChart3, Building } from "lucide-react"
import { useDashboardMensal, fmt } from "@/hooks/use-dashboard-data"

const months = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const years = [2024, 2025, 2026, 2027]

function Skeleton() {
  return <div className="h-8 w-32 animate-pulse rounded bg-muted" />
}

export function DashboardMensal() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [showYearDropdown, setShowYearDropdown] = useState(false)

  const { data, isLoading } = useDashboardMensal(selectedMonth + 1, selectedYear)

  const cards = [
    {
      label: "Faturamento",
      value: data?.faturamento ?? 0,
      icon: ShoppingCart,
      color: "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
    },
    {
      label: "Pagamentos",
      value: data?.pagamentos ?? 0,
      icon: TrendingUp,
      color: "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
    },
    {
      label: "Lucro Bruto",
      value: data?.lucroBruto ?? 0,
      icon: DollarSign,
      color: "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
    },
    {
      label: "% Lucro Bruto",
      value: data?.percLucroBruto ?? 0,
      isPercent: true,
      icon: Percent,
      color: "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
    },
    {
      label: "Recebimentos",
      value: data?.recebimentos ?? 0,
      icon: DollarSign,
      color: "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
    },
    {
      label: "Lucro Liquido",
      value: data?.lucroLiquido ?? 0,
      icon: BarChart3,
      color: data?.lucroLiquido < 0 ? "text-[#E53E3E]" : "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
      valueColor: data?.lucroLiquido < 0 ? "text-[#E53E3E]" : undefined,
    },
    {
      label: "% Lucro Liquido",
      value: data?.percLucroLiquido ?? 0,
      isPercent: true,
      icon: Percent,
      color: data?.percLucroLiquido < 0 ? "text-[#E53E3E]" : "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
      valueColor: data?.percLucroLiquido < 0 ? "text-[#E53E3E]" : undefined,
    },
    {
      label: "Saldo em conta",
      value: data?.saldoConta ?? 0,
      icon: Building,
      color: "text-[#1B4B8A]",
      bgIcon: "bg-[#1B4B8A]",
    },
  ]

  return (
    <div className="rounded-xl bg-[#E8EDF2] p-6 shadow-sm">
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
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {showMonthDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
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
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                  <Skeleton />
                ) : card.isPercent ? (
                  `${card.value.toFixed(2).replace(".", ",")} %`
                ) : (
                  fmt(card.value)
                )}
              </div>
            </div>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${card.bgIcon}`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
