"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ESTRUTURA_DRE, DRE_BY_CODE, getFilhos, type DRENode } from "@/lib/dre-structure"
import { fmt } from "@/hooks/use-dashboard-data"
import type { DRECategoriaDetalhe } from "@/hooks/use-dashboard-data"

interface DREViewProps {
  valores: Record<string, number>
  detalhePorCodigo?: Record<string, DRECategoriaDetalhe[]>
  periodoLabel?: string
  showHeader?: boolean
  title?: string
}

// Cores
const GRUPO_BG = "bg-[#E8EEF7]"          // fundo do grupo principal (azul clarinho)
const SUBTOTAL_BG = "bg-[#D1DCE9]"       // fundo dos resultados (5.0, 9.0, 11.0) um pouco mais escuro
const COR_POS = "text-[hsl(142,71%,35%)]"
const COR_NEG = "text-[hsl(0,72%,51%)]"
const RESULTADO_DESTACADO = new Set(["3.0", "5.0", "9.0", "11.0"])

function valorColor(v: number) {
  if (v > 0) return COR_POS
  if (v < 0) return COR_NEG
  return "text-muted-foreground"
}

// Calcula percentual sobre a Receita Bruta (1.0) para os destaques
function pctLabel(codigo: string, valor: number, valores: Record<string, number>): string | null {
  const base = valores["1.0"] || 0
  if (!base || !RESULTADO_DESTACADO.has(codigo)) return null
  const pct = (valor / base) * 100
  return `${pct.toFixed(2).replace(".", ",")}%`
}

export function DREView({ valores, detalhePorCodigo = {}, periodoLabel, showHeader = true, title = "DRE Financeiro" }: DREViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (codigo: string) =>
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(codigo)) n.delete(codigo); else n.add(codigo)
      return n
    })

  // Nós de primeiro nível (sem parent)
  const nivel1 = ESTRUTURA_DRE.filter((n) => !n.parent)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {showHeader && (
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-xl font-bold text-card-foreground">{title}</h3>
        </div>
      )}

      {/* Header da tabela */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Descrição</span>
        <span className="text-xs font-semibold uppercase text-muted-foreground">{periodoLabel || "Valores"}</span>
      </div>

      <div className="p-4">
        {nivel1.map((grupo) => (
          <GrupoRow
            key={grupo.codigo}
            grupo={grupo}
            valores={valores}
            detalhe={detalhePorCodigo}
            expanded={expanded}
            toggle={toggle}
          />
        ))}
      </div>
    </div>
  )
}

function GrupoRow({
  grupo,
  valores,
  detalhe,
  expanded,
  toggle,
}: {
  grupo: DRENode
  valores: Record<string, number>
  detalhe: Record<string, DRECategoriaDetalhe[]>
  expanded: Set<string>
  toggle: (c: string) => void
}) {
  const valor = valores[grupo.codigo] ?? 0
  const filhos = getFilhos(grupo.codigo)
  const hasFilhos = filhos.length > 0
  const isExpanded = expanded.has(grupo.codigo)
  const isResultado = RESULTADO_DESTACADO.has(grupo.codigo)
  const pct = pctLabel(grupo.codigo, valor, valores)

  // Sinal exibido: se for um grupo de débito sem formula própria, exibir como -
  const isDebito = grupo.tipo === "debito" || ["2.0", "4.0", "7.0", "10.0"].includes(grupo.codigo)
  const valorExibido = isDebito && valor > 0 ? -valor : valor
  const cor = valorColor(valorExibido)

  // Sinal de operação (+, -, =)
  const sinal = grupo.tipo === "resultado" ? "=" : grupo.tipo === "debito" ? "-" : "+"

  return (
    <div className="mb-4">
      <div
        className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-4 py-3 ${
          isResultado ? SUBTOTAL_BG + " font-semibold" : GRUPO_BG
        } ${hasFilhos ? "cursor-pointer hover:bg-muted/50" : ""}`}
        onClick={hasFilhos ? () => toggle(grupo.codigo) : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasFilhos ? (
            isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-[#1B4B8A]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#1B4B8A]" />
          ) : (
            <span className="inline-block h-4 w-4 shrink-0" />
          )}
          <span className="text-sm font-semibold text-card-foreground truncate">
            {sinal} {grupo.label}
          </span>
        </div>
        <div className={`text-right text-sm font-semibold whitespace-nowrap ${cor}`}>
          {fmt(valorExibido)}
        </div>
        <div className="w-16 text-right text-xs font-medium text-[#1B4B8A]">
          {pct || ""}
        </div>
      </div>

      {/* Subgrupos (1.1, 1.2, etc) */}
      {isExpanded && filhos.map((filho) => (
        <SubgrupoRow key={filho.codigo} node={filho} valores={valores} detalhe={detalhe} />
      ))}
    </div>
  )
}

function SubgrupoRow({
  node,
  valores,
  detalhe,
}: {
  node: DRENode
  valores: Record<string, number>
  detalhe: Record<string, DRECategoriaDetalhe[]>
}) {
  const [open, setOpen] = useState(false)
  const v = valores[node.codigo] ?? 0
  const isDebito = node.tipo === "debito"
  const valorExibido = isDebito && v > 0 ? -v : v
  const categorias = detalhe[node.codigo] || []
  const hasDetalhe = categorias.length > 0

  // Sinal de operação (+, -, =)
  const sinal = node.tipo === "resultado" ? "=" : node.tipo === "debito" ? "-" : "+"

  return (
    <div>
      <div
        className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/30 bg-muted/30 px-4 py-2 pl-10 ${
          hasDetalhe ? "cursor-pointer hover:bg-muted/50" : ""
        }`}
        onClick={hasDetalhe ? () => setOpen((o) => !o) : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasDetalhe ? (
            open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <span className="inline-block h-3.5 w-3.5" />
          )}
          <span className="text-sm text-muted-foreground truncate">
            {sinal} {node.label}
          </span>
        </div>
        <div className={`text-right text-sm whitespace-nowrap ${valorColor(valorExibido)}`}>
          {fmt(valorExibido)}
        </div>
        <div className="w-16" />
      </div>

      {open && categorias.map((c) => (
        <div
          key={c.categoria_id}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/20 bg-muted/10 px-4 py-1.5 pl-16"
        >
          <span className="text-xs text-muted-foreground truncate">• {c.categoria_nome}</span>
          <span className={`text-right text-xs whitespace-nowrap ${valorColor(isDebito ? -c.total : c.total)}`}>
            {fmt(isDebito ? -c.total : c.total)}
          </span>
          <div className="w-16" />
        </div>
      ))}
    </div>
  )
}
