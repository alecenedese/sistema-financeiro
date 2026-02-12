"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { Target, TrendingUp, TrendingDown, Wallet, Plus, Pencil, Trash2 } from "lucide-react"
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

interface Meta {
  id: number
  categoria: string
  meta: number
  atual: number
  cor: string
  descricao: string
}

const COLORS = ["#1B3A5C", "#2C5F8A", "#7A8FA6", "#A8B8C8", "#3D7AB5", "#C4CFD9"]

const metasIniciais: Meta[] = [
  { id: 1, categoria: "Receita Mensal", meta: 50000, atual: 32800, cor: "#1B3A5C", descricao: "Receita total mensal esperada incluindo todos os servicos prestados" },
  { id: 2, categoria: "Despesas Operacionais", meta: 15000, atual: 9580, cor: "#2C5F8A", descricao: "Controle de gastos operacionais incluindo aluguel, salarios e insumos" },
  { id: 3, categoria: "Investimentos", meta: 10000, atual: 4200, cor: "#7A8FA6", descricao: "Aportes em investimentos de renda fixa e variavel" },
  { id: 4, categoria: "Reserva de Emergencia", meta: 30000, atual: 25000, cor: "#A8B8C8", descricao: "Fundo de emergencia para cobrir 6 meses de despesas" },
  { id: 5, categoria: "Marketing", meta: 5000, atual: 3200, cor: "#3D7AB5", descricao: "Investimentos em marketing digital e captacao de clientes" },
  { id: 6, categoria: "Capacitacao", meta: 3000, atual: 1500, cor: "#C4CFD9", descricao: "Treinamentos e cursos para equipe" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value)
}

const emptyForm = { categoria: "", meta: "", atual: "", descricao: "" }

export default function PlanejamentoPageWrapper() {
  return <Suspense><PlanejamentoPage /></Suspense>
}

function PlanejamentoPage() {
  const [metas, setMetas] = useState<Meta[]>(metasIniciais)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Meta | null>(null)
  const [form, setForm] = useState(emptyForm)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingMeta(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/planejamento")
    }
  }, [searchParams, router])

  const totalMeta = metas.reduce((a, m) => a + m.meta, 0)
  const totalAtual = metas.reduce((a, m) => a + m.atual, 0)
  const totalPercent = totalMeta > 0 ? Math.round((totalAtual / totalMeta) * 100) : 0

  const summaryData = [
    { label: "Meta de Receita", value: formatCurrency(metas.find((m) => m.categoria === "Receita Mensal")?.meta || 0), icon: TrendingUp, iconBg: "bg-[hsl(142,71%,40%)]" },
    { label: "Meta de Despesas", value: formatCurrency(metas.find((m) => m.categoria === "Despesas Operacionais")?.meta || 0), icon: TrendingDown, iconBg: "bg-[hsl(0,72%,51%)]" },
    { label: "Meta Investimentos", value: formatCurrency(metas.find((m) => m.categoria === "Investimentos")?.meta || 0), icon: Wallet, iconBg: "bg-[hsl(216,60%,22%)]" },
    { label: "Total Metas", value: metas.length.toString(), icon: Target, iconBg: "bg-[hsl(38,92%,50%)]" },
  ]

  function openNew() {
    setEditingMeta(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(meta: Meta) {
    setEditingMeta(meta)
    setForm({
      categoria: meta.categoria,
      meta: meta.meta.toString(),
      atual: meta.atual.toString(),
      descricao: meta.descricao,
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.categoria.trim()) return
    if (editingMeta) {
      setMetas((prev) =>
        prev.map((m) =>
          m.id === editingMeta.id
            ? { ...m, categoria: form.categoria, meta: parseFloat(form.meta) || 0, atual: parseFloat(form.atual) || 0, descricao: form.descricao }
            : m
        )
      )
    } else {
      const newMeta: Meta = {
        id: Date.now(),
        categoria: form.categoria,
        meta: parseFloat(form.meta) || 0,
        atual: parseFloat(form.atual) || 0,
        cor: COLORS[metas.length % COLORS.length],
        descricao: form.descricao,
      }
      setMetas((prev) => [...prev, newMeta])
    }
    setDialogOpen(false)
  }

  function handleDelete(meta: Meta) {
    setMetas((prev) => prev.filter((m) => m.id !== meta.id))
    setDeleteConfirm(null)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Planejamento" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryData.map((item) => (
                <div key={item.label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-xl font-bold text-card-foreground">{item.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.iconBg}`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Progress */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-card-foreground">Progresso Geral</h3>
                <span className="text-sm text-muted-foreground">{formatCurrency(totalAtual)} de {formatCurrency(totalMeta)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${totalPercent}%` }} />
                </div>
                <span className="text-sm font-bold text-card-foreground">{totalPercent}%</span>
              </div>
            </div>

            {/* Goal header */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Metas Detalhadas</h2>
              <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Nova Meta
              </button>
            </div>

            {/* Goal Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {metas.map((meta) => {
                const percentual = meta.meta > 0 ? Math.min((meta.atual / meta.meta) * 100, 100) : 0
                const isOnTrack = percentual >= 50
                return (
                  <div key={meta.id} className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${meta.cor}18` }}>
                        <Target className="h-5 w-5" style={{ color: meta.cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-card-foreground">{meta.categoria}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isOnTrack ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" : "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]"}`}>
                            {isOnTrack ? "No caminho" : "Atencao"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.descricao}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => openEdit(meta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(meta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>{formatCurrency(meta.atual)} de {formatCurrency(meta.meta)}</span>
                        <span className="font-semibold text-card-foreground">{percentual.toFixed(0)}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentual}%`, backgroundColor: meta.cor }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Dialog - Nova/Editar Meta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
            <DialogDescription>{editingMeta ? "Atualize os dados da meta." : "Preencha os dados para criar uma nova meta."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="categoria">Nome da Meta</Label>
              <Input id="categoria" placeholder="Ex: Receita Mensal, Marketing..." value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meta">Valor da Meta (R$)</Label>
                <Input id="meta" type="number" step="0.01" placeholder="0.00" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="atual">Valor Atual (R$)</Label>
                <Input id="atual" type="number" step="0.01" placeholder="0.00" value={form.atual} onChange={(e) => setForm({ ...form, atual: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Input id="descricao" placeholder="Descricao da meta..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              {editingMeta ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a meta &quot;{deleteConfirm?.categoria}&quot;? Esta acao nao pode ser desfeita.
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
