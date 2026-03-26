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
      .select("descricao, cliente_fornecedor")
      .eq("id", Number(id))
      .single()
    
    if (error) {
      console.log("[v0] GET erro supabase client, tentando RPC:", error.message)
      // Fallback: tenta via RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_mapping_rule_full', { p_id: Number(id) })
      if (rpcError) {
        console.log("[v0] GET erro RPC:", rpcError.message)
        return NextResponse.json({ descricao: '', cliente_fornecedor: '' })
      }
      return NextResponse.json(rpcData || { descricao: '', cliente_fornecedor: '' })
    }
    
    return NextResponse.json({
      descricao: data?.descricao || '',
      cliente_fornecedor: data?.cliente_fornecedor || '',
    })
  } catch (e) {
    console.log("[v0] GET catch:", e)
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
    
    const fullData = {
      keyword,
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null,
      subcategoria_filho_id: subcategoria_filho_id || null,
      cliente_fornecedor: cliente_fornecedor || '',
      descricao: descricao || '',
      tenant_id,
    }
    
    if (id === 0) {
      // Tenta insert com todos os campos
      const { data, error } = await supabase
        .from("mapping_rules")
        .insert(fullData)
        .select('id')
        .single()
      
      if (error) {
        console.log("[v0] POST insert com descricao falhou:", error.message)
        // Fallback: sem descricao
        const { keyword: kw, categoria_id: cat, subcategoria_id: sub, subcategoria_filho_id: subf, cliente_fornecedor: cf, tenant_id: tid } = fullData
        const { data: d2, error: e2 } = await supabase
          .from("mapping_rules")
          .insert({ keyword: kw, categoria_id: cat, subcategoria_id: sub, subcategoria_filho_id: subf, cliente_fornecedor: cf, tenant_id: tid })
          .select('id')
          .single()
        if (e2) {
          return NextResponse.json({ error: e2.message }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: d2 })
      }
      return NextResponse.json({ success: true, data })
    } else {
      // Tenta update com todos os campos
      const { tenant_id: _tid, ...updateData } = fullData
      const { error } = await supabase
        .from("mapping_rules")
        .update(updateData)
        .eq("id", id)
      
      if (error) {
        console.log("[v0] POST update com descricao falhou:", error.message)
        // Fallback: sem descricao
        const { descricao: _d, ...basicData } = updateData
        const { error: e2 } = await supabase
          .from("mapping_rules")
          .update(basicData)
          .eq("id", id)
        if (e2) {
          return NextResponse.json({ error: e2.message }, { status: 400 })
        }
      }
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error("[v0] POST catch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
