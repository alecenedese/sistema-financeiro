/**
 * Parser para arquivos CSV e XLS/XLSX com o formato do sistema:
 * DATA;DESCRIÇÃO;VALOR;FORNECEDOR;F. PGTO;PLANO DE CONTA;BANCO
 *
 * Converte para OFXTransaction[] para ser processado pelo mesmo pipeline
 * de importação que o OFX usa.
 */

import type { OFXTransaction } from "./ofx-parser"

// Limpa e converte "R$ 862,10" ou "-R$ 862,10" para número
function parseCurrencyBR(raw: string): number {
  if (!raw) return 0
  const cleaned = raw
    .replace(/R\$\s*/gi, "")
    .replace(/\./g, "")       // separador de milhar
    .replace(",", ".")        // decimal
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
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
  banco: string
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
    descricao:      ["descr", "histor", "memo", "description"],
    valor:          ["valor", "value", "amount", "vlr"],
    fornecedor:     ["fornecedor", "cliente", "supplier", "vendor", "favorecido"],
    formaPagamento: ["forma", "pgto", "pagamento", "payment", "f pgto"],
    planoConta:     ["plano", "categoria", "category", "conta"],
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

  console.log("[v0] CSV separator:", sep)
  console.log("[v0] CSV headers raw:", headers)
  console.log("[v0] CSV header map:", idx)

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
  const wb = XLSX.read(buffer, { type: "array", cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  // Converte para array de arrays
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]
  if (rows.length < 2) return []

  const headers = (rows[0] as string[]).map(String)
  const idx = mapHeaders(headers)
  const results: ParsedSpreadsheetTransaction[] = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i] as unknown[]
    const dataRaw = idx.data !== undefined ? String(cols[idx.data] ?? "") : ""
    const descricao = idx.descricao !== undefined ? String(cols[idx.descricao] ?? "") : ""
    const valorRaw = idx.valor !== undefined ? String(cols[idx.valor] ?? "") : ""
    const fornecedor = idx.fornecedor !== undefined ? String(cols[idx.fornecedor] ?? "") : ""
    const formaPagamento = idx.formaPagamento !== undefined ? String(cols[idx.formaPagamento] ?? "") : ""
    const planoConta = idx.planoConta !== undefined ? String(cols[idx.planoConta] ?? "") : ""
    const banco = idx.banco !== undefined ? String(cols[idx.banco] ?? "") : ""

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
    .filter((r) => r.valor !== 0)
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
        _banco: r.banco,
        _formaPagamento: r.formaPagamento,
      } as OFXTransaction & { _fornecedor: string; _planoConta: string; _banco: string; _formaPagamento: string }
    })
}
