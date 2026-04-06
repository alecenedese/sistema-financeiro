"use client"

import { useRef, useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts"
import { useFluxoCaixaDiario, fmt } from "@/hooks/use-dashboard-data"

interface FluxoCaixaDiarioProps {
  month: number
  year: number
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (active && payload && payload.length) {
    const value = payload[0].value
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <p className="mb-1 text-sm font-semibold text-card-foreground">Dia {label}</p>
        <p className={`text-sm font-bold ${value >= 0 ? "text-[#1B4B8A]" : "text-[#E07755]"}`}>
          {fmt(value)}
        </p>
      </div>
    )
  }
  return null
}

export function FluxoCaixaDiario({ month, year }: FluxoCaixaDiarioProps) {
  const { data = [], isLoading } = useFluxoCaixaDiario(month, year)
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
      <h3 className="mb-6 text-lg font-bold text-card-foreground">Fluxo de caixa diario</h3>
      
      <div ref={containerRef} className="h-80">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-muted" />
        ) : width > 0 && data.length > 0 ? (
          <BarChart width={width} height={320} data={data}>
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: "hsl(220,10%,46%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(220,10%,46%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={0}
              stroke="#333"
              strokeDasharray="3 3"
              label={{
                value: "Ponto de Equilibrio",
                position: "insideLeft",
                fontSize: 10,
                fill: "#666",
              }}
            />
            <Bar dataKey="valor" radius={[2, 2, 0, 0]} maxBarSize={18}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.valor >= 0 ? "#1B4B8A" : "#E07755"}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhum dado encontrado para este periodo
          </div>
        )}
      </div>
    </div>
  )
}
