"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "majo-active-tenant"

export interface ActiveTenant {
  id: number
  nome: string
  cnpj: string
}

// Leitura síncrona — segura apenas no browser
function readFromStorage(): ActiveTenant | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as ActiveTenant) : null
  } catch {
    return null
  }
}

// Hook reativo — inicia com null (SSR safe) e hidrata no useEffect
// para evitar hydration mismatch
export function useTenant() {
  const [tenant, setTenantState] = useState<ActiveTenant | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Hidrata do localStorage apenas no cliente após montagem
    setTenantState(readFromStorage())
    setMounted(true)

    // Sincroniza entre abas
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setTenantState(e.newValue ? JSON.parse(e.newValue) : null)
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setTenant = useCallback((t: ActiveTenant | null) => {
    setTenantState(t)
    try {
      if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
  }, [])

  const clearTenant = useCallback(() => setTenant(null), [setTenant])

  return { tenant, setTenant, clearTenant, mounted }
}

// Versão síncrona para fetchers fora de componentes
export function getActiveTenantId(): number | null {
  return readFromStorage()?.id ?? null
}
