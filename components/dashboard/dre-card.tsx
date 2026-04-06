"use client"

import { useState } from "react"
import { ChevronRight, TrendingUp } from "lucide-react"
import { useDRE, fmt } from "@/hooks/use-dashboard-data"
import { cn } from "@/lib/utils"

interface DRECardProps {
  month: number
  year: number
}

const months = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

interface DRERowProps {
  label: string
  value: number
  isSubtotal?: boolean
  isTotal?: boolean
  isNegative?: boolean
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  indent?: number
}

function DRERow({
  label,
  value,
  isSubtotal,
  isTotal,
  isNegative,
  expandable,
  expanded,
  onToggle,
  indent = 0,
}: DRERowProps) {
  const isPositive = value > 0 && !isNegative

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border py-3 px-4",
        isSubtotal && "bg-muted/30",
        isTotal && "bg-muted/50 font-semibold",
        expandable && "cursor-pointer hover:bg-muted/20 transition-colors"
      )}
      onClick={expandable ? onToggle : undefined}
    >
      <div className="flex items-center gap-2" style={{ paddingLeft: indent * 16 }}>
        {expandable && (
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
        )}
        {isNegative && <div className="h-2 w-2 rounded-full bg-[#E53E3E]" />}
        {!isNegative && !isSubtotal && !isTotal && (
          <div className="h-2 w-2 rounded-full bg-[#1B4B8A]" />
        )}
        <span
          className={cn(
            "text-sm",
            isSubtotal || isTotal ? "font-medium text-card-foreground" : "text-muted-foreground",
            isNegative && "text-[#E53E3E]"
          )}
        >
          {label}
          {isNegative && " (-)"}
          {isSubtotal && " (=)"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isPositive && isSubtotal && (
          <TrendingUp className="h-4 w-4 text-[#22C55E]" />
        )}
        <span
          className={cn(
            "text-sm font-semibold",
            isPositive && isSubtotal ? "text-[#22C55E]" : "text-card-foreground"
          )}
        >
          {fmt(value)}
        </span>
      </div>
    </div>
  )
}

export function DRECard({ month, year }: DRECardProps) {
  const { data, isLoading } = useDRE(month, year)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const monthLabel = months[month - 1]?.toUpperCase() || ""

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <h3 className="text-xl font-bold text-card-foreground">DRE</h3>
      </div>

      {/* Table Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">Descricao</span>
        <span className="text-xs font-medium text-muted-foreground uppercase">{monthLabel} {year}</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        <DRERow
          label="Receita Operacional Bruta"
          value={data?.receitaOperacionalBruta ?? 0}
          expandable
          expanded={expandedSections.has("receita")}
          onToggle={() => toggleSection("receita")}
        />

        <DRERow
          label="Deducoes de Receita Bruta"
          value={data?.deducoesReceitaBruta ?? 0}
          isNegative
        />

        <DRERow
          label="Receita Liquida (apos deducoes de venda)"
          value={data?.receitaLiquida ?? 0}
          isSubtotal
        />

        <DRERow
          label="Custo Direto de Vendas"
          value={data?.custoDiretoVendas ?? 0}
          isNegative
        />

        <DRERow
          label="Resultado / Lucro Bruto"
          value={data?.lucroBruto ?? 0}
          isSubtotal
        />

        <DRERow
          label="Despesas Operacionais e Administrativas"
          value={data?.despesasOperacionais ?? 0}
          isNegative
        />

        <DRERow
          label="EBITDA / Resultado Operacional"
          value={data?.ebitda ?? 0}
          isSubtotal
        />

        <DRERow
          label="Outras Receitas Nao Operacionais"
          value={data?.outrasReceitasNaoOperacionais ?? 0}
        />

        <DRERow
          label="Outras Despesas Nao Operacionais"
          value={data?.outrasDespesasNaoOperacionais ?? 0}
          isNegative
        />

        <DRERow
          label="IR / CSLL"
          value={data?.irCsll ?? 0}
          isNegative
        />

        <DRERow
          label="Lucro Liquido do Periodo"
          value={data?.lucroLiquidoPeriodo ?? 0}
          isSubtotal
          isTotal
        />
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Valores calculados com base nos lancamentos com status &quot;confirmado&quot; e categorias vinculadas ao grupo DRE correspondente. Para incluir um lancamento no DRE, vincule sua categoria a um grupo DRE nas configuracoes de Categorias.
        </p>
      </div>
    </div>
  )
}
