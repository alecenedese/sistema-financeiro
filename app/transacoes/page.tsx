"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Search,
  Filter,
  Home,
  Car,
  ShoppingCart,
  Briefcase,
  Laptop,
  Utensils,
  Heart,
  Zap,
  Pencil,
  Trash2,
} from "lucide-react"
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

interface Transacao {
  id: number
  descricao: string
  valor: number
  data: string
  categoria: string
  conta: string
  icon: typeof Home
  color: string
}

const CATEGORIAS = ["Moradia", "Salario", "Transporte", "Alimentacao", "Freelancer", "Saude", "Investimentos"]
const CONTAS = ["Nubank", "Bradesco", "Caixa"]
const ICON_MAP: Record<string, typeof Home> = {
  Moradia: Home, Salario: Briefcase, Transporte: Car, Alimentacao: ShoppingCart,
  Freelancer: Laptop, Saude: Heart, Investimentos: TrendingUp,
}
const COLOR_MAP: Record<string, string> = {
  Moradia: "#1B3A5C", Salario: "#2C5F8A", Transporte: "#3D7AB5", Alimentacao: "#7A8FA6",
  Freelancer: "#2C5F8A", Saude: "#A8B8C8", Investimentos: "#7A8FA6",
}

const transacoesIniciais: Transacao[] = [
  { id: 1, descricao: "Aluguel", valor: -1290.0, data: "2026-02-05", categoria: "Moradia", conta: "Bradesco", icon: Home, color: "#1B3A5C" },
  { id: 2, descricao: "Salario", valor: 4200.0, data: "2026-02-01", categoria: "Salario", conta: "Nubank", icon: Briefcase, color: "#2C5F8A" },
  { id: 3, descricao: "Combustivel", valor: -250.0, data: "2026-02-03", categoria: "Transporte", conta: "Nubank", icon: Car, color: "#3D7AB5" },
  { id: 4, descricao: "Supermercado", valor: -485.5, data: "2026-02-02", categoria: "Alimentacao", conta: "Nubank", icon: ShoppingCart, color: "#7A8FA6" },
  { id: 5, descricao: "Freelancer - Projeto Web", valor: 800.0, data: "2026-02-04", categoria: "Freelancer", conta: "Nubank", icon: Laptop, color: "#2C5F8A" },
  { id: 6, descricao: "Restaurante", valor: -89.9, data: "2026-02-06", categoria: "Alimentacao", conta: "Nubank", icon: Utensils, color: "#A8B8C8" },
  { id: 7, descricao: "Plano de Saude", valor: -350.0, data: "2026-02-05", categoria: "Saude", conta: "Bradesco", icon: Heart, color: "#1B3A5C" },
  { id: 8, descricao: "Conta de Energia", valor: -185.0, data: "2026-02-07", categoria: "Moradia", conta: "Bradesco", icon: Zap, color: "#3D7AB5" },
  { id: 9, descricao: "Dividendos FIIs", valor: 155.5, data: "2026-02-08", categoria: "Investimentos", conta: "Nubank", icon: TrendingUp, color: "#7A8FA6" },
  { id: 10, descricao: "Estacionamento", valor: -45.0, data: "2026-02-06", categoria: "Transporte", conta: "Nubank", icon: Car, color: "#A8B8C8" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

const emptyForm = { descricao: "", valor: "", data: "", categoria: "Moradia", conta: "Nubank", tipo: "saida" }

export default function TransacoesPage() {
  const [filterTipo, setFilterTipo] = useState<"Todos" | "Entradas" | "Saidas">("Todos")
  const [searchTerm, setSearchTerm] = useState("")
  const [transacoes, setTransacoes] = useState<Transacao[]>(transacoesIniciais)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transacao | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Transacao | null>(null)
  const [form, setForm] = useState(emptyForm)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingTx(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/transacoes")
    }
  }, [searchParams, router])

  const filtered = transacoes
    .filter((tx) => {
      if (filterTipo === "Entradas") return tx.valor > 0
      if (filterTipo === "Saidas") return tx.valor < 0
      return true
    })
    .filter((tx) =>
      tx.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const totalEntradas = transacoes.filter((t) => t.valor > 0).reduce((a, t) => a + t.valor, 0)
  const totalSaidas = transacoes.filter((t) => t.valor < 0).reduce((a, t) => a + Math.abs(t.valor), 0)
  const saldo = totalEntradas - totalSaidas

  function openNew() {
    setEditingTx(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(tx: Transacao) {
    setEditingTx(tx)
    setForm({
      descricao: tx.descricao,
      valor: Math.abs(tx.valor).toString(),
      data: tx.data,
      categoria: tx.categoria,
      conta: tx.conta,
      tipo: tx.valor >= 0 ? "entrada" : "saida",
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.descricao.trim() || !form.valor) return
    const valorNum = parseFloat(form.valor) || 0
    const valorFinal = form.tipo === "saida" ? -Math.abs(valorNum) : Math.abs(valorNum)
    const cat = form.categoria

    if (editingTx) {
      setTransacoes((prev) =>
        prev.map((t) =>
          t.id === editingTx.id
            ? { ...t, descricao: form.descricao, valor: valorFinal, data: form.data, categoria: cat, conta: form.conta, icon: ICON_MAP[cat] || Home, color: COLOR_MAP[cat] || "#7A8FA6" }
            : t
        )
      )
    } else {
      const newTx: Transacao = {
        id: Date.now(),
        descricao: form.descricao,
        valor: valorFinal,
        data: form.data || "2026-02-09",
        categoria: cat,
        conta: form.conta,
        icon: ICON_MAP[cat] || Home,
        color: COLOR_MAP[cat] || "#7A8FA6",
      }
      setTransacoes((prev) => [...prev, newTx])
    }
    setDialogOpen(false)
  }

  function handleDelete(tx: Transacao) {
    setTransacoes((prev) => prev.filter((t) => t.id !== tx.id))
    setDeleteConfirm(null)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Transacoes" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Entradas</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{formatCurrency(totalEntradas)}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Saidas</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{formatCurrency(totalSaidas)}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(0,72%,51%)]">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Saldo do Periodo</p>
                  <p className={`mt-1 text-xl font-bold ${saldo >= 0 ? "text-[hsl(142,71%,40%)]" : "text-[hsl(0,72%,51%)]"}`}>{formatCurrency(saldo)}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                  <ArrowLeftRight className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Transacoes</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{transacoes.length}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,20%,60%)]">
                  <Filter className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar transacao..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-border bg-card">
                  {(["Todos", "Entradas", "Saidas"] as const).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFilterTipo(tipo)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                        filterTipo === tipo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Nova Transacao
                </button>
              </div>
            </div>

            {/* Transactions table */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Descricao</span>
                <span>Categoria</span>
                <span>Conta</span>
                <span>Data</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Acoes</span>
              </div>
              {filtered.map((tx) => (
                <div key={tx.id} className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${tx.color}18` }}>
                      <tx.icon className="h-5 w-5" style={{ color: tx.color }} />
                    </div>
                    <span className="text-sm font-medium text-card-foreground">{tx.descricao}</span>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{tx.categoria}</span>
                  <span className="text-sm text-muted-foreground">{tx.conta}</span>
                  <span className="text-sm text-muted-foreground">{formatDateDisplay(tx.data)}</span>
                  <span className={`text-right text-sm font-semibold ${tx.valor >= 0 ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>
                    {tx.valor >= 0 ? "+" : "-"} {formatCurrency(Math.abs(tx.valor))}
                  </span>
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => openEdit(tx)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm(tx)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Nenhuma transacao encontrada.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Dialog - Novo/Editar Transacao */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTx ? "Editar Transacao" : "Nova Transacao"}</DialogTitle>
            <DialogDescription>{editingTx ? "Atualize os dados da transacao." : "Preencha os dados para registrar uma nova transacao."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Input id="descricao" placeholder="Ex: Aluguel, Salario..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saida</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <Input id="valor" type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <select id="categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contaTx">Conta</Label>
                <select id="contaTx" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {CONTAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              {editingTx ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transacao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a transacao &quot;{deleteConfirm?.descricao}&quot;? Esta acao nao pode ser desfeita.
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
