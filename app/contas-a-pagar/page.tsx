"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { getActiveTenantId, useTenant } from "@/hooks/use-tenant"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { FileDown, Plus, TrendingDown, Clock, CheckCircle2, AlertTriangle, Pencil, Trash2, Loader2, Search, X, ChevronDown, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { handleCurrencyInput, parseBRL, formatBRL } from "@/lib/currency-input"

interface CategoriaRow { id: number; nome: string; tipo: string }
interface SubcategoriaRow { id: number; nome: string; categoria_id: number }
interface SubcategoriaFilhoRow { id: number; nome: string; subcategoria_id: number }
interface ContaBancariaRow { id: number; nome: string; tipo: string }
interface FornecedorRow { id: number; nome: string }

interface ContaPagar {
  id: number
  descricao: string
  valor: number
  vencimento: string
  status: string
  fornecedor: string
  fornecedor_id: number | null
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  conta_bancaria_id: number | null
  forma_pagamento: string
  categoria_nome: string
  subcategoria_nome: string
  filho_nome: string
  conta_bancaria_nome: string
  fornecedor_nome: string
}

const FORMAS_PAGAMENTO = ["PIX", "Boleto", "Cartao de Credito", "Cartao de Debito", "Debito em Conta", "Transferencia", "Dinheiro", "Cheque"]
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

async function fetchContas([, tid]: [string, number | null]): Promise<ContaPagar[]> {
  const supabase = createClient()
  let q = supabase
    .from("contas_pagar")
    .select(`*, categorias(nome), subcategorias(nome), subcategorias_filhos(nome), contas_bancarias(nome, tipo), fornecedores(nome)`)
    .order("vencimento", { ascending: true })
  if (tid) q = q.eq("tenant_id", tid)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    descricao: row.descricao as string,
    valor: Number(row.valor),
    vencimento: row.vencimento as string,
    status: row.status as string,
    fornecedor: row.fornecedor as string,
    fornecedor_id: row.fornecedor_id as number | null,
    categoria_id: row.categoria_id as number | null,
    subcategoria_id: row.subcategoria_id as number | null,
    subcategoria_filho_id: row.subcategoria_filho_id as number | null,
    conta_bancaria_id: row.conta_bancaria_id as number | null,
    forma_pagamento: (row.forma_pagamento as string) || "",
    categoria_nome: (row.categorias as Record<string, string> | null)?.nome || "",
    subcategoria_nome: (row.subcategorias as Record<string, string> | null)?.nome || "",
    filho_nome: (row.subcategorias_filhos as Record<string, string> | null)?.nome || "",
    conta_bancaria_nome: (row.contas_bancarias as Record<string, string> | null)?.nome || "",
    fornecedor_nome: (row.fornecedores as Record<string, string> | null)?.nome || "",
  }))
}

async function fetchHierarchy(tid: number | null) {
  const supabase = createClient()
  let catQ = supabase.from("categorias").select("id, nome, tipo").order("nome")
  let subQ = supabase.from("subcategorias").select("id, nome, categoria_id").order("nome")
  let filhoQ = supabase.from("subcategorias_filhos").select("id, nome, subcategoria_id").order("nome")
  if (tid) { catQ = catQ.eq("tenant_id", tid); subQ = subQ.eq("tenant_id", tid); filhoQ = filhoQ.eq("tenant_id", tid) }
  const [catRes, subRes, filhoRes] = await Promise.all([catQ, subQ, filhoQ])
  return {
    categorias: (catRes.data || []) as CategoriaRow[],
    subcategorias: (subRes.data || []) as SubcategoriaRow[],
    filhos: (filhoRes.data || []) as SubcategoriaFilhoRow[],
  }
}

async function fetchContasBancarias(tid: number | null): Promise<ContaBancariaRow[]> {
  const supabase = createClient()
  let q = supabase.from("contas_bancarias").select("id, nome, tipo").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

async function fetchFornecedores(tid: number | null): Promise<FornecedorRow[]> {
  const supabase = createClient()
  let q = supabase.from("fornecedores").select("id, nome").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function formatDateDisplay(d: string) {
  if (!d) return "-"
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y}`
}

const emptyForm = {
  descricao: "", valor: "", vencimento: "", fornecedor_id: "",
  categoria_id: "", subcategoria_id: "", subcategoria_filho_id: "",
  conta_bancaria_id: "", status: "pendente", forma_pagamento: "",
}

export default function ContasAPagarPageWrapper() {
  return <Suspense><ContasAPagarPage /></Suspense>
}

function ContasAPagarPage() {
  const { tenant } = useTenant()
  const tid = tenant?.id ?? null
  const { data: contas = [], error, isLoading, mutate } = useSWR(["contas_pagar", tid], fetchContas)
  const { data: hierarchy } = useSWR(["hierarchy_pagar", tid], ([, t]) => fetchHierarchy(t))
  const { data: contasBancarias = [] } = useSWR(["contas_bancarias_pagar", tid], ([, t]) => fetchContasBancarias(t))
  const { data: fornecedoresLista = [] } = useSWR(["fornecedores_pagar", tid], ([, t]) => fetchFornecedores(t))

  const [filterStatus, setFilterStatus] = useState<"Todos" | "Pendente" | "Pago" | "Vencido">("Todos")
  const [filterCategoriaId, setFilterCategoriaId] = useState("")
  const [filterSubcategoriaId, setFilterSubcategoriaId] = useState("")
  const [filterPeriodo, setFilterPeriodo] = useState<"mes_atual" | "7dias" | "personalizado" | "todos">("mes_atual")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ContaPagar | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const novoProcessado = useRef(false)

  useEffect(() => {
    if (searchParams.get("novo") === "1" && !novoProcessado.current) {
      novoProcessado.current = true
      setEditingConta(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/contas-a-pagar")
    }
  }, [searchParams, router])

  const despesaCategorias = useMemo(
    () => (hierarchy?.categorias || []).filter((c) => c.tipo === "Despesa"),
    [hierarchy]
  )
  const subcategoriasDaCategoria = useMemo(
    () => (hierarchy?.subcategorias || []).filter((s) => s.categoria_id === Number(filterCategoriaId)),
    [hierarchy, filterCategoriaId]
  )
  // Form cascading
  const subcategoriasForm = useMemo(
    () => (hierarchy?.subcategorias || []).filter((s) => s.categoria_id === Number(form.categoria_id)),
    [hierarchy, form.categoria_id]
  )
  const filhosForm = useMemo(
    () => (hierarchy?.filhos || []).filter((f) => f.subcategoria_id === Number(form.subcategoria_id)),
    [hierarchy, form.subcategoria_id]
  )

  // Date range helpers
  const dateRange = useMemo(() => {
    const today = new Date()
    if (filterPeriodo === "mes_atual") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { from: first.toISOString().split("T")[0], to: last.toISOString().split("T")[0] }
    }
    if (filterPeriodo === "7dias") {
      const from = new Date(today)
      from.setDate(from.getDate() - 7)
      return { from: from.toISOString().split("T")[0], to: today.toISOString().split("T")[0] }
    }
    if (filterPeriodo === "personalizado" && customDateFrom && customDateTo) {
      return { from: customDateFrom, to: customDateTo }
    }
    return null
  }, [filterPeriodo, customDateFrom, customDateTo])

  // Filtered list
  const filtered = useMemo(() => {
    return contas.filter((c) => {
      if (filterStatus !== "Todos" && c.status !== filterStatus.toLowerCase()) return false
      if (filterCategoriaId && String(c.categoria_id) !== filterCategoriaId) return false
      if (filterSubcategoriaId && String(c.subcategoria_id) !== filterSubcategoriaId) return false
      if (dateRange && c.vencimento) {
        if (c.vencimento < dateRange.from || c.vencimento > dateRange.to) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (
          !c.descricao.toLowerCase().includes(q) &&
          !c.fornecedor_nome.toLowerCase().includes(q) &&
          !c.categoria_nome.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [contas, filterStatus, filterCategoriaId, filterSubcategoriaId, search, dateRange])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginatedFiltered = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [filterStatus, filterCategoriaId, filterSubcategoriaId, search, filterPeriodo, customDateFrom, customDateTo])

  const totalPendente = contas.filter((c) => c.status === "pendente").reduce((a, c) => a + c.valor, 0)
  const totalPago = contas.filter((c) => c.status === "pago").reduce((a, c) => a + c.valor, 0)
  const totalVencido = contas.filter((c) => c.status === "vencido").reduce((a, c) => a + c.valor, 0)
  const qtdPendente = contas.filter((c) => c.status === "pendente").length

  const hasFilter = filterStatus !== "Todos" || filterCategoriaId || filterSubcategoriaId || search || filterPeriodo !== "mes_atual"

  function clearFilters() {
    setFilterStatus("Todos")
    setFilterCategoriaId("")
    setFilterSubcategoriaId("")
    setSearch("")
    setFilterPeriodo("mes_atual")
    setCustomDateFrom("")
    setCustomDateTo("")
  }

  function openNew() {
    setEditingConta(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(conta: ContaPagar) {
    setEditingConta(conta)
    setForm({
      descricao: conta.descricao,
      valor: formatBRL(conta.valor),
      vencimento: conta.vencimento,
      fornecedor_id: conta.fornecedor_id?.toString() || "",
      categoria_id: conta.categoria_id?.toString() || "",
      subcategoria_id: conta.subcategoria_id?.toString() || "",
      subcategoria_filho_id: conta.subcategoria_filho_id?.toString() || "",
      conta_bancaria_id: conta.conta_bancaria_id?.toString() || "",
      status: conta.status,
      forma_pagamento: conta.forma_pagamento || "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.descricao.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      const selectedForn = fornecedoresLista.find((f) => f.id === Number(form.fornecedor_id))
      const payload: Record<string, unknown> = {
        descricao: form.descricao,
        valor: parseBRL(form.valor),
        vencimento: form.vencimento || new Date().toISOString().split("T")[0],
        fornecedor: selectedForn?.nome || "",
        fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        subcategoria_id: form.subcategoria_id ? Number(form.subcategoria_id) : null,
        subcategoria_filho_id: form.subcategoria_filho_id ? Number(form.subcategoria_filho_id) : null,
        conta_bancaria_id: form.conta_bancaria_id ? Number(form.conta_bancaria_id) : null,
        status: form.status,
        forma_pagamento: form.forma_pagamento || null,
      }
      if (tid) payload.tenant_id = tid
      if (editingConta) {
        await supabase.from("contas_pagar").update(payload).eq("id", editingConta.id)
      } else {
        await supabase.from("contas_pagar").insert(payload)
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(conta: ContaPagar) {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from("contas_pagar").delete().eq("id", conta.id)
      await mutate()
      setDeleteConfirm(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Contas a Pagar" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Pendente", value: formatCurrency(totalPendente), color: "hsl(38,92%,50%)", icon: Clock },
                { label: "Total Pago", value: formatCurrency(totalPago), color: "hsl(142,71%,40%)", icon: CheckCircle2 },
                { label: "Total Vencido", value: formatCurrency(totalVencido), color: "hsl(0,72%,51%)", icon: AlertTriangle },
                { label: "Contas Pendentes", value: String(qtdPendente), color: "hsl(216,60%,22%)", icon: TrendingDown },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xl font-bold" style={{ color }}>{value}</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              ))}
            </div>

            {/* Filters bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Busca */}
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descricao, fornecedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status */}
              <div className="flex items-center rounded-lg border border-border bg-card">
                {(["Todos", "Pendente", "Pago", "Vencido"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >{s}</button>
                ))}
              </div>

              {/* Categoria */}
              <div className="relative">
                <select
                  value={filterCategoriaId}
                  onChange={(e) => { setFilterCategoriaId(e.target.value); setFilterSubcategoriaId("") }}
                  className="h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Todas categorias</option>
                  {despesaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              {/* Subcategoria */}
              {filterCategoriaId && subcategoriasDaCategoria.length > 0 && (
                <div className="relative">
                  <select
                    value={filterSubcategoriaId}
                    onChange={(e) => setFilterSubcategoriaId(e.target.value)}
                    className="h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Todas subcategorias</option>
                    {subcategoriasDaCategoria.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              )}

              {/* Periodo */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-border bg-card">
                  {([
                    { key: "mes_atual", label: "Mes atual" },
                    { key: "7dias", label: "7 dias" },
                    { key: "personalizado", label: "Personalizado" },
                    { key: "todos", label: "Todos" },
                  ] as const).map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => setFilterPeriodo(key)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterPeriodo === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filterPeriodo === "personalizado" && (
                  <div className="flex items-center gap-1.5">
                    <Input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-10 w-36 text-sm" />
                    <span className="text-xs text-muted-foreground">ate</span>
                    <Input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-10 w-36 text-sm" />
                  </div>
                )}
              </div>

              {hasFilter && (
                <button type="button" onClick={clearFilters}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
                  <X className="h-3.5 w-3.5" /> Limpar
                </button>
              )}

              <button type="button" onClick={openNew}
                className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Nova Conta a Pagar
              </button>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">Erro ao carregar contas.</p>
                <button type="button" onClick={() => mutate()} className="mt-2 text-sm font-medium text-primary hover:underline">Recarregar</button>
              </div>
            )}

            {!isLoading && !error && (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descricao</th>
                        <th className="w-36 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fornecedor</th>
                        <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</th>
                        <th className="w-36 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta Bancaria</th>
                        <th className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vencimento</th>
                        <th className="w-24 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                        <th className="w-32 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</th>
                        <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                            {hasFilter ? "Nenhuma conta encontrada com os filtros atuais." : "Nenhuma conta a pagar cadastrada."}
                          </td>
                        </tr>
                      ) : paginatedFiltered.map((conta) => (
                        <tr key={conta.id} className="group border-b border-border last:border-b-0 transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${conta.status === "vencido" ? "bg-[hsl(0,72%,51%)]/10" : conta.status === "pago" ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(38,92%,50%)]/10"}`}>
                                <FileDown className={`h-4 w-4 ${conta.status === "vencido" ? "text-[hsl(0,72%,51%)]" : conta.status === "pago" ? "text-[hsl(142,71%,40%)]" : "text-[hsl(38,92%,50%)]"}`} />
                              </div>
                              <span className="font-medium text-card-foreground">{conta.descricao}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-muted-foreground">{conta.fornecedor_nome || conta.fornecedor || "-"}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-block max-w-[168px] truncate rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground" title={[conta.categoria_nome, conta.subcategoria_nome, conta.filho_nome].filter(Boolean).join(" > ") || "-"}>
                              {[conta.categoria_nome, conta.subcategoria_nome, conta.filho_nome].filter(Boolean).join(" > ") || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-muted-foreground">{conta.conta_bancaria_nome || "-"}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="whitespace-nowrap text-muted-foreground">{formatDateDisplay(conta.vencimento)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${conta.status === "pago" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" : conta.status === "vencido" ? "bg-[hsl(0,72%,51%)]/10 text-[hsl(0,72%,51%)]" : "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]"}`}>
                              {conta.status === "pago" ? "Pago" : conta.status === "vencido" ? "Vencido" : "Pendente"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="whitespace-nowrap font-semibold text-[hsl(0,72%,51%)]">- {formatCurrency(conta.valor)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button type="button" onClick={() => openEdit(conta)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => setDeleteConfirm(conta)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {filtered.length > 0 && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}-{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registros
                    </p>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) { pageNum = i + 1 }
                        else if (page <= 3) { pageNum = i + 1 }
                        else if (page >= totalPages - 2) { pageNum = totalPages - 4 + i }
                        else { pageNum = page - 2 + i }
                        return (
                          <button key={pageNum} type="button" onClick={() => setPage(pageNum)}
                            className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${page === pageNum ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}>
                            {pageNum}
                          </button>
                        )
                      })}
                      <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle>
            <DialogDescription>{editingConta ? "Atualize os dados da conta." : "Preencha os dados para registrar uma nova conta a pagar."}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-4 py-2 pr-1">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Input id="descricao" placeholder="Ex: Aluguel, Energia..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <Input id="valor" type="text" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: handleCurrencyInput(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vencimento">Vencimento</Label>
                <Input id="vencimento" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={selectClass}>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <select id="fornecedor" value={form.fornecedor_id} onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })} className={selectClass}>
                <option value="">Selecione...</option>
                {fornecedoresLista.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <select id="categoria" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value, subcategoria_id: "", subcategoria_filho_id: "" })} className={selectClass}>
                <option value="">Selecione...</option>
                {despesaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            {subcategoriasForm.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoria">Subcategoria</Label>
                <select id="subcategoria" value={form.subcategoria_id} onChange={(e) => setForm({ ...form, subcategoria_id: e.target.value, subcategoria_filho_id: "" })} className={selectClass}>
                  <option value="">Selecione...</option>
                  {subcategoriasForm.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            )}
            {filhosForm.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="filho">Subcategoria Filho</Label>
                <select id="filho" value={form.subcategoria_filho_id} onChange={(e) => setForm({ ...form, subcategoria_filho_id: e.target.value })} className={selectClass}>
                  <option value="">Selecione...</option>
                  {filhosForm.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="conta_bancaria">Conta Bancaria</Label>
              <select id="conta_bancaria" value={form.conta_bancaria_id} onChange={(e) => setForm({ ...form, conta_bancaria_id: e.target.value })} className={selectClass}>
                <option value="">Selecione...</option>
                {contasBancarias.map((cb) => <option key={cb.id} value={cb.id}>{cb.nome} ({cb.tipo})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
              <select id="forma_pagamento" value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} className={selectClass}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingConta ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a pagar</AlertDialogTitle>
            <AlertDialogDescription>
              {"Tem certeza que deseja excluir "}{deleteConfirm?.descricao}{"? Esta acao nao pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
