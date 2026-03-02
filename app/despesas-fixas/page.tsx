"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  RepeatIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarDays,
} from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { getActiveTenantId, useTenant } from "@/hooks/use-tenant"
import { handleCurrencyInput, parseBRL, formatBRL } from "@/lib/currency-input"
import useSWR from "swr"

interface DespesaFixa {
  id: number
  descricao: string
  valor: number
  dia_vencimento: number
  ativa: boolean
  tipo_recorrencia: "mensal" | "parcelado"
  total_parcelas: number
  parcela_atual: number
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  fornecedor_id: number | null
  conta_bancaria_id: number | null
  forma_pagamento: string
  categoria_nome: string
  fornecedor_nome: string
  conta_bancaria_nome: string
}

interface CategoriaRow { id: number; nome: string; tipo: string }
interface SubcategoriaRow { id: number; nome: string; categoria_id: number }
interface SubcategoriaFilhoRow { id: number; nome: string; subcategoria_id: number }
interface FornecedorRow { id: number; nome: string }
interface ContaBancariaRow { id: number; nome: string; tipo: string }

const FORMAS_PAGAMENTO = ["PIX", "Boleto", "Cartao de Credito", "Cartao de Debito", "Debito em Conta", "Transferencia", "Dinheiro", "Cheque"]

async function fetchDespesas(): Promise<DespesaFixa[]> {
  const supabase = createClient()
  const tid = getActiveTenantId()
  let q = supabase
    .from("despesas_fixas")
    .select("*, categorias(nome), fornecedores(nome), contas_bancarias(nome, tipo)")
    .order("dia_vencimento", { ascending: true })
  if (tid) q = q.eq("tenant_id", tid)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    descricao: r.descricao as string,
    valor: Number(r.valor),
    dia_vencimento: r.dia_vencimento as number,
    ativa: r.ativa as boolean,
    tipo_recorrencia: (r.tipo_recorrencia as "mensal" | "parcelado") || "mensal",
    total_parcelas: Number(r.total_parcelas) || 0,
    parcela_atual: Number(r.parcela_atual) || 1,
    categoria_id: r.categoria_id as number | null,
    subcategoria_id: r.subcategoria_id as number | null,
    subcategoria_filho_id: r.subcategoria_filho_id as number | null,
    fornecedor_id: r.fornecedor_id as number | null,
    conta_bancaria_id: r.conta_bancaria_id as number | null,
    forma_pagamento: (r.forma_pagamento as string) || "",
    categoria_nome: (r.categorias as Record<string, string> | null)?.nome || "",
    fornecedor_nome: (r.fornecedores as Record<string, string> | null)?.nome || "",
    conta_bancaria_nome: (r.contas_bancarias as Record<string, string> | null)?.nome || "",
  }))
}

async function fetchHierarchy() {
  const supabase = createClient()
  const tid = getActiveTenantId()
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

async function fetchFornecedores(): Promise<FornecedorRow[]> {
  const supabase = createClient()
  const tid = getActiveTenantId()
  let q = supabase.from("fornecedores").select("id, nome").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

async function fetchContasBancarias(): Promise<ContaBancariaRow[]> {
  const supabase = createClient()
  const tid = getActiveTenantId()
  let q = supabase.from("contas_bancarias").select("id, nome, tipo").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function makeEmptyForm() {
  return {
    descricao: "",
    valor: "",
    dia_vencimento: "1",
    ativa: true,
    tipo_recorrencia: "mensal" as "mensal" | "parcelado",
    total_parcelas: "0",
    parcela_atual: "1",
    categoria_id: "",
    subcategoria_id: "",
    subcategoria_filho_id: "",
    fornecedor_id: "",
    conta_bancaria_id: "",
    forma_pagamento: "",
  }
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export default function DespesasFixasPage() {
  const { tenant } = useTenant()
  const swrKey = ["despesas_fixas", tenant?.id ?? null]
  const hierarchyKey = ["hierarchy_despesas_fixas", tenant?.id ?? null]
  const fornKey = ["fornecedores_df", tenant?.id ?? null]
  const contasKey = ["contas_bancarias_df", tenant?.id ?? null]

  const { data: despesas = [], mutate, isLoading } = useSWR(swrKey, fetchDespesas, { revalidateOnFocus: false })
  const { data: hierarchy } = useSWR(hierarchyKey, fetchHierarchy, { revalidateOnFocus: false })
  const { data: fornecedoresLista = [] } = useSWR(fornKey, fetchFornecedores, { revalidateOnFocus: false })
  const { data: contasBancarias = [] } = useSWR(contasKey, fetchContasBancarias, { revalidateOnFocus: false })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DespesaFixa | null>(null)
  const [form, setForm] = useState(makeEmptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [search, setSearch] = useState("")

  // Abre via ?novo=1 usando history API (sem router.replace que causa re-render)
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("novo") === "1") {
      window.history.replaceState(null, "", "/despesas-fixas")
      setEditingId(null)
      setForm(makeEmptyForm())
      setSaveError("")
      setDialogOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const despesaCategorias = useMemo(
    () => (hierarchy?.categorias || []).filter((c) => c.tipo === "Despesa" || c.tipo === "despesa"),
    [hierarchy]
  )
  const subcategoriasDisponiveis = useMemo(
    () => (hierarchy?.subcategorias || []).filter((s) => s.categoria_id === Number(form.categoria_id)),
    [hierarchy, form.categoria_id]
  )
  const filhosDisponiveis = useMemo(
    () => (hierarchy?.filhos || []).filter((f) => f.subcategoria_id === Number(form.subcategoria_id)),
    [hierarchy, form.subcategoria_id]
  )

  const filtered = useMemo(
    () => despesas.filter((d) =>
      d.descricao.toLowerCase().includes(search.toLowerCase()) ||
      d.fornecedor_nome.toLowerCase().includes(search.toLowerCase())
    ),
    [despesas, search]
  )

  const totalMensal = useMemo(() => despesas.filter((d) => d.ativa).reduce((a, d) => a + d.valor, 0), [despesas])
  const totalAtivas = despesas.filter((d) => d.ativa).length
  const totalInativas = despesas.filter((d) => !d.ativa).length

  function openNew() {
    setEditingId(null)
    setForm(makeEmptyForm())
    setSaveError("")
    setDialogOpen(true)
  }

  function openEdit(item: DespesaFixa) {
    setEditingId(item.id)
    setForm({
      descricao: item.descricao,
      valor: formatBRL(item.valor),
      dia_vencimento: item.dia_vencimento.toString(),
      ativa: item.ativa,
      tipo_recorrencia: item.tipo_recorrencia || "mensal",
      total_parcelas: item.total_parcelas.toString(),
      parcela_atual: item.parcela_atual.toString(),
      categoria_id: item.categoria_id?.toString() || "",
      subcategoria_id: item.subcategoria_id?.toString() || "",
      subcategoria_filho_id: item.subcategoria_filho_id?.toString() || "",
      fornecedor_id: item.fornecedor_id?.toString() || "",
      conta_bancaria_id: item.conta_bancaria_id?.toString() || "",
      forma_pagamento: item.forma_pagamento || "",
    })
    setSaveError("")
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.descricao.trim()) {
      setSaveError("Descricao e obrigatoria.")
      return
    }
    setSaveError("")
    setSaving(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      const isParcelado = form.tipo_recorrencia === "parcelado"
      const payload: Record<string, unknown> = {
        descricao: form.descricao.trim(),
        keyword: form.descricao.trim().toLowerCase(),
        valor: parseBRL(form.valor),
        dia_vencimento: Number(form.dia_vencimento) || 1,
        ativa: form.ativa,
        tipo_recorrencia: form.tipo_recorrencia,
        total_parcelas: isParcelado ? Number(form.total_parcelas) || 0 : 0,
        parcela_atual: isParcelado ? Number(form.parcela_atual) || 1 : 1,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        subcategoria_id: form.subcategoria_id ? Number(form.subcategoria_id) : null,
        subcategoria_filho_id: form.subcategoria_filho_id ? Number(form.subcategoria_filho_id) : null,
        fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null,
        conta_bancaria_id: form.conta_bancaria_id ? Number(form.conta_bancaria_id) : null,
        forma_pagamento: form.forma_pagamento || null,
      }
      if (tid) payload.tenant_id = tid

      let err
      if (editingId !== null) {
        const res = await supabase.from("despesas_fixas").update(payload).eq("id", editingId)
        err = res.error
      } else {
        const res = await supabase.from("despesas_fixas").insert(payload)
        err = res.error
      }

      if (err) {
        setSaveError(err.message)
        return
      }

      setDialogOpen(false)
      await mutate()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: DespesaFixa) {
    const supabase = createClient()
    await supabase.from("despesas_fixas").delete().eq("id", item.id)
    setDeleteConfirm(null)
    await mutate()
  }

  async function toggleAtiva(item: DespesaFixa) {
    const supabase = createClient()
    await supabase.from("despesas_fixas").update({ ativa: !item.ativa }).eq("id", item.id)
    await mutate()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="ml-[72px] flex flex-1 flex-col">
          <PageHeader title="Despesas Fixas" />
          <main className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Despesas Fixas" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(0,72%,51%)]/10">
                  <RepeatIcon className="h-5 w-5 text-[hsl(0,72%,51%)]" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Total Mensal</p>
                  <p className="text-xl font-bold text-card-foreground">{formatCurrency(totalMensal)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(142,71%,40%)]/10">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(142,71%,40%)]" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Ativas</p>
                  <p className="text-xl font-bold text-card-foreground">{totalAtivas}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Inativas</p>
                  <p className="text-xl font-bold text-card-foreground">{totalInativas}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(38,92%,50%)]/10">
                  <AlertTriangle className="h-5 w-5 text-[hsl(38,92%,50%)]" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Cadastradas</p>
                  <p className="text-xl font-bold text-card-foreground">{despesas.length}</p>
                </div>
              </div>
            </div>

            {/* Header + search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descricao ou fornecedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <button
                type="button"
                onClick={openNew}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Nova Despesa Fixa
              </button>
            </div>

            {/* Lista */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  {search ? "Nenhuma despesa encontrada." : "Nenhuma despesa fixa cadastrada."}
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/40"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAtiva(item)}
                      title={item.ativa ? "Clique para desativar" : "Clique para ativar"}
                      className="shrink-0"
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.ativa ? "bg-[hsl(0,72%,51%)]/10" : "bg-muted"}`}>
                        <RepeatIcon className={`h-4 w-4 ${item.ativa ? "text-[hsl(0,72%,51%)]" : "text-muted-foreground"}`} />
                      </div>
                    </button>
                    <span className={`font-medium ${item.ativa ? "text-card-foreground" : "text-muted-foreground line-through"}`}>
                      {item.descricao}
                    </span>
                    <span className="text-sm font-semibold text-[hsl(0,72%,51%)]">{formatCurrency(item.valor)}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Dia {item.dia_vencimento}
                    </span>
                    {item.tipo_recorrencia === "parcelado" && item.total_parcelas > 0 ? (
                      <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        <CalendarDays className="h-3 w-3" />
                        {item.parcela_atual}/{item.total_parcelas}x
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <RepeatIcon className="h-3 w-3" />
                        Mensal
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {item.categoria_nome || "-"}
                    </span>
                    <span className="text-sm text-muted-foreground">{item.fornecedor_nome || "-"}</span>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(item)}
                        className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Dialog de criação / edição */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open) }}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => { if (saving) e.preventDefault() }}>
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Editar Despesa Fixa" : "Nova Despesa Fixa"}</DialogTitle>
            <DialogDescription>
              {editingId !== null ? "Atualize os dados da despesa fixa." : "Cadastre uma nova despesa recorrente mensal."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto space-y-4 pr-1 py-2">
            {saveError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Aluguel, Internet, Academia..."
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <Input
                  id="valor"
                  type="text"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: handleCurrencyInput(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dia_vencimento">Dia de Vencimento</Label>
                <Input
                  id="dia_vencimento"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex: 5"
                  value={form.dia_vencimento}
                  onChange={(e) => setForm((f) => ({ ...f, dia_vencimento: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Recorrencia</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo_recorrencia: "mensal", total_parcelas: "0", parcela_atual: "1" }))}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors ${form.tipo_recorrencia === "mensal" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted"}`}
                >
                  <RepeatIcon className="h-5 w-5" />
                  <span>Mensal Indefinido</span>
                  <span className="text-xs font-normal opacity-70">Repete todo mes sem fim</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo_recorrencia: "parcelado" }))}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors ${form.tipo_recorrencia === "parcelado" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted"}`}
                >
                  <CalendarDays className="h-5 w-5" />
                  <span>Parcelado</span>
                  <span className="text-xs font-normal opacity-70">Numero fixo de vezes</span>
                </button>
              </div>
            </div>

            {form.tipo_recorrencia === "parcelado" && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-2">
                  <Label htmlFor="total_parcelas">Total de Parcelas</Label>
                  <Input
                    id="total_parcelas"
                    type="number"
                    min={1}
                    max={360}
                    placeholder="Ex: 12"
                    value={form.total_parcelas}
                    onChange={(e) => setForm((f) => ({ ...f, total_parcelas: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parcela_atual">Parcela Atual</Label>
                  <Input
                    id="parcela_atual"
                    type="number"
                    min={1}
                    placeholder="Ex: 1"
                    value={form.parcela_atual}
                    onChange={(e) => setForm((f) => ({ ...f, parcela_atual: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <select
                id="fornecedor"
                value={form.fornecedor_id}
                onChange={(e) => setForm((f) => ({ ...f, fornecedor_id: e.target.value }))}
                className={selectClass}
              >
                <option value="">Selecione...</option>
                {fornecedoresLista.map((fn) => <option key={fn.id} value={fn.id}>{fn.nome}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conta_bancaria">Conta Bancaria</Label>
              <select
                id="conta_bancaria"
                value={form.conta_bancaria_id}
                onChange={(e) => setForm((f) => ({ ...f, conta_bancaria_id: e.target.value }))}
                className={selectClass}
              >
                <option value="">Selecione...</option>
                {contasBancarias.map((cb) => <option key={cb.id} value={cb.id}>{cb.nome} ({cb.tipo})</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <select
                id="categoria"
                value={form.categoria_id}
                onChange={(e) => setForm((f) => ({ ...f, categoria_id: e.target.value, subcategoria_id: "", subcategoria_filho_id: "" }))}
                className={selectClass}
              >
                <option value="">Selecione...</option>
                {despesaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            {subcategoriasDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoria">Subcategoria</Label>
                <select
                  id="subcategoria"
                  value={form.subcategoria_id}
                  onChange={(e) => setForm((f) => ({ ...f, subcategoria_id: e.target.value, subcategoria_filho_id: "" }))}
                  className={selectClass}
                >
                  <option value="">Selecione...</option>
                  {subcategoriasDisponiveis.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            )}

            {filhosDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoriaFilho">Subcategoria Filho</Label>
                <select
                  id="subcategoriaFilho"
                  value={form.subcategoria_filho_id}
                  onChange={(e) => setForm((f) => ({ ...f, subcategoria_filho_id: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Selecione...</option>
                  {filhosDisponiveis.map((fi) => <option key={fi.id} value={fi.id}>{fi.nome}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
              <select
                id="forma_pagamento"
                value={form.forma_pagamento}
                onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value }))}
                className={selectClass}
              >
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <input
                type="checkbox"
                id="ativa"
                checked={form.ativa}
                onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="ativa" className="cursor-pointer">
                Despesa ativa (sera lancada todo mes)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId !== null ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmacao de exclusao */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa Fixa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteConfirm?.descricao}</strong>? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
