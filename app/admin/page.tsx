"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  LogIn,
  RefreshCw,
  X,
} from "lucide-react"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/hooks/use-tenant"
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
  cnpj: string
  email: string
  telefone: string
  responsavel: string
  ativo: boolean
  created_at: string
  observacoes: string
}

async function fetchClientesAdmin(): Promise<Cliente[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("clientes_admin").select("*").order("nome")
  if (error) throw error
  return (data || []).map((r) => ({
    id: r.id,
    nome: r.nome,
    cnpj: r.cnpj || "",
    email: r.email || "",
    telefone: r.telefone || "",
    responsavel: r.responsavel || "",
    ativo: r.ativo ?? true,
    created_at: r.created_at,
    observacoes: r.observacoes || "",
  }))
}

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

const emptyForm = {
  nome: "",
  cnpj: "",
  email: "",
  telefone: "",
  responsavel: "",
  ativo: true,
  observacoes: "",
}

export default function AdminPage() {
  const { data: clientes = [], mutate, isLoading } = useSWR("clientes_admin", fetchClientesAdmin)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Cliente | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Cliente | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState("")
  const [filterAtivo, setFilterAtivo] = useState<"Todos" | "Ativo" | "Inativo">("Todos")
  const router = useRouter()
  const { tenant, setTenant, clearTenant } = useTenant()

  function acessarCliente(item: Cliente) {
    setTenant({ id: item.id, nome: item.nome, cnpj: item.cnpj })
    router.push("/")
  }

  const filtered = clientes
    .filter((c) =>
      (c.nome.toLowerCase().includes(search.toLowerCase()) ||
        c.cnpj.includes(search) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.responsavel.toLowerCase().includes(search.toLowerCase())) &&
      (filterAtivo === "Todos" || (filterAtivo === "Ativo" ? c.ativo : !c.ativo))
    )

  const totalAtivos = clientes.filter((c) => c.ativo).length
  const totalInativos = clientes.filter((c) => !c.ativo).length

  async function buscarCNPJ() {
    const cnpjDigits = form.cnpj.replace(/\D/g, "")
    if (cnpjDigits.length !== 14) { setCnpjError("CNPJ deve ter 14 digitos"); return }
    setCnpjLoading(true)
    setCnpjError("")
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`)
      if (!res.ok) throw new Error("CNPJ nao encontrado")
      const data = await res.json()
      setForm((prev) => ({
        ...prev,
        nome: data.razao_social || prev.nome,
        email: data.email || prev.email,
        telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.telefone,
      }))
    } catch {
      setCnpjError("CNPJ nao encontrado ou servico indisponivel")
    } finally {
      setCnpjLoading(false)
    }
  }

  function openNew() {
    setEditingItem(null)
    setForm(emptyForm)
    setCnpjError("")
    setDialogOpen(true)
  }

  function openEdit(item: Cliente) {
    setEditingItem(item)
    setForm({
      nome: item.nome,
      cnpj: item.cnpj,
      email: item.email,
      telefone: item.telefone,
      responsavel: item.responsavel,
      ativo: item.ativo,
      observacoes: item.observacoes,
    })
    setCnpjError("")
    setDialogOpen(true)
  }

  const handleSave = useCallback(async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        nome: form.nome,
        cnpj: form.cnpj,
        email: form.email,
        telefone: form.telefone,
        responsavel: form.responsavel,
        ativo: form.ativo,
        observacoes: form.observacoes,
      }
      if (editingItem) {
        await supabase.from("clientes_admin").update(payload).eq("id", editingItem.id)
      } else {
        await supabase.from("clientes_admin").insert(payload)
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }, [form, editingItem, mutate])

  const handleDelete = useCallback(async (item: Cliente) => {
    const supabase = createClient()
    await supabase.from("clientes_admin").delete().eq("id", item.id)
    await mutate()
    setDeleteConfirm(null)
  }, [mutate])

  async function toggleAtivo(item: Cliente) {
    const supabase = createClient()
    await supabase.from("clientes_admin").update({ ativo: !item.ativo }).eq("id", item.id)
    await mutate()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="ml-[72px] flex flex-1 flex-col">
          <PageHeader title="Admin - Clientes BPO" />
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
        <PageHeader title="Admin - Clientes BPO" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Admin Banner */}
            <div className="flex items-center gap-3 rounded-xl border border-[hsl(216,60%,22%)]/30 bg-[hsl(216,60%,22%)]/10 px-5 py-4">
              <Shield className="h-5 w-5 text-[hsl(216,60%,50%)]" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[hsl(216,60%,50%)]">Painel Administrativo</p>
                <p className="text-xs text-muted-foreground">Gerencie todos os clientes do sistema BPO Financeiro MAJO.</p>
              </div>
              {tenant && (
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-[hsl(142,71%,40%)]/30 bg-[hsl(142,71%,40%)]/10 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Cliente ativo</p>
                    <p className="text-sm font-semibold text-[hsl(142,71%,40%)]">{tenant.nome}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearTenant}
                    title="Sair do cliente"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                  <p className="text-xl font-bold text-card-foreground">{clientes.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                  <p className="text-xl font-bold text-[hsl(142,71%,40%)]">{totalAtivos}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(0,72%,51%)]">
                  <XCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clientes Inativos</p>
                  <p className="text-xl font-bold text-muted-foreground">{totalInativos}</p>
                </div>
              </div>
            </div>

            {/* Search + Filters + Add */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-64" />
                </div>
                <div className="flex items-center rounded-lg border border-border bg-card">
                  {(["Todos", "Ativo", "Inativo"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setFilterAtivo(s)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterAtivo === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Novo Cliente
              </button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Status</span>
                <span>Nome / Empresa</span>
                <span>CNPJ</span>
                <span>Responsavel</span>
                <span>Email</span>
                <span>Cadastro</span>
                <span className="text-right">Acoes</span>
              </div>
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
                </div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                    <button type="button" onClick={() => toggleAtivo(item)} title={item.ativo ? "Clique para desativar" : "Clique para ativar"}>
                      {item.ativo ? (
                        <CheckCircle2 className="h-5 w-5 text-[hsl(142,71%,40%)]" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(216,60%,22%)]/10">
                        <Building2 className="h-4 w-4 text-[hsl(216,60%,22%)]" />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">{item.nome}</p>
                        {item.observacoes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.observacoes}</p>}
                      </div>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">{item.cnpj || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.responsavel || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.email || "-"}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString("pt-BR") : "-"}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => acessarCliente(item)}
                        title="Acessar como este cliente"
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                          tenant?.id === item.id
                            ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)] border border-[hsl(142,71%,40%)]/30"
                            : "border border-border text-muted-foreground hover:bg-primary hover:text-primary-foreground opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        {tenant?.id === item.id ? "Ativo" : "Acessar"}
                      </button>
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
            <DialogTitle>{editingItem ? "Editar Cliente" : "Novo Cliente BPO"}</DialogTitle>
            <DialogDescription>{editingItem ? "Atualize os dados do cliente." : "Cadastre um novo cliente no sistema MAJO BPO."}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-4 py-2">
            {/* CNPJ lookup */}
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) => { setCnpjError(""); setForm({ ...form, cnpj: formatCNPJ(e.target.value) }) }}
                  className="font-mono"
                />
                <button
                  type="button"
                  onClick={buscarCNPJ}
                  disabled={cnpjLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-[hsl(216,60%,22%)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[hsl(216,60%,18%)] disabled:opacity-50 shrink-0"
                >
                  {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Buscar
                </button>
              </div>
              {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome / Razao Social</Label>
              <Input id="nome" placeholder="Ex: Empresa Alpha Ltda" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsavel</Label>
              <Input id="responsavel" placeholder="Nome do responsavel financeiro" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="financeiro@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" placeholder="(31) 3333-1234" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Input id="observacoes" placeholder="Notas internas..." value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <input
                type="checkbox"
                id="ativo"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="ativo" className="cursor-pointer">Cliente ativo</Label>
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
