"use client"

import { useState } from "react"
import { ChevronDown, Bell, Search } from "lucide-react"

const months = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

export function DashboardHeader() {
  const [selectedMonth, setSelectedMonth] = useState(1) // Fevereiro (index 1)
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Month Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMonthDropdown(!showMonthDropdown)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {months[selectedMonth]}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {showMonthDropdown && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
              {months.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(index)
                    setShowMonthDropdown(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    index === selectedMonth
                      ? "font-medium text-primary"
                      : "text-foreground"
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[hsl(0,72%,51%)]" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            MJ
          </div>
          <span className="hidden text-sm font-medium text-foreground md:inline-block">
            MAJO BPO
          </span>
        </div>
      </div>
    </header>
  )
}
