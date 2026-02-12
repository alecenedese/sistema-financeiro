"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { Tags, Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react"
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

interface Subcategoria {
  id: number
  nome: string
  transacoes: number
}

interface Categoria {
  id: number
  nome: string
  tipo: "Receita" | "Despesa"
  cor: string
  transacoes: number
  subcategorias: Subcategoria[]
}

const COLORS = ["#1B3A5C", "#2C5F8A", "#7A8FA6", "#A8B8C8", "#3D7AB5", "#C4CFD9"]

const categoriasIniciais: Categoria[] = [
  {
    id: 1, nome: "Moradia", tipo: "Despesa", cor: "#1B3A5C", transacoes: 12,
    subcategorias: [
      { id: 101, nome: "Aluguel", transacoes: 3 },
      { id: 102, nome: "Condominio", transacoes: 3 },
      { id: 103, nome: "Conta de Energia", transacoes: 3 },
      { id: 104, nome: "Conta de Agua", transacoes: 2 },
      { id: 105, nome: "Internet", transacoes: 1 },
    ],
  },
  {
    id: 2, nome: "Transporte", tipo: "Despesa", cor: "#2C5F8A", transacoes: 18,
    subcategorias: [
      { id: 201, nome: "Combustivel", transacoes: 8 },
      { id: 202, nome: "Estacionamento", transacoes: 5 },
      { id: 203, nome: "Manutencao Veiculo", transacoes: 3 },
      { id: 204, nome: "Transporte Publico", transacoes: 2 },
    ],
  },
  {
    id: 3, nome: "Alimentacao", tipo: "Despesa", cor: "#7A8FA6", transacoes: 35,
    subcategorias: [
      { id: 301, nome: "Supermercado", transacoes: 12 },
      { id: 302, nome: "Restaurante", transacoes: 10 },
      { id: 303, nome: "Delivery", transacoes: 8 },
      { id: 304, nome: "Padaria", transacoes: 5 },
    ],
  },
  {
    id: 4, nome: "Saude", tipo: "Despesa", cor: "#A8B8C8", transacoes: 8,
    subcategorias: [
      { id: 401, nome: "Plano de Saude", transacoes: 3 },
      { id: 402, nome: "Farmacia", transacoes: 3 },
      { id: 403, nome: "Consultas", transacoes: 2 },
    ],
  },
  {
    id: 5, nome: "Lazer", tipo: "Despesa", cor: "#C4CFD9", transacoes: 15,
    subcategorias: [
      { id: 501, nome: "Streaming", transacoes: 5 },
      { id: 502, nome: "Cinema", transacoes: 4 },
      { id: 503, nome: "Viagens", transacoes: 3 },
      { id: 504, nome: "Esportes", transacoes: 3 },
    ],
  },
  {
    id: 6, nome: "Salario", tipo: "Receita", cor: "hsl(142,71%,40%)", transacoes: 24,
    subcategorias: [
      { id: 601, nome: "Salario Fixo", transacoes: 12 },
      { id: 602, nome: "13o Salario", transacoes: 1 },
      { id: 603, nome: "Ferias", transacoes: 1 },
      { id: 604, nome: "Bonus", transacoes: 4 },
      { id: 605, nome: "Horas Extras", transacoes: 6 },
    ],
  },
  {
    id: 7, nome: "Freelancer", tipo: "Receita", cor: "#3D7AB5", transacoes: 18,
    subcategorias: [
      { id: 701, nome: "Projetos Web", transacoes: 8 },
      { id: 702, nome: "Consultoria", transacoes: 6 },
      { id: 703, nome: "Design", transacoes: 4 },
    ],
  },
  {
    id: 8, nome: "Investimentos", tipo: "Receita", cor: "hsl(38,92%,50%)", transacoes: 12,
    subcategorias: [
      { id: 801, nome: "Dividendos", transacoes: 5 },
      { id: 802, nome: "Renda Fixa", transacoes: 4 },
      { id: 803, nome: "Fundos Imobiliarios", transacoes: 3 },
    ],
  },
]

type DialogMode = "categoria" | "subcategoria"

export default function CategoriasPage() {
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set())
  const [filterTipo, setFilterTipo] = useState<"Todos" | "Receita" | "Despesa">("Todos")
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciais)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("categoria")
  const [editingCat, setEditingCat] = useState<Categoria | null>(null)
  const [editingSub, setEditingSub] = useState<{ catId: number; sub: Subcategoria } | null>(null)
  const [parentCatId, setParentCatId] = useState<number | null>(null)

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "cat" | "sub"; catId: number; subId?: number; nome: string } | null>(null)

  // Form
  const [formNome, setFormNome] = useState("")
  const [formTipo, setFormTipo] = useState<"Receita" | "Despesa">("Despesa")

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      openNewCategoria()
      router.replace("/categorias")
    }
  }, [searchParams, router])

  function toggleExpand(id: number) {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = filterTipo === "Todos" ? categorias : categorias.filter((c) => c.tipo === filterTipo)

  // --- Categoria CRUD ---
  function openNewCategoria() {
    setDialogMode("categoria")
    setEditingCat(null)
    setFormNome("")
    setFormTipo("Despesa")
    setDialogOpen(true)
  }

  function openEditCategoria(cat: Categoria) {
    setDialogMode("categoria")
    setEditingCat(cat)
    setFormNome(cat.nome)
    setFormTipo(cat.tipo)
    setDialogOpen(true)
  }

  function handleSaveCategoria() {
    if (!formNome.trim()) return
    if (editingCat) {
      setCategorias((prev) => prev.map((c) => c.id === editingCat.id ? { ...c, nome: formNome, tipo: formTipo } : c))
    } else {
      const newCat: Categoria = {
        id: Date.now(),
        nome: formNome,
        tipo: formTipo,
        cor: COLORS[categorias.length % COLORS.length],
        transacoes: 0,
        subcategorias: [],
      }
      setCategorias((prev) => [...prev, newCat])
    }
    setDialogOpen(false)
  }

  // --- Subcategoria CRUD ---
  function openNewSubcategoria(catId: number) {
    setDialogMode("subcategoria")
    setEditingSub(null)
    setParentCatId(catId)
    setFormNome("")
    setDialogOpen(true)
  }

  function openEditSubcategoria(catId: number, sub: Subcategoria) {
    setDialogMode("subcategoria")
    setEditingSub({ catId, sub })
    setParentCatId(catId)
    setFormNome(sub.nome)
    setDialogOpen(true)
  }

  function handleSaveSubcategoria() {
    if (!formNome.trim() || !parentCatId) return
    if (editingSub) {
      setCategorias((prev) =>
        prev.map((c) =>
          c.id === editingSub.catId
            ? { ...c, subcategorias: c.subcategorias.map((s) => s.id === editingSub.sub.id ? { ...s, nome: formNome } : s) }
            : c
        )
      )
    } else {
      const newSub: Subcategoria = { id: Date.now(), nome: formNome, transacoes: 0 }
      setCategorias((prev) =>
        prev.map((c) => c.id === parentCatId ? { ...c, subcategorias: [...c.subcategorias, newSub] } : c)
      )
    }
    setDialogOpen(false)
  }

  // --- Delete ---
  function handleDelete() {
    if (!deleteConfirm) return
    if (deleteConfirm.type === "cat") {
      setCategorias((prev) => prev.filter((c) => c.id !== deleteConfirm.catId))
    } else {
      setCategorias((prev) =>
        prev.map((c) =>
          c.id === deleteConfirm.catId
            ? { ...c, subcategorias: c.subcategorias.filter((s) => s.id !== deleteConfirm.subId) }
            : c
        )
      )
    }
    setDeleteConfirm(null)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Categorias" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Top bar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Organize suas transacoes com categorias e subcategorias.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border bg-card">
                  {(["Todos", "Receita", "Despesa"] as const).map((tipo) => (
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
                <button type="button" onClick={openNewCategoria} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Nova Categoria
                </button>
              </div>
            </div>

            {/* Category list */}
            <div className="space-y-3">
              {filtered.map((cat) => {
                const isExpanded = expandedCats.has(cat.id)
                return (
                  <div key={cat.id} className="rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                    {/* Category header */}
                    <div className="flex w-full items-center gap-4 p-5">
                      <button type="button" onClick={() => toggleExpand(cat.id)} className="flex flex-1 items-center gap-4 text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${cat.cor}18` }}>
                          <Tags className="h-5 w-5" style={{ color: cat.cor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-card-foreground">{cat.nome}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              cat.tipo === "Receita" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" : "bg-[hsl(0,72%,51%)]/10 text-[hsl(0,72%,51%)]"
                            }`}>
                              {cat.tipo}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {cat.subcategorias.length} subcategorias &middot; {cat.transacoes} transacoes
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEditCategoria(cat)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm({ type: "cat", catId: cat.id, nome: cat.nome })} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => toggleExpand(cat.id)} className="text-muted-foreground">
                          {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Subcategories */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        <div className="px-5 py-3">
                          <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Subcategorias
                            </span>
                            <button type="button" onClick={() => openNewSubcategoria(cat.id)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              <Plus className="h-3 w-3" />
                              Adicionar
                            </button>
                          </div>
                          <div className="space-y-1">
                            {cat.subcategorias.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
                                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.cor }} />
                                <span className="flex-1 text-sm text-card-foreground">{sub.nome}</span>
                                <span className="text-xs text-muted-foreground">{sub.transacoes} transacoes</span>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => openEditSubcategoria(cat.id, sub)} className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button type="button" onClick={() => setDeleteConfirm({ type: "sub", catId: cat.id, subId: sub.id, nome: sub.nome })} className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Dialog - Novo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "categoria"
                ? editingCat ? "Editar Categoria" : "Nova Categoria"
                : editingSub ? "Editar Subcategoria" : "Nova Subcategoria"
              }
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "categoria"
                ? editingCat ? "Atualize o nome e tipo da categoria." : "Preencha os dados para criar uma nova categoria."
                : editingSub ? "Atualize o nome da subcategoria." : "Preencha o nome da nova subcategoria."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" placeholder={dialogMode === "categoria" ? "Ex: Moradia, Transporte..." : "Ex: Aluguel, Combustivel..."} value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            {dialogMode === "categoria" && (
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select id="tipo" value={formTipo} onChange={(e) => setFormTipo(e.target.value as "Receita" | "Despesa")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="Despesa">Despesa</option>
                  <option value="Receita">Receita</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={dialogMode === "categoria" ? handleSaveCategoria : handleSaveSubcategoria} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              {(dialogMode === "categoria" ? editingCat : editingSub) ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteConfirm?.type === "cat" ? "categoria" : "subcategoria"}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteConfirm?.nome}&quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
