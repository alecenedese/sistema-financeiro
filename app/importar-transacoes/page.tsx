"use client"

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { parseOFX, type OFXTransaction, type OFXData } from "@/lib/ofx-parser"
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
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

// ---------- Types ----------

interface MappingRule {
  id: number
  keyword: string // keyword to match in MEMO
  categoria: string
  subcategoria: string
  subcategoriaFilho: string
  clienteFornecedor: string
}

interface TransactionRow extends OFXTransaction {
  categoria: string
  subcategoria: string
  subcategoriaFilho: string
  clienteFornecedor: string
  selected: boolean
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

// ---------- Data ----------

const categoriasData: Record<string, { tipo: "Receita" | "Despesa"; subcategorias: Record<string, string[]> }> = {
  "Moradia": { tipo: "Despesa", subcategorias: {
    "Aluguel": ["Residencial", "Comercial"],
    "Condominio": ["Taxa Ordinaria", "Taxa Extra"],
    "Conta de Energia": [],
    "Conta de Agua": [],
    "Internet": [],
  }},
  "Transporte": { tipo: "Despesa", subcategorias: {
    "Combustivel": ["Gasolina", "Etanol"],
    "Estacionamento": [],
    "Manutencao Veiculo": ["Revisao", "Pneus", "Funilaria"],
    "Transporte Publico": [],
  }},
  "Alimentacao": { tipo: "Despesa", subcategorias: {
    "Supermercado": [],
    "Restaurante": ["Almoco", "Jantar"],
    "Delivery": [],
    "Padaria": [],
    "Cantina": [],
    "Conveniencia": [],
  }},
  "Saude": { tipo: "Despesa", subcategorias: {
    "Plano de Saude": [],
    "Farmacia": [],
    "Consultas": ["Clinico Geral", "Especialista"],
  }},
  "Lazer": { tipo: "Despesa", subcategorias: {
    "Streaming": [],
    "Cinema": [],
    "Viagens": ["Nacional", "Internacional"],
    "Esportes": [],
  }},
  "Servicos": { tipo: "Despesa", subcategorias: {
    "Pagamentos Digitais": [],
    "Assinaturas": [],
    "Taxas": [],
  }},
  "Salario": { tipo: "Receita", subcategorias: {
    "Salario Fixo": [],
    "13o Salario": [],
    "Ferias": [],
    "Bonus": ["Bonus Anual", "PLR"],
    "Horas Extras": [],
  }},
  "Freelancer": { tipo: "Receita", subcategorias: {
    "Projetos Web": ["Frontend", "Backend"],
    "Consultoria": [],
    "Design": [],
  }},
  "Investimentos": { tipo: "Receita", subcategorias: {
    "Dividendos": [],
    "Renda Fixa": ["CDB", "Tesouro Direto"],
    "Fundos Imobiliarios": [],
  }},
  "Transferencias": { tipo: "Receita", subcategorias: {
    "PIX Recebido": [],
    "TED Recebido": [],
    "DOC Recebido": [],
  }},
  "Outros": { tipo: "Despesa", subcategorias: {
    "Diversos": [],
    "Sem Categoria": [],
  }},
}

const allCategorias = Object.keys(categoriasData)

const initialRules: MappingRule[] = [
  { id: 1, keyword: "CANTINA", categoria: "Alimentacao", subcategoria: "Cantina", subcategoriaFilho: "", clienteFornecedor: "Cantina" },
  { id: 2, keyword: "SUPERMERCADO", categoria: "Alimentacao", subcategoria: "Supermercado", subcategoriaFilho: "", clienteFornecedor: "" },
  { id: 3, keyword: "CONVENIENCIA", categoria: "Alimentacao", subcategoria: "Conveniencia", subcategoriaFilho: "", clienteFornecedor: "" },
  { id: 4, keyword: "SYNC PAY", categoria: "Servicos", subcategoria: "Pagamentos Digitais", subcategoriaFilho: "", clienteFornecedor: "Sync Pay" },
  { id: 5, keyword: "PIX", categoria: "Transferencias", subcategoria: "PIX Recebido", subcategoriaFilho: "", clienteFornecedor: "" },
]

const initialHistory: ImportHistoryItem[] = [
  { id: 1, arquivo: "extrato_nubank_fev2026.csv", data: "09/02/2026", registros: 23, status: "concluido", conta: "98765-4", banco: "Nubank" },
  { id: 2, arquivo: "extrato_bb_jan2026.csv", data: "01/02/2026", registros: 45, status: "concluido", conta: "56789-0", banco: "Banco do Brasil" },
  { id: 3, arquivo: "extrato_itau_jan2026.ofx", data: "01/02/2026", registros: 32, status: "concluido", conta: "12345-6", banco: "Itau" },
]

// ---------- Helpers ----------

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function extractClienteFornecedor(memo: string): string {
  // Try to extract name from PIX: "REM: Name Date" or "DES: Name Date"
  const remMatch = memo.match(/REM:\s*([A-Za-zÀ-ú\s]+?)(?:\s+\d{2}\/\d{2}|$)/i)
  if (remMatch) return remMatch[1].trim()
  const desMatch = memo.match(/DES:\s*([A-Za-zÀ-ú\s]+?)(?:\s+\d{2}\/\d{2}|$)/i)
  if (desMatch) return desMatch[1].trim()
  // For "COMPRA" type, extract store name
  const compraMatch = memo.match(/(?:COMPRA\s+\w+\s+\w+\s+\w+\s+)(.*)/i)
  if (compraMatch) return compraMatch[1].trim()
  return ""
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
  options: string[]
  onChange: (val: string) => void
  placeholder: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className={`relative ${width}`} ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch("") }}
        className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs transition-colors ${
          value ? "border-border text-card-foreground" : "border-dashed border-muted-foreground/40 text-muted-foreground"
        } hover:border-primary/50 bg-card`}
      >
        <span className="truncate">{value || placeholder}</span>
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
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false) }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted ${
                    value === opt ? "font-medium text-primary" : "text-card-foreground"
                  }`}
                >
                  {value === opt && <Check className="h-3 w-3 text-primary" />}
                  {opt}
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
  // State
  const [step, setStep] = useState<"upload" | "review" | "done">("upload")
  const [ofxData, setOfxData] = useState<OFXData | null>(null)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [rules, setRules] = useState<MappingRule[]>(initialRules)
  const [history, setHistory] = useState<ImportHistoryItem[]>(initialHistory)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState("")
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false)
  const [selectAll, setSelectAll] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Computed
  const totalImportados = history.filter((h) => h.status === "concluido").reduce((a, h) => a + h.registros, 0)
  const selectedTxs = transactions.filter((t) => t.selected)
  const selectedEntradas = selectedTxs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0)
  const selectedSaidas = selectedTxs.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0)

  // Auto-match a transaction against saved rules
  const applyRules = useCallback(
    (tx: OFXTransaction): { categoria: string; subcategoria: string; subcategoriaFilho: string; clienteFornecedor: string } => {
      const memoUpper = tx.memo.toUpperCase()
      for (const rule of rules) {
        if (memoUpper.includes(rule.keyword.toUpperCase())) {
          return {
            categoria: rule.categoria,
            subcategoria: rule.subcategoria,
            subcategoriaFilho: rule.subcategoriaFilho,
            clienteFornecedor: rule.clienteFornecedor || extractClienteFornecedor(tx.memo),
          }
        }
      }
      return { categoria: "", subcategoria: "", subcategoriaFilho: "", clienteFornecedor: extractClienteFornecedor(tx.memo) }
    },
    [rules]
  )

  // Process file
  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      alert("Por favor selecione um arquivo .OFX")
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const parsed = parseOFX(content)
      setOfxData(parsed)

      // Map transactions with auto-matching
      const rows: TransactionRow[] = parsed.transactions
        .filter((tx) => tx.amount !== 0) // ignore zero-value
        .map((tx) => {
          const matched = applyRules(tx)
          return {
            ...tx,
            categoria: matched.categoria,
            subcategoria: matched.subcategoria,
            subcategoriaFilho: matched.subcategoriaFilho,
            clienteFornecedor: matched.clienteFornecedor,
            selected: true,
          }
        })
      setTransactions(rows)
      setSelectAll(true)
      setStep("review")
    }
    reader.readAsText(file, "ISO-8859-1")
  }

  // Drag events
  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }
  function handleDragLeave() {
    setIsDragging(false)
  }
  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // Update transaction fields
  function updateTx(idx: number, field: keyof TransactionRow, value: string | boolean) {
    setTransactions((prev) => {
      const next = [...prev]
      const updated = { ...next[idx], [field]: value }
      // When changing categoria, reset subcategoria and filho
      if (field === "categoria") {
        const subs = Object.keys(categoriasData[value as string]?.subcategorias || {})
        if (!subs.includes(updated.subcategoria)) {
          updated.subcategoria = ""
          updated.subcategoriaFilho = ""
        }
      }
      // When changing subcategoria, reset filho if it doesn't match
      if (field === "subcategoria") {
        const filhos = updated.categoria ? (categoriasData[updated.categoria]?.subcategorias?.[value as string] || []) : []
        if (!filhos.includes(updated.subcategoriaFilho)) {
          updated.subcategoriaFilho = ""
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

  // Save rules from current mapping
  function saveNewRules() {
    const newRules: MappingRule[] = [...rules]
    for (const tx of transactions) {
      if (tx.categoria && tx.memo) {
        // Extract a meaningful keyword from the memo
        const keywords = extractKeywordsFromMemo(tx.memo)
        for (const kw of keywords) {
          // Don't duplicate
          const exists = newRules.some((r) => r.keyword.toUpperCase() === kw.toUpperCase())
          if (!exists && kw.length >= 3) {
            newRules.push({
              id: Date.now() + Math.random(),
              keyword: kw,
              categoria: tx.categoria,
              subcategoria: tx.subcategoria,
              subcategoriaFilho: tx.subcategoriaFilho,
              clienteFornecedor: tx.clienteFornecedor,
            })
          }
        }
      }
    }
    setRules(newRules)
  }

  function extractKeywordsFromMemo(memo: string): string[] {
    // Extract store name or significant identifier from MEMO
    const keywords: string[] = []
    // For COMPRA type: "COMPRA ELO DEBITO VISTA CANTINA" -> "CANTINA"
    const compraMatch = memo.match(/(?:COMPRA\s+\w+\s+\w+\s+\w+\s+)([\w*\s]+)/i)
    if (compraMatch) {
      const store = compraMatch[1].trim()
      if (store.length >= 3) keywords.push(store.split(/\s/)[0])
    }
    // For PIX type: DES: NAME -> NAME
    const desMatch = memo.match(/DES:\s*([\w\s*]+?)(?:\s+\d{2}\/\d{2}|$)/i)
    if (desMatch) {
      const name = desMatch[1].trim().split(/\s/)[0]
      if (name.length >= 3) keywords.push(name)
    }
    return keywords
  }

  // Confirm import
  function confirmImport() {
    saveNewRules()
    const selected = transactions.filter((t) => t.selected)
    // Add to history
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
  }

  // Reset
  function resetImport() {
    setStep("upload")
    setOfxData(null)
    setTransactions([])
    setFileName("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Delete rule
  function deleteRule(id: number) {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  // Apply all rules in bulk
  function reapplyRules() {
    setTransactions((prev) =>
      prev.map((tx) => {
        const matched = applyRules(tx)
        return {
          ...tx,
          categoria: matched.categoria || tx.categoria,
          subcategoria: matched.subcategoria || tx.subcategoria,
          subcategoriaFilho: matched.subcategoriaFilho || tx.subcategoriaFilho,
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
                  <p className="mt-1 text-xl font-bold text-card-foreground">{rules.length}</p>
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

            {/* ==================== STEP: UPLOAD ==================== */}
            {step === "upload" && (
              <>
                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card p-12 text-center shadow-sm transition-colors ${
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full ${isDragging ? "bg-primary/20" : "bg-primary/10"}`}>
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-card-foreground">
                    Arraste seu arquivo .OFX aqui ou clique para selecionar
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O arquivo sera analisado e as transacoes serao automaticamente classificadas com base nas regras salvas
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ofx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="ofx-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Upload className="h-4 w-4" />
                    Selecionar Arquivo .OFX
                  </button>
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
                    {rules.slice(0, 5).map((rule) => (
                      <div key={rule.id} className="flex items-center gap-4 px-5 py-3">
                        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono font-medium text-foreground">{rule.keyword}</span>
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-sm text-card-foreground">
                          {[rule.categoria, rule.subcategoria, rule.subcategoriaFilho].filter(Boolean).join(" > ")}
                        </span>
                        {rule.clienteFornecedor && (
                          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            {rule.clienteFornecedor}
                          </span>
                        )}
                      </div>
                    ))}
                    {rules.length > 5 && (
                      <div className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setRulesDialogOpen(true)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Ver todas as {rules.length} regras
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ==================== STEP: REVIEW ==================== */}
            {step === "review" && ofxData && (
              <>
                {/* File info bar */}
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Landmark className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-card-foreground">{ofxData.bankName}</p>
                      <p className="text-xs text-muted-foreground">
                        Conta: {ofxData.accountId} &middot; Periodo: {ofxData.startDate} a {ofxData.endDate} &middot; {fileName}
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
                    <button
                      type="button"
                      onClick={reapplyRules}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reaplicar Regras
                    </button>
                    <button
                      type="button"
                      onClick={() => setRulesDialogOpen(true)}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Zap className="h-4 w-4 text-[hsl(38,92%,50%)]" />
                      Regras ({rules.length})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetImport}
                      className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmImport}
                      disabled={selectedTxs.length === 0}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4" />
                      Importar {selectedTxs.length} Transacoes
                    </button>
                  </div>
                </div>

                {/* Transactions review table */}
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
                  <table className="w-full min-w-[1050px]">
                    <thead>
                      <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-3 py-3 text-left w-10">
                          <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="rounded border-border" />
                        </th>
                        <th className="px-3 py-3 text-left">Data</th>
                        <th className="px-3 py-3 text-left">Descricao</th>
                        <th className="px-3 py-3 text-right w-24">Valor</th>
                        <th className="px-3 py-3 text-left">Categoria</th>
                        <th className="px-3 py-3 text-left">Subcategoria</th>
                        <th className="px-3 py-3 text-left">Sub-Filho</th>
                        <th className="px-3 py-3 text-left">Cliente / Fornecedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.map((tx, idx) => {
                        const isCredit = tx.amount >= 0
                        const subcats = tx.categoria ? Object.keys(categoriasData[tx.categoria]?.subcategorias || {}) : []
                        const filhos = (tx.categoria && tx.subcategoria) ? (categoriasData[tx.categoria]?.subcategorias?.[tx.subcategoria] || []) : []
                        const isAutoMatched = tx.categoria !== ""
                        return (
                          <tr
                            key={tx.fitId}
                            className={`transition-colors hover:bg-muted/50 ${!tx.selected ? "opacity-40" : ""}`}
                          >
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={tx.selected}
                                onChange={(e) => updateTx(idx, "selected", e.target.checked)}
                                className="rounded border-border"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                              {tx.date}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isCredit ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(0,72%,51%)]/10"}`}>
                                  {isCredit
                                    ? <ArrowDownLeft className="h-3.5 w-3.5 text-[hsl(142,71%,40%)]" />
                                    : <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(0,72%,51%)]" />
                                  }
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-card-foreground max-w-[240px]" title={tx.memo}>
                                    {tx.memo}
                                  </p>
                                  {isAutoMatched && (
                                    <span className="text-[10px] text-[hsl(142,71%,40%)]">auto-classificado</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={`px-3 py-2.5 text-right text-sm font-semibold whitespace-nowrap ${
                              isCredit ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"
                            }`}>
                              {isCredit ? "+" : "-"} {formatCurrency(Math.abs(tx.amount))}
                            </td>
                            <td className="px-3 py-2.5">
                              <InlineDropdown
                                value={tx.categoria}
                                options={allCategorias}
                                onChange={(val) => updateTx(idx, "categoria", val)}
                                placeholder="Selecionar"
                                width="w-32"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <InlineDropdown
                                value={tx.subcategoria}
                                options={subcats}
                                onChange={(val) => updateTx(idx, "subcategoria", val)}
                                placeholder={tx.categoria ? "Selecionar" : "-"}
                                width="w-36"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <InlineDropdown
                                value={tx.subcategoriaFilho}
                                options={filhos}
                                onChange={(val) => updateTx(idx, "subcategoriaFilho", val)}
                                placeholder={filhos.length > 0 ? "Selecionar" : "-"}
                                width="w-32"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="text"
                                value={tx.clienteFornecedor}
                                onChange={(e) => updateTx(idx, "clienteFornecedor", e.target.value)}
                                placeholder="Nome..."
                                className="w-full max-w-[160px] rounded-md border border-border bg-card px-2 py-1.5 text-xs text-card-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                              />
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
                  {rules.length} regras de classificacao salvas para futuras importacoes
                </p>
                <button
                  type="button"
                  onClick={resetImport}
                  className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
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
      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Regras de Classificacao Automatica</DialogTitle>
            <DialogDescription>
              Quando uma transacao no extrato conter a palavra-chave, ela sera automaticamente classificada com a categoria, subcategoria e cliente/fornecedor definidos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {rules.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma regra cadastrada. Importe um arquivo e classifique as transacoes para criar regras automaticamente.
              </p>
            )}
            <div className="divide-y divide-border">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 py-3">
                  <span className="shrink-0 rounded-md bg-muted px-2.5 py-1 text-xs font-mono font-medium text-foreground min-w-[80px]">
                    {rule.keyword}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-card-foreground">
                      {[rule.categoria, rule.subcategoria, rule.subcategoriaFilho].filter(Boolean).join(" > ")}
                    </p>
                    {rule.clienteFornecedor && (
                      <p className="text-xs text-muted-foreground">{rule.clienteFornecedor}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteRule(rule.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
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
    </div>
  )
}
