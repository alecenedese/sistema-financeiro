import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const tenantId = searchParams.get('tenant_id')
    const supabase = await createClient()

    if (id) {
      // Busca regra específica via RPC (contorna cache PostgREST)
      const { data, error } = await supabase.rpc('get_mapping_rule_by_id', { p_id: Number(id) })
      if (error) throw error
      return NextResponse.json(data)
    }

    // Lista todas as regras via RPC
    const { data, error } = await supabase.rpc('get_mapping_rules', { p_tenant_id: tenantId ? Number(tenantId) : null })
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e) {
    console.error("GET mapping-rules error:", e)
    return NextResponse.json([], { status: 200 }) // Retorna array vazio em caso de erro para não quebrar o frontend
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
      console.error("POST mapping-rules RPC error:", error)
      if (error.message?.includes('not present in table')) {
        return NextResponse.json({ error: `Referência inválida: ${error.message}` }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("POST mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }

    const { error } = await supabase.rpc('delete_mapping_rule', { p_id: Number(id) })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
