"use client"

import { useRef, useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
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
            Vendas: {fmt(item.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function FluxoVendasDiario({ month, year }: FluxoVendasDiarioProps) {
  const { data: result, isLoading } = useFluxoVendasDiario(month, year)
  const data = result?.points ?? []
  const qtdVendas = result?.qtdVendas ?? 0
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

  // Calcula media de vendas e ticket medio
  const totalVendas = data.reduce((acc, d) => acc + d.valor, 0)
  const diasComVenda = data.filter((d) => d.valor > 0).length
  const media = diasComVenda > 0 ? totalVendas / diasComVenda : 0
  const ticketMedio = qtdVendas > 0 ? totalVendas / qtdVendas : 0

  const nomeMes = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" })
  const labelMes = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-card-foreground">Fluxo de vendas diario</h3>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm text-muted-foreground">
            Vendas {labelMes}: <span className="font-semibold text-card-foreground">{fmt(totalVendas)}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            Ticket Médio: <span className="font-semibold text-card-foreground">{fmt(ticketMedio)}</span>
          </span>
        </div>
      </div>

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
            <Bar dataKey="valor" fill="#1B4B8A" radius={[2, 2, 0, 0]} maxBarSize={20} />
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
