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

// Hook reativo — usa o valor do localStorage como estado inicial
// para evitar flash de "sem tenant" na hidratação
export function useTenant() {
  const [tenant, setTenantState] = useState<ActiveTenant | null>(() => readFromStorage())

  // Sincroniza entre abas
  useEffect(() => {
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

  return { tenant, setTenant, clearTenant }
}

// Versão síncrona para fetchers fora de componentes
export function getActiveTenantId(): number | null {
  return readFromStorage()?.id ?? null
}
