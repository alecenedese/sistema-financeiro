import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Busca dados completos de uma regra (incluindo descricao)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from("mapping_rules")
      .select("id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id")
      .eq("id", Number(id))
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json(data)
  } catch (e) {
    console.error("GET mapping-rules catch:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id } = body
    
    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }
    
    // Usa RPC para contornar o cache de schema do PostgREST
    const { data, error } = await supabase.rpc('upsert_mapping_rule', {
      p_id: id || 0,
      p_keyword: keyword,
      p_categoria_id: categoria_id || null,
      p_subcategoria_id: subcategoria_id || null,
      p_subcategoria_filho_id: subcategoria_filho_id || null,
      p_fornecedor_id: fornecedor_id || null,
      p_cliente_id: cliente_id || null,
      p_cliente_fornecedor: cliente_fornecedor || '',
      p_descricao: descricao || '',
      p_substituir_descricao: substituir_descricao || false,
      p_forma_pagamento: forma_pagamento || '',
      p_tenant_id: tenant_id,
    })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("POST mapping-rules catch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
