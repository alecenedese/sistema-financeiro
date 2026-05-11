"use client"

import { DREView } from "@/components/dre/dre-view"
import { useDRE } from "@/hooks/use-dashboard-data"

interface DRECardProps {
  month: number
  year: number
}

const months = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export function DRECard({ month, year }: DRECardProps) {
  const { data, isLoading } = useDRE(month, year)

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const periodoLabel = `${(months[month - 1] || "").toUpperCase()} ${year}`

  return (
    <DREView
      valores={data?.valores || {}}
      detalhePorCodigo={data?.detalhePorCodigo || {}}
      periodoLabel={periodoLabel}
      title="DRE Financeiro"
    />
  )
}
