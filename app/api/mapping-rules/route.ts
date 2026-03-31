import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Versao 4 - usando Supabase admin client com service role key
// Service role bypassa RLS e tem acesso total

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables")
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    // Query usando colunas que sabemos que existem (evita cache de schema)
    // Depois busca dados relacionados separadamente
    let query = supabase
      .from("mapping_rules")
      .select("*")
      .order("keyword")

    if (tenantId) {
      query = query.eq("tenant_id", Number(tenantId))
    }

    const { data, error } = await query

    if (error) {
      console.error("GET mapping-rules error:", error.message, error.code)
      return NextResponse.json([], { status: 200 })
    }

    // Busca nomes das categorias, subcategorias, fornecedores, clientes
    const rules = await Promise.all((data || []).map(async (row: Record<string, unknown>) => {
      let categoria_nome = ""
      let subcategoria_nome = ""
      let filho_nome = ""
      let fornecedor_nome = ""
      let cliente_nome = ""

      if (row.categoria_id) {
        const { data: cat } = await supabase.from("categorias").select("nome").eq("id", row.categoria_id).single()
        categoria_nome = cat?.nome || ""
      }
      if (row.subcategoria_id) {
        const { data: sub } = await supabase.from("subcategorias").select("nome").eq("id", row.subcategoria_id).single()
        subcategoria_nome = sub?.nome || ""
      }
      if (row.subcategoria_filho_id) {
        const { data: filho } = await supabase.from("subcategorias_filhos").select("nome").eq("id", row.subcategoria_filho_id).single()
        filho_nome = filho?.nome || ""
      }
      if (row.fornecedor_id) {
        const { data: forn } = await supabase.from("fornecedores").select("nome").eq("id", row.fornecedor_id).single()
        fornecedor_nome = forn?.nome || ""
      }
      if (row.cliente_id) {
        const { data: cli } = await supabase.from("clientes").select("nome").eq("id", row.cliente_id).single()
        cliente_nome = cli?.nome || ""
      }

      return {
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
        categoria_nome,
        subcategoria_nome,
        filho_nome,
        fornecedor_nome,
        cliente_nome,
      }
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
    const supabase = createAdminClient()
    const body = await request.json()
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id } = body

    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id sao obrigatorios" }, { status: 400 })
    }

    console.log("[v0] POST mapping-rules: id=", id, "keyword=", keyword, "categoria_id=", categoria_id, "fornecedor_id=", fornecedor_id, "cliente_id=", cliente_id, "descricao=", descricao)

    // Usa select("*") para evitar problemas de cache de schema
    if (id === 0 || !id) {
      const { data, error } = await supabase
        .from("mapping_rules")
        .insert({
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
        })
        .select("id")
        .single()

      if (error) {
        console.error("POST insert error:", error.message, error.code)
        // Retry sem campos de referencia se FK error
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
            .select("id")
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
      const { error } = await supabase
        .from("mapping_rules")
        .update({
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
        })
        .eq("id", id)

      if (error) {
        console.error("POST update error:", error.message, error.code)
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
    const supabase = createAdminClient()
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
