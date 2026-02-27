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
  Building2,
  User,
  RefreshCw,
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
import { getActiveTenantId } from "@/hooks/use-tenant"
import useSWR from "swr"

interface Cliente {
  id: number
  nome: string
  documento: string
  email: string
  telefone: string
  cnpj: string
  tipo_pessoa: string
}

async function fetchClientes(): Promise<Cliente[]> {
  const supabase = createClient()
  const tid = getActiveTenantId()
  let q = supabase.from("clientes").select("*").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((r) => ({
    id: r.id,
    nome: r.nome,
    documento: r.documento || "",
    email: r.email || "",
    telefone: r.telefone || "",
    cnpj: r.cnpj || "",
    tipo_pessoa: r.tipo_pessoa || "PF",
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

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

const emptyForm = { nome: "", documento: "", email: "", telefone: "", cnpj: "", tipo_pessoa: "PF" }

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
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState("")

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
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.cnpj || "").toLowerCase().includes(search.toLowerCase())
  )

  async function buscarCNPJ() {
    const cnpjDigits = form.cnpj.replace(/\D/g, "")
    if (cnpjDigits.length !== 14) {
      setCnpjError("CNPJ deve ter 14 digitos")
      return
    }
    setCnpjLoading(true)
    setCnpjError("")
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`)
      if (!res.ok) throw new Error("CNPJ nao encontrado")
      const data = await res.json()
      setForm((prev) => ({
        ...prev,
        nome: data.razao_social || prev.nome,
        documento: formatCNPJ(cnpjDigits),
        email: data.email || prev.email,
        telefone: data.ddd_telefone_1
          ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}`
          : prev.telefone,
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
      documento: item.documento,
      email: item.email,
      telefone: item.telefone,
      cnpj: item.cnpj || "",
      tipo_pessoa: item.tipo_pessoa || "PF",
    })
    setCnpjError("")
    setDialogOpen(true)
  }

  const handleSave = useCallback(async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      const payload: Record<string, unknown> = {
        nome: form.nome, documento: form.documento, email: form.email,
        telefone: form.telefone, cnpj: form.cnpj, tipo_pessoa: form.tipo_pessoa,
      }
      if (tid) payload.tenant_id = tid
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
    const supabase = createClient()
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
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pessoa Juridica</p>
                  <p className="text-xl font-bold text-card-foreground">{clientes.filter((c) => c.tipo_pessoa === "PJ").length}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,20%,60%)]">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pessoa Fisica</p>
                  <p className="text-xl font-bold text-card-foreground">{clientes.filter((c) => c.tipo_pessoa !== "PJ").length}</p>
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
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Tipo</span>
                <span>Nome</span>
                <span>CNPJ / CPF</span>
                <span>Email</span>
                <span>Telefone</span>
                <span>Doc.</span>
                <span className="text-right">Acoes</span>
              </div>
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
                </div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.tipo_pessoa === "PJ" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" : "bg-[hsl(216,60%,22%)]/10 text-[hsl(216,60%,22%)]"}`}>
                      {item.tipo_pessoa || "PF"}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(142,71%,40%)]/10">
                        <Users className="h-4 w-4 text-[hsl(142,71%,40%)]" />
                      </div>
                      <span className="font-medium text-card-foreground">{item.nome}</span>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">{item.cnpj || item.documento || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.email || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.telefone || "-"}</span>
                    <span className="text-sm text-muted-foreground">{item.documento || "-"}</span>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>{editingItem ? "Atualize os dados do cliente." : "Preencha os dados para cadastrar um novo cliente."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tipo Pessoa */}
            <div className="space-y-2">
              <Label>Tipo de Pessoa</Label>
              <div className="flex gap-2">
                {(["PF", "PJ"] as const).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setForm({ ...form, tipo_pessoa: tipo, cnpj: "" })}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${form.tipo_pessoa === tipo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    {tipo === "PF" ? "Pessoa Fisica" : "Pessoa Juridica"}
                  </button>
                ))}
              </div>
            </div>

            {/* CNPJ lookup - apenas PJ */}
            {form.tipo_pessoa === "PJ" && (
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
                <p className="text-xs text-muted-foreground">Preencha o CNPJ e clique em Buscar para auto-preencher os dados.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nome">Nome {form.tipo_pessoa === "PJ" ? "/ Razao Social" : ""}</Label>
              <Input id="nome" placeholder={form.tipo_pessoa === "PJ" ? "Ex: Empresa Alpha Ltda" : "Ex: Joao da Silva"} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento">{form.tipo_pessoa === "PJ" ? "CNPJ (documento fiscal)" : "CPF"}</Label>
              <Input
                id="documento"
                placeholder={form.tipo_pessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: form.tipo_pessoa === "PJ" ? formatCNPJ(e.target.value) : formatCPF(e.target.value) })}
                className="font-mono"
              />
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
