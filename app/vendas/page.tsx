"use client"
// v2.0.0 - Fixed currency input handling
import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { getActiveTenantId, useTenant } from "@/hooks/use-tenant"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  ShoppingCart, Plus, Pencil, Trash2, Loader2, Search, X, ChevronDown,
  ChevronLeft, ChevronRight, Upload, FileSpreadsheet, Check, TrendingUp, Copy
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { handleCurrencyInput, parseBRL, formatBRL } from "@/lib/currency-input"
import { parseCSVRaw } from "@/lib/spreadsheet-parser"

interface ClienteRow { id: number; nome: string }

interface Venda {
  id: number
  codigo: string
  cliente_id: number | null
  cliente_nome: string
  valor_total: number
  acrescimo: number
  taxas_marketplace: number
  desconto: number
  valor_recebido: number
  forma_pagamento: string
  canal: string
  data_venda: string
  observacoes: string
}

const FORMAS_PAGAMENTO = ["PIX", "Debito", "Credito", "Dinheiro", "Boleto", "Transferencia", "IFOOD - DEBITO - MASTERCARD", "IFOOD - CREDITO"]
const CANAIS = ["DELIVERY", "IFOOD", "LOJA", "WHATSAPP", "SITE", "OUTRO"]

async function fetchVendas([, tid]: [string, number | null]): Promise<Venda[]> {
  const supabase = createClient()
  let q = supabase
    .from("vendas")
    .select(`*, clientes(nome)`)
    .order("data_venda", { ascending: false })
  if (tid) q = q.eq("tenant_id", tid)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    codigo: (row.codigo as string) || "",
    cliente_id: row.cliente_id as number | null,
    cliente_nome: (row.clientes as Record<string, string> | null)?.nome || (row.cliente_nome as string) || "",
    valor_total: Number(row.valor_total) || 0,
    acrescimo: Number(row.acrescimo) || 0,
    taxas_marketplace: Number(row.taxas_marketplace) || 0,
    desconto: Number(row.desconto) || 0,
    valor_recebido: Number(row.valor_recebido) || 0,
    forma_pagamento: (row.forma_pagamento as string) || "",
    canal: (row.canal as string) || "",
    data_venda: (row.data_venda as string) || "",
    observacoes: (row.observacoes as string) || "",
  }))
}

async function fetchClientes(tid: number | null): Promise<ClienteRow[]> {
  const supabase = createClient()
  let q = supabase.from("clientes").select("id, nome").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function formatDateTimeDisplay(d: string) {
  if (!d) return "-"
  const dt = new Date(d)
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const emptyForm = {
  codigo: "", cliente_id: "", cliente_nome: "", valor_total: "", acrescimo: "", taxas_marketplace: "",
  desconto: "", valor_recebido: "", forma_pagamento: "", canal: "", data_venda: "", observacoes: "",
}

export default function VendasPageWrapper() {
  return <Suspense><VendasPage /></Suspense>
}

function VendasPage() {
  const { tenant } = useTenant()
  const tid = tenant?.id ?? null
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: vendas = [], error, isLoading, mutate } = useSWR(["vendas", tid], fetchVendas)
  const { data: clientesLista = [] } = useSWR(["clientes_vendas", tid], ([, t]) => fetchClientes(t))

  const [filterPeriodo, setFilterPeriodo] = useState<"mes_atual" | "7dias" | "personalizado" | "todos">("mes_atual")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [filterCanal, setFilterCanal] = useState("")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVenda, setEditingVenda] = useState<Venda | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Venda | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleteMultiConfirm, setDeleteMultiConfirm] = useState(false)

  // Import
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<{
    codigo: string; cliente: string; valor_total: string; acrescimo: string; taxas_marketplace: string;
    desconto: string; valor_recebido: string; forma_pagamento: string; canal: string; data_venda: string;
  }[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const importFileRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingVenda(null)
      setForm(emptyForm)
      setDialogOpen(true)
      router.replace("/vendas")
    }
  }, [searchParams, router])

  // Date range
  const dateRange = useMemo(() => {
    const today = new Date()
    if (filterPeriodo === "mes_atual") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { from: first.toISOString().split("T")[0], to: last.toISOString().split("T")[0] + "T23:59:59" }
    }
    if (filterPeriodo === "7dias") {
      const from = new Date(today)
      from.setDate(from.getDate() - 7)
      return { from: from.toISOString().split("T")[0], to: today.toISOString().split("T")[0] + "T23:59:59" }
    }
    if (filterPeriodo === "personalizado" && customDateFrom && customDateTo) {
      return { from: customDateFrom, to: customDateTo + "T23:59:59" }
    }
    return null
  }, [filterPeriodo, customDateFrom, customDateTo])

  // Filtered
  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      if (filterCanal && v.canal !== filterCanal) return false
      if (dateRange && v.data_venda) {
        const vDate = v.data_venda.split("T")[0]
        if (vDate < dateRange.from.split("T")[0] || vDate > dateRange.to.split("T")[0]) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (
          !v.codigo.toLowerCase().includes(q) &&
          !v.cliente_nome.toLowerCase().includes(q) &&
          !v.canal.toLowerCase().includes(q) &&
          !v.forma_pagamento.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [vendas, filterCanal, dateRange, search])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginatedFiltered = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  useEffect(() => { setPage(1) }, [filterCanal, search, filterPeriodo, customDateFrom, customDateTo])

  // Totals
  const totalVendas = filtered.reduce((a, v) => a + v.valor_total, 0)
  const totalRecebido = filtered.reduce((a, v) => a + v.valor_recebido, 0)
  const totalTaxas = filtered.reduce((a, v) => a + v.taxas_marketplace, 0)
  const totalDescontos = filtered.reduce((a, v) => a + v.desconto, 0)

  const hasFilter = filterCanal || search || filterPeriodo !== "mes_atual"

  function clearFilters() {
    setFilterCanal("")
    setSearch("")
    setFilterPeriodo("mes_atual")
    setCustomDateFrom("")
    setCustomDateTo("")
  }

  function openNew() {
    setEditingVenda(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(v: Venda) {
    setEditingVenda(v)
    setForm({
      codigo: v.codigo,
      cliente_id: v.cliente_id ? String(v.cliente_id) : "",
      cliente_nome: v.cliente_nome,
      valor_total: formatBRL(v.valor_total),
      acrescimo: formatBRL(v.acrescimo),
      taxas_marketplace: formatBRL(v.taxas_marketplace),
      desconto: formatBRL(v.desconto),
      valor_recebido: formatBRL(v.valor_recebido),
      forma_pagamento: v.forma_pagamento,
      canal: v.canal,
      data_venda: v.data_venda ? v.data_venda.slice(0, 16) : "",
      observacoes: v.observacoes,
    })
    setDialogOpen(true)
  }

  function cloneVenda(v: Venda) {
    setEditingVenda(null) // null para criar nova
    setForm({
      codigo: "", // Código vazio para nova venda
      cliente_id: v.cliente_id ? String(v.cliente_id) : "",
      cliente_nome: v.cliente_nome,
      valor_total: formatBRL(v.valor_total),
      acrescimo: formatBRL(v.acrescimo),
      taxas_marketplace: formatBRL(v.taxas_marketplace),
      desconto: formatBRL(v.desconto),
      valor_recebido: formatBRL(v.valor_recebido),
      forma_pagamento: v.forma_pagamento,
      canal: v.canal,
      data_venda: new Date().toISOString().slice(0, 16), // Data atual
      observacoes: v.observacoes,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    console.log("[v0] handleSave chamado, form:", form)
    if (!form.valor_total) { console.log("[v0] valor_total vazio, retornando"); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const tenantId = getActiveTenantId()
      console.log("[v0] tenantId:", tenantId)
      const valorTotal = parseBRL(form.valor_total)
      const acrescimo = parseBRL(form.acrescimo)
      const taxas = parseBRL(form.taxas_marketplace)
      const desconto = parseBRL(form.desconto)
      const valorRecebido = parseBRL(form.valor_recebido) || (valorTotal + acrescimo - taxas - desconto)
      console.log("[v0] Valores parseados:", { valorTotal, acrescimo, taxas, desconto, valorRecebido })

      const payload: Record<string, unknown> = {
        codigo: form.codigo,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        cliente_nome: form.cliente_nome || clientesLista.find(c => c.id === Number(form.cliente_id))?.nome || "",
        valor_total: valorTotal,
        acrescimo: acrescimo,
        taxas_marketplace: taxas,
        desconto: desconto,
        valor_recebido: valorRecebido,
        forma_pagamento: form.forma_pagamento,
        canal: form.canal,
        data_venda: form.data_venda || new Date().toISOString(),
        observacoes: form.observacoes,
      }
      if (tenantId) payload.tenant_id = tenantId
      console.log("[v0] Payload final:", payload)

      if (editingVenda) {
        const { error } = await supabase.from("vendas").update(payload).eq("id", editingVenda.id)
        console.log("[v0] Update result error:", error)
      } else {
        const { error } = await supabase.from("vendas").insert(payload)
        console.log("[v0] Insert result error:", error)
      }
      await mutate()
      setDialogOpen(false)
    } catch (err) {
      alert("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async (v: Venda) => {
    const supabase = createClient()
    await supabase.from("vendas").delete().eq("id", v.id)
    await mutate()
    setDeleteConfirm(null)
  }, [mutate])

  // Seleção múltipla
  function toggleSelectAll() {
    if (selectedIds.size === paginatedFiltered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedFiltered.map(v => v.id)))
    }
  }

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  async function handleDeleteMultiple() {
    if (selectedIds.size === 0) return
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from("vendas").delete().in("id", Array.from(selectedIds))
      await mutate()
      setSelectedIds(new Set())
      setDeleteMultiConfirm(false)
    } finally {
      setSaving(false)
    }
  }

  // Import functions
  function readFileText(file: File, enc: string): Promise<string> {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target?.result as string); r.onerror = rej; r.readAsText(file, enc) })
  }

  function parseDate(str: string): string {
    if (!str) return ""
    // Excel serial number (e.g., 46082.957650462966)
    const num = parseFloat(str)
    if (!isNaN(num) && num > 25000 && num < 60000) {
      // Excel date serial: days since 1900-01-01 (with Excel bug for 1900 leap year)
      const excelEpoch = new Date(1899, 11, 30) // Dec 30, 1899
      const msPerDay = 24 * 60 * 60 * 1000
      const date = new Date(excelEpoch.getTime() + num * msPerDay)
      return date.toISOString()
    }
    // Try DD/MM/YYYY HH:MM:SS format
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}):?(\d{2})?$/)
    if (match) {
      const [, d, m, y, h, min, s] = match
      return `${y}-${m}-${d}T${h}:${min}:${s || "00"}`
    }
    // Try DD/MM/YYYY format (without time)
    const matchDate = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (matchDate) {
      const [, d, m, y] = matchDate
      return `${y}-${m}-${d}T00:00:00`
    }
    // Try YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str
    return str
  }

  function parseNumber(str: string): string {
    if (!str) return "0"
    return str.replace(/[^\d,.-]/g, "").replace(",", ".")
  }

  async function handleImportFile(file: File) {
    console.log("[v0] handleImportFile chamado com arquivo:", file.name, file.type, file.size)
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? ""
      console.log("[v0] Extensao detectada:", ext)
      let rawRows: Record<string, string>[] = []
      if (ext === "csv") {
        let content = await readFileText(file, "UTF-8")
        const fl = content.split("\n")[0] || ""
        console.log("[v0] Primeira linha CSV:", fl)
        if (!fl.includes(";") && !fl.includes(",")) content = await readFileText(file, "ISO-8859-1")
        rawRows = parseCSVRaw(content)
        console.log("[v0] parseCSVRaw retornou", rawRows.length, "linhas")
        if (rawRows.length > 0) console.log("[v0] Primeira linha parseada:", JSON.stringify(rawRows[0]))
      } else if (ext === "xls" || ext === "xlsx") {
        const buffer = await file.arrayBuffer()
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buffer, { type: "array" })
        console.log("[v0] Sheets encontradas:", wb.SheetNames)
        const ws = wb.Sheets[wb.SheetNames[0]]
        let jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" })
        console.log("[v0] XLSX retornou", jsonRows.length, "linhas")
        
        // Verifica se os headers contem __EMPTY (indica que linha 1 e titulo, nao header)
        if (jsonRows.length > 0) {
          const firstRowKeys = Object.keys(jsonRows[0])
          const hasEmptyHeaders = firstRowKeys.some(k => k.includes("__EMPTY") || k.includes("EMPTY"))
          console.log("[v0] Headers tem __EMPTY?", hasEmptyHeaders, "Keys:", firstRowKeys)
          
          if (hasEmptyHeaders) {
            // A linha 1 e titulo - os valores da primeira "linha" sao os headers reais
            const realHeaders = Object.values(jsonRows[0]) as string[]
            console.log("[v0] Headers reais detectados:", realHeaders)
            
            // Remapeia as linhas restantes usando os headers reais
            rawRows = jsonRows.slice(1).map(row => {
              const n: Record<string, string> = {}
              const values = Object.values(row) as string[]
              realHeaders.forEach((header, idx) => {
                const normalizedKey = String(header).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
                n[normalizedKey] = String(values[idx] ?? "")
              })
              return n
            })
          } else {
            // Headers normais, apenas normaliza
            rawRows = jsonRows.map(r => {
              const n: Record<string, string> = {}
              for (const [k, v] of Object.entries(r)) n[k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()] = String(v)
              return n
            })
          }
        }
        console.log("[v0] Apos normalizacao:", rawRows.length, "linhas", rawRows.length > 0 ? JSON.stringify(rawRows[0]) : "vazio")
      } else { alert("Formato nao suportado. Use CSV, XLS ou XLSX."); return }

      console.log("[v0] Colunas disponiveis:", rawRows.length > 0 ? Object.keys(rawRows[0]) : [])
      
      const mapped = rawRows.map((row, idx) => {
        let codigo = "", cliente = "", valor_total = "", acrescimo = "", taxas_marketplace = ""
        let desconto = "", valor_recebido = "", forma_pagamento = "", canal = "", data_venda = ""
        for (const [key, val] of Object.entries(row)) {
          const k = key.trim().toLowerCase()
          // Codigo
          if (k.includes("codigo") || k.includes("cod")) { codigo = val.trim(); continue }
          // Cliente
          if (k.includes("cliente")) { cliente = val.trim(); continue }
          // Valor Total (antes de "recebido" pois "valor recebido" inclui "valor")
          if (k.includes("valor total") || (k.includes("valor") && !k.includes("recebido"))) { valor_total = parseNumber(val); continue }
          // Valor Recebido
          if (k.includes("recebido") || k.includes("valor recebido")) { valor_recebido = parseNumber(val); continue }
          // Acrescimo
          if (k.includes("acrescimo") || k.includes("acresc")) { acrescimo = parseNumber(val); continue }
          // Taxas Marketplace
          if (k.includes("taxa") || k.includes("marketplace")) { taxas_marketplace = parseNumber(val); continue }
          // Desconto (cuidado para nao pegar "desc" de "descricao")
          if (k === "desconto" || k.includes("desconto")) { desconto = parseNumber(val); continue }
          // Forma de Pagamento
          if (k.includes("forma") || (k.includes("pagamento") && !k.includes("forma"))) { forma_pagamento = val.trim(); continue }
          // Canal
          if (k.includes("canal")) { canal = val.trim(); continue }
          // Data
          if (k.includes("data")) { data_venda = parseDate(val.trim()); continue }
        }
        if (idx === 0) console.log("[v0] Primeiro registro mapeado:", { codigo, cliente, valor_total, acrescimo, taxas_marketplace, desconto, valor_recebido, forma_pagamento, canal, data_venda })
        return { codigo, cliente, valor_total, acrescimo, taxas_marketplace, desconto, valor_recebido, forma_pagamento, canal, data_venda }
      }).filter(r => r.valor_total && parseFloat(r.valor_total) > 0)

      console.log("[v0] Mapped com valores > 0:", mapped.length, "linhas")
      if (mapped.length > 0) console.log("[v0] Primeiro mapeado:", JSON.stringify(mapped[0]))

      setImportRows(mapped)
      setImportResult(null)
    } catch (err) { 
      console.log("[v0] Erro ao importar:", err)
      alert("Erro ao ler arquivo: " + (err instanceof Error ? err.message : String(err))) 
    }
  }

  async function handleImportSave() {
    if (importRows.length === 0) return
    console.log("[v0] handleImportSave iniciado com", importRows.length, "linhas")
    setImporting(true)
    try {
      const supabase = createClient()
      const tenantId = getActiveTenantId()
      let created = 0, skipped = 0

      for (const row of importRows) {
        console.log("[v0] Processando linha:", row.codigo, row.cliente)
        
        // Check if already exists by codigo
        if (row.codigo) {
          let q = supabase.from("vendas").select("id").eq("codigo", row.codigo).limit(1)
          if (tenantId) q = q.eq("tenant_id", tenantId)
          const { data: existing } = await q
          if (existing && existing.length > 0) { 
            console.log("[v0] Codigo ja existe, pulando:", row.codigo)
            skipped++
            continue 
          }
        }

        const payload: Record<string, unknown> = {
          codigo: row.codigo,
          cliente_nome: row.cliente,
          valor_total: parseFloat(row.valor_total) || 0,
          acrescimo: parseFloat(row.acrescimo) || 0,
          taxas_marketplace: parseFloat(row.taxas_marketplace) || 0,
          desconto: parseFloat(row.desconto) || 0,
          valor_recebido: parseFloat(row.valor_recebido) || 0,
          forma_pagamento: row.forma_pagamento,
          canal: row.canal,
          data_venda: row.data_venda || new Date().toISOString(),
        }
        if (tenantId) payload.tenant_id = tenantId
        
        console.log("[v0] Inserindo payload:", JSON.stringify(payload))
        const { error } = await supabase.from("vendas").insert(payload)
        if (error) {
          console.log("[v0] Erro ao inserir:", error)
        } else {
          console.log("[v0] Inserido com sucesso:", row.codigo)
          created++
        }
      }

      console.log("[v0] Importacao finalizada - criados:", created, "pulados:", skipped)
      setImportResult({ created, skipped })
      await mutate()
    } catch (err) { 
      console.log("[v0] Erro geral:", err)
      alert("Erro ao importar: " + (err instanceof Error ? err.message : String(err))) 
    }
    finally { setImporting(false) }
  }

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 pl-[72px]">
        <PageHeader title="Vendas" subtitle="Gerencie suas vendas e historico de transacoes" />

        <div className="space-y-6 p-6">
          {/* Action toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={openNew}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />Adicionar
              </button>
              <button type="button" onClick={() => { setImportRows([]); setImportResult(null); setImportOpen(true) }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                <Upload className="h-4 w-4" />Importar
              </button>
              {selectedIds.size > 0 && (
                <button type="button" onClick={() => setDeleteMultiConfirm(true)}
                  className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90">
                  <Trash2 className="h-4 w-4" />Excluir ({selectedIds.size})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-card">
                {([
                  { key: "mes_atual", label: "Mes atual" },
                  { key: "7dias", label: "7 dias" },
                  { key: "personalizado", label: "Personalizado" },
                  { key: "todos", label: "Todos" },
                ] as const).map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => setFilterPeriodo(key)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterPeriodo === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filterPeriodo === "personalizado" && (
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-10 w-36 text-sm" />
                  <span className="text-xs text-muted-foreground">ate</span>
                  <Input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-10 w-36 text-sm" />
                </div>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#16a34a]" />
              <p className="text-xs font-medium text-muted-foreground">Total Vendas</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#16a34a]">{formatCurrency(totalVendas)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} vendas</p>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#2563eb]" />
              <p className="text-xs font-medium text-muted-foreground">Valor Recebido</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#2563eb]">{formatCurrency(totalRecebido)}</p>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#ea580c]" />
              <p className="text-xs font-medium text-muted-foreground">Taxas Marketplace</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#ea580c]">{formatCurrency(totalTaxas)}</p>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#dc2626]" />
              <p className="text-xs font-medium text-muted-foreground">Descontos</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#dc2626]">{formatCurrency(totalDescontos)}</p>
            </div>
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por codigo, cliente, canal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="relative">
              <select
                value={filterCanal}
                onChange={(e) => setFilterCanal(e.target.value)}
                className="h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos canais</option>
                {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            {hasFilter && (
              <button type="button" onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">Erro ao carregar vendas</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox" checked={selectedIds.size === paginatedFiltered.length && paginatedFiltered.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded border-border" />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Codigo</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Cliente</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Valor Total</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Acrescimo</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Taxas</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Desconto</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Valor Recebido</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Forma Pgto</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Canal</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Data</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-5 py-12 text-center text-sm text-muted-foreground">
                          {hasFilter ? "Nenhuma venda encontrada com os filtros atuais." : "Nenhuma venda cadastrada."}
                        </td>
                      </tr>
                    ) : paginatedFiltered.map((venda) => (
                      <tr key={venda.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${selectedIds.has(venda.id) ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={selectedIds.has(venda.id)} onChange={() => toggleSelect(venda.id)} className="h-4 w-4 rounded border-border" />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{venda.codigo || "-"}</td>
                        <td className="px-4 py-3 font-medium">{venda.cliente_nome || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#16a34a]">{formatCurrency(venda.valor_total)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(venda.acrescimo)}</td>
                        <td className="px-4 py-3 text-right text-[#ea580c]">{formatCurrency(venda.taxas_marketplace)}</td>
                        <td className="px-4 py-3 text-right text-[#dc2626]">{formatCurrency(venda.desconto)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#2563eb]">{formatCurrency(venda.valor_recebido)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{venda.forma_pagamento || "-"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{venda.canal || "-"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTimeDisplay(venda.data_venda)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => cloneVenda(venda)} title="Clonar venda" className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                              <Copy className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openEdit(venda)} title="Editar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setDeleteConfirm(venda)} title="Excluir" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}-{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registros
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) { pageNum = i + 1 }
                      else if (page <= 3) { pageNum = i + 1 }
                      else if (page >= totalPages - 2) { pageNum = totalPages - 4 + i }
                      else { pageNum = page - 2 + i }
                      return (
                        <button key={pageNum} type="button" onClick={() => setPage(pageNum)}
                          className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${page === pageNum ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"}`}>
                          {pageNum}
                        </button>
                      )
                    })}
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {editingVenda ? "Editar Venda" : "Nova Venda"}
              </DialogTitle>
              <DialogDescription>
                {editingVenda ? "Altere os dados da venda" : "Preencha os dados da venda"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Codigo</Label>
                  <Input placeholder="Codigo da venda" value={form.codigo} onChange={(e) => { console.log("[v0] Codigo onChange:", e.target.value); setForm({ ...form, codigo: e.target.value }) }} />
                </div>
                <div className="space-y-2">
                  <Label>Data/Hora</Label>
                  <Input type="datetime-local" value={form.data_venda} onChange={(e) => { console.log("[v0] Data onChange:", e.target.value); setForm({ ...form, data_venda: e.target.value }) }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <select className={selectClass} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                    <option value="">Selecione ou digite</option>
                    {clientesLista.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Nome Cliente (manual)</Label>
                  <Input placeholder="Digite se nao encontrar na lista" value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor Total *</Label>
                  <Input placeholder="0,00" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Acrescimo</Label>
                  <Input placeholder="0,00" value={form.acrescimo} onChange={(e) => setForm({ ...form, acrescimo: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Taxas Marketplace</Label>
                  <Input placeholder="0,00" value={form.taxas_marketplace} onChange={(e) => setForm({ ...form, taxas_marketplace: handleCurrencyInput(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input placeholder="0,00" value={form.desconto} onChange={(e) => setForm({ ...form, desconto: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Valor Recebido</Label>
                  <Input placeholder="Calculado automaticamente" value={form.valor_recebido} onChange={(e) => setForm({ ...form, valor_recebido: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Forma Pagamento</Label>
                  <select className={selectClass} value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}>
                    <option value="">Selecione</option>
                    {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <select className={selectClass} value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })}>
                    <option value="">Selecione</option>
                    {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Observacoes</Label>
                  <Input placeholder="Observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={saving || !form.valor_total}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir venda</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a venda {deleteConfirm?.codigo}? Esta acao nao pode ser desfeita.
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

        {/* Delete multiple confirmation */}
        <AlertDialog open={deleteMultiConfirm} onOpenChange={setDeleteMultiConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedIds.size} vendas</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {selectedIds.size} vendas selecionadas? Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMultiple} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Excluir ${selectedIds.size}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Importar Vendas
              </DialogTitle>
              <DialogDescription>
                Importe vendas a partir de um arquivo CSV ou Excel. Colunas: Codigo, Cliente, Valor Total, Acrescimo, Taxas Marketplace, Desconto, Valor Recebido, Forma de Pagamento, Canal, Data.
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
                    {importRows.length} {importRows.length === 1 ? "venda encontrada" : "vendas encontradas"}
                  </p>
                  <button type="button" onClick={() => setImportRows([])} className="text-xs text-muted-foreground hover:text-foreground">Trocar arquivo</button>
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Codigo</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Valor Total</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Acrescimo</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Taxas</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Desconto</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Valor Receb.</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Forma Pgto</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Canal</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5 font-mono">{row.codigo || "-"}</td>
                          <td className="px-2 py-1.5">{row.cliente || "-"}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#16a34a]">{formatCurrency(parseFloat(row.valor_total) || 0)}</td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground">{formatCurrency(parseFloat(row.acrescimo) || 0)}</td>
                          <td className="px-2 py-1.5 text-right text-[#ea580c]">{formatCurrency(parseFloat(row.taxas_marketplace) || 0)}</td>
                          <td className="px-2 py-1.5 text-right text-[#dc2626]">{formatCurrency(parseFloat(row.desconto) || 0)}</td>
                          <td className="px-2 py-1.5 text-right text-[#2563eb]">{formatCurrency(parseFloat(row.valor_recebido) || 0)}</td>
                          <td className="px-2 py-1.5">{row.forma_pagamento || "-"}</td>
                          <td className="px-2 py-1.5">{row.canal || "-"}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{row.data_venda || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 50 && <p className="text-xs text-muted-foreground text-center">Mostrando 50 de {importRows.length} vendas</p>}
                <DialogFooter>
                  <button type="button" onClick={() => setImportOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
                  <button type="button" onClick={handleImportSave} disabled={importing} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {importing ? "Importando..." : `Importar ${importRows.length} vendas`}
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
                    <span><strong className="text-foreground">{importResult.created}</strong> vendas criadas</span>
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
      </main>
    </div>
  )
}
