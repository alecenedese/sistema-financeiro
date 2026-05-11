import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const tenantId = searchParams.get("tenantId") ? Number(searchParams.get("tenantId")) : null
  // Offset de timezone em minutos (enviado pelo client para respeitar o fuso do usuário)
  const tzOffset = Number(searchParams.get("tzOffset")) || 0

  console.log("[v0] API dashboard-data - month:", month, "year:", year, "tenantId:", tenantId, "tzOffset:", tzOffset)

  const supabase = await createClient()

  // Calcula limites do mês ajustados pelo timezone do usuário
  // getTimezoneOffset() retorna minutos POSITIVOS para timezones atrás do UTC
  // UTC-3 (Brasil) → tzOffset = +180
  // Para obter "April 1 00:00 LOCAL" em UTC, precisamos ADICIONAR o offset:
  // April 1 00:00 UTC + 180min = April 1 03:00 UTC = April 1 00:00 UTC-3 ✓
  const baseFrom = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  baseFrom.setUTCMinutes(baseFrom.getUTCMinutes() + tzOffset)
  const fromISO = baseFrom.toISOString()

  const baseTo = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  baseTo.setUTCMinutes(baseTo.getUTCMinutes() + tzOffset)
  const toISO = baseTo.toISOString()

  console.log("[v0] API dashboard-data - from:", fromISO, "to:", toISO)

  try {
    // Busca contas a receber pelo campo vencimento (principal)
    let qReceber = supabase
      .from("contas_receber")
      .select("id, valor, status, vencimento, categoria_id, categorias(nome)")
      .gte("vencimento", fromISO)
      .lt("vencimento", toISO)
    if (tenantId) qReceber = qReceber.eq("tenant_id", tenantId)

    // Busca contas a pagar pelo campo vencimento (principal)
    let qPagar = supabase
      .from("contas_pagar")
      .select("id, valor, status, vencimento, categoria_id, categorias(nome)")
      .gte("vencimento", fromISO)
      .lt("vencimento", toISO)
    if (tenantId) qPagar = qPagar.eq("tenant_id", tenantId)

    // Busca saldo das contas bancarias
    let qContas = supabase.from("contas_bancarias").select("id, nome, saldo")
    if (tenantId) qContas = qContas.eq("tenant_id", tenantId)

    // Busca vendas da tabela vendas (valor_total é o total de vendas real)
    // Usa fetchAll para paginar e bypassar o limite de 1000 do Supabase
    const [receberResult, pagarResult, contasResult, vendasRows] = await Promise.all([
      qReceber,
      qPagar,
      qContas,
      fetchAll<Record<string, unknown>>(
        tenantId
          ? supabase.from("vendas").select("valor_total").gte("data_venda", fromISO).lt("data_venda", toISO).eq("tenant_id", tenantId)
          : supabase.from("vendas").select("valor_total").gte("data_venda", fromISO).lt("data_venda", toISO)
      ),
    ])

    console.log("[v0] contas_receber:", receberResult.data?.length ?? 0, "error:", receberResult.error?.message ?? "none")
    console.log("[v0] contas_pagar:", pagarResult.data?.length ?? 0, "error:", pagarResult.error?.message ?? "none")
    console.log("[v0] contas_bancarias:", contasResult.data?.length ?? 0, "error:", contasResult.error?.message ?? "none")
    console.log("[v0] vendas:", vendasRows.length, "error: none")

    const receber = receberResult.data || []
    const pagar = pagarResult.data || []
    const contas = contasResult.data || []
    const vendas = vendasRows

    function isTransferCat(nome: string): boolean {
      return nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes("transferencia entre")
    }

    const receberSemTransf = receber.filter(
      r => !isTransferCat((r.categorias as { nome?: string } | null)?.nome || "")
    )

    // Calcula metricas
    // Total de vendas vem da tabela vendas (valor_total)
    const totalVendas = vendas.reduce((acc, v) => acc + Number(v.valor_total), 0)
    const faturamento = receberSemTransf.reduce((acc, r) => acc + Number(r.valor), 0)
    const recebimentos = receberSemTransf
      .filter(r => r.status === "recebido" || r.status === "confirmado")
      .reduce((acc, r) => acc + Number(r.valor), 0)
    const pagamentos = pagar
      .filter(r => r.status === "pago" || r.status === "confirmado")
      .reduce((acc, r) => acc + Number(r.valor), 0)
    const totalPagar = pagar.reduce((acc, r) => acc + Number(r.valor), 0)
    // totalDespesas = mesmo total do gráfico Despesas por Categoria (todas as contas_pagar do período, sem filtro de status)
    const totalDespesas = totalPagar

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
      const recDia = receberSemTransf
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
      const vendasDia = receberSemTransf
        .filter(r => r.vencimento === dateStr)
        .reduce((acc, r) => acc + Number(r.valor), 0)
      fluxoVendasDiario.push({ dia: d, valor: vendasDia })
    }

    return NextResponse.json({
      success: true,
      data: {
        metricas: {
          totalVendas,
          faturamento,
          pagamentos,
          totalDespesas,
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
