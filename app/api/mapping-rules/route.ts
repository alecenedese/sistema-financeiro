import { NextRequest, NextResponse } from "next/server"
import { Client } from "pg"

// Conexão direta ao PostgreSQL - bypassa o cache de schema do PostgREST
async function createPgClient() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error("POSTGRES_URL not configured")
  }
  const client = new Client({ connectionString })
  await client.connect()
  return client
}

export async function GET(request: NextRequest) {
  let pgClient: Client | null = null
  try {
    pgClient = await createPgClient()
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    // Query com JOINs para buscar nomes das referencias
    const sql = `
      SELECT 
        mr.id, mr.keyword, mr.categoria_id, mr.subcategoria_id, mr.subcategoria_filho_id,
        mr.fornecedor_id, mr.cliente_id, mr.cliente_fornecedor,
        mr.descricao, mr.substituir_descricao, mr.forma_pagamento, mr.tenant_id,
        c.nome as categoria_nome,
        s.nome as subcategoria_nome,
        sf.nome as filho_nome,
        f.nome as fornecedor_nome,
        cl.nome as cliente_nome
      FROM public.mapping_rules mr
      LEFT JOIN public.categorias c ON c.id = mr.categoria_id
      LEFT JOIN public.subcategorias s ON s.id = mr.subcategoria_id
      LEFT JOIN public.subcategorias_filhos sf ON sf.id = mr.subcategoria_filho_id
      LEFT JOIN public.fornecedores f ON f.id = mr.fornecedor_id
      LEFT JOIN public.clientes cl ON cl.id = mr.cliente_id
      ${tenantId ? 'WHERE mr.tenant_id = $1' : ''}
      ORDER BY mr.keyword
    `
    const params = tenantId ? [Number(tenantId)] : []
    const result = await pgClient.query(sql, params)
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("GET mapping-rules error:", error)
    return NextResponse.json([], { status: 200 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}

export async function POST(request: NextRequest) {
  let pgClient: Client | null = null
  const body = await request.json()
  const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id } = body

  if (!keyword || !tenant_id) {
    return NextResponse.json({ error: "Keyword e tenant_id sao obrigatorios" }, { status: 400 })
  }

  try {
    pgClient = await createPgClient()

    if (id === 0 || !id) {
      const result = await pgClient.query(
        `INSERT INTO public.mapping_rules 
          (keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [keyword, categoria_id || null, subcategoria_id || null, subcategoria_filho_id || null, fornecedor_id || null, cliente_id || null, cliente_fornecedor || '', descricao || '', substituir_descricao || false, forma_pagamento || '', tenant_id]
      )
      return NextResponse.json({ success: true, data: result.rows[0] })
    } else {
      await pgClient.query(
        `UPDATE public.mapping_rules SET
          keyword = $1, categoria_id = $2, subcategoria_id = $3, subcategoria_filho_id = $4,
          fornecedor_id = $5, cliente_id = $6, cliente_fornecedor = $7,
          descricao = $8, substituir_descricao = $9, forma_pagamento = $10
         WHERE id = $11`,
        [keyword, categoria_id || null, subcategoria_id || null, subcategoria_filho_id || null, fornecedor_id || null, cliente_id || null, cliente_fornecedor || '', descricao || '', substituir_descricao || false, forma_pagamento || '', id]
      )
      return NextResponse.json({ success: true })
    }
  } catch (error: unknown) {
    const pgError = error as { code?: string; detail?: string }
    console.error("POST mapping-rules error:", pgError.code, pgError.detail, error)
    if (pgError.code === '23503') {
      return NextResponse.json({ error: `Referencia invalida: ${pgError.detail || 'verifique categoria, subcategoria, cliente ou fornecedor'}` }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}

export async function DELETE(request: NextRequest) {
  let pgClient: Client | null = null
  try {
    pgClient = await createPgClient()
    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('id')

    if (!ruleId) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    await pgClient.query('DELETE FROM public.mapping_rules WHERE id = $1', [Number(ruleId)])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}
