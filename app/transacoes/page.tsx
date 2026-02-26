"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  ArrowDownLeft, ArrowUpRight, Plus, TrendingUp, TrendingDown,
  ArrowLeftRight, Search, Filter, Loader2, Pencil, Trash2,
  ChevronDown, CalendarDays, X,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ContaBancaria { id: number; nome: string }
interface Categoria { id: number; nome: string; tipo: string; cor: string }
interface Lancamento {
  id: number
  descricao: string
  valor: number
  tipo: "receita" | "despesa"
  data: string
  categoria_id: number | null
  conta_bancaria_id: number | null
  forma_pagamento: string
  status: string
  categoria_nome: string
  categoria_cor: string
  conta_nome: string
}

type PeriodoFiltro = "hoje" | "ontem" | "7dias" | "mes" | "personalizado"

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}
function formatDate(s: string) {
  if (!s) return "-"
  const [y, m, d] = s.split("-")
  return `${d}/${m}/${y}`
}
function toISOLocal(date: Date) {
  return date.toISOString().split("T")[0]
}
function getPeriodoDates(periodo: PeriodoFiltro, custom: { from: string; to: string }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (periodo === "hoje") return { from: toISOLocal(today), to: toISOLocal(today) }
  if (periodo === "ontem") {
    const y = new Date(today); y.setDate(y.getDate() - 1)
    return { from: toISOLocal(y), to: toISOLocal(y) }
  }
  if (periodo === "7dias") {
    const w = new Date(today); w.setDate(w.getDate() - 6)
    return { from: toISOLocal(w), to: toISOLocal(today) }
  }
  if (periodo === "mes") {
    const m = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toISOLocal(m), to: toISOLocal(today) }
  }
  return { from: custom.from, to: custom.to }
}

async function fetchContas(): Promise<ContaBancaria[]> {
  const supabase = createClient()
  const { data } = await supabase.from("contas_bancarias").select("id,nome").order("nome")
  return (data || []).map((r) => ({ id: r.id, nome: r.nome }))
}

async function fetchCategorias(): Promise<Categoria[]> {
  const supabase = createClient()
  const { data } = await supabase.from("categorias").select("id,nome,tipo,cor").order("nome")
  return (data || []).map((r) => ({ id: r.id, nome: r.nome, tipo: r.tipo, cor: r.cor || "#7A8FA6" }))
}

async function fetchLancamentos(filters: {
  periodo: PeriodoFiltro; customFrom: string; customTo: string
  tipo: "todos" | "receita" | "despesa"
  contaId: string; categoriaId: string; search: string
}): Promise<Lancamento[]> {
  const supabase = createClient()
  const { from, to } = getPeriodoDates(filters.periodo, { from: filters.customFrom, to: filters.customTo })

  let q = supabase
    .from("lancamentos")
    .select(`id,descricao,valor,tipo,data,categoria_id,conta_bancaria_id,forma_pagamento,status,categorias(nome,cor),contas_bancarias(nome)`)
    .order("data", { ascending: false })
    .order("id", { ascending: false })
    .limit(200)

  if (from) q = q.gte("data", from)
  if (to) q = q.lte("data", to)
  if (filters.tipo !== "todos") q = q.eq("tipo", filters.tipo)
  if (filters.contaId) q = q.eq("conta_bancaria_id", filters.contaId)
  if (filters.categoriaId) q = q.eq("categoria_id", filters.categoriaId)

  const { data, error } = await q
  if (error) throw error

  let items = (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    descricao: r.descricao as string,
    valor: Number(r.valor),
    tipo: r.tipo as "receita" | "despesa",
    data: r.data as string,
    categoria_id: r.categoria_id as number | null,
    conta_bancaria_id: r.conta_bancaria_id as number | null,
    forma_pagamento: (r.forma_pagamento as string) || "",
    status: (r.status as string) || "confirmado",
    categoria_nome: (r.categorias as Record<string, string> | null)?.nome || "",
    categoria_cor: (r.categorias as Record<string, string> | null)?.cor || "#7A8FA6",
    conta_nome: (r.contas_bancarias as Record<string, string> | null)?.nome || "",
  }))

  if (filters.search.trim()) {
    const s = filters.search.toLowerCase()
    items = items.filter((i) => i.descricao.toLowerCase().includes(s) || i.categoria_nome.toLowerCase().includes(s) || i.conta_nome.toLowerCase().includes(s))
  }
  return items
}

const emptyForm = {
  descricao: "", valor: "", data: "", tipo: "despesa" as "receita" | "despesa",
  categoria_id: "", conta_bancaria_id: "", forma_pagamento: "", status: "confirmado",
}

export default function TransacoesPageWrapper() {
  return <Suspense><TransacoesPage /></Suspense>
}

function TransacoesPage() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [filterTipo, setFilterTipo] = useState<"todos" | "receita" | "despesa">("todos")
  const [filterConta, setFilterConta] = useState("")
  const [filterCategoria, setFilterCategoria] = useState("")
  const [search, setSearch] = useState("")
  const [showPeriodo, setShowPeriodo] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Lancamento | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Lancamento | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()

  const filters = { periodo, customFrom, customTo, tipo: filterTipo, contaId: filterConta, categoriaId: filterCategoria, search }
  const swrKey = ["lancamentos", JSON.stringify(filters)]

  const { data: lancamentos = [], isLoading, mutate } = useSWR(swrKey, () => fetchLancamentos(filters), { keepPreviousData: true })
  const { data: contas = [] } = useSWR("contas_select", fetchContas)
  const { data: categorias = [] } = useSWR("categorias_select", fetchCategorias)

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setForm({ ...emptyForm, data: toISOLocal(new Date()) })
      setEditingItem(null)
      setDialogOpen(true)
      router.replace("/transacoes")
    }
  }, [searchParams, router])

  const totalEntradas = lancamentos.filter((l) => l.tipo === "receita").reduce((a, l) => a + l.valor, 0)
  const totalSaidas = lancamentos.filter((l) => l.tipo === "despesa").reduce((a, l) => a + l.valor, 0)
  const saldo = totalEntradas - totalSaidas

  const periodoLabels: Record<PeriodoFiltro, string> = {
    hoje: "Hoje", ontem: "Ontem", "7dias": "Ultimos 7 dias", mes: "Este mes", personalizado: "Personalizado",
  }

  function openNew() {
    setForm({ ...emptyForm, data: toISOLocal(new Date()) })
    setEditingItem(null)
    setDialogOpen(true)
  }

  function openEdit(l: Lancamento) {
    setEditingItem(l)
    setForm({
      descricao: l.descricao, valor: l.valor.toString(), data: l.data, tipo: l.tipo,
      categoria_id: l.categoria_id?.toString() || "",
      conta_bancaria_id: l.conta_bancaria_id?.toString() || "",
      forma_pagamento: l.forma_pagamento, status: l.status,
    })
    setDialogOpen(true)
  }

  const handleSave = useCallback(async () => {
    if (!form.descricao.trim() || !form.valor) return
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        descricao: form.descricao,
        valor: parseFloat(form.valor) || 0,
        tipo: form.tipo,
        data: form.data || toISOLocal(new Date()),
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        conta_bancaria_id: form.conta_bancaria_id ? Number(form.conta_bancaria_id) : null,
        forma_pagamento: form.forma_pagamento || null,
        status: form.status,
      }
      if (editingItem) {
        await supabase.from("lancamentos").update(payload).eq("id", editingItem.id)
      } else {
        await supabase.from("lancamentos").insert(payload)
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }, [form, editingItem, mutate])

  const handleDelete = useCallback(async (l: Lancamento) => {
    const supabase = createClient()
    await supabase.from("lancamentos").delete().eq("id", l.id)
    await mutate()
    setDeleteConfirm(null)
  }, [mutate])

  function clearFilters() {
    setFilterTipo("todos"); setFilterConta(""); setFilterCategoria(""); setSearch(""); setPeriodo("mes")
  }
  const hasFilters = filterTipo !== "todos" || filterConta || filterCategoria || search

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Transacoes" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Entradas", value: totalEntradas, icon: TrendingUp, color: "hsl(142,71%,40%)" },
                { label: "Total Saidas", value: totalSaidas, icon: TrendingDown, color: "hsl(0,72%,51%)" },
                { label: "Saldo do Periodo", value: saldo, icon: ArrowLeftRight, color: "hsl(216,60%,22%)", signed: true },
                { label: "Total Lancamentos", value: lancamentos.length, icon: Filter, color: "hsl(216,20%,60%)", count: true },
              ].map(({ label, value, icon: Icon, color, signed, count }) => (
                <div key={label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`mt-1 text-xl font-bold ${signed && value < 0 ? "text-[hsl(0,72%,51%)]" : signed && value >= 0 ? "text-[hsl(142,71%,40%)]" : "text-card-foreground"}`}>
                      {count ? value : formatCurrency(value)}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              ))}
            </div>

            {/* Filters bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Periodo picker */}
              <div className="relative">
                <button type="button" onClick={() => setShowPeriodo(!showPeriodo)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {periodoLabels[periodo]}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {showPeriodo && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-border bg-card shadow-lg">
                    {(Object.entries(periodoLabels) as [PeriodoFiltro, string][]).map(([key, label]) => (
                      <button key={key} type="button"
                        onClick={() => { setPeriodo(key); if (key !== "personalizado") setShowPeriodo(false) }}
                        className={`flex w-full items-center px-4 py-2.5 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${periodo === key ? "bg-primary/5 font-medium text-primary" : "text-foreground hover:bg-muted"}`}>
                        {label}
                      </button>
                    ))}
                    {periodo === "personalizado" && (
                      <div className="border-t border-border px-4 pb-3 pt-2 space-y-2">
                        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
                        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
                        <button type="button" onClick={() => setShowPeriodo(false)} className="w-full rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground">Aplicar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tipo */}
              <div className="flex items-center rounded-lg border border-border bg-card">
                {(["todos", "receita", "despesa"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setFilterTipo(t)}
                    className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors first:rounded-l-lg last:rounded-r-lg ${filterTipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {t === "todos" ? "Todos" : t === "receita" ? "Entradas" : "Saidas"}
                  </button>
                ))}
              </div>

              {/* Conta */}
              <select value={filterConta} onChange={(e) => setFilterConta(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none">
                <option value="">Todas as contas</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>

              {/* Categoria */}
              <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none">
                <option value="">Todas as categorias</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>

              {/* Search */}
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 min-w-[160px]">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                {search && <button type="button" onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>}
              </div>

              {hasFilters && (
                <button type="button" onClick={clearFilters} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />Limpar filtros
                </button>
              )}

              <button type="button" onClick={openNew} className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" />Novo Lancamento
              </button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Descricao</span>
                <span>Categoria</span>
                <span>Conta</span>
                <span>Data</span>
                <span>Status</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Acoes</span>
              </div>

              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
                </div>
              )}

              {!isLoading && lancamentos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ArrowLeftRight className="h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">Nenhum lancamento encontrado para o periodo.</p>
                  <button type="button" onClick={openNew} className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    <Plus className="h-3.5 w-3.5" />Adicionar lancamento
                  </button>
                </div>
              )}

              {!isLoading && lancamentos.map((l) => (
                <div key={l.id} className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${l.tipo === "receita" ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(0,72%,51%)]/10"}`}>
                      {l.tipo === "receita"
                        ? <ArrowDownLeft className="h-4 w-4 text-[hsl(142,71%,40%)]" />
                        : <ArrowUpRight className="h-4 w-4 text-[hsl(0,72%,51%)]" />}
                    </div>
                    <span className="truncate text-sm font-medium text-card-foreground">{l.descricao}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {l.categoria_cor && <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.categoria_cor }} />}
                    <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{l.categoria_nome || "-"}</span>
                  </div>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">{l.conta_nome || "-"}</span>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(l.data)}</span>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    l.status === "confirmado" || l.status === "pago" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" :
                    l.status === "pendente" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                  }`}>{l.status}</span>
                  <span className={`text-right text-sm font-semibold ${l.tipo === "receita" ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>
                    {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Math.abs(l.valor))}
                  </span>
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => openEdit(l)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setDeleteConfirm(l)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Dialog Lancamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Lancamento" : "Novo Lancamento"}</DialogTitle>
            <DialogDescription>Preencha os dados do lancamento financeiro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {(["receita", "despesa"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, tipo: t })}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors ${form.tipo === t
                    ? t === "receita" ? "border-[hsl(142,71%,40%)]/40 bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]"
                    : "border-[hsl(0,72%,51%)]/40 bg-[hsl(0,72%,51%)]/10 text-[hsl(0,72%,51%)]"
                    : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {t === "receita" ? "Entrada / Receita" : "Saida / Despesa"}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descricao</Label>
              <Input id="desc" placeholder="Ex: Aluguel, Salario..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input id="valor" type="number" step="0.01" min="0" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <Input id="data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat">Categoria</Label>
                <select id="cat" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Sem categoria</option>
                  {categorias.filter((c) => form.tipo === "receita" ? c.tipo === "Receita" : c.tipo === "Despesa").map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conta">Conta Bancaria</Label>
                <select id="conta" value={form.conta_bancaria_id} onChange={(e) => setForm({ ...form, conta_bancaria_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Sem conta</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="forma">Forma de Pagamento</Label>
                <select id="forma" value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Nao informado</option>
                  <option>Dinheiro</option>
                  <option>Pix</option>
                  <option>Cartao de Debito</option>
                  <option>Cartao de Credito</option>
                  <option>Boleto</option>
                  <option>TED / DOC</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="confirmado">Confirmado</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingItem ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lancamento</AlertDialogTitle>
            <AlertDialogDescription>Deseja excluir &quot;{deleteConfirm?.descricao}&quot;? Esta acao nao pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
