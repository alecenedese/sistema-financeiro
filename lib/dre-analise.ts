// Análise automática e insights do DRE Financeiro
// Baseado na análise estratégica do modelo Audithorium

export interface DREValores {
  "1.0"?: number // Receita Bruta
  "1.1"?: number // Receita de Vendas
  "1.2"?: number // Receita de Serviços
  "2.0"?: number // Deduções da Receita Bruta
  "2.1"?: number // Impostos sobre vendas
  "2.2"?: number // Devoluções
  "3.0"?: number // Receita Líquida
  "4.0"?: number // Custo direto de Vendas
  "4.1"?: number // Custo com Produto
  "5.0"?: number // Lucro Bruto
  "6.0"?: number // Recebimentos do Mês
  "7.0"?: number // Despesas operacionais
  "7.1"?: number // Despesas Administrativas
  "7.2"?: number // Despesas Operacionais
  "7.3"?: number // Despesas com Pessoal
  "8.0"?: number // Receitas e Despesas Financeiras
  "8.1"?: number // Receitas Financeiras
  "8.2"?: number // Despesas Financeiras
  "9.0"?: number // Lucro Líquido
  "10.0"?: number // Retiradas do Caixa
  "10.1"?: number // Retiradas do Caixa
  "10.2"?: number // Distribuição de Lucro
  "11.0"?: number // Resultado Financeiro
  [key: string]: number | undefined
}

export interface AlertaDRE {
  tipo: "info" | "warning" | "critical" | "success"
  titulo: string
  mensagem: string
  codigo?: string // referência ao código DRE relacionado
}

export interface AnaliseEstrategica {
  resumoOperacao: {
    receitaLiquida: number
    lucroBruto: number
    percLucroBruto: number
    lucroLiquido: number
    percLucroLiquido: number
    interpretacao: string
  }
  pontosFortes: string[]
  pontosAtencao: string[]
  recomendacoes: string[]
  indicadores: {
    margemBrutaSaudavel: boolean
    margemLiquidaSaudavel: boolean
    despesasEquilibradas: boolean
    caixaSaudavel: boolean
  }
}

export interface ResultadoAnaliseDRE {
  valores: DREValores
  percentuais: {
    lucroBruto: number
    lucroLiquido: number
    deducoes: number
    custo: number
    despesasOperacionais: number
    retiradas: number
    resultadoFinanceiro: number
  }
  caixaLivre: number
  analise: AnaliseEstrategica
  alertas: AlertaDRE[]
  status: {
    margem: "saudavel" | "atencao" | "critico" | "neutro"
    caixa: "positivo" | "negativo" | "neutro"
  }
}

export function analisarDRE(valores: DREValores | Record<string, number>): ResultadoAnaliseDRE {
  const v = valores as Record<string, number>
  const receitaBruta = v["1.0"] || 0
  const receitaLiquida = v["3.0"] || 0
  const lucroBruto = v["5.0"] || 0
  const lucroLiquido = v["9.0"] || 0
  const deducoes = v["2.0"] || 0
  const custo = v["4.0"] || 0
  const despesasOperacionais = v["7.0"] || 0
  const retiradas = v["10.0"] || 0
  const resultadoFinanceiro = v["11.0"] || 0
  const recebimentos = v["6.0"] || 0

  // Calcular percentuais (base: Receita Bruta)
  const percentuais = {
    lucroBruto: receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0,
    lucroLiquido: receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0,
    deducoes: receitaBruta > 0 ? (deducoes / receitaBruta) * 100 : 0,
    custo: receitaBruta > 0 ? (custo / receitaBruta) * 100 : 0,
    despesasOperacionais: receitaBruta > 0 ? (despesasOperacionais / receitaBruta) * 100 : 0,
    retiradas: receitaBruta > 0 ? (retiradas / receitaBruta) * 100 : 0,
    resultadoFinanceiro: receitaBruta > 0 ? (resultadoFinanceiro / receitaBruta) * 100 : 0,
  }

  // Caixa Livre = Lucro Líquido - Investimentos (Custo Direto)
  // Este é o valor disponível para distribuição sem comprometer o caixa
  const caixaLivre = lucroLiquido - custo

  // Alertas
  const alertas: AlertaDRE[] = []

  // 1. Verificar margens
  if (percentuais.lucroBruto > 50) {
    alertas.push({
      tipo: "success",
      titulo: "Margem Bruta Excelente",
      mensagem: `Sua margem bruta de ${percentuais.lucroBruto.toFixed(2)}% está acima da média do mercado (>50%). Operação muito saudável.`,
      codigo: "5.0"
    })
  } else if (percentuais.lucroBruto >= 30) {
    alertas.push({
      tipo: "success",
      titulo: "Margem Bruta Saudável",
      mensagem: `Margem bruta de ${percentuais.lucroBruto.toFixed(2)}% é considerada boa (acima de 30%).`,
      codigo: "5.0"
    })
  } else if (percentuais.lucroBruto < 20) {
    alertas.push({
      tipo: "warning",
      titulo: "Margem Bruta em Atenção",
      mensagem: `Margem bruta de ${percentuais.lucroBruto.toFixed(2)}% está abaixo do ideal (20%). Avalie seus custos e precificação.`,
      codigo: "5.0"
    })
  }

  if (percentuais.lucroLiquido > 25) {
    alertas.push({
      tipo: "success",
      titulo: "Margem Líquida Excelente",
      mensagem: `Margem líquida de ${percentuais.lucroLiquido.toFixed(2)}% demonstra excelente controle de despesas.`,
      codigo: "9.0"
    })
  } else if (percentuais.lucroLiquido < 10) {
    alertas.push({
      tipo: "critical",
      titulo: "Margem Líquida Crítica",
      mensagem: `Margem líquida de ${percentuais.lucroLiquido.toFixed(2)}% está muito baixa. Reveja suas despesas operacionais.`,
      codigo: "9.0"
    })
  }

  // 2. Verificar proporção de despesas
  if (percentuais.despesasOperacionais > 35) {
    alertas.push({
      tipo: "warning",
      titulo: "Despesas Operacionais Elevadas",
      mensagem: `Despesas operacionais representam ${percentuais.despesasOperacionais.toFixed(2)}% da receita (acima do recomendado de 25-30%).`,
      codigo: "7.0"
    })
  }

  // 3. Verificar Caixa Livre vs Retiradas
  if (retiradas > caixaLivre && caixaLivre > 0) {
    const excesso = retiradas - caixaLivre
    alertas.push({
      tipo: "critical",
      titulo: "Retirada Excede Caixa Livre",
      mensagem: `Você retirou ${formatCurrency(retiradas)}, mas seu caixa livre era de apenas ${formatCurrency(caixaLivre)}. Excesso: ${formatCurrency(excesso)}. Isso gera saldo negativo no resultado financeiro.`,
      codigo: "10.0"
    })
  } else if (caixaLivre <= 0) {
    alertas.push({
      tipo: "critical",
      titulo: "Caixa Livre Negativo ou Zero",
      mensagem: `Lucro Líquido (${formatCurrency(lucroLiquido)}) - Investimentos (${formatCurrency(custo)}) = Caixa Livre (${formatCurrency(caixaLivre)}). Não há capacidade de distribuição sem comprometer o caixa.`,
      codigo: "9.0"
    })
  }

  // 4. Verificar Resultado Financeiro
  if (resultadoFinanceiro < 0) {
    alertas.push({
      tipo: "warning",
      titulo: "Resultado Financeiro Negativo",
      mensagem: `O resultado de ${formatCurrency(resultadoFinanceiro)} não indica prejuízo operacional, mas sim excesso de saídas de caixa no mês. A empresa é lucrativa (${formatCurrency(lucroLiquido)}), mas a estratégia de caixa precisa de ajuste.`,
      codigo: "11.0"
    })
  } else if (resultadoFinanceiro > 0) {
    alertas.push({
      tipo: "success",
      titulo: "Resultado Financeiro Positivo",
      mensagem: `Parabéns! O resultado de ${formatCurrency(resultadoFinanceiro)} indica que você manteve caixa positivo além das retiradas.`,
      codigo: "11.0"
    })
  }

  // 5. Verificar custos específicos (ex: aluguel, cartão)
  const percCusto = receitaBruta > 0 ? (custo / receitaBruta) * 100 : 0
  if (percCusto > 15) {
    alertas.push({
      tipo: "info",
      titulo: "Custo Direto Elevado",
      mensagem: `Custo direto representa ${percCusto.toFixed(2)}% da receita. Se inclui aluguel/compra de loja, verifique se é estratégico para o negócio.`,
      codigo: "4.0"
    })
  }

  // Status
  let statusMargem: "saudavel" | "atencao" | "critico" | "neutro" = "neutro"
  if (percentuais.lucroLiquido > 20) statusMargem = "saudavel"
  else if (percentuais.lucroLiquido >= 10) statusMargem = "atencao"
  else if (percentuais.lucroLiquido > 0) statusMargem = "critico"

  const statusCaixa: "positivo" | "negativo" | "neutro" = resultadoFinanceiro > 0 ? "positivo" : resultadoFinanceiro < 0 ? "negativo" : "neutro"

  // Pontos fortes
  const pontosFortes: string[] = []
  if (percentuais.lucroBruto > 40) pontosFortes.push("Margem bruta acima da média do mercado")
  if (percentuais.lucroLiquido > 25) pontosFortes.push("Margem líquida excelente, controle de despesas eficiente")
  if (percentuais.despesasOperacionais < 25) pontosFortes.push("Despesas operacionais equilibradas (~25% da receita)")
  if (resultadoFinanceiro > 0) pontosFortes.push("Caixa positivo além das retiradas")
  if (receitaLiquida > recebimentos * 1.1) pontosFortes.push("Crescimento de receita consistente")

  // Pontos de atenção
  const pontosAtencao: string[] = []
  if (percentuais.lucroBruto < 30) pontosAtencao.push("Margem bruta abaixo do ideal - revisar precificação")
  if (percentuais.despesasOperacionais > 30) pontosAtencao.push("Despesas operacionais representam mais de 30% da receita")
  if (custo > receitaBruta * 0.2) pontosAtencao.push("Custo direto representa mais de 20% da receita")
  if (retiradas > caixaLivre) pontosAtencao.push("Retiradas excedem o caixa livre disponível")

  // Recomendações
  const recomendacoes: string[] = []
  if (retiradas > caixaLivre) {
    recomendacoes.push("Não retirar mais que o caixa livre (${formatCurrency(caixaLivre)})")
    recomendacoes.push("Ajustar retirada para ${formatCurrency(Math.max(0, caixaLivre * 0.8))} ou reduzir investimentos")
  }
  if (percentuais.lucroLiquido < 15) {
    recomendacoes.push("Revisar estrutura de custos e despesas operacionais")
  }
  recomendacoes.push("Criar indicador de capacidade de distribuição no dashboard")
  recomendacoes.push("Implementar alertas automáticos quando retiradas > caixa livre")

  // Análise estratégica
  const analise: AnaliseEstrategica = {
    resumoOperacao: {
      receitaLiquida,
      lucroBruto,
      percLucroBruto: percentuais.lucroBruto,
      lucroLiquido,
      percLucroLiquido: percentuais.lucroLiquido,
      interpretacao: lucroLiquido > 0
        ? `Você gera ${formatCurrency(lucroLiquido)} de lucro no mês - operação ${percentuais.lucroLiquido > 20 ? "saudável e forte" : "com margem a melhorar"}.`
        : "Operação com prejuízo no período - requer análise urgente."
    },
    pontosFortes,
    pontosAtencao,
    recomendacoes,
    indicadores: {
      margemBrutaSaudavel: percentuais.lucroBruto > 30,
      margemLiquidaSaudavel: percentuais.lucroLiquido > 20,
      despesasEquilibradas: percentuais.despesasOperacionais < 30,
      caixaSaudavel: resultadoFinanceiro >= 0 && retiradas <= caixaLivre
    }
  }

  return {
    valores: v,
    percentuais,
    caixaLivre,
    analise,
    alertas,
    status: {
      margem: statusMargem,
      caixa: statusCaixa
    }
  }
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

// Função para gerar resumo em formato de texto (para relatórios/exports)
export function gerarResumoTexto(analise: ResultadoAnaliseDRE): string {
  const lines: string[] = []
  const a = analise.analise

  lines.push("═══ ANÁLISE DO DRE FINANCEIRO ═══")
  lines.push("")
  lines.push("📊 RAIO-X DA OPERAÇÃO")
  lines.push(`Receita Líquida: ${formatCurrency(a.resumoOperacao.receitaLiquida)}`)
  lines.push(`Lucro Bruto: ${formatCurrency(a.resumoOperacao.lucroBruto)} (${a.resumoOperacao.percLucroBruto.toFixed(2)}%)`)
  lines.push(`Lucro Líquido: ${formatCurrency(a.resumoOperacao.lucroLiquido)} (${a.resumoOperacao.percLucroLiquido.toFixed(2)}%)`)
  lines.push(a.resumoOperacao.interpretacao)
  lines.push("")

  if (a.pontosFortes.length > 0) {
    lines.push("✅ PONTOS FORTES")
    a.pontosFortes.forEach(p => lines.push(`  • ${p}`))
    lines.push("")
  }

  if (a.pontosAtencao.length > 0) {
    lines.push("⚠️ PONTOS DE ATENÇÃO")
    a.pontosAtencao.forEach(p => lines.push(`  • ${p}`))
    lines.push("")
  }

  lines.push("💰 INDICADOR-CHAVE: CAIXA LIVRE")
  lines.push(`Lucro Líquido - Investimentos = ${formatCurrency(analise.caixaLivre)}`)
  const retiradas = analise.valores["10.0"] || 0
  if (retiradas > analise.caixaLivre) {
    lines.push(`⚠️ Sua retirada de ${formatCurrency(retiradas)} foi maior que o caixa livre.`)
  } else {
    lines.push(`✅ Retirada dentro do limite seguro.`)
  }
  lines.push("")

  if (a.recomendacoes.length > 0) {
    lines.push("📋 RECOMENDAÇÕES")
    a.recomendacoes.forEach((r, i) => lines.push(`${i + 1}. ${r}`))
    lines.push("")
  }

  if (analise.alertas.length > 0) {
    lines.push("🔔 ALERTAS")
    analise.alertas.forEach(alerta => {
      const icon = alerta.tipo === "success" ? "✅" : alerta.tipo === "warning" ? "⚠️" : alerta.tipo === "critical" ? "🚨" : "ℹ️"
      lines.push(`${icon} ${alerta.titulo}: ${alerta.mensagem}`)
    })
  }

  return lines.join("\n")
}
