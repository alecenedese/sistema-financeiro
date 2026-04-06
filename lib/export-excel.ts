// Exporta dados para arquivo Excel (.xlsx) usando SheetJS
// Para uso client-side com download automático

export interface ExportColumn {
  header: string
  key: string
  width?: number
  format?: (value: unknown) => string | number
}

export async function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): Promise<void> {
  // Importa xlsx dinamicamente (client-side only)
  const XLSX = await import("xlsx")

  // Prepara os dados no formato do SheetJS
  const headers = columns.map((c) => c.header)
  const rows = data.map((item) =>
    columns.map((col) => {
      const value = item[col.key]
      if (col.format) {
        return col.format(value)
      }
      return value ?? ""
    })
  )

  // Cria worksheet com headers e dados
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Define largura das colunas
  ws["!cols"] = columns.map((col) => ({ wch: col.width || 15 }))

  // Cria workbook e adiciona a worksheet
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Dados")

  // Gera o arquivo e faz download
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Formatadores comuns
export const formatters = {
  currency: (value: unknown): string => {
    const num = Number(value) || 0
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  },
  date: (value: unknown): string => {
    if (!value) return ""
    const date = new Date(value as string)
    return date.toLocaleDateString("pt-BR")
  },
  status: (value: unknown): string => {
    const status = String(value || "").toLowerCase()
    const statusMap: Record<string, string> = {
      pago: "Pago",
      pendente: "Pendente",
      atrasado: "Atrasado",
      recebido: "Recebido",
      confirmado: "Confirmado",
      cancelado: "Cancelado",
    }
    return statusMap[status] || String(value || "")
  },
}
