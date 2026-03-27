import { NextRequest, NextResponse } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function callRpc(functionName: string, params: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(params),
  })
  
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText)
  }
  
  return res.json()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const tenantId = searchParams.get('tenant_id')

    if (id) {
      const data = await callRpc('get_mapping_rule_by_id', { p_id: Number(id) })
      return NextResponse.json(data)
    }

    const data = await callRpc('get_mapping_rules', { p_tenant_id: tenantId ? Number(tenantId) : null })
    return NextResponse.json(data || [])
  } catch (e) {
    console.error("GET mapping-rules error:", e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id } = body

    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id são obrigatórios" }, { status: 400 })
    }

    const data = await callRpc('upsert_mapping_rule', {
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

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    console.error("POST mapping-rules error:", error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('not present in table') || errMsg.includes('violates foreign key')) {
      return NextResponse.json({ error: `Referência inválida: ${errMsg}` }, { status: 400 })
    }
    return NextResponse.json({ error: errMsg || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }

    await callRpc('delete_mapping_rule', { p_id: Number(id) })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
