"use client"

import { useState, useCallback } from "react"

export interface WidgetConfig {
  id: string
  span: "full" | "half"
}

const STORAGE_KEY = "majo-dashboard-layout"

const DEFAULT_ORDER: WidgetConfig[] = [
  { id: "summary", span: "full" },
  { id: "category-charts", span: "full" },
  { id: "monthly-chart", span: "half" },
  { id: "budget", span: "half" },
  { id: "recent-transactions", span: "half" },
  { id: "accounts", span: "half" },
]

function loadSavedOrder(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_ORDER
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as WidgetConfig[]
      const ids = new Set(DEFAULT_ORDER.map((w) => w.id))
      if (parsed.length === DEFAULT_ORDER.length && parsed.every((w) => ids.has(w.id))) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_ORDER
}

function saveOrder(widgets: WidgetConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
  } catch {
    // ignore
  }
}

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadSavedOrder)

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setWidgets((prev) => {
      const next = [...prev]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, removed)
      saveOrder(next)
      return next
    })
  }, [])

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return
    moveWidget(index, index - 1)
  }, [moveWidget])

  const moveDown = useCallback((index: number) => {
    setWidgets((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      next.splice(index + 1, 0, removed)
      saveOrder(next)
      return next
    })
  }, [])

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_ORDER)
    saveOrder(DEFAULT_ORDER)
  }, [])

  return {
    widgets,
    moveUp,
    moveDown,
    resetLayout,
  }
}
