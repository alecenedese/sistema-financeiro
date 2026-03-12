/**
 * Utilitarios para formatacao de moeda brasileira (BRL)
 * @version 2.0.0 - Atualizado para aceitar eventos e valores
 */

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
export function parseBRL(formatted: string | number | null | undefined): number {
  if (formatted == null) return 0
  if (typeof formatted === "number") return formatted
  const cleaned = String(formatted).replace(/\./g, "").replace(",", ".")
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Handler para input de moeda brasileira
 * Retorna string formatada para exibição
 * Aceita qualquer tipo de entrada (evento, string, number, etc)
 */
export function handleCurrencyInput(value: unknown): string {
  // Garante que value seja string - aceita qualquer tipo de entrada
  if (value == null) return ""
  
  // Se for um evento, extrai o valor
  if (typeof value === "object" && value !== null && "target" in value) {
    const target = (value as { target: { value?: unknown } }).target
    if (target && typeof target.value !== "undefined") {
      value = target.value
    }
  }
  
  const strValue = typeof value === "string" ? value : String(value)
  // Remove tudo exceto números
  const numbersOnly = strValue.replace(/\D/g, "")
  if (!numbersOnly) return ""
  
  // Converte centavos para reais
  const num = parseInt(numbersOnly, 10) / 100
  return formatBRL(num)
}
