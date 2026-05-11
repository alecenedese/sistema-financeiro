"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import { DREView } from "@/components/dre/dre-view"
import { useDRE } from "@/hooks/use-dashboard-data"
import { Loader2 } from "lucide-react"

const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export default function DREPage() {
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)

  const { data, isLoading, error } = useDRE(mes, ano)

  const anos = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[72px] flex flex-1 flex-col">
        <PageHeader title="DRE Financeiro" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-6">

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
                  className="bg-transparent text-sm font-medium text-foreground focus:outline-none">
                  {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
                  className="bg-transparent text-sm font-medium text-foreground focus:outline-none">
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                Cálculo baseado em contas a receber (recebido), contas a pagar (pago) e vendas do período.
              </p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Calculando DRE Financeiro...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">Erro ao carregar dados do DRE.</p>
              </div>
            )}

            {!isLoading && !error && data && (
              <>
                <DREView
                  valores={data.valores}
                  detalhePorCodigo={data.detalhePorCodigo}
                  periodoLabel={`${meses[mes - 1].toUpperCase()} ${ano}`}
                />
                <div className="rounded-xl border border-border bg-muted/20 px-6 py-4">
                  <p className="text-xs text-muted-foreground">
                    Vincule as categorias aos grupos DRE em <strong>Categorias</strong> para o cálculo funcionar corretamente.
                    Códigos: 1.1 Vendas · 1.2 Serviços · 2.1 Impostos · 2.2 Devoluções · 4.1 Custo Produto · 7.1 Admin · 7.2 Operacionais · 7.3 Pessoal · 8.1 Receitas Financeiras · 8.2 Despesas Financeiras · 10.1 Retiradas · 10.2 Distribuição de Lucro.
                  </p>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
