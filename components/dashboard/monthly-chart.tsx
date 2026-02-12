"use client"

import dynamic from "next/dynamic"

const MonthlyChartContent = dynamic(
  () => import("./monthly-chart-content"),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-72 animate-pulse rounded bg-muted" />
    </div>
  )
}

export function MonthlyChart() {
  return <MonthlyChartContent />
}
