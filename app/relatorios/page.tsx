import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { BarChart3, Download, FileText, TrendingUp, FileSpreadsheet, PieChart } from "lucide-react"

const summaryData = [
  { label: "Relatorios Disponiveis", value: "6", icon: FileText, iconBg: "bg-[hsl(216,60%,22%)]" },
  { label: "Gerados Este Mes", value: "12", icon: BarChart3, iconBg: "bg-[hsl(142,71%,40%)]" },
  { label: "Exportacoes", value: "8", icon: FileSpreadsheet, iconBg: "bg-[hsl(38,92%,50%)]" },
  { label: "Ultimo Gerado", value: "Hoje", icon: TrendingUp, iconBg: "bg-[hsl(216,20%,60%)]" },
]

const relatorios = [
  { nome: "Fluxo de Caixa", descricao: "Movimentacoes de entrada e saida por periodo com graficos comparativos e projecao", icone: TrendingUp, ultimoGerado: "09/02/2026", formato: "PDF", cor: "#1B3A5C" },
  { nome: "DRE - Demonstrativo de Resultados", descricao: "Receitas, custos e despesas do exercicio com comparativo mensal", icone: FileText, ultimoGerado: "31/01/2026", formato: "PDF", cor: "#2C5F8A" },
  { nome: "Balancete Mensal", descricao: "Resumo das contas patrimoniais e de resultado com evolucao", icone: BarChart3, ultimoGerado: "31/01/2026", formato: "XLSX", cor: "#3D7AB5" },
  { nome: "Contas a Pagar e Receber", descricao: "Visao consolidada de obrigacoes e direitos com aging", icone: FileText, ultimoGerado: "05/02/2026", formato: "PDF", cor: "#7A8FA6" },
  { nome: "Analise de Categorias", descricao: "Despesas e receitas agrupadas por categoria e subcategoria", icone: PieChart, ultimoGerado: "03/02/2026", formato: "PDF", cor: "#A8B8C8" },
  { nome: "Extrato por Conta", descricao: "Movimentacao detalhada por conta bancaria com saldo diario", icone: TrendingUp, ultimoGerado: "07/02/2026", formato: "XLSX", cor: "#C4CFD9" },
]

export default function RelatoriosPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="Relatorios" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryData.map((item) => (
                <div key={item.label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-xl font-bold text-card-foreground">{item.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.iconBg}`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-base font-semibold text-foreground">Relatorios Disponiveis</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {relatorios.map((relatorio) => (
                <div key={relatorio.nome} className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${relatorio.cor}18` }}>
                        <relatorio.icone className="h-5 w-5" style={{ color: relatorio.cor }} />
                      </div>
                      <div>
                        <p className="font-semibold text-card-foreground">{relatorio.nome}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{relatorio.formato}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{relatorio.descricao}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Gerado em: {relatorio.ultimoGerado}</span>
                    <button type="button" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                      <Download className="h-3.5 w-3.5" />
                      Gerar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
