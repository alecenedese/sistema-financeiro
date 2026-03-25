import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, descricao, substituir_descricao, tenant_id } = body
    
    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }
    
    // Usa função RPC para contornar cache do schema
    const { data, error } = await supabase.rpc('upsert_mapping_rule', {
      p_id: id || 0,
      p_keyword: keyword,
      p_categoria_id: categoria_id || null,
      p_subcategoria_id: subcategoria_id || null,
      p_subcategoria_filho_id: subcategoria_filho_id || null,
      p_cliente_fornecedor: cliente_fornecedor || '',
      p_descricao: descricao || '',
      p_substituir_descricao: substituir_descricao || false,
      p_tenant_id: tenant_id,
    })
    
    if (error) {
      console.error("[v0] Erro RPC:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Error saving rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
