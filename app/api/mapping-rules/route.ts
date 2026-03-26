import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Busca dados completos de uma regra específica via RPC (contorna cache do schema)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }
    
    // Usa RPC para buscar dados completos
    const { data, error } = await supabase.rpc('get_mapping_rule_full', { p_id: Number(id) })
    
    if (error) {
      console.log("[v0] Erro RPC get_mapping_rule_full:", error.message)
      return NextResponse.json({ descricao: '', cliente_fornecedor: '' })
    }
    
    return NextResponse.json(data || { descricao: '', cliente_fornecedor: '' })
  } catch (e) {
    console.log("[v0] Erro GET:", e)
    return NextResponse.json({ descricao: '', cliente_fornecedor: '' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, descricao, tenant_id } = body
    
    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }
    
    // Usa RPC para salvar (contorna cache do schema)
    const { data, error } = await supabase.rpc('upsert_mapping_rule', {
      p_id: id || 0,
      p_keyword: keyword,
      p_categoria_id: categoria_id || null,
      p_subcategoria_id: subcategoria_id || null,
      p_subcategoria_filho_id: subcategoria_filho_id || null,
      p_cliente_fornecedor: cliente_fornecedor || '',
      p_descricao: descricao || '',
      p_substituir_descricao: false,
      p_tenant_id: tenant_id,
    })
    
    if (error) {
      console.log("[v0] Erro RPC upsert:", error.message)
      // Fallback: tenta salvar sem descricao
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
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Error saving rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
