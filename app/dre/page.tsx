"use client"

import { useState } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { Loader2, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react"

// ---- Estrutura fixa do DRE (baseada na imagem) ----
const ESTRUTURA_DRE = [
  {
    key: "receita_bruta",
    label: "Receita Operacional Bruta",
    tipo: "receita",
    sinal: 1,
    destaque: true,
    cor: "hsl(216,60%,22%)",
  },
  {
    key: "deducoes_receita",
    label: "Deducoes de Receita Bruta",
    tipo: "despesa",
    sinal: -1,
    destaque: true,
    cor: "hsl(0,72%,51%)",
    subtitulo: "(-)",
  },
  // Receita Liquida = receita_bruta - deducoes_receita (calculado)
  {
    key: "_receita_liquida",
    label: "Receita Liquida (apos deducoes de venda)",
    tipo: "calculado",
    sinal: 1,
    destaque: true,
    cor: "hsl(216,50%,35%)",
    subtitulo: "(=)",
    formula: ["receita_bruta", "-", "deducoes_receita"],
  },
  {
    key: "custo_direto",
    label: "Custo Direto de Vendas",
    tipo: "despesa",
    sinal: -1,
    destaque: true,
    cor: "hsl(0,72%,51%)",
    subtitulo: "(-)",
  },
  // Lucro Bruto = receita_liquida - custo_direto (calculado)
  {
    key: "_lucro_bruto",
    label: "Resultado / Lucro Bruto",
    tipo: "calculado",
    sinal: 1,
    destaque: true,
    cor: "hsl(216,50%,35%)",
    subtitulo: "(=)",
    formula: ["_receita_liquida", "-", "custo_direto"],
  },
  {
    key: "despesas_operacionais",
    label: "Despesas Operacionais e Administrativas",
    tipo: "despesa",
    sinal: -1,
    destaque: true,
    cor: "hsl(0,72%,51%)",
    subtitulo: "(-)",
  },
  // EBITDA = lucro_bruto - despesas_operacionais (calculado)
  {
    key: "_ebitda",
    label: "EBITDA / Resultado Operacional",
    tipo: "calculado",
    sinal: 1,
    destaque: true,
    cor: "hsl(142,71%,30%)",
    subtitulo: "(=)",
    formula: ["_lucro_bruto", "-", "despesas_operacionais"],
  },
  {
    key: "outras_receitas",
    label: "Outras Receitas Nao Operacionais",
    tipo: "receita",
    sinal: 1,
    destaque: true,
    cor: "hsl(216,60%,22%)",
  },
  {
    key: "outras_despesas",
    label: "Outras Despesas Nao Operacionais",
    tipo: "despesa",
    sinal: -1,
    destaque: true,
    cor: "hsl(0,72%,51%)",
    subtitulo: "(-)",
  },
  {
    key: "ir_csll",
    label: "IR / CSLL",
    tipo: "despesa",
    sinal: -1,
    destaque: true,
    cor: "hsl(0,72%,51%)",
    subtitulo: "(-)",
  },
  // Lucro Liquido final
  {
    key: "_lucro_liquido",
    label: "Lucro Liquido do Periodo",
    tipo: "calculado",
    sinal: 1,
    destaque: true,
    cor: "hsl(142,71%,30%)",
    subtitulo: "(=)",
    formula: ["_ebitda", "+", "outras_receitas", "-", "outras_despesas", "-", "ir_csll"],
  },
]

interface CategoriaRow {
  id: number
  nome: string
  grupo_dre: string
  total: number
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function getMesAno(ano: number, mes: number) {
  const from = `${ano}-${String(mes).padStart(2, "0")}-01`
  const lastDay = new Date(ano, mes, 0).getDate()
  const to = `${ano}-${String(mes).padStart(2, "0")}-${lastDay}`
  return { from, to }
}

async function fetchDRE(ano: number, mes: number): Promise<CategoriaRow[]> {
  const supabase = createClient()
  const { from, to } = getMesAno(ano, mes)

  // Busca lancamentos do periodo com categoria e grupo_dre
  const { data, error } = await supabase
    .from("lancamentos")
    .select(`valor, tipo, categorias(id, nome, grupo_dre)`)
    .gte("data", from)
    .lte("data", to)
    .eq("status", "confirmado")

  if (error) throw error

  // Busca vendas do periodo - toda venda entra como Receita Operacional Bruta
  const { data: vendasData } = await supabase
    .from("vendas")
    .select(`valor_total, data_venda`)
    .gte("data_venda", from)
    .lte("data_venda", to + "T23:59:59")

  // Agrupa por categoria
  const map: Record<string, CategoriaRow> = {}
  for (const row of data || []) {
    const cat = row.categorias as { id: number; nome: string; grupo_dre: string } | null
    if (!cat || !cat.grupo_dre) continue
    const key = `${cat.id}`
    if (!map[key]) map[key] = { id: cat.id, nome: cat.nome, grupo_dre: cat.grupo_dre, total: 0 }
    map[key].total += Number(row.valor)
  }

  // Adiciona vendas como Receita Operacional Bruta
  if (vendasData && vendasData.length > 0) {
    const totalVendas = vendasData.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0)
    if (totalVendas > 0) {
      const vendasKey = "vendas_receita_bruta"
      map[vendasKey] = { id: -1, nome: "Vendas", grupo_dre: "receita_bruta", total: totalVendas }
    }
  }

  return Object.values(map)
}

export default function DREPage() {
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const { data: rows = [], isLoading, error } = useSWR(["dre", ano, mes], () => fetchDRE(ano, mes))

  // Agrupa totais por grupo_dre
  const totaisByGrupo: Record<string, number> = {}
  const categoriasByGrupo: Record<string, CategoriaRow[]> = {}
  for (const row of rows) {
    if (!totaisByGrupo[row.grupo_dre]) { totaisByGrupo[row.grupo_dre] = 0; categoriasByGrupo[row.grupo_dre] = [] }
    totaisByGrupo[row.grupo_dre] += row.total
    categoriasByGrupo[row.grupo_dre].push(row)
  }

  // Calcula valores (incluindo calculados)
  const valores: Record<string, number> = {}
  for (const grupo of ESTRUTURA_DRE) {
    if (grupo.formula) {
      // Ex: ["receita_bruta", "-", "deducoes_receita"]
      let total = 0
      let op = "+"
      for (const token of grupo.formula) {
        if (token === "+" || token === "-") { op = token; continue }
        const v = valores[token] ?? 0
        total = op === "+" ? total + v : total - v
      }
      valores[grupo.key] = total
    } else {
      valores[grupo.key] = totaisByGrupo[grupo.key] ?? 0
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const meses = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
  const anos = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="DRE - Demonstrativo de Resultado" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">

            {/* Filtros de periodo */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
                  className="bg-transparent text-sm font-medium text-foreground focus:outline-none">
                  {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
                  className="bg-transparent text-sm font-medium text-foreground focus:outline-none">
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                Dados de lancamentos confirmados com categoria vinculada ao DRE.
              </p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Calculando DRE...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">Erro ao carregar dados do DRE.</p>
              </div>
            )}

            {!isLoading && !error && (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border bg-muted/30 px-6 py-3">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Descricao</span>
                  <span className="text-right text-xs font-semibold uppercase text-muted-foreground">{meses[mes - 1]} {ano}</span>
                </div>

                {/* DRE rows */}
                {ESTRUTURA_DRE.map((grupo) => {
                  const valor = valores[grupo.key] ?? 0
                  const isCalculado = grupo.tipo === "calculado"
                  const isExpanded = expandedGroups.has(grupo.key)
                  const cats = categoriasByGrupo[grupo.key] || []
                  const hasSubitens = !isCalculado && cats.length > 0
                  const isPositive = valor >= 0
                  const sinaledValue = grupo.sinal === -1 ? -Math.abs(valor) : valor

                  return (
                    <div key={grupo.key}>
                      {/* Separator before calculated rows */}
                      {isCalculado && <div className="border-t-2 border-border" />}

                      <div
                        className={`group grid grid-cols-[1fr_auto] items-center gap-4 px-6 transition-colors ${
                          isCalculado
                            ? "py-4 bg-[hsl(216,60%,22%)]/5 border-b border-border/50"
                            : "py-3.5 border-b border-border/50 hover:bg-muted/30"
                        } ${hasSubitens ? "cursor-pointer" : ""}`}
                        onClick={hasSubitens ? () => toggleGroup(grupo.key) : undefined}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {hasSubitens ? (
                            <button type="button" className="shrink-0 text-muted-foreground">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : (
                            <div className={`h-3 w-3 shrink-0 rounded-sm ${isCalculado ? "opacity-0" : ""}`} style={{ backgroundColor: grupo.cor }} />
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${isCalculado ? "font-bold text-card-foreground" : "font-semibold text-card-foreground"}`}>
                              {grupo.label}
                            </span>
                            {grupo.subtitulo && (
                              <span className={`text-xs font-semibold ${
                                grupo.subtitulo === "(=)" ? "text-[hsl(216,60%,50%)]" : "text-[hsl(0,72%,51%)]"
                              }`}>{grupo.subtitulo}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCalculado && (
                            valor > 0 ? <TrendingUp className="h-4 w-4 text-[hsl(142,71%,40%)]" />
                            : valor < 0 ? <TrendingDown className="h-4 w-4 text-[hsl(0,72%,51%)]" />
                            : <Minus className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={`text-right text-sm whitespace-nowrap ${
                            isCalculado
                              ? valor > 0 ? "font-bold text-[hsl(142,71%,40%)]"
                              : valor < 0 ? "font-bold text-[hsl(0,72%,51%)]"
                              : "font-bold text-muted-foreground"
                              : "font-semibold text-card-foreground"
                          }`}>
                            {formatCurrency(isCalculado ? valor : Math.abs(valor))}
                          </span>
                        </div>
                      </div>

                      {/* Subcategoria rows */}
                      {isExpanded && cats.map((cat) => (
                        <div key={cat.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border/30 bg-muted/20 px-6 py-2.5">
                          <div className="flex items-center gap-4">
                            <div className="w-8" /> {/* indent */}
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                            <span className="text-sm text-muted-foreground">{cat.nome}</span>
                          </div>
                          <span className="text-right text-sm font-medium text-card-foreground">{formatCurrency(Math.abs(cat.total))}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Footer note */}
                <div className="px-6 py-4 bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    Valores calculados com base nos lancamentos com status &quot;confirmado&quot; e categorias vinculadas ao grupo DRE correspondente.
                    Para incluir um lancamento no DRE, vincule sua categoria a um grupo DRE nas configuracoes de Categorias.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
