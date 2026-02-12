"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  FileDown,
  FileUp,
  Target,
  BarChart3,
  Upload,
  Tags,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Landmark, label: "Contas Bancarias", href: "/contas-bancarias" },
  { icon: ArrowLeftRight, label: "Transacoes", href: "/transacoes" },
  { icon: FileDown, label: "Contas a Pagar", href: "/contas-a-pagar" },
  { icon: FileUp, label: "Contas a Receber", href: "/contas-a-receber" },
  { icon: Target, label: "Planejamento", href: "/planejamento" },
  { icon: BarChart3, label: "Relatorios", href: "/relatorios" },
  { icon: Upload, label: "Importar Transacoes", href: "/importar-transacoes" },
  { icon: Tags, label: "Categorias", href: "/categorias" },
]

const novoOptions = [
  { icon: Landmark, label: "Nova Conta Bancaria", href: "/contas-bancarias?novo=1" },
  { icon: ArrowLeftRight, label: "Nova Transacao", href: "/transacoes?novo=1" },
  { icon: FileDown, label: "Nova Conta a Pagar", href: "/contas-a-pagar?novo=1" },
  { icon: FileUp, label: "Nova Conta a Receber", href: "/contas-a-receber?novo=1" },
  { icon: Target, label: "Nova Meta", href: "/planejamento?novo=1" },
  { icon: Tags, label: "Nova Categoria", href: "/categorias?novo=1" },
]

export function AppSidebar() {
  const [expanded, setExpanded] = useState(false)
  const [showNovoMenu, setShowNovoMenu] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowNovoMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col transition-all duration-300 ease-in-out",
        "bg-[hsl(216,60%,16%)] border-r border-[hsl(216,45%,22%)]",
        expanded ? "w-64" : "w-[72px]"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setShowNovoMenu(false) }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-[hsl(216,45%,22%)] px-3">
        <div className={cn(
          "flex shrink-0 items-center justify-center transition-all duration-300",
          expanded ? "h-10 w-auto" : "h-10 w-10"
        )}>
          <Image
            src="/logobranca.png"
            alt="MAJO BPO"
            width={expanded ? 160 : 36}
            height={36}
            className={cn("object-contain transition-all duration-300", expanded ? "h-9 w-auto" : "h-8 w-8")}
            priority
          />
        </div>
      </div>

      {/* New Button */}
      <div className="relative px-3 py-4" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowNovoMenu(!showNovoMenu)}
          className={cn(
            "flex items-center gap-2 rounded-lg bg-white text-[hsl(216,60%,16%)] font-semibold transition-all duration-200 hover:bg-[hsl(216,20%,90%)]",
            expanded ? "w-full justify-center px-4 py-2.5" : "mx-auto h-10 w-10 justify-center"
          )}
        >
          <Plus className={cn("h-5 w-5 shrink-0 transition-transform duration-200", showNovoMenu && "rotate-45")} />
          <span
            className={cn(
              "whitespace-nowrap transition-opacity duration-200",
              expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
            )}
          >
            Novo
          </span>
        </button>

        {/* Dropdown Menu */}
        {showNovoMenu && (
          <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-left-2 duration-200">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Criar novo
            </p>
            {novoOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setShowNovoMenu(false)
                  router.push(opt.href)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <opt.icon className="h-4 w-4 text-muted-foreground" />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[hsl(216,50%,24%)] text-white"
                  : "text-[hsl(216,20%,70%)] hover:bg-[hsl(216,50%,24%)] hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-opacity duration-200",
                  expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Expand/Collapse indicator */}
      <div className="flex items-center justify-center border-t border-[hsl(216,45%,22%)] py-3">
        {expanded ? (
          <ChevronLeft className="h-4 w-4 text-[hsl(216,20%,65%)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[hsl(216,20%,65%)]" />
        )}
      </div>
    </aside>
  )
}
