"use client"
// v3.0.0 - fetchAll corrigido + filtro de data no servidor
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
  ChevronLeft, ChevronRight, Upload, FileSpreadsheet, Check, Copy
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
import { fetchAll } from "@/lib/supabase/fetch-all"

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

// ─── fetch com filtro de data no servidor (v4.2 - paginação inline) ────────────────
async function fetchVendas([, tid, dateFrom, dateTo, useLt]: [string, number | null, string, string, boolean]): Promise<Venda[]> {
  console.log('[fetchVendas v4.2] Iniciando busca:', { tid, dateFrom, dateTo, useLt })
  
  const supabase = createClient()
  
  // Paginação inline para evitar problemas
  const PAGE_SIZE = 1000
  let allRows: Record<string, unknown>[] = []
  let offset = 0
  
  while (true) {
    let q = supabase
      .from("vendas")
      .select(`*`)
      .order("id", { ascending: true })  // Ordenar por ID para consistência
    
    if (tid) q = q.eq("tenant_id", tid)
    if (dateFrom) q = q.gte("data_venda", dateFrom)
    if (dateTo) {
      // Com formato YYYY-MM-DD, adiciona T23:59:59 para incluir o dia inteiro
      const toVal = useLt ? dateTo : (dateTo.length === 10 ? dateTo + "T23:59:59" : dateTo)
      q = useLt ? q.lt("data_venda", toVal) : q.lte("data_venda", toVal)
    }
    
    const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1)
    
    if (error) {
      console.error('[fetchVendas v4.2] Erro:', error)
      break
    }
    
    if (!data || data.length === 0) break
    
    allRows = allRows.concat(data)
    console.log(`[fetchVendas v4.2] Página ${Math.floor(offset / PAGE_SIZE) + 1}: ${data.length} registros, total: ${allRows.length}`)
    
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  
  console.log('[fetchVendas v4.2] Total final:', allRows.length)
  
  return allRows.map((row) => ({
    id: row.id as number,
    codigo: (row.codigo as string) || "",
    cliente_id: row.cliente_id as number | null,
    cliente_nome: (row.cliente_nome as string) || "",  // Usa cliente_nome direto da tabela vendas
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
  return fetchAll<ClienteRow>(() => {
    let q = supabase.from("clientes").select("id, nome").order("nome")
    if (tid) q = q.eq("tenant_id", tid)
    return q
  })
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function formatDateDisplay(d: string) {
  if (!d) return "-"
  const dt = new Date(d)
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function toDateInputValue(value?: string) {
  const dt = value ? new Date(value) : new Date()
  if (Number.isNaN(dt.getTime())) return ""
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
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

  const [filterPeriodo, setFilterPeriodo] = useState<"mes_atual" | "7dias" | "personalizado" | "todos">("mes_atual")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const [filterCanal, setFilterCanal] = useState("")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 200
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

  // ─── Date range (para filtro no servidor) ──────────────────────────────────
  const dateRange = useMemo(() => {
    const today = new Date()
    
    if (filterPeriodo === "mes_atual") {
      const year = today.getFullYear()
      const month = today.getMonth() // 0-11

      // Limites em horário local, convertidos para ISO UTC
      // Isso garante que o filtro respeite o fuso do usuário (ex: UTC-3)
      // April 1 00:00 local → April 1 03:00 UTC (para UTC-3)
      const fromStr = new Date(year, month, 1, 0, 0, 0, 0).toISOString()
      const toStr = new Date(year, month + 1, 1, 0, 0, 0, 0).toISOString()
      
      return { from: fromStr, to: toStr, useLt: true }
    }
    if (filterPeriodo === "7dias") {
      const from = new Date(today)
      from.setDate(from.getDate() - 7)
      from.setHours(0, 0, 0, 0)
      const nextDay = new Date(today)
      nextDay.setDate(nextDay.getDate() + 1)
      nextDay.setHours(0, 0, 0, 0)
      
      return { from: from.toISOString(), to: nextDay.toISOString(), useLt: true }
    }
    if (filterPeriodo === "personalizado" && customDateFrom && customDateTo) {
      // Converte YYYY-MM-DD para ISO respeitando horário local
      const [fromYear, fromMonth, fromDay] = customDateFrom.split("-").map(Number)
      const [toYear, toMonth, toDay] = customDateTo.split("-").map(Number)
      const fromStr = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0).toISOString()
      const toStr = new Date(toYear, toMonth - 1, toDay + 1, 0, 0, 0, 0).toISOString()
      
      return { from: fromStr, to: toStr, useLt: true }
    }
    return null
  }, [filterPeriodo, customDateFrom, customDateTo])

  // ─── SWR key inclui o range de datas → refetch automático ao mudar período ─
  const swrKey = useMemo<[string, number | null, string, string, boolean]>(() => {
    const key: [string, number | null, string, string, boolean] = [
      "vendas", 
      tid, 
      dateRange?.from ?? "", 
      dateRange?.to ?? "",
      dateRange?.useLt ?? false
    ]
    console.log('[Vendas v4.0] SWR Key:', { 
      tid, 
      periodo: filterPeriodo,
      dateFrom: dateRange?.from, 
      dateTo: dateRange?.to,
      useLt: dateRange?.useLt
    })
    return key
  }, [tid, dateRange, filterPeriodo])

  const { data: vendas = [], error, isLoading, mutate } = useSWR(
    swrKey, 
    fetchVendas,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 0, // Desabilita deduplicação
    }
  )
  const { data: clientesLista = [] } = useSWR(["clientes_vendas", tid], ([, t]) => fetchClientes(t as number | null))

  // ─── Filtro local (canal + busca) — data já vem filtrada do servidor ───────
  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      if (filterCanal && v.canal !== filterCanal) return false
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
  }, [vendas, filterCanal, search])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginatedFiltered = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  useEffect(() => { setPage(1) }, [filterCanal, search, filterPeriodo, customDateFrom, customDateTo])

  // Totals
  const totalVendas   = filtered.reduce((a, v) => a + v.valor_total, 0)
  const totalRecebido = filtered.reduce((a, v) => a + v.valor_recebido, 0)
  const totalTaxas    = filtered.reduce((a, v) => a + v.taxas_marketplace, 0)
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
      data_venda: toDateInputValue(v.data_venda),
      observacoes: v.observacoes,
    })
    setDialogOpen(true)
  }

  function cloneVenda(v: Venda) {
    setEditingVenda(null)
    setForm({
      codigo: "",
      cliente_id: v.cliente_id ? String(v.cliente_id) : "",
      cliente_nome: v.cliente_nome,
      valor_total: formatBRL(v.valor_total),
      acrescimo: formatBRL(v.acrescimo),
      taxas_marketplace: formatBRL(v.taxas_marketplace),
      desconto: formatBRL(v.desconto),
      valor_recebido: formatBRL(v.valor_recebido),
      forma_pagamento: v.forma_pagamento,
      canal: v.canal,
      data_venda: toDateInputValue(),
      observacoes: v.observacoes,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    // Campos obrigatórios
    if (!form.codigo.trim()) { alert("Codigo é obrigatório."); return }
    if (!form.data_venda) { alert("Data é obrigatória."); return }
    if (!form.cliente_id && !form.cliente_nome.trim()) { alert("Cliente é obrigatório."); return }
    if (!form.valor_total) { alert("Valor é obrigatório."); return }
    if (!form.forma_pagamento) { alert("Forma de Pagamento é obrigatória."); return }
    if (!form.canal) { alert("Canal é obrigatório."); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const tenantId = getActiveTenantId()
      const valorTotal    = parseBRL(form.valor_total)
      const acrescimo     = parseBRL(form.acrescimo)
      const taxas         = parseBRL(form.taxas_marketplace)
      const desconto      = parseBRL(form.desconto)
      const valorRecebido = parseBRL(form.valor_recebido) || (valorTotal + acrescimo - taxas - desconto)

      // Converte YYYY-MM-DD para ISO usando meio-dia UTC para evitar shift de fuso
      const dataISO = form.data_venda
        ? `${form.data_venda}T12:00:00.000Z`
        : new Date().toISOString()

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
        data_venda: dataISO,
        observacoes: form.observacoes,
      }
      if (tenantId) payload.tenant_id = tenantId

      if (editingVenda) {
        await supabase.from("vendas").update(payload).eq("id", editingVenda.id)
      } else {
        await supabase.from("vendas").insert(payload)
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

  // ─── Import ────────────────────────────────────────────────────────────────
  function readFileText(file: File, enc: string): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = e => res(e.target?.result as string)
      r.onerror = rej
      r.readAsText(file, enc)
    })
  }

  function parseDate(str: string): string {
    if (!str) return ""

    const toMiddayUTC = (d: string, m: string, y: string) => `${y}-${m}-${d}T12:00:00.000Z`

    const num = parseFloat(str)
    if (!isNaN(num) && num > 25000 && num < 60000) {
      // Excel serial date: usa midday UTC para evitar shift de timezone
      const excelEpoch = Date.UTC(1899, 11, 30, 12, 0, 0, 0)
      const date = new Date(excelEpoch + Math.floor(num) * 86400000)
      return date.toISOString()
    }
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}):?(\d{2})?$/)
    if (match) {
      const [, d, m, y] = match
      // Para importação de vendas, respeita apenas a data da linha
      // (hora de origem pode deslocar o dia em diferentes fusos)
      return toMiddayUTC(d, m, y)
    }
    const matchDate = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (matchDate) {
      const [, d, m, y] = matchDate
      // Midday UTC garante que a data exibida em qualquer fuso horário (UTC-12 a UTC+12) seja o mesmo dia
      return toMiddayUTC(d, m, y)
    }

    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
    if (isoMatch) {
      const [, y, m, d] = isoMatch
      return toMiddayUTC(d, m, y)
    }

    return str
  }

  function parseNumber(str: string): string {
    if (!str) return "0"
    // Remove espaços e caracteres especiais, mantém apenas números, vírgula, ponto e sinal negativo
    let cleaned = str.toString().trim().replace(/[^\d,.-]/g, "")
    
    // Se tiver vírgula e ponto, determina qual é o separador decimal
    if (cleaned.includes(",") && cleaned.includes(".")) {
      // Se o ponto vem depois da vírgula, vírgula é milhar e ponto é decimal
      if (cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")) {
        cleaned = cleaned.replace(/,/g, "")
      } else {
        // Vírgula é decimal, ponto é milhar
        cleaned = cleaned.replace(/\./g, "").replace(",", ".")
      }
    } else if (cleaned.includes(",")) {
      // Apenas vírgula - substitui por ponto
      cleaned = cleaned.replace(",", ".")
    }
    
    return cleaned || "0"
  }

  function normalizeImportKey(key: string): string {
    return key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  function getMappedValue(row: Record<string, string>, exactAliases: string[], containsAliases: string[] = []): string {
    for (const alias of exactAliases) {
      const value = row[alias]
      if (value !== undefined && String(value).trim()) return String(value).trim()
    }
    if (containsAliases.length > 0) {
      for (const [key, value] of Object.entries(row)) {
        if (containsAliases.some((alias) => key.includes(alias)) && String(value).trim()) {
          return String(value).trim()
        }
      }
    }
    return ""
  }

  async function handleImportFile(file: File) {
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? ""
      let rawRows: Record<string, string>[] = []

      if (ext === "csv") {
        // Tenta UTF-8 primeiro, depois ISO-8859-1
        let content = await readFileText(file, "UTF-8")
        const fl = content.split("\n")[0] || ""
        
        // Se tiver caracteres estranhos, tenta ISO-8859-1
        if (fl.includes("�") || fl.includes("Ã") || fl.includes("Â")) {
          content = await readFileText(file, "ISO-8859-1")
        }
        
        rawRows = parseCSVRaw(content)
      } else if (ext === "xls" || ext === "xlsx") {
        const buffer = await file.arrayBuffer()
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buffer, { type: "array", codepage: 65001 }) // UTF-8
        const ws = wb.Sheets[wb.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false })

        if (jsonRows.length > 0) {
          const firstRowKeys = Object.keys(jsonRows[0])
          const hasEmptyHeaders = firstRowKeys.some(k => k.includes("__EMPTY") || k.includes("EMPTY"))
          if (hasEmptyHeaders) {
            const realHeaders = Object.values(jsonRows[0]) as string[]
            rawRows = jsonRows.slice(1).map(row => {
              const n: Record<string, string> = {}
              const values = Object.values(row) as string[]
              realHeaders.forEach((header, idx) => {
                const normalizedKey = String(header).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
                n[normalizedKey] = String(values[idx] ?? "").trim()
              })
              return n
            })
          } else {
            rawRows = jsonRows.map(r => {
              const n: Record<string, string> = {}
              for (const [k, v] of Object.entries(r)) {
                const normalizedKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
                n[normalizedKey] = String(v ?? "").trim()
              }
              return n
            })
          }
        }
      } else {
        alert("Formato nao suportado. Use CSV, XLS ou XLSX.")
        return
      }

      const mapped = rawRows.map((row) => {
        const normalizedRow: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          normalizedRow[normalizeImportKey(key)] = String(value ?? "").trim()
        }
        
        const codigo          = getMappedValue(normalizedRow, ["codigo", "cod", "codigo venda", "codigo pedido", "numero pedido", "pedido", "id pedido", "numero", "num pedido"], ["codigo", " cod", "cod ", "pedido", "numero"])
        const cliente         = getMappedValue(normalizedRow, ["cliente", "nome cliente", "cliente nome", "nome"], ["cliente", "nome"])
        const valorTotalRaw   = getMappedValue(normalizedRow, ["valor total", "total", "valor venda", "valor"], ["valor total", "total"])
        const valorRecebidoRaw = getMappedValue(normalizedRow, ["valor recebido", "recebido", "liquido", "valor liquido"], ["recebido", "liquido"])
        const acrescimoRaw    = getMappedValue(normalizedRow, ["acrescimo", "acrescimos", "taxa entrega", "entrega"], ["acresc", "entrega"])
        const taxasRaw        = getMappedValue(normalizedRow, ["taxas marketplace", "taxa marketplace", "taxas", "taxa", "taxa ifood"], ["marketplace", "taxa"])
        const descontoRaw     = getMappedValue(normalizedRow, ["desconto", "descontos"], ["desconto"])
        const formaPagamento  = getMappedValue(normalizedRow, ["forma pagamento", "forma de pagamento", "pagamento", "forma"], ["pagamento", "forma"])
        const canal           = getMappedValue(normalizedRow, ["canal", "origem", "marketplace", "plataforma"], ["canal", "origem"])
        const dataRaw         = getMappedValue(normalizedRow, ["data venda", "data", "data pedido", "data hora"], ["data"])

        return {
          codigo: codigo || "",
          cliente: cliente || "",
          valor_total:       parseNumber(valorTotalRaw),
          acrescimo:         parseNumber(acrescimoRaw),
          taxas_marketplace: parseNumber(taxasRaw),
          desconto:          parseNumber(descontoRaw),
          valor_recebido:    parseNumber(valorRecebidoRaw),
          forma_pagamento:   formaPagamento || "",
          canal:             canal || "",
          data_venda:        parseDate(dataRaw),
        }
      })

      console.log('[Import] Mapped rows:', mapped.slice(0, 5)) // Debug: primeiras 5 linhas
      setImportRows(mapped)
      setImportResult(null)
    } catch (err) {
      alert("Erro ao ler arquivo: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function handleImportSave() {
    if (importRows.length === 0) return
    setImporting(true)
    try {
      const supabase = createClient()
      const tenantId = getActiveTenantId()
      let created = 0, skipped = 0
      const errors: string[] = []

      const normalizedRows = importRows.map(row => ({ ...row, codigo: row.codigo?.trim() || "" }))

      console.log('[Import] Total rows to import:', normalizedRows.length)

      const payloads: Record<string, unknown>[] = []

      for (const row of normalizedRows) {
        const valorTotal = parseFloat(row.valor_total) || 0

        // REMOVIDO: Validação de código duplicado
        // Agora permite importar códigos duplicados para bater o caixa
        // REMOVIDO: Filtro valor_total > 0 — importa todas as linhas do CSV

        const payload: Record<string, unknown> = {
          codigo:            row.codigo || "",
          cliente_nome:      row.cliente || "",
          valor_total:       valorTotal,
          acrescimo:         parseFloat(row.acrescimo) || 0,
          taxas_marketplace: parseFloat(row.taxas_marketplace) || 0,
          desconto:          parseFloat(row.desconto) || 0,
          valor_recebido:    parseFloat(row.valor_recebido) || 0,
          forma_pagamento:   row.forma_pagamento || "",
          canal:             row.canal || "",
          data_venda:        row.data_venda || new Date().toISOString(),
        }
        if (tenantId) payload.tenant_id = tenantId
        payloads.push(payload)
      }

      console.log('[Import] Payloads to insert:', payloads.length)
      console.log('[Import] Skipped before insert:', skipped)

      const INSERT_CHUNK = 500
      for (let i = 0; i < payloads.length; i += INSERT_CHUNK) {
        const batch = payloads.slice(i, i + INSERT_CHUNK)
        const { error } = await supabase.from("vendas").insert(batch)
        if (!error) {
          created += batch.length
          console.log(`[Import] Batch ${Math.floor(i / INSERT_CHUNK) + 1} inserted: ${batch.length} rows`)
          continue
        }
        
        console.error('[Import] Batch error:', error)
        
        // fallback individual
        for (const payload of batch) {
          const { error: rowError } = await supabase.from("vendas").insert(payload)
          if (rowError) {
            skipped++
            errors.push(`Erro ao inserir ${payload.codigo}: ${rowError.message}`)
          } else {
            created++
          }
        }
      }

      console.log('[Import] Final result:', { created, skipped, errors: errors.length })
      
      // Mostra erros no console se houver
      if (errors.length > 0) {
        console.warn('[Import] Errors:', errors.slice(0, 10)) // Primeiros 10 erros
      }

      setImportResult({ created, skipped })
      await mutate()
    } catch (err) {
      console.error('[Import] Exception:', err)
      alert("Erro ao importar: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
    }
  }

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 pl-[72px]">
        <PageHeader title="Vendas" />

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
                  { key: "mes_atual",    label: "Mes atual" },
                  { key: "7dias",        label: "7 dias" },
                  { key: "personalizado", label: "Personalizado" },
                  { key: "todos",        label: "Todos" },
                ] as const).map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => setFilterPeriodo(key)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${filterPeriodo === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {filterPeriodo === "personalizado" && (
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} className="h-10 w-36 text-sm" />
                  <span className="text-xs text-muted-foreground">ate</span>
                  <Input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} className="h-10 w-36 text-sm" />
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
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filtered.length} vendas
                {vendas.length !== filtered.length && ` (${vendas.length} total)`}
              </p>
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
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <select
                value={filterCanal}
                onChange={e => setFilterCanal(e.target.value)}
                className="h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Todos canais</option>
                {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
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
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">Erro ao carregar vendas</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox"
                          checked={selectedIds.size === paginatedFiltered.length && paginatedFiltered.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-border" />
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
                      <tr key={venda.id}
                        className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${selectedIds.has(venda.id) ? "bg-primary/5" : ""}`}>
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
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateDisplay(venda.data_venda)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => cloneVenda(venda)} title="Clonar venda"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                              <Copy className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openEdit(venda)} title="Editar"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setDeleteConfirm(venda)} title="Excluir"
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
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
                    Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registros
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5)          pageNum = i + 1
                      else if (page <= 3)           pageNum = i + 1
                      else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                      else                          pageNum = page - 2 + i
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
                  <Label>Codigo <span className="text-destructive">*</span></Label>
                  <Input placeholder="Codigo da venda" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Data <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.data_venda} onChange={e => setForm({ ...form, data_venda: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente <span className="text-destructive">*</span></Label>
                  <select className={selectClass} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                    <option value="">Selecione ou digite</option>
                    {clientesLista.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Nome Cliente (manual)</Label>
                  <Input placeholder="Digite se nao encontrar na lista" value={form.cliente_nome} onChange={e => setForm({ ...form, cliente_nome: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor Total <span className="text-destructive">*</span></Label>
                  <Input placeholder="0,00" value={form.valor_total} onChange={e => setForm({ ...form, valor_total: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Acrescimo</Label>
                  <Input placeholder="0,00" value={form.acrescimo} onChange={e => setForm({ ...form, acrescimo: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Taxas Marketplace</Label>
                  <Input placeholder="0,00" value={form.taxas_marketplace} onChange={e => setForm({ ...form, taxas_marketplace: handleCurrencyInput(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input placeholder="0,00" value={form.desconto} onChange={e => setForm({ ...form, desconto: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Valor Recebido</Label>
                  <Input placeholder="Calculado automaticamente" value={form.valor_recebido} onChange={e => setForm({ ...form, valor_recebido: handleCurrencyInput(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Forma Pagamento <span className="text-destructive">*</span></Label>
                  <select className={selectClass} value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}>
                    <option value="">Selecione</option>
                    {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Canal <span className="text-destructive">*</span></Label>
                  <select className={selectClass} value={form.canal} onChange={e => setForm({ ...form, canal: e.target.value })}>
                    <option value="">Selecione</option>
                    {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Observacoes</Label>
                  <Input placeholder="Observacoes" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <button type="button" onClick={() => setDialogOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete single */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir venda</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a venda {deleteConfirm?.codigo}? Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete multiple */}
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
              <AlertDialogAction onClick={handleDeleteMultiple}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                <div onClick={() => importFileRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
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
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); if (e.target) e.target.value = "" }}
                />
              </div>
            )}

            {importRows.length > 0 && !importResult && (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {importRows.length} {importRows.length === 1 ? "venda encontrada" : "vendas encontradas"}
                  </p>
                  <button type="button" onClick={() => setImportRows([])}
                    className="text-xs text-muted-foreground hover:text-foreground">
                    Trocar arquivo
                  </button>
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
                      {importRows.map((row, i) => (
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
                <DialogFooter>
                  <button type="button" onClick={() => setImportOpen(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleImportSave} disabled={importing}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
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
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground text-center">
                    <div className="flex gap-4">
                      <span><strong className="text-foreground">{importResult.created}</strong> vendas criadas</span>
                      {importResult.skipped > 0 && <span><strong className="text-foreground">{importResult.skipped}</strong> ignoradas</span>}
                    </div>
                    {importResult.skipped > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Vendas ignoradas: sem valor total válido.<br/>
                        Códigos duplicados são permitidos para bater o caixa.<br/>
                        Verifique o console (F12) para mais detalhes.
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <button type="button" onClick={() => setImportOpen(false)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    Fechar
                  </button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
