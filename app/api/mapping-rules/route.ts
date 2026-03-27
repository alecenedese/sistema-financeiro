import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    // Usa apenas colunas que o PostgREST reconhece no cache
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

    const { data, error } = await q

    if (error) {
      console.error("GET mapping-rules error:", error.message)
      return NextResponse.json([], { status: 200 })
    }

    // Mapeia para o formato esperado (campos extras como null/vazio)
    const rules = (data || []).map((row: Record<string, unknown>) => ({
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
  } catch (e) {
    console.error("GET mapping-rules catch:", e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, cliente_fornecedor, tenant_id } = body

    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }

    // Usa apenas colunas que o PostgREST reconhece
    const ruleData = {
      keyword,
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null,
      subcategoria_filho_id: subcategoria_filho_id || null,
      cliente_fornecedor: cliente_fornecedor || '',
      tenant_id,
    }

    if (id === 0 || !id) {
      const { data, error } = await supabase
        .from("mapping_rules")
        .insert(ruleData)
        .select('id')
        .single()

      if (error) {
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
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }
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
