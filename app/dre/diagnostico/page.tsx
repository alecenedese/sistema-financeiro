"use client"

import { useState } from "react"
import { useTenant } from "@/hooks/use-tenant"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ESTRUTURA_DRE, calcularDRE, normalizarGrupoDRE } from "@/lib/dre-structure"
import { analisarDRE, ResultadoAnaliseDRE, AlertaDRE } from "@/lib/dre-analise"

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

interface DiagnosticoItem {
  tipo: string
  id: number
  descricao: string
  categoria_nome: string
  grupo_dre: string | null
  valor: number
  data: string
  status: string
}

export default function DREDiagnosticoPage() {
  const { tenant } = useTenant()
  const [month, setMonth] = useState(3)
  const [year, setYear] = useState(2026)
  const [loading, setLoading] = useState(false)
  const [analise, setAnalise] = useState<ResultadoAnaliseDRE | null>(null)
  const [data, setData] = useState<{
    recebimentos: DiagnosticoItem[]
    pagamentos: DiagnosticoItem[]
    vendas: { total: number; items: any[] }
    grupos: Record<string, number>
    valoresCalculados: Record<string, number>
  } | null>(null)

  const meses = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ]

  const anos = [2024, 2025, 2026, 2027]

  async function carregarDados() {
    if (!tenant?.id) return
    setLoading(true)

    const supabase = createClient()
    const from = `${year}-${String(month).padStart(2, "0")}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

    // Buscar contas_receber
    const { data: recData } = await supabase
      .from("contas_receber")
      .select("id, descricao, valor, vencimento, status, categorias(id, nome, grupo_dre)")
      .eq("tenant_id", tenant.id)
      .eq("status", "recebido")
      .gte("vencimento", from)
      .lte("vencimento", to)

    // Buscar contas_pagar
    const { data: pagData } = await supabase
      .from("contas_pagar")
      .select("id, descricao, valor, vencimento, status, categorias(id, nome, grupo_dre)")
      .eq("tenant_id", tenant.id)
      .eq("status", "pago")
      .gte("vencimento", from)
      .lte("vencimento", to)

    // Buscar vendas
    const { data: vendasData } = await supabase
      .from("vendas")
      .select("id, cliente_nome, valor_total, data_venda")
      .eq("tenant_id", tenant.id)
      .gte("data_venda", from)
      .lte("data_venda", to + "T23:59:59")

    // Processar dados
    const recebimentos: DiagnosticoItem[] = []
    const pagamentos: DiagnosticoItem[] = []
    const grupos: Record<string, number> = {}
    let totalRecebimentos = 0

    // Processar recebimentos
    for (const r of recData || []) {
      const cat = r.categorias as any
      const grupo = normalizarGrupoDRE(cat?.grupo_dre) || "1.2"
      const valor = Number(r.valor) || 0

      recebimentos.push({
        tipo: "Recebimento",
        id: r.id,
        descricao: r.descricao,
        categoria_nome: cat?.nome || "(sem categoria)",
        grupo_dre: grupo,
        valor,
        data: r.vencimento,
        status: r.status,
      })

      totalRecebimentos += valor

      const node = ESTRUTURA_DRE.find(n => n.codigo === grupo)
      if (node && node.fonte === "cr") {
        grupos[grupo] = (grupos[grupo] || 0) + valor
      }
    }

    // Processar pagamentos
    for (const p of pagData || []) {
      const cat = p.categorias as any
      const grupo = normalizarGrupoDRE(cat?.grupo_dre) || "7.2"
      const valor = Number(p.valor) || 0

      pagamentos.push({
        tipo: "Pagamento",
        id: p.id,
        descricao: p.descricao,
        categoria_nome: cat?.nome || "(sem categoria)",
        grupo_dre: grupo,
        valor,
        data: p.vencimento,
        status: p.status,
      })

      const node = ESTRUTURA_DRE.find(n => n.codigo === grupo)
      if (node && node.fonte === "cp") {
        grupos[grupo] = (grupos[grupo] || 0) + valor
      }
    }

    // Processar vendas
    const totalVendas = (vendasData || []).reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0)
    grupos["1.1"] = (grupos["1.1"] || 0) + totalVendas

    // Adicionar recebimentos totais
    grupos["6.0"] = totalRecebimentos

    // Calcular DRE
    const valoresCalculados = calcularDRE(grupos)

    // Gerar análise automática
    const resultadoAnalise = analisarDRE(valoresCalculados)
    setAnalise(resultadoAnalise)

    setData({
      recebimentos,
      pagamentos,
      vendas: { total: totalVendas, items: vendasData || [] },
      grupos,
      valoresCalculados,
    })

    setLoading(false)
  }

  async function salvarAnalise() {
    if (!tenant?.id || !analise || !data) return

    const supabase = createClient()
    const v = data.valoresCalculados

    const { error } = await supabase
      .from("dre_analises")
      .upsert({
        tenant_id: tenant.id,
        ano: year,
        mes: month,
        receita_bruta: v["1.0"] || 0,
        deducoes_receita: v["2.0"] || 0,
        receita_liquida: v["3.0"] || 0,
        custo_direto: v["4.0"] || 0,
        lucro_bruto: v["5.0"] || 0,
        perc_lucro_bruto: analise.percentuais.lucroBruto,
        recebimentos_mes: v["6.0"] || 0,
        despesas_operacionais: v["7.0"] || 0,
        receitas_despesas_financeiras: v["8.0"] || 0,
        lucro_liquido: v["9.0"] || 0,
        perc_lucro_liquido: analise.percentuais.lucroLiquido,
        retiradas_caixa: v["10.0"] || 0,
        resultado_financeiro: v["11.0"] || 0,
        perc_resultado_financeiro: analise.percentuais.resultadoFinanceiro,
        analise_estrategica: analise.analise,
        status_margem: analise.status.margem,
        status_caixa: analise.status.caixa,
        alertas: analise.alertas,
      }, { onConflict: "tenant_id,ano,mes" })

    if (error) {
      alert("Erro ao salvar análise: " + error.message)
    } else {
      alert("✅ Análise salva com sucesso!")
    }
  }

  const dreOrdem = ["1.0", "1.1", "1.2", "2.0", "2.1", "2.2", "3.0", "4.0", "4.1", "5.0", "6.0", "7.0", "7.1", "7.2", "7.3", "8.0", "8.1", "8.2", "9.0", "10.0", "10.1", "10.2", "11.0"]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Diagnóstico DRE - {tenant?.nome}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Período de Análise</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={month.toString()} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {meses.map(m => (
                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map(a => (
                <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={carregarDados} disabled={loading}>
            {loading ? "Carregando..." : "Carregar Dados"}
          </Button>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Resumo DRE */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo DRE Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">% Receita Bruta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dreOrdem.map(codigo => {
                    const node = ESTRUTURA_DRE.find(n => n.codigo === codigo)
                    if (!node) return null
                    const valor = data.valoresCalculados[codigo] || 0
                    const receitaBruta = data.valoresCalculados["1.0"] || 1
                    const percentual = receitaBruta > 0 ? (valor / receitaBruta) * 100 : 0

                    return (
                      <TableRow key={codigo} className={node.destaque ? "bg-slate-50 font-medium" : ""}>
                        <TableCell>{codigo}</TableCell>
                        <TableCell className={node.parent ? "pl-8" : ""}>{node.label}</TableCell>
                        <TableCell className={`text-right ${valor >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(valor)}
                        </TableCell>
                        <TableCell className="text-right">
                          {node.tipo !== "neutro" && codigo !== "1.0" ? `${percentual.toFixed(2)}%` : "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Análise Inteligente com Alertas */}
          {analise && (
            <Card className={analise.status.caixa === "negativo" ? "border-red-300" : analise.status.margem === "saudavel" ? "border-green-300" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>🧠 Análise Inteligente do DRE</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      analise.status.margem === "saudavel" ? "bg-green-100 text-green-800" :
                      analise.status.margem === "atencao" ? "bg-yellow-100 text-yellow-800" :
                      analise.status.margem === "critico" ? "bg-red-100 text-red-800" :
                      "bg-slate-100 text-slate-800"
                    }`}>
                      Margem: {analise.status.margem}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      analise.status.caixa === "positivo" ? "bg-green-100 text-green-800" :
                      analise.status.caixa === "negativo" ? "bg-red-100 text-red-800" :
                      "bg-slate-100 text-slate-800"
                    }`}>
                      Caixa: {analise.status.caixa}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => salvarAnalise()}>
                    💾 Salvar Análise
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Interpretação */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-700 mb-1">📊 Resumo da Operação</p>
                  <p className="text-slate-800">{analise.analise.resumoOperacao.interpretacao}</p>
                </div>

                {/* Cards principais */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">Receita Líquida</p>
                    <p className="text-xl font-bold text-green-800">
                      {formatCurrency(analise.analise.resumoOperacao.receitaLiquida)}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">Lucro Bruto</p>
                    <p className="text-xl font-bold text-blue-800">
                      {formatCurrency(analise.analise.resumoOperacao.lucroBruto)}
                      <span className="text-sm font-normal ml-2">
                        ({analise.analise.resumoOperacao.percLucroBruto.toFixed(2)}%)
                      </span>
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-700">Lucro Líquido</p>
                    <p className="text-xl font-bold text-purple-800">
                      {formatCurrency(analise.analise.resumoOperacao.lucroLiquido)}
                      <span className="text-sm font-normal ml-2">
                        ({analise.analise.resumoOperacao.percLucroLiquido.toFixed(2)}%)
                      </span>
                    </p>
                  </div>
                </div>

                {/* Caixa Livre */}
                <div className={`p-4 rounded-lg ${analise.caixaLivre > 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <p className={`text-sm font-medium ${analise.caixaLivre > 0 ? "text-emerald-700" : "text-red-700"}`}>
                    💰 Caixa Livre (Lucro Líquido - Investimentos)
                  </p>
                  <p className={`text-2xl font-bold ${analise.caixaLivre > 0 ? "text-emerald-800" : "text-red-800"}`}>
                    {formatCurrency(analise.caixaLivre)}
                  </p>
                  <p className={`text-xs mt-2 ${analise.caixaLivre > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {analise.analise.indicadores.caixaSaudavel
                      ? "✅ Caixa saudável - retiradas dentro do limite"
                      : "⚠️ Atenção: Retiradas podem estar comprometendo o caixa"}
                  </p>
                </div>

                {/* Pontos Fortes */}
                {analise.analise.pontosFortes.length > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-700 mb-2">✅ Pontos Fortes</p>
                    <ul className="space-y-1">
                      {analise.analise.pontosFortes.map((ponto, i) => (
                        <li key={i} className="text-sm text-green-800">• {ponto}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pontos de Atenção */}
                {analise.analise.pontosAtencao.length > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-yellow-700 mb-2">⚠️ Pontos de Atenção</p>
                    <ul className="space-y-1">
                      {analise.analise.pontosAtencao.map((ponto, i) => (
                        <li key={i} className="text-sm text-yellow-800">• {ponto}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Alertas */}
                {analise.alertas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">🔔 Alertas e Insights</p>
                    {analise.alertas.map((alerta, i) => (
                      <div key={i} className={`p-3 rounded-lg ${
                        alerta.tipo === "success" ? "bg-green-100 border border-green-200" :
                        alerta.tipo === "warning" ? "bg-yellow-100 border border-yellow-200" :
                        alerta.tipo === "critical" ? "bg-red-100 border border-red-200" :
                        "bg-blue-100 border border-blue-200"
                      }`}>
                        <p className={`font-medium text-sm ${
                          alerta.tipo === "success" ? "text-green-800" :
                          alerta.tipo === "warning" ? "text-yellow-800" :
                          alerta.tipo === "critical" ? "text-red-800" :
                          "text-blue-800"
                        }`}>
                          {alerta.titulo}
                          {alerta.codigo && <span className="text-xs ml-2 opacity-60">({alerta.codigo})</span>}
                        </p>
                        <p className={`text-sm mt-1 ${
                          alerta.tipo === "success" ? "text-green-700" :
                          alerta.tipo === "warning" ? "text-yellow-700" :
                          alerta.tipo === "critical" ? "text-red-700" :
                          "text-blue-700"
                        }`}>
                          {alerta.mensagem}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recomendações */}
                {analise.analise.recomendacoes.length > 0 && (
                  <div className="p-4 bg-slate-100 rounded-lg">
                    <p className="text-sm font-medium text-slate-700 mb-2">📋 Recomendações</p>
                    <ol className="space-y-1">
                      {analise.analise.recomendacoes.map((rec, i) => (
                        <li key={i} className="text-sm text-slate-800">{i + 1}. {rec}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Detalhamento por Grupo */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento por Grupo DRE</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo DRE</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="text-right">Valor Agregado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ESTRUTURA_DRE.filter(n => n.fonte && n.fonte !== "none").map(node => {
                    const valor = data.grupos[node.codigo] || 0
                    return (
                      <TableRow key={node.codigo}>
                        <TableCell className="font-medium">{node.codigo}</TableCell>
                        <TableCell>{node.label}</TableCell>
                        <TableCell>
                          {node.fonte === "cr" && "Contas a Receber"}
                          {node.fonte === "cp" && "Contas a Pagar"}
                          {node.fonte === "vendas" && "Vendas"}
                        </TableCell>
                        <TableCell className={`text-right ${node.tipo === "credito" ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(valor)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lista de Recebimentos */}
          <Card>
            <CardHeader>
              <CardTitle>Recebimentos do Mês ({data.recebimentos.length} itens)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Grupo DRE</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recebimentos.map(r => (
                    <TableRow key={`rec-${r.id}`}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell>{r.descricao}</TableCell>
                      <TableCell>{r.categoria_nome}</TableCell>
                      <TableCell>{r.grupo_dre}</TableCell>
                      <TableCell>{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(r.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lista de Pagamentos */}
          <Card>
            <CardHeader>
              <CardTitle>Pagamentos do Mês ({data.pagamentos.length} itens)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Grupo DRE</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pagamentos.map(p => (
                    <TableRow key={`pag-${p.id}`}>
                      <TableCell>{p.id}</TableCell>
                      <TableCell>{p.descricao}</TableCell>
                      <TableCell>{p.categoria_nome}</TableCell>
                      <TableCell>{p.grupo_dre}</TableCell>
                      <TableCell>{new Date(p.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(p.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
