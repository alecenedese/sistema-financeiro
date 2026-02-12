"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { FileUp, Plus, TrendingUp, Clock, CheckCircle2, AlertTriangle, Pencil, Trash2 } from "lucide-react"
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

interface ContaReceber {
  id: number
  descricao: string
  valor: number
  vencimento: string
  status: "pendente" | "recebido" | "vencido"
  cliente: string
  categoria: string
}

const contasIniciais: ContaReceber[] = [
  { id: 1, descricao: "Servico de Consultoria", valor: 15000.0, vencimento: "2026-02-12", status: "pendente", cliente: "Empresa Alpha", categoria: "Servicos" },
  { id: 2, descricao: "Projeto de BPO", valor: 8500.0, vencimento: "2026-02-18", status: "pendente", cliente: "Grupo Beta", categoria: "Projetos" },
  { id: 3, descricao: "Terceirizacao Financeira", valor: 6200.0, vencimento: "2026-02-05", status: "recebido", cliente: "Corp Gamma", categoria: "Servicos" },
  { id: 4, descricao: "Auditoria Mensal", valor: 4800.0, vencimento: "2026-02-01", status: "recebido", cliente: "Delta LTDA", categoria: "Servicos" },
  { id: 5, descricao: "Gestao de Folha", valor: 9300.0, vencimento: "2026-02-22", status: "pendente", cliente: "Omega SA", categoria: "Projetos" },
  { id: 6, descricao: "Assessoria Fiscal", valor: 3200.0, vencimento: "2026-01-28", status: "vencido", cliente: "Sigma Corp", categoria: "Servicos" },
  { id: 7, descricao: "Treinamento Equipe", valor: 2800.0, vencimento: "2026-02-25", status: "pendente", cliente: "Phi Industries", categoria: "Treinamento" },
]

const CATEGORIAS_RECEBER = ["Servicos", "Projetos", "Treinamento", "Consultoria", "Produtos"]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

const emptyForm = { descricao: "", valor: "", vencimento: "", cliente: "", categoria: "Servicos", status: "pendente" as const }

export default function ContasAReceberPage() {
  const [filterStatus, setFilterStatus] = useState<"Todos" | "Pendente" | "Recebido" | "Vencido">("Todos")
  const [contas, setContas] = useState<ContaReceber[]>(contasIniciais)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaReceber | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ContaReceber | null>(null)
  const [form, setForm] = useState(emptyForm)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingConta(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/contas-a-receber")
    }
  }, [searchParams, router])

  const filtered = filterStatus === "Todos"
    ? contas
    : contas.filter((c) => c.status === filterStatus.toLowerCase())

  const totalPendente = contas.filter((c) => c.status === "pendente").reduce((a, c) => a + c.valor, 0)
  const totalRecebido = contas.filter((c) => c.status === "recebido").reduce((a, c) => a + c.valor, 0)
  const totalVencido = contas.filter((c) => c.status === "vencido").reduce((a, c) => a + c.valor, 0)
  const qtdPendente = contas.filter((c) => c.status === "pendente").length

  function openNew() {
    setEditingConta(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(conta: ContaReceber) {
    setEditingConta(conta)
    setForm({
      descricao: conta.descricao,
      valor: conta.valor.toString(),
      vencimento: conta.vencimento,
      cliente: conta.cliente,
      categoria: conta.categoria,
      status: conta.status,
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.descricao.trim()) return
    if (editingConta) {
      setContas((prev) =>
        prev.map((c) =>
          c.id === editingConta.id
            ? { ...c, descricao: form.descricao, valor: parseFloat(form.valor) || 0, vencimento: form.vencimento, cliente: form.cliente, categoria: form.categoria, status: form.status as ContaReceber["status"] }
            : c
        )
      )
    } else {
      const newConta: ContaReceber = {
        id: Date.now(),
        descricao: form.descricao,
        valor: parseFloat(form.valor) || 0,
        vencimento: form.vencimento || "2026-02-28",
        status: form.status as ContaReceber["status"],
        cliente: form.cliente,
        categoria: form.categoria,
      }
      setContas((prev) => [...prev, newConta])
    }
    setDialogOpen(false)
  }

  function handleDelete(conta: ContaReceber) {
    setContas((prev) => prev.filter((c) => c.id !== conta.id))
    setDeleteConfirm(null)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Contas a Receber" />
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
                  <p className="text-sm text-muted-foreground">Total Recebido</p>
                  <p className="mt-1 text-xl font-bold text-[hsl(142,71%,40%)]">{formatCurrency(totalRecebido)}</p>
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
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center rounded-lg border border-border bg-card">
                {(["Todos", "Pendente", "Recebido", "Vencido"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterStatus === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >{s}</button>
                ))}
              </div>
              <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Nova Conta a Receber
              </button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Descricao</span>
                <span>Cliente</span>
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
                      conta.status === "vencido" ? "bg-[hsl(0,72%,51%)]/10" : conta.status === "recebido" ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(38,92%,50%)]/10"
                    }`}>
                      <FileUp className={`h-5 w-5 ${
                        conta.status === "vencido" ? "text-[hsl(0,72%,51%)]" : conta.status === "recebido" ? "text-[hsl(142,71%,40%)]" : "text-[hsl(38,92%,50%)]"
                      }`} />
                    </div>
                    <span className="text-sm font-medium text-card-foreground">{conta.descricao}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{conta.cliente}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{conta.categoria}</span>
                  <span className="text-sm text-muted-foreground">{formatDateDisplay(conta.vencimento)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    conta.status === "recebido"
                      ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]"
                      : conta.status === "vencido"
                        ? "bg-[hsl(0,72%,51%)]/10 text-[hsl(0,72%,51%)]"
                        : "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]"
                  }`}>
                    {conta.status === "recebido" ? "Recebido" : conta.status === "vencido" ? "Vencido" : "Pendente"}
                  </span>
                  <span className="text-right text-sm font-semibold text-[hsl(142,71%,40%)]">+ {formatCurrency(conta.valor)}</span>
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
            </div>
          </div>
        </main>
      </div>

      {/* Dialog - Novo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle>
            <DialogDescription>{editingConta ? "Atualize os dados da conta." : "Preencha os dados para registrar uma nova conta a receber."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Input id="descricao" placeholder="Ex: Consultoria, Projeto..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
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
              <Label htmlFor="cliente">Cliente</Label>
              <Input id="cliente" placeholder="Nome do cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <select id="categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {CATEGORIAS_RECEBER.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContaReceber["status"] })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="pendente">Pendente</option>
                  <option value="recebido">Recebido</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              {editingConta ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a receber</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteConfirm?.descricao}&quot;? Esta acao nao pode ser desfeita.
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
