"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { Tags, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Loader2 } from "lucide-react"
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

interface SubcategoriaFilho {
  id: number
  nome: string
  subcategoria_id: number
}

interface Subcategoria {
  id: number
  nome: string
  categoria_id: number
  filhos: SubcategoriaFilho[]
}

interface Categoria {
  id: number
  nome: string
  tipo: "Receita" | "Despesa"
  cor: string
  subcategorias: Subcategoria[]
}

const COLORS = ["#1B3A5C", "#2C5F8A", "#7A8FA6", "#A8B8C8", "#3D7AB5", "#C4CFD9"]

const supabase = createClient()

async function fetchCategorias(): Promise<Categoria[]> {
  const { data: cats, error: catError } = await supabase
    .from("categorias")
    .select("*")
    .order("nome")

  if (catError) throw catError

  const { data: subs, error: subError } = await supabase
    .from("subcategorias")
    .select("*")
    .order("nome")

  if (subError) throw subError

  const { data: filhos, error: filhoError } = await supabase
    .from("subcategorias_filhos")
    .select("*")
    .order("nome")

  if (filhoError) throw filhoError

  // Build hierarchy
  const filhosBySub: Record<number, SubcategoriaFilho[]> = {}
  for (const f of filhos || []) {
    if (!filhosBySub[f.subcategoria_id]) filhosBySub[f.subcategoria_id] = []
    filhosBySub[f.subcategoria_id].push(f)
  }

  const subsByCat: Record<number, Subcategoria[]> = {}
  for (const s of subs || []) {
    if (!subsByCat[s.categoria_id]) subsByCat[s.categoria_id] = []
    subsByCat[s.categoria_id].push({
      ...s,
      filhos: filhosBySub[s.id] || [],
    })
  }

  return (cats || []).map((c) => ({
    ...c,
    subcategorias: subsByCat[c.id] || [],
  }))
}

type DialogMode = "categoria" | "subcategoria" | "subcategoria-filho"

export default function CategoriasPage() {
  const { data: categorias, error, isLoading, mutate } = useSWR("categorias", fetchCategorias)

  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set())
  const [expandedSubs, setExpandedSubs] = useState<Set<number>>(new Set())
  const [filterTipo, setFilterTipo] = useState<"Todos" | "Receita" | "Despesa">("Todos")
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("categoria")
  const [editingCat, setEditingCat] = useState<Categoria | null>(null)
  const [editingSub, setEditingSub] = useState<{ catId: number; sub: Subcategoria } | null>(null)
  const [editingFilho, setEditingFilho] = useState<{ catId: number; subId: number; filho: SubcategoriaFilho } | null>(null)
  const [parentCatId, setParentCatId] = useState<number | null>(null)
  const [parentSubId, setParentSubId] = useState<number | null>(null)

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "cat" | "sub" | "filho"; catId: number; subId?: number; filhoId?: number; nome: string } | null>(null)

  // Form
  const [formNome, setFormNome] = useState("")
  const [formTipo, setFormTipo] = useState<"Receita" | "Despesa">("Despesa")

  const searchParams = useSearchParams()
  const router = useRouter()

  const openNewCategoria = useCallback(() => {
    setDialogMode("categoria")
    setEditingCat(null)
    setFormNome("")
    setFormTipo("Despesa")
    setDialogOpen(true)
  }, [])

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      openNewCategoria()
      router.replace("/categorias")
    }
  }, [searchParams, router, openNewCategoria])

  function toggleExpand(id: number) {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExpandSub(id: number) {
    setExpandedSubs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = filterTipo === "Todos" ? (categorias || []) : (categorias || []).filter((c) => c.tipo === filterTipo)

  // --- Categoria CRUD ---
  function openEditCategoria(cat: Categoria) {
    setDialogMode("categoria")
    setEditingCat(cat)
    setFormNome(cat.nome)
    setFormTipo(cat.tipo)
    setDialogOpen(true)
  }

  async function handleSaveCategoria() {
    if (!formNome.trim()) return
    setSaving(true)
    try {
      if (editingCat) {
        await supabase.from("categorias").update({ nome: formNome, tipo: formTipo }).eq("id", editingCat.id)
      } else {
        await supabase.from("categorias").insert({ nome: formNome, tipo: formTipo, cor: COLORS[(categorias?.length || 0) % COLORS.length] })
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
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

  async function handleSaveSubcategoria() {
    if (!formNome.trim() || !parentCatId) return
    setSaving(true)
    try {
      if (editingSub) {
        await supabase.from("subcategorias").update({ nome: formNome }).eq("id", editingSub.sub.id)
      } else {
        await supabase.from("subcategorias").insert({ nome: formNome, categoria_id: parentCatId })
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // --- Subcategoria Filho CRUD ---
  function openNewFilho(catId: number, subId: number) {
    setDialogMode("subcategoria-filho")
    setEditingFilho(null)
    setParentCatId(catId)
    setParentSubId(subId)
    setFormNome("")
    setDialogOpen(true)
  }

  function openEditFilho(catId: number, subId: number, filho: SubcategoriaFilho) {
    setDialogMode("subcategoria-filho")
    setEditingFilho({ catId, subId, filho })
    setParentCatId(catId)
    setParentSubId(subId)
    setFormNome(filho.nome)
    setDialogOpen(true)
  }

  async function handleSaveFilho() {
    if (!formNome.trim() || !parentSubId) return
    setSaving(true)
    try {
      if (editingFilho) {
        await supabase.from("subcategorias_filhos").update({ nome: formNome }).eq("id", editingFilho.filho.id)
      } else {
        await supabase.from("subcategorias_filhos").insert({ nome: formNome, subcategoria_id: parentSubId })
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // --- Delete ---
  async function handleDelete() {
    if (!deleteConfirm) return
    setSaving(true)
    try {
      if (deleteConfirm.type === "cat") {
        await supabase.from("categorias").delete().eq("id", deleteConfirm.catId)
      } else if (deleteConfirm.type === "sub") {
        await supabase.from("subcategorias").delete().eq("id", deleteConfirm.subId!)
      } else if (deleteConfirm.type === "filho") {
        await supabase.from("subcategorias_filhos").delete().eq("id", deleteConfirm.filhoId!)
      }
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

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando categorias...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">Erro ao carregar categorias. Tente novamente.</p>
                <button type="button" onClick={() => mutate()} className="mt-2 text-sm font-medium text-primary hover:underline">
                  Recarregar
                </button>
              </div>
            )}

            {/* Category list */}
            {!isLoading && !error && (
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
                              {cat.subcategorias.length} subcategorias
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
                              {cat.subcategorias.map((sub) => {
                                const isSubExpanded = expandedSubs.has(sub.id)
                                return (
                                  <div key={sub.id}>
                                    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
                                      {sub.filhos.length > 0 ? (
                                        <button type="button" onClick={() => toggleExpandSub(sub.id)} className="shrink-0 text-muted-foreground">
                                          {isSubExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                        </button>
                                      ) : (
                                        <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.cor }} />
                                      )}
                                      <button type="button" onClick={() => toggleExpandSub(sub.id)} className="flex flex-1 items-center gap-2 text-left">
                                        <span className="text-sm text-card-foreground">{sub.nome}</span>
                                        {sub.filhos.length > 0 && (
                                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                            {sub.filhos.length}
                                          </span>
                                        )}
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => openNewFilho(cat.id, sub.id)} className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" title="Adicionar sub-filho">
                                          <Plus className="h-3 w-3" />
                                        </button>
                                        <button type="button" onClick={() => openEditSubcategoria(cat.id, sub)} className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button type="button" onClick={() => setDeleteConfirm({ type: "sub", catId: cat.id, subId: sub.id, nome: sub.nome })} className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                    {/* Subcategoria Filhos (3o nivel) */}
                                    {isSubExpanded && sub.filhos.length > 0 && (
                                      <div className="ml-6 border-l-2 border-border pl-4 mt-1 mb-1">
                                        {sub.filhos.map((filho) => (
                                          <div key={filho.id} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted">
                                            <div className="h-1.5 w-1.5 shrink-0 rounded-full border border-current opacity-40" style={{ color: cat.cor }} />
                                            <span className="flex-1 text-sm text-card-foreground">{filho.nome}</span>
                                            <div className="flex items-center gap-1">
                                              <button type="button" onClick={() => openEditFilho(cat.id, sub.id, filho)} className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                                <Pencil className="h-3 w-3" />
                                              </button>
                                              <button type="button" onClick={() => setDeleteConfirm({ type: "filho", catId: cat.id, subId: sub.id, filhoId: filho.id, nome: filho.nome })} className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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
                : dialogMode === "subcategoria"
                ? editingSub ? "Editar Subcategoria" : "Nova Subcategoria"
                : editingFilho ? "Editar Subcategoria Filho" : "Nova Subcategoria Filho"
              }
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "categoria"
                ? editingCat ? "Atualize o nome e tipo da categoria." : "Preencha os dados para criar uma nova categoria."
                : dialogMode === "subcategoria"
                ? editingSub ? "Atualize o nome da subcategoria." : "Preencha o nome da nova subcategoria."
                : editingFilho ? "Atualize o nome da subcategoria filho." : "Preencha o nome da nova subcategoria filho."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" placeholder={dialogMode === "categoria" ? "Ex: Moradia, Transporte..." : dialogMode === "subcategoria" ? "Ex: Aluguel, Combustivel..." : "Ex: Residencial, Gasolina..."} value={formNome} onChange={(e) => setFormNome(e.target.value)} />
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
            <button
              type="button"
              disabled={saving}
              onClick={dialogMode === "categoria" ? handleSaveCategoria : dialogMode === "subcategoria" ? handleSaveSubcategoria : handleSaveFilho}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {(dialogMode === "categoria" ? editingCat : dialogMode === "subcategoria" ? editingSub : editingFilho) ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteConfirm?.type === "cat" ? "categoria" : deleteConfirm?.type === "sub" ? "subcategoria" : "subcategoria filho"}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteConfirm?.nome}&quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
