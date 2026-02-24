"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "majo-active-tenant"

export interface ActiveTenant {
  id: number
  nome: string
  cnpj: string
  plano: string
}

export function useTenant() {
  const [tenant, setTenantState] = useState<ActiveTenant | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setTenantState(JSON.parse(saved))
    } catch {
      // ignore
    }
  }, [])

  const setTenant = useCallback((t: ActiveTenant | null) => {
    setTenantState(t)
    try {
      if (t) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [])

  const clearTenant = useCallback(() => setTenant(null), [setTenant])

  return { tenant, setTenant, clearTenant }
}

export function getActiveTenantId(): number | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as ActiveTenant
      return parsed.id
    }
  } catch {
    // ignore
  }
  return null
}
