"use client"

import { useState, useMemo, useRef } from "react"
import useSWR from "swr"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/client"
import { useTenant, getActiveTenantId } from "@/hooks/use-tenant"
import { Plus, Pencil, Trash2, Copy, Download, Upload, Search, X, Zap } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"

interface MappingRule {
  id: number
  keyword: string
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  fornecedor_id: number | null
  cliente_id: number | null
  cliente_fornecedor: string
  forma_pagamento?: string
  descricao?: string
  substituir_descricao?: boolean
  origem?: string // "ofx" ou "planilha"
  conta_bancaria_id?: number | null
  categoria_nome?: string
  subcategoria_nome?: string
  filho_nome?: string
  fornecedor_nome?: string
  cliente_nome?: string
}

interface CategoriaRow { id: number; nome: string }
interface SubcategoriaRow { id: number; nome: string; categoria_id: number }
interface SubcategoriaFilhoRow { id: number; nome: string; subcategoria_id: number }
interface FornecedorRow { id: number; nome: string }
interface ClienteRow { id: number; nome: string }

// -------- Fetchers --------

async function fetchRules(tid: number | null): Promise<MappingRule[]> {
  const supabase = createClient()
  let query = supabase.from("mapping_rules").select("*").order("keyword")
  if (tid) query = query.eq("tenant_id", tid)
  const { data, error } = await query
  if (error) throw error

  const catIds = [...new Set((data || []).map(r => r.categoria_id).filter(Boolean))]
  const subIds = [...new Set((data || []).map(r => r.subcategoria_id).filter(Boolean))]
  const filhoIds = [...new Set((data || []).map(r => r.subcategoria_filho_id).filter(Boolean))]
  const fornIds = [...new Set((data || []).map(r => r.fornecedor_id).filter(Boolean))]
  const cliIds = [...new Set((data || []).map(r => r.cliente_id).filter(Boolean))]

  const [cats, subs, filhos, forns, clis] = await Promise.all([
    catIds.length ? supabase.from("categorias").select("id,nome").in("id", catIds) : Promise.resolve({ data: [] }),
    subIds.length ? supabase.from("subcategorias").select("id,nome").in("id", subIds) : Promise.resolve({ data: [] }),
    filhoIds.length ? supabase.from("subcategorias_filhos").select("id,nome").in("id", filhoIds) : Promise.resolve({ data: [] }),
    fornIds.length ? supabase.from("fornecedores").select("id,nome").in("id", fornIds) : Promise.resolve({ data: [] }),
    cliIds.length ? supabase.from("clientes").select("id,nome").in("id", cliIds) : Promise.resolve({ data: [] }),
  ])

  const catMap = new Map((cats.data || []).map((c: { id: number; nome: string }) => [c.id, c.nome]))
  const subMap = new Map((subs.data || []).map((s: { id: number; nome: string }) => [s.id, s.nome]))
  const filhoMap = new Map((filhos.data || []).map((f: { id: number; nome: string }) => [f.id, f.nome]))
  const fornMap = new Map((forns.data || []).map((f: { id: number; nome: string }) => [f.id, f.nome]))
  const cliMap = new Map((clis.data || []).map((c: { id: number; nome: string }) => [c.id, c.nome]))

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    keyword: row.keyword as string,
    categoria_id: row.categoria_id as number | null,
    subcategoria_id: row.subcategoria_id as number | null,
    subcategoria_filho_id: row.subcategoria_filho_id as number | null,
    fornecedor_id: (row.fornecedor_id as number | null) || null,
    cliente_id: (row.cliente_id as number | null) || null,
    cliente_fornecedor: (row.cliente_fornecedor as string) || "",
    descricao: (row.descricao as string) || "",
    substituir_descricao: (row.substituir_descricao as boolean) || false,
    forma_pagamento: (row.forma_pagamento as string) || "",
    origem: (row.origem as string) || undefined,
    conta_bancaria_id: (row.conta_bancaria_id as number | null) || null,
    categoria_nome: catMap.get(row.categoria_id as number) || "",
    subcategoria_nome: subMap.get(row.subcategoria_id as number) || "",
    filho_nome: filhoMap.get(row.subcategoria_filho_id as number) || "",
    fornecedor_nome: fornMap.get(row.fornecedor_id as number) || "",
    cliente_nome: cliMap.get(row.cliente_id as number) || "",
  }))
}

async function fetchHierarchy(tid: number | null) {
  const supabase = createClient()
  let catQ = supabase.from("categorias").select("id, nome").order("nome")
  let subQ = supabase.from("subcategorias").select("id, nome, categoria_id").order("nome")
  let filhoQ = supabase.from("subcategorias_filhos").select("id, nome, subcategoria_id").order("nome")
  if (tid) {
    catQ = catQ.eq("tenant_id", tid); subQ = subQ.eq("tenant_id", tid); filhoQ = filhoQ.eq("tenant_id", tid)
  }
  const [c, s, f] = await Promise.all([catQ, subQ, filhoQ])
  return {
    categorias: (c.data || []) as CategoriaRow[],
    subcategorias: (s.data || []) as SubcategoriaRow[],
    filhos: (f.data || []) as SubcategoriaFilhoRow[],
  }
}

async function fetchFornecedores(tid: number | null): Promise<FornecedorRow[]> {
  const supabase = createClient()
  let q = supabase.from("fornecedores").select("id, nome").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return (data || []) as FornecedorRow[]
}

async function fetchClientes(tid: number | null): Promise<ClienteRow[]> {
  const supabase = createClient()
  let q = supabase.from("clientes").select("id, nome").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return (data || []) as ClienteRow[]
}

// Formato de export/import de regras por nome (permite transferir entre clientes)
interface PortableRule {
  keyword: string
  descricao?: string
  categoria_nome?: string
  subcategoria_nome?: string
  subcategoria_filho_nome?: string
  cliente_nome?: string
  fornecedor_nome?: string
  cliente_fornecedor?: string
  forma_pagamento?: string
  substituir_descricao?: boolean
}

export default function RegrasImportacaoPage() {
  const { tenant } = useTenant()
  const tid = tenant?.id || null

  const { data: rules, mutate } = useSWR(["mapping_rules", tid], () => fetchRules(tid))
  const { data: hierarchy } = useSWR(["rules_hier", tid], () => fetchHierarchy(tid))
  const { data: fornecedores } = useSWR(["rules_forn", tid], () => fetchFornecedores(tid))
  const { data: clientes } = useSWR(["rules_clis", tid], () => fetchClientes(tid))

  const allRules = rules || []
  const fornList = fornecedores || []
  const cliList = clientes || []

  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importJson, setImportJson] = useState("")
  const [importPreview, setImportPreview] = useState<PortableRule[]>([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const catOptions = useMemo(
    () => (hierarchy?.categorias || []).map(c => ({ value: c.id.toString(), label: c.nome })),
    [hierarchy]
  )

  const getSubs = (catId: string) =>
    (hierarchy?.subcategorias || [])
      .filter(s => s.categoria_id.toString() === catId)
      .map(s => ({ value: s.id.toString(), label: s.nome }))

  const getFilhos = (subId: string) =>
    (hierarchy?.filhos || [])
      .filter(f => f.subcategoria_id.toString() === subId)
      .map(f => ({ value: f.id.toString(), label: f.nome }))

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return allRules
    return allRules.filter(r =>
      r.keyword.toLowerCase().includes(s) ||
      (r.descricao || "").toLowerCase().includes(s) ||
      (r.categoria_nome || "").toLowerCase().includes(s) ||
      (r.fornecedor_nome || r.cliente_nome || r.cliente_fornecedor || "").toLowerCase().includes(s)
    )
  }, [allRules, search])

  function openNew() {
    setEditingRule({
      id: 0,
      keyword: "",
      categoria_id: null,
      subcategoria_id: null,
      subcategoria_filho_id: null,
      fornecedor_id: null,
      cliente_id: null,
      cliente_fornecedor: "",
      forma_pagamento: "",
      descricao: "",
      substituir_descricao: false,
    })
    setEditDialogOpen(true)
  }

  function openEdit(rule: MappingRule) {
    setEditingRule({ ...rule })
    setEditDialogOpen(true)
  }

  function openClone(rule: MappingRule) {
    setEditingRule({
      ...rule,
      id: 0,
      keyword: rule.keyword + " (copia)",
      descricao: (rule.descricao || "") + " (copia)",
    })
    setEditDialogOpen(true)
  }

  async function deleteRule(id: number) {
    if (!confirm("Excluir esta regra?")) return
    const supabase = createClient()
    await supabase.from("mapping_rules").delete().eq("id", id)
    await mutate()
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`Excluir ${selected.size} regra(s)?`)) return
    const supabase = createClient()
    await supabase.from("mapping_rules").delete().in("id", Array.from(selected))
    setSelected(new Set())
    await mutate()
  }

  async function saveRule() {
    if (!editingRule) return
    if (!editingRule.keyword.trim()) { alert("Palavra-chave obrigatória"); return }
    const activeTid = getActiveTenantId()
    if (!activeTid) { alert("Selecione um cliente"); return }

    const payload = {
      keyword: editingRule.keyword.trim(),
      categoria_id: editingRule.categoria_id || null,
      subcategoria_id: editingRule.subcategoria_id || null,
      subcategoria_filho_id: editingRule.subcategoria_filho_id || null,
      fornecedor_id: editingRule.fornecedor_id || null,
      cliente_id: editingRule.cliente_id || null,
      cliente_fornecedor: editingRule.cliente_fornecedor || "",
      descricao: editingRule.descricao || "",
      substituir_descricao: editingRule.substituir_descricao || false,
      forma_pagamento: editingRule.forma_pagamento || "",
      tenant_id: activeTid,
    }

    const supabase = createClient()
    if (!editingRule.id) {
      const { error } = await supabase.from("mapping_rules").insert(payload)
      if (error) { alert("Erro: " + error.message); return }
    } else {
      const { error } = await supabase.from("mapping_rules").update(payload).eq("id", editingRule.id)
      if (error) { alert("Erro: " + error.message); return }
    }
    setEditDialogOpen(false)
    await mutate()
  }

  // ---- Export em massa ----
  function exportRules(rulesToExport: MappingRule[]) {
    const portable: PortableRule[] = rulesToExport.map(r => ({
      keyword: r.keyword,
      descricao: r.descricao || "",
      categoria_nome: r.categoria_nome || "",
      subcategoria_nome: r.subcategoria_nome || "",
      subcategoria_filho_nome: r.filho_nome || "",
      cliente_nome: r.cliente_nome || "",
      fornecedor_nome: r.fornecedor_nome || "",
      cliente_fornecedor: r.cliente_fornecedor || "",
      forma_pagamento: r.forma_pagamento || "",
      substituir_descricao: r.substituir_descricao || false,
    }))
    const json = JSON.stringify(portable, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const stamp = new Date().toISOString().split("T")[0]
    a.download = `regras-importacao-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportAll() { exportRules(allRules) }
  function exportSelected() {
    const sel = allRules.filter(r => selected.has(r.id))
    if (sel.length === 0) { alert("Nenhuma regra selecionada"); return }
    exportRules(sel)
  }

  // ---- Import em massa ----
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) { alert("Arquivo deve ser um array JSON de regras"); return }
      setImportJson(text)
      setImportPreview(parsed as PortableRule[])
      setImportDialogOpen(true)
    } catch (err) {
      alert("Erro ao ler arquivo: " + (err instanceof Error ? err.message : String(err)))
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function confirmImport() {
    const activeTid = getActiveTenantId()
    if (!activeTid) { alert("Selecione um cliente"); return }
    if (importPreview.length === 0) { alert("Nenhuma regra para importar"); return }

    setImporting(true)
    try {
      const supabase = createClient()

      // Mapeamento por nome => id no tenant atual
      const catByName = new Map((hierarchy?.categorias || []).map(c => [c.nome.toLowerCase(), c.id]))
      const subByName = new Map((hierarchy?.subcategorias || []).map(s => [`${s.categoria_id}:${s.nome.toLowerCase()}`, s.id]))
      const filhoByName = new Map((hierarchy?.filhos || []).map(f => [`${f.subcategoria_id}:${f.nome.toLowerCase()}`, f.id]))
      const fornByName = new Map(fornList.map(f => [f.nome.toLowerCase(), f.id]))
      const cliByName = new Map(cliList.map(c => [c.nome.toLowerCase(), c.id]))

      let inseridas = 0
      let puladas = 0

      for (const p of importPreview) {
        if (!p.keyword?.trim()) { puladas++; continue }

        const catId = p.categoria_nome ? (catByName.get(p.categoria_nome.toLowerCase()) || null) : null
        const subId = catId && p.subcategoria_nome
          ? (subByName.get(`${catId}:${p.subcategoria_nome.toLowerCase()}`) || null) : null
        const filhoId = subId && p.subcategoria_filho_nome
          ? (filhoByName.get(`${subId}:${p.subcategoria_filho_nome.toLowerCase()}`) || null) : null
        const fornId = p.fornecedor_nome ? (fornByName.get(p.fornecedor_nome.toLowerCase()) || null) : null
        const cliId = p.cliente_nome ? (cliByName.get(p.cliente_nome.toLowerCase()) || null) : null

        const payload = {
          keyword: p.keyword.trim(),
          categoria_id: catId,
          subcategoria_id: subId,
          subcategoria_filho_id: filhoId,
          fornecedor_id: fornId,
          cliente_id: cliId,
          cliente_fornecedor: p.cliente_fornecedor || "",
          descricao: p.descricao || "",
          substituir_descricao: p.substituir_descricao || false,
          forma_pagamento: p.forma_pagamento || "",
          tenant_id: activeTid,
        }

        const { error } = await supabase.from("mapping_rules").insert(payload)
        if (error) puladas++
        else inseridas++
      }

      alert(`Importação concluída.\nInseridas: ${inseridas}\nPuladas: ${puladas}`)
      setImportDialogOpen(false)
      setImportJson("")
      setImportPreview([])
      await mutate()
    } finally {
      setImporting(false)
    }
  }

  function toggleSelect(id: number) {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(r => r.id)))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 pl-[72px]">
        <PageHeader title="Regras de Importação" />
        <main className="px-8 py-6 space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openNew}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Nova Regra
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <Upload className="h-4 w-4" /> Importar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={exportAll}
                disabled={allRules.length === 0}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Exportar Todas ({allRules.length})
              </button>
              {selected.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={exportSelected}
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <Download className="h-4 w-4" /> Exportar Selecionadas ({selected.size})
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir ({selected.size})
                  </button>
                </>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar regras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Info */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Zap className="inline h-4 w-4 text-[hsl(38,92%,50%)] mr-1" />
            Quando uma transação do extrato contiver a palavra-chave, será classificada automaticamente.
            O formato de exportação permite reusar as regras em outros clientes (mapeando por <b>nome</b>).
          </div>

          {/* Rules Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Palavra-chave</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente/Fornecedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">F. Pgto</th>
                    <th className="w-32 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                        Nenhuma regra {search ? "encontrada" : "cadastrada"}.
                      </td>
                    </tr>
                  ) : filtered.map(rule => (
                    <tr key={rule.id} className={`group border-b border-border last:border-b-0 transition-colors hover:bg-muted/40 ${selected.has(rule.id) ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(rule.id)}
                          onChange={() => toggleSelect(rule.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-card-foreground">{rule.keyword}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.descricao || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {[rule.categoria_nome, rule.subcategoria_nome, rule.filho_nome].filter(Boolean).join(" > ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rule.fornecedor_nome || rule.cliente_nome || rule.cliente_fornecedor || "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.forma_pagamento || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button type="button" onClick={() => openEdit(rule)} title="Editar"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => openClone(rule)} title="Clonar"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => exportRules([rule])} title="Exportar esta"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteRule(rule.id)} title="Excluir"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingRule?.id ? "Editar Regra" : "Nova Regra"}</DialogTitle>
            <DialogDescription>Configure a palavra-chave e os campos a preencher automaticamente.</DialogDescription>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-medium text-[hsl(0,72%,51%)]">Palavras-chave (separadas por vírgula) *</label>
                <input type="text"
                  value={editingRule.keyword}
                  onChange={(e) => setEditingRule({ ...editingRule, keyword: e.target.value })}
                  className="mt-1 w-full rounded-md border border-primary/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <select
                    value={editingRule.categoria_id?.toString() || ""}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      categoria_id: e.target.value ? Number(e.target.value) : null,
                      subcategoria_id: null, subcategoria_filho_id: null,
                    })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary/50">
                    <option value="">Selecionar...</option>
                    {catOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Subcategoria</label>
                  <select
                    value={editingRule.subcategoria_id?.toString() || ""}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      subcategoria_id: e.target.value ? Number(e.target.value) : null,
                      subcategoria_filho_id: null,
                    })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary/50">
                    <option value="">Selecionar...</option>
                    {getSubs(editingRule.categoria_id?.toString() || "").map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subcategoria Filho</label>
                <select
                  value={editingRule.subcategoria_filho_id?.toString() || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, subcategoria_filho_id: e.target.value ? Number(e.target.value) : null })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary/50">
                  <option value="">Selecionar...</option>
                  {getFilhos(editingRule.subcategoria_id?.toString() || "").map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                  <select
                    value={editingRule.cliente_id?.toString() || ""}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null
                      const sel = cliList.find(c => c.id === id)
                      setEditingRule({ ...editingRule, cliente_id: id, cliente_fornecedor: sel?.nome || editingRule.cliente_fornecedor })
                    }}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary/50">
                    <option value="">Selecionar...</option>
                    {cliList.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Fornecedor</label>
                  <select
                    value={editingRule.fornecedor_id?.toString() || ""}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null
                      const sel = fornList.find(f => f.id === id)
                      setEditingRule({ ...editingRule, fornecedor_id: id, cliente_fornecedor: sel?.nome || editingRule.cliente_fornecedor })
                    }}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary/50">
                    <option value="">Selecionar...</option>
                    {fornList.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição do lançamento</label>
                <input type="text"
                  value={editingRule.descricao || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, descricao: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                  maxLength={200} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Forma de pagamento</label>
                <select
                  value={editingRule.forma_pagamento || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, forma_pagamento: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary/50">
                  <option value="">Selecionar...</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Débito em Conta">Débito em Conta</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={() => setEditDialogOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
            <button type="button" onClick={saveRule}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Salvar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Regras</DialogTitle>
            <DialogDescription>
              {importPreview.length} regra(s) serão importadas para o cliente ativo.
              Categorias/clientes/fornecedores serão vinculados automaticamente por <b>nome</b>.
              Se o nome não existir no cliente atual, o campo ficará em branco.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left text-xs">Palavra-chave</th>
                  <th className="px-3 py-2 text-left text-xs">Categoria</th>
                  <th className="px-3 py-2 text-left text-xs">Cliente/Forn.</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5">{p.keyword}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {[p.categoria_nome, p.subcategoria_nome, p.subcategoria_filho_nome].filter(Boolean).join(" > ") || "-"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {p.fornecedor_nome || p.cliente_nome || p.cliente_fornecedor || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => { setImportDialogOpen(false); setImportPreview([]); setImportJson("") }}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
            <button type="button" onClick={confirmImport} disabled={importing}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {importing ? "Importando..." : `Importar ${importPreview.length}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
