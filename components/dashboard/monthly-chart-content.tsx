"use client"

import { useRef, useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

const monthlyData = [
  { month: "Ago", receitas: 5200, despesas: 3800 },
  { month: "Set", receitas: 5800, despesas: 4200 },
  { month: "Out", receitas: 6100, despesas: 4500 },
  { month: "Nov", receitas: 5505, despesas: 4024 },
  { month: "Dez", receitas: 7200, despesas: 5100 },
  { month: "Jan", receitas: 5505, despesas: 4024 },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <p className="mb-2 text-sm font-semibold text-card-foreground">
          {label}
        </p>
        {payload.map((item) => (
          <p
            key={item.dataKey}
            className="text-sm"
            style={{ color: item.color }}
          >
            {item.dataKey === "receitas" ? "Receitas" : "Despesas"}:{" "}
            {formatCurrency(item.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function MonthlyChartContent() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width, height })
        }
      }
    })

    observer.observe(el)
    // Initial measurement
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height })
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-semibold text-card-foreground">
          Receitas x Despesas
        </h3>
        <span className="text-xs text-muted-foreground">Ultimos 6 meses</span>
      </div>
      <div ref={containerRef} className="h-72">
        {dimensions.width > 0 && dimensions.height > 0 && (
          <BarChart
            width={dimensions.width}
            height={dimensions.height}
            data={monthlyData}
            barGap={4}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(220, 13%, 91%)"
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) =>
                value === "receitas" ? "Receitas" : "Despesas"
              }
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Bar
              dataKey="receitas"
              fill="hsl(216, 60%, 22%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="despesas"
              fill="hsl(216, 20%, 70%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        )}
      </div>
    </div>
  )
}
