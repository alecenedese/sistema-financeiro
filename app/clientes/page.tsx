"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  FileText,
  Mail,
  Phone,
} from "lucide-react"
import { useState, useEffect, useCallback } from "react"
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
import useSWR from "swr"

interface Cliente {
  id: number
  nome: string
  documento: string
  email: string
  telefone: string
}

const supabase = createClient()

async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from("clientes").select("*").order("nome")
  if (error) throw error
  return (data || []).map((r) => ({
    id: r.id,
    nome: r.nome,
    documento: r.documento,
    email: r.email,
    telefone: r.telefone,
  }))
}

const emptyForm = { nome: "", documento: "", email: "", telefone: "" }

export default function ClientesPageWrapper() {
  return <Suspense><ClientesPage /></Suspense>
}

function ClientesPage() {
  const { data: clientes = [], mutate, isLoading } = useSWR("clientes", fetchClientes)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Cliente | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Cliente | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingItem(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/clientes")
    }
  }, [searchParams, router])

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.documento.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditingItem(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(item: Cliente) {
    setEditingItem(item)
    setForm({ nome: item.nome, documento: item.documento, email: item.email, telefone: item.telefone })
    setDialogOpen(true)
  }

  const handleSave = useCallback(async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const payload = { nome: form.nome, documento: form.documento, email: form.email, telefone: form.telefone }
      if (editingItem) {
        await supabase.from("clientes").update(payload).eq("id", editingItem.id)
      } else {
        await supabase.from("clientes").insert(payload)
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }, [form, editingItem, mutate])

  const handleDelete = useCallback(async (item: Cliente) => {
    await supabase.from("clientes").delete().eq("id", item.id)
    await mutate()
    setDeleteConfirm(null)
  }, [mutate])

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="ml-[72px] flex flex-1 flex-col">
          <PageHeader title="Clientes" />
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
        <PageHeader title="Clientes" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                  <p className="text-xl font-bold text-card-foreground">{clientes.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Com Documento</p>
                  <p className="text-xl font-bold text-card-foreground">{clientes.filter((c) => c.documento).length}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,20%,60%)]">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Com Email</p>
                  <p className="text-xl font-bold text-card-foreground">{clientes.filter((c) => c.email).length}</p>
                </div>
              </div>
            </div>

            {/* Search + Add */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Novo Cliente
              </button>
            </div>

            {/* List */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Nome</span>
                <span>Documento</span>
                <span>Email</span>
                <span>Telefone</span>
                <span className="text-right">Acoes</span>
              </div>
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
                </div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(142,71%,40%)]/10">
                        <Users className="h-4 w-4 text-[hsl(142,71%,40%)]" />
                      </div>
                      <span className="font-medium text-card-foreground">{item.nome}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.documento || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.email || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.telefone || "-"}</span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>{editingItem ? "Atualize os dados do cliente." : "Preencha os dados para cadastrar um novo cliente."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome / Razao Social</Label>
              <Input id="nome" placeholder="Ex: Empresa Alpha" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">CPF / CNPJ</Label>
              <Input id="documento" placeholder="Ex: 11.222.333/0001-44" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="financeiro@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" placeholder="(11) 3000-1111" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingItem ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              {"Tem certeza que deseja excluir "}{deleteConfirm?.nome}{"? Esta acao nao pode ser desfeita."}
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
