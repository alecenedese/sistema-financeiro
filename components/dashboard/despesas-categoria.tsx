"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, Tooltip, Sector } from "recharts"
import { ArrowLeft, PieChartIcon, X, Loader2 } from "lucide-react"
import { useCategoryChartsMonth, fmt, type CategoryPoint } from "@/hooks/use-dashboard-data"
import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/hooks/use-tenant"

interface Lancamento {
  id: number
  descricao: string
  fornecedor_nome: string
  valor: number
  vencimento: string
  data_vencimento: string
  status: string
  categoria: string
  subcategoria: string
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

const COLORS = ["#1B4B8A", "#2196F3", "#4FC3F7", "#81D4FA", "#B3E5FC"]

interface DespesasPorCategoriaProps {
  month: number
  year: number
}

export function DespesasPorCategoria({ month, year }: DespesasPorCategoriaProps) {
  const { data, isLoading } = useCategoryChartsMonth(month, year)
  const { tenant } = useTenant()
  const [drillCategory, setDrillCategory] = useState<CategoryPoint | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCategory, setModalCategory] = useState<string | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loadingLancamentos, setLoadingLancamentos] = useState(false)

  // Busca lançamentos quando abre o modal
  useEffect(() => {
    if (!modalOpen || !modalCategory) return
    
    async function fetchLancamentos() {
      setLoadingLancamentos(true)
      const supabase = createClient()
      const from = `${year}-${String(month).padStart(2, "0")}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

      let query = supabase
        .from("contas_pagar")
        .select(`
          id, 
          descricao, 
          valor, 
          vencimento,
          status,
          categorias(nome),
          subcategorias(nome),
          fornecedores(nome)
        `)
        .gte("vencimento", from)
        .lte("vencimento", to)
      
      if (tenant?.id) {
        query = query.eq("tenant_id", tenant.id)
      }

      const { data: rawData } = await query

      // Filtra pela categoria selecionada
      const filtered = (rawData || [])
        .filter(r => {
          const catName = (r.categorias as { nome: string } | null)?.nome || "Sem categoria"
          return catName === modalCategory
        })
        .map(r => ({
          id: r.id,
          descricao: r.descricao || "Sem descrição",
          fornecedor_nome: (r.fornecedores as { nome: string } | null)?.nome || "Sem fornecedor",
          valor: Number(r.valor),
          vencimento: r.vencimento || "",
          data_vencimento: r.vencimento || "",
          status: r.status || "",
          categoria: (r.categorias as { nome: string } | null)?.nome || "Sem categoria",
          subcategoria: (r.subcategorias as { nome: string } | null)?.nome || "Geral",
        }))
        .sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime())

      setLancamentos(filtered)
      setLoadingLancamentos(false)
    }

    fetchLancamentos()
  }, [modalOpen, modalCategory, month, year, tenant?.id])

  function handleOpenModal(categoryName: string) {
    setModalCategory(categoryName)
    setModalOpen(true)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setModalCategory(null)
    setLancamentos([])
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="flex flex-col items-center xl:flex-row xl:items-center gap-6">
          <div className="h-80 w-80 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-col gap-3 flex-1 w-full">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="h-8 w-full animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const expenses = data?.expenses ?? []
  const expTotal = expenses.reduce((a, b) => a + b.value, 0)

  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-bold text-card-foreground">Despesas por Categoria</h3>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <PieChartIcon className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum lancamento neste mes</p>
        </div>
      </div>
    )
  }

  // Adiciona cores aos dados
  const coloredExpenses = expenses.map((item, idx) => ({
    ...item,
    color: COLORS[idx % COLORS.length],
    subcategorias: item.subcategorias.map((sub, subIdx) => ({
      ...sub,
      color: COLORS[(idx + subIdx) % COLORS.length],
    })),
  }))

  const displayData = drillCategory 
    ? drillCategory.subcategorias 
    : coloredExpenses
  const displayTotal = drillCategory
    ? drillCategory.subcategorias.reduce((acc, s) => acc + s.value, 0)
    : expTotal

  const size = 320

  function handlePieClick(_: unknown, index: number) {
    // Abre o modal ao clicar no gráfico
    if (coloredExpenses[index]) {
      handleOpenModal(coloredExpenses[index].name)
    }
  }

  function handleBack() {
    setDrillCategory(null)
    setActiveIndex(undefined)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
        <h3 className="text-lg font-bold text-card-foreground">
          {drillCategory ? `Despesas por Categoria — ${drillCategory.name}` : "Despesas por Categoria"}
        </h3>
        <span className="ml-auto text-xl font-bold text-[#E53E3E]">
          -{fmt(displayTotal)}
        </span>
      </div>
      {!drillCategory && (
        <p className="mb-4 text-xs text-muted-foreground">
          Clique em uma categoria para ver os lan��amentos
        </p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Grafico de rosca - fixo na esquerda */}
        <div className="relative shrink-0 self-center lg:self-start" style={{ width: size, height: size }}>
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
            <span className="text-2xl font-bold text-[#E53E3E]">-{fmt(displayTotal)}</span>
          </div>
        </div>

        {/* Lista de categorias - com scroll */}
        <div className="flex flex-1 flex-col min-w-0 w-full">
          <div className="max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <div className="flex flex-col gap-2">
              {displayData.map((item, idx) => {
                const pct = displayTotal > 0 ? (item.value / displayTotal) * 100 : 0
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleOpenModal(item.name)}
                    onMouseEnter={() => { if (!drillCategory) setActiveIndex(idx) }}
                    onMouseLeave={() => { if (!drillCategory) setActiveIndex(undefined) }}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted cursor-pointer ${activeIndex === idx && !drillCategory ? "bg-muted" : ""}`}
                  >
                    <div className="h-6 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <span className="flex-1 truncate text-sm text-card-foreground">
                      {item.name}: {fmt(item.value)}
                    </span>
                    <span className="text-sm text-muted-foreground">-</span>
                    <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">{pct.toFixed(2)}%</span>
                  </button>
                )
              })}
            </div>
          </div>
          {drillCategory && (
            <button
              type="button"
              onClick={handleBack}
              className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para todas as categorias
            </button>
          )}
        </div>
      </div>

      {/* Modal de lançamentos */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCloseModal}>
          <div 
            className="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-card-foreground">
                  Lançamentos - {modalCategory}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {lancamentos.length} lançamento(s) encontrado(s)
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {loadingLancamentos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : lancamentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">Nenhum lançamento encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lancamentos.map((lanc) => (
                    <div
                      key={lanc.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-card-foreground truncate">
                          {lanc.fornecedor_nome}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{lanc.descricao}</span>
                          <span>•</span>
                          <span>
                            {new Date(lanc.vencimento || lanc.data_vencimento).toLocaleDateString("pt-BR")}
                          </span>
                          <span>•</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            lanc.status === "pago" || lanc.status === "confirmado"
                              ? "bg-green-100 text-green-700"
                              : lanc.status === "pendente"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {lanc.status || "pendente"}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="font-bold text-[#E53E3E]">-{fmt(lanc.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer com total */}
            {lancamentos.length > 0 && (
              <div className="flex items-center justify-between border-t border-border px-6 py-4">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-[#E53E3E]">
                  -{fmt(lancamentos.reduce((acc, l) => acc + l.valor, 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
