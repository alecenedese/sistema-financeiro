"use client"

import { useRef, useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { useMonthly } from "@/hooks/use-dashboard-data"

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
        <p className="mb-2 text-sm font-semibold text-card-foreground">{label}</p>
        {payload.map((item) => (
          <p key={item.dataKey} className="text-sm" style={{ color: item.color }}>
            {item.dataKey === "receitas" ? "Receitas" : "Despesas"}: {formatCurrency(item.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function MonthlyChartContent() {
  const { data: monthlyData = [], isLoading } = useMonthly()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w > 0) setWidth(w)
    })
    obs.observe(el)
    const rect = el.getBoundingClientRect()
    if (rect.width > 0) setWidth(rect.width)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-semibold text-card-foreground">Receitas x Despesas</h3>
        <span className="text-xs text-muted-foreground">Ultimos 6 meses</span>
      </div>
      <div ref={containerRef} className="h-72">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-muted" />
        ) : width > 0 && monthlyData.length > 0 ? (
          <BarChart width={width} height={288} data={monthlyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220,13%,91%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220,10%,46%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(220,10%,46%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(v) => (v === "receitas" ? "Receitas" : "Despesas")} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="receitas" fill="hsl(216,60%,22%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="despesas" fill="hsl(216,20%,70%)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        ) : !isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhum dado encontrado nos ultimos 6 meses
          </div>
        ) : null}
      </div>
    </div>
  )
}
