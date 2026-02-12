"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { FileDown, Plus, TrendingDown, Clock, CheckCircle2, AlertTriangle, Pencil, Trash2, Loader2 } from "lucide-react"
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

interface CategoriaRow { id: number; nome: string; tipo: string }
interface SubcategoriaRow { id: number; nome: string; categoria_id: number }
interface SubcategoriaFilhoRow { id: number; nome: string; subcategoria_id: number }

interface ContaPagar {
  id: number
  descricao: string
  valor: number
  vencimento: string
  status: string
  fornecedor: string
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  // joined names
  categoria_nome: string
  subcategoria_nome: string
  filho_nome: string
}

const supabase = createClient()

async function fetchContas(): Promise<ContaPagar[]> {
  const { data, error } = await supabase
    .from("contas_pagar")
    .select(`
      *,
      categorias(nome),
      subcategorias(nome),
      subcategorias_filhos(nome)
    `)
    .order("vencimento", { ascending: true })

  if (error) throw error

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    descricao: row.descricao as string,
    valor: Number(row.valor),
    vencimento: row.vencimento as string,
    status: row.status as string,
    fornecedor: row.fornecedor as string,
    categoria_id: row.categoria_id as number | null,
    subcategoria_id: row.subcategoria_id as number | null,
    subcategoria_filho_id: row.subcategoria_filho_id as number | null,
    categoria_nome: (row.categorias as Record<string, string> | null)?.nome || "",
    subcategoria_nome: (row.subcategorias as Record<string, string> | null)?.nome || "",
    filho_nome: (row.subcategorias_filhos as Record<string, string> | null)?.nome || "",
  }))
}

interface CategoriaHierarchy {
  categorias: CategoriaRow[]
  subcategorias: SubcategoriaRow[]
  filhos: SubcategoriaFilhoRow[]
}

async function fetchHierarchy(): Promise<CategoriaHierarchy> {
  const [catRes, subRes, filhoRes] = await Promise.all([
    supabase.from("categorias").select("id, nome, tipo").order("nome"),
    supabase.from("subcategorias").select("id, nome, categoria_id").order("nome"),
    supabase.from("subcategorias_filhos").select("id, nome, subcategoria_id").order("nome"),
  ])
  return {
    categorias: catRes.data || [],
    subcategorias: subRes.data || [],
    filhos: filhoRes.data || [],
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

const emptyForm = { descricao: "", valor: "", vencimento: "", fornecedor: "", categoria_id: "", subcategoria_id: "", subcategoria_filho_id: "", status: "pendente" }

export default function ContasAPagarPage() {
  const { data: contas, error, isLoading, mutate } = useSWR("contas_pagar", fetchContas)
  const { data: hierarchy } = useSWR("hierarchy_pagar", fetchHierarchy)

  const [filterStatus, setFilterStatus] = useState<"Todos" | "Pendente" | "Pago" | "Vencido">("Todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ContaPagar | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingConta(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/contas-a-pagar")
    }
  }, [searchParams, router])

  const allContas = contas || []
  const filtered = filterStatus === "Todos"
    ? allContas
    : allContas.filter((c) => c.status === filterStatus.toLowerCase())

  const totalPendente = allContas.filter((c) => c.status === "pendente").reduce((a, c) => a + c.valor, 0)
  const totalPago = allContas.filter((c) => c.status === "pago").reduce((a, c) => a + c.valor, 0)
  const totalVencido = allContas.filter((c) => c.status === "vencido").reduce((a, c) => a + c.valor, 0)
  const qtdPendente = allContas.filter((c) => c.status === "pendente").length

  // Cascading selects from hierarchy
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

  function openNew() {
    setEditingConta(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(conta: ContaPagar) {
    setEditingConta(conta)
    setForm({
      descricao: conta.descricao,
      valor: conta.valor.toString(),
      vencimento: conta.vencimento,
      fornecedor: conta.fornecedor,
      categoria_id: conta.categoria_id?.toString() || "",
      subcategoria_id: conta.subcategoria_id?.toString() || "",
      subcategoria_filho_id: conta.subcategoria_filho_id?.toString() || "",
      status: conta.status,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.descricao.trim()) return
    setSaving(true)
    try {
      const payload = {
        descricao: form.descricao,
        valor: parseFloat(form.valor) || 0,
        vencimento: form.vencimento || "2026-02-28",
        fornecedor: form.fornecedor,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        subcategoria_id: form.subcategoria_id ? Number(form.subcategoria_id) : null,
        subcategoria_filho_id: form.subcategoria_filho_id ? Number(form.subcategoria_filho_id) : null,
        status: form.status,
      }
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
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Pendente</p>
                  <p className="mt-1 text-xl font-bold text-[hsl(38,92%,50%)]">{formatCurrency(totalPendente)}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(38,92%,50%)]">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Pago</p>
                  <p className="mt-1 text-xl font-bold text-[hsl(142,71%,40%)]">{formatCurrency(totalPago)}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Vencido</p>
                  <p className="mt-1 text-xl font-bold text-[hsl(0,72%,51%)]">{formatCurrency(totalVencido)}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(0,72%,51%)]">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Contas Pendentes</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{qtdPendente}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center rounded-lg border border-border bg-card">
                {(["Todos", "Pendente", "Pago", "Vencido"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >{s}</button>
                ))}
              </div>
              <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Nova Conta a Pagar
              </button>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando contas...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">Erro ao carregar contas. Tente novamente.</p>
                <button type="button" onClick={() => mutate()} className="mt-2 text-sm font-medium text-primary hover:underline">Recarregar</button>
              </div>
            )}

            {/* Table */}
            {!isLoading && !error && (
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                  <span>Descricao</span>
                  <span>Fornecedor</span>
                  <span>Categoria</span>
                  <span>Vencimento</span>
                  <span>Status</span>
                  <span className="text-right">Valor</span>
                  <span className="text-right">Acoes</span>
                </div>
                {filtered.map((conta) => (
                  <div key={conta.id} className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        conta.status === "vencido" ? "bg-[hsl(0,72%,51%)]/10" : conta.status === "pago" ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(38,92%,50%)]/10"
                      }`}>
                        <FileDown className={`h-5 w-5 ${
                          conta.status === "vencido" ? "text-[hsl(0,72%,51%)]" : conta.status === "pago" ? "text-[hsl(142,71%,40%)]" : "text-[hsl(38,92%,50%)]"
                        }`} />
                      </div>
                      <span className="text-sm font-medium text-card-foreground">{conta.descricao}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{conta.fornecedor}</span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {[conta.categoria_nome, conta.subcategoria_nome, conta.filho_nome].filter(Boolean).join(" > ")}
                    </span>
                    <span className="text-sm text-muted-foreground">{formatDateDisplay(conta.vencimento)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      conta.status === "pago"
                        ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]"
                        : conta.status === "vencido"
                          ? "bg-[hsl(0,72%,51%)]/10 text-[hsl(0,72%,51%)]"
                          : "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]"
                    }`}>
                      {conta.status === "pago" ? "Pago" : conta.status === "vencido" ? "Vencido" : "Pendente"}
                    </span>
                    <span className="text-right text-sm font-semibold text-[hsl(0,72%,51%)]">- {formatCurrency(conta.valor)}</span>
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" onClick={() => openEdit(conta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(conta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialog - Novo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle>
            <DialogDescription>{editingConta ? "Atualize os dados da conta." : "Preencha os dados para registrar uma nova conta a pagar."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Input id="descricao" placeholder="Ex: Aluguel, Energia..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <Input id="valor" type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vencimento">Vencimento</Label>
                <Input id="vencimento" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input id="fornecedor" placeholder="Nome do fornecedor" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <select id="categoria" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value, subcategoria_id: "", subcategoria_filho_id: "" })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">Selecione...</option>
                {despesaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            {subcategoriasDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoria">Subcategoria</Label>
                <select id="subcategoria" value={form.subcategoria_id} onChange={(e) => setForm({ ...form, subcategoria_id: e.target.value, subcategoria_filho_id: "" })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">Selecione...</option>
                  {subcategoriasDisponiveis.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            )}
            {filhosDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoriaFilho">Subcategoria Filho</Label>
                <select id="subcategoriaFilho" value={form.subcategoria_filho_id} onChange={(e) => setForm({ ...form, subcategoria_filho_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">Selecione...</option>
                  {filhosDisponiveis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              Cancelar
            </button>
            <button type="button" disabled={saving} onClick={handleSave} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingConta ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a pagar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteConfirm?.descricao}&quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
