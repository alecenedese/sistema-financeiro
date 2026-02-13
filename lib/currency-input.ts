/**
 * Formata valor numérico para formato brasileiro (1.000,00)
 */
export function formatBRL(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return ""
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Remove formatação e converte para número
 */
export function parseBRL(formatted: string): number {
  const cleaned = formatted.replace(/\./g, "").replace(",", ".")
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Handler para input de moeda brasileira
 * Retorna string formatada para exibição
 */
export function handleCurrencyInput(value: string): string {
  // Remove tudo exceto números
  const numbersOnly = value.replace(/\D/g, "")
  if (!numbersOnly) return ""
  
  // Converte centavos para reais
  const num = parseInt(numbersOnly, 10) / 100
  return formatBRL(num)
}
