"use client"

import { useRef, useEffect, useState } from "react"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Scatter,
} from "recharts"
import { useFluxoVendasDiario, fmt } from "@/hooks/use-dashboard-data"

interface FluxoVendasDiarioProps {
  month: number
  year: number
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <p className="mb-2 text-sm font-semibold text-card-foreground">Dia {label}</p>
        {payload.map((item) => (
          <p key={item.dataKey} className="text-sm text-[#1B4B8A]">
            {item.dataKey === "valor" ? "Vendas" : item.dataKey === "media" ? "Media" : "Meta"}: {fmt(item.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function FluxoVendasDiario({ month, year }: FluxoVendasDiarioProps) {
  const { data = [], isLoading } = useFluxoVendasDiario(month, year)
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

  // Calcula media de vendas
  const totalVendas = data.reduce((acc, d) => acc + d.valor, 0)
  const diasComVenda = data.filter((d) => d.valor > 0).length
  const media = diasComVenda > 0 ? totalVendas / diasComVenda : 0

  // Adiciona media e meta aos dados
  const chartData = data.map((d) => ({
    ...d,
    media,
    meta: media, // Meta = media (pode ser customizado)
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-card-foreground">Fluxo de vendas diario</h3>
        <span className="text-sm text-muted-foreground">
          Media: <span className="font-semibold text-card-foreground">{fmt(media)}</span>
        </span>
      </div>

      <div ref={containerRef} className="h-80">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-muted" />
        ) : width > 0 && data.length > 0 ? (
          <ComposedChart width={width} height={320} data={chartData}>
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
              formatter={(v) =>
                v === "valor" ? "Vendas Diarias" : v === "media" ? "Media de Vendas" : "Meta Diaria"
              }
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Bar dataKey="valor" fill="#1B4B8A" radius={[2, 2, 0, 0]} maxBarSize={18} />
            <Line
              type="monotone"
              dataKey="media"
              stroke="#333"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={1}
            />
            <Scatter dataKey="meta" fill="#000" shape="circle" />
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
