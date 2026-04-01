import { NextRequest, NextResponse } from "next/server"
import { Client } from "pg"

async function createPgClient() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  })
  await client.connect()
  return client
}

export async function GET(request: NextRequest) {
  let pgClient: Client | null = null
  try {
    const { searchParams } = new URL(request.url)
    const tenant_id = searchParams.get("tenant_id")

    pgClient = await createPgClient()

    const params: unknown[] = []
    let where = ""
    if (tenant_id) {
      params.push(Number(tenant_id))
      where = `WHERE mr.tenant_id = $1`
    }

    const sql = `
      SELECT
        mr.id,
        mr.keyword,
        mr.categoria_id,
        mr.subcategoria_id,
        mr.subcategoria_filho_id,
        mr.fornecedor_id,
        mr.cliente_id,
        mr.cliente_fornecedor,
        mr.descricao,
        mr.substituir_descricao,
        mr.forma_pagamento,
        mr.tenant_id,
        c.nome AS categoria_nome,
        s.nome AS subcategoria_nome,
        sf.nome AS filho_nome,
        f.nome AS fornecedor_nome,
        cl.nome AS cliente_nome
      FROM public.mapping_rules mr
      LEFT JOIN public.categorias c ON c.id = mr.categoria_id
      LEFT JOIN public.subcategorias s ON s.id = mr.subcategoria_id
      LEFT JOIN public.subcategorias_filhos sf ON sf.id = mr.subcategoria_filho_id
      LEFT JOIN public.fornecedores f ON f.id = mr.fornecedor_id
      LEFT JOIN public.clientes cl ON cl.id = mr.cliente_id
      ${where}
      ORDER BY mr.keyword
    `

    const result = await pgClient.query(sql, params)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("GET mapping-rules error:", error)
    return NextResponse.json({ error: "Erro ao buscar regras" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}

export async function POST(request: NextRequest) {
  let pgClient: Client | null = null
  const body = await request.json()
  const { id, descricao, substituir_descricao, forma_pagamento } = body

  if (!id) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 })
  }

  try {
    pgClient = await createPgClient()

    // Atualiza APENAS os campos de texto que o PostgREST nao reconhece
    await pgClient.query(
      `UPDATE public.mapping_rules SET
        descricao = $1,
        substituir_descricao = $2,
        forma_pagamento = $3
       WHERE id = $4`,
      [descricao || "", substituir_descricao || false, forma_pagamento || "", id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST mapping-rules error:", error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}

export async function DELETE(request: NextRequest) {
  let pgClient: Client | null = null
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 })

    pgClient = await createPgClient()
    await pgClient.query(`DELETE FROM public.mapping_rules WHERE id = $1`, [Number(id)])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules error:", error)
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}
