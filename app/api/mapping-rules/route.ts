import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, tenant_id } = body
    
    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }
    
    // Salva sem os campos descricao e substituir_descricao (problema de cache do Supabase)
    if (id === 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("mapping_rules")
        .insert({
          keyword,
          categoria_id: categoria_id || null,
          subcategoria_id: subcategoria_id || null,
          subcategoria_filho_id: subcategoria_filho_id || null,
          cliente_fornecedor: cliente_fornecedor || '',
          tenant_id,
        })
        .select('id')
        .single()
      
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
      
      return NextResponse.json({ success: true, data: inserted })
    } else {
      const { error: updateError } = await supabase
        .from("mapping_rules")
        .update({
          keyword,
          categoria_id: categoria_id || null,
          subcategoria_id: subcategoria_id || null,
          subcategoria_filho_id: subcategoria_filho_id || null,
          cliente_fornecedor: cliente_fornecedor || '',
        })
        .eq("id", id)
      
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }
      
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error("[v0] Error saving rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
