/**
 * Parser para arquivos CSV e XLS/XLSX com o formato do sistema:
 * DATA;DESCRIÇÃO;VALOR;FORNECEDOR;F. PGTO;PLANO DE CONTA;BANCO
 *
 * Converte para OFXTransaction[] para ser processado pelo mesmo pipeline
 * de importação que o OFX usa.
 */

import type { OFXTransaction } from "./ofx-parser"

// Limpa e converte "R$ 862,10" ou "-R$ 862,10" ou "-R$862,10" para número
function parseCurrencyBR(raw: string): number {
  if (!raw) return 0
  const trimmed = raw.trim()
  // Extrai sinal
  const negative = trimmed.startsWith("-")
  // Remove tudo que não seja dígito, vírgula ou ponto
  const digitsOnly = trimmed.replace(/[^0-9,\.]/g, "")
  if (!digitsOnly) return 0
  // Converte formato BR: 1.234,56 → 1234.56
  let normalized: string
  const lastComma = digitsOnly.lastIndexOf(",")
  const lastDot = digitsOnly.lastIndexOf(".")
  if (lastComma > lastDot) {
    // vírgula é decimal: remove pontos (milhar) e troca vírgula por ponto
    normalized = digitsOnly.replace(/\./g, "").replace(",", ".")
  } else {
    // ponto é decimal (já está correto) ou não tem decimal
    normalized = digitsOnly.replace(/,/g, "")
  }
  const num = parseFloat(normalized)
  if (isNaN(num)) return 0
  return negative ? -num : num
}

// Converte DD/MM/YYYY → YYYYMMDD (formato dateRaw do OFX)
function toDateRaw(dateBR: string): string {
  const parts = dateBR.trim().split(/[/\-]/)
  if (parts.length < 3) return dateBR
  const [d, m, y] = parts
  return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`
}

// Normaliza data para DD/MM/YYYY
function normalizeDateBR(raw: string): string {
  const parts = raw.trim().split(/[/\-]/)
  if (parts.length < 3) return raw
  const [d, m, y] = parts
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
}

export interface ParsedSpreadsheetTransaction {
  data: string         // DD/MM/YYYY
  descricao: string
  valor: number        // já com sinal (negativo = despesa)
  fornecedor: string
  formaPagamento: string
  planoConta: string
  subcategoria: string
  banco: string
}

/**
 * Parseia CSV e retorna dicionarios crus (chave = header normalizado)
 * Util para importar categorias, fornecedores, etc.
 */
export function parseCSVRaw(content: string): Record<string, string>[] {
  const text = content
    .replace(/^\uFEFF/, "")
    .replace(/^\uFFFE/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

  const lines = text.split("\n").filter(l => l.trim())
  if (lines.length < 2) return []

  const sep = detectSeparator(lines[0])
  const headers = splitLine(lines[0], sep)

  const normalize = (s: string) => {
    try {
      return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    } catch { return s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim() }
  }

  const normalizedHeaders = headers.map(h => normalize(h))
  const results: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)
    if (cols.every(c => !c)) continue
    const row: Record<string, string> = {}
    normalizedHeaders.forEach((h, idx) => {
      row[h] = cols[idx] ?? ""
    })
    results.push(row)
  }
  return results
}

/**
 * Detecta separador do CSV (ponto-e-vírgula ou vírgula)
 */
function detectSeparator(line: string): string {
  const semis = (line.match(/;/g) || []).length
  const commas = (line.match(/,/g) || []).length
  return semis >= commas ? ";" : ","
}

/**
 * Divide linha CSV respeitando aspas
 */
function splitLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Faz o map de cabeçalhos para índices (case-insensitive, strip BOM/acentos básicos)
 */
function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  const normalize = (s: string) => {
    try {
      return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")   // remove diacríticos
        .replace(/[^a-z0-9\s]/g, " ")       // substitui especiais por espaço
        .replace(/\s+/g, " ")
        .trim()
    } catch {
      return s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim()
    }
  }

  const aliases: Record<string, string[]> = {
    data:           ["data", "date", "dt"],
    descricao:      ["descricao", "descr", "histor", "memo", "description"],
    valor:          ["valor", "value", "amount", "vlr"],
    fornecedor:     ["fornecedor", "cliente for", "cliente", "supplier", "vendor", "favorecido"],
    formaPagamento: ["f pgto", "forma", "pgto", "pagamento", "payment"],
    planoConta:     ["plano de conta", "plano conta", "plano", "categoria", "category", "conta"],
    subcategoria:   ["subcategoria", "subcateg", "sub categoria", "sub"],
    banco:          ["banco", "bank"],
  }

  headers.forEach((h, i) => {
    const norm = normalize(h)
    for (const [key, values] of Object.entries(aliases)) {
      if (!(key in map) && values.some((v) => norm.includes(v))) {
        map[key] = i
      }
    }
  })
  return map
}

/**
 * Parseia texto CSV/TSV e retorna lista de transações
 */
export function parseCSV(content: string): ParsedSpreadsheetTransaction[] {
  // Remove BOM UTF-8, UTF-16, e caracteres de controle no início
  const text = content
    .replace(/^\uFEFF/, "")   // BOM UTF-8
    .replace(/^\uFFFE/, "")   // BOM UTF-16 LE
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

  const lines = text.split("\n").filter((l) => l.trim())
  if (lines.length < 2) return []

  const sep = detectSeparator(lines[0])
  const headers = splitLine(lines[0], sep)
  const idx = mapHeaders(headers)

  const results: ParsedSpreadsheetTransaction[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)
    if (cols.every((c) => !c)) continue

    const dataRaw = idx.data !== undefined ? cols[idx.data] || "" : ""
    const descricao = idx.descricao !== undefined ? cols[idx.descricao] || "" : ""
    const valorRaw = idx.valor !== undefined ? cols[idx.valor] || "" : ""
    const fornecedor = idx.fornecedor !== undefined ? cols[idx.fornecedor] || "" : ""
    const formaPagamento = idx.formaPagamento !== undefined ? cols[idx.formaPagamento] || "" : ""
    const planoConta = idx.planoConta !== undefined ? cols[idx.planoConta] || "" : ""
    const subcategoria = idx.subcategoria !== undefined ? cols[idx.subcategoria] || "" : ""
    const banco = idx.banco !== undefined ? cols[idx.banco] || "" : ""

    if (!dataRaw && !descricao && !valorRaw) continue

    const valor = parseCurrencyBR(valorRaw)
    results.push({
      data: normalizeDateBR(dataRaw),
      descricao,
      valor,
      fornecedor,
      formaPagamento,
      planoConta,
      subcategoria,
      banco,
    })
  }

  return results
}

/**
 * Parseia XLS/XLSX usando a lib xlsx (SheetJS)
 * Retorna os dados como CSV string para reusar parseCSV
 */
export async function parseXLSX(buffer: ArrayBuffer): Promise<ParsedSpreadsheetTransaction[]> {
  const XLSX = await import("xlsx")
  // Força codepage 65001 (UTF-8) para caracteres especiais
  const wb = XLSX.read(buffer, { type: "array", cellDates: false, codepage: 65001 })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  // Converte para array de arrays com raw: false para obter strings formatadas
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][]
  if (rows.length < 2) return []

  const headers = (rows[0] as string[]).map(String)
  const idx = mapHeaders(headers)
  const results: ParsedSpreadsheetTransaction[] = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i] as unknown[]
    // Função para limpar caracteres inválidos (�, etc)
    const cleanText = (val: unknown): string => {
      const str = String(val ?? "")
      // Remove caracteres de substituição Unicode e outros inválidos
      return str.replace(/[\uFFFD\u0000-\u001F]/g, "").trim()
    }
    
    const dataRaw = idx.data !== undefined ? cleanText(cols[idx.data]) : ""
    const descricao = idx.descricao !== undefined ? cleanText(cols[idx.descricao]) : ""
    const valorRaw = idx.valor !== undefined ? String(cols[idx.valor] ?? "") : ""
    const fornecedor = idx.fornecedor !== undefined ? cleanText(cols[idx.fornecedor]) : ""
    const formaPagamento = idx.formaPagamento !== undefined ? cleanText(cols[idx.formaPagamento]) : ""
    const planoConta = idx.planoConta !== undefined ? cleanText(cols[idx.planoConta]) : ""
    const subcategoria = idx.subcategoria !== undefined ? cleanText(cols[idx.subcategoria]) : ""
    const banco = idx.banco !== undefined ? cleanText(cols[idx.banco]) : ""

    if (!dataRaw && !descricao && !valorRaw) continue

    // SheetJS pode retornar data como número serial
    let dataNorm = dataRaw
    if (/^\d{5}$/.test(dataRaw)) {
      const d = XLSX.SSF.parse_date_code(Number(dataRaw))
      dataNorm = `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`
    } else {
      dataNorm = normalizeDateBR(dataRaw)
    }

    const valor = parseCurrencyBR(valorRaw)
    results.push({
      data: dataNorm,
      descricao,
      valor,
      fornecedor,
      formaPagamento,
      planoConta,
      subcategoria,
      banco,
    })
  }
  return results
}

/**
 * Converte ParsedSpreadsheetTransaction[] para OFXTransaction[]
 * para compatibilidade total com o pipeline existente
 */
export function spreadsheetToOFXTransactions(rows: ParsedSpreadsheetTransaction[]): OFXTransaction[] {
  return rows
    .filter((r) => r.data || r.descricao)  // filtra só linhas completamente vazias
    .map((r, i) => {
      const dateRaw = toDateRaw(r.data)
      const amount = r.valor // já tem sinal
      const type: "CREDIT" | "DEBIT" = amount >= 0 ? "CREDIT" : "DEBIT"
      return {
        id: `SHEET-${dateRaw}-${i}`,
        type,
        date: r.data,
        dateRaw,
        amount,
        fitId: `SHEET-${dateRaw}-${i}`,
        memo: r.descricao || r.planoConta || "",
        // Campos extras preservados para pré-preenchimento
        _fornecedor: r.fornecedor,
        _planoConta: r.planoConta,
        _subcategoria: r.subcategoria,
        _banco: r.banco,
        _formaPagamento: r.formaPagamento,
      } as OFXTransaction & { _fornecedor: string; _planoConta: string; _subcategoria: string; _banco: string; _formaPagamento: string }
    })
}
