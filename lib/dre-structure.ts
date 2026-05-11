// Estrutura fixa do DRE conforme modelo "Modelo DRE.xlsx"
// Os códigos (codigo) são usados no campo categorias.grupo_dre

export type DRETipo = "credito" | "debito" | "resultado" | "neutro"

export interface DRENode {
  codigo: string            // "1.0", "1.1", "11.0", etc
  label: string
  parent?: string           // codigo do grupo pai (ex: "1.0" para "1.1")
  tipo: DRETipo
  operacao?: "=" | "+" | "-" | "0"
  // Fórmula para grupos "resultado". Tokens: código ou operador "+"/"-".
  // Ex: formula=["1.0","-","2.0"] → valor = v["1.0"] - v["2.0"]
  formula?: string[]
  // Se true, a linha inteira tem destaque (grupo principal)
  destaque?: boolean
  // Fonte dos dados para agregação: "cr"=contas_receber, "cp"=contas_pagar, "vendas"=vendas
  // "none" = subgrupo que é apenas soma dos filhos (calculado implicitamente)
  fonte?: "cr" | "cp" | "vendas" | "none"
}

export const ESTRUTURA_DRE: DRENode[] = [
  // 1.0 Receita Bruta
  { codigo: "1.0", label: "Receita Bruta", tipo: "resultado", operacao: "=", destaque: true, formula: ["1.1", "+", "1.2"] },
  { codigo: "1.1", label: "Receita de Vendas",    parent: "1.0", tipo: "credito", operacao: "+", fonte: "vendas" },
  { codigo: "1.2", label: "Receita de Serviços",  parent: "1.0", tipo: "credito", operacao: "+", fonte: "cr" },

  // 2.0 Deduções da Receita Bruta
  { codigo: "2.0", label: "Deduções da Receita Bruta", tipo: "resultado", operacao: "=", destaque: true, formula: ["2.1", "+", "2.2"] },
  { codigo: "2.1", label: "Impostos sobre vendas",  parent: "2.0", tipo: "debito", operacao: "-", fonte: "cp" },
  { codigo: "2.2", label: "Devoluções",             parent: "2.0", tipo: "debito", operacao: "-", fonte: "cp" },

  // 3.0 Receita Líquida
  { codigo: "3.0", label: "Receita Líquida", tipo: "resultado", operacao: "=", destaque: true, formula: ["1.0", "-", "2.0"] },

  // 4.0 Custo direto de Vendas
  { codigo: "4.0", label: "Custo direto de Vendas", tipo: "resultado", operacao: "=", destaque: true, formula: ["4.1"] },
  { codigo: "4.1", label: "Custo com Produto",   parent: "4.0", tipo: "debito", operacao: "-", fonte: "cp" },

  // 5.0 Resultado / Lucro Bruto
  { codigo: "5.0", label: "Resultado / Lucro Bruto", tipo: "resultado", operacao: "=", destaque: true, formula: ["3.0", "-", "4.0"] },

  // 6.0 Recebimentos do Mês — só pagamentos recebidos (status=recebido)
  { codigo: "6.0", label: "Recebimentos do Mês", tipo: "resultado", operacao: "=", destaque: true, fonte: "cr" },

  // 7.0 Despesas operacionais
  { codigo: "7.0", label: "Despesas operacionais", tipo: "resultado", operacao: "=", destaque: true, formula: ["7.1", "+", "7.2", "+", "7.3"] },
  { codigo: "7.1", label: "Despesas Administrativas", parent: "7.0", tipo: "debito", operacao: "-", fonte: "cp" },
  { codigo: "7.2", label: "Despesas Operacionais",    parent: "7.0", tipo: "debito", operacao: "-", fonte: "cp" },
  { codigo: "7.3", label: "Despesas com Pessoal",     parent: "7.0", tipo: "debito", operacao: "-", fonte: "cp" },

  // 8.0 Receitas e Despesas Financeiras
  { codigo: "8.0", label: "Receitas e Despesas Financeiras", tipo: "resultado", operacao: "=", destaque: true, formula: ["8.1", "-", "8.2"] },
  { codigo: "8.1", label: "Receitas Financeiras",  parent: "8.0", tipo: "credito", operacao: "+", fonte: "cr" },
  { codigo: "8.2", label: "Despesas Financeiras",  parent: "8.0", tipo: "debito",  operacao: "-", fonte: "cp" },

  // 9.0 Resultado / Lucro Líquido = Recebimentos do Mês - Deduções - Custo - Despesas Operacionais + Financeiras (8.0 já é negativo quando saldo é despesa)
  { codigo: "9.0", label: "Resultado / Lucro Líquido", tipo: "resultado", operacao: "=", destaque: true, formula: ["6.0", "-", "2.0", "-", "4.0", "-", "7.0", "+", "8.0"] },

  // 10.0 Retiradas do Caixa
  { codigo: "10.0", label: "Retiradas do Caixa", tipo: "resultado", operacao: "=", destaque: true, formula: ["10.1", "+", "10.2"] },
  { codigo: "10.1", label: "Retiradas do Caixa",        parent: "10.0", tipo: "debito", operacao: "-", fonte: "cp" },
  { codigo: "10.2", label: "Distribuição de Lucro",     parent: "10.0", tipo: "debito", operacao: "-", fonte: "cp" },

  // 11.0 Resultado Financeiro = Lucro Líquido - Retiradas
  { codigo: "11.0", label: "Resultado Financeiro", tipo: "resultado", operacao: "=", destaque: true, formula: ["9.0", "-", "10.0"] },
]

// Códigos em ordem de exibição na tela
export const DRE_ORDEM: string[] = ESTRUTURA_DRE.filter(n => !n.parent).map(n => n.codigo)

// Mapa rápido por código
export const DRE_BY_CODE: Record<string, DRENode> = Object.fromEntries(
  ESTRUTURA_DRE.map(n => [n.codigo, n])
)

// Opções para select em /categorias (inclui subgrupos, indentados)
export const DRE_OPTIONS = ESTRUTURA_DRE
  .filter(n => n.fonte) // só folhas onde categorias podem ser vinculadas
  .map(n => ({
    value: n.codigo,
    label: `${n.codigo} ${n.label}`,
    tipo: n.tipo === "credito" ? "Receita" : "Despesa",
  }))

// Filhos de um grupo principal
export function getFilhos(codigoPai: string): DRENode[] {
  return ESTRUTURA_DRE.filter(n => n.parent === codigoPai)
}

// Calcula valores de todos os grupos dada as folhas agregadas por código
export function calcularDRE(folhasValores: Record<string, number>): Record<string, number> {
  const valores: Record<string, number> = { ...folhasValores }
  // Iterar em ordem garante que dependências sejam resolvidas antes (1.0 antes de 3.0, etc.)
  for (const node of ESTRUTURA_DRE) {
    if (node.formula) {
      let total = 0
      let op: "+" | "-" = "+"
      for (const token of node.formula) {
        if (token === "+" || token === "-") { op = token; continue }
        const v = valores[token] ?? 0
        total = op === "+" ? total + v : total - v
      }
      valores[node.codigo] = total
    } else if (valores[node.codigo] === undefined) {
      valores[node.codigo] = 0
    }
  }
  return valores
}

// Mapeamento dos códigos antigos (legado) → novo, para compatibilidade
export const LEGADO_TO_NOVO: Record<string, string> = {
  receita_bruta: "1.1",
  receita_operacional_bruta: "1.1",
  deducoes_receita: "2.1",
  deducoes_receita_bruta: "2.1",
  custo_direto: "4.1",
  custo_direto_vendas: "4.1",
  despesas_operacionais: "7.2",
  outras_receitas: "8.1",
  outras_receitas_nao_operacionais: "8.1",
  outras_despesas: "8.2",
  outras_despesas_nao_operacionais: "8.2",
  ir_csll: "2.1",
}

export function normalizarGrupoDRE(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (DRE_BY_CODE[raw]) return raw
  return LEGADO_TO_NOVO[raw] || null
}
