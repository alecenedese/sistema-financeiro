import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const tenantId = searchParams.get("tenantId") ? Number(searchParams.get("tenantId")) : null

  console.log("[v0] API dashboard-data - month:", month, "year:", year, "tenantId:", tenantId)

  const supabase = await createClient()
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  // Calcula o ultimo dia do mes corretamente (new Date(year, month, 0) retorna o ultimo dia do mes anterior)
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  console.log("[v0] API dashboard-data - from:", from, "to:", to, "lastDay:", lastDay)

  try {
    // Busca contas a receber - tenta por vencimento primeiro
    let qReceber = supabase
      .from("contas_receber")
      .select("id, valor, status, vencimento, data_vencimento, categoria_id, categorias(nome)")
    if (tenantId) qReceber = qReceber.eq("tenant_id", tenantId)

    // Busca contas a receber por data_vencimento também
    let qReceberDataVenc = supabase
      .from("contas_receber")
      .select("id, valor, status, vencimento, data_vencimento, categoria_id, categorias(nome)")
      .gte("data_vencimento", from)
      .lte("data_vencimento", to)
    if (tenantId) qReceberDataVenc = qReceberDataVenc.eq("tenant_id", tenantId)

    // Busca contas a pagar
    let qPagar = supabase
      .from("contas_pagar")
      .select("id, valor, status, vencimento, data_vencimento, categoria_id, categorias(nome)")
    if (tenantId) qPagar = qPagar.eq("tenant_id", tenantId)

    // Busca contas a pagar por data_vencimento também
    let qPagarDataVenc = supabase
      .from("contas_pagar")
      .select("id, valor, status, vencimento, data_vencimento, categoria_id, categorias(nome)")
      .gte("data_vencimento", from)
      .lte("data_vencimento", to)
    if (tenantId) qPagarDataVenc = qPagarDataVenc.eq("tenant_id", tenantId)

    // Busca saldo das contas
    let qContas = supabase.from("contas_bancarias").select("id, nome, saldo")
    if (tenantId) {
      qContas = qContas.eq("tenant_id", tenantId)
    }

    // Verifica tabelas alternativas também
    let qContasAPagar = supabase
      .from("contas_a_pagar")
      .select("valor, status, data_vencimento")
      .gte("data_vencimento", from)
      .lte("data_vencimento", to)
    if (tenantId) qContasAPagar = qContasAPagar.eq("tenant_id", tenantId)

    let qContasAReceber = supabase
      .from("contas_a_receber")
      .select("valor, status, data_vencimento")
      .gte("data_vencimento", from)
      .lte("data_vencimento", to)
    if (tenantId) qContasAReceber = qContasAReceber.eq("tenant_id", tenantId)

    let qLancamentos = supabase
      .from("lancamentos")
      .select("valor, tipo, data, status")
      .gte("data", from)
      .lte("data", to)
    if (tenantId) qLancamentos = qLancamentos.eq("tenant_id", tenantId)

    const [receberResult, receberDataVencResult, pagarResult, pagarDataVencResult, contasResult, capResult, carResult, lancResult] = await Promise.all([
      qReceber,
      qReceberDataVenc,
      qPagar,
      qPagarDataVenc,
      qContas,
      qContasAPagar,
      qContasAReceber,
      qLancamentos,
    ])

    // Log de todos os registros sem filtro de data para debug
    console.log("[v0] API dashboard-data - TOTAL SEM FILTRO DE DATA:")
    console.log("[v0] contas_receber (all):", receberResult.data?.length ?? 0)
    console.log("[v0] contas_pagar (all):", pagarResult.data?.length ?? 0)
    
    // Log com filtro por data_vencimento
    console.log("[v0] API dashboard-data - FILTRADO POR DATA_VENCIMENTO:")
    console.log("[v0] contas_receber (data_vencimento):", receberDataVencResult.data?.length ?? 0, "error:", receberDataVencResult.error?.message ?? "none")
    console.log("[v0] contas_pagar (data_vencimento):", pagarDataVencResult.data?.length ?? 0, "error:", pagarDataVencResult.error?.message ?? "none")
    console.log("[v0] contas_bancarias:", contasResult.data?.length ?? 0, "error:", contasResult.error?.message ?? "none")
    console.log("[v0] contas_a_pagar:", capResult.data?.length ?? 0, "error:", capResult.error?.message ?? "none")
    console.log("[v0] contas_a_receber:", carResult.data?.length ?? 0, "error:", carResult.error?.message ?? "none")
    console.log("[v0] lancamentos:", lancResult.data?.length ?? 0, "error:", lancResult.error?.message ?? "none")
    
    if (capResult.data?.length) {
      console.log("[v0] Exemplo contas_a_pagar:", JSON.stringify(capResult.data.slice(0, 2)))
    }
    if (carResult.data?.length) {
      console.log("[v0] Exemplo contas_a_receber:", JSON.stringify(carResult.data.slice(0, 2)))
    }
    if (lancResult.data?.length) {
      console.log("[v0] Exemplo lancamentos:", JSON.stringify(lancResult.data.slice(0, 2)))
    }

    // Mostra exemplos de registros para debug
    if (receberResult.data?.length) {
      console.log("[v0] Sample receber (all):", JSON.stringify(receberResult.data.slice(0, 2)))
    }
    if (receberDataVencResult.data?.length) {
      console.log("[v0] Sample receber (data_vencimento filtered):", JSON.stringify(receberDataVencResult.data.slice(0, 2)))
    }
    if (pagarResult.data?.length) {
      console.log("[v0] Sample pagar (all):", JSON.stringify(pagarResult.data.slice(0, 2)))
    }
    if (pagarDataVencResult.data?.length) {
      console.log("[v0] Sample pagar (data_vencimento filtered):", JSON.stringify(pagarDataVencResult.data.slice(0, 2)))
    }

    // Usa dados filtrados por data_vencimento (que parece ser o campo correto)
    // Se não houver, tenta filtrar por vencimento localmente
    let receber = receberDataVencResult.data || []
    let pagar = pagarDataVencResult.data || []
    
    // Se não encontrou por data_vencimento, filtra localmente por vencimento
    if (receber.length === 0 && receberResult.data?.length) {
      receber = receberResult.data.filter(r => {
        const venc = r.vencimento || r.data_vencimento
        return venc && venc >= from && venc <= to
      })
      console.log("[v0] Filtered receber by vencimento locally:", receber.length)
    }
    if (pagar.length === 0 && pagarResult.data?.length) {
      pagar = pagarResult.data.filter(p => {
        const venc = p.vencimento || p.data_vencimento
        return venc && venc >= from && venc <= to
      })
      console.log("[v0] Filtered pagar by vencimento locally:", pagar.length)
    }

    const contas = contasResult.data || []
    
    console.log("[v0] FINAL - receber:", receber.length, "pagar:", pagar.length)

    // Calcula metricas
    const faturamento = receber.reduce((acc, r) => acc + Number(r.valor), 0)
    const recebimentos = receber
      .filter(r => r.status === "recebido" || r.status === "confirmado")
      .reduce((acc, r) => acc + Number(r.valor), 0)
    const pagamentos = pagar
      .filter(r => r.status === "pago" || r.status === "confirmado")
      .reduce((acc, r) => acc + Number(r.valor), 0)
    const totalPagar = pagar.reduce((acc, r) => acc + Number(r.valor), 0)

    const lucroBruto = faturamento - totalPagar
    const percLucroBruto = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0
    const lucroLiquido = recebimentos - pagamentos
    const percLucroLiquido = recebimentos > 0 ? (lucroLiquido / recebimentos) * 100 : 0
    const saldoConta = contas.reduce((acc, c) => acc + Number(c.saldo ?? 0), 0)

    console.log("[v0] API dashboard-data - faturamento:", faturamento, "pagamentos:", pagamentos, "lucroBruto:", lucroBruto)

    // Agrupa despesas por categoria
    const despesasPorCategoria: Record<string, number> = {}
    for (const p of pagar) {
      const cat = (p.categorias as { nome: string } | null)?.nome || "Sem categoria"
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + Number(p.valor)
    }

    // Fluxo de caixa diario - usa vencimento ou data_vencimento
    const daysInMonth = new Date(year, month, 0).getDate()
    const fluxoCaixaDiario: { dia: number; valor: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const recDia = receber
        .filter(r => {
          const venc = r.vencimento || r.data_vencimento
          return venc === dateStr && (r.status === "recebido" || r.status === "confirmado")
        })
        .reduce((acc, r) => acc + Number(r.valor), 0)
      const pagDia = pagar
        .filter(r => {
          const venc = r.vencimento || r.data_vencimento
          return venc === dateStr && (r.status === "pago" || r.status === "confirmado")
        })
        .reduce((acc, r) => acc + Number(r.valor), 0)
      fluxoCaixaDiario.push({ dia: d, valor: recDia - pagDia })
    }

    // Fluxo de vendas diario
    const fluxoVendasDiario: { dia: number; valor: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const vendasDia = receber
        .filter(r => {
          const venc = r.vencimento || r.data_vencimento
          return venc === dateStr
        })
        .reduce((acc, r) => acc + Number(r.valor), 0)
      fluxoVendasDiario.push({ dia: d, valor: vendasDia })
    }

    return NextResponse.json({
      success: true,
      data: {
        metricas: {
          faturamento,
          pagamentos,
          lucroBruto,
          percLucroBruto,
          recebimentos,
          lucroLiquido,
          percLucroLiquido,
          saldoConta,
        },
        despesasPorCategoria: Object.entries(despesasPorCategoria)
          .sort((a, b) => b[1] - a[1])
          .map(([nome, valor]) => ({ nome, valor })),
        fluxoCaixaDiario,
        fluxoVendasDiario,
        counts: {
          receber: receber.length,
          pagar: pagar.length,
          contas: contas.length,
        },
      },
    })
  } catch (error) {
    console.error("[v0] API dashboard-data - error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
