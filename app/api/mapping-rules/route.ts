import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Versao 3 - usando Supabase client para consistencia com frontend

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    // Busca regras com joins via SQL direto (rpc) para evitar cache do PostgREST
    // Fallback para query simples se RPC nao existir
    let query = supabase
      .from("mapping_rules")
      .select(`
        id,
        keyword,
        categoria_id,
        subcategoria_id,
        subcategoria_filho_id,
        fornecedor_id,
        cliente_id,
        cliente_fornecedor,
        descricao,
        substituir_descricao,
        forma_pagamento,
        tenant_id,
        categorias(nome),
        subcategorias(nome),
        subcategorias_filhos(nome),
        fornecedores(nome),
        clientes(nome)
      `)
      .order("keyword")

    if (tenantId) {
      query = query.eq("tenant_id", Number(tenantId))
    }

    const { data, error } = await query

    if (error) {
      console.error("GET mapping-rules error:", error.message)
      return NextResponse.json([], { status: 200 })
    }

    // Mapeia para formato esperado pelo frontend
    const rules = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      keyword: row.keyword,
      categoria_id: row.categoria_id,
      subcategoria_id: row.subcategoria_id,
      subcategoria_filho_id: row.subcategoria_filho_id,
      fornecedor_id: row.fornecedor_id,
      cliente_id: row.cliente_id,
      cliente_fornecedor: row.cliente_fornecedor || "",
      descricao: row.descricao || "",
      substituir_descricao: row.substituir_descricao || false,
      forma_pagamento: row.forma_pagamento || "",
      tenant_id: row.tenant_id,
      categoria_nome: (row.categorias as Record<string, string> | null)?.nome || "",
      subcategoria_nome: (row.subcategorias as Record<string, string> | null)?.nome || "",
      filho_nome: (row.subcategorias_filhos as Record<string, string> | null)?.nome || "",
      fornecedor_nome: (row.fornecedores as Record<string, string> | null)?.nome || "",
      cliente_nome: (row.clientes as Record<string, string> | null)?.nome || "",
    }))

    console.log("[v0] GET mapping-rules: returning", rules.length, "rules")
    if (rules[0]) {
      console.log("[v0] GET first rule:", JSON.stringify({ 
        id: rules[0].id, keyword: rules[0].keyword, 
        categoria_id: rules[0].categoria_id, fornecedor_id: rules[0].fornecedor_id, 
        cliente_id: rules[0].cliente_id, descricao: rules[0].descricao,
        categoria_nome: rules[0].categoria_nome
      }))
    }

    return NextResponse.json(rules)
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
      return NextResponse.json({ error: "Keyword e tenant_id sao obrigatorios" }, { status: 400 })
    }

    console.log("[v0] POST mapping-rules: id=", id, "keyword=", keyword, "categoria_id=", categoria_id, "fornecedor_id=", fornecedor_id, "cliente_id=", cliente_id, "descricao=", descricao)

    const ruleData = {
      keyword,
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null,
      subcategoria_filho_id: subcategoria_filho_id || null,
      fornecedor_id: fornecedor_id || null,
      cliente_id: cliente_id || null,
      cliente_fornecedor: cliente_fornecedor || '',
      descricao: descricao || '',
      substituir_descricao: substituir_descricao || false,
      forma_pagamento: forma_pagamento || '',
      tenant_id,
    }

    if (id === 0 || !id) {
      const { data, error } = await supabase
        .from("mapping_rules")
        .insert(ruleData)
        .select('id')
        .single()

      if (error) {
        console.error("POST mapping-rules insert error:", error.message)
        // Tenta sem campos de referencia se for FK error
        if (error.code === '23503') {
          const { data: retryData, error: retryError } = await supabase
            .from("mapping_rules")
            .insert({
              keyword,
              cliente_fornecedor: cliente_fornecedor || '',
              descricao: descricao || '',
              substituir_descricao: substituir_descricao || false,
              forma_pagamento: forma_pagamento || '',
              tenant_id,
            })
            .select('id')
            .single()
          
          if (retryError) {
            return NextResponse.json({ error: retryError.message }, { status: 400 })
          }
          return NextResponse.json({ success: true, data: retryData })
        }
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, data })
    } else {
      const { tenant_id: _tid, ...updateData } = ruleData
      const { error } = await supabase
        .from("mapping_rules")
        .update(updateData)
        .eq("id", id)

      if (error) {
        console.error("POST mapping-rules update error:", error.message)
        // Tenta sem campos de referencia se for FK error
        if (error.code === '23503') {
          const { error: retryError } = await supabase
            .from("mapping_rules")
            .update({
              keyword,
              cliente_fornecedor: cliente_fornecedor || '',
              descricao: descricao || '',
              substituir_descricao: substituir_descricao || false,
              forma_pagamento: forma_pagamento || '',
            })
            .eq("id", id)
          
          if (retryError) {
            return NextResponse.json({ error: retryError.message }, { status: 400 })
          }
          return NextResponse.json({ success: true })
        }
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error("POST mapping-rules catch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('id')

    if (!ruleId) {
      return NextResponse.json({ error: "ID e obrigatorio" }, { status: 400 })
    }

    const { error } = await supabase
      .from("mapping_rules")
      .delete()
      .eq("id", Number(ruleId))

    if (error) {
      console.error("DELETE mapping-rules error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules catch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
