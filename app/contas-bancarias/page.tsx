"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import {
  Landmark, CreditCard, Wallet, Plus, TrendingUp, TrendingDown,
  ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Pencil, Trash2, Loader2, X,
  ArrowLeftRight, ChevronDown,
} from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { getActiveTenantId, useTenant } from "@/hooks/use-tenant"
import useSWR from "swr"
import { ConciliacaoContas } from "@/components/dashboard/conciliacao-contas"

interface ContaBancaria {
  id: number; nome: string; tipo: string; saldo: number; saldo_inicial: number; cor: string
  agencia: string; conta: string; entradas: number; saidas: number
}
interface Extrato {
  id: number; descricao: string; valor: number; tipo: string; data: string; status: string
}

type FiltroExtrato = "hoje" | "ontem" | "7dias" | "mes"

const ICON_MAP: Record<string, typeof Landmark> = {
  "Conta Corrente": Landmark, Poupanca: Wallet, "Cartao de Credito": CreditCard,
}
const COLORS = ["#1B3A5C", "#2C5F8A", "#3D7AB5", "#7A8FA6", "#A8B8C8", "#C4CFD9"]

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}
function toISOLocal(d: Date) { return d.toISOString().split("T")[0] }
function formatDate(s: string) {
  if (!s) return "-"
  const [y, m, d] = s.split("-")
  return `${d}/${m}/${y}`
}

async function fetchEntradasSaidasPorConta(
  [, tid, month, year]: [string, number | null, number, number]
): Promise<Record<number, { entradas: number; saidas: number }>> {
  const supabase = createClient()
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0]
  const to   = new Date(year, month, 1).toISOString().split("T")[0]

  let recQ = supabase.from("contas_receber").select("conta_bancaria_id, valor")
    .eq("status", "recebido").gte("vencimento", from).lt("vencimento", to)
  let pagQ = supabase.from("contas_pagar").select("conta_bancaria_id, valor")
    .eq("status", "pago").gte("vencimento", from).lt("vencimento", to)

  if (tid) { recQ = recQ.eq("tenant_id", tid); pagQ = pagQ.eq("tenant_id", tid) }

  const [{ data: recData }, { data: pagData }] = await Promise.all([recQ, pagQ])

  const result: Record<number, { entradas: number; saidas: number }> = {}
  for (const r of (recData || [])) {
    const id = r.conta_bancaria_id as number
    if (!id) continue
    if (!result[id]) result[id] = { entradas: 0, saidas: 0 }
    result[id].entradas += Number(r.valor)
  }
  for (const r of (pagData || [])) {
    const id = r.conta_bancaria_id as number
    if (!id) continue
    if (!result[id]) result[id] = { entradas: 0, saidas: 0 }
    result[id].saidas += Number(r.valor)
  }
  return result
}

async function fetchContas(tid: number | null): Promise<ContaBancaria[]> {
  const supabase = createClient()
  let q = supabase.from("contas_bancarias").select("*").order("id")
  if (tid) q = q.eq("tenant_id", tid)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((r) => ({
    id: r.id, nome: r.nome, tipo: r.tipo, saldo: Number(r.saldo), saldo_inicial: Number(r.saldo_inicial ?? 0), cor: r.cor,
    agencia: r.agencia, conta: r.conta, entradas: Number(r.entradas), saidas: Number(r.saidas),
  }))
}

async function fetchExtrato(contaId: number, filtro: FiltroExtrato): Promise<Extrato[]> {
  const supabase = createClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let from = toISOLocal(today), to = toISOLocal(today)
  if (filtro === "ontem") {
    const y = new Date(today); y.setDate(y.getDate() - 1)
    from = toISOLocal(y); to = toISOLocal(y)
  } else if (filtro === "7dias") {
    const w = new Date(today); w.setDate(w.getDate() - 6)
    from = toISOLocal(w)
  } else if (filtro === "mes") {
    from = toISOLocal(new Date(today.getFullYear(), today.getMonth(), 1))
  }
  const tid = getActiveTenantId()

  // 1) Lançamentos manuais
  let lancQ = supabase
    .from("lancamentos")
    .select("id,descricao,valor,tipo,data,status")
    .eq("conta_bancaria_id", contaId)
    .gte("data", from).lte("data", to)
    .order("data", { ascending: false }).limit(100)
  if (tid) lancQ = lancQ.eq("tenant_id", tid)

  // 2) Contas a receber (entradas) — usa vencimento como data do extrato
  let recQ = supabase
    .from("contas_receber")
    .select("id,descricao,valor,vencimento,status")
    .eq("conta_bancaria_id", contaId)
    .gte("vencimento", from).lte("vencimento", to)
    .order("vencimento", { ascending: false }).limit(200)
  if (tid) recQ = recQ.eq("tenant_id", tid)

  // 3) Contas a pagar (saídas)
  let pagQ = supabase
    .from("contas_pagar")
    .select("id,descricao,valor,vencimento,status")
    .eq("conta_bancaria_id", contaId)
    .gte("vencimento", from).lte("vencimento", to)
    .order("vencimento", { ascending: false }).limit(200)
  if (tid) pagQ = pagQ.eq("tenant_id", tid)

  const [lancRes, recRes, pagRes] = await Promise.all([lancQ, recQ, pagQ])

  const items: Extrato[] = []
  for (const r of (lancRes.data || []) as any[]) {
    items.push({ id: r.id, descricao: r.descricao, valor: Number(r.valor), tipo: r.tipo, data: r.data, status: r.status || "confirmado" })
  }
  for (const r of (recRes.data || []) as any[]) {
    items.push({ id: r.id + 1e9, descricao: r.descricao, valor: Number(r.valor), tipo: "receita", data: r.vencimento, status: r.status || "pendente" })
  }
  for (const r of (pagRes.data || []) as any[]) {
    items.push({ id: r.id + 2e9, descricao: r.descricao, valor: Number(r.valor), tipo: "despesa", data: r.vencimento, status: r.status || "pendente" })
  }
  // Ordena por data desc e limita a 100
  items.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  return items.slice(0, 100)
}

const emptyForm = { nome: "", tipo: "Conta Corrente", agencia: "", conta: "", saldo: "" }

export default function ContasBancariasPageWrapper() {
  return <Suspense><ContasBancariasPage /></Suspense>
}

function ContasBancariasPage() {
  const { tenant, setTenant, clearTenant } = useTenant()
  const tid = tenant?.id ?? null
  const { data: contas = [], mutate, isLoading } = useSWR(["contas_bancarias", tid], ([, t]) => fetchContas(t))
  const [showBalances, setShowBalances] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaBancaria | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ContaBancaria | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Mês de referência (controla ConciliacaoContas e labels)
  const currentDate = new Date()
  const [refMonth, setRefMonth] = useState(currentDate.getMonth() + 1) // 1..12
  const [refYear, setRefYear] = useState(currentDate.getFullYear())

  const { data: movPorConta = {} } = useSWR(
    ["contas_mov", tid, refMonth, refYear],
    fetchEntradasSaidasPorConta,
    { revalidateOnFocus: false }
  )
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

  // Extrato panel
  const [selectedConta, setSelectedConta] = useState<ContaBancaria | null>(null)
  const [filtroExtrato, setFiltroExtrato] = useState<FiltroExtrato>("mes")
  const [extrato, setExtrato] = useState<Extrato[]>([])
  const [extratoLoading, setExtratoLoading] = useState(false)

  // Transferência entre contas
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({
    contaOrigemId: "",
    contaDestinoId: "",
    valor: "",
    descricao: "Transferência entre contas",
    data: new Date().toISOString().split("T")[0],
  })
  const [transferSaving, setTransferSaving] = useState(false)

  // A categoria "Transferência entre Contas" é criada sob demanda em handleTransfer()
  // (evita criar duplicatas ao abrir o diálogo)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditingConta(null); setForm(emptyForm); setDialogOpen(true)
      router.replace("/contas-bancarias")
    }
  }, [searchParams, router])

  useEffect(() => {
    if (!selectedConta) return
    setExtratoLoading(true)
    fetchExtrato(selectedConta.id, filtroExtrato).then(setExtrato).finally(() => setExtratoLoading(false))
  }, [selectedConta, filtroExtrato])

  const totalBalance  = contas.reduce((a, c) => a + c.saldo, 0)
  const totalEntradas = Object.values(movPorConta).reduce((a, v) => a + v.entradas, 0)
  const totalSaidas   = Object.values(movPorConta).reduce((a, v) => a + v.saidas, 0)

  function openNew() { setEditingConta(null); setForm(emptyForm); setDialogOpen(true) }
  function openEdit(c: ContaBancaria) {
    setEditingConta(c)
    setForm({ nome: c.nome, tipo: c.tipo, agencia: c.agencia, conta: c.conta, saldo: (c.saldo_inicial ?? c.saldo).toString() })
    setDialogOpen(true)
  }

  const handleSave = useCallback(async () => {
    if (!form.nome.trim()) {
      alert("O nome da conta é obrigatório")
      return
    }
    
    // Verificar se já existe uma conta com o mesmo nome PARA O MESMO TENANT
    if (!editingConta) {
      const contaExistente = contas.find(c => 
        c.nome.toLowerCase().trim() === form.nome.toLowerCase().trim()
      )
      if (contaExistente) {
        const confirmar = confirm(
          `Já existe uma conta "${form.nome}" cadastrada. Deseja criar outra conta com o mesmo nome?`
        )
        if (!confirmar) return
      }
    }
    
    setSaving(true)
    try {
      const supabase = createClient()
      
      // IMPORTANTE: Usar o tenant do estado React, não do localStorage
      // porque pode estar desatualizado
      const currentTenantId = tenant?.id
      
      console.log('[Contas Bancárias] Salvando conta:', { 
        currentTenantId, 
        tenant,
        localStorageId: getActiveTenantId() 
      })
      
      // Validar que sempre tem um tenant_id
      if (!currentTenantId) {
        alert("Erro: Cliente não identificado. Por favor, selecione um cliente no topo do sistema.")
        setSaving(false)
        return
      }
      
      // Verificar se o cliente realmente existe
      // (o tenant ativo vem do seletor baseado em clientes_admin)
      const { data: tenantData, error: tenantError } = await supabase
        .from("clientes_admin")
        .select("id, nome, cnpj")
        .eq("id", currentTenantId)
        .maybeSingle()
      
      console.log('[Contas Bancárias] Tenant encontrado:', tenantData, 'Erro:', tenantError)
      
      if (!tenantData) {
        alert(`Erro: Cliente ID ${currentTenantId} não encontrado no sistema.\n\nPor favor:\n1. Clique no nome do cliente no topo\n2. Selecione o cliente correto\n3. Tente cadastrar a conta novamente`)
        setSaving(false)
        return
      }
      
      // Sincronizar o localStorage com o tenant correto
      if (getActiveTenantId() !== currentTenantId) {
        console.log('[Contas Bancárias] Sincronizando localStorage:', currentTenantId)
        setTenant({
          id: currentTenantId,
          nome: tenantData.nome,
          cnpj: tenantData.cnpj || ''
        })
      }
      
      if (editingConta) {
        const novoSaldoInicial = parseFloat(form.saldo) || 0
        const supabase2 = createClient()

        // 1. Atualiza dados cadastrais + saldo_inicial
        const { error: updateError } = await supabase.from("contas_bancarias").update({
          nome: form.nome, tipo: form.tipo, agencia: form.agencia, conta: form.conta,
          saldo_inicial: novoSaldoInicial,
        }).eq("id", editingConta.id)

        if (updateError) {
          console.error("Erro ao atualizar conta:", updateError)
          alert("Erro ao atualizar conta: " + updateError.message)
          setSaving(false)
          return
        }

        // 2. Recalcula saldo = saldo_inicial + entradas_recebidas - saidas_pagas + lancamentos
        const [entradas, saidas, lancs] = await Promise.all([
          fetchAll(supabase2.from("contas_receber").select("valor").eq("conta_bancaria_id", editingConta.id).eq("status", "recebido")),
          fetchAll(supabase2.from("contas_pagar").select("valor").eq("conta_bancaria_id", editingConta.id).eq("status", "pago")),
          fetchAll(supabase2.from("lancamentos").select("valor, tipo").eq("conta_bancaria_id", editingConta.id)),
        ])
        let totalEntradas = (entradas as any[]).reduce((a, r) => a + Number(r.valor), 0)
        let totalSaidas   = (saidas as any[]).reduce((a, r) => a + Number(r.valor), 0)
        for (const l of lancs as any[]) {
          if (l.tipo === "receita") totalEntradas += Number(l.valor)
          else totalSaidas += Number(l.valor)
        }
        const novoSaldo = novoSaldoInicial + totalEntradas - totalSaidas

        await supabase.from("contas_bancarias").update({ saldo: novoSaldo }).eq("id", editingConta.id)
      } else {
        // Novo: saldo_inicial e saldo recebem o valor informado (base para o trigger)
        const saldoInicial = parseFloat(form.saldo) || 0
        const payload: Record<string, unknown> = {
          nome: form.nome.trim(), 
          tipo: form.tipo, 
          agencia: form.agencia?.trim() || '', 
          conta: form.conta?.trim() || '',
          saldo_inicial: saldoInicial,
          saldo: saldoInicial,
          cor: COLORS[contas.length % COLORS.length],
          entradas: 0,
          saidas: 0,
          tenant_id: currentTenantId,
        }
        
        const { error: insertError, data: insertData } = await supabase
          .from("contas_bancarias")
          .insert(payload)
          .select()
        
        if (insertError) {
          console.error("Erro ao criar conta:", {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
            payload: payload
          })
          alert("Erro ao criar conta: " + insertError.message + (insertError.hint ? "\n" + insertError.hint : ""))
          setSaving(false)
          return
        }
        
        console.log("Conta criada com sucesso:", insertData)
      }
      await mutate(); setDialogOpen(false)
    } catch (error) {
      console.error("Erro inesperado:", error)
      alert("Erro inesperado: " + (error instanceof Error ? error.message : String(error)))
    } finally { setSaving(false) }
  }, [form, editingConta, contas, mutate, tenant, setTenant, clearTenant])

  const handleDelete = useCallback(async (c: ContaBancaria) => {
    const supabase = createClient()
    await supabase.from("contas_bancarias").delete().eq("id", c.id)
    await mutate(); setDeleteConfirm(null)
    if (selectedConta?.id === c.id) setSelectedConta(null)
  }, [mutate, selectedConta])

  // Transferência entre contas
  const handleTransfer = useCallback(async () => {
    const valor = parseFloat(transferForm.valor.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0
    if (!transferForm.contaOrigemId || !transferForm.contaDestinoId || valor <= 0) {
      alert("Preencha todos os campos corretamente")
      return
    }
    if (transferForm.contaOrigemId === transferForm.contaDestinoId) {
      alert("Conta de origem e destino devem ser diferentes")
      return
    }
    
    setTransferSaving(true)
    try {
      const supabase = createClient()
      const tid = getActiveTenantId()
      const contaOrigemId = parseInt(transferForm.contaOrigemId)
      const contaDestinoId = parseInt(transferForm.contaDestinoId)
      const contaOrigem = contas.find(c => c.id === contaOrigemId)
      const contaDestino = contas.find(c => c.id === contaDestinoId)

      // Buscar ou criar categoria de transferência (sem grupo_dre = não afeta DRE)
      // Busca robusta: compara normalizado (sem acentos, case-insensitive) para evitar duplicatas
      let categoriaTransferencia: { id: number } | null = null

      const normalize = (s: string) => s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
      const alvo = normalize("Transferência entre Contas")

      // Busca TODAS as categorias do tenant e encontra qualquer variante de nome
      const { data: allCats } = await supabase
        .from("categorias")
        .select("id, nome")
        .eq("tenant_id", tid)

      const existente = (allCats || []).find(c => normalize(c.nome as string) === alvo)

      if (existente) {
        categoriaTransferencia = { id: existente.id as number }
      } else {
        // Não existe — cria
        const { data: newCat, error: insertError } = await supabase
          .from("categorias")
          .insert({
            nome: "Transferência entre Contas",
            tipo: "Despesa",
            cor: "#6B7280",
            tenant_id: tid,
          })
          .select("id")
          .single()

        if (insertError || !newCat) {
          alert("Erro ao criar categoria: " + (insertError?.message || "desconhecido"))
          return
        }
        categoriaTransferencia = newCat
      }

      if (!categoriaTransferencia) {
        alert("Erro ao obter categoria de transferência")
        return
      }

      // 1. Criar conta a pagar (saída da conta origem) - já como PAGO
      const contaPagarPayload: Record<string, unknown> = {
        descricao: `${transferForm.descricao} - Saída para ${contaDestino?.nome}`,
        valor: valor,
        vencimento: transferForm.data,
        status: "pago",
        conta_bancaria_id: contaOrigemId,
        categoria_id: categoriaTransferencia.id,
      }
      if (tid) contaPagarPayload.tenant_id = tid
      await supabase.from("contas_pagar").insert(contaPagarPayload)

      // 2. Criar conta a receber (entrada na conta destino) - já como RECEBIDO
      const contaReceberPayload: Record<string, unknown> = {
        descricao: `${transferForm.descricao} - Entrada de ${contaOrigem?.nome}`,
        valor: valor,
        vencimento: transferForm.data,
        status: "recebido",
        conta_bancaria_id: contaDestinoId,
        categoria_id: categoriaTransferencia.id,
      }
      if (tid) contaReceberPayload.tenant_id = tid
      await supabase.from("contas_receber").insert(contaReceberPayload)

      await mutate()
      setTransferDialogOpen(false)
      setTransferForm({
        contaOrigemId: "",
        contaDestinoId: "",
        valor: "",
        descricao: "Transferência entre contas",
        data: new Date().toISOString().split("T")[0],
      })
    } finally {
      setTransferSaving(false)
    }
  }, [transferForm, contas, mutate])

  const filtroLabels: Record<FiltroExtrato, string> = {
    hoje: "Hoje", ontem: "Ontem", "7dias": "7 dias", mes: "Este mes"
  }
  const extratoEntradas = extrato.filter((e) => e.tipo === "receita").reduce((a, e) => a + e.valor, 0)
  const extratoSaidas = extrato.filter((e) => e.tipo === "despesa").reduce((a, e) => a + e.valor, 0)

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="ml-[72px] flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Contas Bancarias" />
        <main className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Saldo Total</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xl font-bold text-card-foreground">
                        {showBalances ? formatCurrency(totalBalance) : "R$ ••••••"}
                      </p>
                      <button type="button" onClick={() => setShowBalances(!showBalances)} className="text-muted-foreground hover:text-foreground">
                        {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,60%,22%)]">
                    <Landmark className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Entradas do Mes</p>
                    <p className="mt-1 text-xl font-bold text-card-foreground">{showBalances ? formatCurrency(totalEntradas) : "R$ ••••••"}</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(142,71%,40%)]">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Saidas do Mes</p>
                    <p className="mt-1 text-xl font-bold text-card-foreground">{showBalances ? formatCurrency(totalSaidas) : "R$ ••••••"}</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(0,72%,51%)]">
                    <TrendingDown className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Contas Ativas</p>
                    <p className="mt-1 text-xl font-bold text-card-foreground">{contas.length}</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(216,20%,60%)]">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Seletor de Mês de Referência */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Mês de Referência</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setShowMonthDropdown(!showMonthDropdown); setShowYearDropdown(false) }}
                      className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm hover:bg-muted"
                    >
                      {MONTHS[refMonth - 1]}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {showMonthDropdown && (
                      <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                        {MONTHS.map((m, idx) => (
                          <button key={m} type="button"
                            onClick={() => { setRefMonth(idx + 1); setShowMonthDropdown(false) }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${idx + 1 === refMonth ? "bg-muted font-medium" : ""}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setShowYearDropdown(!showYearDropdown); setShowMonthDropdown(false) }}
                      className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm hover:bg-muted"
                    >
                      {refYear}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {showYearDropdown && (
                      <div className="absolute right-0 top-full z-20 mt-1 w-24 rounded-lg border border-border bg-card py-1 shadow-lg">
                        {[refYear - 1, refYear, refYear + 1].map((y) => (
                          <button key={y} type="button"
                            onClick={() => { setRefYear(y); setShowYearDropdown(false) }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${y === refYear ? "bg-muted font-medium" : ""}`}>
                            {y}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Movimentação e Conciliação */}
              <ConciliacaoContas month={refMonth} year={refYear} />

              {/* Table header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Minhas Contas</h2>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setTransferDialogOpen(true)} 
                    disabled={contas.length < 2}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-card-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeftRight className="h-4 w-4" />Transferir
                  </button>
                  <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4" />Nova Conta
                  </button>
                </div>
              </div>

              {/* Accounts Table */}
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Banco</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Nome / Tipo</th>
                        <th className="w-36 px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Agencia / Conta</th>
                        <th className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Entradas</th>
                        <th className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Saidas</th>
                        <th className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Saldo</th>
                        <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contas.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Landmark className="h-8 w-8 text-muted-foreground/40" />
                              <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
                              <button type="button" onClick={openNew} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="h-3.5 w-3.5" />Adicionar conta</button>
                            </div>
                          </td>
                        </tr>
                      ) : contas.map((conta) => {
                        const Icon = ICON_MAP[conta.tipo] || Landmark
                        const isSelected = selectedConta?.id === conta.id
                        const mov = movPorConta[conta.id] ?? { entradas: 0, saidas: 0 }
                        return (
                          <tr key={conta.id}
                            className={`group border-b border-border last:border-b-0 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                            <td className="px-4 py-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${conta.cor}18` }}>
                                <Icon className="h-4 w-4" style={{ color: conta.cor }} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button type="button" onClick={() => setSelectedConta(isSelected ? null : conta)} className="text-left">
                                <p className={`font-semibold hover:text-primary transition-colors ${isSelected ? "text-primary" : "text-card-foreground"}`}>{conta.nome}</p>
                                <p className="text-xs text-muted-foreground">{conta.tipo}</p>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-muted-foreground">Ag: {conta.agencia || "-"}</p>
                              <p className="text-xs text-muted-foreground">Cc: {conta.conta || "-"}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <ArrowDownLeft className="h-3.5 w-3.5 text-[hsl(142,71%,40%)]" />
                                <span className="text-sm font-medium text-[hsl(142,71%,40%)]">{showBalances ? formatCurrency(mov.entradas) : "••••"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(0,72%,51%)]" />
                                <span className="text-sm font-medium text-[hsl(0,72%,51%)]">{showBalances ? formatCurrency(mov.saidas) : "••••"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-base font-bold ${conta.saldo >= 0 ? "text-card-foreground" : "text-[hsl(0,72%,51%)]"}`}>
                                {showBalances ? formatCurrency(conta.saldo) : "R$ ••••••"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button type="button" onClick={() => openEdit(conta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => setDeleteConfirm(conta)} className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Extrato panel */}
          {selectedConta && (
            <div className="hidden w-[380px] shrink-0 border-l border-border bg-card xl:flex xl:flex-col">
              {/* Panel header */}
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${selectedConta.cor}18` }}>
                    {(() => { const I = ICON_MAP[selectedConta.tipo] || Landmark; return <I className="h-4 w-4" style={{ color: selectedConta.cor }} /> })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-card-foreground truncate">{selectedConta.nome}</p>
                    <p className="text-xs text-muted-foreground">{selectedConta.tipo}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedConta(null)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Saldo atual</p>
                    <p className={`text-base font-bold ${selectedConta.saldo >= 0 ? "text-card-foreground" : "text-[hsl(0,72%,51%)]"}`}>{showBalances ? formatCurrency(selectedConta.saldo) : "R$ ••••••"}</p>
                  </div>
                </div>
              </div>

              {/* Filtros extrato */}
              <div className="flex border-b border-border">
                {(["hoje", "ontem", "7dias", "mes"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFiltroExtrato(f)}
                    className={`flex flex-1 items-center justify-center py-2.5 text-xs font-medium transition-colors border-b-2 ${filtroExtrato === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {filtroLabels[f]}
                  </button>
                ))}
              </div>

              {/* Resumo extrato */}
              <div className="grid grid-cols-2 gap-3 border-b border-border px-4 py-3">
                <div className="rounded-lg bg-[hsl(142,71%,40%)]/10 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Entradas</p>
                  <p className="text-sm font-bold text-[hsl(142,71%,40%)]">{formatCurrency(extratoEntradas)}</p>
                </div>
                <div className="rounded-lg bg-[hsl(0,72%,51%)]/10 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Saidas</p>
                  <p className="text-sm font-bold text-[hsl(0,72%,51%)]">{formatCurrency(extratoSaidas)}</p>
                </div>
              </div>

              {/* Extrato list */}
              <div className="flex-1 overflow-y-auto">
                {extratoLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : extrato.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground">Nenhum lancamento no periodo.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {extrato.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${e.tipo === "receita" ? "bg-[hsl(142,71%,40%)]/10" : "bg-[hsl(0,72%,51%)]/10"}`}>
                          {e.tipo === "receita"
                            ? <ArrowDownLeft className="h-3.5 w-3.5 text-[hsl(142,71%,40%)]" />
                            : <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(0,72%,51%)]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-card-foreground">{e.descricao}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(e.data)}</p>
                        </div>
                        <span className={`text-sm font-semibold ${e.tipo === "receita" ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>
                          {e.tipo === "receita" ? "+" : "-"}{formatCurrency(Math.abs(e.valor))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Panel footer */}
              <div className="border-t border-border px-5 py-3">
                <p className="text-xs text-muted-foreground">{extrato.length} lancamentos</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta" : "Nova Conta Bancaria"}</DialogTitle>
            <DialogDescription>{editingConta ? "Atualize os dados da conta." : "Preencha os dados para adicionar uma nova conta."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="nome">Nome do Banco</Label><Input id="nome" placeholder="Ex: Nubank, Bradesco..." value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Conta</Label>
              <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option>Conta Corrente</option><option>Poupanca</option><option>Cartao de Credito</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="agencia">Agencia</Label><Input id="agencia" placeholder="0001" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="conta_num">Conta</Label><Input id="conta_num" placeholder="12345-6" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="saldo">{editingConta ? "Saldo Inicial" : "Saldo Inicial"}</Label>
              <Input id="saldo" type="number" step="0.01" placeholder="0.00" value={form.saldo} onChange={(e) => setForm({ ...form, saldo: e.target.value })} />
              {editingConta && <p className="text-xs text-muted-foreground">O saldo atual sera recalculado automaticamente com base neste valor mais os lancamentos.</p>}
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingConta ? "Salvar" : "Adicionar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>Deseja excluir a conta {deleteConfirm?.nome}? Esta acao nao pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Transferência entre Contas */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Transferencia entre Contas
            </DialogTitle>
            <DialogDescription>
              Transfira valores entre suas contas bancarias. Esta operacao nao afeta o DRE.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="contaOrigem">Conta de Origem (saida)</Label>
              <select
                id="contaOrigem"
                value={transferForm.contaOrigemId}
                onChange={(e) => setTransferForm({ ...transferForm, contaOrigemId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione a conta de origem...</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} - Saldo: {formatCurrency(c.saldo)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contaDestino">Conta de Destino (entrada)</Label>
              <select
                id="contaDestino"
                value={transferForm.contaDestinoId}
                onChange={(e) => setTransferForm({ ...transferForm, contaDestinoId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione a conta de destino...</option>
                {contas.filter(c => c.id.toString() !== transferForm.contaOrigemId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} - Saldo: {formatCurrency(c.saldo)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valorTransfer">Valor</Label>
              <Input
                id="valorTransfer"
                type="text"
                placeholder="R$ 0,00"
                value={transferForm.valor}
                onChange={(e) => setTransferForm({ ...transferForm, valor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataTransfer">Data da Transferencia</Label>
              <Input
                id="dataTransfer"
                type="date"
                value={transferForm.data}
                onChange={(e) => setTransferForm({ ...transferForm, data: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricaoTransfer">Descricao</Label>
              <Input
                id="descricaoTransfer"
                type="text"
                placeholder="Ex: Transferência entre contas"
                value={transferForm.descricao}
                onChange={(e) => setTransferForm({ ...transferForm, descricao: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setTransferDialogOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={transferSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {transferSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transferir"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
