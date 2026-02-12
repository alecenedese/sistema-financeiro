"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { FileDown, Plus, TrendingDown, Clock, CheckCircle2, AlertTriangle, Pencil, Trash2 } from "lucide-react"
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

interface ContaPagar {
  id: number
  descricao: string
  valor: number
  vencimento: string
  status: "pendente" | "pago" | "vencido"
  fornecedor: string
  categoria: string
  subcategoria: string
  subcategoriaFilho: string
}

// Hierarquia: Categoria > Subcategoria > Filho
const CATEGORIAS_HIERARQUIA: Record<string, Record<string, string[]>> = {
  "Moradia": {
    "Aluguel": ["Residencial", "Comercial"],
    "Condominio": ["Taxa Ordinaria", "Taxa Extra"],
    "Conta de Energia": [],
    "Conta de Agua": [],
    "Internet": [],
  },
  "Transporte": {
    "Combustivel": ["Gasolina", "Etanol"],
    "Estacionamento": [],
    "Manutencao Veiculo": ["Revisao", "Pneus", "Funilaria"],
    "Transporte Publico": [],
  },
  "Alimentacao": {
    "Supermercado": [],
    "Restaurante": ["Almoco", "Jantar"],
    "Delivery": [],
    "Padaria": [],
  },
  "Saude": {
    "Plano de Saude": [],
    "Farmacia": [],
    "Consultas": ["Clinico Geral", "Especialista"],
  },
  "Lazer": {
    "Streaming": [],
    "Cinema": [],
    "Viagens": ["Nacional", "Internacional"],
    "Esportes": [],
  },
  "Infraestrutura": {
    "Software": [],
    "Equipamentos": [],
    "Seguros": [],
  },
  "Servicos": {
    "Limpeza": [],
    "Manutencao": [],
    "Consultoria": [],
  },
  "Suprimentos": {
    "Material Escritorio": [],
    "Material Limpeza": [],
  },
  "Salarios": {
    "Folha de Pagamento": [],
    "Encargos": [],
  },
  "Impostos": {
    "Federal": [],
    "Estadual": [],
    "Municipal": [],
  },
}

const CATEGORIAS_PAGAR = Object.keys(CATEGORIAS_HIERARQUIA)

const contasIniciais: ContaPagar[] = [
  { id: 1, descricao: "Aluguel Escritorio", valor: 2800.0, vencimento: "2026-02-10", status: "pendente", fornecedor: "Imobiliaria Central", categoria: "Moradia", subcategoria: "Aluguel", subcategoriaFilho: "Comercial" },
  { id: 2, descricao: "Energia Eletrica", valor: 680.0, vencimento: "2026-02-15", status: "pendente", fornecedor: "CEMIG", categoria: "Moradia", subcategoria: "Conta de Energia", subcategoriaFilho: "" },
  { id: 3, descricao: "Internet Corporativa", valor: 450.0, vencimento: "2026-02-20", status: "pendente", fornecedor: "Vivo Empresas", categoria: "Moradia", subcategoria: "Internet", subcategoriaFilho: "" },
  { id: 4, descricao: "Software Contabil", valor: 1200.0, vencimento: "2026-02-05", status: "pago", fornecedor: "ContaSoft", categoria: "Infraestrutura", subcategoria: "Software", subcategoriaFilho: "" },
  { id: 5, descricao: "Seguro Empresarial", valor: 3500.0, vencimento: "2026-02-01", status: "pago", fornecedor: "Porto Seguro", categoria: "Infraestrutura", subcategoria: "Seguros", subcategoriaFilho: "" },
  { id: 6, descricao: "Servico de Limpeza", valor: 950.0, vencimento: "2026-02-25", status: "pendente", fornecedor: "LimpMax", categoria: "Servicos", subcategoria: "Limpeza", subcategoriaFilho: "" },
  { id: 7, descricao: "Manutencao Veiculo", valor: 380.0, vencimento: "2026-02-03", status: "vencido", fornecedor: "AutoCenter", categoria: "Transporte", subcategoria: "Manutencao Veiculo", subcategoriaFilho: "Revisao" },
  { id: 8, descricao: "Material de Escritorio", valor: 240.0, vencimento: "2026-02-28", status: "pendente", fornecedor: "Kalunga", categoria: "Suprimentos", subcategoria: "Material Escritorio", subcategoriaFilho: "" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

const emptyForm = { descricao: "", valor: "", vencimento: "", fornecedor: "", categoria: "Moradia", subcategoria: "", subcategoriaFilho: "", status: "pendente" as const }

export default function ContasAPagarPage() {
  const [filterStatus, setFilterStatus] = useState<"Todos" | "Pendente" | "Pago" | "Vencido">("Todos")
  const [contas, setContas] = useState<ContaPagar[]>(contasIniciais)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ContaPagar | null>(null)
  const [form, setForm] = useState(emptyForm)

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

  const filtered = filterStatus === "Todos"
    ? contas
    : contas.filter((c) => c.status === filterStatus.toLowerCase())

  const totalPendente = contas.filter((c) => c.status === "pendente").reduce((a, c) => a + c.valor, 0)
  const totalPago = contas.filter((c) => c.status === "pago").reduce((a, c) => a + c.valor, 0)
  const totalVencido = contas.filter((c) => c.status === "vencido").reduce((a, c) => a + c.valor, 0)
  const qtdPendente = contas.filter((c) => c.status === "pendente").length

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
      categoria: conta.categoria,
      subcategoria: conta.subcategoria,
      subcategoriaFilho: conta.subcategoriaFilho,
      status: conta.status,
    })
    setDialogOpen(true)
  }

  const subcategoriasDisponiveis = form.categoria ? Object.keys(CATEGORIAS_HIERARQUIA[form.categoria] || {}) : []
  const filhosDisponiveis = form.categoria && form.subcategoria ? (CATEGORIAS_HIERARQUIA[form.categoria]?.[form.subcategoria] || []) : []

  function handleSave() {
    if (!form.descricao.trim()) return
    if (editingConta) {
      setContas((prev) =>
        prev.map((c) =>
          c.id === editingConta.id
            ? { ...c, descricao: form.descricao, valor: parseFloat(form.valor) || 0, vencimento: form.vencimento, fornecedor: form.fornecedor, categoria: form.categoria, subcategoria: form.subcategoria, subcategoriaFilho: form.subcategoriaFilho, status: form.status as ContaPagar["status"] }
            : c
        )
      )
    } else {
      const newConta: ContaPagar = {
        id: Date.now(),
        descricao: form.descricao,
        valor: parseFloat(form.valor) || 0,
        vencimento: form.vencimento || "2026-02-28",
        status: form.status as ContaPagar["status"],
        fornecedor: form.fornecedor,
        categoria: form.categoria,
        subcategoria: form.subcategoria,
        subcategoriaFilho: form.subcategoriaFilho,
      }
      setContas((prev) => [...prev, newConta])
    }
    setDialogOpen(false)
  }

  function handleDelete(conta: ContaPagar) {
    setContas((prev) => prev.filter((c) => c.id !== conta.id))
    setDeleteConfirm(null)
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

            {/* Table */}
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
                    {[conta.categoria, conta.subcategoria, conta.subcategoriaFilho].filter(Boolean).join(" > ")}
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
            </div>
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
              <select id="categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value, subcategoria: "", subcategoriaFilho: "" })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">Selecione...</option>
                {CATEGORIAS_PAGAR.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {subcategoriasDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoria">Subcategoria</Label>
                <select id="subcategoria" value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value, subcategoriaFilho: "" })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">Selecione...</option>
                  {subcategoriasDisponiveis.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {filhosDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoriaFilho">Subcategoria Filho</Label>
                <select id="subcategoriaFilho" value={form.subcategoriaFilho} onChange={(e) => setForm({ ...form, subcategoriaFilho: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">Selecione...</option>
                  {filhosDisponiveis.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContaPagar["status"] })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
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
            <AlertDialogTitle>Excluir conta a pagar</AlertDialogTitle>
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
