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
  Upload,
  FileSpreadsheet,
  Check,
} from "lucide-react"
import React, { useState, useEffect, useCallback } from "react"
import { parseCSVRaw } from "@/lib/spreadsheet-parser"
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

  // Import
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<{ nome: string; tipo: string; documento: string; email: string; telefone: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const importFileRef = React.useRef<HTMLInputElement>(null)

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

  // ---- Import CSV/XLS ----
  function readFileText(file: File, enc: string): Promise<string> {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target?.result as string); r.onerror = rej; r.readAsText(file, enc) })
  }

  async function handleImportFile(file: File) {
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? ""
      let rawRows: Record<string, string>[] = []
      if (ext === "csv") {
        let content = await readFileText(file, "UTF-8")
        const fl = content.split("\n")[0] || ""
        if (!fl.includes(";") && !fl.includes(",")) content = await readFileText(file, "ISO-8859-1")
        rawRows = parseCSVRaw(content)
      } else if (ext === "xls" || ext === "xlsx") {
        const buffer = await file.arrayBuffer()
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buffer, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" })
        rawRows = jsonRows.map(r => {
          const n: Record<string, string> = {}
          for (const [k, v] of Object.entries(r)) n[k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()] = String(v)
          return n
        })
      } else { alert("Formato nao suportado. Use CSV, XLS ou XLSX."); return }
      const mapped = rawRows.map(row => {
        let nome = "", tipo = "", documento = "", email = "", telefone = ""
        for (const [key, val] of Object.entries(row)) {
          const k = key.trim()
          if (k.includes("nome") || k.includes("razao")) nome = val.trim()
          else if (k.includes("tipo")) tipo = val.trim()
          else if (k.includes("doc") || k.includes("cnpj") || k.includes("cpf")) documento = val.trim()
          else if (k.includes("email") || k.includes("e mail")) email = val.trim()
          else if (k.includes("tel") || k.includes("fone") || k.includes("celular")) telefone = val.trim()
        }
        const tl = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
        const tipoPessoa = (tl.includes("juridica") || tl.includes("pj")) ? "PJ" : "PF"
        return { nome, tipo: tipoPessoa, documento, email, telefone }
      }).filter(r => r.nome.trim())
      setImportRows(mapped)
      setImportResult(null)
    } catch (err) { alert("Erro ao ler arquivo: " + (err instanceof Error ? err.message : String(err))) }
  }

  async function handleImportSave() {
    if (importRows.length === 0) return
    setImporting(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      let created = 0, skipped = 0
      for (const row of importRows) {
        let q = supabase.from("clientes").select("id").ilike("nome", row.nome).limit(1)
        if (tid) q = q.eq("tenant_id", tid)
        const { data: existing } = await q
        if (existing && existing.length > 0) { skipped++; continue }
        const payload: Record<string, unknown> = {
          nome: row.nome, tipo_pessoa: row.tipo, documento: row.documento,
          cnpj: row.tipo === "PJ" ? row.documento : "", email: row.email, telefone: row.telefone,
        }
        if (tid) payload.tenant_id = tid
        await supabase.from("clientes").insert(payload)
        created++
      }
      setImportResult({ created, skipped })
      await mutate()
    } catch (err) { alert("Erro ao importar: " + (err instanceof Error ? err.message : String(err))) }
    finally { setImporting(false) }
  }

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
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setImportRows([]); setImportResult(null); setImportOpen(true) }} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  <Upload className="h-4 w-4" />Importar
                </button>
                <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  <Plus className="h-4 w-4" />Novo Cliente
                </button>
              </div>
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

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Clientes
            </DialogTitle>
            <DialogDescription>
              Importe clientes a partir de um arquivo CSV ou Excel. Colunas: Nome, Tipo, Documento, E-mail, Telefone.
            </DialogDescription>
          </DialogHeader>

          {importRows.length === 0 && !importResult && (
            <div className="space-y-4 py-4">
              <div
                onClick={() => importFileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">Clique para selecionar o arquivo</p>
                <p className="mt-1 text-xs text-muted-foreground">Formatos: .CSV, .XLS, .XLSX</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Colunas: <span className="font-medium text-foreground">Nome</span> | <span className="font-medium text-foreground">Tipo</span> | <span className="font-medium text-foreground">Documento</span> | <span className="font-medium text-foreground">E-mail</span> | <span className="font-medium text-foreground">Telefone</span>
                </p>
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); if (e.target) e.target.value = "" }}
              />
            </div>
          )}

          {importRows.length > 0 && !importResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {importRows.length} {importRows.length === 1 ? "cliente encontrado" : "clientes encontrados"}
                </p>
                <button type="button" onClick={() => setImportRows([])} className="text-xs text-muted-foreground hover:text-foreground">Trocar arquivo</button>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Documento</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">E-mail</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-foreground">{row.nome}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.tipo === "PJ" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" : "bg-[hsl(216,60%,22%)]/10 text-[hsl(216,60%,22%)]"}`}>
                            {row.tipo === "PJ" ? "Pessoa Juridica" : "Pessoa Fisica"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.documento || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.email || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.telefone || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <button type="button" onClick={() => setImportOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
                <button type="button" onClick={handleImportSave} disabled={importing} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? "Importando..." : `Importar ${importRows.length} clientes`}
                </button>
              </DialogFooter>
            </div>
          )}

          {importResult && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-[hsl(142,71%,40%)]/5 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]/10">
                  <Check className="h-6 w-6 text-[hsl(142,71%,40%)]" />
                </div>
                <p className="text-sm font-semibold text-foreground">Importacao concluida</p>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span><strong className="text-foreground">{importResult.created}</strong> clientes criados</span>
                  {importResult.skipped > 0 && <span><strong className="text-foreground">{importResult.skipped}</strong> ja existentes</span>}
                </div>
              </div>
              <DialogFooter>
                <button type="button" onClick={() => setImportOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Fechar</button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
