"use client"

import { useState, useRef, useCallback, useMemo, type DragEvent, type ChangeEvent } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { parseOFX, type OFXTransaction, type OFXData } from "@/lib/ofx-parser"
import { parseCSV, parseXLSX, spreadsheetToOFXTransactions } from "@/lib/spreadsheet-parser"
import { useTenant } from "@/hooks/use-tenant"
import { handleCurrencyInput, parseBRL, formatBRL } from "@/lib/currency-input"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Check,
  Zap,
  Save,
  Trash2,
  X,
  Landmark,
  RotateCcw,
  Loader2,
  Plus,
  Copy,
  Pencil,
  Download,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

// ---------- Helper Functions ----------

// Recalcula e atualiza o saldo de uma conta bancaria
async function recalcularSaldoConta(contaId: number) {
  if (!contaId) return
  const supabase = createClient()
  // Busca saldo inicial da conta
  const { data: conta } = await supabase.from("contas_bancarias").select("saldo_inicial").eq("id", contaId).single()
  if (!conta) return
  const saldoInicial = Number(conta.saldo_inicial) || 0
  
  // Busca transacoes de contas_pagar (saidas pagas)
  const { data: despesas } = await supabase.from("contas_pagar").select("valor").eq("conta_bancaria_id", contaId).eq("status", "pago")
  // Busca transacoes de contas_receber (entradas recebidas)
  const { data: receitas } = await supabase.from("contas_receber").select("valor").eq("conta_bancaria_id", contaId).eq("status", "recebido")
  // Busca lancamentos manuais
  const { data: lancamentos } = await supabase.from("lancamentos").select("valor, tipo").eq("conta_bancaria_id", contaId)
  
  let entradas = 0, saidas = 0
  for (const l of lancamentos || []) {
    if (l.tipo === "receita") entradas += Number(l.valor)
    else saidas += Number(l.valor)
  }
  for (const r of receitas || []) entradas += Number(r.valor)
  for (const d of despesas || []) saidas += Number(d.valor)
  
  const novoSaldo = saldoInicial + entradas - saidas
  await supabase.from("contas_bancarias").update({ saldo: novoSaldo }).eq("id", contaId)
}

// ---------- Types ----------

interface CategoriaRow { id: number; nome: string; tipo: string }
interface SubcategoriaRow { id: number; nome: string; categoria_id: number }
interface SubcategoriaFilhoRow { id: number; nome: string; subcategoria_id: number }

interface ContaBancariaRow { id: number; nome: string; tipo: string }
interface FornecedorRow { id: number; nome: string }
interface ClienteRow { id: number; nome: string }

interface TransactionSplit {
  id: string // temporary UUID for UI
  valor: number
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  fornecedor_id?: number | null
  cliente_id?: number | null
}

interface MappingRule {
  id: number
  keyword: string
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  fornecedor_id: number | null
  cliente_id: number | null
  cliente_fornecedor: string
  conta_bancaria_id?: number | null
  forma_pagamento?: string
  descricao?: string
  substituir_descricao?: boolean
  // Joined names for display
  categoria_nome?: string
  subcategoria_nome?: string
  filho_nome?: string
  fornecedor_nome?: string
  cliente_nome?: string
}

interface TransactionRow extends OFXTransaction {
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  fornecedor_id: number | null
  cliente_id: number | null
  clienteFornecedor: string
  selected: boolean
  isSplit?: boolean
  splits?: TransactionSplit[]
  forma_pagamento: string
  descricao_editada: string
}

interface ImportHistoryItem {
  id: number
  arquivo: string
  data: string
  registros: number
  status: "concluido" | "erro" | "processando"
  conta: string
  banco: string
}

// ---------- Supabase ----------

interface CategoriaHierarchy {
  categorias: CategoriaRow[]
  subcategorias: SubcategoriaRow[]
  filhos: SubcategoriaFilhoRow[]
}

async function fetchHierarchy(tid: number | null): Promise<CategoriaHierarchy> {
  const supabase = createClient()
  let catQ = supabase.from("categorias").select("id, nome, tipo").order("nome")
  let subQ = supabase.from("subcategorias").select("id, nome, categoria_id").order("nome")
  let filhoQ = supabase.from("subcategorias_filhos").select("id, nome, subcategoria_id").order("nome")
  if (tid) { catQ = catQ.eq("tenant_id", tid); subQ = subQ.eq("tenant_id", tid); filhoQ = filhoQ.eq("tenant_id", tid) }
  const [catRes, subRes, filhoRes] = await Promise.all([catQ, subQ, filhoQ])
  return {
    categorias: catRes.data || [],
    subcategorias: subRes.data || [],
    filhos: filhoRes.data || [],
  }
}

async function fetchContasBancarias(tid: number | null): Promise<ContaBancariaRow[]> {
  const supabase = createClient()
  let q = supabase.from("contas_bancarias").select("id, nome, tipo").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

async function fetchFornecedores(tid: number | null): Promise<FornecedorRow[]> {
  const supabase = createClient()
  let q = supabase.from("fornecedores").select("id, nome").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

async function fetchClientes(tid: number | null): Promise<ClienteRow[]> {
  const supabase = createClient()
  let q = supabase.from("clientes").select("id, nome").order("nome")
  if (tid) q = q.eq("tenant_id", tid)
  const { data } = await q
  return data || []
}

interface DespesaFixaRow {
  id: number
  descricao: string
  valor: number
  categoria_id: number | null
  subcategoria_id: number | null
  subcategoria_filho_id: number | null
  fornecedor_id: number | null
  conta_bancaria_id: number | null
  forma_pagamento: string
  ativa: boolean
}

async function fetchDespesasFixas(): Promise<DespesaFixaRow[]> {
  const supabase = createClient()
  const { data } = await supabase.from("despesas_fixas").select("*").eq("ativa", true)
  return (data || []).map((r) => ({
    id: r.id,
    descricao: r.descricao,
    valor: Number(r.valor),
    categoria_id: r.categoria_id,
    subcategoria_id: r.subcategoria_id,
    subcategoria_filho_id: r.subcategoria_filho_id,
    fornecedor_id: r.fornecedor_id,
    conta_bancaria_id: r.conta_bancaria_id,
    forma_pagamento: r.forma_pagamento || "",
    ativa: r.ativa,
  }))
}

async function fetchRules(tid: number | null): Promise<MappingRule[]> {
  const supabase = createClient()
  let q = supabase
    .from("mapping_rules")
    .select(`
      *,
      categorias(nome),
      subcategorias(nome),
      subcategorias_filhos(nome),
      fornecedores(nome),
      clientes(nome)
    `)
    .order("keyword")
  
  if (tid) q = q.eq("tenant_id", tid)

  const { data, error } = await q

  if (error) throw error

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    keyword: row.keyword as string,
    categoria_id: row.categoria_id as number | null,
    subcategoria_id: row.subcategoria_id as number | null,
    subcategoria_filho_id: row.subcategoria_filho_id as number | null,
    fornecedor_id: row.fornecedor_id as number | null,
    cliente_id: row.cliente_id as number | null,
    cliente_fornecedor: (row.cliente_fornecedor as string) || "",
    conta_bancaria_id: row.conta_bancaria_id as number | null,
    forma_pagamento: (row.forma_pagamento as string) || "",
    descricao: (row.descricao as string) || "",
    substituir_descricao: (row.substituir_descricao as boolean) || false,
    categoria_nome: (row.categorias as Record<string, string> | null)?.nome || "",
    subcategoria_nome: (row.subcategorias as Record<string, string> | null)?.nome || "",
    filho_nome: (row.subcategorias_filhos as Record<string, string> | null)?.nome || "",
    fornecedor_nome: (row.fornecedores as Record<string, string> | null)?.nome || "",
    cliente_nome: (row.clientes as Record<string, string> | null)?.nome || "",
  }))
}

// ---------- Helpers ----------

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function extractClienteFornecedor(memo: string): string {
  const remMatch = memo.match(/REM:\s*([A-Za-zÀ-ú\s]+?)(?:\s+\d{2}\/\d{2}|$)/i)
  if (remMatch) return remMatch[1].trim()
  const desMatch = memo.match(/DES:\s*([A-Za-zÀ-ú\s]+?)(?:\s+\d{2}\/\d{2}|$)/i)
  if (desMatch) return desMatch[1].trim()
  const compraMatch = memo.match(/(?:COMPRA\s+\w+\s+\w+\s+\w+\s+)(.*)/i)
  if (compraMatch) return compraMatch[1].trim()
  return ""
}

function extractKeywordsFromMemo(memo: string): string[] {
  const keywords: string[] = []
  const compraMatch = memo.match(/(?:COMPRA\s+\w+\s+\w+\s+\w+\s+)([\w*\s]+)/i)
  if (compraMatch) {
    const store = compraMatch[1].trim()
    if (store.length >= 3) keywords.push(store.split(/\s/)[0])
  }
  const desMatch = memo.match(/DES:\s*([\w\s*]+?)(?:\s+\d{2}\/\d{2}|$)/i)
  if (desMatch) {
    const name = desMatch[1].trim().split(/\s/)[0]
    if (name.length >= 3) keywords.push(name)
  }
  return keywords
}

// ---------- Dropdown Component ----------

function InlineDropdown({
  value,
  options,
  onChange,
  placeholder,
  width = "w-40",
}: {
  value: string
  options: { label: string; value: string }[]
  onChange: (val: string) => void
  placeholder: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
  const displayLabel = options.find((o) => o.value === value)?.label || ""

  return (
    <div className={`relative ${width}`} ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch("") }}
        className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs transition-colors ${
          value ? "border-border text-card-foreground" : "border-dashed border-muted-foreground/40 text-muted-foreground"
        } hover:border-primary/50 bg-card`}
      >
        <span className="truncate">{displayLabel || placeholder}</span>
        <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-xl">
            <div className="px-2 pb-1">
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(""); setOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                  Limpar
                </button>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted ${
                    value === opt.value ? "font-medium text-primary" : "text-card-foreground"
                  }`}
                >
                  {value === opt.value && <Check className="h-3 w-3 text-primary" />}
                  {opt.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Main Page ----------

export default function ImportarTransacoesPage() {
  const { tenant } = useTenant()
  const tid = tenant?.id ?? null

  const { data: hierarchy } = useSWR(["hierarchy_importar", tid], ([, t]) => fetchHierarchy(t as number | null))
  const { data: rules, mutate: mutateRules } = useSWR(["mapping_rules", tid], ([, t]) => fetchRules(t as number | null))
  const { data: contasBancarias = [] } = useSWR(["contas_bancarias_importar", tid], ([, t]) => fetchContasBancarias(t))
  const { data: fornecedoresLista = [] } = useSWR(["fornecedores_importar", tid], ([, t]) => fetchFornecedores(t))
  const { data: clientesLista = [] } = useSWR(["clientes_importar", tid], ([, t]) => fetchClientes(t))
  const { data: despesasFixas = [] } = useSWR("despesas_fixas_importar", fetchDespesasFixas)

  // State
  const [selectedContaBancariaId, setSelectedContaBancariaId] = useState<string>("")
  const [step, setStep] = useState<"upload" | "review" | "done">("upload")
  const [ofxData, setOfxData] = useState<OFXData | null>(null)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [history, setHistory] = useState<ImportHistoryItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState("")
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false)
  const [selectAll, setSelectAll] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Split dialog state
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [splitTransactionIdx, setSplitTransactionIdx] = useState<number | null>(null)
  const [splitEntries, setSplitEntries] = useState<TransactionSplit[]>([])
  const [splitDisplayValues, setSplitDisplayValues] = useState<Record<string, string>>({})

  // Rule editing state
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set())
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null)
  const [ruleEditDialogOpen, setRuleEditDialogOpen] = useState(false)

  const allRules = rules || []

  // Category options for dropdowns
  const catOptions = useMemo(
    () => (hierarchy?.categorias || []).map((c) => ({ label: c.nome, value: c.id.toString() })),
    [hierarchy]
  )

  const getSubcatOptions = useCallback(
    (catId: string) => (hierarchy?.subcategorias || []).filter((s) => s.categoria_id === Number(catId)).map((s) => ({ label: s.nome, value: s.id.toString() })),
    [hierarchy]
  )

  const getFilhoOptions = useCallback(
    (subId: string) => (hierarchy?.filhos || []).filter((f) => f.subcategoria_id === Number(subId)).map((f) => ({ label: f.nome, value: f.id.toString() })),
    [hierarchy]
  )

  // Lookup maps
  const catNameMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const c of hierarchy?.categorias || []) m[c.id] = c.nome
    return m
  }, [hierarchy])

  const subNameMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const s of hierarchy?.subcategorias || []) m[s.id] = s.nome
    return m
  }, [hierarchy])

  const filhoNameMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const f of hierarchy?.filhos || []) m[f.id] = f.nome
    return m
  }, [hierarchy])

  // Computed
  const totalImportados = history.filter((h) => h.status === "concluido").reduce((a, h) => a + h.registros, 0)
  const selectedTxs = transactions.filter((t) => t.selected)
  const selectedEntradas = selectedTxs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0)
  const selectedSaidas = selectedTxs.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0)

  // Auto-match a transaction against saved rules and despesas fixas
  const applyRules = useCallback(
    (tx: OFXTransaction): { categoria_id: number | null; subcategoria_id: number | null; subcategoria_filho_id: number | null; fornecedor_id: number | null; cliente_id: number | null; clienteFornecedor: string } => {
      const memoUpper = tx.memo.toUpperCase()

      // First try mapping rules
      for (const rule of allRules) {
        if (memoUpper.includes(rule.keyword.toUpperCase())) {
          return {
            categoria_id: rule.categoria_id,
            subcategoria_id: rule.subcategoria_id,
            subcategoria_filho_id: rule.subcategoria_filho_id,
            fornecedor_id: rule.fornecedor_id,
            cliente_id: rule.cliente_id,
            clienteFornecedor: rule.cliente_fornecedor || extractClienteFornecedor(tx.memo),
          }
        }
      }

      // Then try despesas fixas auto-match (only for debits)
      if (tx.amount < 0) {
        for (const df of despesasFixas) {
          const descUpper = df.descricao.toUpperCase()
          // Check if memo contains key words from the despesa fixa description
          const words = descUpper.split(/\s+/).filter((w) => w.length >= 4)
          if (words.some((w) => memoUpper.includes(w))) {
            const fornNome = df.fornecedor_id ? fornecedoresLista.find((f) => f.id === df.fornecedor_id)?.nome || "" : ""
            return {
              categoria_id: df.categoria_id,
              subcategoria_id: df.subcategoria_id,
              subcategoria_filho_id: df.subcategoria_filho_id,
              fornecedor_id: df.fornecedor_id,
              cliente_id: null,
              clienteFornecedor: fornNome || extractClienteFornecedor(tx.memo),
            }
          }
        }
      }

      return { categoria_id: null, subcategoria_id: null, subcategoria_filho_id: null, fornecedor_id: null, cliente_id: null, clienteFornecedor: extractClienteFornecedor(tx.memo) }
    },
    [allRules, despesasFixas, fornecedoresLista]
  )

  // Process file — suporta OFX, CSV e XLS/XLSX
  async function processFile(file: File) {
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? ""
      const supported = ["ofx", "csv", "xls", "xlsx"]
      if (!supported.includes(ext)) {
        alert("Por favor selecione um arquivo .OFX, .CSV, .XLS ou .XLSX")
        return
      }
      if (!selectedContaBancariaId) {
        alert("Selecione uma conta bancaria antes de importar o extrato.")
        return
      }
      setFileName(file.name)

      let txs: OFXTransaction[] = []
      let parsedOFX: OFXData | null = null

      if (ext === "ofx") {
        const content = await readFileAsText(file, "ISO-8859-1")
        parsedOFX = parseOFX(content)
        txs = parsedOFX.transactions
      } else if (ext === "csv") {
        let content = await readFileAsText(file, "UTF-8")
        const firstLine = content.split("\n")[0] || ""
        if (!firstLine.includes(";") && !firstLine.includes(",")) {
          content = await readFileAsText(file, "ISO-8859-1")
        }
        const parsed = parseCSV(content)
        txs = spreadsheetToOFXTransactions(parsed)
      } else {
        const buffer = await file.arrayBuffer()
        const rows = await parseXLSX(buffer)
        txs = spreadsheetToOFXTransactions(rows)
      }

      setOfxData(parsedOFX)

      // Função para normalizar texto (remove acentos e converte para minúsculo)
      function normalizeText(text: string): string {
        return text
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      }

      // Mapas para match por nome (case-insensitive, sem acentos)
      const fornecedorList = fornecedoresLista.map(f => ({ id: f.id, key: normalizeText(f.nome), original: f.nome }))
      const clienteList = clientesLista.map(c => ({ id: c.id, key: normalizeText(c.nome), original: c.nome }))
      const categoriaList = (hierarchy?.categorias || []).map(c => ({ id: c.id, key: normalizeText(c.nome), original: c.nome }))
      const subcategoriaList = (hierarchy?.subcategorias || []).map(s => ({ id: s.id, categoria_id: s.categoria_id, key: normalizeText(s.nome), original: s.nome }))

      console.log("[v0] DEBUG - Categorias no banco:", categoriaList.map(c => ({ id: c.id, key: c.key, original: c.original })))
      console.log("[v0] DEBUG - Subcategorias no banco:", subcategoriaList.map(s => ({ id: s.id, key: s.key, original: s.original })))

      function matchByName(list: { id: number; key: string }[], search: string): number | null {
        const s = normalizeText(search)
        if (!s) return null
        // 1. Match exato
        const exact = list.find(item => item.key === s)
        if (exact) return exact.id
        // 2. Search contem item (ex: "Compra de Prod Sicredi" contem "Compra de Prod")
        const partial = list.find(item => s.includes(item.key))
        if (partial) return partial.id
        // 3. Item contem search
        const reverse = list.find(item => item.key.includes(s))
        if (reverse) return reverse.id
        return null
      }



      const rows: TransactionRow[] = txs
        .map((tx) => {
          const extra = tx as OFXTransaction & { _fornecedor?: string; _planoConta?: string; _subcategoria?: string; _formaPagamento?: string; _banco?: string }
          const isDebit = tx.amount < 0 // Saída/despesa
          
          let fornecedor_id: number | null = null
          let clienteFornecedor = ""
          let categoria_id: number | null = null
          let subcategoria_id: number | null = null
          let subcategoria_filho_id: number | null = null
          let cliente_id: number | null = null
          
          // 1. Match cliente/fornecedor pelo nome do CSV
          if (extra._fornecedor) {
            const searchTerm = extra._fornecedor.trim()
            clienteFornecedor = searchTerm
            
            if (isDebit) {
              // Para despesas, procura em fornecedores
              fornecedor_id = matchByName(fornecedorList, searchTerm)
            } else {
              // Para receitas, procura em clientes
              cliente_id = matchByName(clienteList, searchTerm)
            }
          }

          // 2. Match categoria pelo plano de conta do CSV
          if (extra._planoConta) {
            console.log("[v0] DEBUG - Buscando categoria:", extra._planoConta, "normalizado:", normalizeText(extra._planoConta))
            categoria_id = matchByName(categoriaList, extra._planoConta)
            console.log("[v0] DEBUG - Categoria encontrada:", categoria_id)
          }

          // 3. Match subcategoria pelo nome da planilha
          if (extra._subcategoria) {
            console.log("[v0] DEBUG - Buscando subcategoria:", extra._subcategoria, "normalizado:", normalizeText(extra._subcategoria))
            const subcatSearch = normalizeText(extra._subcategoria)
            // Se já tem categoria, filtra subcategorias dessa categoria
            if (categoria_id) {
              const subcatMatch = subcategoriaList.find(s => s.categoria_id === categoria_id && (s.key.includes(subcatSearch) || subcatSearch.includes(s.key)))
              if (subcatMatch) subcategoria_id = subcatMatch.id
            } else {
              // Se não tem categoria, procura em todas subcategorias
              const subcatMatch = subcategoriaList.find(s => s.key.includes(subcatSearch) || subcatSearch.includes(s.key))
              if (subcatMatch) {
                subcategoria_id = subcatMatch.id
                // Preenche a categoria correspondente
                categoria_id = subcatMatch.categoria_id
              }
            }
          }

          // 4. Aplica regras automaticas como fallback (se planilha nao mapeou)
          const matched = applyRules(tx)
          if (!fornecedor_id && matched.fornecedor_id) fornecedor_id = matched.fornecedor_id
          if (!cliente_id && matched.cliente_id) cliente_id = matched.cliente_id
          if (!clienteFornecedor) clienteFornecedor = matched.clienteFornecedor || extractClienteFornecedor(tx.memo)
          if (!categoria_id && matched.categoria_id) categoria_id = matched.categoria_id
          if (!subcategoria_id && matched.subcategoria_id) subcategoria_id = matched.subcategoria_id
          if (!subcategoria_filho_id && matched.subcategoria_filho_id) subcategoria_filho_id = matched.subcategoria_filho_id

          // 4. Detecta forma de pagamento automaticamente (para ambos)
          let forma_pagamento = extra._formaPagamento || ""
          if (!forma_pagamento) {
            const memoLower = tx.memo.toLowerCase()
            if (memoLower.includes("pix")) forma_pagamento = "PIX"
            else if (memoLower.includes("ted") || memoLower.includes("transf")) forma_pagamento = "Transferência"
            else if (memoLower.includes("boleto")) forma_pagamento = "Boleto"
            else if (memoLower.includes("cheque")) forma_pagamento = "Cheque"
          }

          return {
            ...tx,
            categoria_id,
            subcategoria_id,
            subcategoria_filho_id,
            fornecedor_id,
            cliente_id,
            clienteFornecedor,
            selected: tx.amount !== 0,
            forma_pagamento,
            descricao_editada: tx.memo,
          }
        })
        .filter((tx) => tx.amount !== 0)

      setTransactions(rows)
      setSelectAll(true)
      setStep("review")
    } catch (err) {
      console.error("[v0] ERRO processFile:", err)
      alert("Erro ao processar arquivo: " + (err instanceof Error ? err.message : String(err)))
    }
  }

  function readFileAsText(file: File, encoding = "UTF-8"): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file, encoding)
    })
  }

  // Drag events
  function handleDragOver(e: DragEvent) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave() { setIsDragging(false) }
  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file).catch(() => {})
  }
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file).catch(() => {})
    if (e.target) e.target.value = ""
  }

  // Update transaction fields
  function updateTx(idx: number, field: keyof TransactionRow, value: string | boolean | number | null) {
    setTransactions((prev) => {
      const next = [...prev]
      const updated = { ...next[idx], [field]: value }
      if (field === "categoria_id") {
        // Reset children when parent changes
        const subs = (hierarchy?.subcategorias || []).filter((s) => s.categoria_id === Number(value))
        if (!subs.find((s) => s.id === updated.subcategoria_id)) {
          updated.subcategoria_id = null
          updated.subcategoria_filho_id = null
        }
      }
      if (field === "subcategoria_id") {
        const filhos = (hierarchy?.filhos || []).filter((f) => f.subcategoria_id === Number(value))
        if (!filhos.find((f) => f.id === updated.subcategoria_filho_id)) {
          updated.subcategoria_filho_id = null
        }
      }
      next[idx] = updated
      return next
    })
  }

  function toggleSelectAll() {
    const newVal = !selectAll
    setSelectAll(newVal)
    setTransactions((prev) => prev.map((t) => ({ ...t, selected: newVal })))
  }

  // Split transaction handlers
  function openSplitDialog(idx: number) {
    setSplitTransactionIdx(idx)
    const tx = transactions[idx]
    if (tx.splits && tx.splits.length > 0) {
      setSplitEntries([...tx.splits])
      const displayVals: Record<string, string> = {}
      for (const s of tx.splits) {
        displayVals[s.id] = formatBRL(s.valor)
      }
      setSplitDisplayValues(displayVals)
    } else {
      setSplitEntries([])
      setSplitDisplayValues({})
    }
    setSplitDialogOpen(true)
  }

  function closeSplitDialog() {
    setSplitDialogOpen(false)
    setSplitTransactionIdx(null)
    setSplitEntries([])
    setSplitDisplayValues({})
  }

  function addSplitEntry() {
    const newEntry: TransactionSplit = {
      id: Math.random().toString(36).substr(2, 9),
      valor: 0,
      categoria_id: null,
      subcategoria_id: null,
      subcategoria_filho_id: null,
    }
    setSplitEntries([...splitEntries, newEntry])
    setSplitDisplayValues((prev) => ({ ...prev, [newEntry.id]: "" }))
  }

  function removeSplitEntry(entryId: string) {
    setSplitEntries(splitEntries.filter((e) => e.id !== entryId))
    setSplitDisplayValues((prev) => {
      const next = { ...prev }
      delete next[entryId]
      return next
    })
  }

  function updateSplitValor(entryId: string, inputValue: string) {
    const formatted = handleCurrencyInput(inputValue)
    setSplitDisplayValues((prev) => ({ ...prev, [entryId]: formatted }))
    const numericValue = parseBRL(formatted)
    setSplitEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, valor: numericValue } : e))
    )
  }

  function updateSplitEntry(entryId: string, field: keyof TransactionSplit, value: number | string | null) {
    setSplitEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e
        const updated = { ...e, [field]: value }
        if (field === "categoria_id") {
          const subs = (hierarchy?.subcategorias || []).filter((s) => s.categoria_id === Number(value))
          if (!subs.find((s) => s.id === updated.subcategoria_id)) {
            updated.subcategoria_id = null
            updated.subcategoria_filho_id = null
          }
        }
        if (field === "subcategoria_id") {
          const filhos = (hierarchy?.filhos || []).filter((f) => f.subcategoria_id === Number(value))
          if (!filhos.find((f) => f.id === updated.subcategoria_filho_id)) {
            updated.subcategoria_filho_id = null
          }
        }
        return updated
      })
    )
  }

  function saveSplit() {
    if (splitTransactionIdx === null) return
    const tx = transactions[splitTransactionIdx]
    const totalSplit = splitEntries.reduce((sum, e) => sum + e.valor, 0)
    if (Math.abs(totalSplit - Math.abs(tx.amount)) > 0.01) {
      alert(`Total das divisoes (R$ ${formatBRL(totalSplit)}) nao bate com o valor original (R$ ${formatBRL(Math.abs(tx.amount))})`)
      return
    }
    const updated = { ...tx, isSplit: true, splits: [...splitEntries] }
    const newTransactions = [...transactions]
    newTransactions[splitTransactionIdx] = updated
    setTransactions(newTransactions)
    closeSplitDialog()
  }

  // Save rules from current mapping to Supabase
  async function saveNewRules() {
    if (!tid) return // Não salva regras sem tenant
    const supabase = createClient()
    const existingKeywords = new Set(allRules.map((r) => r.keyword.toUpperCase()))
    const newRuleInserts: { keyword: string; categoria_id: number | null; subcategoria_id: number | null; subcategoria_filho_id: number | null; fornecedor_id: number | null; cliente_id: number | null; cliente_fornecedor: string; tenant_id: number }[] = []

    for (const tx of transactions) {
      if (tx.categoria_id && tx.memo) {
        const keywords = extractKeywordsFromMemo(tx.memo)
        for (const kw of keywords) {
          if (!existingKeywords.has(kw.toUpperCase()) && kw.length >= 3) {
            existingKeywords.add(kw.toUpperCase())
            newRuleInserts.push({
              keyword: kw,
              categoria_id: tx.categoria_id,
              subcategoria_id: tx.subcategoria_id,
              subcategoria_filho_id: tx.subcategoria_filho_id,
              fornecedor_id: tx.fornecedor_id,
              cliente_id: tx.cliente_id,
              cliente_fornecedor: tx.clienteFornecedor,
              tenant_id: tid,
            })
          }
        }
      }
    }

    if (newRuleInserts.length > 0) {
      await supabase.from("mapping_rules").insert(newRuleInserts)
      await mutateRules()
    }
  }

  // Confirm import - save transactions to contas_pagar/contas_receber
  async function confirmImport() {
    const supabase = createClient()
    setSaving(true)
    try {
      await saveNewRules()

      const selected = transactions.filter((t) => t.selected)
      const despesas = selected.filter((t) => t.amount < 0)
      const receitas = selected.filter((t) => t.amount >= 0)

      const contaBancariaId = selectedContaBancariaId ? Number(selectedContaBancariaId) : null

      if (despesas.length > 0) {
        const despesasToInsert = []
        for (const tx of despesas) {
          const descricaoFinal = tx.descricao_editada || tx.memo
          if (tx.isSplit && tx.splits && tx.splits.length > 0) {
            for (const split of tx.splits) {
              despesasToInsert.push({
                descricao: descricaoFinal,
                valor: Math.abs(split.valor),
                vencimento: tx.date.split("/").reverse().join("-"),
                status: "pago",
                fornecedor: split.fornecedor_id ? fornecedoresLista.find((f) => f.id === split.fornecedor_id)?.nome || tx.clienteFornecedor : tx.clienteFornecedor,
                fornecedor_id: split.fornecedor_id,
                categoria_id: split.categoria_id,
                subcategoria_id: split.subcategoria_id,
                subcategoria_filho_id: split.subcategoria_filho_id,
                conta_bancaria_id: contaBancariaId,
                forma_pagamento: tx.forma_pagamento || null,
                tenant_id: tid,
              })
            }
          } else {
            const fornNome = tx.fornecedor_id ? fornecedoresLista.find((f) => f.id === tx.fornecedor_id)?.nome || tx.clienteFornecedor : tx.clienteFornecedor
            despesasToInsert.push({
              descricao: descricaoFinal,
              valor: Math.abs(tx.amount),
              vencimento: tx.date.split("/").reverse().join("-"),
              status: "pago",
              fornecedor: fornNome,
              fornecedor_id: tx.fornecedor_id,
              categoria_id: tx.categoria_id,
              subcategoria_id: tx.subcategoria_id,
              subcategoria_filho_id: tx.subcategoria_filho_id,
              conta_bancaria_id: contaBancariaId,
              forma_pagamento: tx.forma_pagamento || null,
              tenant_id: tid,
            })
          }
        }
        await supabase.from("contas_pagar").insert(despesasToInsert)
      }

      if (receitas.length > 0) {
        const receitasToInsert = []
        for (const tx of receitas) {
          const descricaoFinal = tx.descricao_editada || tx.memo
          if (tx.isSplit && tx.splits && tx.splits.length > 0) {
            for (const split of tx.splits) {
              receitasToInsert.push({
                descricao: descricaoFinal,
                valor: split.valor,
                vencimento: tx.date.split("/").reverse().join("-"),
                status: "recebido",
                cliente: split.cliente_id ? clientesLista.find((c) => c.id === split.cliente_id)?.nome || tx.clienteFornecedor : tx.clienteFornecedor,
                cliente_id: split.cliente_id,
                categoria_id: split.categoria_id,
                subcategoria_id: split.subcategoria_id,
                subcategoria_filho_id: split.subcategoria_filho_id,
                conta_bancaria_id: contaBancariaId,
                forma_pagamento: tx.forma_pagamento || null,
                tenant_id: tid,
              })
            }
          } else {
            const cliNome = tx.cliente_id ? clientesLista.find((c) => c.id === tx.cliente_id)?.nome || tx.clienteFornecedor : tx.clienteFornecedor
            receitasToInsert.push({
              descricao: descricaoFinal,
              valor: tx.amount,
              vencimento: tx.date.split("/").reverse().join("-"),
              status: "recebido",
              cliente: cliNome,
              cliente_id: tx.cliente_id,
              categoria_id: tx.categoria_id,
              subcategoria_id: tx.subcategoria_id,
              subcategoria_filho_id: tx.subcategoria_filho_id,
              conta_bancaria_id: contaBancariaId,
              forma_pagamento: tx.forma_pagamento || null,
              tenant_id: tid,
            })
          }
        }
        await supabase.from("contas_receber").insert(receitasToInsert)
      }

      // Recalcula saldo da conta bancaria apos importacao
      if (contaBancariaId) {
        await recalcularSaldoConta(Number(contaBancariaId))
      }

      const newEntry: ImportHistoryItem = {
        id: Date.now(),
        arquivo: fileName,
        data: new Date().toLocaleDateString("pt-BR"),
        registros: selected.length,
        status: "concluido",
        conta: ofxData?.accountId || "",
        banco: ofxData?.bankName || "",
      }
      setHistory((prev) => [newEntry, ...prev])
      setStep("done")
    } finally {
      setSaving(false)
    }
  }

  function resetImport() {
    setStep("upload")
    setOfxData(null)
    setTransactions([])
    setFileName("")
    setSelectedContaBancariaId("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function deleteRule(id: number) {
    const supabase = createClient()
    await supabase.from("mapping_rules").delete().eq("id", id)
    await mutateRules()
  }

  async function deleteSelectedRules() {
    if (selectedRules.size === 0) return
    if (!confirm(`Tem certeza que deseja excluir ${selectedRules.size} regra(s)?`)) return
    const supabase = createClient()
    const ids = Array.from(selectedRules)
    await supabase.from("mapping_rules").delete().in("id", ids)
    setSelectedRules(new Set())
    await mutateRules()
  }

  function cloneRule(rule: MappingRule) {
    const cloned: MappingRule = {
      ...rule,
      id: 0, // Will be assigned by DB
      keyword: rule.keyword + " (copia)",
      descricao: (rule.descricao || "") + " (copia)",
    }
    setEditingRule(cloned)
    setRuleEditDialogOpen(true)
  }

  function openEditRule(rule: MappingRule) {
    setEditingRule({ ...rule })
    setRuleEditDialogOpen(true)
  }

  function createNewRule() {
    const newRule: MappingRule = {
      id: 0, // Will be assigned by DB
      keyword: "",
      categoria_id: null,
      subcategoria_id: null,
      subcategoria_filho_id: null,
      fornecedor_id: null,
      cliente_id: null,
      cliente_fornecedor: "",
      conta_bancaria_id: null,
      forma_pagamento: "",
      descricao: "",
      substituir_descricao: false,
    }
    setEditingRule(newRule)
    setRuleEditDialogOpen(true)
  }

  function exportRule(rule: MappingRule) {
    const data = {
      keyword: rule.keyword,
      descricao: rule.descricao,
      categoria: rule.categoria_nome,
      subcategoria: rule.subcategoria_nome,
      subcategoria_filho: rule.filho_nome,
      cliente_fornecedor: rule.cliente_fornecedor,
      forma_pagamento: rule.forma_pagamento,
    }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `regra-${rule.keyword.replace(/[^a-z0-9]/gi, "_")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveEditedRule() {
    if (!editingRule) return
    const supabase = createClient()
    
    const ruleData = {
      keyword: editingRule.keyword,
      categoria_id: editingRule.categoria_id,
      subcategoria_id: editingRule.subcategoria_id,
      subcategoria_filho_id: editingRule.subcategoria_filho_id,
      fornecedor_id: editingRule.fornecedor_id,
      cliente_id: editingRule.cliente_id,
      cliente_fornecedor: editingRule.cliente_fornecedor,
      conta_bancaria_id: editingRule.conta_bancaria_id,
      forma_pagamento: editingRule.forma_pagamento,
      descricao: editingRule.descricao,
      substituir_descricao: editingRule.substituir_descricao,
      tenant_id: tid,
    }

    if (editingRule.id === 0) {
      // New rule (clone)
      await supabase.from("mapping_rules").insert(ruleData)
    } else {
      // Update existing
      await supabase.from("mapping_rules").update(ruleData).eq("id", editingRule.id)
    }

    await mutateRules()
    setRuleEditDialogOpen(false)
    setEditingRule(null)
  }

  function reapplyRules() {
    setTransactions((prev) =>
      prev.map((tx) => {
        const matched = applyRules(tx)
        return {
          ...tx,
          categoria_id: matched.categoria_id || tx.categoria_id,
          subcategoria_id: matched.subcategoria_id || tx.subcategoria_id,
          subcategoria_filho_id: matched.subcategoria_filho_id || tx.subcategoria_filho_id,
          fornecedor_id: matched.fornecedor_id || tx.fornecedor_id,
          cliente_id: matched.cliente_id || tx.cliente_id,
          clienteFornecedor: matched.clienteFornecedor || tx.clienteFornecedor,
        }
      })
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Importar Transacoes" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Total Importados</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{totalImportados}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Importacoes</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{history.length}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Regras Salvas</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{allRules.length}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(38,92%,50%)]">
                  <Zap className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Bancos Importados</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{new Set(history.map((h) => h.banco)).size}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,20%,60%)]">
                  <ArrowLeftRight className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Conta Bancaria Selector - show on upload and review */}
            {(step === "upload" || step === "review") && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Landmark className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="conta_bancaria_import" className="text-sm font-semibold text-card-foreground">Conta Bancaria</label>
                    <p className="text-xs text-muted-foreground">Selecione a conta bancaria associada a esta importacao</p>
                  </div>
                  <select
                    id="conta_bancaria_import"
                    value={selectedContaBancariaId}
                    onChange={(e) => setSelectedContaBancariaId(e.target.value)}
                    className="w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Selecione uma conta...</option>
                    {contasBancarias.map((cb) => (
                      <option key={cb.id} value={cb.id}>{cb.nome} ({cb.tipo})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* ==================== STEP: UPLOAD ==================== */}
            {step === "upload" && (
              <>
                {/* Warning: no bank account */}
                {!selectedContaBancariaId && (
                  <div className="flex items-center gap-3 rounded-lg border border-[hsl(0,72%,51%)]/30 bg-[hsl(0,72%,51%)]/5 px-4 py-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-[hsl(0,72%,51%)]" />
                    <p className="text-sm text-[hsl(0,72%,51%)]">
                      <strong>Atenção:</strong> Selecione uma conta bancaria acima antes de importar o extrato. Sem a conta selecionada, a importacao sera bloqueada.
                    </p>
                  </div>
                )}

                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card p-12 text-center shadow-sm transition-colors ${
                    isDragging ? "border-primary bg-primary/5" : !selectedContaBancariaId ? "border-border opacity-50 cursor-not-allowed" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full ${isDragging ? "bg-primary/20" : "bg-primary/10"}`}>
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-card-foreground">
                    Arraste seu arquivo aqui ou clique para selecionar
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Formatos suportados: <span className="font-medium text-foreground">.OFX</span>, <span className="font-medium text-foreground">.CSV</span>, <span className="font-medium text-foreground">.XLS</span>, <span className="font-medium text-foreground">.XLSX</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Colunas esperadas no CSV/Excel: DATA · DESCRICAO · VALOR · FORNECEDOR · F. PGTO · PLANO DE CONTA · BANCO
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ofx,.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                    className="hidden"
                    id="ofx-upload"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4" />
                      Selecionar Arquivo
                    </button>
                  </div>
                </div>

                {/* Rules Management */}
                <div className="rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div>
                      <h3 className="text-base font-semibold text-card-foreground">Regras de Classificacao Automatica</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Palavras-chave no extrato que serao automaticamente vinculadas a categorias e fornecedores
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRulesDialogOpen(true)}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Zap className="h-4 w-4 text-[hsl(38,92%,50%)]" />
                      Gerenciar Regras
                    </button>
                  </div>
                  <div className="divide-y divide-border">
                    {allRules.slice(0, 5).map((rule) => (
                      <div key={rule.id} className="flex items-center gap-4 px-5 py-3">
                        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono font-medium text-foreground">{rule.keyword}</span>
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-sm text-card-foreground">
                          {[rule.categoria_nome, rule.subcategoria_nome, rule.filho_nome].filter(Boolean).join(" > ")}
                        </span>
                        {rule.cliente_fornecedor && (
                          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            {rule.cliente_fornecedor}
                          </span>
                        )}
                      </div>
                    ))}
                    {allRules.length > 5 && (
                      <div className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setRulesDialogOpen(true)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Ver todas as {allRules.length} regras
                        </button>
                      </div>
                    )}
                    {allRules.length === 0 && (
                      <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                        Nenhuma regra cadastrada. Importe um arquivo e classifique as transacoes para criar regras automaticamente.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ==================== STEP: REVIEW ==================== */}
            {step === "review" && transactions.length > 0 && (
              <>
                {/* File info bar */}
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Landmark className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-card-foreground">{ofxData?.bankName ?? "Importacao CSV/Excel"}</p>
                      <p className="text-xs text-muted-foreground">
                        {ofxData ? <>Conta: {ofxData.accountId} &middot; Periodo: {ofxData.startDate} a {ofxData.endDate} &middot;</> : null} {fileName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(142,71%,40%)]/10 px-3 py-1.5">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-[hsl(142,71%,40%)]" />
                      <span className="text-xs font-medium text-[hsl(142,71%,40%)]">{formatCurrency(selectedEntradas)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(0,72%,51%)]/10 px-3 py-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(0,72%,51%)]" />
                      <span className="text-xs font-medium text-[hsl(0,72%,51%)]">{formatCurrency(selectedSaidas)}</span>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {selectedTxs.length} de {transactions.length} selecionadas
                    </span>
                  </div>
                </div>

                {/* Actions bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={reapplyRules}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                      <RotateCcw className="h-4 w-4" />
                      Reaplicar Regras
                    </button>
                    <button type="button" onClick={() => setRulesDialogOpen(true)}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                      <Zap className="h-4 w-4 text-[hsl(38,92%,50%)]" />
                      Regras ({allRules.length})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={resetImport}
                      className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                    <button type="button" onClick={confirmImport} disabled={selectedTxs.length === 0 || saving}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Importar {selectedTxs.length} Transacoes
                    </button>
                  </div>
                </div>

                {/* Transactions review table */}
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-2 py-3 text-left w-8">
                          <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="rounded border-border" />
                        </th>
                        <th className="px-2 py-3 text-left w-20">Data</th>
                        <th className="px-3 py-3 text-left min-w-[280px]">Descricao</th>
                        <th className="px-2 py-3 text-right w-24">Valor</th>
                        <th className="px-2 py-3 text-left">Categoria</th>
                        <th className="px-2 py-3 text-left">Subcategoria</th>
                        <th className="px-2 py-3 text-left">Cliente / Fornecedor</th>
                        <th className="px-2 py-3 text-left">F. Pagamento</th>
                        <th className="px-2 py-3 text-right w-16">Acoes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.map((tx, idx) => {
                        const isCredit = tx.amount >= 0
                        const subcats = getSubcatOptions(tx.categoria_id?.toString() || "")
                        const filhos = getFilhoOptions(tx.subcategoria_id?.toString() || "")
                        const isAutoMatched = tx.categoria_id !== null
                        const fornecedorOptions = fornecedoresLista.map(f => ({ label: f.nome, value: f.id.toString() }))
                        const clienteOptions = clientesLista.map(c => ({ label: c.nome, value: c.id.toString() }))
                        const formaPgtoOptions = [
                          { label: "PIX", value: "PIX" },
                          { label: "Boleto", value: "Boleto" },
                          { label: "Cartão de Crédito", value: "Cartão de Crédito" },
                          { label: "Cartão de Débito", value: "Cartão de Débito" },
                          { label: "Transferência", value: "Transferência" },
                          { label: "Débito em Conta", value: "Débito em Conta" },
                          { label: "Dinheiro", value: "Dinheiro" },
                          { label: "Cheque", value: "Cheque" },
                        ]
                        return (
                          <tr key={tx.fitId} className={`transition-colors hover:bg-muted/50 ${!tx.selected ? "opacity-40" : ""}`}>
                            <td className="px-2 py-2.5">
                              <input type="checkbox" checked={tx.selected} onChange={(e) => updateTx(idx, "selected", e.target.checked)} className="rounded border-border" />
                            </td>
                            <td className="px-2 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{tx.date}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isCredit ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(0,72%,51%)]/10"}`}>
                                  {isCredit ? <ArrowDownLeft className="h-3 w-3 text-[hsl(142,71%,40%)]" /> : <ArrowUpRight className="h-3 w-3 text-[hsl(0,72%,51%)]" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <input
                                    type="text"
                                    value={tx.descricao_editada || tx.memo}
                                    onChange={(e) => updateTx(idx, "descricao_editada", e.target.value)}
                                    className="w-full min-w-[240px] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-card-foreground outline-none hover:border-border focus:border-primary/50 focus:bg-background"
                                    title={tx.memo}
                                  />
                                  {isAutoMatched && !isCredit && <span className="text-[10px] text-[hsl(142,71%,40%)]">auto-classificado</span>}
                                </div>
                              </div>
                            </td>
                            <td className={`px-2 py-2.5 text-right text-sm font-semibold whitespace-nowrap ${isCredit ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>
                              {isCredit ? "+" : "-"} {formatCurrency(Math.abs(tx.amount))}
                            </td>
                            <td className="px-2 py-2.5">
                              <InlineDropdown
                                value={tx.categoria_id?.toString() || ""}
                                options={catOptions}
                                onChange={(val) => updateTx(idx, "categoria_id", val ? Number(val) : null)}
                                placeholder="Categoria..."
                                width="w-28"
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              <InlineDropdown
                                value={tx.subcategoria_id?.toString() || ""}
                                options={subcats}
                                onChange={(val) => updateTx(idx, "subcategoria_id", val ? Number(val) : null)}
                                placeholder={tx.categoria_id ? "Subcategoria..." : "-"}
                                width="w-32"
                              />
                            </td>
                            <td className="px-2 py-2.5">
                              {isCredit ? (
                                <InlineDropdown
                                  value={tx.cliente_id?.toString() || ""}
                                  options={clienteOptions}
                                  onChange={(val) => {
                                    const cId = val ? Number(val) : null
                                    const cNome = clientesLista.find((c) => c.id === cId)?.nome || ""
                                    updateTx(idx, "cliente_id", cId)
                                    updateTx(idx, "clienteFornecedor", cNome)
                                  }}
                                  placeholder="Cliente..."
                                  width="w-32"
                                />
                              ) : (
                                <InlineDropdown
                                  value={tx.fornecedor_id?.toString() || ""}
                                  options={fornecedorOptions}
                                  onChange={(val) => {
                                    const fId = val ? Number(val) : null
                                    const fNome = fornecedoresLista.find((f) => f.id === fId)?.nome || ""
                                    updateTx(idx, "fornecedor_id", fId)
                                    updateTx(idx, "clienteFornecedor", fNome)
                                  }}
                                  placeholder="Fornecedor..."
                                  width="w-32"
                                />
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <InlineDropdown
                                value={tx.forma_pagamento || ""}
                                options={formaPgtoOptions}
                                onChange={(val) => updateTx(idx, "forma_pagamento", val)}
                                placeholder={tx.forma_pagamento || "F. Pgto..."}
                                width="w-28"
                              />
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              <button type="button" onClick={() => openSplitDialog(idx)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                                <ArrowLeftRight className="h-3 w-3" />
                                {tx.isSplit ? `${tx.splits?.length}` : ""}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Tip */}
                <div className="flex items-start gap-3 rounded-xl border border-[hsl(38,92%,50%)]/30 bg-[hsl(38,92%,50%)]/5 p-4">
                  <Zap className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(38,92%,50%)]" />
                  <div className="text-sm text-card-foreground">
                    <p className="font-medium">Dica: Classificacoes automaticas</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Ao importar, as classificacoes que voce fizer serao salvas como regras automaticas. 
                      Na proxima importacao, transacoes com descricoes semelhantes serao classificadas automaticamente, 
                      sem precisar selecionar uma por uma.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ==================== STEP: DONE ==================== */}
            {step === "done" && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]/10">
                  <CheckCircle2 className="h-8 w-8 text-[hsl(142,71%,40%)]" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-card-foreground">Importacao Concluida</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedTxs.length} transacoes importadas com sucesso de {ofxData?.bankName}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(142,71%,40%)]/10 px-4 py-2">
                    <ArrowDownLeft className="h-4 w-4 text-[hsl(142,71%,40%)]" />
                    <span className="text-sm font-medium text-[hsl(142,71%,40%)]">Entradas: {formatCurrency(selectedEntradas)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(0,72%,51%)]/10 px-4 py-2">
                    <ArrowUpRight className="h-4 w-4 text-[hsl(0,72%,51%)]" />
                    <span className="text-sm font-medium text-[hsl(0,72%,51%)]">Saidas: {formatCurrency(selectedSaidas)}</span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {allRules.length} regras de classificacao salvas para futuras importacoes
                </p>
                <button type="button" onClick={resetImport}
                  className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  <Upload className="h-4 w-4" />
                  Importar Outro Arquivo
                </button>
              </div>
            )}

            {/* Import History - always visible */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold text-card-foreground">Historico de Importacoes</h3>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Arquivo</span>
                <span>Banco</span>
                <span>Data</span>
                <span>Registros</span>
                <span>Status</span>
              </div>
              {history.length === 0 && (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Nenhuma importacao realizada ainda
                </div>
              )}
              {history.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.status === "erro" ? "bg-[hsl(0,72%,51%)]/10" : "bg-[hsl(142,71%,40%)]/10"}`}>
                      <FileSpreadsheet className={`h-5 w-5 ${item.status === "erro" ? "text-[hsl(0,72%,51%)]" : "text-[hsl(142,71%,40%)]"}`} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-card-foreground block truncate">{item.arquivo}</span>
                      <span className="text-xs text-muted-foreground">Conta: {item.conta}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{item.banco}</span>
                  <span className="text-sm text-muted-foreground">{item.data}</span>
                  <span className="text-sm font-medium text-card-foreground">{item.registros}</span>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                    item.status === "concluido" ? "text-[hsl(142,71%,40%)]" : item.status === "erro" ? "text-[hsl(0,72%,51%)]" : "text-[hsl(38,92%,50%)]"
                  }`}>
                    {item.status === "concluido" ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === "erro" ? <AlertCircle className="h-3.5 w-3.5" /> : null}
                    {item.status === "concluido" ? "Concluido" : item.status === "erro" ? "Erro" : "Processando"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Rules Management Dialog */}
      <Dialog open={rulesDialogOpen} onOpenChange={(open) => { setRulesDialogOpen(open); if (!open) setSelectedRules(new Set()) }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Regras de Classificacao Automatica</DialogTitle>
                <DialogDescription>
                  Quando uma transacao no extrato conter a palavra-chave, ela sera automaticamente classificada.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={createNewRule}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Nova Regra
              </button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {allRules.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma regra cadastrada. Clique em &quot;Nova Regra&quot; para criar uma regra manualmente.
              </p>
            )}
            <div className="divide-y divide-border">
              {allRules.map((rule) => {
                const contaNome = contasBancarias.find(c => c.id === rule.conta_bancaria_id)?.nome
                return (
                  <div key={rule.id} className="group relative flex items-start gap-3 py-3 hover:bg-muted/30 transition-colors -mx-3 px-3 rounded-md">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedRules.has(rule.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedRules)
                        if (e.target.checked) newSet.add(rule.id)
                        else newSet.delete(rule.id)
                        setSelectedRules(newSet)
                      }}
                      className="mt-1.5 rounded border-border"
                    />
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-card-foreground">
                          {rule.descricao || rule.keyword.split(",")[0].trim().toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({rule.keyword})
                        </span>
                      </div>
                      
                      {/* Tags Row */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {contaNome && (
                          <span className="inline-flex items-center rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {contaNome}
                          </span>
                        )}
                        {rule.categoria_nome && (
                          <span className="inline-flex items-center rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {rule.categoria_nome}
                            {rule.subcategoria_nome && `/${rule.subcategoria_nome}`}
                          </span>
                        )}
                        {(rule.fornecedor_nome || rule.cliente_nome || rule.cliente_fornecedor) && (
                          <span className="inline-flex items-center rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {rule.fornecedor_nome || rule.cliente_nome || rule.cliente_fornecedor}
                          </span>
                        )}
                        {rule.forma_pagamento && (
                          <span className="inline-flex items-center rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {rule.forma_pagamento}
                          </span>
                        )}
                        {rule.filho_nome && (
                          <span className="inline-flex items-center rounded border border-[hsl(38,92%,50%)]/50 bg-[hsl(38,92%,50%)]/10 px-2 py-0.5 text-xs text-[hsl(38,92%,50%)]">
                            {rule.filho_nome}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons (show on hover) */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm rounded-md px-1 py-1">
                      <button
                        type="button"
                        onClick={() => cloneRule(rule)}
                        title="Clonar regra"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditRule(rule)}
                        title="Editar regra"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportRule(rule)}
                        title="Exportar regra"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRule(rule.id)}
                        title="Excluir regra"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              {selectedRules.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">{selectedRules.size} selecionada(s)</span>
                  <button
                    type="button"
                    onClick={deleteSelectedRules}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir selecionadas
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRulesDialogOpen(false)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Edit Dialog */}
      <Dialog open={ruleEditDialogOpen} onOpenChange={setRuleEditDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar regra de preenchimento</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              {/* Keywords */}
              <div>
                <label className="text-xs font-medium text-[hsl(0,72%,51%)]">Palavras chave (separadas por virgula) *</label>
                <input
                  type="text"
                  value={editingRule.keyword}
                  onChange={(e) => setEditingRule({ ...editingRule, keyword: e.target.value })}
                  className="mt-1 w-full rounded-md border border-primary/50 bg-background px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
                  maxLength={200}
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">{editingRule.keyword.length} / 200</div>
              </div>
              
              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descricao dos lancamentos *</label>
                <input
                  type="text"
                  value={editingRule.descricao || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, descricao: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                  maxLength={200}
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">{(editingRule.descricao || "").length} / 200</div>
              </div>
              
              {/* Grid Fields */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Conta</label>
                  <select
                    value={editingRule.conta_bancaria_id?.toString() || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, conta_bancaria_id: e.target.value ? Number(e.target.value) : null })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                  >
                    <option value="">Selecionar...</option>
                    {contasBancarias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <select
                    value={editingRule.categoria_id?.toString() || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, categoria_id: e.target.value ? Number(e.target.value) : null, subcategoria_id: null, subcategoria_filho_id: null })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                  >
                    <option value="">Selecionar...</option>
                    {catOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contato</label>
                  <input
                    type="text"
                    value={editingRule.cliente_fornecedor || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, cliente_fornecedor: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Centro</label>
                  <select
                    value={editingRule.subcategoria_id?.toString() || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, subcategoria_id: e.target.value ? Number(e.target.value) : null, subcategoria_filho_id: null })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                  >
                    <option value="">Selecionar...</option>
                    {getSubcatOptions(editingRule.categoria_id?.toString() || "").map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Projeto</label>
                  <select
                    value={editingRule.subcategoria_filho_id?.toString() || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, subcategoria_filho_id: e.target.value ? Number(e.target.value) : null })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                  >
                    <option value="">Selecionar...</option>
                    {getFilhoOptions(editingRule.subcategoria_id?.toString() || "").map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Forma de pagto</label>
                  <select
                    value={editingRule.forma_pagamento || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, forma_pagamento: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                  >
                    <option value="">Selecionar...</option>
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Cartão de Crédito">Cartao de Credito</option>
                    <option value="Cartão de Débito">Cartao de Debito</option>
                    <option value="Transferência">Transferencia</option>
                    <option value="Débito em Conta">Debito em Conta</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
              
              {/* Tags */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tags</label>
                <input
                  type="text"
                  placeholder="Adicionar tags..."
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary/50"
                />
              </div>
              
              {/* Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule({ ...editingRule, substituir_descricao: !editingRule.substituir_descricao })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${editingRule.substituir_descricao ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editingRule.substituir_descricao ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-card-foreground">
                  Ao importar lancamentos, substituir a descricao do extrato por <strong>{editingRule.descricao || editingRule.keyword.split(",")[0].trim().toUpperCase()}</strong>.
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRuleEditDialogOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-card-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEditedRule}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Transaction Dialog */}
      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dividir Transacao</DialogTitle>
            <DialogDescription>
              Divida esta transacao em multiplas entradas com categorias e valores diferentes.
            </DialogDescription>
          </DialogHeader>

          {splitTransactionIdx !== null && transactions[splitTransactionIdx] && (
            <div className="space-y-6">
              {/* Original Transaction Summary */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">TRANSACAO ORIGINAL</p>
                    <p className="mt-1 text-sm text-card-foreground">{transactions[splitTransactionIdx].memo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-muted-foreground">VALOR</p>
                    <p className={`mt-1 text-lg font-bold ${transactions[splitTransactionIdx].amount < 0 ? "text-[hsl(0,72%,51%)]" : "text-[hsl(142,71%,40%)]"}`}>
                      {transactions[splitTransactionIdx].amount < 0 ? "-" : "+"} {formatCurrency(Math.abs(transactions[splitTransactionIdx].amount))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Split Entries */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-card-foreground">Divisoes</h4>
                  <button type="button" onClick={addSplitEntry}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>

                {splitEntries.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma divisao adicionada</p>
                ) : (
                  <div className="space-y-3">
                    {splitEntries.map((entry, idx) => {
                      const subcats = getSubcatOptions(entry.categoria_id?.toString() || "")
                      const filhos = getFilhoOptions(entry.subcategoria_id?.toString() || "")
                      return (
                        <div key={entry.id} className="flex gap-2 rounded-lg border border-border bg-card p-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground">Valor</label>
                                <input type="text" placeholder="0,00" value={splitDisplayValues[entry.id] ?? ""} onChange={(e) => updateSplitValor(entry.id, e.target.value)}
                                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-card-foreground outline-none focus:border-primary/50" />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                                <select value={entry.categoria_id?.toString() || ""} onChange={(e) => updateSplitEntry(entry.id, "categoria_id", e.target.value ? Number(e.target.value) : null)}
                                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-card-foreground outline-none focus:border-primary/50">
                                  <option value="">Selecionar...</option>
                                  {catOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground">Subcategoria</label>
                                <select value={entry.subcategoria_id?.toString() || ""} onChange={(e) => updateSplitEntry(entry.id, "subcategoria_id", e.target.value ? Number(e.target.value) : null)}
                                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-card-foreground outline-none focus:border-primary/50">
                                  <option value="">Selecionar...</option>
                                  {subcats.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground">Sub-Filho</label>
                                <select value={entry.subcategoria_filho_id?.toString() || ""} onChange={(e) => updateSplitEntry(entry.id, "subcategoria_filho_id", e.target.value ? Number(e.target.value) : null)}
                                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-card-foreground outline-none focus:border-primary/50">
                                  <option value="">Selecionar...</option>
                                  {filhos.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeSplitEntry(entry.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Validation Summary */}
              {splitEntries.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">TOTAL DAS DIVISOES</p>
                    <p className="mt-0.5 text-sm font-semibold text-card-foreground">
                      {formatCurrency(splitEntries.reduce((sum, e) => sum + e.valor, 0))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-medium ${Math.abs(splitEntries.reduce((sum, e) => sum + e.valor, 0) - Math.abs(transactions[splitTransactionIdx].amount)) < 0.01 ? "text-[hsl(142,71%,40%)]" : "text-[hsl(0,72%,51%)]"}`}>
                      {Math.abs(splitEntries.reduce((sum, e) => sum + e.valor, 0) - Math.abs(transactions[splitTransactionIdx].amount)) < 0.01 ? "CORRETO" : "DIFERENCA: " + formatCurrency(Math.abs(splitEntries.reduce((sum, e) => sum + e.valor, 0) - Math.abs(transactions[splitTransactionIdx].amount)))}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <button type="button" onClick={closeSplitDialog}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-card-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={saveSplit} disabled={splitEntries.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Salvar Divisao
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
