"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function LimparCachePage() {
  const [currentData, setCurrentData] = useState<any>(null)
  const [cleared, setCleared] = useState(false)
  const router = useRouter()

  useEffect(() => {
    mostrarDados()
  }, [])

  function mostrarDados() {
    try {
      const tenant = localStorage.getItem('majo-active-tenant')
      const data = tenant ? JSON.parse(tenant) : null
      setCurrentData(data)
    } catch (e) {
      setCurrentData({ error: "Erro ao ler dados" })
    }
  }

  function limparCache() {
    // Limpar localStorage
    localStorage.clear()
    
    // Limpar sessionStorage
    sessionStorage.clear()
    
    setCleared(true)
    mostrarDados()
  }

  function voltarSistema() {
    router.push('/')
  }

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '50px auto',
      padding: '20px',
      background: '#f5f5f5'
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ color: '#333', marginTop: 0 }}>🔧 Limpar Cache do Sistema</h1>
        
        <div style={{
          background: '#eff6ff',
          padding: '15px',
          borderRadius: '6px',
          margin: '15px 0'
        }}>
          <strong>Problema:</strong> O sistema está usando dados antigos do cache.<br/>
          <strong>Solução:</strong> Limpar o localStorage e recarregar.
        </div>
        
        <h3>Dados Atuais no localStorage:</h3>
        <pre style={{
          background: '#f1f5f9',
          padding: '10px',
          borderRadius: '4px',
          overflowX: 'auto',
          fontSize: '12px'
        }}>
          {JSON.stringify(currentData, null, 2)}
        </pre>
        
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={limparCache}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              margin: '10px 5px'
            }}
          >
            🗑️ Limpar Cache
          </button>
          
          <button
            onClick={voltarSistema}
            style={{
              background: '#16a34a',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              margin: '10px 5px'
            }}
          >
            ↩️ Voltar ao Sistema
          </button>
        </div>
        
        {cleared && (
          <div style={{
            color: '#16a34a',
            fontWeight: 'bold',
            marginTop: '20px',
            padding: '15px',
            background: '#f0fdf4',
            borderRadius: '6px'
          }}>
            ✅ Cache limpo com sucesso!
            <p style={{ marginTop: '10px', fontWeight: 'normal' }}>
              Agora volte ao sistema e selecione o cliente novamente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
