"use client"

import dynamic from "next/dynamic"

const CategoryChartsContent = dynamic(
  () => import("./category-charts-content"),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="flex flex-col items-center lg:flex-row lg:items-start gap-6">
            <div className="h-56 w-56 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex flex-col gap-2.5 flex-1">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="h-4 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function CategoryCharts() {
  return <CategoryChartsContent />
}
