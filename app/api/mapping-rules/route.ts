import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, descricao, substituir_descricao, tenant_id } = body
    
    if (id === 0) {
      // New rule - insert sem os campos descricao/substituir_descricao por causa do cache
      const { error: insertError } = await supabase.from("mapping_rules").insert({
        keyword,
        categoria_id,
        subcategoria_id,
        subcategoria_filho_id,
        cliente_fornecedor: cliente_fornecedor || '',
        tenant_id,
      })
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
    } else {
      // Update existing - tenta sem campos problemáticos primeiro
      const { error } = await supabase.from("mapping_rules").update({
        keyword,
        categoria_id,
        subcategoria_id,
        subcategoria_filho_id,
        cliente_fornecedor: cliente_fornecedor || '',
      }).eq("id", id)
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
