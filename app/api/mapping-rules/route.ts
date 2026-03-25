import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    console.log("[v0] Body recebido:", JSON.stringify(body))
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, tenant_id } = body
    
    if (!keyword || !tenant_id) {
      console.log("[v0] Faltando keyword ou tenant_id")
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }
    
    if (id === 0) {
      // New rule
      const insertData = {
        keyword,
        categoria_id: categoria_id || null,
        subcategoria_id: subcategoria_id || null,
        subcategoria_filho_id: subcategoria_filho_id || null,
        cliente_fornecedor: cliente_fornecedor || '',
        tenant_id,
      }
      console.log("[v0] Inserindo:", JSON.stringify(insertData))
      
      const { data, error: insertError } = await supabase.from("mapping_rules").insert(insertData).select()
      
      console.log("[v0] Resultado insert - data:", JSON.stringify(data), "error:", insertError)
      
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, data })
    } else {
      // Update existing
      const updateData = {
        keyword,
        categoria_id: categoria_id || null,
        subcategoria_id: subcategoria_id || null,
        subcategoria_filho_id: subcategoria_filho_id || null,
        cliente_fornecedor: cliente_fornecedor || '',
      }
      console.log("[v0] Atualizando id:", id, "data:", JSON.stringify(updateData))
      
      const { data, error } = await supabase.from("mapping_rules").update(updateData).eq("id", id).select()
      
      console.log("[v0] Resultado update - data:", JSON.stringify(data), "error:", error)
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, data })
    }
  } catch (error) {
    console.error("[v0] Error saving rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
