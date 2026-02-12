export interface OFXTransaction {
  id: string
  type: "CREDIT" | "DEBIT"
  date: string // DD/MM/YYYY
  dateRaw: string // YYYYMMDD
  amount: number
  fitId: string
  memo: string
}

export interface OFXData {
  bankName: string
  bankId: string
  accountId: string
  accountType: string
  currency: string
  startDate: string
  endDate: string
  transactions: OFXTransaction[]
}

function getTagValue(content: string, tag: string): string {
  // Handles both <TAG>value</TAG> and <TAG>value\n patterns (SGML style)
  const closedPattern = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i")
  const closedMatch = content.match(closedPattern)
  if (closedMatch) return closedMatch[1].trim()

  const openPattern = new RegExp(`<${tag}>([^\\n<]+)`, "i")
  const openMatch = content.match(openPattern)
  if (openMatch) return openMatch[1].trim()

  return ""
}

function formatDate(raw: string): string {
  // YYYYMMDD or YYYYMMDDHHMMSS -> DD/MM/YYYY
  if (raw.length < 8) return raw
  const year = raw.substring(0, 4)
  const month = raw.substring(4, 6)
  const day = raw.substring(6, 8)
  return `${day}/${month}/${year}`
}

export function parseOFX(content: string): OFXData {
  // Extract bank info
  const bankName = getTagValue(content, "ORG") || "Desconhecido"
  const bankId = getTagValue(content, "BANKID")
  const accountId = getTagValue(content, "ACCTID")
  const accountType = getTagValue(content, "ACCTTYPE")
  const currency = getTagValue(content, "CURDEF") || "BRL"
  const startDate = getTagValue(content, "DTSTART")
  const endDate = getTagValue(content, "DTEND")

  // Extract transactions
  const transactions: OFXTransaction[] = []
  const trnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match

  while ((match = trnPattern.exec(content)) !== null) {
    const block = match[1]
    const type = getTagValue(block, "TRNTYPE") as "CREDIT" | "DEBIT"
    const dateRaw = getTagValue(block, "DTPOSTED")
    const amountStr = getTagValue(block, "TRNAMT")
    const fitId = getTagValue(block, "FITID")
    const memo = getTagValue(block, "MEMO")
    const amount = parseFloat(amountStr.replace(",", "."))

    if (fitId && !isNaN(amount)) {
      transactions.push({
        id: fitId,
        type: amount >= 0 ? "CREDIT" : "DEBIT",
        date: formatDate(dateRaw),
        dateRaw,
        amount,
        fitId,
        memo,
      })
    }
  }

  return {
    bankName,
    bankId,
    accountId,
    accountType,
    currency,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    transactions,
  }
}
