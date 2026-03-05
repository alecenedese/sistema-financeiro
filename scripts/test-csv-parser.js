// Teste do parser CSV com o mesmo conteudo do arquivo real
const csvContent = `DATA;DESCRIÇÃO;VALOR;FORNECEDOR;F. PGTO;PLANO DE CONTA;BANCO
02/01/2026;Compra de produtos;-R$ 862,10;Capital Rs Fidc - Fornecedor;Boleto;Compra de Produtos;Sicredi
02/01/2026;Compra de produtos;-R$ 948,44;A. M. Dias Ltda - Fornecedor;Boleto;Compra de Produtos;Sicredi`

// Reproduce parseCurrencyBR
function parseCurrencyBR(raw) {
  if (!raw) return 0
  const trimmed = raw.trim()
  const negative = trimmed.startsWith("-")
  const digitsOnly = trimmed.replace(/[^0-9,\.]/g, "")
  if (!digitsOnly) return 0
  let normalized
  const lastComma = digitsOnly.lastIndexOf(",")
  const lastDot = digitsOnly.lastIndexOf(".")
  if (lastComma > lastDot) {
    normalized = digitsOnly.replace(/\./g, "").replace(",", ".")
  } else {
    normalized = digitsOnly.replace(/,/g, "")
  }
  const num = parseFloat(normalized)
  if (isNaN(num)) return 0
  return negative ? -num : num
}

function detectSeparator(line) {
  const semis = (line.match(/;/g) || []).length
  const commas = (line.match(/,/g) || []).length
  return semis >= commas ? ";" : ","
}

function splitLine(line, sep) {
  const result = []
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

function mapHeaders(headers) {
  const map = {}
  const normalize = (s) => {
    try {
      return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    } catch {
      return s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim()
    }
  }
  const aliases = {
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
    console.log(`  Header[${i}]: "${h}" -> normalized: "${norm}"`)
    for (const [key, values] of Object.entries(aliases)) {
      if (!(key in map) && values.some((v) => norm.includes(v))) {
        console.log(`    -> MATCHED: ${key} = index ${i} (via "${values.find(v => norm.includes(v))}")`)
        map[key] = i
      }
    }
  })
  return map
}

console.log("=== CSV Content (first 200 chars) ===")
console.log(JSON.stringify(csvContent.slice(0, 200)))

const text = csvContent.replace(/^\uFEFF/, "").replace(/^\uFFFE/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
const lines = text.split("\n").filter(l => l.trim())
console.log("\n=== Lines:", lines.length, "===")

const sep = detectSeparator(lines[0])
console.log("Separator:", JSON.stringify(sep))

const headers = splitLine(lines[0], sep)
console.log("\nHeaders:", headers)

const idx = mapHeaders(headers)
console.log("\nHeader map:", idx)

console.log("\n=== Parsing rows ===")
for (let i = 1; i < lines.length; i++) {
  const cols = splitLine(lines[i], sep)
  console.log(`Row ${i}:`, cols)
  const valorRaw = idx.valor !== undefined ? cols[idx.valor] || "" : ""
  console.log(`  valorRaw: "${valorRaw}"`)
  const valor = parseCurrencyBR(valorRaw)
  console.log(`  parseCurrencyBR("${valorRaw}") = ${valor}`)
}

// Test with corrupted encoding (like the real file might have)
console.log("\n=== Test with replacement chars ===")
const corruptedHeader = "DESCRI\uFFFD\uFFFDO"
const normResult = corruptedHeader.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
console.log(`"${corruptedHeader}" -> "${normResult}" -> includes("descr"): ${normResult.includes("descr")}`)

// Test parseCurrencyBR with various formats
console.log("\n=== parseCurrencyBR tests ===")
const tests = ["-R$ 862,10", "-R$862,10", "-R$ 948,44", "R$ 1.234,56", "-1234.56", "0", ""]
tests.forEach(t => console.log(`  parseCurrencyBR("${t}") = ${parseCurrencyBR(t)}`))
