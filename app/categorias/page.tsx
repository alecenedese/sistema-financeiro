"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  Tags, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Loader2,
  X, ArrowRight, ReceiptText, CalendarClock, FileText, BarChart3,
  Upload, FileSpreadsheet, Check, AlertCircle
} from "lucide-react"
import { parseCSVRaw } from "@/lib/spreadsheet-parser"
import { getActiveTenantId, useTenant } from "@/hooks/use-tenant"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ---- Grupos DRE ----
export const GRUPOS_DRE = [
  { value: "receita_bruta",       label: "Receita Operacional Bruta",            tipo: "Receita" },
  { value: "deducoes_receita",    label: "Deducoes de Receita Bruta (-)",         tipo: "Receita" },
  { value: "custo_direto",        label: "Custo Direto de Vendas (-)",            tipo: "Despesa" },
  { value: "despesas_operacionais",label: "Despesas Operacionais e Adm. (-)",    tipo: "Despesa" },
  { value: "outras_receitas",     label: "Outras Receitas Nao Operacionais",      tipo: "Receita" },
  { value: "outras_despesas",     label: "Outras Despesas Nao Operacionais (-)",  tipo: "Despesa" },
  { value: "ir_csll",             label: "IR / CSLL (-)",                         tipo: "Despesa" },
]

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
  grupo_dre: string | null
  subcategorias: Subcategoria[]
}

interface DrillItem {
  id: number
  descricao: string
  valor: number
  data: string
  tipo: string
  origem: "lancamento" | "despesa_fixa" | "conta"
  status?: string
}

const COLORS = ["#1B3A5C", "#2C5F8A", "#7A8FA6", "#A8B8C8", "#3D7AB5", "#C4CFD9"]

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}
function formatDate(s: string) {
  if (!s) return "-"
  const [y, m, d] = s.split("-")
  return `${d}/${m}/${y}`
}

async function fetchCategorias([, tid]: [string, number | null]): Promise<Categoria[]> {
  const supabase = createClient()
  let catQ = supabase.from("categorias").select("*").order("nome")
  let subQ = supabase.from("subcategorias").select("*").order("nome")
  let filhoQ = supabase.from("subcategorias_filhos").select("*").order("nome")
  if (tid) { catQ = catQ.eq("tenant_id", tid); subQ = subQ.eq("tenant_id", tid); filhoQ = filhoQ.eq("tenant_id", tid) }
  const [{ data: cats }, { data: subs }, { data: filhos }] = await Promise.all([catQ, subQ, filhoQ])

  const filhosBySub: Record<number, SubcategoriaFilho[]> = {}
  for (const f of filhos || []) {
    if (!filhosBySub[f.subcategoria_id]) filhosBySub[f.subcategoria_id] = []
    filhosBySub[f.subcategoria_id].push(f)
  }
  const subsByCat: Record<number, Subcategoria[]> = {}
  for (const s of subs || []) {
    if (!subsByCat[s.categoria_id]) subsByCat[s.categoria_id] = []
    subsByCat[s.categoria_id].push({ ...s, filhos: filhosBySub[s.id] || [] })
  }
  return (cats || []).map((c) => ({ ...c, grupo_dre: c.grupo_dre || null, subcategorias: subsByCat[c.id] || [] }))
}

async function fetchDrillItems(categoriaId: number): Promise<DrillItem[]> {
  const supabase = createClient()
  const tid = getActiveTenantId()
  let lancQ = supabase.from("lancamentos").select("id,descricao,valor,data,tipo,status").eq("categoria_id", categoriaId).order("data", { ascending: false }).limit(50)
  let fixaQ = supabase.from("despesas_fixas").select("id,descricao,valor,ativa").eq("categoria_id", categoriaId).order("descricao")
  let contaQ = supabase.from("contas_a_pagar").select("id,descricao,valor,data_vencimento,status").eq("categoria_id", categoriaId).order("data_vencimento", { ascending: false }).limit(30)
  if (tid) { lancQ = lancQ.eq("tenant_id", tid); fixaQ = fixaQ.eq("tenant_id", tid); contaQ = contaQ.eq("tenant_id", tid) }
  const [{ data: lancs }, { data: fixas }, { data: contas }] = await Promise.all([lancQ, fixaQ, contaQ])
  const items: DrillItem[] = []
  for (const l of lancs || []) items.push({ id: l.id, descricao: l.descricao, valor: Number(l.valor), data: l.data, tipo: l.tipo, status: l.status, origem: "lancamento" })
  for (const f of fixas || []) items.push({ id: f.id, descricao: f.descricao, valor: Number(f.valor), data: "", tipo: "despesa", status: f.ativa ? "ativa" : "inativa", origem: "despesa_fixa" })
  for (const c of contas || []) items.push({ id: c.id, descricao: c.descricao, valor: Number(c.valor), data: c.data_vencimento, tipo: "despesa", status: c.status, origem: "conta" })
  return items
}

type DialogMode = "categoria" | "subcategoria" | "subcategoria-filho"
type DrillTab = "lancamentos" | "despesas_fixas" | "contas"

export default function CategoriasPageWrapper() {
  return <Suspense><CategoriasPage /></Suspense>
}

function CategoriasPage() {
  const { tenant } = useTenant()
  const tid = tenant?.id ?? null
  const { data: categorias, error, isLoading, mutate } = useSWR(["categorias", tid], fetchCategorias)

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "cat" | "sub" | "filho"; catId: number; subId?: number; filhoId?: number; nome: string } | null>(null)

  // Form
  const [formNome, setFormNome] = useState("")
  const [formTipo, setFormTipo] = useState<"Receita" | "Despesa">("Despesa")
  const [formGrupoDre, setFormGrupoDre] = useState<string>("")

  // Drill-down panel
  const [drillCat, setDrillCat] = useState<Categoria | null>(null)
  const [drillTab, setDrillTab] = useState<DrillTab>("lancamentos")
  const [drillItems, setDrillItems] = useState<DrillItem[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<{ nome: string; tipo: string; subcategoria: string; subFilho: string; grupoDre: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const importFileRef = React.useRef<HTMLInputElement>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  const openNewCategoria = useCallback(() => {
    setDialogMode("categoria")
    setEditingCat(null)
    setFormNome("")
    setFormTipo("Despesa")
    setFormGrupoDre("")
    setDialogOpen(true)
  }, [])

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      openNewCategoria()
      router.replace("/categorias")
    }
  }, [searchParams, router, openNewCategoria])

  async function openDrill(cat: Categoria) {
    setDrillCat(cat)
    setDrillTab("lancamentos")
    setDrillLoading(true)
    setDrillItems([])
    try {
      const items = await fetchDrillItems(cat.id)
      setDrillItems(items)
    } finally {
      setDrillLoading(false)
    }
  }

  function toggleExpand(id: number) {
    setExpandedCats((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleExpandSub(id: number) {
    setExpandedSubs((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filtered = filterTipo === "Todos" ? (categorias || []) : (categorias || []).filter((c) => c.tipo === filterTipo)

  // Categoria CRUD
  function openEditCategoria(cat: Categoria) {
    setDialogMode("categoria")
    setEditingCat(cat)
    setFormNome(cat.nome)
    setFormTipo(cat.tipo)
    setFormGrupoDre(cat.grupo_dre || "")
    setDialogOpen(true)
  }

  async function handleSaveCategoria() {
    if (!formNome.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      const payload: Record<string, unknown> = { nome: formNome, tipo: formTipo, grupo_dre: formGrupoDre || null }
      if (tid) payload.tenant_id = tid
      if (editingCat) {
        await supabase.from("categorias").update(payload).eq("id", editingCat.id)
      } else {
        await supabase.from("categorias").insert({ ...payload, cor: COLORS[(categorias?.length || 0) % COLORS.length] })
      }
      await mutate()
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Subcategoria CRUD
  function openNewSubcategoria(catId: number) {
    setDialogMode("subcategoria"); setEditingSub(null); setParentCatId(catId); setFormNome(""); setDialogOpen(true)
  }
  function openEditSubcategoria(catId: number, sub: Subcategoria) {
    setDialogMode("subcategoria"); setEditingSub({ catId, sub }); setParentCatId(catId); setFormNome(sub.nome); setDialogOpen(true)
  }
  async function handleSaveSubcategoria() {
    if (!formNome.trim() || !parentCatId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      if (editingSub) {
        await supabase.from("subcategorias").update({ nome: formNome }).eq("id", editingSub.sub.id)
      } else {
        const p: Record<string, unknown> = { nome: formNome, categoria_id: parentCatId }
        if (tid) p.tenant_id = tid
        await supabase.from("subcategorias").insert(p)
      }
      await mutate(); setDialogOpen(false)
    } finally { setSaving(false) }
  }

  // Filho CRUD
  function openNewFilho(catId: number, subId: number) {
    setDialogMode("subcategoria-filho"); setEditingFilho(null); setParentCatId(catId); setParentSubId(subId); setFormNome(""); setDialogOpen(true)
  }
  function openEditFilho(catId: number, subId: number, filho: SubcategoriaFilho) {
    setDialogMode("subcategoria-filho"); setEditingFilho({ catId, subId, filho }); setParentCatId(catId); setParentSubId(subId); setFormNome(filho.nome); setDialogOpen(true)
  }
  async function handleSaveFilho() {
    if (!formNome.trim() || !parentSubId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      if (editingFilho) {
        await supabase.from("subcategorias_filhos").update({ nome: formNome }).eq("id", editingFilho.filho.id)
      } else {
        const p: Record<string, unknown> = { nome: formNome, subcategoria_id: parentSubId }
        if (tid) p.tenant_id = tid
        await supabase.from("subcategorias_filhos").insert(p)
      }
      await mutate(); setDialogOpen(false)
    } finally { setSaving(false) }
  }

  // ---- Import CSV/XLS ----
  function readFile(file: File, encoding: string): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => res(e.target?.result as string)
      r.onerror = rej
      r.readAsText(file, encoding)
    })
  }

  async function handleImportFile(file: File) {
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? ""
      let rawRows: Record<string, string>[] = []

      if (ext === "csv") {
        let content = await readFile(file, "UTF-8")
        const firstLine = content.split("\n")[0] || ""
        if (!firstLine.includes(";") && !firstLine.includes(",")) {
          content = await readFile(file, "ISO-8859-1")
        }
        rawRows = parseCSVRaw(content)
      } else if (ext === "xls" || ext === "xlsx") {
        const buffer = await file.arrayBuffer()
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buffer, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" })
        // Normaliza headers do XLS
        rawRows = jsonRows.map(r => {
          const norm: Record<string, string> = {}
          for (const [key, val] of Object.entries(r)) {
            const k = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
            norm[k] = String(val)
          }
          return norm
        })
      } else {
        alert("Formato nao suportado. Use CSV, XLS ou XLSX.")
        return
      }

      // Mapeia colunas para campos esperados
      const mapped = rawRows.map(row => mapImportRow(row)).filter(r => r.nome.trim())
      setImportRows(mapped)
      setImportResult(null)
    } catch (err) {
      alert("Erro ao ler arquivo: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  function mapImportRow(row: Record<string, string>): { nome: string; tipo: string; subcategoria: string; subFilho: string; grupoDre: string } {
    let nome = "", tipo = "", subcategoria = "", subFilho = "", grupoDre = ""
    for (const [key, val] of Object.entries(row)) {
      const k = key.trim()
      // Nome / Categoria (primeira coluna que contem "nome" ou "categ" mas NAO "sub")
      if ((k.includes("nome") || (k.includes("categ") && !k.includes("sub"))) && !nome) nome = val.trim()
      // Tipo
      else if (k.includes("tipo") && !tipo) tipo = val.trim()
      // Sub-filho (precisa vir antes de "sub" generico)
      else if ((k.includes("sub") && k.includes("filho")) || k === "sub filho") subFilho = val.trim()
      // Subcategoria
      else if (k.includes("sub") && !subFilho) subcategoria = val.trim()
      // Grupo DRE
      else if (k.includes("grupo") || k.includes("dre")) grupoDre = val.trim()
    }
    return { nome, tipo: normalizeTipo(tipo), subcategoria, subFilho, grupoDre }
  }

  function normalizeTipo(t: string): string {
    const lower = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    if (lower.includes("receita") || lower.includes("entrada")) return "Receita"
    if (lower.includes("despesa") || lower.includes("saida") || lower.includes("custo")) return "Despesa"
    return "Despesa"
  }

  function matchGrupoDre(nome: string): string {
    if (!nome) return ""
    const lower = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    const match = GRUPOS_DRE.find(g => {
      const gl = g.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
      return gl.includes(lower) || lower.includes(gl) || gl === lower
    })
    return match?.value || ""
  }

  async function handleImportSave() {
    if (importRows.length === 0) return
    setImporting(true)
    try {
      const supabase = createClient()
      const tenantId = getActiveTenantId()
      let created = 0
      let skipped = 0

      // Agrupar por categoria
      const catMap = new Map<string, typeof importRows>()
      for (const row of importRows) {
        const key = row.nome.toLowerCase()
        if (!catMap.has(key)) catMap.set(key, [])
        catMap.get(key)!.push(row)
      }

      for (const [, rows] of catMap) {
        const first = rows[0]
        // Verifica se categoria ja existe
        let catQuery = supabase.from("categorias").select("id").eq("nome", first.nome).limit(1)
        if (tenantId) catQuery = catQuery.eq("tenant_id", tenantId)
        const { data: existingCats } = await catQuery
        let catId: number

        if (existingCats && existingCats.length > 0) {
          catId = existingCats[0].id
          skipped++
        } else {
          const grupoDre = matchGrupoDre(first.grupoDre) || null
          const payload: Record<string, unknown> = {
            nome: first.nome,
            tipo: first.tipo || "Despesa",
            grupo_dre: grupoDre,
            cor: COLORS[(categorias?.length || 0 + created) % COLORS.length],
          }
          if (tenantId) payload.tenant_id = tenantId
          const { data: newCat } = await supabase.from("categorias").insert(payload).select("id").single()
          if (!newCat) continue
          catId = newCat.id
          created++
        }

        // Processar subcategorias
        const subMap = new Map<string, typeof rows>()
        for (const row of rows) {
          if (!row.subcategoria) continue
          const key = row.subcategoria.toLowerCase()
          if (!subMap.has(key)) subMap.set(key, [])
          subMap.get(key)!.push(row)
        }

        for (const [, subRows] of subMap) {
          const subFirst = subRows[0]
          let subQuery = supabase.from("subcategorias").select("id").eq("nome", subFirst.subcategoria).eq("categoria_id", catId).limit(1)
          if (tenantId) subQuery = subQuery.eq("tenant_id", tenantId)
          const { data: existingSubs } = await subQuery
          let subId: number

          if (existingSubs && existingSubs.length > 0) {
            subId = existingSubs[0].id
          } else {
            const subPayload: Record<string, unknown> = { nome: subFirst.subcategoria, categoria_id: catId }
            if (tenantId) subPayload.tenant_id = tenantId
            const { data: newSub } = await supabase.from("subcategorias").insert(subPayload).select("id").single()
            if (!newSub) continue
            subId = newSub.id
          }

          // Processar sub-filhos
          for (const row of subRows) {
            if (!row.subFilho) continue
            let filhoQuery = supabase.from("subcategorias_filhos").select("id").eq("nome", row.subFilho).eq("subcategoria_id", subId).limit(1)
            if (tenantId) filhoQuery = filhoQuery.eq("tenant_id", tenantId)
            const { data: existingFilhos } = await filhoQuery
            if (existingFilhos && existingFilhos.length > 0) continue
            const filhoPayload: Record<string, unknown> = { nome: row.subFilho, subcategoria_id: subId }
            if (tenantId) filhoPayload.tenant_id = tenantId
            await supabase.from("subcategorias_filhos").insert(filhoPayload)
          }
        }
      }

      setImportResult({ created, skipped })
      await mutate()
    } catch (err) {
      alert("Erro ao importar: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setSaving(true)
    try {
      const supabase = createClient()
      if (deleteConfirm.type === "cat") await supabase.from("categorias").delete().eq("id", deleteConfirm.catId)
      else if (deleteConfirm.type === "sub") await supabase.from("subcategorias").delete().eq("id", deleteConfirm.subId!)
      else await supabase.from("subcategorias_filhos").delete().eq("id", deleteConfirm.filhoId!)
      await mutate(); setDeleteConfirm(null)
    } finally { setSaving(false) }
  }

  function handleSave() {
    if (dialogMode === "categoria") return handleSaveCategoria()
    if (dialogMode === "subcategoria") return handleSaveSubcategoria()
    return handleSaveFilho()
  }

  const drillLancamentos = drillItems.filter((i) => i.origem === "lancamento")
  const drillFixas = drillItems.filter((i) => i.origem === "despesa_fixa")
  const drillContas = drillItems.filter((i) => i.origem === "conta")
  const drillTabItems = drillTab === "lancamentos" ? drillLancamentos : drillTab === "despesas_fixas" ? drillFixas : drillContas
  const grupoDreLabel = drillCat?.grupo_dre ? GRUPOS_DRE.find(g => g.value === drillCat.grupo_dre)?.label : null

  const tabsConfig: { key: DrillTab; label: string; count: number; Icon: typeof ReceiptText }[] = [
    { key: "lancamentos", label: "Lancamentos", count: drillLancamentos.length, Icon: ReceiptText },
    { key: "despesas_fixas", label: "Despesas Fixas", count: drillFixas.length, Icon: CalendarClock },
    { key: "contas", label: "Contas", count: drillContas.length, Icon: FileText },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Categorias" />
        <main className="flex flex-1 overflow-hidden">
          {/* List */}
          <div className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ${drillCat ? "xl:pr-3" : ""}`}>
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Top bar */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Organize suas transacoes com categorias, subcategorias e grupos DRE.</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-border bg-card">
                    {(["Todos", "Receita", "Despesa"] as const).map((tipo) => (
                      <button key={tipo} type="button" onClick={() => setFilterTipo(tipo)}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterTipo === tipo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        {tipo}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => { setImportRows([]); setImportResult(null); setImportOpen(true) }} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                    <Upload className="h-4 w-4" />Importar
                  </button>
                  <button type="button" onClick={openNewCategoria} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                    <Plus className="h-4 w-4" />Nova Categoria
                  </button>
                </div>
              </div>

              {isLoading && <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="ml-2 text-sm text-muted-foreground">Carregando...</span></div>}
              {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"><p className="text-sm text-destructive">Erro ao carregar. <button type="button" onClick={() => mutate()} className="font-medium text-primary underline">Recarregar</button></p></div>}

              {!isLoading && !error && (
                <div className="space-y-3">
                  {filtered.map((cat) => {
                    const isExpanded = expandedCats.has(cat.id)
                    const grupoDre = GRUPOS_DRE.find(g => g.value === cat.grupo_dre)
                    const isActive = drillCat?.id === cat.id
                    return (
                      <div key={cat.id} className={`rounded-xl border bg-card shadow-sm transition-all ${isActive ? "border-primary/40 shadow-md" : "border-border hover:shadow-md"}`}>
                        <div className="flex w-full items-center gap-4 p-5">
                          <button type="button" onClick={() => toggleExpand(cat.id)} className="flex flex-1 items-center gap-4 text-left">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${cat.cor}18` }}>
                              <Tags className="h-5 w-5" style={{ color: cat.cor }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-card-foreground">{cat.nome}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.tipo === "Receita" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" : "bg-[hsl(0,72%,51%)]/10 text-[hsl(0,72%,51%)]"}`}>{cat.tipo}</span>
                                {grupoDre && (
                                  <span className="rounded-full border border-[hsl(216,60%,50%)]/30 bg-[hsl(216,60%,50%)]/10 px-2 py-0.5 text-[10px] font-medium text-[hsl(216,60%,50%)]">
                                    DRE: {grupoDre.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{cat.subcategorias.length} subcategorias</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => isActive ? setDrillCat(null) : openDrill(cat)}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"}`}>
                              <BarChart3 className="h-3.5 w-3.5" />
                              {isActive ? "Fechar" : "Ver"}
                            </button>
                            <button type="button" onClick={() => openEditCategoria(cat)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setDeleteConfirm({ type: "cat", catId: cat.id, nome: cat.nome })} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => toggleExpand(cat.id)} className="text-muted-foreground">
                              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border px-5 py-3">
                            <div className="flex items-center justify-between pb-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subcategorias</span>
                              <button type="button" onClick={() => openNewSubcategoria(cat.id)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="h-3 w-3" />Adicionar</button>
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
                                      <span className="flex-1 text-sm text-card-foreground">{sub.nome}</span>
                                      {sub.filhos.length > 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{sub.filhos.length}</span>}
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => openNewFilho(cat.id, sub.id)} className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Plus className="h-3 w-3" /></button>
                                        <button type="button" onClick={() => openEditSubcategoria(cat.id, sub)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                                        <button type="button" onClick={() => setDeleteConfirm({ type: "sub", catId: cat.id, subId: sub.id, nome: sub.nome })} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                                      </div>
                                    </div>
                                    {isSubExpanded && sub.filhos.length > 0 && (
                                      <div className="ml-6 border-l-2 border-border pl-4 mt-1 mb-1">
                                        {sub.filhos.map((filho) => (
                                          <div key={filho.id} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted">
                                            <div className="h-1.5 w-1.5 shrink-0 rounded-full border border-current opacity-40" style={{ color: cat.cor }} />
                                            <span className="flex-1 text-sm">{filho.nome}</span>
                                            <div className="flex items-center gap-1">
                                              <button type="button" onClick={() => openEditFilho(cat.id, sub.id, filho)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                                              <button type="button" onClick={() => setDeleteConfirm({ type: "filho", catId: cat.id, subId: sub.id, filhoId: filho.id, nome: filho.nome })} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              {cat.subcategorias.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma subcategoria.</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {filtered.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                      <Tags className="h-10 w-10 text-muted-foreground/40" />
                      <p className="mt-3 text-sm font-medium text-muted-foreground">Nenhuma categoria encontrada.</p>
                      <button type="button" onClick={openNewCategoria} className="mt-4 flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="h-3.5 w-3.5" />Criar primeira categoria</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Drill-down panel */}
          {drillCat && (
            <div className="hidden w-[420px] shrink-0 border-l border-border bg-card xl:flex xl:flex-col">
              {/* Panel header */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${drillCat.cor}18` }}>
                  <Tags className="h-4 w-4" style={{ color: drillCat.cor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground truncate">{drillCat.nome}</p>
                  {grupoDreLabel && <p className="text-[10px] text-[hsl(216,60%,50%)] truncate">DRE: {grupoDreLabel}</p>}
                </div>
                <button type="button" onClick={() => setDrillCat(null)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {tabsConfig.map(({ key, label, count, Icon }) => (
                  <button key={key} type="button" onClick={() => setDrillTab(key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors border-b-2 ${drillTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${drillTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{count}</span>
                  </button>
                ))}
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto">
                {drillLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : drillTabItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {drillTabItems.map((item) => (
                      <div key={`${item.origem}-${item.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-card-foreground">{item.descricao}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.data && <span className="text-xs text-muted-foreground">{formatDate(item.data)}</span>}
                            {item.status && (
                              <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${
                                item.status === "confirmado" || item.status === "ativa" || item.status === "pago" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" :
                                item.status === "pendente" ? "bg-amber-500/10 text-amber-600" :
                                "bg-muted text-muted-foreground"
                              }`}>{item.status}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${item.tipo === "receita" ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>
                          {item.tipo === "receita" ? "+" : "-"}{formatCurrency(Math.abs(item.valor))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {drillTabItems.length > 0 && (
                <div className="border-t border-border px-5 py-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{drillTabItems.length} registros</span>
                    <span className="font-semibold text-card-foreground">{formatCurrency(drillTabItems.reduce((acc, i) => acc + i.valor, 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Dialog Categoria/Subcategoria/Filho */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "categoria" ? (editingCat ? "Editar Categoria" : "Nova Categoria") :
               dialogMode === "subcategoria" ? (editingSub ? "Editar Subcategoria" : "Nova Subcategoria") :
               (editingFilho ? "Editar Sub-filho" : "Novo Sub-filho")}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "categoria" ? "Defina nome, tipo e o grupo do DRE para esta categoria." :
               dialogMode === "subcategoria" ? "Nome da subcategoria." : "Nome do sub-filho."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="formNome">Nome</Label>
              <Input id="formNome" placeholder="Ex: Vendas, Aluguel..." value={formNome} onChange={(e) => setFormNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSave() }} />
            </div>
            {dialogMode === "categoria" && (
              <>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["Receita", "Despesa"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => { setFormTipo(t); setFormGrupoDre("") }}
                        className={`rounded-lg border p-3 text-sm font-medium transition-colors ${formTipo === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grupoDre">Grupo do DRE</Label>
                  <select id="grupoDre" value={formGrupoDre} onChange={(e) => setFormGrupoDre(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">-- Sem grupo DRE --</option>
                    {GRUPOS_DRE.filter(g => g.tipo === formTipo || !formTipo).map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Vincule ao grupo correto para que o DRE seja calculado automaticamente.</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCat || editingSub || editingFilho ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>Deseja excluir &quot;{deleteConfirm?.nome}&quot;? Esta acao nao pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Categorias
            </DialogTitle>
            <DialogDescription>
              Importe categorias a partir de um arquivo CSV ou Excel. Colunas esperadas: Nome, Tipo, Subcategoria, Sub-filho, Grupo do DRE.
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
                  Colunas: <span className="font-medium text-foreground">Nome</span> | <span className="font-medium text-foreground">Tipo</span> | <span className="font-medium text-foreground">Subcategoria</span> | <span className="font-medium text-foreground">Sub-filho</span> | <span className="font-medium text-foreground">Grupo do DRE</span>
                </p>
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImportFile(file)
                  if (e.target) e.target.value = ""
                }}
              />
            </div>
          )}

          {importRows.length > 0 && !importResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {importRows.length} {importRows.length === 1 ? "linha encontrada" : "linhas encontradas"}
                </p>
                <button type="button" onClick={() => setImportRows([])} className="text-xs text-muted-foreground hover:text-foreground">
                  Trocar arquivo
                </button>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Subcategoria</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sub-filho</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Grupo DRE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-foreground">{row.nome}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.tipo === "Receita" ? "bg-[hsl(142,71%,40%)]/10 text-[hsl(142,71%,40%)]" : "bg-[hsl(0,72%,51%)]/10 text-[hsl(0,72%,51%)]"}`}>
                            {row.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.subcategoria || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.subFilho || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{row.grupoDre || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <button type="button" onClick={() => setImportOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  Cancelar
                </button>
                <button type="button" onClick={handleImportSave} disabled={importing} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? "Importando..." : `Importar ${importRows.length} categorias`}
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
                  <span><strong className="text-foreground">{importResult.created}</strong> categorias criadas</span>
                  {importResult.skipped > 0 && <span><strong className="text-foreground">{importResult.skipped}</strong> ja existentes</span>}
                </div>
              </div>
              <DialogFooter>
                <button type="button" onClick={() => setImportOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  Fechar
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
