"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  Landmark,
  CreditCard,
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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

interface Conta {
  id: number
  nome: string
  tipo: string
  saldo: number
  icon: typeof Landmark
  color: string
  agencia: string
  conta: string
  entradas: number
  saidas: number
}

const ICON_MAP: Record<string, typeof Landmark> = {
  "Conta Corrente": Landmark,
  Poupanca: Wallet,
  "Cartao de Credito": CreditCard,
}

const contasIniciais: Conta[] = [
  { id: 1, nome: "Nubank", tipo: "Conta Corrente", saldo: 3241.6, icon: Landmark, color: "#1B3A5C", agencia: "0001", conta: "98765-4", entradas: 4200.0, saidas: 958.4 },
  { id: 2, nome: "Bradesco", tipo: "Conta Corrente", saldo: 2150.0, icon: Landmark, color: "#2C5F8A", agencia: "1234", conta: "56789-0", entradas: 3500.0, saidas: 1350.0 },
  { id: 3, nome: "Caixa", tipo: "Poupanca", saldo: 1700.0, icon: Wallet, color: "#7A8FA6", agencia: "0567", conta: "12345-6", entradas: 500.0, saidas: 0 },
  { id: 4, nome: "Nubank", tipo: "Cartao de Credito", saldo: -480.0, icon: CreditCard, color: "#A8B8C8", agencia: "-", conta: "****-1234", entradas: 0, saidas: 480.0 },
]

const COLORS = ["#1B3A5C", "#2C5F8A", "#3D7AB5", "#7A8FA6", "#A8B8C8", "#C4CFD9"]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

const emptyForm = { nome: "", tipo: "Conta Corrente", agencia: "", conta: "", saldo: "" }

export default function ContasBancariasPage() {
  const [showBalances, setShowBalances] = useState(true)
  const [contas, setContas] = useState<Conta[]>(contasIniciais)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Conta | null>(null)
  const [form, setForm] = useState(emptyForm)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingConta(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/contas-bancarias")
    }
  }, [searchParams, router])

  const totalBalance = contas.reduce((acc, c) => acc + c.saldo, 0)
  const totalEntradas = contas.reduce((acc, c) => acc + c.entradas, 0)
  const totalSaidas = contas.reduce((acc, c) => acc + c.saidas, 0)

  function openNew() {
    setEditingConta(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(conta: Conta) {
    setEditingConta(conta)
    setForm({
      nome: conta.nome,
      tipo: conta.tipo,
      agencia: conta.agencia,
      conta: conta.conta,
      saldo: conta.saldo.toString(),
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.nome.trim()) return
    if (editingConta) {
      setContas((prev) =>
        prev.map((c) =>
          c.id === editingConta.id
            ? {
                ...c,
                nome: form.nome,
                tipo: form.tipo,
                agencia: form.agencia,
                conta: form.conta,
                saldo: parseFloat(form.saldo) || 0,
                icon: ICON_MAP[form.tipo] || Landmark,
              }
            : c
        )
      )
    } else {
      const newConta: Conta = {
        id: Date.now(),
        nome: form.nome,
        tipo: form.tipo,
        saldo: parseFloat(form.saldo) || 0,
        icon: ICON_MAP[form.tipo] || Landmark,
        color: COLORS[contas.length % COLORS.length],
        agencia: form.agencia,
        conta: form.conta,
        entradas: 0,
        saidas: 0,
      }
      setContas((prev) => [...prev, newConta])
    }
    setDialogOpen(false)
  }

  function handleDelete(conta: Conta) {
    setContas((prev) => prev.filter((c) => c.id !== conta.id))
    setDeleteConfirm(null)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Contas Bancarias" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Saldo Total</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xl font-bold text-card-foreground">
                      {showBalances ? formatCurrency(totalBalance) : "R$ ******"}
                    </p>
                    <button type="button" onClick={() => setShowBalances(!showBalances)} className="text-muted-foreground hover:text-foreground">
                      {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                  <Landmark className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Entradas do Mes</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{showBalances ? formatCurrency(totalEntradas) : "R$ ******"}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Saidas do Mes</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{showBalances ? formatCurrency(totalSaidas) : "R$ ******"}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(0,72%,51%)]">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Contas Ativas</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{contas.length}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,20%,60%)]">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Account Cards */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Minhas Contas</h2>
              <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Nova Conta
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {contas.map((conta) => (
                <div key={conta.id} className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${conta.color}18` }}>
                      <conta.icon className="h-5 w-5" style={{ color: conta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-card-foreground">{conta.nome}</p>
                      <p className="text-xs text-muted-foreground">{conta.tipo} &middot; Ag: {conta.agencia} | Cc: {conta.conta}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" onClick={() => openEdit(conta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(conta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className={`text-xl font-bold ${conta.saldo >= 0 ? "text-card-foreground" : "text-[hsl(0,72%,51%)]"}`}>
                      {showBalances ? formatCurrency(conta.saldo) : "R$ ******"}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(142,71%,40%)]/10 px-3 py-1.5">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-[hsl(142,71%,40%)]" />
                      <span className="text-xs font-medium text-[hsl(142,71%,40%)]">{formatCurrency(conta.entradas)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(0,72%,51%)]/10 px-3 py-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(0,72%,51%)]" />
                      <span className="text-xs font-medium text-[hsl(0,72%,51%)]">{formatCurrency(conta.saidas)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Dialog - Novo/Editar Conta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta" : "Nova Conta Bancaria"}</DialogTitle>
            <DialogDescription>{editingConta ? "Atualize os dados da conta bancaria." : "Preencha os dados para adicionar uma nova conta."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Banco</Label>
              <Input id="nome" placeholder="Ex: Nubank, Bradesco..." value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Conta</Label>
              <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="Conta Corrente">Conta Corrente</option>
                <option value="Poupanca">Poupanca</option>
                <option value="Cartao de Credito">Cartao de Credito</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agencia">Agencia</Label>
                <Input id="agencia" placeholder="0001" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conta">Conta</Label>
                <Input id="conta" placeholder="12345-6" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="saldo">Saldo Inicial</Label>
              <Input id="saldo" type="number" step="0.01" placeholder="0.00" value={form.saldo} onChange={(e) => setForm({ ...form, saldo: e.target.value })} />
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
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta {deleteConfirm?.nome} ({deleteConfirm?.tipo})? Esta acao nao pode ser desfeita.
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
