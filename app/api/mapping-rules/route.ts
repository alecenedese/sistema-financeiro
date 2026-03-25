import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, descricao, substituir_descricao, tenant_id } = body
    
    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
    }
    
    // Usa REST API diretamente para contornar cache do schema
    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/upsert_mapping_rule`
    
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_id: id || 0,
        p_keyword: keyword,
        p_categoria_id: categoria_id || null,
        p_subcategoria_id: subcategoria_id || null,
        p_subcategoria_filho_id: subcategoria_filho_id || null,
        p_cliente_fornecedor: cliente_fornecedor || '',
        p_descricao: descricao || '',
        p_substituir_descricao: substituir_descricao || false,
        p_tenant_id: tenant_id,
      }),
    })
    
    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text()
      console.error("[v0] Erro REST API:", errorText)
      return NextResponse.json({ error: errorText }, { status: 400 })
    }
    
    const data = await rpcResponse.json()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Error saving rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
