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
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  console.log("[v0] API dashboard-data - from:", from, "to:", to)

  try {
    // Busca contas a receber pelo campo vencimento (principal)
    let qReceber = supabase
      .from("contas_receber")
      .select("id, valor, status, vencimento, categoria_id, categorias(nome)")
      .gte("vencimento", from)
      .lte("vencimento", to)
    if (tenantId) qReceber = qReceber.eq("tenant_id", tenantId)

    // Busca contas a pagar pelo campo vencimento (principal)
    let qPagar = supabase
      .from("contas_pagar")
      .select("id, valor, status, vencimento, categoria_id, categorias(nome)")
      .gte("vencimento", from)
      .lte("vencimento", to)
    if (tenantId) qPagar = qPagar.eq("tenant_id", tenantId)

    // Busca saldo das contas bancarias
    let qContas = supabase.from("contas_bancarias").select("id, nome, saldo")
    if (tenantId) qContas = qContas.eq("tenant_id", tenantId)

    const [receberResult, pagarResult, contasResult] = await Promise.all([
      qReceber,
      qPagar,
      qContas,
    ])

    console.log("[v0] contas_receber:", receberResult.data?.length ?? 0, "error:", receberResult.error?.message ?? "none")
    console.log("[v0] contas_pagar:", pagarResult.data?.length ?? 0, "error:", pagarResult.error?.message ?? "none")
    console.log("[v0] contas_bancarias:", contasResult.data?.length ?? 0, "error:", contasResult.error?.message ?? "none")

    const receber = receberResult.data || []
    const pagar = pagarResult.data || []
    const contas = contasResult.data || []

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

    console.log("[v0] faturamento:", faturamento, "pagamentos:", pagamentos, "lucroBruto:", lucroBruto)

    // Agrupa despesas por categoria
    const despesasPorCategoria: Record<string, number> = {}
    for (const p of pagar) {
      const cat = (p.categorias as { nome: string } | null)?.nome || "Sem categoria"
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + Number(p.valor)
    }

    // Fluxo de caixa diario
    const daysInMonth = new Date(year, month, 0).getDate()
    const fluxoCaixaDiario: { dia: number; valor: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const recDia = receber
        .filter(r => r.vencimento === dateStr && (r.status === "recebido" || r.status === "confirmado"))
        .reduce((acc, r) => acc + Number(r.valor), 0)
      const pagDia = pagar
        .filter(r => r.vencimento === dateStr && (r.status === "pago" || r.status === "confirmado"))
        .reduce((acc, r) => acc + Number(r.valor), 0)
      fluxoCaixaDiario.push({ dia: d, valor: recDia - pagDia })
    }

    // Fluxo de vendas diario
    const fluxoVendasDiario: { dia: number; valor: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const vendasDia = receber
        .filter(r => r.vencimento === dateStr)
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
