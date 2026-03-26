import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Busca dados completos de uma regra específica via fetch direto
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }
    
    // Busca diretamente via REST API do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ descricao: '', cliente_fornecedor: '' })
    }
    
    // Chama função RPC via REST
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_mapping_rule_full`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ p_id: Number(id) }),
    })
    
    if (rpcRes.ok) {
      const data = await rpcRes.json()
      return NextResponse.json(data || { descricao: '', cliente_fornecedor: '' })
    }
    
    return NextResponse.json({ descricao: '', cliente_fornecedor: '' })
  } catch (e) {
    console.log("[v0] Erro GET:", e)
    return NextResponse.json({ descricao: '', cliente_fornecedor: '' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, descricao, tenant_id } = body
    
    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
    }
    
    // Tenta usar RPC via REST API
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/upsert_mapping_rule`, {
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
        p_substituir_descricao: false,
        p_tenant_id: tenant_id,
      }),
    })
    
    if (rpcRes.ok) {
      const data = await rpcRes.json()
      return NextResponse.json({ success: true, data })
    }
    
    // Fallback: usa Supabase client para salvar campos básicos
    const supabase = await createClient()
    
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
