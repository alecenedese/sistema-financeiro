"use client"

import { useRef, useEffect, useState } from "react"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Legend,
  CartesianGrid,
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
  payload?: Array<{ value: number; name: string; color: string; dataKey: string }>
  label?: string
}) {
  if (active && payload && payload.length) {
    const labelMap: Record<string, string> = {
      entradas: "Entradas",
      saidas: "Saidas",
      saldo: "Saldo",
    }
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <p className="mb-2 text-sm font-semibold text-card-foreground">Dia {label}</p>
        {payload.map((p) => {
          const display = p.dataKey === "saidas" ? Math.abs(p.value) : p.value
          return (
            <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
              <span className="font-medium">{labelMap[p.dataKey] || p.name}: </span>
              <span className="font-bold">{fmt(display)}</span>
            </p>
          )
        })}
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
      
      <div ref={containerRef} className="h-[500px]">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-muted" />
        ) : width > 0 && data.length > 0 ? (
          <ComposedChart width={width} height={500} data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
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
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value: string) => {
                const map: Record<string, string> = {
                  entradas: "Entradas",
                  saidas: "Saidas",
                  saldo: "Saldo",
                }
                return map[value] || value
              }}
            />
            <ReferenceLine y={0} stroke="#333" strokeWidth={1} />
            <Bar dataKey="entradas" fill="#1B4B8A" radius={[2, 2, 0, 0]} maxBarSize={28} />
            <Bar dataKey="saidas" fill="#E53E3E" radius={[0, 0, 2, 2]} maxBarSize={28} />
            <Line
              type="monotone"
              dataKey="saldo"
              stroke="#111827"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#111827" }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhum dado encontrado para este periodo
          </div>
        )}
      </div>
    </div>
  )
}
