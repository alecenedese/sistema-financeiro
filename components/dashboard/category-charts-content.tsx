"use client"

import { useState } from "react"
import { PieChart, Pie, Cell, Tooltip, Sector } from "recharts"
import { ArrowLeft } from "lucide-react"

interface SubcategoryItem {
  name: string
  value: number
  color: string
}

interface CategoryItem {
  name: string
  value: number
  color: string
  subcategorias: SubcategoryItem[]
}

const expenseData: CategoryItem[] = [
  {
    name: "Moradia",
    value: 1290,
    color: "#1B3A5C",
    subcategorias: [
      { name: "Aluguel", value: 800, color: "#1B3A5C" },
      { name: "Condominio", value: 250, color: "#274B70" },
      { name: "Conta de Energia", value: 140, color: "#335C84" },
      { name: "Conta de Agua", value: 60, color: "#3F6D98" },
      { name: "Internet", value: 40, color: "#4B7EAC" },
    ],
  },
  {
    name: "Transporte",
    value: 1110,
    color: "#2C5F8A",
    subcategorias: [
      { name: "Combustivel", value: 520, color: "#2C5F8A" },
      { name: "Estacionamento", value: 280, color: "#3A6F9A" },
      { name: "Manutencao Veiculo", value: 210, color: "#487FAA" },
      { name: "Transporte Publico", value: 100, color: "#568FBA" },
    ],
  },
  {
    name: "Alimentacao",
    value: 920,
    color: "#7A8FA6",
    subcategorias: [
      { name: "Supermercado", value: 485, color: "#7A8FA6" },
      { name: "Restaurante", value: 220, color: "#8A9DB2" },
      { name: "Delivery", value: 125, color: "#9AABBC" },
      { name: "Padaria", value: 90, color: "#AAB9C6" },
    ],
  },
  {
    name: "Saude",
    value: 350,
    color: "#A8B8C8",
    subcategorias: [
      { name: "Plano de Saude", value: 200, color: "#A8B8C8" },
      { name: "Farmacia", value: 95, color: "#B4C2D0" },
      { name: "Consultas", value: 55, color: "#C0CCD8" },
    ],
  },
  {
    name: "Lazer",
    value: 220,
    color: "#C4CFD9",
    subcategorias: [
      { name: "Streaming", value: 80, color: "#C4CFD9" },
      { name: "Cinema", value: 60, color: "#CDD7DF" },
      { name: "Viagens", value: 50, color: "#D6DFE5" },
      { name: "Esportes", value: 30, color: "#DFE7EB" },
    ],
  },
  {
    name: "Outros",
    value: 134,
    color: "#D9E1E8",
    subcategorias: [
      { name: "Assinaturas", value: 74, color: "#D9E1E8" },
      { name: "Presentes", value: 60, color: "#E2E8EE" },
    ],
  },
]

const incomeData: CategoryItem[] = [
  {
    name: "Salario",
    value: 4200,
    color: "#1B3A5C",
    subcategorias: [
      { name: "Salario Fixo", value: 3500, color: "#1B3A5C" },
      { name: "Bonus", value: 400, color: "#274B70" },
      { name: "Horas Extras", value: 300, color: "#335C84" },
    ],
  },
  {
    name: "Freelancer",
    value: 800,
    color: "#3D7AB5",
    subcategorias: [
      { name: "Projetos Web", value: 500, color: "#3D7AB5" },
      { name: "Consultoria", value: 200, color: "#4D8AC5" },
      { name: "Design", value: 100, color: "#5D9AD5" },
    ],
  },
  {
    name: "Investimentos",
    value: 355.5,
    color: "#7A8FA6",
    subcategorias: [
      { name: "Dividendos", value: 155.5, color: "#7A8FA6" },
      { name: "Renda Fixa", value: 120, color: "#8A9DB2" },
      { name: "Fundos Imobiliarios", value: 80, color: "#9AABBC" },
    ],
  },
  {
    name: "Outros",
    value: 150,
    color: "#B0BEC5",
    subcategorias: [
      { name: "Cashback", value: 90, color: "#B0BEC5" },
      { name: "Reembolsos", value: 60, color: "#BCCAD1" },
    ],
  },
]

const expenseTotal = expenseData.reduce((acc, item) => acc + item.value, 0)
const incomeTotal = incomeData.reduce((acc, item) => acc + item.value, 0)

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { color: string } }>
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-card-foreground">
          {payload[0].name}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    )
  }
  return null
}

function renderActiveShape(props: Record<string, unknown>) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as {
    cx: number
    cy: number
    innerRadius: number
    outerRadius: number
    startAngle: number
    endAngle: number
    fill: string
  }
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius as number}
      outerRadius={(outerRadius as number) + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      style={{ cursor: "pointer", filter: "brightness(1.15)" }}
    />
  )
}

function DonutChart({
  data,
  total,
  title,
}: {
  data: CategoryItem[]
  total: number
  title: string
}) {
  const size = 224
  const [drillCategory, setDrillCategory] = useState<CategoryItem | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  const displayData = drillCategory ? drillCategory.subcategorias : data
  const displayTotal = drillCategory
    ? drillCategory.subcategorias.reduce((acc, s) => acc + s.value, 0)
    : total

  function handlePieClick(_: unknown, index: number) {
    if (!drillCategory) {
      setDrillCategory(data[index])
      setActiveIndex(undefined)
    }
  }

  function handleBack() {
    setDrillCategory(null)
    setActiveIndex(undefined)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {drillCategory && (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h3 className="text-base font-semibold text-card-foreground">
          {drillCategory ? `${title} - ${drillCategory.name}` : title}
        </h3>
      </div>
      {!drillCategory && (
        <p className="mb-3 text-xs text-muted-foreground">
          Clique em uma fatia para detalhar por subcategoria
        </p>
      )}
      <div className="flex flex-col items-center lg:flex-row lg:items-start gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <PieChart width={size} height={size} style={{ minWidth: size, minHeight: size }}>
            <Pie
              data={displayData}
              cx={size / 2}
              cy={size / 2}
              innerRadius={60}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              isAnimationActive={true}
              animationDuration={400}
              activeIndex={activeIndex}
              activeShape={!drillCategory ? renderActiveShape : undefined}
              onMouseEnter={!drillCategory ? (_: unknown, idx: number) => setActiveIndex(idx) : undefined}
              onMouseLeave={!drillCategory ? () => setActiveIndex(undefined) : undefined}
              onClick={handlePieClick}
              style={!drillCategory ? { cursor: "pointer" } : undefined}
            >
              {displayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-card-foreground">
              {formatCurrency(displayTotal)}
            </span>
            <span className="text-xs text-muted-foreground">
              {drillCategory ? drillCategory.name : "Total"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          {displayData.map((item, idx) => (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                if (!drillCategory) {
                  setDrillCategory(data[idx])
                  setActiveIndex(undefined)
                }
              }}
              onMouseEnter={() => {
                if (!drillCategory) setActiveIndex(idx)
              }}
              onMouseLeave={() => {
                if (!drillCategory) setActiveIndex(undefined)
              }}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors ${
                !drillCategory ? "hover:bg-muted cursor-pointer" : "cursor-default"
              } ${activeIndex === idx && !drillCategory ? "bg-muted" : ""}`}
            >
              <div
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {item.name}
              </span>
              <span className="text-sm font-medium text-card-foreground">
                {formatCurrency(item.value)}
              </span>
            </button>
          ))}
          {drillCategory && (
            <button
              type="button"
              onClick={handleBack}
              className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para todas as categorias
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CategoryChartsContent() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <DonutChart
        data={expenseData}
        total={expenseTotal}
        title="Despesas por Categoria"
      />
      <DonutChart
        data={incomeData}
        total={incomeTotal}
        title="Receitas por Categoria"
      />
    </div>
  )
}
