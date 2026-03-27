import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    // Usa RPC para buscar todos os campos (contorna cache do PostgREST)
    console.log("[v0] GET mapping-rules: calling RPC get_mapping_rules with tenant_id:", tenantId)
    const { data, error } = await supabase.rpc('get_mapping_rules', {
      p_tenant_id: tenantId ? Number(tenantId) : null
    })
    console.log("[v0] GET mapping-rules RPC result - error:", error?.message, "data type:", typeof data, "data length:", Array.isArray(data) ? data.length : 'not array', "first item:", data?.[0] ? JSON.stringify(data[0]).substring(0, 200) : 'null')

    if (error) {
      console.error("[v0] GET mapping-rules RPC error:", error.message, error.code, error.details)
      // Fallback: busca apenas colunas básicas
      let q = supabase
        .from("mapping_rules")
        .select(`
          id,
          keyword,
          categoria_id,
          subcategoria_id,
          subcategoria_filho_id,
          cliente_fornecedor,
          tenant_id,
          categorias(nome),
          subcategorias(nome),
          subcategorias_filhos(nome)
        `)
        .order("keyword")

      if (tenantId) q = q.eq("tenant_id", Number(tenantId))
      const { data: fallbackData } = await q
      
      const rules = (fallbackData || []).map((row: Record<string, unknown>) => ({
        id: row.id,
        keyword: row.keyword,
        categoria_id: row.categoria_id,
        subcategoria_id: row.subcategoria_id,
        subcategoria_filho_id: row.subcategoria_filho_id,
        fornecedor_id: null,
        cliente_id: null,
        cliente_fornecedor: row.cliente_fornecedor || "",
        descricao: "",
        substituir_descricao: false,
        forma_pagamento: "",
        categoria_nome: (row.categorias as Record<string, string> | null)?.nome || "",
        subcategoria_nome: (row.subcategorias as Record<string, string> | null)?.nome || "",
        filho_nome: (row.subcategorias_filhos as Record<string, string> | null)?.nome || "",
        fornecedor_nome: "",
        cliente_nome: "",
      }))
      return NextResponse.json(rules)
    }

    // RPC retorna JSON com todos os campos e joins
    return NextResponse.json(data || [])
  } catch (e) {
    console.error("GET mapping-rules catch:", e)
    return NextResponse.json([], { status: 200 })
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

    // Usa RPC para salvar todos os campos (contorna cache do PostgREST)
    console.log("[v0] POST mapping-rules: calling RPC upsert_mapping_rule with id:", id, "keyword:", keyword)
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

    console.log("[v0] POST mapping-rules RPC result - error:", error?.message, "data:", JSON.stringify(data))
    if (error) {
      console.error("[v0] POST mapping-rules RPC error:", error.message, error.code, error.details)
      // Fallback: tenta insert/update apenas com colunas básicas
      const ruleData = {
        keyword,
        categoria_id: categoria_id || null,
        subcategoria_id: subcategoria_id || null,
        subcategoria_filho_id: subcategoria_filho_id || null,
        cliente_fornecedor: cliente_fornecedor || '',
        tenant_id,
      }

      if (id === 0 || !id) {
        const { data: insertData, error: insertError } = await supabase
          .from("mapping_rules")
          .insert(ruleData)
          .select('id')
          .single()

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 400 })
        }
        return NextResponse.json({ success: true, data: insertData })
      } else {
        const { tenant_id: _tid, ...updateData } = ruleData
        const { error: updateError } = await supabase
          .from("mapping_rules")
          .update(updateData)
          .eq("id", id)

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }
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

    const { error } = await supabase
      .from("mapping_rules")
      .delete()
      .eq("id", Number(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
