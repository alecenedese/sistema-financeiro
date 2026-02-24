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
import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
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
import { handleCurrencyInput, parseBRL, formatBRL } from "@/lib/currency-input"
import useSWR from "swr"

interface DespesaFixa {
  id: number
  descricao: string
  valor: number
  dia_vencimento: number
  ativa: boolean
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

const FORMAS_PAGAMENTO = ["PIX", "Boleto", "Cartao de Credito", "Cartao de Debito", "Transferencia", "Dinheiro", "Cheque"]

async function fetchDespesas(): Promise<DespesaFixa[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("despesas_fixas")
    .select(`*, categorias(nome), fornecedores(nome), contas_bancarias(nome, tipo)`)
    .order("dia_vencimento", { ascending: true })
  if (error) throw error
  return (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    descricao: r.descricao as string,
    valor: Number(r.valor),
    dia_vencimento: r.dia_vencimento as number,
    ativa: r.ativa as boolean,
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
  const [catRes, subRes, filhoRes] = await Promise.all([
    supabase.from("categorias").select("id, nome, tipo").order("nome"),
    supabase.from("subcategorias").select("id, nome, categoria_id").order("nome"),
    supabase.from("subcategorias_filhos").select("id, nome, subcategoria_id").order("nome"),
  ])
  return { categorias: (catRes.data || []) as CategoriaRow[], subcategorias: (subRes.data || []) as SubcategoriaRow[], filhos: (filhoRes.data || []) as SubcategoriaFilhoRow[] }
}

async function fetchFornecedores(): Promise<FornecedorRow[]> {
  const supabase = createClient()
  const { data } = await supabase.from("fornecedores").select("id, nome").order("nome")
  return data || []
}

async function fetchContasBancarias(): Promise<ContaBancariaRow[]> {
  const supabase = createClient()
  const { data } = await supabase.from("contas_bancarias").select("id, nome, tipo").order("nome")
  return data || []
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

const emptyForm = {
  descricao: "",
  valor: "",
  dia_vencimento: "1",
  ativa: true,
  categoria_id: "",
  subcategoria_id: "",
  subcategoria_filho_id: "",
  fornecedor_id: "",
  conta_bancaria_id: "",
  forma_pagamento: "",
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export default function DespesasFixasPageWrapper() {
  return <Suspense><DespesasFixasPage /></Suspense>
}

function DespesasFixasPage() {
  const { data: despesas = [], mutate, isLoading } = useSWR("despesas_fixas", fetchDespesas)
  const { data: hierarchy } = useSWR("hierarchy_despesas_fixas", fetchHierarchy)
  const { data: fornecedoresLista = [] } = useSWR("fornecedores_df", fetchFornecedores)
  const { data: contasBancarias = [] } = useSWR("contas_bancarias_df", fetchContasBancarias)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DespesaFixa | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DespesaFixa | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      openNew()
      router.replace("/despesas-fixas")
    }
  }, [searchParams, router])

  const despesaCategorias = useMemo(
    () => (hierarchy?.categorias || []).filter((c) => c.tipo === "Despesa"),
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

  const filtered = despesas.filter((d) =>
    d.descricao.toLowerCase().includes(search.toLowerCase()) ||
    d.fornecedor_nome.toLowerCase().includes(search.toLowerCase())
  )

  const totalMensal = despesas.filter((d) => d.ativa).reduce((a, d) => a + d.valor, 0)
  const totalAtivas = despesas.filter((d) => d.ativa).length
  const totalInativas = despesas.filter((d) => !d.ativa).length

  function openNew() {
    setEditingItem(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(item: DespesaFixa) {
    setEditingItem(item)
    setForm({
      descricao: item.descricao,
      valor: formatBRL(item.valor),
      dia_vencimento: item.dia_vencimento.toString(),
      ativa: item.ativa,
      categoria_id: item.categoria_id?.toString() || "",
      subcategoria_id: item.subcategoria_id?.toString() || "",
      subcategoria_filho_id: item.subcategoria_filho_id?.toString() || "",
      fornecedor_id: item.fornecedor_id?.toString() || "",
      conta_bancaria_id: item.conta_bancaria_id?.toString() || "",
      forma_pagamento: item.forma_pagamento || "",
    })
    setDialogOpen(true)
  }

  const handleSave = useCallback(async () => {
    if (!form.descricao.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        descricao: form.descricao,
        valor: parseBRL(form.valor),
        dia_vencimento: Number(form.dia_vencimento) || 1,
        ativa: form.ativa,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        subcategoria_id: form.subcategoria_id ? Number(form.subcategoria_id) : null,
        subcategoria_filho_id: form.subcategoria_filho_id ? Number(form.subcategoria_filho_id) : null,
        fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null,
        conta_bancaria_id: form.conta_bancaria_id ? Number(form.conta_bancaria_id) : null,
        forma_pagamento: form.forma_pagamento || null,
      }
      if (editingItem) {
        await supabase.from("despesas_fixas").update(payload).eq("id", editingItem.id)
      } else {
        await supabase.from("despesas_fixas").insert(payload)
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }, [form, editingItem, mutate])

  const handleDelete = useCallback(async (item: DespesaFixa) => {
    const supabase = createClient()
    await supabase.from("despesas_fixas").delete().eq("id", item.id)
    await mutate()
    setDeleteConfirm(null)
  }, [mutate])

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
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Mensal</p>
                  <p className="mt-1 text-xl font-bold text-[hsl(0,72%,51%)]">{formatCurrency(totalMensal)}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(0,72%,51%)]">
                  <RepeatIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Despesas Ativas</p>
                  <p className="mt-1 text-xl font-bold text-[hsl(142,71%,40%)]">{totalAtivas}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Despesas Inativas</p>
                  <p className="mt-1 text-xl font-bold text-muted-foreground">{totalInativas}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,20%,60%)]">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Despesas</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{despesas.length}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                  <CalendarDays className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Search + Add */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar despesa fixa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Nova Despesa Fixa
              </button>
            </div>

            {/* Info */}
            <div className="rounded-lg border border-[hsl(38,92%,50%)]/30 bg-[hsl(38,92%,50%)]/5 px-4 py-3">
              <p className="text-sm text-[hsl(38,92%,40%)]">
                <strong>Como funciona:</strong> As despesas fixas sao automaticamente associadas ao importar extratos bancarios. O sistema identifica a descricao e preenche os dados automaticamente.
              </p>
            </div>

            {/* List */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Status</span>
                <span>Descricao</span>
                <span>Valor</span>
                <span>Dia Venc.</span>
                <span>Categoria</span>
                <span>Fornecedor</span>
                <span>Forma Pag.</span>
                <span className="text-right">Acoes</span>
              </div>
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {search ? "Nenhuma despesa fixa encontrada." : "Nenhuma despesa fixa cadastrada."}
                </div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                    <button
                      type="button"
                      onClick={() => toggleAtiva(item)}
                      title={item.ativa ? "Clique para desativar" : "Clique para ativar"}
                      className="flex items-center"
                    >
                      {item.ativa ? (
                        <CheckCircle2 className="h-5 w-5 text-[hsl(142,71%,40%)]" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.ativa ? "bg-[hsl(0,72%,51%)]/10" : "bg-muted"}`}>
                        <RepeatIcon className={`h-4 w-4 ${item.ativa ? "text-[hsl(0,72%,51%)]" : "text-muted-foreground"}`} />
                      </div>
                      <span className={`font-medium ${item.ativa ? "text-card-foreground" : "text-muted-foreground line-through"}`}>{item.descricao}</span>
                    </div>
                    <span className="text-sm font-semibold text-[hsl(0,72%,51%)]">{formatCurrency(item.valor)}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Dia {item.dia_vencimento}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{item.categoria_nome || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.fornecedor_nome || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.forma_pagamento || "-"}</span>
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openEdit(item)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(item)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100">
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Despesa Fixa" : "Nova Despesa Fixa"}</DialogTitle>
            <DialogDescription>{editingItem ? "Atualize os dados da despesa fixa." : "Cadastre uma nova despesa recorrente mensal."}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Input id="descricao" placeholder="Ex: Aluguel, Internet, Academia..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor Mensal</Label>
                <Input id="valor" type="text" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: handleCurrencyInput(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dia_vencimento">Dia de Vencimento</Label>
                <Input id="dia_vencimento" type="number" min={1} max={31} placeholder="Ex: 5" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <select id="fornecedor" value={form.fornecedor_id} onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })} className={selectClass}>
                <option value="">Selecione...</option>
                {fornecedoresLista.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conta_bancaria">Conta Bancaria</Label>
              <select id="conta_bancaria" value={form.conta_bancaria_id} onChange={(e) => setForm({ ...form, conta_bancaria_id: e.target.value })} className={selectClass}>
                <option value="">Selecione...</option>
                {contasBancarias.map((cb) => <option key={cb.id} value={cb.id}>{cb.nome} ({cb.tipo})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <select id="categoria" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value, subcategoria_id: "", subcategoria_filho_id: "" })} className={selectClass}>
                <option value="">Selecione...</option>
                {despesaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            {subcategoriasDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoria">Subcategoria</Label>
                <select id="subcategoria" value={form.subcategoria_id} onChange={(e) => setForm({ ...form, subcategoria_id: e.target.value, subcategoria_filho_id: "" })} className={selectClass}>
                  <option value="">Selecione...</option>
                  {subcategoriasDisponiveis.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            )}
            {filhosDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoriaFilho">Subcategoria Filho</Label>
                <select id="subcategoriaFilho" value={form.subcategoria_filho_id} onChange={(e) => setForm({ ...form, subcategoria_filho_id: e.target.value })} className={selectClass}>
                  <option value="">Selecione...</option>
                  {filhosDisponiveis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
              <select id="forma_pagamento" value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} className={selectClass}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <input
                type="checkbox"
                id="ativa"
                checked={form.ativa}
                onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="ativa" className="cursor-pointer">
                Despesa ativa (sera lancada todo mes)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingItem ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa fixa</AlertDialogTitle>
            <AlertDialogDescription>
              {"Tem certeza que deseja excluir "}{deleteConfirm?.descricao}{"? Esta acao nao pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
