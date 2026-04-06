"use client"

import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { useLucroBrutoChart, useLucroLiquidoChart, fmt } from "@/hooks/use-dashboard-data"

interface LucroChartsProps {
  month: number
  year: number
}

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

interface DonutChartProps {
  title: string
  label1: string
  label2: string
  value1: number
  value2: number
  resultado: number
  percentual: number
  isNegative: boolean
}

function DonutChart({
  title,
  label1,
  label2,
  value1,
  value2,
  resultado,
  percentual,
  isNegative,
}: DonutChartProps) {
  const data = [
    { name: label1, value: value1, color: "#1B4B8A" },
    { name: label2, value: value2, color: "#F07575" },
  ]

  const size = 280

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-card-foreground">{title}</h3>

      {/* Legend */}
      <div className="mb-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#1B4B8A]" />
          <span className="text-sm text-muted-foreground">{label1.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#F07575]" />
          <span className="text-sm text-muted-foreground">{label2.toUpperCase()}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <PieChart width={size} height={size}>
          <Pie
            data={data}
            cx={size / 2}
            cy={size / 2}
            innerRadius={80}
            outerRadius={120}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            isAnimationActive
            animationDuration={400}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className={`rounded-lg px-3 py-1.5 ${
              isNegative ? "bg-[#F07575]" : "bg-[#1B4B8A]"
            }`}
          >
            <span className="text-xs font-semibold text-white">
              RESULTADO {percentual.toFixed(2).replace(".", ",")}%
            </span>
          </div>
          <span
            className={`mt-1 text-lg font-bold ${
              isNegative ? "text-[#F07575]" : "text-[#1B4B8A]"
            }`}
          >
            {isNegative ? "- " : ""}
            {fmt(Math.abs(resultado))}
          </span>
        </div>
      </div>
    </div>
  )
}

export function LucroCharts({ month, year }: LucroChartsProps) {
  const { data: lucroBruto, isLoading: loadingBruto } = useLucroBrutoChart(month, year)
  const { data: lucroLiquido, isLoading: loadingLiquido } = useLucroLiquidoChart(month, year)

  if (loadingBruto || loadingLiquido) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-64 w-64 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <DonutChart
        title="Lucro Bruto"
        label1="Vendas"
        label2="Saidas"
        value1={lucroBruto.vendas}
        value2={lucroBruto.saidas}
        resultado={lucroBruto.resultado}
        percentual={lucroBruto.percentual}
        isNegative={lucroBruto.resultado < 0}
      />
      <DonutChart
        title="Lucro Liquido"
        label1="Recebimento"
        label2="Pagamentos"
        value1={lucroLiquido.vendas}
        value2={lucroLiquido.saidas}
        resultado={lucroLiquido.resultado}
        percentual={lucroLiquido.percentual}
        isNegative={lucroLiquido.resultado < 0}
      />
    </div>
  )
}
