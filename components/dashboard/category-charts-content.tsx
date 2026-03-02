"use client"

import { useState } from "react"
import { PieChart, Pie, Cell, Tooltip, Sector } from "recharts"
import { ArrowLeft, PieChartIcon } from "lucide-react"
import { useCategoryCharts, fmt, type CategoryPoint } from "@/hooks/use-dashboard-data"

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-card-foreground">{payload[0].name}</p>
        <p className="text-sm text-muted-foreground">{fmt(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

function renderActiveShape(props: Record<string, unknown>) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as {
    cx: number; cy: number; innerRadius: number; outerRadius: number
    startAngle: number; endAngle: number; fill: string
  }
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius}
      outerRadius={(outerRadius) + 6}
      startAngle={startAngle} endAngle={endAngle}
      fill={fill}
      style={{ cursor: "pointer", filter: "brightness(1.15)" }}
    />
  )
}

function EmptyChart({ title }: { title: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-card-foreground">{title}</h3>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <PieChartIcon className="h-10 w-10 opacity-20" />
        <p className="text-sm">Nenhum lancamento neste mes</p>
      </div>
    </div>
  )
}

function DonutChart({ data, total, title, accentColor }: {
  data: CategoryPoint[]
  total: number
  title: string
  accentColor: string
}) {
  const size = 320
  const [drillCategory, setDrillCategory] = useState<CategoryPoint | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  const displayData = drillCategory ? drillCategory.subcategorias : data
  const displayTotal = drillCategory
    ? drillCategory.subcategorias.reduce((acc, s) => acc + s.value, 0)
    : total

  if (data.length === 0) return <EmptyChart title={title} />

  function handlePieClick(_: unknown, index: number) {
    if (!drillCategory) {
      setDrillCategory(data[index])
      setActiveIndex(undefined)
    }
  }

  function handleBack() {
    setDrillCategory(null)
    setActiveIndex(undefined)
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        {drillCategory && (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h3 className="text-base font-semibold text-card-foreground">
          {drillCategory ? `${title} — ${drillCategory.name}` : title}
        </h3>
        <span className="ml-auto text-lg font-bold" style={{ color: accentColor }}>
          {fmt(displayTotal)}
        </span>
      </div>
      {!drillCategory && (
        <p className="mb-4 text-xs text-muted-foreground">
          Clique em uma fatia para detalhar por subcategoria
        </p>
      )}

      <div className="flex flex-col items-center gap-6 xl:flex-row xl:items-center">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <PieChart width={size} height={size}>
            <Pie
              data={displayData}
              cx={size / 2}
              cy={size / 2}
              innerRadius={92}
              outerRadius={140}
              paddingAngle={displayData.length > 1 ? 2 : 0}
              dataKey="value"
              stroke="none"
              isAnimationActive
              animationDuration={400}
              activeIndex={activeIndex}
              activeShape={!drillCategory ? renderActiveShape : undefined}
              onMouseEnter={!drillCategory ? (_: unknown, idx: number) => setActiveIndex(idx) : undefined}
              onMouseLeave={!drillCategory ? () => setActiveIndex(undefined) : undefined}
              onClick={handlePieClick}
              style={!drillCategory ? { cursor: "pointer" } : undefined}
            >
              {displayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-card-foreground">{fmt(displayTotal)}</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {drillCategory ? drillCategory.name : "Total"}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 min-w-0 w-full">
          {displayData.map((item, idx) => {
            const pct = displayTotal > 0 ? Math.round((item.value / displayTotal) * 100) : 0
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => { if (!drillCategory && data[idx]?.subcategorias?.length) { setDrillCategory(data[idx]); setActiveIndex(undefined) } }}
                onMouseEnter={() => { if (!drillCategory) setActiveIndex(idx) }}
                onMouseLeave={() => { if (!drillCategory) setActiveIndex(undefined) }}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  !drillCategory ? "hover:bg-muted cursor-pointer" : "cursor-default"
                } ${activeIndex === idx && !drillCategory ? "bg-muted" : ""}`}
              >
                <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="flex-1 truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {item.name}
                </span>
                <div className="flex items-center gap-3">
                  <div className="hidden w-24 sm:block">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                  <span className="w-8 text-right text-xs text-muted-foreground">{pct}%</span>
                  <span className="w-24 text-right text-sm font-semibold text-card-foreground">
                    {fmt(item.value)}
                  </span>
                </div>
              </button>
            )
          })}
          {drillCategory && (
            <button
              type="button"
              onClick={handleBack}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para todas as categorias
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CategoryChartsContent() {
  const { data, isLoading } = useCategoryCharts()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="flex flex-col items-center xl:flex-row xl:items-center gap-6">
              <div className="h-80 w-80 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex flex-col gap-3 flex-1 w-full">
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-8 w-full animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const expenses = data?.expenses ?? []
  const incomes = data?.incomes ?? []
  const expTotal = expenses.reduce((a, b) => a + b.value, 0)
  const incTotal = incomes.reduce((a, b) => a + b.value, 0)

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <DonutChart
        data={expenses}
        total={expTotal}
        title="Despesas por Categoria"
        accentColor="hsl(0, 72%, 51%)"
      />
      <DonutChart
        data={incomes}
        total={incTotal}
        title="Receitas por Categoria"
        accentColor="hsl(142, 71%, 40%)"
      />
    </div>
  )
}
